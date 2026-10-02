import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
    expect(screen.getByRole('button', { name: 'Round Over. Start new round' })).toBeDefined();
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
    expect(images.length).toBe(9); // 8 in discard, 1 in current turn (decorative, alt="")

    const cardButton = screen.getByRole('button', { name: /Start new round/ });
    expect(cardButton.getAttribute('aria-label')).toBe('Player 1. Start new round');
    expect(cardButton.querySelector('img')?.getAttribute('alt')).toBe('');
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
    
    expect(screen.getByRole('button', { name: /Draw next turn card/ })).toBeDefined();
  });

  describe('tap the current card to draw the next one', () => {
    const drawCards: Card[] = [
      { id: 'p1', type: 'Player 1', imageFaceUrl: 'url1', isRevealed: false },
      { id: 'p2', type: 'Player 2', imageFaceUrl: 'url2', isRevealed: false },
      { id: 'n1', type: 'Nemesis', imageFaceUrl: 'url3', isRevealed: false },
    ];
    const currentCard: Card = { id: 'p0', type: 'Player 3', imageFaceUrl: 'url0', isRevealed: true };

    beforeEach(() => {
      vi.useFakeTimers();
      useGameStore.setState({ drawPile: drawCards, discardPile: [currentCard] });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('does not render a separate Next Turn button', () => {
      render(<GameplayScreen />);

      expect(screen.queryByText('NEXT TURN')).toBeNull();
      expect(screen.queryByText('START NEW ROUND')).toBeNull();
    });

    it('renders the current card as an accessible native button with the hint below it', () => {
      render(<GameplayScreen />);

      const cardButton = screen.getByRole('button', { name: /Draw next turn card/ });
      // The accessible name says which card is current, not just the action
      expect(cardButton).toBe(screen.getByRole('button', { name: /^Player 3\. Draw next turn card$/ }));
      expect(cardButton.querySelector('img')?.getAttribute('alt')).toBe('');
      expect(cardButton.tagName).toBe('BUTTON');
      expect(cardButton.getAttribute('type')).toBe('button');
      expect(cardButton.getAttribute('aria-disabled')).toBe('false');
      expect(cardButton.querySelector('img')?.getAttribute('src')).toBe('url0');

      const hint = screen.getByText('(tap the card to draw the next one)');
      expect(cardButton.nextElementSibling).toBe(hint);
    });

    it('draws the next card when the current card is clicked', () => {
      render(<GameplayScreen />);

      fireEvent.click(screen.getByRole('button', { name: /Draw next turn card/ }));

      const state = useGameStore.getState();
      expect(state.discardPile.map(c => c.id)).toEqual(['p0', 'p1']);
      expect(state.drawPile.map(c => c.id)).toEqual(['p2', 'n1']);
    });

    it('ignores a second tap within 1s and reflects the disabled state on the card', () => {
      render(<GameplayScreen />);
      const cardButton = screen.getByRole('button', { name: /Draw next turn card/ });

      fireEvent.click(cardButton);
      expect(cardButton.getAttribute('aria-disabled')).toBe('true');
      fireEvent.click(cardButton);
      expect(useGameStore.getState().discardPile).toHaveLength(2);

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(cardButton.getAttribute('aria-disabled')).toBe('false');
      fireEvent.click(cardButton);
      expect(useGameStore.getState().discardPile).toHaveLength(3);
    });

    it('starts a new round when the draw pile is empty', () => {
      useGameStore.setState({ drawPile: [], discardPile: [currentCard], roundNumber: 1 });
      render(<GameplayScreen />);

      fireEvent.click(screen.getByRole('button', { name: /^Player 3\. Start new round$/ }));

      expect(useGameStore.getState().roundNumber).toBe(2);
    });

    it('is not tappable and hides the hint in a special mode', () => {
      render(<GameplayScreen />);

      fireEvent.click(screen.getByText('Special Actions'));
      fireEvent.click(screen.getByText('Move Cards'));

      expect(screen.getByText('Move mode')).toBeDefined();
      expect(screen.queryByRole('button', { name: /Draw next turn card/ })).toBeNull();
      expect(screen.queryByText('(tap the card to draw the next one)')).toBeNull();
      // The current turn card is still shown, just not wrapped in a button
      const currentImages = screen.getAllByRole('img').filter(img => img.getAttribute('src') === 'url0');
      expect(currentImages.length).toBeGreaterThan(0);
      currentImages.forEach(img => expect(img.closest('button')).toBeNull());
      expect(useGameStore.getState().discardPile).toHaveLength(1);
    });

    it('is not tappable and hides the hint in Reveal mode, and restores both after cancelling', () => {
      render(<GameplayScreen />);

      fireEvent.click(screen.getByText('Special Actions'));
      fireEvent.click(screen.getByText('Reveal Cards'));

      expect(screen.getByText('Reveal mode')).toBeDefined();
      expect(screen.queryByRole('button', { name: /Draw next turn card/ })).toBeNull();
      expect(screen.queryByText('(tap the card to draw the next one)')).toBeNull();
      const currentImages = screen.getAllByRole('img').filter(img => img.getAttribute('src') === 'url0');
      expect(currentImages.length).toBeGreaterThan(0);
      currentImages.forEach(img => expect(img.closest('button')).toBeNull());

      fireEvent.click(screen.getByText('Cancel'));

      expect(screen.getByRole('button', { name: /^Player 3\. Draw next turn card$/ })).toBeDefined();
      expect(screen.getByText('(tap the card to draw the next one)')).toBeDefined();
      expect(useGameStore.getState().discardPile).toHaveLength(1);
    });

    it('is keyboard-focusable as a native button (Enter/Space activation is native button behaviour)', () => {
      render(<GameplayScreen />);
      const cardButton = screen.getByRole('button', { name: /Draw next turn card/ }) as HTMLButtonElement;

      // Not removed from the tab order and not natively disabled (would drop focus during the debounce)
      expect(cardButton.hasAttribute('tabindex')).toBe(false);
      expect(cardButton.disabled).toBe(false);
      cardButton.focus();
      expect(document.activeElement).toBe(cardButton);

      // A keyboard activation dispatches a click on the native button; it draws a card and keeps focus
      fireEvent.click(cardButton, { detail: 0 });
      expect(useGameStore.getState().discardPile).toHaveLength(2);
      expect(cardButton.getAttribute('aria-disabled')).toBe('true');
      expect(cardButton.disabled).toBe(false);
      expect(document.activeElement).toBe(screen.getByRole('button', { name: /Draw next turn card/ }));
    });

    it('updates the accessible name to the newly drawn card', () => {
      render(<GameplayScreen />);

      fireEvent.click(screen.getByRole('button', { name: /^Player 3\. Draw next turn card$/ }));

      // Drawing reveals the card, so the name reports its type
      expect(screen.getByRole('button', { name: /^Player 1\. Draw next turn card$/ })).toBeDefined();
    });

    it('labels a face-down current card as "Card Back"', () => {
      useGameStore.setState({ discardPile: [{ ...currentCard, isRevealed: false }] });
      render(<GameplayScreen />);

      const cardButton = screen.getByRole('button', { name: /^Card Back\. Draw next turn card$/ });
      expect(cardButton.querySelector('img')?.getAttribute('alt')).toBe('');
    });

    it('starts a new round from the "Round Over" state when there is no current card', () => {
      useGameStore.setState({ drawPile: [], discardPile: [], roundNumber: 3 });
      render(<GameplayScreen />);

      const cardButton = screen.getByRole('button', { name: /^Round Over\. Start new round$/ });
      expect(cardButton.textContent).toBe('Round Over');
      expect(screen.getByText('(tap the card to draw the next one)')).toBeDefined();

      fireEvent.click(cardButton);
      expect(useGameStore.getState().roundNumber).toBe(4);
    });

    it('does not start a second new round from a double tap within 1s', () => {
      useGameStore.setState({ drawPile: [], discardPile: [currentCard], roundNumber: 1 });
      render(<GameplayScreen />);

      fireEvent.click(screen.getByRole('button', { name: /Start new round/ }));
      expect(useGameStore.getState().roundNumber).toBe(2);
      const drawnAfterFirst = useGameStore.getState().discardPile.length;

      fireEvent.click(screen.getByRole('button', { name: /Draw next turn card|Start new round/ }));
      expect(useGameStore.getState().roundNumber).toBe(2);
      expect(useGameStore.getState().discardPile).toHaveLength(drawnAfterFirst);
    });
  });
});
