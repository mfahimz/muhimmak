import { suggestNextQuestion } from '@/server/services/forms.service';

export async function POST(request: Request) {
  return suggestNextQuestion(request);
}
