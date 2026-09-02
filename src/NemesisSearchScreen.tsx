import { useState, useMemo, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { allNemeses } from './data/allNemeses';
import { useGameStore } from './store';
import ExpansionFilter from './components/ExpansionFilter';

export default function NemesisSearchScreen() {
  const nemesisSearchFilters = useGameStore((state) => state.nemesisSearchFilters);
  const setNemesisSearchFilters = useGameStore((state) => state.setNemesisSearchFilters);
  const [showImages, setShowImages] = useState(false);

  const { nemesisQuery, selectedNemesisExpansions } = nemesisSearchFilters;
  
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(nemesisQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [nemesisQuery]);

  const allExpansions = useMemo(() => {
    const exps = new Set<string>();
    allNemeses.forEach(n => {
      if (n.expansion) exps.add(n.expansion);
    });
    return Array.from(exps).sort();
  }, []);

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
    });
    setDebouncedQuery('');
    setShowImages(false);
  };

  const stripHtml = (html: string) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
  };

  const filteredNemeses = useMemo(() => {
    return allNemeses.filter(nemesis => {
      if (!nemesis) return false;

      if (debouncedQuery) {
        const terms = debouncedQuery.toLowerCase().split(/\s+/).filter(Boolean);
        const searchableText = [
          nemesis.name,
          nemesis.additionalInfo ? stripHtml(nemesis.additionalInfo) : ''
        ].join(' ').toLowerCase();
        
        if (!terms.every(term => searchableText.includes(term))) {
          return false;
        }
      }

      if (selectedNemesisExpansions.length > 0 && (!nemesis.expansion || !selectedNemesisExpansions.includes(nemesis.expansion))) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      const diffA = a.difficulty !== undefined ? Number(a.difficulty) : 0;
      const diffB = b.difficulty !== undefined ? Number(b.difficulty) : 0;
      return diffA - diffB;
    });
  }, [debouncedQuery, selectedNemesisExpansions]);

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
          <label style={{ color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={showImages} 
              onChange={e => setShowImages(e.target.checked)} 
              style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
            />
            Show Nemesis Mats (Images Only)
          </label>
        </div>
      </div>

      <div style={{ padding: '1rem', backgroundColor: '#1a1a1a' }}>
        {filteredNemeses.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <p style={{ fontSize: '1.25rem', color: '#ccc' }}>No matching nemeses found.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: showImages ? 'repeat(auto-fill, minmax(400px, 1fr))' : 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
            {filteredNemeses.map((nemesis, idx) => (
              <div key={nemesis.id || idx} style={{ backgroundColor: '#222', padding: showImages ? '0' : '1.5rem', borderRadius: '8px', border: '1px solid #444', color: 'white', overflow: 'hidden' }}>
                {showImages ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                    <a href={`https://aeonsend.wiki.gg/wiki/${nemesis.name.replace(/ /g, '_')}`} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
                      <img 
                        src={`https://aeonsend.wiki.gg/images/${nemesis.name.replace(/ /g, '_')}_Front.jpg`} 
                        alt={`${nemesis.name} Front`}
                        loading="lazy"
                        style={{ width: '100%', height: 'auto', display: 'block' }} 
                      />
                    </a>
                    <a href={`https://aeonsend.wiki.gg/wiki/${nemesis.name.replace(/ /g, '_')}`} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
                      <img 
                        src={`https://aeonsend.wiki.gg/images/${nemesis.name.replace(/ /g, '_')}_Back.jpg`} 
                        alt={`${nemesis.name} Back`}
                        loading="lazy"
                        style={{ width: '100%', height: 'auto', display: 'block', marginTop: '4px' }} 
                      />
                    </a>
                  </div>
                ) : (
                  <>
                    <h2 style={{ margin: '0 0 0.25rem 0' }}>
                      <a 
                        href={`https://aeonsend.wiki.gg/wiki/${nemesis.name.replace(/ /g, '_')}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ color: '#4CAF50', textDecoration: 'none' }}
                      >
                        {nemesis.name}
                      </a>
                    </h2>
                    <h4 style={{ margin: '0 0 1rem 0', color: '#aaa', fontWeight: 'normal', fontStyle: 'italic' }}>
                      {nemesis.expansion}
                    </h4>

                    <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#1a1a1a', borderRadius: '4px', borderLeft: '4px solid #f44336' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <strong style={{ color: '#fff' }}>Health: {nemesis.health}</strong>
                        <strong style={{ color: '#fff' }}>Difficulty: {nemesis.difficulty}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#bbb', fontSize: '0.9rem' }}>Expedition Rating: {nemesis.expeditionRating}</span>
                      </div>
                    </div>

                    {nemesis.additionalInfo && (
                      <div>
                        <strong style={{ color: '#ccc', display: 'block', marginBottom: '0.5rem' }}>Additional Info:</strong>
                        <div 
                          style={{ fontSize: '0.9rem', color: '#ddd' }}
                          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(nemesis.additionalInfo) }} 
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
