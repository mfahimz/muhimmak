import { deleteSession } from '@/server/services/sessions.service';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return deleteSession(request, id);
}
