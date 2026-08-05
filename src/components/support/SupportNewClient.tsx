"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle2, LifeBuoy, AlertCircle, PlusCircle } from "lucide-react"

export function SupportNewClient() {
  const t = useTranslations("Support")

  const [rawInput, setRawInput] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [submittedTicketId, setSubmittedTicketId] = React.useState<string | null>(null)

  // Auto detect Arabic text for RTL alignment
  const isArabic = React.useMemo(() => {
    return /[\u0600-\u06FF]/.test(rawInput)
  }, [rawInput])

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    if (val.length <= 2000) {
      setRawInput(val)
      if (errorMessage) setErrorMessage(null)
    }
  }

  const handleSubmit = async () => {
    if (!rawInput.trim()) {
      setErrorMessage(t("placeholder"))
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const response = await fetch("/api/v1/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawInput }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to submit support ticket")
      }

      setSubmittedTicketId(data.ticketId)
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReset = () => {
    setRawInput("")
    setSubmittedTicketId(null)
    setErrorMessage(null)
  }

  return (
    <div className="container max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl text-indigo-600 dark:text-indigo-400">
              <LifeBuoy className="size-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {t("newTicketTitle")}
              </CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
                {t("pageTitle")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {submittedTicketId ? (
            <div className="py-8 flex flex-col items-center text-center space-y-4">
              <div className="size-14 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center animate-in zoom-in-95 duration-200">
                <CheckCircle2 className="size-8" />
              </div>
              <div className="space-y-1 max-w-md">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {t("successTitle")}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {t("successMessage")}
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-lg text-xs font-mono text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <span className="text-slate-400 font-sans uppercase font-semibold">{t("ticketId")}:</span>
                <span className="font-bold">{submittedTicketId}</span>
              </div>

              <div className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  className="gap-2"
                >
                  <PlusCircle className="size-4" />
                  <span>{t("submitBtn")}</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {errorMessage && (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs font-medium text-rose-700 dark:text-rose-300 flex items-center gap-2.5">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="space-y-2">
                <textarea
                  rows={7}
                  dir={isArabic ? "rtl" : "ltr"}
                  value={rawInput}
                  onChange={handleTextChange}
                  placeholder={t("placeholder")}
                  disabled={isSubmitting}
                  className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-y min-h-[160px]"
                />

                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{isArabic ? "Arabic detected" : "English detected"}</span>
                  <span>
                    {t("charCount", { current: rawInput.length, max: 2000 })}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !rawInput.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 px-6 h-10 rounded-lg font-medium shadow-sm transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>{t("submitBtn")}...</span>
                    </>
                  ) : (
                    <span>{t("submitBtn")}</span>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
