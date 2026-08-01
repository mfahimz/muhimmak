import { markNotificationRead } from '@/server/services/notifications-center.service';

export async function PATCH(request: Request) {
  return markNotificationRead(request);
}
