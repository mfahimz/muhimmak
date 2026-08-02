import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getTodayQrInfo } from "@/server/services/qr-rotation.service"
import { DailyQrClient } from "./DailyQrClient"

export const dynamic = "force-dynamic"

export default async function DailyQrPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let canManageQr = false

  if (user) {
    const admin = createAdminClient()
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    canManageQr = Boolean(
      profile?.role && ["super_admin", "ceo"].includes(profile.role)
    )
  }

  const qrInfo = await getTodayQrInfo()
  return <DailyQrClient qrInfo={qrInfo} canManageQr={canManageQr} />
}
