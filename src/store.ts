
import { create, StateCreator } from 'zustand';
import { createJSONStorage, persist, StateStorage } from 'zustand/middleware';
import { z } from 'zod';
import { CARD_TYPES, Card, CardType, generateDeck, shuffleDeck } from './deckEngine';
import { getSupplyCardById } from './utils/cards';
import { ScrapedSupplyCard } from './types/scraped';

export type VisibilityOption = 'current' | 'next' | 'all';

const CardTypeSchema = z.enum(CARD_TYPES);

const CardSchema = z.object({
  id: z.string(),
  type: CardTypeSchema,
  imageFaceUrl: z.string(),
  isRevealed: z.boolean().optional(),
});

const VisibilityOptionSchema = z.enum(['current', 'next', 'all']);

/** Persisted record ids of one favorites category; an invalid value resets the category to []. */
const FavoriteIdsSchema = z.array(z.string()).catch([]);

const emptyFavorites = (): Favorites => ({ supply: [], mages: [], nemeses: [] });

/** Persisted notes of one category by record id; an invalid value resets the category to {}. */
const NotesByIdSchema = z.record(z.string()).catch({});

const emptyNotes = (): Notes => ({ supply: {}, mages: {}, nemeses: {} });

const GameStateSchema = z.object({
  playerCount: z.union([z.number().min(1).max(4), z.literal('custom')]),
  customDeck: z.array(CardTypeSchema).default([]),
  allowConsecutiveNemesis: z.boolean(),
  allowConsecutivePlayer: z.boolean().default(true),
  visibilityOption: VisibilityOptionSchema,
  isPlaying: z.boolean(),
  drawPile: z.array(CardSchema),
  discardPile: z.array(CardSchema),
  roundNumber: z.number().min(0),
  turnHistory: z.array(z.object({
    roundNumber: z.number(),
    card: CardSchema,
  })).optional().default([]),
  searchFilters: z.object({
    cardQuery: z.string().optional().default(''),
    selectedTypes: z.array(z.string()),
    costRange: z.tuple([z.number(), z.number()]),
  }).optional(),
  mageSearchFilters: z.object({
    mageQuery: z.string(),
  }).optional(),
  nemesisSearchFilters: z.object({
    nemesisQuery: z.string(),
    difficultyRange: z.tuple([z.number(), z.number()]).optional().default([1, 10]),
  }).optional(),
  /** Favorites by record id. Ids that are not in the dataset are kept but never shown. */
  favorites: z.object({
    supply: FavoriteIdsSchema,
    mages: FavoriteIdsSchema,
    nemeses: FavoriteIdsSchema,
  }).catch(emptyFavorites),
  /** Notes by record id, kept like favorites. */
  notes: z.object({
    supply: NotesByIdSchema,
    mages: NotesByIdSchema,
    nemeses: NotesByIdSchema,
  }).catch(emptyNotes),
  /** App-wide "Expansions". An invalid value resets it to [] (= All). */
  ownedExpansions: z.array(z.string()).catch([]),
  /** Expansion profiles and the active ones; an invalid value resets to []. */
  expansionProfiles: z.array(z.object({
    id: z.string(),
    name: z.string(),
    expansions: z.array(z.string()),
  })).catch([]),
  activeProfileIds: z.array(z.string()).catch([]),
  randomizerSlots: z.array(z.object({
    id: z.string(),
    cardTypes: z.array(z.enum(['Gem', 'Relic', 'Spell'])).default(['Gem', 'Relic', 'Spell']),
    costRange: z.tuple([z.number(), z.number()]),
    searchTerm: z.string(),
  })).optional(),
  /** Saved results are looked up by card id, so they show current card data. Unknown ids are skipped. */
  randomizedResult: z.record(z.object({ id: z.string() }))
    .transform((saved) => {
      const resolved: Record<string, ScrapedSupplyCard> = {};
      for (const [slotId, { id }] of Object.entries(saved)) {
        const card = getSupplyCardById(id);
        if (card) resolved[slotId] = card;
      }
      return resolved;
    })
    .catch({}),
  /** Supply Scanner card ids in supply order; an invalid value resets it to []. */
  scannerSupply: z.array(z.string()).catch([]),
});

/**
 * Zustand slice managing game setup and configuration parameters.
 */
export interface ConfigSlice {
  /** Configured player count (1-4) or 'custom' for custom deck builder */
  playerCount: number | 'custom';
  /** Array of card types selected in the custom deck builder */
  customDeck: CardType[];
  /** Whether consecutive Nemesis turns are allowed */
  allowConsecutiveNemesis: boolean;
  /** Whether consecutive player turns are allowed */
  allowConsecutivePlayer: boolean;
  /** Active draw pile visibility setting */
  visibilityOption: VisibilityOption;
  /** Updates configured player count */
  setPlayerCount: (count: number | 'custom') => void;
  /** Updates custom turn order deck card pool */
  setCustomDeck: (deck: CardType[]) => void;
  /** Sets all game options at once */
  setGameOptions: (options: GameOptionsData) => void;
}

/** The game options edited by GameOptionsForm. */
export type GameOptionsData = Pick<ConfigSlice, 'playerCount' | 'allowConsecutiveNemesis' | 'allowConsecutivePlayer' | 'visibilityOption'>;

export interface TurnHistoryEntry {
  roundNumber: number;
  card: Card;
}

export interface PlaySlice {
  isPlaying: boolean;
  drawPile: Card[];
  discardPile: Card[];
  roundNumber: number;
  turnHistory: TurnHistoryEntry[];
  startGame: () => void;
  nextTurn: () => void;
  endGame: () => void;
  revealCards: (indices: number[]) => void;
  shuffleDrawPile: () => void;
  setPiles: (newDrawPile: Card[], newDiscardPile: Card[]) => void;
}

/**
 * Filter parameters for card search queries.
 */
export interface SearchFilters {
  /** Text query matched against card name and rules/effect text */
  cardQuery: string;
  /** List of selected card types ('Gem', 'Relic', 'Spell') to include in results */
  selectedTypes: string[];
  /** [minCost, maxCost] Aether cost bounds */
  costRange: [number, number];
}

export interface MageSearchFilters {
  mageQuery: string;
}

export interface NemesisSearchFilters {
  nemesisQuery: string;
  difficultyRange: [number, number];
}

/** Kinds of items that can be favorited and given a note. */
export type ItemCategory = 'supply' | 'mages' | 'nemeses';

/** Record ids of favorited items, grouped by category. */
export type Favorites = Record<ItemCategory, string[]>;

/** The user's note on each item, by category and record id. */
export type Notes = Record<ItemCategory, Record<string, string>>;

/**
 * Zustand slice managing card search filter state.
 */
export interface SearchSlice {
  /** Persisted search filter criteria */
  searchFilters: SearchFilters;
  /** Updates the active search filter parameters */
  setSearchFilters: (filters: Partial<SearchFilters>) => void;
  /** Persisted mage search filter criteria */
  mageSearchFilters: MageSearchFilters;
  /** Updates the active mage search filter parameters */
  setMageSearchFilters: (filters: Partial<MageSearchFilters>) => void;
  /** Persisted nemesis search filter criteria */
  nemesisSearchFilters: NemesisSearchFilters;
  /** Updates the active nemesis search filter parameters */
  setNemesisSearchFilters: (filters: Partial<NemesisSearchFilters>) => void;
  /** Persisted favorited supply cards, mages, and nemeses, by record id */
  favorites: Favorites;
  /** Adds the item with this record id to its category's favorites, or removes it if already favorited */
  toggleFavorite: (category: ItemCategory, id: string) => void;
  /** Persisted notes on supply cards, mages, and nemeses, by record id */
  notes: Notes;
  /** Sets the note on the item with this record id; an empty note removes it */
  setNote: (category: ItemCategory, id: string, text: string) => void;
}

/**
 * Configuration criteria for an individual market supply slot in the Supply Randomizer.
 */
export interface SlotCriteria {
  /** Unique identifier for the slot */
  id: string;
  /** Filter by card types (multi-select: Gem, Relic, Spell) */
  cardTypes: ('Gem' | 'Relic' | 'Spell')[];
  /** Range filter for card cost: [minCost, maxCost] */
  costRange: [number, number];
  /** Search string filter evaluated against card name and rules text */
  searchTerm: string;
}

/**
 * Zustand slice managing supply randomizer setup, slot criteria, and randomized results.
 */
export interface SupplyRandomizerSlice {
  /** Configured criteria for each supply slot */
  randomizerSlots: SlotCriteria[];
  /** Map of slot IDs to assigned supply cards */
  randomizedResult: Record<string, ScrapedSupplyCard>;
  /** Adds a new slot with specified criteria */
  addSlot: (slot: SlotCriteria) => void;
  /** Removes a slot and its assigned card by ID */
  removeSlot: (id: string) => void;
  /** Updates criteria for a specific slot */
  updateSlot: (id: string, updates: Partial<SlotCriteria>) => void;
  /** Sets the randomized card assignments */
  setRandomizedResult: (result: Record<string, ScrapedSupplyCard>) => void;
  /** Clears all slots and results */
  clearRandomizer: () => void;
}

/** A named preset of expansions, e.g. one player's collection. */
export interface ExpansionProfile {
  id: string;
  name: string;
  /** May contain stale names, like ownedExpansions. */
  expansions: string[];
}

/**
 * Zustand slice holding the app-wide "Expansions" setting.
 *
 * Scope: global (one per browser profile + origin), persisted in
 * localStorage['aeons-end-game-storage'].state.ownedExpansions. Not synced across tabs
 * (last tab to write wins). Applies to Card Search, Mage Search, Nemesis Search and the
 * Supply Randomizer card pool; Favorites is intentionally unfiltered.
 */
export interface ExpansionsSlice {
  /**
   * App-wide "Expansions". Empty array = All Expansions (no filtering).
   * May contain stale names no longer in the data; consumers must go through
   * getEffectiveOwned()/useOwnedExpansions(), never read this raw for filtering or display.
   */
  ownedExpansions: string[];
  /** Saved profiles, in creation order. */
  expansionProfiles: ExpansionProfile[];
  /**
   * Ids of the active profiles. While any is active, ownedExpansions is the union of their
   * expansions; editing the selection directly turns every profile off.
   */
  activeProfileIds: string[];
  /** Adds or removes one expansion. */
  toggleOwnedExpansion: (name: string) => void;
  /** Replaces the selection (Select All / Clear Selection). */
  setOwnedExpansions: (names: readonly string[]) => void;
  /** Turns a profile on or off. */
  toggleExpansionProfile: (id: string) => void;
  /** Adds a profile, or replaces the one with the same id. */
  saveExpansionProfile: (profile: ExpansionProfile) => void;
  /** Deletes a profile. */
  deleteExpansionProfile: (id: string) => void;
}

/**
 * Zustand slice holding the Supply Scanner's supply, so it is kept between visits.
 */
export interface ScannerSlice {
  /** Card ids of the supply, in order. May contain ids not in the dataset; the screen skips them. */
  scannerSupply: string[];
  /** Replaces the supply. */
  setScannerSupply: (ids: string[]) => void;
}

type GameState = ConfigSlice & PlaySlice & SearchSlice & SupplyRandomizerSlice & ExpansionsSlice & ScannerSlice;

const applyVisibility = (drawPile: Card[], visibilityOption: VisibilityOption): Card[] => {
  let newPile = drawPile.map(c => ({ ...c, isRevealed: !!c.isRevealed }));
  if (visibilityOption === 'next' && newPile.length > 0) {
    newPile[0] = { ...newPile[0], isRevealed: true };
  } else if (visibilityOption === 'all') {
    newPile = newPile.map(c => ({ ...c, isRevealed: true }));
  }
  return newPile;
};

const updateRoundHistory = (
  turnHistory: TurnHistoryEntry[],
  roundNumber: number,
  cards: Card[]
): TurnHistoryEntry[] => [
  ...turnHistory.filter(h => h.roundNumber !== roundNumber),
  ...cards.map(card => ({ roundNumber, card }))
];

const createConfigSlice: StateCreator<GameState, [], [], ConfigSlice> = (set, get) => ({
  playerCount: 1,
  customDeck: [],
  allowConsecutiveNemesis: true,
  allowConsecutivePlayer: true,
  visibilityOption: 'current',
  setPlayerCount: (count) => set({ playerCount: count }),
  setCustomDeck: (deck) => set({ customDeck: deck }),
  setGameOptions: (options) => set({ ...options, drawPile: applyVisibility(get().drawPile, options.visibilityOption) }),
});

const createPlaySlice: StateCreator<GameState, [], [], PlaySlice> = (set, get) => ({
  isPlaying: false,
  drawPile: [],
  discardPile: [],
  roundNumber: 0,
  turnHistory: [],

  startGame: () => {
    const state = get();
    const initialDeck = generateDeck(state.playerCount, state.customDeck);
    let shuffled = shuffleDeck(initialDeck, state.allowConsecutiveNemesis, state.allowConsecutivePlayer, null);
    
    shuffled = applyVisibility(shuffled, state.visibilityOption);
    
    set({
      isPlaying: true,
      drawPile: shuffled,
      discardPile: [],
      roundNumber: 1,
      turnHistory: [],
    });
  },

  nextTurn: () => {
    const state = get();

    if (state.drawPile.length > 0) {
      const [drawn, ...rest] = state.drawPile;
      const revealed = { ...drawn, isRevealed: true };
      set({
        discardPile: [...state.discardPile, revealed],
        drawPile: applyVisibility(rest, state.visibilityOption),
        turnHistory: [...state.turnHistory, { roundNumber: state.roundNumber, card: revealed }],
      });
    } else {
      const initialDeck = generateDeck(state.playerCount, state.customDeck);
      const lastTurnType = state.discardPile.length > 0 ? state.discardPile[state.discardPile.length - 1].type : null;
      let shuffled = shuffleDeck(initialDeck, state.allowConsecutiveNemesis, state.allowConsecutivePlayer, lastTurnType);
      
      let nextCard = shuffled.shift() || null;
      if (nextCard) {
        nextCard = { ...nextCard, isRevealed: true };
      }
      
      shuffled = applyVisibility(shuffled, state.visibilityOption);
      
      const turnHistory = nextCard ? [...state.turnHistory, { roundNumber: state.roundNumber + 1, card: nextCard }] : state.turnHistory;

      set({
        discardPile: nextCard ? [nextCard] : [],
        drawPile: shuffled,
        roundNumber: state.roundNumber + 1,
        turnHistory,
      });
    }
  },

  endGame: () => {
    set({
      isPlaying: false,
      drawPile: [],
      discardPile: [],
      roundNumber: 0,
      turnHistory: [],
    });
  },

  revealCards: (indices: number[]) => {
    const state = get();
    if (state.drawPile.length > 0) {
      const newDrawPile = [...state.drawPile];
      indices.forEach(index => {
        if (index >= 0 && index < newDrawPile.length) {
          newDrawPile[index] = { ...newDrawPile[index], isRevealed: true };
        }
      });
      set({ drawPile: newDrawPile });
    }
  },

  shuffleDrawPile: () => {
    const state = get();
    if (state.drawPile.length <= 1) return;
    
    const lastTurnType = state.discardPile.length > 0 ? state.discardPile[state.discardPile.length - 1].type : null;
    let newDrawPile = shuffleDeck([...state.drawPile], state.allowConsecutiveNemesis, state.allowConsecutivePlayer, lastTurnType);
    
    newDrawPile = applyVisibility(newDrawPile, state.visibilityOption);

    set({ drawPile: newDrawPile });
  },

  setPiles: (newDrawPile, newDiscardPile) => {
    const state = get();
    newDiscardPile = newDiscardPile.map(c => ({ ...c, isRevealed: true }));
    newDrawPile = applyVisibility(newDrawPile, state.visibilityOption);

    const turnHistory = updateRoundHistory(state.turnHistory, state.roundNumber, newDiscardPile);

    set({ drawPile: newDrawPile, discardPile: newDiscardPile, turnHistory });
  },
});

/**
 * Creates the search filter state slice with default initial filter criteria.
 */
const createSearchSlice: StateCreator<GameState, [], [], SearchSlice> = (set) => ({
  searchFilters: {
    cardQuery: '',
    selectedTypes: [],
    costRange: [0, 10],
  },
  setSearchFilters: (filters) => set((state) => ({
    searchFilters: { ...state.searchFilters, ...filters }
  })),
  mageSearchFilters: {
    mageQuery: '',
  },
  setMageSearchFilters: (filters) => set((state) => ({
    mageSearchFilters: { ...state.mageSearchFilters, ...filters }
  })),
  nemesisSearchFilters: {
    nemesisQuery: '',
    difficultyRange: [1, 10],
  },
  setNemesisSearchFilters: (filters) => set((state) => ({
    nemesisSearchFilters: { ...state.nemesisSearchFilters, ...filters }
  })),
  favorites: {
    supply: [],
    mages: [],
    nemeses: [],
  },
  toggleFavorite: (category, id) => set((state) => {
    const current = state.favorites[category];
    const updated = current.includes(id)
      ? current.filter(n => n !== id)
      : [...current, id];
    return { favorites: { ...state.favorites, [category]: updated } };
  }),
  notes: emptyNotes(),
  setNote: (category, id, text) => set((state) => {
    const byId = { ...state.notes[category] };
    if (text) {
      byId[id] = text;
    } else {
      delete byId[id];
    }
    return { notes: { ...state.notes, [category]: byId } };
  }),
});

/**
 * Creates the supply randomizer state slice with default empty slots and filters.
 */
const createRandomizerSlice: StateCreator<GameState, [], [], SupplyRandomizerSlice> = (set) => ({
  randomizerSlots: [],
  randomizedResult: {},
  addSlot: (slot) => set((state) => ({ randomizerSlots: [...state.randomizerSlots, slot] })),
  removeSlot: (id) => set((state) => {
    const newSlots = state.randomizerSlots.filter(s => s.id !== id);
    const newResult = { ...state.randomizedResult };
    delete newResult[id];
    return { randomizerSlots: newSlots, randomizedResult: newResult };
  }),
  updateSlot: (id, updates) => set((state) => ({
    randomizerSlots: state.randomizerSlots.map(s => s.id === id ? { ...s, ...updates } : s)
  })),
  setRandomizedResult: (result) => set({ randomizedResult: result }),
  clearRandomizer: () => set({ randomizerSlots: [], randomizedResult: {} })
});

/** Active ids and selection for these active profiles; no active profile selects nothing (= All). */
const activateProfiles = (profiles: ExpansionProfile[], activeIds: string[]) => {
  const active = profiles.filter((p) => activeIds.includes(p.id));
  return {
    activeProfileIds: active.map((p) => p.id),
    ownedExpansions: [...new Set(active.flatMap((p) => p.expansions))],
  };
};

/**
 * Creates the app-wide "Expansions" slice. These actions are the only writers
 * of ownedExpansions; no "Clear Filters" action may touch it.
 */
const createExpansionsSlice: StateCreator<GameState, [], [], ExpansionsSlice> = (set) => ({
  ownedExpansions: [],
  expansionProfiles: [],
  activeProfileIds: [],
  toggleOwnedExpansion: (name) => set((state) => {
    const current = state.ownedExpansions;
    return {
      ownedExpansions: current.includes(name)
        ? current.filter((n) => n !== name)
        : [...current, name],
      activeProfileIds: [],
    };
  }),
  setOwnedExpansions: (names) => set({ ownedExpansions: [...names], activeProfileIds: [] }),
  toggleExpansionProfile: (id) => set((state) => {
    const current = state.activeProfileIds;
    const activeIds = current.includes(id) ? current.filter((a) => a !== id) : [...current, id];
    return activateProfiles(state.expansionProfiles, activeIds);
  }),
  saveExpansionProfile: (profile) => set((state) => {
    const exists = state.expansionProfiles.some((p) => p.id === profile.id);
    const expansionProfiles = exists
      ? state.expansionProfiles.map((p) => (p.id === profile.id ? profile : p))
      : [...state.expansionProfiles, profile];
    if (!state.activeProfileIds.includes(profile.id)) return { expansionProfiles };
    return { expansionProfiles, ...activateProfiles(expansionProfiles, state.activeProfileIds) };
  }),
  deleteExpansionProfile: (id) => set((state) => {
    const expansionProfiles = state.expansionProfiles.filter((p) => p.id !== id);
    if (!state.activeProfileIds.includes(id)) return { expansionProfiles };
    return { expansionProfiles, ...activateProfiles(expansionProfiles, state.activeProfileIds) };
  }),
});

const createScannerSlice: StateCreator<GameState, [], [], ScannerSlice> = (set) => ({
  scannerSupply: [],
  setScannerSupply: (ids) => set({ scannerSupply: ids }),
});

/**
 * localStorage whose writes are guarded, so a full or blocked storage (quota exceeded, private mode)
 * logs the error and the session continues in memory. Read errors are reported by zustand through
 * onRehydrateStorage.
 */
const guardedLocalStorage: StateStorage = {
  getItem: (name) => window.localStorage.getItem(name),
  setItem: (name, value) => {
    try {
      window.localStorage.setItem(name, value);
    } catch (e) {
      console.error('Failed to persist state (session continues in memory)', e);
    }
  },
  removeItem: (name) => window.localStorage.removeItem(name),
};

export const useGameStore = create<GameState>()(
  persist(
    (...a) => ({
      ...createConfigSlice(...a),
      ...createPlaySlice(...a),
      ...createSearchSlice(...a),
      ...createRandomizerSlice(...a),
      ...createExpansionsSlice(...a),
      ...createScannerSlice(...a),
    }),
    {
      name: 'aeons-end-game-storage',
      storage: createJSONStorage(() => guardedLocalStorage),
      onRehydrateStorage: () => (_state, error) => {
        if (error) console.error('Failed to rehydrate persisted state', error);
      },
      merge: (persistedState, currentState) => {
        if (!persistedState) return currentState;
        const parsed = GameStateSchema.safeParse(persistedState);
        if (!parsed.success) {
          console.error('Failed to parse persisted state', parsed.error);
          return currentState;
        }
        return { ...currentState, ...parsed.data };
      },
    }
  )
);


