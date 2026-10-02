import React, { useState } from 'react';
import { Modal, ModalButton } from './Modal';
import { GameOptionsForm } from './GameOptionsForm';
import { useGameStore, GameOptionsData } from '../store';

interface GameOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GameOptionsModal: React.FC<GameOptionsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  // Mounting the dialog only while open starts every opening from the saved options.
  return <GameOptionsDialog onClose={onClose} />;
};

function GameOptionsDialog({ onClose }: { onClose: () => void }) {
  const store = useGameStore();
  const [options, setOptions] = useState<GameOptionsData>({
    playerCount: store.playerCount,
    allowConsecutiveNemesis: store.allowConsecutiveNemesis,
    allowConsecutivePlayer: store.allowConsecutivePlayer,
    visibilityOption: store.visibilityOption,
  });

  const handleSave = () => {
    store.setGameOptions(options);
    onClose();
  };

  return (
    <Modal isOpen title="Update Game Options">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '20px' }}>
        <GameOptionsForm options={options} onChange={setOptions} />
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <ModalButton onClick={onClose} style={{ flex: 1 }}>
          Cancel
        </ModalButton>
        <ModalButton onClick={handleSave} style={{ flex: 1, backgroundColor: '#4CAF50', color: '#fff' }}>
          Save Options
        </ModalButton>
      </div>
    </Modal>
  );
}
