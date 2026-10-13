"use client";

import * as React from "react";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import {
  Download,
  RefreshCw,
  Search,
  Sparkles,
  Car,
  MessageSquare,
  HelpCircle,
  TrendingUp,
  BarChart3,
  Layers,
  Eye,
  X,
  FileSpreadsheet,
  Globe,
} from "lucide-react";
import type { LiveResponsesData, EnrichedResponse } from "@/server/services/responses.service";
import { toArabicNumerals } from "@/lib/utils/arabic-numerals";
import { DateRangeFilter, type PresetType } from "@/components/dashboard/DateRangeFilter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QuestionAiChat } from "./QuestionAiChat";

interface ResponsesClientProps {
  initialData: LiveResponsesData;
  initialStartDate: string;
  initialEndDate: string;
}

// star_rating answers run 1 to 5, every other averaged type (numeric_scale) 1 to 10.
const ratingScaleMax = (type: string) => (type === "star_rating" ? 5 : 10);

export function ResponsesClient({
  initialData,
  initialStartDate,
  initialEndDate,
}: ResponsesClientProps) {
  const t = useTranslations("Responses");
  const locale = useLocale();

  const [data, setData] = React.useState<LiveResponsesData>(initialData);
  const [startDate, setStartDate] = React.useState<string>(initialStartDate);
  const [endDate, setEndDate] = React.useState<string>(initialEndDate);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [aiScoringLoading, setAiScoringLoading] = React.useState<boolean>(false);
  const [exporting, setExporting] = React.useState<boolean>(false);

  // Filters & Tabs
  const [activeTab, setActiveTab] = React.useState<"questions" | "matrix" | "feedback" | "stats">("questions");
  const [selectedStage, setSelectedStage] = React.useState<"all" | "drop_off" | "pick_up">("all");
  const [searchTerm, setSearchTerm] = React.useState<string>("");
  const [selectedQuestionId, setSelectedQuestionId] = React.useState<string>(
    initialData.questions.length > 0 ? initialData.questions[0].id : ""
  );
  const [inspectSession, setInspectSession] = React.useState<EnrichedResponse | null>(null);

  const activeQuestionId = selectedQuestionId || (data.questions.length > 0 ? data.questions[0].id : "");

  const fetchData = async (sDate: string, eDate: string, stage: string = selectedStage) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (sDate) params.set("startDate", sDate);
      if (eDate) params.set("endDate", eDate);
      if (stage && stage !== "all") params.set("visitStage", stage);
      if (searchTerm) params.set("search", searchTerm);

      const res = await fetch(`/api/v1/responses?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load data");
      const json: LiveResponsesData = await res.json();
      setData(json);
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to refresh responses");
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (range: { startDate: string; endDate: string; preset: PresetType }) => {
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    fetchData(range.startDate, range.endDate, selectedStage);
  };

  const handleStageChange = (stage: "all" | "drop_off" | "pick_up") => {
    setSelectedStage(stage);
    fetchData(startDate, endDate, stage);
  };

  const handleRunAiScoring = async () => {
    setAiScoringLoading(true);
    toast.info(t("aiScoringRunning"));
    try {
      const res = await fetch("/api/v1/responses/ai-score", { method: "POST" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to run AI scoring");

      toast.success(
        `${t("aiScoringSuccess")} (${result.scoredFeedbackCount} feedback items scored, ${result.generatedSummaryCount} session summaries generated)`
      );
      // Immediately refresh data
      await fetchData(startDate, endDate, selectedStage);
    } catch (err: unknown) {
      toast.error((err as Error).message || "Error running AI scoring");
    } finally {
      setAiScoringLoading(false);
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/v1/responses/export");
      if (!res.ok) throw new Error("Failed to export Excel file");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `supabase_survey_responses_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Excel sheet downloaded successfully!");
    } catch (err: unknown) {
      toast.error((err as Error).message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  // Filtered responses based on search term
  const filteredResponses = React.useMemo(() => {
    if (!searchTerm.trim()) return data.responses;
    const term = searchTerm.toLowerCase();
    return data.responses.filter((r) => {
      const plate = (r.plateNumber || "").toLowerCase();
      const mobile = (r.mobileNumber || "").toLowerCase();
      const answersText = Object.values(r.answers).join(" ").toLowerCase();
      return plate.includes(term) || mobile.includes(term) || answersText.includes(term);
    });
  }, [data.responses, searchTerm]);

  // Selected question details
  const currentQuestion = React.useMemo(() => {
    return data.questions.find((q) => q.id === activeQuestionId) || data.questions[0];
  }, [data.questions, activeQuestionId]);

  const currentQuestionStats = React.useMemo(() => {
    return data.questionStats.find((qs) => qs.id === activeQuestionId);
  }, [data.questionStats, activeQuestionId]);

  // Answers specifically for the current question
  const currentQuestionAnswers = React.useMemo(() => {
    if (!currentQuestion) return [];
    return filteredResponses
      .filter((r) => r.answers[currentQuestion.id] !== undefined && r.answers[currentQuestion.id] !== null && r.answers[currentQuestion.id] !== "")
      .map((r) => ({
        response: r,
        answer: r.answers[currentQuestion.id],
        score: r.perQuestionScores[currentQuestion.id],
      }));
  }, [filteredResponses, currentQuestion]);


  return (
    <div className="flex flex-col gap-6">
      {/* TOP CONTROLS & EXPORT BAR */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <DateRangeFilter onChange={handleDateChange} initialPreset="30d" />

          {/* Stage Filter */}
          <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-0.5 text-xs font-medium">
            <button
              onClick={() => handleStageChange("all")}
              className={`px-3 py-1.5 rounded-md transition-all ${
                selectedStage === "all"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              {t("allStages")}
            </button>
            <button
              onClick={() => handleStageChange("drop_off")}
              className={`px-3 py-1.5 rounded-md transition-all ${
                selectedStage === "drop_off"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              {t("dropOff")}
            </button>
            <button
              onClick={() => handleStageChange("pick_up")}
              className={`px-3 py-1.5 rounded-md transition-all ${
                selectedStage === "pick_up"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              {t("pickUp")}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search box */}
          <div className="relative min-w-[220px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={t("searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-9 pr-3 py-1.5 text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(startDate, endDate, selectedStage)}
            disabled={loading}
            className="gap-1.5 text-xs font-medium"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {t("refresh")}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRunAiScoring}
            disabled={aiScoringLoading || !data.deepseekConfigured}
            title={t("textScoringStatus")}
            className="gap-1.5 text-xs font-medium"
          >
            <Sparkles className={`h-3.5 w-3.5 ${aiScoringLoading ? "animate-spin" : ""}`} />
            {aiScoringLoading ? t("aiScoringRunning") : t("runAiScoring")}
          </Button>

          <Button
            size="sm"
            onClick={handleExportExcel}
            disabled={exporting}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-xs"
          >
            <Download className="h-3.5 w-3.5" />
            {exporting ? t("exporting") : t("exportExcel")}
          </Button>
        </div>
      </div>

      {/* OVERVIEW STATS ROW */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{t("totalResponses")}</span>
            <FileSpreadsheet className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {toArabicNumerals(data.overview.totalResponses, locale)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {toArabicNumerals(data.overview.totalSessions, locale)} sessions recorded
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{t("overallSatisfaction")}</span>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {data.overview.averageScore !== null ? `${toArabicNumerals(data.overview.averageScore, locale)}%` : "N/A"}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Drop-off: {data.overview.dropOffAverageScore ?? "N/A"}% | Pick-up: {data.overview.pickUpAverageScore ?? "N/A"}%
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{t("textComments")}</span>
            <MessageSquare className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {toArabicNumerals(data.aiStatus.totalTextFeedback, locale)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {data.aiStatus.scoredTextFeedback} AI evaluated & scored
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{t("googleReviews")}</span>
            <Globe className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {toArabicNumerals(data.overview.googleReviewClickCount, locale)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Review invites clicked by satisfied users
          </div>
        </div>
      </div>

      {/* VIEW TABS SWITCHER */}
      <div className="flex items-center border-b border-slate-200 dark:border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab("questions")}
          className={`pb-3 text-sm font-semibold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === "questions"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
          }`}
        >
          <HelpCircle className="h-4 w-4" />
          {t("tabQuestions")}
        </button>

        <button
          onClick={() => setActiveTab("matrix")}
          className={`pb-3 text-sm font-semibold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === "matrix"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
          }`}
        >
          <Layers className="h-4 w-4" />
          {t("tabMatrix")}
        </button>

        <button
          onClick={() => setActiveTab("feedback")}
          className={`pb-3 text-sm font-semibold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === "feedback"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          {t("tabFeedback")}
        </button>

        <button
          onClick={() => setActiveTab("stats")}
          className={`pb-3 text-sm font-semibold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === "stats"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          {t("tabStats")}
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: RESPONSES BY QUESTION */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "questions" && (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Question Selector List (Left Column) */}
          <div className="w-full lg:w-80 shrink-0 flex flex-col gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-xs max-h-[800px] overflow-y-auto">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
              {t("allQuestions")} ({data.questions.length})
            </span>
            {data.questions.map((q) => {
              const stat = data.questionStats.find((s) => s.id === q.id);
              const isSelected = q.id === activeQuestionId;

              return (
                <button
                  key={q.id}
                  onClick={() => setSelectedQuestionId(q.id)}
                  className={`text-start p-3 rounded-lg border transition-all ${
                    isSelected
                      ? "border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 text-slate-900 dark:text-white shadow-xs"
                      : "border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-semibold mb-1 text-slate-400">
                    <span className="capitalize">{q.visitStage.replace("_", " ")}</span>
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                      {q.type.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="text-xs font-semibold line-clamp-2 leading-snug">
                    {q.labelEn}
                  </div>
                  <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
                    <span>{stat?.totalAnswers || 0} answers</span>
                    {stat && stat.averageRating !== null && (
                      <span className="font-bold text-emerald-600">
                        {toArabicNumerals(t("ratingOutOf", { value: stat.averageRating, max: ratingScaleMax(q.type) }), locale)}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Question Detail & Individual Answers Table (Right Column) */}
          <div className="flex-1 flex flex-col gap-4">
            {currentQuestion ? (
              <>
                {/* Active Question Header Card */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Badge className="bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-semibold text-[11px]">
                      {currentQuestion.visitStage.replace("_", " ").toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className="text-[11px] capitalize font-medium">
                      {currentQuestion.roleTag.replace("_", " ")}
                    </Badge>
                    <Badge variant="secondary" className="text-[11px] capitalize">
                      {currentQuestion.type.replace("_", " ")}
                    </Badge>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
                    {currentQuestion.labelEn}
                  </h3>
                  {currentQuestion.labelAr && (
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1 font-arabic" dir="rtl">
                      {currentQuestion.labelAr}
                    </p>
                  )}

                  {/* Summary Metric Strip for This Question */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="text-[11px] text-slate-400 uppercase font-semibold">{t("answersReceived")}</span>
                      <div className="text-lg font-bold text-slate-900 dark:text-white">
                        {currentQuestionStats?.totalAnswers || 0}
                      </div>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 uppercase font-semibold">{t("responseRate")}</span>
                      <div className="text-lg font-bold text-slate-900 dark:text-white">
                        {currentQuestionStats?.responseRate || 0}%
                      </div>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 uppercase font-semibold">{t("avgScore")}</span>
                      <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                        {currentQuestionStats && currentQuestionStats.averageRating !== null
                          ? toArabicNumerals(
                              t("ratingOutOf", {
                                value: currentQuestionStats.averageRating,
                                max: ratingScaleMax(currentQuestion.type),
                              }),
                              locale
                            )
                          : currentQuestionStats && currentQuestionStats.averageNormalizedScore !== null
                          ? `${currentQuestionStats.averageNormalizedScore}%`
                          : "N/A"}
                      </div>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 uppercase font-semibold">Weight</span>
                      <div className="text-lg font-bold text-slate-900 dark:text-white">
                        {currentQuestion.weight}%
                      </div>
                    </div>
                  </div>

                  {/* Multiple-choice option breakdown pills if applicable */}
                  {currentQuestion.type === "multiple_choice" && currentQuestionStats?.choiceDistribution && (
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-semibold text-slate-500 block mb-2">
                        Response Distribution:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {currentQuestionStats.choiceDistribution.map((opt, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                          >
                            <span className="font-medium text-slate-800 dark:text-slate-200">{opt.label}</span>
                            <Badge className="bg-indigo-600 text-white text-[10px] px-1.5 py-0 font-bold">
                              {opt.count} ({opt.percentage}%)
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* AI chat that interprets this question's results */}
                <QuestionAiChat
                  key={`${currentQuestion.id}|${startDate}|${endDate}|${selectedStage}`}
                  questionId={currentQuestion.id}
                  startDate={startDate}
                  endDate={endDate}
                  visitStage={selectedStage}
                  disabled={!data.deepseekConfigured}
                />

                {/* Table of Individual Customer Responses to this Question */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
                  <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Recorded Responses ({currentQuestionAnswers.length})
                    </h4>
                  </div>

                  {currentQuestionAnswers.length === 0 ? (
                    <div className="p-12 text-center text-sm text-slate-400">
                      {t("noResponsesFound")}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-start">
                        <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="py-2.5 px-3 font-semibold text-start">{t("plateNumber")}</th>
                            <th className="py-2.5 px-3 font-semibold text-start">{t("dateTime")}</th>
                            <th className="py-2.5 px-3 font-semibold text-start">Language</th>
                            <th className="py-2.5 px-3 font-semibold text-start">{t("answer")}</th>
                            <th className="py-2.5 px-3 font-semibold text-center">Score</th>
                            <th className="py-2.5 px-3 font-semibold text-center">{t("overallSatisfaction")}</th>
                            <th className="py-2.5 px-3 font-semibold text-end">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {currentQuestionAnswers.map(({ response, answer, score }) => (
                            <tr
                              key={response.responseId}
                              className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                            >
                              <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                                <span className="inline-flex items-center gap-1.5 font-mono font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                                  <Car className="h-3 w-3 text-slate-400" />
                                  {response.plateNumber || "N/A"}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                                {response.submittedAt ? response.submittedAt.slice(0, 16).replace("T", " ") : "N/A"}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-slate-600 uppercase">
                                {response.language}
                              </td>
                              <td className="py-2.5 px-3 text-slate-900 dark:text-slate-100 font-medium max-w-md">
                                {String(answer)}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {score !== undefined ? (
                                  <Badge
                                    className={
                                      score >= 80
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : score >= 50
                                        ? "bg-amber-50 text-amber-700 border-amber-200"
                                        : "bg-rose-50 text-rose-700 border-rose-200"
                                    }
                                  >
                                    {score}%
                                  </Badge>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {response.overallScore !== null ? (
                                  <span className="font-bold text-slate-800 dark:text-slate-200">
                                    {response.overallScore}%
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setInspectSession(response)}
                                  className="h-7 px-2 text-[11px] gap-1"
                                >
                                  <Eye className="h-3 w-3" />
                                  {t("viewDetails")}
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="p-12 text-center text-slate-400 rounded-xl border border-dashed">
                {t("selectQuestion")}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: ALL SUBMISSIONS TABLE (MATRIX VIEW) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "matrix" && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              All Survey Submissions ({filteredResponses.length})
            </h4>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3 font-semibold text-start">{t("dateTime")}</th>
                  <th className="py-2.5 px-3 font-semibold text-start">{t("plateNumber")}</th>
                  <th className="py-2.5 px-3 font-semibold text-start">{t("mobileNumber")}</th>
                  <th className="py-2.5 px-3 font-semibold text-start">{t("stage")}</th>
                  <th className="py-2.5 px-3 font-semibold text-start">Channel</th>
                  <th className="py-2.5 px-3 font-semibold text-center">{t("overallSatisfaction")}</th>
                  <th className="py-2.5 px-3 font-semibold text-start">{t("aiSummary")}</th>
                  <th className="py-2.5 px-3 font-semibold text-end">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredResponses.map((r) => (
                  <tr
                    key={r.responseId}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                      {r.submittedAt ? r.submittedAt.slice(0, 16).replace("T", " ") : "N/A"}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 font-mono font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                        <Car className="h-3 w-3 text-slate-400" />
                        {r.plateNumber || "N/A"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 font-mono whitespace-nowrap">
                      {r.mobileNumber || "—"}
                    </td>
                    <td className="py-2.5 px-3 capitalize">
                      <Badge variant="outline" className="text-[10px] py-0">
                        {r.visitStage.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                      {r.channel}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {r.overallScore !== null ? (
                        <Badge
                          className={
                            r.overallScore >= 80
                              ? "bg-emerald-600 text-white font-bold"
                              : r.overallScore >= 50
                              ? "bg-amber-600 text-white font-bold"
                              : "bg-rose-600 text-white font-bold"
                          }
                        >
                          {r.overallScore}%
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 max-w-sm truncate">
                      {r.aiAnalysisSummary || (
                        <span className="text-slate-400 italic">{t("noSummary")}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setInspectSession(r)}
                        className="h-7 px-2 text-[11px] gap-1"
                      >
                        <Eye className="h-3 w-3" />
                        {t("viewDetails")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: VERBATIM CUSTOMER FEEDBACK & SENTIMENT */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "feedback" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Customer Qualitative Comments ({data.textFeedback.length})
            </h4>
            <span className="text-xs text-slate-500">
              Evaluated for sentiment and improvement insights via DeepSeek AI
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.textFeedback.map((fb, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center gap-1.5 font-mono font-bold text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-slate-900 dark:text-white">
                      <Car className="h-3 w-3 text-slate-400" />
                      {fb.plateNumber || "N/A"}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">
                        {fb.submittedAt ? fb.submittedAt.slice(0, 16).replace("T", " ") : ""}
                      </span>
                      {fb.aiScore !== null ? (
                        <Badge
                          className={
                            fb.aiScore >= 80
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : fb.aiScore >= 50
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          }
                        >
                          AI Sentiment: {fb.aiScore}%
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600 border-amber-300">
                          {t("unscored")}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Q: {fb.questionLabelEn}
                  </div>

                  <blockquote className="text-sm text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border-l-3 border-indigo-500 font-medium italic leading-relaxed">
                    &ldquo;{fb.customerComment}&rdquo;
                  </blockquote>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                  <span className="capitalize">Stage: {fb.visitStage.replace("_", " ")}</span>
                  {fb.mobileNumber && <span>Phone: {fb.mobileNumber}</span>}
                  {fb.overallScore !== null && (
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Survey Score: {fb.overallScore}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 4: QUESTION BREAKDOWN & STATS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "stats" && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Question Summary & Metrics Matrix ({data.questionStats.length} Questions)
            </h4>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3 font-semibold text-start">{t("stage")}</th>
                  <th className="py-2.5 px-3 font-semibold text-start">{t("role")}</th>
                  <th className="py-2.5 px-3 font-semibold text-start">{t("question")}</th>
                  <th className="py-2.5 px-3 font-semibold text-start">Type</th>
                  <th className="py-2.5 px-3 font-semibold text-center">{t("answersReceived")}</th>
                  <th className="py-2.5 px-3 font-semibold text-center">{t("responseRate")}</th>
                  <th className="py-2.5 px-3 font-semibold text-center">{t("avgScore")}</th>
                  <th className="py-2.5 px-3 font-semibold text-start">Distribution / Common Answers</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.questionStats.map((qs) => (
                  <tr
                    key={qs.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-2.5 px-3 font-medium capitalize text-slate-700 dark:text-slate-300">
                      <Badge variant="outline" className="text-[10px] py-0">
                        {qs.visitStage.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 font-medium capitalize text-slate-600">
                      {qs.roleTag.replace("_", " ")}
                    </td>
                    <td className="py-2.5 px-3 text-slate-900 dark:text-white font-medium max-w-sm">
                      {qs.labelEn}
                    </td>
                    <td className="py-2.5 px-3 capitalize text-slate-500">
                      {qs.type.replace("_", " ")}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-900 dark:text-white">
                      {qs.totalAnswers}
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-600">
                      {qs.responseRate}%
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-emerald-600">
                      {qs.averageRating !== null
                        ? toArabicNumerals(t("ratingOutOf", { value: qs.averageRating, max: ratingScaleMax(qs.type) }), locale)
                        : qs.averageNormalizedScore !== null
                        ? `${qs.averageNormalizedScore}%`
                        : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-md">
                      {qs.type === "multiple_choice" && qs.choiceDistribution.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {qs.choiceDistribution.slice(0, 3).map((c, i) => (
                            <span
                              key={i}
                              className="inline-block bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px]"
                            >
                              {c.label}: {c.percentage}%
                            </span>
                          ))}
                        </div>
                      ) : qs.type === "text" ? (
                        <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                          {qs.textCount} text comments
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* INSPECT SESSION MODAL DIALOG */}
      {inspectSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 font-mono font-bold text-sm bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-md text-slate-900 dark:text-white">
                  <Car className="h-4 w-4 text-slate-400" />
                  {inspectSession.plateNumber || "N/A"}
                </span>
                <Badge variant="outline" className="capitalize text-xs">
                  {inspectSession.visitStage.replace("_", " ")}
                </Badge>
                {inspectSession.overallScore !== null && (
                  <Badge className="bg-indigo-600 text-white font-bold text-xs">
                    Score: {inspectSession.overallScore}%
                  </Badge>
                )}
              </div>
              <button
                onClick={() => setInspectSession(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              {inspectSession.aiAnalysisSummary && (
                <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
                  <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider block mb-1">
                    AI Feedback Summary
                  </span>
                  <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                    {inspectSession.aiAnalysisSummary}
                  </p>
                </div>
              )}

              <div>
                <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Answers to Survey Questions
                </h5>
                <div className="space-y-3">
                  {data.questions
                    .filter((q) => inspectSession.answers[q.id] !== undefined)
                    .map((q) => (
                      <div
                        key={q.id}
                        className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-xs"
                      >
                        <div className="text-slate-500 font-semibold mb-1">{q.labelEn}</div>
                        <div className="text-slate-900 dark:text-white font-medium text-sm">
                          {String(inspectSession.answers[q.id])}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <Button onClick={() => setInspectSession(null)} size="sm">
                {t("close")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

