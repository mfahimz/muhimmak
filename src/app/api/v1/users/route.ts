import { getUsers, createUser } from '@/server/services/users.service';

export async function GET(request: Request) {
  return getUsers(request);
}

export async function POST(request: Request) {
  return createUser(request);
}
