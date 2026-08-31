export const QUESTION_DOMAINS = [
  'booking', 'arrival', 'reception', 'communication', 'transparency',
  'timeliness', 'repair_quality', 'pricing', 'loyalty', 'overall_experience', 'other',
] as const

export type QuestionDomain = typeof QUESTION_DOMAINS[number]

export function isQuestionDomain(value: unknown): value is QuestionDomain {
  return typeof value === 'string' && (QUESTION_DOMAINS as readonly string[]).includes(value)
}
