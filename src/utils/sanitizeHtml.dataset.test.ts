import { describe, it, expect } from 'vitest';
import DOMPurify from 'dompurify';
// A static import: a missing dataset fails the whole suite at import time instead of skipping.
import scrapedData from '../../data/scraped/aeons_end_all.json';
import { createScrapedHtmlSanitizer, sanitizeScrapedHtml } from './sanitizeHtml';

/** Every HTML field the app renders, plus nemesis_cards.effect so it is ready if ever rendered. */
const HTML_FIELDS = {
  supply: ['effect'],
  unique_starters: ['effect'],
  mages: ['ability_effect', 'additional_rules'],
  nemeses: ['unleash', 'increased_difficulty', 'rules', 'setup'],
  nemesis_cards: ['effect'],
} as const;

/** The only fields whose output differs from DOMPurify's default config: the img style is removed. */
const EXPECTED_STYLE_DIFFS = ['nemesis:blight-lord.unleash', 'nemesis:carapace-queen.unleash', 'nemesis:rageborne.unleash'];

const IMG_STYLE_ATTR = / style="[^"]*"/;

interface HtmlValue {
  key: string;
  html: string;
}

function collectHtmlValues(): HtmlValue[] {
  const values: HtmlValue[] = [];
  for (const [collection, fields] of Object.entries(HTML_FIELDS)) {
    const records: Record<string, unknown>[] = scrapedData[collection as keyof typeof HTML_FIELDS];
    if (!Array.isArray(records) || records.length === 0) {
      throw new Error(`Dataset collection ${collection} is missing or empty`);
    }
    for (const field of fields) {
      let present = 0;
      for (const record of records) {
        const value = record[field];
        if (value === undefined || value === null || value === '') continue;
        if (typeof value !== 'string') {
          throw new Error(`${collection}.${field} of ${String(record.id)} is not a string`);
        }
        values.push({ key: `${String(record.id)}.${field}`, html: value });
        present += 1;
      }
      if (present === 0) throw new Error(`Dataset field ${collection}.${field} is empty in every record`);
    }
  }
  return values;
}

function describeRemoved(entry: (typeof DOMPurify.removed)[number]): string {
  if ('attribute' in entry) {
    return `${entry.from.nodeName}@${entry.attribute?.name ?? '?'}`;
  }
  return entry.element.nodeName;
}

describe('allowlist against the bundled dataset', () => {
  const values = collectHtmlValues();

  it('covers every rendered HTML field', () => {
    expect(values.length).toBeGreaterThan(2000);
  });

  it('matches the default DOMPurify output except for the known img style removals', () => {
    const diffs: string[] = [];
    for (const { key, html } of values) {
      const ours = sanitizeScrapedHtml(html);
      const reference = DOMPurify.sanitize(html);
      if (ours === reference) continue;
      diffs.push(key);
      expect(reference, key).toMatch(IMG_STYLE_ATTR);
      expect(ours, key).toBe(reference.replace(IMG_STYLE_ATTR, ''));
    }
    expect(diffs.sort()).toEqual(EXPECTED_STYLE_DIFFS);
  });

  it('removes nothing from the dataset except the 3 img style attributes', () => {
    const local = DOMPurify(window);
    const sanitize = createScrapedHtmlSanitizer(local);
    const removed: string[] = [];
    for (const { key, html } of values) {
      sanitize(html);
      for (const entry of local.removed) {
        const name = describeRemoved(entry);
        if (name !== 'BODY') removed.push(`${key}: ${name}`);
      }
    }
    expect(removed.sort()).toEqual(EXPECTED_STYLE_DIFFS.map((key) => `${key}: IMG@style`));
  });
});
