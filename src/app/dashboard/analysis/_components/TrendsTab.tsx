"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import type { AnalyticsReport } from "@/lib/analytics/types";
import { useFmt } from "./format";
import { Card, SectionTitle } from "./primitives";

function ChartSkeleton({ height }: { height: string }) {
  return <div className={`${height} w-full animate-pulse rounded-lg bg-muted/60`} aria-hidden />;
}

const ScoreTrendChart = dynamic(() => import("./TrendCharts").then((m) => m.ScoreTrendChart), {
  ssr: false,
  loading: () => <ChartSkeleton height="h-64" />,
});
const SurveysChart = dynamic(() => import("./TrendCharts").then((m) => m.SurveysChart), {
  ssr: false,
  loading: () => <ChartSkeleton height="h-48" />,
});
const WeekdayChart = dynamic(() => import("./TrendCharts").then((m) => m.WeekdayChart), {
  ssr: false,
  loading: () => <ChartSkeleton height="h-44" />,
});

function LegendKey({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: color }} aria-hidden />
      {label}
    </span>
  );
}

/** A chart card with the table twin of the chart one click away. */
function ChartCard({
  title,
  subtitle,
  legend,
  table,
  children,
}: {
  title: string;
  subtitle?: string;
  legend?: React.ReactNode;
  table: { headers: string[]; rows: string[][] };
  children: React.ReactNode;
}) {
  const { t } = useFmt();
  const [asTable, setAsTable] = React.useState(false);
  return (
    <Card>
      <SectionTitle
        title={title}
        subtitle={subtitle}
        action={
          <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => setAsTable((v) => !v)}>
            {asTable ? t("trends.chartView") : t("trends.tableView")}
          </Button>
        }
      />
      {legend && <div className="mb-2 flex flex-wrap gap-4">{legend}</div>}
      {asTable ? (
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card text-muted-foreground">
              <tr>
                {table.headers.map((h) => (
                  <th key={h} className="py-1.5 text-start font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border tabular-nums">
              {table.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j} className="py-1.5 pe-3">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </Card>
  );
}

export function TrendsTab({ report }: { report: AnalyticsReport }) {
  const { t, num, pct, shortDate, month } = useFmt();
  const o = report.overview;
  const points = report.trend.points;
  const hasStageSplit = points.some((p) => p.dropOff.n > 0) && points.some((p) => p.pickUp.n > 0);
  const f = o.funnel;
  const funnelTotal = Math.max(1, f.started);
  const notFinished = f.unfinished + f.abandoned;
  const weekdayHasData = report.weekday.filter((w) => w.surveys > 0).length >= 3;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <ChartCard
          title={t("trends.scoreTitle")}
          subtitle={t(report.trend.granularity === "week" ? "trends.byWeek" : "trends.byDay")}
          legend={
            <>
              <LegendKey color="var(--viz-drop-off)" label={t("stage.drop_off")} />
              <LegendKey color="var(--viz-pick-up)" label={t("stage.pick_up")} />
            </>
          }
          table={{
            headers: [t("trends.date"), t("stage.drop_off"), t("stage.pick_up"), t("trends.surveys")],
            rows: points.map((p) => [shortDate(p.key), num(p.dropOff.avg), num(p.pickUp.avg), num(p.surveys)]),
          }}
        >
          {hasStageSplit || points.some((p) => p.avg !== null) ? (
            <ScoreTrendChart
              points={points}
              names={{ dropOff: t("stage.drop_off"), pickUp: t("stage.pick_up"), n: t("trends.surveys") }}
              formatDate={shortDate}
              formatNum={num}
            />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">{t("trends.noData")}</p>
          )}
        </ChartCard>
      </div>

      <ChartCard
        title={t("trends.volumeTitle")}
        subtitle={t("trends.volumeSubtitle")}
        table={{
          headers: [t("trends.date"), t("trends.surveys")],
          rows: points.map((p) => [shortDate(p.key), num(p.surveys)]),
        }}
      >
        <SurveysChart points={points} name={t("trends.surveys")} formatDate={shortDate} formatNum={num} />
      </ChartCard>

      <Card>
        <SectionTitle title={t("trends.funnelTitle")} subtitle={t("trends.funnelSubtitle")} />
        <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={t("trends.funnelTitle")}>
          <div style={{ width: `${(f.completed / funnelTotal) * 100}%`, background: "var(--viz-single)" }} title={`${t("trends.completed")}: ${num(f.completed)}`} />
          <div className="bg-muted-foreground/50" style={{ width: `${(f.declined / funnelTotal) * 100}%` }} title={`${t("trends.declined")}: ${num(f.declined)}`} />
          <div className="bg-muted-foreground/20" style={{ width: `${(notFinished / funnelTotal) * 100}%` }} title={`${t("trends.notFinished")}: ${num(notFinished)}`} />
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div>
            <dt className="text-muted-foreground">{t("trends.completed")}</dt>
            <dd className="text-lg font-bold text-foreground">{num(f.completed)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("trends.declined")}</dt>
            <dd className="text-lg font-bold text-foreground">{num(f.declined)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("trends.notFinished")}</dt>
            <dd className="text-lg font-bold text-foreground">{num(notFinished)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          {t("trends.funnelNote", { started: num(f.started), rate: pct(f.completionRate) })}
        </p>
        <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
          <p>{t("trends.reviewLine", { clicked: num(o.googleReview.clicked), eligible: num(o.googleReview.eligible) })}</p>
          {report.dataQuality.reviewTrackingGap && <p className="mt-1">{t("trends.reviewGap")}</p>}
        </div>
      </Card>

      <Card>
        <SectionTitle title={t("trends.languageTitle")} subtitle={t("trends.languageSubtitle")} />
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="py-1.5 text-start font-semibold">{t("trends.language")}</th>
              <th className="py-1.5 text-center font-semibold">{t("trends.surveys")}</th>
              <th className="py-1.5 text-center font-semibold">{t("trends.avgScore")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(["ar", "en"] as const).map((l) => (
              <tr key={l}>
                <td className="py-2 font-medium text-foreground">{t(`lang.${l}`)}</td>
                <td className="py-2 text-center">{num(o.byLanguage[l].n)}</td>
                <td className="py-2 text-center font-semibold text-foreground">{num(o.byLanguage[l].avg)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {weekdayHasData && (
        <ChartCard
          title={t("trends.weekdayTitle")}
          subtitle={t("trends.weekdaySubtitle")}
          table={{
            headers: [t("trends.day"), t("trends.surveys"), t("trends.avgScore")],
            rows: report.weekday.map((w) => [t(`weekday.${w.day}`), num(w.surveys), num(w.avg)]),
          }}
        >
          <WeekdayChart
            points={report.weekday}
            dayName={(d) => t(`weekday.${d}`)}
            names={{ surveys: t("trends.surveys"), avg: t("trends.avgScore") }}
            formatNum={num}
          />
        </ChartCard>
      )}

      {report.monthly.length >= 2 && (
        <Card className="lg:col-span-2">
          <SectionTitle title={t("trends.monthlyTitle")} subtitle={t("trends.monthlySubtitle")} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="py-1.5 text-start font-semibold">{t("trends.month")}</th>
                  <th className="py-1.5 text-center font-semibold">{t("trends.surveys")}</th>
                  <th className="py-1.5 text-center font-semibold">{t("trends.avgScore")}</th>
                  <th className="py-1.5 text-center font-semibold">{t("stage.drop_off")}</th>
                  <th className="py-1.5 text-center font-semibold">{t("stage.pick_up")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border tabular-nums">
                {report.monthly.map((m) => (
                  <tr key={m.month}>
                    <td className="py-2 font-medium text-foreground">{month(m.month)}</td>
                    <td className="py-2 text-center">{num(m.surveys)}</td>
                    <td className="py-2 text-center font-semibold text-foreground">{num(m.avg)}</td>
                    <td className="py-2 text-center">
                      {num(m.dropOff.avg)} <span className="text-xs text-muted-foreground">({num(m.dropOff.n)})</span>
                    </td>
                    <td className="py-2 text-center">
                      {num(m.pickUp.avg)} <span className="text-xs text-muted-foreground">({num(m.pickUp.n)})</span>
                    </td>
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
