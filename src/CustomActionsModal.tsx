import React from 'react';
import toast from 'react-hot-toast';
import { useGameStore } from './store';
import { Modal, ModalButton } from './Modal';

interface CustomActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEnterEditMode: () => void;
  onEnterRevealMode?: () => void;
}

export const CustomActionsModal: React.FC<CustomActionsModalProps> = ({ isOpen, onClose, onEnterEditMode, onEnterRevealMode }) => {
  const { shuffleDrawPile, drawPile } = useGameStore();

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
    if (onEnterRevealMode) {
      onEnterRevealMode();
    }
    onClose();
  };

  const isRevealDisabled = drawPile.length === 0;
  const isShuffleDisabled = drawPile.length <= 1;

  return (
    <Modal isOpen={isOpen} title="Special Actions">
      <ModalButton onClick={handleShuffle} disabled={isShuffleDisabled} style={{ width: '100%', marginBottom: '10px' }}>
        Shuffle Draw Pile
      </ModalButton>
      <ModalButton onClick={handleMoveCards} style={{ width: '100%', marginBottom: '10px' }}>
        Move Cards
      </ModalButton>
      <ModalButton onClick={handleRevealClick} disabled={isRevealDisabled} style={{ width: '100%', marginBottom: '20px' }}>
        Reveal Cards
      </ModalButton>
      <ModalButton onClick={onClose} style={{ width: '100%' }}>
        Cancel
      </ModalButton>
    </Modal>
  );
};
