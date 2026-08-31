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

export type TicketLifecycleEventType =
  | 'created_submitter'
  | 'created_admin'
  | 'assigned_assignee'
  | 'assigned_submitter'
  | 'assigned_admin'
  | 'status_in_progress'
  | 'status_reopened'
  | 'resolved'
  | 'closed'
  | 'comment_added';

export interface SendTicketLifecycleEmailParams {
  ticketId: string;
  eventType: TicketLifecycleEventType;
  recipients: string[];
  ticketTitle: string;
  ticketDescription: string;
  severity: string;
  status: string;
  submitterName: string;
  actorName?: string;
  assigneeName?: string;
  commentText?: string;
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
 * Shared helper to build and send support ticket lifecycle emails.
 * Ensures recipient emails are deduplicated and contains ZERO raw UUIDs.
 */
export async function sendTicketLifecycleEmail(
  params: SendTicketLifecycleEmailParams
): Promise<void> {
  const {
    eventType,
    recipients,
    ticketTitle,
    ticketDescription,
    severity,
    status,
    submitterName,
    actorName,
    assigneeName,
    commentText,
  } = params;

  const cleanRecipients = Array.from(
    new Set(
      recipients
        .map((e) => e?.trim()?.toLowerCase())
        .filter((e): e is string => Boolean(e && e.includes('@')))
    )
  );

  if (cleanRecipients.length === 0) {
    return;
  }

  const severityBg =
    severity === 'high'
      ? '#fef2f2'
      : severity === 'medium'
      ? '#fffbeb'
      : '#f8fafc';
  const severityBorder =
    severity === 'high'
      ? '#fecaca'
      : severity === 'medium'
      ? '#fde68a'
      : '#e2e8f0';
  const severityText =
    severity === 'high'
      ? '#dc2626'
      : severity === 'medium'
      ? '#d97706'
      : '#475569';

  let subject = `[Muhimmak] Support Ticket Update: ${ticketTitle}`;
  let headerTitle = ticketTitle;
  let subMessage = `Submitted by <strong>${submitterName}</strong>`;
  let highlightMessage = '';

  switch (eventType) {
    case 'created_submitter':
      subject = `[Muhimmak] Support Ticket Received: ${ticketTitle}`;
      headerTitle = `Ticket Received`;
      highlightMessage = `<p style="margin:0 0 16px 0;font-size:14px;color:#1e293b;line-height:1.6;">Hello <strong>${submitterName}</strong>, your support request has been logged successfully. Our administrative team will review it shortly.</p>`;
      break;

    case 'created_admin':
      subject = `[Muhimmak] New Support Ticket: ${ticketTitle}`;
      headerTitle = `New Support Ticket`;
      highlightMessage = `<p style="margin:0 0 16px 0;font-size:14px;color:#1e293b;line-height:1.6;">A new <strong>${severity} severity</strong> support ticket was submitted by <strong>${submitterName}</strong>.</p>`;
      break;

    case 'assigned_assignee':
      subject = `[Muhimmak] Support Ticket Assigned to You: ${ticketTitle}`;
      headerTitle = `Ticket Assigned to You`;
      highlightMessage = `<p style="margin:0 0 16px 0;font-size:14px;color:#1e293b;line-height:1.6;">Support ticket <strong>"${ticketTitle}"</strong> (submitted by ${submitterName}) has been assigned to you by <strong>${actorName || 'an Administrator'}</strong>.</p>`;
      break;

    case 'assigned_submitter':
      subject = `[Muhimmak] Ticket Update: ${ticketTitle} Assigned`;
      headerTitle = `Ticket Assigned`;
      highlightMessage = `<p style="margin:0 0 16px 0;font-size:14px;color:#1e293b;line-height:1.6;">Your support ticket <strong>"${ticketTitle}"</strong> has been assigned to <strong>${assigneeName || 'a staff member'}</strong> for resolution.</p>`;
      break;

    case 'assigned_admin':
      subject = `[Muhimmak] Ticket Assigned: ${ticketTitle}`;
      headerTitle = `Ticket Assignment`;
      highlightMessage = `<p style="margin:0 0 16px 0;font-size:14px;color:#1e293b;line-height:1.6;">Support ticket <strong>"${ticketTitle}"</strong> was assigned to <strong>${assigneeName}</strong> by <strong>${actorName || 'an Administrator'}</strong>.</p>`;
      break;

    case 'status_in_progress':
      subject = `[Muhimmak] Support Ticket In Progress: ${ticketTitle}`;
      headerTitle = `Status Changed: In Progress`;
      highlightMessage = `<p style="margin:0 0 16px 0;font-size:14px;color:#1e293b;line-height:1.6;">Work has commenced on support ticket <strong>"${ticketTitle}"</strong>. Status is now set to <strong>In Progress</strong>.</p>`;
      break;

    case 'status_reopened':
      subject = `[Muhimmak] Support Ticket Reopened: ${ticketTitle}`;
      headerTitle = `Ticket Reopened`;
      highlightMessage = `<p style="margin:0 0 16px 0;font-size:14px;color:#1e293b;line-height:1.6;">Support ticket <strong>"${ticketTitle}"</strong> has been reopened by <strong>${actorName || 'an Administrator'}</strong>. Status is now <strong>Open</strong>.</p>`;
      break;

    case 'resolved':
      subject = `[Muhimmak] Support Ticket Resolved: ${ticketTitle}`;
      headerTitle = `Ticket Resolved`;
      highlightMessage = `<p style="margin:0 0 16px 0;font-size:14px;color:#166534;line-height:1.6;">Support ticket <strong>"${ticketTitle}"</strong> has been marked as <strong>Resolved</strong> by <strong>${actorName || 'an Administrator'}</strong>.</p>`;
      break;

    case 'closed':
      subject = `[Muhimmak] Support Ticket Closed: ${ticketTitle}`;
      headerTitle = `Ticket Closed`;
      highlightMessage = `<p style="margin:0 0 16px 0;font-size:14px;color:#334155;line-height:1.6;">Support ticket <strong>"${ticketTitle}"</strong> has been formally marked as <strong>Closed</strong>.</p>`;
      break;

    case 'comment_added':
      subject = `[Muhimmak] New Comment on Ticket: ${ticketTitle}`;
      headerTitle = `New Comment Added`;
      highlightMessage = `
        <p style="margin:0 0 12px 0;font-size:14px;color:#1e293b;line-height:1.6;"><strong>${actorName || 'A team member'}</strong> added a comment to ticket <strong>"${ticketTitle}"</strong>:</p>
        <div style="background-color:#f1f5f9;border-left:4px solid #6366f1;padding:12px 16px;border-radius:4px;margin-bottom:16px;">
          <p style="margin:0;font-size:14px;color:#334155;font-style:italic;line-height:1.6;">"${commentText || ''}"</p>
        </div>
      `;
      break;
  }

  const emailContent = `
    <div style="display:inline-block;background-color:${severityBg};border:1px solid ${severityBorder};border-radius:6px;padding:4px 12px;margin-bottom:16px;">
      <span style="font-size:12px;font-weight:700;color:${severityText};letter-spacing:1px;text-transform:uppercase;">${severity} Severity • Status: ${status.replace('_', ' ')}</span>
    </div>
    <h2 style="margin:0 0 6px 0;font-size:20px;font-weight:700;color:#0f172a;">${headerTitle}</h2>
    <p style="margin:0 0 20px 0;font-size:13px;color:#64748b;">${subMessage}</p>

    ${highlightMessage}

    <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0;">
      <h3 style="margin:0 0 8px 0;font-size:14px;font-weight:600;color:#0f172a;">Ticket Summary</h3>
      <p style="margin:0;font-size:14px;color:#334155;line-height:1.6;">${ticketDescription}</p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: RESEND_FROM,
      to: cleanRecipients,
      subject,
      html: buildEmailWrapper(emailContent),
    });
  } catch (emailErr) {
    console.error('[support.service] Failed to send support lifecycle email:', emailErr);
  }
}

/**
 * Helper to fetch active super_admins' notification emails.
 * Logs a warning if a super_admin profile lacks a notification_email.
 */
async function getSuperAdminNotificationEmails(excludeProfileId?: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data: superAdmins, error } = await admin
    .from('profiles')
    .select('id, full_name, notification_email')
    .eq('role', 'super_admin')
    .eq('is_active', true);

  if (error || !superAdmins) {
    console.error('[support.service] Error fetching super admin profiles:', error);
    return [];
  }

  const emails: string[] = [];
  for (const sa of superAdmins) {
    if (excludeProfileId && sa.id === excludeProfileId) continue;
    const email = sa.notification_email?.trim();
    if (email && email.includes('@')) {
      emails.push(email);
    } else {
      console.warn(`[support.service] Active super_admin profile ${sa.full_name || sa.id} has no valid notification_email set`);
    }
  }

  return emails;
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
    .select('full_name, notification_email')
    .eq('id', submittedBy)
    .single();

  const submitterName = submitterProfile?.full_name || 'Staff Member';
  const submitterEmail = submitterProfile?.notification_email?.trim();

  if (!submitterEmail || !submitterEmail.includes('@')) {
    console.warn(`[support.service] Submitter profile ${submittedBy} (${submitterName}) has no valid notification_email set`);
  }

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

  // A) In-app notification for super admins
  await createNotification({
    recipientRole: ['super_admin'],
    type: 'support_ticket',
    title: structured.title,
    message: `New ${structured.severity} severity ticket submitted by ${submitterName}`,
    metadata: { ticketId: ticket.id },
  });

  // B) Send email to Submitter confirming receipt
  if (submitterEmail && submitterEmail.includes('@')) {
    await sendTicketLifecycleEmail({
      ticketId: ticket.id,
      eventType: 'created_submitter',
      recipients: [submitterEmail],
      ticketTitle: structured.title,
      ticketDescription: structured.description,
      severity: structured.severity,
      status: 'open',
      submitterName,
    });
  }

  // C) Send email to Super Admins
  const adminEmails = await getSuperAdminNotificationEmails();
  if (adminEmails.length > 0) {
    await sendTicketLifecycleEmail({
      ticketId: ticket.id,
      eventType: 'created_admin',
      recipients: adminEmails,
      ticketTitle: structured.title,
      ticketDescription: structured.description,
      severity: structured.severity,
      status: 'open',
      submitterName,
    });
  }

  return { id: ticket.id };
}

/**
 * Assigns a support ticket to a user.
 * Sends emails to assignee, submitter, and other super_admins.
 */
export async function assignTicket(
  ticketId: string,
  assigneeId: string,
  assignedById?: string
): Promise<void> {
  const admin = createAdminClient();

  // Fetch ticket details
  const { data: ticket, error: ticketError } = await admin
    .from('support_tickets')
    .select('*, submitted_by_profile:profiles!support_tickets_submitted_by_fkey(full_name, notification_email)')
    .eq('id', ticketId)
    .single();

  if (ticketError || !ticket) {
    console.error('[support.service] Error fetching ticket for assign:', ticketError);
    throw new Error('Ticket not found');
  }

  if (!assigneeId) {
    const { error: updateError } = await admin
      .from('support_tickets')
      .update({
        assigned_to: null,
        assigned_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticketId);

    if (updateError) {
      console.error('[support.service] Error unassigning ticket:', updateError);
      throw new Error(updateError.message);
    }
    return;
  }

  // Fetch Assignee profile
  const { data: assigneeProfile } = await admin
    .from('profiles')
    .select('full_name, notification_email')
    .eq('id', assigneeId)
    .single();

  if (!assigneeProfile) {
    throw new Error('Assignee profile not found');
  }

  // Fetch Assigner profile (if provided)
  let actorName = 'An Administrator';
  if (assignedById) {
    const { data: actorProfile } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', assignedById)
      .single();
    if (actorProfile?.full_name) actorName = actorProfile.full_name;
  }

  // Update DB
  const { error: updateError } = await admin
    .from('support_tickets')
    .update({
      assigned_to: assigneeId,
      assigned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticketId);

  if (updateError) {
    console.error('[support.service] Error updating ticket assignee:', updateError);
    throw new Error(updateError.message);
  }

  const title = ticket.structured?.title || 'Support Ticket';
  const description = ticket.structured?.description || ticket.raw_input || '';
  const submitterName = ticket.submitted_by_profile?.full_name || 'Staff Member';
  const submitterEmail = ticket.submitted_by_profile?.notification_email?.trim();
  const assigneeName = assigneeProfile.full_name || 'Staff Member';
  const assigneeEmail = assigneeProfile.notification_email?.trim();

  // 1) Email to Assignee
  if (assigneeEmail && assigneeEmail.includes('@')) {
    await sendTicketLifecycleEmail({
      ticketId,
      eventType: 'assigned_assignee',
      recipients: [assigneeEmail],
      ticketTitle: title,
      ticketDescription: description,
      severity: ticket.severity || 'low',
      status: ticket.status || 'open',
      submitterName,
      actorName,
      assigneeName,
    });
  } else {
    console.warn(`[support.service] Assignee ${assigneeId} (${assigneeName}) has no valid notification_email set`);
  }

  // 2) Email to Submitter
  if (submitterEmail && submitterEmail.includes('@')) {
    await sendTicketLifecycleEmail({
      ticketId,
      eventType: 'assigned_submitter',
      recipients: [submitterEmail],
      ticketTitle: title,
      ticketDescription: description,
      severity: ticket.severity || 'low',
      status: ticket.status || 'open',
      submitterName,
      actorName,
      assigneeName,
    });
  }

  // 3) Email to other Super Admins
  const adminEmails = await getSuperAdminNotificationEmails(assignedById);
  if (adminEmails.length > 0) {
    await sendTicketLifecycleEmail({
      ticketId,
      eventType: 'assigned_admin',
      recipients: adminEmails,
      ticketTitle: title,
      ticketDescription: description,
      severity: ticket.severity || 'low',
      status: ticket.status || 'open',
      submitterName,
      actorName,
      assigneeName,
    });
  }
}

/**
 * Updates status of a support ticket (open, in_progress, resolved, closed).
 * Fires status lifecycle emails to submitter & super_admins.
 */
export async function updateTicketStatus(
  ticketId: string,
  status: string,
  updatedById?: string
): Promise<void> {
  const allowedStatuses = ['open', 'in_progress', 'resolved', 'closed'];
  if (!allowedStatuses.includes(status)) {
    throw new Error(`Invalid status value: ${status}`);
  }

  const admin = createAdminClient();

  // Fetch ticket details
  const { data: ticket, error: ticketError } = await admin
    .from('support_tickets')
    .select('*, submitted_by_profile:profiles!support_tickets_submitted_by_fkey(full_name, notification_email)')
    .eq('id', ticketId)
    .single();

  if (ticketError || !ticket) {
    console.error('[support.service] Error fetching ticket for status update:', ticketError);
    throw new Error('Ticket not found');
  }

  // Fetch Updater profile (if provided)
  let actorName = 'An Administrator';
  if (updatedById) {
    const { data: actorProfile } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', updatedById)
      .single();
    if (actorProfile?.full_name) actorName = actorProfile.full_name;
  }

  const nowIso = new Date().toISOString();
  const updatePayload: Record<string, any> = {
    status,
    updated_at: nowIso,
  };

  if (status === 'resolved') {
    updatePayload.resolved_at = nowIso;
  } else if (status === 'closed') {
    updatePayload.closed_at = nowIso;
  }

  const { error: updateError } = await admin
    .from('support_tickets')
    .update(updatePayload)
    .eq('id', ticketId);

  if (updateError) {
    console.error('[support.service] Error updating ticket status:', updateError);
    throw new Error(updateError.message);
  }

  const title = ticket.structured?.title || 'Support Ticket';
  const description = ticket.structured?.description || ticket.raw_input || '';
  const submitterName = ticket.submitted_by_profile?.full_name || 'Staff Member';
  const submitterEmail = ticket.submitted_by_profile?.notification_email?.trim();

  let eventType: TicketLifecycleEventType = 'status_in_progress';
  if (status === 'resolved') eventType = 'resolved';
  else if (status === 'closed') eventType = 'closed';
  else if (status === 'open') eventType = 'status_reopened';

  // Gather recipients: submitter + super_admins
  const adminEmails = await getSuperAdminNotificationEmails();
  const recipients: string[] = [...adminEmails];
  if (submitterEmail && submitterEmail.includes('@')) {
    recipients.push(submitterEmail);
  }

  await sendTicketLifecycleEmail({
    ticketId,
    eventType,
    recipients,
    ticketTitle: title,
    ticketDescription: description,
    severity: ticket.severity || 'low',
    status,
    submitterName,
    actorName,
  });
}

/**
 * Adds a comment/reply to a support ticket and fires email notifications.
 */
export async function addTicketComment(
  ticketId: string,
  authorId: string,
  comment: string
): Promise<{ id: string }> {
  const cleanComment = comment?.trim();
  if (!cleanComment) {
    throw new Error('Comment text cannot be empty');
  }

  const admin = createAdminClient();

  // Fetch ticket details
  const { data: ticket, error: ticketError } = await admin
    .from('support_tickets')
    .select('*, submitted_by_profile:profiles!support_tickets_submitted_by_fkey(full_name, notification_email), assigned_to_profile:profiles!support_tickets_assigned_to_fkey(full_name, notification_email)')
    .eq('id', ticketId)
    .single();

  if (ticketError || !ticket) {
    console.error('[support.service] Error fetching ticket for comment:', ticketError);
    throw new Error('Ticket not found');
  }

  // Fetch comment author profile
  const { data: authorProfile } = await admin
    .from('profiles')
    .select('full_name, role')
    .eq('id', authorId)
    .single();

  const authorName = authorProfile?.full_name || 'Team Member';

  // Insert comment into DB
  const { data: newComment, error: insertError } = await admin
    .from('support_ticket_comments')
    .insert({
      ticket_id: ticketId,
      author_id: authorId,
      comment: cleanComment,
    })
    .select('id')
    .single();

  if (insertError || !newComment) {
    console.error('[support.service] Error inserting ticket comment:', insertError);
    throw new Error(insertError?.message || 'Failed to add comment');
  }

  const title = ticket.structured?.title || 'Support Ticket';
  const description = ticket.structured?.description || ticket.raw_input || '';
  const submitterName = ticket.submitted_by_profile?.full_name || 'Staff Member';
  const submitterId = ticket.submitted_by;
  const submitterEmail = ticket.submitted_by_profile?.notification_email?.trim();
  const assigneeId = ticket.assigned_to;
  const assigneeEmail = ticket.assigned_to_profile?.notification_email?.trim();

  // Build recipient list
  const recipients: string[] = [];

  // 1) Submitter (unless author IS submitter)
  if (authorId !== submitterId && submitterEmail && submitterEmail.includes('@')) {
    recipients.push(submitterEmail);
  }

  // 2) Assignee (unless author IS assignee)
  if (assigneeId && authorId !== assigneeId && assigneeEmail && assigneeEmail.includes('@')) {
    recipients.push(assigneeEmail);
  }

  // 3) Super Admins (exclude author if author is a super admin)
  const adminEmails = await getSuperAdminNotificationEmails(authorId);
  recipients.push(...adminEmails);

  await sendTicketLifecycleEmail({
    ticketId,
    eventType: 'comment_added',
    recipients,
    ticketTitle: title,
    ticketDescription: description,
    severity: ticket.severity || 'low',
    status: ticket.status || 'open',
    submitterName,
    actorName: authorName,
    commentText: cleanComment,
  });

  return { id: newComment.id };
}

/**
 * Fetches comments for a support ticket.
 */
export async function getTicketComments(ticketId: string): Promise<any[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('support_ticket_comments')
    .select('*, author_profile:profiles!support_ticket_comments_author_id_fkey(full_name, role)')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[support.service] Error fetching ticket comments:', error);
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Fetches tickets based on user role. Super Admin & CEO see all, others see only their own.
 */
export async function getTicketsForUser(user: { id: string; role: string }) {
  const admin = createAdminClient();

  if (['super_admin', 'ceo'].includes(user.role)) {
    const { data, error } = await admin
      .from('support_tickets')
      .select('*, submitted_by_profile:profiles!support_tickets_submitted_by_fkey(full_name, role), assigned_to_profile:profiles!support_tickets_assigned_to_fkey(full_name, role)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[support.service] Error fetching tickets for admin:', error);
      throw new Error(error.message);
    }
    return data || [];
  }

  const { data, error } = await admin
    .from('support_tickets')
    .select('*, submitted_by_profile:profiles!support_tickets_submitted_by_fkey(full_name, role), assigned_to_profile:profiles!support_tickets_assigned_to_fkey(full_name, role)')
    .eq('submitted_by', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[support.service] Error fetching user tickets:', error);
    throw new Error(error.message);
  }

  return data || [];
}
