import { NextResponse } from 'next/server';
import { checkDailyQrDeliveryHealth } from '@/server/services/qr-rotation.service';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const result = await checkDailyQrDeliveryHealth();
    return NextResponse.json(result);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to check QR delivery health';
    console.error('Failed to execute daily QR delivery health check cron:', err);
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
