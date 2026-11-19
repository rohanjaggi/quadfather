/**
 * Escape a value for Telegram `parse_mode: 'HTML'` (`<`, `>`, `&`, plus quotes for attributes).
 * Use on EVERY interpolated value, never on the markup itself.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
