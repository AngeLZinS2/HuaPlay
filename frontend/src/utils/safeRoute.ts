/**
 * Safe Route Validator for HuaPlay.
 *
 * Enforces same-origin and safe in-app navigation routes.
 * Blocks dangerous schemes (javascript:, data:, vbscript:), backslash protocol
 * bypass (e.g. /\\evil.example), and encoded control characters.
 */

const TRUSTED_ORIGINS = new Set([
  'https://huaplay.playdb.info',
  'https://huaplay.app',
]);

export function sanitizeAppRoute(urlOrPath?: string | null): string | null {
  if (!urlOrPath || typeof urlOrPath !== 'string') {
    return null;
  }

  // Reject raw or encoded control characters (%00-%1F, %7F, \r, \n, \t)
  // eslint-disable-next-line no-control-regex
  if (/[\r\n\t\x00-\x1f\x7f]/i.test(urlOrPath) || /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(urlOrPath)) {
    return null;
  }

  const trimmed = urlOrPath.trim();
  if (!trimmed) {
    return null;
  }

  // Reject backslash bypass (e.g. /\evil.com, /\\evil.com, \evil.com)
  if (trimmed.includes('\\')) {
    return null;
  }

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    return null;
  }

  // Handle custom huaplay:// scheme deep links
  if (lower.startsWith('huaplay://')) {
    const afterScheme = trimmed.slice('huaplay://'.length);
    const pathWithSlash = afterScheme.startsWith('/') ? afterScheme : `/${afterScheme}`;
    return sanitizeAppRoute(pathWithSlash);
  }

  // Internal relative path (e.g. /series/123 or /profile)
  if (trimmed.startsWith('/')) {
    // Prevent protocol-relative URLs like //evil.com or ///
    if (trimmed.startsWith('//')) {
      return null;
    }
    return trimmed;
  }

  // If absolute HTTP/HTTPS URL, enforce same-origin or trusted origin
  try {
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    const parsed = new URL(trimmed);
    const origin = parsed.origin.toLowerCase();

    if (origin === currentOrigin.toLowerCase() || TRUSTED_ORIGINS.has(origin)) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/';
    }
  } catch {
    return null;
  }

  return null;
}
