/**
 * Escape a value for safe interpolation into a Telegram `parse_mode: 'HTML'`
 * message. Telegram's HTML subset only requires `<`, `>` and `&` to be
 * escaped, but we also escape quotes so values are safe inside attributes
 * (e.g. <a href="...">).
 *
 * Use this on EVERY interpolated value (exercise/workout/food names, AI
 * output, user notes) — never on the markup itself.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
