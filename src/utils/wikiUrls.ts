const WIKI_PAGE_BASE_URL = 'https://aeonsend.wiki.gg/wiki/';

/** Wiki page URL built from a record name. */
export function wikiPageUrl(name: string): string {
  return `${WIKI_PAGE_BASE_URL}${encodeURIComponent(name.replace(/ /g, '_'))}`;
}
