'use server';
import 'server-only';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export interface FacilityHoliday {
  id: string;
  label: string;
  holiday_date: string | null;
  is_recurring_weekly: boolean;
  recurring_weekday: number | null;
  created_at: string;
  created_by?: string | null;
}

async function authorizeSettingsAdmin(): Promise<
  | { ok: true; user: { id: string }; admin: ReturnType<typeof createAdminClient> }
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

export async function getFacilityHolidaysAndSettings(): Promise<NextResponse> {
  const auth = await authorizeSettingsAdmin();
  if (!auth.ok) return auth.response;

  const { data: holidays, error: holidaysError } = await auth.admin
    .from('facility_holidays')
    .select('id, label, holiday_date, is_recurring_weekly, recurring_weekday, created_at, created_by')
    .order('created_at', { ascending: false });

  if (holidaysError) {
    return NextResponse.json({ error: holidaysError.message }, { status: 500 });
  }

  const { data: settings } = await auth.admin
    .from('facility_settings')
    .select('qr_rotation_enabled')
    .eq('id', '00000000-0000-0000-0000-000000000000')
    .single();

  return NextResponse.json({
    holidays: holidays || [],
    qr_rotation_enabled: settings?.qr_rotation_enabled ?? true,
  });
}

export async function createFacilityHoliday(request: Request): Promise<NextResponse> {
  const auth = await authorizeSettingsAdmin();
  if (!auth.ok) return auth.response;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { label, holidayDate, isRecurringWeekly, recurringWeekday } = body || {};

  if (!label || typeof label !== 'string' || label.trim() === '') {
    return NextResponse.json({ error: 'Label is required' }, { status: 400 });
  }

  if (isRecurringWeekly) {
    if (typeof recurringWeekday !== 'number' || recurringWeekday < 0 || recurringWeekday > 6) {
      return NextResponse.json(
        { error: 'recurringWeekday must be an integer between 0 and 6 for recurring holidays' },
        { status: 400 }
      );
    }
  } else {
    if (!holidayDate || typeof holidayDate !== 'string' || holidayDate.trim() === '') {
      return NextResponse.json({ error: 'holidayDate is required for non-recurring holidays' }, { status: 400 });
    }
  }

  const insertData = {
    label: label.trim(),
    holiday_date: isRecurringWeekly ? null : holidayDate.trim(),
    is_recurring_weekly: Boolean(isRecurringWeekly),
    recurring_weekday: isRecurringWeekly ? recurringWeekday : null,
    created_by: auth.user.id,
  };

  const { data: holiday, error } = await auth.admin
    .from('facility_holidays')
    .insert(insertData)
    .select('id, label, holiday_date, is_recurring_weekly, recurring_weekday, created_at, created_by')
    .single();

  if (error || !holiday) {
    return NextResponse.json({ error: error?.message || 'Failed to create holiday' }, { status: 500 });
  }

  return NextResponse.json({ holiday });
}

export async function deleteFacilityHoliday(
  _request: Request,
  holidayIdParam?: string
): Promise<NextResponse> {
  const auth = await authorizeSettingsAdmin();
  if (!auth.ok) return auth.response;

  if (!holidayIdParam || typeof holidayIdParam !== 'string') {
    return NextResponse.json({ error: 'Holiday ID is required' }, { status: 400 });
  }

  const { error } = await auth.admin
    .from('facility_holidays')
    .delete()
    .eq('id', holidayIdParam);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function updateQrRotationEnabled(request: Request): Promise<NextResponse> {
  const auth = await authorizeSettingsAdmin();
  if (!auth.ok) return auth.response;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { qrRotationEnabled } = body || {};
  if (typeof qrRotationEnabled !== 'boolean') {
    return NextResponse.json({ error: 'qrRotationEnabled must be a boolean' }, { status: 400 });
  }

  const { error } = await auth.admin
    .from('facility_settings')
    .update({
      qr_rotation_enabled: qrRotationEnabled,
      updated_at: new Date().toISOString(),
    })
    .eq('id', '00000000-0000-0000-0000-000000000000');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, qr_rotation_enabled: qrRotationEnabled });
}
