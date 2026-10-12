import { scoreUnscoredFeedbackService } from "@/server/services/responses.service";

export async function POST() {
  return scoreUnscoredFeedbackService();
}

