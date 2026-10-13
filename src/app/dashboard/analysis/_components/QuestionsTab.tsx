"use client";

import * as React from "react";
import { ChevronDown, MessageCircleQuestion } from "lucide-react";
import type { AnalyticsReport, OptionStat, QuestionAnalysis, StageKey } from "@/lib/analytics/types";
import { useFmt } from "./format";
import { BUCKET_FILL, BUCKET_ORDER, Card, Meter, StackBar } from "./primitives";

interface QuestionsTabProps {
  report: AnalyticsReport;
  onAsk: (prompt: string, questionId: string | null) => void;
  onOpenComments: () => void;
}

function AnswerRow({ o, label }: { o: OptionStat; label: string }) {
  const { num, pct } = useFmt();
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_5rem_4.5rem] items-center gap-3 text-sm sm:grid-cols-[minmax(0,1fr)_8rem_4.5rem]">
      <span className={`inline-flex min-w-0 items-center gap-2 ${o.count === 0 ? "text-muted-foreground" : "text-foreground"}`}>
        <span className={`size-1.5 shrink-0 rounded-full ${o.bucket ? BUCKET_FILL[o.bucket] : "bg-muted-foreground/40"}`} aria-hidden />
        <span className="truncate">{label}</span>
      </span>
      <Meter value={o.pct} className={o.bucket ? BUCKET_FILL[o.bucket] : "bg-primary"} />
      <span className="text-end text-xs text-muted-foreground">
        {num(o.count)} · {pct(o.pct)}
      </span>
    </li>
  );
}

function QuestionDetail({ q, onAsk }: { q: QuestionAnalysis; onAsk: QuestionsTabProps["onAsk"] }) {
  const { t, num, label, isAr } = useFmt();
  const isScale = q.type === "star_rating" || q.type === "numeric_scale";
  // Scales list only the values somebody chose, highest first. Choices keep the form order.
  const rows = isScale ? q.options.filter((o) => o.count > 0).sort((a, b) => Number(b.key) - Number(a.key)) : q.options;
  const { ar, en } = q.byLanguage;

  return (
    <div className="space-y-4 border-t border-border bg-muted/30 px-4 py-4">
      <ul className="max-w-xl space-y-2">
        {rows.map((o) => (
          <AnswerRow key={o.key} o={o} label={isScale ? t("q.rated", { value: num(o.key) }) : isAr && o.labelAr ? o.labelAr : o.labelEn} />
        ))}
      </ul>

      <div className="space-y-1 text-xs text-muted-foreground">
        <p>
          {t("q.answers", { n: num(q.answered), nRaw: q.answered })}
          {ar.n > 0 && en.n > 0 && ` · ${t("q.langLine", { ar: num(ar.avgScore), en: num(en.avgScore) })}`}
        </p>
        {q.driver.gap !== null && <p>{q.driver.gap >= 5 ? t("q.driverLower", { gap: num(q.driver.gap) }) : t("q.driverNone")}</p>}
      </div>

      <button
        type="button"
        onClick={() => onAsk(t("q.askPrompt", { question: label(q) }), q.id)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <MessageCircleQuestion className="size-4" aria-hidden />
        {t("q.askAbout")}
      </button>
    </div>
  );
}

export function QuestionsTab({ report, onAsk, onOpenComments }: QuestionsTabProps) {
  const { t, num, pct, label } = useFmt();
  const [open, setOpen] = React.useState<string | null>(null);

  const groups = (["drop_off", "pick_up", "general"] as StageKey[])
    .map((stage) => ({ stage, items: report.questions.filter((q) => q.stage === stage && q.type !== "text") }))
    .filter((g) => g.items.length > 0);
  const writtenCount = report.questions.filter((q) => q.type === "text").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {BUCKET_ORDER.map((b) => (
          <span key={b} className="inline-flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${BUCKET_FILL[b]}`} aria-hidden />
            {t(`bucket.${b}`)}
          </span>
        ))}
        <span>{t("q.tap")}</span>
      </div>

      {groups.map((g) => (
        <section key={g.stage} aria-labelledby={`group-${g.stage}`}>
          <h4 id={`group-${g.stage}`} className="mb-2 text-xs font-bold text-muted-foreground">
            {t(`q.group.${g.stage}`)}
          </h4>
          <Card className="overflow-hidden p-0">
            <ul className="divide-y divide-border">
              {g.items.map((q) => {
                const isOpen = open === q.id;
                const negPct = q.scored > 0 ? Math.round((q.buckets.negative / q.scored) * 100) : 0;
                return (
                  <li key={q.id}>
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : q.id)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center gap-4 px-4 py-3 text-start transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug text-foreground">{label(q)}</p>
                        <div className="mt-2 max-w-md">
                          <StackBar counts={q.buckets} />
                        </div>
                      </div>
                      <div className="shrink-0 text-end">
                        <p className="text-lg font-bold leading-none text-foreground">{num(q.avgScore)}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {negPct > 0 ? t("q.negativeShort", { pct: pct(negPct) }) : t("q.answers", { n: num(q.answered), nRaw: q.answered })}
                        </p>
                      </div>
                      <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden />
                    </button>
                    {isOpen && <QuestionDetail q={q} onAsk={onAsk} />}
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      ))}

      {writtenCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("q.writtenNote")}{" "}
          <button type="button" onClick={onOpenComments} className="font-medium text-primary hover:underline">
            {t("q.openComments")}
          </button>
        </p>
      )}
    </div>
  );
}
