const WIKI_PAGE_BASE_URL = 'https://aeonsend.wiki.gg/wiki/';
const WIKI_IMAGE_BASE_URL = 'https://aeonsend.wiki.gg/images/';

/** Wiki path segment for a page title or file name: spaces become underscores, the rest is URL-encoded. */
const wikiName = (name: string): string => encodeURIComponent(name.replace(/ /g, '_'));

/** Wiki page URL built from a page title, e.g. "Jade" or "Bishop: Returned". */
export function wikiPageUrl(title: string): string {
  return `${WIKI_PAGE_BASE_URL}${wikiName(title)}`;
}

/** Wiki image URL built from a file name, e.g. "Jade.jpg" or "Brama_Front.jpg". */
export function wikiImageUrl(file: string): string {
  return `${WIKI_IMAGE_BASE_URL}${wikiName(file)}`;
}
