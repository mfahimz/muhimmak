// Rule based findings. Deterministic, free, and identical on every load.
// Each finding carries ids and numbers only; the client turns them into a short sentence
// in the viewer's language, so Arabic needs no AI translation.
//
// Every finding gets an importance on the same 0..100 scale (share of customers affected,
// or size of a gap in points), so the top of the list is the most important regardless of type.
// Data quality notes (unclassified or unusable comments) live in the Data notes panel, not here.

import {
  FOLLOW_UP_BELOW,
  MIN_SAMPLE,
  POSITIVE_MIN,
  type AnalyticsReport,
  type Finding,
  type Severity,
  type TrendPoint,
} from '@/lib/analytics/types';

type PartialReport = Omit<AnalyticsReport, 'findings'>;

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2, positive: 3 };
const MAX_PROBLEMS = 10;
const MAX_POSITIVES = 3;

function r1(x: number): number {
  return Math.round(x * 10) / 10;
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function buildFindings(report: PartialReport, weeklyPoints: TrendPoint[]): Finding[] {
  const out: Array<{ f: Finding; importance: number }> = [];
  const push = (f: Finding, importance: number) => out.push({ f, importance });

  const { overview, previous, meta } = report;
  const surveys = Math.max(1, overview.surveys);
  const scoredQs = report.questions.filter(
    (q) => q.type !== 'text' && q.scored >= MIN_SAMPLE && q.avgScore !== null
  );

  // Negative answers: the most concrete signal. Importance = share of customers who answered negatively.
  const covered = new Set<string>();
  for (const q of scoredQs) {
    const neg = q.buckets.negative;
    const share = neg / q.scored;
    if (neg < 3 || share < 0.2) continue;
    covered.add(q.id);
    const top = q.options.filter((o) => o.bucket === 'negative').sort((a, b) => b.count - a.count)[0];
    const num = { pct: Math.round(share * 100), count: neg, n: q.scored, avg: q.avgScore ?? 0 };
    const severity: Severity = share >= 0.4 ? 'critical' : 'warning';
    if (q.type === 'multiple_choice' && top) {
      push({ id: `neg:${q.id}`, type: 'negative_choice', severity, questionId: q.id, answerKey: top.key, stage: q.stage, num }, share * 100);
    } else {
      push({ id: `neg:${q.id}`, type: 'negative_rating', severity, questionId: q.id, stage: q.stage, num }, share * 100);
    }
  }

  // Weak averages that no negative answer finding already explains.
  scoredQs
    .filter((q) => !covered.has(q.id) && (q.avgScore ?? 100) < POSITIVE_MIN)
    .sort((a, b) => (a.avgScore ?? 0) - (b.avgScore ?? 0))
    .slice(0, 2)
    .forEach((q) => {
      const avg = q.avgScore ?? 0;
      const severity: Severity = avg < 50 ? 'critical' : avg < 70 ? 'warning' : 'info';
      push(
        {
          id: `weak:${q.id}`,
          type: 'weak_question',
          severity,
          questionId: q.id,
          stage: q.stage,
          num: { avg, n: q.scored, negPct: Math.round((q.buckets.negative / q.scored) * 100) },
        },
        100 - avg
      );
    });

  scoredQs
    .filter((q) => (q.avgScore ?? 0) >= 90)
    .sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0))
    .slice(0, 2)
    .forEach((q) =>
      push(
        { id: `strong:${q.id}`, type: 'strength', severity: 'positive', questionId: q.id, stage: q.stage, num: { avg: q.avgScore ?? 0, n: q.scored } },
        q.avgScore ?? 0
      )
    );

  // Change against the previous period of the same length.
  if (previous) {
    for (const stage of ['drop_off', 'pick_up'] as const) {
      const cur = overview.byStage[stage];
      const prev = previous.byStage[stage];
      if (cur.n < MIN_SAMPLE || prev.n < MIN_SAMPLE || cur.avg === null || prev.avg === null) continue;
      const delta = r1(cur.avg - prev.avg);
      if (Math.abs(delta) < 3) continue;
      const num = { delta: Math.abs(delta), current: cur.avg, previous: prev.avg, n: cur.n };
      if (delta < 0) {
        push({ id: `trend:${stage}`, type: 'stage_trend_down', severity: Math.abs(delta) >= 6 ? 'critical' : 'warning', stage, num }, Math.abs(delta) * 5);
      } else {
        push({ id: `trend:${stage}`, type: 'stage_trend_up', severity: 'positive', stage, num }, Math.abs(delta) * 5);
      }
    }
  }

  // Stage and language gaps.
  const drop = overview.byStage.drop_off;
  const pick = overview.byStage.pick_up;
  if (meta.visitStage === 'all' && drop.n >= MIN_SAMPLE && pick.n >= MIN_SAMPLE && drop.avg !== null && pick.avg !== null) {
    const gap = r1(drop.avg - pick.avg);
    if (gap >= 5) push({ id: 'stage_gap', type: 'stage_gap', severity: 'info', num: { gap, dropOff: drop.avg, pickUp: pick.avg } }, gap);
  }

  const en = overview.byLanguage.en;
  const ar = overview.byLanguage.ar;
  if (en.n >= MIN_SAMPLE && ar.n >= MIN_SAMPLE && en.avg !== null && ar.avg !== null) {
    const gap = r1(en.avg - ar.avg);
    if (Math.abs(gap) >= 4) {
      push(
        {
          id: 'lang_gap',
          type: 'language_gap',
          severity: gap > 0 ? 'warning' : 'info',
          lang: gap > 0 ? 'ar' : 'en',
          num: { gap: Math.abs(gap), ar: ar.avg, en: en.avg, arN: ar.n, enN: en.n },
        },
        Math.abs(gap) * 2
      );
    }
  }

  const langGaps = scoredQs
    .filter((q) => q.byLanguage.ar.n >= 5 && q.byLanguage.en.n >= 5)
    .map((q) => {
      const a = q.byLanguage.ar.negativePct ?? 0;
      const e = q.byLanguage.en.negativePct ?? 0;
      return { q, a, e, diff: a - e };
    })
    .filter((x) => Math.abs(x.diff) >= 20)
    .sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff))
    .slice(0, 2);
  for (const x of langGaps) {
    push(
      {
        id: `langq:${x.q.id}`,
        type: 'language_question_gap',
        severity: 'warning',
        questionId: x.q.id,
        stage: x.q.stage,
        lang: x.diff > 0 ? 'ar' : 'en',
        num: {
          highPct: Math.max(x.a, x.e),
          lowPct: Math.min(x.a, x.e),
          highN: x.diff > 0 ? x.q.byLanguage.ar.n : x.q.byLanguage.en.n,
          lowN: x.diff > 0 ? x.q.byLanguage.en.n : x.q.byLanguage.ar.n,
        },
      },
      Math.abs(x.diff) / 2
    );
  }

  // Problems that come together, and how much an extra problem costs.
  report.compound.slice(0, 2).forEach((c, i) =>
    push(
      {
        id: `compound:${i}`,
        type: 'compound',
        severity: c.customers >= 3 ? 'warning' : 'info',
        questionId: c.a.questionId,
        answerKey: c.a.key,
        secondQuestionId: c.b.questionId,
        secondAnswerKey: c.b.key,
        num: { customers: c.customers, avg: c.avgScore, overall: overview.avgScore ?? 0 },
      },
      (c.customers / surveys) * 100
    )
  );

  const load = report.negativeLoad;
  if (load.zero.n >= 5 && load.twoPlus.n >= 3 && load.zero.avg !== null && load.twoPlus.avg !== null) {
    const gap = r1(load.zero.avg - load.twoPlus.avg);
    if (gap >= 10) {
      push(
        { id: 'load', type: 'negative_load', severity: 'info', num: { low: load.twoPlus.avg, high: load.zero.avg, n: load.twoPlus.n } },
        gap
      );
    }
  }

  report.questions
    .filter((q) => q.driver.gap !== null && q.driver.gap >= 8)
    .sort((a, b) => (b.driver.gap ?? 0) - (a.driver.gap ?? 0))
    .slice(0, 2)
    .forEach((q) =>
      push(
        {
          id: `driver:${q.id}`,
          type: 'driver',
          severity: (q.driver.gap ?? 0) >= 15 ? 'warning' : 'info',
          questionId: q.id,
          stage: q.stage,
          num: { gap: q.driver.gap ?? 0, n: q.driver.negativeN },
        },
        (q.driver.gap ?? 0) * 2
      )
    );

  // Operational follow up and participation.
  if (report.followUps.total > 0) {
    push(
      {
        id: 'follow_up',
        type: 'follow_up',
        severity: report.followUps.total >= 5 ? 'warning' : 'info',
        num: { count: report.followUps.total, below: FOLLOW_UP_BELOW },
      },
      (report.followUps.total / surveys) * 100
    );
  }

  if (report.trend.granularity === 'week') {
    const pts = weeklyPoints.slice();
    const startIsMonday = new Date(`${meta.startDate}T00:00:00Z`).getUTCDay() === 1;
    const endIsSunday = new Date(`${meta.endDate}T00:00:00Z`).getUTCDay() === 0;
    if (!endIsSunday) pts.pop();
    if (!startIsMonday) pts.shift();
    if (pts.length >= 6) {
      const recent = mean(pts.slice(-3).map((p) => p.surveys));
      const earlier = mean(pts.slice(0, -3).map((p) => p.surveys));
      if (earlier >= 3 && recent <= earlier * 0.6) {
        push(
          { id: 'participation', type: 'participation_drop', severity: 'warning', num: { recent: r1(recent), earlier: r1(earlier) } },
          ((earlier - recent) / earlier) * 50
        );
      }
    }
  }

  const f = overview.funnel;
  if (f.completionRate !== null && f.started >= 20 && f.completionRate < 85) {
    push({ id: 'completion', type: 'completion', severity: 'info', num: { rate: f.completionRate } }, (100 - f.completionRate) / 2);
  }

  const sorted = out.sort(
    (a, b) => SEVERITY_RANK[a.f.severity] - SEVERITY_RANK[b.f.severity] || b.importance - a.importance
  );
  // Problems first; good news is kept separate so it is never crowded out by a long problem list.
  const problems = sorted.filter((x) => x.f.severity !== 'positive').slice(0, MAX_PROBLEMS);
  const positives = sorted.filter((x) => x.f.severity === 'positive').slice(0, MAX_POSITIVES);
  return [...problems, ...positives].map((x) => x.f);
}
