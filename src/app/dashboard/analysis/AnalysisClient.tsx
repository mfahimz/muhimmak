"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, MessageCircleQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateRangeFilter, type PresetType } from "@/components/dashboard/DateRangeFilter";
import { useAiChat } from "@/components/dashboard/ai-chat/useAiChat";
import { toArabicNumerals } from "@/lib/utils/arabic-numerals";
import type { AnalyticsReport, InsightsResult, Stage } from "@/lib/analytics/types";
import { AnalysisChatSheet } from "./_components/AnalysisChatSheet";
import { DataNotes } from "./_components/DataNotes";
import { DriversTab } from "./_components/DriversTab";
import { FindingsList } from "./_components/FindingsList";
import { FollowUpTab } from "./_components/FollowUpTab";
import { InsightsPanel, type AiRunState } from "./_components/InsightsPanel";
import { KpiTiles } from "./_components/KpiTiles";
import { QuestionsTab } from "./_components/QuestionsTab";
import { EmptyState } from "./_components/primitives";
import { TrendsTab } from "./_components/TrendsTab";
import { VoiceTab } from "./_components/VoiceTab";
import { findQuestion } from "./_components/format";

interface Filters {
  startDate: string;
  endDate: string;
  visitStage: Stage | "all";
}

export type TabKey = "questions" | "drivers" | "trends" | "voice" | "followUp";
const TABS: TabKey[] = ["questions", "drivers", "trends", "voice", "followUp"];

interface AnalysisClientProps {
  initialReport: AnalyticsReport;
  initialFilters: Filters;
  aiConfigured: boolean;
  /** Lets a link such as /dashboard/analysis?tab=voice open a specific tab. */
  initialTab?: TabKey;
}
const MAX_CLASSIFY_ROUNDS = 4;

const noopSubscribe = () => () => {};

function sameFilters(a: Filters, b: Filters): boolean {
  return a.startDate === b.startDate && a.endDate === b.endDate && a.visitStage === b.visitStage;
}

function storageKey(f: Filters, locale: string): string {
  return `analysis-insights:v1:${f.startDate}|${f.endDate}|${f.visitStage}|${locale}`;
}

function readInsights(key: string): InsightsResult | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as InsightsResult) : null;
  } catch {
    return null;
  }
}

function writeInsights(key: string, value: InsightsResult) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable: the report simply is not remembered
  }
}

async function postJson<T>(url: string, body: unknown, errors: { generic: string; rateLimited: string }): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  // Server messages are English only, so the viewer gets a localized one instead.
  if (!res.ok) throw new Error(res.status === 429 ? errors.rateLimited : errors.generic);
  return json as T;
}

export function AnalysisClient({ initialReport, initialFilters, aiConfigured, initialTab = "questions" }: AnalysisClientProps) {
  const t = useTranslations("Analysis");
  const locale = useLocale();
  const isAr = locale === "ar";

  const [report, setReport] = React.useState<AnalyticsReport>(initialReport);
  const [filters, setFilters] = React.useState<Filters>(initialFilters);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<TabKey>(initialTab);
  const [voice, setVoice] = React.useState<{ key: number; questionId: string | null }>({ key: 0, questionId: null });

  // AI report: remembered per browser tab (sessionStorage), never read during server render.
  const isClient = React.useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [insightsOverride, setInsightsOverride] = React.useState<{ key: string; value: InsightsResult } | undefined>(undefined);
  const insightsKey = storageKey(filters, locale);
  // A result that finishes after the filters changed belongs to its own key and is ignored for the new one.
  const insights =
    insightsOverride && insightsOverride.key === insightsKey ? insightsOverride.value : isClient ? readInsights(insightsKey) : null;
  const [aiState, setAiState] = React.useState<AiRunState>("idle");
  const [aiError, setAiError] = React.useState<string | null>(null);
  const [classifying, setClassifying] = React.useState(false);
  const aiRunning = React.useRef(false);

  const [chatOpen, setChatOpen] = React.useState(false);
  const [focusId, setFocusId] = React.useState<string | null>(null);
  const filtersRef = React.useRef(filters);
  const focusRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    filtersRef.current = filters;
  });

  const chat = useAiChat({
    endpoint: "/api/v1/analysis/chat",
    getBody: () => ({ ...filtersRef.current, locale, questionId: focusRef.current }),
    genericError: t("chat.error"),
    rateLimitError: t("chat.rateLimited"),
  });

  const fetchSeq = React.useRef(0);
  const load = React.useCallback(
    async (next: Filters) => {
      const seq = ++fetchSeq.current;
      setLoading(true);
      setLoadError(null);
      try {
        const params = new URLSearchParams({ startDate: next.startDate, endDate: next.endDate });
        if (next.visitStage !== "all") params.set("visitStage", next.visitStage);
        const res = await fetch(`/api/v1/analysis?${params.toString()}`);
        if (!res.ok) throw new Error("load failed");
        const json = (await res.json()) as AnalyticsReport;
        if (seq === fetchSeq.current) setReport(json);
      } catch {
        if (seq === fetchSeq.current) setLoadError(t("loadError"));
      } finally {
        if (seq === fetchSeq.current) setLoading(false);
      }
    },
    [t]
  );

  const applyFilters = (next: Filters) => {
    setFilters(next);
    setInsightsOverride(undefined);
    setAiState("idle");
    setAiError(null);
    chat.reset();
    void load(next);
  };

  const handleDateChange = (range: { startDate: string; endDate: string; preset: PresetType }) =>
    applyFilters({ ...filters, startDate: range.startDate, endDate: range.endDate });

  const aiErrors = { generic: t("ai.error"), rateLimited: t("ai.rateLimited") };

  /** Classifies every unclassified comment (each is classified once, then stored). */
  const classifyAll = async (body: unknown) => {
    for (let round = 0; round < MAX_CLASSIFY_ROUNDS; round++) {
      const r = await postJson<{ annotated: number; remaining: number }>("/api/v1/analysis/annotate", body, aiErrors);
      if (r.annotated === 0 || r.remaining === 0) break;
    }
  };

  /** Classify, then write the AI report. */
  const runAi = async () => {
    if (aiRunning.current) return;
    aiRunning.current = true;
    setAiError(null);
    setAiState("classifying");
    const body = { ...filters, locale };
    const runFilters = filters;
    const runKey = insightsKey;
    // The viewer may change the filters while the AI works; a late result must not overwrite the new view.
    const stillCurrent = () => sameFilters(filtersRef.current, runFilters);
    try {
      await classifyAll(body);
      setAiState("writing");
      const result = await postJson<InsightsResult>("/api/v1/analysis/insights", body, aiErrors);
      setInsightsOverride({ key: runKey, value: result });
      writeInsights(runKey, result);
      setAiState("idle");
      if (stillCurrent()) {
        await load(runFilters);
        toast.success(t("ai.done"));
      }
    } catch (err: unknown) {
      if (stillCurrent()) {
        setAiState("error");
        setAiError((err as Error).message || t("ai.error"));
        void load(runFilters); // some comments may have been classified before the failure
      }
    } finally {
      aiRunning.current = false;
    }
  };

  /** Classify comments only (no report), for the button on the Customer voice tab. */
  const runClassify = async () => {
    if (aiRunning.current) return;
    aiRunning.current = true;
    setClassifying(true);
    const runFilters = filters;
    try {
      await classifyAll({ ...runFilters, locale });
      if (sameFilters(filtersRef.current, runFilters)) {
        await load(runFilters);
        toast.success(t("voice.classified"));
      }
    } catch (err: unknown) {
      toast.error((err as Error).message || t("ai.error"));
      if (sameFilters(filtersRef.current, runFilters)) void load(runFilters);
    } finally {
      setClassifying(false);
      aiRunning.current = false;
    }
  };

  const ask = (prompt: string, questionId: string | null) => {
    focusRef.current = questionId;
    setFocusId(questionId);
    setChatOpen(true);
    void chat.send(prompt);
  };

  const clearFocus = () => {
    focusRef.current = null;
    setFocusId(null);
  };

  const openVoice = (questionId: string | null) => {
    setVoice((v) => ({ key: v.key + 1, questionId }));
    setTab("voice");
  };

  const focusQuestion = findQuestion(report.questions, focusId ?? undefined);
  const focusLabel = focusQuestion ? (isAr && focusQuestion.labelAr ? focusQuestion.labelAr : focusQuestion.labelEn) : null;
  const aiDisabled = !aiConfigured || report.overview.surveys === 0 || classifying;

  const stageOptions: Array<Stage | "all"> = ["all", "drop_off", "pick_up"];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <DateRangeFilter initialPreset="90d" initialStartDate={initialFilters.startDate} initialEndDate={initialFilters.endDate} onChange={handleDateChange} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-lg border border-border bg-muted p-0.5 text-xs font-medium" role="group" aria-label={t("stage.label")}>
              {stageOptions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => s !== filters.visitStage && applyFilters({ ...filters, visitStage: s })}
                  aria-pressed={filters.visitStage === s}
                  className={`rounded-md px-3 py-1.5 transition-all ${
                    filters.visitStage === s ? "bg-card font-semibold text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t(`stage.${s}`)}
                </button>
              ))}
            </div>
            {loading && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                {t("loading")}
              </span>
            )}
          </div>
          <Button type="button" onClick={() => { focusRef.current = null; setFocusId(null); setChatOpen(true); }} disabled={!aiConfigured} className="gap-1.5 text-xs font-semibold">
            <MessageCircleQuestion className="size-4" aria-hidden />
            {t("askAi")}
          </Button>
        </div>
        {loadError && (
          <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {loadError}
          </p>
        )}
      </div>

      {/* Held at reduced opacity while refetching so the layout never jumps. */}
      <div className={`flex flex-col gap-6 transition-opacity ${loading ? "pointer-events-none opacity-60" : ""}`} aria-busy={loading}>
        {report.overview.surveys === 0 ? (
          <EmptyState title={t("noData")} description={t("noDataDesc")} />
        ) : (
          <>
            <KpiTiles report={report} />
            <FindingsList report={report} onAsk={ask} />
            <InsightsPanel report={report} state={aiState} result={insights} error={aiError} disabled={aiDisabled} onGenerate={runAi} />

            <div>
              <div role="tablist" aria-label={t("title")} className="flex gap-1 overflow-x-auto border-b border-border">
                {TABS.map((k) => (
                  <button
                    key={k}
                    role="tab"
                    id={`tab-${k}`}
                    aria-selected={tab === k}
                    aria-controls={`panel-${k}`}
                    type="button"
                    onClick={() => setTab(k)}
                    className={`shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                      tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t(`tabs.${k}`)}
                    {k === "followUp" && report.followUps.total > 0 && (
                      <span className="ms-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-foreground">
                        {toArabicNumerals(report.followUps.total, locale)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="pt-4">
                {tab === "questions" && <QuestionsTab report={report} onAsk={ask} onOpenVoice={openVoice} />}
                {tab === "drivers" && <DriversTab report={report} />}
                {tab === "trends" && <TrendsTab report={report} />}
                {tab === "voice" && (
                  <VoiceTab key={voice.key} report={report} initialQuestionId={voice.questionId} aiBusy={classifying || aiState === "classifying" || aiState === "writing"} onClassify={runClassify} />
                )}
                {tab === "followUp" && <FollowUpTab report={report} />}
              </div>
            </div>

            <DataNotes report={report} />
          </>
        )}
      </div>

      <AnalysisChatSheet
        open={chatOpen}
        onOpenChange={setChatOpen}
        chat={chat}
        focusLabel={focusLabel}
        onClearFocus={clearFocus}
        disabled={!aiConfigured}
      />
    </div>
  );
}
