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
import { SupplyCard } from './allCards';

export interface Mage {
  id: string;
  name: string;
  expansion: string;
  mageTitle?: string;
  abilityName?: string;
  abilityActivation?: string;
  abilityEffect?: string;
  numberOfCharges?: number;
  uniqueStarters?: SupplyCard[];
}

export const allMages: Mage[] = [
  ...(aeonsEndData.mages || []),
  ...(buriedSecretsData.mages || []),
  ...(intoTheWildData.mages || []),
  ...(legacyData.mages || []),
  ...(outerDarkData.mages || []),
  ...(promosData.mages || []),
  ...(shatteredDreamsData.mages || []),
  ...(theAncientsData.mages || []),
  ...(theDepthsData.mages || []),
  ...(theNamelessData.mages || []),
  ...(theNewAgeData.mages || []),
  ...(theVoidData.mages || []),
  ...(warEternalData.mages || []),
];
