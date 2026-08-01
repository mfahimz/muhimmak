'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { computeWeightedScore } from '@/server/services/sessions.service';

export interface ScoreTrendItem {
  date: string;
  avgScore: number | null;
}

export interface SessionVolumeItem {
  date: string;
  started: number;
  completed: number;
  refused: number;
}

export interface SessionsByFormItem {
  formId: string;
  formName: string;
  sessionCount: number;
  avgScore: number | null;
}

export interface SessionsByReceptionistItem {
  staffId: string;
  staffName: string;
  sessionCount: number;
  avgScore: number | null;
}

export interface SessionsByLanguage {
  en: number;
  ar: number;
}

export interface SatisfactionDistribution {
  band0to49: number;
  band50to69: number;
  band70to89: number;
  band90to100: number;
}

export interface GoogleReviewConversion {
  totalCompleted: number;
  thresholdMet: number;
  conversionRate: number;
}

export interface CompletionRateData {
  started: number;
  completed: number;
  refused: number;
  abandoned: number;
  total: number;
  completionRatePercent: number;
}

export interface ReportsData {
  scoreTrend: ScoreTrendItem[];
  sessionVolume: SessionVolumeItem[];
  sessionsByForm: SessionsByFormItem[];
  sessionsByReceptionist: SessionsByReceptionistItem[];
  sessionsByLanguage: SessionsByLanguage;
  satisfactionDistribution: SatisfactionDistribution;
  googleReviewConversion: GoogleReviewConversion;
  completionRate: CompletionRateData;
}

// Generate all YYYY-MM-DD date strings between start and end dates (inclusive)
function generateDateBucketList(startDateStr: string, endDateStr: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return dates;
  }

  const curr = new Date(start);
  while (curr <= end) {
    dates.push(curr.toISOString().split('T')[0]);
    curr.setDate(curr.getDate() + 1);
  }

  return dates;
}

export async function computeReportsData(
  startDate: string,
  endDate: string
): Promise<ReportsData> {
  const emptyResult: ReportsData = {
    scoreTrend: [],
    sessionVolume: [],
    sessionsByForm: [],
    sessionsByReceptionist: [],
    sessionsByLanguage: { en: 0, ar: 0 },
    satisfactionDistribution: {
      band0to49: 0,
      band50to69: 0,
      band70to89: 0,
      band90to100: 0,
    },
    googleReviewConversion: {
      totalCompleted: 0,
      thresholdMet: 0,
      conversionRate: 0,
    },
    completionRate: {
      started: 0,
      completed: 0,
      refused: 0,
      abandoned: 0,
      total: 0,
      completionRatePercent: 0,
    },
  };

  try {
    const admin = createAdminClient();

    // 1. Validate / format date bounds
    const startStr = startDate ? startDate.trim() : new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endStr = endDate ? endDate.trim() : new Date().toISOString().split('T')[0];

    const startIso = `${startStr}T00:00:00.000Z`;
    const endIso = `${endStr}T23:59:59.999Z`;

    const dateBuckets = generateDateBucketList(startStr, endStr);

    // 2. Fetch all sessions created in date range
    const { data: sessionsData, error: sessionsErr } = await admin
      .from('sessions')
      .select('id, created_by, form_id, status, language, started_at, completed_at, refused_at, created_at, visit_stage, linked_session_id')
      .gte('created_at', startIso)
      .lte('created_at', endIso)
      .order('created_at', { ascending: true });

    if (sessionsErr || !sessionsData) {
      console.error('Error fetching sessions for reports:', sessionsErr);
      return {
        ...emptyResult,
        scoreTrend: dateBuckets.map((d) => ({ date: d, avgScore: null })),
        sessionVolume: dateBuckets.map((d) => ({ date: d, started: 0, completed: 0, refused: 0 })),
      };
    }

    const sessions = sessionsData;
    const completedSessions = sessions.filter((s) => s.status === 'completed');
    const completedIds = completedSessions.map((s) => s.id);

    // 3. Batch fetch responses for completed sessions
    const { data: responsesData } = completedIds.length > 0
      ? await admin
          .from('responses')
          .select('session_id, answers, ai_text_score')
          .in('session_id', completedIds)
      : { data: [] };

    const responseMap = new Map<string, any>();
    (responsesData || []).forEach((r) => {
      responseMap.set(r.session_id, r);
    });

    // 4. Batch fetch forms for unique form_ids
    const formIds = Array.from(new Set(sessions.map((s) => s.form_id).filter(Boolean)));
    const { data: formsData } = formIds.length > 0
      ? await admin
          .from('forms')
          .select('id, name, fields')
          .in('id', formIds)
      : { data: [] };

    const formMap = new Map<string, { id: string; name: string; fields: any[] }>();
    (formsData || []).forEach((f) => {
      formMap.set(f.id, { id: f.id, name: f.name || 'Unknown Form', fields: Array.isArray(f.fields) ? f.fields : [] });
    });

    // 5. Batch fetch staff profiles for unique created_by IDs
    const staffIds = Array.from(new Set(sessions.map((s) => s.created_by).filter(Boolean)));
    const { data: profilesData } = staffIds.length > 0
      ? await admin
          .from('profiles')
          .select('id, full_name')
          .in('id', staffIds)
      : { data: [] };

    const profileMap = new Map<string, string>();
    (profilesData || []).forEach((p) => {
      profileMap.set(p.id, p.full_name || 'Unknown Staff');
    });

    // 6. Fetch Google Review threshold setting
    const { data: settingsData } = await admin
      .from('facility_settings')
      .select('review_qr_threshold_percent')
      .eq('id', '00000000-0000-0000-0000-000000000000')
      .single();

    const thresholdPercent = settingsData?.review_qr_threshold_percent ?? 90;

    // 7. Compute individual weighted scores for completed sessions
    interface ScoredSessionItem {
      sessionId: string;
      createdBy: string;
      formId: string;
      createdAt: string;
      dateKey: string;
      finalScore: number;
      visitStage: string | null;
      linkedSessionId: string | null;
    }

    const scoredSessionMap = new Map<string, ScoredSessionItem>();
    const scoredSessions: ScoredSessionItem[] = [];

    for (const s of completedSessions) {
      const resp = responseMap.get(s.id);
      if (!resp) continue;

      const form = formMap.get(s.form_id);
      if (!form) continue;

      const answers = resp.answers || {};
      const textScores = answers._textScores || {};
      const { finalScore } = computeWeightedScore(form.fields, answers, textScores);

      const dateKey = s.created_at ? s.created_at.split('T')[0] : '';
      const item: ScoredSessionItem = {
        sessionId: s.id,
        createdBy: s.created_by,
        formId: s.form_id,
        createdAt: s.created_at,
        dateKey,
        finalScore: Math.round(finalScore),
        visitStage: s.visit_stage,
        linkedSessionId: s.linked_session_id,
      };

      scoredSessions.push(item);
      scoredSessionMap.set(s.id, item);
    }

    // 8. Group into Visit Units for score aggregation (combining linked pairs into 1 Visit Unit)
    interface VisitUnit {
      unitId: string;
      dateKey: string;
      score: number;
    }

    const visitUnits: VisitUnit[] = [];
    const processedIds = new Set<string>();

    for (const s of completedSessions) {
      if (processedIds.has(s.id)) continue;

      const currentScored = scoredSessionMap.get(s.id);
      if (!currentScored) continue;

      let partnerScored: ScoredSessionItem | undefined = undefined;

      if (s.visit_stage === 'pick_up' && s.linked_session_id) {
        partnerScored = scoredSessionMap.get(s.linked_session_id);
      } else if (s.visit_stage === 'drop_off') {
        partnerScored = Array.from(scoredSessionMap.values()).find(
          (item) => item.linkedSessionId === s.id
        );
      }

      if (partnerScored && !processedIds.has(partnerScored.sessionId)) {
        processedIds.add(s.id);
        processedIds.add(partnerScored.sessionId);

        const blendedScore = Math.round((currentScored.finalScore + partnerScored.finalScore) / 2);
        // Use pick-up date (or latest date) as unit date
        const unitDateKey = partnerScored.dateKey || currentScored.dateKey;

        visitUnits.push({
          unitId: `visit_${s.id}_${partnerScored.sessionId}`,
          dateKey: unitDateKey,
          score: blendedScore,
        });
      } else {
        processedIds.add(s.id);
        visitUnits.push({
          unitId: s.id,
          dateKey: currentScored.dateKey,
          score: currentScored.finalScore,
        });
      }
    }

    // ─── REPORT 1: scoreTrend ──────────────────────────────────────────────
    const scoreTrendMap: Record<string, number[]> = {};
    dateBuckets.forEach((d) => {
      scoreTrendMap[d] = [];
    });

    visitUnits.forEach((vu) => {
      if (scoreTrendMap[vu.dateKey] !== undefined) {
        scoreTrendMap[vu.dateKey].push(vu.score);
      }
    });

    const scoreTrend: ScoreTrendItem[] = dateBuckets.map((d) => {
      const scores = scoreTrendMap[d] || [];
      const avg = scores.length > 0
        ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1))
        : null;
      return { date: d, avgScore: avg };
    });

    // ─── REPORT 2: sessionVolume ───────────────────────────────────────────
    const volumeMap: Record<string, { started: number; completed: number; refused: number }> = {};
    dateBuckets.forEach((d) => {
      volumeMap[d] = { started: 0, completed: 0, refused: 0 };
    });

    sessions.forEach((s) => {
      const dKey = s.created_at ? s.created_at.split('T')[0] : '';
      if (volumeMap[dKey]) {
        if (s.status === 'completed') {
          volumeMap[dKey].completed++;
        } else if (s.status === 'refused') {
          volumeMap[dKey].refused++;
        } else {
          volumeMap[dKey].started++;
        }
      }
    });

    const sessionVolume: SessionVolumeItem[] = dateBuckets.map((d) => ({
      date: d,
      started: volumeMap[d]?.started || 0,
      completed: volumeMap[d]?.completed || 0,
      refused: volumeMap[d]?.refused || 0,
    }));

    // ─── REPORT 3: sessionsByForm ──────────────────────────────────────────
    const formAggMap = new Map<string, { formId: string; formName: string; count: number; scores: number[] }>();

    sessions.forEach((s) => {
      const fId = s.form_id;
      if (!fId) return;
      const fName = formMap.get(fId)?.name || 'Unknown Form';

      if (!formAggMap.has(fId)) {
        formAggMap.set(fId, { formId: fId, formName: fName, count: 0, scores: [] });
      }
      formAggMap.get(fId)!.count++;
    });

    scoredSessions.forEach((ss) => {
      if (formAggMap.has(ss.formId)) {
        formAggMap.get(ss.formId)!.scores.push(ss.finalScore);
      }
    });

    const sessionsByForm: SessionsByFormItem[] = Array.from(formAggMap.values())
      .map((item) => ({
        formId: item.formId,
        formName: item.formName,
        sessionCount: item.count,
        avgScore: item.scores.length > 0
          ? Number((item.scores.reduce((a, b) => a + b, 0) / item.scores.length).toFixed(1))
          : null,
      }))
      .sort((a, b) => b.sessionCount - a.sessionCount);

    // ─── REPORT 4: sessionsByReceptionist ──────────────────────────────────
    const staffAggMap = new Map<string, { staffId: string; staffName: string; count: number; scores: number[] }>();

    sessions.forEach((s) => {
      const stId = s.created_by;
      if (!stId) return;
      const stName = profileMap.get(stId) || 'Unknown Staff';

      if (!staffAggMap.has(stId)) {
        staffAggMap.set(stId, { staffId: stId, staffName: stName, count: 0, scores: [] });
      }
      staffAggMap.get(stId)!.count++;
    });

    scoredSessions.forEach((ss) => {
      if (staffAggMap.has(ss.createdBy)) {
        staffAggMap.get(ss.createdBy)!.scores.push(ss.finalScore);
      }
    });

    const sessionsByReceptionist: SessionsByReceptionistItem[] = Array.from(staffAggMap.values())
      .map((item) => ({
        staffId: item.staffId,
        staffName: item.staffName,
        sessionCount: item.count,
        avgScore: item.scores.length > 0
          ? Number((item.scores.reduce((a, b) => a + b, 0) / item.scores.length).toFixed(1))
          : null,
      }))
      .sort((a, b) => b.sessionCount - a.sessionCount);

    // ─── REPORT 5: sessionsByLanguage ──────────────────────────────────────
    let enCount = 0;
    let arCount = 0;
    sessions.forEach((s) => {
      if (s.language === 'ar') {
        arCount++;
      } else {
        enCount++;
      }
    });
    const sessionsByLanguage: SessionsByLanguage = { en: enCount, ar: arCount };

    // ─── REPORT 6: satisfactionDistribution ───────────────────────────────
    let band0to49 = 0;
    let band50to69 = 0;
    let band70to89 = 0;
    let band90to100 = 0;

    visitUnits.forEach((vu) => {
      if (vu.score < 50) band0to49++;
      else if (vu.score < 70) band50to69++;
      else if (vu.score < 90) band70to89++;
      else band90to100++;
    });

    const satisfactionDistribution: SatisfactionDistribution = {
      band0to49,
      band50to69,
      band70to89,
      band90to100,
    };

    // ─── REPORT 7: googleReviewConversion ──────────────────────────────────
    const totalCompletedVisits = visitUnits.length;
    const thresholdMetVisits = visitUnits.filter((vu) => vu.score >= thresholdPercent).length;
    const conversionRate = totalCompletedVisits > 0
      ? Number(((thresholdMetVisits / totalCompletedVisits) * 100).toFixed(1))
      : 0;

    const googleReviewConversion: GoogleReviewConversion = {
      totalCompleted: totalCompletedVisits,
      thresholdMet: thresholdMetVisits,
      conversionRate,
    };

    // ─── REPORT 8: completionRate ──────────────────────────────────────────
    let startedCount = 0;
    let completedCount = 0;
    let refusedCount = 0;
    let abandonedCount = 0;

    sessions.forEach((s) => {
      if (s.status === 'completed') completedCount++;
      else if (s.status === 'refused') refusedCount++;
      else if (s.status === 'abandoned') abandonedCount++;
      else startedCount++;
    });

    const totalSessions = sessions.length;
    const completionRatePercent = totalSessions > 0
      ? Number(((completedCount / totalSessions) * 100).toFixed(1))
      : 0;

    const completionRate: CompletionRateData = {
      started: startedCount,
      completed: completedCount,
      refused: refusedCount,
      abandoned: abandonedCount,
      total: totalSessions,
      completionRatePercent,
    };

    return {
      scoreTrend,
      sessionVolume,
      sessionsByForm,
      sessionsByReceptionist,
      sessionsByLanguage,
      satisfactionDistribution,
      googleReviewConversion,
      completionRate,
    };
  } catch (err) {
    console.error('Error computing reports data:', err);
    return emptyResult;
  }
}
