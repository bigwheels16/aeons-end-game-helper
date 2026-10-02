import scrapedData from '../../data/scraped/aeons_end_all.json';
import { getUniqueExpansions, ItemWithExpansions } from './cards';

/**
 * Union of every expansion name found across supply cards, mages and nemeses,
 * sorted. Derived once at module load.
 *
 * Scope: global, in-memory, never persisted. This is the only list of expansion
 * names the UI ever renders; persisted names are intersected with it first.
 */
export const ALL_EXPANSIONS: readonly string[] = Object.freeze(
  getUniqueExpansions([
    ...(scrapedData.supply || []),
    ...(scrapedData.mages || []),
    ...(scrapedData.nemeses || []),
  ])
);

/**
 * Returns the owned expansion names that exist in `all`, in `all` order, without
 * duplicates. Stale or unknown persisted names are dropped. An empty result means
 * "All Expansions" (no filtering).
 */
export function getEffectiveOwned(
  owned: readonly string[],
  all: readonly string[] = ALL_EXPANSIONS
): string[] {
  const ownedSet = new Set(owned);
  return all.filter((name) => ownedSet.has(name));
}

/**
 * Any-match expansion filter: an item matches if any of its expansions is in
 * `ownedSet`. A null or empty set means "All Expansions" and matches everything.
 */
export function matchesOwned(
  item: ItemWithExpansions,
  ownedSet: ReadonlySet<string> | null
): boolean {
  if (!ownedSet || ownedSet.size === 0) return true;
  return (item.expansions || []).some((exp) => ownedSet.has(exp));
}

/**
 * Formats owned expansion names for display, truncated after `max` entries
 * with a "+N more" suffix. Callers must pass getEffectiveOwned() output.
 */
export function formatOwnedList(owned: readonly string[], max: number = 3): string {
  if (owned.length <= max) return owned.join(', ');
  return `${owned.slice(0, max).join(', ')} +${owned.length - max} more`;
}
