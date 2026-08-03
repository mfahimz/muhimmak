import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function PATCH(request: Request) {
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
  const allowedRoles = ['super_admin', 'ceo'];
  if (!allowedRoles.includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    google_review_url,
    review_qr_threshold_percent,
    ai_business_context,
    default_form_id,
    display_orientation,
  } = body || {};

  const updatePayload: Record<string, any> = {
    google_review_url: google_review_url || '',
    review_qr_threshold_percent: typeof review_qr_threshold_percent === 'number' ? review_qr_threshold_percent : 90,
    ai_business_context: ai_business_context || null,
    default_form_id: default_form_id || null,
    updated_at: new Date().toISOString(),
  };

  if (display_orientation) {
    updatePayload.display_orientation = display_orientation;
  }

  // Attempt update with all fields
  let { error } = await admin
    .from('facility_settings')
    .update(updatePayload)
    .eq('id', '00000000-0000-0000-0000-000000000000');

  // Fallback: If display_orientation column does not exist in schema cache yet, retry without it
  if (error && display_orientation && (error.message?.includes('display_orientation') || error.code === 'PGRST204')) {
    delete updatePayload.display_orientation;
    const retry = await admin
      .from('facility_settings')
      .update(updatePayload)
      .eq('id', '00000000-0000-0000-0000-000000000000');
    error = retry.error;
  }

  if (error) {
    return NextResponse.json({ error: error.message || 'Failed to update facility settings' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
