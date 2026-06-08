import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project-id.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

/**
 * Creates a client-side Supabase instance.
 * Safe to call inside Client Components.
 */
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
