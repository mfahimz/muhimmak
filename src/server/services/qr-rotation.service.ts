'use server';
import 'server-only';

import crypto from 'crypto';
import QRCode from 'qrcode';
import { createAdminClient } from '@/lib/supabase/admin';
import { resend, RESEND_FROM } from '@/server/lib/resend';
import { dailyQrEmail, dailyQrFailureAlertEmail } from '@/server/lib/email-templates';
import { createNotification } from '@/server/services/notifications-center.service';

/**
 * Returns today's date formatted as YYYY-MM-DD in UAE timezone (Asia/Dubai)
 */
export async function getUaeDateString(date: Date = new Date()): Promise<string> {
  const formatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Dubai' });
  return formatter.format(date);
}

/**
 * Returns weekday index (0=Sunday..6=Saturday) in UAE timezone
 */
export async function getUaeWeekday(date: Date = new Date()): Promise<number> {
  const uaeStr = date.toLocaleString('en-US', { timeZone: 'Asia/Dubai' });
  return new Date(uaeStr).getDay();
}

/**
 * Checks if a given date is a holiday or recurring day off according to facility_holidays
 */
export async function isHoliday(date: Date = new Date()): Promise<{ isHoliday: boolean; label?: string }> {
  const admin = createAdminClient();
  const dateStr = await getUaeDateString(date);
  const weekday = await getUaeWeekday(date);

  // 1. Check exact holiday date
  const { data: exactHolidays } = await admin
    .from('facility_holidays')
    .select('id, label')
    .eq('is_recurring_weekly', false)
    .eq('holiday_date', dateStr)
    .limit(1);

  if (exactHolidays && exactHolidays.length > 0) {
    return { isHoliday: true, label: exactHolidays[0].label };
  }

  // 2. Check recurring weekday day off
  const { data: recurringHolidays } = await admin
    .from('facility_holidays')
    .select('id, label')
    .eq('is_recurring_weekly', true)
    .eq('recurring_weekday', weekday)
    .limit(1);

  if (recurringHolidays && recurringHolidays.length > 0) {
    return { isHoliday: true, label: recurringHolidays[0].label };
  }

  return { isHoliday: false };
}

const DEFAULT_ADMIN_ALERT_EMAIL = 'binfah222@gmail.com';

/**
 * Returns list of admin emails to receive critical delivery failure alerts
 */
export async function getAdminAlertEmails(): Promise<string[]> {
  try {
    const admin = createAdminClient();
    const { data: superAdmins } = await admin
      .from('profiles')
      .select('notification_email')
      .eq('role', 'super_admin')
      .eq('is_active', true)
      .not('notification_email', 'is', null);

    const emails = (superAdmins || [])
      .map((sa) => sa.notification_email?.trim())
      .filter((e): e is string => Boolean(e && e.includes('@')));

    if (!emails.includes(DEFAULT_ADMIN_ALERT_EMAIL)) {
      emails.push(DEFAULT_ADMIN_ALERT_EMAIL);
    }
    return emails;
  } catch {
    return [DEFAULT_ADMIN_ALERT_EMAIL];
  }
}

/**
 * Dispatches an email alert to the admin(s) and creates an in-app notification for super_admin
 */
export async function notifyAdminQrFailure(data: {
  recipientEmail?: string;
  recipientName?: string;
  errorReason: string;
  diagnosticDetails?: string;
  dateLabel: string;
  feedbackUrl?: string;
}): Promise<void> {
  try {
    const adminEmails = await getAdminAlertEmails();
    if (!adminEmails.length) return;

    const template = dailyQrFailureAlertEmail({
      recipientEmail: data.recipientEmail || 'Unassigned / System',
      recipientName: data.recipientName,
      errorReason: data.errorReason,
      diagnosticDetails: data.diagnosticDetails,
      dateLabel: data.dateLabel,
      feedbackUrl: data.feedbackUrl,
    });

    await Promise.all(
      adminEmails.map(async (adminEmail) => {
        try {
          const { error } = await resend.emails.send({
            from: RESEND_FROM,
            to: adminEmail,
            subject: template.subject,
            html: template.html,
          });
          if (error) {
            console.error(`[qr-rotation] Failed to send admin alert to ${adminEmail}:`, error);
          }
        } catch (err) {
          console.error(`[qr-rotation] Network error sending admin alert to ${adminEmail}:`, err);
        }
      })
    );
  } catch (err) {
    console.error('[qr-rotation] notifyAdminQrFailure failed:', err);
  }
}

/**
 * Helper to record in-app notification and prevent duplicate alerts for the same issue
 */
async function alertAdminOnce(params: {
  alertKey: string;
  recipientEmail?: string;
  recipientName?: string;
  errorReason: string;
  diagnosticDetails?: string;
  dateLabel: string;
  feedbackUrl?: string;
}): Promise<boolean> {
  try {
    const admin = createAdminClient();

    const { data: existing } = await admin
      .from('notifications')
      .select('id')
      .eq('type', 'daily_qr_failure_alert')
      .filter('metadata->>alertKey', 'eq', params.alertKey)
      .limit(1);

    if (existing && existing.length > 0) {
      return false;
    }

    await notifyAdminQrFailure(params);

    await createNotification({
      recipientRole: ['super_admin', 'ceo'],
      type: 'daily_qr_failure_alert',
      title: `Daily QR Issue: ${params.errorReason}`,
      message: `Daily QR delivery issue for ${params.recipientEmail || 'receptionist'}: ${params.errorReason}. ${params.diagnosticDetails || ''}`.trim(),
      metadata: {
        alertKey: params.alertKey,
        dateLabel: params.dateLabel,
        recipientEmail: params.recipientEmail,
        errorReason: params.errorReason,
        diagnosticDetails: params.diagnosticDetails,
        feedbackUrl: params.feedbackUrl,
      },
    });

    return true;
  } catch (err) {
    console.error('[qr-rotation] alertAdminOnce error:', err);
    return false;
  }
}

/**
 * Rotates the daily QR token, updates facility_settings, and dispatches notification emails
 */
export async function rotateQrToken(): Promise<{
  skipped: boolean;
  reason?: string;
  token?: string;
  url?: string;
  recipientCount?: number;
}> {
  const admin = createAdminClient();
  const todayDateStr = await getUaeDateString();

  // 1. Fetch facility_settings
  const { data: settings, error: settingsError } = await admin
    .from('facility_settings')
    .select('qr_rotation_enabled, current_qr_token, qr_token_date')
    .eq('id', '00000000-0000-0000-0000-000000000000')
    .single();

  if (settingsError || !settings) {
    throw new Error('Failed to load facility settings');
  }

  if (settings.qr_rotation_enabled === false) {
    return { skipped: true, reason: 'Daily QR rotation is disabled in settings.' };
  }

  // 2. Check holiday status
  const holidayCheck = await isHoliday();
  if (holidayCheck.isHoliday) {
    return {
      skipped: true,
      reason: `Today (${todayDateStr}) is a scheduled holiday / day off: ${holidayCheck.label || 'Holiday'}.`,
    };
  }

  // 3. Generate token & full URL
  const token = crypto.randomUUID();
  const fullUrl = `https://muhimmak.misalm.com/feedback/${token}`;

  // 4. Update facility_settings singleton
  const { error: updateError } = await admin
    .from('facility_settings')
    .update({
      current_qr_token: token,
      qr_token_date: todayDateStr,
      updated_at: new Date().toISOString(),
    })
    .eq('id', '00000000-0000-0000-0000-000000000000');

  if (updateError) {
    throw new Error(`Failed to update QR token in database: ${updateError.message}`);
  }

  // 5. Generate QR Code PNG Buffer
  const qrBuffer = await QRCode.toBuffer(fullUrl, {
    type: 'png',
    margin: 1,
    width: 400,
  });

  // 6. Query recipient notification emails from notification_settings for 'daily_qr'
  const { data: notifSetting } = await admin
    .from('notification_settings')
    .select('enabled, recipient_profile_ids')
    .eq('event_type', 'daily_qr')
    .single();

  let emailList: string[] = [];
  if (notifSetting?.enabled && notifSetting.recipient_profile_ids?.length) {
    const { data: profileRecipients } = await admin
      .from('profiles')
      .select('notification_email')
      .in('id', notifSetting.recipient_profile_ids)
      .eq('is_active', true)
      .not('notification_email', 'is', null);

    emailList = (profileRecipients || [])
      .map((r) => r.notification_email?.trim())
      .filter((e): e is string => Boolean(e && e.includes('@')));

    // If recipients are assigned in settings but none have a valid email configured, alert admin
    if (emailList.length === 0) {
      await alertAdminOnce({
        alertKey: `no_valid_emails_${todayDateStr}`,
        recipientEmail: 'Assigned profiles lack valid emails',
        errorReason: 'No Valid Recipient Email Configured',
        diagnosticDetails: `Daily QR has ${notifSetting.recipient_profile_ids.length} recipient ID(s) assigned, but none have an active notification_email set in profiles.`,
        dateLabel: todayDateStr,
        feedbackUrl: fullUrl,
      });
    }
  }

  let recipientCount = 0;

  if (emailList.length > 0) {
    const template = dailyQrEmail({
      feedbackUrl: fullUrl,
      dateLabel: todayDateStr,
      qrCid: 'qrcode',
    });

    const sendPromises = emailList.map(async (recipientEmail) => {
      try {
        const { data, error } = await resend.emails.send({
          from: RESEND_FROM,
          to: recipientEmail,
          subject: template.subject,
          html: template.html,
          attachments: [
            {
              filename: 'qrcode.png',
              content: qrBuffer,
              contentId: 'qrcode',
            },
          ],
        });

        if (error) {
          console.error(`Failed to send daily QR email to ${recipientEmail}:`, error);
          await alertAdminOnce({
            alertKey: `send_error_${todayDateStr}_${recipientEmail}`,
            recipientEmail,
            errorReason: `Resend API Error: ${error.name || 'Dispatch Error'}`,
            diagnosticDetails: `${error.message} (status: ${error.statusCode || 'unknown'})`,
            dateLabel: todayDateStr,
            feedbackUrl: fullUrl,
          });
          return null;
        }

        return data;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`Failed to send daily QR email to ${recipientEmail}:`, err);
        await alertAdminOnce({
          alertKey: `send_exception_${todayDateStr}_${recipientEmail}`,
          recipientEmail,
          errorReason: 'Network/Transport Exception during dispatch',
          diagnosticDetails: errorMsg,
          dateLabel: todayDateStr,
          feedbackUrl: fullUrl,
        });
        return null;
      }
    });

    const results = await Promise.all(sendPromises);
    recipientCount = results.filter(Boolean).length;
  }

  return {
    skipped: false,
    token,
    url: fullUrl,
    recipientCount,
  };
}

/**
 * Returns current QR rotation info for in-app dashboard viewer
 */
export async function getTodayQrInfo(): Promise<{
  current_qr_token: string | null;
  qr_token_date: string | null;
  is_today_valid: boolean;
  qr_rotation_enabled: boolean;
  feedback_url: string | null;
  today_date_str: string;
  holiday_info?: { isHoliday: boolean; label?: string };
}> {
  const admin = createAdminClient();
  const todayDateStr = await getUaeDateString();

  const { data: settings } = await admin
    .from('facility_settings')
    .select('current_qr_token, qr_token_date, qr_rotation_enabled')
    .eq('id', '00000000-0000-0000-0000-000000000000')
    .single();

  const currentToken = settings?.current_qr_token || null;
  const tokenDate = settings?.qr_token_date || null;
  const enabled = settings?.qr_rotation_enabled ?? true;
  const isTodayValid = currentToken !== null && tokenDate === todayDateStr;

  const holidayInfo = await isHoliday();

  return {
    current_qr_token: currentToken,
    qr_token_date: tokenDate,
    is_today_valid: isTodayValid,
    qr_rotation_enabled: enabled,
    feedback_url: isTodayValid ? `https://muhimmak.misalm.com/feedback/${currentToken}` : null,
    today_date_str: todayDateStr,
    holiday_info: holidayInfo,
  };
}

/**
 * Validates whether a token matches today's active rotating QR token
 */
export async function validateQrToken(token: string): Promise<boolean> {
  if (!token || typeof token !== 'string' || token.trim() === '') {
    return false;
  }

  const admin = createAdminClient();
  const todayDateStr = await getUaeDateString();

  const { data: settings } = await admin
    .from('facility_settings')
    .select('current_qr_token, qr_token_date')
    .eq('id', '00000000-0000-0000-0000-000000000000')
    .single();

  if (!settings || !settings.current_qr_token || !settings.qr_token_date) {
    return false;
  }

  return (
    settings.current_qr_token === token.trim() &&
    settings.qr_token_date === todayDateStr
  );
}

/**
 * Generates a test/preview QR token and URL without updating DB or sending emails
 */
export async function generateTestQr(): Promise<{ token: string; url: string }> {
  const token = crypto.randomUUID();
  const url = `https://muhimmak.misalm.com/feedback/${token}`;
  return { token, url };
}

/**
 * Manually rotates the daily QR token immediately, bypassing rotation enabled and holiday checks
 */
export async function resetQrNow(): Promise<{
  skipped: boolean;
  token?: string;
  url?: string;
  recipientCount?: number;
}> {
  const admin = createAdminClient();
  const todayDateStr = await getUaeDateString();

  // 1. Generate token & full URL
  const token = crypto.randomUUID();
  const fullUrl = `https://muhimmak.misalm.com/feedback/${token}`;

  // 2. Update facility_settings singleton
  const { error: updateError } = await admin
    .from('facility_settings')
    .update({
      current_qr_token: token,
      qr_token_date: todayDateStr,
      updated_at: new Date().toISOString(),
    })
    .eq('id', '00000000-0000-0000-0000-000000000000');

  if (updateError) {
    throw new Error(`Failed to update QR token in database: ${updateError.message}`);
  }

  // 3. Generate QR Code PNG Buffer
  const qrBuffer = await QRCode.toBuffer(fullUrl, {
    type: 'png',
    margin: 1,
    width: 400,
  });

  // 4. Query recipient notification emails from notification_settings for 'qr_manual_reset'
  const { data: notifSetting } = await admin
    .from('notification_settings')
    .select('enabled, recipient_profile_ids')
    .eq('event_type', 'qr_manual_reset')
    .single();

  let emailList: string[] = [];
  if (notifSetting?.enabled && notifSetting.recipient_profile_ids?.length) {
    const { data: profileRecipients } = await admin
      .from('profiles')
      .select('notification_email')
      .in('id', notifSetting.recipient_profile_ids)
      .eq('is_active', true)
      .not('notification_email', 'is', null);

    emailList = (profileRecipients || [])
      .map((r) => r.notification_email?.trim())
      .filter((e): e is string => Boolean(e && e.includes('@')));

    if (emailList.length === 0) {
      await alertAdminOnce({
        alertKey: `manual_reset_no_valid_emails_${todayDateStr}`,
        recipientEmail: 'Assigned profiles lack valid emails',
        errorReason: 'No Valid Recipient Email Configured for Manual Reset',
        diagnosticDetails: `QR Manual Reset has ${notifSetting.recipient_profile_ids.length} recipient ID(s) assigned, but none have an active notification_email set in profiles.`,
        dateLabel: todayDateStr,
        feedbackUrl: fullUrl,
      });
    }
  }

  let recipientCount = 0;

  if (emailList.length > 0) {
    const template = dailyQrEmail({
      feedbackUrl: fullUrl,
      dateLabel: todayDateStr,
      qrCid: 'qrcode',
      isManualReset: true,
    });

    const sendPromises = emailList.map(async (recipientEmail) => {
      try {
        const { data, error } = await resend.emails.send({
          from: RESEND_FROM,
          to: recipientEmail,
          subject: template.subject,
          html: template.html,
          attachments: [
            {
              filename: 'qrcode.png',
              content: qrBuffer,
              contentId: 'qrcode',
            },
          ],
        });

        if (error) {
          console.error(`Failed to send daily QR reset email to ${recipientEmail}:`, error);
          await alertAdminOnce({
            alertKey: `manual_reset_error_${todayDateStr}_${recipientEmail}`,
            recipientEmail,
            errorReason: `Resend API Error: ${error.name || 'Reset Dispatch Error'}`,
            diagnosticDetails: `${error.message} (status: ${error.statusCode || 'unknown'})`,
            dateLabel: todayDateStr,
            feedbackUrl: fullUrl,
          });
          return null;
        }

        return data;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`Failed to send daily QR reset email to ${recipientEmail}:`, err);
        await alertAdminOnce({
          alertKey: `manual_reset_exception_${todayDateStr}_${recipientEmail}`,
          recipientEmail,
          errorReason: 'Network/Transport Exception during reset dispatch',
          diagnosticDetails: errorMsg,
          dateLabel: todayDateStr,
          feedbackUrl: fullUrl,
        });
        return null;
      }
    });

    const results = await Promise.all(sendPromises);
    recipientCount = results.filter(Boolean).length;
  }

  return {
    skipped: false,
    token,
    url: fullUrl,
    recipientCount,
  };
}

/**
 * Delivery Health Check Cron Handler:
 * Runs via Vercel Cron (e.g. 05:30 UTC / 09:30 UAE) after daily QR rotation.
 * 1. Checks holiday status / whether rotation is enabled.
 * 2. Verifies if QR rotation executed for today's date.
 * 3. Inspects Resend API for bounced, delivery_delayed, or missing QR emails.
 * 4. Alerts the admin (binfah222@gmail.com) and registers in-app notification if issues are found.
 */
export async function checkDailyQrDeliveryHealth(): Promise<{
  checkedDate: string;
  status: 'healthy' | 'alerted' | 'skipped';
  issues: string[];
}> {
  const admin = createAdminClient();
  const todayDateStr = await getUaeDateString();
  const issues: string[] = [];

  // 1. Check holiday status
  const holidayCheck = await isHoliday();
  if (holidayCheck.isHoliday) {
    return {
      checkedDate: todayDateStr,
      status: 'skipped',
      issues: [`Today (${todayDateStr}) is a scheduled holiday / day off: ${holidayCheck.label || 'Holiday'}`],
    };
  }

  // 2. Fetch facility_settings
  const { data: settings } = await admin
    .from('facility_settings')
    .select('qr_rotation_enabled, current_qr_token, qr_token_date')
    .eq('id', '00000000-0000-0000-0000-000000000000')
    .single();

  if (settings?.qr_rotation_enabled === false) {
    return {
      checkedDate: todayDateStr,
      status: 'skipped',
      issues: ['Daily QR rotation is disabled in facility settings'],
    };
  }

  const fullUrl = settings?.current_qr_token
    ? `https://muhimmak.misalm.com/feedback/${settings.current_qr_token}`
    : undefined;

  // 3. Verify that rotation executed for today
  if (settings?.qr_token_date !== todayDateStr) {
    const reason = `Daily QR rotation cron did not execute for ${todayDateStr}. Current token date in database is ${settings?.qr_token_date || 'none'}.`;
    issues.push(reason);

    await alertAdminOnce({
      alertKey: `rotation_missed_${todayDateStr}`,
      recipientEmail: 'Daily Rotation Cron',
      errorReason: 'Daily QR Rotation Did Not Execute Today',
      diagnosticDetails: reason,
      dateLabel: todayDateStr,
      feedbackUrl: fullUrl,
    });
  }

  // 4. Query notification_settings for 'daily_qr'
  const { data: notifSetting } = await admin
    .from('notification_settings')
    .select('enabled, recipient_profile_ids')
    .eq('event_type', 'daily_qr')
    .single();

  if (!notifSetting?.enabled) {
    return {
      checkedDate: todayDateStr,
      status: issues.length > 0 ? 'alerted' : 'skipped',
      issues: issues.length > 0 ? issues : ['Daily QR notification is disabled in settings'],
    };
  }

  if (!notifSetting.recipient_profile_ids?.length) {
    const reason = 'Daily QR notifications are enabled, but no recipient profiles are assigned.';
    issues.push(reason);
    await alertAdminOnce({
      alertKey: `no_recipients_${todayDateStr}`,
      recipientEmail: 'Unassigned',
      errorReason: 'No Recipients Configured for Daily QR',
      diagnosticDetails: reason,
      dateLabel: todayDateStr,
      feedbackUrl: fullUrl,
    });
  }

  // 5. Query Resend API for recent emails matching today's date
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    issues.push('RESEND_API_KEY is not configured');
    return { checkedDate: todayDateStr, status: 'alerted', issues };
  }

  try {
    const res = await fetch('https://api.resend.com/emails?limit=25', {
      headers: { Authorization: `Bearer ${resendApiKey}` },
    });

    if (!res.ok) {
      issues.push(`Failed to query Resend API: HTTP ${res.status}`);
      return { checkedDate: todayDateStr, status: 'alerted', issues };
    }

    const emailListData = (await res.json()) as { data?: Array<{ id: string; to: string | string[]; subject: string; last_event: string }> };
    const emails = emailListData?.data || [];

    // Filter emails for today's daily QR
    const todayQrEmails = emails.filter((e) =>
      e.subject?.includes(todayDateStr) &&
      (e.subject?.includes('Daily QR Feedback Link') || e.subject?.includes('QR'))
    );

    if (todayQrEmails.length === 0 && notifSetting.recipient_profile_ids?.length) {
      const reason = `No Daily QR emails were recorded in Resend for date ${todayDateStr}.`;
      issues.push(reason);
      await alertAdminOnce({
        alertKey: `no_resend_emails_${todayDateStr}`,
        recipientEmail: 'Configured recipient(s)',
        errorReason: 'No Daily QR Email Sent via Resend',
        diagnosticDetails: reason,
        dateLabel: todayDateStr,
        feedbackUrl: fullUrl,
      });
    }

    for (const email of todayQrEmails) {
      const isFailed = email.last_event === 'bounced';
      const isDelayed = email.last_event === 'delivery_delayed';
      const isComplained = email.last_event === 'complained';

      if (isFailed || isDelayed || isComplained) {
        let diagnostic = `Resend delivery status: ${email.last_event}`;
        try {
          const detailRes = await fetch(`https://api.resend.com/emails/${email.id}`, {
            headers: { Authorization: `Bearer ${resendApiKey}` },
          });
          if (detailRes.ok) {
            const detail = await detailRes.json();
            if (detail.bounce) {
              diagnostic = `${detail.bounce.message || ''} ${detail.bounce.diagnosticCode?.join(' ') || ''}`.trim();
            }
          }
        } catch {
          // ignore detail fetch error
        }

        const toEmail = Array.isArray(email.to) ? email.to.join(', ') : email.to;
        const reason = isFailed
          ? `Email bounced / undeliverable to ${toEmail}`
          : isDelayed
          ? `Email delivery delayed by recipient mail server for ${toEmail}`
          : `Spam complaint received from ${toEmail}`;

        issues.push(reason);

        await alertAdminOnce({
          alertKey: `resend_${email.id}_${email.last_event}`,
          recipientEmail: toEmail,
          errorReason: isFailed
            ? 'Email Bounced (Undeliverable)'
            : isDelayed
            ? 'Delivery Delayed (Mailbox Full or Temporary Server Error)'
            : 'Spam Complaint',
          diagnosticDetails: diagnostic,
          dateLabel: todayDateStr,
          feedbackUrl: fullUrl,
        });
      }
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    issues.push(`Resend delivery check exception: ${errorMsg}`);
  }

  return {
    checkedDate: todayDateStr,
    status: issues.length > 0 ? 'alerted' : 'healthy',
    issues,
  };
}

