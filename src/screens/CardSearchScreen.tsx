import { useMemo } from 'react';
import DOMPurify from 'dompurify';
import scrapedData from '../../data/scraped/aeons_end_all.json';
import { useGameStore } from '../store';
import ExpansionFilter from '../components/ExpansionFilter';
import { useDebounce } from '../hooks/useDebounce';
import { useToggleSet } from '../hooks/useToggleSet';
import { stripHtml } from '../utils/text';
import { getUniqueExpansions } from '../utils/cards';
import { ScrapedSupplyCard } from '../types/scraped';

const allCards: ScrapedSupplyCard[] = scrapedData.supply || [];

/**
 * Card Search Screen Component.
 *
 * Provides a responsive multi-filter card lookup tool for Aeon's End supply cards (Gems, Relics, Spells).
 * Supports debounced name and effect text queries, expansion toggle filtering, card type filtering,
 * cost range slider filtering, and sanitized HTML effect rendering with DOMPurify.
 *
 * Filter criteria are synchronized with and persisted in the global Zustand store (`localStorage`),
 * allowing search parameters to persist across tool navigation and page reloads.
 */
export default function CardSearchScreen() {
  const searchFilters = useGameStore((state) => state.searchFilters);
  const setSearchFilters = useGameStore((state) => state.setSearchFilters);

  const { cardQuery, selectedExpansions, selectedTypes, costRange } = searchFilters;
  const visibleImages = useToggleSet();
  const debouncedQuery = useDebounce(cardQuery);

  // Extract all available expansions
  const allExpansions = useMemo(() => getUniqueExpansions(allCards), []);

  const toggleExpansion = (exp: string) => {
    setSearchFilters({
      selectedExpansions: selectedExpansions.includes(exp)
        ? selectedExpansions.filter(e => e !== exp)
        : [...selectedExpansions, exp]
    });
  };

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
      selectedExpansions: [],
      selectedTypes: [],
      costRange: [0, 10]
    });
  };

  const filteredCards = useMemo(() => {
    return allCards.filter(card => {
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

      // Expansion filter
      if (selectedExpansions.length > 0 && (!card.expansions || !card.expansions.some(e => selectedExpansions.includes(e)))) {
        return false;
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
  }, [debouncedQuery, selectedExpansions, selectedTypes, costRange]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', backgroundColor: '#1a1a1a' }}>
      <div style={{ padding: '1rem', borderBottom: '1px solid #555' }}>
        <h2 style={{ marginTop: 0, color: 'white' }}>Card Search ({filteredCards.length} results)</h2>
        
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

        <ExpansionFilter
          allExpansions={allExpansions}
          selectedExpansions={selectedExpansions}
          onToggleExpansion={toggleExpansion}
        />

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
              style={{ flex: 1 }}
            />
            <input 
              type="range" 
              min="0" max="10" 
              value={costRange[1]} 
              onChange={e => setSearchFilters({ costRange: [costRange[0], Math.max(Number(e.target.value), costRange[0])] })}
              style={{ flex: 1 }}
            />
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
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
        </div>
      </div>

      <div style={{ padding: '1rem', backgroundColor: '#1a1a1a' }}>
        {filteredCards.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <p style={{ fontSize: '1.25rem', color: '#ccc' }}>No matching cards found.</p>
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
              <div key={`${card.id || card.name}-${idx}`} style={{ backgroundColor: '#222', padding: '1rem', borderRadius: '8px', border: '1px solid #444', color: 'white', overflow: 'hidden' }}>
                    <h3 style={{ margin: '0 0 0.5rem 0' }}>
                      <a 
                        href={card.page_url || `https://aeonsend.wiki.gg/wiki/${card.name.replace(/ /g, '_')}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ color: '#4CAF50', textDecoration: 'none' }}
                      >
                        {card.name}
                      </a>
                    </h3>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#aaa', marginBottom: '0.5rem' }}>
                      <span>{card.type} | {card.expansions?.join(', ') || 'Unknown'}</span>
                      <span>Cost: {card.cost}</span>
                    </div>
                    <div 
                        style={{ fontSize: '0.9rem', color: '#ddd', marginBottom: '0.5rem', textAlign: 'center' }}
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(card.effect || '') }} 
                      />
                      <button 
                        onClick={() => visibleImages.toggle(card.id || card.name)}
                        style={{ background: 'none', border: 'none', color: '#2196F3', cursor: 'pointer', padding: 0, fontSize: '0.875rem' }}
                      >
                        {visibleImages.has(card.id || card.name) ? 'Hide Image' : 'Show Image'}
                      </button>
                      {visibleImages.has(card.id || card.name) && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <a href={`https://aeonsend.wiki.gg/images/${card.name.replace(/ /g, '_')}.jpg`} target="_blank" rel="noopener noreferrer">
                              <img 
                                src={`https://aeonsend.wiki.gg/images/${card.name.replace(/ /g, '_')}.jpg`} 
                                alt={card.name}
                                loading="lazy"
                                style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '4px' }} 
                              />
                            </a>
                        </div>
                      )}
                    
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}






