import { updateSession } from '@/server/services/sessions.service';

export async function POST(request: Request) {
  return updateSession(request);
}
