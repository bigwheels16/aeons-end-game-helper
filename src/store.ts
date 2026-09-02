
import { create, StateCreator } from 'zustand';
import { persist } from 'zustand/middleware';
import { z } from 'zod';
import { Card, CardType, generateDeck, shuffleDeck } from './deckEngine';

export type VisibilityOption = 'current' | 'next' | 'all';

const CardTypeSchema = z.enum(['Player 1', 'Player 2', 'Player 3', 'Player 4', 'Nemesis', 'Wild']);

const CardSchema = z.object({
  id: z.string(),
  type: CardTypeSchema,
  imageFaceUrl: z.string(),
  isRevealed: z.boolean().optional(),
});

const VisibilityOptionSchema = z.enum(['current', 'next', 'all']);

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
    nameQuery: z.string(),
    effectQuery: z.string(),
    selectedExpansions: z.array(z.string()),
    selectedTypes: z.array(z.string()),
    costRange: z.tuple([z.number(), z.number()]),
    showImages: z.boolean().default(false),
  }).optional(),
  mageSearchFilters: z.object({
    mageQuery: z.string(),
    selectedMageExpansions: z.array(z.string()),
  }).optional(),
  nemesisSearchFilters: z.object({
    nemesisQuery: z.string(),
    selectedNemesisExpansions: z.array(z.string()),
  }).optional(),
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

export interface PlaySlice {
  isPlaying: boolean;
  drawPile: Card[];
  discardPile: Card[];
  roundNumber: number;
  turnHistory: { roundNumber: number; card: Card }[];
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
  /** Text query matched against card name (partial match, case-insensitive) */
  nameQuery: string;
  /** Text query matched against card rules and effect text */
  effectQuery: string;
  /** List of selected expansion acronyms/identifiers to include in results */
  selectedExpansions: string[];
  /** List of selected card types ('Gem', 'Relic', 'Spell') to include in results */
  selectedTypes: string[];
  /** [minCost, maxCost] Aether cost bounds */
  costRange: [number, number];
  /** Whether to render the card image instead of text properties */
  showImages: boolean;
}

export interface MageSearchFilters {
  mageQuery: string;
  selectedMageExpansions: string[];
}

export interface NemesisSearchFilters {
  nemesisQuery: string;
  selectedNemesisExpansions: string[];
}

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
}

type GameState = ConfigSlice & PlaySlice & SearchSlice;

const applyVisibility = (drawPile: Card[], visibilityOption: VisibilityOption): Card[] => {
  let newPile = drawPile.map(c => ({ ...c, isRevealed: !!c.isRevealed }));
  if (visibilityOption === 'next' && newPile.length > 0) {
    newPile[0] = { ...newPile[0], isRevealed: true };
  } else if (visibilityOption === 'all') {
    newPile = newPile.map(c => ({ ...c, isRevealed: true }));
  }
  return newPile;
};

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

    const prevHistory = state.turnHistory.filter(h => h.roundNumber !== state.roundNumber);
    const newHistory = discardPile.map(card => ({ roundNumber: state.roundNumber, card }));
    const turnHistory = [...prevHistory, ...newHistory];

    set({ drawPile, discardPile, turnHistory });
  },

  setPiles: (newDrawPile, newDiscardPile) => {
    const state = get();
    const currentTotal = state.drawPile.length + state.discardPile.length;
    const newTotal = newDrawPile.length + newDiscardPile.length;
    if (currentTotal !== newTotal) {
      console.warn('Cheating detected: card count mismatch');
      return false;
    }
    
    newDiscardPile = newDiscardPile.map(c => ({ ...c, isRevealed: true }));
    newDrawPile = applyVisibility(newDrawPile, state.visibilityOption);

    const prevHistory = state.turnHistory.filter(h => h.roundNumber !== state.roundNumber);
    const newHistory = newDiscardPile.map(card => ({ roundNumber: state.roundNumber, card }));
    const turnHistory = [...prevHistory, ...newHistory];

    set({ drawPile: newDrawPile, discardPile: newDiscardPile, turnHistory });
    return true;
  },
});

/**
 * Creates the search filter state slice with default initial filter criteria.
 */
const createSearchSlice: StateCreator<GameState, [], [], SearchSlice> = (set) => ({
  searchFilters: {
    nameQuery: '',
    effectQuery: '',
    selectedExpansions: [],
    selectedTypes: [],
    costRange: [0, 10],
    showImages: false,
  },
  setSearchFilters: (filters) => set((state) => ({
    searchFilters: { ...state.searchFilters, ...filters }
  })),
  mageSearchFilters: {
    mageQuery: '',
    selectedMageExpansions: [],
  },
  setMageSearchFilters: (filters) => set((state) => ({
    mageSearchFilters: { ...state.mageSearchFilters, ...filters }
  })),
  nemesisSearchFilters: {
    nemesisQuery: '',
    selectedNemesisExpansions: [],
  },
  setNemesisSearchFilters: (filters) => set((state) => ({
    nemesisSearchFilters: { ...state.nemesisSearchFilters, ...filters }
  })),
});

export const useGameStore = create<GameState>()(
  persist(
    (...a) => ({
      ...createConfigSlice(...a),
      ...createPlaySlice(...a),
      ...createSearchSlice(...a),
    }),
    {
      name: 'aeons-end-game-storage',
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

