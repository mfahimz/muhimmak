import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resetQrNow } from '@/server/services/qr-rotation.service';

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile?.role || !['super_admin', 'ceo'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const result = await resetQrNow();
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Failed to reset QR code manually:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to reset QR code' },
      { status: 500 }
    );
  }
}
