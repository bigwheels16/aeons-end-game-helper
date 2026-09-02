import React from 'react';
import { Modal, ModalButton } from './Modal';
import { useGameStore } from '../store';


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
              <div style={{ 
                display: 'flex', 
                gap: '5px', 
                overflowX: 'auto', 
                alignItems: 'center', 
                padding: '5px'
              }}>
                {rounds[Number(roundNum)].map((card, idx) => (
                  <img 
                    key={idx} 
                    src={card.imageFaceUrl} 
                    alt={card.type} 
                    title={card.type}
                    style={{ 
                      flex: '0 0 calc((100% - 25px) / 6)',
                      height: '80px',
                      objectFit: 'contain',
                      borderRadius: '4px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                    }} 
                  />
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
