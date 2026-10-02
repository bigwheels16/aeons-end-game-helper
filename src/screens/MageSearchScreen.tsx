import { useMemo } from 'react';
import scrapedData from '../../data/scraped/aeons_end_all.json';
import { useGameStore } from '../store';
import { useDebounce } from '../hooks/useDebounce';
import { useOwnedExpansions } from '../hooks/useOwnedExpansions';
import { matchesSearch } from '../utils/text';
import { matchesOwned } from '../utils/expansions';
import { ScrapedMage } from '../types/scraped';
import { getMageStarters } from '../utils/mages';
import MageDisplayItem from '../components/MageDisplayItem';
import SearchScreenLayout from '../components/SearchScreenLayout';

const allMages: ScrapedMage[] = scrapedData.mages;

/**
 * Mage Search Screen Component.
 *
 * Debounced search over mage names, abilities and unique starters. Results are restricted to the
 * app-wide "Expansions" setting, which this screen's "Clear All Filters" never changes.
 */
export default function MageSearchScreen() {
  const mageSearchFilters = useGameStore((state) => state.mageSearchFilters);
  const setMageSearchFilters = useGameStore((state) => state.setMageSearchFilters);

  const { mageQuery } = mageSearchFilters;
  const debouncedQuery = useDebounce(mageQuery);
  const { ownedSet } = useOwnedExpansions();

  // Step 1: restrict to the Expansions setting (not debounced, so changes apply instantly)
  const ownedPool = useMemo(
    () => allMages.filter(mage => matchesOwned(mage, ownedSet)),
    [ownedSet]
  );

  // Step 2: this screen's own search filters
  const filteredMages = useMemo(() => {
    return ownedPool.filter(mage => matchesSearch(debouncedQuery, [
      mage.name,
      mage.title,
      mage.ability_name,
      mage.ability_activation,
      mage.ability_effect,
      ...getMageStarters(mage).flatMap(s => [s.name, s.effect]),
    ])).sort((a, b) => a.name.localeCompare(b.name));
  }, [ownedPool, debouncedQuery]);

  return (
    <SearchScreenLayout
      title="Mage Search"
      itemLabel="mages"
      search={{
        label: 'Search (Name, Ability, Unique Starters)',
        placeholder: 'Search mages, abilities, starters...',
        value: mageQuery,
        onChange: (value) => setMageSearchFilters({ mageQuery: value }),
      }}
      onClear={() => setMageSearchFilters({ mageQuery: '' })}
      noOwnedItems={ownedPool.length === 0}
      results={filteredMages.map(mage => <MageDisplayItem key={mage.id} mage={mage} />)}
      itemMinWidth="350px"
      itemGap="1.5rem"
    />
  );
}
