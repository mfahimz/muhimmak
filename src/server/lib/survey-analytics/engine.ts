// Pure analytics engine for the Feedback Analysis page.
//
// No database, no AI, no server-only imports: it turns already loaded rows into a
// report, so every number on the page is reproducible and costs no tokens.
// The weighted scoring function is injected (the service passes computeWeightedScore
// from sessions.service) so scoring stays single sourced.

import {
  ANNOTATION_VERSION,
  COMMENT_CATEGORIES,
  COMMENT_THEMES,
  FOLLOW_UP_BELOW,
  bucketOf,
  type AnalyticsReport,
  type AnswerRef,
  type Bucket,
  type CommentCategory,
  type CommentInsight,
  type CommentItem,
  type CommentProvenance,
  type CommentTheme,
  type CompoundProblem,
  type DataQuality,
  type FollowUpItem,
  type Lang,
  type LangQuestionStat,
  type MonthPoint,
  type OptionStat,
  type Overview,
  type PreviousPeriod,
  type QuestionAnalysis,
  type ScoreStat,
  type Stage,
  type StageKey,
  type StaffMention,
  type StoredCommentInsight,
  type ThemeStat,
  type TrendPoint,
  type WeekdayPoint,
} from '@/lib/analytics/types';
import { buildFindings } from './findings';
import { isAnswered, isUsableComment } from './text';

// ---------------------------------------------------------------------------
// Input contract
// ---------------------------------------------------------------------------

export interface EngineField {
  id: string;
  type: string;
  label?: string;
  options?: string[];
  optionScores?: number[];
  weight?: number;
  ar?: { label?: string; options?: string[] };
  visit_stage?: string;
  dependsOn?: unknown;
}

export interface EngineForm {
  id: string;
  createdAt: string;
  fields: EngineField[];
}

export interface EngineSession {
  id: string;
  status: string;
  visitStage: Stage | null;
  language: Lang;
  createdAt: string;
  googleReviewClicked: boolean;
  googleReviewQrShown: boolean;
  formId: string | null;
}

export interface EngineResponse {
  id: string;
  sessionId: string;
  formId: string | null;
  submittedAt: string;
  answers: Record<string, unknown>;
  interactionMetadata: Record<string, unknown>;
}

export type WeightedScoreFn = (
  fields: EngineField[],
  answers: Record<string, unknown>,
  textScores?: Record<string, number>
) => { finalScore: number; aiTextScore: number | null };

export interface EngineInput {
  startDate: string;
  endDate: string;
  visitStage: Stage | 'all';
  forms: EngineForm[];
  sessions: EngineSession[];
  responses: EngineResponse[];
  reviewThresholdPercent: number;
  weightedScore: WeightedScoreFn;
  /** Comments returned in the report (newest first). Defaults to 300; the classifier asks for all of them. */
  maxComments?: number;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const TZ = 'Asia/Dubai';
const SCOREABLE = new Set(['star_rating', 'multiple_choice', 'numeric_scale', 'text']);
const MAX_COMMENTS_RETURNED = 300;
const MAX_FOLLOW_UPS = 30;
const MAX_TREND_POINTS = 120;
const MIN_GROUP = 3;

const dubaiDateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function dubaiDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : dubaiDateFmt.format(d);
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function mondayOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (dow - 1));
  return d.toISOString().slice(0, 10);
}

function daysInclusive(start: string, end: string): number {
  const a = new Date(`${start}T00:00:00Z`).getTime();
  const b = new Date(`${end}T00:00:00Z`).getTime();
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

function mean(xs: number[]): number | null {
  return xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

function clampScore(x: number): number {
  return Number.isFinite(x) ? Math.min(100, Math.max(0, x)) : x;
}

function r1(x: number | null): number | null {
  return x === null ? null : Math.round(x * 10) / 10;
}

function stat(xs: number[]): ScoreStat {
  return { n: xs.length, avg: r1(mean(xs)) };
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function stageKeyOf(v: string | undefined | null): StageKey {
  return v === 'drop_off' || v === 'pick_up' ? v : 'general';
}

const STAGE_RANK: Record<StageKey, number> = { drop_off: 0, pick_up: 1, general: 2 };

// ---------------------------------------------------------------------------
// Answer normalization
// ---------------------------------------------------------------------------

interface Normalized {
  key: string;
  score: number | null;
  raw: number | null;
}

function normalizeStructured(field: EngineField, answer: unknown): Normalized | null {
  if (field.type === 'star_rating') {
    const v = Number(answer);
    if (!Number.isFinite(v) || v < 1 || v > 5) return null;
    return { key: String(v), score: (v / 5) * 100, raw: v };
  }
  if (field.type === 'numeric_scale') {
    const v = Number(answer);
    if (!Number.isFinite(v) || v < 1 || v > 10) return null;
    return { key: String(v), score: ((v - 1) / 9) * 100, raw: v };
  }
  if (field.type === 'multiple_choice') {
    const key = String(answer).trim();
    const options = Array.isArray(field.options) ? field.options : [];
    const idx = options.indexOf(String(answer));
    const s = idx >= 0 && Array.isArray(field.optionScores) ? field.optionScores[idx] : undefined;
    return { key, score: typeof s === 'number' && Number.isFinite(s) ? s : null, raw: null };
  }
  return null;
}

function hasWeightedAnswer(fields: EngineField[], answers: Record<string, unknown>): boolean {
  return fields.some((f) => SCOREABLE.has(f.type) && (f.weight ?? 0) > 0 && isAnswered(answers[f.id]));
}

// ---------------------------------------------------------------------------
// Row + aggregate shapes
// ---------------------------------------------------------------------------

interface Item {
  qid: string;
  key: string;
  score: number | null;
  bucket: Bucket | null;
}

interface Row {
  responseId: string;
  sessionId: string;
  stage: StageKey;
  lang: Lang;
  at: string;
  overall: number;
  fields: EngineField[];
  answers: Record<string, unknown>;
  textScores: Record<string, number>;
  items: Item[];
  negatives: AnswerRef[];
}

interface OptAgg {
  count: number;
  score: number | null;
  rest: number[];
  labelAr: string | null;
}

interface Agg {
  latest: EngineField;
  stage: StageKey;
  order: number;
  conditional: boolean;
  shown: number;
  answered: number;
  scores: number[];
  buckets: Record<Bucket, number>;
  raw: number[];
  opts: Map<string, OptAgg>;
  lang: Record<Lang, { scores: number[]; neg: number }>;
  negRest: number[];
  posRest: number[];
  textTotal: number;
  textUsable: number;
  textClassified: number;
  textScores: number[];
}

function emptyAgg(latest: EngineField, order: number): Agg {
  return {
    latest,
    stage: stageKeyOf(latest.visit_stage),
    order,
    conditional: !!latest.dependsOn,
    shown: 0,
    answered: 0,
    scores: [],
    buckets: { positive: 0, neutral: 0, negative: 0 },
    raw: [],
    opts: new Map(),
    lang: { en: { scores: [], neg: 0 }, ar: { scores: [], neg: 0 } },
    negRest: [],
    posRest: [],
    textTotal: 0,
    textUsable: 0,
    textClassified: 0,
    textScores: [],
  };
}

function parseInsight(raw: unknown): CommentInsight | null {
  const r = asRecord(raw) as Partial<StoredCommentInsight>;
  if (r.v !== ANNOTATION_VERSION) return null;
  if (!COMMENT_CATEGORIES.includes(r.c as CommentCategory)) return null;
  const themes = (Array.isArray(r.t) ? r.t : []).filter((t): t is CommentTheme =>
    (COMMENT_THEMES as readonly string[]).includes(t as string)
  );
  const staff = (Array.isArray(r.s) ? r.s : []).filter((s): s is string => typeof s === 'string' && s.trim() !== '');
  return {
    category: r.c as CommentCategory,
    themes,
    staff,
    gist: typeof r.g === 'string' ? r.g : '',
  };
}

interface ClosingInfo {
  shownSource: 'ai' | 'static' | null;
  shownType: string | null;
  shownLabel: string | null;
  aiSucceeded: boolean;
  lastSeen: string | null;
}

function closingInfo(meta: Record<string, unknown>): ClosingInfo {
  const shown = asRecord(meta.closing_question_shown);
  const ai = asRecord(meta.closing_question_ai);
  const source = shown.source === 'ai' || shown.source === 'static' ? shown.source : null;
  return {
    shownSource: source,
    shownType: typeof shown.type === 'string' ? shown.type : null,
    shownLabel: typeof shown.label === 'string' ? shown.label : null,
    aiSucceeded: ai.succeeded === true,
    lastSeen: typeof meta.last_seen_field_id === 'string' ? meta.last_seen_field_id : null,
  };
}

// ---------------------------------------------------------------------------
// Core build (one period)
// ---------------------------------------------------------------------------

interface CoreResult {
  report: Omit<AnalyticsReport, 'findings' | 'previous'>;
  weeklyPoints: TrendPoint[];
}

function buildCore(input: EngineInput): CoreResult {
  const { startDate, endDate, visitStage, weightedScore } = input;

  const formsById = new Map(input.forms.map((f) => [f.id, f]));
  const formsNewestFirst = [...input.forms].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // Latest definition of every question (current wording, options, type).
  const latestDef = new Map<string, { field: EngineField; order: number }>();
  for (const form of formsNewestFirst) {
    form.fields.forEach((field, idx) => {
      if (!latestDef.has(field.id)) latestDef.set(field.id, { field, order: idx });
    });
  }

  const sessions = input.sessions.filter((s) => visitStage === 'all' || s.visitStage === visitStage);
  const sessionById = new Map(sessions.map((s) => [s.id, s]));

  // One response per session (keep the latest).
  const latestResponse = new Map<string, EngineResponse>();
  for (const r of input.responses) {
    if (!sessionById.has(r.sessionId)) continue;
    const prev = latestResponse.get(r.sessionId);
    if (!prev || r.submittedAt > prev.submittedAt) latestResponse.set(r.sessionId, r);
  }

  const aggs = new Map<string, Agg>();
  const getAgg = (field: EngineField): Agg => {
    let a = aggs.get(field.id);
    if (!a) {
      const def = latestDef.get(field.id) ?? { field, order: 0 };
      a = emptyAgg(def.field, def.order);
      aggs.set(field.id, a);
    }
    return a;
  };

  const rows: Row[] = [];
  const comments: CommentItem[] = [];
  const dq: DataQuality = {
    unscoredComments: 0,
    unscoredWeighted: 0,
    junkComments: 0,
    aiFollowUpAnswers: 0,
    aiFollowUpUncertain: 0,
    emptySubmissions: 0,
    reviewTrackingGap: false,
  };
  const commentsByResponse = new Map<string, string>();

  for (const session of sessions) {
    if (session.status !== 'completed') continue;
    const resp = latestResponse.get(session.id);
    const form = formsById.get(resp?.formId ?? session.formId ?? '');
    if (!resp || !form) {
      dq.emptySubmissions++;
      continue;
    }

    const answers = resp.answers ?? {};
    const meta = resp.interactionMetadata ?? {};
    // Keep only numeric sentiment scores: a corrupt value must not turn a whole survey into NaN.
    const textScores: Record<string, number> = {};
    for (const [k, v] of Object.entries(asRecord(answers._textScores))) {
      if (typeof v === 'number' && Number.isFinite(v)) textScores[k] = v;
    }
    const fields = form.fields;

    if (!hasWeightedAnswer(fields, answers)) {
      dq.emptySubmissions++;
      continue;
    }

    // Answers come from a public endpoint, so an out of range value must not push a score past 0..100.
    const overall = clampScore(weightedScore(fields, answers, textScores).finalScore);
    if (!Number.isFinite(overall)) {
      dq.emptySubmissions++;
      continue;
    }

    const stage: StageKey = session.visitStage ?? 'general';
    const lang = session.language;
    const at = resp.submittedAt || session.createdAt;
    const branchedRaw = asRecord(answers._branchedAway).fieldIds;
    const branched = Array.isArray(branchedRaw) ? new Set(branchedRaw.map(String)) : null;
    const closing = closingInfo(meta);
    const insights = asRecord(meta.text_insights);

    const row: Row = {
      responseId: resp.id,
      sessionId: session.id,
      stage,
      lang,
      at,
      overall,
      fields,
      answers,
      textScores,
      items: [],
      negatives: [],
    };

    const rowComments: CommentItem[] = [];

    for (const field of fields) {
      if (!SCOREABLE.has(field.type)) continue;
      const value = answers[field.id];
      const present = isAnswered(value);
      // A visit journey form holds both stages' questions, but a customer only sees their own stage.
      const otherStage =
        (field.visit_stage === 'drop_off' || field.visit_stage === 'pick_up') && stage !== 'general' && field.visit_stage !== stage;
      if (otherStage && !present) continue;
      const agg = getAgg(field);
      const wasShown = branched ? !branched.has(field.id) : !field.dependsOn;
      if (wasShown || present) agg.shown++;
      if (!present) continue;

      const isClosingSlot = closing.lastSeen === field.id;
      const aiKnown = isClosingSlot && closing.shownSource === 'ai';
      const aiUncertain = isClosingSlot && closing.shownSource === null && closing.aiSucceeded && lang === 'en';

      // The answer belongs to an AI generated question, not the form question.
      if (aiKnown) {
        dq.aiFollowUpAnswers++;
        if (closing.shownType === 'text') {
          const text = String(value).trim();
          rowComments.push({
            responseId: resp.id,
            questionId: field.id,
            stage,
            language: lang,
            submittedAt: at,
            text,
            usable: isUsableComment(text),
            aiScore: null,
            overall,
            provenance: 'ai_follow_up',
            followUpLabel: closing.shownLabel,
            negativeOn: [],
            insight: parseInsight(insights[field.id]),
          });
        }
        continue;
      }
      if (aiUncertain && field.type !== 'text') {
        dq.aiFollowUpUncertain++;
        continue;
      }

      agg.answered++;

      if (field.type === 'text') {
        const text = String(value).trim();
        const usable = isUsableComment(text);
        const aiScoreRaw = textScores[field.id];
        const aiScore = typeof aiScoreRaw === 'number' && Number.isFinite(aiScoreRaw) ? aiScoreRaw : null;
        const insight = usable ? parseInsight(insights[field.id]) : null;
        const provenance: CommentProvenance = aiUncertain ? 'ai_follow_up_uncertain' : 'form';
        if (aiUncertain) dq.aiFollowUpUncertain++;

        agg.textTotal++;
        if (usable) {
          agg.textUsable++;
          if (insight) agg.textClassified++;
          if (aiScore !== null) {
            agg.textScores.push(aiScore);
            agg.scores.push(aiScore);
            agg.buckets[bucketOf(aiScore)]++;
          } else {
            dq.unscoredComments++;
            if ((field.weight ?? 0) > 0) dq.unscoredWeighted++;
          }
        } else {
          dq.junkComments++;
        }

        rowComments.push({
          responseId: resp.id,
          questionId: field.id,
          stage,
          language: lang,
          submittedAt: at,
          text,
          usable,
          aiScore,
          overall,
          provenance,
          followUpLabel: null,
          negativeOn: [],
          insight,
        });
        continue;
      }

      const norm = normalizeStructured(field, value);
      if (!norm) {
        agg.answered--;
        continue;
      }

      const bucket = norm.score === null ? null : bucketOf(norm.score);
      row.items.push({ qid: field.id, key: norm.key, score: norm.score, bucket });

      // Raw value distribution only when the answer was given on the question's current scale.
      if (norm.raw !== null && field.type === agg.latest.type) agg.raw.push(norm.raw);

      let opt = agg.opts.get(norm.key);
      if (!opt) {
        const idx = Array.isArray(field.options) ? field.options.indexOf(norm.key) : -1;
        const labelAr = idx >= 0 ? (field.ar?.options?.[idx] ?? null) : null;
        opt = { count: 0, score: norm.score, rest: [], labelAr: labelAr ? labelAr.trim() : null };
        agg.opts.set(norm.key, opt);
      }
      opt.count++;

      if (norm.score !== null && bucket) {
        agg.scores.push(norm.score);
        agg.buckets[bucket]++;
        agg.lang[lang].scores.push(norm.score);
        if (bucket === 'negative') {
          agg.lang[lang].neg++;
          row.negatives.push({ questionId: field.id, key: norm.key });
        }

        // Score of the rest of the survey, without this question's own weight.
        const others = fields.filter((f) => f.id !== field.id);
        if (hasWeightedAnswer(others, answers)) {
          const rest = clampScore(weightedScore(others, answers, textScores).finalScore);
          if (Number.isFinite(rest)) {
            opt.rest.push(rest);
            if (bucket === 'negative') agg.negRest.push(rest);
            if (bucket === 'positive') agg.posRest.push(rest);
          }
        }
      }
    }

    const negativeIds = row.negatives.map((n) => n.questionId);
    for (const c of rowComments) c.negativeOn = negativeIds;
    comments.push(...rowComments);
    const firstUsable = rowComments.find((c) => c.usable);
    if (firstUsable) commentsByResponse.set(resp.id, firstUsable.text.slice(0, 300));

    rows.push(row);
  }

  // ----- question analyses ---------------------------------------------------
  const questions: QuestionAnalysis[] = [...aggs.entries()]
    .filter(([, a]) => a.answered > 0)
    .map(([id, a]): QuestionAnalysis => {
      const f = a.latest;
      const isText = f.type === 'text';
      const scaleMax = f.type === 'star_rating' ? 5 : f.type === 'numeric_scale' ? 10 : null;

      const options: OptionStat[] = [];
      const scoredTotal = a.scores.length;
      if (f.type === 'multiple_choice') {
        const seen = new Set<string>();
        (f.options ?? []).forEach((key, idx) => {
          seen.add(key);
          const o = a.opts.get(key);
          const score = typeof f.optionScores?.[idx] === 'number' ? (f.optionScores[idx] as number) : null;
          options.push({
            key,
            labelEn: key,
            labelAr: f.ar?.options?.[idx]?.trim() || null,
            count: o?.count ?? 0,
            pct: a.answered > 0 ? Math.round(((o?.count ?? 0) / a.answered) * 100) : 0,
            score,
            bucket: score === null ? null : bucketOf(score),
            restAvg: o && o.rest.length >= MIN_GROUP ? r1(mean(o.rest)) : null,
          });
        });
        for (const [key, o] of a.opts) {
          if (seen.has(key)) continue;
          options.push({
            key,
            labelEn: key,
            labelAr: o.labelAr,
            count: o.count,
            pct: a.answered > 0 ? Math.round((o.count / a.answered) * 100) : 0,
            score: o.score,
            bucket: o.score === null ? null : bucketOf(o.score),
            restAvg: o.rest.length >= MIN_GROUP ? r1(mean(o.rest)) : null,
          });
        }
      } else if (scaleMax) {
        for (let v = 1; v <= scaleMax; v++) {
          const o = a.opts.get(String(v));
          const score = f.type === 'star_rating' ? (v / 5) * 100 : ((v - 1) / 9) * 100;
          options.push({
            key: String(v),
            labelEn: String(v),
            labelAr: null,
            count: o?.count ?? 0,
            pct: a.answered > 0 ? Math.round(((o?.count ?? 0) / a.answered) * 100) : 0,
            score: Math.round(score * 10) / 10,
            bucket: bucketOf(score),
            restAvg: o && o.rest.length >= MIN_GROUP ? r1(mean(o.rest)) : null,
          });
        }
      }

      const langStat = (l: Lang): LangQuestionStat => {
        const g = a.lang[l];
        return {
          n: g.scores.length,
          avgScore: r1(mean(g.scores)),
          negativePct: g.scores.length > 0 ? Math.round((g.neg / g.scores.length) * 100) : null,
        };
      };

      const negN = a.negRest.length;
      const posN = a.posRest.length;
      const negRest = negN >= MIN_GROUP ? r1(mean(a.negRest)) : null;
      const posRest = posN >= MIN_GROUP ? r1(mean(a.posRest)) : null;

      return {
        id,
        labelEn: f.label?.trim() || 'Untitled question',
        labelAr: f.ar?.label?.trim() || null,
        type: f.type,
        stage: a.stage,
        weight: typeof f.weight === 'number' ? f.weight : 0,
        conditional: a.conditional,
        shown: a.shown,
        answered: a.answered,
        responseRate: a.shown > 0 ? Math.min(100, Math.round((a.answered / a.shown) * 100)) : null,
        scored: scoredTotal,
        avgRaw: r1(mean(a.raw)),
        scaleMax,
        avgScore: r1(mean(a.scores)),
        buckets: a.buckets,
        options,
        byLanguage: { en: langStat('en'), ar: langStat('ar') },
        driver: {
          negativeN: negN,
          positiveN: posN,
          negativeRest: negRest,
          positiveRest: posRest,
          gap: negRest !== null && posRest !== null ? r1(posRest - negRest) : null,
        },
        previousAvgScore: null,
        text: isText ? { total: a.textTotal, usable: a.textUsable, classified: a.textClassified } : null,
      };
    })
    .sort((x, y) => {
      const sx = STAGE_RANK[x.stage] - STAGE_RANK[y.stage];
      if (sx !== 0) return sx;
      const ax = aggs.get(x.id)?.order ?? 0;
      const ay = aggs.get(y.id)?.order ?? 0;
      return ax - ay;
    });

  // ----- compound problems ----------------------------------------------------
  const pairs = new Map<string, { a: AnswerRef; b: AnswerRef; scores: number[] }>();
  const loadScores: Record<'zero' | 'one' | 'twoPlus', number[]> = { zero: [], one: [], twoPlus: [] };
  for (const row of rows) {
    const n = row.negatives.length;
    loadScores[n === 0 ? 'zero' : n === 1 ? 'one' : 'twoPlus'].push(row.overall);
    if (n < 2) continue;
    const refs = [...row.negatives].sort((p, q) =>
      `${p.questionId}|${p.key}`.localeCompare(`${q.questionId}|${q.key}`)
    );
    for (let i = 0; i < refs.length; i++) {
      for (let j = i + 1; j < refs.length; j++) {
        const k = `${refs[i].questionId}|${refs[i].key}||${refs[j].questionId}|${refs[j].key}`;
        const entry = pairs.get(k) ?? { a: refs[i], b: refs[j], scores: [] };
        entry.scores.push(row.overall);
        pairs.set(k, entry);
      }
    }
  }
  const compound: CompoundProblem[] = [...pairs.values()]
    .filter((p) => p.scores.length >= 2)
    .map((p) => ({ a: p.a, b: p.b, customers: p.scores.length, avgScore: r1(mean(p.scores)) ?? 0 }))
    .sort((x, y) => y.customers - x.customers || x.avgScore - y.avgScore)
    .slice(0, 5);

  // ----- overview -------------------------------------------------------------
  const overalls = rows.map((r) => r.overall);
  const byStageScores: Record<Stage, number[]> = { drop_off: [], pick_up: [] };
  const byLangScores: Record<Lang, number[]> = { en: [], ar: [] };
  const bands = { below50: 0, from50to69: 0, from70to89: 0, from90: 0 };
  let eligible = 0;
  for (const r of rows) {
    if (r.stage === 'drop_off' || r.stage === 'pick_up') byStageScores[r.stage].push(r.overall);
    byLangScores[r.lang].push(r.overall);
    if (r.overall < 50) bands.below50++;
    else if (r.overall < 70) bands.from50to69++;
    else if (r.overall < 90) bands.from70to89++;
    else bands.from90++;
    if (r.stage === 'pick_up' && r.overall >= input.reviewThresholdPercent) eligible++;
  }

  const funnelCounts = { completed: 0, declined: 0, abandoned: 0, unfinished: 0 };
  let clicked = 0;
  let qrShown = 0;
  for (const s of sessions) {
    if (s.status === 'completed') funnelCounts.completed++;
    else if (s.status === 'refused') funnelCounts.declined++;
    else if (s.status === 'abandoned') funnelCounts.abandoned++;
    else funnelCounts.unfinished++;
    if (s.googleReviewClicked) clicked++;
    if (s.googleReviewQrShown) qrShown++;
  }
  dq.reviewTrackingGap = clicked > 0 && qrShown === 0;

  const usableComments = comments.filter((c) => c.usable);
  const classified = usableComments.filter((c) => c.insight).length;

  const overview: Overview = {
    surveys: rows.length,
    avgScore: r1(mean(overalls)),
    byStage: { drop_off: stat(byStageScores.drop_off), pick_up: stat(byStageScores.pick_up) },
    byLanguage: { en: stat(byLangScores.en), ar: stat(byLangScores.ar) },
    scoreBands: bands,
    comments: { total: comments.length, usable: usableComments.length, classified },
    googleReview: { clicked, eligible },
    funnel: {
      started: sessions.length,
      ...funnelCounts,
      completionRate: sessions.length > 0 ? Math.round((funnelCounts.completed / sessions.length) * 1000) / 10 : null,
    },
  };

  // ----- trends ---------------------------------------------------------------
  const granularity: 'day' | 'week' = daysInclusive(startDate, endDate) <= 21 ? 'day' : 'week';
  const bucketKey = (date: string) => (granularity === 'day' ? date : mondayOf(date));
  const trendMap = new Map<string, { all: number[]; drop: number[]; pick: number[] }>();
  const monthMap = new Map<string, { all: number[]; drop: number[]; pick: number[] }>();
  const weekdayMap = new Map<number, number[]>();
  for (const r of rows) {
    const date = dubaiDate(r.at);
    if (!date) continue;
    const put = (m: Map<string, { all: number[]; drop: number[]; pick: number[] }>, key: string) => {
      const g = m.get(key) ?? { all: [], drop: [], pick: [] };
      g.all.push(r.overall);
      if (r.stage === 'drop_off') g.drop.push(r.overall);
      if (r.stage === 'pick_up') g.pick.push(r.overall);
      m.set(key, g);
    };
    put(trendMap, bucketKey(date));
    put(monthMap, date.slice(0, 7));
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
    weekdayMap.set(dow, [...(weekdayMap.get(dow) ?? []), r.overall]);
  }

  const points: TrendPoint[] = [];
  {
    const step = granularity === 'day' ? 1 : 7;
    let cursor = bucketKey(startDate);
    const last = bucketKey(endDate);
    while (cursor <= last && points.length < 1000) {
      const g = trendMap.get(cursor);
      points.push({
        key: cursor,
        surveys: g?.all.length ?? 0,
        avg: r1(mean(g?.all ?? [])),
        dropOff: stat(g?.drop ?? []),
        pickUp: stat(g?.pick ?? []),
      });
      cursor = addDays(cursor, step);
    }
  }
  const trendPoints = points.slice(-MAX_TREND_POINTS);

  const monthly: MonthPoint[] =
    monthMap.size >= 2
      ? [...monthMap.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([month, g]) => ({
            month,
            surveys: g.all.length,
            avg: r1(mean(g.all)),
            dropOff: stat(g.drop),
            pickUp: stat(g.pick),
          }))
      : [];

  const weekday: WeekdayPoint[] = Array.from({ length: 7 }, (_, day) => {
    const xs = weekdayMap.get(day) ?? [];
    return { day, surveys: xs.length, avg: r1(mean(xs)) };
  });

  // ----- comments, themes, staff ------------------------------------------------
  comments.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  const themeMap = new Map<CommentTheme, ThemeStat>();
  const staffMap = new Map<string, StaffMention & { display: Map<string, number> }>();
  for (const c of comments) {
    if (!c.insight) continue;
    const cat = c.insight.category;
    for (const theme of c.insight.themes) {
      const t = themeMap.get(theme) ?? { theme, count: 0, praise: 0, complaint: 0, suggestion: 0, other: 0 };
      t.count++;
      if (cat === 'praise') t.praise++;
      else if (cat === 'complaint') t.complaint++;
      else if (cat === 'suggestion') t.suggestion++;
      else t.other++;
      themeMap.set(theme, t);
    }
    for (const name of c.insight.staff) {
      const norm = name.toLowerCase().replace(/^(mr|mrs|ms|miss|eng|dr)\.?\s+/i, '').trim();
      if (!norm) continue;
      const s = staffMap.get(norm) ?? { name, count: 0, positive: 0, negative: 0, display: new Map<string, number>() };
      s.count++;
      if (cat === 'praise') s.positive++;
      if (cat === 'complaint') s.negative++;
      s.display.set(name, (s.display.get(name) ?? 0) + 1);
      staffMap.set(norm, s);
    }
  }
  const commentThemes = [...themeMap.values()].sort((a, b) => b.count - a.count);
  const staffMentions: StaffMention[] = [...staffMap.values()]
    .map((s) => {
      const best = [...s.display.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? s.name;
      return { name: best, count: s.count, positive: s.positive, negative: s.negative };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  // ----- follow ups -------------------------------------------------------------
  const lowRows = rows.filter((r) => r.overall < FOLLOW_UP_BELOW).sort((a, b) => a.overall - b.overall);
  const followUpItems: FollowUpItem[] = lowRows.slice(0, MAX_FOLLOW_UPS).map((r) => {
    const worst = r.items
      .filter((i): i is Item & { score: number } => i.score !== null)
      .sort((a, b) => a.score - b.score)
      .filter((i) => i.bucket === 'negative')
      .slice(0, 3)
      .map((i) => ({ questionId: i.qid, key: i.key, score: Math.round(i.score) }));
    return {
      sessionId: r.sessionId,
      submittedAt: r.at,
      stage: r.stage,
      language: r.lang,
      overall: r1(r.overall) ?? r.overall,
      worst,
      comment: commentsByResponse.get(r.responseId) ?? null,
      plate: null,
      mobile: null,
    };
  });

  // ----- fingerprint --------------------------------------------------------------
  let latestAt = '';
  for (const r of rows) if (r.at > latestAt) latestAt = r.at;

  return {
    report: {
      meta: {
        startDate,
        endDate,
        visitStage,
        generatedAt: new Date().toISOString(),
        // Surveys and comments only: classifying comments later must not make an existing AI report look out of date.
        fingerprint: `${rows.length}:${latestAt}:${comments.length}`,
      },
      overview,
      questions,
      compound,
      negativeLoad: { zero: stat(loadScores.zero), one: stat(loadScores.one), twoPlus: stat(loadScores.twoPlus) },
      trend: { granularity, points: trendPoints },
      monthly,
      weekday,
      comments: comments.slice(0, input.maxComments ?? MAX_COMMENTS_RETURNED),
      commentThemes,
      staffMentions,
      followUps: { total: lowRows.length, items: followUpItems },
      dataQuality: dq,
    },
    weeklyPoints: points,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function previousRange(startDate: string, endDate: string): { startDate: string; endDate: string } {
  const days = daysInclusive(startDate, endDate);
  const prevEnd = addDays(startDate, -1);
  return { startDate: addDays(prevEnd, -(days - 1)), endDate: prevEnd };
}

export function buildAnalyticsReport(input: EngineInput, previousInput?: EngineInput | null): AnalyticsReport {
  const current = buildCore(input);
  let previous: PreviousPeriod | null = null;

  if (previousInput) {
    const prev = buildCore(previousInput).report;
    const questionAvg: Record<string, number | null> = {};
    for (const q of prev.questions) questionAvg[q.id] = q.avgScore;
    previous = {
      startDate: previousInput.startDate,
      endDate: previousInput.endDate,
      surveys: prev.overview.surveys,
      avgScore: prev.overview.avgScore,
      byStage: prev.overview.byStage,
      questionAvg,
    };
    for (const q of current.report.questions) q.previousAvgScore = questionAvg[q.id] ?? null;
  }

  const partial = { ...current.report, previous };
  const findings = buildFindings(partial, current.weeklyPoints);
  return { ...partial, findings };
}
