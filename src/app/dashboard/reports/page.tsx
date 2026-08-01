import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getTranslations } from "next-intl/server";
import { computeReportsData } from "@/server/services/reports.service";
import { ReportsClient } from "./ReportsClient";
import { getPresetDates } from "@/lib/utils/date-range";

export default async function ReportsPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  // Server-side role check: super_admin, ceo, agm, manager are allowed
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role || "receptionist";
  const allowedRoles = ["super_admin", "ceo", "agm", "manager"];

  if (!allowedRoles.includes(role)) {
    redirect("/dashboard");
  }

  // Fetch translations
  const t = await getTranslations("Reports");

  // Default date range: Last 30 Days
  const { startDate, endDate } = getPresetDates("30d");

  // Pre-fetch initial data server-side
  const initialReportsData = await computeReportsData(startDate, endDate);

  return (
    <>
      <SiteHeader title={t("title")} />
      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6 bg-background text-start">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">{t("title")}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t("subtitle")}
            </p>
          </div>
        </div>

        <ReportsClient
          initialData={initialReportsData}
          initialStartDate={startDate}
          initialEndDate={endDate}
        />
      </div>
    </>
  );
}
