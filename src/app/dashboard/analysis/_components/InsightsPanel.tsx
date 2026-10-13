"use client";

import * as React from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AnalyticsReport, InsightsResult } from "@/lib/analytics/types";
import { useFmt } from "./format";
import { Card } from "./primitives";

export type AiRunState = "idle" | "classifying" | "writing" | "error";

interface InsightsPanelProps {
  report: AnalyticsReport;
  state: AiRunState;
  result: InsightsResult | null;
  error: string | null;
  disabled: boolean;
  onGenerate: () => void;
}

const TOP_ACTIONS = 3;

/** Short by default: the headline and three actions. The full report is one click away. */
export function InsightsPanel({ report, state, result, error, disabled, onGenerate }: InsightsPanelProps) {
  const { t, num, dateTime, digits } = useFmt();
  const [expanded, setExpanded] = React.useState(false);
  const busy = state === "classifying" || state === "writing";
  const stale = !!result && result.fingerprint !== report.meta.fingerprint;
  const ins = result?.insights;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-base font-bold text-foreground">
            <Sparkles className="size-4 text-primary" aria-hidden />
            {t("ai.title")}
          </h3>
          {busy ? (
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {state === "classifying" ? t("ai.stepClassify") : t("ai.stepWrite")}
            </p>
          ) : (
            !ins && <p className="mt-1 text-sm text-muted-foreground">{t("ai.intro")}</p>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant={ins ? "outline" : "default"}
          onClick={onGenerate}
          disabled={busy || disabled}
          className="text-xs font-semibold"
        >
          {ins ? t("ai.regenerate") : t("ai.generate")}
        </Button>
      </div>

      {state === "error" && error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}

      {ins && (
        <div className={`mt-4 space-y-4 ${busy ? "opacity-60" : ""}`}>
          {stale && <p className="text-xs text-warning">{t("ai.stale")}</p>}

          <p dir="auto" className="text-[15px] leading-relaxed text-foreground">
            {digits(ins.headline)}
          </p>

          {ins.actions.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-muted-foreground">{t("ai.topActions")}</h4>
              <ol className="mt-2 space-y-2.5">
                {ins.actions.slice(0, expanded ? ins.actions.length : TOP_ACTIONS).map((a, i) => (
                  <li key={i} dir="auto" className="flex gap-3 text-sm">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-foreground">
                      {num(i + 1)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-foreground">{digits(a.action)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {digits(a.owner)} · {digits(a.timeline)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {expanded && (
            <div className="space-y-5 border-t border-border pt-4 text-sm">
              {ins.problems.length > 0 && (
                <section dir="auto">
                  <h4 className="mb-2 text-xs font-bold text-muted-foreground">{t("ai.problems")}</h4>
                  <ul className="space-y-3">
                    {ins.problems.map((p, i) => (
                      <li key={i}>
                        <p className="font-semibold text-foreground">{digits(p.title)}</p>
                        <p className="mt-0.5 text-muted-foreground">{digits(p.evidence)}</p>
                        {p.likelyCause && (
                          <p className="mt-0.5 text-xs italic text-muted-foreground">{t("ai.possibleCause", { cause: digits(p.likelyCause) })}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {ins.working.length > 0 && (
                <section dir="auto">
                  <h4 className="mb-2 text-xs font-bold text-muted-foreground">{t("ai.working")}</h4>
                  <ul className="space-y-2">
                    {ins.working.map((w, i) => (
                      <li key={i}>
                        <span className="font-semibold text-foreground">{digits(w.title)}.</span>{" "}
                        <span className="text-muted-foreground">{digits(w.detail)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {(ins.voice.summary || ins.voice.suggestions.length > 0) && (
                <section dir="auto">
                  <h4 className="mb-2 text-xs font-bold text-muted-foreground">{t("ai.voice")}</h4>
                  {ins.voice.summary && <p className="text-muted-foreground">{digits(ins.voice.summary)}</p>}
                  {ins.voice.suggestions.length > 0 && (
                    <ul className="mt-2 list-disc space-y-0.5 ps-5 text-foreground">
                      {ins.voice.suggestions.map((s, i) => (
                        <li key={i}>{digits(s)}</li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

              {ins.caveats.length > 0 && (
                <ul dir="auto" className="space-y-1 text-xs text-muted-foreground">
                  {ins.caveats.map((c, i) => (
                    <li key={i}>{digits(c)}</li>
                  ))}
                </ul>
              )}

              <p className="text-[11px] text-muted-foreground">
                {t("ai.footer", { time: dateTime(result.generatedAt), surveys: num(result.surveys) })}
              </p>
            </div>
          )}

          <button type="button" onClick={() => setExpanded((v) => !v)} className="text-sm font-medium text-primary hover:underline">
            {expanded ? t("ai.hideReport") : t("ai.fullReport")}
          </button>
        </div>
      )}
    </Card>
  );
}
