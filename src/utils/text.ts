/**
 * Strips HTML tags from an HTML string using DOMParser, returning clean plain text.
 */
export function stripHtml(html: string): string {
  if (!html) return '';
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
  }
  return html.replace(/<[^>]+>/g, ' ');
}
