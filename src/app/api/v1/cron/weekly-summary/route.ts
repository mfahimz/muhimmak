import { sendWeeklySummary } from '@/server/services/email.service';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  await sendWeeklySummary();
  return new Response('OK', { status: 200 });
}
