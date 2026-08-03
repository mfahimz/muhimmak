import { trackReviewQrShown } from "@/server/services/sessions.service"

export async function POST(request: Request) {
  return trackReviewQrShown(request)
}
