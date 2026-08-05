import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getTranslations } from "next-intl/server";
import { getTicketsForUser } from "@/server/services/support.service";
import { SupportListClient } from "@/components/support/SupportListClient";

export default async function SupportListPage() {
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

  const t = await getTranslations("Support");
  const initialTickets = await getTicketsForUser({ id: user.id, role });

  return (
    <>
      <SiteHeader title={t("listTitle")} />
      <SupportListClient initialTickets={initialTickets} />
    </>
  );
}
