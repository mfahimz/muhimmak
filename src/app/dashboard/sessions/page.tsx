import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { getTranslations } from "next-intl/server"
import { decryptPlate } from "@/lib/utils/plate-number"
import { SessionsListClient, type SessionItem } from "./SessionsListClient"
import { type PendingClosureItem } from "../pending-closures/PendingClosuresClient"

interface PageProps {
  searchParams: Promise<{
    tab?: string
    page?: string
    status?: string
    from?: string
    to?: string
  }>
}

export default async function SessionsPage({ searchParams }: PageProps) {
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect("/login")
  }

  // Server-side role check
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const role = profile?.role || "receptionist"
  const allowedRoles = ["super_admin", "ceo", "agm", "manager", "receptionist"]

  if (!allowedRoles.includes(role)) {
    redirect("/dashboard")
  }

  // Fetch translations
  const t = await getTranslations("Sessions")

  // Resolve search parameters
  const resolvedParams = await searchParams
  const tab = resolvedParams.tab === "open-visits" ? "open-visits" : "all"
  const page = Number(resolvedParams.page) || 1
  const status = resolvedParams.status || ""
  const from = resolvedParams.from || ""
  const to = resolvedParams.to || ""

  const pageSize = 20
  const fromIndex = (page - 1) * pageSize
  const toIndex = fromIndex + pageSize - 1

  // Build query for sessions
  let query = supabase
    .from("sessions")
    .select(`
      id,
      created_by,
      form_id,
      location_id,
      status,
      plate_number_encrypted,
      consent_given,
      language,
      started_at,
      completed_at,
      refused_at,
      created_at,
      updated_at,
      forms:form_id (
        name
      )
    `, { count: "exact" })

  // Apply date filters
  if (from) {
    query = query.gte("started_at", `${from}T00:00:00.000Z`)
  }

  if (to) {
    query = query.lte("started_at", `${to}T23:59:59.999Z`)
  }

  // Sorting and Pagination
  query = query
    .order("started_at", { ascending: false })
    .range(fromIndex, toIndex)

  const { data: sessionsData, error: sessionsError, count } = await query

  const rawSessions = sessionsData || []
  const totalCount = count || 0

  const sessions: SessionItem[] = rawSessions.map((row: any) => {
    const { plate_number_encrypted, ...rest } = row
    return {
      ...rest,
      plate_number: decryptPlate(plate_number_encrypted),
      forms: Array.isArray(row.forms) ? row.forms[0] ?? null : row.forms,
    }
  })

  // Fetch pending closures data
  const { data: closuresData, error: closuresError } = await admin
    .from("visit_closures")
    .select(`
      id,
      session_id,
      plate_number_hash,
      flagged_at,
      status,
      invoice_number,
      resolved_by,
      resolved_at,
      notified_at,
      created_at,
      sessions:session_id (
        id,
        created_at,
        plate_number_encrypted
      ),
      profiles:resolved_by (
        full_name
      )
    `)
    .order("flagged_at", { ascending: true })

  const rawClosures = closuresData || []

  const closures: PendingClosureItem[] = rawClosures.map((row: any) => {
    const sessionObj = Array.isArray(row.sessions) ? row.sessions[0] : row.sessions
    const profileObj = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles

    const encryptedPlate = sessionObj?.plate_number_encrypted || null
    const decryptedPlate = encryptedPlate ? decryptPlate(encryptedPlate) : "UNKNOWN"
    const dropOffCreatedAt = sessionObj?.created_at || row.created_at

    const daysElapsed = dropOffCreatedAt
      ? Math.max(0, Math.floor((Date.now() - new Date(dropOffCreatedAt).getTime()) / (1000 * 60 * 60 * 24)))
      : 0

    return {
      id: row.id,
      sessionId: row.session_id,
      plateNumber: decryptedPlate || "UNKNOWN",
      status: row.status,
      invoiceNumber: row.invoice_number || null,
      resolvedBy: row.resolved_by || null,
      resolverName: profileObj?.full_name || null,
      resolvedAt: row.resolved_at || null,
      flaggedAt: row.flagged_at,
      dropOffCreatedAt: dropOffCreatedAt,
      daysElapsed: daysElapsed,
    }
  })

  // Scope summary counts (scoped by date filters, ignoring status filter)
  let metricsQuery = supabase
    .from("sessions")
    .select("status")

  if (from) {
    metricsQuery = metricsQuery.gte("started_at", `${from}T00:00:00.000Z`)
  }
  if (to) {
    metricsQuery = metricsQuery.lte("started_at", `${to}T23:59:59.999Z`)
  }

  const { data: metricsData } = await metricsQuery
  const rawMetrics = metricsData || []
  const metrics = {
    total: rawMetrics.length,
    completed: rawMetrics.filter((r: any) => r.status === "completed").length,
    refused: rawMetrics.filter((r: any) => r.status === "refused").length,
    abandoned: rawMetrics.filter((r: any) => r.status === "abandoned" || r.status === "started").length,
  }

  return (
    <>
      <SiteHeader title={t("title")} />
      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6 bg-background text-start animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">{t("title")}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t("subtitle")}
            </p>
          </div>
        </div>

        {(sessionsError || closuresError) && (
          <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-100 text-rose-600 text-sm font-medium">
            {t("errorLoading")}
          </div>
        )}

        <SessionsListClient
          sessions={sessions}
          closures={closures}
          role={role}
          currentUserId={user.id}
          totalCount={totalCount}
          currentPage={page}
          pageSize={pageSize}
          filters={{ status, from, to }}
          metrics={metrics}
          initialTab={tab}
        />
      </div>
    </>
  )
}
