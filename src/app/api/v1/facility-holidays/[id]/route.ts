import { deleteFacilityHoliday } from '@/server/services/facility-holidays.service';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return deleteFacilityHoliday(request, id);
}
