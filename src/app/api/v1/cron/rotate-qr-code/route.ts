import { NextResponse } from 'next/server';
import { rotateQrToken } from '@/server/services/qr-rotation.service';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const result = await rotateQrToken();
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Failed to execute daily QR rotation cron:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to rotate QR token' },
      { status: 500 }
    );
  }
}
