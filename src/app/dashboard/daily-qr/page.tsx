import { getTodayQrInfo } from "@/server/services/qr-rotation.service"
import { DailyQrClient } from "./DailyQrClient"

export const dynamic = "force-dynamic"

export default async function DailyQrPage() {
  const qrInfo = await getTodayQrInfo()
  return <DailyQrClient qrInfo={qrInfo} />
}
