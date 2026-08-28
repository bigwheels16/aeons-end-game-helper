import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
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
      currentTurn: null,
      roundNumber: 0,
    });
  });

  it('should start at config screen, allow config, and start game', () => {
    render(<App />);

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
    expect(useGameStore.getState().currentTurn).not.toBeNull();
    
    // There should be a NEXT TURN button
    expect(screen.getByText('NEXT TURN')).toBeDefined();
    expect(screen.getByText('End Game')).toBeDefined();
  });
});
