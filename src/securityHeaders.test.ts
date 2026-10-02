import { describe, it, expect } from 'vitest';
// Imported with ?raw so a missing file fails the whole suite at import time
// instead of skipping or passing vacuously.
import securityHeadersConf from '../nginx/security-headers.conf?raw';
import indexHtml from '../index.html?raw';

const EXPECTED_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' https://aeonsend.wiki.gg; object-src 'none'; base-uri 'self'; " +
  "frame-ancestors 'none'; form-action 'none'";

const CSP_LINE_PATTERN = /^\s*add_header\s+Content-Security-Policy\s+"([^"]*)"\s+always;\s*$/;

function cspLines(conf: string): string[] {
  return conf
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('#'))
    .filter((line) => /content-security-policy/i.test(line));
}

function extractCsp(conf: string): string {
  const lines = cspLines(conf);
  if (lines.length !== 1) {
    throw new Error(`Expected exactly one Content-Security-Policy line, found ${lines.length}`);
  }
  const match = CSP_LINE_PATTERN.exec(lines[0]);
  if (!match) {
    throw new Error(`Content-Security-Policy line is malformed or missing "always": ${lines[0]}`);
  }
  return match[1];
}

function parseDirectives(csp: string): Map<string, string[]> {
  const directives = new Map<string, string[]>();
  for (const part of csp.split(';')) {
    const tokens = part.trim().split(/\s+/).filter((t) => t.length > 0);
    if (tokens.length === 0) continue;
    const [name, ...sources] = tokens;
    const key = name.toLowerCase();
    if (directives.has(key)) {
      throw new Error(`Duplicate CSP directive: ${key}`);
    }
    directives.set(key, sources);
  }
  return directives;
}

function directive(directives: Map<string, string[]>, name: string): string[] {
  const sources = directives.get(name);
  if (sources === undefined) {
    throw new Error(`CSP directive missing: ${name}`);
  }
  return sources;
}

describe('nginx security headers: Content-Security-Policy', () => {
  const csp = extractCsp(securityHeadersConf);
  const directives = parseDirectives(csp);

  it('has exactly one CSP line, sent with "always"', () => {
    expect(cspLines(securityHeadersConf)).toHaveLength(1);
    expect(CSP_LINE_PATTERN.test(cspLines(securityHeadersConf)[0])).toBe(true);
  });

  it('matches the approved policy exactly', () => {
    expect(csp).toBe(EXPECTED_CSP);
  });

  it('script-src allows neither unsafe-inline nor unsafe-eval', () => {
    const scriptSrc = directive(directives, 'script-src');
    expect(scriptSrc).toEqual(["'self'"]);
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it('sets object-src none, base-uri self, frame-ancestors none and form-action none', () => {
    expect(directive(directives, 'object-src')).toEqual(["'none'"]);
    expect(directive(directives, 'base-uri')).toEqual(["'self'"]);
    expect(directive(directives, 'frame-ancestors')).toEqual(["'none'"]);
    expect(directive(directives, 'form-action')).toEqual(["'none'"]);
  });

  it('img-src holds only self and the wiki origin', () => {
    expect(directive(directives, 'img-src')).toEqual(["'self'", 'https://aeonsend.wiki.gg']);
  });

  it('style-src has no hash or nonce while unsafe-inline is present', () => {
    const styleSrc = directive(directives, 'style-src');
    expect(styleSrc).toContain("'unsafe-inline'");
    for (const source of styleSrc) {
      expect(source.startsWith("'sha256-")).toBe(false);
      expect(source.startsWith("'sha384-")).toBe(false);
      expect(source.startsWith("'sha512-")).toBe(false);
      expect(source.startsWith("'nonce-")).toBe(false);
    }
  });

  it('contains no wildcard, data:, blob: or bare https: source', () => {
    for (const sources of directives.values()) {
      for (const source of sources) {
        expect(source).not.toContain('*');
        expect(['data:', 'blob:', 'https:', 'http:']).not.toContain(source.toLowerCase());
      }
    }
  });
});

describe('index.html', () => {
  it('has at least one script, and every script has a src attribute', () => {
    const scriptTags = indexHtml.match(/<script\b[^>]*>/gi) ?? [];
    expect(scriptTags.length).toBeGreaterThan(0);
    for (const tag of scriptTags) {
      expect(tag).toMatch(/\ssrc\s*=/i);
    }
  });

  it('declares no CSP via meta http-equiv', () => {
    expect(indexHtml).not.toMatch(/http-equiv\s*=\s*["']?content-security-policy/i);
  });
});
