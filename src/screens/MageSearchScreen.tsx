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
import { ScrapedMage } from '../types/scraped';
import { getMageStarters } from '../utils/mages';
import MageDisplayItem from '../components/MageDisplayItem';

const allMages: ScrapedMage[] = scrapedData.mages || [];

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
  
  const visibleMats = useToggleSet();
  const visibleStarters = useToggleSet();
  const debouncedQuery = useDebounce(mageQuery);
  const { ownedSet } = useOwnedExpansions();
  const [pickerOpen, setPickerOpen] = useState(false);
  const openPicker = () => setPickerOpen(true);

  // Resets only this screen's filters; the Expansions setting is app-wide and is never cleared here.
  const clearFilters = () => {
    setMageSearchFilters({
      mageQuery: '',
    });
  };

  // Step 1: restrict to the Expansions setting (not debounced, so changes apply instantly)
  const ownedPool = useMemo(
    () => allMages.filter(mage => mage && matchesOwned(mage, ownedSet)),
    [ownedSet]
  );

  // Step 2: this screen's own search filters
  const filteredMages = useMemo(() => {
    return ownedPool.filter(mage => {
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

      return true;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [ownedPool, debouncedQuery]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', backgroundColor: '#1a1a1a' }}>
      <div style={{ padding: '1rem', borderBottom: '1px solid #555' }}>
        <h2 style={{ marginTop: 0, color: 'white' }}>Mage Search ({filteredMages.length} results)</h2>

        <MyExpansionsChip onOpen={openPicker} />
        <MyExpansionsPicker isOpen={pickerOpen} onClose={() => setPickerOpen(false)} />

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
          <MyExpansionsEmptyState itemLabel="mages" onOpen={openPicker} />
        ) : filteredMages.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <p style={{ fontSize: '1.25rem', color: '#ccc' }}>No matching mages found.</p>
            <MyExpansionsSearchingNote onOpen={openPicker} />
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





