import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGameStore } from './store';
import { generateDeck } from './deckEngine';
import { ALL_EXPANSIONS } from './utils/expansions';
import { getSupplyCardById } from './utils/cards';

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
    it('should overwrite draw and discard piles', () => {
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
  });
});

const SAVED_FAVORITES = { supply: ['supply:jade'], mages: ['mage:brama'], nemeses: ['nemesis:rageborne'] };

/** A complete, valid saved payload. */
const makeSavedState = () => {
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
    searchFilters: { cardQuery: 'gem', selectedTypes: ['Gem'], costRange: [1, 6] },
    mageSearchFilters: { mageQuery: 'brama' },
    nemesisSearchFilters: { nemesisQuery: '', difficultyRange: [2, 8] },
    favorites: SAVED_FAVORITES,
    randomizerSlots: [{ id: 'slot-1', cardTypes: ['Gem'], costRange: [0, 10], searchTerm: '' }],
    randomizedResult: {},
  };
};

const writePersisted = (state: unknown) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, version: 0 }));
};

describe('Expansions setting (ownedExpansions)', () => {
  const [expA, expB] = ALL_EXPANSIONS;

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

  it('setOwnedExpansions supports Select All / Clear Selection', () => {
    useGameStore.getState().setOwnedExpansions(ALL_EXPANSIONS);
    expect(useGameStore.getState().ownedExpansions).toEqual([...ALL_EXPANSIONS]);

    useGameStore.getState().setOwnedExpansions([]);
    expect(useGameStore.getState().ownedExpansions).toEqual([]);
  });

  it('keeps the current state and logs when the saved state is malformed', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    useGameStore.setState({ ownedExpansions: [expA], isPlaying: false });
    writePersisted({ ...makeSavedState(), drawPile: 'not a pile', ownedExpansions: [expB] });

    await expect(useGameStore.persist.rehydrate()).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith('Failed to parse persisted state', expect.objectContaining({ name: 'ZodError' }));
    expect(useGameStore.getState().ownedExpansions).toEqual([expA]);
    expect(useGameStore.getState().isPlaying).toBe(false);
  });

  it('keeps stale names in storage on hydration (ignored at read time, not pruned)', async () => {
    writePersisted({ ...makeSavedState(), ownedExpansions: ['Renamed Expansion', expA] });
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

  it('logs (and does not throw) when the persisted JSON is corrupt', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    useGameStore.setState({ ownedExpansions: [expA], favorites: { supply: ['supply:jade'], mages: [], nemeses: [] } });
    localStorage.setItem(STORAGE_KEY, '{not valid json');

    await expect(useGameStore.persist.rehydrate()).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith('Failed to rehydrate persisted state', expect.any(SyntaxError));
    expect(useGameStore.getState().ownedExpansions).toEqual([expA]);
    expect(useGameStore.getState().favorites.supply).toEqual(['supply:jade']);
  });
});

describe('persisted randomizerSlots', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('gives a saved slot without cardTypes all types and keeps the rest of the save', async () => {
    const errorSpy = vi.spyOn(console, 'error');
    useGameStore.setState({ isPlaying: false, randomizerSlots: [] });
    writePersisted({
      ...makeSavedState(),
      randomizerSlots: [{ id: 'slot-1', costRange: [2, 5], searchTerm: 'aether' }],
    });

    await useGameStore.persist.rehydrate();

    const state = useGameStore.getState();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(state.randomizerSlots).toEqual([
      { id: 'slot-1', cardTypes: ['Gem', 'Relic', 'Spell'], costRange: [2, 5], searchTerm: 'aether' },
    ]);
    expect(state.isPlaying).toBe(true);
    expect(state.favorites).toEqual(SAVED_FAVORITES);
  });
});

describe('persisted randomizedResult', () => {
  const [expA] = ALL_EXPANSIONS;
  const lens = getSupplyCardById('supply:transmuters-lens')!;
  const jade = getSupplyCardById('supply:jade')!;

  /** Rehydrates a saved payload with this randomizedResult; every other saved field must survive. */
  const hydrate = async (randomizedResult: unknown) => {
    writePersisted({ ...makeSavedState(), ownedExpansions: [expA], randomizedResult });
    await useGameStore.persist.rehydrate();
    const state = useGameStore.getState();
    expect(state.ownedExpansions).toEqual([expA]);
    expect(state.isPlaying).toBe(true);
    expect(state.favorites).toEqual(SAVED_FAVORITES);
    return state.randomizedResult;
  };

  beforeEach(() => {
    useGameStore.setState({
      ownedExpansions: [],
      isPlaying: false,
      favorites: { supply: [], mages: [], nemeses: [] },
      randomizerSlots: [],
      randomizedResult: {},
    });
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("resolves an entry by id and uses the current card's fields", async () => {
    const result = await hydrate({
      'slot-1': { ...lens, effect: 'Old effect text', type: 'Relic', cost: '9' },
    });
    expect(result['slot-1']).toBe(lens);
    expect(result['slot-1'].effect).toBe(lens.effect);
  });

  it('skips an entry whose id is not in the dataset', async () => {
    const result = await hydrate({
      'slot-1': { id: 'supply:renamed-card', name: 'Jade' },
      'slot-2': { id: 'supply:jade', name: 'Jade' },
    });
    expect(result).toEqual({ 'slot-2': jade });
  });
});
