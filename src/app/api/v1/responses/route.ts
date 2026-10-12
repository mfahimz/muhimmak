import { getResponsesService } from "@/server/services/responses.service";

export async function GET(request: Request) {
  return getResponsesService(request);
}

