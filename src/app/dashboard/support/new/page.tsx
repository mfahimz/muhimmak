import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getTranslations } from "next-intl/server";
import { SupportNewClient } from "@/components/support/SupportNewClient";

export default async function SupportNewPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const t = await getTranslations("Support");

  return (
    <>
      <SiteHeader title={t("newTicketTitle")} />
      <SupportNewClient />
    </>
  );
}
