import { markAllNotificationsRead } from '@/server/services/notifications-center.service';

export async function PATCH(request: Request) {
  return markAllNotificationsRead(request);
}
