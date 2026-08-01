import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { writeAuditLog, getClientIp } from '@/lib/audit/log';

const ADMIN_ROLES = ['super_admin', 'ceo', 'agm', 'manager'];
const ALLOWED_ROLES = [...ADMIN_ROLES, 'receptionist'];

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = profile?.role || 'receptionist';
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { action, status, invoiceNumber, resolvedBy, resolvedAt } = body;

    const ip = getClientIp(request);
    const nowIso = new Date().toISOString();

    // Check if target closure exists
    const { data: existingClosure, error: fetchErr } = await admin
      .from('visit_closures')
      .select('id, session_id, status')
      .eq('id', id)
      .single();

    if (fetchErr || !existingClosure) {
      return NextResponse.json({ error: 'Visit closure not found' }, { status: 404 });
    }

    if (role === 'receptionist') {
      // Receptionists can ONLY invoke mark_delivered or mark_still_in_shop
      if (action === 'mark_delivered') {
        const { data: updated, error: updateErr } = await admin
          .from('visit_closures')
          .update({
            status: 'delivered',
            invoice_number: typeof invoiceNumber === 'string' && invoiceNumber.trim() ? invoiceNumber.trim() : null,
            resolved_by: user.id,
            resolved_at: nowIso,
            updated_at: nowIso,
          })
          .eq('id', id)
          .select()
          .single();

        if (updateErr) throw updateErr;

        await writeAuditLog({
          actorId: user.id,
          action: 'closure_marked_delivered',
          ipAddress: ip,
          metadata: { closureId: id, sessionId: existingClosure.session_id, invoiceNumber: invoiceNumber?.trim() || null },
        });

        return NextResponse.json({ success: true, closure: updated });
      } else if (action === 'mark_still_in_shop') {
        const { data: updated, error: updateErr } = await admin
          .from('visit_closures')
          .update({
            status: 'still_in_shop',
            resolved_by: user.id,
            resolved_at: nowIso,
            updated_at: nowIso,
          })
          .eq('id', id)
          .select()
          .single();

        if (updateErr) throw updateErr;

        await writeAuditLog({
          actorId: user.id,
          action: 'closure_marked_still_in_shop',
          ipAddress: ip,
          metadata: { closureId: id, sessionId: existingClosure.session_id },
        });

        return NextResponse.json({ success: true, closure: updated });
      } else {
        return NextResponse.json(
          { error: 'Forbidden. Receptionists can only mark closures as delivered or still in shop.' },
          { status: 403 }
        );
      }
    }

    // Admin & Manager Roles: full update or mark actions
    if (ADMIN_ROLES.includes(role)) {
      if (action === 'mark_delivered') {
        const { data: updated, error: updateErr } = await admin
          .from('visit_closures')
          .update({
            status: 'delivered',
            invoice_number: typeof invoiceNumber === 'string' && invoiceNumber.trim() ? invoiceNumber.trim() : null,
            resolved_by: user.id,
            resolved_at: nowIso,
            updated_at: nowIso,
          })
          .eq('id', id)
          .select()
          .single();

        if (updateErr) throw updateErr;

        await writeAuditLog({
          actorId: user.id,
          action: 'closure_marked_delivered',
          ipAddress: ip,
          metadata: { closureId: id, sessionId: existingClosure.session_id, invoiceNumber: invoiceNumber?.trim() || null },
        });

        return NextResponse.json({ success: true, closure: updated });
      } else if (action === 'mark_still_in_shop') {
        const { data: updated, error: updateErr } = await admin
          .from('visit_closures')
          .update({
            status: 'still_in_shop',
            resolved_by: user.id,
            resolved_at: nowIso,
            updated_at: nowIso,
          })
          .eq('id', id)
          .select()
          .single();

        if (updateErr) throw updateErr;

        await writeAuditLog({
          actorId: user.id,
          action: 'closure_marked_still_in_shop',
          ipAddress: ip,
          metadata: { closureId: id, sessionId: existingClosure.session_id },
        });

        return NextResponse.json({ success: true, closure: updated });
      } else {
        // Direct field edit
        const updatePayload: Record<string, any> = { updated_at: nowIso };
        if (status) updatePayload.status = status;
        if (invoiceNumber !== undefined) updatePayload.invoice_number = invoiceNumber ? invoiceNumber.trim() : null;
        if (resolvedBy !== undefined) updatePayload.resolved_by = resolvedBy || null;
        if (resolvedAt !== undefined) updatePayload.resolved_at = resolvedAt || null;

        const { data: updated, error: updateErr } = await admin
          .from('visit_closures')
          .update(updatePayload)
          .eq('id', id)
          .select()
          .single();

        if (updateErr) throw updateErr;

        await writeAuditLog({
          actorId: user.id,
          action: 'closure_updated',
          ipAddress: ip,
          metadata: { closureId: id, sessionId: existingClosure.session_id, updates: updatePayload },
        });

        return NextResponse.json({ success: true, closure: updated });
      }
    }

    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  } catch (err: any) {
    console.error('Error updating visit closure:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = profile?.role || 'receptionist';

    // Strictly restrict delete to super_admin, ceo, agm, manager
    if (!ADMIN_ROLES.includes(role)) {
      return NextResponse.json(
        { error: 'Forbidden. Deleting pending closures is restricted to managers and admins.' },
        { status: 403 }
      );
    }

    const ip = getClientIp(request);

    const { error: deleteErr } = await admin
      .from('visit_closures')
      .delete()
      .eq('id', id);

    if (deleteErr) throw deleteErr;

    await writeAuditLog({
      actorId: user.id,
      action: 'closure_deleted',
      ipAddress: ip,
      metadata: { closureId: id },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting visit closure:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
