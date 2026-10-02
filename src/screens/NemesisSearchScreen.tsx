import { useMemo } from 'react';
import scrapedData from '../../data/scraped/aeons_end_all.json';
import { useGameStore } from '../store';
import { useDebounce } from '../hooks/useDebounce';
import { useOwnedExpansions } from '../hooks/useOwnedExpansions';
import { matchesSearch } from '../utils/text';
import { matchesOwned } from '../utils/expansions';
import { toNumber } from '../utils/numbers';
import { ScrapedNemesis } from '../types/scraped';
import NemesisDisplayItem from '../components/NemesisDisplayItem';
import SearchScreenLayout from '../components/SearchScreenLayout';

const allNemeses: ScrapedNemesis[] = scrapedData.nemeses;

/**
 * Nemesis Search Screen Component.
 *
 * Debounced search over nemesis text plus a difficulty range. Results are restricted to the
 * app-wide "Expansions" setting, which this screen's "Clear All Filters" never changes.
 */
export default function NemesisSearchScreen() {
  const nemesisSearchFilters = useGameStore((state) => state.nemesisSearchFilters);
  const setNemesisSearchFilters = useGameStore((state) => state.setNemesisSearchFilters);

  const { nemesisQuery, difficultyRange } = nemesisSearchFilters;
  const debouncedQuery = useDebounce(nemesisQuery);
  const { ownedSet } = useOwnedExpansions();

  const clearFilters = () => {
    setNemesisSearchFilters({
      nemesisQuery: '',
      difficultyRange: [1, 10],
    });
  };

  // Step 1: restrict to the Expansions setting (not debounced, so changes apply instantly)
  const ownedPool = useMemo(
    () => allNemeses.filter(nemesis => matchesOwned(nemesis, ownedSet)),
    [ownedSet]
  );

  // Step 2: this screen's own search filters
  const filteredNemeses = useMemo(() => {
    return ownedPool.filter(nemesis => {
      const difficulty = Number(nemesis.difficulty);
      if (nemesis.difficulty !== undefined && !Number.isNaN(difficulty) && (difficulty < difficultyRange[0] || difficulty > difficultyRange[1])) {
        return false;
      }

      return matchesSearch(debouncedQuery, [
        nemesis.name,
        nemesis.unleash,
        nemesis.rules,
        nemesis.setup,
        nemesis.increased_difficulty,
      ]);
    }).sort((a, b) => toNumber(a.difficulty) - toNumber(b.difficulty));
  }, [ownedPool, debouncedQuery, difficultyRange]);

  return (
    <SearchScreenLayout
      title="Nemesis Search"
      itemLabel="nemeses"
      search={{
        label: 'Search (Name, Info)',
        placeholder: 'Search nemeses...',
        value: nemesisQuery,
        onChange: (value) => setNemesisSearchFilters({ nemesisQuery: value }),
      }}
      onClear={clearFilters}
      noOwnedItems={ownedPool.length === 0}
      results={filteredNemeses.map(nemesis => <NemesisDisplayItem key={nemesis.id} nemesis={nemesis} />)}
      itemMinWidth="350px"
      itemGap="1.5rem"
    >
      <div style={{ marginBottom: '1rem' }}>
        <strong style={{ color: '#ccc' }}>Difficulty Range ({difficultyRange[0]} - {difficultyRange[1]})</strong>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', alignItems: 'center' }}>
          <input
            type="range"
            min="1" max="10"
            value={difficultyRange[0]}
            onChange={e => setNemesisSearchFilters({ difficultyRange: [Math.min(Number(e.target.value), difficultyRange[1]), difficultyRange[1]] })}
            aria-label="Minimum difficulty"
            style={{ flex: 1, minWidth: 0 }}
          />
          <input
            type="range"
            min="1" max="10"
            value={difficultyRange[1]}
            onChange={e => setNemesisSearchFilters({ difficultyRange: [difficultyRange[0], Math.max(Number(e.target.value), difficultyRange[0])] })}
            aria-label="Maximum difficulty"
            style={{ flex: 1, minWidth: 0 }}
          />
        </div>
      </div>
    </SearchScreenLayout>
  );
}
