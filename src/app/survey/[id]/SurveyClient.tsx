"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useIdleTimer } from "@/hooks/useIdleTimer"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, AlertTriangle, ArrowRight, RefreshCw, QrCode, ThumbsUp, Loader2 } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { toArabicNumerals } from "@/lib/utils/arabic-numerals"

export interface SurveyField {
  id: string
  type: "star_rating" | "text" | "multiple_choice" | "numeric_scale"
  label: string
  required: boolean
  options: string[]
  dependsOn?: {
    fieldId: string
    operator: 'equals' | 'not_equals' | 'lte' | 'gte'
    value: string | number
  } | null
  weight?: number
  optionScores?: number[]
  ar?: { label: string; options: string[] }
  visit_stage?: 'drop_off' | 'pick_up' | null
}

export interface SurveySession {
  id: string
  form_id: string
  location_id: string | null
  status: string
  language: string
  visit_stage?: 'drop_off' | 'pick_up' | null
}

interface SurveyClientProps {
  session: SurveySession
  plateNumber?: string | null
  form: {
    id: string
    name: string
    description: string
    fields: any
  }
  facilitySettings: {
    google_review_url: string
    review_qr_threshold_percent: number
    display_orientation?: string
  }
  isPublicMode?: boolean
}

function isFieldVisible(field: SurveyField, answers: Record<string, any>): boolean {
  if (!field.dependsOn) return true
  const sourceAnswer = answers[field.dependsOn.fieldId]
  if (sourceAnswer === undefined) return false

  switch (field.dependsOn.operator) {
    case 'equals':
      return sourceAnswer === field.dependsOn.value
    case 'not_equals':
      return sourceAnswer !== field.dependsOn.value
    case 'lte':
      return typeof sourceAnswer === 'number' && sourceAnswer <= (field.dependsOn.value as number)
    case 'gte':
      return typeof sourceAnswer === 'number' && sourceAnswer >= (field.dependsOn.value as number)
    default:
      return true
  }
}

export function SurveyClient({ session, plateNumber, form, facilitySettings, isPublicMode }: SurveyClientProps) {
  const router = useRouter()
  const t = useTranslations("Survey")

  const isPublic = Boolean(isPublicMode || !(session as any).created_by || (session as any).channel === 'public_qr')
  const isFitToScreen = facilitySettings?.display_orientation === 'fit_to_screen'
  
  // Parse fields
  const fields = React.useMemo(() => {
    let parsed: SurveyField[] = []
    if (Array.isArray(form.fields)) {
      parsed = form.fields as SurveyField[]
    }
    if (session.visit_stage) {
      return parsed.filter(f => !f.visit_stage || f.visit_stage === session.visit_stage)
    }
    return parsed
  }, [form.fields, session.visit_stage])

  const isArabic = session.language === 'ar'

  // UI state
  const [step, setStep] = React.useState<"handoff" | "consent" | "survey" | "refused" | "completed" | "ended">(() => {
    if (session.status === "refused" || session.status === "completed" || session.status === "abandoned") return "ended"
    if (isPublic) return "consent"
    return "handoff"
  })
  const [currentFieldIdx, setCurrentFieldIdx] = React.useState(0)
  const [answers, setAnswers] = React.useState<Record<string, any>>({})
  const [textVal, setTextVal] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [showQr, setShowQr] = React.useState(false)

  // AI closing question states
  const [extraFields, setExtraFields] = React.useState<SurveyField[]>([])
  const [aiClosingQuestion, setAiClosingQuestion] = React.useState<any | null>(null)
  const [aiClosingQuestionStatus, setAiClosingQuestionStatus] = React.useState<'idle' | 'pending' | 'ready' | 'failed'>('idle')
  const [lockedClosingQuestion, setLockedClosingQuestion] = React.useState<SurveyField | null>(null)

  const combinedFields = React.useMemo(() => {
    return [...fields, ...extraFields]
  }, [fields, extraFields])

  const visibleFields = React.useMemo(() => {
    return combinedFields.filter(f => isFieldVisible(f, answers))
  }, [combinedFields, answers])

  const isClosing = React.useMemo(() => {
    const field = visibleFields[currentFieldIdx]
    return !!field && (field.id === 'd1a1a1a1-0008-4000-8000-000000000008' || field.id === 'p1c1k1u1-0010-4000-8000-000000000010')
  }, [visibleFields, currentFieldIdx])

  const currentField = React.useMemo(() => {
    const field = visibleFields[currentFieldIdx]
    if (!field) return field

    if (isClosing && lockedClosingQuestion) {
      return lockedClosingQuestion
    }
    return field
  }, [visibleFields, currentFieldIdx, isClosing, lockedClosingQuestion])

  const showClosingLoading = React.useMemo(() => {
    return isClosing && !isArabic && !lockedClosingQuestion
  }, [isClosing, isArabic, lockedClosingQuestion])

  // AI text scoring states
  const [textScores, setTextScores] = React.useState<Record<string, number>>({})
  const [pendingTextFields, setPendingTextFields] = React.useState<Set<string>>(new Set())
  const [wasPendingOnSubmit, setWasPendingOnSubmit] = React.useState(false)

  // Submission refs for guards (same pattern as LoginForm.tsx)
  const isAcceptingConsent = React.useRef(false)
  const isRefusingConsent = React.useRef(false)
  const isSubmittingSurvey = React.useRef(false)

  // Loading/submitting states for visual feedback
  const [acceptingConsent, setAcceptingConsent] = React.useState(false)
  const [refusingConsent, setRefusingConsent] = React.useState(false)

  // Idle warning state
  const [showWarningModal, setShowWarningModal] = React.useState(false)
  const [warningCount, setWarningCount] = React.useState(10)
  const countdownIntervalRef = React.useRef<NodeJS.Timeout | null>(null)

  const triggerAiGeneration = React.useCallback((currentAnswers: Record<string, any>) => {
    const isAr = session.language === 'ar'
    if (isAr || !session.visit_stage || aiClosingQuestionStatus !== 'idle') return

    setAiClosingQuestionStatus('pending')
    
    // Prepare question labels
    const questionLabels: Record<string, string> = {}
    fields.forEach(f => {
      questionLabels[f.id] = f.label
    })

    fetch("/api/v1/sessions/generate-closing-question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.id,
        visitStage: session.visit_stage,
        answers: currentAnswers,
        questionLabels,
      }),
    })
      .then(res => {
        if (!res.ok) throw new Error("AI generation failed")
        return res.json()
      })
      .then(data => {
        setAiClosingQuestion(data)
        setAiClosingQuestionStatus('ready')
      })
      .catch(err => {
        console.error("AI closing question generation failed:", err)
        setAiClosingQuestionStatus('failed')
      })
  }, [session.id, session.visit_stage, session.language, fields, aiClosingQuestionStatus])

  // Idle timer hook (disabled on personal device flow)
  const { resetTimer } = useIdleTimer({
    timeoutMs: 90000, // 90 seconds
    warningMs: 10000, // 10 seconds warning
    onWarning: () => {
      setShowWarningModal(true)
      setWarningCount(10)
      countdownIntervalRef.current = setInterval(() => {
        setWarningCount(prev => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current!)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    },
    onTimeout: async () => {
      // Auto-submit partial answers as abandoned
      clearInterval(countdownIntervalRef.current!)
      setShowWarningModal(false)
      await handleAbandonSession()
    },
    onReset: () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
      setShowWarningModal(false)
    },
    enabled: step === "survey" && !isPublic,
  })

  // Monitor count down to trigger actual timeout if interval didn't complete
  React.useEffect(() => {
    if (showWarningModal && warningCount === 0) {
      clearInterval(countdownIntervalRef.current!)
      setShowWarningModal(false)
      handleAbandonSession()
    }
  }, [showWarningModal, warningCount])

  // Clean up interval
  React.useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    }
  }, [])

  // Lock or wait for AI closing question
  React.useEffect(() => {
    if (!isClosing || lockedClosingQuestion) return

    const originalField = visibleFields[currentFieldIdx]
    if (!originalField) return

    if (isArabic) {
      // Arabic sessions skip AI and show static immediately (no loading state)
      setLockedClosingQuestion(originalField)
      return
    }

    // Trigger AI generation if it hasn't been triggered yet
    if (aiClosingQuestionStatus === 'idle') {
      triggerAiGeneration(answers)
      return
    }

    // If AI question is already ready, lock it immediately
    if (aiClosingQuestionStatus === 'ready' && aiClosingQuestion) {
      setLockedClosingQuestion({
        ...originalField,
        type: aiClosingQuestion.type,
        label: aiClosingQuestion.label,
        options: aiClosingQuestion.options || [],
      })
      return
    }

    // If AI question already failed, lock to static immediately
    if (aiClosingQuestionStatus === 'failed') {
      setLockedClosingQuestion(originalField)
      return
    }

    // Otherwise, we wait up to 2500ms
    const timer = setTimeout(() => {
      // Timer expired, lock to static fallback
      setLockedClosingQuestion(originalField)
    }, 2500)

    return () => clearTimeout(timer)
  }, [
    isClosing,
    currentFieldIdx,
    isArabic,
    aiClosingQuestionStatus,
    aiClosingQuestion,
    lockedClosingQuestion,
    visibleFields,
    answers,
    triggerAiGeneration,
  ])

  // React effect watching pendingTextFields to fire a follow-up POST for rescoring
  React.useEffect(() => {
    if (step === "completed" && wasPendingOnSubmit && pendingTextFields.size === 0) {
      fetch("/api/v1/sessions/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          action: "rescore",
          textScores: textScores,
        }),
      })
        .then(res => {
          if (!res.ok) throw new Error(t("errorRescore"))
          return res.json()
        })
        .then(data => {
          if (data.showQr) {
            setShowQr(true)
          } else {
            setShowQr(false)
          }
          setWasPendingOnSubmit(false)
        })
        .catch(err => {
          console.error("Rescoring failed:", err)
          setWasPendingOnSubmit(false)
        })
    }
  }, [step, wasPendingOnSubmit, pendingTextFields.size, textScores, session.id])

  // Consent Actions
  const handleAcceptConsent = async () => {
    if (isAcceptingConsent.current || isRefusingConsent.current || isSubmittingSurvey.current) return
    isAcceptingConsent.current = true
    setAcceptingConsent(true)
    try {
      const res = await fetch("/api/v1/sessions/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, action: "consent_given" }),
      })
      if (!res.ok) throw new Error(t("errorConsent"))
      setStep("survey")
      resetTimer()
    } catch (err) {
      console.error(err)
    } finally {
      setAcceptingConsent(false)
      isAcceptingConsent.current = false
    }
  }

  const handleRefuseConsent = async () => {
    if (isRefusingConsent.current || isAcceptingConsent.current || isSubmittingSurvey.current) return
    isRefusingConsent.current = true
    setRefusingConsent(true)
    try {
      setStep("refused")
      await fetch("/api/v1/sessions/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, action: "consent_refused" }),
      })
      setTimeout(() => {
        router.refresh()
      }, 4000)
    } catch (err) {
      console.error(err)
    } finally {
      setRefusingConsent(false)
      isRefusingConsent.current = false
    }
  }

  // Answer handlers
  const handleAnswer = (val: any, autoAdvance = true) => {
    setAnswers(prev => ({ ...prev, [currentField.id]: val }))

    // Trigger AI text scoring if field type is text and answer is non-empty
    if (currentField.type === "text" && val && String(val).trim() !== "") {
      const trimmedVal = String(val).trim();
      setPendingTextFields(prev => {
        const next = new Set(prev)
        next.add(currentField.id)
        return next
      })

      fetch("/api/v1/sessions/score-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          fieldId: currentField.id,
          questionLabel: currentField.label,
          answer: trimmedVal,
        }),
      })
        .then(res => {
          if (!res.ok) throw new Error(t("errorScoreText"))
          return res.json()
        })
        .then(data => {
          const score = typeof data.score === "number" ? data.score : 50
          setTextScores(prev => ({ ...prev, [currentField.id]: score }))
          setPendingTextFields(prev => {
            const next = new Set(prev)
            next.delete(currentField.id)
            return next
          })
        })
        .catch(err => {
          console.error("Text scoring error:", err)
          setTextScores(prev => ({ ...prev, [currentField.id]: 50 }))
          setPendingTextFields(prev => {
            const next = new Set(prev)
            next.delete(currentField.id)
            return next
          })
        })
    }

    // Trigger AI closing question generation if conditions are met
    const isAr = session.language === 'ar'
    if (!isAr && session.visit_stage && aiClosingQuestionStatus === 'idle') {
      const updatedAnswers = { ...answers, [currentField.id]: val }
      // Filter out meta keys like _textScores
      const answeredKeys = Object.keys(updatedAnswers).filter(k => k !== '_textScores')
      const triggerThreshold = Math.ceil(fields.length * 0.5)

      if (answeredKeys.length >= triggerThreshold) {
        triggerAiGeneration(updatedAnswers)
      }
    }

    if (autoAdvance) {
      const updatedAnswers = { ...answers, [currentField.id]: val }
      const nextVisibleFields = combinedFields.filter(f => isFieldVisible(f, updatedAnswers))
      const isLastVisible = currentFieldIdx >= nextVisibleFields.length - 1

      if (!isLastVisible) {
        setTextVal("")
        setCurrentFieldIdx(prev => prev + 1)
      } else {
        handleSubmitSurvey(updatedAnswers)
      }
    }
  }

  const handleTextSubmit = () => {
    handleAnswer(textVal, true)
  }

  const handleSkip = () => {
    if (submitting) return
    setTextVal("")
    const nextVisibleFields = combinedFields.filter(f => isFieldVisible(f, answers))
    const isLastVisible = currentFieldIdx >= nextVisibleFields.length - 1

    if (!isLastVisible) {
      setCurrentFieldIdx(prev => prev + 1)
    } else {
      handleSubmitSurvey(answers)
    }
  }

  const handleNext = () => {
    if (submitting) return
    if (currentField?.type === "text") {
      if (textVal.trim()) {
        handleAnswer(textVal.trim(), true)
      } else {
        handleSkip()
      }
    } else if (currentField) {
      const existingAnswer = answers[currentField.id]
      if (existingAnswer !== undefined && existingAnswer !== null) {
        handleAnswer(existingAnswer, true)
      } else {
        handleSkip()
      }
    }
  }

  const handleBack = () => {
    if (currentFieldIdx > 0) {
      const prevField = visibleFields[currentFieldIdx - 1]
      setTextVal(answers[prevField.id] || "")
      setCurrentFieldIdx(prev => prev - 1)
    }
  }

  // Submit survey successfully
  const handleSubmitSurvey = async (finalAnswers: Record<string, any>) => {
    if (isSubmittingSurvey.current || isAcceptingConsent.current || isRefusingConsent.current) return
    isSubmittingSurvey.current = true
    setSubmitting(true)

    const isPending = pendingTextFields.size > 0
    if (isPending) {
      setWasPendingOnSubmit(true)
    }

    const skippedList = visibleFields.filter(f => finalAnswers[f.id] === undefined || finalAnswers[f.id] === null)
    const skippedByTypes: Record<string, number> = {}
    skippedList.forEach(f => {
      skippedByTypes[f.type] = (skippedByTypes[f.type] || 0) + 1
    })

    const payloadAnswers = {
      ...finalAnswers,
      _skippedSummary: {
        count: skippedList.length,
        byType: skippedByTypes,
        skippedFieldIds: skippedList.map(f => f.id)
      }
    }

    try {
      const res = await fetch("/api/v1/sessions/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          action: "completed",
          answers: payloadAnswers,
          textScores: textScores,
          isPendingScoring: isPending,
          deviceInfo: typeof window !== "undefined" ? window.navigator.userAgent : "kiosk_tablet",
        }),
      })

      if (!res.ok) throw new Error(t("errorSubmit"))
      const data = await res.json()
      
      if (data.showQr) {
        setShowQr(true)
      }
      setStep("completed")
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
      isSubmittingSurvey.current = false
    }
  }

  // Abandon survey on inactivity timeout
  const handleAbandonSession = async () => {
    try {
      setStep("refused") // Show timeout/exited screen
      await fetch("/api/v1/sessions/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          action: "abandoned",
          answers: Object.keys(answers).length > 0 ? answers : null,
          deviceInfo: typeof window !== "undefined" ? window.navigator.userAgent : "kiosk_tablet",
        }),
      })
      setTimeout(() => {
        router.refresh()
      }, 3000)
    } catch (err) {
      console.error(err)
    }
  }

  // Calculations are handled server-side upon survey submission.

  // --- RENDER VIEWS ---

  if (step === "handoff") {
    return (
      <div className="flex-1 flex items-center justify-center p-4" dir={isArabic ? "rtl" : "ltr"}>
        <Card className={`${isFitToScreen ? 'max-w-none w-full' : 'max-w-2xl w-full'} border border-slate-200 shadow-xl dark:border-slate-800 rounded-3xl overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-8 md:p-12 text-center space-y-8 animate-fade-in`}>
          <div className="space-y-3">
            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              {t("handoffTitle")}
            </h2>
          </div>

          <div className="pt-2">
            <button
              onClick={() => setStep("consent")}
              className="w-full sm:w-auto min-w-[200px] px-8 py-4 text-lg font-bold bg-indigo-600 text-white rounded-2xl hover:bg-indigo-500 transition shadow-md active:scale-98 cursor-pointer"
            >
              {t("handoffButton")}
            </button>
          </div>
        </Card>
      </div>
    )
  }

  if (step === "consent") {
    return (
      <div className="flex-1 flex items-center justify-center p-4" dir={isArabic ? "rtl" : "ltr"}>
        <Card className={`${isFitToScreen ? 'max-w-none w-full' : 'max-w-2xl w-full'} border border-slate-200 shadow-xl dark:border-slate-800 rounded-3xl overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-8 md:p-12 text-center space-y-8 animate-fade-in`}>
          {plateNumber && (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold uppercase tracking-wider dark:bg-indigo-950/40 dark:border-indigo-900 dark:text-indigo-400">
              Vehicle: {plateNumber}
            </div>
          )}

          <div className="space-y-3">
            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              {t("consentTitle")}
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed max-w-md mx-auto">
              {t("consentSubtitle")}
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/50 text-xs text-slate-500 leading-relaxed text-start border border-slate-100 dark:border-slate-850">
            <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              {t("consentPrivacyTitle")}
            </span>
            {t("consentPrivacyBody")}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-2">
            <button
              onClick={handleRefuseConsent}
              disabled={refusingConsent || acceptingConsent}
              className="flex-1 px-6 py-3 text-sm font-bold border border-slate-200 text-slate-600 rounded-2xl hover:bg-slate-50 transition active:scale-98 cursor-pointer dark:border-slate-800 dark:text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
            >
              {refusingConsent ? (
                <span className="flex items-center justify-center gap-2">
                  <RefreshCw className="size-4 animate-spin" />
                  <span>{t("consentDeclining")}</span>
                </span>
              ) : (
                t("consentRefuse")
              )}
            </button>
            <button
              onClick={handleAcceptConsent}
              disabled={acceptingConsent || refusingConsent}
              className="flex-1 px-6 py-3 text-sm font-bold bg-indigo-600 text-white rounded-2xl hover:bg-indigo-500 transition shadow-md active:scale-98 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
            >
              {acceptingConsent ? (
                <span className="flex items-center justify-center gap-2">
                  <RefreshCw className="size-4 animate-spin" />
                  <span>{t("consentLoading")}</span>
                </span>
              ) : (
                t("consentAccept")
              )}
            </button>
          </div>
        </Card>
      </div>
    )
  }

  if (step === "refused") {
    return (
      <div className="flex-1 flex items-center justify-center p-4" dir={isArabic ? "rtl" : "ltr"}>
        <Card className="max-w-md w-full border border-slate-200 shadow-xl dark:border-slate-800 rounded-3xl bg-white p-8 text-center space-y-6 animate-fade-in">
          <div className="size-16 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
            <RefreshCw className="size-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {t("refusedTitle")}
            </h3>
            <p className="text-sm text-muted-foreground leading-normal">
              {t("refusedSubtitle")}
            </p>
          </div>
        </Card>
      </div>
    )
  }

  if (step === "ended") {
    let title = "";
    let description = "";
    
    if (session.status === "completed") {
      title = t("endedCompletedTitle");
      description = t("endedCompletedSubtitle");
    } else if (session.status === "refused") {
      title = t("endedRefusedTitle");
      description = t("endedRefusedSubtitle");
    } else if (session.status === "abandoned") {
      title = t("endedExpiredTitle");
      description = t("endedExpiredSubtitle");
    } else {
      title = t("endedGenericTitle");
      description = t("endedGenericSubtitle");
    }

    return (
      <div className="flex-1 flex items-center justify-center p-4" dir={isArabic ? "rtl" : "ltr"}>
        <Card className="max-w-md w-full border border-slate-200 shadow-xl dark:border-slate-800 rounded-3xl bg-white p-8 text-center space-y-6 animate-fade-in">
          <div className="size-16 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
            <AlertTriangle className="size-8 text-slate-400" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {title}
            </h3>
            <p className="text-sm text-muted-foreground leading-normal text-slate-500">
              {description}
            </p>
          </div>
        </Card>
      </div>
    )
  }

  if (step === "completed") {
    return (
      <div className="flex-1 flex items-center justify-center p-4" dir={isArabic ? "rtl" : "ltr"}>
        <Card className={`${isFitToScreen ? 'max-w-none w-full' : 'max-w-xl w-full'} border border-slate-200 shadow-2xl dark:border-slate-800 rounded-3xl overflow-hidden bg-white p-8 md:p-12 text-center space-y-8 animate-scale-in`}>
          <div className="size-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto dark:bg-emerald-950/40 dark:text-emerald-400">
            <ThumbsUp className="size-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {t("completedTitle")}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("completedSubtitle")}
            </p>
          </div>

          {showQr && (
            isPublic ? (
              <div className="pt-2 animate-fade-in">
                <a
                  href={facilitySettings.google_review_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 text-base font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-2xl shadow-lg transition active:scale-98 cursor-pointer"
                >
                  <ThumbsUp className="size-5" />
                  <span>{isArabic ? "اترك تقييمك على Google" : "Leave us a review on Google"}</span>
                </a>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner dark:bg-slate-950/50 dark:border-slate-850 gap-4 animate-fade-in">
                <div className="space-y-1">
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center justify-center gap-1">
                    <QrCode className="size-4 text-indigo-600" />
                    <span>{t("reviewTitle")}</span>
                  </span>
                  <p className="text-xs text-muted-foreground">
                    {t("reviewSubtitle")}
                  </p>
                </div>
                <div className="p-3 bg-white rounded-xl shadow-xs">
                  <QRCodeSVG value={facilitySettings.google_review_url} size={150} level="H" />
                </div>
              </div>
            )
          )}

          {!isPublic && (
            <div className="pt-2">
              <button
                onClick={() => router.push("/dashboard")}
                className="w-full px-6 py-3 text-sm font-bold bg-indigo-600 text-white rounded-2xl hover:bg-indigo-500 transition shadow-md active:scale-98 cursor-pointer"
              >
                {t("handbackButton")}
              </button>
            </div>
          )}
        </Card>
      </div>
    )
  }

  // Standard Form rendering
  const progressPercent = visibleFields.length > 0
    ? Math.round((currentFieldIdx / visibleFields.length) * 100)
    : 0

  return (
    <div className={`flex-1 flex flex-col justify-between p-4 md:p-8 ${isFitToScreen ? 'max-w-none w-full px-4 md:px-12' : 'max-w-4xl mx-auto w-full'} animate-fade-in`} dir={isArabic ? "rtl" : "ltr"}>
      {/* Progress Bar & Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>{t("questionCounter", { current: toArabicNumerals(currentFieldIdx + 1, isArabic ? 'ar' : 'en'), total: toArabicNumerals(visibleFields.length, isArabic ? 'ar' : 'en') })}</span>
          <span className="tabular-nums">{t("progressLabel", { percent: toArabicNumerals(progressPercent, isArabic ? 'ar' : 'en') })}</span>
        </div>
        <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-600 transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Main Question Card */}
      <div className="flex-1 flex items-center justify-center py-8">
        <Card className="w-full border border-slate-200 shadow-lg dark:border-slate-800 rounded-2xl bg-white p-6 md:p-10 space-y-8">
          {showClosingLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <Loader2 className="size-6 text-indigo-600 animate-spin" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {isArabic ? "لحظة من فضلك..." : "Just a moment..."}
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2 text-center md:text-start">
                <h3 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {isArabic && currentField.ar?.label ? currentField.ar.label : currentField.label}
                </h3>
              </div>

              {/* Render inputs matching currentField.type */}
              <div className="flex items-center justify-center w-full">
                {currentField.type === "star_rating" && (() => {
                  const emojiScale = ['😞', '😕', '😐', '🙂', '😄']
                  const currentAnswer = answers[currentField.id]
                  return (
                    <div className="flex items-center justify-center gap-3 py-6" dir={isArabic ? "rtl" : "ltr"}>
                      {emojiScale.map((emoji, idx) => {
                        const ratingValue = idx + 1
                        const isSelected = currentAnswer === ratingValue
                        return (
                          <button
                            key={ratingValue}
                            type="button"
                            disabled={submitting}
                            onClick={() => handleAnswer(ratingValue, true)}
                            className={`
                              flex items-center justify-center
                              w-14 h-14 rounded-full border transition-all
                              active:scale-90 text-3xl
                              disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
                              ${isSelected
                                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950 scale-110 shadow-md'
                                : 'border-slate-200 dark:border-slate-800 hover:border-indigo-300 hover:scale-105'
                              }
                            `}
                          >
                            {emoji}
                          </button>
                        )
                      })}
                    </div>
                  )
                })()}

                {currentField.type === "numeric_scale" && (() => {
                  const currentAnswer = answers[currentField.id]
                  return (
                    <div className="flex flex-wrap gap-2 justify-center py-6 w-full" dir={isArabic ? "rtl" : "ltr"}>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                        const isSelected = currentAnswer === num
                        return (
                          <button
                            key={num}
                            type="button"
                            disabled={submitting}
                            onClick={() => handleAnswer(num, true)}
                            className={`
                              flex items-center justify-center
                              w-10 h-10 rounded-lg text-sm font-semibold transition-all
                              active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
                              ${isSelected
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'border border-slate-300 text-slate-700 bg-white hover:border-indigo-500 hover:text-indigo-600'
                              }
                            `}
                          >
                            {toArabicNumerals(num, isArabic ? 'ar' : 'en')}
                          </button>
                        )
                      })}
                    </div>
                  )
                })()}

                {currentField.type === "multiple_choice" && (
                  <div className={`flex flex-col gap-3 w-full py-4 ${isArabic ? 'items-end' : 'items-start'}`}>
                    {(isArabic && currentField.ar?.options?.length
                      ? currentField.ar.options
                      : currentField.options
                    ).map((option: string, idx: number) => {
                      const englishValue = currentField.options[idx]
                      const currentAnswer = answers[currentField.id]
                      const isSelected = currentAnswer === englishValue
                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={submitting}
                          onClick={submitting ? undefined : () => handleAnswer(englishValue, true)}
                          className={`
                            w-full px-5 py-4 rounded-xl border text-left transition-all
                            disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
                            active:scale-[0.99]
                            ${isArabic ? 'text-right' : 'text-left'}
                            ${isSelected
                              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-medium'
                              : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-indigo-300 hover:bg-slate-50 dark:hover:bg-slate-900'
                            }
                          `}
                        >
                          {option}
                        </button>
                      )
                    })}
                  </div>
                )}

                {currentField.type === "text" && (
                  <div className="space-y-4 w-full py-2">
                    <textarea
                      rows={4}
                      value={textVal}
                      onChange={(e) => setTextVal(e.target.value)}
                      placeholder={t("textPlaceholder")}
                      disabled={submitting}
                      className="flex w-full rounded-xl border border-slate-250 bg-transparent px-4 py-3 text-base shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800"
                    />
                  </div>
                )}
              </div>

              {/* Action Buttons: Left = Skip (light/subtle), Right = Next */}
              <div className="flex items-center justify-between w-full pt-4 border-t border-slate-100 dark:border-slate-800 mt-2" dir="ltr">
                {/* Left: Skip button (subtle, light design) */}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleSkip}
                  disabled={submitting}
                  className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 text-xs sm:text-sm font-normal cursor-pointer"
                >
                  <span>{t("skipButton")}</span>
                </Button>

                {/* Right: Next button */}
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={submitting}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5 h-11 px-6 rounded-xl shadow-xs cursor-pointer"
                >
                  {submitting ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    <>
                      <span>{t("nextButton")}</span>
                      <ArrowRight className={`size-4 ${isArabic ? 'rotate-180' : ''}`} />
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Footer Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-850 pt-4 shrink-0">
        <Button
          onClick={handleBack}
          disabled={submitting || currentFieldIdx === 0}
          variant="ghost"
          className="text-slate-500 hover:text-slate-700 disabled:opacity-30 flex items-center gap-1 h-9 rounded-lg"
        >
          <ChevronLeft className="size-4" />
          <span>{t("backButton")}</span>
        </Button>
        <span className="text-xs text-muted-foreground">{t("footerWatermark")}</span>
      </div>

      {/* 10-Second Idle Warning Modal */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="max-w-sm w-full border border-rose-100 shadow-2xl dark:border-rose-950 rounded-2xl bg-white p-6 text-center space-y-6 animate-scale-in">
            <div className="size-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto dark:bg-rose-950/40 dark:text-rose-400">
              <AlertTriangle className="size-6 animate-bounce" />
            </div>

            <div className="space-y-1">
              <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {t("idleTitle")}
              </h4>
              <p className="text-xs text-muted-foreground">
                {t("idleSubtitle", { seconds: toArabicNumerals(warningCount, isArabic ? 'ar' : 'en') })}
              </p>
            </div>

            <Button
              onClick={resetTimer}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold h-11 rounded-xl"
            >
              {t("idleButton")}
            </Button>
          </Card>
        </div>
      )}
    </div>
  )
}
