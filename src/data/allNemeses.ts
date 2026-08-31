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

export interface Nemesis {
  id: string;
  name: string;
  expansion: string;
  health: number | string;
  difficulty: number;
  expeditionRating: number;
  additionalInfo: string;
}

export const allNemeses: Nemesis[] = [
  ...(aeonsEndData.nemeses || []),
  ...(buriedSecretsData.nemeses || []),
  ...(intoTheWildData.nemeses || []),
  ...(legacyData.nemeses || []),
  ...(outerDarkData.nemeses || []),
  ...(promosData.nemeses || []),
  ...(shatteredDreamsData.nemeses || []),
  ...(theAncientsData.nemeses || []),
  ...(theDepthsData.nemeses || []),
  ...(theNamelessData.nemeses || []),
  ...(theNewAgeData.nemeses || []),
  ...(theVoidData.nemeses || []),
  ...(warEternalData.nemeses || []),
];
