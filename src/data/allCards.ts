import aeonsEndData from './aeonsEnd';
import buriedSecretsData from './buriedSecrets';
import intoTheWildData from './intoTheWild';
import legacyData from './legacy';
import outerDarkData from './outerDark';
import promosData from './promos';
import shatteredDreamsData from './shatteredDreams';
import theAncientsData from './theAncients';
import theDepthsData from './theDepths';
import theNamelessData from './theNameless';
import theNewAgeData from './theNewAge';
import theVoidData from './theVoid';
import warEternalData from './warEternal';

/**
 * Represents a supply market card (Gem, Relic, or Spell) in Aeon's End.
 */
export interface SupplyCard {
  id: string;
  name: string;
  type: 'Gem' | 'Relic' | 'Spell' | string;
  expansion: string;
  cost: number;
  effect: string;
  keywords?: string[];
}

/**
 * Aggregated repository of all Aeon's End supply cards across official base sets,
 * expansions, and promo releases.
 */
export const allCards: SupplyCard[] = [
  ...(aeonsEndData.cards || []),
  ...(buriedSecretsData.cards || []),
  ...(intoTheWildData.cards || []),
  ...(legacyData.cards || []),
  ...(outerDarkData.cards || []),
  ...(promosData.cards || []),
  ...(shatteredDreamsData.cards || []),
  ...(theAncientsData.cards || []),
  ...(theDepthsData.cards || []),
  ...(theNamelessData.cards || []),
  ...(theNewAgeData.cards || []),
  ...(theVoidData.cards || []),
  ...(warEternalData.cards || []),
];
