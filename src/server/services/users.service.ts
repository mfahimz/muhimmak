'server-only';

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { writeAuditLog, getClientIp } from '@/lib/audit/log';
import { createNotification } from '@/server/services/notifications-center.service';

const VALID_ROLES = ['super_admin', 'ceo', 'agm', 'manager', 'receptionist'] as const;

async function authorizeUserAdmin(): Promise<
  | { ok: true; user: { id: string; email?: string }; admin: ReturnType<typeof createAdminClient> }
  | { ok: false; response: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = profile?.role || 'receptionist';
  const allowedRoles = ['super_admin', 'ceo'];
  if (!allowedRoles.includes(role)) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { ok: true, user, admin };
}

export async function getUsers(_request: Request): Promise<NextResponse> {
  const auth = await authorizeUserAdmin();
  if (!auth.ok) return auth.response;

  const { data: users, error } = await auth.admin
    .from('profiles')
    .select('id, full_name, role, is_active, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ users: users || [] });
}

export async function createUser(request: Request): Promise<NextResponse> {
  const auth = await authorizeUserAdmin();
  if (!auth.ok) return auth.response;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
  }

  const { fullName, role } = body || {};

  if (!fullName || typeof fullName !== 'string' || fullName.trim() === '') {
    return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
  }

  if (!role || typeof role !== 'string' || !VALID_ROLES.includes(role as any)) {
    return NextResponse.json(
      { error: `Role must be one of: ${VALID_ROLES.join(', ')}` },
      { status: 400 }
    );
  }

  const trimmedName = fullName.trim();

  // Generate 4-digit PIN (1000 - 9999)
  const pin = String(Math.floor(1000 + Math.random() * 9000));
  const pinHash = await bcrypt.hash(pin, 10);

  // Generate synthetic email
  const slugified = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'staff';
  const shortRandom = Math.random().toString(36).substring(2, 8);
  const syntheticEmail = `${slugified}-${shortRandom}@muhimmak.local`;

  // Create auth.users record
  const { data: newAuthData, error: authError } = await auth.admin.auth.admin.createUser({
    email: syntheticEmail,
    password: `secure_pass_${Math.random().toString(36).slice(-8)}`,
    email_confirm: true,
    user_metadata: {
      full_name: trimmedName,
      role,
    },
  });

  if (authError || !newAuthData?.user) {
    return NextResponse.json(
      { error: authError?.message || 'Failed to create auth user' },
      { status: 400 }
    );
  }

  const newUserId = newAuthData.user.id;

  // Insert profile row
  const { data: profile, error: profileError } = await auth.admin
    .from('profiles')
    .insert({
      id: newUserId,
      full_name: trimmedName,
      role,
      pin_hash: pinHash,
      is_active: true,
      preferred_locale: 'en',
    })
    .select('id, full_name, role, is_active, created_at')
    .single();

  if (profileError || !profile) {
    // Rollback auth user
    await auth.admin.auth.admin.deleteUser(newUserId).catch(() => {});
    return NextResponse.json(
      { error: profileError?.message || 'Failed to create user profile' },
      { status: 500 }
    );
  }

  // Write audit log entry (NEVER log plaintext PIN)
  await writeAuditLog({
    actorId: auth.user.id,
    action: 'user_created',
    metadata: {
      userId: newUserId,
      role,
    },
    ipAddress: getClientIp(request),
  });

  await createNotification({
    recipientRole: ['super_admin', 'ceo'],
    type: 'user_created',
    title: 'New User Created',
    message: `User "${trimmedName}" (${role}) was created.`,
    metadata: { userId: newUserId, role, createdBy: auth.user.id },
  });

  return NextResponse.json({ user: profile, pin });
}

export async function updateUser(request: Request, userIdParam?: string): Promise<NextResponse> {
  const auth = await authorizeUserAdmin();
  if (!auth.ok) return auth.response;

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // Body may be empty if invalid JSON
  }

  const userId = userIdParam || body.userId;
  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  const { fullName, role } = body;

  if (fullName === undefined && role === undefined) {
    return NextResponse.json(
      { error: 'At least one of fullName or role must be provided' },
      { status: 400 }
    );
  }

  if (role !== undefined && (!VALID_ROLES.includes(role as any))) {
    return NextResponse.json(
      { error: `Role must be one of: ${VALID_ROLES.join(', ')}` },
      { status: 400 }
    );
  }

  // Guard against demoting own account
  if (userId === auth.user.id && role && !['super_admin', 'ceo'].includes(role)) {
    return NextResponse.json(
      { error: 'You cannot demote your own account role.' },
      { status: 400 }
    );
  }

  const updateFields: Record<string, any> = {};
  const changedFields: string[] = [];

  if (fullName !== undefined && typeof fullName === 'string' && fullName.trim() !== '') {
    updateFields.full_name = fullName.trim();
    changedFields.push('full_name');
  }

  if (role !== undefined && typeof role === 'string' && VALID_ROLES.includes(role as any)) {
    updateFields.role = role;
    changedFields.push('role');
  }

  if (Object.keys(updateFields).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { data: updatedProfile, error } = await auth.admin
    .from('profiles')
    .update(updateFields)
    .eq('id', userId)
    .select('id, full_name, role, is_active, created_at')
    .single();

  if (error || !updatedProfile) {
    return NextResponse.json({ error: error?.message || 'Failed to update user' }, { status: 500 });
  }

  // Sync auth metadata
  await auth.admin.auth.admin.updateUserById(userId, {
    user_metadata: {
      full_name: updatedProfile.full_name,
      role: updatedProfile.role,
    },
  }).catch(() => {});

  await writeAuditLog({
    actorId: auth.user.id,
    action: 'user_updated',
    metadata: {
      userId,
      changedFields,
    },
    ipAddress: getClientIp(request),
  });

  return NextResponse.json({ user: updatedProfile });
}

export async function setUserActiveStatus(
  request: Request,
  userIdParam?: string
): Promise<NextResponse> {
  const auth = await authorizeUserAdmin();
  if (!auth.ok) return auth.response;

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
  }

  const userId = userIdParam || body.userId;
  const isActive = body.isActive;

  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  if (typeof isActive !== 'boolean') {
    return NextResponse.json({ error: 'isActive must be a boolean' }, { status: 400 });
  }

  // Guard against deactivating own account
  if (userId === auth.user.id && !isActive) {
    return NextResponse.json(
      { error: 'You cannot deactivate your own account.' },
      { status: 400 }
    );
  }

  const { data: updatedProfile, error } = await auth.admin
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', userId)
    .select('id, full_name, role, is_active, created_at')
    .single();

  if (error || !updatedProfile) {
    return NextResponse.json({ error: error?.message || 'Failed to update user status' }, { status: 500 });
  }

  await writeAuditLog({
    actorId: auth.user.id,
    action: isActive ? 'user_reactivated' : 'user_deactivated',
    metadata: {
      userId,
    },
    ipAddress: getClientIp(request),
  });

  await createNotification({
    recipientRole: ['super_admin', 'ceo'],
    type: isActive ? 'user_reactivated' : 'user_deactivated',
    title: isActive ? 'User Reactivated' : 'User Deactivated',
    message: isActive
      ? `User "${updatedProfile.full_name}" was reactivated.`
      : `User "${updatedProfile.full_name}" was deactivated.`,
    metadata: { userId, isActive, updatedBy: auth.user.id },
  });

  return NextResponse.json({ user: updatedProfile });
}

export async function resetUserPin(
  request: Request,
  userIdParam?: string,
  newPin?: string
): Promise<NextResponse> {
  const auth = await authorizeUserAdmin();
  if (!auth.ok) return auth.response;

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // Body optional if userIdParam is passed
  }

  const userId = userIdParam || body.userId;
  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  const finalPin = newPin || body.newPin;
  if (!finalPin || typeof finalPin !== 'string') {
    return NextResponse.json({ error: 'PIN is required' }, { status: 400 });
  }

  const pinHash = await bcrypt.hash(finalPin, 10);

  const { data: updatedProfile, error } = await auth.admin
    .from('profiles')
    .update({
      pin_hash: pinHash,
      failed_pin_attempts: 0,
      locked_until: null,
    })
    .eq('id', userId)
    .select('id, full_name, role, is_active, created_at')
    .single();

  if (error || !updatedProfile) {
    return NextResponse.json({ error: error?.message || 'Failed to reset PIN' }, { status: 500 });
  }

  await writeAuditLog({
    actorId: auth.user.id,
    action: 'user_pin_reset',
    metadata: {
      userId,
    },
    ipAddress: getClientIp(request),
  });

  await createNotification({
    recipientRole: ['super_admin', 'ceo'],
    type: 'pin_reset',
    title: 'User PIN Reset',
    message: `PIN was reset for user "${updatedProfile.full_name}".`,
    metadata: { userId, resetBy: auth.user.id },
  });

  return NextResponse.json({ user: updatedProfile, pin: finalPin });
}
