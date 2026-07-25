import { scoreText } from '@/server/services/sessions.service';

export async function POST(request: Request) {
  return scoreText(request);
}
