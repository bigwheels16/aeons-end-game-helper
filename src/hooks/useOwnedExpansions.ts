import { useMemo } from 'react';
import { useGameStore } from '../store';
import { ALL_EXPANSIONS, getEffectiveOwned } from '../utils/expansions';

export interface OwnedExpansionsView {
  /** Effective owned names (intersection with ALL_EXPANSIONS, in ALL_EXPANSIONS order). */
  owned: string[];
  /** True when the effective selection is empty, i.e. "All Expansions" (no filtering). */
  isAll: boolean;
  /** Set for filtering via matchesOwned(); null means "All". */
  ownedSet: ReadonlySet<string> | null;
  /** Number of effective owned expansions (stale names never counted). */
  count: number;
  /** Total number of known expansions. */
  total: number;
  /** Short badge label: "All" or "N of M". */
  label: string;
}

/**
 * Derived, read-only view of the app-wide "Expansions" setting.
 * Components must use this (never the raw persisted array) for filtering and display.
 */
export function useOwnedExpansions(): OwnedExpansionsView {
  const raw = useGameStore((state) => state.ownedExpansions);
  return useMemo(() => {
    const owned = getEffectiveOwned(raw);
    const isAll = owned.length === 0;
    return {
      owned,
      isAll,
      ownedSet: isAll ? null : new Set(owned),
      count: owned.length,
      total: ALL_EXPANSIONS.length,
      label: isAll ? 'All' : `${owned.length} of ${ALL_EXPANSIONS.length}`,
    };
  }, [raw]);
}
