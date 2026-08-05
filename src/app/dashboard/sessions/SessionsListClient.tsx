"use client"

import * as React from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
import { toArabicNumerals } from "@/lib/utils/arabic-numerals"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import {
  Calendar,
  Filter,
  ArrowLeft,
  ArrowRight,
  ClipboardList,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Globe,
  Car,
  Plus,
  X,
  ChevronRight,
  FileText,
  Lock,
  Trash2,
  Loader2,
} from "lucide-react"
import { PendingClosuresClient, type PendingClosureItem } from "../pending-closures/PendingClosuresClient"

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

export interface SessionMetrics {
  total: number
  completed: number
  refused: number
  abandoned: number
}

interface SessionsListClientProps {
  sessions: SessionItem[]
  closures: PendingClosureItem[]
  role: string
  currentUserId: string
  totalCount: number
  currentPage: number
  pageSize: number
  filters: {
    status: string
    from: string
    to: string
  }
  metrics?: SessionMetrics
  initialTab?: string
}

export function SessionsListClient({
  sessions,
  closures,
  role,
  currentUserId,
  totalCount,
  currentPage,
  pageSize,
  filters,
  metrics,
  initialTab = "all",
}: SessionsListClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const t = useTranslations("Sessions")
  const locale = useLocale()

  const canDelete = role === "super_admin" || role === "ceo"
  const [localSessions, setLocalSessions] = React.useState(sessions)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)

  // Sync local sessions with prop changes (e.g. pagination / filter changes)
  React.useEffect(() => {
    setLocalSessions(sessions)
  }, [sessions])

  const handleDeleteSession = async (sessionId: string) => {
    setDeletingId(sessionId)
    try {
      const res = await fetch(`/api/v1/sessions/${sessionId}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to delete session")
      }
      setLocalSessions((prev) => prev.filter((s) => s.id !== sessionId))
      toast.success("Session deleted successfully")
    } catch (err: any) {
      console.error("Delete session error:", err)
      toast.error(err.message || "Failed to delete session")
    } finally {
      setDeletingId(null)
    }
  }

  const [activeTab, setActiveTab] = React.useState<"all" | "open-visits">(
    initialTab === "open-visits" ? "open-visits" : "all"
  )

  const [statusVal, setStatusVal] = React.useState("")
  const [fromVal, setFromVal] = React.useState(filters.from)
  const [toVal, setToVal] = React.useState(filters.to)
  const [searchQuery, setSearchQuery] = React.useState("")

  // Sync state with incoming props
  React.useEffect(() => {
    if (initialTab === "open-visits") {
      setActiveTab("open-visits")
    } else {
      setActiveTab("all")
    }
  }, [initialTab])

  React.useEffect(() => {
    setFromVal(filters.from)
  }, [filters.from])

  React.useEffect(() => {
    setToVal(filters.to)
  }, [filters.to])

  const showPlateNumber = role !== "manager" && role !== "receptionist"

  const handleTabChange = (newTab: "all" | "open-visits") => {
    setActiveTab(newTab)
    const params = new URLSearchParams(searchParams ? searchParams.toString() : "")
    if (newTab === "open-visits") {
      params.set("tab", "open-visits")
    } else {
      params.delete("tab")
    }
    const queryString = params.toString()
    router.push(`${pathname}${queryString ? `?${queryString}` : ""}`)
  }

  const updateUrl = (newFilters: { from?: string; to?: string; page?: string }) => {
    const params = new URLSearchParams(searchParams ? searchParams.toString() : "")

    const currentFrom = newFilters.from !== undefined ? newFilters.from : fromVal
    const currentTo = newFilters.to !== undefined ? newFilters.to : toVal

    const isFilterChange = newFilters.from !== undefined || newFilters.to !== undefined

    const nextPage = isFilterChange ? "1" : (newFilters.page || String(currentPage))

    // Remove status param from URL since status filtering is client-side state
    params.delete("status")

    if (currentFrom) params.set("from", currentFrom)
    else params.delete("from")

    if (currentTo) params.set("to", currentTo)
    else params.delete("to")

    if (nextPage && nextPage !== "1") params.set("page", nextPage)
    else params.delete("page")

    if (activeTab === "open-visits") {
      params.set("tab", "open-visits")
    }

    const queryString = params.toString()
    router.push(`${pathname}${queryString ? `?${queryString}` : ""}`)
  }

  const handleStatusChange = (val: string) => {
    setStatusVal(val)
  }

  const handleFromChange = (val: string) => {
    setFromVal(val)
    updateUrl({ from: val })
  }

  const handleToChange = (val: string) => {
    setToVal(val)
    updateUrl({ to: val })
  }

  const handleDatePreset = (preset: "today" | "yesterday" | "7d") => {
    const now = new Date()
    let fromStr = ""
    let toStr = ""

    if (preset === "today") {
      const today = now.toISOString().split("T")[0]
      fromStr = today
      toStr = today
    } else if (preset === "yesterday") {
      const yestDate = new Date()
      yestDate.setDate(now.getDate() - 1)
      const yest = yestDate.toISOString().split("T")[0]
      fromStr = yest
      toStr = yest
    } else if (preset === "7d") {
      const to = new Date().toISOString().split("T")[0]
      const fromDate = new Date()
      fromDate.setDate(fromDate.getDate() - 6)
      const from = fromDate.toISOString().split("T")[0]
      fromStr = from
      toStr = to
    }

    setFromVal(fromStr)
    setToVal(toStr)
    updateUrl({ from: fromStr, to: toStr })
  }

  const handleClearFilters = () => {
    setStatusVal("")
    setFromVal("")
    setToVal("")
    setSearchQuery("")
    const params = new URLSearchParams()
    if (activeTab === "open-visits") params.set("tab", "open-visits")
    const queryString = params.toString()
    router.push(`${pathname}${queryString ? `?${queryString}` : ""}`)
  }

  const hasActiveFilters = Boolean(statusVal || filters.from || filters.to || searchQuery)

  // Filter client-side by statusVal and instant search query
  const filteredSessions = React.useMemo(() => {
    return localSessions.filter((s) => {
      if (statusVal) {
        if (statusVal === "abandoned") {
          if (s.status !== "abandoned" && s.status !== "started") return false
        } else if (s.status !== statusVal) {
          return false
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase()
        const formName = (s.forms?.name || "").toLowerCase()
        const plate = (s.plate_number || "").toLowerCase()
        const lang = (s.language || "").toLowerCase()
        const id = s.id.toLowerCase()
        if (!formName.includes(q) && !plate.includes(q) && !lang.includes(q) && !id.includes(q)) {
          return false
        }
      }

      return true
    })
  }, [localSessions, statusVal, searchQuery])

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "—"
    const formatted = new Date(dateStr).toLocaleString(locale === "ar" ? "ar-AE" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
    return toArabicNumerals(formatted, locale)
  }

  const formatDuration = (startedAt: string, endedAt: string | null) => {
    if (!endedAt) return "—"
    const start = new Date(startedAt).getTime()
    const end = new Date(endedAt).getTime()
    const diffSec = Math.max(0, Math.floor((end - start) / 1000))

    if (diffSec < 60) {
      return t("durationUnitSec", { count: toArabicNumerals(diffSec, locale) })
    }
    const minutes = Math.floor(diffSec / 60)
    const seconds = diffSec % 60
    if (minutes < 60) {
      return t("durationUnitMin", {
        count: toArabicNumerals(minutes, locale),
        sec: toArabicNumerals(seconds, locale),
      })
    }
    const hours = Math.floor(minutes / 60)
    const remainingMins = minutes % 60
    return t("durationUnitHour", {
      count: toArabicNumerals(hours, locale),
      min: toArabicNumerals(remainingMins, locale),
    })
  }

  const getEndedAt = (session: SessionItem) => {
    if (session.status === "completed") return formatDateTime(session.completed_at)
    if (session.status === "refused") return formatDateTime(session.refused_at)
    return "—"
  }

  const getDuration = (session: SessionItem) => {
    if (session.status === "completed") return formatDuration(session.started_at, session.completed_at)
    if (session.status === "refused") return formatDuration(session.started_at, session.refused_at)
    return "—"
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "started":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 text-xs font-bold text-blue-700 dark:text-blue-300 border border-blue-200/70 dark:border-blue-800 shrink-0">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-blue-500" />
            </span>
            {t("filterStarted")}
          </span>
        )
      case "completed":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800 shrink-0">
            <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            {t("filterCompleted")}
          </span>
        )
      case "refused":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 text-xs font-bold text-rose-700 dark:text-rose-300 border border-rose-200/70 dark:border-rose-800 shrink-0">
            <XCircle className="size-3.5 text-rose-600 dark:text-rose-400" />
            {t("filterRefused")}
          </span>
        )
      case "abandoned":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800 shrink-0">
            <AlertTriangle className="size-3.5 text-amber-600 dark:text-amber-400" />
            {t("filterAbandoned")}
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0">
            <Clock className="size-3.5 text-slate-500" />
            {status}
          </span>
        )
    }
  }

  const hasNextPage = sessions.length === pageSize && currentPage * pageSize < totalCount
  const hasPrevPage = currentPage > 1

  return (
    <div className="space-y-6">
      {/* KPI METRIC CARDS (INTERACTIVE FILTERS) */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* Card 1: Total Scope */}
          <button
            type="button"
            onClick={() => handleStatusChange("")}
            className={`p-4 rounded-2xl border transition-all text-start cursor-pointer select-none group ${
              statusVal === ""
                ? "bg-slate-900 text-white border-slate-900 shadow-md dark:bg-slate-800 dark:border-slate-700"
                : "bg-card border-border hover:border-slate-300 dark:hover:border-slate-700 shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-bold uppercase tracking-wider ${
                  statusVal === "" ? "text-slate-300" : "text-muted-foreground"
                }`}
              >
                {t("metricTotal")}
              </span>
              <ClipboardList
                className={`size-4 ${statusVal === "" ? "text-slate-300" : "text-slate-400"}`}
              />
            </div>
            <div className="text-2xl font-extrabold tracking-tight mt-2 tabular-nums">
              {toArabicNumerals(metrics.total, locale)}
            </div>
            <span
              className={`text-[10px] font-medium block mt-1 ${
                statusVal === "" ? "text-slate-400" : "text-muted-foreground"
              }`}
            >
              {t("metricTotalDesc")}
            </span>
          </button>

          {/* Card 2: Completed */}
          <button
            type="button"
            onClick={() => handleStatusChange("completed")}
            className={`p-4 rounded-2xl border transition-all text-start cursor-pointer select-none group ${
              statusVal === "completed"
                ? "bg-emerald-600 text-white border-emerald-600 shadow-md dark:bg-emerald-950 dark:border-emerald-700"
                : "bg-card border-border hover:border-emerald-300 dark:hover:border-emerald-800 shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-bold uppercase tracking-wider ${
                  statusVal === "completed" ? "text-emerald-100" : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {t("metricCompleted")}
              </span>
              <CheckCircle2
                className={`size-4 ${
                  statusVal === "completed" ? "text-emerald-100" : "text-emerald-500"
                }`}
              />
            </div>
            <div className="text-2xl font-extrabold tracking-tight mt-2 tabular-nums">
              {toArabicNumerals(metrics.completed, locale)}
            </div>
            <span
              className={`text-[10px] font-medium block mt-1 ${
                statusVal === "completed" ? "text-emerald-200" : "text-muted-foreground"
              }`}
            >
              {t("metricCompletedDesc")}
            </span>
          </button>

          {/* Card 3: Refused */}
          <button
            type="button"
            onClick={() => handleStatusChange("refused")}
            className={`p-4 rounded-2xl border transition-all text-start cursor-pointer select-none group ${
              statusVal === "refused"
                ? "bg-rose-600 text-white border-rose-600 shadow-md dark:bg-rose-950 dark:border-rose-700"
                : "bg-card border-border hover:border-rose-300 dark:hover:border-rose-800 shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-bold uppercase tracking-wider ${
                  statusVal === "refused" ? "text-rose-100" : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {t("metricRefused")}
              </span>
              <XCircle
                className={`size-4 ${statusVal === "refused" ? "text-rose-100" : "text-rose-500"}`}
              />
            </div>
            <div className="text-2xl font-extrabold tracking-tight mt-2 tabular-nums">
              {toArabicNumerals(metrics.refused, locale)}
            </div>
            <span
              className={`text-[10px] font-medium block mt-1 ${
                statusVal === "refused" ? "text-rose-200" : "text-muted-foreground"
              }`}
            >
              {t("metricRefusedDesc")}
            </span>
          </button>

          {/* Card 4: Abandoned / Started */}
          <button
            type="button"
            onClick={() => handleStatusChange("abandoned")}
            className={`p-4 rounded-2xl border transition-all text-start cursor-pointer select-none group ${
              statusVal === "abandoned"
                ? "bg-amber-600 text-white border-amber-600 shadow-md dark:bg-amber-950 dark:border-amber-700"
                : "bg-card border-border hover:border-amber-300 dark:hover:border-amber-800 shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-bold uppercase tracking-wider ${
                  statusVal === "abandoned" ? "text-amber-100" : "text-amber-600 dark:text-amber-400"
                }`}
              >
                {t("metricAbandoned")}
              </span>
              <AlertTriangle
                className={`size-4 ${
                  statusVal === "abandoned" ? "text-amber-100" : "text-amber-500"
                }`}
              />
            </div>
            <div className="text-2xl font-extrabold tracking-tight mt-2 tabular-nums">
              {toArabicNumerals(metrics.abandoned, locale)}
            </div>
            <span
              className={`text-[10px] font-medium block mt-1 ${
                statusVal === "abandoned" ? "text-amber-200" : "text-muted-foreground"
              }`}
            >
              {t("metricAbandonedDesc")}
            </span>
          </button>

          {/* Card 5: Open Visits */}
          <button
            type="button"
            onClick={() => handleTabChange("open-visits")}
            className={`p-4 rounded-2xl border transition-all text-start cursor-pointer select-none group col-span-2 sm:col-span-1 ${
              activeTab === "open-visits"
                ? "bg-indigo-600 text-white border-indigo-600 shadow-md dark:bg-indigo-950 dark:border-indigo-700"
                : "bg-card border-border hover:border-indigo-300 dark:hover:border-indigo-800 shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-bold uppercase tracking-wider ${
                  activeTab === "open-visits" ? "text-indigo-100" : "text-indigo-600 dark:text-indigo-400"
                }`}
              >
                {t("tabOpenVisits")}
              </span>
              <Car
                className={`size-4 ${
                  activeTab === "open-visits" ? "text-indigo-100" : "text-indigo-500"
                }`}
              />
            </div>
            <div className="text-2xl font-extrabold tracking-tight mt-2 tabular-nums">
              {toArabicNumerals(closures.length, locale)}
            </div>
            <span
              className={`text-[10px] font-medium block mt-1 ${
                activeTab === "open-visits" ? "text-indigo-200" : "text-muted-foreground"
              }`}
            >
              Vehicles awaiting survey
            </span>
          </button>
        </div>
      )}

      {/* TOP HEADER CONTROLS (TABS + START SESSION ACTION) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Tab Switcher */}
        <div className="flex bg-muted p-1 rounded-2xl border border-border w-fit font-semibold text-xs shadow-xs">
          <button
            type="button"
            onClick={() => handleTabChange("all")}
            className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === "all"
                ? "bg-background text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("tabAllSessions")}
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("open-visits")}
            className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "open-visits"
                ? "bg-background text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>{t("tabOpenVisits")}</span>
            {closures.length > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                {toArabicNumerals(closures.length, locale)}
              </span>
            )}
          </button>
        </div>

        {/* Quick Action Button */}
        <Button
          onClick={() => router.push("/dashboard/sessions/new")}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-10 px-4 rounded-xl shadow-xs flex items-center gap-2 self-start sm:self-auto cursor-pointer transition-all"
        >
          <Plus className="size-4" />
          <span>{t("quickStartSession")}</span>
        </Button>
      </div>

      {activeTab === "open-visits" ? (
        <PendingClosuresClient closures={closures} role={role} currentUserId={currentUserId} />
      ) : (
        <>
          {/* FILTERS TOOLBAR */}
          <div className="flex flex-col gap-4 p-5 rounded-2xl border border-border bg-card shadow-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
              {/* Instant Search Field */}
              <div className="space-y-1.5 text-start col-span-1 sm:col-span-2 lg:col-span-1">
                <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider block">
                  Search
                </label>
                <div className="relative">
                  <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t("searchPlaceholder")}
                    className="pl-9 pr-8 h-10 border-border bg-background rounded-xl text-sm focus-visible:ring-indigo-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Status Select */}
              <div className="space-y-1.5 text-start">
                <label htmlFor="status-filter" className="text-xs font-bold uppercase text-muted-foreground tracking-wider block">
                  {t("filterStatus")}
                </label>
                <div className="relative">
                  <select
                    id="status-filter"
                    value={statusVal}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="w-full h-10 px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:ring-2 focus:ring-indigo-500 transition-all appearance-none cursor-pointer"
                  >
                    <option value="">{t("filterAll")}</option>
                    <option value="started">{t("filterStarted")}</option>
                    <option value="completed">{t("filterCompleted")}</option>
                    <option value="refused">{t("filterRefused")}</option>
                    <option value="abandoned">{t("filterAbandoned")}</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-muted-foreground">
                    <Filter className="size-4" />
                  </div>
                </div>
              </div>

              {/* Date From */}
              <div className="space-y-1.5 text-start">
                <label htmlFor="from-filter" className="text-xs font-bold uppercase text-muted-foreground tracking-wider block">
                  {t("filterDateFrom")}
                </label>
                <div className="relative">
                  <Input
                    id="from-filter"
                    type="date"
                    value={fromVal}
                    onChange={(e) => handleFromChange(e.target.value)}
                    className="h-10 border-border bg-background focus-visible:ring-indigo-500 rounded-xl pr-10 text-sm"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-muted-foreground">
                    <Calendar className="size-4" />
                  </div>
                </div>
              </div>

              {/* Date To */}
              <div className="space-y-1.5 text-start">
                <label htmlFor="to-filter" className="text-xs font-bold uppercase text-muted-foreground tracking-wider block">
                  {t("filterDateTo")}
                </label>
                <div className="relative">
                  <Input
                    id="to-filter"
                    type="date"
                    value={toVal}
                    onChange={(e) => handleToChange(e.target.value)}
                    className="h-10 border-border bg-background focus-visible:ring-indigo-500 rounded-xl pr-10 text-sm"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-muted-foreground">
                    <Calendar className="size-4" />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Date Presets & Clear Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/50">
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <span className="text-muted-foreground uppercase text-[10px] tracking-wider mr-1">Quick Dates:</span>
                <button
                  type="button"
                  onClick={() => handleDatePreset("today")}
                  className="px-2.5 py-1 rounded-lg bg-muted hover:bg-slate-200 dark:hover:bg-slate-800 transition text-foreground"
                >
                  {t("presetToday")}
                </button>
                <button
                  type="button"
                  onClick={() => handleDatePreset("yesterday")}
                  className="px-2.5 py-1 rounded-lg bg-muted hover:bg-slate-200 dark:hover:bg-slate-800 transition text-foreground"
                >
                  {t("presetYesterday")}
                </button>
                <button
                  type="button"
                  onClick={() => handleDatePreset("7d")}
                  className="px-2.5 py-1 rounded-lg bg-muted hover:bg-slate-200 dark:hover:bg-slate-800 transition text-foreground"
                >
                  {t("preset7d")}
                </button>
              </div>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  onClick={handleClearFilters}
                  className="text-xs font-semibold text-rose-500 hover:text-rose-600 hover:bg-rose-50/50 dark:hover:bg-rose-950/10 h-8 px-3 rounded-lg shrink-0 gap-1.5"
                >
                  <X className="size-3.5" />
                  <span>{t("clearFilters")}</span>
                </Button>
              )}
            </div>

            {/* Active Filter Chips */}
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                <span className="text-muted-foreground font-semibold">{t("activeFilter")}</span>
                {statusVal && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-medium border border-indigo-200/60">
                    Status: {statusVal}
                    <X
                      className="size-3 cursor-pointer hover:opacity-80"
                      onClick={() => handleStatusChange("")}
                    />
                  </span>
                )}
                {fromVal && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium border border-slate-200">
                    From: {fromVal}
                    <X
                      className="size-3 cursor-pointer hover:opacity-80"
                      onClick={() => handleFromChange("")}
                    />
                  </span>
                )}
                {toVal && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium border border-slate-200">
                    To: {toVal}
                    <X
                      className="size-3 cursor-pointer hover:opacity-80"
                      onClick={() => handleToChange("")}
                    />
                  </span>
                )}
                {searchQuery && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-medium border border-purple-200/60">
                    Search: &ldquo;{searchQuery}&rdquo;
                    <X
                      className="size-3 cursor-pointer hover:opacity-80"
                      onClick={() => setSearchQuery("")}
                    />
                  </span>
                )}
              </div>
            )}
          </div>

          {/* TABLE SECTION */}
          {filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center border border-dashed border-border rounded-2xl bg-card py-20 px-4 text-center animate-fade-in space-y-3">
              <div className="size-16 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
                <ClipboardList className="size-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-foreground">{t("title")}</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  {t("noSessions")}
                </p>
              </div>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearFilters}
                  className="rounded-xl text-xs font-semibold border-border"
                >
                  {t("clearFilters")}
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-start text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-xs font-bold text-muted-foreground uppercase tracking-wider select-none">
                      <th className="px-6 py-4 text-start font-bold">{t("colForm")}</th>
                      <th className="px-6 py-4 text-center font-bold">{t("colStatus")}</th>
                      <th className="px-6 py-4 text-center font-bold">{t("colDuration")}</th>
                      <th className="px-6 py-4 text-center font-bold">{t("colStarted")}</th>
                      <th className="px-6 py-4 text-center font-bold">{t("colEnded")}</th>
                      <th className="px-6 py-4 text-center font-bold">{t("colLanguage")}</th>
                      {showPlateNumber && (
                        <th className="px-6 py-4 text-start font-bold">{t("colPlate")}</th>
                      )}
                      <th className="px-6 py-4 text-end font-bold">{t("colActions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredSessions.map((session) => {
                      const formName = session.forms?.name || t("formFallback")
                      const langDisplay =
                        session.language === "ar"
                          ? t("languageArabicDisplay")
                          : t("languageEnglishDisplay")

                      return (
                        <tr
                          key={session.id}
                          onClick={() => {
                            if (role !== "receptionist") {
                              router.push(`/dashboard/sessions/${session.id}`)
                            }
                          }}
                          className={`transition-colors duration-150 ${
                            role === "receptionist"
                              ? "hover:bg-slate-50/50 dark:hover:bg-slate-900/20 cursor-default"
                              : "hover:bg-slate-50/80 dark:hover:bg-slate-900/40 cursor-pointer group"
                          }`}
                        >
                          {/* Form Name */}
                          <td className="px-6 py-4 text-start">
                            <div className="flex items-center gap-2.5">
                              <div className="size-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                                <FileText className="size-4" />
                              </div>
                              <div>
                                <span className={`font-bold text-foreground transition-colors block ${role !== "receptionist" ? "group-hover:text-indigo-600 dark:group-hover:text-indigo-400" : ""}`}>
                                  {formName}
                                </span>
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  ID: {session.id.slice(0, 8)}...
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-6 py-4 text-center whitespace-nowrap">
                            {getStatusBadge(session.status)}
                          </td>

                          {/* Duration */}
                          <td className="px-6 py-4 text-center whitespace-nowrap text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                            {getDuration(session)}
                          </td>

                          {/* Started At */}
                          <td className="px-6 py-4 text-center tabular-nums text-muted-foreground whitespace-nowrap text-xs font-medium">
                            {formatDateTime(session.started_at)}
                          </td>

                          {/* Ended At */}
                          <td className="px-6 py-4 text-center tabular-nums text-muted-foreground whitespace-nowrap text-xs font-medium">
                            {getEndedAt(session)}
                          </td>

                          {/* Language */}
                          <td className="px-6 py-4 text-center whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                              <Globe className="size-3 text-muted-foreground" />
                              {langDisplay}
                            </span>
                          </td>

                          {/* Plate Number */}
                          {showPlateNumber && (
                            <td className="px-6 py-4 text-start whitespace-nowrap">
                              {session.plate_number ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono font-bold text-xs text-foreground border border-slate-200 dark:border-slate-700">
                                  <Car className="size-3.5 text-indigo-500 shrink-0" />
                                  {session.plate_number}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </td>
                          )}

                          {/* Explicit View Details Action */}
                          <td className="px-6 py-4 text-end whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              {canDelete && (
                                <AlertDialog>
                                  <AlertDialogTrigger
                                    disabled={deletingId === session.id}
                                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                    className="inline-flex items-center justify-center h-8 w-8 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                                  >
                                    {deletingId === session.id ? (
                                      <Loader2 className="size-3.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="size-3.5" />
                                    )}
                                  </AlertDialogTrigger>
                                  <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete this session?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will permanently delete the session and all its responses. This cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleDeleteSession(session.id)
                                        }}
                                        className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                              {role === "receptionist" ? (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground/60 select-none">
                                  <Lock className="size-3.5" />
                                  <span>{t("btnViewDetails")}</span>
                                </span>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    router.push(`/dashboard/sessions/${session.id}`)
                                  }}
                                  className="h-8 px-3 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-xl group-hover:translate-x-0.5 transition-all gap-1"
                                >
                                  <span>{t("btnViewDetails")}</span>
                                  <ChevronRight className="size-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PAGINATION CONTROLS */}
          {(hasPrevPage || hasNextPage) && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border">
              <div className="text-xs text-muted-foreground select-none">
                {t("paginationShowing")} <span className="font-bold text-foreground">{toArabicNumerals(currentPage, locale)}</span> {t("paginationOf")}{" "}
                <span className="font-bold text-foreground">
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
                  className="border-border h-9 rounded-xl px-4 text-xs font-bold cursor-pointer"
                >
                  <ArrowLeft className="size-3.5 mr-1.5" />
                  {t("paginationPrev")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasNextPage}
                  onClick={() => updateUrl({ page: String(currentPage + 1) })}
                  className="border-border h-9 rounded-xl px-4 text-xs font-bold cursor-pointer"
                >
                  {t("paginationNext")}
                  <ArrowRight className="size-3.5 ml-1.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
