export interface ItemWithExpansions {
  expansions?: string[];
}

/**
 * Extracts a sorted, unique list of expansions from an array of items.
 */
export function getUniqueExpansions(items: ItemWithExpansions[]): string[] {
  const exps = new Set<string>();
  for (const item of items) {
    if (item.expansions) {
      for (const exp of item.expansions) {
        if (exp) exps.add(exp);
      }
    }
  }
  return Array.from(exps).sort();
}
