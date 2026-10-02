import { useMemo, useState } from 'react';
import scrapedData from '../../data/scraped/aeons_end_all.json';
import { useGameStore } from '../store';
import {
  MyExpansionsChip,
  MyExpansionsEmptyState,
  MyExpansionsPicker,
  MyExpansionsSearchingNote,
} from '../components/MyExpansions';
import { useDebounce } from '../hooks/useDebounce';
import { useOwnedExpansions } from '../hooks/useOwnedExpansions';
import { useToggleSet } from '../hooks/useToggleSet';
import { stripHtml } from '../utils/text';
import { matchesOwned } from '../utils/expansions';
import { ScrapedSupplyCard } from '../types/scraped';
import CardDisplayItem from '../components/CardDisplayItem';

const allCards: ScrapedSupplyCard[] = scrapedData.supply || [];

/**
 * Card Search Screen Component.
 *
 * Provides a responsive multi-filter card lookup tool for Aeon's End supply cards (Gems, Relics, Spells).
 * Supports debounced name and effect text queries, card type filtering, cost range slider
 * filtering, and sanitized HTML effect rendering with DOMPurify. Results are restricted to the
 * app-wide "Expansions" setting, which this screen's "Clear All Filters" never changes.
 *
 * Filter criteria are synchronized with and persisted in the global Zustand store (`localStorage`),
 * allowing search parameters to persist across tool navigation and page reloads.
 */
export default function CardSearchScreen() {
  const searchFilters = useGameStore((state) => state.searchFilters);
  const setSearchFilters = useGameStore((state) => state.setSearchFilters);

  const { cardQuery, selectedTypes, costRange } = searchFilters;
  const visibleImages = useToggleSet();
  const debouncedQuery = useDebounce(cardQuery);
  const { ownedSet } = useOwnedExpansions();
  const [pickerOpen, setPickerOpen] = useState(false);
  const openPicker = () => setPickerOpen(true);

  const toggleType = (type: string) => {
    setSearchFilters({
      selectedTypes: selectedTypes.includes(type)
        ? selectedTypes.filter(t => t !== type)
        : [...selectedTypes, type]
    });
  };

  // Resets only this screen's filters; the Expansions setting is app-wide and is never cleared here.
  const clearFilters = () => {
    setSearchFilters({
      cardQuery: '',
      selectedTypes: [],
      costRange: [0, 10]
    });
  };

  // Step 1: restrict to the Expansions setting (not debounced, so changes apply instantly)
  const ownedPool = useMemo(
    () => allCards.filter(card => card && matchesOwned(card, ownedSet)),
    [ownedSet]
  );

  // Step 2: this screen's own search filters
  const filteredCards = useMemo(() => {
    return ownedPool.filter(card => {
      // Missing data fallback
      if (!card) return false;

      // Combined Name & Effect search
      if (debouncedQuery) {
        const terms = debouncedQuery.toLowerCase().split(/\s+/).filter(Boolean);
        const searchableText = [
          card.name,
          card.effect ? stripHtml(card.effect) : ''
        ].join(' ').toLowerCase();

        if (!terms.every(term => searchableText.includes(term))) {
          return false;
        }
      }

      // Type filter
      if (selectedTypes.length > 0 && (!card.type || !selectedTypes.includes(card.type))) {
        return false;
      }

      // Cost filter
      const cardCost = card.cost !== undefined ? Number(card.cost) || 0 : 0;
      if (cardCost < costRange[0] || cardCost > costRange[1]) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      const costA = a.cost !== undefined ? Number(a.cost) || 0 : 0;
      const costB = b.cost !== undefined ? Number(b.cost) || 0 : 0;
      return costA - costB;
    });
  }, [ownedPool, debouncedQuery, selectedTypes, costRange]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', backgroundColor: '#1a1a1a' }}>
      <div style={{ padding: '1rem', borderBottom: '1px solid #555' }}>
        <h2 style={{ marginTop: 0, color: 'white' }}>Card Search ({filteredCards.length} results)</h2>

        <MyExpansionsChip onOpen={openPicker} />
        <MyExpansionsPicker isOpen={pickerOpen} onClose={() => setPickerOpen(false)} />

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: '200px' }}>
            <label style={{ color: '#ccc', marginBottom: '4px' }}>Search (Name, Effect)</label>
            <input 
              type="text" 
              value={cardQuery} 
              onChange={e => setSearchFilters({ cardQuery: e.target.value })} 
              placeholder="Search cards, effects..."
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#333', color: 'white' }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <strong style={{ color: '#ccc' }}>Card Type:</strong>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            {['Gem', 'Relic', 'Spell'].map(type => (
              <button
                key={type}
                onClick={() => toggleType(type)}
                style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '4px',
                  border: selectedTypes.includes(type) ? '1px solid #4CAF50' : '1px solid #555',
                  backgroundColor: selectedTypes.includes(type) ? 'rgba(76, 175, 80, 0.2)' : '#222',
                  color: selectedTypes.includes(type) ? '#fff' : '#ccc',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
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
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <button 
            onClick={clearFilters} 
            style={{ 
              padding: '0.5rem 1rem', 
              cursor: 'pointer', 
              backgroundColor: '#f44336', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              fontWeight: 'bold'
            }}
          >
            Clear All Filters
          </button>
          <span style={{ color: '#999', fontSize: '0.85rem' }}>
            Resets search, type &amp; cost. Expansions are kept.
          </span>
        </div>
      </div>

      <div style={{ padding: '1rem', backgroundColor: '#1a1a1a' }}>
        {ownedPool.length === 0 ? (
          <MyExpansionsEmptyState itemLabel="cards" onOpen={openPicker} />
        ) : filteredCards.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <p style={{ fontSize: '1.25rem', color: '#ccc' }}>No matching cards found.</p>
            <MyExpansionsSearchingNote onOpen={openPicker} />
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
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
            {filteredCards.map((card, idx) => (
              <CardDisplayItem 
                key={`${card.id || card.name}-${idx}`} 
                card={card} 
                isImageVisible={visibleImages.has(card.id || card.name)}
                onToggleImage={() => visibleImages.toggle(card.id || card.name)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
