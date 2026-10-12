"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { NEGATIVE_MAX, POSITIVE_MIN, type AnalyticsReport } from "@/lib/analytics/types";
import { useFmt } from "./format";
import { Card } from "./primitives";

/** Honest limits of the data, shown only when they apply. */
export function DataNotes({ report }: { report: AnalyticsReport }) {
  const { t, num } = useFmt();
  const dq = report.dataQuality;
  const notes: string[] = [];

  if (dq.emptySubmissions > 0) notes.push(t("notes.empty", { n: num(dq.emptySubmissions) }));
  if (dq.unscoredComments > 0) {
    notes.push(
      dq.unscoredWeighted > 0
        ? t("notes.unscoredWeighted", { n: num(dq.unscoredComments), w: num(dq.unscoredWeighted) })
        : t("notes.unscored", { n: num(dq.unscoredComments) })
    );
  }
  if (dq.junkComments > 0) notes.push(t("notes.junk", { n: num(dq.junkComments) }));
  if (dq.aiFollowUpAnswers > 0) notes.push(t("notes.aiKnown", { n: num(dq.aiFollowUpAnswers) }));
  if (dq.aiFollowUpUncertain > 0) notes.push(t("notes.aiUncertain", { n: num(dq.aiFollowUpUncertain) }));
  if (dq.reviewTrackingGap) notes.push(t("notes.review"));
  notes.push(t("notes.method", { positive: num(POSITIVE_MIN), negative: num(NEGATIVE_MAX) }));
  notes.push(t("notes.sample"));

  return (
    <Card className="p-0">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 text-sm font-semibold text-foreground">
          {t("notes.title")}
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <ul className="space-y-2 border-t border-border px-5 py-4 text-xs leading-relaxed text-muted-foreground">
          {notes.map((n, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden>•</span>
              <span>{n}</span>
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}
