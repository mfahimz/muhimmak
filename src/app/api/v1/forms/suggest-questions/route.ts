import { suggestQuestions } from '@/server/services/forms.service';

export async function POST(request: Request) {
  return suggestQuestions(request);
}
