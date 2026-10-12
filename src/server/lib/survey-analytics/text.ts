// Deterministic helpers for free text answers. No AI involved.

const TRIVIAL = new Set([
  'no', 'nope', 'nah', 'na', 'n/a', 'n.a', 'none', 'nothing', 'nil', 'null', 'nill',
  'لا', 'لا شيء', 'لا شئ', 'لايوجد', 'لا يوجد', 'لا توجد', 'ما في', 'مافي', 'لا اعتقد', 'لا أعتقد',
]);

/**
 * A comment is usable when it carries words a manager can act on.
 * Blank answers, "No", "NA", bare numbers and punctuation are not usable.
 */
export function isUsableComment(raw: string): boolean {
  const t = raw
    .trim()
    .toLowerCase()
    .replace(/[.!?,;:؟،؛\s]+$/u, '')
    .trim();
  if (t.length < 2) return false;
  if (TRIVIAL.has(t)) return false;
  if (!/\p{L}/u.test(t)) return false;
  return true;
}

export function isAnswered(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
}

// ---------------------------------------------------------------------------
// Privacy: comments are free text, so a customer can type a phone number or plate into one.
// Anything sent to the AI goes through redactForAi first. The staff UI still shows the original.
// ---------------------------------------------------------------------------

const DIGIT = '[0-9\\u0660-\\u0669\\u06F0-\\u06F9]';
// 7 or more digits, optionally separated by single spaces, dots, dashes or brackets (phone numbers, long ids).
const LONG_NUMBER_RE = new RegExp(`\\+?\\(?${DIGIT}(?:[\\s().-]?${DIGIT}){6,}`, 'gu');
// Plate shaped tokens such as 11111-X11, 22222ABC-D (digits first, no space) and A 12345, AB-1234 (capital letters first).
// Deliberately narrow: "in 2025" or "2500 was" must survive.
const PLATE_DIGITS_FIRST_RE = /\b\d{3,5}-?[A-Za-z]{1,3}(?:-?[A-Za-z]?\d{0,3})?\b/g;
const PLATE_LETTERS_FIRST_RE = /\b[A-Z]{1,3}[\s-]?\d{3,5}\b/g;
// Letters that make a digit group a price or a measurement, not a plate.
const NOT_A_PLATE = new Set(['aed', 'usd', 'sar', 'kwd', 'omr', 'eur', 'gbp', 'km', 'kg', 'kmh', 'am', 'pm', 'th', 'st', 'nd', 'rd']);

export function redactForAi(text: string): string {
  const notPlate = (match: string) =>
    NOT_A_PLATE.has(match.replace(/[^A-Za-z]/g, '').toLowerCase().slice(0, 3)) ||
    NOT_A_PLATE.has(match.replace(/[^A-Za-z]/g, '').toLowerCase());
  return text
    .replace(LONG_NUMBER_RE, '[number]')
    .replace(PLATE_DIGITS_FIRST_RE, (m) => (notPlate(m) ? m : '[plate]'))
    .replace(PLATE_LETTERS_FIRST_RE, (m) => (notPlate(m) ? m : '[plate]'));
}
