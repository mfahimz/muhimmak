import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getTranslations } from "next-intl/server";
import { getAllAnnouncements } from "@/server/services/announcements.service";
import { AnnouncementsClient } from "./AnnouncementsClient";

export default async function AnnouncementsPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  // Role check guard: super_admin and ceo only
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role || "receptionist";
  const allowedRoles = ["super_admin", "ceo"];

  if (!allowedRoles.includes(role)) {
    redirect("/dashboard");
  }

  const t = await getTranslations("Announcements");
  const initialAnnouncements = await getAllAnnouncements();

  return (
    <>
      <SiteHeader title={t("pageTitle")} />
      <AnnouncementsClient initialAnnouncements={initialAnnouncements || []} />
    </>
  );
}
