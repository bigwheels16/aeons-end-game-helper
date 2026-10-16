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

describe('Expansion profiles', () => {
  const [expA, expB, expC] = ALL_EXPANSIONS;
  const mine = { id: 'p-mine', name: 'Mine', expansions: [expA, expB] };
  const theirs = { id: 'p-theirs', name: 'Theirs', expansions: [expB, expC] };

  beforeEach(() => {
    useGameStore.setState({ ownedExpansions: [], expansionProfiles: [mine, theirs], activeProfileIds: [] });
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('selects the union of the active profiles, and All once none is active', () => {
    const { toggleExpansionProfile } = useGameStore.getState();

    toggleExpansionProfile(mine.id);
    expect(useGameStore.getState().ownedExpansions).toEqual([expA, expB]);

    toggleExpansionProfile(theirs.id);
    expect(useGameStore.getState().activeProfileIds).toEqual([mine.id, theirs.id]);
    expect(useGameStore.getState().ownedExpansions).toEqual([expA, expB, expC]);

    toggleExpansionProfile(mine.id);
    expect(useGameStore.getState().ownedExpansions).toEqual([expB, expC]);

    toggleExpansionProfile(theirs.id);
    expect(useGameStore.getState().activeProfileIds).toEqual([]);
    expect(useGameStore.getState().ownedExpansions).toEqual([]);
  });

  it.each([
    ['toggleOwnedExpansion', () => useGameStore.getState().toggleOwnedExpansion(expA), [expB]],
    ['setOwnedExpansions', () => useGameStore.getState().setOwnedExpansions([expC]), [expC]],
  ])('%s turns the profiles off and edits the current selection', (_name, edit, expected) => {
    useGameStore.getState().toggleExpansionProfile(mine.id);
    edit();
    expect(useGameStore.getState().activeProfileIds).toEqual([]);
    expect(useGameStore.getState().ownedExpansions).toEqual(expected);
  });

  it('saveExpansionProfile adds a profile, and updates the selection only when the profile is active', () => {
    const { saveExpansionProfile, toggleExpansionProfile } = useGameStore.getState();
    saveExpansionProfile({ id: 'p-new', name: 'New', expansions: [expC] });
    expect(useGameStore.getState().expansionProfiles.map((p) => p.name)).toEqual(['Mine', 'Theirs', 'New']);
    expect(useGameStore.getState().ownedExpansions).toEqual([]);

    toggleExpansionProfile(mine.id);
    saveExpansionProfile({ ...mine, name: 'Renamed', expansions: [expA] });
    expect(useGameStore.getState().expansionProfiles[0]).toEqual({ id: mine.id, name: 'Renamed', expansions: [expA] });
    expect(useGameStore.getState().ownedExpansions).toEqual([expA]);
  });

  it('deleteExpansionProfile drops an active profile from the selection', () => {
    const { toggleExpansionProfile, deleteExpansionProfile } = useGameStore.getState();
    toggleExpansionProfile(mine.id);
    toggleExpansionProfile(theirs.id);

    deleteExpansionProfile(mine.id);

    const state = useGameStore.getState();
    expect(state.expansionProfiles).toEqual([theirs]);
    expect(state.activeProfileIds).toEqual([theirs.id]);
    expect(state.ownedExpansions).toEqual([expB, expC]);
  });

  it('restores profiles and active ids from storage', async () => {
    useGameStore.setState({ expansionProfiles: [], activeProfileIds: [] });
    writePersisted({ ...makeSavedState(), ownedExpansions: [expA, expB], expansionProfiles: [mine], activeProfileIds: [mine.id] });

    await useGameStore.persist.rehydrate();

    const state = useGameStore.getState();
    expect(state.expansionProfiles).toEqual([mine]);
    expect(state.activeProfileIds).toEqual([mine.id]);
    expect(state.ownedExpansions).toEqual([expA, expB]);
  });

  it('resets invalid saved profiles and keeps the rest of the save', async () => {
    writePersisted({ ...makeSavedState(), ownedExpansions: [expA], expansionProfiles: [{ name: 'No id' }], activeProfileIds: 'p-mine' });

    await useGameStore.persist.rehydrate();

    const state = useGameStore.getState();
    expect(state.expansionProfiles).toEqual([]);
    expect(state.activeProfileIds).toEqual([]);
    expect(state.ownedExpansions).toEqual([expA]);
    expect(state.favorites).toEqual(SAVED_FAVORITES);
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

describe('notes', () => {
  beforeEach(() => {
    useGameStore.setState({ notes: { supply: {}, mages: {}, nemeses: {} } });
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('setNote sets and replaces one note per item, and an empty note removes it', () => {
    useGameStore.getState().setNote('mages', 'mage:brama', 'First');
    useGameStore.getState().setNote('mages', 'mage:brama', 'Second');
    useGameStore.getState().setNote('supply', 'supply:jade', 'Jade note');
    expect(useGameStore.getState().notes).toEqual({
      supply: { 'supply:jade': 'Jade note' },
      mages: { 'mage:brama': 'Second' },
      nemeses: {},
    });

    useGameStore.getState().setNote('mages', 'mage:brama', '');
    expect(useGameStore.getState().notes.mages).toEqual({});
  });

  it('restores saved notes from storage', async () => {
    const saved = { supply: { 'supply:jade': 'Buy early.' }, mages: {}, nemeses: { 'nemesis:rageborne': 'Rush it.' } };
    writePersisted({ ...makeSavedState(), notes: saved });

    await useGameStore.persist.rehydrate();

    expect(useGameStore.getState().notes).toEqual(saved);
  });

  it('starts with no notes when the save has none, and keeps the rest of the save', async () => {
    writePersisted(makeSavedState());

    await useGameStore.persist.rehydrate();

    expect(useGameStore.getState().notes).toEqual({ supply: {}, mages: {}, nemeses: {} });
    expect(useGameStore.getState().favorites).toEqual(SAVED_FAVORITES);
  });

  it('resets an invalid category to no notes and keeps the other categories', async () => {
    writePersisted({
      ...makeSavedState(),
      notes: { supply: { 'supply:jade': 5 }, mages: { 'mage:brama': 'Keep me.' }, nemeses: [] },
    });

    await useGameStore.persist.rehydrate();

    expect(useGameStore.getState().notes).toEqual({ supply: {}, mages: { 'mage:brama': 'Keep me.' }, nemeses: {} });
    expect(useGameStore.getState().favorites).toEqual(SAVED_FAVORITES);
  });
});

describe('persisted scannerSupply', () => {
  beforeEach(() => {
    useGameStore.setState({ scannerSupply: [] });
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('saves the supply to storage', () => {
    useGameStore.getState().setScannerSupply(['supply:jade', 'supply:transmuters-lens']);

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.state.scannerSupply).toEqual(['supply:jade', 'supply:transmuters-lens']);
  });

  it('restores the saved supply from storage', async () => {
    writePersisted({ ...makeSavedState(), scannerSupply: ['supply:transmuters-lens', 'supply:jade'] });

    await useGameStore.persist.rehydrate();

    expect(useGameStore.getState().scannerSupply).toEqual(['supply:transmuters-lens', 'supply:jade']);
  });

  it('resets an invalid saved supply to empty and keeps the rest of the save', async () => {
    writePersisted({ ...makeSavedState(), scannerSupply: 'supply:jade' });

    await useGameStore.persist.rehydrate();

    expect(useGameStore.getState().scannerSupply).toEqual([]);
    expect(useGameStore.getState().favorites).toEqual(SAVED_FAVORITES);
  });
});

describe('turn order kept between rounds', () => {
  beforeEach(() => {
    useGameStore.setState({
      playerCount: 4,
      customDeck: [],
      allowConsecutiveNemesis: true,
      allowConsecutivePlayer: true,
      shuffleEachRound: false,
      visibilityOption: 'current',
      isPlaying: false,
      drawPile: [],
      discardPile: [],
      roundNumber: 0,
      keptTurnOrder: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  /** Starts a game the way the setup screen does, drawing the first turn. */
  const startGame = () => {
    useGameStore.getState().startGame();
    useGameStore.getState().nextTurn();
  };

  /** Draws the rest of the round and the first turn of the next one. */
  const nextRound = () => {
    while (useGameStore.getState().drawPile.length > 0) useGameStore.getState().nextTurn();
    useGameStore.getState().nextTurn();
  };

  /** Card ids of the current round, in turn order, while no turn after the first has been drawn. */
  const roundOrder = () => {
    const { discardPile, drawPile } = useGameStore.getState();
    return [...discardPile, ...drawPile].map(c => c.id);
  };

  it('shuffles a preset deck once and deals every later round in that order', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    startGame();
    const firstRound = roundOrder();
    expect(firstRound).not.toEqual(generateDeck(4).map(c => c.id));
    vi.restoreAllMocks();

    for (let round = 2; round <= 4; round++) {
      nextRound();
      expect(useGameStore.getState().roundNumber).toBe(round);
      expect(roundOrder()).toEqual(firstRound);
    }
  });

  it('deals a custom deck in the order it was built every round', () => {
    const customDeck = ['Nemesis', 'Player 2', 'Player 1', 'Nemesis'] as const;
    useGameStore.setState({ playerCount: 'custom', customDeck: [...customDeck], allowConsecutiveNemesis: false });

    startGame();
    for (let round = 1; round <= 3; round++) {
      const { discardPile, drawPile } = useGameStore.getState();
      expect([...discardPile, ...drawPile].map(c => c.type)).toEqual(customDeck);
      nextRound();
    }
  });

  it('keeps the order when only the visibility changes, and deals a new one when a turn order option changes', () => {
    startGame();
    const kept = useGameStore.getState().keptTurnOrder;
    expect(kept.map(c => c.id)).toEqual(roundOrder());

    const options = { playerCount: 4, allowConsecutiveNemesis: true, allowConsecutivePlayer: true, shuffleEachRound: false } as const;
    useGameStore.getState().setGameOptions({ ...options, visibilityOption: 'all' });
    expect(useGameStore.getState().keptTurnOrder).toBe(kept);

    useGameStore.getState().setGameOptions({ ...options, playerCount: 2, visibilityOption: 'all' });
    expect(useGameStore.getState().keptTurnOrder).toEqual([]);

    nextRound();
    const secondRound = roundOrder();
    expect([...secondRound].sort()).toEqual(generateDeck(2).map(c => c.id).sort());
    nextRound();
    expect(roundOrder()).toEqual(secondRound);
  });

  it('keeps no order while shuffling each round', () => {
    useGameStore.setState({ shuffleEachRound: true });
    startGame();
    nextRound();
    expect(useGameStore.getState().keptTurnOrder).toEqual([]);
  });

  it('restores the option and kept order from storage, defaulting for saves without them', async () => {
    writePersisted(makeSavedState());
    await useGameStore.persist.rehydrate();
    expect(useGameStore.getState().shuffleEachRound).toBe(true);
    expect(useGameStore.getState().keptTurnOrder).toEqual([]);

    const keptTurnOrder = generateDeck(2);
    writePersisted({ ...makeSavedState(), shuffleEachRound: false, keptTurnOrder });
    await useGameStore.persist.rehydrate();
    expect(useGameStore.getState().shuffleEachRound).toBe(false);
    expect(useGameStore.getState().keptTurnOrder).toEqual(keptTurnOrder);
  });
});
