import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { getTranslations } from "next-intl/server"
import { NewFormClient } from "./NewFormClient"

export default async function NewFormPage() {
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

  // Fetch form types from database
  const { data: typesData } = await supabase
    .from("form_types")
    .select("id, name, description, is_implemented, enabled, sort_order")
    .order("sort_order", { ascending: true })

  const types = typesData || []

  return (
    <>
      <SiteHeader title={t("newForm")} />
      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6 bg-background max-w-4xl mx-auto w-full text-start">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">{t("newForm")}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Design your form layout and add questions.
          </p>
        </div>
        <NewFormClient userId={user.id} types={types} />
      </div>
    </>
  )
}
