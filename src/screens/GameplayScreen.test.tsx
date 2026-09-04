import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import GameplayScreen from './GameplayScreen';
import { useGameStore } from '../store';
import { Card } from '../deckEngine';

describe('GameplayScreen Component', () => {
  beforeEach(() => {
    useGameStore.setState({
      playerCount: 2,
      allowConsecutiveNemesis: true,
      visibilityOption: 'current',
      isPlaying: true,
      drawPile: [],
      discardPile: [],
      roundNumber: 1,
    });
  });

  it('should render empty piles correctly', () => {
    render(<GameplayScreen />);
    
    expect(screen.getByText('Discard Pile')).toBeDefined();
    expect(screen.getByText('Draw Pile Empty')).toBeDefined();
    expect(screen.getByText('START NEW ROUND')).toBeDefined();
  });

  it('should render all cards in discard pile without limiting to 6', () => {
    const generateCards = (num: number): Card[] => {
      return Array.from({ length: num }).map((_, i) => ({
        id: 'Player 1-' + i,
        type: 'Player 1',
        imageFaceUrl: 'test-url',
        isRevealed: true
      }));
    };

    useGameStore.setState({
      discardPile: generateCards(8),
      drawPile: [],
    });

    render(<GameplayScreen />);
    
    const images = screen.getAllByRole('img');
    expect(images.length).toBe(9); // 8 in discard, 1 in current turn
  });

  it('should render draw pile preview cards', () => {
    const drawCards: Card[] = [
      { id: 'p1', type: 'Player 1', imageFaceUrl: 'url1', isRevealed: true },
      { id: 'p2', type: 'Player 2', imageFaceUrl: 'url2', isRevealed: false },
    ];

    useGameStore.setState({
      drawPile: drawCards,
      discardPile: [],
    });

    render(<GameplayScreen />);
    
    const images = screen.getAllByRole('img');
    expect(images.length).toBe(2);
    
    expect(images[0].getAttribute('src')).toBe('url1');
    expect(images[1].getAttribute('alt')).toBe('Card Back');
    
    expect(screen.getByText('NEXT TURN')).toBeDefined();
  });
});
