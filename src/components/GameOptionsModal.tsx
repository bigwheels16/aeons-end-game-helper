import React, { useState, useEffect } from 'react';
import { Modal, ModalButton } from './Modal';
import { useGameStore, VisibilityOption } from '../store';

interface GameOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

import { GameOptionsForm } from './GameOptionsForm';

export const GameOptionsModal: React.FC<GameOptionsModalProps> = ({ isOpen, onClose }) => {
  const store = useGameStore();

  const [localPlayerCount, setLocalPlayerCount] = useState(store.playerCount);
  const [localAllowNemesis, setLocalAllowNemesis] = useState(store.allowConsecutiveNemesis);
  const [localAllowPlayer, setLocalAllowPlayer] = useState(store.allowConsecutivePlayer);
  const [localVisibility, setLocalVisibility] = useState<VisibilityOption>(store.visibilityOption);

  useEffect(() => {
    if (isOpen) {
      setLocalPlayerCount(store.playerCount);
      setLocalAllowNemesis(store.allowConsecutiveNemesis);
      setLocalAllowPlayer(store.allowConsecutivePlayer);
      setLocalVisibility(store.visibilityOption);
    }
  }, [isOpen, store.playerCount, store.allowConsecutiveNemesis, store.allowConsecutivePlayer, store.visibilityOption]);

  if (!isOpen) return null;

  const handleSave = () => {
    store.setPlayerCount(localPlayerCount);
    store.setAllowConsecutiveNemesis(localAllowNemesis);
    store.setAllowConsecutivePlayer(localAllowPlayer);
    store.setVisibilityOption(localVisibility);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} title="Update Game Options">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '20px' }}>
        
        <GameOptionsForm 
          options={{
            playerCount: localPlayerCount,
            allowConsecutiveNemesis: localAllowNemesis,
            allowConsecutivePlayer: localAllowPlayer,
            visibilityOption: localVisibility,
          }}
          onChange={(opts) => {
            setLocalPlayerCount(opts.playerCount);
            setLocalAllowNemesis(opts.allowConsecutiveNemesis);
            setLocalAllowPlayer(opts.allowConsecutivePlayer);
            setLocalVisibility(opts.visibilityOption);
          }}
        />
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
};
