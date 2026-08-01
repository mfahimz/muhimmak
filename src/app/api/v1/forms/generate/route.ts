import { generateForm } from '@/server/services/forms.service';

export async function POST(request: Request) {
  return generateForm(request);
}
