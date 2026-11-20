/** Dietary needs the Personal details page offers (stored by `value`). */
export const DIETARY_RESTRICTIONS: { value: string; label: string }[] = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'pescatarian', label: 'Pescatarian' },
  { value: 'gluten_free', label: 'Gluten-free' },
  { value: 'dairy_free', label: 'Dairy-free' },
  { value: 'nut_free', label: 'Nut-free' },
  { value: 'halal', label: 'Halal' },
  { value: 'kosher', label: 'Kosher' },
  { value: 'low_carb', label: 'Low carb' },
  { value: 'keto', label: 'Keto' },
  { value: 'oil_free', label: 'Oil-free' },
]

/** "Vegetarian", "Vegan +2", or "None". */
export function dietSummary(values: string[]): string {
  if (values.length === 0) return 'None'
  const first = DIETARY_RESTRICTIONS.find(r => r.value === values[0])?.label ?? values[0]
  return values.length > 1 ? `${first} +${values.length - 1}` : first
}
