import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGameStore } from './store';
import { generateDeck } from './deckEngine';
import { ALL_EXPANSIONS } from './utils/expansions';

const STORAGE_KEY = 'aeons-end-game-storage';

describe('useGameStore custom actions', () => {
  beforeEach(() => {
    useGameStore.setState({
      playerCount: 1,
      allowConsecutiveNemesis: false,
      allowConsecutivePlayer: true,
      visibilityOption: 'current',
      isPlaying: false,
      drawPile: [],
      discardPile: [],
      roundNumber: 0,
      ownedExpansions: [],
    });
  });

  it('should move a card from draw to discard', () => {
    const deck = generateDeck(1); // 5 cards
    useGameStore.setState({ drawPile: deck, discardPile: [] });
    
    const cardId = deck[0].id;
    useGameStore.getState().moveCard('draw', cardId, 'discard', 'top'); // position shouldn't matter much for discard
    
    const state = useGameStore.getState();
    expect(state.drawPile.length).toBe(4);
    expect(state.discardPile.length).toBe(1);
    expect(state.discardPile[0].id).toBe(cardId);
  });

  it('should move a card from discard to draw top', () => {
    const deck = generateDeck(1);
    const card = deck[0];
    useGameStore.setState({ drawPile: [], discardPile: [card] });
    
    useGameStore.getState().moveCard('discard', card.id, 'draw', 'top');
    
    const state = useGameStore.getState();
    expect(state.discardPile.length).toBe(0);
    expect(state.drawPile.length).toBe(1);
    expect(state.drawPile[0].id).toBe(card.id);
  });

  it('should move a card from discard to draw bottom', () => {
    const deck = generateDeck(1);
    const topCard = deck[1];
    const cardToMove = deck[0];
    useGameStore.setState({ drawPile: [topCard], discardPile: [cardToMove] });
    
    useGameStore.getState().moveCard('discard', cardToMove.id, 'draw', 'bottom');
    
    const state = useGameStore.getState();
    expect(state.discardPile.length).toBe(0);
    expect(state.drawPile.length).toBe(2);
    expect(state.drawPile[1].id).toBe(cardToMove.id);
  });

  it('should move a card to draw and shuffle', () => {
    const deck = generateDeck(1);
    const cardToMove = deck[0];
    useGameStore.setState({ drawPile: deck.slice(1), discardPile: [cardToMove] });
    
    useGameStore.getState().moveCard('discard', cardToMove.id, 'draw', 'shuffled');
    
    const state = useGameStore.getState();
    expect(state.discardPile.length).toBe(0);
    expect(state.drawPile.length).toBe(5);
  });

  it('should shuffle draw pile', () => {
    const deck = generateDeck(1);
    useGameStore.setState({ drawPile: deck });
    
    useGameStore.getState().shuffleDrawPile();
    
    const state = useGameStore.getState();
    expect(state.drawPile.length).toBe(5);
  });

  it('should reveal the specified cards of the draw pile', () => {
    const deck = generateDeck(1);
    useGameStore.setState({ drawPile: deck });
    
    useGameStore.getState().revealCards([0, 2]);
    
    const state = useGameStore.getState();
    expect(state.drawPile[0].isRevealed).toBe(true);
    expect(state.drawPile[1].isRevealed).toBeUndefined();
    expect(state.drawPile[2].isRevealed).toBe(true);
  });

  it('should explicitly set isRevealed to true on the card when moving to discardPile in nextTurn', () => {
    const deck = generateDeck(1);
    useGameStore.setState({ drawPile: deck, discardPile: [] });
    
    useGameStore.getState().nextTurn();
    
    const state = useGameStore.getState();
    expect(state.discardPile.length).toBe(1);
    expect(state.discardPile[0].isRevealed).toBe(true);
  });

  describe('setPiles (Edit Mode)', () => {
    it('should overwrite draw and discard piles if total count is the same', () => {
      const deck = generateDeck(1); // 5 cards
      useGameStore.setState({ drawPile: deck, discardPile: [] });

      const newDraw = deck.slice(0, 3);
      const newDiscard = deck.slice(3, 5);
      
      useGameStore.getState().setPiles(newDraw, newDiscard);
      
      const state = useGameStore.getState();
      expect(state.drawPile.length).toBe(3);
      expect(state.discardPile.length).toBe(2);
      expect(state.drawPile).toEqual(newDraw.map(c => ({ ...c, isRevealed: false })));
      expect(state.discardPile).toEqual(newDiscard.map(c => ({ ...c, isRevealed: true })));
    });

    it('should reject changes if total count does not match (anti-cheating)', () => {
      const deck = generateDeck(1); // 5 cards
      useGameStore.setState({ drawPile: deck, discardPile: [] });

      const newDraw = deck.slice(0, 3);
      // Omit discard pile cards, making the total count 3 instead of 5
      const newDiscard: typeof deck = [];
      
      useGameStore.getState().setPiles(newDraw, newDiscard);
      
      const state = useGameStore.getState();
      // Should remain unchanged
      expect(state.drawPile.length).toBe(5);
      expect(state.discardPile.length).toBe(0);
      expect(state.drawPile).toEqual(deck);
    });
  });

  describe('searchFilters', () => {
    it('should initially have default search filters', () => {
      const state = useGameStore.getState();
      expect(state.searchFilters).toEqual({
        cardQuery: '',
        selectedTypes: [],
        costRange: [0, 10],
      });
    });

    it('should update search filters partially', () => {
      useGameStore.getState().setSearchFilters({ cardQuery: 'Diamond' });
      
      const state = useGameStore.getState();
      expect(state.searchFilters.cardQuery).toBe('Diamond');
      expect(state.searchFilters).not.toHaveProperty('selectedExpansions');
      expect(state.searchFilters.selectedTypes).toEqual([]);
      expect(state.searchFilters.costRange).toEqual([0, 10]);

      useGameStore.getState().setSearchFilters({ costRange: [2, 5], selectedTypes: ['Gem'] });
      
      const nextState = useGameStore.getState();
      expect(nextState.searchFilters.cardQuery).toBe('Diamond');
      expect(nextState.searchFilters.costRange).toEqual([2, 5]);
      expect(nextState.searchFilters.selectedTypes).toEqual(['Gem']);
    });

    it('should support custom decks containing Player 1/2 and Player 3/4', () => {
      useGameStore.getState().setCustomDeck(['Player 1/2', 'Player 3/4', 'Nemesis']);
      useGameStore.getState().setPlayerCount('custom');

      const state = useGameStore.getState();
      expect(state.customDeck).toEqual(['Player 1/2', 'Player 3/4', 'Nemesis']);
      expect(state.playerCount).toBe('custom');
    });
  });
});

/** A complete payload in the pre-"Expansions" (legacy) persisted format. */
const makeLegacyState = () => {
  const deck = generateDeck(1);
  return {
    playerCount: 2,
    customDeck: [],
    allowConsecutiveNemesis: true,
    allowConsecutivePlayer: true,
    visibilityOption: 'current',
    isPlaying: true,
    drawPile: deck.slice(1),
    discardPile: [{ ...deck[0], isRevealed: true }],
    roundNumber: 3,
    turnHistory: [],
    searchFilters: { cardQuery: 'gem', selectedExpansions: ['Legacy'], selectedTypes: ['Gem'], costRange: [1, 6] },
    mageSearchFilters: { mageQuery: 'brama', selectedMageExpansions: ['War Eternal'] },
    nemesisSearchFilters: { nemesisQuery: '', selectedNemesisExpansions: ['The Void'], difficultyRange: [2, 8] },
    favorites: { supply: ['Jade'], mages: ['Brama'], nemeses: ['Rageborne'] },
    randomizerExpansions: ['Aeon\'s End', 'The Depths'],
    randomizerSlots: [{ id: 'slot-1', cardTypes: ['Gem'], costRange: [0, 10], searchTerm: '' }],
    randomizedResult: {},
  };
};

const writePersisted = (state: unknown) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, version: 0 }));
};

const readPersistedState = (): Record<string, unknown> => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) throw new Error('Nothing persisted');
  return JSON.parse(raw).state;
};

describe('Expansions setting (ownedExpansions)', () => {
  const [expA, expB, expC] = ALL_EXPANSIONS;

  beforeEach(() => {
    useGameStore.setState({
      ownedExpansions: [],
      favorites: { supply: [], mages: [], nemeses: [] },
      randomizerSlots: [],
      randomizedResult: {},
    });
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('defaults to an empty selection (= All Expansions)', () => {
    expect(useGameStore.getState().ownedExpansions).toEqual([]);
    expect(ALL_EXPANSIONS.length).toBeGreaterThan(2);
  });

  it('toggleOwnedExpansion adds and removes an expansion', () => {
    useGameStore.getState().toggleOwnedExpansion(expA);
    expect(useGameStore.getState().ownedExpansions).toEqual([expA]);
    useGameStore.getState().toggleOwnedExpansion(expA);
    expect(useGameStore.getState().ownedExpansions).toEqual([]);
  });

  it('rapid toggles end in a consistent state', () => {
    const { toggleOwnedExpansion } = useGameStore.getState();
    toggleOwnedExpansion(expA);
    toggleOwnedExpansion(expB);
    toggleOwnedExpansion(expC);
    toggleOwnedExpansion(expB);
    toggleOwnedExpansion(expA);
    toggleOwnedExpansion(expA);
    expect(useGameStore.getState().ownedExpansions).toEqual([expC, expA]);
  });

  it('toggleOwnedExpansion ignores names that are not known expansions', () => {
    useGameStore.getState().toggleOwnedExpansion('<script>alert(1)</script>');
    useGameStore.getState().toggleOwnedExpansion('__proto__');
    expect(useGameStore.getState().ownedExpansions).toEqual([]);
  });

  it('setOwnedExpansions supports Select All / Clear Selection and drops unknown names', () => {
    useGameStore.getState().setOwnedExpansions(ALL_EXPANSIONS);
    expect(useGameStore.getState().ownedExpansions).toEqual([...ALL_EXPANSIONS]);

    useGameStore.getState().setOwnedExpansions([]);
    expect(useGameStore.getState().ownedExpansions).toEqual([]);

    useGameStore.getState().setOwnedExpansions([expB, 'Not An Expansion', expB]);
    expect(useGameStore.getState().ownedExpansions).toEqual([expB]);
  });

  it('clearing other filters and the randomizer never touches ownedExpansions', () => {
    useGameStore.getState().setOwnedExpansions([expA, expB]);
    useGameStore.getState().setSearchFilters({ cardQuery: '', selectedTypes: [], costRange: [0, 10] });
    useGameStore.getState().setMageSearchFilters({ mageQuery: '' });
    useGameStore.getState().setNemesisSearchFilters({ nemesisQuery: '', difficultyRange: [1, 10] });
    useGameStore.getState().clearRandomizer();
    expect(useGameStore.getState().ownedExpansions).toEqual([expA, expB]);
  });

  it('persists to localStorage and round-trips through rehydration', async () => {
    useGameStore.getState().setOwnedExpansions([expA, expC]);
    const saved = localStorage.getItem(STORAGE_KEY);
    expect(saved).not.toBeNull();
    expect(readPersistedState().ownedExpansions).toEqual([expA, expC]);

    // Wipe the in-memory value, then restore the saved payload and rehydrate
    useGameStore.setState({ ownedExpansions: [] });
    localStorage.setItem(STORAGE_KEY, saved as string);
    await useGameStore.persist.rehydrate();

    expect(useGameStore.getState().ownedExpansions).toEqual([expA, expC]);
  });

  it('migrates a legacy payload without losing other state, and drops legacy fields', async () => {
    const errorSpy = vi.spyOn(console, 'error');
    useGameStore.setState({ ownedExpansions: [expA] });
    writePersisted(makeLegacyState());

    await useGameStore.persist.rehydrate();

    const state = useGameStore.getState() as unknown as Record<string, unknown> & ReturnType<typeof useGameStore.getState>;
    expect(errorSpy).not.toHaveBeenCalled();
    // Human Decision 1: existing users start at "All"
    expect(state.ownedExpansions).toEqual([]);
    // Everything else survives
    expect(state.favorites).toEqual({ supply: ['Jade'], mages: ['Brama'], nemeses: ['Rageborne'] });
    expect(state.isPlaying).toBe(true);
    expect(state.roundNumber).toBe(3);
    expect(state.drawPile.length).toBe(4);
    expect(state.discardPile.length).toBe(1);
    expect(state.randomizerSlots).toEqual([{ id: 'slot-1', cardTypes: ['Gem'], costRange: [0, 10], searchTerm: '' }]);
    expect(state.searchFilters).toEqual({ cardQuery: 'gem', selectedTypes: ['Gem'], costRange: [1, 6] });
    expect(state.mageSearchFilters).toEqual({ mageQuery: 'brama' });
    expect(state.nemesisSearchFilters).toEqual({ nemesisQuery: '', difficultyRange: [2, 8] });
    // Legacy keys are gone from state...
    expect(state.searchFilters).not.toHaveProperty('selectedExpansions');
    expect(state).not.toHaveProperty('randomizerExpansions');
    expect(state).not.toHaveProperty('setRandomizerExpansions');

    // ...and the next write drops them from storage too
    useGameStore.getState().toggleOwnedExpansion(expB);
    const persisted = readPersistedState();
    expect(persisted).not.toHaveProperty('randomizerExpansions');
    expect(persisted.searchFilters).not.toHaveProperty('selectedExpansions');
    expect(persisted.mageSearchFilters).not.toHaveProperty('selectedMageExpansions');
    expect(persisted.nemesisSearchFilters).not.toHaveProperty('selectedNemesisExpansions');
    expect(persisted.ownedExpansions).toEqual([expB]);
  });

  it.each([
    ['a number', 42],
    ['an array of numbers', [1, 2]],
    ['an array of objects', [{}]],
    ['null', null],
    ['an oversized array', Array.from({ length: 501 }, (_, i) => `Expansion ${i}`)],
    ['an over-long name', ['x'.repeat(201)]],
    ['a string', 'Base'],
  ])('resets only ownedExpansions when it is %s', async (_label, badValue) => {
    const errorSpy = vi.spyOn(console, 'error');
    useGameStore.setState({ ownedExpansions: [expA] });
    writePersisted({ ...makeLegacyState(), ownedExpansions: badValue });

    await useGameStore.persist.rehydrate();

    const state = useGameStore.getState();
    expect(state.ownedExpansions).toEqual([]);
    // The rest of the store was not wiped
    expect(errorSpy).not.toHaveBeenCalled();
    expect(state.favorites).toEqual({ supply: ['Jade'], mages: ['Brama'], nemeses: ['Rageborne'] });
    expect(state.isPlaying).toBe(true);
    expect(state.randomizerSlots.length).toBe(1);
  });

  it('keeps stale names in storage on hydration (ignored at read time, not pruned)', async () => {
    writePersisted({ ...makeLegacyState(), ownedExpansions: ['Renamed Expansion', expA] });
    await useGameStore.persist.rehydrate();
    expect(useGameStore.getState().ownedExpansions).toEqual(['Renamed Expansion', expA]);
  });

  it('keeps working in memory and logs when localStorage writes fail', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    expect(() => useGameStore.getState().toggleOwnedExpansion(expA)).not.toThrow();

    expect(useGameStore.getState().ownedExpansions).toEqual([expA]);
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to persist state (session continues in memory)',
      expect.any(DOMException)
    );
  });

  it('logs and keeps current state when localStorage reads fail', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    useGameStore.setState({ ownedExpansions: [expA] });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Access denied', 'SecurityError');
    });

    await useGameStore.persist.rehydrate();

    expect(useGameStore.getState().ownedExpansions).toEqual([expA]);
    expect(errorSpy).toHaveBeenCalledWith('Failed to read persisted state', expect.any(DOMException));
  });

  it('logs (and does not throw) when the persisted JSON is corrupt', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    useGameStore.setState({ ownedExpansions: [expA], favorites: { supply: ['Jade'], mages: [], nemeses: [] } });
    localStorage.setItem(STORAGE_KEY, '{not valid json');

    await expect(useGameStore.persist.rehydrate()).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith('Failed to rehydrate persisted state', expect.any(SyntaxError));
    expect(useGameStore.getState().ownedExpansions).toEqual([expA]);
    expect(useGameStore.getState().favorites.supply).toEqual(['Jade']);
  });
});
