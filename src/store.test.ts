import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from './store';
import { generateDeck } from './deckEngine';

describe('useGameStore custom actions', () => {
  beforeEach(() => {
    useGameStore.setState({
      playerCount: 1,
      allowConsecutiveNemesis: false,
      visibilityOption: 'current',
      isPlaying: false,
      drawPile: [],
      discardPile: [],
      currentTurn: null,
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
});
