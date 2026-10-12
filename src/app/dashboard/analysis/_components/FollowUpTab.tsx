"use client";

import * as React from "react";
import { FOLLOW_UP_BELOW, type AnalyticsReport } from "@/lib/analytics/types";
import { answerText, findQuestion, useFmt } from "./format";
import { Card, Chip, EmptyState, ScoreBadge, SectionTitle } from "./primitives";

function telHref(mobile: string): string {
  return `tel:${mobile.replace(/[^\d+]/g, "")}`;
}

export function FollowUpTab({ report }: { report: AnalyticsReport }) {
  const { t, num, isAr, dateTime } = useFmt();
  const { total, items } = report.followUps;

  if (total === 0) {
    return <EmptyState title={t("followUp.empty", { below: num(FOLLOW_UP_BELOW) })} description={t("followUp.emptyDesc")} />;
  }

  return (
    <Card>
      <SectionTitle
        title={t("followUp.title", { count: num(total), countRaw: total, below: num(FOLLOW_UP_BELOW) })}
        subtitle={items.length < total ? t("followUp.capped", { n: num(items.length) }) : t("followUp.subtitle")}
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-176 text-xs">
          <thead>
            <tr className="text-muted-foreground">
              <th className="py-2 text-start font-semibold">{t("followUp.date")}</th>
              <th className="py-2 text-start font-semibold">{t("followUp.plate")}</th>
              <th className="py-2 text-start font-semibold">{t("followUp.mobile")}</th>
              <th className="py-2 text-center font-semibold">{t("followUp.score")}</th>
              <th className="py-2 text-start font-semibold">{t("followUp.problems")}</th>
              <th className="py-2 text-start font-semibold">{t("followUp.comment")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border align-top">
            {items.map((item) => (
              <tr key={item.sessionId}>
                <td className="py-3 pe-3 text-muted-foreground">
                  <div>{dateTime(item.submittedAt)}</div>
                  <div className="mt-1 flex gap-1">
                    <Chip>{t(`stage.${item.stage}`)}</Chip>
                    <Chip>{t(`lang.${item.language}`)}</Chip>
                  </div>
                </td>
                <td className="py-3 pe-3">
                  {item.plate ? (
                    <span dir="ltr" className="inline-block rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-bold text-foreground">
                      {item.plate}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{t("na")}</span>
                  )}
                </td>
                <td className="py-3 pe-3">
                  {item.mobile ? (
                    <a href={telHref(item.mobile)} dir="ltr" className="font-mono text-primary underline-offset-2 hover:underline">
                      {item.mobile}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">{t("na")}</span>
                  )}
                </td>
                <td className="py-3 pe-3 text-center">
                  <ScoreBadge score={item.overall} />
                </td>
                <td className="py-3 pe-3">
                  <ul className="space-y-1">
                    {item.worst.map((w) => {
                      const q = findQuestion(report.questions, w.questionId);
                      return (
                        <li key={`${w.questionId}:${w.key}`} className="text-foreground">
                          {answerText(q, w.key, isAr)}
                        </li>
                      );
                    })}
                    {item.worst.length === 0 && <li className="text-muted-foreground">{t("followUp.noNegative")}</li>}
                  </ul>
                </td>
                <td dir="auto" className="py-3 text-foreground">
                  {item.comment ?? <span className="text-muted-foreground">{t("followUp.noComment")}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
