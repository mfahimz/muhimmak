import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getTranslations } from "next-intl/server";
import { UsersClient } from "./UsersClient";

export default async function UsersPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  // Server-side role check: super_admin and ceo only
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

  const t = await getTranslations("Users");

  // Fetch full staff list server-side (all profiles)
  const { data: profilesData } = await admin
    .from("profiles")
    .select("id, full_name, role, is_active, created_at")
    .order("created_at", { ascending: false });

  const initialUsers = profilesData || [];

  return (
    <>
      <SiteHeader title={t("title")} />
      <UsersClient initialUsers={initialUsers} currentUserId={user.id} />
    </>
  );
}
