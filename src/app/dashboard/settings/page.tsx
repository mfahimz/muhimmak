import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { getTranslations } from "next-intl/server"
import { SettingsClient } from "./SettingsClient"

export default async function SettingsPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect("/login")
  }

  // Server-side role check: super_admin and ceo only
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const role = profile?.role || "receptionist"
  const allowedRoles = ["super_admin", "ceo"]

  if (!allowedRoles.includes(role)) {
    redirect("/dashboard")
  }

  const t = await getTranslations("Settings")

  // Fetch form types from database
  const { data: formTypesData } = await supabase
    .from("form_types")
    .select("*")
    .order("sort_order", { ascending: true })

  const formTypes = formTypesData || []

  // Fetch facility settings from database (singleton check)
  const { data: facilitySettingsData } = await supabase
    .from("facility_settings")
    .select("*")
    .single()

  const facilitySettings = facilitySettingsData || {
    google_review_url: "https://search.google.com/local/writereview?placeid=ChIJplaceholder",
    review_qr_threshold_percent: 90,
    default_form_id: null,
    display_orientation: "fit_to_width",
  }

  // Fetch all 5 notification settings from database
  const { data: notificationSettings } = await admin
    .from("notification_settings")
    .select("*")
    .order("event_type")

  // Fetch all active profiles for notification recipient selection
  const { data: availableUsersData } = await admin
    .from("profiles")
    .select("id, full_name, role, notification_email")
    .eq("is_active", true)
    .order("full_name", { ascending: true })

  const availableUsers = availableUsersData || []

  // Fetch all active forms for the default form dropdown
  const { data: activeFormsData } = await supabase
    .from("forms")
    .select("id, name")
    .eq("status", "active")
    .order("name", { ascending: true })

  const activeForms = activeFormsData || []

  return (
    <>
      <SiteHeader title={t("title")} />
      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6 bg-background text-start">
        <div className="max-w-4xl mx-auto w-full">
          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">{t("title")}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t("subtitle")}
            </p>
          </div>
          <SettingsClient
            initialFormTypes={formTypes}
            initialFacilitySettings={facilitySettings}
            initialNotificationSettings={notificationSettings ?? []}
            availableUsers={availableUsers}
            userRole={role}
            activeForms={activeForms}
          />
        </div>
      </div>
    </>
  )
}
