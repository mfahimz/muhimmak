import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { getLocale, getTranslations } from "next-intl/server"
import Link from "next/link"
import { PlusIcon, FileTextIcon, HelpCircleIcon, CalendarIcon, ArrowRightIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default async function FormsPage() {
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
  const allowedRoles = ["super_admin", "ceo", "agm"]

  if (!allowedRoles.includes(role)) {
    redirect("/dashboard")
  }

  // Fetch translations and locale
  const locale = await getLocale()
  const t = await getTranslations("Forms")

  // Fetch forms from Supabase. We only select forms that are not closed.
  // We join profiles to get the creator's full name.
  const { data: formsData, error: formsError } = await supabase
    .from("forms")
    .select(`
      id,
      name,
      description,
      status,
      fields,
      updated_at,
      profiles:created_by (
        full_name
      )
    `)
    .neq("status", "closed")
    .order("updated_at", { ascending: false })

  const forms = formsData || []

  // Helper to format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(locale === "ar" ? "ar-AE" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  return (
    <>
      <SiteHeader title={t("title")} />

      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6 bg-background text-start">
        {/* Header section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">{t("title")}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t("subtitle")}
            </p>
          </div>
          <Link href="/dashboard/forms/new">
            <Button className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5 shadow-xs h-10 px-5 rounded-xl">
              <PlusIcon className="size-4" />
              <span>{t("newForm")}</span>
            </Button>
          </Link>
        </div>

        {formsError && (
          <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-100 text-rose-600 text-sm font-medium">
            {t("errorFetch")}
          </div>
        )}

        {/* Forms list */}
        {forms.length === 0 ? (
          <div className="flex flex-col items-center justify-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-card py-20 px-4 text-center">
            <div className="size-16 rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400 mb-4">
              <FileTextIcon className="size-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{t("noForms")}</h3>
            <p className="text-sm text-slate-500 max-w-sm mt-1 mb-6">
              {t("emptyDescription")}
            </p>
            <Link href="/dashboard/forms/new">
              <Button className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold">
                <PlusIcon className="size-4 mr-1.5" />
                {t("newForm")}
              </Button>
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-start text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/10 text-xs font-bold text-muted-foreground uppercase tracking-wider select-none">
                    <th className="px-6 py-4 text-start font-semibold">{t("name")}</th>
                    <th className="px-6 py-4 text-center font-semibold">{t("status")}</th>
                    <th className="px-6 py-4 text-center font-semibold">{t("questions")}</th>
                    <th className="px-6 py-4 text-center font-semibold">{t("lastUpdated")}</th>
                    <th className="px-6 py-4 text-start font-semibold">{t("createdBy")}</th>
                    <th className="px-6 py-4 text-end font-semibold"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {forms.map((form: any) => {
                    const fieldsArray = Array.isArray(form.fields) ? form.fields : []
                    const questionCount = fieldsArray.length
                    const creatorName = form.profiles?.full_name || t("creatorFallback")

                    return (
                      <tr
                        key={form.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors duration-150 group"
                      >
                        <td className="px-6 py-4 text-start">
                          <Link href={`/dashboard/forms/${form.id}/edit`} className="block focus:outline-hidden">
                            <span className="font-semibold text-slate-900 dark:text-slate-100 block hover:text-indigo-600 transition-colors">
                              {form.name}
                            </span>
                            {form.description && (
                              <span className="text-xs text-muted-foreground block mt-0.5 line-clamp-1">
                                {form.description}
                              </span>
                            )}
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-center whitespace-nowrap">
                          {form.status === "active" ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-50/80 rounded-md font-medium px-2 py-0.5">
                              {t("statusActive")}
                            </Badge>
                          ) : (
                            <Badge className="bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100/80 rounded-md font-medium px-2 py-0.5">
                              {t("statusDraft")}
                            </Badge>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center tabular-nums text-slate-600 dark:text-slate-400">
                          <span className="inline-flex items-center gap-1">
                            <HelpCircleIcon className="size-3.5 text-slate-400" />
                            {questionCount}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            <CalendarIcon className="size-3.5 text-slate-400" />
                            {formatDate(form.updated_at)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-start text-slate-700 dark:text-slate-300">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="size-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] text-slate-500 font-bold uppercase">
                              {creatorName.charAt(0)}
                            </span>
                            {creatorName}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-end whitespace-nowrap">
                          <Link href={`/dashboard/forms/${form.id}/edit`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/50 dark:text-indigo-400 dark:hover:bg-indigo-950/20"
                            >
                              <span>{t("editButton")}</span>
                              <ArrowRightIcon className="size-3.5 ml-1 transition-transform group-hover:translate-x-0.5" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
