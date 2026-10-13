// Shared (server + client) types and constants for the Feedback Analysis page.
// Pure data only: no server imports, safe to use from client components.

export type Stage = 'drop_off' | 'pick_up';
export type StageKey = Stage | 'general';
export type Lang = 'en' | 'ar';
export type Bucket = 'positive' | 'neutral' | 'negative';

/** Normalized answer score (0..100) at or above this is a positive answer. */
export const POSITIVE_MIN = 80;
/** Normalized answer score at or below this is a negative answer. */
export const NEGATIVE_MAX = 50;
/** Customers whose overall survey score is below this are listed for follow up. */
export const FOLLOW_UP_BELOW = 70;
/** Minimum answers before a question level finding is raised. */
export const MIN_SAMPLE = 8;
/** Classifies a normalized 0..100 answer score. */
export function bucketOf(score: number): Bucket {
  if (score >= POSITIVE_MIN) return 'positive';
  if (score <= NEGATIVE_MAX) return 'negative';
  return 'neutral';
}

/** Bump when the comment classification prompt or vocabulary changes. */
export const ANNOTATION_VERSION = 1;

export const COMMENT_CATEGORIES = ['praise', 'complaint', 'suggestion', 'mixed', 'neutral'] as const;
export type CommentCategory = (typeof COMMENT_CATEGORIES)[number];

export const COMMENT_THEMES = [
  'staff_service',
  'communication_updates',
  'delivery_time',
  'price_value',
  'repair_quality',
  'facility_cleanliness',
  'booking_process',
  'reception_welcome',
  'explanation_transparency',
  'vehicle_care',
  'convenience',
  'other',
] as const;
export type CommentTheme = (typeof COMMENT_THEMES)[number];

export interface ScoreStat {
  n: number;
  avg: number | null;
}

export interface OptionStat {
  /** The stored answer: the English option text, or the scale value as a string. */
  key: string;
  labelEn: string;
  labelAr: string | null;
  count: number;
  /** Share of answered, 0..100. */
  pct: number;
  score: number | null;
  bucket: Bucket | null;
  /** Average score on the rest of the survey for customers who chose this (null when fewer than 3). */
  restAvg: number | null;
}

export interface LangQuestionStat {
  n: number;
  avgScore: number | null;
  negativePct: number | null;
}

export interface QuestionAnalysis {
  id: string;
  labelEn: string;
  labelAr: string | null;
  type: string;
  stage: StageKey;
  weight: number;
  /** Shown only after an earlier answer (branching), so the response rate is relative to who saw it. */
  conditional: boolean;
  /** Customers who were shown the question. */
  shown: number;
  answered: number;
  /** answered / shown, 0..100. */
  responseRate: number | null;
  /** Answers that carry a 0..100 score. */
  scored: number;
  avgRaw: number | null;
  scaleMax: number | null;
  avgScore: number | null;
  buckets: Record<Bucket, number>;
  options: OptionStat[];
  byLanguage: Record<Lang, LangQuestionStat>;
  driver: {
    negativeN: number;
    positiveN: number;
    negativeRest: number | null;
    positiveRest: number | null;
    /** positiveRest minus negativeRest. */
    gap: number | null;
  };
  previousAvgScore: number | null;
  /** Free text questions only. */
  text: { total: number; usable: number; classified: number } | null;
}

export interface AnswerRef {
  questionId: string;
  key: string;
}

export interface CompoundProblem {
  a: AnswerRef;
  b: AnswerRef;
  customers: number;
  avgScore: number;
}

export interface TrendPoint {
  /** Bucket start date, YYYY-MM-DD (Monday for weekly buckets). */
  key: string;
  surveys: number;
  avg: number | null;
  dropOff: ScoreStat;
  pickUp: ScoreStat;
}

export interface MonthPoint {
  month: string;
  surveys: number;
  avg: number | null;
  dropOff: ScoreStat;
  pickUp: ScoreStat;
}

export interface WeekdayPoint {
  /** 0 = Sunday. */
  day: number;
  surveys: number;
  avg: number | null;
}

export type CommentProvenance = 'form' | 'ai_follow_up' | 'ai_follow_up_uncertain';

export interface CommentInsight {
  category: CommentCategory;
  themes: CommentTheme[];
  staff: string[];
  gist: string;
}

export interface CommentItem {
  responseId: string;
  questionId: string;
  stage: StageKey;
  language: Lang;
  submittedAt: string;
  text: string;
  usable: boolean;
  aiScore: number | null;
  overall: number | null;
  provenance: CommentProvenance;
  /** The AI generated question text, when it was recorded. */
  followUpLabel: string | null;
  /** Question ids this same customer answered negatively (links comments to structured problems). */
  negativeOn: string[];
  insight: CommentInsight | null;
}

export interface ThemeStat {
  theme: CommentTheme;
  count: number;
  praise: number;
  complaint: number;
  suggestion: number;
  other: number;
}

export interface StaffMention {
  name: string;
  count: number;
  positive: number;
  negative: number;
}

export interface FollowUpAnswer {
  questionId: string;
  key: string;
  score: number;
}

export interface FollowUpItem {
  sessionId: string;
  submittedAt: string;
  stage: StageKey;
  language: Lang;
  overall: number;
  worst: FollowUpAnswer[];
  comment: string | null;
  /** Filled in by the service for authorized roles only. */
  plate: string | null;
  mobile: string | null;
}

export type FindingType =
  | 'weak_question'
  | 'negative_choice'
  | 'negative_rating'
  | 'strength'
  | 'stage_trend_down'
  | 'stage_trend_up'
  | 'stage_gap'
  | 'language_gap'
  | 'language_question_gap'
  | 'compound'
  | 'driver'
  | 'follow_up'
  | 'negative_load'
  | 'participation_drop'
  | 'completion';

export type Severity = 'critical' | 'warning' | 'info' | 'positive';

export interface Finding {
  id: string;
  type: FindingType;
  severity: Severity;
  questionId?: string;
  answerKey?: string;
  secondQuestionId?: string;
  secondAnswerKey?: string;
  stage?: StageKey;
  lang?: Lang;
  /** Numbers the message template needs. */
  num: Record<string, number>;
}

export interface DataQuality {
  /** Usable comments with no AI sentiment score yet. */
  unscoredComments: number;
  /** Of those, how many sit on a question that carries weight in the overall score. */
  unscoredWeighted: number;
  junkComments: number;
  /** Answers known to belong to an AI generated follow up question (excluded from question stats). */
  aiFollowUpAnswers: number;
  /** Older answers where an AI follow up was generated but it is unknown whether it replaced the form question. */
  aiFollowUpUncertain: number;
  /** Completed sessions with no scorable answers. */
  emptySubmissions: number;
  /** Review clicks were recorded but the QR shown flag never was. */
  reviewTrackingGap: boolean;
}

export interface Overview {
  surveys: number;
  avgScore: number | null;
  byStage: Record<Stage, ScoreStat>;
  byLanguage: Record<Lang, ScoreStat>;
  scoreBands: { below50: number; from50to69: number; from70to89: number; from90: number };
  comments: { total: number; usable: number; classified: number };
  googleReview: { clicked: number; eligible: number };
  funnel: {
    started: number;
    completed: number;
    declined: number;
    abandoned: number;
    unfinished: number;
    completionRate: number | null;
  };
}

export interface PreviousPeriod {
  startDate: string;
  endDate: string;
  surveys: number;
  avgScore: number | null;
  byStage: Record<Stage, ScoreStat>;
  questionAvg: Record<string, number | null>;
}

export interface AnalyticsReport {
  meta: {
    startDate: string;
    endDate: string;
    visitStage: Stage | 'all';
    generatedAt: string;
    /** Changes whenever the underlying data changes. Used to flag stale AI output. */
    fingerprint: string;
  };
  overview: Overview;
  previous: PreviousPeriod | null;
  questions: QuestionAnalysis[];
  compound: CompoundProblem[];
  negativeLoad: { zero: ScoreStat; one: ScoreStat; twoPlus: ScoreStat };
  trend: { granularity: 'day' | 'week'; points: TrendPoint[] };
  monthly: MonthPoint[];
  weekday: WeekdayPoint[];
  comments: CommentItem[];
  commentThemes: ThemeStat[];
  staffMentions: StaffMention[];
  followUps: { total: number; items: FollowUpItem[] };
  findings: Finding[];
  dataQuality: DataQuality;
}

/** Stored per comment in responses.interaction_metadata.text_insights[fieldId]. */
export interface StoredCommentInsight {
  v: number;
  c: CommentCategory;
  t: CommentTheme[];
  s: string[];
  g: string;
  at: string;
}

export type Priority = 'high' | 'medium' | 'low';

/** Written by the AI report step. All text is in the language requested by the caller. */
export interface AiInsights {
  headline: string;
  working: Array<{ title: string; detail: string }>;
  problems: Array<{ title: string; evidence: string; impact: Priority; likelyCause: string | null }>;
  actions: Array<{ action: string; why: string; owner: string; priority: Priority; timeline: string }>;
  voice: { summary: string; suggestions: string[] };
  caveats: string[];
}

export interface InsightsResult {
  insights: AiInsights;
  generatedAt: string;
  /** Fingerprint of the data the insights were written from, to detect staleness. */
  fingerprint: string;
  locale: Lang;
  surveys: number;
}
