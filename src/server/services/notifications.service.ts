import 'server-only';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export type NotificationEvent =
  | 'low_satisfaction_alert'
  | 'daily_summary'
  | 'weekly_summary';

export interface NotificationSetting {
  id: string;
  event_type: NotificationEvent;
  enabled: boolean;
  recipients: string[];
  threshold_percent: number | null;
}

async function assertSuperAdmin(): Promise<
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
  if (profile?.role !== 'super_admin') {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { ok: true };
}

export async function getNotificationSettings(
  _request: Request
): Promise<NextResponse> {
  const auth = await assertSuperAdmin();
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
  const auth = await assertSuperAdmin();
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const { event_type, enabled, recipients, threshold_percent } = body;

  if (!event_type) {
    return NextResponse.json({ error: 'Missing event_type' }, { status: 400 });
  }

  const validEvents: NotificationEvent[] = [
    'low_satisfaction_alert',
    'daily_summary',
    'weekly_summary',
  ];
  if (!validEvents.includes(event_type)) {
    return NextResponse.json({ error: 'Invalid event_type' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('notification_settings')
    .update({
      enabled: Boolean(enabled),
      recipients: Array.isArray(recipients) ? recipients : [],
      threshold_percent: threshold_percent ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('event_type', event_type);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
