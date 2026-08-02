import {
  getFacilityHolidaysAndSettings,
  createFacilityHoliday,
  updateQrRotationEnabled,
} from '@/server/services/facility-holidays.service';

export async function GET(request: Request) {
  return getFacilityHolidaysAndSettings();
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  if (action === 'toggle-rotation') {
    return updateQrRotationEnabled(request);
  }

  return createFacilityHoliday(request);
}
