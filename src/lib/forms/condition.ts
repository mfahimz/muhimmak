export type FieldCondition = {
  fieldId: string
  operator: 'equals' | 'not_equals' | 'lte' | 'gte'
  value: string | number
  /**
   * Optional sub-target when the source field is `matrix_rating`:
   * - omitted or `'__avg__'`: evaluates against the average score (0..5) of rated sub-options
   * - any other string: evaluates against that specific sub-option's score (0..5)
   */
  subOption?: string
}

export const MATRIX_AVG_TARGET = '__avg__'

export function normalizeDependsOn(
  dependsOn?: FieldCondition[] | FieldCondition | null
): FieldCondition[] {
  if (!dependsOn) return []
  return Array.isArray(dependsOn) ? dependsOn : [dependsOn]
}
