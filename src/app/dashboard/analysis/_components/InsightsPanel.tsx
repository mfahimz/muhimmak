"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AnalyticsReport, InsightsResult, Priority } from "@/lib/analytics/types";
import { useFmt } from "./format";
import { Card, Chip, SectionTitle } from "./primitives";

export type AiRunState = "idle" | "classifying" | "writing" | "error";

interface InsightsPanelProps {
  report: AnalyticsReport;
  state: AiRunState;
  result: InsightsResult | null;
  error: string | null;
  disabled: boolean;
  onGenerate: () => void;
}

const PRIORITY_DOT: Record<Priority, string> = { high: "bg-danger", medium: "bg-warning", low: "bg-muted-foreground/50" };

function PriorityChip({ value, kind }: { value: Priority; kind: "impact" | "priority" }) {
  const { t } = useFmt();
  return (
    <Chip>
      <span className={`size-2 rounded-full ${PRIORITY_DOT[value]}`} aria-hidden />
      {t(`ai.${kind}.${value}`)}
    </Chip>
  );
}

export function InsightsPanel({ report, state, result, error, disabled, onGenerate }: InsightsPanelProps) {
  const { t, num, dateTime, digits } = useFmt();
  const busy = state === "classifying" || state === "writing";
  const stale = !!result && result.fingerprint !== report.meta.fingerprint;
  const toClassify = report.overview.comments.usable - report.overview.comments.classified;

  const action = (
    <Button type="button" onClick={onGenerate} disabled={busy || disabled} className="gap-1.5 text-xs font-semibold">
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : result ? <RefreshCw className="size-4" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
      {result ? t("ai.regenerate") : t("ai.generate")}
    </Button>
  );

  return (
    <Card className="border-primary/20">
      <SectionTitle title={t("ai.title")} subtitle={t("ai.subtitle")} action={action} />

      {busy && (
        <ol className="space-y-2 text-sm">
          <li className="flex items-center gap-2 text-foreground">
            {state === "classifying" ? <Loader2 className="size-4 animate-spin text-primary" aria-hidden /> : <CheckCircle2 className="size-4 text-success" aria-hidden />}
            {t("ai.stepClassify")}
          </li>
          <li className={`flex items-center gap-2 ${state === "writing" ? "text-foreground" : "text-muted-foreground"}`}>
            {state === "writing" ? <Loader2 className="size-4 animate-spin text-primary" aria-hidden /> : <span className="size-4 rounded-full border border-border" aria-hidden />}
            {t("ai.stepWrite")}
          </li>
        </ol>
      )}

      {state === "error" && error && (
        <p role="alert" className="mb-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {!busy && !result && (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>{t("ai.intro")}</p>
          <ul className="list-disc space-y-0.5 ps-5 text-xs">
            <li>{toClassify > 0 ? t("ai.introClassify", { n: num(toClassify) }) : t("ai.introClassified")}</li>
            <li>{t("ai.introWrite")}</li>
            <li>{t("ai.introCost")}</li>
          </ul>
        </div>
      )}

      {result && (
        <div className={`space-y-6 ${busy ? "opacity-60" : ""}`}>
          {stale && (
            <p className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
              <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden />
              {t("ai.stale")}
            </p>
          )}

          <p dir="auto" className="text-base leading-relaxed text-foreground">
            {digits(result.insights.headline)}
          </p>

          <div className="grid gap-6 lg:grid-cols-2">
            {result.insights.working.length > 0 && (
              <section>
                <h4 className="mb-2 text-sm font-bold text-foreground">{t("ai.working")}</h4>
                <ul className="space-y-3">
                  {result.insights.working.map((w, i) => (
                    <li key={i} dir="auto" className="flex gap-2 text-sm">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                      <div>
                        <p className="font-semibold text-foreground">{digits(w.title)}</p>
                        <p className="text-muted-foreground">{digits(w.detail)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {result.insights.problems.length > 0 && (
              <section>
                <h4 className="mb-2 text-sm font-bold text-foreground">{t("ai.problems")}</h4>
                <ul className="space-y-3">
                  {result.insights.problems.map((p, i) => (
                    <li key={i} dir="auto" className="text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground">{digits(p.title)}</p>
                        <PriorityChip value={p.impact} kind="impact" />
                      </div>
                      <p className="mt-0.5 text-muted-foreground">{digits(p.evidence)}</p>
                      {p.likelyCause && (
                        <p className="mt-0.5 text-xs italic text-muted-foreground">{t("ai.possibleCause", { cause: digits(p.likelyCause) })}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {result.insights.actions.length > 0 && (
            <section>
              <h4 className="mb-2 text-sm font-bold text-foreground">{t("ai.actions")}</h4>
              <div className="overflow-x-auto">
                <table className="w-full min-w-144 text-xs">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="py-1.5 text-start font-semibold">{t("ai.priority.label")}</th>
                      <th className="py-1.5 text-start font-semibold">{t("ai.action")}</th>
                      <th className="py-1.5 text-start font-semibold">{t("ai.owner")}</th>
                      <th className="py-1.5 text-start font-semibold">{t("ai.timeline")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border align-top">
                    {result.insights.actions.map((a, i) => (
                      <tr key={i} dir="auto">
                        <td className="py-2.5 pe-3">
                          <PriorityChip value={a.priority} kind="priority" />
                        </td>
                        <td className="py-2.5 pe-3">
                          <p className="text-sm font-medium text-foreground">{digits(a.action)}</p>
                          <p className="mt-0.5 text-muted-foreground">{digits(a.why)}</p>
                        </td>
                        <td className="py-2.5 pe-3 text-foreground">{digits(a.owner)}</td>
                        <td className="py-2.5 text-foreground">{digits(a.timeline)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {(result.insights.voice.summary || result.insights.voice.suggestions.length > 0) && (
            <section dir="auto">
              <h4 className="mb-2 text-sm font-bold text-foreground">{t("ai.voice")}</h4>
              {result.insights.voice.summary && <p className="text-sm text-muted-foreground">{digits(result.insights.voice.summary)}</p>}
              {result.insights.voice.suggestions.length > 0 && (
                <ul className="mt-2 list-disc space-y-0.5 ps-5 text-sm text-foreground">
                  {result.insights.voice.suggestions.map((s, i) => (
                    <li key={i}>{digits(s)}</li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {result.insights.caveats.length > 0 && (
            <ul dir="auto" className="space-y-1 border-t border-border pt-3 text-[11px] text-muted-foreground">
              {result.insights.caveats.map((c, i) => (
                <li key={i}>{digits(c)}</li>
              ))}
            </ul>
          )}

          <p className="text-[11px] text-muted-foreground">
            {t("ai.footer", { time: dateTime(result.generatedAt), surveys: num(result.surveys) })}
          </p>
        </div>
      )}
    </Card>
  );
}
