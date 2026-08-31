import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeVisitScore } from '@/server/services/sessions.service';
import { decryptPlate } from '@/lib/utils/plate-number';
import SessionDetailClient from './SessionDetailClient';
import { SiteHeader } from '@/components/site-header';
import { getTranslations } from 'next-intl/server';

const ALLOWED_ROLES = ['super_admin', 'ceo', 'agm', 'manager', 'receptionist'];
const HIDE_PLATE_ROLES = ['manager', 'receptionist'];

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

  // Read persisted AI analysis summary from session
  const aiSummary = session.ai_analysis_summary || '';

  const threshold = facilitySettings?.review_qr_threshold_percent ?? 90;
  const t = await getTranslations('Sessions');
  const canDelete = role === 'super_admin' || role === 'ceo';

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
        canDelete={canDelete}
      />
    </>
  );
}

