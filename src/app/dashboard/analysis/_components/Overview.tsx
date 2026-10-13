"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, MessageCircleQuestion, XCircle } from "lucide-react";
import type { AnalyticsReport, Finding, Lang, Severity } from "@/lib/analytics/types";
import { answerText, findQuestion, useFmt } from "./format";
import { Card, Delta } from "./primitives";

const VISIBLE = 3;

const SEVERITY_ICON = { critical: XCircle, warning: AlertTriangle, info: Info, positive: CheckCircle2 } as const;
const SEVERITY_COLOR: Record<Severity, string> = {
  critical: "text-danger",
  warning: "text-warning",
  info: "text-primary",
  positive: "text-success",
};

interface OverviewProps {
  report: AnalyticsReport;
  onAsk: (prompt: string, questionId: string | null) => void;
}

/** The headline numbers and the few things worth knowing, in one card. */
export function Overview({ report, onAsk }: OverviewProps) {
  const { t, num, label, stage, isAr } = useFmt();
  const [showAll, setShowAll] = React.useState(false);
  const o = report.overview;
  const prev = report.previous;
  const hasPrev = !!prev && prev.surveys > 0;

  const other = (l: Lang): Lang => (l === "ar" ? "en" : "ar");

  const headline = (f: Finding): string => {
    const nums: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(f.num)) {
      nums[k] = num(Math.round(v * 10) / 10);
      nums[`${k}Raw`] = v;
    }
    const q = findQuestion(report.questions, f.questionId);
    const q2 = findQuestion(report.questions, f.secondQuestionId);
    return t(`findings.${f.type}`, {
      ...nums,
      answer: answerText(q, f.answerKey, isAr),
      answerA: answerText(q, f.answerKey, isAr),
      answerB: answerText(q2, f.secondAnswerKey, isAr),
      stage: f.stage ? stage(f.stage) : "",
      lang: f.lang ? t(`lang.${f.lang}`) : "",
      otherLang: f.lang ? t(`lang.${other(f.lang)}`) : "",
      langAvg: f.lang ? num(f.num[f.lang]) : "",
      otherAvg: f.lang ? num(f.num[other(f.lang)]) : "",
    });
  };

  // The question a finding is about, shown quietly under the sentence.
  const context = (f: Finding): string => {
    if (f.type === "compound") return "";
    const q = findQuestion(report.questions, f.questionId);
    return q ? label(q) : "";
  };

  const problems = report.findings.filter((f) => f.severity !== "positive");
  const positives = report.findings.filter((f) => f.severity === "positive");
  const shown = showAll ? problems : problems.slice(0, VISIBLE);
  const extra = Math.max(0, problems.length - VISIBLE) + positives.length;

  const row = (f: Finding) => {
    const Icon = SEVERITY_ICON[f.severity];
    const text = headline(f);
    const sub = context(f);
    return (
      <li key={f.id} className="group flex items-start gap-3 py-2.5">
        <Icon className={`mt-0.5 size-4 shrink-0 ${SEVERITY_COLOR[f.severity]}`} role="img" aria-label={t(`severity.${f.severity}`)} />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-foreground">{text}</p>
          {sub && <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>}
        </div>
        <button
          type="button"
          onClick={() => onAsk(t("findings.askPrompt", { finding: sub ? `${text} (${sub})` : text }), f.questionId ?? null)}
          title={t("askAi")}
          aria-label={t("askAi")}
          className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
        >
          <MessageCircleQuestion className="size-4" aria-hidden />
        </button>
      </li>
    );
  };

  const stageStat = (key: "drop_off" | "pick_up") => {
    const s = o.byStage[key];
    if (s.n === 0) return null;
    return (
      <div key={key}>
        <dt className="text-xs text-muted-foreground">{stage(key)}</dt>
        <dd className="text-xl font-semibold text-foreground">{num(s.avg)}</dd>
      </div>
    );
  };

  return (
    <Card>
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">{t("overview.overall")}</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-5xl font-bold tracking-tight text-foreground">{num(o.avgScore)}</span>
            <span className="text-sm text-muted-foreground">{t("overview.outOf")}</span>
            {hasPrev && <Delta value={o.avgScore !== null && prev?.avgScore != null ? o.avgScore - prev.avgScore : null} title={t("overview.vsPrevious")} />}
          </div>
        </div>
        <dl className="flex flex-wrap gap-x-8 gap-y-2">
          {stageStat("drop_off")}
          {stageStat("pick_up")}
          <div>
            <dt className="text-xs text-muted-foreground">{t("overview.surveys")}</dt>
            <dd className="text-xl font-semibold text-foreground">{num(o.surveys)}</dd>
          </div>
        </dl>
      </div>

      {(problems.length > 0 || positives.length > 0) && (
        <div className="mt-5 border-t border-border pt-4">
          <h3 className="text-sm font-bold text-foreground">{t("findings.title")}</h3>
          {problems.length > 0 && <ul className="mt-1 divide-y divide-border">{shown.map(row)}</ul>}
          {(showAll || problems.length === 0) && positives.length > 0 && (
            <>
              <h4 className="mt-4 text-xs font-bold text-muted-foreground">{t("findings.goodNews")}</h4>
              <ul className="divide-y divide-border">{positives.map(row)}</ul>
            </>
          )}
          {extra > 0 && problems.length > 0 && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 text-sm font-medium text-primary hover:underline">
              {showAll ? t("findings.showLess") : t("findings.showAll", { count: num(extra) })}
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
