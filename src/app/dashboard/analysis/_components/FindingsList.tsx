"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, MessageCircleQuestion, XCircle } from "lucide-react";
import type { AnalyticsReport, Finding, Lang, Severity } from "@/lib/analytics/types";
import { Button } from "@/components/ui/button";
import { answerText, findQuestion, useFmt } from "./format";
import { Card, SectionTitle } from "./primitives";

const VISIBLE = 6;

const SEVERITY_ICON = { critical: XCircle, warning: AlertTriangle, info: Info, positive: CheckCircle2 } as const;
const SEVERITY_COLOR: Record<Severity, string> = {
  critical: "text-danger",
  warning: "text-warning",
  info: "text-primary",
  positive: "text-success",
};

interface FindingsListProps {
  report: AnalyticsReport;
  onAsk: (prompt: string, questionId: string | null) => void;
}

export function FindingsList({ report, onAsk }: FindingsListProps) {
  const { t, num, label, stage, isAr } = useFmt();
  const [showAll, setShowAll] = React.useState(false);

  const other = (l: Lang): Lang => (l === "ar" ? "en" : "ar");

  const textOf = (f: Finding): string => {
    const q = findQuestion(report.questions, f.questionId);
    const q2 = findQuestion(report.questions, f.secondQuestionId);
    // Every number is passed formatted for display (key) and raw for plural rules (keyRaw).
    const nums: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(f.num)) {
      nums[k] = num(Math.round(v * 10) / 10);
      nums[`${k}Raw`] = v;
    }
    const lang = f.lang;
    return t(`findings.${f.type}`, {
      ...nums,
      question: q ? label(q) : "",
      answer: answerText(q, f.answerKey, isAr),
      answerA: answerText(q, f.answerKey, isAr),
      answerB: answerText(q2, f.secondAnswerKey, isAr),
      stage: f.stage ? stage(f.stage) : "",
      // lang is the language the finding is about (lower scoring, or more negative); otherLang is the other one.
      lang: lang ? t(`lang.${lang}`) : "",
      otherLang: lang ? t(`lang.${other(lang)}`) : "",
      langAvg: lang ? num(f.num[lang]) : "",
      otherAvg: lang ? num(f.num[other(lang)]) : "",
    });
  };

  const problems = report.findings.filter((f) => f.severity !== "positive");
  const positives = report.findings.filter((f) => f.severity === "positive");
  const shown = showAll ? problems : problems.slice(0, VISIBLE);

  const row = (f: Finding) => {
    const Icon = SEVERITY_ICON[f.severity];
    const text = textOf(f);
    return (
      <li key={f.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
        <Icon className={`mt-0.5 size-5 shrink-0 ${SEVERITY_COLOR[f.severity]}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <span className="mb-0.5 block text-[11px] font-semibold text-muted-foreground">{t(`severity.${f.severity}`)}</span>
          <p className="text-sm leading-relaxed text-foreground">{text}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onAsk(t("findings.askPrompt", { finding: text }), f.questionId ?? null)}
          className="shrink-0 gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <MessageCircleQuestion className="size-3.5" aria-hidden />
          <span className="sr-only sm:not-sr-only">{t("askAi")}</span>
        </Button>
      </li>
    );
  };

  if (report.findings.length === 0) return null;

  return (
    <Card>
      <SectionTitle title={t("findings.title")} subtitle={t("findings.subtitle")} />
      {problems.length > 0 && <ul className="divide-y divide-border">{shown.map(row)}</ul>}
      {problems.length > VISIBLE && (
        <Button type="button" variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)} className="mt-2 text-xs">
          {showAll ? t("findings.showLess") : t("findings.showAll", { count: num(problems.length) })}
        </Button>
      )}
      {positives.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="mb-2 text-xs font-bold text-muted-foreground">{t("findings.goodNews")}</p>
          <ul className="divide-y divide-border">{positives.map(row)}</ul>
        </div>
      )}
    </Card>
  );
}
