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
  isRevealed: z.boolean().optional(),
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
  
  /** 
   * Remaining cards in the current round draw pile.
   * Face orientation of each card is determined by its `isRevealed` property.
   */
  drawPile: Card[];
  /** 
   * Previously played cards in the current round (discard pile history). 
   * The top card (last element: `discardPile[discardPile.length - 1]`) represents the currently active turn.
   * Cards in the discard pile have `isRevealed: true`.
   */
  discardPile: Card[];
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
  /** 
   * Advance to the next turn or start a new round if the draw pile is exhausted.
   * Moves the drawn card to the discard pile with `isRevealed: true`, and applies visibility to the remaining draw pile.
   */
  nextTurn: () => void;
  /** Reset active game state and return to configuration screen */
  endGame: () => void;
  
  /**
   * Manually reveals specific cards in the draw pile by setting `isRevealed: true`. 
   * This state persists until the card is drawn or the pile is shuffled.
   * @param indices Array of indices in the draw pile to reveal.
   */
  revealCards: (indices: number[]) => void;
  
  /**
   * Shuffles the remaining cards in the active draw pile.
   *
   * Utilizes the Fisher-Yates engine while honoring the `allowConsecutiveNemesis`
   * setting relative to the currently active turn (top card of the discard pile). Gracefully ignores calls
   * if the draw pile has 1 or fewer cards. Resets reveals and re-applies current visibility configuration.
   */
  shuffleDrawPile: () => void;

  /**
   * Moves a specific card between the Draw and Discard piles.
   *
   * @param source - The source pile containing the card ('draw' or 'discard')
   * @param cardId - Unique identifier of the card to move
   * @param destination - The target pile ('draw' or 'discard')
   * @param position - Insertion position when moving into the draw pile ('top', 'bottom', or 'shuffled').
   *                   When moving to discard, the card is marked with `isRevealed: true` and appended to history.
   */
  moveCard: (
    source: 'draw' | 'discard',
    cardId: string,
    destination: 'draw' | 'discard',
    position: 'top' | 'bottom' | 'shuffled'
  ) => void;

  /**
   * Commits newly arranged Draw and Discard piles from drag-and-drop Edit Mode.
   *
   * Enforces deck integrity validation (anti-cheating) to ensure the total number
   * of cards across both piles remains identical before committing the state changes.
   * Ensures all cards in the discard pile have `isRevealed: true` and re-applies visibility to the draw pile.
   *
   * @param newDrawPile - The new ordered list of cards in the Draw Pile
   * @param newDiscardPile - The new ordered list of cards in the Discard Pile
   * @returns true if the operation was successful, false if validation failed
   */
  setPiles: (newDrawPile: Card[], newDiscardPile: Card[]) => boolean;
}

/**
 * Applies the given visibility option to the draw pile by setting `isRevealed: true`
 * on applicable cards (single source of truth for face up orientation):
 * - 'current': No additional cards revealed in draw pile
 * - 'next': Top card (index 0) of draw pile is marked `isRevealed: true`
 * - 'all': All cards in draw pile are marked `isRevealed: true`
 *
 * @param drawPile - Array of cards in the draw pile
 * @param visibilityOption - The active visibility configuration ('current' | 'next' | 'all')
 * @returns Updated array of cards with `isRevealed` applied
 */
const applyVisibility = (drawPile: Card[], visibilityOption: VisibilityOption): Card[] => {
  let newPile = [...drawPile];
  if (visibilityOption === 'next' && newPile.length > 0) {
    newPile[0] = { ...newPile[0], isRevealed: true };
  } else if (visibilityOption === 'all') {
    newPile = newPile.map(c => ({ ...c, isRevealed: true }));
  }
  return newPile;
};

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
      roundNumber: 0,

      setPlayerCount: (count) => set({ playerCount: count }),
      setAllowConsecutiveNemesis: (allow) => set({ allowConsecutiveNemesis: allow }),
      setVisibilityOption: (opt) => set({ visibilityOption: opt }),

      startGame: () => {
        const state = get();
        const initialDeck = generateDeck(state.playerCount);
        let shuffled = shuffleDeck(initialDeck, state.allowConsecutiveNemesis, null);
        
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
          // Deck is empty, start new round
          const initialDeck = generateDeck(state.playerCount);
          const lastTurnType = state.discardPile.length > 0 ? state.discardPile[state.discardPile.length - 1].type : null;
          let shuffled = shuffleDeck(initialDeck, state.allowConsecutiveNemesis, lastTurnType);
          
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
        // Disregard shuffle requests when draw pile is empty or has only a single card
        if (state.drawPile.length <= 1) return;
        
        const lastTurnType = state.discardPile.length > 0 ? state.discardPile[state.discardPile.length - 1].type : null;
        let newDrawPile = shuffleDeck([...state.drawPile], state.allowConsecutiveNemesis, lastTurnType);
        
        newDrawPile = applyVisibility(newDrawPile, state.visibilityOption);

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
            const lastTurnType = discardPile.length > 0 ? discardPile[discardPile.length - 1].type : null;
            drawPile = shuffleDeck(drawPile, state.allowConsecutiveNemesis, lastTurnType);
          }
          drawPile = applyVisibility(drawPile, state.visibilityOption);
        } else if (destination === 'discard') {
          // Cards moved to discard are appended to the discard history
          cardToMove = { ...cardToMove, isRevealed: true };
          discardPile.push(cardToMove);
        }

        // Update state without modifying round counter or triggering round advances
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
