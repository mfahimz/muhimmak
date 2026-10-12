"use client";

import * as React from "react";
import type { AnalyticsReport } from "@/lib/analytics/types";
import { useFmt } from "./format";
import { Delta, Meter } from "./primitives";

function Tile({
  label,
  children,
  className = "",
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-xs ${className}`}>
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function diff(cur: number | null, prev: number | null): number | null {
  return cur !== null && prev !== null ? cur - prev : null;
}

export function KpiTiles({ report }: { report: AnalyticsReport }) {
  const { t, num, pct } = useFmt();
  const o = report.overview;
  const prev = report.previous;
  const hasPrev = !!prev && prev.surveys > 0;

  const stageTile = (stage: "drop_off" | "pick_up") => {
    const cur = o.byStage[stage];
    const before = prev?.byStage[stage];
    const color = stage === "drop_off" ? "var(--viz-drop-off)" : "var(--viz-pick-up)";
    return (
      <Tile
        key={stage}
        label={
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: color }} aria-hidden />
            {t(stage === "drop_off" ? "kpi.dropOff" : "kpi.pickUp")}
          </span>
        }
      >
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-foreground">{num(cur.avg)}</span>
          {hasPrev && before && cur.n >= 3 && before.n >= 3 && <Delta value={diff(cur.avg, before.avg)} />}
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">{t("kpi.surveysN", { n: num(cur.n), nRaw: cur.n })}</p>
      </Tile>
    );
  };

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Tile label={t("kpi.overall")} className="col-span-2 xl:col-span-2">
        <div className="flex items-baseline gap-3">
          <span className="text-5xl font-bold tracking-tight text-foreground">{num(o.avgScore)}</span>
          <span className="text-sm text-muted-foreground">{t("kpi.outOf")}</span>
          {hasPrev && <Delta value={diff(o.avgScore, prev?.avgScore ?? null)} />}
        </div>
        <div className="mt-3">
          <Meter value={o.avgScore ?? 0} />
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {hasPrev ? t("kpi.vsPrevious") : t("kpi.noPrevious")}
        </p>
      </Tile>

      {stageTile("drop_off")}
      {stageTile("pick_up")}

      <Tile label={t("kpi.surveys")}>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-foreground">{num(o.surveys)}</span>
          {hasPrev && <Delta value={diff(o.surveys, prev?.surveys ?? null)} />}
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {o.funnel.completionRate !== null ? t("kpi.completion", { rate: pct(o.funnel.completionRate) }) : ""}
        </p>
      </Tile>

      <Tile label={t("kpi.comments")}>
        <span className="text-3xl font-bold text-foreground">{num(o.comments.usable)}</span>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {t("kpi.commentsSub", { total: num(o.comments.total), classified: num(o.comments.classified) })}
        </p>
      </Tile>
    </div>
  );
}
