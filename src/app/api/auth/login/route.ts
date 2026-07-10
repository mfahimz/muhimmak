import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loginRequestSchema } from '@/lib/validation/auth';
import { writeAuditLog, getClientIp } from '@/lib/audit/log';

const MAX_ATTEMPTS = Number(process.env.PIN_LOGIN_MAX_ATTEMPTS ?? 5);
const LOCKOUT_MINUTES = Number(process.env.PIN_LOGIN_LOCKOUT_MINUTES ?? 15);

// Generic message on purpose — never reveal whether the PIN or the
// profile selection was the wrong part.
const GENERIC_ERROR = 'Incorrect PIN. Please try again.';

export async function POST(request: Request) {
  const ip = getClientIp(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = loginRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 }
    );
  }
  const { profileId, pin } = parsed.data;

  const admin = createAdminClient();

  const { data: profile, error: fetchError } = await admin
    .from('profiles')
    .select('id, full_name, role, pin_hash, is_active, failed_pin_attempts, locked_until')
    .eq('id', profileId)
    .maybeSingle();

  if (fetchError || !profile) {
    // Don't leak whether the profile exists.
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  if (!profile.is_active) {
    await writeAuditLog({
      actorId: profile.id,
      action: 'login_failed_inactive',
      ipAddress: ip,
    });
    return NextResponse.json(
      { error: 'This account has been deactivated. Contact an admin.' },
      { status: 403 }
    );
  }

  // Enforce lockout window.
  if (profile.locked_until && new Date(profile.locked_until) > new Date()) {
    await writeAuditLog({
      actorId: profile.id,
      action: 'login_failed_locked',
      ipAddress: ip,
      metadata: { locked_until: profile.locked_until },
    });
    const retryAfterSeconds = Math.ceil(
      (new Date(profile.locked_until).getTime() - Date.now()) / 1000
    );
    return NextResponse.json(
      {
        error: `Too many failed attempts. Try again in ${Math.ceil(
          retryAfterSeconds / 60
        )} minute(s).`,
      },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
    );
  }

  if (!profile.pin_hash) {
    // Provisioned account with no PIN set yet.
    return NextResponse.json(
      { error: 'This account has not been set up yet. Contact an admin.' },
      { status: 403 }
    );
  }

  const pinMatches = await bcrypt.compare(pin, profile.pin_hash);

  if (!pinMatches) {
    const nextAttempts = (profile.failed_pin_attempts ?? 0) + 1;
    const shouldLock = nextAttempts >= MAX_ATTEMPTS;

    await admin
      .from('profiles')
      .update({
        failed_pin_attempts: shouldLock ? 0 : nextAttempts,
        locked_until: shouldLock
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString()
          : null,
      })
      .eq('id', profile.id);

    await writeAuditLog({
      actorId: profile.id,
      action: 'login_failed_bad_pin',
      ipAddress: ip,
      metadata: { attempt: nextAttempts, locked: shouldLock },
    });

    if (shouldLock) {
      return NextResponse.json(
        {
          error: `Too many failed attempts. Try again in ${LOCKOUT_MINUTES} minute(s).`,
        },
        { status: 429 }
      );
    }

    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  // --- PIN verified. Reset attempt counter and issue a real session. ---
  await admin
    .from('profiles')
    .update({ failed_pin_attempts: 0, locked_until: null })
    .eq('id', profile.id);

  // profiles.id === auth.users.id (established by the Phase 0-3 auth
  // trigger). The linked Supabase Auth user has a synthetic internal
  // email + random unusable password, created at provisioning time.
  // See the admin-provisioning flow (Phase 4.x) for how this is created.
  const { data: authUser, error: authUserError } =
    await admin.auth.admin.getUserById(profile.id);

  if (authUserError || !authUser?.user?.email) {
    console.error('[login] missing linked auth user:', authUserError?.message);
    return NextResponse.json(
      { error: 'Account is not fully provisioned. Contact an admin.' },
      { status: 500 }
    );
  }

  // Generate a one-time magic link server-side purely to obtain a valid
  // token_hash, then immediately redeem it ourselves via verifyOtp. The
  // staff member never sees a link or email — this is just how Supabase
  // recommends minting a session for a user with no password step.
  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: authUser.user.email,
    });

  if (linkError || !linkData?.properties?.hashed_token) {
    console.error('[login] generateLink failed:', linkError?.message);
    return NextResponse.json(
      { error: 'Could not start session. Please try again.' },
      { status: 500 }
    );
  }

  const supabase = await createServerClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: linkData.properties.hashed_token,
  });

  if (verifyError) {
    console.error('[login] verifyOtp failed:', verifyError.message);
    return NextResponse.json(
      { error: 'Could not start session. Please try again.' },
      { status: 500 }
    );
  }

  await writeAuditLog({
    actorId: profile.id,
    action: 'login_success',
    ipAddress: ip,
  });

  return NextResponse.json({
    ok: true,
    profile: { id: profile.id, fullName: profile.full_name, role: profile.role },
  });
}
