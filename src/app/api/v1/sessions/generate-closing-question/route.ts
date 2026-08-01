import { createAdminClient } from '@/lib/supabase/admin';
import { deepseek, DEEPSEEK_MODEL } from '@/server/lib/deepseek';
import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';

const generatedQuestionsSet = new Set<string>();

export async function POST(request: Request) {
  let sessionId: string | undefined;
  let visitStage: string | undefined;
  let addedToSet = false;

  try {
    const body = await request.json();
    sessionId = body.sessionId;
    visitStage = body.visitStage;
    const { answers, questionLabels } = body;

    if (!sessionId || !visitStage || !answers || !questionLabels) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, visitStage, answers, questionLabels' },
        { status: 400 }
      );
    }

    // Layer 1 — Rate limiting (by IP)
    const rateLimit = checkRateLimit(request, 'ai_closing_question', { windowMs: 60 * 1000, max: 5 });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again in a minute.' },
        { status: 429 }
      );
    }

    const admin = createAdminClient();

    // Verify session is active
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

    // Layer 2 — Per-session+stage call cap (in-memory Set)
    const sessionStageKey = `${sessionId}:${visitStage}`;
    if (generatedQuestionsSet.has(sessionStageKey)) {
      return NextResponse.json(
        { error: 'Closing question already generated for this stage.' },
        { status: 429 }
      );
    }

    generatedQuestionsSet.add(sessionStageKey);
    addedToSet = true;

    // Fetch facility settings for ai business context
    const { data: facilitySettings } = await admin
      .from('facility_settings')
      .select('ai_business_context')
      .eq('id', '00000000-0000-0000-0000-000000000000')
      .single();

    const systemPrompt =
      (facilitySettings?.ai_business_context?.trim() ||
      'You are an AI assistant helping design customer feedback forms for Al Maraghi, a UAE-based automotive service facility.') +
      '\nForms are used on a kiosk to collect feedback from customers immediately after their vehicle service visit. ' +
      'Keep questions concise, professional, and appropriate for a post-service automotive context in the UAE.';

    // Construct the user prompt with lean context
    let answeredContext = '';
    for (const [fieldId, value] of Object.entries(answers)) {
      const label = questionLabels[fieldId] || 'Question';
      answeredContext += `- Question: "${label}"\n  Answer: "${value}"\n`;
    }

    const userPrompt = `You are generating a single closing question for a customer who is finishing the "${visitStage}" stage of their service visit.
Here are the customer's answers to the questions asked so far in this stage:
${answeredContext}

Generate exactly ONE personalized closing question that flows naturally from their prior answers.
You must choose the question type ("text", "star_rating", or "multiple_choice") that best fits what you want to ask:
- Choose "text" if you want detailed feedback.
- Choose "star_rating" for simple sentiment rating.
- Choose "multiple_choice" if there are specific categorical follow-up options.

Return ONLY a raw JSON object matching the following structure. Do NOT wrap in markdown formatting, and do NOT include any explanation or extra text.

Required JSON Structure:
{
  "type": "text" | "star_rating" | "multiple_choice",
  "label": "Question text here",
  "options": ["Option 1", "Option 2"] // Only include and populate this if type is multiple_choice
}

Constraints:
1. The question must be in English.
2. The question must be concise (under 200 characters).
3. If type is "multiple_choice", options must contain between 2 and 4 short, distinct choices.
4. Keep the question professional and relevant to their service visit.`;

    const makeCall = async (): Promise<string> => {
      if (!process.env.DEEPSEEK_API_KEY) {
        throw new Error('DeepSeek API Key is not configured');
      }

      const completion = await deepseek.chat.completions.create({
        model: DEEPSEEK_MODEL,
        temperature: 0.7,
        max_tokens: 120, // strict output token limit (cost control)
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        ...({
          thinking: { type: 'disabled' }
        } as any)
      });

      const content = completion.choices?.[0]?.message?.content;
      if (!content) throw new Error('Empty content received from DeepSeek');
      return content;
    };

    let resultText = '';
    try {
      resultText = await makeCall();
    } catch (firstErr: any) {
      console.warn('First DeepSeek closing question attempt failed, retrying in 500ms...', firstErr.message);
      await new Promise((resolve) => setTimeout(resolve, 500));
      try {
        resultText = await makeCall();
      } catch (retryErr: any) {
        console.error('Second DeepSeek attempt failed:', retryErr.message);
        if (sessionId && visitStage) {
          generatedQuestionsSet.delete(`${sessionId}:${visitStage}`);
        }
        return NextResponse.json({ error: 'DeepSeek generation failed' }, { status: 502 });
      }
    }

    let parsed: any;
    try {
      parsed = JSON.parse(resultText.trim().replace(/^```json\s*|```$/g, '').trim());
    } catch (parseErr: any) {
      console.error('Failed to parse DeepSeek JSON response:', parseErr.message);
      if (sessionId && visitStage) {
        generatedQuestionsSet.delete(`${sessionId}:${visitStage}`);
      }
      return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 502 });
    }

    // SERVER-SIDE VALIDATION
    const { type, label, options } = parsed;

    if (type !== 'text' && type !== 'star_rating' && type !== 'multiple_choice' && type !== 'numeric_scale') {
      console.error(`AI question validation failed: Invalid question type attempted: "${type}"`);
      if (sessionId && visitStage) {
        generatedQuestionsSet.delete(`${sessionId}:${visitStage}`);
      }
      return NextResponse.json({ error: 'Invalid question type generated' }, { status: 502 });
    }

    if (typeof label !== 'string' || label.trim() === '') {
      console.error(`AI question validation failed: Empty label string for type "${type}"`);
      if (sessionId && visitStage) {
        generatedQuestionsSet.delete(`${sessionId}:${visitStage}`);
      }
      return NextResponse.json({ error: 'Empty label generated' }, { status: 502 });
    }

    if (label.length > 200) {
      console.error(`AI question validation failed: Question label exceeds length limit (length: ${label.length}) for type "${type}"`);
      if (sessionId && visitStage) {
        generatedQuestionsSet.delete(`${sessionId}:${visitStage}`);
      }
      return NextResponse.json({ error: 'Question label too long' }, { status: 502 });
    }

    if (type === 'multiple_choice') {
      if (!Array.isArray(options)) {
        console.error(`AI question validation failed: options must be an array for multiple_choice`);
        if (sessionId && visitStage) {
          generatedQuestionsSet.delete(`${sessionId}:${visitStage}`);
        }
        return NextResponse.json({ error: 'Missing options for multiple_choice' }, { status: 502 });
      }
      if (options.length < 2 || options.length > 4) {
        console.error(`AI question validation failed: options length ${options.length} out of range [2, 4]`);
        if (sessionId && visitStage) {
          generatedQuestionsSet.delete(`${sessionId}:${visitStage}`);
        }
        return NextResponse.json({ error: 'Invalid number of options generated' }, { status: 502 });
      }
      if (options.some((opt: any) => typeof opt !== 'string' || opt.trim() === '')) {
        console.error(`AI question validation failed: options contain non-string or empty elements`);
        if (sessionId && visitStage) {
          generatedQuestionsSet.delete(`${sessionId}:${visitStage}`);
        }
        return NextResponse.json({ error: 'Invalid option string elements' }, { status: 502 });
      }
    }

    // Prepare clean response (ensure options is absent if type is text/star_rating)
    const cleanQuestion: {
      type: 'text' | 'star_rating' | 'multiple_choice' | 'numeric_scale';
      label: string;
      options?: string[];
    } = {
      type,
      label: label.trim(),
    };

    if (type === 'multiple_choice') {
      cleanQuestion.options = options.map((opt: string) => opt.trim());
    }

    return NextResponse.json(cleanQuestion);
  } catch (err: any) {
    console.error('Crash in generate-closing-question route:', err);
    if (addedToSet && sessionId && visitStage) {
      generatedQuestionsSet.delete(`${sessionId}:${visitStage}`);
    }
    return NextResponse.json({ error: err.message || err }, { status: 500 });
  }
}
