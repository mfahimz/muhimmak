import 'server-only';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { writeAuditLog, getClientIp } from '@/lib/audit/log';
import { checkRateLimit } from '@/lib/rate-limit';
import { sendLowSatisfactionAlert } from '@/server/services/email.service';
import { createNotification } from '@/server/services/notifications-center.service';
import { encryptPlate, hashPlate } from '@/lib/utils/plate-number';

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || '',
  baseURL: 'https://api.deepseek.com',
});
const DEEPSEEK_MODEL = 'deepseek-v4-flash';

// ---------------------------------------------------------------------------
// Helper — weighted score calculation (used by completed + rescore + reports)
// ---------------------------------------------------------------------------
export function computeWeightedScore(
  fields: any[],
  answers: Record<string, any>,
  textScores?: Record<string, number>
): { finalScore: number; aiTextScore: number | null } {
  const scoreable = fields.filter(
    (f) => f.type === 'star_rating' || f.type === 'multiple_choice' || f.type === 'text' || f.type === 'numeric_scale'
  );

  let weightedSum = 0;
  let totalWeightAssigned = 0;
  let textWeightedSum = 0;
  let textTotalWeight = 0;

  scoreable.forEach((f) => {
    const answer = answers[f.id];
    if (answer !== undefined && answer !== null) {
      let questionNormalizedScore = 0;
      if (f.type === 'star_rating') {
        questionNormalizedScore = (Number(answer) / 5) * 100;
      } else if (f.type === 'multiple_choice') {
        const optIdx = Array.isArray(f.options) ? f.options.indexOf(String(answer)) : -1;
        if (
          optIdx !== -1 &&
          Array.isArray(f.optionScores) &&
          f.optionScores[optIdx] !== undefined
        ) {
          questionNormalizedScore = f.optionScores[optIdx];
        }
      } else if (f.type === 'numeric_scale') {
        questionNormalizedScore = ((Number(answer) - 1) / 9) * 100;
      } else if (f.type === 'text') {
        questionNormalizedScore = textScores?.[f.id] ?? 50;
        textWeightedSum += (questionNormalizedScore * (f.weight || 0)) / 100;
        textTotalWeight += f.weight || 0;
      }
      weightedSum += (questionNormalizedScore * (f.weight || 0)) / 100;
      totalWeightAssigned += f.weight || 0;
    }
  });

  const finalScore =
    totalWeightAssigned > 0 ? (weightedSum * 100) / totalWeightAssigned : 0;
  const aiTextScore =
    textTotalWeight > 0
      ? Math.round((textWeightedSum * 100) / textTotalWeight)
      : null;

  return { finalScore, aiTextScore };
}

// ---------------------------------------------------------------------------
// Helper — Visit Journey score calculation & partner lookup
// ---------------------------------------------------------------------------
export interface LinkedPartnerSession {
  id: string;
  form_id: string;
  visit_stage: 'drop_off' | 'pick_up' | null;
  created_at: string;
  status: string;
}

export interface VisitScoreDetails {
  visitScore: number | null;
  ownScore: number | null;
  partnerScore: number | null;
  isLinked: boolean;
  partnerSession: LinkedPartnerSession | null;
}

export async function computeVisitScore(
  sessionId: string
): Promise<VisitScoreDetails> {
  const admin = createAdminClient();

  const { data: session } = await admin
    .from('sessions')
    .select('id, form_id, status, visit_stage, linked_session_id, created_at')
    .eq('id', sessionId)
    .single();

  if (!session) {
    return { visitScore: null, ownScore: null, partnerScore: null, isLinked: false, partnerSession: null };
  }

  const getSessionScore = async (sId: string, fId: string, status: string): Promise<number | null> => {
    if (status !== 'completed') return null;
    const [{ data: form }, { data: resp }] = await Promise.all([
      admin.from('forms').select('fields').eq('id', fId).single(),
      admin.from('responses').select('answers').eq('session_id', sId).single(),
    ]);
    if (!form || !resp) return null;
    const fields = Array.isArray(form.fields) ? form.fields : [];
    const answers = resp.answers || {};
    const textScores = answers._textScores || {};
    const { finalScore } = computeWeightedScore(fields, answers, textScores);
    return Math.round(finalScore);
  };

  const ownScore = await getSessionScore(session.id, session.form_id, session.status);

  let partnerSession: LinkedPartnerSession | null = null;

  if (session.visit_stage === 'pick_up' && session.linked_session_id) {
    const { data: partner } = await admin
      .from('sessions')
      .select('id, form_id, visit_stage, created_at, status')
      .eq('id', session.linked_session_id)
      .single();

    if (partner) {
      partnerSession = partner as LinkedPartnerSession;
    }
  } else if (session.visit_stage === 'drop_off') {
    const { data: partner } = await admin
      .from('sessions')
      .select('id, form_id, visit_stage, created_at, status')
      .eq('linked_session_id', session.id)
      .limit(1)
      .maybeSingle();

    if (partner) {
      partnerSession = partner as LinkedPartnerSession;
    }
  }

  if (partnerSession) {
    const partnerScore = await getSessionScore(partnerSession.id, partnerSession.form_id, partnerSession.status);
    let visitScore: number | null = null;

    if (ownScore !== null && partnerScore !== null) {
      visitScore = Math.round((ownScore + partnerScore) / 2);
    } else {
      visitScore = ownScore ?? partnerScore;
    }

    return {
      visitScore,
      ownScore,
      partnerScore,
      isLinked: true,
      partnerSession,
    };
  }

  return {
    visitScore: ownScore,
    ownScore,
    partnerScore: null,
    isLinked: false,
    partnerSession: null,
  };
}

// ---------------------------------------------------------------------------
// createSession
// ---------------------------------------------------------------------------
export async function createSession(request: Request): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { formId, language, plateNumber, locationId } = body;

    if (!formId || !language) {
      return NextResponse.json({ error: 'Missing formId or language' }, { status: 400 });
    }

    const encryptedPlate = plateNumber ? encryptPlate(plateNumber) : null;
    const hashedPlate = plateNumber ? hashPlate(plateNumber) : null;

    const { data: session, error: insertError } = await supabase
      .from('sessions')
      .insert({
        created_by: user.id,
        form_id: formId,
        location_id: locationId || null,
        status: 'started',
        plate_number_encrypted: encryptedPlate,
        plate_number_hash: hashedPlate,
        consent_given: null,
        language: language,
      })
      .select('id')
      .single();

    if (insertError) throw insertError;

    const ip = getClientIp(request);
    await writeAuditLog({
      actorId: user.id,
      action: 'session_started',
      ipAddress: ip,
      metadata: { sessionId: session.id, formId, language, locationId },
    });

    const response = NextResponse.json({ success: true, sessionId: session.id });
    response.cookies.set('NEXT_LOCALE', language, { path: '/', maxAge: 31536000 });
    return response;
  } catch (err: any) {
    console.error('Session creation error:', err);
    return NextResponse.json({ error: err.message || err }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// logRefusal — Log a refusal session directly by receptionist/staff
// ---------------------------------------------------------------------------
export async function logRefusal(userId: string, ipAddress?: string | null): Promise<{ success: boolean; sessionId: string }> {
  const admin = createAdminClient();

  const { data: settings, error: settingsErr } = await admin
    .from('facility_settings')
    .select('default_form_id')
    .eq('id', '00000000-0000-0000-0000-000000000000')
    .single();

  if (settingsErr || !settings?.default_form_id) {
    throw new Error('Public feedback is not configured. Default form is not set.');
  }

  const now = new Date().toISOString();

  const { data: session, error: insertError } = await admin
    .from('sessions')
    .insert({
      created_by: userId,
      form_id: settings.default_form_id,
      channel: 'public_qr',
      language: 'en',
      status: 'refused',
      consent_given: false,
      started_at: now,
      refused_at: now,
    })
    .select('id')
    .single();

  if (insertError) throw insertError;

  await writeAuditLog({
    actorId: userId,
    action: 'session_consent_refused',
    ipAddress: ipAddress || null,
    metadata: { sessionId: session.id, channel: 'public_qr' },
  });

  return { success: true, sessionId: session.id };
}

// ---------------------------------------------------------------------------
// createPublicSession (Public QR Flow)
// ---------------------------------------------------------------------------
export async function createPublicSession(request: Request): Promise<NextResponse> {
  try {
    const rateLimit = checkRateLimit(request, 'public_session_create', { windowMs: 60 * 1000, max: 10 });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again in a minute.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { plateNumber, mobileNumber, language, visitStage } = body;

    if (!plateNumber || typeof plateNumber !== 'string' || plateNumber.trim().length < 2 || plateNumber.trim().length > 20) {
      return NextResponse.json(
        { error: 'Invalid or missing plate number. Must be between 2 and 20 characters.' },
        { status: 400 }
      );
    }

    const cleanPlate = plateNumber.trim().toUpperCase();
    const cleanMobile = typeof mobileNumber === 'string' && mobileNumber.trim() ? mobileNumber.trim() : null;
    const sessionLang = language === 'ar' ? 'ar' : 'en';

    const encryptedPlate = encryptPlate(cleanPlate);
    const hashedPlate = hashPlate(cleanPlate);

    if (!hashedPlate || !encryptedPlate) {
      return NextResponse.json({ error: 'Failed to process plate number.' }, { status: 500 });
    }

    const admin = createAdminClient();

    const { data: settings, error: settingsErr } = await admin
      .from('facility_settings')
      .select('default_form_id, visit_link_window_days')
      .eq('id', '00000000-0000-0000-0000-000000000000')
      .single();

    if (settingsErr || !settings?.default_form_id) {
      return NextResponse.json(
        { error: 'Public feedback is not configured. Default form is not set.' },
        { status: 400 }
      );
    }

    // 6-hour duplicate check: Check both hashed key and legacy plaintext key in cookies
    const cookieHeader = request.headers.get('cookie') || '';
    const cookieKeyHashed = `muhimmak_submitted_${encodeURIComponent(hashedPlate)}`;
    const cookieKeyLegacy = `muhimmak_submitted_${encodeURIComponent(cleanPlate)}`;
    if (cookieHeader.includes(`${cookieKeyHashed}=true`) || cookieHeader.includes(`${cookieKeyLegacy}=true`)) {
      return NextResponse.json(
        { duplicate: true, message: 'Feedback already submitted for this plate number in the last 6 hours.' },
        { status: 409 }
      );
    }

    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: existingLogs } = await admin
      .from('public_submission_log')
      .select('id')
      .or(`plate_number_hash.eq.${hashedPlate},plate_number.eq.${cleanPlate}`)
      .gte('submitted_at', sixHoursAgo)
      .limit(1);

    if (existingLogs && existingLogs.length > 0) {
      return NextResponse.json(
        { duplicate: true, message: 'Feedback already submitted for this plate number in the last 6 hours.' },
        { status: 409 }
      );
    }

    // Check if target form has is_visit_journey enabled
    const { data: form, error: formErr } = await admin
      .from('forms')
      .select('id, is_visit_journey')
      .eq('id', settings.default_form_id)
      .single();

    if (formErr || !form) {
      return NextResponse.json(
        { error: 'Form not found.' },
        { status: 400 }
      );
    }

    let finalVisitStage: 'drop_off' | 'pick_up' | null = null;
    let linkedSessionId: string | null = null;

    if (form.is_visit_journey) {
      if (visitStage !== 'drop_off' && visitStage !== 'pick_up') {
        return NextResponse.json(
          { error: 'Visit stage must be drop_off or pick_up' },
          { status: 400 }
        );
      }
      finalVisitStage = visitStage;

      if (finalVisitStage === 'pick_up') {
        const linkWindowDays = settings.visit_link_window_days ?? 5;
        const windowStartDate = new Date(Date.now() - linkWindowDays * 24 * 60 * 60 * 1000).toISOString();

        const { data: matchingDropOff } = await admin
          .from('sessions')
          .select('id')
          .eq('plate_number_hash', hashedPlate)
          .eq('visit_stage', 'drop_off')
          .is('linked_session_id', null)
          .gte('created_at', windowStartDate)
          .order('created_at', { ascending: false })
          .limit(1);

        if (matchingDropOff && matchingDropOff.length > 0) {
          linkedSessionId = matchingDropOff[0].id;
        }
      }
    }

    const { data: session, error: insertError } = await admin
      .from('sessions')
      .insert({
        created_by: null,
        channel: 'public_qr',
        form_id: form.id,
        location_id: null,
        status: 'started',
        plate_number_encrypted: encryptedPlate,
        plate_number_hash: hashedPlate,
        visit_stage: finalVisitStage,
        linked_session_id: linkedSessionId,
        mobile_number: cleanMobile,
        consent_given: null,
        language: sessionLang,
      })
      .select('id, form_id, location_id, status, language, plate_number_encrypted, plate_number_hash, visit_stage, linked_session_id')
      .single();

    if (insertError) throw insertError;

    await admin.from('public_submission_log').insert({
      plate_number_encrypted: encryptedPlate,
      plate_number_hash: hashedPlate,
      submitted_at: new Date().toISOString(),
    });

    const ip = getClientIp(request);
    await writeAuditLog({
      actorId: null,
      action: 'session_started',
      ipAddress: ip,
      metadata: { sessionId: session.id, formId: form.id, channel: 'public_qr', visitStage: finalVisitStage },
    });

    const response = NextResponse.json({ success: true, session });
    response.cookies.set('NEXT_LOCALE', sessionLang, { path: '/', maxAge: 31536000 });
    response.cookies.set(cookieKeyHashed, 'true', { path: '/', maxAge: 21600 });
    return response;
  } catch (err: any) {
    console.error('Public session creation error:', err);
    return NextResponse.json({ error: err.message || err }, { status: 500 });
  }
}

export async function notifyDispute(request: Request): Promise<NextResponse> {
  try {
    const rateLimit = checkRateLimit(request, 'public_notify_dispute', { windowMs: 60 * 1000, max: 5 });
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();
    const { plateNumber } = body;
    const cleanPlate = typeof plateNumber === 'string' ? plateNumber.trim().toUpperCase() : 'UNKNOWN';
    const ip = getClientIp(request);

    await writeAuditLog({
      actorId: null,
      action: 'session_started',
      ipAddress: ip,
      metadata: { dispute: true, plateNumber: cleanPlate, note: 'Customer disputed 6-hour duplicate block' },
    });

    await createNotification({
      recipientRole: ['super_admin', 'ceo', 'agm', 'manager', 'receptionist'],
      type: 'low_satisfaction',
      title: 'Duplicate Submission Dispute',
      message: `Customer with plate ${cleanPlate} reported duplicate block was incorrect.`,
      metadata: { plateNumber: cleanPlate },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || err }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// scoreText
// ---------------------------------------------------------------------------
export async function scoreText(request: Request): Promise<NextResponse> {
  try {
    const rateLimit = checkRateLimit(request, 'score_text', { windowMs: 60 * 1000, max: 30 });
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again in a minute.' }, { status: 429 });
    }
    const body = await request.json();
    const { sessionId, fieldId, questionLabel, answer } = body;

    if (
      !sessionId || typeof sessionId !== 'string' || sessionId.trim() === '' ||
      !fieldId || typeof fieldId !== 'string' || fieldId.trim() === '' ||
      !questionLabel || typeof questionLabel !== 'string' || questionLabel.trim() === '' ||
      !answer || typeof answer !== 'string' || answer.trim() === ''
    ) {
      return NextResponse.json(
        { error: 'Missing or empty required fields: sessionId, fieldId, questionLabel, answer' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: session, error: sessionError } = await admin
      .from('sessions')
      .select('status')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status !== 'started') {
      return NextResponse.json({ error: 'Session is not active' }, { status: 400 });
    }

    const { data: facilitySettings } = await admin
      .from('facility_settings')
      .select('ai_business_context')
      .eq('id', '00000000-0000-0000-0000-000000000000')
      .single();

    const systemPrompt =
      facilitySettings?.ai_business_context?.trim() ||
      'You are an AI assistant helping design customer feedback forms for Al Maraghi, a UAE-based automotive service facility.';

    let score = 50;

    const makeCall = async (): Promise<number> => {
      if (!process.env.DEEPSEEK_API_KEY) {
        throw new Error('DeepSeek API Key is not configured');
      }

      const userPrompt = `You are evaluating a customer feedback response for an automotive service facility. Score the following text answer on a scale of 0 to 100, where 0 means extremely negative/destructive feedback and 100 means extremely positive feedback. Consider both sentiment (how positive or negative) and relevance (how well it answers the question). Return ONLY a raw JSON object with a single field: { score: number }. No explanation, no markdown. Question: ${questionLabel}. Customer answer: ${answer}`;

      const completion = await deepseek.chat.completions.create({
        model: DEEPSEEK_MODEL,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });

      const resultText = completion.choices?.[0]?.message?.content;
      if (!resultText) throw new Error('Empty content received from DeepSeek');

      const parsed = JSON.parse(resultText.trim().replace(/^```json\s*|```$/g, ''));
      if (typeof parsed.score !== 'number') {
        throw new Error('Parsed response does not contain a numeric score');
      }

      return Math.min(100, Math.max(0, parsed.score));
    };

    try {
      score = await makeCall();
    } catch (firstErr: any) {
      console.warn('First DeepSeek scoring attempt failed, retrying in 500ms...', firstErr.message);
      await new Promise((resolve) => setTimeout(resolve, 500));
      try {
        score = await makeCall();
      } catch (retryErr: any) {
        console.error('Second attempt failed. Falling back to neutral score 50.', retryErr.message);
        score = 50;
      }
    }

    return NextResponse.json({ score, fieldId });
  } catch (err: any) {
    console.error('Crash in scoreText service:', err);
    return NextResponse.json({ error: err.message || err }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// updateSession
// ---------------------------------------------------------------------------
export async function updateSession(request: Request): Promise<NextResponse> {
  try {
    const rateLimit = checkRateLimit(request, 'session_update', { windowMs: 60 * 1000, max: 30 });
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again in a minute.' }, { status: 429 });
    }

    const body = await request.json();
    const { sessionId, action, answers, deviceInfo, textScores, isPendingScoring } = body;

    if (!sessionId || !action) {
      return NextResponse.json({ error: 'Missing sessionId or action' }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: session, error: selectError } = await admin
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (selectError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (action !== 'rescore' && session.status !== 'started') {
      return NextResponse.json({ error: 'Session is already finalized' }, { status: 400 });
    }

    const ip = getClientIp(request);
    const now = new Date().toISOString();

    if (action === 'consent_given') {
      const { error: updateError } = await admin
        .from('sessions')
        .update({ consent_given: true, updated_at: now })
        .eq('id', sessionId);

      if (updateError) throw updateError;

      await writeAuditLog({
        actorId: null,
        action: 'session_consent_given',
        ipAddress: ip,
        metadata: { sessionId },
      });

      return NextResponse.json({ success: true });
    }

    if (action === 'consent_refused') {
      const { error: updateError } = await admin
        .from('sessions')
        .update({
          consent_given: false,
          status: 'refused',
          refused_at: now,
          updated_at: now,
        })
        .eq('id', sessionId);

      if (updateError) throw updateError;

      await writeAuditLog({
        actorId: null,
        action: 'session_consent_refused',
        ipAddress: ip,
        metadata: { sessionId },
      });

      const response = NextResponse.json({ success: true });
      response.cookies.delete('NEXT_LOCALE');
      return response;
    }

    if (action === 'completed' || action === 'abandoned') {
      const finalStatus = action === 'completed' ? 'completed' : 'abandoned';
      let showQr = false;

      if (answers) {
        const { data: form } = await admin
          .from('forms')
          .select('fields')
          .eq('id', session.form_id)
          .single();

        const fields = Array.isArray(form?.fields) ? (form.fields as any[]) : [];
        const { finalScore, aiTextScore } = computeWeightedScore(fields, answers, textScores);

        const answersWithScores = { ...answers, _textScores: textScores || {} };

        const { error: responseError } = await admin
          .from('responses')
          .insert({
            form_id: session.form_id,
            session_id: sessionId,
            answers: answersWithScores,
            device_info: deviceInfo || null,
            submitted_at: now,
            ai_text_score: aiTextScore,
          });

        if (responseError) throw responseError;

        if (action === 'completed') {
          if (isPendingScoring) {
            showQr = false;
          } else {
            const { data: settings } = await admin
              .from('facility_settings')
              .select('google_review_url, review_qr_threshold_percent')
              .eq('id', '00000000-0000-0000-0000-000000000000')
              .single();

            const threshold = settings?.review_qr_threshold_percent ?? 90;
            const reviewUrl = settings?.google_review_url;

            if (finalScore >= threshold && reviewUrl) showQr = true;
          }

          if (!isPendingScoring) {
            const formNameResult = await admin
              .from('forms')
              .select('name')
              .eq('id', session.form_id)
              .single();
            const formName = formNameResult.data?.name ?? 'Unknown Form';
            sendLowSatisfactionAlert({
              sessionId,
              score: Math.round(finalScore),
              formName,
            });
            await createNotification({
              recipientRole: ['super_admin', 'ceo', 'agm', 'manager'],
              type: 'low_satisfaction',
              title: 'Low Satisfaction Alert',
              message: `Low satisfaction score of ${Math.round(finalScore)}% recorded for "${formName}".`,
              metadata: { sessionId, score: Math.round(finalScore), formName },
            });
          }
        }
      }

      const { error: updateError } = await admin
        .from('sessions')
        .update({
          status: finalStatus,
          completed_at: action === 'completed' ? now : null,
          updated_at: now,
        })
        .eq('id', sessionId);

      if (updateError) throw updateError;

      await writeAuditLog({
        actorId: null,
        action: action === 'completed' ? 'session_completed' : 'session_abandoned',
        ipAddress: ip,
        metadata: { sessionId, finalStatus },
      });

      const response = NextResponse.json({ success: true, showQr });
      response.cookies.delete('NEXT_LOCALE');
      return response;
    }

    if (action === 'rescore') {
      const { data: form } = await admin
        .from('forms')
        .select('fields')
        .eq('id', session.form_id)
        .single();

      const fields = Array.isArray(form?.fields) ? (form.fields as any[]) : [];

      const { data: responseData } = await admin
        .from('responses')
        .select('answers')
        .eq('session_id', sessionId)
        .single();

      if (!responseData) {
        return NextResponse.json({ error: 'Response not found' }, { status: 404 });
      }

      const responseAnswers = responseData.answers || {};
      const { finalScore, aiTextScore } = computeWeightedScore(
        fields,
        responseAnswers,
        textScores
      );

      const answersWithScores = { ...responseAnswers, _textScores: textScores || {} };

      const { error: responseUpdateError } = await admin
        .from('responses')
        .update({ answers: answersWithScores, ai_text_score: aiTextScore })
        .eq('session_id', sessionId);

      if (responseUpdateError) throw responseUpdateError;

      const { data: settings } = await admin
        .from('facility_settings')
        .select('google_review_url, review_qr_threshold_percent')
        .eq('id', '00000000-0000-0000-0000-000000000000')
        .single();

      const threshold = settings?.review_qr_threshold_percent ?? 90;
      const reviewUrl = settings?.google_review_url;
      const showQr = finalScore >= threshold && !!reviewUrl;

      return NextResponse.json({ success: true, showQr });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('Session update error:', err);
    return NextResponse.json({ error: err.message || err }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// computeReceptionistImpact — Stats for Receptionist Impact Dashboard
// ---------------------------------------------------------------------------
export interface RecognitionFeedItem {
  comment: string;
  score: number;
  date: string;
}

export interface ReceptionistImpactData {
  totalSessions: number;
  milestones: {
    currentCount: number;
    nextMilestone: number;
    progressText: string;
    percentage: number;
  };
  stats90Days: {
    avgScore: number | null;
    streak: number;
    totalCompleted: number;
  };
  recognitionFeed: RecognitionFeedItem[];
  weeklyRecap: {
    count: number;
    avgScore: number | null;
    highlight: string | null;
  };
}

export async function computeReceptionistImpact(staffId: string): Promise<ReceptionistImpactData> {
  const emptyResult: ReceptionistImpactData = {
    totalSessions: 0,
    milestones: {
      currentCount: 0,
      nextMilestone: 25,
      progressText: '0 / 25',
      percentage: 0,
    },
    stats90Days: {
      avgScore: null,
      streak: 0,
      totalCompleted: 0,
    },
    recognitionFeed: [],
    weeklyRecap: {
      count: 0,
      avgScore: null,
      highlight: null,
    },
  };

  if (!staffId) return emptyResult;

  try {
    const admin = createAdminClient();

    // 1. Total All-time Sessions count
    const { count: totalCount, error: totalCountErr } = await admin
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', staffId);

    const totalSessions = totalCountErr ? 0 : (totalCount ?? 0);

    // Calculate milestone target
    let nextMilestone = 25;
    if (totalSessions < 25) {
      nextMilestone = 25;
    } else if (totalSessions < 50) {
      nextMilestone = 50;
    } else if (totalSessions < 100) {
      nextMilestone = 100;
    } else {
      nextMilestone = Math.ceil((totalSessions + 1) / 50) * 50;
    }
    const percentage = Math.min(100, Math.round((totalSessions / nextMilestone) * 100));

    // 2. Rolling 90-day Window Query
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: sessions, error: sessionsErr } = await admin
      .from('sessions')
      .select('id, form_id, status, created_at, completed_at')
      .eq('created_by', staffId)
      .gte('created_at', ninetyDaysAgo)
      .order('created_at', { ascending: false });

    if (sessionsErr || !sessions || sessions.length === 0) {
      return {
        totalSessions,
        milestones: {
          currentCount: totalSessions,
          nextMilestone,
          progressText: `${totalSessions} / ${nextMilestone}`,
          percentage,
        },
        stats90Days: {
          avgScore: null,
          streak: 0,
          totalCompleted: 0,
        },
        recognitionFeed: [],
        weeklyRecap: {
          count: 0,
          avgScore: null,
          highlight: null,
        },
      };
    }

    const completedSessions = sessions.filter((s) => s.status === 'completed');
    const completedIds = completedSessions.map((s) => s.id);

    // Fetch responses for completed sessions
    const { data: responses } = completedIds.length > 0
      ? await admin
          .from('responses')
          .select('session_id, answers, submitted_at, ai_text_score')
          .in('session_id', completedIds)
      : { data: [] };

    const responseMap = new Map<string, any>();
    (responses || []).forEach((r) => {
      responseMap.set(r.session_id, r);
    });

    // Fetch unique form fields
    const formIds = Array.from(new Set(sessions.map((s) => s.form_id).filter(Boolean)));
    const { data: forms } = formIds.length > 0
      ? await admin.from('forms').select('id, fields').in('id', formIds)
      : { data: [] };

    const formMap = new Map<string, any>();
    (forms || []).forEach((f) => {
      formMap.set(f.id, f);
    });

    // Fetch Review QR Threshold
    const { data: settings } = await admin
      .from('facility_settings')
      .select('review_qr_threshold_percent')
      .eq('id', '00000000-0000-0000-0000-000000000000')
      .single();

    const threshold = settings?.review_qr_threshold_percent ?? 90;

    // Process completed sessions
    interface ScoredSession {
      sessionId: string;
      createdAt: string;
      finalScore: number;
      answers: Record<string, any>;
      fields: any[];
    }

    const scoredSessions: ScoredSession[] = [];
    const feedItems: RecognitionFeedItem[] = [];

    for (const s of completedSessions) {
      const resp = responseMap.get(s.id);
      if (!resp) continue;

      const form = formMap.get(s.form_id);
      const fields = Array.isArray(form?.fields) ? form.fields : [];
      const answers = resp.answers || {};
      const textScores = answers._textScores || {};

      const { finalScore } = computeWeightedScore(fields, answers, textScores);

      scoredSessions.push({
        sessionId: s.id,
        createdAt: s.created_at,
        finalScore: Math.round(finalScore),
        answers,
        fields,
      });

      // Check text questions for recognition feed
      const textFields = fields.filter((f: any) => f.type === 'text');
      for (const tf of textFields) {
        const textAnswer = answers[tf.id];
        const scoreVal = textScores[tf.id];
        if (
          typeof textAnswer === 'string' &&
          textAnswer.trim().length > 0 &&
          typeof scoreVal === 'number' &&
          scoreVal >= 70
        ) {
          feedItems.push({
            comment: textAnswer.trim(),
            score: scoreVal,
            date: s.created_at,
          });
        }
      }
    }

    // 90-day Average Score
    const totalCompleted = scoredSessions.length;
    const avgScore = totalCompleted > 0
      ? Math.round(scoredSessions.reduce((acc, curr) => acc + curr.finalScore, 0) / totalCompleted)
      : null;

    // Streak calculation (consecutive completed sessions with finalScore >= threshold, most recent first)
    let streak = 0;
    for (const ss of scoredSessions) {
      if (ss.finalScore >= threshold) {
        streak++;
      } else {
        break;
      }
    }

    // Recognition Feed (up to 10, sorted by date descending)
    feedItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const recognitionFeed = feedItems.slice(0, 10);

    // 3. Weekly Recap (sessions in last 7 days)
    const sessionsIn7Days = sessions.filter((s) => s.created_at >= sevenDaysAgo);
    const weeklyCount = sessionsIn7Days.length;

    const weeklyScored = scoredSessions.filter((s) => s.createdAt >= sevenDaysAgo);
    const weeklyAvgScore = weeklyScored.length > 0
      ? Math.round(weeklyScored.reduce((acc, curr) => acc + curr.finalScore, 0) / weeklyScored.length)
      : null;

    let weeklyHighlight: string | null = null;
    if (weeklyScored.length > 0) {
      // Find weekly text comments >= 70
      const weeklyComments = feedItems.filter((fi) => fi.date >= sevenDaysAgo);
      if (weeklyComments.length > 0) {
        // Pick top scoring weekly comment
        weeklyComments.sort((a, b) => b.score - a.score);
        weeklyHighlight = `"${weeklyComments[0].comment}"`;
      } else {
        const topScore = Math.max(...weeklyScored.map((s) => s.finalScore));
        weeklyHighlight = `Peak satisfaction score of ${topScore}% achieved this week!`;
      }
    }

    return {
      totalSessions,
      milestones: {
        currentCount: totalSessions,
        nextMilestone,
        progressText: `${totalSessions} / ${nextMilestone}`,
        percentage,
      },
      stats90Days: {
        avgScore,
        streak,
        totalCompleted,
      },
      recognitionFeed,
      weeklyRecap: {
        count: weeklyCount,
        avgScore: weeklyAvgScore,
        highlight: weeklyHighlight,
      },
    };
  } catch (err) {
    console.error('Error computing receptionist impact:', err);
    return emptyResult;
  }
}
