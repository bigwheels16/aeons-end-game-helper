import { useState, useMemo, useEffect } from 'react';
import DOMPurify from 'dompurify';
import scrapedData from '../../data/scraped/aeons_end_all.json';
import { useGameStore } from '../store';
import ExpansionFilter from '../components/ExpansionFilter';

interface ScrapedNemesis {
  name: string;
  type: string;
  health?: string;
  difficulty?: string;
  expedition_battle?: string;
  unleash?: string;
  increased_difficulty?: string;
  rules?: string;
  setup?: string;
  expansions?: string[];
  page_url?: string;
}

const allNemeses: ScrapedNemesis[] = scrapedData.nemeses || [];

export default function NemesisSearchScreen() {
  const nemesisSearchFilters = useGameStore((state) => state.nemesisSearchFilters);
  const setNemesisSearchFilters = useGameStore((state) => state.setNemesisSearchFilters);

  const { nemesisQuery, selectedNemesisExpansions } = nemesisSearchFilters;
  const [visibleImages, setVisibleImages] = useState<Set<string>>(new Set());

  const toggleImage = (id: string) => {
    setVisibleImages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };
  
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
      n.expansions?.forEach(e => {
        if (e) exps.add(e);
      });
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

      return true;
    }).sort((a, b) => {
      const diffA = a.difficulty !== undefined ? Number(a.difficulty) || 0 : 0;
      const diffB = b.difficulty !== undefined ? Number(b.difficulty) || 0 : 0;
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
                <div key={`${nemesis.name}-${idx}`} style={{ backgroundColor: '#222', padding: '1.5rem', borderRadius: '8px', border: '1px solid #444', color: 'white', overflow: 'hidden' }}>
                    <h2 style={{ margin: '0 0 0.25rem 0' }}>
                      <a 
                        href={nemesis.page_url || `https://aeonsend.wiki.gg/wiki/${encodeURIComponent(nemesis.name.replace(/ /g, '_'))}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ color: '#4CAF50', textDecoration: 'none' }}
                      >
                        {nemesis.name}
                      </a>
                    </h2>
                    <h4 style={{ margin: '0 0 1rem 0', color: '#aaa', fontWeight: 'normal', fontStyle: 'italic' }}>
                      {nemesis.expansions?.join(', ') || 'Unknown'}
                    </h4>

                    <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#1a1a1a', borderRadius: '4px', borderLeft: '4px solid #f44336' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <strong style={{ color: '#fff' }}>Health: {nemesis.health}</strong>
                        <strong style={{ color: '#fff' }}>Difficulty: {nemesis.difficulty}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#bbb', fontSize: '0.9rem' }}>Expedition Battle: {nemesis.expedition_battle || 'N/A'}</span>
                      </div>
                    </div>

                    {nemesis.unleash && (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <strong style={{ color: '#ff7043', display: 'block', marginBottom: '0.25rem' }}>Unleash:</strong>
                        <div 
                          style={{ fontSize: '0.9rem', color: '#ddd' }}
                          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(nemesis.unleash) }} 
                        />
                      </div>
                    )}

                    {nemesis.increased_difficulty && (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <strong style={{ color: '#ef5350', display: 'block', marginBottom: '0.25rem' }}>Increased Difficulty:</strong>
                        <div 
                          style={{ fontSize: '0.9rem', color: '#ddd' }}
                          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(nemesis.increased_difficulty) }} 
                        />
                      </div>
                    )}

                    {nemesis.rules && (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <strong style={{ color: '#42a5f5', display: 'block', marginBottom: '0.25rem' }}>Rules:</strong>
                        <div 
                          style={{ fontSize: '0.9rem', color: '#ddd' }}
                          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(nemesis.rules) }} 
                        />
                      </div>
                    )}

                    {nemesis.setup && (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <strong style={{ color: '#ffa726', display: 'block', marginBottom: '0.25rem' }}>Setup:</strong>
                        <div 
                          style={{ fontSize: '0.9rem', color: '#ddd' }}
                          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(nemesis.setup) }} 
                        />
                      </div>
                    )}

                    <button 
                      onClick={() => toggleImage(nemesis.name)}
                      style={{ marginTop: '1rem', background: 'none', border: 'none', color: '#2196F3', cursor: 'pointer', padding: 0, fontSize: '0.875rem' }}
                    >
                      {visibleImages.has(nemesis.name) ? 'Hide Mat Images' : 'Show Mat Images'}
                    </button>
                    {visibleImages.has(nemesis.name) && (
                      <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <a href={`https://aeonsend.wiki.gg/images/${encodeURIComponent(nemesis.name.replace(/ /g, '_'))}_Front.jpg`} target="_blank" rel="noopener noreferrer">
                          <img 
                            src={`https://aeonsend.wiki.gg/images/${encodeURIComponent(nemesis.name.replace(/ /g, '_'))}_Front.jpg`} 
                            alt={`${nemesis.name} Front`}
                            loading="lazy"
                            style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '4px' }} 
                          />
                        </a>
                        <a href={`https://aeonsend.wiki.gg/images/${encodeURIComponent(nemesis.name.replace(/ /g, '_'))}_Back.jpg`} target="_blank" rel="noopener noreferrer">
                          <img 
                            src={`https://aeonsend.wiki.gg/images/${encodeURIComponent(nemesis.name.replace(/ /g, '_'))}_Back.jpg`} 
                            alt={`${nemesis.name} Back`}
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





