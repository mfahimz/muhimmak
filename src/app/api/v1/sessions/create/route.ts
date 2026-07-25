import { createSession } from '@/server/services/sessions.service';

export async function POST(request: Request) {
  return createSession(request);
}
