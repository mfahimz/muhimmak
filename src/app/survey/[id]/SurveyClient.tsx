"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useIdleTimer } from "@/hooks/useIdleTimer"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, AlertTriangle, ArrowRight, RefreshCw, QrCode, ThumbsUp } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"

export interface SurveyField {
  id: string
  type: "star_rating" | "text" | "multiple_choice"
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
}

export interface SurveySession {
  id: string
  form_id: string
  location_id: string | null
  status: string
  language: string
  plate_number_encrypted: string | null
}

interface SurveyClientProps {
  session: SurveySession
  form: {
    id: string
    name: string
    description: string
    fields: any
  }
  facilitySettings: {
    google_review_url: string
    review_qr_threshold_percent: number
  }
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

export function SurveyClient({ session, form, facilitySettings }: SurveyClientProps) {
  const router = useRouter()
  const t = useTranslations("Survey")
  
  // Parse fields
  const fields = React.useMemo(() => {
    if (Array.isArray(form.fields)) {
      return form.fields as SurveyField[]
    }
    return []
  }, [form.fields])

  const isArabic = session.language === 'ar'

  // UI state
  const [step, setStep] = React.useState<"handoff" | "consent" | "survey" | "refused" | "completed" | "ended">(() => {
    if (session.status === "refused" || session.status === "completed" || session.status === "abandoned") return "ended"
    return "handoff"
  })
  const [currentFieldIdx, setCurrentFieldIdx] = React.useState(0)
  const [answers, setAnswers] = React.useState<Record<string, any>>({})
  const [textVal, setTextVal] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [showQr, setShowQr] = React.useState(false)

  const visibleFields = React.useMemo(() => {
    return fields.filter(f => isFieldVisible(f, answers))
  }, [fields, answers])

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

  // Idle timer hook
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
    enabled: step === "survey",
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
    const currentField = visibleFields[currentFieldIdx]
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

    if (autoAdvance) {
      const updatedAnswers = { ...answers, [currentField.id]: val }
      const nextVisibleFields = fields.filter(f => isFieldVisible(f, updatedAnswers))
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

    try {
      const res = await fetch("/api/v1/sessions/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          action: "completed",
          answers: finalAnswers,
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
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full border border-slate-200 shadow-xl dark:border-slate-800 rounded-3xl overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-8 md:p-12 text-center space-y-8 animate-fade-in">
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
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full border border-slate-200 shadow-xl dark:border-slate-800 rounded-3xl overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-8 md:p-12 text-center space-y-8 animate-fade-in">
          {session.plate_number_encrypted && (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold uppercase tracking-wider dark:bg-indigo-950/40 dark:border-indigo-900 dark:text-indigo-400">
              Vehicle: {session.plate_number_encrypted}
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
      <div className="flex-1 flex items-center justify-center p-4">
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
      <div className="flex-1 flex items-center justify-center p-4">
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
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="max-w-xl w-full border border-slate-200 shadow-2xl dark:border-slate-800 rounded-3xl overflow-hidden bg-white p-8 md:p-12 text-center space-y-8 animate-scale-in">
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
          )}

          <div className="pt-2">
            <button
              onClick={() => router.push("/dashboard")}
              className="w-full px-6 py-3 text-sm font-bold bg-indigo-600 text-white rounded-2xl hover:bg-indigo-500 transition shadow-md active:scale-98 cursor-pointer"
            >
              {t("handbackButton")}
            </button>
          </div>
        </Card>
      </div>
    )
  }

  // Standard Form rendering
  const currentField = visibleFields[currentFieldIdx]
  const progressPercent = visibleFields.length > 0
    ? Math.round((currentFieldIdx / visibleFields.length) * 100)
    : 0

  return (
    <div className="flex-1 flex flex-col justify-between p-4 md:p-8 max-w-4xl mx-auto w-full animate-fade-in">
      {/* Progress Bar & Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>{t("questionCounter", { current: currentFieldIdx + 1, total: visibleFields.length })}</span>
          <span className="tabular-nums">{t("progressLabel", { percent: progressPercent })}</span>
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
          <div className="space-y-2 text-center md:text-start">
            <h3 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">
              {isArabic && currentField.ar?.label ? currentField.ar.label : currentField.label}
              <span className="text-rose-500 ml-1">*</span>
            </h3>
          </div>

          {/* Render inputs matching currentField.type */}
          <div className="flex items-center justify-center w-full">
            {currentField.type === "star_rating" && (() => {
              const emojiScale = ['😞', '😕', '😐', '🙂', '😄']
              const displayScale = isArabic ? [...emojiScale].reverse() : emojiScale
              const currentAnswer = answers[currentField.id]
              return (
                <div className="flex items-center justify-center gap-3 py-6">
                  {displayScale.map((emoji, displayIdx) => {
                    const ratingValue = isArabic ? (5 - displayIdx) : (displayIdx + 1)
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

            {currentField.type === "multiple_choice" && (
              <div className={`flex flex-col gap-3 w-full py-4 ${isArabic ? 'items-end' : 'items-start'}`}>
                {(isArabic && currentField.ar?.options?.length
                  ? currentField.ar.options
                  : currentField.options
                ).map((option, idx) => {
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
                <div className="flex justify-end">
                  <Button
                    onClick={handleTextSubmit}
                    disabled={submitting || !textVal.trim()}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5 h-11 px-6 rounded-xl shadow-xs"
                  >
                    {submitting ? (
                      <RefreshCw className="size-4 animate-spin" />
                    ) : (
                      <>
                        <span>{t("nextButton")}</span>
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
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
                {t("idleSubtitle", { seconds: warningCount })}
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
