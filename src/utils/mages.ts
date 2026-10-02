import scrapedData from '../../data/scraped/aeons_end_all.json';
import { ScrapedMage, ScrapedUniqueStarter } from '../types/scraped';

const allUniqueStarters: ScrapedUniqueStarter[] = scrapedData.unique_starters;

const startersByName = new Map<string, ScrapedUniqueStarter>();
const startersByMage = new Map<string, ScrapedUniqueStarter[]>();
allUniqueStarters.forEach(s => {
  startersByName.set(s.name.toLowerCase(), s);
  if (s.mage) {
    const key = s.mage.toLowerCase();
    if (!startersByMage.has(key)) startersByMage.set(key, []);
    startersByMage.get(key)!.push(s);
  }
});

/**
 * Returns a mage's unique starter cards: those listed on the mage's page first,
 * followed by any other starters that name the mage, without duplicates.
 */
export function getMageStarters(mage: ScrapedMage): ScrapedUniqueStarter[] {
  const result: ScrapedUniqueStarter[] = [];
  const seen = new Set<string>();

  (mage.unique_cards || []).forEach(name => {
    const match = startersByName.get(name.toLowerCase());
    if (match && !seen.has(match.name)) {
      seen.add(match.name);
      result.push(match);
    }
  });

  const byMage = startersByMage.get(mage.name.toLowerCase()) || [];
  byMage.forEach(s => {
    if (!seen.has(s.name)) {
      seen.add(s.name);
      result.push(s);
    }
  });

  return result;
}
