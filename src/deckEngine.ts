/**
 * Turn Order Deck Logic and Engine for Aeon's End.
 *
 * Handles deck construction based on player counts and shuffling algorithms,
 * including validation for preventing consecutive Nemesis turns across rounds.
 */

import { shuffleInPlace } from './utils/shuffle';
import { imageUrl } from './utils/wikiUrls';

/**
 * Valid card types in the Aeon's End turn order deck.
 */
export const CARD_TYPES = [
  'Player 1',
  'Player 2',
  'Player 3',
  'Player 4',
  'Nemesis',
  'Wild',
  'Player 1/2',
  'Player 3/4',
] as const;

export type CardType = (typeof CARD_TYPES)[number];

/**
 * Represents a single turn order card.
 */
export interface Card {
  /** Unique identifier for the card instance within a round. */
  id: string;
  /** Turn card type/designation. */
  type: CardType;
  /** URL for the official card face image. */
  imageFaceUrl: string;
  /**
   * Whether the card face is currently revealed.
   * Serves as the single source of truth for whether the card is rendered face up or face down.
   */
  isRevealed?: boolean;
}

/**
 * Card face image URLs: hosted copies of the Aeon's End Wiki's turn order card images.
 * @see https://aeonsend.wiki.gg/wiki/Turn_Order_Deck
 */
export const CARD_IMAGES: Record<CardType, string> = {
  'Player 1': imageUrl('Turn_Order_Card_1.webp'),
  'Player 2': imageUrl('Turn_Order_Card_2.webp'),
  'Player 3': imageUrl('Turn_Order_Card_3.webp'),
  'Player 4': imageUrl('Turn_Order_Card_4.webp'),
  'Nemesis': imageUrl('Turn_Order_Card_Nemesis.webp'),
  'Wild': imageUrl('Turn_Order_Card_Wild.webp'),
  'Player 1/2': imageUrl('Turn_Order_Card_1_2.webp'),
  'Player 3/4': imageUrl('Turn_Order_Card_3_4.webp')
};

/**
 * Official card back image URL sourced from the Aeon's End Wiki.
 * @see https://aeonsend.wiki.gg/wiki/Turn_Order_Deck
 */
export const CARD_BACK_URL = '/assets/images/Card_Back.svg';

/**
 * Generates the Aeon's End turn order deck based on player count or custom deck configuration.
 *
 * Card distribution rules:
 * - 1 Player: 3x Player 1, 2x Nemesis (5 cards total)
 * - 2 Players: 2x Player 1, 2x Player 2, 2x Nemesis (6 cards total)
 * - 3 Players: 1x Player 1, 1x Player 2, 1x Player 3, 1x Wild, 2x Nemesis (6 cards total)
 * - 4 Players: 1x Player 1, 1x Player 2, 1x Player 3, 1x Player 4, 2x Nemesis (6 cards total)
 * - Custom: Custom card array supplied via `customDeck`
 *
 * @param playerCount - Number of players (1 to 4) or 'custom'
 * @param customDeck - Optional array of CardType for custom deck mode (defaults to empty array)
 * @returns Array of Card objects representing the initial round deck
 */
export function generateDeck(playerCount: number | 'custom', customDeck: CardType[] = []): Card[] {
  let cards: CardType[] = [];
  if (playerCount === 'custom') {
    cards = [...customDeck];
  } else if (playerCount === 1) {
    cards.push('Player 1', 'Player 1', 'Player 1', 'Nemesis', 'Nemesis');
  } else if (playerCount === 2) {
    cards.push('Player 1', 'Player 1', 'Player 2', 'Player 2', 'Nemesis', 'Nemesis');
  } else if (playerCount === 3) {
    cards.push('Player 1', 'Player 2', 'Player 3', 'Wild', 'Nemesis', 'Nemesis');
  } else if (playerCount === 4) {
    cards.push('Player 1', 'Player 2', 'Player 3', 'Player 4', 'Nemesis', 'Nemesis');
  }

  return cards.map((type, index) => ({
    id: `${type}-${index}`,
    type,
    imageFaceUrl: CARD_IMAGES[type],
  }));
}

/**
 * Shuffles the turn order deck with Fisher-Yates and applies Nemesis turn constraints.
 *
 * Rules:
 * - If `allowConsecutiveNemesis` is false:
 *   - Ensures no two Nemesis cards appear consecutively within the round deck.
 *   - If the previous round ended with a Nemesis turn (`lastTurnType === 'Nemesis'`),
 *     the new round will not begin with a Nemesis turn.
 *   - In unavoidable cases (e.g. deck contains only Nemesis cards), rule is suspended.
 * - If `repeating` is true, the order is played every round, so its last card is also checked against its first.
 * - Resets `isRevealed` on all cards in the deck upon shuffling.
 *
 * @param deck - The deck of cards to shuffle
 * @param allowConsecutiveNemesis - Whether back-to-back Nemesis turns are permitted
 * @param lastTurnType - The card type played on the last turn of the previous round, if applicable
 * @param repeating - Whether the shuffled order is kept for every later round
 * @returns A newly shuffled array of Card objects
 */
export function shuffleDeck(
  deck: Card[],
  allowConsecutiveNemesis: boolean,
  allowConsecutivePlayer: boolean,
  lastTurnType: CardType | null,
  repeating = false
): Card[] {
  let shuffled = deck.map(c => {
    const { isRevealed, ...rest } = c;
    return rest as Card;
  });
  let valid = false;
  let attempts = 0;

  const isPlayerCard = (type: CardType) => type.startsWith('Player');
  const isForbiddenPair = (first: CardType, second: CardType) =>
    (!allowConsecutiveNemesis && first === 'Nemesis' && second === 'Nemesis') ||
    (!allowConsecutivePlayer && isPlayerCard(first) && first === second);

  // We will just try 100 times. If it fails, it returns the last attempt.
  // This handles both unavoidable cases (returns whatever it gets) and
  // allows us to reuse the same logic for all scenarios.

  while (!valid && attempts < 100) {
    shuffleInPlace(shuffled);

    valid = true;
    
    // Check first card against last turn of previous round
    if (lastTurnType && shuffled.length > 0 && isForbiddenPair(lastTurnType, shuffled[0].type)) {
      valid = false;
    }

    // Check the last card against the first one when the order repeats
    if (repeating && shuffled.length > 1 && isForbiddenPair(shuffled[shuffled.length - 1].type, shuffled[0].type)) {
      valid = false;
    }

    // Check consecutive cards in the new deck
    for (let i = 0; i < shuffled.length - 1; i++) {
      if (isForbiddenPair(shuffled[i].type, shuffled[i + 1].type)) {
        valid = false;
        break;
      }
    }

    attempts++;
  }

  return shuffled;
}
