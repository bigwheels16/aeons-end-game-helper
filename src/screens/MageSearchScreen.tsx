import { useMemo } from 'react';
import scrapedData from '../../data/scraped/aeons_end_all.json';
import { useGameStore } from '../store';
import ExpansionFilter from '../components/ExpansionFilter';
import { useDebounce } from '../hooks/useDebounce';
import { useToggleSet } from '../hooks/useToggleSet';
import { stripHtml } from '../utils/text';
import { getUniqueExpansions } from '../utils/cards';
import { ScrapedMage } from '../types/scraped';
import { getMageStarters } from '../utils/mages';
import MageDisplayItem from '../components/MageDisplayItem';

const allMages: ScrapedMage[] = scrapedData.mages || [];

export default function MageSearchScreen() {
  const mageSearchFilters = useGameStore((state) => state.mageSearchFilters);
  const setMageSearchFilters = useGameStore((state) => state.setMageSearchFilters);

  const { mageQuery, selectedMageExpansions } = mageSearchFilters;
  
  const visibleMats = useToggleSet();
  const visibleStarters = useToggleSet();
  const debouncedQuery = useDebounce(mageQuery);

  const allExpansions = useMemo(() => getUniqueExpansions(allMages), []);

  const toggleExpansion = (exp: string) => {
    setMageSearchFilters({
      selectedMageExpansions: selectedMageExpansions.includes(exp)
        ? selectedMageExpansions.filter(e => e !== exp)
        : [...selectedMageExpansions, exp]
    });
  };

  const clearFilters = () => {
    setMageSearchFilters({
      mageQuery: '',
      selectedMageExpansions: [],
    });
  };

  const filteredMages = useMemo(() => {
    return allMages.filter(mage => {
      if (!mage) return false;

      if (debouncedQuery) {
        const terms = debouncedQuery.toLowerCase().split(/\s+/).filter(Boolean);
        const starters = getMageStarters(mage);
        const startersText = starters
          .map(s => `${s.name} ${s.effect ? stripHtml(s.effect) : ''}`)
          .join(' ');

        const searchableText = [
          mage.name,
          mage.title,
          mage.ability_name,
          mage.ability_activation,
          mage.ability_effect ? stripHtml(mage.ability_effect) : '',
          startersText
        ].join(' ').toLowerCase();
        
        if (!terms.every(term => searchableText.includes(term))) {
          return false;
        }
      }

      if (selectedMageExpansions.length > 0 && (!mage.expansions || !mage.expansions.some(e => selectedMageExpansions.includes(e)))) {
        return false;
      }

      return true;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [debouncedQuery, selectedMageExpansions]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', backgroundColor: '#1a1a1a' }}>
      <div style={{ padding: '1rem', borderBottom: '1px solid #555' }}>
        <h2 style={{ marginTop: 0, color: 'white' }}>Mage Search ({filteredMages.length} results)</h2>
        
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: '200px' }}>
            <label style={{ color: '#ccc', marginBottom: '4px' }}>Search (Name, Ability, Unique Starters)</label>
            <input 
              type="text" 
              value={mageQuery} 
              onChange={e => setMageSearchFilters({ mageQuery: e.target.value })} 
              placeholder="Search mages, abilities, starters..."
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#333', color: 'white' }}
            />
          </div>
        </div>

        <ExpansionFilter
          allExpansions={allExpansions}
          selectedExpansions={selectedMageExpansions}
          onToggleExpansion={toggleExpansion}
          onSelectAll={() => setMageSearchFilters({ selectedMageExpansions: allExpansions })}
          onClearAll={() => setMageSearchFilters({ selectedMageExpansions: [] })}
        />

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
        {filteredMages.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <p style={{ fontSize: '1.25rem', color: '#ccc' }}>No matching mages found.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
              {filteredMages.map((mage, idx) => (
                <MageDisplayItem
                  key={`${mage.name}-${idx}`}
                  mage={mage}
                  matsVisible={visibleMats.has(mage.name)}
                  onToggleMats={() => visibleMats.toggle(mage.name)}
                  isStarterVisible={visibleStarters.has}
                  onToggleStarter={visibleStarters.toggle}
                />
              ))}
            </div>
        )}
      </div>
    </div>
  );
}





