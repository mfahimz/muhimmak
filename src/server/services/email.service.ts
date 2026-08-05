import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { resend, RESEND_FROM } from '@/server/lib/resend';
import { deepseek, DEEPSEEK_MODEL } from '@/server/lib/deepseek';
import {
  lowSatisfactionAlertEmail,
  dailySummaryEmail,
  weeklySummaryEmail,
} from '@/server/lib/email-templates';
import { computeWeightedScore } from '@/server/services/sessions.service';

async function resolveRecipientEmails(recipientProfileIds: string[]): Promise<string[]> {
  if (!recipientProfileIds || recipientProfileIds.length === 0) return [];

  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from('profiles')
    .select('notification_email')
    .in('id', recipientProfileIds)
    .eq('is_active', true)
    .not('notification_email', 'is', null);

  if (!profiles || profiles.length === 0) return [];

  return profiles
    .map((p) => p.notification_email?.trim())
    .filter((email): email is string => Boolean(email && email.includes('@')));
}

async function generateEmailNarrative(
  type: 'low_satisfaction_alert' | 'daily_summary' | 'weekly_summary',
  data: Record<string, any>
): Promise<string> {
  const fallbacks: Record<string, string> = {
    low_satisfaction_alert: `<p>A customer session has been flagged for low satisfaction. Please review the details below and follow up as appropriate.</p>`,
    daily_summary: `<p>Here is your daily feedback summary for Al Maraghi. Review the metrics below for an overview of today's customer sessions.</p>`,
    weekly_summary: `<p>Here is your weekly feedback summary for Al Maraghi. Review the metrics below for a comprehensive overview of this week's customer sessions.</p>`,
  };

  const prompts: Record<string, string> = {
    low_satisfaction_alert: `You are writing a concise, professional email notification for Al Maraghi, a UAE automotive service facility. A customer feedback session scored ${data.score}% which is below the alert threshold of ${data.threshold}%. The form used was "${data.formName}". Write 2-3 sentences: acknowledge the low score urgently but professionally, suggest the team follow up with the customer if possible, and note the severity (${data.score < data.threshold * 0.5 ? 'critical — immediate action recommended' : 'concerning — review recommended'}). Write in English. Output only plain HTML paragraphs (<p> tags), no headings, no bullet points, no markdown.`,
    
    daily_summary: `You are writing a concise daily summary email for Al Maraghi, a UAE automotive service facility. Today's data: ${data.totalSessions} total sessions, ${data.completedSessions} completed, average score ${data.averageScore !== null ? data.averageScore + '%' : 'unavailable'}, ${data.lowScoreCount} low-score alerts. Write 2-3 sentences providing a professional narrative analysis of today's performance. If average score is high (above 70%), be positive. If low score count is high, flag concern. If no sessions, note the quiet day. Write in English. Output only plain HTML paragraphs (<p> tags), no headings, no bullet points, no markdown.`,
    
    weekly_summary: `You are writing a weekly performance summary email for Al Maraghi, a UAE automotive service facility. This week's data: ${data.totalSessions} total sessions, ${data.completedSessions} completed, average score ${data.averageScore !== null ? data.averageScore + '%' : 'unavailable'}, ${data.lowScoreCount} low-score alerts. Write 3-4 sentences providing a professional narrative analysis of the week's performance. Comment on the volume of feedback, satisfaction trend, and any concerns if low scores are high. If performance was strong, acknowledge it. Write in English. Output only plain HTML paragraphs (<p> tags), no headings, no bullet points, no markdown.`,
  };

  try {
    if (!process.env.DEEPSEEK_API_KEY) throw new Error('No API key');
    const completion = await deepseek.chat.completions.create({
      model: DEEPSEEK_MODEL,
      temperature: 0.5,
      messages: [
        { role: 'system', content: 'You write professional email copy for a UAE automotive service business. Output only clean HTML paragraphs. Never use markdown, bullet points, or headings.' },
        { role: 'user', content: prompts[type] },
      ],
    });
    const text = completion.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('Empty response');
    return text;
  } catch (err) {
    console.error('[email] AI narrative generation failed, using fallback:', err);
    return fallbacks[type];
  }
}

// ---------------------------------------------------------------------------
// Send low satisfaction alert
// Called from sessions.service.ts after a session completes with low score
// ---------------------------------------------------------------------------
export async function sendLowSatisfactionAlert(data: {
  sessionId: string;
  score: number;
  formName: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();

    const { data: notifSetting } = await admin
      .from('notification_settings')
      .select('enabled, recipient_profile_ids, threshold_percent')
      .eq('event_type', 'low_satisfaction_alert')
      .single();

    if (!notifSetting?.enabled) return;
    if (!notifSetting.recipient_profile_ids?.length) return;
    if (data.score >= (notifSetting.threshold_percent ?? 50)) return;

    const recipientEmails = await resolveRecipientEmails(notifSetting.recipient_profile_ids);
    if (!recipientEmails.length) return;

    const narrativeHtml = await generateEmailNarrative('low_satisfaction_alert', {
      score: data.score,
      threshold: notifSetting.threshold_percent ?? 50,
      formName: data.formName,
    });

    const { subject, html } = lowSatisfactionAlertEmail({
      sessionId: data.sessionId,
      score: data.score,
      threshold: notifSetting.threshold_percent ?? 50,
      formName: data.formName,
      date: new Date().toLocaleDateString('en-AE', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      narrativeHtml,
    });

    await resend.emails.send({
      from: RESEND_FROM,
      to: recipientEmails,
      subject,
      html,
    });
  } catch (err) {
    console.error('[email] sendLowSatisfactionAlert failed:', err);
  }
}

// ---------------------------------------------------------------------------
// Send daily summary
// Called by Vercel Cron at 7am UAE time (UTC+4 = 03:00 UTC)
// ---------------------------------------------------------------------------
export async function sendDailySummary(): Promise<void> {
  try {
    const admin = createAdminClient();

    const { data: notifSetting } = await admin
      .from('notification_settings')
      .select('enabled, recipient_profile_ids')
      .eq('event_type', 'daily_summary')
      .single();

    if (!notifSetting?.enabled) return;
    if (!notifSetting.recipient_profile_ids?.length) return;

    const recipientEmails = await resolveRecipientEmails(notifSetting.recipient_profile_ids);
    if (!recipientEmails.length) return;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    const startOfDay = `${dateStr}T00:00:00.000Z`;
    const endOfDay = `${dateStr}T23:59:59.999Z`;

    const { data: sessions } = await admin
      .from('sessions')
      .select('id, form_id, status')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);

    const total = sessions?.length ?? 0;
    const completedSessions = (sessions ?? []).filter((s) => s.status === 'completed');
    const completed = completedSessions.length;

    const completedIds = completedSessions.map((s) => s.id);

    const { data: responses } = completedIds.length > 0
      ? await admin
          .from('responses')
          .select('session_id, answers')
          .in('session_id', completedIds)
      : { data: [] };

    const responseMap = new Map<string, Record<string, any>>();
    (responses ?? []).forEach((r) => {
      responseMap.set(r.session_id, r.answers || {});
    });

    const formIds = Array.from(new Set(completedSessions.map((s) => s.form_id).filter(Boolean)));
    const { data: forms } = formIds.length > 0
      ? await admin
          .from('forms')
          .select('id, fields')
          .in('id', formIds)
      : { data: [] };

    const formMap = new Map<string, any[]>();
    (forms ?? []).forEach((f) => {
      formMap.set(f.id, Array.isArray(f.fields) ? f.fields : []);
    });

    const scores: number[] = [];

    for (const s of completedSessions) {
      const answers = responseMap.get(s.id);
      if (!answers) continue;

      const fields = formMap.get(s.form_id);
      if (!fields) continue;

      const scoreable = fields.filter(
        (f) => f.type === 'star_rating' || f.type === 'multiple_choice' || f.type === 'text' || f.type === 'numeric_scale'
      );
      const totalWeightAssigned = scoreable.reduce((sum, f) => {
        const answer = answers[f.id];
        return answer !== undefined && answer !== null ? sum + (f.weight || 0) : sum;
      }, 0);

      if (totalWeightAssigned > 0) {
        const textScores = answers._textScores || {};
        const { finalScore } = computeWeightedScore(fields, answers, textScores);
        scores.push(finalScore);
      }
    }

    const avgScore =
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null;

    const { data: alertSetting } = await admin
      .from('notification_settings')
      .select('threshold_percent')
      .eq('event_type', 'low_satisfaction_alert')
      .single();

    const threshold = alertSetting?.threshold_percent ?? 50;
    const lowScoreCount = scores.filter((s) => Math.round(s) < threshold).length;

    const narrativeHtml = await generateEmailNarrative('daily_summary', {
      totalSessions: total,
      completedSessions: completed,
      averageScore: avgScore,
      lowScoreCount,
      date: dateStr,
    });

    const { subject, html } = dailySummaryEmail({
      date: yesterday.toLocaleDateString('en-AE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      totalSessions: total,
      completedSessions: completed,
      averageScore: avgScore,
      lowScoreCount,
      narrativeHtml,
    });

    await resend.emails.send({
      from: RESEND_FROM,
      to: recipientEmails,
      subject,
      html,
    });
  } catch (err) {
    console.error('[email] sendDailySummary failed:', err);
  }
}

// ---------------------------------------------------------------------------
// Send weekly summary
// Called by Vercel Cron every Monday at 7am UAE time (03:00 UTC)
// ---------------------------------------------------------------------------
export async function sendWeeklySummary(): Promise<void> {
  try {
    const admin = createAdminClient();

    const { data: notifSetting } = await admin
      .from('notification_settings')
      .select('enabled, recipient_profile_ids')
      .eq('event_type', 'weekly_summary')
      .single();

    if (!notifSetting?.enabled) return;
    if (!notifSetting.recipient_profile_ids?.length) return;

    const recipientEmails = await resolveRecipientEmails(notifSetting.recipient_profile_ids);
    if (!recipientEmails.length) return;

    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - 7);
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - 1);

    const startStr = monday.toISOString().split('T')[0] + 'T00:00:00.000Z';
    const endStr = sunday.toISOString().split('T')[0] + 'T23:59:59.999Z';

    const { data: sessions } = await admin
      .from('sessions')
      .select('id, form_id, status')
      .gte('created_at', startStr)
      .lte('created_at', endStr);

    const total = sessions?.length ?? 0;
    const completedSessions = (sessions ?? []).filter((s) => s.status === 'completed');
    const completed = completedSessions.length;

    const completedIds = completedSessions.map((s) => s.id);

    const { data: responses } = completedIds.length > 0
      ? await admin
          .from('responses')
          .select('session_id, answers')
          .in('session_id', completedIds)
      : { data: [] };

    const responseMap = new Map<string, Record<string, any>>();
    (responses ?? []).forEach((r) => {
      responseMap.set(r.session_id, r.answers || {});
    });

    const formIds = Array.from(new Set(completedSessions.map((s) => s.form_id).filter(Boolean)));
    const { data: forms } = formIds.length > 0
      ? await admin
          .from('forms')
          .select('id, fields')
          .in('id', formIds)
      : { data: [] };

    const formMap = new Map<string, any[]>();
    (forms ?? []).forEach((f) => {
      formMap.set(f.id, Array.isArray(f.fields) ? f.fields : []);
    });

    const scores: number[] = [];

    for (const s of completedSessions) {
      const answers = responseMap.get(s.id);
      if (!answers) continue;

      const fields = formMap.get(s.form_id);
      if (!fields) continue;

      const scoreable = fields.filter(
        (f) => f.type === 'star_rating' || f.type === 'multiple_choice' || f.type === 'text' || f.type === 'numeric_scale'
      );
      const totalWeightAssigned = scoreable.reduce((sum, f) => {
        const answer = answers[f.id];
        return answer !== undefined && answer !== null ? sum + (f.weight || 0) : sum;
      }, 0);

      if (totalWeightAssigned > 0) {
        const textScores = answers._textScores || {};
        const { finalScore } = computeWeightedScore(fields, answers, textScores);
        scores.push(finalScore);
      }
    }

    const avgScore =
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null;

    const { data: alertSetting } = await admin
      .from('notification_settings')
      .select('threshold_percent')
      .eq('event_type', 'low_satisfaction_alert')
      .single();

    const threshold = alertSetting?.threshold_percent ?? 50;
    const lowScoreCount = scores.filter((s) => Math.round(s) < threshold).length;

    const formatDate = (d: Date) =>
      d.toLocaleDateString('en-AE', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

    const narrativeHtml = await generateEmailNarrative('weekly_summary', {
      totalSessions: total,
      completedSessions: completed,
      averageScore: avgScore,
      lowScoreCount,
    });

    const { subject, html } = weeklySummaryEmail({
      weekStart: formatDate(monday),
      weekEnd: formatDate(sunday),
      totalSessions: total,
      completedSessions: completed,
      averageScore: avgScore,
      lowScoreCount,
      narrativeHtml,
    });

    await resend.emails.send({
      from: RESEND_FROM,
      to: recipientEmails,
      subject,
      html,
    });
  } catch (err) {
    console.error('[email] sendWeeklySummary failed:', err);
  }
}

