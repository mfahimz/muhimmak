import { getNotifications } from '@/server/services/notifications-center.service';

export async function GET(request: Request) {
  return getNotifications(request);
}
