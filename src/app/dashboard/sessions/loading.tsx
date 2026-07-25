"use client"

import { SiteHeader } from "@/components/site-header"
import { Skeleton } from "@/components/ui/skeleton"
import { useTranslations } from "next-intl"

export default function SessionsLoading() {
  const t = useTranslations("Sessions")

  return (
    <>
      <SiteHeader title={t("title")} />

      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6 bg-background text-start animate-pulse">
        {/* Header section skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-44 bg-slate-200 dark:bg-slate-800 rounded-md" />
            <Skeleton className="h-4 w-96 bg-slate-200 dark:bg-slate-800 rounded-md" />
          </div>
        </div>

        {/* Filters Toolbar skeleton */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-card shadow-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full md:max-w-3xl">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded-md" />
                <Skeleton className="h-10 w-full bg-slate-200 dark:bg-slate-800 rounded-xl" />
              </div>
            ))}
          </div>
        </div>

        {/* Table skeleton */}
        <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/10">
                  {[...Array(5)].map((_, i) => (
                    <th key={i} className="px-6 py-4 text-start">
                      <Skeleton className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded-md" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {[...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4">
                      <Skeleton className="h-4 w-40 bg-slate-200 dark:bg-slate-800 rounded-md" />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Skeleton className="h-4 w-16 bg-slate-200 dark:bg-slate-800 rounded-md m-auto" />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Skeleton className="h-5 w-24 bg-slate-200 dark:bg-slate-800 rounded-full m-auto" />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Skeleton className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded-md m-auto" />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Skeleton className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded-md m-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
