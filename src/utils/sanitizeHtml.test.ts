import { describe, it, expect } from 'vitest';
import DOMPurify from 'dompurify';
import {
  ALLOWED_ATTR,
  ALLOWED_TAGS,
  createScrapedHtmlSanitizer,
  isAllowedAttribute,
  isWikiImageUrl,
  sanitizeScrapedHtml,
} from './sanitizeHtml';

const WIKI_IMG = 'https://aeonsend.wiki.gg/images/Fury_token.png';

/** Every img left in `out` must point at the wiki image path. */
function imgSrcs(out: string): string[] {
  const doc = new DOMParser().parseFromString(`<div>${out}</div>`, 'text/html');
  return Array.from(doc.querySelectorAll('img')).map((img) => img.getAttribute('src') ?? '');
}

/** Sanitizes a malicious sample and applies the checks every malicious sample must pass. */
function sanitizeMalicious(input: string): string {
  const out = sanitizeScrapedHtml(input);
  expect(out).not.toMatch(/on\w+=|javascript:|style=/i);
  for (const src of imgSrcs(out)) {
    expect(isWikiImageUrl(src), `img src ${src}`).toBe(true);
  }
  return out;
}

describe('sanitizeScrapedHtml: allowed markup', () => {
  it('keeps the audited formatting tags unchanged', () => {
    expect(sanitizeScrapedHtml('<b>Cast:</b> Deal 1.<br/><i>x</i><hr/><b><small>OR</small></b>')).toBe(
      '<b>Cast:</b> Deal 1.<br><i>x</i><hr><b><small>OR</small></b>',
    );
  });

  it('keeps the aether span', () => {
    expect(sanitizeScrapedHtml('Gain 2 <span class="aether">&AElig;</span>.')).toBe(
      'Gain 2 <span class="aether">Æ</span>.',
    );
  });

  it('keeps the wiki token image and removes its style', () => {
    const input =
      'Rageborne gains one Fury token.<br/><img src="https://aeonsend.wiki.gg/images/Fury_token.png" alt="Fury token" ' +
      'width="50" style="display: block; margin: 0.5rem auto; max-width: 100%; height: auto;" loading="lazy">';
    expect(sanitizeScrapedHtml(input)).toBe(
      'Rageborne gains one Fury token.<br><img src="https://aeonsend.wiki.gg/images/Fury_token.png" alt="Fury token" width="50" loading="lazy">',
    );
  });

  it('returns an empty string for empty input', () => {
    expect(sanitizeScrapedHtml('')).toBe('');
    expect(sanitizeScrapedHtml(undefined)).toBe('');
    expect(sanitizeScrapedHtml(null)).toBe('');
  });

  it('exports frozen allowlists', () => {
    expect(Object.isFrozen(ALLOWED_TAGS)).toBe(true);
    expect(Object.isFrozen(ALLOWED_ATTR)).toBe(true);
    expect([...ALLOWED_TAGS].sort()).toEqual(['b', 'br', 'hr', 'i', 'img', 'small', 'span']);
    expect([...ALLOWED_ATTR].sort()).toEqual(['alt', 'class', 'loading', 'src', 'width']);
  });
});

describe('sanitizeScrapedHtml: links and disallowed tags', () => {
  it('unwraps an external link to its text', () => {
    expect(sanitizeMalicious('<a href="https://evil.com">x</a>')).toBe('x');
  });

  it('unwraps a javascript: link to its text', () => {
    expect(sanitizeMalicious('<a href="javascript:alert(1)">click</a>')).toBe('click');
  });

  it('unwraps other disallowed formatting tags but keeps their text', () => {
    expect(sanitizeMalicious('<em>a</em><strong>b</strong><p>c</p><div>d</div><u>e</u>')).toBe('abcde');
  });

  it('drops script content', () => {
    expect(sanitizeMalicious('a<script>alert(1)</script>b')).toBe('ab');
  });

  it('drops style element content', () => {
    expect(sanitizeMalicious('a<style>body{display:none}</style>b')).toBe('ab');
  });

  it('drops iframe content', () => {
    expect(sanitizeMalicious('a<iframe src="https://evil.com">x</iframe>b')).toBe('ab');
  });

  it('removes form and input tags, keeping text children (not in FORBID_CONTENTS)', () => {
    expect(sanitizeMalicious('<form action="https://evil.com">t<input name="x" value="v"></form>')).toBe('t');
  });

  it('removes object and embed tags, keeping text children', () => {
    expect(sanitizeMalicious('<object data="x">o</object><embed src="x">')).toBe('o');
  });

  it('drops svg content', () => {
    expect(sanitizeMalicious('<svg><g onload="alert(1)">x</g></svg>')).toBe('');
  });

  it('drops math mXSS sample', () => {
    expect(
      sanitizeMalicious('<math><mtext><table><mglyph><style><img src=x onerror=alert(1)></style></mglyph></table></mtext></math>'),
    ).toBe('');
  });

  it('escapes textarea content as text', () => {
    // The payload survives only as escaped text, which the generic markup regex would flag, so
    // this case asserts on the parsed result instead: no elements at all.
    const out = sanitizeScrapedHtml('<textarea><img src=x onerror=alert(1)></textarea>');
    expect(out).toBe('&lt;img src=x onerror=alert(1)&gt;');
    const doc = new DOMParser().parseFromString(`<div>${out}</div>`, 'text/html');
    expect(doc.body.querySelectorAll('div *')).toHaveLength(0);
  });

  it('drops svg/style mXSS sample', () => {
    expect(sanitizeMalicious('<svg><style><img src=x onerror=alert(1)></style></svg>')).toBe('');
  });

  it('drops noscript mXSS sample without leaving an img', () => {
    const out = sanitizeMalicious('<noscript><p title="</noscript><img src=x onerror=alert(1)>">');
    expect(out).not.toContain('<img');
  });

  it('drops comments', () => {
    expect(sanitizeMalicious('<!--<img src=x onerror=1>-->')).toBe('');
  });
});

describe('sanitizeScrapedHtml: image sources', () => {
  it.each([
    ['onerror with bad src', '<img src=x onerror=alert(1)>'],
    ['external host', '<img src="https://evil.com/images/a.png">'],
    ['data: URL', '<img src="data:image/png;base64,AAAA">'],
    ['protocol-relative', '<img src="//aeonsend.wiki.gg/images/a.png">'],
    ['userinfo', '<img src="https://user:pw@aeonsend.wiki.gg/images/a.png">'],
    ['look-alike host', '<img src="https://aeonsend.wiki.gg.evil.com/images/a.png">'],
    ['trailing-dot host', '<img src="https://aeonsend.wiki.gg./images/a.png">'],
    ['non-/images/ path', '<img src="https://aeonsend.wiki.gg/wiki/a.png">'],
    ['dot-segment escape', '<img src="https://aeonsend.wiki.gg/images/../x.png">'],
    ['encoded dot-segment escape', '<img src="https://aeonsend.wiki.gg/images/%2e%2e/x.png">'],
    ['http scheme', '<img src="http://aeonsend.wiki.gg/images/a.png">'],
    ['non-default port', '<img src="https://aeonsend.wiki.gg:8443/images/a.png">'],
    ['missing src', '<img alt="x">'],
  ])('removes an img with %s', (_label, input) => {
    expect(sanitizeMalicious(input)).toBe('');
  });

  it('treats surrounding whitespace in src like no whitespace', () => {
    expect(sanitizeScrapedHtml('<img src=" https://aeonsend.wiki.gg/images/a.png ">')).toBe(
      sanitizeScrapedHtml('<img src="https://aeonsend.wiki.gg/images/a.png">'),
    );
    expect(sanitizeScrapedHtml('<img src="https://aeonsend.wiki.gg/images/a.png">')).toBe(
      '<img src="https://aeonsend.wiki.gg/images/a.png">',
    );
  });

  it('accepts a backslash-separated URL because the parser normalizes it to the wiki image path', () => {
    // WHATWG parsing turns https:\\host\images\a.png into https://host/images/a.png, which is what
    // the browser would fetch, so the check on the parsed URL accepts it.
    expect(isWikiImageUrl('https:\\\\aeonsend.wiki.gg\\images\\a.png')).toBe(true);
    expect(sanitizeMalicious('<img src="https:\\\\aeonsend.wiki.gg\\images\\a.png">')).toContain('<img');
  });

  it('accepts the explicit default port 443, which normalizes to no port', () => {
    expect(isWikiImageUrl('https://aeonsend.wiki.gg:443/images/a.png')).toBe(true);
  });

  it('keeps only src when srcset is also present', () => {
    expect(sanitizeMalicious(`<img srcset="https://evil.com/a.png 1x" src="${WIKI_IMG}">`)).toBe(
      `<img src="${WIKI_IMG}">`,
    );
  });
});

describe('sanitizeScrapedHtml: attributes', () => {
  it('removes a span class other than exactly "aether" and all other span attributes', () => {
    expect(
      sanitizeMalicious('<span class="aether modal" style="color:red" onclick="x" id="i" name="n" data-x="1" aria-label="a">t</span>'),
    ).toBe('<span>t</span>');
  });

  it('removes class on tags other than span', () => {
    expect(sanitizeMalicious('<b class="aether">t</b>')).toBe('<b>t</b>');
  });

  it('removes a non-numeric width and a non-lazy loading', () => {
    expect(sanitizeMalicious(`<img src="${WIKI_IMG}" width="100%" loading="eager">`)).toBe(`<img src="${WIKI_IMG}">`);
  });

  it('removes an over-long alt', () => {
    expect(sanitizeMalicious(`<img src="${WIKI_IMG}" alt="${'a'.repeat(201)}">`)).toBe(`<img src="${WIKI_IMG}">`);
  });

  it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty'])(
    'removes a "%s" attribute on span and img without throwing',
    (attr) => {
      expect(sanitizeMalicious(`<span ${attr}="x">t</span>`)).toBe('<span>t</span>');
      expect(sanitizeMalicious(`<img src="${WIKI_IMG}" ${attr}="x">`)).toBe(`<img src="${WIKI_IMG}">`);
      expect(isAllowedAttribute('span', attr, 'x')).toBe(false);
      expect(isAllowedAttribute('img', attr, 'x')).toBe(false);
      expect(isAllowedAttribute(attr, 'class', 'aether')).toBe(false);
    },
  );
});

describe('isWikiImageUrl', () => {
  it('returns false for unparsable input', () => {
    expect(isWikiImageUrl('')).toBe(false);
    expect(isWikiImageUrl('not a url')).toBe(false);
    expect(isWikiImageUrl('/images/a.png')).toBe(false);
  });
});

describe('sanitizer instance', () => {
  it('fails closed when DOMPurify is not supported', () => {
    const local = DOMPurify(window);
    const sanitize = createScrapedHtmlSanitizer(local);
    local.isSupported = false;
    expect(() => sanitize('<img src=x onerror=alert(1)>')).toThrow(/not supported/);
  });

  it('does not install hooks on the default DOMPurify instance', () => {
    expect(sanitizeScrapedHtml('<a href="https://x">y</a>')).toBe('y');
    expect(DOMPurify.sanitize('<a href="https://x">y</a>')).toBe('<a href="https://x">y</a>');
    expect(DOMPurify.sanitize('<span class="other">t</span>')).toBe('<span class="other">t</span>');
  });
});
