import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from './store';
import { generateDeck } from './deckEngine';

describe('useGameStore custom actions', () => {
  beforeEach(() => {
    useGameStore.setState({
      playerCount: 1,
      allowConsecutiveNemesis: false,
      allowConsecutivePlayer: true,
      visibilityOption: 'current',
      isPlaying: false,
      drawPile: [],
      discardPile: [],
      roundNumber: 0,
    });
  });

  it('should move a card from draw to discard', () => {
    const deck = generateDeck(1); // 5 cards
    useGameStore.setState({ drawPile: deck, discardPile: [] });
    
    const cardId = deck[0].id;
    useGameStore.getState().moveCard('draw', cardId, 'discard', 'top'); // position shouldn't matter much for discard
    
    const state = useGameStore.getState();
    expect(state.drawPile.length).toBe(4);
    expect(state.discardPile.length).toBe(1);
    expect(state.discardPile[0].id).toBe(cardId);
  });

  it('should move a card from discard to draw top', () => {
    const deck = generateDeck(1);
    const card = deck[0];
    useGameStore.setState({ drawPile: [], discardPile: [card] });
    
    useGameStore.getState().moveCard('discard', card.id, 'draw', 'top');
    
    const state = useGameStore.getState();
    expect(state.discardPile.length).toBe(0);
    expect(state.drawPile.length).toBe(1);
    expect(state.drawPile[0].id).toBe(card.id);
  });

  it('should move a card from discard to draw bottom', () => {
    const deck = generateDeck(1);
    const topCard = deck[1];
    const cardToMove = deck[0];
    useGameStore.setState({ drawPile: [topCard], discardPile: [cardToMove] });
    
    useGameStore.getState().moveCard('discard', cardToMove.id, 'draw', 'bottom');
    
    const state = useGameStore.getState();
    expect(state.discardPile.length).toBe(0);
    expect(state.drawPile.length).toBe(2);
    expect(state.drawPile[1].id).toBe(cardToMove.id);
  });

  it('should move a card to draw and shuffle', () => {
    const deck = generateDeck(1);
    const cardToMove = deck[0];
    useGameStore.setState({ drawPile: deck.slice(1), discardPile: [cardToMove] });
    
    useGameStore.getState().moveCard('discard', cardToMove.id, 'draw', 'shuffled');
    
    const state = useGameStore.getState();
    expect(state.discardPile.length).toBe(0);
    expect(state.drawPile.length).toBe(5);
  });

  it('should shuffle draw pile', () => {
    const deck = generateDeck(1);
    useGameStore.setState({ drawPile: deck });
    
    useGameStore.getState().shuffleDrawPile();
    
    const state = useGameStore.getState();
    expect(state.drawPile.length).toBe(5);
  });

  it('should reveal the specified cards of the draw pile', () => {
    const deck = generateDeck(1);
    useGameStore.setState({ drawPile: deck });
    
    useGameStore.getState().revealCards([0, 2]);
    
    const state = useGameStore.getState();
    expect(state.drawPile[0].isRevealed).toBe(true);
    expect(state.drawPile[1].isRevealed).toBeUndefined();
    expect(state.drawPile[2].isRevealed).toBe(true);
  });

  it('should explicitly set isRevealed to true on the card when moving to discardPile in nextTurn', () => {
    const deck = generateDeck(1);
    useGameStore.setState({ drawPile: deck, discardPile: [] });
    
    useGameStore.getState().nextTurn();
    
    const state = useGameStore.getState();
    expect(state.discardPile.length).toBe(1);
    expect(state.discardPile[0].isRevealed).toBe(true);
  });

  describe('setPiles (Edit Mode)', () => {
    it('should overwrite draw and discard piles if total count is the same', () => {
      const deck = generateDeck(1); // 5 cards
      useGameStore.setState({ drawPile: deck, discardPile: [] });

      const newDraw = deck.slice(0, 3);
      const newDiscard = deck.slice(3, 5);
      
      useGameStore.getState().setPiles(newDraw, newDiscard);
      
      const state = useGameStore.getState();
      expect(state.drawPile.length).toBe(3);
      expect(state.discardPile.length).toBe(2);
      expect(state.drawPile).toEqual(newDraw.map(c => ({ ...c, isRevealed: false })));
      expect(state.discardPile).toEqual(newDiscard.map(c => ({ ...c, isRevealed: true })));
    });

    it('should reject changes if total count does not match (anti-cheating)', () => {
      const deck = generateDeck(1); // 5 cards
      useGameStore.setState({ drawPile: deck, discardPile: [] });

      const newDraw = deck.slice(0, 3);
      // Omit discard pile cards, making the total count 3 instead of 5
      const newDiscard: typeof deck = [];
      
      useGameStore.getState().setPiles(newDraw, newDiscard);
      
      const state = useGameStore.getState();
      // Should remain unchanged
      expect(state.drawPile.length).toBe(5);
      expect(state.discardPile.length).toBe(0);
      expect(state.drawPile).toEqual(deck);
    });
  });

  describe('searchFilters', () => {
    it('should initially have default search filters', () => {
      const state = useGameStore.getState();
      expect(state.searchFilters).toEqual({
        nameQuery: '',
        effectQuery: '',
        selectedExpansions: [],
        selectedTypes: [],
        costRange: [0, 10],
      });
    });

    it('should update search filters partially', () => {
      useGameStore.getState().setSearchFilters({ nameQuery: 'Diamond' });
      
      const state = useGameStore.getState();
      expect(state.searchFilters.nameQuery).toBe('Diamond');
      expect(state.searchFilters.effectQuery).toBe('');
      expect(state.searchFilters.selectedExpansions).toEqual([]);
      expect(state.searchFilters.selectedTypes).toEqual([]);
      expect(state.searchFilters.costRange).toEqual([0, 10]);

      useGameStore.getState().setSearchFilters({ costRange: [2, 5], selectedTypes: ['Gem'] });
      
      const nextState = useGameStore.getState();
      expect(nextState.searchFilters.nameQuery).toBe('Diamond');
      expect(nextState.searchFilters.costRange).toEqual([2, 5]);
      expect(nextState.searchFilters.selectedTypes).toEqual(['Gem']);
    });
  });
});

