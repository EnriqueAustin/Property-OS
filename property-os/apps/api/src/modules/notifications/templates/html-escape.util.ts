/**
 * HTML-escaping helpers for building email bodies.
 *
 * Guest- and owner-supplied values (names, special requests, phone numbers,
 * free-text fields, etc.) are interpolated into email HTML. Without escaping,
 * a guest could book as `<a href="evil">Click to pay</a>` and phish the owner
 * from our own sending domain (audit S9). Every untrusted variable must be run
 * through `escapeHtml` before interpolation. `safeUrl` validates and escapes a
 * URL destined for an `href`/`src` attribute.
 */

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;',
};

/**
 * Escape a value for safe interpolation into HTML text or a quoted attribute.
 * `null`/`undefined` become an empty string. Non-strings are coerced first.
 */
export function escapeHtml(
  value: string | number | boolean | null | undefined,
): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"'`]/g, (ch) => HTML_ESCAPE_MAP[ch]);
}

/**
 * Validate a URL and return an HTML-attribute-safe version of it. Only http(s)
 * and mailto URLs are allowed; anything else (e.g. `javascript:`, `data:`)
 * returns '#'. The result is additionally HTML-escaped so it is safe to drop
 * straight into an `href="..."` attribute.
 */
export function safeUrl(value: string | null | undefined): string {
  if (value === null || value === undefined) return '#';
  const raw = value.trim();
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return '#';
  }
  const allowed = ['http:', 'https:', 'mailto:'];
  if (!allowed.includes(parsed.protocol)) return '#';
  return escapeHtml(parsed.toString());
}
