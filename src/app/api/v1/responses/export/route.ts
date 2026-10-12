import { exportResponsesExcelService } from "@/server/services/responses.service";

export async function GET() {
  return exportResponsesExcelService();
}

