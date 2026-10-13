"use client";

// Loaded with next/dynamic (ssr: false) so recharts stays out of the initial bundle.
// Colours come from CSS tokens in globals.css so light and dark are handled in one place.
// Grid and axes are solid hairlines; marks are thin; hover shows one tooltip per x position.

import * as React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrendPoint } from "@/lib/analytics/types";

interface TooltipRow {
  name: string;
  value: string;
  color: string;
}

function ChartTooltip({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-foreground">{title}</p>
      {rows.map((r) => (
        <div key={r.name} className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: r.color }} aria-hidden />
          <span className="font-semibold text-foreground">{r.value}</span>
          <span className="text-muted-foreground">{r.name}</span>
        </div>
      ))}
    </div>
  );
}

const AXIS_TICK = { fontSize: 11, fill: "var(--viz-label)" };
const GRID = "var(--viz-grid)";
const AXIS = "var(--viz-axis)";
const SURFACE = "var(--card)";

interface ScoreTrendProps {
  points: TrendPoint[];
  names: { dropOff: string; pickUp: string; n: string };
  formatDate: (key: string) => string;
  formatNum: (v: number | null | undefined) => string;
}

export function ScoreTrendChart({ points, names, formatDate, formatNum }: ScoreTrendProps) {
  const data = points.map((p) => ({
    key: p.key,
    drop: p.dropOff.avg,
    pick: p.pickUp.avg,
    nDrop: p.dropOff.n,
    nPick: p.pickUp.n,
  }));
  const values = data.flatMap((d) => [d.drop, d.pick]).filter((v): v is number => v !== null);
  const low = values.length > 0 ? Math.max(0, Math.floor((Math.min(...values) - 5) / 10) * 10) : 0;

  return (
    <div dir="ltr" className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="key" tickFormatter={formatDate} tick={AXIS_TICK} axisLine={{ stroke: AXIS }} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
          <YAxis domain={[low, 100]} tickFormatter={(v: number) => formatNum(v)} tick={AXIS_TICK} axisLine={false} tickLine={false} width={36} />
          <Tooltip
            cursor={{ stroke: AXIS }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as (typeof data)[number];
              const rows: TooltipRow[] = [];
              if (d.drop !== null) rows.push({ name: `${names.dropOff} (${names.n} ${formatNum(d.nDrop)})`, value: formatNum(d.drop), color: "var(--viz-drop-off)" });
              if (d.pick !== null) rows.push({ name: `${names.pickUp} (${names.n} ${formatNum(d.nPick)})`, value: formatNum(d.pick), color: "var(--viz-pick-up)" });
              return <ChartTooltip title={formatDate(d.key)} rows={rows} />;
            }}
          />
          <Line type="linear" dataKey="drop" stroke="var(--viz-drop-off)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" connectNulls dot={{ r: 4, fill: "var(--viz-drop-off)", stroke: SURFACE, strokeWidth: 2 }} activeDot={{ r: 6, stroke: SURFACE, strokeWidth: 2 }} isAnimationActive={false} />
          <Line type="linear" dataKey="pick" stroke="var(--viz-pick-up)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" connectNulls dot={{ r: 4, fill: "var(--viz-pick-up)", stroke: SURFACE, strokeWidth: 2 }} activeDot={{ r: 6, stroke: SURFACE, strokeWidth: 2 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
