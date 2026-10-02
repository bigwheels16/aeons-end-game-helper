import DOMPurify from 'dompurify';
import { ScrapedMage } from '../types/scraped';
import { getMageStarters } from '../utils/mages';
import FavoriteStar from './FavoriteStar';
import WikiLink from './WikiLink';

const BREACH_POSITION_COLORS: Record<string, string> = {
  open: '#4CAF50',
  right: '#e53935',
  down: '#e65100',
  left: '#ffb74d',
  up: '#fdd835',
};

export interface MageDisplayItemProps {
  mage: ScrapedMage;
  matsVisible: boolean;
  onToggleMats: () => void;
  isStarterVisible: (starterName: string) => boolean;
  onToggleStarter: (starterName: string) => void;
}

/**
 * Mage presentation card: title (wiki link), favorite star, special ability and additional rules,
 * complexity, color-coded breach positions, mat images, and unique starter cards.
 */
export default function MageDisplayItem({
  mage,
  matsVisible,
  onToggleMats,
  isStarterVisible,
  onToggleStarter
}: MageDisplayItemProps) {
  const starters = getMageStarters(mage);

  return (
    <div style={{ backgroundColor: '#222', padding: '0.75rem', borderRadius: '8px', border: '1px solid #444', color: 'white', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', margin: '0 0 0.25rem 0' }}>
        <h2 style={{ margin: 0 }}>
          <WikiLink url={mage.page_url} fallbackName={mage.name} style={{ color: '#4CAF50', textDecoration: 'none' }}>
            {mage.name}
          </WikiLink>
        </h2>
        <FavoriteStar category="mages" id={mage.id} name={mage.name} />
      </div>
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
        {mage.additional_rules && (
          <div style={{ marginTop: '0.75rem' }}>
            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#bbb', textAlign: 'center' }}><em>Additional Rules:</em></p>
            <div
              style={{ fontSize: '0.9rem', color: '#ddd', textAlign: 'center' }}
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(mage.additional_rules) }}
            />
          </div>
        )}
      </div>

      {mage.complexity && (
        <div style={{ marginBottom: '0.5rem', fontSize: '0.85rem', color: '#bbb' }}>
          <strong style={{ color: '#ccc' }}>Complexity: </strong>{mage.complexity}
        </div>
      )}

      {mage.breaches && mage.breaches.length > 0 && (
        <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: '#bbb' }}>
          <strong style={{ color: '#ccc' }}>Breaches: </strong>
          {mage.breaches.map(([type, pos], i) => (
            <span key={i} style={{ marginRight: '0.5rem' }}>
              {type}: <span style={{ color: BREACH_POSITION_COLORS[pos] ?? '#bbb' }}>{pos}</span>
            </span>
          ))}
        </div>
      )}

      <button 
        onClick={() => onToggleMats()}
        style={{ marginBottom: '1rem', background: 'none', border: 'none', color: '#2196F3', cursor: 'pointer', padding: 0, fontSize: '0.875rem' }}
      >
        {matsVisible ? 'Hide Mat Images' : 'Show Mat Images'}
      </button>
      {matsVisible && (
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
                    <WikiLink url={starter.page_url} fallbackName={starter.name} style={{ color: '#4CAF50', textDecoration: 'none' }}>
                      {starter.name}
                    </WikiLink>
                  </strong>
                  <span style={{ fontSize: '0.8rem', color: '#aaa' }}>{starter.type}</span>
                </div>
                <div 
                  style={{ fontSize: '0.85rem', color: '#ddd', textAlign: 'center' }}
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(starter.effect || '') }} 
                />
                <button 
                  onClick={() => onToggleStarter(starter.name)}
                  style={{ marginTop: '0.5rem', background: 'none', border: 'none', color: '#2196F3', cursor: 'pointer', padding: 0, fontSize: '0.875rem' }}
                >
                  {isStarterVisible(starter.name) ? 'Hide Image' : 'Show Image'}
                </button>
                {isStarterVisible(starter.name) && (
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
}
