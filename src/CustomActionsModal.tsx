import React, { useState } from 'react';
import { useGameStore } from './store';

/**
 * Step identifiers for the Custom Actions multi-step wizard:
 * - `menu`: Main action selection screen (Shuffle vs. Move Cards)
 * - `move_source`: Selection of pile from which to take a card (Draw or Discard)
 * - `move_card`: Selection of specific card from the chosen source pile
 * - `move_dest`: Selection of destination placement ('Top', 'Bottom', or 'Shuffled' in Draw Pile, or Discard)
 */
type WizardStep = 'menu' | 'move_source' | 'move_card' | 'move_dest';

/**
 * Props for the CustomActionsModal component.
 */
interface CustomActionsModalProps {
  /** Whether the modal dialog is currently visible. */
  isOpen: boolean;
  /** Callback invoked when closing or dismissing the modal dialog. */
  onClose: () => void;
}

/**
 * Custom Actions Modal Component.
 *
 * Provides a guided interface for in-game turn order deck manipulation:
 * 1. Shuffling the remaining cards in the Draw Pile.
 * 2. Moving cards between the Draw Pile and Discard Pile with position targeting (Top, Bottom, Shuffled).
 */
export const CustomActionsModal: React.FC<CustomActionsModalProps> = ({ isOpen, onClose }) => {
  const { shuffleDrawPile, moveCard, drawPile, discardPile } = useGameStore();
  const [step, setStep] = useState<WizardStep>('menu');
  const [selectedSource, setSelectedSource] = useState<'draw' | 'discard' | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  if (!isOpen) return null;

  /**
   * Resets wizard selection state back to the initial step and closes the modal.
   */
  const resetAndClose = () => {
    setStep('menu');
    setSelectedSource(null);
    setSelectedCardId(null);
    onClose();
  };

  /**
   * Triggers draw pile shuffle and closes the modal.
   */
  const handleShuffle = () => {
    shuffleDrawPile();
    resetAndClose();
  };

  /**
   * Sets the chosen source pile and navigates to card selection.
   */
  const handleSourceSelect = (source: 'draw' | 'discard') => {
    setSelectedSource(source);
    setStep('move_card');
  };

  /**
   * Sets the selected card and advances to destination/position selection.
   */
  const handleCardSelect = (cardId: string) => {
    setSelectedCardId(cardId);
    setStep('move_dest');
  };

  /**
   * Finalizes the move operation and closes the modal dialog.
   */
  const handleDestSelect = (dest: 'draw' | 'discard', position: 'top' | 'bottom' | 'shuffled') => {
    if (selectedSource && selectedCardId) {
      moveCard(selectedSource, selectedCardId, dest, position);
    }
    resetAndClose();
  };

  const renderMenu = () => (
    <>
      <button 
        onClick={handleShuffle}
        disabled={drawPile.length <= 1}
        style={{ width: '100%', padding: '15px', marginBottom: '10px', fontSize: '18px', opacity: drawPile.length <= 1 ? 0.5 : 1 }}
      >
        Shuffle Draw Pile
      </button>
      <button 
        onClick={() => setStep('move_source')}
        style={{ width: '100%', padding: '15px', fontSize: '18px' }}
      >
        Move Cards
      </button>
    </>
  );

  const renderMoveSource = () => (
    <>
      <h3 style={{ marginTop: 0 }}>Select Source Pile</h3>
      <button 
        onClick={() => handleSourceSelect('draw')}
        disabled={drawPile.length === 0}
        style={{ width: '100%', padding: '15px', marginBottom: '10px', fontSize: '18px', opacity: drawPile.length === 0 ? 0.5 : 1 }}
      >
        Draw Pile
      </button>
      <button 
        onClick={() => handleSourceSelect('discard')}
        disabled={discardPile.length === 0}
        style={{ width: '100%', padding: '15px', fontSize: '18px', opacity: discardPile.length === 0 ? 0.5 : 1 }}
      >
        Discard Pile
      </button>
    </>
  );

  const renderMoveCard = () => {
    const cards = selectedSource === 'draw' ? drawPile : discardPile;
    return (
      <>
        <h3 style={{ marginTop: 0 }}>Select Card</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', maxHeight: '50vh', overflowY: 'auto' }}>
          {cards.map(card => (
            <img 
              key={card.id} 
              src={card.imageFaceUrl} 
              alt={card.type} 
              onClick={() => handleCardSelect(card.id)}
              style={{ width: '80px', objectFit: 'contain', cursor: 'pointer', border: '2px solid transparent' }} 
            />
          ))}
        </div>
      </>
    );
  };

  const renderMoveDest = () => {
    const dest = selectedSource === 'draw' ? 'discard' : 'draw';
    return (
      <>
        <h3 style={{ marginTop: 0 }}>Select Destination Position</h3>
        {dest === 'draw' ? (
          <>
            <button onClick={() => handleDestSelect('draw', 'top')} style={{ width: '100%', padding: '15px', marginBottom: '10px' }}>Top of Draw Pile</button>
            <button onClick={() => handleDestSelect('draw', 'bottom')} style={{ width: '100%', padding: '15px', marginBottom: '10px' }}>Bottom of Draw Pile</button>
            <button onClick={() => handleDestSelect('draw', 'shuffled')} style={{ width: '100%', padding: '15px', marginBottom: '10px' }}>Shuffled in Draw Pile</button>
          </>
        ) : (
          <button onClick={() => handleDestSelect('discard', 'top')} style={{ width: '100%', padding: '15px', marginBottom: '10px' }}>To Discard Pile</button>
        )}
      </>
    );
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', 
      backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000, 
      display: 'flex', justifyContent: 'center', alignItems: 'center'
    }}>
      <div style={{
        backgroundColor: '#333', padding: '20px', borderRadius: '8px', 
        width: '90%', maxWidth: '400px', display: 'flex', flexDirection: 'column'
      }}>
        {step === 'menu' && renderMenu()}
        {step === 'move_source' && renderMoveSource()}
        {step === 'move_card' && renderMoveCard()}
        {step === 'move_dest' && renderMoveDest()}
        
        <button 
          onClick={step === 'menu' ? resetAndClose : () => setStep('menu')}
          style={{ marginTop: '20px', padding: '10px', backgroundColor: '#555', color: 'white', border: 'none' }}
        >
          {step === 'menu' ? 'Cancel' : 'Back'}
        </button>
      </div>
    </div>
  );
};
