"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  SkipForward,
  Trash2,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
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
  partnerResponse?: any | null;
  partnerFields?: any[];
  partnerAnswers?: Record<string, any>;
  isVisitJourney?: boolean;
  canDelete?: boolean;
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
  partnerResponse,
  partnerFields,
  partnerAnswers,
  isVisitJourney = false,
  canDelete = false,
}: SessionDetailClientProps) {
  const t = useTranslations("Sessions");
  const tNumeric = useTranslations("NumericScale");
  const locale = useLocale();
  const router = useRouter();

  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDeleteSession = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/sessions/${session.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete session");
      }
      toast.success("Session deleted successfully");
      router.push("/dashboard/sessions");
    } catch (err: any) {
      console.error("Delete session error:", err);
      toast.error(err.message || "Failed to delete session");
      setIsDeleting(false);
    }
  };

  const dropOffInfo = React.useMemo(() => {
    if (!isVisitJourney) return null;
    if (session.visit_stage === "drop_off") {
      return {
        fields: fields.filter((f: any) => !f.visit_stage || f.visit_stage === "drop_off"),
        answers: answers,
        status: session.status,
        session: session,
        isCurrent: true,
      };
    } else {
      return {
        fields: (partnerFields || []).filter((f: any) => !f.visit_stage || f.visit_stage === "drop_off"),
        answers: partnerAnswers || {},
        status: visitScoreDetails?.partnerSession?.status || (partnerResponse ? "completed" : "pending"),
        session: visitScoreDetails?.partnerSession,
        isCurrent: false,
      };
    }
  }, [isVisitJourney, session, fields, answers, partnerFields, partnerAnswers, visitScoreDetails, partnerResponse]);

  const pickUpInfo = React.useMemo(() => {
    if (!isVisitJourney) return null;
    if (session.visit_stage === "pick_up") {
      return {
        fields: fields.filter((f: any) => f.visit_stage === "pick_up"),
        answers: answers,
        status: session.status,
        session: session,
        isCurrent: true,
      };
    } else {
      return {
        fields: (partnerFields || []).filter((f: any) => f.visit_stage === "pick_up"),
        answers: partnerAnswers || {},
        status: visitScoreDetails?.partnerSession?.status || (partnerResponse ? "completed" : "pending"),
        session: visitScoreDetails?.partnerSession,
        isCurrent: false,
      };
    }
  }, [isVisitJourney, session, fields, answers, partnerFields, partnerAnswers, visitScoreDetails, partnerResponse]);

  const skippedFields = React.useMemo(() => {
    return fields.filter((f: any) => answers[f.id] === undefined || answers[f.id] === null);
  }, [fields, answers]);

  const skippedByTypes = React.useMemo(() => {
    const counts: Record<string, number> = {
      star_rating: 0,
      numeric_scale: 0,
      multiple_choice: 0,
      text: 0,
    };
    skippedFields.forEach((f) => {
      if (counts[f.type] !== undefined) {
        counts[f.type] += 1;
      } else {
        counts[f.type] = (counts[f.type] || 0) + 1;
      }
    });
    return counts;
  }, [skippedFields]);

  const dropOffSkipped = React.useMemo(() => {
    if (!dropOffInfo) return [];
    return dropOffInfo.fields.filter(
      (f: any) => dropOffInfo.answers[f.id] === undefined || dropOffInfo.answers[f.id] === null
    );
  }, [dropOffInfo]);

  const dropOffSkippedByTypes = React.useMemo(() => {
    const counts: Record<string, number> = { star_rating: 0, numeric_scale: 0, multiple_choice: 0, text: 0 };
    dropOffSkipped.forEach((f: any) => {
      counts[f.type] = (counts[f.type] || 0) + 1;
    });
    return counts;
  }, [dropOffSkipped]);

  const pickUpSkipped = React.useMemo(() => {
    if (!pickUpInfo) return [];
    return pickUpInfo.fields.filter(
      (f: any) => pickUpInfo.answers[f.id] === undefined || pickUpInfo.answers[f.id] === null
    );
  }, [pickUpInfo]);

  const pickUpSkippedByTypes = React.useMemo(() => {
    const counts: Record<string, number> = { star_rating: 0, numeric_scale: 0, multiple_choice: 0, text: 0 };
    pickUpSkipped.forEach((f: any) => {
      counts[f.type] = (counts[f.type] || 0) + 1;
    });
    return counts;
  }, [pickUpSkipped]);

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

  const renderFieldAnswer = (field: any, idx: number, stageAnswers: Record<string, any>) => {
    const answer = stageAnswers[field.id];
    const isSkipped = answer === undefined || answer === null;

    return (
      <div
        key={field.id || idx}
        className={`p-4 rounded-xl border space-y-3 transition-colors ${
          isSkipped
            ? "border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/20"
            : "border-border/70 bg-background/50"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h4 className="text-sm font-bold text-foreground">
            {field.label || t("questionNumber", { number: idx + 1 })}
          </h4>
          <div className="flex items-center gap-2">
            {isSkipped && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-3 py-0.5 text-[11px] font-medium border border-slate-300/50 dark:border-slate-700">
                <SkipForward className="size-3 text-slate-400" />
                {t("skippedBadge")}
              </span>
            )}
            {getFieldTypeBadge(field.type)}
          </div>
        </div>

        <div className="pt-1">
          {isSkipped ? (
            <p className="text-xs text-muted-foreground italic">
              {t("skippedBadge")}
            </p>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
    );
  };

  const displayScore = visitScoreDetails?.visitScore ?? computedScore;
  const isVisitJourneyMode = Boolean(isVisitJourney || session.visit_stage || visitScoreDetails?.isLinked);
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
                {t("dropOffStage")}
              </span>
            )}
            {session.visit_stage === "pick_up" && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800">
                <LogOut className="size-3.5" />
                {t("pickUpStage")}
              </span>
            )}
            {getStatusBadge(session.status)}
            {canDelete && (
              <AlertDialog>
                <AlertDialogTrigger
                  disabled={isDeleting}
                  className="inline-flex items-center gap-1.5 h-8 px-3 text-sm font-medium text-rose-600 border border-rose-200 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-700 rounded-xl cursor-pointer disabled:opacity-50 disabled:pointer-events-none bg-background"
                >
                  {isDeleting ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                  <span>Delete Session</span>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this session?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete the session and all its responses. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteSession}
                      className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
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
                    Linked to {visitScoreDetails.partnerSession.visit_stage === "drop_off" ? t("dropOffStage") : t("pickUpStage")} ({formatDateTime(visitScoreDetails.partnerSession.created_at)})
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
                      : displayScore >= threshold && session.visit_stage !== "drop_off"
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
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line">
              {aiSummary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* SECTION 4.5 — Skipped Questions Analysis Card */}
      {session.status === "completed" && (
        isVisitJourney && dropOffInfo && pickUpInfo ? (
          <Card className="border border-border shadow-xs bg-card rounded-2xl overflow-hidden">
            <CardHeader className="bg-muted/10 border-b border-border/60 pb-3">
              <CardTitle className="text-base font-bold flex items-center justify-between text-foreground">
                <div className="flex items-center gap-2">
                  <SkipForward className="size-4 text-slate-500" />
                  <span>{t("skippedCardTitle")}</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Drop-off Stage Skipped Breakdown */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border/40 pb-2">
                  <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-bold text-sm">
                    <LogIn className="size-4 text-indigo-600 dark:text-indigo-400" />
                    <span>{t("dropOffStage")}</span>
                  </div>
                  {dropOffInfo.status === "completed" ? (
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800">
                      {t("skippedOfTotal", {
                        skipped: toArabicNumerals(dropOffSkipped.length, locale),
                        total: toArabicNumerals(dropOffInfo.fields.length, locale),
                      })}
                    </span>
                  ) : (
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                      {t("dropOffPending")}
                    </span>
                  )}
                </div>

                {dropOffInfo.status === "completed" && dropOffInfo.fields.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/40 flex flex-col gap-1">
                      <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1">
                        <Star className="size-3 fill-amber-400 text-amber-400" />
                        {t("typeStarRating")}
                      </span>
                      <span className="text-xl font-extrabold text-foreground tabular-nums">
                        {toArabicNumerals(dropOffSkippedByTypes.star_rating || 0, locale)}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200/50 dark:border-orange-900/40 flex flex-col gap-1">
                      <span className="text-[11px] font-medium text-orange-700 dark:text-orange-400">
                        {tNumeric("typeLabel")}
                      </span>
                      <span className="text-xl font-extrabold text-foreground tabular-nums">
                        {toArabicNumerals(dropOffSkippedByTypes.numeric_scale || 0, locale)}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/40 flex flex-col gap-1">
                      <span className="text-[11px] font-medium text-blue-700 dark:text-blue-400">
                        {t("typeMultipleChoice")}
                      </span>
                      <span className="text-xl font-extrabold text-foreground tabular-nums">
                        {toArabicNumerals(dropOffSkippedByTypes.multiple_choice || 0, locale)}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/50 dark:border-purple-900/40 flex flex-col gap-1">
                      <span className="text-[11px] font-medium text-purple-700 dark:text-purple-400 flex items-center gap-1">
                        <MessageSquare className="size-3" />
                        {t("typeText")}
                      </span>
                      <span className="text-xl font-extrabold text-foreground tabular-nums">
                        {toArabicNumerals(dropOffSkippedByTypes.text || 0, locale)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Pick-up Stage Skipped Breakdown */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-border/40 pb-2">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                    <LogOut className="size-4 text-emerald-600 dark:text-emerald-400" />
                    <span>{t("pickUpStage")}</span>
                  </div>
                  {pickUpInfo.status === "completed" ? (
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800">
                      {t("skippedOfTotal", {
                        skipped: toArabicNumerals(pickUpSkipped.length, locale),
                        total: toArabicNumerals(pickUpInfo.fields.length, locale),
                      })}
                    </span>
                  ) : (
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                      {t("pickUpPending")}
                    </span>
                  )}
                </div>

                {pickUpInfo.status === "completed" && pickUpInfo.fields.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/40 flex flex-col gap-1">
                      <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1">
                        <Star className="size-3 fill-amber-400 text-amber-400" />
                        {t("typeStarRating")}
                      </span>
                      <span className="text-xl font-extrabold text-foreground tabular-nums">
                        {toArabicNumerals(pickUpSkippedByTypes.star_rating || 0, locale)}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200/50 dark:border-orange-900/40 flex flex-col gap-1">
                      <span className="text-[11px] font-medium text-orange-700 dark:text-orange-400">
                        {tNumeric("typeLabel")}
                      </span>
                      <span className="text-xl font-extrabold text-foreground tabular-nums">
                        {toArabicNumerals(pickUpSkippedByTypes.numeric_scale || 0, locale)}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/40 flex flex-col gap-1">
                      <span className="text-[11px] font-medium text-blue-700 dark:text-blue-400">
                        {t("typeMultipleChoice")}
                      </span>
                      <span className="text-xl font-extrabold text-foreground tabular-nums">
                        {toArabicNumerals(pickUpSkippedByTypes.multiple_choice || 0, locale)}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/50 dark:border-purple-900/40 flex flex-col gap-1">
                      <span className="text-[11px] font-medium text-purple-700 dark:text-purple-400 flex items-center gap-1">
                        <MessageSquare className="size-3" />
                        {t("typeText")}
                      </span>
                      <span className="text-xl font-extrabold text-foreground tabular-nums">
                        {toArabicNumerals(pickUpSkippedByTypes.text || 0, locale)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : fields.length > 0 ? (
          <Card className="border border-border shadow-xs bg-card rounded-2xl overflow-hidden">
            <CardHeader className="bg-muted/10 border-b border-border/60 pb-3">
              <CardTitle className="text-base font-bold flex items-center justify-between text-foreground">
                <div className="flex items-center gap-2">
                  <SkipForward className="size-4 text-slate-500" />
                  <span>{t("skippedCardTitle")}</span>
                </div>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700">
                  {t("skippedOfTotal", {
                    skipped: toArabicNumerals(skippedFields.length, locale),
                    total: toArabicNumerals(fields.length, locale),
                  })}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/40 flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1">
                    <Star className="size-3 fill-amber-400 text-amber-400" />
                    {t("typeStarRating")}
                  </span>
                  <span className="text-xl font-extrabold text-foreground tabular-nums">
                    {toArabicNumerals(skippedByTypes.star_rating || 0, locale)}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200/50 dark:border-orange-900/40 flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-orange-700 dark:text-orange-400">
                    {tNumeric("typeLabel")}
                  </span>
                  <span className="text-xl font-extrabold text-foreground tabular-nums">
                    {toArabicNumerals(skippedByTypes.numeric_scale || 0, locale)}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/40 flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-blue-700 dark:text-blue-400">
                    {t("typeMultipleChoice")}
                  </span>
                  <span className="text-xl font-extrabold text-foreground tabular-nums">
                    {toArabicNumerals(skippedByTypes.multiple_choice || 0, locale)}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/50 dark:border-purple-900/40 flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-purple-700 dark:text-purple-400 flex items-center gap-1">
                    <MessageSquare className="size-3" />
                    {t("typeText")}
                  </span>
                  <span className="text-xl font-extrabold text-foreground tabular-nums">
                    {toArabicNumerals(skippedByTypes.text || 0, locale)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null
      )}

      {/* SECTION 5 — Answers */}
      {session.status === "completed" ? (
        isVisitJourney && dropOffInfo && pickUpInfo ? (
          <Card className="border border-border shadow-xs bg-card rounded-2xl overflow-hidden">
            <CardHeader className="bg-muted/10 border-b border-border/60 pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                <MessageSquare className="size-4 text-indigo-600 dark:text-indigo-400" />
                <span>{t("answersLabel")}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-8">
              {/* Section A: Drop-off Stage */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-bold text-base border-b border-indigo-100 dark:border-indigo-900/40 pb-2">
                  <LogIn className="size-4 text-indigo-600 dark:text-indigo-400" />
                  <span>{t("dropOffStage")}</span>
                </div>
                {dropOffInfo.status === "completed" && dropOffInfo.fields.length > 0 ? (
                  <div className="space-y-4">
                    {dropOffInfo.fields.map((field: any, idx: number) =>
                      renderFieldAnswer(field, idx, dropOffInfo.answers)
                    )}
                  </div>
                ) : (
                  <div className="p-6 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 text-center">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                      {t("dropOffPending")}
                    </p>
                  </div>
                )}
              </div>

              {/* Section B: Pick-up Stage */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-base border-b border-emerald-100 dark:border-emerald-900/40 pb-2">
                  <LogOut className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{t("pickUpStage")}</span>
                </div>
                {pickUpInfo.status === "completed" && pickUpInfo.fields.length > 0 ? (
                  <div className="space-y-4">
                    {pickUpInfo.fields.map((field: any, idx: number) =>
                      renderFieldAnswer(field, idx, pickUpInfo.answers)
                    )}
                  </div>
                ) : (
                  <div className="p-6 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 text-center">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                      {t("pickUpPending")}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border border-border shadow-xs bg-card rounded-2xl overflow-hidden">
            <CardHeader className="bg-muted/10 border-b border-border/60 pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                <MessageSquare className="size-4 text-indigo-600 dark:text-indigo-400" />
                <span>{t("answersLabel")}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {fields.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">{t("noAnswers")}</p>
              ) : (
                fields.map((field: any, idx: number) => renderFieldAnswer(field, idx, answers))
              )}
            </CardContent>
          </Card>
        )
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
