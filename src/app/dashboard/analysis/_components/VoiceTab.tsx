"use client";

import * as React from "react";
import { Info, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  COMMENT_CATEGORIES,
  type AnalyticsReport,
  type CommentCategory,
  type CommentItem,
  type Lang,
  type StageKey,
} from "@/lib/analytics/types";
import { findQuestion, useFmt } from "./format";
import { Card, Chip, EmptyState, ScoreBadge, SectionTitle } from "./primitives";

const PAGE = 30;

const CATEGORY_DOT: Record<CommentCategory, string> = {
  praise: "bg-success",
  complaint: "bg-danger",
  suggestion: "bg-primary",
  mixed: "bg-warning",
  neutral: "bg-muted-foreground/50",
};

interface VoiceTabProps {
  report: AnalyticsReport;
  initialQuestionId: string | null;
  aiBusy: boolean;
  onClassify: () => void;
}

const selectClass =
  "rounded-lg border border-input bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring/30";

function Themes({ report }: { report: AnalyticsReport }) {
  const { t, num } = useFmt();
  const max = Math.max(1, ...report.commentThemes.map((x) => x.count));
  return (
    <Card>
      <SectionTitle title={t("voice.themesTitle")} subtitle={t("voice.themesSubtitle")} />
      <ul className="space-y-3">
        {report.commentThemes.map((th) => (
          <li key={th.theme}>
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="font-semibold text-foreground">{t(`theme.${th.theme}`)}</span>
              <span className="text-muted-foreground">{num(th.count)}</span>
            </div>
            <div className="flex h-2 gap-0.5 overflow-hidden rounded-full" style={{ width: `${(th.count / max) * 100}%` }}>
              {th.praise > 0 && <div className="bg-success" style={{ flex: th.praise }} title={`${t("category.praise")}: ${num(th.praise)}`} />}
              {th.complaint > 0 && <div className="bg-danger" style={{ flex: th.complaint }} title={`${t("category.complaint")}: ${num(th.complaint)}`} />}
              {th.suggestion > 0 && <div className="bg-primary" style={{ flex: th.suggestion }} title={`${t("category.suggestion")}: ${num(th.suggestion)}`} />}
              {th.other > 0 && <div className="bg-muted-foreground/40" style={{ flex: th.other }} title={`${t("category.other")}: ${num(th.other)}`} />}
            </div>
          </li>
        ))}
      </ul>
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-[11px] text-muted-foreground">
        {(["praise", "complaint", "suggestion", "other"] as const).map((c) => (
          <li key={c} className="inline-flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${c === "praise" ? "bg-success" : c === "complaint" ? "bg-danger" : c === "suggestion" ? "bg-primary" : "bg-muted-foreground/40"}`} aria-hidden />
            {t(`category.${c}`)}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function CommentCard({ c, report }: { c: CommentItem; report: AnalyticsReport }) {
  const { t, num, label, isAr, dateTime } = useFmt();
  const q = findQuestion(report.questions, c.questionId);
  const where =
    c.provenance === "ai_follow_up" && c.followUpLabel ? `${t("voice.aiFollowUpShort")}: ${c.followUpLabel}` : q ? label(q) : "";
  return (
    <li className={`rounded-xl border border-border bg-card p-4 shadow-xs ${c.usable ? "" : "opacity-70"}`}>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-muted-foreground">{dateTime(c.submittedAt)}</span>
        <Chip>{t(`stage.${c.stage}`)}</Chip>
        <Chip>{t(`lang.${c.language}`)}</Chip>
        {c.insight && (
          <Chip>
            <span className={`size-2 rounded-full ${CATEGORY_DOT[c.insight.category]}`} aria-hidden />
            {t(`category.${c.insight.category}`)}
          </Chip>
        )}
        {!c.usable && <Chip>{t("voice.notUsable")}</Chip>}
        {c.provenance === "ai_follow_up_uncertain" && (
          <span title={t("voice.aiUncertainHelp")}>
            <Chip>
              <Info className="size-3" aria-hidden />
              {t("voice.aiUncertain")}
            </Chip>
          </span>
        )}
      </div>
      {where && <p className="mb-1 text-[11px] text-muted-foreground">{where}</p>}
      <p dir="auto" className="text-sm leading-relaxed text-foreground">
        {c.text}
      </p>
      {c.insight?.gist && /[\u0600-\u06FF]/.test(c.text) && !isAr && (
        <p className="mt-1 text-xs italic text-muted-foreground">{t("voice.gist", { gist: c.insight.gist })}</p>
      )}
      {c.insight && (c.insight.themes.length > 0 || c.insight.staff.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {c.insight.themes.map((th) => (
            <Chip key={th}>{t(`theme.${th}`)}</Chip>
          ))}
          {c.insight.staff.map((s) => (
            <Chip key={s} className="border-primary/30 text-primary">
              {s}
            </Chip>
          ))}
        </div>
      )}
      {c.overall !== null && (
        <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>{t("voice.surveyScore")}</span>
          <ScoreBadge score={c.overall} />
          {c.aiScore !== null && <span>{t("voice.sentiment", { score: num(Math.round(c.aiScore)) })}</span>}
        </div>
      )}
    </li>
  );
}

export function VoiceTab({ report, initialQuestionId, aiBusy, onClassify }: VoiceTabProps) {
  const { t, num, label } = useFmt();
  const o = report.overview.comments;
  const [stage, setStage] = React.useState<"all" | StageKey>("all");
  const [lang, setLang] = React.useState<"all" | Lang>("all");
  const [category, setCategory] = React.useState<"all" | CommentCategory>("all");
  const [questionId, setQuestionId] = React.useState<string>(initialQuestionId ?? "all");
  const [problemId, setProblemId] = React.useState<string>("all");
  const [showUnusable, setShowUnusable] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [limit, setLimit] = React.useState(PAGE);

  const textQuestions = report.questions.filter((q) => q.type === "text");
  const problemIds = [...new Set(report.comments.flatMap((c) => c.negativeOn))];
  const anyClassified = o.classified > 0;

  const filtered = report.comments.filter((c) => {
    if (!showUnusable && !c.usable) return false;
    if (stage !== "all" && c.stage !== stage) return false;
    if (lang !== "all" && c.language !== lang) return false;
    if (category !== "all" && c.insight?.category !== category) return false;
    if (questionId !== "all" && c.questionId !== questionId) return false;
    if (problemId !== "all" && !c.negativeOn.includes(problemId)) return false;
    if (search.trim()) {
      const hay = `${c.text} ${c.insight?.gist ?? ""}`.toLowerCase();
      if (!hay.includes(search.trim().toLowerCase())) return false;
    }
    return true;
  });

  if (o.total === 0) return <EmptyState title={t("voice.empty")} description={t("voice.emptyDesc")} />;

  return (
    <div className="space-y-4">
      {o.usable > o.classified && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-primary/30 bg-primary/5">
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">{t("voice.classifyTitle", { n: num(o.usable - o.classified) })}</p>
            <p className="text-xs text-muted-foreground">{t("voice.classifyDesc")}</p>
          </div>
          <Button type="button" onClick={onClassify} disabled={aiBusy} className="gap-1.5 text-xs font-semibold">
            {aiBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
            {t("voice.classifyButton")}
          </Button>
        </Card>
      )}

      {anyClassified && (
        <div className="grid gap-4 lg:grid-cols-2">
          {report.commentThemes.length > 0 && <Themes report={report} />}
          {report.staffMentions.length > 0 && (
            <Card>
              <SectionTitle title={t("voice.staffTitle")} subtitle={t("voice.staffSubtitle")} />
              <ul className="divide-y divide-border">
                {report.staffMentions.map((s) => (
                  <li key={s.name} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="font-medium text-foreground">{s.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {t("voice.staffCount", { count: num(s.count), countRaw: s.count, positive: num(s.positive), negative: num(s.negative) })}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select aria-label={t("voice.filterStage")} className={selectClass} value={stage} onChange={(e) => { setStage(e.target.value as typeof stage); setLimit(PAGE); }}>
          <option value="all">{t("stage.all")}</option>
          <option value="drop_off">{t("stage.drop_off")}</option>
          <option value="pick_up">{t("stage.pick_up")}</option>
        </select>
        <select aria-label={t("voice.filterLanguage")} className={selectClass} value={lang} onChange={(e) => { setLang(e.target.value as typeof lang); setLimit(PAGE); }}>
          <option value="all">{t("voice.allLanguages")}</option>
          <option value="ar">{t("lang.ar")}</option>
          <option value="en">{t("lang.en")}</option>
        </select>
        {anyClassified && (
          <select aria-label={t("voice.filterCategory")} className={selectClass} value={category} onChange={(e) => { setCategory(e.target.value as typeof category); setLimit(PAGE); }}>
            <option value="all">{t("voice.allCategories")}</option>
            {COMMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`category.${c}`)}
              </option>
            ))}
          </select>
        )}
        <select aria-label={t("voice.filterQuestion")} className={`${selectClass} max-w-56`} value={questionId} onChange={(e) => { setQuestionId(e.target.value); setLimit(PAGE); }}>
          <option value="all">{t("voice.allQuestions")}</option>
          {textQuestions.map((q) => (
            <option key={q.id} value={q.id}>
              {label(q)}
            </option>
          ))}
        </select>
        {problemIds.length > 0 && (
          <select aria-label={t("voice.filterProblem")} className={`${selectClass} max-w-56`} value={problemId} onChange={(e) => { setProblemId(e.target.value); setLimit(PAGE); }}>
            <option value="all">{t("voice.anyProblem")}</option>
            {problemIds.map((id) => {
              const q = findQuestion(report.questions, id);
              return q ? (
                <option key={id} value={id}>
                  {t("voice.problemOn", { question: label(q) })}
                </option>
              ) : null;
            })}
          </select>
        )}
        <input
          type="search"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setLimit(PAGE); }}
          placeholder={t("voice.search")}
          aria-label={t("voice.search")}
          className="min-w-40 flex-1 rounded-lg border border-input bg-card px-3 py-1.5 text-xs focus:outline-hidden focus:ring-2 focus:ring-ring/30"
        />
        <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={showUnusable} onChange={(e) => { setShowUnusable(e.target.checked); setLimit(PAGE); }} />
          {t("voice.showUnusable")}
        </label>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("voice.count", { shown: num(Math.min(limit, filtered.length)), total: num(filtered.length) })}
        {report.overview.comments.total > report.comments.length ? ` · ${t("voice.capped", { n: num(report.comments.length) })}` : ""}
      </p>

      {filtered.length === 0 ? (
        <EmptyState title={t("voice.noMatch")} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {filtered.slice(0, limit).map((c) => (
            <CommentCard key={`${c.responseId}:${c.questionId}`} c={c} report={report} />
          ))}
        </ul>
      )}
      {filtered.length > limit && (
        <div className="text-center">
          <Button type="button" variant="outline" size="sm" onClick={() => setLimit((l) => l + PAGE)} className="text-xs">
            {t("voice.showMore")}
          </Button>
        </div>
      )}
    </div>
  );
}
