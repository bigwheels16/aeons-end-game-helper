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
import { ScrapedNemesis } from '../types/scraped';
import NemesisDisplayItem from '../components/NemesisDisplayItem';

const allNemeses: ScrapedNemesis[] = scrapedData.nemeses || [];

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
  const visibleImages = useToggleSet();
  const debouncedQuery = useDebounce(nemesisQuery);
  const { ownedSet } = useOwnedExpansions();
  const [pickerOpen, setPickerOpen] = useState(false);
  const openPicker = () => setPickerOpen(true);

  // Resets only this screen's filters; the Expansions setting is app-wide and is never cleared here.
  const clearFilters = () => {
    setNemesisSearchFilters({
      nemesisQuery: '',
      difficultyRange: [1, 10],
    });
  };

  // Step 1: restrict to the Expansions setting (not debounced, so changes apply instantly)
  const ownedPool = useMemo(
    () => allNemeses.filter(nemesis => nemesis && matchesOwned(nemesis, ownedSet)),
    [ownedSet]
  );

  // Step 2: this screen's own search filters
  const filteredNemeses = useMemo(() => {
    return ownedPool.filter(nemesis => {
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
  }, [ownedPool, debouncedQuery, difficultyRange]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', backgroundColor: '#1a1a1a' }}>
      <div style={{ padding: '1rem', borderBottom: '1px solid #555' }}>
        <h2 style={{ marginTop: 0, color: 'white' }}>Nemesis Search ({filteredNemeses.length} results)</h2>

        <MyExpansionsChip onOpen={openPicker} />
        <MyExpansionsPicker isOpen={pickerOpen} onClose={() => setPickerOpen(false)} />

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
        {ownedPool.length === 0 ? (
          <MyExpansionsEmptyState itemLabel="nemeses" onOpen={openPicker} />
        ) : filteredNemeses.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <p style={{ fontSize: '1.25rem', color: '#ccc' }}>No matching nemeses found.</p>
            <MyExpansionsSearchingNote onOpen={openPicker} />
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





