'server-only';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export interface CreateNotificationParams {
  recipientId?: string | null;
  recipientRole?: string | string[] | null;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, any>;
}

/**
 * Defensive helper to create in-app notifications.
 * Does not throw on error, logs failure gracefully.
 */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  try {
    const admin = createAdminClient();

    if (Array.isArray(params.recipientRole)) {
      const rows = params.recipientRole.map((role) => ({
        recipient_id: null,
        recipient_role: role,
        type: params.type,
        title: params.title,
        message: params.message,
        metadata: params.metadata || {},
      }));

      if (rows.length > 0) {
        const { error } = await admin.from('notifications').insert(rows);
        if (error) {
          console.error('Failed to create role notifications:', error);
        }
      }
      return;
    }

    const { error } = await admin.from('notifications').insert({
      recipient_id: params.recipientId || null,
      recipient_role: params.recipientRole || null,
      type: params.type,
      title: params.title,
      message: params.message,
      metadata: params.metadata || {},
    });

    if (error) {
      console.error('Failed to create notification:', error);
    }
  } catch (err) {
    console.error('Exception in createNotification:', err);
  }
}

async function getAuthenticatedCaller() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = profile?.role || 'receptionist';
  return { user, role, admin };
}

/**
 * GET notifications for the authenticated user (recipient_id = caller or recipient_role = caller's role)
 */
export async function getNotifications(_request: Request): Promise<NextResponse> {
  try {
    const caller = await getAuthenticatedCaller();
    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user, role, admin } = caller;
    const filter = `recipient_id.eq.${user.id},recipient_role.eq.${role}`;

    const { data: notifications, error } = await admin
      .from('notifications')
      .select('*')
      .or(filter)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      console.error('Error fetching notifications:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { count, error: countError } = await admin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .or(filter)
      .eq('is_read', false);

    if (countError) {
      console.error('Error counting unread notifications:', countError);
    }

    return NextResponse.json({
      notifications: notifications || [],
      unreadCount: count || 0,
    });
  } catch (err: any) {
    console.error('Exception in getNotifications:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

/**
 * Mark a single notification as read, verifying caller ownership/role access
 */
export async function markNotificationRead(request: Request): Promise<NextResponse> {
  try {
    const caller = await getAuthenticatedCaller();
    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body invalid or empty
    }

    const notificationId = body.notificationId;

    if (!notificationId || typeof notificationId !== 'string') {
      return NextResponse.json({ error: 'notificationId is required' }, { status: 400 });
    }

    const { user, role, admin } = caller;

    const { data: notification, error: fetchError } = await admin
      .from('notifications')
      .select('id, recipient_id, recipient_role')
      .eq('id', notificationId)
      .single();

    if (fetchError || !notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    if (notification.recipient_id !== user.id && notification.recipient_role !== role) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error: updateError } = await admin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Exception in markNotificationRead:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

/**
 * Mark all unread notifications for the caller as read
 */
export async function markAllNotificationsRead(_request: Request): Promise<NextResponse> {
  try {
    const caller = await getAuthenticatedCaller();
    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user, role, admin } = caller;
    const filter = `recipient_id.eq.${user.id},recipient_role.eq.${role}`;

    const { error } = await admin
      .from('notifications')
      .update({ is_read: true })
      .or(filter)
      .eq('is_read', false);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Exception in markAllNotificationsRead:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
