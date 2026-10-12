import 'server-only';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { decryptPlate } from '@/lib/utils/plate-number';
import { getPresetDates } from '@/lib/utils/date-range';
import { checkRateLimit } from '@/lib/rate-limit';
import { guardAnalyticsAccess } from '@/server/lib/analytics-access';
import { computeWeightedScore } from '@/server/services/sessions.service';
import {
  buildAnalyticsReport,
  previousRange,
  type EngineField,
  type EngineForm,
  type EngineInput,
  type EngineResponse,
  type EngineSession,
} from '@/server/lib/survey-analytics/engine';
import type { AnalyticsReport, Lang, Stage } from '@/lib/analytics/types';

export interface AnalysisFilters {
  startDate: string;
  endDate: string;
  visitStage: Stage | 'all';
}

interface RawSession {
  id: string;
  status: string;
  visit_stage: string | null;
  language: string | null;
  created_at: string;
  google_review_clicked: boolean | null;
  google_review_qr_shown: boolean | null;
  form_id: string | null;
  plate_number_encrypted: string | null;
  mobile_number: string | null;
}

interface RawResponse {
  id: string;
  session_id: string;
  form_id: string | null;
  submitted_at: string;
  answers: Record<string, unknown> | null;
  interaction_metadata: Record<string, unknown> | null;
}

interface PeriodData {
  sessions: RawSession[];
  responses: RawResponse[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SPAN_DAYS = 400;
const PAGE_SIZE = 1000;
const DEFAULT_REVIEW_THRESHOLD = 90;

const SESSION_COLUMNS =
  'id, status, visit_stage, language, created_at, google_review_clicked, google_review_qr_shown, form_id, plate_number_encrypted, mobile_number';
const RESPONSE_COLUMNS = 'id, session_id, form_id, submitted_at, answers, interaction_metadata';

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

/** A YYYY-MM-DD string that is also a real calendar date (2026-13-01 is not). */
function validDate(value: string | null | undefined): string | null {
  if (!value || !DATE_RE.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value ? value : null;
}

export function normalizeFilters(input: {
  startDate?: string | null;
  endDate?: string | null;
  visitStage?: string | null;
}): AnalysisFilters {
  const defaults = getPresetDates('30d');
  let startDate = validDate(input.startDate) ?? defaults.startDate;
  let endDate = validDate(input.endDate) ?? defaults.endDate;
  if (startDate > endDate) [startDate, endDate] = [endDate, startDate];

  const spanDays = Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000) + 1;
  if (spanDays > MAX_SPAN_DAYS) {
    const d = new Date(`${endDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - (MAX_SPAN_DAYS - 1));
    startDate = d.toISOString().slice(0, 10);
  }

  const visitStage = input.visitStage === 'drop_off' || input.visitStage === 'pick_up' ? input.visitStage : 'all';
  return { startDate, endDate, visitStage };
}

// ---------------------------------------------------------------------------
// Data loading (lean columns, paginated past the 1000 row API cap)
// ---------------------------------------------------------------------------

/** One retry covers a transient API hiccup (a brief clock skew error was seen from the Supabase gateway). */
async function retryOnce<T>(fn: () => PromiseLike<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    await new Promise((r) => setTimeout(r, 600));
    return await fn();
  }
}

async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const rows = await retryOnce(async () => {
      const { data, error } = await page(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(error.message);
      return (data ?? []) as T[];
    });
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return out;
}

async function loadPeriod(range: { startDate: string; endDate: string }, stage: Stage | 'all'): Promise<PeriodData> {
  const admin = createAdminClient();
  // Date boundaries are UTC, matching the Reports and Survey Responses pages so counts agree.
  const startIso = `${range.startDate}T00:00:00.000Z`;
  const endIso = `${range.endDate}T23:59:59.999Z`;

  const [sessions, responses] = await Promise.all([
    fetchAll<RawSession>((from, to) => {
      let q = admin.from('sessions').select(SESSION_COLUMNS).gte('created_at', startIso).lte('created_at', endIso);
      if (stage !== 'all') q = q.eq('visit_stage', stage);
      return q.order('created_at', { ascending: true }).order('id', { ascending: true }).range(from, to);
    }),
    // The inner join keeps only responses whose session started inside the range, with no giant id list.
    fetchAll<RawResponse>((from, to) => {
      let q = admin
        .from('responses')
        .select(`${RESPONSE_COLUMNS}, sessions!inner(created_at, visit_stage)`)
        .gte('sessions.created_at', startIso)
        .lte('sessions.created_at', endIso);
      if (stage !== 'all') q = q.eq('sessions.visit_stage', stage);
      return q.order('id', { ascending: true }).range(from, to);
    }),
  ]);
  return { sessions, responses };
}

async function loadForms(): Promise<EngineForm[]> {
  const admin = createAdminClient();
  const data = await retryOnce(async () => {
    const res = await admin.from('forms').select('id, fields, created_at');
    if (res.error) throw new Error(res.error.message);
    return res.data;
  });
  return (data ?? []).map((f) => ({
    id: f.id as string,
    createdAt: (f.created_at as string) ?? '',
    fields: Array.isArray(f.fields) ? (f.fields as EngineField[]) : [],
  }));
}

async function loadReviewThreshold(): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('facility_settings')
    .select('review_qr_threshold_percent')
    .eq('id', '00000000-0000-0000-0000-000000000000')
    .single();
  const t = data?.review_qr_threshold_percent;
  return typeof t === 'number' ? t : DEFAULT_REVIEW_THRESHOLD;
}

function toEngineInput(
  filters: { startDate: string; endDate: string; visitStage: Stage | 'all' },
  data: PeriodData,
  forms: EngineForm[],
  reviewThresholdPercent: number,
  maxComments?: number
): EngineInput {
  const sessions: EngineSession[] = data.sessions.map((s) => ({
    id: s.id,
    status: s.status,
    visitStage: s.visit_stage === 'drop_off' || s.visit_stage === 'pick_up' ? s.visit_stage : null,
    language: (s.language === 'ar' ? 'ar' : 'en') as Lang,
    createdAt: s.created_at,
    googleReviewClicked: !!s.google_review_clicked,
    googleReviewQrShown: !!s.google_review_qr_shown,
    formId: s.form_id,
  }));
  const responses: EngineResponse[] = data.responses.map((r) => ({
    id: r.id,
    sessionId: r.session_id,
    formId: r.form_id,
    submittedAt: r.submitted_at,
    answers: r.answers ?? {},
    interactionMetadata: r.interaction_metadata ?? {},
  }));
  return {
    startDate: filters.startDate,
    endDate: filters.endDate,
    visitStage: filters.visitStage,
    forms,
    sessions,
    responses,
    reviewThresholdPercent,
    weightedScore: computeWeightedScore,
    maxComments,
  };
}

// ---------------------------------------------------------------------------
// Public service functions
// ---------------------------------------------------------------------------

export interface LoadedAnalysis {
  report: AnalyticsReport;
  /** Raw rows of the current period, for the AI annotation step (server side only). */
  current: PeriodData;
}

/**
 * Loads the dataset for the range and the previous period of equal length (in parallel)
 * and builds the report. Plate and phone numbers are attached for follow up items only.
 */
export interface LoadOptions {
  /**
   * Decrypt plate and phone numbers for the follow up list. Off by default so a caller that forgets
   * to think about PII gets none; only the guarded page and the guarded GET route switch it on.
   */
  includeContacts?: boolean;
  /** Comments to return, newest first (default 300). */
  maxComments?: number;
}

export async function loadAnalysis(filters: AnalysisFilters, opts: LoadOptions = {}): Promise<LoadedAnalysis> {
  const includeContacts = opts.includeContacts ?? false;
  const prevRange = previousRange(filters.startDate, filters.endDate);
  const [forms, threshold, current, previous] = await Promise.all([
    loadForms(),
    loadReviewThreshold(),
    loadPeriod(filters, filters.visitStage),
    loadPeriod(prevRange, filters.visitStage),
  ]);

  const report = buildAnalyticsReport(
    toEngineInput(filters, current, forms, threshold, opts.maxComments),
    toEngineInput({ ...prevRange, visitStage: filters.visitStage }, previous, forms, threshold)
  );

  // Plates and phone numbers are decrypted for the follow up list only, and never on the AI paths.
  if (includeContacts) {
    const bySession = new Map(current.sessions.map((s) => [s.id, s]));
    for (const item of report.followUps.items) {
      const s = bySession.get(item.sessionId);
      item.plate = decryptPlate(s?.plate_number_encrypted ?? null);
      item.mobile = s?.mobile_number ?? null;
    }
  }

  return { report, current };
}

export async function getAnalysisReport(filters: AnalysisFilters, opts: LoadOptions = {}): Promise<AnalyticsReport> {
  return (await loadAnalysis(filters, opts)).report;
}

export async function getAnalysisReportService(request: Request): Promise<NextResponse> {
  const denied = await guardAnalyticsAccess();
  if (denied) return denied;
  if (!checkRateLimit(request, 'analysis_report', { windowMs: 60_000, max: 60 }).allowed) {
    return NextResponse.json({ error: 'Too many requests. Please wait a minute.' }, { status: 429 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const filters = normalizeFilters({
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      visitStage: searchParams.get('visitStage'),
    });
    return NextResponse.json(await getAnalysisReport(filters, { includeContacts: true }));
  } catch (error: unknown) {
    console.error('[survey-analytics.service] getAnalysisReportService error:', error);
    return NextResponse.json({ error: 'Failed to build the feedback analysis' }, { status: 500 });
  }
}
