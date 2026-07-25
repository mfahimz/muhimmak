import { suggestBranching } from '@/server/services/forms.service';

export async function POST(request: Request) {
  return suggestBranching(request);
}
