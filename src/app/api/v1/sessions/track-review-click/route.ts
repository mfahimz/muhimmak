import { trackReviewClick } from "@/server/services/sessions.service"

export async function POST(request: Request) {
  return trackReviewClick(request)
}
