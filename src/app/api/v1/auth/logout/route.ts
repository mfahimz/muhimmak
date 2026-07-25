import { logoutUser } from '@/server/services/auth.service';

export async function POST(request: Request) {
  return logoutUser(request);
}
