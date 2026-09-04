import React, { useState } from 'react';
import DOMPurify from 'dompurify';
import { ScrapedSupplyCard } from '../types/scraped';

export interface CardDisplayItemProps {
  card: ScrapedSupplyCard;
  headerExtra?: React.ReactNode;
  containerStyle?: React.CSSProperties;
  isImageVisible?: boolean;
  onToggleImage?: () => void;
}

/**
 * Standard card presentation component matching the layout and styling of CardSearchScreen.
 * Displays card title (wiki link), type, expansions, cost, sanitized effect,
 * and a collapsible image viewer.
 */
export default function CardDisplayItem({
  card,
  headerExtra,
  containerStyle,
  isImageVisible,
  onToggleImage
}: CardDisplayItemProps) {
  const [internalShowImage, setInternalShowImage] = useState(false);
  const showImage = isImageVisible !== undefined ? isImageVisible : internalShowImage;
  const toggleImage = onToggleImage || (() => setInternalShowImage(prev => !prev));

  const wikiUrl = card.page_url || `https://aeonsend.wiki.gg/wiki/${card.name.replace(/ /g, '_')}`;
  const imageUrl = `https://aeonsend.wiki.gg/images/${card.name.replace(/ /g, '_')}.jpg`;

  return (
    <div 
      style={{ 
        backgroundColor: '#222', 
        padding: '1rem', 
        borderRadius: '8px', 
        border: '1px solid #444', 
        color: 'white', 
        overflow: 'hidden',
        ...containerStyle 
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
        <h3 style={{ margin: 0 }}>
          <a 
            href={wikiUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: '#4CAF50', textDecoration: 'none' }}
          >
            {card.name}
          </a>
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.8rem', color: '#aaa', flexShrink: 0 }}>{card.type}</span>
          {headerExtra}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#aaa', marginBottom: '0.5rem' }}>
        <span>{card.expansions?.join(', ') || 'Unknown'}</span>
        <span>Cost: {card.cost}</span>
      </div>
      <div 
        style={{ fontSize: '0.9rem', color: '#ddd', marginBottom: '0.5rem', textAlign: 'center' }}
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(card.effect || '') }} 
      />
      <button 
        onClick={toggleImage}
        style={{ background: 'none', border: 'none', color: '#2196F3', cursor: 'pointer', padding: 0, fontSize: '0.875rem' }}
      >
        {showImage ? 'Hide Image' : 'Show Image'}
      </button>
      {showImage && (
        <div style={{ marginTop: '0.5rem' }}>
          <a href={imageUrl} target="_blank" rel="noopener noreferrer">
            <img 
              src={imageUrl} 
              alt={card.name}
              loading="lazy"
              style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '4px' }} 
            />
          </a>
        </div>
      )}
    </div>
  );
}
