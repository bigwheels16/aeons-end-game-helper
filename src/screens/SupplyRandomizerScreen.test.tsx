import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SupplyRandomizerScreen from './SupplyRandomizerScreen';
import { useGameStore } from '../store';

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

describe('SupplyRandomizerScreen', () => {
  beforeEach(() => {
    useGameStore.getState().clearRandomizer();
    useGameStore.getState().setRandomizerExpansions([]);
  });

  it('renders correctly and can add a slot', async () => {
    render(<SupplyRandomizerScreen />);
    
    expect(screen.getByText('Supply Randomizer')).toBeDefined();
    
    const addButton = screen.getByText('+ Add Slot');
    fireEvent.click(addButton);

    await waitFor(() => {
      // "Card Type:" is rendered inside SupplySlot
      expect(screen.getByText('Card Type:')).toBeDefined();
    });

    const slots = useGameStore.getState().randomizerSlots;
    expect(slots.length).toBe(1);
  });

  it('can delete a slot', async () => {
    render(<SupplyRandomizerScreen />);
    
    const addButton = screen.getByText('+ Add Slot');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Card Type:')).toBeDefined();
    });

    const menuButton = screen.getByTitle('Slot Menu');
    fireEvent.click(menuButton);
    const removeButton = screen.getByRole('button', { name: 'Remove' });
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(screen.queryByText('Card Type:')).toBeNull();
    });

    expect(useGameStore.getState().randomizerSlots.length).toBe(0);
  });

  it('updates slot criteria and shows correct match counts with all types selected by default', async () => {
    render(<SupplyRandomizerScreen />);
    
    const addButton = screen.getByText('+ Add Slot');
    fireEvent.click(addButton);

    // Verify 'Any' button is not rendered
    expect(screen.queryByRole('button', { name: 'Any' })).toBeNull();

    await waitFor(() => {
      // Defaults to all card types selected: Gem, Relic, Spell (4 total cards)
      expect(screen.getByText('4 Matching Cards')).toBeDefined();
    });

    // Toggle Gem off -> Relic & Spell remain (2 cards: Staff, Spark)
    const gemButton = screen.getByRole('button', { name: 'Gem' });
    fireEvent.click(gemButton);

    await waitFor(() => {
      expect(screen.getByText('2 Matching Cards')).toBeDefined();
    });

    // Toggle Relic off -> Spell remains (1 card: Spark)
    const relicButton = screen.getByRole('button', { name: 'Relic' });
    fireEvent.click(relicButton);

    await waitFor(() => {
      expect(screen.getByText('1 Matching Cards')).toBeDefined();
    });

    // Toggle Gem back on -> Gem & Spell (3 cards: Jade, Ruby, Spark)
    fireEvent.click(gemButton);

    await waitFor(() => {
      expect(screen.getByText('3 Matching Cards')).toBeDefined();
    });

    const searchInput = screen.getByPlaceholderText('Filter by name or effect...');
    fireEvent.change(searchInput, { target: { value: 'Ruby' } });

    await waitFor(() => {
      // 1 card with 'Ruby'
      expect(screen.getByText('1 Matching Cards')).toBeDefined();
    });
  });

  it('disables randomize button when a slot has 0 matches', async () => {
    render(<SupplyRandomizerScreen />);
    
    const addButton = screen.getByText('+ Add Slot');
    fireEvent.click(addButton);

    const searchInput = screen.getByPlaceholderText('Filter by name or effect...');
    fireEvent.change(searchInput, { target: { value: 'ImpossibleSearchTerm' } });

    await waitFor(() => {
      expect(screen.getByText('0 Matching Cards')).toBeDefined();
    });

    const randomizeButton = screen.getByRole('button', { name: /^Randomize$/i });
    expect(randomizeButton).toHaveProperty('disabled', true);
  });

  it('randomizes and renders assigned cards', async () => {
    render(<SupplyRandomizerScreen />);
    
    const addButton = screen.getByText('+ Add Slot');
    fireEvent.click(addButton);

    // Default slot has all 4 matches
    await waitFor(() => {
      expect(screen.getByText('4 Matching Cards')).toBeDefined();
    });
    
    const searchInput = screen.getByPlaceholderText('Filter by name or effect...');
    fireEvent.change(searchInput, { target: { value: 'Ruby' } });

    await waitFor(() => {
      expect(screen.getByText('1 Matching Cards')).toBeDefined();
    });

    const randomizeButton = screen.getByRole('button', { name: /^Randomize$/i });
    expect(randomizeButton).toHaveProperty('disabled', false);
    
    fireEvent.click(randomizeButton);

    await waitFor(() => {
      // Ruby is assigned
      expect(screen.getByText('Ruby')).toBeDefined();
      expect(screen.getByText('Show Image')).toBeDefined();
    });

    // Check store
    const result = useGameStore.getState().randomizedResult;
    const slots = useGameStore.getState().randomizerSlots;
    expect(result[slots[0].id]).toBeDefined();
    expect(result[slots[0].id].name).toBe('Ruby');
  });

  it('supports slot menu options: Randomize, Edit Criteria, and Remove', async () => {
    render(<SupplyRandomizerScreen />);
    
    const addButton = screen.getByText('+ Add Slot');
    fireEvent.click(addButton);

    // Filter to Gems
    const gemButton = screen.getByRole('button', { name: 'Gem' });
    fireEvent.click(gemButton);

    const randomizeButton = screen.getByRole('button', { name: /^Randomize$/i });
    fireEvent.click(randomizeButton);

    await waitFor(() => {
      expect(screen.getByText('Show Image')).toBeDefined();
    });

    // Open slot menu
    const menuButton = screen.getByTitle('Slot Menu');
    fireEvent.click(menuButton);

    const randomizeButtons = screen.getAllByRole('button', { name: 'Randomize' });
    expect(randomizeButtons.length).toBe(2);
    expect(screen.getByRole('button', { name: 'Edit Criteria' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDefined();

    // Click Edit Criteria
    fireEvent.click(screen.getByRole('button', { name: 'Edit Criteria' }));

    await waitFor(() => {
      expect(screen.getByText('Card Type:')).toBeDefined();
    });

    // Verify that the assignedCard was removed for that slot
    const slotId = useGameStore.getState().randomizerSlots[0].id;
    expect(useGameStore.getState().randomizedResult[slotId]).toBeUndefined();

    // Randomize slot from menu
    fireEvent.click(screen.getByTitle('Slot Menu'));
    const menuRandomizeBtn = screen.getAllByRole('button', { name: 'Randomize' })[1];
    fireEvent.click(menuRandomizeBtn);

    await waitFor(() => {
      expect(screen.getByText('Show Image')).toBeDefined();
    });
    expect(useGameStore.getState().randomizedResult[slotId]).toBeDefined();
  });
});
