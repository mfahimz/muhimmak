"use client"

import * as React from "react"
import { useTranslations, useLocale } from "next-intl"
import { QRCodeSVG } from "qrcode.react"
import { toast } from "sonner"
import { Copy, Check, QrCode, Calendar, ShieldAlert, Sparkles, ExternalLink } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

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
}

export function DailyQrClient({ qrInfo }: DailyQrClientProps) {
  const t = useTranslations("DailyQr")
  const locale = useLocale()
  const [copied, setCopied] = React.useState(false)

  const handleCopyLink = () => {
    if (!qrInfo.feedback_url) return
    navigator.clipboard.writeText(qrInfo.feedback_url)
    setCopied(true)
    toast.success(t("linkCopied"))
    setTimeout(() => setCopied(false), 3000)
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
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Badge variant="outline" className="px-3 py-1 text-xs font-semibold gap-1.5 border-slate-200 dark:border-slate-800">
            <Calendar className="size-3.5 text-slate-500" />
            <span>{qrInfo.today_date_str}</span>
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
            <Badge className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 px-3 py-1 text-xs font-semibold">
              {t("statusPending")}
            </Badge>
          )}
        </div>
      </div>

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
                    onClick={handleCopyLink}
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
    </div>
  )
}
