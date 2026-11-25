import { saveFormVersion } from '@/server/services/forms.service';

export async function POST(request: Request) {
  return saveFormVersion(request);
}
