/**
 * Turn Order Deck Logic and Engine for Aeon's End.
 *
 * Handles deck construction based on player counts and shuffling algorithms,
 * including validation for preventing consecutive Nemesis turns across rounds.
 */

/**
 * Valid card types in the Aeon's End turn order deck.
 */
export type CardType = 'Player 1' | 'Player 2' | 'Player 3' | 'Player 4' | 'Nemesis' | 'Wild';

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
}

/**
 * Official card face image URLs sourced from the Aeon's End Wiki.
 * @see https://aeonsend.wiki.gg/wiki/Turn_Order_Deck
 */
export const CARD_IMAGES: Record<CardType, string> = {
  'Player 1': '/assets/images/Player_1.jpg',
  'Player 2': '/assets/images/Player_2.jpg',
  'Player 3': '/assets/images/Player_3.jpg',
  'Player 4': '/assets/images/Player_4.jpg',
  'Nemesis': '/assets/images/Nemesis.jpg',
  'Wild': '/assets/images/Wild.jpg',
};

/**
 * Official card back image URL sourced from the Aeon's End Wiki.
 * @see https://aeonsend.wiki.gg/wiki/Turn_Order_Deck
 */
export const CARD_BACK_URL = '/assets/images/Card_Back.svg';

/**
 * Generates the standard Aeon's End turn order deck based on player count.
 *
 * Card distribution rules:
 * - 1 Player: 3x Player 1, 2x Nemesis (5 cards total)
 * - 2 Players: 2x Player 1, 2x Player 2, 2x Nemesis (6 cards total)
 * - 3 Players: 1x Player 1, 1x Player 2, 1x Player 3, 1x Wild, 2x Nemesis (6 cards total)
 * - 4 Players: 1x Player 1, 1x Player 2, 1x Player 3, 1x Player 4, 2x Nemesis (6 cards total)
 *
 * @param playerCount - Number of players (1 to 4)
 * @returns Array of Card objects representing the initial round deck
 */
export function generateDeck(playerCount: number): Card[] {
  const cards: CardType[] = [];
  if (playerCount === 1) {
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
 *
 * @param deck - The deck of cards to shuffle
 * @param allowConsecutiveNemesis - Whether back-to-back Nemesis turns are permitted
 * @param lastTurnType - The card type played on the last turn of the previous round, if applicable
 * @returns A newly shuffled array of Card objects
 */
export function shuffleDeck(
  deck: Card[],
  allowConsecutiveNemesis: boolean,
  lastTurnType: CardType | null
): Card[] {
  let shuffled = [...deck];
  let valid = false;
  let attempts = 0;

  // Unavoidable case check: if all remaining cards are Nemesis, consecutive is unavoidable
  const allNemesis = deck.every(c => c.type === 'Nemesis');
  if (allNemesis || allowConsecutiveNemesis) {
    // Fisher-Yates shuffle
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  while (!valid && attempts < 100) {
    // Fisher-Yates shuffle
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    valid = true;
    
    // Check first card against last turn of previous round
    if (lastTurnType === 'Nemesis' && shuffled[0].type === 'Nemesis') {
      valid = false;
    }

    // Check consecutive Nemesis cards in the new deck
    for (let i = 0; i < shuffled.length - 1; i++) {
      if (shuffled[i].type === 'Nemesis' && shuffled[i + 1].type === 'Nemesis') {
        valid = false;
        break;
      }
    }

    attempts++;
  }

  return shuffled;
}
