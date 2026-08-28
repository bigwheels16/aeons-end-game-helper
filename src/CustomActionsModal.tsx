import React from 'react';
import { useGameStore } from './store';

/**
 * Properties for the CustomActionsModal component.
 */
interface CustomActionsModalProps {
  /** Whether the modal is currently open and visible */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Callback to transition the application into drag-and-drop Edit Mode */
  onEnterEditMode: () => void;
}

/**
 * Custom Actions Modal Component.
 *
 * Provides mid-round deck manipulation options:
 * - "Shuffle Draw Pile": Triggers a re-shuffle of remaining cards in the active draw pile
 *   (disabled if 1 or fewer cards remain). Resets reveals and reapplies current visibility options.
 * - "Move Cards": Enters inline drag-and-drop Edit Mode to reorder and transfer cards
 *   between the Draw and Discard piles.
 * - "Reveal top card of Draw Pile": Manually sets `isRevealed: true` on the top card of the draw pile
 *   (disabled if the draw pile is empty, the top card is already revealed, or global visibility already shows the top card).
 */
export const CustomActionsModal: React.FC<CustomActionsModalProps> = ({ isOpen, onClose, onEnterEditMode }) => {
  const { shuffleDrawPile, drawPile, visibilityOption, revealTopCard } = useGameStore();

  if (!isOpen) return null;

  const handleShuffle = () => {
    shuffleDrawPile();
    onClose();
  };

  const handleMoveCards = () => {
    onEnterEditMode();
    onClose();
  };

  const handleRevealTopCard = () => {
    revealTopCard();
    onClose();
  };

  const isRevealDisabled = drawPile.length === 0 || visibilityOption === 'next' || visibilityOption === 'all' || drawPile[0]?.isRevealed;

  const isShuffleDisabled = drawPile.length <= 1;

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
        <button 
          onClick={handleShuffle}
          disabled={isShuffleDisabled}
          style={{ width: '100%', padding: '15px', marginBottom: '10px', fontSize: '18px', opacity: isShuffleDisabled ? 0.5 : 1 }}
        >
          Shuffle Draw Pile
        </button>
        <button 
          onClick={handleMoveCards}
          style={{ width: '100%', padding: '15px', marginBottom: '10px', fontSize: '18px' }}
        >
          Move Cards
        </button>

        <button 
          onClick={handleRevealTopCard}
          disabled={isRevealDisabled}
          style={{ width: '100%', padding: '15px', fontSize: '18px', opacity: isRevealDisabled ? 0.5 : 1 }}
        >
          Reveal top card of Draw Pile
        </button>
        
        <button 
          onClick={onClose}
          style={{ marginTop: '20px', padding: '10px', backgroundColor: '#555', color: 'white', border: 'none' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

