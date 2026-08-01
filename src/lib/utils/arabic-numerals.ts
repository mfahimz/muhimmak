const WESTERN_TO_EASTERN_MAP: Record<string, string> = {
  '0': '٠',
  '1': '١',
  '2': '٢',
  '3': '٣',
  '4': '٤',
  '5': '٥',
  '6': '٦',
  '7': '٧',
  '8': '٨',
  '9': '٩',
};

/**
 * Converts Western digits (0-9) in a string or number to Eastern Arabic numerals (٠١٢٣٤٥٦٧٨٩)
 * if `locale === 'ar'`. Preserves all other non-digit characters (% / : - spaces text).
 */
export function toArabicNumerals(
  value: string | number | null | undefined,
  locale: string
): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (locale !== 'ar') return str;

  return str.replace(/[0-9]/g, (char) => WESTERN_TO_EASTERN_MAP[char] || char);
}
