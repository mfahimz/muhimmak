import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect, notFound } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { getTranslations } from "next-intl/server"
import { EditFormClient } from "./EditFormClient"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditFormPage({ params }: PageProps) {
  const { id } = await params

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

  const t = await getTranslations("Forms")

  // Fetch the specific form
  const { data: form, error: formError } = await supabase
    .from("forms")
    .select("id, name, description, name_ar, description_ar, status, fields, parent_id, type, is_visit_journey")
    .eq("id", id)
    .single()

  if (formError || !form) {
    notFound()
  }

  return (
    <>
      <SiteHeader title={t("editForm")} />
      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6 bg-background max-w-4xl mx-auto w-full text-start">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">{t("editForm")}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Modify question settings and field options.
          </p>
        </div>
        <EditFormClient userId={user.id} form={form} />
      </div>
    </>
  )
}
