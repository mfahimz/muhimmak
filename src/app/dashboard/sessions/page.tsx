import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { getTranslations } from "next-intl/server"
import { SessionsListClient, type SessionItem } from "./SessionsListClient"

interface PageProps {
  searchParams: Promise<{
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
  const page = Number(resolvedParams.page) || 1
  const status = resolvedParams.status || ""
  const from = resolvedParams.from || ""
  const to = resolvedParams.to || ""

  const pageSize = 20
  const fromIndex = (page - 1) * pageSize
  const toIndex = fromIndex + pageSize - 1

  // Build query
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

  // Scoping: Receptionists can only see their own sessions
  if (role === "receptionist") {
    query = query.eq("created_by", user.id)
  }

  // Apply filters
  if (status) {
    query = query.eq("status", status)
  }

  if (from) {
    // Start of the day in UTC
    query = query.gte("started_at", `${from}T00:00:00.000Z`)
  }

  if (to) {
    // End of the day in UTC
    query = query.lte("started_at", `${to}T23:59:59.999Z`)
  }

  // Sorting and Pagination
  query = query
    .order("started_at", { ascending: false })
    .range(fromIndex, toIndex)

  const { data: sessionsData, error: sessionsError, count } = await query

  const rawSessions = sessionsData || []
  const totalCount = count || 0

  const sessions: SessionItem[] = rawSessions.map((row: any) => ({
    ...row,
    forms: Array.isArray(row.forms) ? row.forms[0] ?? null : row.forms,
  }))

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

        {sessionsError && (
          <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-100 text-rose-600 text-sm font-medium">
            {t("errorLoading")}
          </div>
        )}

        <SessionsListClient
          sessions={sessions}
          role={role}
          totalCount={totalCount}
          currentPage={page}
          pageSize={pageSize}
          filters={{ status, from, to }}
        />
      </div>
    </>
  )
}
