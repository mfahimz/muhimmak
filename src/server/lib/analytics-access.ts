import 'server-only';
import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/** Roles that may see survey responses and the feedback analysis page. */
export const ANALYTICS_ALLOWED_ROLES = ['super_admin', 'ceo', 'agm', 'manager'] as const;

export type AnalyticsViewer =
  | { status: 'ok'; userId: string; role: string }
  | { status: 'unauthenticated' }
  | { status: 'forbidden' };

/**
 * Resolves the signed in user and checks the role. The proxy matcher does not cover /api and the
 * services use the service role client (bypasses RLS), so every route and page must call this itself.
 */
export async function resolveAnalyticsViewer(): Promise<AnalyticsViewer> {
  const supabase = await createServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { status: 'unauthenticated' };

  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('role, is_active').eq('id', user.id).single();
  // A deactivated user can still hold a valid session for a while, so check the flag as well as the role.
  if (profile?.is_active === false) return { status: 'forbidden' };
  const role = profile?.role || 'receptionist';
  if (!(ANALYTICS_ALLOWED_ROLES as readonly string[]).includes(role)) return { status: 'forbidden' };
  return { status: 'ok', userId: user.id, role };
}

/** For route handlers: a NextResponse to return when access is denied, or null when allowed. */
export async function guardAnalyticsAccess(): Promise<NextResponse | null> {
  const viewer = await resolveAnalyticsViewer();
  if (viewer.status === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (viewer.status === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden: You do not have permission to view survey responses.' }, { status: 403 });
  }
  return null;
}
