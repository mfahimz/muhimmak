"use client"

import * as React from "react"
import { useTranslations, useLocale } from "next-intl"
import { useRouter } from "next/navigation"
import { QRCodeSVG } from "qrcode.react"
import { toast } from "sonner"
import {
  Copy,
  Check,
  QrCode,
  Calendar,
  ShieldAlert,
  Sparkles,
  ExternalLink,
  RotateCw,
  FlaskConical,
  X,
  Loader2,
  AlertTriangle,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toArabicNumerals } from "@/lib/utils/arabic-numerals"

interface DailyQrClientProps {
  qrInfo: {
    current_qr_token: string | null
    qr_token_date: string | null
    is_today_valid: boolean
    qr_rotation_enabled: boolean
    feedback_url: string | null
    today_date_str: string
    holiday_info?: { isHoliday: boolean; label?: string }
  }
  canManageQr?: boolean
}

export function DailyQrClient({ qrInfo, canManageQr = false }: DailyQrClientProps) {
  const t = useTranslations("DailyQr")
  const locale = useLocale()
  const router = useRouter()

  const [copied, setCopied] = React.useState(false)
  const [testCopied, setTestCopied] = React.useState(false)

  // Test QR Modal state
  const [isTestModalOpen, setIsTestModalOpen] = React.useState(false)
  const [isGeneratingTest, setIsGeneratingTest] = React.useState(false)
  const [testQrData, setTestQrData] = React.useState<{ token: string; url: string } | null>(null)

  // Reset QR Confirm Dialog state
  const [isResetConfirmOpen, setIsResetConfirmOpen] = React.useState(false)
  const [isResetting, setIsResetting] = React.useState(false)

  const handleCopyLink = (url: string, isTest: boolean = false) => {
    if (!url) return
    navigator.clipboard.writeText(url)
    if (isTest) {
      setTestCopied(true)
      toast.success(t("linkCopied"))
      setTimeout(() => setTestCopied(false), 3000)
    } else {
      setCopied(true)
      toast.success(t("linkCopied"))
      setTimeout(() => setCopied(false), 3000)
    }
  }

  const handleGenerateTestQr = async () => {
    setIsGeneratingTest(true)
    try {
      const res = await fetch("/api/v1/qr-rotation/test", { method: "POST" })
      if (!res.ok) {
        throw new Error("Failed to generate test QR")
      }
      const data = await res.json()
      setTestQrData(data)
      setIsTestModalOpen(true)
    } catch (err) {
      console.error(err)
      toast.error(t("testQrError"))
    } finally {
      setIsGeneratingTest(false)
    }
  }

  const handleResetLiveQr = async () => {
    setIsResetting(true)
    try {
      const res = await fetch("/api/v1/qr-rotation/reset", { method: "POST" })
      if (!res.ok) {
        throw new Error("Failed to reset live QR")
      }
      toast.success(t("resetSuccess"))
      setIsResetConfirmOpen(false)
      router.refresh()
    } catch (err) {
      console.error(err)
      toast.error(t("resetError"))
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6 bg-background text-start max-w-4xl mx-auto w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <QrCode className="size-6 text-indigo-600 dark:text-indigo-400" />
            <span>{t("title")}</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t("subtitle")}
          </p>
        </div>

        {/* Date & Status Badge */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <Badge variant="outline" className="px-3 py-1 text-xs font-semibold gap-1.5 border-slate-200 dark:border-slate-800">
            <Calendar className="size-3.5 text-slate-500" />
            <span>{toArabicNumerals(qrInfo.today_date_str, locale)}</span>
          </Badge>

          {qrInfo.is_today_valid ? (
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 px-3 py-1 text-xs font-semibold">
              <Sparkles className="size-3 mr-1 inline" />
              {t("statusActive")}
            </Badge>
          ) : qrInfo.holiday_info?.isHoliday ? (
            <Badge className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 px-3 py-1 text-xs font-semibold">
              <ShieldAlert className="size-3 mr-1 inline" />
              {t("statusHoliday")} ({qrInfo.holiday_info.label || t("holiday")})
            </Badge>
          ) : !qrInfo.qr_rotation_enabled ? (
            <Badge className="bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 px-3 py-1 text-xs font-semibold">
              {t("statusDisabled")}
            </Badge>
          ) : (
            <Badge className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 px-3 py-1 text-xs font-semibold">
              {t("statusPending")}
            </Badge>
          )}
        </div>
      </div>

      {/* Admin Quick Action Controls */}
      {canManageQr && (
        <div className="flex items-center gap-3 bg-muted/40 border border-border p-3.5 px-5 rounded-2xl flex-wrap justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Sparkles className="size-4 text-indigo-500" />
            <span>Admin Control Panel</span>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGenerateTestQr}
              disabled={isGeneratingTest}
              className="text-xs h-9 px-3.5 rounded-xl font-semibold gap-1.5 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {isGeneratingTest ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <FlaskConical className="size-3.5 text-indigo-600 dark:text-indigo-400" />
              )}
              <span>{t("generateTestQr")}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsResetConfirmOpen(true)}
              className="text-xs h-9 px-3.5 rounded-xl font-semibold gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <RotateCw className="size-3.5" />
              <span>{t("resetQrNow")}</span>
            </Button>
          </div>
        </div>
      )}

      {/* Main QR Card */}
      <Card className="border border-border bg-card shadow-md rounded-3xl overflow-hidden">
        <CardHeader className="p-6 pb-4 border-b border-border bg-muted/20">
          <CardTitle className="text-lg font-bold text-foreground">
            {t("cardTitle")}
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            {t("cardDescription")}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6 md:p-8 flex flex-col items-center justify-center space-y-6 text-center">
          {qrInfo.is_today_valid && qrInfo.feedback_url ? (
            <>
              {/* QR Code Container */}
              <div className="p-6 bg-white border-2 border-dashed border-indigo-200 dark:border-indigo-900 rounded-3xl shadow-inner relative group">
                <QRCodeSVG
                  value={qrInfo.feedback_url}
                  size={240}
                  level="H"
                  includeMargin={true}
                  className="mx-auto"
                />
              </div>

              {/* URL Display & Action Bar */}
              <div className="w-full max-w-lg space-y-3">
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 px-4 shadow-xs">
                  <span className="text-xs font-mono text-slate-700 dark:text-slate-300 truncate flex-1 text-start select-all">
                    {qrInfo.feedback_url}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleCopyLink(qrInfo.feedback_url!, false)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs h-9 px-3 rounded-xl shrink-0 gap-1.5 shadow-xs"
                  >
                    {copied ? (
                      <>
                        <Check className="size-3.5" />
                        <span>{t("copied")}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" />
                        <span>{t("copyLink")}</span>
                      </>
                    )}
                  </Button>
                </div>

                <div className="flex justify-center">
                  <a
                    href={qrInfo.feedback_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                  >
                    <span>{t("openInNewTab")}</span>
                    <ExternalLink className="size-3.5" />
                  </a>
                </div>
              </div>
            </>
          ) : (
            /* Inactive / Holiday State Notice */
            <div className="py-12 px-4 max-w-md space-y-4">
              <div className="size-16 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900 flex items-center justify-center mx-auto">
                <ShieldAlert className="size-8" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-foreground">
                  {qrInfo.holiday_info?.isHoliday
                    ? t("holidayNoticeTitle")
                    : !qrInfo.qr_rotation_enabled
                    ? t("disabledNoticeTitle")
                    : t("pendingNoticeTitle")}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {qrInfo.holiday_info?.isHoliday
                    ? t("holidayNoticeDesc", { holiday: qrInfo.holiday_info.label || t("holiday") })
                    : !qrInfo.qr_rotation_enabled
                    ? t("disabledNoticeDesc")
                    : t("pendingNoticeDesc")}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test QR Preview Modal */}
      {isTestModalOpen && testQrData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card text-card-foreground border border-border rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
                <FlaskConical className="size-5 text-indigo-600 dark:text-indigo-400" />
                <span>{t("testQrTitle")}</span>
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsTestModalOpen(false)}
                className="size-8 rounded-full"
              >
                <X className="size-4" />
              </Button>
            </div>

            {/* Test QR Notice */}
            <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-3.5 flex items-start gap-3">
              <AlertTriangle className="size-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <p className="text-xs text-indigo-950 dark:text-indigo-200 leading-relaxed">
                {t("testQrPreviewNotice")}
              </p>
            </div>

            {/* Test QR Render */}
            <div className="p-5 bg-white border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl flex justify-center">
              <QRCodeSVG value={testQrData.url} size={200} level="H" includeMargin={true} />
            </div>

            {/* Test URL & Copy */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 px-3.5">
              <span className="text-xs font-mono text-slate-700 dark:text-slate-300 truncate flex-1 text-start select-all">
                {testQrData.url}
              </span>
              <Button
                type="button"
                size="sm"
                onClick={() => handleCopyLink(testQrData.url, true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs h-8 px-3 rounded-xl shrink-0 gap-1"
              >
                {testCopied ? (
                  <>
                    <Check className="size-3.5" />
                    <span>{t("copied")}</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" />
                    <span>{t("copyLink")}</span>
                  </>
                )}
              </Button>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsTestModalOpen(false)}
                className="rounded-xl px-5 text-xs font-semibold"
              >
                {t("close")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Live QR Confirm Dialog */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card text-card-foreground border border-border rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-2xl bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 flex items-center justify-center shrink-0">
                <RotateCw className="size-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-foreground">{t("resetConfirmTitle")}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("resetConfirmDesc")}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={isResetting}
                onClick={() => setIsResetConfirmOpen(false)}
                className="rounded-xl text-xs font-semibold h-9"
              >
                {t("cancel")}
              </Button>
              <Button
                type="button"
                disabled={isResetting}
                onClick={handleResetLiveQr}
                className="bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold h-9 px-4 gap-1.5"
              >
                {isResetting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <RotateCw className="size-3.5" />
                    <span>{t("confirmReset")}</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
