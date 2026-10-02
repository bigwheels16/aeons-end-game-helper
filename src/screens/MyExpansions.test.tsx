import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CardSearchScreen from './CardSearchScreen';
import MageSearchScreen from './MageSearchScreen';
import NemesisSearchScreen from './NemesisSearchScreen';
import SupplyRandomizerScreen from './SupplyRandomizerScreen';
import HomeScreen from './HomeScreen';
import { useGameStore } from '../store';

// Expansions: Base (all three datasets), Buried Secrets (supply only), Promo (supply + nemeses),
// War Eternal (mages only) => ALL_EXPANSIONS has 4 entries.
vi.mock('../../data/scraped/aeons_end_all.json', () => ({
  default: {
    supply: [
      { id: 'supply:jade', name: 'Jade', type: 'Gem', expansions: ['Base'], cost: '2', effect: 'Gain 2 aether.' },
      { id: 'supply:shard', name: 'Shard', type: 'Gem', expansions: ['Buried Secrets'], cost: '3', effect: 'Gain 1 aether.' },
      { id: 'supply:spark', name: 'Spark', type: 'Spell', expansions: ['Promo'], cost: '1', effect: 'Deal 1 damage.' },
    ],
    unique_starters: [],
    mages: [
      { id: 'mage:adelheim', name: 'Adelheim', type: 'Mage', expansions: ['Base'], charges: '5', ability_name: 'Aethereal Ward', breaches: [] },
      { id: 'mage:brama', name: 'Brama', type: 'Mage', expansions: ['War Eternal'], charges: '4', ability_name: 'Brink Siphon', breaches: [] },
    ],
    nemeses: [
      { id: 'nemesis:rageborne', name: 'Rageborne', type: 'Nemesis', expansions: ['Base'], health: '70', difficulty: '3' },
      { id: 'nemesis:prince-of-gluttons', name: 'Prince of Gluttons', type: 'Nemesis', expansions: ['Promo'], health: '60', difficulty: '4' },
    ],
  },
}));

const STORAGE_KEY = 'aeons-end-game-storage';

const openPickerFromChip = () => {
  fireEvent.click(screen.getByRole('button', { name: /^Expansions:/ }));
  return screen.getByRole('dialog');
};

describe('Expansions (app-wide setting)', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.setState({
      ownedExpansions: [],
      searchFilters: { cardQuery: '', selectedTypes: [], costRange: [0, 10] },
      mageSearchFilters: { mageQuery: '' },
      nemesisSearchFilters: { nemesisQuery: '', difficultyRange: [1, 10] },
      randomizerSlots: [],
      randomizedResult: {},
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('one selection is shared by every tool screen and the Home chip', async () => {
    const card = render(<CardSearchScreen />);
    expect(screen.getByText('Card Search (3 results)')).toBeDefined();

    const dialog = openPickerFromChip();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Base' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Card Search (1 results)')).toBeDefined();
    card.unmount();

    const mage = render(<MageSearchScreen />);
    expect(screen.getByText('Mage Search (1 results)')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Expansions: 1 of 4 selected, applies to all tools. Edit' })).toBeDefined();
    mage.unmount();

    const nemesis = render(<NemesisSearchScreen />);
    expect(screen.getByText('Nemesis Search (1 results)')).toBeDefined();
    expect(screen.getByText('Rageborne')).toBeDefined();
    expect(screen.queryByText('Prince of Gluttons')).toBeNull();
    nemesis.unmount();

    const randomizer = render(<SupplyRandomizerScreen />);
    fireEvent.click(screen.getByText('+ Add Slot'));
    await waitFor(() => {
      expect(screen.getByText('1 Matching Cards')).toBeDefined();
    });
    randomizer.unmount();

    render(<HomeScreen onSelectTool={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Expansions: 1 of 4 selected, applies to all tools. Edit' })).toBeDefined();
  });

  it('Home uses the same Expansions chip as the tool screens, and its changes apply to the tools', () => {
    const home = render(<HomeScreen onSelectTool={() => undefined} />);
    const chip = screen.getByRole('button', { name: 'Expansions: All, applies to all tools. Edit' });
    expect(chip.getAttribute('aria-haspopup')).toBe('dialog');
    expect(chip.textContent).toBe('Expansionsapplies to all toolsAll ›');

    fireEvent.click(chip);
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Promo' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));

    expect(screen.getByRole('button', { name: 'Expansions: 1 of 4 selected, applies to all tools. Edit' })).toBeDefined();
    home.unmount();

    render(<NemesisSearchScreen />);
    expect(screen.getByText('Nemesis Search (1 results)')).toBeDefined();
    expect(screen.getByText('Prince of Gluttons')).toBeDefined();
  });

  it('Mage Search "Clear All Filters" resets only the query and keeps the Expansions setting', async () => {
    useGameStore.setState({ ownedExpansions: ['War Eternal'] });
    useGameStore.getState().setMageSearchFilters({ mageQuery: 'zzz' });
    render(<MageSearchScreen />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear All Filters' }));

    await waitFor(() => {
      expect(screen.getByText('Brama')).toBeDefined();
    });
    expect(useGameStore.getState().mageSearchFilters).toEqual({ mageQuery: '' });
    expect(useGameStore.getState().ownedExpansions).toEqual(['War Eternal']);
    expect(screen.queryByText('Adelheim')).toBeNull();
  });

  it('Nemesis Search "Clear All Filters" resets query and difficulty and keeps the Expansions setting', async () => {
    useGameStore.setState({ ownedExpansions: ['Promo'] });
    useGameStore.getState().setNemesisSearchFilters({ nemesisQuery: 'zzz', difficultyRange: [8, 10] });
    render(<NemesisSearchScreen />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear All Filters' }));

    await waitFor(() => {
      expect(screen.getByText('Prince of Gluttons')).toBeDefined();
    });
    expect(useGameStore.getState().nemesisSearchFilters).toEqual({ nemesisQuery: '', difficultyRange: [1, 10] });
    expect(useGameStore.getState().ownedExpansions).toEqual(['Promo']);
    expect(screen.queryByText('Rageborne')).toBeNull();
  });

  it.each([
    ['Mage Search', MageSearchScreen, 'Buried Secrets', 'mages'],
    ['Nemesis Search', NemesisSearchScreen, 'Buried Secrets', 'nemeses'],
    ['Card Search', CardSearchScreen, 'War Eternal', 'cards'],
  ] as const)('%s shows an explicit empty state when the Expansions setting has no items', (_name, Screen, owned, noun) => {
    useGameStore.setState({ ownedExpansions: [owned] });
    render(<Screen />);

    expect(screen.getByText(`None of your selected expansions contain ${noun}.`)).toBeDefined();
    expect(screen.getByText(`Selected: ${owned}`)).toBeDefined();
    expect(screen.getByText('(Clearing filters will not change this.)')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Clear all filters' })).toBeNull();
    expect(screen.queryByText(/No matching/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Expansions' }));
    expect(screen.getByRole('dialog')).toBeDefined();
  });

  it('truncates the empty-state expansion list after three names', () => {
    // None of these contain mages
    useGameStore.setState({ ownedExpansions: ['Promo', 'Buried Secrets'] });
    render(<MageSearchScreen />);
    expect(screen.getByText('Selected: Buried Secrets, Promo')).toBeDefined();
  });

  describe('picker', () => {
    it('uses tiles with aria-pressed, Select All / Clear Selection and a live status line', () => {
      render(<CardSearchScreen />);
      const dialog = openPickerFromChip();

      expect(within(dialog).getByText('None selected — showing all expansions')).toBeDefined();
      const tiles = within(dialog).getAllByRole('button', { pressed: false });
      expect(tiles.map(t => t.textContent)).toEqual(['Base', 'Buried Secrets', 'Promo', 'War Eternal']);

      fireEvent.click(within(dialog).getByRole('button', { name: 'Select All (4)' }));
      expect(within(dialog).getByText('4 of 4 selected')).toBeDefined();
      expect(within(dialog).getAllByRole('button', { pressed: true }).length).toBe(4);
      expect(screen.getByRole('button', { name: /^Expansions: 4 of 4 selected/ })).toBeDefined();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Clear Selection' }));
      expect(useGameStore.getState().ownedExpansions).toEqual([]);
      expect(within(dialog).getByText('None selected — showing all expansions')).toBeDefined();
    });

    it('does not autofocus the search box; focus goes to the heading', () => {
      render(<CardSearchScreen />);
      const dialog = openPickerFromChip();
      expect(document.activeElement).toBe(within(dialog).getByRole('heading', { name: 'Expansions' }));
    });

    it('has no corner close button; the only ✕ is the in-search "Clear search" button', () => {
      render(<CardSearchScreen />);
      const dialog = openPickerFromChip();
      expect(within(dialog).queryByRole('button', { name: /close/i })).toBeNull();
      expect(within(dialog).queryByText('✕')).toBeNull();

      fireEvent.change(within(dialog).getByRole('textbox', { name: 'Search expansions' }), { target: { value: 'bur' } });
      const clear = within(dialog).getByRole('button', { name: 'Clear search' });
      expect(within(dialog).getAllByText('✕')).toEqual([clear]);
    });

    it.each([
      ['Escape', () => fireEvent.keyDown(document, { key: 'Escape' })],
      ['backdrop click', () => fireEvent.click(screen.getByRole('dialog'))],
      ['Done button', () => fireEvent.click(screen.getByRole('button', { name: 'Done' }))],
    ])('closing via %s keeps changes', (_how, close) => {
      render(<CardSearchScreen />);
      const dialog = openPickerFromChip();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Promo' }));

      close();

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(useGameStore.getState().ownedExpansions).toEqual(['Promo']);
      expect(screen.getByText('Card Search (1 results)')).toBeDefined();
    });

    it('locks body scroll while open and restores it on close', () => {
      render(<CardSearchScreen />);
      openPickerFromChip();
      expect(document.body.style.overflow).toBe('hidden');
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(document.body.style.overflow).toBe('');
    });

    it('search filters tiles; Select All during a search selects every expansion', () => {
      render(<CardSearchScreen />);
      const dialog = openPickerFromChip();

      fireEvent.change(within(dialog).getByRole('textbox', { name: 'Search expansions' }), { target: { value: 'bur' } });
      expect(within(dialog).getAllByRole('button', { pressed: false }).map(t => t.textContent)).toEqual(['Buried Secrets']);

      fireEvent.click(within(dialog).getByRole('button', { name: 'Select All (4)' }));
      expect(useGameStore.getState().ownedExpansions).toEqual(['Base', 'Buried Secrets', 'Promo', 'War Eternal']);
    });

    it('treats regex metacharacters in the search as plain text', () => {
      render(<CardSearchScreen />);
      const dialog = openPickerFromChip();

      fireEvent.change(within(dialog).getByRole('textbox', { name: 'Search expansions' }), { target: { value: '.*(' } });
      expect(within(dialog).getByText('No matching expansions found')).toBeDefined();
    });

    it('resets the search text when closed and reopened', () => {
      render(<CardSearchScreen />);
      let dialog = openPickerFromChip();
      fireEvent.change(within(dialog).getByRole('textbox', { name: 'Search expansions' }), { target: { value: 'zzz' } });
      expect(within(dialog).getByText('No matching expansions found')).toBeDefined();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));

      dialog = openPickerFromChip();
      expect((within(dialog).getByRole('textbox', { name: 'Search expansions' }) as HTMLInputElement).value).toBe('');
    });
  });

  it('persists the selection and restores it on rehydrate', async () => {
    render(<CardSearchScreen />);
    const dialog = openPickerFromChip();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Base' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Promo' }));

    const saved = localStorage.getItem(STORAGE_KEY);
    expect(saved).not.toBeNull();
    expect(JSON.parse(saved as string).state.ownedExpansions).toEqual(['Base', 'Promo']);

    // The screen is still mounted, so store updates must go through act()
    act(() => {
      useGameStore.setState({ ownedExpansions: [] });
    });
    expect(screen.getByText('Card Search (3 results)')).toBeDefined();
    localStorage.setItem(STORAGE_KEY, saved as string);
    await act(async () => {
      await useGameStore.persist.rehydrate();
    });

    expect(useGameStore.getState().ownedExpansions).toEqual(['Base', 'Promo']);
    expect(screen.getByText('Card Search (2 results)')).toBeDefined();
  });

  it('ignores malicious persisted names: renders "All", injects nothing, no prototype pollution', async () => {
    const protoKeysBefore = Object.getOwnPropertyNames(Object.prototype).sort();
    const payload = {
      state: {
        playerCount: 1,
        allowConsecutiveNemesis: true,
        visibilityOption: 'current',
        isPlaying: false,
        drawPile: [],
        discardPile: [],
        roundNumber: 0,
        ownedExpansions: ['<img src=x onerror=alert(1)>', '__proto__', 'constructor'],
      },
      version: 0,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    await useGameStore.persist.rehydrate();

    const { container } = render(<CardSearchScreen />);

    expect(screen.getByText('Card Search (3 results)')).toBeDefined();
    const chip = screen.getByRole('button', { name: 'Expansions: All, applies to all tools. Edit' });
    expect(within(chip).getByText('All ›')).toBeDefined();
    expect(container.querySelector('img[src="x"]')).toBeNull();
    expect(container.innerHTML).not.toContain('onerror');
    expect(container.innerHTML).not.toContain('__proto__');

    const dialog = openPickerFromChip();
    expect(within(dialog).getAllByRole('button', { pressed: false }).map(t => t.textContent))
      .toEqual(['Base', 'Buried Secrets', 'Promo', 'War Eternal']);
    expect(document.body.innerHTML).not.toContain('onerror');

    expect(Object.getOwnPropertyNames(Object.prototype).sort()).toEqual(protoKeysBefore);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
