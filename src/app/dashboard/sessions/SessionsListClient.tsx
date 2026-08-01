"use client"

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
import { toArabicNumerals } from "@/lib/utils/arabic-numerals"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar, Filter, ArrowLeft, ArrowRight, ClipboardList } from "lucide-react"

export interface SessionItem {
  id: string
  created_by: string
  form_id: string
  location_id: string | null
  status: string
  plate_number: string | null
  consent_given: boolean | null
  language: string | null
  started_at: string
  completed_at: string | null
  refused_at: string | null
  created_at: string
  updated_at: string
  forms: {
    name: string
  } | null
}

interface SessionsListClientProps {
  sessions: SessionItem[]
  role: string
  totalCount: number
  currentPage: number
  pageSize: number
  filters: {
    status: string
    from: string
    to: string
  }
}

export function SessionsListClient({
  sessions,
  role,
  totalCount,
  currentPage,
  pageSize,
  filters,
}: SessionsListClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations("Sessions")
  const locale = useLocale()

  const [statusVal, setStatusVal] = React.useState(filters.status)
  const [fromVal, setFromVal] = React.useState(filters.from)
  const [toVal, setToVal] = React.useState(filters.to)

  // Sync state with incoming props (e.g. on navigation back/forward)
  React.useEffect(() => {
    setStatusVal(filters.status)
  }, [filters.status])

  React.useEffect(() => {
    setFromVal(filters.from)
  }, [filters.from])

  React.useEffect(() => {
    setToVal(filters.to)
  }, [filters.to])

  const showPlateNumber = role !== "manager" && role !== "receptionist"

  const updateUrl = (newFilters: { status?: string; from?: string; to?: string; page?: string }) => {
    const params = new URLSearchParams()

    const currentStatus = newFilters.status !== undefined ? newFilters.status : statusVal
    const currentFrom = newFilters.from !== undefined ? newFilters.from : fromVal
    const currentTo = newFilters.to !== undefined ? newFilters.to : toVal

    const isFilterChange =
      newFilters.status !== undefined || newFilters.from !== undefined || newFilters.to !== undefined

    const nextPage = isFilterChange ? "1" : (newFilters.page || String(currentPage))

    if (currentStatus) params.set("status", currentStatus)
    if (currentFrom) params.set("from", currentFrom)
    if (currentTo) params.set("to", currentTo)
    if (nextPage && nextPage !== "1") params.set("page", nextPage)

    router.push(`${pathname}?${params.toString()}`)
  }

  const handleStatusChange = (val: string) => {
    setStatusVal(val)
    updateUrl({ status: val })
  }

  const handleFromChange = (val: string) => {
    setFromVal(val)
    updateUrl({ from: val })
  }

  const handleToChange = (val: string) => {
    setToVal(val)
    updateUrl({ to: val })
  }

  const handleClearFilters = () => {
    setStatusVal("")
    setFromVal("")
    setToVal("")
    router.push(pathname)
  }

  const hasActiveFilters = filters.status || filters.from || filters.to

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "—"
    const formatted = new Date(dateStr).toLocaleString(locale === "ar" ? "ar-AE" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
    return toArabicNumerals(formatted, locale)
  }

  const getEndedAt = (session: SessionItem) => {
    if (session.status === "completed") return formatDateTime(session.completed_at)
    if (session.status === "refused") return formatDateTime(session.refused_at)
    return "—"
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "started":
        return (
          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200/50">
            {t("filterStarted")}
          </span>
        )
      case "completed":
        return (
          <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-100/50">
            {t("filterCompleted")}
          </span>
        )
      case "refused":
        return (
          <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 border border-rose-100/50">
            {t("filterRefused")}
          </span>
        )
      case "abandoned":
        return (
          <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-100/50">
            {t("filterAbandoned")}
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200/50">
            {status}
          </span>
        )
    }
  }

  const hasNextPage = sessions.length === pageSize && (currentPage * pageSize) < totalCount
  const hasPrevPage = currentPage > 1

  return (
    <div className="space-y-6">
      {/* Filters toolbar */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-card shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full md:max-w-3xl">
          {/* Status Select */}
          <div className="space-y-1.5 text-start">
            <label htmlFor="status-filter" className="text-xs font-bold uppercase text-slate-400 tracking-wider">
              {t("filterStatus")}
            </label>
            <div className="relative">
              <select
                id="status-filter"
                value={statusVal}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="w-full h-10 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-background text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/80 transition-all appearance-none"
              >
                <option value="">{t("filterAll")}</option>
                <option value="started">{t("filterStarted")}</option>
                <option value="completed">{t("filterCompleted")}</option>
                <option value="refused">{t("filterRefused")}</option>
                <option value="abandoned">{t("filterAbandoned")}</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
                <Filter className="size-4" />
              </div>
            </div>
          </div>

          {/* Date From */}
          <div className="space-y-1.5 text-start">
            <label htmlFor="from-filter" className="text-xs font-bold uppercase text-slate-400 tracking-wider">
              {t("filterDateFrom")}
            </label>
            <div className="relative">
              <Input
                id="from-filter"
                type="date"
                value={fromVal}
                onChange={(e) => handleFromChange(e.target.value)}
                className="h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-indigo-500/20 rounded-xl pr-10 text-sm"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                <Calendar className="size-4" />
              </div>
            </div>
          </div>

          {/* Date To */}
          <div className="space-y-1.5 text-start">
            <label htmlFor="to-filter" className="text-xs font-bold uppercase text-slate-400 tracking-wider">
              {t("filterDateTo")}
            </label>
            <div className="relative">
              <Input
                id="to-filter"
                type="date"
                value={toVal}
                onChange={(e) => handleToChange(e.target.value)}
                className="h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-indigo-500/20 rounded-xl pr-10 text-sm"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                <Calendar className="size-4" />
              </div>
            </div>
          </div>
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            onClick={handleClearFilters}
            className="text-xs font-semibold text-rose-500 hover:text-rose-600 hover:bg-rose-50/50 dark:hover:bg-rose-950/10 h-10 px-4 rounded-xl shrink-0"
          >
            {t("clearFilters")}
          </Button>
        )}
      </div>

      {/* Table section */}
      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-card py-20 px-4 text-center animate-fade-in">
          <div className="size-16 rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400 mb-4">
            <ClipboardList className="size-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{t("title")}</h3>
          <p className="text-sm text-slate-500 max-w-sm mt-1">
            {t("noSessions")}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/10 text-xs font-bold text-muted-foreground uppercase tracking-wider select-none">
                  <th className="px-6 py-4 text-start font-semibold">{t("colForm")}</th>
                  <th className="px-6 py-4 text-center font-semibold">{t("colLanguage")}</th>
                  <th className="px-6 py-4 text-center font-semibold">{t("colStatus")}</th>
                  <th className="px-6 py-4 text-center font-semibold">{t("colStarted")}</th>
                  <th className="px-6 py-4 text-center font-semibold">{t("colEnded")}</th>
                  {showPlateNumber && (
                    <th className="px-6 py-4 text-start font-semibold">{t("colPlate")}</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {sessions.map((session) => {
                  const formName = session.forms?.name || t("formFallback")
                  const langDisplay = session.language === "ar" ? t("languageArabicDisplay") : t("languageEnglishDisplay")

                  return (
                    <tr
                      key={session.id}
                      onClick={() => router.push(`/dashboard/sessions/${session.id}`)}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors duration-150 cursor-pointer"
                    >
                      <td className="px-6 py-4 text-start">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {formName}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center whitespace-nowrap text-slate-600 dark:text-slate-400">
                        {langDisplay}
                      </td>
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        {getStatusBadge(session.status)}
                      </td>
                      <td className="px-6 py-4 text-center tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {formatDateTime(session.started_at)}
                      </td>
                      <td className="px-6 py-4 text-center tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {getEndedAt(session)}
                      </td>
                      {showPlateNumber && (
                        <td className="px-6 py-4 text-start font-medium text-slate-700 dark:text-slate-300">
                          {session.plate_number || <span className="text-slate-400">—</span>}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination controls */}
      {(hasPrevPage || hasNextPage) && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="text-xs text-muted-foreground select-none">
            {t("paginationShowing")} <span className="font-semibold text-foreground">{toArabicNumerals(currentPage, locale)}</span> {t("paginationOf")}{" "}
            <span className="font-semibold text-foreground">
              {toArabicNumerals(Math.max(1, Math.ceil(totalCount / pageSize)), locale)}
            </span>{" "}
            ({toArabicNumerals(totalCount, locale)} {t("paginationItems")})
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!hasPrevPage}
              onClick={() => updateUrl({ page: String(currentPage - 1) })}
              className="border-slate-200 dark:border-slate-800 h-9 rounded-xl px-4 text-xs font-semibold"
            >
              <ArrowLeft className="size-3.5 mr-1.5" />
              {t("paginationPrev")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasNextPage}
              onClick={() => updateUrl({ page: String(currentPage + 1) })}
              className="border-slate-200 dark:border-slate-800 h-9 rounded-xl px-4 text-xs font-semibold"
            >
              {t("paginationNext")}
              <ArrowRight className="size-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
