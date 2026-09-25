import DOMPurify from 'dompurify';
import { ScrapedNemesis } from '../types/scraped';
import FavoriteStar from './FavoriteStar';

export interface NemesisDisplayItemProps {
  nemesis: ScrapedNemesis;
  imagesVisible: boolean;
  onToggleImages: () => void;
}

/**
 * Nemesis presentation card: title (wiki link), favorite star, health and difficulty,
 * unleash, increased difficulty, rules, setup, and mat images.
 */
export default function NemesisDisplayItem({
  nemesis,
  imagesVisible,
  onToggleImages
}: NemesisDisplayItemProps) {
  return (
    <div style={{ backgroundColor: '#222', padding: '1.5rem', borderRadius: '8px', border: '1px solid #444', color: 'white', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', margin: '0 0 0.25rem 0' }}>
        <h2 style={{ margin: 0 }}>
          <a 
            href={nemesis.page_url || `https://aeonsend.wiki.gg/wiki/${encodeURIComponent(nemesis.name.replace(/ /g, '_'))}`} 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: '#4CAF50', textDecoration: 'none' }}
          >
            {nemesis.name}
          </a>
        </h2>
        <FavoriteStar category="nemeses" name={nemesis.name} />
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
        onClick={() => onToggleImages()}
        style={{ marginTop: '1rem', background: 'none', border: 'none', color: '#2196F3', cursor: 'pointer', padding: 0, fontSize: '0.875rem' }}
      >
        {imagesVisible ? 'Hide Mat Images' : 'Show Mat Images'}
      </button>
      {imagesVisible && (
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
  );
}
