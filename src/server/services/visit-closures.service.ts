'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { decryptPlate } from '@/lib/utils/plate-number';
import { createNotification } from '@/server/services/notifications-center.service';

export interface ProcessVisitClosuresResult {
  success: boolean;
  newlyFlaggedCount: number;
  unnotifiedCount: number;
  notificationSent: boolean;
  error?: string;
}

export async function process7DayVisitClosures(): Promise<ProcessVisitClosuresResult> {
  const admin = createAdminClient();

  try {
    const sevenDaysAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Fetch drop-off sessions created <= 7 days ago
    const { data: candidateDropOffs, error: fetchErr } = await admin
      .from('sessions')
      .select('id, plate_number_hash, plate_number_encrypted, created_at, status')
      .eq('visit_stage', 'drop_off')
      .neq('status', 'abandoned')
      .neq('status', 'refused')
      .lte('created_at', sevenDaysAgoIso);

    if (fetchErr) {
      console.error('Error fetching candidate drop-off sessions:', fetchErr);
      return {
        success: false,
        newlyFlaggedCount: 0,
        unnotifiedCount: 0,
        notificationSent: false,
        error: fetchErr.message,
      };
    }

    const candidateIds = (candidateDropOffs || []).map((s) => s.id);

    // 2. Fetch pick-up sessions that link to candidate drop-offs
    const { data: linkedPickUps } = candidateIds.length > 0
      ? await admin
          .from('sessions')
          .select('linked_session_id')
          .in('linked_session_id', candidateIds)
      : { data: [] };

    const linkedDropOffIds = new Set(
      (linkedPickUps || [])
        .map((p) => p.linked_session_id)
        .filter(Boolean) as string[]
    );

    // 3. Fetch existing visit_closures rows for candidate drop-offs
    const { data: existingClosures } = candidateIds.length > 0
      ? await admin
          .from('visit_closures')
          .select('session_id')
          .in('session_id', candidateIds)
      : { data: [] };

    const existingClosureSessionIds = new Set(
      (existingClosures || []).map((vc) => vc.session_id)
    );

    // Filter qualifying drop-off sessions (unlinked & not already in visit_closures)
    const qualifyingSessions = (candidateDropOffs || []).filter(
      (s) => !linkedDropOffIds.has(s.id) && !existingClosureSessionIds.has(s.id)
    );

    let newlyFlaggedCount = 0;

    if (qualifyingSessions.length > 0) {
      const rowsToInsert = qualifyingSessions.map((s) => ({
        session_id: s.id,
        plate_number_hash: s.plate_number_hash || '',
        status: 'pending',
        flagged_at: new Date().toISOString(),
        notified_at: null,
      }));

      const { error: insertErr } = await admin
        .from('visit_closures')
        .insert(rowsToInsert);

      if (insertErr) {
        console.error('Failed to insert visit_closures rows:', insertErr);
      } else {
        newlyFlaggedCount = qualifyingSessions.length;
      }
    }

    // 4. Query unnotified visit_closures with status = 'pending'
    const { data: unnotifiedClosures, error: unnotifiedErr } = await admin
      .from('visit_closures')
      .select('id, session_id, plate_number_hash, flagged_at, status')
      .eq('status', 'pending')
      .is('notified_at', null);

    if (unnotifiedErr || !unnotifiedClosures || unnotifiedClosures.length === 0) {
      return {
        success: true,
        newlyFlaggedCount,
        unnotifiedCount: 0,
        notificationSent: false,
      };
    }

    // Double-check no linked pick-up was added between query & notification
    const unnotifiedSessionIds = unnotifiedClosures.map((vc) => vc.session_id);
    const { data: recheckLinked } = await admin
      .from('sessions')
      .select('linked_session_id')
      .in('linked_session_id', unnotifiedSessionIds);

    const recheckLinkedSet = new Set(
      (recheckLinked || []).map((p) => p.linked_session_id).filter(Boolean) as string[]
    );

    const validUnnotified = unnotifiedClosures.filter(
      (vc) => !recheckLinkedSet.has(vc.session_id)
    );

    if (validUnnotified.length === 0) {
      return {
        success: true,
        newlyFlaggedCount,
        unnotifiedCount: 0,
        notificationSent: false,
      };
    }

    // Fetch plate_number_encrypted from sessions for validUnnotified
    const validSessionIds = validUnnotified.map((vc) => vc.session_id);
    const { data: sessionsWithPlates } = await admin
      .from('sessions')
      .select('id, plate_number_encrypted')
      .in('id', validSessionIds);

    const plateMap = new Map<string, string>();
    (sessionsWithPlates || []).forEach((s) => {
      if (s.plate_number_encrypted) {
        const decrypted = decryptPlate(s.plate_number_encrypted);
        if (decrypted) plateMap.set(s.id, decrypted);
      }
    });

    const closureDetails = validUnnotified.map((vc) => {
      const plate = plateMap.get(vc.session_id) || 'UNKNOWN';
      return {
        closureId: vc.id,
        sessionId: vc.session_id,
        plateNumber: plate,
        flaggedAt: vc.flagged_at,
      };
    });

    const decryptedPlates = closureDetails.map((c) => c.plateNumber);

    const title = '7-Day Pending Vehicle Closures';
    const message = `${validUnnotified.length} vehicle(s) reached 7 days in shop without a recorded pick-up: ${decryptedPlates.join(', ')}.`;

    // Send single digest notification to receptionist role ONLY
    await createNotification({
      recipientRole: ['receptionist'],
      type: 'visit_closure_digest',
      title,
      message,
      metadata: {
        count: validUnnotified.length,
        plates: decryptedPlates,
        closures: closureDetails,
      },
    });

    // Mark notified_at = now() for validUnnotified rows
    const closureIdsToMark = validUnnotified.map((vc) => vc.id);
    const nowIso = new Date().toISOString();
    await admin
      .from('visit_closures')
      .update({ notified_at: nowIso })
      .in('id', closureIdsToMark);

    return {
      success: true,
      newlyFlaggedCount,
      unnotifiedCount: validUnnotified.length,
      notificationSent: true,
    };
  } catch (err: any) {
    console.error('Error processing 7-day visit closures:', err);
    return {
      success: false,
      newlyFlaggedCount: 0,
      unnotifiedCount: 0,
      notificationSent: false,
      error: err.message || String(err),
    };
  }
}
