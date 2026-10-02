import { useMemo } from 'react';
import scrapedData from '../../data/scraped/aeons_end_all.json';
import { useGameStore } from '../store';
import { useDebounce } from '../hooks/useDebounce';
import { useOwnedExpansions } from '../hooks/useOwnedExpansions';
import { matchesSearch } from '../utils/text';
import { matchesOwned } from '../utils/expansions';
import { toNumber } from '../utils/numbers';
import { ScrapedSupplyCard } from '../types/scraped';
import CardDisplayItem from '../components/CardDisplayItem';
import SearchScreenLayout from '../components/SearchScreenLayout';
import { pillStyle } from '../components/selectableStyle';

const allCards: ScrapedSupplyCard[] = scrapedData.supply;

/**
 * Card Search Screen Component.
 *
 * Provides a responsive multi-filter card lookup tool for Aeon's End supply cards (Gems, Relics, Spells).
 * Supports debounced name and effect text queries, card type filtering, cost range slider
 * filtering, and HTML effect rendering. Results are restricted to the
 * app-wide "Expansions" setting, which this screen's "Clear All Filters" never changes.
 *
 * Filter criteria are synchronized with and persisted in the global Zustand store (`localStorage`),
 * allowing search parameters to persist across tool navigation and page reloads.
 */
export default function CardSearchScreen() {
  const searchFilters = useGameStore((state) => state.searchFilters);
  const setSearchFilters = useGameStore((state) => state.setSearchFilters);

  const { cardQuery, selectedTypes, costRange } = searchFilters;
  const debouncedQuery = useDebounce(cardQuery);
  const { ownedSet } = useOwnedExpansions();

  const toggleType = (type: string) => {
    setSearchFilters({
      selectedTypes: selectedTypes.includes(type)
        ? selectedTypes.filter(t => t !== type)
        : [...selectedTypes, type]
    });
  };

  const clearFilters = () => {
    setSearchFilters({
      cardQuery: '',
      selectedTypes: [],
      costRange: [0, 10]
    });
  };

  // Step 1: restrict to the Expansions setting (not debounced, so changes apply instantly)
  const ownedPool = useMemo(
    () => allCards.filter(card => matchesOwned(card, ownedSet)),
    [ownedSet]
  );

  // Step 2: this screen's own search filters
  const filteredCards = useMemo(() => {
    return ownedPool.filter(card => {
      // Type filter
      if (selectedTypes.length > 0 && (!card.type || !selectedTypes.includes(card.type))) {
        return false;
      }

      // Cost filter
      const cardCost = toNumber(card.cost);
      if (cardCost < costRange[0] || cardCost > costRange[1]) {
        return false;
      }

      // Combined Name & Effect search
      return matchesSearch(debouncedQuery, [card.name, card.effect]);
    }).sort((a, b) => toNumber(a.cost) - toNumber(b.cost));
  }, [ownedPool, debouncedQuery, selectedTypes, costRange]);

  return (
    <SearchScreenLayout
      title="Card Search"
      itemLabel="cards"
      search={{
        label: 'Search (Name, Effect)',
        placeholder: 'Search cards, effects...',
        value: cardQuery,
        onChange: (value) => setSearchFilters({ cardQuery: value }),
      }}
      onClear={clearFilters}
      noOwnedItems={ownedPool.length === 0}
      results={filteredCards.map(card => <CardDisplayItem key={card.id} card={card} />)}
      itemMinWidth="250px"
      itemGap="1rem"
      clearNote={
        <span style={{ color: '#999', fontSize: '0.85rem' }}>
          Resets search, type &amp; cost. Expansions are kept.
        </span>
      }
      noMatchActions={
        <button
          onClick={clearFilters}
          style={{
            padding: '0.5rem 1rem',
            cursor: 'pointer',
            marginTop: '1rem',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontWeight: 'bold'
          }}
        >
          Clear all filters
        </button>
      }
    >
      <div style={{ marginBottom: '1rem' }}>
        <strong style={{ color: '#ccc' }}>Card Type:</strong>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
          {['Gem', 'Relic', 'Spell'].map(type => (
            <button key={type} onClick={() => toggleType(type)} style={pillStyle(selectedTypes.includes(type))}>
              {type}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <strong style={{ color: '#ccc' }}>Cost Range ({costRange[0]} - {costRange[1]})</strong>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', alignItems: 'center' }}>
          <input
            type="range"
            min="0" max="10"
            value={costRange[0]}
            onChange={e => setSearchFilters({ costRange: [Math.min(Number(e.target.value), costRange[1]), costRange[1]] })}
            style={{ flex: 1, minWidth: 0 }}
          />
          <input
            type="range"
            min="0" max="10"
            value={costRange[1]}
            onChange={e => setSearchFilters({ costRange: [costRange[0], Math.max(Number(e.target.value), costRange[0])] })}
            style={{ flex: 1, minWidth: 0 }}
          />
        </div>
      </div>
    </SearchScreenLayout>
  );
}
