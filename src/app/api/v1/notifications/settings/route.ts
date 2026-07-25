import {
  getNotificationSettings,
  updateNotificationSettings,
} from '@/server/services/notifications.service';

export async function GET(request: Request) {
  return getNotificationSettings(request);
}

export async function PATCH(request: Request) {
  return updateNotificationSettings(request);
}
