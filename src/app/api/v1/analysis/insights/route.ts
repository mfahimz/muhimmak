import { generateInsightsService } from "@/server/services/survey-ai.service";

export const maxDuration = 60;

export async function POST(request: Request) {
  return generateInsightsService(request);
}
