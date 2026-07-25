import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { getTranslations } from "next-intl/server"
import {
  ActivityIcon,
  StarIcon,
  BanIcon,
  PlusIcon,
  SparklesIcon,
  CheckCircle2Icon,
  CalendarCheckIcon,
  AwardIcon,
  UserCheck2Icon,
} from "lucide-react"
import Link from "next/link"

export default async function Page() {
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect("/login")
  }

  // Fetch translations on server side
  const t = await getTranslations("Dashboard")
  const tRoles = await getTranslations("Roles")
  const tHeader = await getTranslations("Header")

  // Fetch profile via admin client to bypass any direct read constraints
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single()

  const fullName = profile?.full_name || user.user_metadata?.full_name || t("fallbackName")
  const role = (profile?.role || user.user_metadata?.role || "receptionist") as string

  const isReceptionist = role === "receptionist"
  const canStartSession = role === "receptionist" || role === "super_admin" || role === "ceo"

  // Format role label using translation keys with fallback
  const formatRole = (roleKey: string) => {
    return tRoles.has(roleKey) ? tRoles(roleKey) : roleKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  }

  // ─── Query Metrics by Role ───────────────────────────────────────────────
  let receptionistMetrics = {
    started: "0" as string | number,
    completed: "0" as string | number,
    refused: "0" as string | number,
  }
  let fullMetrics = {
    sessionsToday: "0" as string | number,
    refusalsToday: "0" as string | number,
    totalFeedback: "—",
    avgScore: "—",
  }
  let byUserRows: { receptionist: string; sessionsCount: number; avgScore: string }[] | null = []

  const startOfToday = new Date()
  startOfToday.setUTCHours(0, 0, 0, 0)
  const startOfTodayISO = startOfToday.toISOString()

  if (isReceptionist) {
    // Receptionist view metrics are strictly scoped to their own sessions
    try {
      const { count: started, error: startedError } = await supabase
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .eq("created_by", user.id)
        .eq("status", "started")

      const { count: completed, error: completedError } = await supabase
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .eq("created_by", user.id)
        .eq("status", "completed")

      const { count: refused, error: refusedError } = await supabase
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .eq("created_by", user.id)
        .eq("status", "refused")

      receptionistMetrics = {
        started: startedError ? t("unableToLoad") : (started ?? 0),
        completed: completedError ? t("unableToLoad") : (completed ?? 0),
        refused: refusedError ? t("unableToLoad") : (refused ?? 0),
      }
    } catch (err) {
      console.error("Failed to query receptionist metrics:", err)
      receptionistMetrics = {
        started: t("unableToLoad"),
        completed: t("unableToLoad"),
        refused: t("unableToLoad"),
      }
    }
  } else {
    // Full view metrics are facility-wide (super_admin, ceo, agm, manager)
    try {
      const { count: sessionsToday, error: sError } = await supabase
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .gte("started_at", startOfTodayISO)

      const { count: refusalsToday, error: rError } = await supabase
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .eq("status", "refused")
        .gte("refused_at", startOfTodayISO)

      fullMetrics.sessionsToday = sError ? t("unableToLoad") : (sessionsToday ?? 0)
      fullMetrics.refusalsToday = rError ? t("unableToLoad") : (refusalsToday ?? 0)

      // TODO: Compute average and total scores from JSONB answers column in responses table once schema is finalized
      fullMetrics.totalFeedback = "—"
      fullMetrics.avgScore = "—"

      // Query sessions + profiles for By User table aggregation
      const { data: sessionsData, error: sessionsError } = await supabase
        .from("sessions")
        .select("created_by, profiles:created_by ( full_name )")

      if (sessionsError) {
        byUserRows = null
      } else if (sessionsData) {
        const userMap: Record<string, { name: string; count: number }> = {}
        sessionsData.forEach((s: any) => {
          const creatorId = s.created_by
          if (!creatorId) return
          const pName = Array.isArray(s.profiles)
            ? s.profiles[0]?.full_name
            : s.profiles?.full_name
          const name = pName || t("unknownStaff")
          if (!userMap[creatorId]) {
            userMap[creatorId] = { name, count: 0 }
          }
          userMap[creatorId].count++
        })

        byUserRows = Object.values(userMap).map((item) => ({
          receptionist: item.name,
          sessionsCount: item.count,
          avgScore: "—",
        }))
      }
    } catch (err) {
      console.error("Failed to query full metrics:", err)
      fullMetrics.sessionsToday = t("unableToLoad")
      fullMetrics.refusalsToday = t("unableToLoad")
      byUserRows = null
    }
  }

  return (
    <>
      <SiteHeader title={tHeader("dashboardOverview")} />

      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6 bg-background">
        {/* Welcome Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-xs transition-all duration-300 hover:border-primary/20">
          <div className="absolute top-0 end-0 -me-16 -mt-16 size-48 rounded-full bg-primary/5 blur-3xl" />
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1 text-start">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                {t("welcomeBack", { name: fullName })} <SparklesIcon className="size-4 text-primary animate-pulse" />
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("subtitle")}
              </p>
            </div>
            <div className="flex items-center gap-2 mt-4 md:mt-0">
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                {t("roleBadge", { role: formatRole(role) })}
              </span>
            </div>
          </div>
        </div>

        {/* ─── CONDITIONAL RENDERING BY ROLE ─────────────────────────────────────── */}
        {isReceptionist ? (
          /* =========================================================================
             RECEPTIONIST VIEW
             ========================================================================= */
          <div className="space-y-6">
            {/* Top Prominent Action Card */}
            <div className="rounded-2xl border border-indigo-200 bg-linear-to-br from-indigo-50/40 via-card to-card p-6 shadow-xs text-center md:text-start flex flex-col md:flex-row md:items-center md:justify-between gap-6 transition-all duration-300 hover:border-indigo-300 dark:border-indigo-900/40 dark:from-indigo-950/10 animate-fade-in">
              <div className="space-y-1.5 text-start">
                <h3 className="text-lg font-bold tracking-tight text-indigo-900 dark:text-indigo-100">{t("startSessionButton")}</h3>
                <p className="text-sm text-muted-foreground max-w-xl">
                  {t("startSessionDesc")}
                </p>
              </div>
              <Link href="/dashboard/sessions/new" className="shrink-0">
                <button className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:bg-indigo-500 active:scale-98">
                  <PlusIcon className="size-4" />
                  <span>{t("startSessionButton")}</span>
                </button>
              </Link>
            </div>

            {/* Stat Cards Grid (3 cards only, own scope) */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {/* Sessions Started */}
              <div className="group relative rounded-xl border border-border bg-card p-5 shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold tracking-wide text-muted-foreground">{t("metrics.sessionsStarted")}</span>
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                    <ActivityIcon className="size-5" />
                  </div>
                </div>
                <div className="mt-4 text-start">
                  <h3 className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
                    {receptionistMetrics.started}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">{t("metrics.sessionsStartedSub")}</p>
                </div>
              </div>

              {/* Sessions Completed */}
              <div className="group relative rounded-xl border border-border bg-card p-5 shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:border-success/30 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold tracking-wide text-muted-foreground">{t("metrics.sessionsCompleted")}</span>
                  <div className="flex size-9 items-center justify-center rounded-lg bg-success/10 text-success group-hover:bg-success group-hover:text-success-foreground transition-colors duration-300">
                    <CheckCircle2Icon className="size-5" />
                  </div>
                </div>
                <div className="mt-4 text-start">
                  <h3 className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
                    {receptionistMetrics.completed}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">{t("metrics.sessionsCompletedSub")}</p>
                </div>
              </div>

              {/* Sessions Refused */}
              <div className="group relative rounded-xl border border-border bg-card p-5 shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:border-danger/30 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold tracking-wide text-muted-foreground">{t("metrics.sessionsRefused")}</span>
                  <div className="flex size-9 items-center justify-center rounded-lg bg-danger/10 text-danger group-hover:bg-danger group-hover:text-danger-foreground transition-colors duration-300">
                    <BanIcon className="size-5" />
                  </div>
                </div>
                <div className="mt-4 text-start">
                  <h3 className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
                    {receptionistMetrics.refused}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">{t("metrics.sessionsRefusedSub")}</p>
                </div>
              </div>
            </div>

            {/* Prominent Action Card */}
            <div className="rounded-2xl border border-primary/20 bg-linear-to-br from-primary/5 via-card to-card p-8 shadow-xs text-center md:text-start flex flex-col md:flex-row md:items-center md:justify-between gap-6 transition-all duration-300 hover:border-primary/40">
              <div className="space-y-2 text-start">
                <h3 className="text-lg font-bold tracking-tight text-foreground">{t("readyToReceive")}</h3>
                <p className="text-sm text-muted-foreground max-w-xl">
                  {t("readySubtitle")}
                </p>
              </div>
              <Link href="/dashboard/sessions/new" className="shrink-0">
                <button className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md transition-all duration-200 hover:bg-primary/95 active:scale-98">
                  <PlusIcon className="size-4" />
                  <span>{t("btnStartSession")}</span>
                </button>
              </Link>
            </div>
          </div>
        ) : (
          /* =========================================================================
             FULL VIEW (ADMIN, CEO, AGM, MANAGER)
             ========================================================================= */
          <div className="space-y-6">
            {canStartSession && (
              <div className="rounded-2xl border border-indigo-200 bg-linear-to-br from-indigo-50/40 via-card to-card p-6 shadow-xs text-center md:text-start flex flex-col md:flex-row md:items-center md:justify-between gap-6 transition-all duration-300 hover:border-indigo-300 dark:border-indigo-900/40 dark:from-indigo-950/10 animate-fade-in">
                <div className="space-y-1.5 text-start">
                  <h3 className="text-lg font-bold tracking-tight text-indigo-900 dark:text-indigo-100">{t("startSessionButton")}</h3>
                  <p className="text-sm text-muted-foreground max-w-xl">
                    {t("startSessionDesc")}
                  </p>
                </div>
                <Link href="/dashboard/sessions/new" className="shrink-0">
                  <button className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:bg-indigo-500 active:scale-98">
                    <PlusIcon className="size-4" />
                    <span>{t("startSessionButton")}</span>
                  </button>
                </Link>
              </div>
            )}

            {/* Stat Cards Grid (4 cards, facility-wide) */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Sessions Today */}
              <div className="group relative rounded-xl border border-border bg-card p-5 shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold tracking-wide text-muted-foreground">{t("metrics.sessionsToday")}</span>
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                    <CalendarCheckIcon className="size-5" />
                  </div>
                </div>
                <div className="mt-4 text-start">
                  <h3 className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
                    {fullMetrics.sessionsToday}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">{t("metrics.sessionsTodaySub")}</p>
                </div>
              </div>

              {/* Refusals Today */}
              <div className="group relative rounded-xl border border-border bg-card p-5 shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:border-danger/30 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold tracking-wide text-muted-foreground">{t("metrics.refusalsToday")}</span>
                  <div className="flex size-9 items-center justify-center rounded-lg bg-danger/10 text-danger group-hover:bg-danger group-hover:text-danger-foreground transition-colors duration-300">
                    <BanIcon className="size-5" />
                  </div>
                </div>
                <div className="mt-4 text-start">
                  <h3 className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
                    {fullMetrics.refusalsToday}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">{t("metrics.refusalsTodaySub")}</p>
                </div>
              </div>

              {/* Total Feedback Score */}
              <div className="group relative rounded-xl border border-border bg-card p-5 shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:border-warning/30 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold tracking-wide text-muted-foreground">{t("metrics.totalFeedback")}</span>
                  <div className="flex size-9 items-center justify-center rounded-lg bg-warning/10 text-warning group-hover:bg-warning group-hover:text-warning-foreground transition-colors duration-300">
                    <AwardIcon className="size-5" />
                  </div>
                </div>
                <div className="mt-4 text-start">
                  <h3 className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
                    {fullMetrics.totalFeedback}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">{t("metrics.totalFeedbackSub")}</p>
                </div>
              </div>

              {/* Average Score */}
              <div className="group relative rounded-xl border border-border bg-card p-5 shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:border-success/30 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold tracking-wide text-muted-foreground">{t("metrics.avgScore")}</span>
                  <div className="flex size-9 items-center justify-center rounded-lg bg-success/10 text-success group-hover:bg-success group-hover:text-success-foreground transition-colors duration-300">
                    <StarIcon className="size-5" />
                  </div>
                </div>
                <div className="mt-4 text-start">
                  <h3 className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
                    {fullMetrics.avgScore}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">{t("metrics.avgScoreSub")}</p>
                </div>
              </div>
            </div>

            {/* By User Performance Table Section */}
            <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
              <div className="border-b border-border/50 bg-muted/20 px-6 py-4 flex items-center justify-between">
                <div className="text-start">
                  <h3 className="text-base font-bold text-foreground">{t("tableTitle")}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("tableSubtitle")}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-primary font-semibold">
                  <UserCheck2Icon className="size-4" />
                  <span>{t("realtimeSync")}</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-start text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border/55 bg-muted/10 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      <th className="px-6 py-3.5 text-start">{t("table.receptionist")}</th>
                      <th className="px-6 py-3.5 text-center">{t("table.sessionsCount")}</th>
                      <th className="px-6 py-3.5 text-end">{t("table.avgScore")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {byUserRows === null ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-8 text-center text-rose-500 font-medium">
                          {t("table.unableToLoad")}
                        </td>
                      </tr>
                    ) : byUserRows.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-8 text-center text-muted-foreground">
                          {t("table.noSessions")}
                        </td>
                      </tr>
                    ) : (
                      byUserRows.map((row, index) => (
                        <tr
                          key={index}
                          className="hover:bg-muted/5 transition-colors duration-150"
                        >
                          <td className="px-6 py-4 font-semibold text-foreground text-start">
                            {row.receptionist}
                          </td>
                          <td className="px-6 py-4 text-center tabular-nums text-muted-foreground">
                            {row.sessionsCount}
                          </td>
                          <td className="px-6 py-4 text-end tabular-nums font-semibold text-success">
                            {row.avgScore}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
