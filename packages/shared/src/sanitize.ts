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
