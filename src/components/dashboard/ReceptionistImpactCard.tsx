"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import { toArabicNumerals } from "@/lib/utils/arabic-numerals";
import {
  FlameIcon,
  MessageSquareHeartIcon,
  SparklesIcon,
  StarIcon,
  TargetIcon,
  TrendingUpIcon,
  UserXIcon,
  Loader2Icon,
  PlusIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CalendarCheckIcon,
  BanIcon,
  ClockAlert,
  ChevronRightIcon,
  ZapIcon,
} from "lucide-react";
import { ReceptionistImpactData } from "@/server/services/sessions.service";

interface ReceptionistImpactCardProps {
  data: ReceptionistImpactData;
  staffName: string;
  todaysSessions?: number;
  todaysRefusals?: number;
  pendingClosuresCount?: number;
  completionRate?: number | null;
}

export default function ReceptionistImpactCard({
  data,
  staffName,
  todaysSessions = 0,
  todaysRefusals = 0,
  pendingClosuresCount = 0,
  completionRate = null,
}: ReceptionistImpactCardProps) {
  const t = useTranslations("Impact");
  const tDash = useTranslations("Dashboard");
  const tCommon = useTranslations("Sessions");
  const locale = useLocale();
  const router = useRouter();

  const [showRefusalConfirm, setShowRefusalConfirm] = React.useState(false);
  const [isLoggingRefusal, setIsLoggingRefusal] = React.useState(false);
  const [isQuotesExpanded, setIsQuotesExpanded] = React.useState(false);

  const handleLogRefusal = async () => {
    setIsLoggingRefusal(true);
    try {
      const res = await fetch("/api/v1/sessions/log-refusal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || t("logRefusalError"));
      }

      toast.success(t("logRefusalSuccess"));
      setShowRefusalConfirm(false);
      router.refresh();
    } catch (err: any) {
      console.error("Error logging refusal:", err);
      toast.error(t("logRefusalError"));
    } finally {
      setIsLoggingRefusal(false);
    }
  };

  const {
    milestones,
    stats90Days,
    recognitionFeed,
    weeklyRecap,
  } = data;

  const formattedWeeklyAvgScore =
    weeklyRecap.avgScore !== null ? `${weeklyRecap.avgScore}%` : "—";

  return (
    <div className="space-y-4 animate-fade-in">
      {/* TODAY'S PULSE CARD */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-xs transition-all duration-300 hover:border-indigo-500/20">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0">
              <ZapIcon className="size-4.5" />
            </div>
            <h3 className="text-sm font-bold text-foreground">
              {t("pulse.title")}
            </h3>
          </div>
        </div>

        <div className="mt-3 text-start space-y-1">
          {completionRate !== null && completionRate !== undefined ? (
            <h4
              className={`text-3xl font-extrabold tracking-tight tabular-nums ${
                completionRate <= 40
                  ? "text-amber-600 dark:text-amber-400"
                  : completionRate <= 70
                  ? "text-indigo-600 dark:text-indigo-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {toArabicNumerals(`${completionRate}%`, locale)}
            </h4>
          ) : (
            <p className="text-sm font-semibold text-muted-foreground">
              {t("pulse.noSessionsYet")}
            </p>
          )}

          <p className="text-xs font-medium text-muted-foreground">
            {completionRate === null || completionRate === undefined
              ? t("pulse.msgNull")
              : completionRate <= 40
              ? t("pulse.msgLow")
              : completionRate <= 70
              ? t("pulse.msgModerate")
              : completionRate <= 90
              ? t("pulse.msgHigh")
              : t("pulse.msgExcellent")}
          </p>
        </div>
      </div>

      {/* A) TOP STATS BAR — Single row with Today's Sessions, Today's Refusals, & Prominent Log Refusal button */}
      <div className="relative overflow-hidden rounded-2xl border border-indigo-100 dark:border-indigo-900/40 bg-linear-to-br from-indigo-50/60 via-card to-card p-4 shadow-xs">
        {/* Decorative blur blob — Bug Fix: pointer-events-none added */}
        <div className="absolute top-0 end-0 -me-16 -mt-16 size-48 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 sm:gap-6">
            {/* Today's Sessions */}
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <CalendarCheckIcon className="size-4.5" />
              </div>
              <div className="text-start">
                <p className="text-xs font-semibold text-muted-foreground">
                  {t("todaysSessions")}
                </p>
                <p className="text-xl font-bold tracking-tight text-foreground tabular-nums">
                  {toArabicNumerals(todaysSessions, locale)}
                </p>
              </div>
            </div>

            <div className="h-8 w-px bg-border/60" />

            {/* Today's Refusals */}
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                <BanIcon className="size-4.5" />
              </div>
              <div className="text-start">
                <p className="text-xs font-semibold text-muted-foreground">
                  {t("todaysRefusals")}
                </p>
                <p className="text-xl font-bold tracking-tight text-foreground tabular-nums">
                  {toArabicNumerals(todaysRefusals, locale)}
                </p>
              </div>
            </div>
          </div>

          {/* Log Refusal Button — Prominent CTA */}
          <button
            type="button"
            onClick={() => setShowRefusalConfirm(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 px-4 py-2.5 text-xs sm:text-sm font-bold text-rose-700 dark:text-rose-300 shadow-xs transition-all cursor-pointer active:scale-[0.98]"
          >
            <UserXIcon className="size-4 text-rose-600 dark:text-rose-400" />
            <span>{t("logRefusalButton")}</span>
          </button>
        </div>
      </div>

      {/* B) PENDING CLOSURES PREVIEW CARD */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-linear-to-br from-amber-50/70 via-card to-card p-4 shadow-xs transition-all hover:border-amber-300 dark:from-amber-950/20">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 shrink-0">
              <ClockAlert className="size-5" />
            </div>
            <div className="text-start space-y-0.5">
              <h4 className="text-sm font-bold text-foreground">
                {t("pendingClosuresPreview", { count: toArabicNumerals(pendingClosuresCount, locale) })}
              </h4>
            </div>
          </div>
          <Link
            href="/dashboard/sessions?tab=open-visits"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-[0.98] px-4 py-2 text-xs font-bold text-white shadow-xs transition-all cursor-pointer shrink-0"
          >
            <span>{t("viewPendingClosures")}</span>
            <ChevronRightIcon className="size-4" />
          </Link>
        </div>
      </div>

      {/* C) PRIMARY CTA — Full-width prominent Start Session button */}
      {/* <Link href="/dashboard/sessions/new" className="block w-full">
        <button
          type="button"
          className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] py-3.5 px-6 text-base font-bold text-white shadow-md hover:shadow-indigo-500/20 transition-all cursor-pointer"
        >
          <PlusIcon className="size-5" />
          <span>{tDash("startSessionButton")}</span>
        </button>
      </Link> */}

      {/* D) STREAK + MILESTONE — Two cards side-by-side */}
      {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Active Streak Card */}
        {/* <div className="rounded-xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <FlameIcon
                  className={`size-4.5 ${
                    stats90Days.streak > 0
                      ? "text-amber-500 animate-bounce"
                      : "text-muted-foreground"
                  }`}
                />
                <h4 className="text-sm font-bold text-foreground">
                  {t("streak.title")}
                </h4>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("streak.subtitle")}
              </p>
            </div>
            {stats90Days.streak > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                🔥 {t("streak.badge", { count: toArabicNumerals(stats90Days.streak, locale) })}
              </span>
            )}
          </div>

          <div className="rounded-lg bg-muted/40 p-3 text-start">
            {stats90Days.streak > 0 ? (
              <div className="space-y-0.5">
                <p className="text-xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
                  {t("streak.activeCount", { count: toArabicNumerals(stats90Days.streak, locale) })}
                </p>
                <p className="text-xs font-medium text-muted-foreground">
                  {t("streak.activeDesc")}
                </p>
              </div>
            ) : (
              <p className="text-xs font-medium text-muted-foreground">
                {t("streak.zeroMessage")}
              </p>
            )}
          </div>
        </div> */}

        {/* Milestone Progress Card */}
        {/* <div className="rounded-xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <TargetIcon className="size-4.5 text-indigo-500" />
                <h4 className="text-sm font-bold text-foreground">
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

          <div className="space-y-1.5">
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
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
        </div> */}
      {/* </div> */}

      {/* D) RECOGNITION FEED — Collapsible */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => setIsQuotesExpanded(!isQuotesExpanded)}
          className="w-full flex items-center justify-between p-4 bg-card hover:bg-muted/30 transition-colors cursor-pointer text-start"
        >
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
              <MessageSquareHeartIcon className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                {t("recognition.title")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {toArabicNumerals(recognitionFeed.length, locale)}{" "}
                {recognitionFeed.length === 1
                  ? t("recognition.quoteSingle")
                  : t("recognition.quotePlural")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            {isQuotesExpanded ? (
              <ChevronUpIcon className="size-4" />
            ) : (
              <ChevronDownIcon className="size-4" />
            )}
          </div>
        </button>

        {isQuotesExpanded && (
          <div className="p-4 border-t border-border/50 bg-muted/10 space-y-3 animate-fade-in">
            {recognitionFeed.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {recognitionFeed.slice(0, 3).map((item, idx) => (
                  <div
                    key={idx}
                    className="relative rounded-xl border border-border/80 bg-card p-3.5 text-start space-y-2 flex flex-col justify-between"
                  >
                    <p className="text-xs font-medium text-foreground italic leading-relaxed line-clamp-3">
                      &ldquo;{item.comment}&rdquo;
                    </p>
                    <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                      <span className="text-muted-foreground">
                        {toArabicNumerals(
                          new Date(item.date).toLocaleDateString(
                            locale === "ar" ? "ar-AE" : "en-US",
                            { month: "short", day: "numeric" }
                          ),
                          locale
                        )}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 dark:bg-emerald-950/70 px-1.5 py-0.5 font-bold text-emerald-700 dark:text-emerald-300">
                        <StarIcon className="size-3 fill-emerald-600 text-emerald-600" />
                        {toArabicNumerals(item.score, locale)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border/70 p-6 text-center space-y-1">
                <SparklesIcon className="size-6 text-amber-400 mx-auto animate-pulse" />
                <h4 className="text-xs font-semibold text-foreground">
                  {t("recognition.emptyTitle")}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {t("recognition.emptySubtitle")}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* E) WEEKLY RECAP — Two numbers only in a single compact row */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-xs flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <TrendingUpIcon className="size-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span className="font-semibold text-foreground">
            {t("thisWeekRecap", {
              sessions: toArabicNumerals(weeklyRecap.count, locale),
              avg: toArabicNumerals(formattedWeeklyAvgScore, locale),
            })}
          </span>
        </div>
        <span className="text-muted-foreground font-medium">
          {t("weekly.rangeLabel")}
        </span>
      </div>

      {/* Refusal Confirmation Dialog Modal */}
      {showRefusalConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 text-start">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <UserXIcon className="size-5 shrink-0" />
              <h3 className="text-base font-bold text-foreground">
                {t("logRefusalConfirmTitle")}
              </h3>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("logRefusalConfirmDesc")}
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
              <button
                type="button"
                onClick={() => setShowRefusalConfirm(false)}
                disabled={isLoggingRefusal}
                className="rounded-xl border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                {tCommon("cancelButton")}
              </button>
              <button
                type="button"
                onClick={handleLogRefusal}
                disabled={isLoggingRefusal}
                className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isLoggingRefusal ? (
                  <Loader2Icon className="size-3.5 animate-spin" />
                ) : null}
                <span>{t("logRefusalConfirmTitle")}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
