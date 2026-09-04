import { ScrapedSupplyCard } from './types/scraped';
import { SlotCriteria } from './store';

/**
 * Solves supply card assignments across configured slots using depth-first backtracking
 * with the Most Constrained Variable (MRV) heuristic. Ensures 100% unique card selection
 * without duplicates across all slots.
 *
 * @param slots List of slot criteria specifying type, cost range, and search terms
 * @param availableCards Pool of supply cards filtered by selected expansions
 * @returns Map of slot ID to unique ScrapedSupplyCard, or null if no valid assignment exists
 */
export function solveSupplyRandomizer(
  slots: SlotCriteria[],
  availableCards: ScrapedSupplyCard[]
): Record<string, ScrapedSupplyCard> | null {
  // Sort slots by Most Constrained Variable (MRV) heuristic
  // i.e., by the number of matching available cards ascending.

  // First, precompute matching cards for each slot
  const slotCandidates: Record<string, ScrapedSupplyCard[]> = {};
  
  for (const slot of slots) {
    const candidates = availableCards.filter(card => isCardMatch(card, slot));
    slotCandidates[slot.id] = candidates;
  }

  const sortedSlots = [...slots].sort((a, b) => {
    return slotCandidates[a.id].length - slotCandidates[b.id].length;
  });

  const assignment: Record<string, ScrapedSupplyCard> = {};
  const usedCards = new Set<string>(); // Use name as unique identifier since id might be missing or name is unique

  let stepCount = 0;
  const MAX_STEPS = 1000;

  function backtrack(slotIndex: number): boolean {
    if (stepCount >= MAX_STEPS) {
      throw new Error("Timeout: exceeded maximum steps in randomization");
    }
    stepCount++;

    if (slotIndex === sortedSlots.length) {
      return true; // All slots assigned successfully
    }

    const currentSlot = sortedSlots[slotIndex];
    let candidates = slotCandidates[currentSlot.id];

    // Optional: shuffle candidates to ensure randomization
    candidates = shuffleArray([...candidates]);

    for (const card of candidates) {
      const uniqueId = card.id || card.name;
      if (!usedCards.has(uniqueId)) {
        assignment[currentSlot.id] = card;
        usedCards.add(uniqueId);

        if (backtrack(slotIndex + 1)) {
          return true;
        }

        // Undo assignment
        delete assignment[currentSlot.id];
        usedCards.delete(uniqueId);
      }
    }

    return false;
  }

  try {
    if (backtrack(0)) {
      return assignment;
    }
    return null;
  } catch (err) {
    console.error(err);
    return null;
  }
}

import { stripHtml } from './utils/text';

/**
 * Checks whether a supply card satisfies the criteria specified for a slot.
 * Matches against card type, cost range, and name/effect search text.
 *
 * @param card The supply card candidate
 * @param slot The slot criteria to evaluate against
 * @returns True if the card satisfies all slot criteria
 */
export function isCardMatch(card: ScrapedSupplyCard, slot: SlotCriteria): boolean {
  if (!card) return false;

  // Type filter
  if (slot.cardTypes !== undefined) {
    if (!card.type || !slot.cardTypes.includes(card.type as any)) {
      return false;
    }
  } else if (slot.cardType && card.type !== slot.cardType) {
    return false;
  }

  // Cost filter
  const cardCost = card.cost !== undefined ? Number(card.cost) || 0 : 0;
  if (cardCost < slot.costRange[0] || cardCost > slot.costRange[1]) {
    return false;
  }

  // Search filter
  if (slot.searchTerm && slot.searchTerm.trim() !== '') {
    const terms = slot.searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
    const searchableText = [
      card.name,
      card.effect ? stripHtml(card.effect) : ''
    ].join(' ').toLowerCase();

    if (!terms.every(term => searchableText.includes(term))) {
      return false;
    }
  }

  return true;
}

/**
 * Performs an in-place Fisher-Yates shuffle on an array to randomize candidate selection.
 *
 * @param array Array of items to shuffle
 * @returns Shuffled array
 */
function shuffleArray<T>(array: T[]): T[] {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}
