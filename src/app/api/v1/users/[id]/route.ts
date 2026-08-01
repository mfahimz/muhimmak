import { updateUser } from '@/server/services/users.service';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return updateUser(request, id);
}
