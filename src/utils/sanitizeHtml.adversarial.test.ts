import { describe, it, expect } from 'vitest';
import { isAllowedAttribute, isWikiImageUrl, sanitizeScrapedHtml } from './sanitizeHtml';

const WIKI_IMG = 'https://aeonsend.wiki.gg/images/Fury_token.png';

function parse(out: string): HTMLDivElement {
  const doc = new DOMParser().parseFromString(`<div>${out}</div>`, 'text/html');
  return doc.body.firstElementChild as HTMLDivElement;
}

/** Asserts the invariants every hostile sample must satisfy and returns the sanitized output. */
function sanitizeHostile(input: string): string {
  const out = sanitizeScrapedHtml(input);
  expect(out, input).not.toMatch(/on\w+=|javascript:|style=/i);
  const root = parse(out);
  for (const el of Array.from(root.querySelectorAll('*'))) {
    expect(['B', 'I', 'SMALL', 'SPAN', 'BR', 'HR', 'IMG'], `${el.nodeName} in ${input}`).toContain(el.nodeName);
    for (const attr of Array.from(el.attributes)) {
      expect(isAllowedAttribute(el.nodeName, attr.name, attr.value), `${el.nodeName}@${attr.name} in ${input}`).toBe(true);
    }
  }
  for (const img of Array.from(root.querySelectorAll('img'))) {
    expect(isWikiImageUrl(img.getAttribute('src') ?? ''), `img in ${input}`).toBe(true);
  }
  // Re-sanitizing the output must be a no-op: the serialized string parses back to the same tree.
  expect(sanitizeScrapedHtml(out), `idempotent for ${input}`).toBe(out);
  return out;
}

describe('sanitizeScrapedHtml: mXSS and namespace confusion', () => {
  it.each([
    ['template', '<template><img src=x onerror=alert(1)></template>', ''],
    ['template inside allowed tag', '<b><template><img src=x onerror=alert(1)></template>t</b>', '<b>t</b>'],
    ['svg foreignObject', '<svg><foreignObject><img src=x onerror=alert(1)></foreignObject></svg>', ''],
    ['math inside svg', '<svg><math><mi><img src=x onerror=alert(1)></mi></math></svg>', ''],
    ['svg inside math', '<math><mi><svg><style><img src=x onerror=alert(1)></style></svg></mi></math>', ''],
    ['math mglyph style', '<math><mtext><mglyph><style><img src=x onerror=alert(1)>', ''],
    ['noembed', '<noembed><img src=x onerror=alert(1)></noembed>', ''],
    ['noframes', '<noframes><img src=x onerror=alert(1)></noframes>', ''],
    ['xmp', '<xmp><img src=x onerror=alert(1)></xmp>', ''],
    ['title', '<title><img src=x onerror=alert(1)></title>', ''],
    ['plaintext', '<plaintext><img src=x onerror=alert(1)>', ''],
    ['style inside allowed tag', '<b><style>*{x:y}</style>t</b>', '<b>t</b>'],
    ['uppercase script', 'a<SCRIPT>alert(1)</SCRIPT>b', 'ab'],
    ['svg inside allowed tag', '<i><svg><g onload="alert(1)">x</g></svg>y</i>', '<i>y</i>'],
  ])('drops %s content', (_label, input, expected) => {
    expect(sanitizeHostile(input)).toBe(expected);
  });

  it.each([
    ['svg p style breakout', '<svg></p><style><a id="</style><img src=1 onerror=alert(1)>">'],
    ['form math mglyph', '<form><math><mtext></form><form><mglyph><style></math><img src onerror=alert(1)>'],
    ['math table mglyph', '<math><mtext><table><mglyph><style><!--</style><img title="--&gt;&lt;img src=1 onerror=alert(1)&gt;">'],
    ['noscript title breakout', '<noscript><p title="</noscript><img src=x onerror=alert(1)>">'],
    ['textarea title breakout', '<textarea><p title="</textarea><img src=x onerror=alert(1)>">'],
    ['style title breakout', '<style><p title="</style><img src=x onerror=alert(1)>">'],
    ['comment breakout', '<!--><img src=x onerror=alert(1)>-->'],
    ['cdata in html', '<![CDATA[><img src=x onerror=alert(1)>]]>'],
    ['nested svg desc', '<svg><desc><svg><style><img src=x onerror=alert(1)></style></svg></desc></svg>'],
    ['select style', '<select><style><img src=x onerror=alert(1)></style></select>'],
  ])('leaves no executable markup for %s', (_label, input) => {
    const out = sanitizeHostile(input);
    expect(parse(out).querySelector('img:not([src^="https://aeonsend.wiki.gg/images/"])')).toBeNull();
  });
});

describe('sanitizeScrapedHtml: disallowed tags keep text, content-dropping tags lose it', () => {
  it.each([
    ['u', '<u>t</u>', 't'],
    ['a', '<a href="https://aeonsend.wiki.gg/wiki/X">t</a>', 't'],
    ['font', '<font color="red">t</font>', 't'],
    ['blockquote', '<blockquote>t</blockquote>', 't'],
    ['custom element', '<x-evil onclick="1">t</x-evil>', 't'],
    ['button', '<button onclick="1">t</button>', 't'],
    ['table', '<table><tr><td>t</td></tr></table>', 't'],
    ['details', '<details open ontoggle="alert(1)"><summary>s</summary>t</details>', 'st'],
    ['base', '<base href="https://evil.com/">t', 't'],
    ['meta', '<meta http-equiv="refresh" content="0;url=https://evil.com">t', 't'],
    ['link', '<link rel="stylesheet" href="https://evil.com/x.css">t', 't'],
  ])('unwraps %s and keeps its text', (_label, input, expected) => {
    expect(sanitizeHostile(input)).toBe(expected);
  });

  it.each([
    ['script', 'a<script>evil()</script>b'],
    ['style', 'a<style>b{}</style>b'],
    ['iframe', 'a<iframe srcdoc="<script>1</script>">x</iframe>b'],
    ['noscript', 'a<noscript>x</noscript>b'],
    ['template', 'a<template>x</template>b'],
    ['video', 'a<video><source onerror="alert(1)">x</video>b'],
    ['audio', 'a<audio src=x onerror=alert(1)>x</audio>b'],
  ])('drops %s together with its content', (_label, input) => {
    expect(sanitizeHostile(input)).toBe('ab');
  });
});

describe('sanitizeScrapedHtml: attributes on allowed tags', () => {
  const HOSTILE_ATTRS = 'onclick="alert(1)" onmouseover="alert(1)" onerror="alert(1)" onload="alert(1)" style="color:red" id="x" title="t" name="n" data-x="1" aria-label="a" href="javascript:alert(1)" xmlns="http://www.w3.org/2000/svg"';

  it.each(['b', 'i', 'small', 'span'])('removes event handlers and other attributes from <%s>', (tag) => {
    expect(sanitizeHostile(`<${tag} ${HOSTILE_ATTRS}>t</${tag}>`)).toBe(`<${tag}>t</${tag}>`);
  });

  it.each(['br', 'hr'])('removes event handlers and other attributes from <%s>', (tag) => {
    expect(sanitizeHostile(`<${tag} ${HOSTILE_ATTRS}>`)).toBe(`<${tag}>`);
  });

  it('removes event handlers from a wiki img but keeps the img', () => {
    expect(sanitizeHostile(`<img src="${WIKI_IMG}" ${HOSTILE_ATTRS}>`)).toBe(`<img src="${WIKI_IMG}">`);
  });

  it('removes img-only attributes from other tags', () => {
    expect(sanitizeHostile(`<span src="${WIKI_IMG}" alt="a" width="50" loading="lazy">t</span>`)).toBe('<span>t</span>');
    expect(sanitizeHostile('<hr width="50"><b alt="a">t</b>')).toBe('<hr><b>t</b>');
  });

  it('removes class from img', () => {
    expect(sanitizeHostile(`<img src="${WIKI_IMG}" class="aether">`)).toBe(`<img src="${WIKI_IMG}">`);
  });

  it('removes uppercase event handler and src-less uppercase IMG', () => {
    expect(sanitizeHostile(`<IMG SRC="${WIKI_IMG}" ONERROR="alert(1)">`)).toBe(`<img src="${WIKI_IMG}">`);
    expect(sanitizeHostile('<IMG SRC=x ONERROR=alert(1)>')).toBe('');
  });

  it.each([
    ['two tokens', 'aether evil'],
    ['reversed tokens', 'evil aether'],
    ['repeated token', 'aether aether'],
    ['uppercase', 'AETHER'],
    ['other class', 'modal'],
    ['empty', ''],
  ])('removes span class with %s', (_label, value) => {
    expect(sanitizeHostile(`<span class="${value}">t</span>`)).toBe('<span>t</span>');
  });

  it('accepts a span class with surrounding whitespace because DOMPurify trims values', () => {
    expect(sanitizeHostile('<span class=" aether ">t</span>')).toBe('<span class="aether">t</span>');
  });

  it.each(['50px', '100%', '', '-1', '1e3', '0x10', '12345', '5 0', '٥٠', 'calc(1px)'])(
    'removes width "%s"',
    (value) => {
      expect(sanitizeHostile(`<img src="${WIKI_IMG}" width="${value}">`)).toBe(`<img src="${WIKI_IMG}">`);
    },
  );

  it('keeps 1-4 digit widths', () => {
    expect(sanitizeHostile(`<img src="${WIKI_IMG}" width="0">`)).toBe(`<img src="${WIKI_IMG}" width="0">`);
    expect(sanitizeHostile(`<img src="${WIKI_IMG}" width="9999">`)).toBe(`<img src="${WIKI_IMG}" width="9999">`);
  });

  it.each(['eager', 'LAZY', 'auto', '', 'lazy eager'])('removes loading "%s"', (value) => {
    expect(sanitizeHostile(`<img src="${WIKI_IMG}" loading="${value}">`)).toBe(`<img src="${WIKI_IMG}">`);
  });

  it('keeps an alt of exactly 200 characters', () => {
    const alt = 'a'.repeat(200);
    expect(sanitizeHostile(`<img src="${WIKI_IMG}" alt="${alt}">`)).toBe(`<img src="${WIKI_IMG}" alt="${alt}">`);
  });

  it('never turns markup inside alt into elements', () => {
    // DOMPurify drops an attribute whose value looks like a closing tag; otherwise the value stays text.
    const out = sanitizeScrapedHtml(`<img src="${WIKI_IMG}" alt="&quot;&gt;&lt;script&gt;x&lt;/script&gt;">`);
    const root = parse(out);
    expect(root.querySelector('script')).toBeNull();
    expect(root.querySelectorAll('img')).toHaveLength(1);
    expect(root.querySelector('img')?.getAttribute('alt') ?? '"><script>x</script>').toBe('"><script>x</script>');
  });
});

describe('sanitizeScrapedHtml: img src variants', () => {
  it.each([
    ['javascript:', 'javascript:alert(1)'],
    ['mixed-case javascript:', 'JaVaScRiPt:alert(1)'],
    ['entity-encoded javascript:', '&#106;avascript:alert(1)'],
    ['tab inside javascript:', 'java\tscript:alert(1)'],
    ['data: svg', 'data:image/svg+xml,<svg onload=alert(1)>'],
    ['data: png', 'data:image/png;base64,iVBORw0KGgo='],
    ['blob:', 'blob:https://aeonsend.wiki.gg/123'],
    ['file:', 'file:///etc/passwd'],
    ['http', 'http://aeonsend.wiki.gg/images/a.png'],
    ['ftp', 'ftp://aeonsend.wiki.gg/images/a.png'],
    ['protocol-relative', '//aeonsend.wiki.gg/images/a.png'],
    ['root-relative', '/images/a.png'],
    ['relative dot-segment', '/images/../a.png'],
    ['userinfo', 'https://u@aeonsend.wiki.gg/images/a.png'],
    ['userinfo with wiki name', 'https://aeonsend.wiki.gg@evil.com/images/a.png'],
    ['backslash before at-sign', 'https://evil.com\\@aeonsend.wiki.gg/images/a.png'],
    ['port 80', 'https://aeonsend.wiki.gg:80/images/a.png'],
    ['port 8443', 'https://aeonsend.wiki.gg:8443/images/a.png'],
    ['subdomain', 'https://x.aeonsend.wiki.gg/images/a.png'],
    ['parent domain', 'https://wiki.gg/images/a.png'],
    ['look-alike suffix', 'https://aeonsend.wiki.gg.evil.com/images/a.png'],
    ['IP host', 'https://127.0.0.1/images/a.png'],
    ['encoded slash in host', 'https://aeonsend.wiki.gg%2fimages/a.png'],
    ['encoded slash after images', 'https://aeonsend.wiki.gg/images%2fa.png'],
    ['encoded dot-segment escape', 'https://aeonsend.wiki.gg/images/%2E%2E/x.png'],
    ['backslash dot-segment escape', 'https://aeonsend.wiki.gg\\images\\..\\x.png'],
    ['dot-segment escape', 'https://aeonsend.wiki.gg/images/../x.png'],
    ['path case', 'https://aeonsend.wiki.gg/Images/a.png'],
    ['images without slash', 'https://aeonsend.wiki.gg/images'],
    ['images prefix word', 'https://aeonsend.wiki.gg/imagesx/a.png'],
    ['empty', ''],
  ])('removes an img with a %s src', (_label, src) => {
    expect(sanitizeHostile(`<img src="${src}" alt="a">`)).toBe('');
  });

  it.each([
    ['uppercase host', 'https://AEONSEND.WIKI.GG/images/a.png'],
    ['uppercase scheme', 'HTTPS://aeonsend.wiki.gg/images/a.png'],
    ['explicit default port', 'https://aeonsend.wiki.gg:443/images/a.png'],
    ['empty port', 'https://aeonsend.wiki.gg:/images/a.png'],
    ['single slash after scheme', 'https:/aeonsend.wiki.gg/images/a.png'],
    ['backslashes', 'https:\\\\aeonsend.wiki.gg\\images\\a.png'],
    ['query and fragment', 'https://aeonsend.wiki.gg/images/a.png?x=1#y'],
    ['dot-segment that stays under images', 'https://aeonsend.wiki.gg/images/x/../a.png'],
  ])('keeps an img with a %s src, which the browser fetches from the wiki image path', (_label, src) => {
    expect(isWikiImageUrl(src)).toBe(true);
    const out = sanitizeHostile(`<img src="${src}">`);
    expect(parse(out).querySelectorAll('img')).toHaveLength(1);
    const fetched = new URL(parse(out).querySelector('img')?.getAttribute('src') ?? '');
    expect(fetched.origin).toBe('https://aeonsend.wiki.gg');
    expect(fetched.pathname.startsWith('/images/')).toBe(true);
  });

  it('removes only the bad img and keeps surrounding text and a good img', () => {
    expect(
      sanitizeHostile(`a<img src="https://evil.com/p.gif">b<img src="${WIKI_IMG}" onerror="x">c<img>d`),
    ).toBe(`ab<img src="${WIKI_IMG}">cd`);
  });

  it('removes an img with duplicate src attributes when the first is hostile', () => {
    expect(sanitizeHostile(`<img src="https://evil.com/p.gif" src="${WIKI_IMG}">`)).toBe('');
  });

  it('does not throw on a pathological src', () => {
    expect(() => sanitizeHostile(`<img src="https://${'a'.repeat(5000)}/images/a.png">`)).not.toThrow();
    expect(() => sanitizeHostile('<img src="https://[::1/images/a.png">')).not.toThrow();
    expect(() => sanitizeHostile('<img src="https://xn--/images/a.png">')).not.toThrow();
  });
});
