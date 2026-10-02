import { describe, it, expect, vi } from 'vitest';
import { ALL_EXPANSIONS, formatOwnedList, getEffectiveOwned, matchesOwned } from './expansions';

vi.mock('../../data/scraped/aeons_end_all.json', () => ({
  default: {
    supply: [
      { name: 'Jade', type: 'Gem', expansions: ['Base'] },
      { name: 'Shard', type: 'Gem', expansions: ['Buried Secrets'] },
      { name: 'Spark', type: 'Spell', expansions: ['Promo', 'Base'] },
    ],
    mages: [
      { name: 'Brama', type: 'Mage', expansions: ['War Eternal'] },
      { name: 'Adelheim', type: 'Mage', expansions: ['Base'] },
    ],
    nemeses: [
      { name: 'Rageborne', type: 'Nemesis', expansions: ['Aeon\'s End'] },
      { name: 'Nameless', type: 'Nemesis' },
    ],
  },
}));

describe('ALL_EXPANSIONS', () => {
  it('is the sorted, de-duplicated union across supply, mages and nemeses', () => {
    expect(ALL_EXPANSIONS).toEqual(['Aeon\'s End', 'Base', 'Buried Secrets', 'Promo', 'War Eternal']);
  });

  it('is immutable', () => {
    expect(Object.isFrozen(ALL_EXPANSIONS)).toBe(true);
  });
});

describe('getEffectiveOwned', () => {
  it('returns [] (= All) for an empty selection', () => {
    expect(getEffectiveOwned([])).toEqual([]);
  });

  it('drops stale/unknown names and returns the rest in canonical order', () => {
    expect(getEffectiveOwned(['War Eternal', 'Gone', 'Base'])).toEqual(['Base', 'War Eternal']);
  });

  it('returns [] when every name is stale', () => {
    expect(getEffectiveOwned(['Gone', 'Also Gone'])).toEqual([]);
  });

  it('removes duplicates', () => {
    expect(getEffectiveOwned(['Promo', 'Promo', 'Base'])).toEqual(['Base', 'Promo']);
  });

  it('accepts an explicit list of all expansions', () => {
    expect(getEffectiveOwned(['b', 'z', 'a'], ['a', 'b', 'c'])).toEqual(['a', 'b']);
  });
});

describe('matchesOwned', () => {
  it('matches everything when the set is null or empty (All)', () => {
    expect(matchesOwned({ expansions: ['Base'] }, null)).toBe(true);
    expect(matchesOwned({ expansions: ['Base'] }, new Set())).toBe(true);
    expect(matchesOwned({}, null)).toBe(true);
  });

  it('uses any-match semantics for multi-expansion items', () => {
    const owned = new Set(['Promo']);
    expect(matchesOwned({ expansions: ['Base', 'Promo'] }, owned)).toBe(true);
    expect(matchesOwned({ expansions: ['Base'] }, owned)).toBe(false);
  });

  it('does not match items without expansions when a selection is active', () => {
    expect(matchesOwned({}, new Set(['Base']))).toBe(false);
  });
});

describe('formatOwnedList', () => {
  it('lists up to three names', () => {
    expect(formatOwnedList(['A', 'B', 'C'])).toBe('A, B, C');
  });

  it('truncates after three names with "+N more"', () => {
    expect(formatOwnedList(['A', 'B', 'C', 'D', 'E'])).toBe('A, B, C +2 more');
  });
});
