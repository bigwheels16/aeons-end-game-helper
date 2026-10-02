import createDOMPurify, { type Config, type DOMPurify } from 'dompurify';
import { WIKI_HOSTNAME } from './wikiUrls';

/** Allowed tags and attributes; anything else is stripped. */
export const ALLOWED_TAGS: readonly string[] = Object.freeze(['b', 'i', 'small', 'span', 'br', 'hr', 'img']);
export const ALLOWED_ATTR: readonly string[] = Object.freeze(['class', 'src', 'alt', 'width', 'loading']);

/** Path prefix that inline wiki images must stay under. */
export const WIKI_IMAGE_PATH_PREFIX = '/images/';
const MAX_ALT_LENGTH = 200;
const WIDTH_PATTERN = /^\d{1,4}$/;

type AttrRule = (value: string) => boolean;

/**
 * Returns true only for an https URL on exactly the wiki host, with no port or credentials, whose
 * parsed path is under /images/. The checks run on the WHATWG-parsed URL, never the raw string.
 */
export function isWikiImageUrl(value: string): boolean {
  let url: URL;
  try {
    // No base URL: relative and protocol-relative inputs are rejected, not resolved.
    url = new URL(value);
  } catch (error) {
    // URL throws TypeError for unparsable input; that is the documented fail-closed "reject"
    // result. Anything else is unexpected and propagates.
    if (error instanceof TypeError) return false;
    throw error;
  }
  return (
    url.protocol === 'https:' &&
    url.hostname === WIKI_HOSTNAME &&
    url.port === '' &&
    url.username === '' &&
    url.password === '' &&
    url.pathname.startsWith(WIKI_IMAGE_PATH_PREFIX)
  );
}

/**
 * Per-tag attribute rules. Maps (not plain objects) so attribute names such as `constructor` or
 * `__proto__` can never resolve to inherited properties. An attribute with no rule is removed.
 */
const ATTR_RULES: ReadonlyMap<string, ReadonlyMap<string, AttrRule>> = new Map<string, ReadonlyMap<string, AttrRule>>([
  ['span', new Map<string, AttrRule>([['class', (v) => v === 'aether']])],
  [
    'img',
    new Map<string, AttrRule>([
      ['src', isWikiImageUrl],
      ['alt', (v) => v.length <= MAX_ALT_LENGTH],
      ['width', (v) => WIDTH_PATTERN.test(v)],
      ['loading', (v) => v === 'lazy'],
    ]),
  ],
]);

/** True when the attribute is allowed on the tag and its value passes the tag's rule. */
export function isAllowedAttribute(tagName: string, attrName: string, value: string): boolean {
  const rule = ATTR_RULES.get(tagName.toLowerCase())?.get(attrName);
  return rule !== undefined && rule(value) === true;
}

const CONFIG: Readonly<Config> = Object.freeze({
  ALLOWED_TAGS: [...ALLOWED_TAGS],
  ALLOWED_ATTR: [...ALLOWED_ATTR],
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
  KEEP_CONTENT: true,
});

/**
 * Installs the per-tag attribute hooks on `purifier` and returns a sanitize function bound to it
 * and to the shared config. Exported so tests can build their own instance with identical rules;
 * the app's own instance is private to this module.
 */
export function createScrapedHtmlSanitizer(purifier: DOMPurify): (html: string | undefined | null) => string {
  purifier.addHook('uponSanitizeAttribute', (node, data) => {
    if (!isAllowedAttribute(node.nodeName, data.attrName, data.attrValue)) {
      data.keepAttr = false;
    }
  });
  purifier.addHook('afterSanitizeAttributes', (node) => {
    // An <img> whose src was rejected (or missing) is removed entirely; it has no text to keep.
    if (node.nodeName === 'IMG' && !node.hasAttribute('src')) {
      node.remove();
    }
  });
  return (html) => {
    if (!purifier.isSupported) {
      // DOMPurify returns its input unchanged when unsupported; never let raw HTML through.
      throw new Error('HTML sanitizer is not supported in this environment');
    }
    if (!html) return '';
    return purifier.sanitize(html, CONFIG);
  };
}

const sanitizeWithPrivateInstance = createScrapedHtmlSanitizer(createDOMPurify(window));

/** Sanitizes wiki effect/rules HTML against the allowlist above. Empty input yields ''. */
export function sanitizeScrapedHtml(html: string | undefined | null): string {
  return sanitizeWithPrivateInstance(html);
}
