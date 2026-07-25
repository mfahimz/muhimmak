import { loginUser } from '@/server/services/auth.service';

export async function POST(request: Request) {
  return loginUser(request);
}
