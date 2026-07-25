import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  lowSatisfactionAlertEmail,
  dailySummaryEmail,
  weeklySummaryEmail,
} from '@/server/lib/email-templates';

const MOCK_NARRATIVE = {
  low_satisfaction_alert: `<p>This session has been flagged due to a critically low satisfaction score. The customer's feedback suggests significant dissatisfaction with the service received, and immediate follow-up is strongly recommended.</p><p>Please review the session details below and consider reaching out to the customer directly to address their concerns.</p>`,
  daily_summary: `<p>Today's performance at Al Maraghi showed steady customer engagement with a moderate satisfaction rate across all completed sessions.</p><p>The low-score alert count remains within acceptable bounds, suggesting consistent service quality throughout the day.</p>`,
  weekly_summary: `<p>This week demonstrated strong feedback volume at Al Maraghi, reflecting healthy customer engagement across the service facility.</p><p>Overall satisfaction scores indicate a positive trend, with the team maintaining quality service delivery. The low-score alerts this week warrant a brief review to identify any recurring themes.</p><p>Keep up the strong performance heading into next week.</p>`,
};

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const type = url.searchParams.get('type') || 'low_satisfaction_alert';

  let result: { subject: string; html: string };

  if (type === 'low_satisfaction_alert') {
    result = lowSatisfactionAlertEmail({
      sessionId: 'preview-session-id-001',
      score: 42,
      threshold: 90,
      formName: 'Customer Service Feedback',
      date: new Date().toLocaleDateString('en-AE', {
        day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      }),
      narrativeHtml: MOCK_NARRATIVE.low_satisfaction_alert,
    });
  } else if (type === 'daily_summary') {
    result = dailySummaryEmail({
      date: new Date().toLocaleDateString('en-AE', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      }),
      totalSessions: 14,
      completedSessions: 11,
      averageScore: 78,
      lowScoreCount: 2,
      narrativeHtml: MOCK_NARRATIVE.daily_summary,
    });
  } else {
    const monday = new Date();
    monday.setDate(monday.getDate() - 7);
    result = weeklySummaryEmail({
      weekStart: monday.toLocaleDateString('en-AE', { day: 'numeric', month: 'long', year: 'numeric' }),
      weekEnd: new Date().toLocaleDateString('en-AE', { day: 'numeric', month: 'long', year: 'numeric' }),
      totalSessions: 89,
      completedSessions: 74,
      averageScore: 81,
      lowScoreCount: 7,
      narrativeHtml: MOCK_NARRATIVE.weekly_summary,
    });
  }

  return NextResponse.json(result);
}
