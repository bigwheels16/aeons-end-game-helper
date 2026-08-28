import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { z } from 'zod';
import { Card, generateDeck, shuffleDeck } from './deckEngine';

/**
 * Supported visibility options for upcoming turn order cards:
 * - `current`: Show only the current turn card face; all draw pile cards are face-down.
 * - `next`: Show current turn and reveal the next upcoming card face.
 * - `all`: Show current turn and reveal all upcoming card faces in the round.
 */
export type VisibilityOption = 'current' | 'next' | 'all';

/** Schema for validating card type in persisted storage */
const CardTypeSchema = z.enum(['Player 1', 'Player 2', 'Player 3', 'Player 4', 'Nemesis', 'Wild']);

/** Schema for validating Card objects in persisted storage */
const CardSchema = z.object({
  id: z.string(),
  type: CardTypeSchema,
  imageFaceUrl: z.string(),
});

/** Schema for validating VisibilityOption in persisted storage */
const VisibilityOptionSchema = z.enum(['current', 'next', 'all']);

/** Schema for validating full persisted GameState */
const GameStateSchema = z.object({
  playerCount: z.number().min(1).max(4),
  allowConsecutiveNemesis: z.boolean(),
  visibilityOption: VisibilityOptionSchema,
  isPlaying: z.boolean(),
  drawPile: z.array(CardSchema),
  discardPile: z.array(CardSchema),
  currentTurn: CardSchema.nullable(),
  roundNumber: z.number().min(0),
});

/**
 * Complete Game State interface including state properties and mutation actions.
 */
interface GameState {
  /** Selected number of players (1 to 4). */
  playerCount: number;
  /** Whether consecutive Nemesis turns are allowed across turns and round boundaries. */
  allowConsecutiveNemesis: boolean;
  /** Visibility configuration for previewing draw pile cards. */
  visibilityOption: VisibilityOption;
  /** Whether a game session is actively in progress. */
  isPlaying: boolean;
  
  /** Remaining unrevealed/unplayed cards in the current round draw pile. */
  drawPile: Card[];
  /** Previously played cards in the current round (discard pile history). */
  discardPile: Card[];
  /** Currently active turn card. */
  currentTurn: Card | null;
  /** Current round number (1-indexed during play, 0 when inactive). */
  roundNumber: number;

  /** Set the player count (1-4) */
  setPlayerCount: (count: number) => void;
  /** Toggle whether consecutive Nemesis turns are permitted */
  setAllowConsecutiveNemesis: (allow: boolean) => void;
  /** Set the turn order visibility preview option */
  setVisibilityOption: (opt: VisibilityOption) => void;
  
  /** Initialize and start a new game session with current configuration */
  startGame: () => void;
  /** Advance to the next turn or start a new round if the draw pile is exhausted */
  nextTurn: () => void;
  /** Reset active game state and return to configuration screen */
  endGame: () => void;
  
  /**
   * Shuffles the remaining cards in the active draw pile.
   *
   * Utilizes the Fisher-Yates engine while honoring the `allowConsecutiveNemesis`
   * setting relative to the currently active turn. Gracefully ignores calls
   * if the draw pile has 1 or fewer cards.
   */
  shuffleDrawPile: () => void;

  /**
   * Moves a specific card between the Draw and Discard piles.
   *
   * @param source - The source pile containing the card ('draw' or 'discard')
   * @param cardId - Unique identifier of the card to move
   * @param destination - The target pile ('draw' or 'discard')
   * @param position - Insertion position when moving into the draw pile ('top', 'bottom', or 'shuffled').
   *                   When moving to discard, the card is appended to the discard history.
   */
  moveCard: (
    source: 'draw' | 'discard',
    cardId: string,
    destination: 'draw' | 'discard',
    position: 'top' | 'bottom' | 'shuffled'
  ) => void;
}

/**
 * Zustand game store with localStorage persistence and Zod schema validation.
 */
export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      playerCount: 1,
      allowConsecutiveNemesis: true,
      visibilityOption: 'current',
      isPlaying: false,
      
      drawPile: [],
      discardPile: [],
      currentTurn: null,
      roundNumber: 0,

      setPlayerCount: (count) => set({ playerCount: count }),
      setAllowConsecutiveNemesis: (allow) => set({ allowConsecutiveNemesis: allow }),
      setVisibilityOption: (opt) => set({ visibilityOption: opt }),

      startGame: () => {
        const state = get();
        const initialDeck = generateDeck(state.playerCount);
        const shuffled = shuffleDeck(initialDeck, state.allowConsecutiveNemesis, null);
        
        set({
          isPlaying: true,
          drawPile: shuffled,
          discardPile: [],
          currentTurn: null,
          roundNumber: 1,
        });
      },

      nextTurn: () => {
        const state = get();
        let newDiscard = [...state.discardPile];
        if (state.currentTurn) {
          newDiscard.push(state.currentTurn);
        }

        let newDrawPile = [...state.drawPile];
        let nextCard = null;

        if (newDrawPile.length > 0) {
          nextCard = newDrawPile.shift() || null;
          set({
            discardPile: newDiscard,
            currentTurn: nextCard,
            drawPile: newDrawPile,
          });
        } else {
          // Deck is empty, start new round
          const initialDeck = generateDeck(state.playerCount);
          const lastTurnType = state.currentTurn ? state.currentTurn.type : null;
          const shuffled = shuffleDeck(initialDeck, state.allowConsecutiveNemesis, lastTurnType);
          
          nextCard = shuffled.shift() || null;
          
          set({
            discardPile: [],
            currentTurn: nextCard,
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
          currentTurn: null,
          roundNumber: 0,
        });
      },

      shuffleDrawPile: () => {
        const state = get();
        // Disregard shuffle requests when draw pile is empty or has only a single card
        if (state.drawPile.length <= 1) return;
        
        const lastTurnType = state.currentTurn ? state.currentTurn.type : null;
        const newDrawPile = shuffleDeck([...state.drawPile], state.allowConsecutiveNemesis, lastTurnType);
        
        set({ drawPile: newDrawPile });
      },

      moveCard: (source, cardId, destination, position) => {
        const state = get();
        let drawPile = [...state.drawPile];
        let discardPile = [...state.discardPile];

        // 1. Locate and extract target card from the source pile
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

        // Abort if card does not exist in the designated source pile
        if (!cardToMove) return;

        // 2. Insert card into the destination pile based on requested placement
        if (destination === 'draw') {
          if (position === 'top') {
            drawPile.unshift(cardToMove);
          } else if (position === 'bottom') {
            drawPile.push(cardToMove);
          } else if (position === 'shuffled') {
            drawPile.push(cardToMove);
            // Re-shuffle the draw pile while preserving consecutive Nemesis constraints
            const lastTurnType = state.currentTurn ? state.currentTurn.type : null;
            drawPile = shuffleDeck(drawPile, state.allowConsecutiveNemesis, lastTurnType);
          }
        } else if (destination === 'discard') {
          // Cards moved to discard are appended to the discard history
          discardPile.push(cardToMove);
        }

        // Update state without modifying round counter or triggering round advances
        set({ drawPile, discardPile });
      },
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
