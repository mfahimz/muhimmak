import 'server-only';
import OpenAI from 'openai';

/**
 * Singleton DeepSeek client using the openai SDK.
 * Import this anywhere server-side AI calls are needed.
 * Never import in client components — server-only is enforced above.
 */
export const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || '',
  baseURL: 'https://api.deepseek.com',
});

export const DEEPSEEK_MODEL = 'deepseek-v4-flash';

/**
 * Spread into a completions.create() call to disable reasoning tokens.
 * `thinking` is a DeepSeek extension the openai SDK types do not know about;
 * a spread (unlike an inline property) passes the excess-property check.
 */
export const DEEPSEEK_NO_THINKING = { thinking: { type: 'disabled' } } as const;
