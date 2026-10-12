import { getAnalysisReportService } from "@/server/services/survey-analytics.service";

export async function GET(request: Request) {
  return getAnalysisReportService(request);
}
