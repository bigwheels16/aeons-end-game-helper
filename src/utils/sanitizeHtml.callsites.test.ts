import { describe, it, expect } from 'vitest';

const SOURCES = import.meta.glob<string>('/src/**/*.{ts,tsx,js,jsx,mjs}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const SANITIZER_FILE = '/src/utils/sanitizeHtml.ts';
const SINK_FILE = '/src/components/ScrapedHtml.tsx';

const DOMPURIFY_IMPORT = /['"](isomorphic-)?dompurify['"]/;
const REACT_HTML_SINK = /dangerouslySetInnerHTML/;
const FORBIDDEN_SINKS: [string, RegExp][] = [
  ['innerHTML assignment', /\.innerHTML\s*=/],
  ['outerHTML assignment', /outerHTML\s*=/],
  ['insertAdjacentHTML', /insertAdjacentHTML/],
  ['createContextualFragment', /createContextualFragment/],
  ['document.write', /document\.write/],
];

function isTestFile(path: string): boolean {
  return /\.(test|spec)\.[^/]+$/.test(path) || path.startsWith('/src/test/');
}

const appSources = Object.entries(SOURCES).filter(([path]) => !isTestFile(path));

describe('HTML sink call sites', () => {
  it('scans the app sources, including both permitted files', () => {
    expect(appSources.length).toBeGreaterThan(10);
    const paths = appSources.map(([path]) => path);
    expect(paths).toContain(SANITIZER_FILE);
    expect(paths).toContain(SINK_FILE);
    expect(SOURCES[SANITIZER_FILE]).toMatch(DOMPURIFY_IMPORT);
    expect(SOURCES[SINK_FILE]).toMatch(REACT_HTML_SINK);
  });

  it('imports dompurify only in the sanitizer module', () => {
    const offenders = appSources.filter(([path, src]) => path !== SANITIZER_FILE && DOMPURIFY_IMPORT.test(src));
    expect(offenders.map(([path]) => path)).toEqual([]);
  });

  it('uses dangerouslySetInnerHTML only in ScrapedHtml', () => {
    const offenders = appSources.filter(([path, src]) => path !== SINK_FILE && REACT_HTML_SINK.test(src));
    expect(offenders.map(([path]) => path)).toEqual([]);
  });

  it.each(FORBIDDEN_SINKS)('has no %s anywhere in the app sources', (_label, pattern) => {
    const offenders = appSources.filter(([, src]) => pattern.test(src));
    expect(offenders.map(([path]) => path)).toEqual([]);
  });
});
