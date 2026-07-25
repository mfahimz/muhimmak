import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { deepseek, DEEPSEEK_MODEL } from '@/server/lib/deepseek';
import SessionDetailClient from './SessionDetailClient';
import { SiteHeader } from '@/components/site-header';
import { getTranslations } from 'next-intl/server';

const ALLOWED_ROLES = ['super_admin', 'ceo', 'agm', 'manager', 'receptionist'];
const HIDE_PLATE_ROLES = ['manager', 'receptionist'];

async function generateAiSummary(
  answers: Record<string, any>,
  fields: any[],
  businessContext: string
): Promise<string> {
  try {
    if (!process.env.DEEPSEEK_API_KEY) throw new Error('No API key');

    const answerText = fields
      .filter(f => answers[f.id] !== undefined && answers[f.id] !== null)
      .map(f => `Q: ${f.label}\nA: ${answers[f.id]}`)
      .join('\n\n');

    if (!answerText.trim()) return '';

    const completion = await deepseek.chat.completions.create({
      model: DEEPSEEK_MODEL,
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content: businessContext || 'You are an analyst reviewing customer feedback for Al Maraghi Motors, a UAE automotive service facility.',
        },
        {
          role: 'user',
          content: `Analyze this customer feedback and write a concise 3-4 sentence professional summary. Highlight the key sentiment, any standout positives, any concerns, and an overall impression. Write in English as plain text — no bullet points, no headings, no markdown.\n\n${answerText}`,
        },
      ],
    });

    return completion.choices?.[0]?.message?.content?.trim() || '';
  } catch (err) {
    console.error('[session detail] AI summary failed:', err);
    return '';
  }
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SessionDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/login');

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single();

  const role = profile?.role || 'receptionist';
  if (!ALLOWED_ROLES.includes(role)) redirect('/dashboard');

  // Fetch session
  const { data: session, error: sessionError } = await admin
    .from('sessions')
    .select('*')
    .eq('id', id)
    .single();

  if (sessionError || !session) notFound();

  // Receptionist can only see their own sessions
  if (role === 'receptionist' && session.created_by !== user.id) {
    redirect('/dashboard/sessions');
  }

  // Fetch response
  const { data: response } = await admin
    .from('responses')
    .select('*')
    .eq('session_id', id)
    .single();

  // Fetch form with fields
  const { data: form } = await admin
    .from('forms')
    .select('name, fields')
    .eq('id', session.form_id)
    .single();

  // Fetch creator name
  const { data: creator } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', session.created_by)
    .single();

  // Fetch facility settings for business context
  const { data: facilitySettings } = await admin
    .from('facility_settings')
    .select('ai_business_context, review_qr_threshold_percent')
    .eq('id', '00000000-0000-0000-0000-000000000000')
    .single();

  const fields = Array.isArray(form?.fields) ? form.fields : [];
  const answers = response?.answers || {};
  const showPlate = !HIDE_PLATE_ROLES.includes(role);

  // Generate AI summary server-side (only for completed sessions with answers)
  let aiSummary = '';
  if (session.status === 'completed' && response && Object.keys(answers).length > 0) {
    aiSummary = await generateAiSummary(
      answers,
      fields,
      facilitySettings?.ai_business_context || ''
    );
  }

  // Compute score
  let computedScore: number | null = null;
  if (session.status === 'completed' && fields.length > 0 && Object.keys(answers).length > 0) {
    const scoreable = fields.filter(
      f => f.type === 'star_rating' || f.type === 'multiple_choice' || f.type === 'text'
    );
    let weightedSum = 0;
    let totalWeight = 0;
    scoreable.forEach(f => {
      const answer = answers[f.id];
      if (answer === undefined || answer === null) return;
      let score = 0;
      if (f.type === 'star_rating') score = (Number(answer) / 5) * 100;
      else if (f.type === 'multiple_choice') {
        const idx = Array.isArray(f.options) ? f.options.indexOf(String(answer)) : -1;
        if (idx !== -1 && Array.isArray(f.optionScores)) score = f.optionScores[idx] ?? 0;
      } else if (f.type === 'text') {
        score = response?.ai_text_score ?? answers._textScores?.[f.id] ?? 50;
      }
      weightedSum += (score * (f.weight || 0)) / 100;
      totalWeight += f.weight || 0;
    });
    if (totalWeight > 0) computedScore = Math.round((weightedSum * 100) / totalWeight);
  }

  const threshold = facilitySettings?.review_qr_threshold_percent ?? 90;

  const t = await getTranslations('Sessions');

  return (
    <>
      <SiteHeader title={t('sessionDetail')} />
      <SessionDetailClient
        session={session}
        response={response ?? null}
        form={form ?? null}
        fields={fields}
        answers={answers}
        creatorName={creator?.full_name ?? 'Unknown'}
        role={role}
        showPlate={showPlate}
        aiSummary={aiSummary}
        computedScore={computedScore}
        threshold={threshold}
      />
    </>
  );
}
