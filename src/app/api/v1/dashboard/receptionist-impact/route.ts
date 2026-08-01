import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeReceptionistImpact } from '@/server/services/sessions.service';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedStaffId = searchParams.get('staffId') || user.id;

    // Check user role
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = profile?.role || 'receptionist';
    const isElevated = role === 'super_admin' || role === 'ceo';

    if (!isElevated && requestedStaffId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to view other staff members.' },
        { status: 403 }
      );
    }

    const impactData = await computeReceptionistImpact(requestedStaffId);
    return NextResponse.json({ data: impactData });
  } catch (err: any) {
    console.error('[receptionist-impact api] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
