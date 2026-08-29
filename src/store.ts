
import { create, StateCreator } from 'zustand';
import { persist } from 'zustand/middleware';
import { z } from 'zod';
import { Card, generateDeck, shuffleDeck } from './deckEngine';

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
  playerCount: z.number().min(1).max(4),
  allowConsecutiveNemesis: z.boolean(),
  allowConsecutivePlayer: z.boolean().default(true),
  visibilityOption: VisibilityOptionSchema,
  isPlaying: z.boolean(),
  drawPile: z.array(CardSchema),
  discardPile: z.array(CardSchema),
  roundNumber: z.number().min(0),
});

export interface ConfigSlice {
  playerCount: number;
  allowConsecutiveNemesis: boolean;
  allowConsecutivePlayer: boolean;
  visibilityOption: VisibilityOption;
  setPlayerCount: (count: number) => void;
  setAllowConsecutiveNemesis: (allow: boolean) => void;
  setAllowConsecutivePlayer: (allow: boolean) => void;
  setVisibilityOption: (opt: VisibilityOption) => void;
}

export interface PlaySlice {
  isPlaying: boolean;
  drawPile: Card[];
  discardPile: Card[];
  roundNumber: number;
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

type GameState = ConfigSlice & PlaySlice;

const applyVisibility = (drawPile: Card[], visibilityOption: VisibilityOption): Card[] => {
  let newPile = [...drawPile];
  if (visibilityOption === 'next' && newPile.length > 0) {
    newPile[0] = { ...newPile[0], isRevealed: true };
  } else if (visibilityOption === 'all') {
    newPile = newPile.map(c => ({ ...c, isRevealed: true }));
  }
  return newPile;
};

const createConfigSlice: StateCreator<GameState, [], [], ConfigSlice> = (set) => ({
  playerCount: 1,
  allowConsecutiveNemesis: true,
  allowConsecutivePlayer: true,
  visibilityOption: 'current',
  setPlayerCount: (count) => set({ playerCount: count }),
  setAllowConsecutiveNemesis: (allow) => set({ allowConsecutiveNemesis: allow }),
  setAllowConsecutivePlayer: (allow) => set({ allowConsecutivePlayer: allow }),
  setVisibilityOption: (opt) => set({ visibilityOption: opt }),
});

const createPlaySlice: StateCreator<GameState, [], [], PlaySlice> = (set, get) => ({
  isPlaying: false,
  drawPile: [],
  discardPile: [],
  roundNumber: 0,

  startGame: () => {
    const state = get();
    const initialDeck = generateDeck(state.playerCount);
    let shuffled = shuffleDeck(initialDeck, state.allowConsecutiveNemesis, state.allowConsecutivePlayer, null);
    
    shuffled = applyVisibility(shuffled, state.visibilityOption);
    
    set({
      isPlaying: true,
      drawPile: shuffled,
      discardPile: [],
      roundNumber: 1,
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

      set({
        discardPile: newDiscard,
        drawPile: newDrawPile,
      });
    } else {
      const initialDeck = generateDeck(state.playerCount);
      const lastTurnType = state.discardPile.length > 0 ? state.discardPile[state.discardPile.length - 1].type : null;
      let shuffled = shuffleDeck(initialDeck, state.allowConsecutiveNemesis, state.allowConsecutivePlayer, lastTurnType);
      
      nextCard = shuffled.shift() || null;
      if (nextCard) {
        nextCard = { ...nextCard, isRevealed: true };
      }
      
      shuffled = applyVisibility(shuffled, state.visibilityOption);
      
      set({
        discardPile: nextCard ? [nextCard] : [],
        drawPile: shuffled,
        roundNumber: state.roundNumber + 1,
      });
    }
  },

  endGame: () => {
    set({
      isPlaying: false,
      drawPile: [],
      discardPile: [],
      roundNumber: 0,
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

    set({ drawPile, discardPile });
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

    set({ drawPile: newDrawPile, discardPile: newDiscardPile });
    return true;
  },
});

export const useGameStore = create<GameState>()(
  persist(
    (...a) => ({
      ...createConfigSlice(...a),
      ...createPlaySlice(...a)
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

