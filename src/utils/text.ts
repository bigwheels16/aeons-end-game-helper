/**
 * Strips HTML tags from an HTML string using DOMParser, returning clean plain text.
 */
export function stripHtml(html: string): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}

/**
 * True when every whitespace-separated term of `query` appears, case-insensitively, in `texts`.
 * HTML tags in `texts` are ignored. An empty query matches everything.
 */
export function matchesSearch(query: string, texts: (string | undefined)[]): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const searchable = stripHtml(texts.join(' ')).toLowerCase();
  return terms.every(term => searchable.includes(term));
}
