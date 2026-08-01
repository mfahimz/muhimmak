"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import {
  ArrowLeft,
  Calendar,
  User,
  FileText,
  Sparkles,
  Star,
  Globe,
  Car,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Award,
  MessageSquare,
  LogIn,
  LogOut,
  Link2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toArabicNumerals } from "@/lib/utils/arabic-numerals";
import type { VisitScoreDetails } from "@/server/services/sessions.service";

interface SessionDetailClientProps {
  session: any;
  response: any | null;
  form: any | null;
  fields: any[];
  answers: Record<string, any>;
  creatorName: string;
  role: string;
  showPlate: boolean;
  plateNumber?: string | null;
  aiSummary: string;
  computedScore: number | null;
  visitScoreDetails?: VisitScoreDetails | null;
  threshold: number;
}

export default function SessionDetailClient({
  session,
  response,
  form,
  fields,
  answers,
  creatorName,
  role,
  showPlate,
  plateNumber,
  aiSummary,
  computedScore,
  visitScoreDetails,
  threshold,
}: SessionDetailClientProps) {
  const t = useTranslations("Sessions");
  const tNumeric = useTranslations("NumericScale");
  const locale = useLocale();

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "—";
    const formatted = new Date(dateStr).toLocaleString(locale === "ar" ? "ar-AE" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    return toArabicNumerals(formatted, locale);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "started":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
            <Clock className="size-3.5" />
            {t("filterStarted")}
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800">
            <CheckCircle2 className="size-3.5" />
            {t("filterCompleted")}
          </span>
        );
      case "refused":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800">
            <XCircle className="size-3.5" />
            {t("filterRefused")}
          </span>
        );
      case "abandoned":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800">
            <AlertCircle className="size-3.5" />
            {t("filterAbandoned")}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
            {status}
          </span>
        );
    }
  };

  const getConsentText = (consent: boolean | null) => {
    if (consent === true) return t("consentYes");
    if (consent === false) return t("consentNo");
    return t("consentNull");
  };

  const getFieldTypeBadge = (type: string) => {
    switch (type) {
      case "star_rating":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/40 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300 border border-amber-200/50">
            <Star className="size-3 fill-amber-400 text-amber-400" />
            Star Rating
          </span>
        );
      case "numeric_scale":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 dark:bg-orange-950/40 px-2.5 py-0.5 text-[11px] font-medium text-orange-700 dark:text-orange-300 border border-orange-200/50">
            {tNumeric("typeLabel")}
          </span>
        );
      case "multiple_choice":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/40 px-2.5 py-0.5 text-[11px] font-medium text-blue-700 dark:text-blue-300 border border-blue-200/50">
            Multiple Choice
          </span>
        );
      case "text":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 dark:bg-purple-950/40 px-2.5 py-0.5 text-[11px] font-medium text-purple-700 dark:text-purple-300 border border-purple-200/50">
            <MessageSquare className="size-3" />
            Text Feedback
          </span>
        );
      default:
        return null;
    }
  };

  const displayScore = visitScoreDetails?.visitScore ?? computedScore;
  const isVisitJourney = Boolean(session.visit_stage || visitScoreDetails?.isLinked);
  const displayCreatorName = session?.channel === "public_qr" ? "Public QR" : creatorName;

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6 bg-background text-start max-w-5xl mx-auto w-full animate-fade-in">
      {/* SECTION 1 — Back button + Page header */}
      <div className="flex flex-col gap-4">
        <Link href="/dashboard/sessions">
          <Button
            variant="ghost"
            size="sm"
            className="w-fit gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-xl -ml-2"
          >
            <ArrowLeft className="size-4" />
            <span>{t("backToSessions")}</span>
          </Button>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              {t("sessionDetail")}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">
              ID: {session.id}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {session.visit_stage === "drop_off" && (
              <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800">
                <LogIn className="size-3.5" />
                Drop-off Stage
              </span>
            )}
            {session.visit_stage === "pick_up" && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800">
                <LogOut className="size-3.5" />
                Pick-up Stage
              </span>
            )}
            {getStatusBadge(session.status)}
          </div>
        </div>
      </div>

      {/* SECTION 2 — Session metadata card */}
      <Card className="border border-border shadow-xs bg-card rounded-2xl overflow-hidden">
        <CardHeader className="bg-muted/10 border-b border-border/60 pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
            <FileText className="size-4 text-indigo-600 dark:text-indigo-400" />
            <span>{t("sessionMetadata")}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider block">
                {t("formLabel")}
              </span>
              <p className="text-sm font-semibold text-foreground">
                {form?.name || t("formFallback")}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider block">
                {t("languageLabel")}
              </span>
              <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Globe className="size-3.5 text-muted-foreground" />
                {session.language === "ar" ? t("languageArabic") : t("languageEnglish")}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider block">
                {t("createdByLabel")}
              </span>
              <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <User className="size-3.5 text-muted-foreground" />
                {displayCreatorName}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider block">
                {t("startedLabel")}
              </span>
              <p className="text-sm font-medium text-foreground flex items-center gap-1.5 tabular-nums">
                <Calendar className="size-3.5 text-muted-foreground" />
                {formatDateTime(session.started_at)}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider block">
                {t("completedLabel")}
              </span>
              <p className="text-sm font-medium text-foreground flex items-center gap-1.5 tabular-nums">
                <Clock className="size-3.5 text-muted-foreground" />
                {session.completed_at
                  ? formatDateTime(session.completed_at)
                  : session.refused_at
                  ? formatDateTime(session.refused_at)
                  : "—"}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider block">
                {t("consentLabel")}
              </span>
              <p className="text-sm font-medium text-foreground">
                {getConsentText(session.consent_given)}
              </p>
            </div>

            {showPlate && (
              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider block">
                  {t("plateLabel")}
                </span>
                <p className="text-sm font-medium text-foreground flex items-center gap-1.5 font-mono">
                  <Car className="size-3.5 text-muted-foreground" />
                  {plateNumber || "—"}
                </p>
              </div>
            )}

            {visitScoreDetails?.isLinked && visitScoreDetails.partnerSession && (
              <div className="space-y-1 col-span-1 md:col-span-2">
                <span className="text-xs font-semibold uppercase text-indigo-600 dark:text-indigo-400 tracking-wider block">
                  Linked Visit Stage
                </span>
                <Link
                  href={`/dashboard/sessions/${visitScoreDetails.partnerSession.id}`}
                  className="inline-flex items-center gap-2 p-2 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:underline transition"
                >
                  <Link2 className="size-3.5" />
                  <span>
                    Linked to {visitScoreDetails.partnerSession.visit_stage === "drop_off" ? "Drop-off" : "Pick-up"} session ({formatDateTime(visitScoreDetails.partnerSession.created_at)})
                  </span>
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* SECTION 3 — Score card */}
      {displayScore !== null && (
        <Card className="border border-border shadow-xs bg-card rounded-2xl overflow-hidden">
          <CardHeader className="bg-muted/10 border-b border-border/60 pb-3">
            <CardTitle className="text-base font-bold flex items-center justify-between text-foreground">
              <div className="flex items-center gap-2">
                <Award className="size-4 text-amber-500" />
                <span>{visitScoreDetails?.isLinked ? "Visit Blended Satisfaction Score" : t("scoreLabel")}</span>
              </div>
              {visitScoreDetails?.isLinked && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Combined Journey
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div
                  className={`size-16 rounded-2xl flex items-center justify-center border font-bold text-2xl tabular-nums shadow-xs ${
                    displayScore >= threshold
                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                      : displayScore >= 50
                      ? "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                      : "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800"
                  }`}
                >
                  {toArabicNumerals(displayScore, locale)}%
                </div>
                <div>
                  <h4 className="text-base font-bold text-foreground">
                    {displayScore >= threshold
                      ? t("satisfactionHigh")
                      : displayScore >= 50
                      ? t("satisfactionModerate")
                      : t("satisfactionLow")}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {visitScoreDetails?.isLinked
                      ? `Blended score averaging Drop-off (${visitScoreDetails.ownScore ?? visitScoreDetails.partnerScore}%) and Pick-up (${visitScoreDetails.partnerScore ?? visitScoreDetails.ownScore}%) stages.`
                      : displayScore >= threshold
                      ? t("aboveThreshold")
                      : t("belowThreshold")}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SECTION 4 — AI Summary */}
      {aiSummary && (
        <Card className="border border-indigo-200/80 dark:border-indigo-900/60 shadow-xs bg-gradient-to-br from-indigo-50/50 via-card to-card dark:from-indigo-950/20 dark:via-card dark:to-card rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-indigo-100 dark:border-indigo-900/40 pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-indigo-900 dark:text-indigo-300">
              <Sparkles className="size-4 text-indigo-600 dark:text-indigo-400" />
              <span>{t("aiAnalysisLabel")}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {aiSummary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* SECTION 5 — Answers */}
      {session.status === "completed" ? (
        <Card className="border border-border shadow-xs bg-card rounded-2xl overflow-hidden">
          <CardHeader className="bg-muted/10 border-b border-border/60 pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <MessageSquare className="size-4 text-indigo-600 dark:text-indigo-400" />
              <span>{t("answersLabel")}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {fields.length === 0 || Object.keys(answers).length === 0 ? (
              <p className="text-sm text-muted-foreground italic">{t("noAnswers")}</p>
            ) : (
              fields.map((field: any, idx: number) => {
                const answer = answers[field.id];
                if (answer === undefined || answer === null) return null;

                return (
                  <div
                    key={field.id || idx}
                    className="p-4 rounded-xl border border-border/70 bg-background/50 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <h4 className="text-sm font-bold text-foreground">
                        {field.label || t("questionNumber", { number: idx + 1 })}
                      </h4>
                      <div>{getFieldTypeBadge(field.type)}</div>
                    </div>

                    {/* Answer display logic */}
                    <div className="pt-1">
                      {field.type === "star_rating" && (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`size-5 ${
                                  star <= Number(answer)
                                    ? "fill-amber-400 text-amber-400"
                                    : "text-slate-300 dark:text-slate-700"
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-sm font-semibold text-foreground tabular-nums ml-2">
                            {toArabicNumerals(answer, locale)} / {toArabicNumerals(5, locale)}
                          </span>
                        </div>
                      )}

                      {field.type === "multiple_choice" && (
                        <span className="inline-flex items-center rounded-lg bg-indigo-50 dark:bg-indigo-950/50 px-3 py-1 text-sm font-semibold text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800">
                          {String(answer)}
                        </span>
                      )}

                      {field.type === "text" && (
                        <div className="border-l-4 border-indigo-500 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-r-xl italic text-sm text-slate-700 dark:text-slate-300">
                          &ldquo;{String(answer)}&rdquo;
                        </div>
                      )}

                      {field.type === "numeric_scale" && (
                        <span className="text-sm font-semibold text-foreground tabular-nums">
                          {tNumeric("displayFormat", { value: toArabicNumerals(answer, locale) })}
                        </span>
                      )}

                      {field.type !== "star_rating" &&
                        field.type !== "multiple_choice" &&
                        field.type !== "text" &&
                        field.type !== "numeric_scale" && (
                          <p className="text-sm font-medium text-foreground">
                            {String(answer)}
                          </p>
                        )}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      ) : session.status === "refused" ? (
        <Card className="border border-rose-200/60 dark:border-rose-900/40 bg-rose-50/30 dark:bg-rose-950/10 rounded-2xl p-6 text-center">
          <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">
            {t("sessionRefused")}
          </p>
        </Card>
      ) : session.status === "abandoned" ? (
        <Card className="border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-950/10 rounded-2xl p-6 text-center">
          <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
            {t("sessionAbandoned")}
          </p>
        </Card>
      ) : (
        <Card className="border border-slate-200/60 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/10 rounded-2xl p-6 text-center">
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
            {t("sessionInProgress")}
          </p>
        </Card>
      )}
    </div>
  );
}
