import { describe, it, expect } from 'vitest';
import {
  getMageById,
  getNemesisById,
  getSupplyCardById,
  getSupplyCardByLegacyName,
  getUniqueExpansions,
  isKnownFavoriteId,
} from './cards';

describe('record lookups by id', () => {
  it('finds supply cards by exact id', () => {
    expect(getSupplyCardById('supply:transmuters-lens')?.name).toBe("Transmuter's Lens");
    expect(getSupplyCardById('supply:no-such-card')).toBeUndefined();
    expect(getSupplyCardById('mage:taqren-outcasts')).toBeUndefined();
  });

  it('does not transform ids before lookup', () => {
    expect(getSupplyCardById('SUPPLY:TRANSMUTERS-LENS')).toBeUndefined();
    expect(getSupplyCardById(' supply:transmuters-lens')).toBeUndefined();
  });

  it('finds mages and nemeses by id, and not by wrong-kind or unknown ids', () => {
    expect(getMageById('mage:taqren-outcasts')?.name).toBe('Taqren (Outcasts)');
    expect(getNemesisById('nemesis:prince-of-gluttons')?.name).toBe('Prince of Gluttons');
    expect(getMageById('nemesis:prince-of-gluttons')).toBeUndefined();
    expect(getNemesisById('mage:taqren-outcasts')).toBeUndefined();
    expect(getMageById('mage:nobody')).toBeUndefined();
  });

  it('finds legacy supply cards by exact name only', () => {
    expect(getSupplyCardByLegacyName('All-out Barrage')?.id).toBe('supply:all-out-barrage');
    expect(getSupplyCardByLegacyName('all-out barrage')).toBeUndefined();
  });

  it('is prototype-safe', () => {
    for (const key of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
      expect(getSupplyCardById(key)).toBeUndefined();
      expect(getSupplyCardByLegacyName(key)).toBeUndefined();
      expect(getMageById(key)).toBeUndefined();
      expect(getNemesisById(key)).toBeUndefined();
      expect(isKnownFavoriteId('supply', key)).toBe(false);
      expect(isKnownFavoriteId('mages', key)).toBe(false);
      expect(isKnownFavoriteId('nemeses', key)).toBe(false);
    }
  });

  it('does not resolve kind-prefixed prototype names or invisible-character variants', () => {
    for (const id of ['supply:constructor', 'supply:proto', 'supply:__proto__', 'mage:constructor']) {
      expect(getSupplyCardById(id)).toBeUndefined();
      expect(getMageById(id)).toBeUndefined();
    }
    // Exact comparison: zero-width, bidi, trailing newline and NFD variants of a real id do not match.
    for (const id of ['supply:ja\u200bde', '\u202esupply:jade', 'supply:jade\n', 'supply:jade'.normalize('NFD') + '\u0301']) {
      expect(getSupplyCardById(id)).toBeUndefined();
      expect(isKnownFavoriteId('supply', id)).toBe(false);
    }
  });

  it('isKnownFavoriteId rejects an unknown category without throwing', () => {
    expect(isKnownFavoriteId('constructor' as never, 'supply:jade')).toBe(false);
    expect(isKnownFavoriteId('__proto__' as never, 'supply:jade')).toBe(false);
  });

  it('isKnownFavoriteId checks the category kind', () => {
    expect(isKnownFavoriteId('supply', 'supply:jade')).toBe(true);
    expect(isKnownFavoriteId('mages', 'mage:taqren-outcasts')).toBe(true);
    expect(isKnownFavoriteId('nemeses', 'nemesis:prince-of-gluttons')).toBe(true);
    expect(isKnownFavoriteId('supply', 'mage:taqren-outcasts')).toBe(false);
    expect(isKnownFavoriteId('mages', 'supply:jade')).toBe(false);
    expect(isKnownFavoriteId('supply', 'Jade')).toBe(false);
  });
});

describe('getUniqueExpansions', () => {
  it('returns sorted unique non-empty expansions', () => {
    expect(getUniqueExpansions([{ expansions: ['B', 'A'] }, { expansions: ['A', ''] }, {}])).toEqual(['A', 'B']);
  });
});
