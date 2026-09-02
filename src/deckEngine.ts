/**
 * Turn Order Deck Logic and Engine for Aeon's End.
 *
 * Handles deck construction based on player counts and shuffling algorithms,
 * including validation for preventing consecutive Nemesis turns across rounds.
 */

/**
 * Valid card types in the Aeon's End turn order deck.
 */
export type CardType = 'Player 1' | 'Player 2' | 'Player 3' | 'Player 4' | 'Nemesis' | 'Wild' | 'Player 1/2' | 'Player 3/4';

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
 * Official card face image URLs sourced from the Aeon's End Wiki.
 * @see https://aeonsend.wiki.gg/wiki/Turn_Order_Deck
 */
export const CARD_IMAGES: Record<CardType, string> = {
  'Player 1': 'https://aeonsend.wiki.gg/images/Turn_Order_Card_1.jpg',
  'Player 2': 'https://aeonsend.wiki.gg/images/Turn_Order_Card_2.jpg',
  'Player 3': 'https://aeonsend.wiki.gg/images/Turn_Order_Card_3.jpg',
  'Player 4': 'https://aeonsend.wiki.gg/images/Turn_Order_Card_4.jpg',
  'Nemesis': 'https://aeonsend.wiki.gg/images/Turn_Order_Card_Nemesis.jpg',
  'Wild': 'https://aeonsend.wiki.gg/images/Turn_Order_Card_Wild.jpg',
  'Player 1/2': 'https://aeonsend.wiki.gg/images/Turn_Order_Card_1_2.jpg',
  'Player 3/4': 'https://aeonsend.wiki.gg/images/Turn_Order_Card_3_4.jpg'
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
 * - Resets `isRevealed` on all cards in the deck upon shuffling.
 *
 * @param deck - The deck of cards to shuffle
 * @param allowConsecutiveNemesis - Whether back-to-back Nemesis turns are permitted
 * @param lastTurnType - The card type played on the last turn of the previous round, if applicable
 * @returns A newly shuffled array of Card objects
 */
export function shuffleDeck(
  deck: Card[],
  allowConsecutiveNemesis: boolean,
  allowConsecutivePlayer: boolean,
  lastTurnType: CardType | null
): Card[] {
  let shuffled = deck.map(c => {
    const { isRevealed, ...rest } = c;
    return rest as Card;
  });
  let valid = false;
  let attempts = 0;

  const isPlayerCard = (type: CardType) => type.startsWith('Player');

  // We will just try 100 times. If it fails, it returns the last attempt.
  // This handles both unavoidable cases (returns whatever it gets) and
  // allows us to reuse the same logic for all scenarios.

  while (!valid && attempts < 100) {
    // Fisher-Yates shuffle
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    valid = true;
    
    // Check first card against last turn of previous round
    if (!allowConsecutiveNemesis && lastTurnType === 'Nemesis' && shuffled[0].type === 'Nemesis') {
      valid = false;
    }
    if (!allowConsecutivePlayer && lastTurnType && isPlayerCard(lastTurnType) && shuffled[0].type === lastTurnType) {
      valid = false;
    }

    // Check consecutive cards in the new deck
    for (let i = 0; i < shuffled.length - 1; i++) {
      if (!allowConsecutiveNemesis && shuffled[i].type === 'Nemesis' && shuffled[i + 1].type === 'Nemesis') {
        valid = false;
        break;
      }
      if (!allowConsecutivePlayer && isPlayerCard(shuffled[i].type) && shuffled[i].type === shuffled[i + 1].type) {
        valid = false;
        break;
      }
    }

    attempts++;
  }

  return shuffled;
}
