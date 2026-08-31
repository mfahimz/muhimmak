export type FieldCondition = {
  fieldId: string
  operator: 'equals' | 'not_equals' | 'lte' | 'gte'
  value: string | number
}

export function normalizeDependsOn(
  dependsOn?: FieldCondition[] | FieldCondition | null
): FieldCondition[] {
  if (!dependsOn) return []
  return Array.isArray(dependsOn) ? dependsOn : [dependsOn]
}
