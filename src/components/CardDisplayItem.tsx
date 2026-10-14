import React, { useState } from 'react';
import { ScrapedSupplyCard } from '../types/scraped';
import FavoriteStar from './FavoriteStar';
import NoteButton from './NoteButton';
import ScrapedHtml from './ScrapedHtml';
import WikiImage from './WikiImage';
import WikiLink from './WikiLink';

export interface CardDisplayItemProps {
  card: ScrapedSupplyCard;
  headerExtra?: React.ReactNode;
  containerStyle?: React.CSSProperties;
  /** Supply cards show the note icon, favorites star and expansions; unique starters don't. */
  isSupplyCard?: boolean;
}

/**
 * Supply or unique starter card presentation, matching the layout and styling of CardSearchScreen.
 * Displays card title (wiki link), type, note icon, favorite star, expansions, cost, effect,
 * and a collapsible image viewer.
 */
export default function CardDisplayItem({
  card,
  headerExtra,
  containerStyle,
  isSupplyCard = true
}: CardDisplayItemProps) {
  const [showImage, setShowImage] = useState(false);

  return (
    <div 
      style={{ 
        backgroundColor: '#222', 
        padding: '0.5rem', 
        borderRadius: '8px', 
        border: '1px solid #444', 
        color: 'white', 
        overflow: 'hidden',
        ...containerStyle 
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
        <h3 style={{ margin: 0 }}>
          <WikiLink title={card.name} style={{ color: '#4CAF50', textDecoration: 'none' }}>
            {card.name}
          </WikiLink>
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.8rem', color: '#aaa', flexShrink: 0 }}>{card.type}</span>
          {headerExtra}
          {isSupplyCard && (
            <>
              <NoteButton category="supply" id={card.id} name={card.name} />
              <FavoriteStar category="supply" id={card.id} name={card.name} />
            </>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#aaa', marginBottom: '0.5rem' }}>
        {isSupplyCard && <span>{card.expansions?.join(', ') || 'Unknown'}</span>}
        <span>Cost: {card.cost}</span>
      </div>
      <ScrapedHtml
        html={card.effect}
        style={{ fontSize: '0.9rem', color: '#ddd', marginBottom: '0.5rem', textAlign: 'center' }}
      />
      <button 
        onClick={() => setShowImage(prev => !prev)}
        style={{ background: 'none', border: 'none', color: '#2196F3', cursor: 'pointer', padding: 0, fontSize: '0.875rem' }}
      >
        {showImage ? 'Hide Image' : 'Show Image'}
      </button>
      {showImage && (
        <div style={{ marginTop: '0.5rem' }}>
          {card.images?.map(file => <WikiImage key={file} file={file} />)}
        </div>
      )}
    </div>
  );
}
