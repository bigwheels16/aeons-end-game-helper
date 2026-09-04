import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
    useGameStore.getState().setSearchFilters({
      cardQuery: '',
      selectedExpansions: [],
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

  it('filters by expansion', async () => {
    render(<CardSearchScreen />);
    
    // Open the expansions dropdown
    const dropdownTrigger = screen.getByRole('button', { name: /Expansions/i });
    fireEvent.click(dropdownTrigger);

    // Select Promo expansion checkbox
    const promoOption = screen.getByLabelText('Promo');
    fireEvent.click(promoOption);

    await waitFor(() => {
      expect(screen.queryByText('Jade')).toBeNull();
    });
    
    expect(screen.getByText('Spark')).toBeDefined();
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

