import { describe, it, expect } from 'vitest';
import scrapedData from '../../data/scraped/aeons_end_all.json';

const KIND_BY_COLLECTION = {
  supply: 'supply',
  unique_starters: 'starter',
  mages: 'mage',
  nemeses: 'nemesis',
  nemesis_cards: 'nemesis-card',
} as const;

const EXPECTED_COUNTS = { supply: 427, unique_starters: 239, mages: 104, nemeses: 73, nemesis_cards: 1276 };

const idPattern = (kind: string) => new RegExp(`^${kind}:[\\p{L}\\p{M}\\p{N}]+(?:-[\\p{L}\\p{M}\\p{N}]+)*$`, 'u');

describe('bundled dataset ids', () => {
  const collections = Object.keys(KIND_BY_COLLECTION) as (keyof typeof KIND_BY_COLLECTION)[];

  it('has the expected record counts', () => {
    for (const collection of collections) {
      expect(scrapedData[collection].length, collection).toBe(EXPECTED_COUNTS[collection]);
    }
  });

  it('gives every record an NFC, bounded id of its collection kind', () => {
    for (const collection of collections) {
      const pattern = idPattern(KIND_BY_COLLECTION[collection]);
      for (const record of scrapedData[collection]) {
        const id: unknown = record.id;
        if (typeof id !== 'string' || !pattern.test(id) || id.normalize('NFC') !== id || id.length > 200) {
          throw new Error(`Bad id in ${collection}: ${JSON.stringify(id)}`);
        }
        expect(id).toContain(':');
        expect(Object.keys(record)[0]).toBe('id');
        expect(record).not.toHaveProperty('card_number');
        expect(record).not.toHaveProperty('page_id');
      }
    }
  });

  it('has globally unique ids', () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const collection of collections) {
      for (const record of scrapedData[collection]) {
        if (seen.has(record.id)) duplicates.push(record.id);
        seen.add(record.id);
      }
    }
    expect(duplicates).toEqual([]);
    expect(seen.size).toBe(2119);
  });

  it('id regexes are anchored (no partial or multiline matches)', () => {
    const pattern = idPattern('supply');
    expect(pattern.test('supply:jade')).toBe(true);
    expect(pattern.test('supply:café')).toBe(true);
    expect(pattern.test('supply:jade\n')).toBe(false);
    expect(pattern.test('x supply:jade')).toBe(false);
    expect(pattern.test('supply:jade\nmage:x')).toBe(false);
    expect(pattern.test('supply:a--b')).toBe(false);
    expect(pattern.test('supply:-a')).toBe(false);
  });
});
