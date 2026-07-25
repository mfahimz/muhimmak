import 'server-only';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { writeAuditLog, getClientIp } from '@/lib/audit/log';
import { sendLowSatisfactionAlert } from '@/server/services/email.service';

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || '',
  baseURL: 'https://api.deepseek.com',
});
const DEEPSEEK_MODEL = 'deepseek-v4-flash';

// ---------------------------------------------------------------------------
// Private helper — weighted score calculation (used by completed + rescore)
// ---------------------------------------------------------------------------
function computeWeightedScore(
  fields: any[],
  answers: Record<string, any>,
  textScores?: Record<string, number>
): { finalScore: number; aiTextScore: number | null } {
  const scoreable = fields.filter(
    (f) => f.type === 'star_rating' || f.type === 'multiple_choice' || f.type === 'text'
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

    const { data: session, error: insertError } = await supabase
      .from('sessions')
      .insert({
        created_by: user.id,
        form_id: formId,
        location_id: locationId || null,
        status: 'started',
        plate_number_encrypted: plateNumber || null,
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
// scoreText
// ---------------------------------------------------------------------------
export async function scoreText(request: Request): Promise<NextResponse> {
  try {
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
