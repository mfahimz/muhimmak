import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toArabicNumerals } from './arabic-numerals';

export { toArabicNumerals };

/**
 * Combines tailwind-merge and clsx to merge Tailwind classes cleanly without conflicts.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a ISO date string to a human-readable date format with locale awareness.
 */
export function formatDate(dateString: string, locale: string = 'en'): string {
  const date = new Date(dateString);
  const formatted = date.toLocaleDateString(locale === 'ar' ? 'ar-AE' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return toArabicNumerals(formatted, locale);
}
