import scrapedData from '../../data/scraped/aeons_end_all.json';
import { ScrapedMage, ScrapedNemesis, ScrapedSupplyCard } from '../types/scraped';

/* Built once at module load; never persisted. */
const allSupply: readonly ScrapedSupplyCard[] = scrapedData.supply;
const allMages: readonly ScrapedMage[] = scrapedData.mages;
const allNemeses: readonly ScrapedNemesis[] = scrapedData.nemeses;

const SUPPLY_BY_ID: ReadonlyMap<string, ScrapedSupplyCard> = new Map(allSupply.map((c) => [c.id, c]));
const MAGE_BY_ID: ReadonlyMap<string, ScrapedMage> = new Map(allMages.map((m) => [m.id, m]));
const NEMESIS_BY_ID: ReadonlyMap<string, ScrapedNemesis> = new Map(allNemeses.map((n) => [n.id, n]));

/** Bundled supply card with this exact id, or undefined. */
export function getSupplyCardById(id: string): ScrapedSupplyCard | undefined {
  return SUPPLY_BY_ID.get(id);
}

/** Bundled mage with this exact id, or undefined. */
export function getMageById(id: string): ScrapedMage | undefined {
  return MAGE_BY_ID.get(id);
}

/** Bundled nemesis with this exact id, or undefined. */
export function getNemesisById(id: string): ScrapedNemesis | undefined {
  return NEMESIS_BY_ID.get(id);
}
