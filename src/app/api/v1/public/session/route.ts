import { createPublicSession } from '@/server/services/sessions.service';

export async function POST(request: Request) {
  return createPublicSession(request);
}
