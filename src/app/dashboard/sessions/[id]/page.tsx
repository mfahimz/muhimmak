import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { deepseek, DEEPSEEK_MODEL } from '@/server/lib/deepseek';
import { computeVisitScore } from '@/server/services/sessions.service';
import { decryptPlate } from '@/lib/utils/plate-number';
import SessionDetailClient from './SessionDetailClient';
import { SiteHeader } from '@/components/site-header';
import { getTranslations } from 'next-intl/server';

const ALLOWED_ROLES = ['super_admin', 'ceo', 'agm', 'manager', 'receptionist'];
const HIDE_PLATE_ROLES = ['manager', 'receptionist'];

async function generateAiSummary({
  answers,
  fields,
  businessContext,
  isVisitJourney,
  currentStage,
  partnerAnswers,
  partnerFields,
  partnerStage,
}: {
  answers: Record<string, any>;
  fields: any[];
  businessContext: string;
  isVisitJourney?: boolean;
  currentStage?: 'drop_off' | 'pick_up' | null;
  partnerAnswers?: Record<string, any>;
  partnerFields?: any[];
  partnerStage?: 'drop_off' | 'pick_up' | null;
}): Promise<string> {
  try {
    if (!process.env.DEEPSEEK_API_KEY) throw new Error('No API key');

    let answerText = '';

    if (isVisitJourney) {
      let dropOffFields: any[] = [];
      let dropOffAns: Record<string, any> = {};
      let pickUpFields: any[] = [];
      let pickUpAns: Record<string, any> = {};

      if (currentStage === 'drop_off') {
        dropOffFields = fields.filter(f => !f.visit_stage || f.visit_stage === 'drop_off');
        dropOffAns = answers;
        if (partnerStage === 'pick_up' && partnerFields) {
          pickUpFields = partnerFields.filter(f => f.visit_stage === 'pick_up');
          pickUpAns = partnerAnswers || {};
        }
      } else if (currentStage === 'pick_up') {
        pickUpFields = fields.filter(f => f.visit_stage === 'pick_up');
        pickUpAns = answers;
        if (partnerStage === 'drop_off' && partnerFields) {
          dropOffFields = partnerFields.filter(f => !f.visit_stage || f.visit_stage === 'drop_off');
          dropOffAns = partnerAnswers || {};
        }
      }

      const dropOffText = dropOffFields
        .filter(f => dropOffAns[f.id] !== undefined && dropOffAns[f.id] !== null)
        .map(f => `Q: ${f.label}\nA: ${dropOffAns[f.id]}`)
        .join('\n\n');

      const pickUpText = pickUpFields
        .filter(f => pickUpAns[f.id] !== undefined && pickUpAns[f.id] !== null)
        .map(f => `Q: ${f.label}\nA: ${pickUpAns[f.id]}`)
        .join('\n\n');

      const sections: string[] = [];
      if (dropOffText.trim()) {
        sections.push(`--- Drop-off Stage ---\n${dropOffText}`);
      }
      if (pickUpText.trim()) {
        sections.push(`--- Pick-up Stage ---\n${pickUpText}`);
      }
      answerText = sections.join('\n\n');
    } else {
      answerText = fields
        .filter(f => answers[f.id] !== undefined && answers[f.id] !== null)
        .map(f => `Q: ${f.label}\nA: ${answers[f.id]}`)
        .join('\n\n');
    }

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

  // Receptionists cannot open or view session details/results
  if (role === 'receptionist') {
    redirect('/dashboard/sessions');
  }

  // Fetch response
  const { data: response } = await admin
    .from('responses')
    .select('*')
    .eq('session_id', id)
    .maybeSingle();

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
  const plateNumber = decryptPlate(session.plate_number_encrypted);
  const { plate_number_encrypted, ...sanitizedSession } = session;

  // Compute Visit Score details
  const visitScoreDetails = await computeVisitScore(id);
  const isVisitJourney = Boolean(session.visit_stage);

  let partnerResponse: any | null = null;
  let partnerFields: any[] = [];
  let partnerAnswers: Record<string, any> = {};

  if (isVisitJourney && visitScoreDetails.partnerSession) {
    const { data: pResp } = await admin
      .from('responses')
      .select('*')
      .eq('session_id', visitScoreDetails.partnerSession.id)
      .maybeSingle();

    const { data: pForm } = await admin
      .from('forms')
      .select('fields')
      .eq('id', visitScoreDetails.partnerSession.form_id)
      .single();

    partnerResponse = pResp ?? null;
    partnerFields = Array.isArray(pForm?.fields) ? pForm.fields : [];
    partnerAnswers = pResp?.answers || {};
  }

  // Generate AI summary server-side (only for sessions with answers)
  let aiSummary = '';
  const hasCurrentAnswers = response && Object.keys(answers).length > 0;
  const hasPartnerAnswers = partnerResponse && Object.keys(partnerAnswers).length > 0;

  if (hasCurrentAnswers || hasPartnerAnswers) {
    aiSummary = await generateAiSummary({
      answers,
      fields,
      businessContext: facilitySettings?.ai_business_context || '',
      isVisitJourney,
      currentStage: session.visit_stage,
      partnerAnswers,
      partnerFields,
      partnerStage: visitScoreDetails.partnerSession?.visit_stage ?? null,
    });
  }

  const threshold = facilitySettings?.review_qr_threshold_percent ?? 90;
  const t = await getTranslations('Sessions');

  return (
    <>
      <SiteHeader title={t('sessionDetail')} />
      <SessionDetailClient
        session={sanitizedSession}
        response={response ?? null}
        form={form ?? null}
        fields={fields}
        answers={answers}
        creatorName={creator?.full_name ?? 'Unknown'}
        role={role}
        showPlate={showPlate}
        plateNumber={plateNumber}
        aiSummary={aiSummary}
        computedScore={visitScoreDetails.ownScore}
        visitScoreDetails={visitScoreDetails}
        threshold={threshold}
        partnerResponse={partnerResponse}
        partnerFields={partnerFields}
        partnerAnswers={partnerAnswers}
        isVisitJourney={isVisitJourney}
      />
    </>
  );
}
