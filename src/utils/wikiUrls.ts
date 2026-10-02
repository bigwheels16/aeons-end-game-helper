/** Origin of the Aeon's End wiki, the only site data-derived page links may point to. */
export const WIKI_ORIGIN = 'https://aeonsend.wiki.gg';
export const WIKI_HOSTNAME = 'aeonsend.wiki.gg';
/** Wiki page path prefix; page links must stay under it. */
export const WIKI_PAGE_PATH_PREFIX = '/wiki/';
export const WIKI_PAGE_BASE_URL = `${WIKI_ORIGIN}${WIKI_PAGE_PATH_PREFIX}`;
/** Longest URL accepted before parsing. */
export const MAX_URL_LENGTH = 2048;

/**
 * Returns the normalized href if `raw` is an https URL on exactly aeonsend.wiki.gg, under /wiki/,
 * with no port, credentials or query; otherwise null.
 *
 * Fail closed: anything unparsable, any other scheme (javascript:, data:, http:), host, port,
 * path or embedded credentials yields null, and callers must render no link. The check runs on
 * the WHATWG-parsed URL (never on the raw string), and callers must render the returned value,
 * never `raw`.
 */
export function safeWikiHref(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > MAX_URL_LENGTH) return null;
  let url: URL;
  try {
    // No base URL: relative inputs such as "//host/x" or "/wiki/x" are rejected, not resolved.
    url = new URL(raw);
  } catch {
    // An unparsable URL is the documented fail-closed "no link" result, not a swallowed error;
    // WikiLink logs a name-only warning for every rejected URL.
    return null;
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname !== WIKI_HOSTNAME ||
    url.port !== '' ||
    url.username !== '' ||
    url.password !== '' ||
    !url.pathname.startsWith(WIKI_PAGE_PATH_PREFIX) ||
    url.search !== ''
  ) {
    return null;
  }
  return url.href;
}

/** Fallback page URL built from the trusted page prefix plus the encoded name. */
export function wikiPageUrl(name: string): string {
  return `${WIKI_PAGE_BASE_URL}${encodeURIComponent(name.replace(/ /g, '_'))}`;
}
