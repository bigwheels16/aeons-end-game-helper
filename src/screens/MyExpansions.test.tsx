import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CardSearchScreen from './CardSearchScreen';
import MageSearchScreen from './MageSearchScreen';
import NemesisSearchScreen from './NemesisSearchScreen';
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

const openPickerFromChip = () => {
  fireEvent.click(screen.getByRole('button', { name: /^Expansions:/ }));
  return screen.getByRole('dialog');
};

describe('Expansions (app-wide setting)', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.setState({
      ownedExpansions: [],
      expansionProfiles: [],
      activeProfileIds: [],
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
    // The picker stays open when a pick replaces the empty state with results
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Base' }));
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.queryByText(`None of your selected expansions contain ${noun}.`)).toBeNull();
  });

  it('the "Searching within" note opens the picker, which stays open when a pick brings back results', () => {
    useGameStore.setState({ ownedExpansions: ['Base'], mageSearchFilters: { mageQuery: 'brama' } });
    render(<MageSearchScreen />);
    expect(screen.getByText('No matching mages found.')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'War Eternal' }));

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Brama')).toBeDefined();
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

    it('search filters tiles; Select All during a search selects every expansion', () => {
      render(<CardSearchScreen />);
      const dialog = openPickerFromChip();

      fireEvent.change(within(dialog).getByRole('textbox', { name: 'Search expansions' }), { target: { value: 'bur' } });
      expect(within(dialog).getAllByRole('button', { pressed: false }).map(t => t.textContent)).toEqual(['Buried Secrets']);

      fireEvent.click(within(dialog).getByRole('button', { name: 'Select All (4)' }));
      expect(useGameStore.getState().ownedExpansions).toEqual(['Base', 'Buried Secrets', 'Promo', 'War Eternal']);
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

  describe('profiles', () => {
    const profileNames = (dialog: HTMLElement) =>
      within(dialog).queryAllByRole('button', { name: /^Edit profile / }).map((b) => b.getAttribute('aria-label'));

    it('New Profile starts from the current selection and saves a named profile', () => {
      useGameStore.setState({ ownedExpansions: ['Promo'] });
      render(<CardSearchScreen />);
      const dialog = openPickerFromChip();

      fireEvent.click(within(dialog).getByRole('button', { name: '+ New Profile' }));
      expect(within(dialog).getByRole('heading', { name: 'New Profile' })).toBeDefined();
      expect(within(dialog).getByRole('button', { name: 'Promo', pressed: true })).toBeDefined();
      expect(within(dialog).queryByRole('button', { name: 'Delete' })).toBeNull();

      fireEvent.change(within(dialog).getByRole('textbox', { name: 'Profile name' }), { target: { value: '  Mine  ' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Base' }));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

      expect(within(dialog).getByRole('heading', { name: 'Expansions' })).toBeDefined();
      expect(profileNames(dialog)).toEqual(['Edit profile Mine']);
      expect(useGameStore.getState().expansionProfiles).toEqual([
        { id: expect.any(String), name: 'Mine', expansions: ['Base', 'Promo'] },
      ]);
      // Saving does not change the selection or turn the profile on
      expect(useGameStore.getState().ownedExpansions).toEqual(['Promo']);
      expect(within(dialog).getByRole('button', { name: 'Mine', pressed: false })).toBeDefined();
    });

    it('Save needs a name and at least one expansion', () => {
      render(<CardSearchScreen />);
      const dialog = openPickerFromChip();
      fireEvent.click(within(dialog).getByRole('button', { name: '+ New Profile' }));

      const save = within(dialog).getByRole('button', { name: 'Save' }) as HTMLButtonElement;
      expect(within(dialog).getByText('Pick at least one expansion')).toBeDefined();
      fireEvent.change(within(dialog).getByRole('textbox', { name: 'Profile name' }), { target: { value: 'Mine' } });
      expect(save.disabled).toBe(true);

      fireEvent.click(within(dialog).getByRole('button', { name: 'Base' }));
      expect(within(dialog).getByText('1 of 4 selected')).toBeDefined();
      expect(save.disabled).toBe(false);

      fireEvent.change(within(dialog).getByRole('textbox', { name: 'Profile name' }), { target: { value: '   ' } });
      expect(save.disabled).toBe(true);
    });

    it('active profiles select the union of their expansions; tapping a tile turns them off', () => {
      useGameStore.setState({
        expansionProfiles: [
          { id: 'p-mine', name: 'Mine', expansions: ['Base', 'Promo'] },
          { id: 'p-alex', name: 'Alex', expansions: ['Promo', 'War Eternal'] },
        ],
      });
      render(<MageSearchScreen />);
      const dialog = openPickerFromChip();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Mine' }));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Alex' }));

      expect(within(dialog).getByText('3 of 4 selected')).toBeDefined();
      expect(within(dialog).getAllByRole('button', { name: /^(Mine|Alex)$/, pressed: true }).length).toBe(2);
      expect(screen.getByRole('button', {
        name: 'Expansions: 3 of 4 selected from profiles Mine, Alex, applies to all tools. Edit',
      })).toBeDefined();
      expect(screen.getByText('Mine + Alex')).toBeDefined();
      expect(screen.getByText('Mage Search (2 results)')).toBeDefined();

      fireEvent.click(within(dialog).getByRole('button', { name: 'War Eternal' }));

      expect(useGameStore.getState().ownedExpansions).toEqual(['Base', 'Promo']);
      expect(within(dialog).queryAllByRole('button', { name: /^(Mine|Alex)$/, pressed: true })).toEqual([]);
      expect(screen.queryByText('Mine + Alex')).toBeNull();
    });

    it('editing a profile updates it; Delete needs a second tap', () => {
      useGameStore.setState({
        expansionProfiles: [
          { id: 'p-mine', name: 'Mine', expansions: ['Base'] },
          { id: 'p-alex', name: 'Alex', expansions: ['Promo'] },
        ],
        activeProfileIds: ['p-mine'],
        ownedExpansions: ['Base'],
      });
      render(<CardSearchScreen />);
      const dialog = openPickerFromChip();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Edit profile Mine' }));
      expect(within(dialog).getByRole('heading', { name: 'Edit Profile' })).toBeDefined();
      expect((within(dialog).getByRole('textbox', { name: 'Profile name' }) as HTMLInputElement).value).toBe('Mine');
      fireEvent.change(within(dialog).getByRole('textbox', { name: 'Profile name' }), { target: { value: 'Me' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Buried Secrets' }));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

      // The active profile's new expansions apply right away
      expect(useGameStore.getState().ownedExpansions).toEqual(['Base', 'Buried Secrets']);
      expect(profileNames(dialog)).toEqual(['Edit profile Me', 'Edit profile Alex']);

      fireEvent.click(within(dialog).getByRole('button', { name: 'Edit profile Alex' }));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm Delete' }));

      expect(profileNames(dialog)).toEqual(['Edit profile Me']);
      expect(useGameStore.getState().expansionProfiles.map((p) => p.name)).toEqual(['Me']);
    });

    it.each([
      ['Escape', () => fireEvent.keyDown(document, { key: 'Escape' })],
      ['backdrop click', () => fireEvent.click(screen.getByRole('dialog'))],
      ['Cancel button', () => fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))],
    ])('%s in the profile editor discards the draft and returns to the selection', (_how, cancel) => {
      useGameStore.setState({ expansionProfiles: [{ id: 'p-mine', name: 'Mine', expansions: ['Base'] }] });
      render(<CardSearchScreen />);
      const dialog = openPickerFromChip();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Edit profile Mine' }));
      fireEvent.change(within(dialog).getByRole('textbox', { name: 'Profile name' }), { target: { value: 'Changed' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Promo' }));

      cancel();

      expect(screen.getByRole('dialog')).toBeDefined();
      expect(within(dialog).getByRole('heading', { name: 'Expansions' })).toBeDefined();
      expect(document.activeElement).toBe(within(dialog).getByRole('heading', { name: 'Expansions' }));
      expect(useGameStore.getState().expansionProfiles).toEqual([{ id: 'p-mine', name: 'Mine', expansions: ['Base'] }]);
    });
  });
});
