const WIKI_IMAGE_BASE_URL = 'https://aeonsend.wiki.gg/images/';

/** Wiki file name for an image name: spaces become underscores, the rest is URL-encoded. */
const wikiName = (name: string): string => encodeURIComponent(name.replace(/ /g, '_'));

/** Wiki image URL built from an image name, e.g. "Jade" or "Brama Front". */
export function wikiImageUrl(name: string): string {
  return `${WIKI_IMAGE_BASE_URL}${wikiName(name)}.jpg`;
}
