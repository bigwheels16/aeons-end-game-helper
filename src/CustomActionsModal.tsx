import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useGameStore } from './store';
import { RevealModal } from './RevealModal';
import { Modal, ModalButton } from './Modal';

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
    <Modal isOpen={isOpen} title="Custom Actions">
      <ModalButton onClick={handleShuffle} disabled={isShuffleDisabled} style={{ width: '100%', marginBottom: '10px' }}>
        Shuffle Draw Pile
      </ModalButton>
      <ModalButton onClick={handleMoveCards} style={{ width: '100%', marginBottom: '10px' }}>
        Move Cards
      </ModalButton>
      <ModalButton onClick={handleRevealClick} disabled={isRevealDisabled} style={{ width: '100%', marginBottom: '20px' }}>
        Reveal cards from Draw Pile
      </ModalButton>
      <ModalButton onClick={onClose} style={{ width: '100%' }}>
        Cancel
      </ModalButton>
    </Modal>
  );
};

