"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, CheckCircle2, MinusCircle, XCircle } from "lucide-react";
import { bucketOf, type Bucket, type StageKey } from "@/lib/analytics/types";
import { useFmt } from "./format";

export const BUCKET_ORDER: Bucket[] = ["positive", "neutral", "negative"];

const BUCKET_BAR: Record<Bucket, string> = {
  positive: "bg-success",
  neutral: "bg-warning",
  negative: "bg-danger",
};
const BUCKET_TEXT: Record<Bucket, string> = {
  positive: "text-success",
  neutral: "text-warning",
  negative: "text-danger",
};
const BUCKET_ICON = { positive: CheckCircle2, neutral: MinusCircle, negative: XCircle } as const;

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <section className={`rounded-xl border border-border bg-card p-5 shadow-xs ${className}`}>{children}</section>;
}

export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
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

export function Chip({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground ${className}`}>
      {children}
    </span>
  );
}

export function StageChip({ stage }: { stage: StageKey }) {
  const { stage: label } = useFmt();
  return <Chip>{label(stage)}</Chip>;
}

/** The score is written in ink; the coloured dot carries the status together with the number. */
export function ScoreBadge({ score, className = "" }: { score: number | null; className?: string }) {
  const { num } = useFmt();
  if (score === null) return <span className="text-xs text-muted-foreground">{num(null)}</span>;
  const bucket = bucketOf(score);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-0.5 text-sm font-bold text-foreground ${className}`}>
      <span className={`size-2 rounded-full ${BUCKET_BAR[bucket]}`} aria-hidden />
      {num(Math.round(score * 10) / 10)}
    </span>
  );
}

/** Change against the previous period. The arrow is coloured, the number stays in ink. */
export function Delta({ value, suffix = "" }: { value: number | null; suffix?: string }) {
  const { num } = useFmt();
  if (value === null || Math.abs(value) < 0.05) return null;
  const up = value > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-foreground">
      <Icon className={`size-3.5 ${up ? "text-success" : "text-danger"}`} aria-hidden />
      {num(Math.abs(Math.round(value * 10) / 10))}
      {suffix}
    </span>
  );
}

/** Positive / neutral / negative share of answers, with the figures written out underneath. */
export function BucketBar({ counts }: { counts: Record<Bucket, number> }) {
  const { t, num, pct } = useFmt();
  const total = counts.positive + counts.neutral + counts.negative;
  if (total === 0) return <div className="h-2.5 rounded-full bg-muted" />;
  const share = (b: Bucket) => Math.round((counts[b] / total) * 100);

  return (
    <div>
      <div
        className="flex h-2.5 gap-0.5 overflow-hidden rounded-full"
        role="img"
        aria-label={BUCKET_ORDER.map((b) => `${t(`bucket.${b}`)} ${pct(share(b))}`).join(", ")}
      >
        {BUCKET_ORDER.filter((b) => counts[b] > 0).map((b) => (
          <div
            key={b}
            className={BUCKET_BAR[b]}
            style={{ width: `${(counts[b] / total) * 100}%` }}
            title={`${t(`bucket.${b}`)}: ${num(counts[b])} (${pct(share(b))})`}
          />
        ))}
      </div>
      <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {BUCKET_ORDER.map((b) => {
          const Icon = BUCKET_ICON[b];
          return (
            <li key={b} className="inline-flex items-center gap-1">
              <Icon className={`size-3 ${BUCKET_TEXT[b]}`} aria-hidden />
              {pct(share(b))} {t(`bucket.${b}`)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** A thin horizontal meter used for shares and score gaps. The fill is the data, the track is a recessive wash. */
export function Meter({ value, max = 100, className = "bg-primary" }: { value: number; max?: number; className?: string }) {
  const width = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
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
