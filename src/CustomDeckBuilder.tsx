import React, { useState, useEffect } from 'react';
import { useGameStore } from './store';
import { CardType, CARD_IMAGES } from './deckEngine';

/**
 * CustomDeckBuilder Component.
 *
 * Provides a dedicated screen for constructing custom turn order decks through direct visual manipulation:
 * - Top section: Pool of available card types (`AVAILABLE_CARDS`) that can be tapped to add copies to the deck.
 * - Bottom section: Current deck composition with tap-to-remove interactions.
 * - Bottom bar: "DONE" action that validates non-empty decks, persists configuration to the store, and navigates back to setup.
 */
const CustomDeckBuilder: React.FC = () => {
  const store = useGameStore();
  const [draftDeck, setDraftDeck] = useState<CardType[]>([]);

  useEffect(() => {
    // Load existing custom deck on mount
    setDraftDeck(store.customDeck || []);
  }, [store.customDeck]);

  const handleAddCard = (type: CardType) => {
    setDraftDeck(prev => [...prev, type]);
  };

  const handleRemoveCard = (indexToRemove: number) => {
    setDraftDeck(prev => prev.filter((_, i) => i !== indexToRemove));
  };

  const handleDone = () => {
    if (draftDeck.length === 0) {
      alert('Deck must contain at least one card.');
      return;
    }
    store.setCustomDeck(draftDeck);
    store.setPlayerCount('custom');
    window.location.hash = 'turn-order';
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Custom Deck Builder</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '10px' }}>Available Cards (Tap to Add)</h3>
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px' }}>
          {(Object.keys(CARD_IMAGES) as CardType[]).map(type => (
            <div 
              key={type} 
              onClick={() => handleAddCard(type)}
              style={{ flexShrink: 0, width: '100px', cursor: 'pointer', textAlign: 'center' }}
            >
              <img src={CARD_IMAGES[type]} alt={type} style={{ width: '100%', borderRadius: '8px', border: '2px solid transparent' }} />
              <div style={{ fontSize: '12px', marginTop: '5px' }}>{type}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '10px' }}>Current Deck ({draftDeck.length} Cards) (Tap to Remove)</h3>
        {draftDeck.length === 0 ? (
          <div style={{ color: '#888', fontStyle: 'italic', padding: '20px', textAlign: 'center', backgroundColor: '#222', borderRadius: '8px' }}>
            Deck is empty. Add cards from above.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '10px' }}>
            {draftDeck.map((type, index) => (
              <div 
                key={`${type}-${index}`} 
                onClick={() => handleRemoveCard(index)}
                style={{ cursor: 'pointer', position: 'relative' }}
              >
                <img src={CARD_IMAGES[type]} alt={type} style={{ width: '100%', borderRadius: '8px', display: 'block' }} />
                <div style={{ position: 'absolute', top: '-5px', right: '-5px', background: 'red', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                  &times;
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {draftDeck.length > 0 && !draftDeck.includes('Nemesis') && (
        <div style={{ padding: '10px', backgroundColor: 'rgba(255, 152, 0, 0.2)', color: '#ff9800', borderRadius: '8px', marginBottom: '15px', textAlign: 'center', border: '1px solid #ff9800' }}>
          Warning: Your deck does not contain any Nemesis cards.
        </div>
      )}
      
      {draftDeck.length > 0 && !draftDeck.some(c => c !== 'Nemesis') && (
        <div style={{ padding: '10px', backgroundColor: 'rgba(255, 152, 0, 0.2)', color: '#ff9800', borderRadius: '8px', marginBottom: '15px', textAlign: 'center', border: '1px solid #ff9800' }}>
          Warning: Your deck only contains Nemesis cards.
        </div>
      )}

      <button
        onClick={handleDone}
        disabled={draftDeck.length === 0}
        style={{
          width: '100%',
          padding: '20px',
          backgroundColor: draftDeck.length > 0 ? '#4CAF50' : '#555',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '20px',
          fontWeight: 'bold',
          cursor: draftDeck.length > 0 ? 'pointer' : 'not-allowed'
        }}
      >
        DONE
      </button>
    </div>
  );
};

export default CustomDeckBuilder;
