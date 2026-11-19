/** Limits for one number field on a settings form. */
export interface NumberRule {
  min: number
  max: number
  /** Whole numbers only (steps, age). */
  integer?: boolean
  /** Decimal field: a comma is a decimal point ("2,5" L), not a thousands separator. */
  decimal?: boolean
}

/** Reads what the user typed; NaN when it isn't a number. */
export function parseNumber(raw: string, decimal = false): number {
  const s = raw.trim()
  if (!s) return NaN
  return Number(decimal ? s.replace(',', '.') : s.replace(/,/g, ''))
}

const fmt = (n: number) => n.toLocaleString('en-US')

/** A plain-words problem with the value, or null when it's fine. */
export function checkNumber(raw: string, rule: NumberRule): string | null {
  const n = parseNumber(raw, rule.decimal)
  if (!Number.isFinite(n)) return 'Enter a number.'
  if (rule.integer && !Number.isInteger(n)) return 'Use a whole number.'
  if (n < rule.min || n > rule.max) return `Use a number from ${fmt(rule.min)} to ${fmt(rule.max)}.`
  return null
}
