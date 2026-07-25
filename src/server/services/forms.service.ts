import 'server-only';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { deepseek, DEEPSEEK_MODEL } from '@/server/lib/deepseek';

const ALLOWED_ROLES = ['super_admin', 'ceo', 'agm'];
const FACILITY_ID = '00000000-0000-0000-0000-000000000000';

// ---------------------------------------------------------------------------
// Private helper — auth + role check (shared by all three forms routes)
// ---------------------------------------------------------------------------
async function authorizeFormAdmin(): Promise<
  { authorized: true; admin: ReturnType<typeof createAdminClient> } |
  { authorized: false; response: NextResponse }
> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authorized: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = profile?.role || 'receptionist';
  if (!ALLOWED_ROLES.includes(role)) {
    return { authorized: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { authorized: true, admin };
}

// ---------------------------------------------------------------------------
// Private helper — fetch business context from facility_settings
// ---------------------------------------------------------------------------
async function getBusinessContext(admin: ReturnType<typeof createAdminClient>): Promise<string> {
  const { data: facilitySettings } = await admin
    .from('facility_settings')
    .select('ai_business_context')
    .eq('id', FACILITY_ID)
    .single();

  return facilitySettings?.ai_business_context?.trim() ||
    'You are an AI assistant helping design customer feedback forms for Al Maraghi, a UAE-based automotive service facility. Forms are used on a kiosk to collect feedback from customers immediately after their vehicle service visit. Questions are answered by customers on a tablet in the service center, one at a time. Keep questions concise, professional, and appropriate for a post-service automotive context in the UAE.';
}

// ---------------------------------------------------------------------------
// Private helper — DeepSeek call with 1-second retry
// ---------------------------------------------------------------------------
async function callDeepSeekWithRetry(
  systemPrompt: string,
  userPrompt: string,
  temperature: number
): Promise<string> {
  const makeCall = async () => {
    const completion = await deepseek.chat.completions.create({
      model: DEEPSEEK_MODEL,
      temperature,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });
    const content = completion.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty content received from DeepSeek');
    return content;
  };

  try {
    return await makeCall();
  } catch (err) {
    console.warn('First DeepSeek attempt failed, retrying after 1 second...', err);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return await makeCall();
  }
}

// ---------------------------------------------------------------------------
// suggestQuestions
// ---------------------------------------------------------------------------
export async function suggestQuestions(request: Request): Promise<NextResponse> {
  try {
    const auth = await authorizeFormAdmin();
    if (!auth.authorized) return auth.response;
    const { admin } = auth;

    const body = await request.json();
    const { goal } = body;

    if (!goal || typeof goal !== 'string' || goal.trim() === '') {
      return NextResponse.json({ error: 'Goal description is required' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const locale = cookieStore.get('NEXT_LOCALE')?.value || 'en';
    const languageName = locale === 'ar' ? 'Arabic' : 'English';

    const systemPrompt = await getBusinessContext(admin);

    if (!process.env.DEEPSEEK_API_KEY) {
      return NextResponse.json({ error: 'DeepSeek API Key is not configured' }, { status: 500 });
    }

    const userPrompt = `Generate 3-6 customer feedback questions based on the customer feedback goal: "${goal}".
The generated questions must be in the ${languageName} language (matching the "${locale}" locale).

Return ONLY a raw JSON array matching this exact shape. Do NOT wrap it in markdown formatting (like \`\`\`json) and do NOT include any explanation or extra text.

Required JSON Structure:
[
  {
    "type": "star_rating" | "text" | "multiple_choice",
    "label": "Question text here",
    "options": ["Option 1", "Option 2"]
  }
]

Constraints:
1. "type" can only be "star_rating", "text", or "multiple_choice".
2. "options" must be an empty array [] if type is "star_rating" or "text".
3. "options" must contain 2 to 4 options if type is "multiple_choice".
4. Do NOT include id, order, weight, optionScores, required, or dependsOn.`;

    let content: string;
    try {
      content = await callDeepSeekWithRetry(systemPrompt, userPrompt, 0.4);
    } catch {
      return NextResponse.json({ error: 'AI service unavailable, please try again' }, { status: 502 });
    }

    let parsedArray;
    try {
      const cleaned = content.trim().replace(/^```json\s*|```$/g, '').trim();
      parsedArray = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('Failed to parse DeepSeek output:', content, parseErr);
      return NextResponse.json({ error: 'DeepSeek returned malformed JSON' }, { status: 500 });
    }

    if (!Array.isArray(parsedArray) || parsedArray.length === 0) {
      return NextResponse.json({ error: 'Invalid AI response structure' }, { status: 500 });
    }

    return NextResponse.json({ questions: parsedArray });
  } catch (err: any) {
    console.error('suggestQuestions error:', err);
    return NextResponse.json({ error: err.message || err }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// suggestNextQuestion
// ---------------------------------------------------------------------------
export async function suggestNextQuestion(request: Request): Promise<NextResponse> {
  try {
    const auth = await authorizeFormAdmin();
    if (!auth.authorized) return auth.response;
    const { admin } = auth;

    const body = await request.json();
    const { existingQuestions } = body;

    if (!Array.isArray(existingQuestions) || existingQuestions.length === 0) {
      return NextResponse.json(
        { error: 'Existing questions are required and must be a non-empty array' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const locale = cookieStore.get('NEXT_LOCALE')?.value || 'en';
    const languageName = locale === 'ar' ? 'Arabic' : 'English';

    const systemPrompt = await getBusinessContext(admin);

    if (!process.env.DEEPSEEK_API_KEY) {
      return NextResponse.json({ error: 'DeepSeek API Key is not configured' }, { status: 500 });
    }

    const userPrompt = `Given the following existing questions in a customer feedback form:
${JSON.stringify(existingQuestions, null, 2)}

Suggest ONE additional feedback question that would complement the form well.
The suggested question must be in the ${languageName} language (matching the "${locale}" locale).

Return ONLY a raw JSON object matching this exact shape. Do NOT wrap it in markdown formatting (like \`\`\`json) and do NOT include any explanation or extra text.

Required JSON Structure:
{
  "type": "star_rating" | "text" | "multiple_choice",
  "label": "Question text here",
  "options": ["Option 1", "Option 2"]
}

Constraints:
1. "type" can only be "star_rating", "text", or "multiple_choice".
2. "options" must be an empty array [] if type is "star_rating" or "text".
3. "options" must contain 2 to 4 options if type is "multiple_choice".
4. Do NOT include id, order, weight, optionScores, required, or dependsOn.`;

    let content: string;
    try {
      content = await callDeepSeekWithRetry(systemPrompt, userPrompt, 0.4);
    } catch {
      return NextResponse.json({ error: 'AI service unavailable, please try again' }, { status: 502 });
    }

    let parsedObject;
    try {
      const cleaned = content.trim().replace(/^```json\s*|```$/g, '').trim();
      parsedObject = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('Failed to parse DeepSeek output:', content, parseErr);
      return NextResponse.json({ error: 'DeepSeek returned malformed JSON' }, { status: 500 });
    }

    if (!parsedObject || typeof parsedObject !== 'object' || !parsedObject.type || !parsedObject.label) {
      return NextResponse.json({ error: 'Invalid AI response structure' }, { status: 500 });
    }

    return NextResponse.json({ question: parsedObject });
  } catch (err: any) {
    console.error('suggestNextQuestion error:', err);
    return NextResponse.json({ error: err.message || err }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// suggestWeights
// ---------------------------------------------------------------------------
export async function suggestWeights(request: Request): Promise<NextResponse> {
  try {
    const auth = await authorizeFormAdmin();
    if (!auth.authorized) return auth.response;

    const body = await request.json();
    const { questions } = body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: 'No scoreable questions provided' }, { status: 400 });
    }

    if (!process.env.DEEPSEEK_API_KEY) {
      return NextResponse.json({ error: 'DeepSeek API Key is not configured' }, { status: 500 });
    }

    const systemPrompt = 'You are a database and API server that only returns raw JSON objects.';

    const userPrompt = `You are a professional survey and feedback designer.
Analyze the following scoreable questions for a customer satisfaction survey. Questions can be of type "star_rating", "multiple_choice", or "text" (where text answers are evaluated by AI for sentiment and relevance).
Provide:
1. A suggested weight (percentage) for each question such that the sum of all weights across all these questions is EXACTLY 100.
2. For multiple choice questions only, suggest a score from 0 to 100 for each option based on customer satisfaction (e.g. "Excellent" = 100, "Good" = 75, "Neutral" = 50, "Poor" = 25, "Terrible" = 0, or "Yes" = 100, "No" = 0).
3. Do NOT include optionScores for "star_rating" or "text" questions in the final output. Only "multiple_choice" questions should be present in the optionScores mapping.

Questions:
${JSON.stringify(questions, null, 2)}

Return ONLY a raw JSON object matching the following TypeScript schema exactly. Do not wrap it in markdown formatting (like \`\`\`json) or include any explanation.

Schema:
{
  "weights": {
    "[questionId]": number (weight between 0 and 100)
  },
  "optionScores": {
    "[questionId]": number[] (an array of scores between 0 and 100, matching the question options array index-for-index, ONLY for multiple_choice questions)
  }
}`;

    let resultText: string;
    try {
      resultText = await callDeepSeekWithRetry(systemPrompt, userPrompt, 0.1);
    } catch {
      return NextResponse.json({ error: 'AI service unavailable, please try again' }, { status: 502 });
    }

    let suggestions;
    try {
      suggestions = JSON.parse(resultText.trim().replace(/^```json\s*|```$/g, ''));
    } catch (parseErr) {
      console.error('Failed to parse DeepSeek output:', resultText);
      return NextResponse.json({ error: 'DeepSeek returned malformed JSON' }, { status: 502 });
    }

    return NextResponse.json(suggestions);
  } catch (err: any) {
    console.error('suggestWeights error:', err);
    return NextResponse.json({ error: err.message || err }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// translateForm — English → Arabic translation for form content
// ---------------------------------------------------------------------------
const TRANSLATE_SYSTEM_PROMPT =
  'You are a professional Arabic translator. Translate all provided text from English to Arabic for a UAE automotive service customer feedback form. Return only raw JSON with no explanation, no markdown, no code fences. Preserve the exact same JSON structure you receive. Translate only the string values, never the keys.';

export async function translateForm(request: Request): Promise<NextResponse> {
  try {
    const auth = await authorizeFormAdmin();
    if (!auth.authorized) return auth.response;

    if (!process.env.DEEPSEEK_API_KEY) {
      return NextResponse.json({ error: 'DeepSeek API Key is not configured' }, { status: 500 });
    }

    const body = await request.json();

    // -----------------------------------------------------------------------
    // MODE 2 — single field translation (fieldId + label + options?)
    // -----------------------------------------------------------------------
    if (body.fieldId && body.label !== undefined) {
      const payload: Record<string, any> = { label: body.label };
      if (Array.isArray(body.options) && body.options.length > 0) {
        payload.options = body.options;
      }

      const userPrompt = `Translate the following JSON values from English to Arabic. Return the exact same JSON structure with translated string values:\n${JSON.stringify(payload)}`;

      let content: string;
      try {
        content = await callDeepSeekWithRetry(TRANSLATE_SYSTEM_PROMPT, userPrompt, 0.2);
      } catch {
        return NextResponse.json({ error: 'AI service unavailable, please try again' }, { status: 502 });
      }

      let parsed;
      try {
        parsed = JSON.parse(content.trim().replace(/^```json\s*|```$/g, '').trim());
      } catch {
        console.error('translateForm (single) — failed to parse:', content);
        return NextResponse.json({ error: 'Translation failed — invalid response from AI' }, { status: 500 });
      }

      return NextResponse.json({
        fieldId: body.fieldId,
        ar: {
          label: parsed.label || '',
          options: Array.isArray(parsed.options) ? parsed.options : [],
        },
      });
    }

    // -----------------------------------------------------------------------
    // MODE 1 — bulk translation (fields[] + name? + description?)
    // -----------------------------------------------------------------------
    if (!Array.isArray(body.fields) || body.fields.length === 0) {
      return NextResponse.json(
        { error: 'Request must include "fields" array (bulk mode) or "fieldId"+"label" (single mode)' },
        { status: 400 }
      );
    }

    // Build a single payload with everything to translate in one call
    const bulkPayload: Record<string, any> = {};
    if (body.name) bulkPayload.name = body.name;
    if (body.description) bulkPayload.description = body.description;
    bulkPayload.fields = body.fields.map((f: any) => {
      const entry: Record<string, any> = { id: f.id, label: f.label };
      if (Array.isArray(f.options) && f.options.length > 0) {
        entry.options = f.options;
      }
      return entry;
    });

    const userPrompt = `Translate the following JSON values from English to Arabic. Return the exact same JSON structure with translated string values. Do NOT translate the "id" values — keep them exactly as they are:\n${JSON.stringify(bulkPayload)}`;

    let content: string;
    try {
      content = await callDeepSeekWithRetry(TRANSLATE_SYSTEM_PROMPT, userPrompt, 0.2);
    } catch {
      return NextResponse.json({ error: 'AI service unavailable, please try again' }, { status: 502 });
    }

    let parsed;
    try {
      parsed = JSON.parse(content.trim().replace(/^```json\s*|```$/g, '').trim());
    } catch {
      console.error('translateForm (bulk) — failed to parse:', content);
      return NextResponse.json({ error: 'Translation failed — invalid response from AI' }, { status: 500 });
    }

    const responseFields = Array.isArray(parsed.fields)
      ? parsed.fields.map((f: any) => ({
          id: f.id,
          ar: {
            label: f.label || '',
            options: Array.isArray(f.options) ? f.options : [],
          },
        }))
      : [];

    return NextResponse.json({
      name_ar: parsed.name || '',
      description_ar: parsed.description || '',
      fields: responseFields,
    });
  } catch (err: any) {
    console.error('translateForm error:', err);
    return NextResponse.json({ error: err.message || err }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// suggestBranching — AI suggest branching conditions for form questions
// ---------------------------------------------------------------------------
export async function suggestBranching(request: Request): Promise<NextResponse> {
  try {
    const auth = await authorizeFormAdmin();
    if (!auth.authorized) return auth.response;

    const body = await request.json();
    const { questions } = body;

    if (!Array.isArray(questions) || questions.length <= 1) {
      return NextResponse.json(
        { error: 'Questions must be an array with at least 2 questions' },
        { status: 400 }
      );
    }

    if (!process.env.DEEPSEEK_API_KEY) {
      return NextResponse.json({ error: 'DeepSeek API Key is not configured' }, { status: 500 });
    }

    const possibleSources = questions.filter(
      (q: any) => q.type === 'multiple_choice' || q.type === 'star_rating'
    );

    if (possibleSources.length === 0) {
      return NextResponse.json({ suggestions: [] });
    }

    const systemPrompt = 'You are a database and API server that only returns raw JSON objects.';

    const userPrompt = `You are an expert survey designer for Al Maraghi, a UAE automotive service facility.
Analyze the following ordered list of feedback questions:
${JSON.stringify(questions, null, 2)}

Only these questions are valid condition sources (multiple_choice or star_rating):
${JSON.stringify(possibleSources, null, 2)}

Task:
- For each question that is NOT the first question, suggest whether it should have a branch condition based on an earlier question in the list.
- Only suggest a condition if it makes clear practical sense for a UAE automotive service feedback context (e.g. a low star rating leading to a follow-up "what went wrong" question, or a specific multiple choice answer leading to a more specific question).
- Not every question needs a condition — most should have none.
- A condition can only reference a question earlier in the list, never itself or a later question.
- For multiple_choice source questions: operator must be "equals" or "not_equals", and value must be one of that question's exact option strings.
- For star_rating source questions: operator must be "lte" or "gte", and value must be an integer from 1 to 5.
- Return ONLY questions that should have a suggested condition — omit questions that should stay unconditional.

Return ONLY a raw JSON object matching this schema exactly. Do NOT wrap it in markdown formatting (like \`\`\`json) and do NOT include any explanation or extra text.

Schema:
{
  "suggestions": [
    {
      "fieldId": "the id of the question that should be conditional",
      "condition": {
        "fieldId": "the id of the earlier source question",
        "operator": "equals" | "not_equals" | "lte" | "gte",
        "value": "string or number matching the source question's type"
      },
      "reasoning": "one short sentence explaining why in plain language"
    }
  ]
}`;

    let resultText: string;
    try {
      resultText = await callDeepSeekWithRetry(systemPrompt, userPrompt, 0.2);
    } catch {
      return NextResponse.json({ error: 'AI service unavailable, please try again' }, { status: 502 });
    }

    let parsed;
    try {
      parsed = JSON.parse(resultText.trim().replace(/^```json\s*|```$/g, '').trim());
    } catch (parseErr) {
      console.error('Failed to parse DeepSeek output:', resultText, parseErr);
      return NextResponse.json({ error: 'DeepSeek returned malformed JSON' }, { status: 502 });
    }

    const validSuggestions = [];
    if (parsed && Array.isArray(parsed.suggestions)) {
      for (const item of parsed.suggestions) {
        if (!item || typeof item !== 'object') continue;
        const { fieldId, condition, reasoning } = item;
        if (!fieldId || !condition || typeof condition !== 'object') continue;

        const targetIdx = questions.findIndex((q: any) => q.id === fieldId);
        if (targetIdx <= 0) continue; // Target question must exist and not be the first question

        const sourceQ = questions.find((q: any) => q.id === condition.fieldId);
        if (!sourceQ) continue;

        const sourceIdx = questions.findIndex((q: any) => q.id === condition.fieldId);
        if (sourceIdx < 0 || sourceIdx >= targetIdx) continue; // Source must appear earlier

        if (sourceQ.type !== 'multiple_choice' && sourceQ.type !== 'star_rating') continue;

        if (sourceQ.type === 'multiple_choice') {
          if (condition.operator !== 'equals' && condition.operator !== 'not_equals') continue;
          if (!Array.isArray(sourceQ.options) || !sourceQ.options.includes(String(condition.value))) continue;
        } else if (sourceQ.type === 'star_rating') {
          if (condition.operator !== 'lte' && condition.operator !== 'gte') continue;
          const numVal = Number(condition.value);
          if (!Number.isInteger(numVal) || numVal < 1 || numVal > 5) continue;
          condition.value = numVal;
        }

        validSuggestions.push({
          fieldId,
          condition: {
            fieldId: condition.fieldId,
            operator: condition.operator,
            value: condition.value,
          },
          reasoning: typeof reasoning === 'string' ? reasoning : '',
        });
      }
    }

    return NextResponse.json({ suggestions: validSuggestions });
  } catch (err: any) {
    console.error('suggestBranching error:', err);
    return NextResponse.json({ error: err.message || err }, { status: 500 });
  }
}
