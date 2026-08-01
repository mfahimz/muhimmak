import { NextResponse } from 'next/server';
import { resetUserPin } from '@/server/services/users.service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let newPin: string;
  try {
    const body = await request.json();
    newPin = body.newPin;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }

  if (typeof newPin !== 'string' || !/^\d{4}$/.test(newPin)) {
    return NextResponse.json({ error: 'PIN must be exactly 4 digits.' }, { status: 400 });
  }

  return resetUserPin(request, id, newPin);
}
