import { NextResponse } from 'next/server';
import { inferMissingQuestionDomains } from '@/server/services/forms.service';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();
    if (!Array.isArray(body.fields)) return NextResponse.json({ error: 'fields must be an array' }, { status: 400 });
    return NextResponse.json({ fields: await inferMissingQuestionDomains(body.fields) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Domain inference failed' }, { status: 500 });
  }
}
