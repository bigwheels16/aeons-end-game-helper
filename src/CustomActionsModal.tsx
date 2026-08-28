import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useGameStore } from './store';
import { RevealModal } from './RevealModal';

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
 *   (disabled if 1 or fewer cards remain). Resets reveals and reapplies current visibility options. Displays a toast notification.
 * - "Move Cards": Enters inline drag-and-drop Edit Mode to reorder and transfer cards
 *   between the Draw and Discard piles.
 * - "Reveal cards from Draw Pile": Opens a visual modal allowing the user to select specific
 *   cards in the draw pile to reveal, with options to confirm or cancel. Displays a toast notification upon confirmation.
 */
export const CustomActionsModal: React.FC<CustomActionsModalProps> = ({ isOpen, onClose, onEnterEditMode }) => {
  const { shuffleDrawPile, drawPile, revealCards } = useGameStore();
  const [isRevealModalOpen, setIsRevealModalOpen] = useState(false);

  if (!isOpen) return null;

  const handleShuffle = () => {
    shuffleDrawPile();
    toast.success('Draw pile has been shuffled!');
    onClose();
  };

  const handleMoveCards = () => {
    onEnterEditMode();
    onClose();
  };

  const handleRevealClick = () => {
    setIsRevealModalOpen(true);
  };

  const handleConfirmReveal = (selectedIndices: number[]) => {
    revealCards(selectedIndices);
    toast.success('Cards have been revealed!');
    setIsRevealModalOpen(false);
    onClose();
  };

  const handleCancelReveal = () => {
    setIsRevealModalOpen(false);
  };

  const isRevealDisabled = drawPile.length === 0;

  const isShuffleDisabled = drawPile.length <= 1;

  if (isRevealModalOpen) {
    return (
      <RevealModal
        isOpen={isRevealModalOpen}
        drawPile={drawPile}
        onClose={handleCancelReveal}
        onConfirm={handleConfirmReveal}
      />
    );
  }

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
          onClick={handleRevealClick}
          disabled={isRevealDisabled}
          style={{ width: '100%', padding: '15px', fontSize: '18px', opacity: isRevealDisabled ? 0.5 : 1 }}
        >
          Reveal cards from Draw Pile
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

