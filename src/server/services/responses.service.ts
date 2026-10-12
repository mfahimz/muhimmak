import 'server-only';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { guardAnalyticsAccess } from '@/server/lib/analytics-access';
import { decryptPlate } from '@/lib/utils/plate-number';
import { computeWeightedScore } from '@/server/services/sessions.service';
import { deepseek, DEEPSEEK_MODEL, DEEPSEEK_NO_THINKING } from '@/server/lib/deepseek';
import ExcelJS from 'exceljs';

export interface QuestionMeta {
  id: string;
  labelEn: string;
  labelAr: string | null;
  type: string;
  options: string[];
  optionScores?: number[];
  weight: number;
  roleTag: string;
  visitStage: string;
  order: number;
}

export interface QuestionSummaryStat {
  id: string;
  labelEn: string;
  labelAr: string | null;
  type: string;
  roleTag: string;
  visitStage: string;
  totalAnswers: number;
  responseRate: number;
  averageRating: number | null;
  averageNormalizedScore: number | null;
  choiceDistribution: { label: string; count: number; percentage: number }[];
  textCount: number;
}

export interface EnrichedResponse {
  responseId: string;
  sessionId: string;
  formId: string;
  formName: string;
  submittedAt: string;
  sessionStatus: string;
  channel: string;
  visitStage: string;
  language: string;
  plateNumber: string | null;
  mobileNumber: string | null;
  googleReviewClicked: boolean;
  overallScore: number | null;
  aiTextScore: number | null;
  aiAnalysisSummary: string | null;
  answers: Record<string, unknown>;
  textScores: Record<string, number>;
  perQuestionScores: Record<string, number>;
}

interface FormField {
  id: string;
  label?: string;
  name?: string;
  ar?: { label?: string };
  type?: string;
  options?: string[];
  optionScores?: number[];
  weight?: number;
  roleTag?: string;
  domain?: string;
  visit_stage?: string;
}

interface ResponseRow {
  id: string;
  session_id: string;
  form_id: string;
  submitted_at: string;
  answers?: Record<string, unknown>;
  ai_text_score: number | null;
}

export interface TextFeedbackItem {
  responseId: string;
  sessionId: string;
  plateNumber: string | null;
  mobileNumber: string | null;
  submittedAt: string;
  visitStage: string;
  language: string;
  questionId: string;
  questionLabelEn: string;
  questionLabelAr: string | null;
  customerComment: string;
  aiScore: number | null;
  overallScore: number | null;
}

export interface LiveResponsesData {
  deepseekConfigured: boolean;
  aiStatus: {
    totalTextFeedback: number;
    scoredTextFeedback: number;
    unscoredTextFeedback: number;
    totalCompletedSessions: number;
    sessionsWithAiSummary: number;
    sessionsWithoutAiSummary: number;
  };
  overview: {
    totalResponses: number;
    totalSessions: number;
    averageScore: number | null;
    dropOffAverageScore: number | null;
    pickUpAverageScore: number | null;
    googleReviewClickCount: number;
  };
  questions: QuestionMeta[];
  questionStats: QuestionSummaryStat[];
  responses: EnrichedResponse[];
  textFeedback: TextFeedbackItem[];
}

export async function fetchLiveResponsesData(options?: {
  startDate?: string;
  endDate?: string;
  visitStage?: string;
  searchTerm?: string;
}): Promise<LiveResponsesData> {
  const admin = createAdminClient();

  let sessionsQuery = admin.from('sessions').select('*').order('created_at', { ascending: false });
  if (options?.startDate) {
    sessionsQuery = sessionsQuery.gte('created_at', `${options.startDate}T00:00:00.000Z`);
  }
  if (options?.endDate) {
    sessionsQuery = sessionsQuery.lte('created_at', `${options.endDate}T23:59:59.999Z`);
  }
  if (options?.visitStage && options.visitStage !== 'all') {
    sessionsQuery = sessionsQuery.eq('visit_stage', options.visitStage);
  }

  const { data: rawSessions, error: sErr } = await sessionsQuery;
  if (sErr) throw sErr;

  const sessionIds = (rawSessions || []).map((s) => s.id);

  let responsesQuery = admin.from('responses').select('*').order('submitted_at', { ascending: false });
  if (sessionIds.length > 0) {
    responsesQuery = responsesQuery.in('session_id', sessionIds);
  } else if (options?.startDate || options?.endDate || (options?.visitStage && options.visitStage !== 'all')) {
    // No matching sessions in date/stage range
    responsesQuery = responsesQuery.in('session_id', ['00000000-0000-0000-0000-000000000000']);
  }

  const { data: rawResponses, error: rErr } = await responsesQuery;
  if (rErr) throw rErr;

  const { data: rawForms, error: fErr } = await admin.from('forms').select('*');
  if (fErr) throw fErr;

  const sessionMap = new Map((rawSessions || []).map((s) => [s.id, s]));
  const formMap = new Map((rawForms || []).map((f) => [f.id, f]));

  // Master questions catalog
  const masterQuestions = new Map<string, QuestionMeta>();
  (rawForms || []).forEach((form) => {
    (form.fields || []).forEach((field: FormField, idx: number) => {
      if (!masterQuestions.has(field.id)) {
        masterQuestions.set(field.id, {
          id: field.id,
          labelEn: field.label || field.name || 'Untitled Question',
          labelAr: field.ar?.label || null,
          type: field.type || 'text',
          options: Array.isArray(field.options) ? field.options : [],
          optionScores: Array.isArray(field.optionScores) ? field.optionScores : undefined,
          weight: typeof field.weight === 'number' ? field.weight : 0,
          roleTag: field.roleTag || field.domain || 'general',
          visitStage: field.visit_stage || 'general',
          order: idx + 1,
        });
      }
    });
  });

  const questionList = Array.from(masterQuestions.values()).sort((a, b) => {
    const stageOrder: Record<string, number> = { drop_off: 1, pick_up: 2, general: 3 };
    const aOrder = stageOrder[a.visitStage] || 4;
    const bOrder = stageOrder[b.visitStage] || 4;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.order - b.order;
  });

  // Track text scoring health
  let totalTextFeedback = 0;
  let scoredTextFeedback = 0;
  let unscoredTextFeedback = 0;

  const textFeedbackItems: TextFeedbackItem[] = [];

  const enrichedResponses: EnrichedResponse[] = [];
  const scoresByStage: Record<string, number[]> = { drop_off: [], pick_up: [] };
  const allScores: number[] = [];
  let googleReviewClickCount = 0;

  (rawResponses || []).forEach((r: ResponseRow) => {
    const s = sessionMap.get(r.session_id) || {};
    const f = formMap.get(r.form_id) || {};
    const fields = f.fields || [];

    const answers = r.answers || {};
    const textScores = (answers._textScores as Record<string, number>) || {};

    const { finalScore } = computeWeightedScore(fields, answers, textScores);

    // Compute normalized per-question scores
    const perQuestionScores: Record<string, number> = {};
    (fields || []).forEach((field: FormField) => {
      const ans = answers[field.id];
      if (ans !== undefined && ans !== null && ans !== '') {
        if (field.type === 'star_rating') {
          perQuestionScores[field.id] = Math.round((Number(ans) / 5) * 100);
        } else if (field.type === 'numeric_scale') {
          perQuestionScores[field.id] = Math.round(((Number(ans) - 1) / 9) * 100);
        } else if (field.type === 'multiple_choice') {
          const optIdx = Array.isArray(field.options) ? field.options.indexOf(String(ans)) : -1;
          if (optIdx !== -1 && Array.isArray(field.optionScores) && field.optionScores[optIdx] !== undefined) {
            perQuestionScores[field.id] = field.optionScores[optIdx];
          }
        } else if (field.type === 'text') {
          const scored = textScores[field.id];
          if (typeof scored === 'number') {
            perQuestionScores[field.id] = scored;
          }
        }
      }
    });

    const decryptedPlate = decryptPlate(s.plate_number_encrypted);

    if (s.google_review_clicked) {
      googleReviewClickCount++;
    }

    if (finalScore !== null && !isNaN(finalScore)) {
      allScores.push(finalScore);
      if (s.visit_stage === 'drop_off' || s.visit_stage === 'pick_up') {
        scoresByStage[s.visit_stage].push(finalScore);
      }
    }

    // Process text feedback items
    questionList.forEach((q) => {
      if (q.type === 'text') {
        const comment = answers[q.id];
        if (typeof comment === 'string' && comment.trim().length > 0) {
          totalTextFeedback++;
          const score = typeof textScores[q.id] === 'number' ? textScores[q.id] : null;
          if (score !== null) {
            scoredTextFeedback++;
          } else {
            unscoredTextFeedback++;
          }

          textFeedbackItems.push({
            responseId: r.id,
            sessionId: r.session_id,
            plateNumber: decryptedPlate,
            mobileNumber: s.mobile_number || null,
            submittedAt: r.submitted_at,
            visitStage: q.visitStage || s.visit_stage || 'general',
            language: s.language || 'en',
            questionId: q.id,
            questionLabelEn: q.labelEn,
            questionLabelAr: q.labelAr,
            customerComment: comment.trim(),
            aiScore: score,
            overallScore: finalScore,
          });
        }
      }
    });

    enrichedResponses.push({
      responseId: r.id,
      sessionId: r.session_id,
      formId: r.form_id,
      formName: f.name || 'Feedback Survey',
      submittedAt: r.submitted_at,
      sessionStatus: s.status || 'completed',
      channel: s.channel || 'kiosk',
      visitStage: s.visit_stage || 'general',
      language: s.language || 'en',
      plateNumber: decryptedPlate,
      mobileNumber: s.mobile_number || null,
      googleReviewClicked: !!s.google_review_clicked,
      overallScore: finalScore,
      aiTextScore: r.ai_text_score,
      aiAnalysisSummary: s.ai_analysis_summary || null,
      answers,
      textScores,
      perQuestionScores,
    });
  });

  // Calculate question summary stats
  const totalResponses = enrichedResponses.length;
  const questionStats: QuestionSummaryStat[] = questionList.map((q) => {
    const rawAnswers = enrichedResponses
      .map((r) => r.answers[q.id])
      .filter((a) => a !== undefined && a !== null && a !== '');

    const totalAnswers = rawAnswers.length;
    const responseRate = totalResponses > 0 ? Math.round((totalAnswers / totalResponses) * 1000) / 10 : 0;

    let averageRating: number | null = null;
    let averageNormalizedScore: number | null = null;

    if (q.type === 'star_rating' || q.type === 'numeric_scale') {
      const numbers = rawAnswers.map((a) => Number(a)).filter((n) => !isNaN(n));
      if (numbers.length > 0) {
        averageRating = Math.round((numbers.reduce((sum, n) => sum + n, 0) / numbers.length) * 10) / 10;
        const normScores = enrichedResponses
          .map((r) => r.perQuestionScores[q.id])
          .filter((s) => typeof s === 'number');
        if (normScores.length > 0) {
          averageNormalizedScore = Math.round(normScores.reduce((sum, n) => sum + n, 0) / normScores.length);
        }
      }
    } else if (q.type === 'multiple_choice') {
      const normScores = enrichedResponses
        .map((r) => r.perQuestionScores[q.id])
        .filter((s) => typeof s === 'number');
      if (normScores.length > 0) {
        averageNormalizedScore = Math.round(normScores.reduce((sum, n) => sum + n, 0) / normScores.length);
      }
    }

    const choiceDistribution: { label: string; count: number; percentage: number }[] = [];
    if (q.type === 'multiple_choice') {
      const counts: Record<string, number> = {};
      rawAnswers.forEach((a) => {
        const str = String(a);
        counts[str] = (counts[str] || 0) + 1;
      });
      Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([label, count]) => {
          choiceDistribution.push({
            label,
            count,
            percentage: totalAnswers > 0 ? Math.round((count / totalAnswers) * 100) : 0,
          });
        });
    }

    return {
      id: q.id,
      labelEn: q.labelEn,
      labelAr: q.labelAr,
      type: q.type,
      roleTag: q.roleTag,
      visitStage: q.visitStage,
      totalAnswers,
      responseRate,
      averageRating,
      averageNormalizedScore,
      choiceDistribution,
      textCount: q.type === 'text' ? totalAnswers : 0,
    };
  });

  // Calculate overview metrics
  const completedSessions = (rawSessions || []).filter((s) => s.status === 'completed');
  const sessionsWithAiSummary = completedSessions.filter((s) => !!s.ai_analysis_summary).length;
  const sessionsWithoutAiSummary = completedSessions.length - sessionsWithAiSummary;

  const averageScore = allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : null;
  const dropOffAverageScore =
    scoresByStage.drop_off.length > 0
      ? Math.round(scoresByStage.drop_off.reduce((a, b) => a + b, 0) / scoresByStage.drop_off.length)
      : null;
  const pickUpAverageScore =
    scoresByStage.pick_up.length > 0
      ? Math.round(scoresByStage.pick_up.reduce((a, b) => a + b, 0) / scoresByStage.pick_up.length)
      : null;

  return {
    deepseekConfigured: !!process.env.DEEPSEEK_API_KEY,
    aiStatus: {
      totalTextFeedback,
      scoredTextFeedback,
      unscoredTextFeedback,
      totalCompletedSessions: completedSessions.length,
      sessionsWithAiSummary,
      sessionsWithoutAiSummary,
    },
    overview: {
      totalResponses,
      totalSessions: (rawSessions || []).length,
      averageScore,
      dropOffAverageScore,
      pickUpAverageScore,
      googleReviewClickCount,
    },
    questions: questionList,
    questionStats,
    responses: enrichedResponses,
    textFeedback: textFeedbackItems,
  };
}

/**
 * Run AI Batch Scoring on unscored feedback and generate missing AI session summaries.
 * Adheres to AGENTS.md retry requirements (>= 1s delay for transient errors).
 */
export async function runAiBatchScoring(): Promise<{
  success: boolean;
  scoredFeedbackCount: number;
  generatedSummaryCount: number;
  errors: string[];
}> {
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY is not configured in environment variables');
  }

  const admin = createAdminClient();
  const errors: string[] = [];
  let scoredFeedbackCount = 0;
  let generatedSummaryCount = 0;

  // 1. Fetch forms to get question labels
  const { data: rawForms } = await admin.from('forms').select('*');
  const questionMap = new Map<string, FormField>();
  (rawForms || []).forEach((form) => {
    (form.fields || []).forEach((field: FormField) => {
      questionMap.set(field.id, field);
    });
  });

  // Facility settings for business context
  const { data: facilitySettings } = await admin
    .from('facility_settings')
    .select('ai_business_context')
    .eq('id', '00000000-0000-0000-0000-000000000000')
    .single();

  const systemContext =
    facilitySettings?.ai_business_context?.trim() ||
    'You are an AI quality assurance and customer satisfaction analyst for Al Maraghi, an automotive service facility in the UAE.';

  // 2. Fetch all responses to scan for unscored text feedback
  const { data: rawResponses } = await admin.from('responses').select('*');

  for (const resp of rawResponses || []) {
    const answers = resp.answers || {};
    const textScores = answers._textScores || {};
    let needsUpdate = false;

    for (const [key, val] of Object.entries(answers)) {
      if (key.startsWith('_')) continue;
      const field = questionMap.get(key);
      if (field?.type === 'text' && typeof val === 'string' && val.trim().length > 0) {
        if (textScores[key] === undefined || textScores[key] === null) {
          // Unscored text answer found! Score it via DeepSeek with retry logic
          const questionLabel = field.label || 'Customer Feedback';
          const answerText = val.trim();

          const makeScoringCall = async (): Promise<number> => {
            const userPrompt = `You are evaluating a customer feedback response for an automotive service facility. Score the following text answer on a scale of 0 to 100, where 0 means extremely negative/destructive feedback and 100 means extremely positive feedback. Consider both sentiment (how positive or negative) and relevance (how well it answers the question). Return ONLY a raw JSON object with a single field: { score: number }. No explanation, no markdown. Question: ${questionLabel}. Customer answer: ${answerText}`;

            const completion = await deepseek.chat.completions.create({
              model: DEEPSEEK_MODEL,
              temperature: 0.1,
              ...DEEPSEEK_NO_THINKING,
              response_format: { type: 'json_object' },
              messages: [
                { role: 'system', content: systemContext },
                { role: 'user', content: userPrompt },
              ],
            });

            const content = completion.choices?.[0]?.message?.content;
            if (!content) throw new Error('Empty content from DeepSeek');
            const parsed = JSON.parse(content.trim().replace(/^```json\s*|```$/g, ''));
            if (typeof parsed.score !== 'number') throw new Error('No numeric score returned');
            return Math.min(100, Math.max(0, parsed.score));
          };

          try {
            let score: number;
            try {
              score = await makeScoringCall();
            } catch {
              // Retry with >= 1s delay per AGENTS.md rules
              await new Promise((r) => setTimeout(r, 1000));
              score = await makeScoringCall();
            }

            textScores[key] = score;
            needsUpdate = true;
            scoredFeedbackCount++;
          } catch (err: unknown) {
            errors.push(`Failed scoring text for response ${resp.id}: ${(err as Error).message}`);
          }
        }
      }
    }

    if (needsUpdate) {
      // Recompute weighted score and overall AI text score
      const form = (rawForms || []).find((f) => f.id === resp.form_id);
      const { aiTextScore } = computeWeightedScore(form?.fields || [], answers, textScores);

      const updatedAnswers = { ...answers, _textScores: textScores };
      await admin
        .from('responses')
        .update({ answers: updatedAnswers, ai_text_score: aiTextScore })
        .eq('id', resp.id);
    }
  }

  // 3. Scan completed sessions missing ai_analysis_summary
  const { data: pendingSessions } = await admin
    .from('sessions')
    .select('id, form_id, status, ai_analysis_summary')
    .eq('status', 'completed')
    .is('ai_analysis_summary', null);

  for (const session of pendingSessions || []) {
    try {
      const { data: resp } = await admin.from('responses').select('answers').eq('session_id', session.id).maybeSingle();
      if (!resp || !resp.answers) continue;

      const form = (rawForms || []).find((f) => f.id === session.form_id);
      const fields = form?.fields || [];

      const answerText = fields
        .filter((f: FormField) => resp.answers[f.id] !== undefined && resp.answers[f.id] !== null)
        .map((f: FormField) => `Q: ${f.label}\nA: ${resp.answers[f.id]}`)
        .join('\n\n');

      if (!answerText.trim()) continue;

      const makeSummaryCall = async (): Promise<string> => {
        const completion = await deepseek.chat.completions.create({
          model: DEEPSEEK_MODEL,
          temperature: 0.3,
          ...DEEPSEEK_NO_THINKING,
          messages: [
            { role: 'system', content: systemContext },
            {
              role: 'user',
              content: `Analyze this customer feedback and write a concise 3-4 sentence professional summary. Highlight key sentiment, notable positives, concerns, and an overall impression. Plain text only, no markdown.\n\n${answerText}`,
            },
          ],
        });
        const summary = completion.choices?.[0]?.message?.content?.trim();
        if (!summary) throw new Error('Empty summary from DeepSeek');
        return summary;
      };

      let summary: string;
      try {
        summary = await makeSummaryCall();
      } catch {
        await new Promise((r) => setTimeout(r, 1000));
        summary = await makeSummaryCall();
      }

      await admin
        .from('sessions')
        .update({
          ai_analysis_summary: summary,
          ai_analysis_generated_at: new Date().toISOString(),
        })
        .eq('id', session.id);

      generatedSummaryCount++;
    } catch (err: unknown) {
      errors.push(`Failed summary for session ${session.id}: ${(err as Error).message}`);
    }
  }

  return {
    success: true,
    scoredFeedbackCount,
    generatedSummaryCount,
    errors,
  };
}

/**
 * Generate a multi-tab Excel workbook stream directly using ExcelJS
 */
export async function generateLiveResponsesExcelBuffer(): Promise<Buffer> {
  const data = await fetchLiveResponsesData();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Muhimmak Al Maraghi Feedback System';
  workbook.created = new Date();

  const NAVY_HEADER = '1E3A8A';
  const headerFont: Partial<ExcelJS.Font> = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  const headerFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF' + NAVY_HEADER },
  };
  const headerAlignment: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle', wrapText: true };

  const zebraFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF1F5F9' },
  };
  const whiteFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFFFFF' },
  };
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  };

  // TAB 1: Responses by Question
  const ws1 = workbook.addWorksheet('Responses by Question', { views: [{ showGridLines: true }] });
  const headers1 = [
    'Question ID',
    'Stage',
    'Department / Role',
    'Question (English)',
    'Question (Arabic)',
    'Question Type',
    'Plate Number',
    'Mobile Number',
    'Language',
    'Submission Date & Time',
    'Customer Answer',
    'Normalized Score (0-100)',
    'Overall Survey Score',
    'Channel',
    'Response ID',
  ];
  const row1 = ws1.addRow(headers1);
  row1.height = 28;
  row1.eachCell((cell) => {
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = headerAlignment;
    cell.border = thinBorder;
  });

  let rowIdx1 = 2;
  data.questions.forEach((q) => {
    data.responses.forEach((r) => {
      const ans = r.answers[q.id];
      if (ans !== undefined && ans !== null && ans !== '') {
        const normScore = r.perQuestionScores[q.id];
        const formattedDate = r.submittedAt ? r.submittedAt.replace('T', ' ').substring(0, 16) : '';

        const dataRow = ws1.addRow([
          q.id,
          q.visitStage.replace('_', ' ').toUpperCase(),
          q.roleTag.replace('_', ' ').toUpperCase(),
          q.labelEn,
          q.labelAr || '',
          q.type,
          r.plateNumber || 'N/A',
          r.mobileNumber || 'N/A',
          r.language.toUpperCase(),
          formattedDate,
          String(ans),
          normScore !== undefined ? normScore : 'N/A',
          r.overallScore !== null ? r.overallScore : 'N/A',
          r.channel,
          r.responseId,
        ]);

        dataRow.height = 22;
        const fill = rowIdx1 % 2 === 0 ? zebraFill : whiteFill;
        dataRow.eachCell((cell, colNum) => {
          cell.font = { name: 'Calibri', size: 10 };
          cell.fill = fill;
          cell.border = thinBorder;
          if ([1, 2, 3, 6, 7, 8, 9, 10, 12, 13, 14].includes(colNum)) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else if ([4, 5, 11].includes(colNum)) {
            cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
          } else {
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
          }
        });
        rowIdx1++;
      }
    });
  });

  // TAB 2: All Submissions (Matrix)
  const ws2 = workbook.addWorksheet('All Submissions (Flat Matrix)', { views: [{ showGridLines: true }] });
  const baseHeaders2 = [
    'Submission Date',
    'Plate Number',
    'Mobile Number',
    'Visit Stage',
    'Channel',
    'Language',
    'Overall Score',
    'Google Review Clicked',
    'AI Analysis Summary',
  ];
  const questionHeaders2 = data.questions.map((q) => `Q: ${q.labelEn}`);
  const headers2 = baseHeaders2.concat(questionHeaders2);
  const row2 = ws2.addRow(headers2);
  row2.height = 36;
  row2.eachCell((cell) => {
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = headerAlignment;
    cell.border = thinBorder;
  });

  let rowIdx2 = 2;
  data.responses.forEach((r) => {
    const formattedDate = r.submittedAt ? r.submittedAt.replace('T', ' ').substring(0, 16) : '';
    const rowValues = [
      formattedDate,
      r.plateNumber || 'N/A',
      r.mobileNumber || 'N/A',
      r.visitStage.replace('_', ' ').toUpperCase(),
      r.channel,
      r.language.toUpperCase(),
      r.overallScore !== null ? r.overallScore : 'N/A',
      r.googleReviewClicked ? 'Yes' : 'No',
      r.aiAnalysisSummary || '',
    ];

    data.questions.forEach((q) => {
      const ans = r.answers[q.id];
      rowValues.push(ans !== undefined && ans !== null ? String(ans) : '');
    });

    const dataRow = ws2.addRow(rowValues);
    dataRow.height = 24;
    const fill = rowIdx2 % 2 === 0 ? zebraFill : whiteFill;
    dataRow.eachCell((cell, colNum) => {
      cell.font = { name: 'Calibri', size: 10 };
      cell.fill = fill;
      cell.border = thinBorder;
      if (colNum <= 8) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      }
    });
    rowIdx2++;
  });

  // TAB 3: Question Summary & Stats
  const ws3 = workbook.addWorksheet('Question Summary & Stats', { views: [{ showGridLines: true }] });
  const headers3 = [
    'Question ID',
    'Stage',
    'Department / Role',
    'Question (English)',
    'Question (Arabic)',
    'Question Type',
    'Total Responses',
    'Response Rate (%)',
    'Average Rating / Score',
    'Answer Distribution / Common Responses',
  ];
  const row3 = ws3.addRow(headers3);
  row3.height = 28;
  row3.eachCell((cell) => {
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = headerAlignment;
    cell.border = thinBorder;
  });

  let rowIdx3 = 2;
  data.questionStats.forEach((qs) => {
    let avgStr = 'N/A';
    if (qs.averageRating !== null) {
      avgStr = `${qs.averageRating} / ${qs.type === 'star_rating' ? 5 : 10} (${qs.averageNormalizedScore}%)`;
    } else if (qs.averageNormalizedScore !== null) {
      avgStr = `${qs.averageNormalizedScore}% avg score`;
    }

    let distStr = '';
    if (qs.type === 'multiple_choice') {
      distStr = qs.choiceDistribution.map((c) => `${c.label}: ${c.count} (${c.percentage}%)`).join(' | ');
    } else if (qs.type === 'text') {
      distStr = `${qs.textCount} text comments received`;
    }

    const dataRow = ws3.addRow([
      qs.id,
      qs.visitStage.replace('_', ' ').toUpperCase(),
      qs.roleTag.replace('_', ' ').toUpperCase(),
      qs.labelEn,
      qs.labelAr || '',
      qs.type,
      qs.totalAnswers,
      `${qs.responseRate}%`,
      avgStr,
      distStr,
    ]);

    dataRow.height = 24;
    const fill = rowIdx3 % 2 === 0 ? zebraFill : whiteFill;
    dataRow.eachCell((cell, colNum) => {
      cell.font = { name: 'Calibri', size: 10 };
      cell.fill = fill;
      cell.border = thinBorder;
      if ([1, 2, 3, 6, 7, 8, 9].includes(colNum)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      }
    });
    rowIdx3++;
  });

  // TAB 4: Verbatim Customer Feedback
  const ws4 = workbook.addWorksheet('Verbatim Customer Feedback', { views: [{ showGridLines: true }] });
  const headers4 = [
    'Submission Date',
    'Plate Number',
    'Mobile Number',
    'Visit Stage',
    'Question Prompt (English)',
    'Question Prompt (Arabic)',
    'Verbatim Customer Comment',
    'Language',
    'AI Sentiment Score (0-100)',
    'Overall Survey Score',
    'Response ID',
  ];
  const row4 = ws4.addRow(headers4);
  row4.height = 28;
  row4.eachCell((cell) => {
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = headerAlignment;
    cell.border = thinBorder;
  });

  let rowIdx4 = 2;
  data.textFeedback.forEach((tf) => {
    const formattedDate = tf.submittedAt ? tf.submittedAt.replace('T', ' ').substring(0, 16) : '';
    const dataRow = ws4.addRow([
      formattedDate,
      tf.plateNumber || 'N/A',
      tf.mobileNumber || 'N/A',
      tf.visitStage.replace('_', ' ').toUpperCase(),
      tf.questionLabelEn,
      tf.questionLabelAr || '',
      tf.customerComment,
      tf.language.toUpperCase(),
      tf.aiScore !== null ? tf.aiScore : 'Pending Scoring',
      tf.overallScore !== null ? tf.overallScore : 'N/A',
      tf.responseId,
    ]);

    dataRow.height = 28;
    const fill = rowIdx4 % 2 === 0 ? zebraFill : whiteFill;
    dataRow.eachCell((cell, colNum) => {
      cell.font = { name: 'Calibri', size: 10 };
      cell.fill = fill;
      cell.border = thinBorder;
      if ([1, 2, 3, 4, 8, 9, 10, 11].includes(colNum)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      }
    });
    rowIdx4++;
  });

  // Auto-adjust column widths
  [ws1, ws2, ws3, ws4].forEach((ws) => {
    ws.columns.forEach((col) => {
      let maxLen = 12;
      col.eachCell?.({ includeEmpty: false }, (cell) => {
        const val = String(cell.value || '');
        maxLen = Math.max(maxLen, Math.min(val.length + 3, 55));
      });
      col.width = maxLen;
    });
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

// ---------------------------------------------------------------------------
// HTTP API Route Handlers Wrappers (Used by /api/v1/responses/...)
// ---------------------------------------------------------------------------
export async function getResponsesService(request: Request): Promise<NextResponse> {
  const denied = await guardAnalyticsAccess();
  if (denied) return denied;
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const visitStage = searchParams.get('visitStage') || undefined;
    const searchTerm = searchParams.get('search') || undefined;

    const data = await fetchLiveResponsesData({ startDate, endDate, visitStage, searchTerm });
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('[responses.service] getResponsesService error:', error);
    return NextResponse.json({ error: (error as Error).message || 'Failed to fetch live responses' }, { status: 500 });
  }
}

export async function scoreUnscoredFeedbackService(): Promise<NextResponse> {
  const denied = await guardAnalyticsAccess();
  if (denied) return denied;
  try {
    const result = await runAiBatchScoring();
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('[responses.service] scoreUnscoredFeedbackService error:', error);
    return NextResponse.json({ error: (error as Error).message || 'Failed to execute AI batch scoring' }, { status: 500 });
  }
}

export async function exportResponsesExcelService(): Promise<NextResponse> {
  const denied = await guardAnalyticsAccess();
  if (denied) return denied;
  try {
    const buffer = await generateLiveResponsesExcelBuffer();
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="supabase_survey_responses.xlsx"',
      },
    });
  } catch (error: unknown) {
    console.error('[responses.service] exportResponsesExcelService error:', error);
    return NextResponse.json({ error: (error as Error).message || 'Failed to export Excel spreadsheet' }, { status: 500 });
  }
}

