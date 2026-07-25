import { translateForm } from '@/server/services/forms.service';

export async function POST(request: Request) {
  return translateForm(request);
}
