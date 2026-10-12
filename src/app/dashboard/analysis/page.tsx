import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { resolveAnalyticsViewer } from "@/server/lib/analytics-access";
import { getPresetDates } from "@/lib/utils/date-range";
import { getAnalysisReport, normalizeFilters } from "@/server/services/survey-analytics.service";
import { AnalysisClient, type TabKey } from "./AnalysisClient";

// Plain values cannot be imported from a client module into a server component, so the keys live here.
const TAB_KEYS: TabKey[] = ["questions", "drivers", "trends", "voice", "followUp"];

export default async function FeedbackAnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const viewer = await resolveAnalyticsViewer();
  if (viewer.status === "unauthenticated") redirect("/login");
  if (viewer.status === "forbidden") redirect("/dashboard");

  const { tab } = await searchParams;
  const initialTab = TAB_KEYS.find((k) => k === tab);
  const t = await getTranslations("Analysis");

  // The numbers load on the server in one pass. AI never runs here: it starts only when someone asks.
  // Feedback arrives slowly (a few surveys a week), so 90 days gives a sample worth analysing.
  const filters = normalizeFilters(getPresetDates("90d"));
  const initialReport = await getAnalysisReport(filters, { includeContacts: true });

  return (
    <>
      <SiteHeader title={t("title")} />
      <div className="flex flex-1 flex-col gap-6 bg-background p-4 text-start lg:p-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">{t("title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <AnalysisClient initialReport={initialReport} initialFilters={filters} aiConfigured={!!process.env.DEEPSEEK_API_KEY} initialTab={initialTab} />
      </div>
    </>
  );
}
