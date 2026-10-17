const WIKI_PAGE_BASE_URL = 'https://aeonsend.wiki.gg/wiki/';
/** Hosted copies of the wiki's images, at base URL + image file name. */
const IMAGE_BASE_URL = 'https://aeons-end.jkbff.com/images/';

/** Wiki path segment for a page title: spaces become underscores, the rest is URL-encoded. */
const wikiName = (name: string): string => encodeURIComponent(name.replace(/ /g, '_'));

/** Wiki page URL built from a page title, e.g. "Jade" or "Bishop: Returned". */
export function wikiPageUrl(title: string): string {
  return `${WIKI_PAGE_BASE_URL}${wikiName(title)}`;
}

/** Hosted image URL built from an image file name in the dataset, e.g. "Jade.webp" or "Brama_Front.webp". */
export function imageUrl(name: string): string {
  return `${IMAGE_BASE_URL}${encodeURIComponent(name)}`;
}
