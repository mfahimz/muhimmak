import 'server-only';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export type NotificationEvent =
  | 'low_satisfaction_alert'
  | 'daily_summary'
  | 'weekly_summary'
  | 'daily_qr'
  | 'qr_manual_reset';

export interface NotificationSetting {
  id: string;
  event_type: NotificationEvent;
  enabled: boolean;
  recipient_profile_ids: string[];
  threshold_percent: number | null;
}

async function assertAdminOrCeo(): Promise<
  { ok: true } | { ok: false; response: NextResponse }
> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const allowedRoles = ['super_admin', 'ceo'];
  if (!profile || !allowedRoles.includes(profile.role)) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { ok: true };
}

export async function getNotificationSettings(
  _request: Request
): Promise<NextResponse> {
  const auth = await assertAdminOrCeo();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('notification_settings')
    .select('*')
    .order('event_type');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: data });
}

export async function updateNotificationSettings(
  request: Request
): Promise<NextResponse> {
  const auth = await assertAdminOrCeo();
  if (!auth.ok) return auth.response;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { event_type, enabled, recipient_profile_ids, threshold_percent } = body;

  if (!event_type) {
    return NextResponse.json({ error: 'Missing event_type' }, { status: 400 });
  }

  const validEvents: NotificationEvent[] = [
    'low_satisfaction_alert',
    'daily_summary',
    'weekly_summary',
    'daily_qr',
    'qr_manual_reset',
  ];
  if (!validEvents.includes(event_type)) {
    return NextResponse.json({ error: 'Invalid event_type' }, { status: 400 });
  }

  const profileIds: string[] = Array.isArray(recipient_profile_ids) ? recipient_profile_ids : [];

  const admin = createAdminClient();

  // Validate that all profile IDs exist in profiles table if provided
  if (profileIds.length > 0) {
    const { data: existingProfiles, error: profileCheckError } = await admin
      .from('profiles')
      .select('id')
      .in('id', profileIds);

    if (profileCheckError) {
      return NextResponse.json({ error: profileCheckError.message }, { status: 500 });
    }

    const foundIds = new Set((existingProfiles || []).map((p) => p.id));
    const missingIds = profileIds.filter((id) => !foundIds.has(id));

    if (missingIds.length > 0) {
      return NextResponse.json(
        { error: `One or more recipient profile IDs do not exist: ${missingIds.join(', ')}` },
        { status: 400 }
      );
    }
  }

  const { error } = await admin
    .from('notification_settings')
    .update({
      enabled: Boolean(enabled),
      recipient_profile_ids: profileIds,
      threshold_percent: threshold_percent ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('event_type', event_type);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
