import { notifyDispute } from '@/server/services/sessions.service';

export async function POST(request: Request) {
  return notifyDispute(request);
}
