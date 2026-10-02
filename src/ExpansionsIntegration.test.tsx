import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import toast from 'react-hot-toast';
import App from './App';
import CardSearchScreen from './screens/CardSearchScreen';
import MageSearchScreen from './screens/MageSearchScreen';
import NemesisSearchScreen from './screens/NemesisSearchScreen';
import SupplyRandomizerScreen from './screens/SupplyRandomizerScreen';
import HomeScreen from './screens/HomeScreen';
import { useGameStore } from './store';

// Expansions: Base (all three datasets), Buried Secrets (supply only), Promo (supply + nemeses),
// War Eternal (mages only) => ALL_EXPANSIONS has 4 entries. Base has two supply cards so the
// randomizer can re-roll within it.
vi.mock('../data/scraped/aeons_end_all.json', () => ({
  default: {
    supply: [
      { id: 'Jade', name: 'Jade', type: 'Gem', expansions: ['Base'], cost: '2', effect: 'Gain 2 aether.' },
      { id: 'Ruby', name: 'Ruby', type: 'Gem', expansions: ['Base'], cost: '4', effect: 'Gain 3 aether.' },
      { id: 'Shard', name: 'Shard', type: 'Gem', expansions: ['Buried Secrets'], cost: '3', effect: 'Gain 1 aether.' },
      { id: 'Spark', name: 'Spark', type: 'Spell', expansions: ['Promo'], cost: '1', effect: 'Deal 1 damage.' },
    ],
    unique_starters: [],
    mages: [
      { name: 'Adelheim', type: 'Mage', expansions: ['Base'], charges: '5', ability_name: 'Aethereal Ward', breaches: [] },
      { name: 'Brama', type: 'Mage', expansions: ['War Eternal'], charges: '4', ability_name: 'Brink Siphon', breaches: [] },
    ],
    nemeses: [
      { name: 'Rageborne', type: 'Nemesis', expansions: ['Base'], health: '70', difficulty: '3' },
      { name: 'Prince of Gluttons', type: 'Nemesis', expansions: ['Promo'], health: '60', difficulty: '4' },
    ],
  },
}));

const STORAGE_KEY = 'aeons-end-game-storage';

const persistedOwned = (): unknown => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) throw new Error('Nothing persisted');
  return JSON.parse(raw).state.ownedExpansions;
};

const toggleInPicker = (names: string[]) => {
  fireEvent.click(screen.getByRole('button', { name: /^Expansions:/ }));
  const dialog = screen.getByRole('dialog');
  for (const name of names) fireEvent.click(within(dialog).getByRole('button', { name }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
};

/** A minimal valid persisted payload (as written by an older build), plus overrides. */
const basePersistedState = (overrides: Record<string, unknown> = {}) => ({
  playerCount: 2,
  customDeck: [],
  allowConsecutiveNemesis: false,
  allowConsecutivePlayer: true,
  visibilityOption: 'current',
  isPlaying: true,
  drawPile: [
    { id: 'p1', type: 'Player 1', imageFaceUrl: 'p1.png', isRevealed: false },
    { id: 'n1', type: 'Nemesis', imageFaceUrl: 'n1.png', isRevealed: false },
  ],
  discardPile: [{ id: 'p2', type: 'Player 2', imageFaceUrl: 'p2.png', isRevealed: true }],
  roundNumber: 2,
  turnHistory: [],
  favorites: { supply: ['Shard'], mages: ['Brama'], nemeses: ['Prince of Gluttons'] },
  randomizerSlots: [{ id: 'slot-legacy', cardTypes: ['Gem'], costRange: [0, 10], searchTerm: '' }],
  randomizedResult: {},
  ...overrides,
});

/**
 * Simulates a full page reload: drops every cached module so the store is created again and
 * hydrates from localStorage exactly as it would on a fresh page load.
 */
const reloadApp = async () => {
  vi.resetModules();
  const storeModule = await import('./store');
  const appModule = await import('./App');
  return { useGameStore: storeModule.useGameStore, App: appModule.default };
};

describe('Expansions setting: app-wide integration', () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '';
    useGameStore.setState({
      ownedExpansions: [],
      isPlaying: false,
      favorites: { supply: [], mages: [], nemeses: [] },
      searchFilters: { cardQuery: '', selectedTypes: [], costRange: [0, 10] },
      mageSearchFilters: { mageQuery: '' },
      nemesisSearchFilters: { nemesisQuery: '', difficultyRange: [1, 10] },
      randomizerSlots: [],
      randomizedResult: {},
    });
  });

  afterEach(() => {
    // Randomizer success toasts live in a module-level store; drop them so a later <App />
    // (whose <Toaster> would render them) starts clean.
    act(() => {
      toast.remove();
    });
    vi.restoreAllMocks();
    localStorage.clear();
    window.location.hash = '';
  });

  it('a selection made on Home applies across every tool when navigating through the App', () => {
    render(<App />);
    toggleInPicker(['Base']);

    fireEvent.click(screen.getByText('Supply Card Search'));
    expect(screen.getByText('Card Search (2 results)')).toBeDefined();

    // Change it again from inside Card Search; the next tool sees the new value
    toggleInPicker(['Promo']);
    expect(screen.getByText('Card Search (3 results)')).toBeDefined();
    fireEvent.click(screen.getByText('← Back to Tools'));
    expect(screen.getByRole('button', { name: 'Expansions: 2 of 4 selected, applies to all tools. Edit' })).toBeDefined();

    fireEvent.click(screen.getByText('Mage Search'));
    expect(screen.getByText('Mage Search (1 results)')).toBeDefined();
    expect(screen.getByText('Adelheim')).toBeDefined();
    fireEvent.click(screen.getByText('← Back to Tools'));

    fireEvent.click(screen.getByText('Nemesis Search'));
    expect(screen.getByText('Nemesis Search (2 results)')).toBeDefined();
    fireEvent.click(screen.getByText('← Back to Tools'));

    fireEvent.click(screen.getByText('Supply Randomizer'));
    expect(screen.getByRole('button', { name: 'Expansions: 2 of 4 selected, applies to all tools. Edit' })).toBeDefined();
    fireEvent.click(screen.getByText('+ Add Slot'));
    expect(screen.getByText('3 Matching Cards')).toBeDefined();
  });

  it('changes propagate immediately to other mounted screens without a remount', () => {
    render(
      <>
        <HomeScreen onSelectTool={() => undefined} />
        <MageSearchScreen />
        <NemesisSearchScreen />
      </>
    );
    expect(screen.getByText('Mage Search (2 results)')).toBeDefined();
    expect(screen.getByText('Nemesis Search (2 results)')).toBeDefined();

    // Open the picker from the Home chip (the first of the three identical chips)
    fireEvent.click(screen.getAllByRole('button', { name: /^Expansions:/ })[0]);
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'War Eternal' }));

    // Not debounced: the other screens update in the same tick
    expect(screen.getByText('Mage Search (1 results)')).toBeDefined();
    expect(screen.getByText('Brama')).toBeDefined();
    expect(screen.getByText('Nemesis Search (0 results)')).toBeDefined();
    expect(screen.getByText('None of your selected expansions contain nemeses.')).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Expansions: 1 of 4 selected, applies to all tools. Edit' }).length).toBe(3);
  });

  describe('every Clear button leaves the setting intact (state and storage)', () => {
    const OWNED = ['Base', 'Promo'];

    it.each([
      [
        'Card Search "Clear All Filters"',
        () => {
          useGameStore.getState().setSearchFilters({ cardQuery: 'jade', selectedTypes: ['Gem'], costRange: [2, 2] });
          render(<CardSearchScreen />);
          fireEvent.click(screen.getByRole('button', { name: 'Clear All Filters' }));
          expect(useGameStore.getState().searchFilters).toEqual({ cardQuery: '', selectedTypes: [], costRange: [0, 10] });
        },
      ],
      [
        'Card Search empty-state "Clear all filters"',
        async () => {
          useGameStore.getState().setSearchFilters({ cardQuery: 'zzz' });
          render(<CardSearchScreen />);
          fireEvent.click(await screen.findByRole('button', { name: 'Clear all filters' }));
          expect(useGameStore.getState().searchFilters.cardQuery).toBe('');
        },
      ],
      [
        'Mage Search "Clear All Filters"',
        () => {
          useGameStore.getState().setMageSearchFilters({ mageQuery: 'zzz' });
          render(<MageSearchScreen />);
          fireEvent.click(screen.getByRole('button', { name: 'Clear All Filters' }));
          expect(useGameStore.getState().mageSearchFilters).toEqual({ mageQuery: '' });
        },
      ],
      [
        'Nemesis Search "Clear All Filters"',
        () => {
          useGameStore.getState().setNemesisSearchFilters({ nemesisQuery: 'zzz', difficultyRange: [9, 10] });
          render(<NemesisSearchScreen />);
          fireEvent.click(screen.getByRole('button', { name: 'Clear All Filters' }));
          expect(useGameStore.getState().nemesisSearchFilters).toEqual({ nemesisQuery: '', difficultyRange: [1, 10] });
        },
      ],
      [
        'Supply Randomizer "Clear All"',
        () => {
          render(<SupplyRandomizerScreen />);
          fireEvent.click(screen.getByText('+ Add Slot'));
          fireEvent.click(screen.getByRole('button', { name: 'Clear All' }));
          expect(useGameStore.getState().randomizerSlots).toEqual([]);
        },
      ],
    ] as const)('%s', async (_name, clickClear) => {
      useGameStore.getState().setOwnedExpansions(OWNED);
      expect(persistedOwned()).toEqual(OWNED);

      await clickClear();

      expect(useGameStore.getState().ownedExpansions).toEqual(OWNED);
      expect(persistedOwned()).toEqual(OWNED);
      expect(screen.getByRole('button', { name: 'Expansions: 2 of 4 selected, applies to all tools. Edit' })).toBeDefined();
    });
  });

  it('Supply Randomizer: earlier results stay as a snapshot; re-rolls use the new setting', async () => {
    useGameStore.setState({ ownedExpansions: ['Base'] });
    render(<SupplyRandomizerScreen />);
    fireEvent.click(screen.getByText('+ Add Slot'));
    fireEvent.click(screen.getByRole('button', { name: /^Randomize$/i }));

    const slotId = useGameStore.getState().randomizerSlots[0].id;
    await waitFor(() => {
      expect(useGameStore.getState().randomizedResult[slotId]).toBeDefined();
    });
    const first = useGameStore.getState().randomizedResult[slotId].name;
    expect(['Jade', 'Ruby']).toContain(first);

    // Switch ownership from Base to Promo via the picker on this screen
    toggleInPicker(['Base', 'Promo']);
    expect(useGameStore.getState().ownedExpansions).toEqual(['Promo']);
    // Existing result is not re-filtered
    expect(useGameStore.getState().randomizedResult[slotId].name).toBe(first);

    // Single-slot re-roll now draws from the Promo pool only
    fireEvent.click(screen.getByTitle('Slot Menu'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Randomize' })[1]);
    expect(useGameStore.getState().randomizedResult[slotId].name).toBe('Spark');

    // Full randomize also respects it
    fireEvent.click(screen.getByRole('button', { name: /^Randomize$/i }));
    await waitFor(() => {
      expect(useGameStore.getState().randomizedResult[slotId].name).toBe('Spark');
    });
  });

  it('Favorites in the App is not filtered by the setting', () => {
    useGameStore.setState({
      ownedExpansions: ['War Eternal'],
      favorites: { supply: ['Jade', 'Spark'], mages: ['Adelheim'], nemeses: ['Prince of Gluttons'] },
    });
    render(<App />);
    fireEvent.click(screen.getByText('Favorites'));

    expect(screen.getByText('Favorites (4)')).toBeDefined();
    for (const name of ['Jade', 'Spark', 'Adelheim', 'Prince of Gluttons']) {
      expect(screen.getByText(name)).toBeDefined();
    }
  });

  describe('simulated page reload (fresh store module)', () => {
    it('first-ever visit (no stored state) starts at "All" and hides nothing', async () => {
      const fresh = await reloadApp();
      expect(fresh.useGameStore.getState().ownedExpansions).toEqual([]);

      render(<fresh.App />);
      expect(screen.getByRole('button', { name: 'Expansions: All, applies to all tools. Edit' })).toBeDefined();
      fireEvent.click(screen.getByText('Supply Card Search'));
      expect(screen.getByText('Card Search (4 results)')).toBeDefined();
    });

    it('a selection persists across a reload and is applied before the first render', async () => {
      const before = render(<App />);
      toggleInPicker(['Promo']);
      expect(persistedOwned()).toEqual(['Promo']);
      before.unmount();
      const saved = localStorage.getItem(STORAGE_KEY);

      const fresh = await reloadApp();
      // Hydrated synchronously at store creation, before any component renders (no flash)
      expect(fresh.useGameStore.persist.hasHydrated()).toBe(true);
      expect(fresh.useGameStore.getState().ownedExpansions).toEqual(['Promo']);
      expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);

      window.location.hash = 'nemesis-search';
      const { unmount } = render(<fresh.App />);
      expect(screen.getByText('Nemesis Search (1 results)')).toBeDefined();
      expect(screen.getByText('Prince of Gluttons')).toBeDefined();
      expect(screen.queryByText('Rageborne')).toBeNull();
      unmount();
    });

    it('a legacy payload migrates to "All" and keeps favorites, the game and slots, across two reloads', async () => {
      const errorSpy = vi.spyOn(console, 'error');
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        state: basePersistedState({
          searchFilters: { cardQuery: '', selectedExpansions: ['Base'], selectedTypes: [], costRange: [0, 10] },
          mageSearchFilters: { mageQuery: '', selectedMageExpansions: ['Base'] },
          nemesisSearchFilters: { nemesisQuery: '', selectedNemesisExpansions: ['Base'], difficultyRange: [1, 10] },
          randomizerExpansions: ['Base', 'Promo'],
        }),
        version: 0,
      }));

      let fresh = await reloadApp();
      let state = fresh.useGameStore.getState();
      expect(errorSpy).not.toHaveBeenCalled();
      expect(state.ownedExpansions).toEqual([]);
      expect(state.favorites).toEqual({ supply: ['Shard'], mages: ['Brama'], nemeses: ['Prince of Gluttons'] });
      expect(state.isPlaying).toBe(true);
      expect(state.roundNumber).toBe(2);
      expect(state.drawPile.map(c => c.id)).toEqual(['p1', 'n1']);
      expect(state.randomizerSlots).toEqual([{ id: 'slot-legacy', cardTypes: ['Gem'], costRange: [0, 10], searchTerm: '' }]);

      window.location.hash = 'card-search';
      const first = render(<fresh.App />);
      expect(screen.getByText('Card Search (4 results)')).toBeDefined();
      // Choosing expansions after the upgrade is saved and survives the next reload
      toggleInPicker(['Buried Secrets']);
      expect(screen.getByText('Card Search (1 results)')).toBeDefined();
      first.unmount();

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) as string).state;
      expect(stored).not.toHaveProperty('randomizerExpansions');
      expect(stored.searchFilters).not.toHaveProperty('selectedExpansions');

      fresh = await reloadApp();
      state = fresh.useGameStore.getState();
      expect(state.ownedExpansions).toEqual(['Buried Secrets']);
      expect(state.favorites.supply).toEqual(['Shard']);
      expect(state.isPlaying).toBe(true);
      expect(state.randomizerSlots.length).toBe(1);

      window.location.hash = 'favorites';
      render(<fresh.App />);
      // Favorites stays unfiltered after the reload
      expect(screen.getByText('Favorites (3)')).toBeDefined();
      expect(screen.getByText('Brama')).toBeDefined();
      expect(screen.getByText('Prince of Gluttons')).toBeDefined();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('stale persisted names are ignored after a reload and not counted', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        state: basePersistedState({ isPlaying: false, ownedExpansions: ['Renamed Expansion', 'War Eternal'] }),
        version: 0,
      }));

      const fresh = await reloadApp();
      window.location.hash = 'mage-search';
      render(<fresh.App />);

      expect(screen.getByRole('button', { name: 'Expansions: 1 of 4 selected, applies to all tools. Edit' })).toBeDefined();
      expect(screen.getByText('Mage Search (1 results)')).toBeDefined();
      expect(screen.queryByText(/Renamed Expansion/)).toBeNull();
    });
  });

  it('the setting is not changed by navigating between tools', async () => {
    useGameStore.getState().setOwnedExpansions(['Promo']);
    render(<App />);
    for (const tool of ['Supply Card Search', 'Mage Search', 'Nemesis Search', 'Supply Randomizer', 'Favorites']) {
      fireEvent.click(screen.getByText(tool));
      fireEvent.click(screen.getByText('← Back to Tools'));
    }
    await act(async () => undefined);
    expect(useGameStore.getState().ownedExpansions).toEqual(['Promo']);
    expect(persistedOwned()).toEqual(['Promo']);
  });
});
