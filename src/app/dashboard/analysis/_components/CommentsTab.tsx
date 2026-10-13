"use client";

import * as React from "react";
import { Info, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COMMENT_CATEGORIES, type AnalyticsReport, type CommentCategory, type CommentTheme } from "@/lib/analytics/types";
import { useFmt } from "./format";
import { Card, EmptyState } from "./primitives";

const PAGE = 20;

const CATEGORY_DOT: Record<CommentCategory, string> = {
  praise: "bg-success",
  complaint: "bg-danger",
  suggestion: "bg-primary",
  mixed: "bg-warning",
  neutral: "bg-muted-foreground/50",
};

const selectClass =
  "rounded-lg border border-input bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring/30";

interface CommentsTabProps {
  report: AnalyticsReport;
  initialQuestionId: string | null;
  aiBusy: boolean;
  aiDisabled: boolean;
  onClassify: () => void;
}

export function CommentsTab({ report, initialQuestionId, aiBusy, aiDisabled, onClassify }: CommentsTabProps) {
  const { t, num, label, isAr, dateTime, stage: stageName } = useFmt();
  const [search, setSearch] = React.useState("");
  const [questionId, setQuestionId] = React.useState(initialQuestionId ?? "all");
  const [category, setCategory] = React.useState<"all" | CommentCategory>("all");
  const [theme, setTheme] = React.useState<CommentTheme | null>(null);
  const [limit, setLimit] = React.useState(PAGE);

  const c = report.overview.comments;
  const unclassified = c.usable - c.classified;
  const textQuestions = report.questions.filter((q) => q.type === "text");
  const usable = report.comments.filter((x) => x.usable);

  const reset = () => setLimit(PAGE);
  const filtered = usable.filter((x) => {
    if (questionId !== "all" && x.questionId !== questionId) return false;
    if (category !== "all" && x.insight?.category !== category) return false;
    if (theme && !x.insight?.themes.includes(theme)) return false;
    if (search.trim()) {
      const hay = `${x.text} ${x.insight?.gist ?? ""}`.toLowerCase();
      if (!hay.includes(search.trim().toLowerCase())) return false;
    }
    return true;
  });

  if (c.usable === 0) return <EmptyState title={t("c.empty")} description={t("c.emptyDesc")} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{num(c.usable)}</span> {t("c.useful", { total: num(c.total) })}
        </p>
        {unclassified > 0 && (
          <Button type="button" size="sm" variant="outline" onClick={onClassify} disabled={aiBusy || aiDisabled} className="gap-1.5 text-xs">
            {aiBusy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Sparkles className="size-3.5" aria-hidden />}
            {t("c.classify", { n: num(unclassified) })}
          </Button>
        )}
      </div>

      {report.commentThemes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {report.commentThemes.map((th) => (
            <button
              key={th.theme}
              type="button"
              aria-pressed={theme === th.theme}
              onClick={() => {
                setTheme(theme === th.theme ? null : th.theme);
                reset();
              }}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                theme === th.theme ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground hover:bg-muted"
              }`}
            >
              {t(`theme.${th.theme}`)} <span className="text-muted-foreground">{num(th.count)}</span>
            </button>
          ))}
        </div>
      )}

      {report.staffMentions.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("c.staff")} <span className="text-foreground">{report.staffMentions.map((s) => `${s.name} (${num(s.count)})`).join(" · ")}</span>
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            reset();
          }}
          placeholder={t("c.search")}
          aria-label={t("c.search")}
          className="min-w-44 flex-1 rounded-lg border border-input bg-card px-3 py-1.5 text-xs focus:outline-hidden focus:ring-2 focus:ring-ring/30"
        />
        {textQuestions.length > 1 && (
          <select
            aria-label={t("c.allQuestions")}
            className={`${selectClass} max-w-60`}
            value={questionId}
            onChange={(e) => {
              setQuestionId(e.target.value);
              reset();
            }}
          >
            <option value="all">{t("c.allQuestions")}</option>
            {textQuestions.map((q) => (
              <option key={q.id} value={q.id}>
                {label(q)}
              </option>
            ))}
          </select>
        )}
        {c.classified > 0 && (
          <select
            aria-label={t("c.allTypes")}
            className={selectClass}
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as typeof category);
              reset();
            }}
          >
            <option value="all">{t("c.allTypes")}</option>
            {COMMENT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {t(`category.${cat}`)}
              </option>
            ))}
          </select>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("c.noMatch")}</p>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-border">
            {filtered.slice(0, limit).map((x) => {
              const showGist = !!x.insight?.gist && !isAr && /[؀-ۿ]/.test(x.text);
              return (
                <li key={`${x.responseId}:${x.questionId}`} className="px-4 py-3">
                  <p dir="auto" className="text-sm leading-relaxed text-foreground">
                    {x.text}
                  </p>
                  {showGist && <p className="mt-1 text-xs italic text-muted-foreground">{t("c.gist", { gist: x.insight?.gist ?? "" })}</p>}
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
                    <span>{dateTime(x.submittedAt)}</span>
                    <span aria-hidden>·</span>
                    <span>{stageName(x.stage)}</span>
                    {x.insight && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="inline-flex items-center gap-1">
                          <span className={`size-1.5 rounded-full ${CATEGORY_DOT[x.insight.category]}`} aria-hidden />
                          {t(`category.${x.insight.category}`)}
                        </span>
                      </>
                    )}
                    {x.provenance !== "form" && (
                      <span className="inline-flex items-center" title={t("c.aiUncertainHelp")}>
                        <Info className="size-3" aria-label={t("c.aiUncertainHelp")} />
                      </span>
                    )}
                  </p>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {filtered.length > limit && (
        <div className="text-center">
          <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="text-sm font-medium text-primary hover:underline">
            {t("c.showMore")}
          </button>
        </div>
      )}
    </div>
  );
}
