import { render, screen, fireEvent, act, within } from '@testing-library/react';
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

    it.each([
      ['Move Cards', 'Move mode'],
      ['Reveal Cards', 'Reveal mode'],
    ])('is not tappable and hides the hint after choosing "%s", and restores both after cancelling', (action, modeTitle) => {
      render(<GameplayScreen />);

      fireEvent.click(screen.getByText('Special Actions'));
      fireEvent.click(screen.getByText(action));

      expect(screen.getByText(modeTitle)).toBeDefined();
      expect(screen.queryByRole('button', { name: /Draw next turn card/ })).toBeNull();
      expect(screen.queryByText('(tap the card to draw the next one)')).toBeNull();
      // The current turn card is still shown, just not wrapped in a button
      const currentImages = screen.getAllByRole('img').filter(img => img.getAttribute('src') === 'url0');
      expect(currentImages.length).toBeGreaterThan(0);
      currentImages.forEach(img => expect(img.closest('button')).toBeNull());

      fireEvent.click(screen.getByText('Cancel'));

      expect(screen.getByRole('button', { name: /^Player 3\. Draw next turn card$/ })).toBeDefined();
      expect(screen.getByText('(tap the card to draw the next one)')).toBeDefined();
      expect(useGameStore.getState().discardPile).toHaveLength(1);
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
  });

  it('Update Game Options: Cancel discards the changes; Save applies all four and reveals the draw pile', () => {
    useGameStore.setState({
      allowConsecutivePlayer: true,
      drawPile: [
        { id: 'p1', type: 'Player 1', imageFaceUrl: 'url1', isRevealed: false },
        { id: 'n1', type: 'Nemesis', imageFaceUrl: 'url2', isRevealed: false },
      ],
    });
    render(<GameplayScreen />);
    const openOptions = () => {
      fireEvent.click(screen.getByRole('button', { name: 'Special Actions' }));
      fireEvent.click(screen.getByRole('button', { name: 'Update Game Options' }));
      return within(screen.getByRole('heading', { name: 'Update Game Options' }).parentElement!);
    };
    const savedOptions = () => {
      const { playerCount, allowConsecutiveNemesis, allowConsecutivePlayer, visibilityOption } = useGameStore.getState();
      return { playerCount, allowConsecutiveNemesis, allowConsecutivePlayer, visibilityOption };
    };
    const before = savedOptions();

    let dialog = openOptions();
    fireEvent.click(dialog.getByText('All turns'));
    fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
    // Reopening starts from the saved options, so saving at once changes nothing
    dialog = openOptions();
    fireEvent.click(dialog.getByRole('button', { name: 'Save Options' }));
    expect(savedOptions()).toEqual(before);
    expect(screen.getAllByAltText('Card Back')).toHaveLength(2);

    dialog = openOptions();
    fireEvent.click(dialog.getByText('3'));
    fireEvent.click(dialog.getByText('Nemesis'));
    fireEvent.click(dialog.getByText('Same Player'));
    fireEvent.click(dialog.getByText('All turns'));
    fireEvent.click(dialog.getByRole('button', { name: 'Save Options' }));

    expect(savedOptions()).toEqual({
      playerCount: 3,
      allowConsecutiveNemesis: false,
      allowConsecutivePlayer: false,
      visibilityOption: 'all',
    });
    expect(screen.queryByAltText('Card Back')).toBeNull();
    expect(screen.getAllByRole('img').map(img => img.getAttribute('src'))).toEqual(['url1', 'url2']);
  });
});
