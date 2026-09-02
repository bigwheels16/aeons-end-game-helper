import React from 'react';
import { Modal, ModalButton } from './Modal';
import { useGameStore } from './store';


interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose }) => {
  const turnHistory = useGameStore(state => state.turnHistory || []);
  
  if (!isOpen) return null;

  // Group history by round
  const rounds = turnHistory.reduce((acc, curr) => {
    if (!acc[curr.roundNumber]) {
      acc[curr.roundNumber] = [];
    }
    acc[curr.roundNumber].push(curr.card);
    return acc;
  }, {} as Record<number, any[]>);

  const getCardColor = (type: string) => {
    if (type.includes('Player')) return '#2196F3'; // Blue
    if (type === 'Nemesis') return '#f44336'; // Red
    if (type === 'Wild') return '#9C27B0'; // Purple
    return '#888';
  };

  return (
    <Modal isOpen={isOpen} title="Turn History">
      <div style={{ maxHeight: '60vh', overflowY: 'auto', marginBottom: '20px' }}>
        {Object.keys(rounds).length === 0 ? (
          <p style={{ color: '#ccc', textAlign: 'center' }}>No turns have been taken yet.</p>
        ) : (
          Object.keys(rounds).sort((a, b) => Number(b) - Number(a)).map(roundNum => (
            <div key={roundNum} style={{ marginBottom: '15px', backgroundColor: '#222', padding: '10px', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#fff', borderBottom: '1px solid #444', paddingBottom: '5px' }}>
                Round {roundNum}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[...rounds[Number(roundNum)]].reverse().map((card, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#333', padding: '8px', borderRadius: '4px' }}>
                    <div style={{ 
                      width: '12px', 
                      height: '12px', 
                      borderRadius: '50%', 
                      backgroundColor: getCardColor(card.type)
                    }} />
                    <span style={{ color: '#ddd' }}>
                      <strong style={{ color: getCardColor(card.type) }}>{card.type}</strong>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
      <ModalButton onClick={onClose} style={{ width: '100%' }}>
        Close
      </ModalButton>
    </Modal>
  );
};
