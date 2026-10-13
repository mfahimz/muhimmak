"use client";

import * as React from "react";
import { FOLLOW_UP_BELOW, type AnalyticsReport } from "@/lib/analytics/types";
import { answerText, findQuestion, useFmt } from "./format";
import { Card, EmptyState, ScoreBadge } from "./primitives";

function telHref(mobile: string): string {
  return `tel:${mobile.replace(/[^\d+]/g, "")}`;
}

export function FollowUpTab({ report }: { report: AnalyticsReport }) {
  const { t, num, isAr, dateTime, stage } = useFmt();
  const { total, items } = report.followUps;

  if (total === 0) {
    return <EmptyState title={t("followUp.empty", { below: num(FOLLOW_UP_BELOW) })} description={t("followUp.emptyDesc")} />;
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-bold text-foreground">
          {t("followUp.title", { count: num(total), countRaw: total, below: num(FOLLOW_UP_BELOW) })}
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {items.length < total ? t("followUp.capped", { n: num(items.length) }) : t("followUp.subtitle")}
        </p>
      </div>

      <Card className="p-0">
        <ul className="divide-y divide-border">
          {items.map((item) => {
            const problems = item.worst.map((w) => answerText(findQuestion(report.questions, w.questionId), w.key, isAr));
            return (
              <li key={item.sessionId} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3">
                <div className="w-14 shrink-0 pt-0.5">
                  <ScoreBadge score={item.overall} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">{problems.length > 0 ? problems.join(" · ") : t("followUp.noNegative")}</p>
                  {item.comment && (
                    <p dir="auto" className="mt-0.5 text-xs text-muted-foreground">
                      “{item.comment}”
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {dateTime(item.submittedAt)} · {stage(item.stage)}
                  </p>
                </div>
                <div className="shrink-0 text-end text-xs">
                  {item.plate && (
                    <p dir="ltr" className="font-mono font-semibold text-foreground">
                      {item.plate}
                    </p>
                  )}
                  {item.mobile && (
                    <a href={telHref(item.mobile)} dir="ltr" className="font-mono text-primary hover:underline">
                      {item.mobile}
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
