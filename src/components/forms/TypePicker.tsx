"use client"

import * as React from "react"
import { FileText, GitBranch, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export interface FormType {
  id: string
  name: string
  description: string
  is_implemented: boolean
  enabled: boolean
  sort_order: number
}

interface TypePickerProps {
  types: FormType[]
  onSelect: (typeId: string) => void
}

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  standard: FileText,
  smart: GitBranch,
  ai: Sparkles,
}

export function TypePicker({ types, onSelect }: TypePickerProps) {
  const t = useTranslations("Forms")

  // Sort by sort_order
  const sortedTypes = [...types].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="space-y-6">
      <div className="text-center md:text-start">
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {t("typePicker.title")}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {t("typePicker.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {sortedTypes.map((type) => {
          const Icon = ICON_MAP[type.id] || FileText
          const isSelectable = type.is_implemented

          return (
            <Card
              key={type.id}
              onClick={() => isSelectable && onSelect(type.id)}
              className={`border transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${
                isSelectable
                  ? "border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-md cursor-pointer hover:-translate-y-1 active:scale-99"
                  : "border-slate-200 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-950/10 opacity-70 cursor-not-allowed select-none"
              }`}
            >
              {/* Blur accent glow for implemented types */}
              {isSelectable && (
                <div className="absolute top-0 right-0 -mr-8 -mt-8 size-24 rounded-full bg-indigo-500/5 blur-xl group-hover:bg-indigo-500/10" />
              )}

              <CardContent className="p-6 flex flex-col gap-4 flex-1">
                {/* Header Icon & Status badges */}
                <div className="flex items-center justify-between">
                  <div
                    className={`size-10 rounded-xl flex items-center justify-center ${
                      isSelectable
                        ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400"
                        : "bg-slate-100 text-slate-400 dark:bg-slate-900 dark:text-slate-600"
                    }`}
                  >
                    <Icon className="size-5" />
                  </div>

                  {!isSelectable && (
                    <Badge className="bg-slate-200/80 text-slate-600 border-none hover:bg-slate-200/80 rounded-md font-bold px-2 py-0.5 text-[10px]">
                      {t("typePicker.comingSoon")}
                    </Badge>
                  )}
                </div>

                {/* Name & Description */}
                <div className="space-y-1.5 flex-1">
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 text-base">
                    {type.name}
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {type.description}
                  </p>
                </div>

                {/* Select visual indicator */}
                {isSelectable && (
                  <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 mt-2">
                    <span>Select</span>
                    <span className="text-[10px]">&rarr;</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
