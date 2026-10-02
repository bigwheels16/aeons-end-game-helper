import { describe, it, expect } from 'vitest';
import {
  getMageById,
  getNemesisById,
  getSupplyCardById,
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
