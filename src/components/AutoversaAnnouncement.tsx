"use client"

import * as React from "react"
import { ShieldCheck, Car } from "lucide-react"
import { useTranslations } from "next-intl"

interface AutoversaAnnouncementProps {
  title_en: string
  title_ar: string
  body_en: string
  body_ar: string
  imageUrl?: string | null
  isArabic: boolean
}

export function AutoversaAnnouncement({ title_en, title_ar, body_en, body_ar, imageUrl, isArabic }: AutoversaAnnouncementProps) {
  const t = useTranslations("Survey")
  const title = isArabic ? title_ar : title_en
  const body = isArabic ? body_ar : body_en

  return (
    <div className="pt-6 animate-fade-in">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700 shadow-2xl">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-blue-500 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-white blur-3xl" />
        </div>

        <div className="relative px-8 py-10 md:px-12 md:py-12 text-center space-y-6">
          {imageUrl ? (
            <div className="mx-auto max-w-[220px] max-h-24 p-2.5 rounded-2xl bg-white/95 shadow-lg border border-white/40 flex items-center justify-center overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="Announcement" className="max-h-16 w-auto max-w-full object-contain" />
            </div>
          ) : (
            <div className="mx-auto w-20 h-20 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              <Car className="size-10 text-white" />
            </div>
          )}

          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold uppercase tracking-wider">
              <ShieldCheck className="size-3.5" />
              {t("announcementNewLaunch")}
            </div>
            <h3 className="text-2xl md:text-3xl font-bold text-white leading-tight">{title}</h3>
          </div>

          <p className="text-sm md:text-base text-slate-300 leading-relaxed max-w-lg mx-auto">{body}</p>

          <div className="flex items-center justify-center gap-3 pt-2">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-slate-500" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
              {t("announcementBrand")}
            </span>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-slate-500" />
          </div>
        </div>
      </div>
    </div>
  )
}
