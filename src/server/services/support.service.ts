'server-only';

import { deepseek, DEEPSEEK_MODEL } from '@/server/lib/deepseek';
import { createAdminClient } from '@/lib/supabase/admin';
import { createNotification } from '@/server/services/notifications-center.service';
import { resend, RESEND_FROM } from '@/server/lib/resend';
import { buildEmailWrapper } from '@/server/lib/email-templates';

export interface StructuredTicket {
  title: string;
  description: string;
  steps_to_reproduce: string;
  severity: 'low' | 'medium' | 'high';
  language_detected: 'en' | 'ar';
}

/**
 * Call DeepSeek AI to structure raw user support input into JSON.
 */
export async function structureTicket(rawInput: string): Promise<StructuredTicket> {
  const fallback: StructuredTicket = {
    title: 'Support Request',
    description: rawInput,
    steps_to_reproduce: 'Not provided',
    severity: 'low',
    language_detected: 'en',
  };

  try {
    if (!process.env.DEEPSEEK_API_KEY) {
      console.warn('[support.service] DEEPSEEK_API_KEY not found, using fallback structured ticket');
      return fallback;
    }

    const completion = await deepseek.chat.completions.create({
      model: DEEPSEEK_MODEL,
      temperature: 0.2,
      thinking: { type: 'disabled' },
      messages: [
        {
          role: 'system',
          content:
            'You are a support ticket assistant for Muhimmak, a customer feedback app used at Al Maraghi Motors UAE. Structure the user\'s raw input into a support ticket. Respond ONLY with valid JSON, no markdown, no explanation.',
        },
        {
          role: 'user',
          content: `Structure this support report into JSON with these exact fields:
{ title: string (max 80 chars, in English), description: string (clear explanation in English), steps_to_reproduce: string (if mentioned, else 'Not provided'), severity: 'low'|'medium'|'high', language_detected: 'en'|'ar' }

Raw input: ${rawInput}`,
        },
      ],
    } as any);

    const rawText = completion.choices?.[0]?.message?.content?.trim() || '';
    const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

    if (!cleanJson) {
      return fallback;
    }

    const parsed = JSON.parse(cleanJson);

    const severity = ['low', 'medium', 'high'].includes(parsed.severity)
      ? parsed.severity
      : 'low';
    const language_detected = ['en', 'ar'].includes(parsed.language_detected)
      ? parsed.language_detected
      : 'en';

    return {
      title: (parsed.title || 'Support Request').substring(0, 80),
      description: parsed.description || rawInput,
      steps_to_reproduce: parsed.steps_to_reproduce || 'Not provided',
      severity,
      language_detected,
    };
  } catch (err) {
    console.error('[support.service] structureTicket failed, using fallback:', err);
    return fallback;
  }
}

/**
 * Creates a support ticket, structures input via AI, and fires in-app & email notifications.
 */
export async function createTicket(
  submittedBy: string,
  rawInput: string
): Promise<{ id: string }> {
  const structured = await structureTicket(rawInput);
  const admin = createAdminClient();

  const { data: submitterProfile } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', submittedBy)
    .single();

  const submitterName = submitterProfile?.full_name || 'Staff Member';

  const { data: ticket, error } = await admin
    .from('support_tickets')
    .insert({
      submitted_by: submittedBy,
      raw_input: rawInput,
      structured,
      language_detected: structured.language_detected,
      severity: structured.severity,
      status: 'open',
    })
    .select('id')
    .single();

  if (error || !ticket) {
    console.error('[support.service] Error inserting ticket:', error);
    throw new Error(error?.message || 'Failed to create support ticket');
  }

  // A) In-app notification
  await createNotification({
    recipientRole: ['super_admin'],
    type: 'support_ticket',
    title: structured.title,
    message: `New ${structured.severity} severity ticket submitted by ${submitterName}`,
    metadata: { ticketId: ticket.id },
  });

  // B) Email notification to active super_admins with email set
  try {
    const { data: superAdmins } = await admin
      .from('profiles')
      .select('notification_email')
      .eq('role', 'super_admin')
      .eq('is_active', true)
      .not('notification_email', 'is', null);

    const recipientEmails = (superAdmins || [])
      .map((p) => p.notification_email?.trim())
      .filter((email): email is string => Boolean(email && email.includes('@')));

    if (recipientEmails.length > 0) {
      const severityBg =
        structured.severity === 'high'
          ? '#fef2f2'
          : structured.severity === 'medium'
          ? '#fffbeb'
          : '#f8fafc';
      const severityBorder =
        structured.severity === 'high'
          ? '#fecaca'
          : structured.severity === 'medium'
          ? '#fde68a'
          : '#e2e8f0';
      const severityText =
        structured.severity === 'high'
          ? '#dc2626'
          : structured.severity === 'medium'
          ? '#d97706'
          : '#475569';

      const emailContent = `
        <div style="display:inline-block;background-color:${severityBg};border:1px solid ${severityBorder};border-radius:6px;padding:4px 12px;margin-bottom:16px;">
          <span style="font-size:12px;font-weight:700;color:${severityText};letter-spacing:1px;text-transform:uppercase;">${structured.severity} Severity Ticket</span>
        </div>
        <h2 style="margin:0 0 6px 0;font-size:20px;font-weight:700;color:#0f172a;">${structured.title}</h2>
        <p style="margin:0 0 20px 0;font-size:13px;color:#64748b;">Submitted by <strong>${submitterName}</strong></p>

        <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0;">
          <h3 style="margin:0 0 8px 0;font-size:14px;font-weight:600;color:#0f172a;">Description</h3>
          <p style="margin:0 0 16px 0;font-size:14px;color:#334155;line-height:1.6;">${structured.description}</p>
          <h3 style="margin:0 0 8px 0;font-size:14px;font-weight:600;color:#0f172a;">Steps to Reproduce</h3>
          <p style="margin:0;font-size:14px;color:#334155;line-height:1.6;">${structured.steps_to_reproduce}</p>
        </div>

        <p style="margin:16px 0 0 0;font-size:13px;color:#64748b;">Raw input: <em>"${rawInput}"</em></p>
      `;

      await resend.emails.send({
        from: RESEND_FROM,
        to: recipientEmails,
        subject: `[Muhimmak] New Support Ticket: ${structured.title}`,
        html: buildEmailWrapper(emailContent),
      });
    }
  } catch (emailErr) {
    console.error('[support.service] Failed to send support ticket email:', emailErr);
  }

  return { id: ticket.id };
}

/**
 * Fetches tickets based on user role. Super Admin & CEO see all, others see only their own.
 */
export async function getTicketsForUser(user: { id: string; role: string }) {
  const admin = createAdminClient();

  if (['super_admin', 'ceo'].includes(user.role)) {
    const { data, error } = await admin
      .from('support_tickets')
      .select('*, submitted_by_profile:profiles!support_tickets_submitted_by_fkey(full_name, role)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[support.service] Error fetching tickets for admin:', error);
      throw new Error(error.message);
    }
    return data || [];
  }

  const { data, error } = await admin
    .from('support_tickets')
    .select('*, submitted_by_profile:profiles!support_tickets_submitted_by_fkey(full_name, role)')
    .eq('submitted_by', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[support.service] Error fetching user tickets:', error);
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Updates status of a support ticket.
 */
export async function updateTicketStatus(ticketId: string, status: string): Promise<void> {
  const admin = createAdminClient();

  const { error } = await admin
    .from('support_tickets')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticketId);

  if (error) {
    console.error('[support.service] Error updating ticket status:', error);
    throw new Error(error.message);
  }
}
