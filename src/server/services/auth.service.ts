import 'server-only';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { writeAuditLog, getClientIp } from '@/lib/audit/log';

const MAX_ATTEMPTS = Number(process.env.PIN_LOGIN_MAX_ATTEMPTS ?? 5);
const LOCKOUT_MINUTES = Number(process.env.PIN_LOGIN_LOCKOUT_MINUTES ?? 15);
const GENERIC_ERROR = 'Incorrect name or PIN. Please try again.';

const loginRequestSchema = z.object({
  name: z.string().trim().min(1).max(100),
  pin: z.string().trim().regex(/^\d{4}$/, 'PIN must be exactly 4 digits'),
});

export async function loginUser(request: Request): Promise<NextResponse> {
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
  const { name, pin } = parsed.data;

  const admin = createAdminClient();

  const { data: candidates, error: fetchError } = await admin
    .from('profiles')
    .select('id, full_name, role, pin_hash, is_active, failed_pin_attempts, locked_until')
    .ilike('full_name', name.replace(/[%_]/g, '\\$&'));

  const profile = candidates?.find(
    (p) => p.full_name.toLowerCase() === name.toLowerCase()
  );

  if (fetchError || !profile) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  if (!profile.is_active) {
    await writeAuditLog({ actorId: profile.id, action: 'login_failed_inactive', ipAddress: ip });
    return NextResponse.json(
      { error: 'This account has been deactivated. Contact an admin.' },
      { status: 403 }
    );
  }

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
      { error: `Too many failed attempts. Try again in ${Math.ceil(retryAfterSeconds / 60)} minute(s).` },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
    );
  }

  if (!profile.pin_hash) {
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
        { error: `Too many failed attempts. Try again in ${LOCKOUT_MINUTES} minute(s).` },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const [, { data: authUser, error: authUserError }] = await Promise.all([
    admin
      .from('profiles')
      .update({ failed_pin_attempts: 0, locked_until: null })
      .eq('id', profile.id),
    admin.auth.admin.getUserById(profile.id),
  ]);

  if (authUserError || !authUser?.user?.email) {
    console.error('[login] missing linked auth user:', authUserError?.message);
    return NextResponse.json(
      { error: 'Account is not fully provisioned. Contact an admin.' },
      { status: 500 }
    );
  }

  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({ type: 'magiclink', email: authUser.user.email });

  if (linkError || !linkData?.properties?.hashed_token) {
    console.error('[login] generateLink failed:', linkError?.message);
    return NextResponse.json({ error: 'Could not start session. Please try again.' }, { status: 500 });
  }

  const supabase = await createServerClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: linkData.properties.hashed_token,
  });

  if (verifyError) {
    console.error('[login] verifyOtp failed:', verifyError.message);
    return NextResponse.json({ error: 'Could not start session. Please try again.' }, { status: 500 });
  }

  writeAuditLog({ actorId: profile.id, action: 'login_success', ipAddress: ip });

  const response = NextResponse.json({
    ok: true,
    profile: { id: profile.id, fullName: profile.full_name, role: profile.role },
  });

  const sessionTimeoutMinutes = Number(process.env.SESSION_TIMEOUT_MINUTES ?? 720);
  response.cookies.set('muhimmak_session_start', new Date().toISOString(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: sessionTimeoutMinutes * 60,
  });

  return response;
}

export async function logoutUser(request: Request): Promise<NextResponse> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.auth.signOut();

  if (user) {
    await writeAuditLog({
      actorId: user.id,
      action: 'logout',
      ipAddress: getClientIp(request),
    });
  }

  const cookieStore = await cookies();
  const response = NextResponse.json({ ok: true });

  const allCookies = cookieStore.getAll();
  allCookies.forEach((cookie) => {
    if (cookie.name.startsWith('sb-') || cookie.name === 'muhimmak_session_start') {
      response.cookies.delete(cookie.name);
      cookieStore.delete(cookie.name);
    }
  });

  response.cookies.delete('muhimmak_session_start');
  cookieStore.delete('muhimmak_session_start');

  return response;
}
