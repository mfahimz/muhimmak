"use client";

import React from "react";
import { useTranslations, useLocale } from "next-intl";
import { toArabicNumerals } from "@/lib/utils/arabic-numerals";
import {
  AwardIcon,
  CheckCircle2Icon,
  FlameIcon,
  MessageSquareHeartIcon,
  SparklesIcon,
  StarIcon,
  TargetIcon,
  TrendingUpIcon,
  ActivityIcon,
} from "lucide-react";
import { ReceptionistImpactData } from "@/server/services/sessions.service";

interface ReceptionistImpactCardProps {
  data: ReceptionistImpactData;
  staffName: string;
}

export default function ReceptionistImpactCard({
  data,
  staffName,
}: ReceptionistImpactCardProps) {
  const t = useTranslations("Impact");
  const locale = useLocale();

  const {
    totalSessions,
    milestones,
    stats90Days,
    recognitionFeed,
    weeklyRecap,
  } = data;

  const formattedAvgScore =
    stats90Days.avgScore !== null ? `${stats90Days.avgScore}%` : "—";
  const formattedWeeklyAvgScore =
    weeklyRecap.avgScore !== null ? `${weeklyRecap.avgScore}%` : "—";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome & Impact Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-indigo-100 dark:border-indigo-900/40 bg-linear-to-br from-indigo-50/60 via-card to-card p-6 shadow-xs">
        <div className="absolute top-0 end-0 -me-16 -mt-16 size-48 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 px-3 py-1 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                <SparklesIcon className="size-3.5 text-indigo-500 animate-pulse" />
                {t("impactBadge")}
              </span>
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
              {t("impactOverviewTitle", { name: staffName })}
            </h2>
            <p className="text-sm text-muted-foreground max-w-xl">
              {t("impactOverviewSubtitle")}
            </p>
          </div>
        </div>
      </div>

      {/* 1. Personal Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Total Sessions */}
        <div className="group relative rounded-xl border border-border bg-card p-5 shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-300 dark:hover:border-indigo-800">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold tracking-wide text-muted-foreground">
              {t("stats.totalSessionsLabel")}
            </span>
            <div className="flex size-10 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
              <ActivityIcon className="size-5" />
            </div>
          </div>
          <div className="mt-4 text-start">
            <h3 className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
              {toArabicNumerals(totalSessions, locale)}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {t("stats.totalSessionsSub")}
            </p>
          </div>
        </div>

        {/* 90-Day Avg Score */}
        <div className="group relative rounded-xl border border-border bg-card p-5 shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-300 dark:hover:border-emerald-800">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold tracking-wide text-muted-foreground">
              {t("stats.avgScoreLabel")}
            </span>
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-300">
              <StarIcon className="size-5" />
            </div>
          </div>
          <div className="mt-4 text-start">
            <h3 className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
              {toArabicNumerals(formattedAvgScore, locale)}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {t("stats.avgScoreSub", { count: toArabicNumerals(stats90Days.totalCompleted, locale) })}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Streak & Milestone Progress */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Active Streak Card */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <FlameIcon
                  className={`size-5 ${
                    stats90Days.streak > 0
                      ? "text-amber-500 animate-bounce"
                      : "text-muted-foreground"
                  }`}
                />
                <h4 className="text-base font-bold text-foreground">
                  {t("streak.title")}
                </h4>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("streak.subtitle")}
              </p>
            </div>
            {stats90Days.streak > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/60 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">
                🔥 {t("streak.badge", { count: toArabicNumerals(stats90Days.streak, locale) })}
              </span>
            )}
          </div>

          <div className="rounded-lg bg-muted/40 p-4 text-start">
            {stats90Days.streak > 0 ? (
              <div className="space-y-1">
                <p className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
                  {t("streak.activeCount", { count: toArabicNumerals(stats90Days.streak, locale) })}
                </p>
                <p className="text-xs font-medium text-muted-foreground">
                  {t("streak.activeDesc")}
                </p>
              </div>
            ) : (
              <p className="text-sm font-medium text-muted-foreground">
                {t("streak.zeroMessage")}
              </p>
            )}
          </div>
        </div>

        {/* Milestone Progress Card */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <TargetIcon className="size-5 text-indigo-500" />
                <h4 className="text-base font-bold text-foreground">
                  {t("milestone.title")}
                </h4>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("milestone.subtitle", { target: toArabicNumerals(milestones.nextMilestone, locale) })}
              </p>
            </div>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
              {toArabicNumerals(milestones.progressText, locale)}
            </span>
          </div>

          <div className="space-y-2">
            <div className="h-3.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-linear-to-r from-indigo-500 to-purple-600 transition-all duration-500"
                style={{ width: `${milestones.percentage}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("milestone.progressLabel")}</span>
              <span className="font-semibold">{toArabicNumerals(milestones.percentage, locale)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Recognition Feed */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-border/50 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
              <MessageSquareHeartIcon className="size-5" />
            </div>
            <div className="text-start">
              <h3 className="text-base font-bold text-foreground">
                {t("recognition.title")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("recognition.subtitle")}
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
            {toArabicNumerals(recognitionFeed.length, locale)}{" "}
            {recognitionFeed.length === 1
              ? t("recognition.quoteSingle")
              : t("recognition.quotePlural")}
          </span>
        </div>

        {recognitionFeed.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recognitionFeed.map((item, idx) => (
              <div
                key={idx}
                className="relative rounded-xl border border-border/80 bg-muted/20 p-4 transition-all duration-200 hover:bg-muted/30 text-start space-y-3 flex flex-col justify-between"
              >
                <p className="text-sm font-medium text-foreground italic leading-relaxed">
                  &ldquo;{item.comment}&rdquo;
                </p>
                <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                  <span className="text-muted-foreground">
                    {toArabicNumerals(new Date(item.date).toLocaleDateString(locale === "ar" ? "ar-AE" : "en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    }), locale)}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 dark:bg-emerald-950/70 px-2 py-0.5 font-bold text-emerald-700 dark:text-emerald-300">
                    <StarIcon className="size-3 fill-emerald-600 text-emerald-600" />
                    {toArabicNumerals(item.score, locale)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/70 p-8 text-center space-y-2">
            <SparklesIcon className="size-8 text-amber-400 mx-auto animate-pulse" />
            <h4 className="text-sm font-semibold text-foreground">
              {t("recognition.emptyTitle")}
            </h4>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              {t("recognition.emptySubtitle")}
            </p>
          </div>
        )}
      </div>

      {/* 4. Weekly Recap */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-4 text-start">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUpIcon className="size-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-base font-bold text-foreground">
              {t("weekly.title")}
            </h3>
          </div>
          <span className="text-xs text-muted-foreground">
            {t("weekly.rangeLabel")}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-lg border border-border/60 bg-muted/20 p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">
                {t("weekly.sessionsCountLabel")}
              </p>
              <p className="text-2xl font-bold text-foreground tabular-nums mt-1">
                {toArabicNumerals(weeklyRecap.count, locale)}
              </p>
            </div>
            <CheckCircle2Icon className="size-6 text-indigo-500/40" />
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/20 p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">
                {t("weekly.avgScoreLabel")}
              </p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums mt-1">
                {toArabicNumerals(formattedWeeklyAvgScore, locale)}
              </p>
            </div>
            <AwardIcon className="size-6 text-emerald-500/40" />
          </div>
        </div>

        {/* Weekly Highlight */}
        {weeklyRecap.highlight && (
          <div className="rounded-xl border border-indigo-100 dark:border-indigo-950/60 bg-linear-to-r from-indigo-50/40 to-purple-50/40 dark:from-indigo-950/20 dark:to-purple-950/20 p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300">
              <SparklesIcon className="size-4 text-indigo-500" />
              <span>{t("weekly.highlightTitle")}</span>
            </div>
            <p className="text-sm font-semibold text-indigo-950 dark:text-indigo-100 italic">
              {weeklyRecap.highlight}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
