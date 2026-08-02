import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logRefusal } from '@/server/services/sessions.service';
import { getClientIp } from '@/lib/audit/log';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ip = getClientIp(request);
    const result = await logRefusal(user.id, ip);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[log-refusal api] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to log refusal' },
      { status: 500 }
    );
  }
}
