import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { getTranslations } from "next-intl/server"
import { NewSessionClient } from "./NewSessionClient"

export default async function NewSessionPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect("/login")
  }

  // Server-side role check: receptionist, manager, agm, ceo, super_admin are allowed
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("profiles")
    .select("role, location_id")
    .eq("id", user.id)
    .single()

  const role = profile?.role || "receptionist"
  const allowedRoles = ["super_admin", "ceo", "agm", "manager", "receptionist"]

  if (!allowedRoles.includes(role)) {
    redirect("/dashboard")
  }

  const t = await getTranslations("Dashboard")

  // Fetch only active forms
  const { data: formsData } = await supabase
    .from("forms")
    .select("id, name, description, name_ar, status, type, fields")
    .eq("status", "active")
    .order("updated_at", { ascending: false })

  const activeForms = (formsData || []).map((form) => {
    const hasNameAr = typeof form.name_ar === 'string' && form.name_ar.trim() !== ''
    const fieldsArr = Array.isArray(form.fields) ? form.fields : []
    const hasFields = fieldsArr.length > 0
    const allFieldsTranslated = hasFields && fieldsArr.every((f: any) =>
      f.ar && typeof f.ar.label === 'string' && f.ar.label.trim() !== ''
    )

    return {
      id: form.id,
      name: form.name,
      description: form.description,
      status: form.status,
      type: form.type,
      hasArabicTranslation: hasNameAr && allFieldsTranslated,
    }
  })

  // Fetch facility settings to get default_form_id
  const { data: facilitySettings } = await supabase
    .from("facility_settings")
    .select("default_form_id")
    .single()

  const defaultFormId = facilitySettings?.default_form_id || null

  return (
    <>
      <SiteHeader title={t("btnStartSession")} />
      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6 bg-background max-w-4xl mx-auto w-full text-start animate-fade-in">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">{t("btnStartSession")}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure form, language, and client details to launch a new feedback session.
          </p>
        </div>
        <NewSessionClient
          activeForms={activeForms}
          locationId={profile?.location_id || null}
          userId={user.id}
          defaultFormId={defaultFormId}
        />
      </div>
    </>
  )
}
