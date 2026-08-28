import { describe, it, expect } from 'vitest';
import { generateDeck, shuffleDeck } from './deckEngine';

describe('deckEngine', () => {
  it('should generate a deck of 5 cards for 1 player', () => {
    const deck = generateDeck(1);
    expect(deck.length).toBe(5);
    expect(deck.filter(c => c.type === 'Player 1').length).toBe(3);
    expect(deck.filter(c => c.type === 'Nemesis').length).toBe(2);
  });

  it('should generate a deck of 6 cards for 2 players', () => {
    const deck = generateDeck(2);
    expect(deck.length).toBe(6);
    expect(deck.filter(c => c.type === 'Player 1').length).toBe(2);
    expect(deck.filter(c => c.type === 'Player 2').length).toBe(2);
    expect(deck.filter(c => c.type === 'Nemesis').length).toBe(2);
  });

  it('should shuffle without consecutive nemesis cards if not allowed', () => {
    const deck = generateDeck(1);
    const shuffled = shuffleDeck(deck, false, null);
    
    let hasConsecutive = false;
    for (let i = 0; i < shuffled.length - 1; i++) {
      if (shuffled[i].type === 'Nemesis' && shuffled[i + 1].type === 'Nemesis') {
        hasConsecutive = true;
      }
    }
    expect(hasConsecutive).toBe(false);
  });

  it('should allow consecutive nemesis if specified', () => {
    const deck = generateDeck(1);
    const shuffled = shuffleDeck(deck, true, null);
    expect(shuffled.length).toBe(deck.length);
  });

  it('should gracefully handle only nemesis cards left when not allowing consecutive', () => {
    const deck: any[] = [
      { id: '1', type: 'Nemesis', imageFaceUrl: '' },
      { id: '2', type: 'Nemesis', imageFaceUrl: '' }
    ];
    const shuffled = shuffleDeck(deck, false, null);
    expect(shuffled.length).toBe(2);
    expect(shuffled[0].type).toBe('Nemesis');
    expect(shuffled[1].type).toBe('Nemesis');
  });

  it('should gracefully handle nemesis cards when last turn was nemesis but only nemesis left', () => {
    const deck: any[] = [
      { id: '1', type: 'Nemesis', imageFaceUrl: '' },
      { id: '2', type: 'Nemesis', imageFaceUrl: '' }
    ];
    const shuffled = shuffleDeck(deck, false, 'Nemesis');
    expect(shuffled.length).toBe(2);
  });
});
