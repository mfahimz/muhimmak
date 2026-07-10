import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export type AuditAction =
  | 'login_success'
  | 'login_failed_bad_pin'
  | 'login_failed_locked'
  | 'login_failed_inactive'
  | 'logout';

interface AuditEntry {
  actorId: string | null;
  action: AuditAction;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}

/**
 * Writes an entry to audit_log. Failures are logged but never thrown —
 * an audit log outage should never block a login/logout request.
 */
export async function writeAuditLog({
  actorId,
  action,
  metadata = {},
  ipAddress = null,
}: AuditEntry): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from('audit_log').insert({
      actor_id: actorId,
      action,
      metadata,
      ip_address: ipAddress,
    });
    if (error) {
      console.error('[audit_log] insert failed:', error.message);
    }
  } catch (err) {
    console.error('[audit_log] unexpected failure:', err);
  }
}

/** Best-effort client IP extraction behind Vercel's proxy. */
export function getClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0]!.trim();
  return request.headers.get('x-real-ip');
}
