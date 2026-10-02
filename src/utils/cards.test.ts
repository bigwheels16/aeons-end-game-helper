import { describe, it, expect } from 'vitest';
import { getMageById, getNemesisById, getSupplyCardById, getSupplyCardByName } from './cards';

describe('record lookups by id', () => {
  it('finds supply cards by exact id', () => {
    expect(getSupplyCardById('supply:transmuters-lens')?.name).toBe("Transmuter's Lens");
    expect(getSupplyCardById('supply:no-such-card')).toBeUndefined();
    expect(getSupplyCardById('mage:taqren-outcasts')).toBeUndefined();
  });

  it('finds supply cards by exact name', () => {
    expect(getSupplyCardByName("Transmuter's Lens")?.id).toBe('supply:transmuters-lens');
    expect(getSupplyCardByName("transmuter's lens")).toBeUndefined();
    expect(getSupplyCardByName('No Such Card')).toBeUndefined();
  });

  it('finds mages and nemeses by id, and not by wrong-kind or unknown ids', () => {
    expect(getMageById('mage:taqren-outcasts')?.name).toBe('Taqren (Outcasts)');
    expect(getNemesisById('nemesis:prince-of-gluttons')?.name).toBe('Prince of Gluttons');
    expect(getMageById('nemesis:prince-of-gluttons')).toBeUndefined();
    expect(getNemesisById('mage:taqren-outcasts')).toBeUndefined();
    expect(getMageById('mage:nobody')).toBeUndefined();
  });
});
