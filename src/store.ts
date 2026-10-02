
import { create, StateCreator } from 'zustand';
import { createJSONStorage, persist, StateStorage } from 'zustand/middleware';
import { z } from 'zod';
import { CARD_TYPES, Card, CardType, generateDeck, shuffleDeck } from './deckEngine';
import { ALL_EXPANSIONS } from './utils/expansions';
import { getSupplyCardById, isKnownFavoriteId } from './utils/cards';
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

/**
 * Persisted favorites of one category: a list of record ids. Every element that is not a known id
 * of this category (old name-keyed favorites, other kinds, unknown ids, non-strings) and every
 * duplicate is dropped, never migrated. A non-array resets only this category to []. Warnings
 * carry counts and field names only, never stored values.
 */
const favoriteIdList = (category: FavoriteCategory) =>
  z.array(z.unknown())
    .transform((raw) => {
      const out: string[] = [];
      const seen = new Set<string>();
      let dropped = 0;
      for (const v of raw) {
        if (typeof v === 'string' && isKnownFavoriteId(category, v) && !seen.has(v)) {
          seen.add(v);
          out.push(v);
        } else {
          dropped++;
        }
      }
      if (dropped > 0) console.warn(`favorites.${category}: dropped ${dropped} unknown or invalid entries`);
      return out;
    })
    .optional()
    .default([])
    .catch(() => {
      console.warn(`favorites.${category}: invalid persisted value, reset to empty`);
      return [];
    });

const emptyFavorites = (): Favorites => ({ supply: [], mages: [], nemeses: [] });

/** Only the stored card id is read; the card itself comes from the current card list. */
const PersistedResultEntrySchema = z.object({ id: z.string() });

/**
 * Resolves persisted randomizer results by card id, so saved slots show current card data.
 * Entries without a known id are skipped; a non-object resets the field to {}. Never throws.
 * Warnings carry counts only.
 */
function resolvePersistedRandomizedResult(raw: unknown): Record<string, ScrapedSupplyCard> {
  if (raw === undefined) return {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    console.warn('randomizedResult: invalid persisted value, reset to empty');
    return {};
  }
  const entries = Object.entries(raw);
  const resolved: [string, ScrapedSupplyCard][] = [];
  for (const [slotId, entry] of entries) {
    const parsed = PersistedResultEntrySchema.safeParse(entry);
    const card = parsed.success ? getSupplyCardById(parsed.data.id) : undefined;
    if (card) resolved.push([slotId, card]);
  }
  const dropped = entries.length - resolved.length;
  if (dropped > 0) {
    console.warn(`randomizedResult: dropped ${dropped} persisted results that were invalid or stale`);
  }
  return Object.fromEntries(resolved);
}

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
  // Plain z.object() (default strip of unknown keys): the LEGACY selectedExpansions key is silently dropped.
  searchFilters: z.object({
    cardQuery: z.string().optional().default(''),
    selectedTypes: z.array(z.string()),
    costRange: z.tuple([z.number(), z.number()]),
  }).optional(),
  // Plain z.object() (default strip of unknown keys): the LEGACY selectedMageExpansions key is silently dropped.
  mageSearchFilters: z.object({
    mageQuery: z.string(),
  }).optional(),
  // Plain z.object() (default strip of unknown keys): the LEGACY selectedNemesisExpansions key is silently dropped.
  nemesisSearchFilters: z.object({
    nemesisQuery: z.string(),
    difficultyRange: z.tuple([z.number(), z.number()]).optional().default([1, 10]),
  }).optional(),
  /**
   * Favorites by record id. Old name-keyed favorites are dropped (not migrated). Any
   * invalid value resets only the affected category, or only `favorites`, never the whole store.
   */
  favorites: z.object({
    supply: favoriteIdList('supply'),
    mages: favoriteIdList('mages'),
    nemeses: favoriteIdList('nemeses'),
  })
    .optional()
    .default(emptyFavorites)
    .catch(() => {
      console.warn('favorites: invalid persisted value, reset to empty');
      return emptyFavorites();
    }),
  // LEGACY randomizerExpansions is no longer declared, so the top-level (strip) object drops it.
  /**
   * App-wide "Expansions". Non-string entries are skipped; a non-array resets only this field
   * to [] (= All) instead of failing the whole parse.
   */
  ownedExpansions: z.array(z.unknown())
    .transform((names) => names.filter((name): name is string => typeof name === 'string'))
    .optional()
    .default([])
    .catch([]),
  randomizerSlots: z.array(z.object({
    id: z.string(),
    cardTypes: z.array(z.enum(['Gem', 'Relic', 'Spell'])).optional(),
    cardType: z.any().optional(),
    costRange: z.tuple([z.number(), z.number()]),
    searchTerm: z.string(),
  }).transform((slot) => {
    let types: ('Gem' | 'Relic' | 'Spell')[] = ['Gem', 'Relic', 'Spell'];
    if (Array.isArray(slot.cardTypes)) {
      types = slot.cardTypes;
    } else if (typeof slot.cardType === 'string') {
      if (['Gem', 'Relic', 'Spell'].includes(slot.cardType)) {
        types = [slot.cardType as 'Gem' | 'Relic' | 'Spell'];
      }
    }
    return {
      id: slot.id,
      cardTypes: types,
      costRange: slot.costRange,
      searchTerm: slot.searchTerm,
    };
  })).optional(),
  /** Only each entry's `id` is read, and the entry is replaced by that card. Never fails the whole parse. */
  randomizedResult: z.unknown()
    .transform(resolvePersistedRandomizedResult)
    .catch(() => {
      console.warn('randomizedResult: invalid persisted value, reset to empty');
      return {};
    }),
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
  /** Toggles consecutive Nemesis rule */
  setAllowConsecutiveNemesis: (allow: boolean) => void;
  /** Toggles consecutive player rule */
  setAllowConsecutivePlayer: (allow: boolean) => void;
  /** Sets draw pile visibility option */
  setVisibilityOption: (opt: VisibilityOption) => void;
}

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
  moveCard: (
    source: 'draw' | 'discard',
    cardId: string,
    destination: 'draw' | 'discard',
    position: 'top' | 'bottom' | 'shuffled'
  ) => void;
  setPiles: (newDrawPile: Card[], newDiscardPile: Card[]) => boolean;
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

export type FavoriteCategory = 'supply' | 'mages' | 'nemeses';

/** Record ids of favorited items, grouped by category. */
export type Favorites = Record<FavoriteCategory, string[]>;

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
  toggleFavorite: (category: FavoriteCategory, id: string) => void;
}

/**
 * Configuration criteria for an individual market supply slot in the Supply Randomizer.
 */
export interface SlotCriteria {
  /** Unique identifier for the slot */
  id: string;
  /** Filter by card types (multi-select: Gem, Relic, Spell) */
  cardTypes?: ('Gem' | 'Relic' | 'Spell')[];
  /** Legacy single card type filter for backwards compatibility */
  cardType?: 'Gem' | 'Relic' | 'Spell';
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
  /** Adds or removes one expansion. Names not in ALL_EXPANSIONS are ignored. */
  toggleOwnedExpansion: (name: string) => void;
  /** Replaces the selection (Select All / Clear Selection). Unknown names are dropped. */
  setOwnedExpansions: (names: readonly string[]) => void;
}

type GameState = ConfigSlice & PlaySlice & SearchSlice & SupplyRandomizerSlice & ExpansionsSlice;

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
  setAllowConsecutiveNemesis: (allow) => set({ allowConsecutiveNemesis: allow }),
  setAllowConsecutivePlayer: (allow) => set({ allowConsecutivePlayer: allow }),
  setVisibilityOption: (opt) => {
    const currentDrawPile = get().drawPile || [];
    const newDrawPile = currentDrawPile.length > 0 ? applyVisibility(currentDrawPile, opt) : [];
    set({ visibilityOption: opt, drawPile: newDrawPile });
  },
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
    let newDiscard = [...state.discardPile];

    let newDrawPile = [...state.drawPile];
    let nextCard = null;

    if (newDrawPile.length > 0) {
      nextCard = newDrawPile.shift() || null;
      if (nextCard) {
        nextCard = { ...nextCard, isRevealed: true };
        newDiscard.push(nextCard);
      }
      
      newDrawPile = applyVisibility(newDrawPile, state.visibilityOption);

      const turnHistory = nextCard ? [...state.turnHistory, { roundNumber: state.roundNumber, card: nextCard }] : state.turnHistory;

      set({
        discardPile: newDiscard,
        drawPile: newDrawPile,
        turnHistory,
      });
    } else {
      const initialDeck = generateDeck(state.playerCount, state.customDeck);
      const lastTurnType = state.discardPile.length > 0 ? state.discardPile[state.discardPile.length - 1].type : null;
      let shuffled = shuffleDeck(initialDeck, state.allowConsecutiveNemesis, state.allowConsecutivePlayer, lastTurnType);
      
      nextCard = shuffled.shift() || null;
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

  moveCard: (source, cardId, destination, position) => {
    const state = get();
    let drawPile = [...state.drawPile];
    let discardPile = [...state.discardPile];

    let cardToMove: Card | undefined;
    if (source === 'draw') {
      const index = drawPile.findIndex(c => c.id === cardId);
      if (index !== -1) {
        cardToMove = drawPile[index];
        drawPile.splice(index, 1);
      }
    } else if (source === 'discard') {
      const index = discardPile.findIndex(c => c.id === cardId);
      if (index !== -1) {
        cardToMove = discardPile[index];
        discardPile.splice(index, 1);
      }
    }

    if (!cardToMove) return;

    if (destination === 'draw') {
      if (position === 'top') {
        drawPile.unshift(cardToMove);
      } else if (position === 'bottom') {
        drawPile.push(cardToMove);
      } else if (position === 'shuffled') {
        drawPile.push(cardToMove);
        const lastTurnType = discardPile.length > 0 ? discardPile[discardPile.length - 1].type : null;
        drawPile = shuffleDeck(drawPile, state.allowConsecutiveNemesis, state.allowConsecutivePlayer, lastTurnType);
      }
      drawPile = applyVisibility(drawPile, state.visibilityOption);
    } else if (destination === 'discard') {
      cardToMove = { ...cardToMove, isRevealed: true };
      discardPile.push(cardToMove);
    }

    const turnHistory = updateRoundHistory(state.turnHistory, state.roundNumber, discardPile);

    set({ drawPile, discardPile, turnHistory });
  },

  setPiles: (newDrawPile, newDiscardPile) => {
    const state = get();
    const currentTotal = state.drawPile.length + state.discardPile.length;
    const newTotal = newDrawPile.length + newDiscardPile.length;
    if (currentTotal !== newTotal) {
      console.warn(`Card move rejected: card count changed from ${currentTotal} to ${newTotal}`);
      return false;
    }
    
    newDiscardPile = newDiscardPile.map(c => ({ ...c, isRevealed: true }));
    newDrawPile = applyVisibility(newDrawPile, state.visibilityOption);

    const turnHistory = updateRoundHistory(state.turnHistory, state.roundNumber, newDiscardPile);

    set({ drawPile: newDrawPile, discardPile: newDiscardPile, turnHistory });
    return true;
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

/**
 * Creates the app-wide "Expansions" slice. These two actions are the only writers
 * of ownedExpansions; no "Clear Filters" action may touch it.
 */
const createExpansionsSlice: StateCreator<GameState, [], [], ExpansionsSlice> = (set) => ({
  ownedExpansions: [],
  toggleOwnedExpansion: (name) => set((state) => {
    if (!ALL_EXPANSIONS.includes(name)) return {};
    const current = state.ownedExpansions;
    return {
      ownedExpansions: current.includes(name)
        ? current.filter((n) => n !== name)
        : [...current, name],
    };
  }),
  setOwnedExpansions: (names) => set({
    ownedExpansions: ALL_EXPANSIONS.filter((name) => names.includes(name)),
  }),
});

/**
 * localStorage adapter that keeps the app usable when storage is blocked or full
 * (private mode, quota exceeded): each storage call is individually guarded and the
 * failure is logged with console.error. Payload contents are never logged.
 * window.localStorage is resolved lazily inside the guard because the getter itself
 * can throw when storage access is denied.
 */
const loggingLocalStorage: StateStorage = {
  getItem: (name) => {
    try {
      return window.localStorage.getItem(name);
    } catch (e) {
      console.error('Failed to read persisted state', e);
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      window.localStorage.setItem(name, value);
    } catch (e) {
      console.error('Failed to persist state (session continues in memory)', e);
    }
  },
  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name);
    } catch (e) {
      console.error('Failed to remove persisted state', e);
    }
  },
};

export const useGameStore = create<GameState>()(
  persist(
    (...a) => ({
      ...createConfigSlice(...a),
      ...createPlaySlice(...a),
      ...createSearchSlice(...a),
      ...createRandomizerSlice(...a),
      ...createExpansionsSlice(...a),
    }),
    {
      name: 'aeons-end-game-storage',
      storage: createJSONStorage(() => loggingLocalStorage),
      onRehydrateStorage: () => (_state, error) => {
        if (error) console.error('Failed to rehydrate persisted state', error);
      },
      merge: (persistedState: any, currentState) => {
        try {
          if (!persistedState) return currentState;
          const validated = GameStateSchema.parse(persistedState);
          return { ...currentState, ...validated };
        } catch (e) {
          console.error('Failed to parse persisted state', e);
          return currentState;
        }
      },
    }
  )
);


