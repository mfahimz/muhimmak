"use client"

import * as React from "react"

interface AnnouncementCardProps {
  title: string
  body: string
  imageUrl?: string | null
}

export function AnnouncementCard({ title, body, imageUrl }: AnnouncementCardProps) {
  return (
    <div className="pt-4 animate-fade-in">
      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {imageUrl && (
          <div className="w-full h-48 bg-slate-100 dark:bg-slate-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-6 text-center space-y-3">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{body}</p>
        </div>
      </div>
    </div>
  )
}
