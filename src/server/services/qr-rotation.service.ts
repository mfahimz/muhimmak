'use server';
import 'server-only';

import crypto from 'crypto';
import QRCode from 'qrcode';
import { createAdminClient } from '@/lib/supabase/admin';
import { resend, RESEND_FROM } from '@/server/lib/resend';
import { dailyQrEmail } from '@/server/lib/email-templates';

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
  }

  let recipientCount = 0;

  if (emailList.length > 0) {
    const template = dailyQrEmail({
      feedbackUrl: fullUrl,
      dateLabel: todayDateStr,
      qrCid: 'qrcode',
    });

    const sendPromises = emailList.map((recipientEmail) =>
      resend.emails.send({
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
      }).catch((err) => {
        console.error(`Failed to send daily QR email to ${recipientEmail}:`, err);
        return null;
      })
    );

    await Promise.all(sendPromises);
    recipientCount = emailList.length;
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
  }

  let recipientCount = 0;

  if (emailList.length > 0) {
    const template = dailyQrEmail({
      feedbackUrl: fullUrl,
      dateLabel: todayDateStr,
      qrCid: 'qrcode',
      isManualReset: true,
    });

    const sendPromises = emailList.map((recipientEmail) =>
      resend.emails.send({
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
      }).catch((err) => {
        console.error(`Failed to send daily QR reset email to ${recipientEmail}:`, err);
        return null;
      })
    );

    await Promise.all(sendPromises);
    recipientCount = emailList.length;
  }

  return {
    skipped: false,
    token,
    url: fullUrl,
    recipientCount,
  };
}
