import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getLocale, getTranslations } from "next-intl/server"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect("/login")
  }

  // Fetch locale on server side
  const locale = await getLocale()
  const t = await getTranslations("Header")

  // Fetch profile via admin client to bypass any direct read constraints
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single()

  const fullName = profile?.full_name || user.user_metadata?.full_name || t("staffFallback")
  const role = (profile?.role || user.user_metadata?.role || "receptionist") as string
  const email = user.email || ""

  const userProfile = {
    name: fullName,
    role: role,
    email: email,
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar user={userProfile} variant="inset" side={locale === "ar" ? "right" : "left"} />
      <SidebarInset>
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
