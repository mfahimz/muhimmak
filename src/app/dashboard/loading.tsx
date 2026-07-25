"use client"

import { SiteHeader } from "@/components/site-header"
import { Skeleton } from "@/components/ui/skeleton"
import { useTranslations } from "next-intl"

export default function DashboardLoading() {
  const tHeader = useTranslations("Header")

  return (
    <>
      <SiteHeader title={tHeader("dashboardOverview")} />

      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6 bg-background">
        {/* Welcome Banner Skeleton */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-xs">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-7 w-56 bg-slate-200 rounded-md" />
              <Skeleton className="h-4 w-96 bg-slate-200 rounded-md" />
            </div>
            <div className="mt-4 md:mt-0">
              <Skeleton className="h-6 w-32 bg-slate-200 rounded-full" />
            </div>
          </div>
        </div>

        {/* Stat Cards Grid (4 cards) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card p-5 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-32 bg-slate-200 rounded-md" />
                <Skeleton className="size-9 bg-slate-200 rounded-lg" />
              </div>
              <div className="mt-4 space-y-2">
                <Skeleton className="h-8 w-16 bg-slate-200 rounded-md" />
                <Skeleton className="h-3 w-44 bg-slate-200 rounded-md" />
              </div>
            </div>
          ))}
        </div>

        {/* Performance by Staff Table Section Skeleton */}
        <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
          <div className="border-b border-border/50 bg-muted/20 px-6 py-4 flex items-center justify-between">
            <div className="space-y-1">
              <Skeleton className="h-5 w-40 bg-slate-200 rounded-md" />
              <Skeleton className="h-3 w-64 bg-slate-200 rounded-md" />
            </div>
            <Skeleton className="h-4 w-24 bg-slate-200 rounded-md" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm border-collapse">
              <thead>
                <tr className="border-b border-border/55 bg-muted/10 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  <th className="px-6 py-3.5 text-start">
                    <Skeleton className="h-4 w-24 bg-slate-200 rounded-md" />
                  </th>
                  <th className="px-6 py-3.5 text-center">
                    <Skeleton className="h-4 w-28 bg-slate-200 rounded-md" />
                  </th>
                  <th className="px-6 py-3.5 text-end">
                    <Skeleton className="h-4 w-24 bg-slate-200 rounded-md" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {[...Array(3)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4">
                      <Skeleton className="h-4 w-36 bg-slate-200 rounded-md" />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Skeleton className="h-4 w-12 bg-slate-200 rounded-md" />
                    </td>
                    <td className="px-6 py-4 text-end">
                      <Skeleton className="h-4 w-10 bg-slate-200 rounded-md" />
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
