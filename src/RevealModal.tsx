import React, { useState } from 'react';
import { Card, CARD_BACK_URL } from './deckEngine';
import { Modal, ModalButton } from './Modal';

/**
 * Properties for the RevealModal component.
 */
interface RevealModalProps {
  /** Whether the reveal selection modal is currently open and visible */
  isOpen: boolean;
  /** Current cards in the draw pile */
  drawPile: Card[];
  /** Callback to close the modal without applying changes */
  onClose: () => void;
  /** Callback to commit revealing the selected card indices */
  onConfirm: (selectedIndices: number[]) => void;
}

/**
 * Reveal Modal Component.
 *
 * Provides a visual modal for selecting cards in the draw pile to reveal:
 * - Displays all cards in the draw pile with their current visual state (card back or revealed artwork).
 * - Allows users to toggle selection on unrevealed cards (highlighted with a green border).
 * - Cards already revealed are dimmed and disabled from selection.
 * - Provides "Confirm" to reveal selected cards and "Cancel" to dismiss without changes.
 */
export const RevealModal: React.FC<RevealModalProps> = ({ isOpen, drawPile, onClose, onConfirm }) => {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  if (!isOpen) return null;

  const toggleSelection = (index: number) => {
    const newSelection = new Set(selectedIndices);
    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }
    setSelectedIndices(newSelection);
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selectedIndices));
    setSelectedIndices(new Set());
    onClose();
  };

  const handleCancel = () => {
    setSelectedIndices(new Set());
    onClose();
  };

  return (
    <Modal isOpen={isOpen} title="Select Cards to Reveal" maxWidth="600px" zIndex={1100}>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center',
        maxHeight: '60vh', overflowY: 'auto', margin: '20px 0', padding: '10px'
      }}>
        {drawPile.map((card, idx) => {
          const isRevealed = !!card.isRevealed;
          const isSelected = selectedIndices.has(idx);
          
          return (
            <div
              key={idx}
              onClick={() => !isRevealed && toggleSelection(idx)}
              style={{
                cursor: isRevealed ? 'not-allowed' : 'pointer',
                opacity: isRevealed ? 0.5 : 1,
                border: isSelected ? '3px solid #4CAF50' : '3px solid transparent',
                borderRadius: '8px',
                width: 'calc(33% - 10px)',
                minWidth: '100px',
                boxSizing: 'border-box'
              }}
            >
              <img
                src={isRevealed ? card.imageFaceUrl : CARD_BACK_URL}
                alt={isRevealed ? card.type : 'Card Back'}
                style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '4px' }}
              />
            </div>
          );
        })}
        {drawPile.length === 0 && <span style={{ color: '#888' }}>Draw Pile Empty</span>}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
        <ModalButton onClick={handleCancel} style={{ flex: 1 }}>
          Cancel
        </ModalButton>
        <ModalButton onClick={handleConfirm} variant="primary" style={{ flex: 1 }}>
          Confirm
        </ModalButton>
      </div>
    </Modal>
  );
};
