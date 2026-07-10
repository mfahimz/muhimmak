import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

/**
 * Public (pre-login) endpoint that returns only { id, full_name, role } for
 * active staff, backed by the `staff_directory` view which never selects
 * pin_hash or lockout columns. Safe to call from an unauthenticated client.
 */
export async function GET() {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('staff_directory')
    .select('id, full_name, role')
    .order('full_name', { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: 'Could not load staff directory' },
      { status: 500 }
    );
  }

  return NextResponse.json({ staff: data ?? [] });
}
