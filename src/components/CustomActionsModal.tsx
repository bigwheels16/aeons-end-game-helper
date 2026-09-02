import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useGameStore } from '../store';
import { Modal, ModalButton } from './Modal';

interface CustomActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEnterEditMode: () => void;
  onEnterRevealMode?: () => void;
  onOpenGameOptions?: () => void;
  onOpenHistory?: () => void;
}

export const CustomActionsModal: React.FC<CustomActionsModalProps> = ({ isOpen, onClose, onEnterEditMode, onEnterRevealMode, onOpenGameOptions, onOpenHistory }) => {
  const { shuffleDrawPile, drawPile } = useGameStore();
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!isOpen) setShowConfirm(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleShuffle = () => {
    shuffleDrawPile();
    toast.success('Draw pile has been shuffled!');
    setShowConfirm(false);
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

  if (showConfirm) {
    return (
      <Modal isOpen={true} title="Confirm Shuffle">
        <p style={{ color: '#ccc', marginBottom: '20px' }}>Are you sure you want to shuffle the draw pile?</p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <ModalButton onClick={() => setShowConfirm(false)} style={{ flex: 1 }}>
            Cancel
          </ModalButton>
          <ModalButton variant="danger" onClick={handleShuffle} style={{ flex: 1 }}>
            Shuffle
          </ModalButton>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} title="Special Actions">
      <ModalButton onClick={() => setShowConfirm(true)} disabled={isShuffleDisabled} style={{ width: '100%', marginBottom: '10px' }}>
        Shuffle Draw Pile
      </ModalButton>
      <ModalButton onClick={handleMoveCards} style={{ width: '100%', marginBottom: '10px' }}>
        Move Cards
      </ModalButton>
      <ModalButton onClick={handleRevealClick} disabled={isRevealDisabled} style={{ width: '100%', marginBottom: '20px' }}>
        Reveal Cards
      </ModalButton>
      <ModalButton onClick={() => { if (onOpenHistory) onOpenHistory(); onClose(); }} style={{ width: '100%', marginBottom: '20px' }}>
        Show Turn History
      </ModalButton>
      <ModalButton onClick={() => { if (onOpenGameOptions) onOpenGameOptions(); onClose(); }} style={{ width: '100%', marginBottom: '20px' }}>
        Update Game Options
      </ModalButton>
      <ModalButton onClick={onClose} style={{ width: '100%' }}>
        Cancel
      </ModalButton>
    </Modal>
  );
};
