import { describe, it, expect } from 'vitest';
import scrapedData from '../../data/scraped/aeons_end_all.json';
import { MAX_URL_LENGTH, safeWikiHref, wikiPageUrl } from './wikiUrls';

describe('safeWikiHref', () => {
  it.each([
    'https://aeonsend.wiki.gg/wiki/Jade',
    'https://aeonsend.wiki.gg/wiki/Transmuter%27s_Lens',
    'https://aeonsend.wiki.gg/wiki/Smite_%28Spell%29',
  ])('accepts and returns the real wiki URL %s unchanged', (url) => {
    expect(safeWikiHref(url)).toBe(url);
  });

  it('returns the normalized URL', () => {
    expect(safeWikiHref('HTTPS://AEONSEND.WIKI.GG/wiki/X')).toBe('https://aeonsend.wiki.gg/wiki/X');
    expect(safeWikiHref('https://aeonsend.wiki.gg:443/wiki/X')).toBe('https://aeonsend.wiki.gg/wiki/X');
  });

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    ' javascript:alert(1)',
    'javascript:alert(1) ',
    '\njavascript:alert(1)',
    'java\tscript:alert(1)',
    '\x00javascript:alert(1)',
    '\x01https://evil.com/wiki/X',
    'data:text/html,<script>alert(1)</script>',
    'blob:https://aeonsend.wiki.gg/1234',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'http://aeonsend.wiki.gg/wiki/X',
    'https://aeonsend.wiki.gg.evil.com/',
    'https://aeonsend.wiki.gg.evil.com/wiki/X',
    'https://evil.com/?https://aeonsend.wiki.gg/',
    'https://evil.com/wiki/X',
    'https://user:pw@aeonsend.wiki.gg/wiki/X',
    'https://user@aeonsend.wiki.gg/wiki/X',
    'https://aeonsend.wiki.gg:8443/wiki/X',
    '//aeonsend.wiki.gg/wiki/X',
    '/wiki/X',
    'wiki/X',
    'https:\\\\evil.com\\',
    'https:/\\evil.com',
    'https://aeonsend.wiki.gg.',
    'https://aeonsend.wiki.gg./wiki/X',
    'https://aeonsend.wiki.gg%2eevil.com/wiki/X',
    'https://evil.com#@aeonsend.wiki.gg/wiki/X',
    'https://evil.com\\@aeonsend.wiki.gg/wiki/X',
    'https://xn--aeonsend-xxx.wiki.gg/wiki/X',
    'https://aeonsеnd.wiki.gg/wiki/X',
    'https://sub.aeonsend.wiki.gg/wiki/X',
    'https://aeonsend.wiki.gg/',
    'https://aeonsend.wiki.gg/index.php?title=X',
    'https://aeonsend.wiki.gg/wiki/X?action=raw',
    'https://aeonsend.wiki.gg/wiki/../index.php',
    'https://aeonsend.wiki.gg/wiki/%2e%2e/index.php',
    'https://aeonsend.wiki.gg/wikiX',
    '',
  ])('rejects %j', (url) => {
    expect(safeWikiHref(url)).toBeNull();
  });

  it.each([undefined, null, 42, {}, ['https://aeonsend.wiki.gg/wiki/X'], new URL('https://aeonsend.wiki.gg/wiki/X')])(
    'rejects the non-string %j',
    (value) => {
      expect(safeWikiHref(value)).toBeNull();
    }
  );

  it('rejects over-long URLs before parsing', () => {
    const base = 'https://aeonsend.wiki.gg/wiki/';
    expect(safeWikiHref(base + 'a'.repeat(MAX_URL_LENGTH - base.length))).not.toBeNull();
    expect(safeWikiHref(base + 'a'.repeat(MAX_URL_LENGTH - base.length + 1))).toBeNull();
  });

  it('accepts every page_url in the bundled dataset unchanged (all 5 collections)', () => {
    const collections = [
      scrapedData.supply,
      scrapedData.unique_starters,
      scrapedData.mages,
      scrapedData.nemeses,
      scrapedData.nemesis_cards,
    ];
    let checked = 0;
    for (const records of collections) {
      expect(records.length).toBeGreaterThan(0);
      for (const record of records) {
        const url: unknown = record.page_url;
        expect(typeof url).toBe('string');
        if (safeWikiHref(url) !== url) throw new Error(`Rejected or non-normalized page_url for ${record.id}`);
        checked++;
      }
    }
    expect(checked).toBe(2119);
  });
});

describe('safeWikiHref parser edge cases', () => {
  const X = 'https://aeonsend.wiki.gg/wiki/X';

  it.each([
    ['backslashes as separators', 'https:\\\\aeonsend.wiki.gg\\wiki\\X', X],
    ['backslash path on the right host', 'https://aeonsend.wiki.gg\\wiki\\X', X],
    ['tab inside the path', 'https://aeonsend.wiki.gg/wi\tki/X', X],
    ['newline inside the host', 'https://aeon\nsend.wiki.gg/wiki/X', X],
    ['trailing newline', 'https://aeonsend.wiki.gg/wiki/X\n', X],
    ['mixed-case scheme and host', 'HtTpS://AeonSend.Wiki.GG/wiki/X', X],
    ['percent-encoded dot in the host', 'https://aeonsend%2Ewiki.gg/wiki/X', X],
    ['empty userinfo', 'https://@aeonsend.wiki.gg/wiki/X', X],
    ['empty user and password', 'https://:@aeonsend.wiki.gg/wiki/X', X],
    ['empty port', 'https://aeonsend.wiki.gg:/wiki/X', X],
    ['default port with leading zero', 'https://aeonsend.wiki.gg:0443/wiki/X', X],
    ['fullwidth host characters (IDNA-mapped to the same ASCII host)', 'https://ａｅｏｎｓｅｎｄ.wiki.gg/wiki/X', X],
    ['single-dot segment', 'https://aeonsend.wiki.gg/wiki/./X', X],
    ['fragment (not restricted by design)', 'https://aeonsend.wiki.gg/wiki/X#Section', 'https://aeonsend.wiki.gg/wiki/X#Section'],
  ])('accepts %s and returns the normalized URL, never the raw input', (_label, raw, expected) => {
    const href = safeWikiHref(raw);
    expect(href).toBe(expected);
    // The returned value is a fixed point: re-checking it yields the same string.
    expect(safeWikiHref(href)).toBe(href);
  });

  it.each([
    ['uppercase trailing-dot host', 'https://AEONSEND.WIKI.GG./wiki/X'],
    ['percent-encoded trailing dot', 'https://aeonsend.wiki.gg%2E/wiki/X'],
    ['IDN host that maps to punycode', 'https://aeonsënd.wiki.gg/wiki/X'],
    ['invalid punycode label', 'https://xn--aeonsend.wiki.gg/wiki/X'],
    ['user with empty password', 'https://u:@aeonsend.wiki.gg/wiki/X'],
    ['password only', 'https://:p@aeonsend.wiki.gg/wiki/X'],
    ['port 80', 'https://aeonsend.wiki.gg:80/wiki/X'],
    ['port 0', 'https://aeonsend.wiki.gg:0/wiki/X'],
    ['uppercase /WIKI/ path', 'https://aeonsend.wiki.gg/WIKI/X'],
    ['/w/index.php', 'https://aeonsend.wiki.gg/w/index.php'],
    ['/wiki without trailing slash', 'https://aeonsend.wiki.gg/wiki'],
    ['dot segments that leave /wiki/', 'https://aeonsend.wiki.gg/wiki/X/../../index.php'],
    ['encoded uppercase dot segments', 'https://aeonsend.wiki.gg/wiki/%2E%2E/x'],
    ['non-empty query', 'https://aeonsend.wiki.gg/wiki/X?a'],
    ['query hidden after a backslash', 'https://aeonsend.wiki.gg\\wiki\\X?title=Y'],
    ['tab inside the scheme', 'ht\ttps://evil.com/wiki/X'],
    ['ws scheme', 'wss://aeonsend.wiki.gg/wiki/X'],
    ['IPv4 host', 'https://127.0.0.1/wiki/X'],
  ])('rejects %s', (_label, raw) => {
    expect(safeWikiHref(raw)).toBeNull();
  });
});

describe('wikiPageUrl', () => {
  it('builds an encoded page URL that passes the allowlist', () => {
    const url = wikiPageUrl('What? #1 / 100%');
    expect(url).toBe('https://aeonsend.wiki.gg/wiki/What%3F_%231_%2F_100%25');
    expect(safeWikiHref(url)).toBe(url);
  });

  it('cannot escape the /wiki/ path', () => {
    expect(safeWikiHref(wikiPageUrl('../index.php'))).toBe('https://aeonsend.wiki.gg/wiki/..%2Findex.php');
  });
});
