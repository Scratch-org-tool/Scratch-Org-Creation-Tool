/** Strip HTML/script content from display names before persistence. */
export function sanitizeDisplayName(value: string): string {
  let cleaned = value
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned;
}

/** Convert Azure DevOps HTML fields/comments to readable plain text for UI display. */
export function stripHtmlForDisplay(html: string): string {
  if (!html?.trim()) return '';

  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, '');

  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function isDisplayNameValid(value: string): boolean {
  return sanitizeDisplayName(value).length > 0;
}

/** Allow only same-origin application paths for post-authentication redirects. */
export function sanitizeNextRedirect(
  value: string | null | undefined,
  fallback = '/dashboard',
): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (
    !trimmed.startsWith('/')
    || trimmed.startsWith('//')
    || trimmed.includes('\\')
    || /[\u0000-\u001F\u007F]/.test(trimmed)
  ) {
    return fallback;
  }
  try {
    const decoded = decodeURIComponent(trimmed);
    if (
      decoded.startsWith('//')
      || decoded.includes('\\')
      || /[\u0000-\u001F\u007F]/.test(decoded)
    ) {
      return fallback;
    }
    const parsed = new URL(trimmed, 'https://app.invalid');
    if (parsed.origin !== 'https://app.invalid') return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
