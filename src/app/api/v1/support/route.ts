import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createTicket, getTicketsForUser } from '@/server/services/support.service';

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

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { rawInput } = body;

    if (typeof rawInput !== 'string' || !rawInput.trim()) {
      return NextResponse.json({ error: 'Support ticket input cannot be empty' }, { status: 400 });
    }

    if (rawInput.length > 2000) {
      return NextResponse.json({ error: 'Support ticket exceeds maximum length of 2000 characters' }, { status: 400 });
    }

    const result = await createTicket(user.id, rawInput.trim());

    return NextResponse.json({ success: true, ticketId: result.id });
  } catch (err: any) {
    console.error('[POST /api/v1/support] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = profile?.role || 'receptionist';
    const tickets = await getTicketsForUser({ id: user.id, role });

    return NextResponse.json({ tickets });
  } catch (err: any) {
    console.error('[GET /api/v1/support] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
