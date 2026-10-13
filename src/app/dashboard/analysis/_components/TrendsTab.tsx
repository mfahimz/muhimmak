"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import type { AnalyticsReport } from "@/lib/analytics/types";
import { useFmt } from "./format";
import { Card } from "./primitives";

const ScoreTrendChart = dynamic(() => import("./TrendCharts").then((m) => m.ScoreTrendChart), {
  ssr: false,
  loading: () => <div className="h-64 w-full animate-pulse rounded-lg bg-muted/60" aria-hidden />,
});

function LegendKey({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: color }} aria-hidden />
      {label}
    </span>
  );
}

export function TrendsTab({ report }: { report: AnalyticsReport }) {
  const { t, num, pct, shortDate, month } = useFmt();
  const [asTable, setAsTable] = React.useState(false);
  const o = report.overview;
  const points = report.trend.points;
  const hasData = points.some((p) => p.avg !== null);
  const busiest = [...report.weekday].sort((a, b) => b.surveys - a.surveys)[0];

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-foreground">{t("trends.scoreTitle")}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{t(report.trend.granularity === "week" ? "trends.byWeek" : "trends.byDay")}</p>
          </div>
          <button type="button" onClick={() => setAsTable((v) => !v)} className="text-xs font-medium text-primary hover:underline">
            {asTable ? t("trends.chartView") : t("trends.tableView")}
          </button>
        </div>

        {!hasData ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t("trends.noData")}</p>
        ) : asTable ? (
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card text-muted-foreground">
                <tr>
                  <th className="py-1.5 text-start font-semibold">{t("trends.date")}</th>
                  <th className="py-1.5 text-start font-semibold">{t("stage.drop_off")}</th>
                  <th className="py-1.5 text-start font-semibold">{t("stage.pick_up")}</th>
                  <th className="py-1.5 text-start font-semibold">{t("trends.surveys")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border tabular-nums">
                {points.map((p) => (
                  <tr key={p.key}>
                    <td className="py-1.5 pe-3">{shortDate(p.key)}</td>
                    <td className="py-1.5 pe-3">{num(p.dropOff.avg)}</td>
                    <td className="py-1.5 pe-3">{num(p.pickUp.avg)}</td>
                    <td className="py-1.5">{num(p.surveys)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <div className="mb-2 flex flex-wrap gap-4">
              <LegendKey color="var(--viz-drop-off)" label={t("stage.drop_off")} />
              <LegendKey color="var(--viz-pick-up)" label={t("stage.pick_up")} />
            </div>
            <ScoreTrendChart
              points={points}
              names={{ dropOff: t("stage.drop_off"), pickUp: t("stage.pick_up"), n: t("trends.surveys") }}
              formatDate={shortDate}
              formatNum={num}
            />
          </>
        )}
      </Card>

      <Card>
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">{t("trends.completionLabel")}</dt>
            <dd className="mt-0.5 text-foreground">
              {t("trends.completion", { completed: num(o.funnel.completed), started: num(o.funnel.started), rate: pct(o.funnel.completionRate) })}
            </dd>
          </div>
          {busiest && busiest.surveys > 0 && (
            <div>
              <dt className="text-xs text-muted-foreground">{t("trends.busiestLabel")}</dt>
              <dd className="mt-0.5 text-foreground">{t("trends.busiest", { day: t(`weekday.${busiest.day}`), n: num(busiest.surveys) })}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-muted-foreground">{t("trends.reviewsLabel")}</dt>
            <dd className="mt-0.5 text-foreground">{num(o.googleReview.clicked)}</dd>
          </div>
        </dl>
      </Card>

      {report.monthly.length >= 2 && (
        <Card>
          <h3 className="mb-3 text-base font-bold text-foreground">{t("trends.monthlyTitle")}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="py-1.5 text-start font-semibold">{t("trends.month")}</th>
                  <th className="py-1.5 text-center font-semibold">{t("trends.surveys")}</th>
                  <th className="py-1.5 text-center font-semibold">{t("stage.drop_off")}</th>
                  <th className="py-1.5 text-center font-semibold">{t("stage.pick_up")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border tabular-nums">
                {report.monthly.map((m) => (
                  <tr key={m.month}>
                    <td className="py-2 text-foreground">{month(m.month)}</td>
                    <td className="py-2 text-center">{num(m.surveys)}</td>
                    <td className="py-2 text-center">{num(m.dropOff.avg)}</td>
                    <td className="py-2 text-center">{num(m.pickUp.avg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
