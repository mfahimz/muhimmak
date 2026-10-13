"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { bucketOf, type Bucket } from "@/lib/analytics/types";
import { useFmt } from "./format";

export const BUCKET_ORDER: Bucket[] = ["positive", "neutral", "negative"];

export const BUCKET_FILL: Record<Bucket, string> = {
  positive: "bg-success",
  neutral: "bg-warning",
  negative: "bg-danger",
};

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("rounded-xl border border-border bg-card p-5 shadow-xs", className)}>{children}</section>;
}

export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-base font-bold text-foreground">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** The number in ink with a small coloured dot for its band. */
export function ScoreBadge({ score }: { score: number | null }) {
  const { num } = useFmt();
  if (score === null) return <span className="text-xs text-muted-foreground">{num(null)}</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-bold text-foreground">
      <span className={`size-2 rounded-full ${BUCKET_FILL[bucketOf(score)]}`} aria-hidden />
      {num(Math.round(score * 10) / 10)}
    </span>
  );
}

/** Change against the previous period. The arrow is coloured, the number stays in ink. */
export function Delta({ value, title }: { value: number | null; title?: string }) {
  const { num } = useFmt();
  if (value === null || Math.abs(value) < 0.05) return null;
  const up = value > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-foreground" title={title}>
      <Icon className={`size-3.5 ${up ? "text-success" : "text-danger"}`} aria-hidden />
      {num(Math.abs(Math.round(value * 10) / 10))}
    </span>
  );
}

/** One thin bar split into positive, neutral and negative answers. */
export function StackBar({ counts }: { counts: Record<Bucket, number> }) {
  const { t, pct } = useFmt();
  const total = counts.positive + counts.neutral + counts.negative;
  if (total === 0) return <div className="h-1.5 rounded-full bg-muted" />;
  const share = (b: Bucket) => Math.round((counts[b] / total) * 100);
  return (
    <div
      className="flex h-1.5 gap-0.5 overflow-hidden rounded-full"
      role="img"
      aria-label={BUCKET_ORDER.map((b) => `${t(`bucket.${b}`)} ${pct(share(b))}`).join(", ")}
    >
      {BUCKET_ORDER.filter((b) => counts[b] > 0).map((b) => (
        <div key={b} className={BUCKET_FILL[b]} style={{ width: `${(counts[b] / total) * 100}%` }} />
      ))}
    </div>
  );
}

/** A thin horizontal meter. The fill is the data, the track is a recessive wash. */
export function Meter({ value, max = 100, className = "bg-primary" }: { value: number; max?: number; className?: string }) {
  const width = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
      <div className={`h-full rounded-full ${className}`} style={{ width: `${width}%` }} />
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-4 py-14 text-center">
      <p className="text-base font-bold text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}
