"use client";

import * as React from "react";
import type { AnalyticsReport } from "@/lib/analytics/types";
import { answerText, findQuestion, useFmt } from "./format";
import { Card, EmptyState, Meter, SectionTitle } from "./primitives";

export function DriversTab({ report }: { report: AnalyticsReport }) {
  const { t, num, label, isAr } = useFmt();
  const overall = report.overview.avgScore;

  const drivers = report.questions
    .filter((q) => q.driver.gap !== null && q.type !== "text")
    .sort((a, b) => (b.driver.gap ?? 0) - (a.driver.gap ?? 0))
    .slice(0, 8);
  const maxGap = Math.max(10, ...drivers.map((q) => Math.abs(q.driver.gap ?? 0)));

  const load = report.negativeLoad;
  const loadRows = [
    { key: "zero", stat: load.zero },
    { key: "one", stat: load.one },
    { key: "twoPlus", stat: load.twoPlus },
  ] as const;

  if (drivers.length === 0 && report.compound.length === 0 && loadRows.every((r) => r.stat.n === 0)) {
    return <EmptyState title={t("drivers.empty")} description={t("drivers.emptyDesc")} />;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <SectionTitle title={t("drivers.spillTitle")} subtitle={t("drivers.spillSubtitle")} />
        {drivers.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("drivers.spillEmpty")}</p>
        ) : (
          <ul className="space-y-4">
            {drivers.map((q) => {
              const gap = q.driver.gap ?? 0;
              const topNegative = q.options.filter((o) => o.bucket === "negative").sort((a, b) => b.count - a.count)[0];
              return (
                <li key={q.id}>
                  <p className="text-sm font-semibold text-foreground">{label(q)}</p>
                  {topNegative && (
                    <p className="text-[11px] text-muted-foreground">
                      {t("drivers.whenAnswer", { answer: isAr && topNegative.labelAr ? topNegative.labelAr : topNegative.labelEn })}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-3">
                    <Meter value={Math.max(0, gap)} max={maxGap} className="bg-danger" />
                    <span className="w-24 shrink-0 text-end text-xs font-semibold text-foreground">
                      {gap > 0 ? t("drivers.points", { gap: num(gap) }) : t("drivers.noSpill")}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {t("drivers.compare", {
                      negative: num(q.driver.negativeRest),
                      positive: num(q.driver.positiveRest),
                      nNeg: num(q.driver.negativeN),
                      nPos: num(q.driver.positiveN),
                    })}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-4 border-t border-border pt-3 text-[11px] text-muted-foreground">{t("drivers.method")}</p>
      </Card>

      <div className="space-y-4">
        <Card>
          <SectionTitle title={t("drivers.loadTitle")} subtitle={t("drivers.loadSubtitle")} />
          <ul className="space-y-3">
            {loadRows.map(({ key, stat }) => (
              <li key={key}>
                <div className="mb-1 flex items-baseline justify-between text-xs">
                  <span className="font-semibold text-foreground">{t(`drivers.load.${key}`)}</span>
                  <span className="text-muted-foreground">
                    {t("drivers.customers", { n: num(stat.n), nRaw: stat.n })}
                    {stat.avg !== null ? ` · ${num(stat.avg)}` : ""}
                  </span>
                </div>
                <Meter value={stat.avg ?? 0} />
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <SectionTitle title={t("drivers.compoundTitle")} subtitle={t("drivers.compoundSubtitle")} />
          {report.compound.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("drivers.compoundEmpty")}</p>
          ) : (
            <ul className="space-y-4">
              {report.compound.map((c, i) => {
                const qa = findQuestion(report.questions, c.a.questionId);
                const qb = findQuestion(report.questions, c.b.questionId);
                return (
                  <li key={i}>
                    <p className="text-sm text-foreground">
                      {answerText(qa, c.a.key, isAr)} <span className="text-muted-foreground">+</span> {answerText(qb, c.b.key, isAr)}
                    </p>
                    <div className="mt-1.5 flex items-center gap-3">
                      <Meter value={c.avgScore} className="bg-danger" />
                      <span className="w-14 shrink-0 text-end text-xs font-semibold text-foreground">{num(c.avgScore)}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {t("drivers.compoundNote", { customers: num(c.customers), overall: num(overall) })}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
