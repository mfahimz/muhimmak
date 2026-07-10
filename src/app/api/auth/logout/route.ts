import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { writeAuditLog, getClientIp } from '@/lib/audit/log';

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.auth.signOut();

  if (user) {
    await writeAuditLog({
      actorId: user.id,
      action: 'logout',
      ipAddress: getClientIp(request),
    });
  }

  return NextResponse.json({ ok: true });
}
