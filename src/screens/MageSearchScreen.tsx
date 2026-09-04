import { useMemo } from 'react';
import DOMPurify from 'dompurify';
import scrapedData from '../../data/scraped/aeons_end_all.json';
import { useGameStore } from '../store';
import ExpansionFilter from '../components/ExpansionFilter';
import { useDebounce } from '../hooks/useDebounce';
import { useToggleSet } from '../hooks/useToggleSet';
import { stripHtml } from '../utils/text';
import { getUniqueExpansions } from '../utils/cards';
import { ScrapedMage, ScrapedUniqueStarter } from '../types/scraped';

const allMages: ScrapedMage[] = scrapedData.mages || [];
const allUniqueStarters: ScrapedUniqueStarter[] = scrapedData.unique_starters || [];

export default function MageSearchScreen() {
  const mageSearchFilters = useGameStore((state) => state.mageSearchFilters);
  const setMageSearchFilters = useGameStore((state) => state.setMageSearchFilters);

  const { mageQuery, selectedMageExpansions } = mageSearchFilters;
  
  const visibleMats = useToggleSet();
  const visibleStarters = useToggleSet();
  const debouncedQuery = useDebounce(mageQuery);

  const startersByName = useMemo(() => {
    const map = new Map<string, ScrapedUniqueStarter>();
    allUniqueStarters.forEach(s => {
      map.set(s.name.toLowerCase(), s);
    });
    return map;
  }, []);

  const startersByMage = useMemo(() => {
    const map = new Map<string, ScrapedUniqueStarter[]>();
    allUniqueStarters.forEach(s => {
      if (s.mage) {
        const key = s.mage.toLowerCase();
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(s);
      }
    });
    return map;
  }, []);

  const getMageStarters = (mage: ScrapedMage): ScrapedUniqueStarter[] => {
    const result: ScrapedUniqueStarter[] = [];
    const seen = new Set<string>();

    (mage.unique_cards || []).forEach(name => {
      const match = startersByName.get(name.toLowerCase());
      if (match && !seen.has(match.name)) {
        seen.add(match.name);
        result.push(match);
      }
    });

    const byMage = startersByMage.get(mage.name.toLowerCase()) || [];
    byMage.forEach(s => {
      if (!seen.has(s.name)) {
        seen.add(s.name);
        result.push(s);
      }
    });

    return result;
  };

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
              {filteredMages.map((mage, idx) => {
                const starters = getMageStarters(mage);
                return (
                  <div key={`${mage.name}-${idx}`} style={{ backgroundColor: '#222', padding: '1.5rem', borderRadius: '8px', border: '1px solid #444', color: 'white', overflow: 'hidden' }}>
                    <h2 style={{ margin: '0 0 0.25rem 0' }}>
                      <a 
                        href={mage.page_url || `https://aeonsend.wiki.gg/wiki/${encodeURIComponent(mage.name.replace(/ /g, '_'))}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ color: '#4CAF50', textDecoration: 'none' }}
                      >
                        {mage.name}
                      </a>
                    </h2>
                    <h4 style={{ margin: '0 0 1rem 0', color: '#aaa', fontWeight: 'normal', fontStyle: 'italic' }}>
                      {mage.title ? `${mage.title} | ` : ''}{mage.expansions?.join(', ') || 'Unknown'}
                    </h4>

                    <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#1a1a1a', borderRadius: '4px', borderLeft: '4px solid #4CAF50' }}>
                      <h4 style={{ margin: '0 0 0.5rem 0', color: '#fff' }}>{mage.ability_name} ({mage.charges} Charges)</h4>
                      {mage.ability_activation && (
                        <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#bbb', textAlign: 'center' }}><em>{mage.ability_activation}</em></p>
                      )}
                      <div 
                        style={{ fontSize: '0.9rem', color: '#ddd', textAlign: 'center' }}
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(mage.ability_effect || '') }} 
                      />
                    </div>

                    {mage.breaches && mage.breaches.length > 0 && (
                      <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: '#bbb' }}>
                        <strong style={{ color: '#ccc' }}>Breaches: </strong>
                        {mage.breaches.map(([type, pos], i) => (
                          <span key={i} style={{ marginRight: '0.5rem' }}>
                            {type}: <span style={{ color: pos === 'open' ? '#4CAF50' : '#ffa726' }}>{pos}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    <button 
                      onClick={() => visibleMats.toggle(mage.name)}
                      style={{ marginBottom: '1rem', background: 'none', border: 'none', color: '#2196F3', cursor: 'pointer', padding: 0, fontSize: '0.875rem' }}
                    >
                      {visibleMats.has(mage.name) ? 'Hide Mat Images' : 'Show Mat Images'}
                    </button>
                    {visibleMats.has(mage.name) && (
                      <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <a href={`https://aeonsend.wiki.gg/images/${encodeURIComponent(mage.name.replace(/ /g, '_'))}_Front.jpg`} target="_blank" rel="noopener noreferrer">
                            <img 
                              src={`https://aeonsend.wiki.gg/images/${encodeURIComponent(mage.name.replace(/ /g, '_'))}_Front.jpg`} 
                              alt={`${mage.name} Front`}
                              loading="lazy"
                              style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '4px' }} 
                            />
                          </a>
                        <a href={`https://aeonsend.wiki.gg/images/${encodeURIComponent(mage.name.replace(/ /g, '_'))}_Back.jpg`} target="_blank" rel="noopener noreferrer">
                            <img 
                              src={`https://aeonsend.wiki.gg/images/${encodeURIComponent(mage.name.replace(/ /g, '_'))}_Back.jpg`} 
                              alt={`${mage.name} Back`}
                              loading="lazy"
                              style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '4px' }} 
                            />
                          </a>
                      </div>
                    )}

                    {starters.length > 0 && (
                      <div>
                        <strong style={{ color: '#ccc', display: 'block', marginBottom: '0.5rem' }}>Unique Starters:</strong>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {starters.map((starter, sIdx) => (
                            <div key={sIdx} style={{ backgroundColor: '#333', padding: '0.75rem', borderRadius: '4px', border: '1px solid #444' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                <strong style={{ color: '#fff' }}>
                                  <a 
                                    href={starter.page_url || `https://aeonsend.wiki.gg/wiki/${encodeURIComponent(starter.name.replace(/ /g, '_'))}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    style={{ color: '#4CAF50', textDecoration: 'none' }}
                                  >
                                    {starter.name}
                                  </a>
                                </strong>
                                <span style={{ fontSize: '0.8rem', color: '#aaa' }}>{starter.type}</span>
                              </div>
                              <div 
                                style={{ fontSize: '0.85rem', color: '#ddd', textAlign: 'center' }}
                                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(starter.effect || '') }} 
                              />
                              <button 
                                onClick={() => visibleStarters.toggle(starter.name)}
                                style={{ marginTop: '0.5rem', background: 'none', border: 'none', color: '#2196F3', cursor: 'pointer', padding: 0, fontSize: '0.875rem' }}
                              >
                                {visibleStarters.has(starter.name) ? 'Hide Image' : 'Show Image'}
                              </button>
                              {visibleStarters.has(starter.name) && (
                                <div style={{ marginTop: '0.5rem' }}>
                                  <a href={`https://aeonsend.wiki.gg/images/${encodeURIComponent(starter.name.replace(/ /g, '_'))}.jpg`} target="_blank" rel="noopener noreferrer">
                                    <img 
                                      src={`https://aeonsend.wiki.gg/images/${encodeURIComponent(starter.name.replace(/ /g, '_'))}.jpg`} 
                                      alt={starter.name}
                                      loading="lazy"
                                      style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '4px' }} 
                                    />
                                  </a>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
        )}
      </div>
    </div>
  );
}





