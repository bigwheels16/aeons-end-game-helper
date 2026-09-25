import { useMemo } from 'react';
import scrapedData from '../../data/scraped/aeons_end_all.json';
import { useGameStore } from '../store';
import ExpansionFilter from '../components/ExpansionFilter';
import { useDebounce } from '../hooks/useDebounce';
import { useToggleSet } from '../hooks/useToggleSet';
import { stripHtml } from '../utils/text';
import { getUniqueExpansions } from '../utils/cards';
import { ScrapedNemesis } from '../types/scraped';
import NemesisDisplayItem from '../components/NemesisDisplayItem';

const allNemeses: ScrapedNemesis[] = scrapedData.nemeses || [];

export default function NemesisSearchScreen() {
  const nemesisSearchFilters = useGameStore((state) => state.nemesisSearchFilters);
  const setNemesisSearchFilters = useGameStore((state) => state.setNemesisSearchFilters);

  const { nemesisQuery, selectedNemesisExpansions, difficultyRange } = nemesisSearchFilters;
  const visibleImages = useToggleSet();
  const debouncedQuery = useDebounce(nemesisQuery);

  const allExpansions = useMemo(() => getUniqueExpansions(allNemeses), []);

  const toggleExpansion = (exp: string) => {
    setNemesisSearchFilters({
      selectedNemesisExpansions: selectedNemesisExpansions.includes(exp)
        ? selectedNemesisExpansions.filter(e => e !== exp)
        : [...selectedNemesisExpansions, exp]
    });
  };

  const clearFilters = () => {
    setNemesisSearchFilters({
      nemesisQuery: '',
      selectedNemesisExpansions: [],
      difficultyRange: [1, 10],
    });
  };

  const filteredNemeses = useMemo(() => {
    return allNemeses.filter(nemesis => {
      if (!nemesis) return false;

      if (debouncedQuery) {
        const terms = debouncedQuery.toLowerCase().split(/\s+/).filter(Boolean);
        const searchableText = [
          nemesis.name,
          nemesis.unleash ? stripHtml(nemesis.unleash) : '',
          nemesis.rules ? stripHtml(nemesis.rules) : '',
          nemesis.setup ? stripHtml(nemesis.setup) : '',
          nemesis.increased_difficulty ? stripHtml(nemesis.increased_difficulty) : ''
        ].join(' ').toLowerCase();
        
        if (!terms.every(term => searchableText.includes(term))) {
          return false;
        }
      }

      if (selectedNemesisExpansions.length > 0 && (!nemesis.expansions || !nemesis.expansions.some(e => selectedNemesisExpansions.includes(e)))) {
        return false;
      }

      const difficulty = Number(nemesis.difficulty);
      if (nemesis.difficulty !== undefined && !Number.isNaN(difficulty) && (difficulty < difficultyRange[0] || difficulty > difficultyRange[1])) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      const diffA = a.difficulty !== undefined ? Number(a.difficulty) || 0 : 0;
      const diffB = b.difficulty !== undefined ? Number(b.difficulty) || 0 : 0;
      return diffA - diffB;
    });
  }, [debouncedQuery, selectedNemesisExpansions, difficultyRange]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', backgroundColor: '#1a1a1a' }}>
      <div style={{ padding: '1rem', borderBottom: '1px solid #555' }}>
        <h2 style={{ marginTop: 0, color: 'white' }}>Nemesis Search ({filteredNemeses.length} results)</h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '1rem' }}>
          <label style={{ color: '#ccc', marginBottom: '4px' }}>Search (Name, Info)</label>
          <input 
            type="text" 
            value={nemesisQuery} 
            onChange={e => setNemesisSearchFilters({ nemesisQuery: e.target.value })} 
            placeholder="Search nemeses..."
            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#333', color: 'white' }}
          />
        </div>

        <ExpansionFilter
          allExpansions={allExpansions}
          selectedExpansions={selectedNemesisExpansions}
          onToggleExpansion={toggleExpansion}
          onSelectAll={() => setNemesisSearchFilters({ selectedNemesisExpansions: allExpansions })}
          onClearAll={() => setNemesisSearchFilters({ selectedNemesisExpansions: [] })}
        />

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
        {filteredNemeses.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <p style={{ fontSize: '1.25rem', color: '#ccc' }}>No matching nemeses found.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
              {filteredNemeses.map((nemesis, idx) => (
                <NemesisDisplayItem
                  key={`${nemesis.name}-${idx}`}
                  nemesis={nemesis}
                  imagesVisible={visibleImages.has(nemesis.name)}
                  onToggleImages={() => visibleImages.toggle(nemesis.name)}
                />
              ))}
            </div>
        )}
      </div>
    </div>
  );

}





