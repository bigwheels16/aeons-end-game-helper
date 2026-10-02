import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import App from './App';
import { useGameStore } from './store';

describe('App Integration', () => {
  beforeEach(() => {
    // Reset store before each test
    useGameStore.setState({
      playerCount: 1,
      allowConsecutiveNemesis: true,
      visibilityOption: 'current',
      isPlaying: false,
      drawPile: [],
      discardPile: [],
      roundNumber: 0,
    });
    window.location.hash = '';
  });

  it('should start at config screen, allow config, and start game', () => {
    render(<App />);

    fireEvent.click(screen.getByText('Turn Order Helper'));

    // Should see Setup screen
    expect(screen.getByText("Aeon's End Setup")).toBeDefined();

    // Change player count to 2
    const btn2 = screen.getByText('2');
    fireEvent.click(btn2);
    expect(useGameStore.getState().playerCount).toBe(2);

    // Start game
    const startBtn = screen.getByText('START GAME');
    fireEvent.click(startBtn);

    // Should now be on Gameplay screen
    expect(screen.queryByText("Aeon's End Setup")).toBeNull();
    expect(useGameStore.getState().isPlaying).toBe(true);
    expect(useGameStore.getState().roundNumber).toBe(1);
    expect(useGameStore.getState().discardPile.length).toBeGreaterThan(0);
    
    // The current turn card is the control that draws the next card
    expect(screen.getByRole('button', { name: /Draw next turn card/ })).toBeDefined();
    expect(screen.getByText('(tap the card to draw the next one)')).toBeDefined();
    expect(screen.getByText('Special Actions')).toBeDefined();
    expect(screen.getByText('End Game')).toBeDefined();
  });

  it('plays a full round by tapping the current turn card, then starts a new round', () => {
    vi.useFakeTimers();
    try {
      render(<App />);
      fireEvent.click(screen.getByText('Turn Order Helper'));
      fireEvent.click(screen.getByText('2'));
      fireEvent.click(screen.getByText('START GAME'));

      expect(screen.queryByText('NEXT TURN')).toBeNull();
      expect(useGameStore.getState().roundNumber).toBe(1);
      const roundSize = useGameStore.getState().drawPile.length + useGameStore.getState().discardPile.length;

      // Draw every remaining card by tapping the card, waiting out the 1s debounce between taps
      while (useGameStore.getState().drawPile.length > 0) {
        const before = useGameStore.getState().discardPile.length;
        const top = useGameStore.getState().discardPile[before - 1];
        fireEvent.click(screen.getByRole('button', { name: `${top.type}. Draw next turn card` }));
        expect(useGameStore.getState().discardPile).toHaveLength(before + 1);
        act(() => {
          vi.advanceTimersByTime(1000);
        });
      }
      expect(useGameStore.getState().discardPile).toHaveLength(roundSize);

      // With the draw pile empty the same card control starts a new round
      const last = useGameStore.getState().discardPile[roundSize - 1];
      const card = screen.getByRole('button', { name: `${last.type}. Start new round` });
      expect(screen.getByText('(tap the card to draw the next one)')).toBeDefined();
      fireEvent.click(card);

      expect(useGameStore.getState().roundNumber).toBe(2);
      expect(useGameStore.getState().discardPile).toHaveLength(1);
      expect(useGameStore.getState().drawPile).toHaveLength(roundSize - 1);
      expect(screen.getByRole('button', { name: /Draw next turn card/ })).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('should allow navigation to Card Search tool and rendering of cards', () => {
    render(<App />);

    // Click Card Search button on HomeScreen
    const cardSearchBtn = screen.getByText('Supply Card Search');
    fireEvent.click(cardSearchBtn);

    // Verify Card Search screen is shown
    expect(screen.getByPlaceholderText('Search cards, effects...')).toBeDefined();
    
    // Check for Back button
    const backBtn = screen.getByText('← Back to Tools');
    fireEvent.click(backBtn);
    
    // Verify we are back on HomeScreen
    expect(screen.getByText('Supply Card Search')).toBeDefined();
  });
});
