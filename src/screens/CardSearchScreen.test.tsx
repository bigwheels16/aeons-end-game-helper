import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CardSearchScreen from './CardSearchScreen';
import { useGameStore } from '../store';

// Mock the scraped data to keep the test predictable and fast
vi.mock('../../data/scraped/aeons_end_all.json', () => ({
  default: {
    supply: [
      {
        id: 'Jade',
        name: 'Jade',
        type: 'Gem',
        expansions: ['Base'],
        cost: '2',
        effect: 'Gain 2 aether.'
      },
      {
        id: 'Ruby',
        name: 'Ruby',
        type: 'Gem',
        expansions: ['Base'],
        cost: '4',
        effect: 'Gain 3 aether.'
      },
      {
        id: 'Spark',
        name: 'Spark',
        type: 'Spell',
        expansions: ['Promo'],
        cost: '1',
        effect: 'Deal 1 damage.'
      },
      {
        id: 'Staff',
        name: 'Staff',
        type: 'Relic',
        expansions: ['ExpansionX'],
        cost: '5',
        effect: 'Gain 1 charge.'
      }
    ]
  }
}));

describe('CardSearchScreen', () => {
  beforeEach(() => {
    useGameStore.setState({ ownedExpansions: [] });
    useGameStore.getState().setSearchFilters({
      cardQuery: '',
      selectedTypes: [],
      costRange: [0, 10]
    });
  });

  it('renders all cards initially', () => {
    render(<CardSearchScreen />);
    
    expect(screen.getByText('Jade')).toBeDefined();
    expect(screen.getByText('Ruby')).toBeDefined();
    expect(screen.getByText('Spark')).toBeDefined();
    expect(screen.getByText('Staff')).toBeDefined();
  });

  it('filters by name', async () => {
    render(<CardSearchScreen />);
    
    const searchInput = screen.getByPlaceholderText('Search cards, effects...');
    fireEvent.change(searchInput, { target: { value: 'Ja' } });

    // Wait for debounce
    await waitFor(() => {
      expect(screen.queryByText('Ruby')).toBeNull();
    });
    
    expect(screen.getByText('Jade')).toBeDefined();
  });

  it('filters by effect', async () => {
    render(<CardSearchScreen />);
    
    const searchInput = screen.getByPlaceholderText('Search cards, effects...');
    fireEvent.change(searchInput, { target: { value: 'damage' } });

    await waitFor(() => {
      expect(screen.queryByText('Jade')).toBeNull();
    });
    
    expect(screen.getByText('Spark')).toBeDefined();
  });

  it('filters by the Expansions setting via the shared chip', () => {
    render(<CardSearchScreen />);

    fireEvent.click(screen.getByRole('button', { name: /^Expansions: All,/ }));
    const dialog = screen.getByRole('dialog');
    const promoTile = within(dialog).getByRole('button', { name: 'Promo' });
    expect(promoTile.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(promoTile);

    // Applies immediately (no debounce, no save step)
    expect(promoTile.getAttribute('aria-pressed')).toBe('true');
    expect(useGameStore.getState().ownedExpansions).toEqual(['Promo']);
    expect(screen.queryByText('Jade')).toBeNull();
    expect(screen.getByText('Spark')).toBeDefined();
    expect(screen.getByText('Card Search (1 results)')).toBeDefined();
    expect(screen.getByRole('button', { name: /^Expansions: 1 of 3 selected/ })).toBeDefined();
  });

  it('filters by card type', async () => {
    render(<CardSearchScreen />);
    
    const typeButton = screen.getByRole('button', { name: 'Relic' });
    fireEvent.click(typeButton);

    await waitFor(() => {
      expect(screen.queryByText('Jade')).toBeNull();
      expect(screen.queryByText('Spark')).toBeNull();
    });
    
    expect(screen.getByText('Staff')).toBeDefined();
  });

  it('"Clear All Filters" resets search filters but keeps the Expansions setting', async () => {
    useGameStore.setState({ ownedExpansions: ['Base', 'ExpansionX'] });
    render(<CardSearchScreen />);

    fireEvent.click(screen.getByRole('button', { name: 'Relic' }));
    fireEvent.change(screen.getByPlaceholderText('Search cards, effects...'), { target: { value: 'charge' } });
    await waitFor(() => {
      expect(screen.queryByText('Jade')).toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Clear All Filters' }));

    await waitFor(() => {
      expect(screen.getByText('Jade')).toBeDefined();
    });
    const state = useGameStore.getState();
    expect(state.searchFilters).toEqual({ cardQuery: '', selectedTypes: [], costRange: [0, 10] });
    expect(state.ownedExpansions).toEqual(['Base', 'ExpansionX']);
    // Promo is still excluded by the Expansions setting
    expect(screen.queryByText('Spark')).toBeNull();
    expect(screen.getByText('Card Search (3 results)')).toBeDefined();
  });

  it('empty-state "Clear all filters" keeps the Expansions setting and notes the restriction', async () => {
    useGameStore.setState({ ownedExpansions: ['Base'] });
    render(<CardSearchScreen />);

    fireEvent.change(screen.getByPlaceholderText('Search cards, effects...'), { target: { value: 'nothing-matches-this' } });
    await waitFor(() => {
      expect(screen.getByText('No matching cards found.')).toBeDefined();
    });
    expect(screen.getByText(/Searching within selected expansions \(1 of 3\)/)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Clear all filters' }));

    await waitFor(() => {
      expect(screen.getByText('Jade')).toBeDefined();
    });
    expect(useGameStore.getState().ownedExpansions).toEqual(['Base']);
    expect(screen.queryByText('Spark')).toBeNull();
  });

  it('treats unknown persisted expansion names as "All"', () => {
    useGameStore.setState({ ownedExpansions: ['Gone'] });
    render(<CardSearchScreen />);

    expect(screen.getByText('Card Search (4 results)')).toBeDefined();
    const chip = screen.getByRole('button', { name: /^Expansions: All,/ });
    expect(within(chip).getByText('All ›')).toBeDefined();
    expect(screen.queryByText(/Gone/)).toBeNull();
  });

  it('clears all filters', async () => {
    render(<CardSearchScreen />);
    
    const typeButton = screen.getByRole('button', { name: 'Relic' });
    fireEvent.click(typeButton);

    await waitFor(() => {
      expect(screen.queryByText('Jade')).toBeNull();
    });
    
    const clearButton = screen.getAllByText(/Clear All Filters/i)[0];
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(screen.getByText('Jade')).toBeDefined();
      expect(screen.getByText('Staff')).toBeDefined();
    });
  });
});

