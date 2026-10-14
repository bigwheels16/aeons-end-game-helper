import { useState } from 'react';
import { ScrapedMage } from '../types/scraped';
import { getMageStarters } from '../utils/mages';
import CardDisplayItem from './CardDisplayItem';
import FavoriteStar from './FavoriteStar';
import NoteButton from './NoteButton';
import ScrapedHtml from './ScrapedHtml';
import WikiImage from './WikiImage';
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
}

/** One starting card list (hand or deck), one card per line. */
function StartingCards({ label, html }: { label: string; html: string | undefined }) {
  if (!html) return null;
  return (
    <div style={{ flex: '1 1 140px' }}>
      <strong style={{ color: '#ccc', display: 'block', marginBottom: '0.25rem' }}>{label}:</strong>
      <ScrapedHtml html={html} style={{ lineHeight: 1.5 }} />
    </div>
  );
}

/**
 * Mage presentation card: title (wiki link), note icon, favorite star, special ability and additional rules,
 * complexity, color-coded breach positions, starting hand and deck, mat images, and unique starter cards.
 */
export default function MageDisplayItem({ mage }: MageDisplayItemProps) {
  const [showMats, setShowMats] = useState(false);
  const starters = getMageStarters(mage);

  return (
    <div style={{ backgroundColor: '#222', padding: '0.75rem', borderRadius: '8px', border: '1px solid #444', color: 'white', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', margin: '0 0 0.25rem 0' }}>
        <h2 style={{ margin: 0 }}>
          <WikiLink title={mage.name} style={{ color: '#4CAF50', textDecoration: 'none' }}>
            {mage.name}
          </WikiLink>
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          <NoteButton category="mages" id={mage.id} name={mage.name} />
          <FavoriteStar category="mages" id={mage.id} name={mage.name} />
        </div>
      </div>
      <h4 style={{ margin: '0 0 1rem 0', color: '#aaa', fontWeight: 'normal', fontStyle: 'italic' }}>
        {mage.title ? `${mage.title} | ` : ''}{mage.expansions?.join(', ') || 'Unknown'}
      </h4>

      <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#1a1a1a', borderRadius: '4px', borderLeft: '4px solid #4CAF50' }}>
        <h4 style={{ margin: '0 0 0.5rem 0', color: '#fff' }}>{mage.ability_name} ({mage.charges} Charges)</h4>
        {mage.ability_activation && (
          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#bbb', textAlign: 'center' }}><em>{mage.ability_activation}</em></p>
        )}
        <ScrapedHtml
          html={mage.ability_effect}
          style={{ fontSize: '0.9rem', color: '#ddd', textAlign: 'center' }}
        />
        {mage.additional_rules && (
          <div style={{ marginTop: '0.75rem' }}>
            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#bbb', textAlign: 'center' }}><em>Additional Rules:</em></p>
            <ScrapedHtml
              html={mage.additional_rules}
              style={{ fontSize: '0.9rem', color: '#ddd', textAlign: 'center' }}
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

      {(mage.starting_hand || mage.starting_deck) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1.5rem', marginBottom: '1rem', fontSize: '0.85rem', color: '#bbb' }}>
          <StartingCards label="Starting Hand" html={mage.starting_hand} />
          <StartingCards label="Starting Deck" html={mage.starting_deck} />
        </div>
      )}

      <button 
        onClick={() => setShowMats(prev => !prev)}
        style={{ marginBottom: '1rem', background: 'none', border: 'none', color: '#2196F3', cursor: 'pointer', padding: 0, fontSize: '0.875rem' }}
      >
        {showMats ? 'Hide Mat Images' : 'Show Mat Images'}
      </button>
      {showMats && (
        <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {mage.images?.map(file => <WikiImage key={file} file={file} />)}
        </div>
      )}

      {starters.length > 0 && (
        <div>
          <strong style={{ color: '#ccc', display: 'block', marginBottom: '0.5rem' }}>Unique Starters:</strong>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {starters.map(starter => (
              <CardDisplayItem
                key={starter.id}
                card={starter}
                isSupplyCard={false}
                containerStyle={{ backgroundColor: '#333' }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
