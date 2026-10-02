import { useState } from 'react';
import { ScrapedNemesis } from '../types/scraped';
import FavoriteStar from './FavoriteStar';
import ScrapedHtml from './ScrapedHtml';
import WikiImage from './WikiImage';
import WikiLink from './WikiLink';

/** Rules text sections, in display order. */
const TEXT_SECTIONS: { label: string; color: string; field: 'unleash' | 'increased_difficulty' | 'rules' | 'setup' }[] = [
  { label: 'Unleash', color: '#ff7043', field: 'unleash' },
  { label: 'Increased Difficulty', color: '#ef5350', field: 'increased_difficulty' },
  { label: 'Rules', color: '#42a5f5', field: 'rules' },
  { label: 'Setup', color: '#ffa726', field: 'setup' },
];

export interface NemesisDisplayItemProps {
  nemesis: ScrapedNemesis;
}

/**
 * Nemesis presentation card: title (wiki link), favorite star, health and difficulty,
 * unleash, increased difficulty, rules, setup, and mat images.
 */
export default function NemesisDisplayItem({ nemesis }: NemesisDisplayItemProps) {
  const [showMats, setShowMats] = useState(false);

  return (
    <div style={{ backgroundColor: '#222', padding: '0.75rem', borderRadius: '8px', border: '1px solid #444', color: 'white', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', margin: '0 0 0.25rem 0' }}>
        <h2 style={{ margin: 0 }}>
          <WikiLink url={nemesis.page_url} style={{ color: '#4CAF50', textDecoration: 'none' }}>
            {nemesis.name}
          </WikiLink>
        </h2>
        <FavoriteStar category="nemeses" id={nemesis.id} name={nemesis.name} />
      </div>
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

      {TEXT_SECTIONS.map(({ label, color, field }) => nemesis[field] && (
        <div key={field} style={{ marginBottom: '0.75rem' }}>
          <strong style={{ color, display: 'block', marginBottom: '0.25rem' }}>{label}:</strong>
          <ScrapedHtml
            html={nemesis[field]}
            style={{ fontSize: '0.9rem', color: '#ddd' }}
          />
        </div>
      ))}

      <button 
        onClick={() => setShowMats(prev => !prev)}
        style={{ marginTop: '1rem', background: 'none', border: 'none', color: '#2196F3', cursor: 'pointer', padding: 0, fontSize: '0.875rem' }}
      >
        {showMats ? 'Hide Mat Images' : 'Show Mat Images'}
      </button>
      {showMats && (
        <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <WikiImage name={`${nemesis.name} Front`} />
          <WikiImage name={`${nemesis.name} Back`} />
        </div>
      )}
    </div>
  );
}
