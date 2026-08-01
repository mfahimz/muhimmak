import { NextResponse } from 'next/server';
import { process7DayVisitClosures } from '@/server/services/visit-closures.service';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const result = await process7DayVisitClosures();
  if (!result.success) {
    return NextResponse.json(
      { error: result.error || 'Failed to process visit closures' },
      { status: 500 }
    );
  }

  return NextResponse.json(result);
}
