import { suggestWeights } from '@/server/services/forms.service';

export async function POST(request: Request) {
  return suggestWeights(request);
}
