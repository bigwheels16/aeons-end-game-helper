import { describe, it, expect } from 'vitest';
import { solveSupplyRandomizer } from './supplyRandomizerEngine';
import { SlotCriteria } from './store';
import { ScrapedSupplyCard } from './types/scraped';

describe('Supply Randomizer Engine', () => {
  const mockCards: ScrapedSupplyCard[] = [
    { id: '1', name: 'Gem1', type: 'Gem', cost: 2 },
    { id: '2', name: 'Gem2', type: 'Gem', cost: 4 },
    { id: '3', name: 'Relic1', type: 'Relic', cost: 3 },
    { id: '4', name: 'Spell1', type: 'Spell', cost: 5 },
    { id: '5', name: 'Spell2', type: 'Spell', cost: 6 },
  ];

  it('should assign cards successfully for valid constraints', () => {
    const slots: SlotCriteria[] = [
      { id: 's1', cardType: 'Gem', costRange: [0, 10], searchTerm: '' },
      { id: 's2', cardType: 'Relic', costRange: [0, 10], searchTerm: '' },
      { id: 's3', cardType: 'Spell', costRange: [5, 6], searchTerm: '' }
    ];
    
    const result = solveSupplyRandomizer(slots, mockCards);
    expect(result).not.toBeNull();
    expect(result!['s1'].type).toBe('Gem');
    expect(result!['s2'].type).toBe('Relic');
    expect(result!['s3'].type).toBe('Spell');
    
    // Ensure all assigned cards are unique
    const assignedIds = Object.values(result!).map(c => c.id);
    expect(new Set(assignedIds).size).toBe(3);
  });

  it('should return null if constraints cannot be satisfied', () => {
    const slots: SlotCriteria[] = [
      { id: 's1', cardType: 'Relic', costRange: [0, 10], searchTerm: '' },
      { id: 's2', cardType: 'Relic', costRange: [0, 10], searchTerm: '' }, // We only have 1 Relic in mockCards
    ];
    
    const result = solveSupplyRandomizer(slots, mockCards);
    expect(result).toBeNull();
  });

  it('should fallback appropriately with backtracking when a greedy choice fails', () => {
    const customCards: ScrapedSupplyCard[] = [
      { id: '1', name: 'Jade', type: 'Gem', cost: 2 },
      { id: '2', name: 'Ruby', type: 'Gem', cost: 3 },
    ];
    
    const slots: SlotCriteria[] = [
      { id: 's1', cardType: 'Gem', costRange: [0, 10], searchTerm: '' },
      { id: 's2', cardType: 'Gem', costRange: [3, 3], searchTerm: 'ruby' }, // Must be Ruby
    ];
    
    const result = solveSupplyRandomizer(slots, customCards);
    expect(result).not.toBeNull();
    // It should figure out that s2 MUST be Ruby, so s1 must be Jade
    expect(result!['s2'].name).toBe('Ruby');
    expect(result!['s1'].name).toBe('Jade');
  });

  it('should enforce maximum step count to prevent DoS on impossible large constraints', () => {
    // Generate 100 identical cards and 100 slots that are impossible to fulfill uniquely 
    // due to a subtle constraint, testing if it timeouts gracefully
    const manyCards = Array.from({ length: 20 }, (_, i) => ({ id: `c${i}`, name: `Card${i}`, type: 'Gem', cost: 1 }));
    const impossibleSlots = Array.from({ length: 21 }, (_, i) => ({ id: `s${i}`, cardType: 'Gem' as const, costRange: [0, 10] as [number, number], searchTerm: '' }));
    
    const result = solveSupplyRandomizer(impossibleSlots, manyCards);
    expect(result).toBeNull(); // Should fail gracefully
  });
});
