import React, { useMemo, useState, useRef, useEffect } from 'react';
import { SlotCriteria } from '../store';
import { ScrapedSupplyCard } from '../types/scraped';
import { isCardMatch } from '../supplyRandomizerEngine';
import CardDisplayItem from './CardDisplayItem';
import { pillStyle } from './selectableStyle';

interface SupplySlotProps {
  criteria: SlotCriteria;
  availableCards: ScrapedSupplyCard[];
  assignedCard: ScrapedSupplyCard | null;
  onUpdate: (id: string, updates: Partial<SlotCriteria>) => void;
  onRemove: (id: string) => void;
  onReroll: (id: string) => void;
  onEditCriteria: (id: string) => void;
}

interface SlotMenuProps {
  onReroll: () => void;
  onEditCriteria: () => void;
  onRemove: () => void;
  hasAssignedCard: boolean;
}

const menuItemStyle: React.CSSProperties = {
  padding: '0.6rem 1rem',
  backgroundColor: 'transparent',
  color: 'white',
  border: 'none',
  textAlign: 'left',
  cursor: 'pointer',
  fontSize: '0.875rem',
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
};

function SlotMenu({ onReroll, onEditCriteria, onRemove, hasAssignedCard }: SlotMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const items: { label: string; onClick: () => void; style?: React.CSSProperties }[] = [
    { label: 'Randomize', onClick: onReroll },
    ...(hasAssignedCard ? [{ label: 'Edit Criteria', onClick: onEditCriteria }] : []),
    { label: 'Remove', onClick: onRemove, style: { color: '#f44336', borderTop: '1px solid #444' } },
  ];

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={menuRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setIsOpen(prev => !prev)}
        style={{
          background: 'none',
          border: 'none',
          color: '#aaa',
          fontSize: '1.25rem',
          cursor: 'pointer',
          padding: '0.25rem 0.5rem',
          lineHeight: 1,
          borderRadius: '4px',
        }}
        title="Slot Menu"
        aria-label="Slot Menu"
      >
        &#8942;
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            zIndex: 100,
            backgroundColor: '#2a2a2a',
            border: '1px solid #555',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            minWidth: '140px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {items.map(({ label, onClick, style }) => (
            <button
              key={label}
              onClick={() => {
                setIsOpen(false);
                onClick();
              }}
              style={{ ...menuItemStyle, ...style }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#3a3a3a')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Individual market slot component for the Supply Randomizer.
 * Provides controls for card type selection, dual cost range sliders, and text search filtering,
 * along with real-time matching card previews and randomized card display with standard CardSearch formatting.
 */
export default function SupplySlot({
  criteria,
  availableCards,
  assignedCard,
  onUpdate,
  onRemove,
  onReroll,
  onEditCriteria,
}: SupplySlotProps) {
  const matchingCards = useMemo(() => {
    return availableCards.filter(card => isCardMatch(card, criteria));
  }, [availableCards, criteria]);

  const slotId = criteria.id;
  const currentTypes = criteria.cardTypes;

  const toggleType = (type: 'Gem' | 'Relic' | 'Spell') => {
    const nextTypes = currentTypes.includes(type)
      ? currentTypes.filter(t => t !== type)
      : [...currentTypes, type];
    onUpdate(slotId, { cardTypes: nextTypes });
  };

  const handleCostMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    onUpdate(slotId, { costRange: [Math.min(val, criteria.costRange[1]), criteria.costRange[1]] });
  };

  const handleCostMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    onUpdate(slotId, { costRange: [criteria.costRange[0], Math.max(val, criteria.costRange[0])] });
  };

  const menu = (
    <SlotMenu
      onReroll={() => onReroll(slotId)}
      onEditCriteria={() => onEditCriteria(slotId)}
      onRemove={() => onRemove(slotId)}
      hasAssignedCard={!!assignedCard}
    />
  );

  if (assignedCard) {
    return (
      <CardDisplayItem 
        card={assignedCard}
        headerExtra={menu}
        containerStyle={{ border: '1px solid #444', position: 'relative' }}
      />
    );
  }

  return (
    <div style={{ backgroundColor: '#222', padding: '1rem', borderRadius: '8px', border: '1px solid #444', color: 'white', position: 'relative', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', zIndex: 10 }}>
        {menu}
      </div>

      <div>
        <strong style={{ color: '#ccc', display: 'block', marginBottom: '0.5rem' }}>Card Type:</strong>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {(['Gem', 'Relic', 'Spell'] as const).map(type => (
            <button key={type} onClick={() => toggleType(type)} style={pillStyle(currentTypes.includes(type))}>
              {type}
            </button>
          ))}
        </div>
      </div>

      <div>
        <strong style={{ color: '#ccc', display: 'block', marginBottom: '0.5rem' }}>Cost Range ({criteria.costRange[0]} - {criteria.costRange[1]}):</strong>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <input type="range" min="0" max="10" value={criteria.costRange[0]} onChange={handleCostMinChange} style={{ flex: 1, minWidth: 0 }} />
          <input type="range" min="0" max="10" value={criteria.costRange[1]} onChange={handleCostMaxChange} style={{ flex: 1, minWidth: 0 }} />
        </div>
      </div>

      <div>
        <strong style={{ color: '#ccc', display: 'block', marginBottom: '0.5rem' }}>Search Terms:</strong>
        <input 
          type="text" 
          value={criteria.searchTerm} 
          onChange={e => onUpdate(slotId, { searchTerm: e.target.value })} 
          placeholder="Filter by name or effect..."
          style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#333', color: 'white', boxSizing: 'border-box' }}
        />
      </div>

      <div>
        <strong style={{ color: matchingCards.length === 0 ? '#f44336' : '#aaa', fontSize: '0.875rem' }}>
          {matchingCards.length} Matching Cards
        </strong>
      </div>
    </div>
  );
}
