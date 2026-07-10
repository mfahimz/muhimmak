import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Admin-privileged Supabase client using the service role key.
 *
 * NEVER import this file from a Client Component or expose it to the
 * browser bundle — the `server-only` import above will throw a build
 * error if that happens. Only use inside route handlers / server actions.
 *
 * This is required for:
 *  - Reading pin_hash / lockout state (bypasses RLS)
 *  - Issuing a real Supabase Auth session for a PIN-verified staff member
 *    via auth.admin.generateLink(), without the staff member ever having
 *    a password.
 */
export function createAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars'
    );
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
