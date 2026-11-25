export const MATRIX_MIN_SCORE = 0;
export const MATRIX_MAX_SCORE = 5;

const ARABIC_TO_ASCII_DIGITS: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};

/**
 * Normalizes a single-character numeric entry from Western, Eastern Arabic, or Persian digits.
 * Returns `""` for empty input, `"0"`..`"5"` for valid whole numbers in 0..5, or `null` if invalid.
 */
export function normalizeMatrixDigitInput(raw: string): string | null {
  const normalized = raw
    .replace(/[٠-٩۰-۹]/g, (ch) => ARABIC_TO_ASCII_DIGITS[ch] ?? ch)
    .trim();
  if (normalized === '') return '';
  if (/^[0-5]$/.test(normalized)) return normalized;
  return null;
}

export function isMatrixAnswer(value: unknown): value is Record<string, number> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isValidMatrixScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= MATRIX_MIN_SCORE && value <= MATRIX_MAX_SCORE;
}

/**
 * Resolves which sub-option keys were actively entered by the respondent.
 * When `_matrixRated[fieldId]` is present, only those explicitly entered keys count toward averages
 * (so blank boxes defaulted to 0 on save are excluded, while explicitly typed 0s still count).
 */
export function getMatrixRatedKeys(
  field: { id: string; options?: string[] },
  answer: unknown,
  matrixRatedMap?: unknown
): string[] {
  if (!isMatrixAnswer(answer)) return [];

  const answerRecord = answer as Record<string, unknown>;
  const explicitMap =
    matrixRatedMap && typeof matrixRatedMap === 'object' && !Array.isArray(matrixRatedMap)
      ? (matrixRatedMap as Record<string, unknown>)[field.id]
      : undefined;

  if (Array.isArray(explicitMap)) {
    return explicitMap.filter(
      (key): key is string => typeof key === 'string' && isValidMatrixScore(answerRecord[key])
    );
  }

  const orderedKeys = Array.isArray(field.options) && field.options.length > 0
    ? [
        ...field.options,
        ...Object.keys(answerRecord).filter((k) => !field.options!.includes(k)),
      ]
    : Object.keys(answerRecord);

  return orderedKeys.filter((key) => isValidMatrixScore(answerRecord[key]));
}

/**
 * Computes the average raw score (0..5) and normalized score (0..100) across rated sub-options.
 */
export function computeMatrixAverageRaw(
  field: { id: string; options?: string[] },
  answer: unknown,
  matrixRatedMap?: unknown
): { averageRaw: number; normalizedScore: number; ratedCount: number } | null {
  if (!isMatrixAnswer(answer)) return null;
  const ratedKeys = getMatrixRatedKeys(field, answer, matrixRatedMap);
  if (ratedKeys.length === 0) return null;

  let sum = 0;
  let count = 0;
  for (const key of ratedKeys) {
    const val = (answer as Record<string, unknown>)[key];
    if (isValidMatrixScore(val)) {
      sum += val;
      count++;
    }
  }
  if (count === 0) return null;

  const averageRaw = sum / count;
  const normalizedScore = (averageRaw / MATRIX_MAX_SCORE) * 100;
  return { averageRaw, normalizedScore, ratedCount: count };
}

/**
 * Sanitizes an incoming `matrix_rating` answer from the public survey endpoint.
 * Unentered sub-options default to `0` in the saved record, while `ratedKeys` records only
 * sub-options that were explicitly entered as whole numbers in `0..5`.
 */
export function sanitizeMatrixSubmission(
  field: { id: string; options?: string[] },
  rawAnswer: unknown,
  rawRatedKeys: unknown
): { answer: Record<string, number>; ratedKeys: string[] } | null {
  if (!isMatrixAnswer(rawAnswer)) return null;

  const rawRecord = rawAnswer as Record<string, unknown>;
  const options =
    Array.isArray(field.options) && field.options.length > 0
      ? field.options
      : Object.keys(rawRecord);

  const sanitizedAnswer: Record<string, number> = {};
  for (const opt of options) {
    const num = Number(rawRecord[opt]);
    sanitizedAnswer[opt] =
      Number.isInteger(num) && num >= MATRIX_MIN_SCORE && num <= MATRIX_MAX_SCORE ? num : 0;
  }

  let ratedKeys: string[];
  if (Array.isArray(rawRatedKeys)) {
    const rawSet = new Set(rawRatedKeys.filter((k): k is string => typeof k === 'string'));
    ratedKeys = options.filter((opt) => {
      if (!rawSet.has(opt)) return false;
      const num = Number(rawRecord[opt]);
      return Number.isInteger(num) && num >= MATRIX_MIN_SCORE && num <= MATRIX_MAX_SCORE;
    });
  } else {
    ratedKeys = options.filter((opt) => {
      const val = rawRecord[opt];
      return typeof val === 'number' && Number.isInteger(val) && val >= MATRIX_MIN_SCORE && val <= MATRIX_MAX_SCORE;
    });
  }

  return { answer: sanitizedAnswer, ratedKeys };
}

export interface MatrixEntry {
  key: string;
  label: string;
  score: number;
  wasRated: boolean;
}

export function getMatrixEntries(
  field: { id: string; options?: string[]; ar?: { options?: string[] } },
  answer: unknown,
  matrixRatedMap?: unknown,
  isArabic = false
): MatrixEntry[] {
  if (!isMatrixAnswer(answer)) return [];

  const answerRecord = answer as Record<string, unknown>;
  const options = Array.isArray(field.options) ? field.options : [];
  const orderedKeys = [
    ...options,
    ...Object.keys(answerRecord).filter((k) => !options.includes(k)),
  ];

  const explicitMap =
    matrixRatedMap && typeof matrixRatedMap === 'object' && !Array.isArray(matrixRatedMap)
      ? (matrixRatedMap as Record<string, unknown>)[field.id]
      : undefined;
  const hasExplicitRated = Array.isArray(explicitMap);
  const ratedSet = hasExplicitRated
    ? new Set(explicitMap.filter((k): k is string => typeof k === 'string'))
    : null;

  return orderedKeys
    .filter((key) => isValidMatrixScore(answerRecord[key]))
    .map((key) => {
      const optIdx = options.indexOf(key);
      const arLabel = optIdx >= 0 ? field.ar?.options?.[optIdx]?.trim() : undefined;
      return {
        key,
        label: isArabic && arLabel ? arLabel : key,
        score: Number(answerRecord[key]),
        wasRated: ratedSet ? ratedSet.has(key) : true,
      };
    });
}

export function formatMatrixAnswerSummary(
  field: { id: string; options?: string[]; ar?: { options?: string[] } },
  answer: unknown,
  matrixRatedMap?: unknown,
  isArabic = false
): string {
  const entries = getMatrixEntries(field, answer, matrixRatedMap, isArabic);
  if (entries.length === 0) return '';
  return entries
    .map((e) => (e.wasRated ? `${e.label}: ${e.score}/5` : `${e.label}: ${e.score}/5 (unrated)`))
    .join(', ');
}
