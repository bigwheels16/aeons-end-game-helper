import scrapedData from '../../data/scraped/aeons_end_all.json';
import type { FavoriteCategory } from '../store';
import { ScrapedMage, ScrapedNemesis, ScrapedSupplyCard } from '../types/scraped';

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

/*
 * Scope: global per JS realm (one per tab), module-level, immutable, built once at module load
 * from the bundled build-time dataset, never persisted. All lookups use Map, so untrusted keys
 * such as "__proto__" or "constructor" can never resolve to prototype members. Ids are compared
 * exactly as stored: callers must not normalize, trim or lowercase an id before lookup.
 */
const allSupply: readonly ScrapedSupplyCard[] = scrapedData.supply || [];
const allMages: readonly ScrapedMage[] = scrapedData.mages || [];
const allNemeses: readonly ScrapedNemesis[] = scrapedData.nemeses || [];

const SUPPLY_BY_ID: ReadonlyMap<string, ScrapedSupplyCard> = new Map(allSupply.map((c) => [c.id, c]));
/** Legacy-only: resolves randomizer results saved before ids existed. */
const SUPPLY_BY_NAME: ReadonlyMap<string, ScrapedSupplyCard> = new Map(allSupply.map((c) => [c.name, c]));
const MAGE_BY_ID: ReadonlyMap<string, ScrapedMage> = new Map(allMages.map((m) => [m.id, m]));
const NEMESIS_BY_ID: ReadonlyMap<string, ScrapedNemesis> = new Map(allNemeses.map((n) => [n.id, n]));

/** Favorites category -> id kind prefix. */
export const FAVORITE_KIND_BY_CATEGORY: Readonly<Record<FavoriteCategory, string>> = Object.freeze({
  supply: 'supply',
  mages: 'mage',
  nemeses: 'nemesis',
});

const FAVORITE_IDS_BY_CATEGORY: ReadonlyMap<FavoriteCategory, ReadonlyMap<string, unknown>> = new Map<
  FavoriteCategory,
  ReadonlyMap<string, unknown>
>([
  ['supply', SUPPLY_BY_ID],
  ['mages', MAGE_BY_ID],
  ['nemeses', NEMESIS_BY_ID],
]);

/** Bundled supply card with this exact id, or undefined. */
export function getSupplyCardById(id: string): ScrapedSupplyCard | undefined {
  return SUPPLY_BY_ID.get(id);
}

/** Bundled supply card with this exact name, or undefined. Only for legacy saved results. */
export function getSupplyCardByLegacyName(name: string): ScrapedSupplyCard | undefined {
  return SUPPLY_BY_NAME.get(name);
}

/** Bundled mage with this exact id, or undefined. */
export function getMageById(id: string): ScrapedMage | undefined {
  return MAGE_BY_ID.get(id);
}

/** Bundled nemesis with this exact id, or undefined. */
export function getNemesisById(id: string): ScrapedNemesis | undefined {
  return NEMESIS_BY_ID.get(id);
}

/** True only if `id` is a bundled id of this category's kind (a mage id is unknown under supply). */
export function isKnownFavoriteId(category: FavoriteCategory, id: string): boolean {
  const ids = FAVORITE_IDS_BY_CATEGORY.get(category);
  return ids !== undefined && ids.has(id);
}
