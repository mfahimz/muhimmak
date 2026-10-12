"use client";

import * as React from "react";
import { CheckCircle2, ChevronDown, MessageCircleQuestion, MinusCircle, XCircle } from "lucide-react";
import { NEGATIVE_MAX, POSITIVE_MIN, type AnalyticsReport, type Bucket, type QuestionAnalysis, type StageKey } from "@/lib/analytics/types";
import { Button } from "@/components/ui/button";
import { useFmt } from "./format";
import { BucketBar, Chip, Delta, Meter, ScoreBadge } from "./primitives";

const BUCKET_ICON = { positive: CheckCircle2, neutral: MinusCircle, negative: XCircle } as const;
const BUCKET_COLOR: Record<Bucket, string> = { positive: "text-success", neutral: "text-warning", negative: "text-danger" };
const BUCKET_FILL: Record<Bucket, string> = { positive: "bg-success", neutral: "bg-warning", negative: "bg-danger" };

type SortMode = "survey" | "attention";

interface QuestionsTabProps {
  report: AnalyticsReport;
  onAsk: (prompt: string, questionId: string | null) => void;
  onOpenVoice: (questionId: string) => void;
}

function Histogram({ q }: { q: QuestionAnalysis }) {
  const { t, num } = useFmt();
  const max = Math.max(1, ...q.options.map((o) => o.count));
  return (
    <div>
      <div className="flex h-28 items-end gap-1.5" role="img" aria-label={t("q.distribution")}>
        {q.options.map((o) => {
          const bucket = o.bucket ?? "neutral";
          const height = o.count === 0 ? 0 : Math.max(6, (o.count / max) * 100);
          return (
            <div key={o.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${o.key}: ${num(o.count)}`}>
              <span className="text-[11px] font-semibold text-foreground">{o.count === max && o.count > 0 ? num(o.count) : ""}</span>
              <div className={`w-full max-w-6 rounded-t-sm ${BUCKET_FILL[bucket]}`} style={{ height: `${height}%` }} />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1.5">
        {q.options.map((o) => (
          <span key={o.key} className="flex-1 text-center text-[11px] text-muted-foreground">
            {num(o.key)}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <tbody>
          {q.options.map((o) => (
            <tr key={o.key}>
              <td>{num(o.key)}</td>
              <td>{num(o.count)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OptionsTable({ q }: { q: QuestionAnalysis }) {
  const { t, num, pct, isAr } = useFmt();
  const hasRest = q.options.some((o) => o.restAvg !== null);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground">
            <th className="py-1.5 text-start font-semibold">{t("q.answer")}</th>
            <th className="py-1.5 text-center font-semibold">{t("q.customers")}</th>
            <th className="w-40 py-1.5 text-start font-semibold">{t("q.share")}</th>
            {hasRest && <th className="py-1.5 text-center font-semibold">{t("q.restAvg")}</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {q.options.map((o) => {
            const Icon = o.bucket ? BUCKET_ICON[o.bucket] : null;
            return (
              <tr key={o.key} className={o.count === 0 ? "text-muted-foreground" : "text-foreground"}>
                <td className="py-2 pe-3">
                  <span className="inline-flex items-center gap-1.5">
                    {Icon && o.bucket && <Icon className={`size-3.5 shrink-0 ${BUCKET_COLOR[o.bucket]}`} aria-hidden />}
                    {isAr && o.labelAr ? o.labelAr : o.labelEn}
                  </span>
                </td>
                <td className="py-2 text-center font-semibold">{num(o.count)}</td>
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <Meter value={o.pct} className={o.bucket ? BUCKET_FILL[o.bucket] : "bg-primary"} />
                    <span className="w-10 shrink-0 text-end">{pct(o.pct)}</span>
                  </div>
                </td>
                {hasRest && <td className="py-2 text-center">{o.restAvg !== null ? num(o.restAvg) : ""}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function QuestionRow({
  q,
  report,
  open,
  onToggle,
  onAsk,
  onOpenVoice,
}: {
  q: QuestionAnalysis;
  report: AnalyticsReport;
  open: boolean;
  onToggle: () => void;
  onAsk: QuestionsTabProps["onAsk"];
  onOpenVoice: QuestionsTabProps["onOpenVoice"];
}) {
  const { t, num, pct, label, dateTime } = useFmt();
  const isText = q.type === "text";
  const delta = q.avgScore !== null && q.previousAvgScore !== null ? q.avgScore - q.previousAvgScore : null;
  const comments = isText ? report.comments.filter((c) => c.questionId === q.id && c.usable).slice(0, 5) : [];

  return (
    <li className="rounded-xl border border-border bg-card shadow-xs">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start gap-3 p-4 text-start"
      >
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <Chip>{t(`type.${q.type}`)}</Chip>
            {q.conditional && <Chip>{t("q.followUp")}</Chip>}
          </div>
          <p className="text-sm font-semibold leading-snug text-foreground">{label(q)}</p>
          <div className="mt-3 max-w-xl">
            {q.scored > 0 ? (
              <BucketBar counts={q.buckets} />
            ) : isText && q.text ? (
              <p className="text-xs text-muted-foreground">
                {t("q.textSummary", { usable: num(q.text.usable), total: num(q.text.total), classified: num(q.text.classified) })}
              </p>
            ) : null}
          </div>
        </div>
        <div className="shrink-0 text-end">
          <ScoreBadge score={q.avgScore} />
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t("q.answers", { n: num(q.answered), nRaw: q.answered })}
            {q.responseRate !== null && !q.conditional ? ` · ${t("q.responded", { rate: pct(q.responseRate) })}` : ""}
          </p>
          <div className="mt-0.5 flex justify-end">
            <Delta value={delta} />
          </div>
        </div>
        <ChevronDown className={`mt-1 size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open && (
        <div className="space-y-4 border-t border-border p-4">
          {q.type === "multiple_choice" && <OptionsTable q={q} />}
          {(q.type === "star_rating" || q.type === "numeric_scale") && (
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <div dir="ltr">
                <Histogram q={q} />
              </div>
              {q.avgRaw !== null && q.scaleMax && (
                <div className="text-center md:px-6">
                  <p className="text-3xl font-bold text-foreground">{num(q.avgRaw)}</p>
                  <p className="text-xs text-muted-foreground">{t("q.outOfScale", { max: num(q.scaleMax) })}</p>
                </div>
              )}
            </div>
          )}

          {!isText && (q.byLanguage.ar.n > 0 || q.byLanguage.en.n > 0) && (
            <div className="grid grid-cols-2 gap-3 text-xs">
              {(["ar", "en"] as const).map((l) => {
                const s = q.byLanguage[l];
                return (
                  <div key={l} className="rounded-lg bg-muted/60 p-3">
                    <p className="font-semibold text-foreground">{t(`lang.${l}`)}</p>
                    <p className="mt-0.5 text-muted-foreground">
                      {s.n > 0
                        ? t("q.langStat", { avg: num(s.avgScore), n: num(s.n), neg: pct(s.negativePct) })
                        : t("q.noAnswers")}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {q.driver.gap !== null && !isText && (
            <p className="text-xs text-muted-foreground">
              {q.driver.gap >= 0
                ? t("q.driverLower", { gap: num(Math.abs(q.driver.gap)), n: num(q.driver.negativeN) })
                : t("q.driverNone", { n: num(q.driver.negativeN) })}
            </p>
          )}

          {isText && (
            <div className="space-y-2">
              {comments.map((c) => (
                <blockquote
                  key={`${c.responseId}:${c.questionId}`}
                  dir="auto"
                  className="rounded-lg border-s-2 border-primary bg-muted/60 px-3 py-2 text-sm text-foreground"
                >
                  {c.text}
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {dateTime(c.submittedAt)} · {t(`lang.${c.language}`)}
                    {c.provenance !== "form" ? ` · ${t("voice.aiFollowUpShort")}` : ""}
                  </span>
                </blockquote>
              ))}
              {comments.length === 0 && <p className="text-xs text-muted-foreground">{t("q.noUsableComments")}</p>}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => onAsk(t("q.askPrompt", { question: label(q) }), q.id)}
            >
              <MessageCircleQuestion className="size-3.5" aria-hidden />
              {t("q.askAbout")}
            </Button>
            {isText && (
              <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => onOpenVoice(q.id)}>
                {t("q.seeAllComments")}
              </Button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

export function QuestionsTab({ report, onAsk, onOpenVoice }: QuestionsTabProps) {
  const { t, num } = useFmt();
  const [sort, setSort] = React.useState<SortMode>("survey");
  const [open, setOpen] = React.useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const groups = (["drop_off", "pick_up", "general"] as StageKey[])
    .map((stage) => {
      const all = report.questions.filter((q) => q.stage === stage);
      const structured = all.filter((q) => q.type !== "text");
      const written = all.filter((q) => q.type === "text");
      const ordered =
        sort === "attention"
          ? [...structured].sort((a, b) => (a.avgScore ?? 101) - (b.avgScore ?? 101))
          : structured;
      return { stage, items: [...ordered, ...written] };
    })
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-xs text-muted-foreground">{t("q.legend", { positive: num(POSITIVE_MIN), negative: num(NEGATIVE_MAX) })}</p>
        <div className="flex items-center rounded-lg border border-border bg-muted p-0.5 text-xs font-medium">
          {(["survey", "attention"] as SortMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setSort(m)}
              className={`rounded-md px-3 py-1.5 transition-all ${
                sort === m ? "bg-card font-semibold text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(`q.sort.${m}`)}
            </button>
          ))}
        </div>
      </div>

      {groups.map((g) => (
        <section key={g.stage} aria-labelledby={`stage-${g.stage}`}>
          <h4 id={`stage-${g.stage}`} className="mb-2 text-sm font-bold text-foreground">
            {t(`q.group.${g.stage}`)} <span className="font-normal text-muted-foreground">({num(g.items.length)})</span>
          </h4>
          <ul className="space-y-2">
            {g.items.map((q) => (
              <QuestionRow
                key={q.id}
                q={q}
                report={report}
                open={open.has(q.id)}
                onToggle={() => toggle(q.id)}
                onAsk={onAsk}
                onOpenVoice={onOpenVoice}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
