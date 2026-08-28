import { useState } from 'react';
import toast from 'react-hot-toast';
import { useGameStore } from './store';
import { CARD_BACK_URL } from './deckEngine';
import { CustomActionsModal } from './CustomActionsModal';
import { EditModeController } from './EditModeController';

/**
 * Gameplay Screen Component.
 *
 * Displays the active game state with a mobile-optimized layout:
 * - Top Section (Discard Pile): Horizontal scroll of up to 6 previously played cards in the active round (rendered face-up with card.isRevealed)
 * - Center Section (Current Turn): Prominent active card display (derived from top card of the discard pile) with official artwork and turn designation banner
 * - Middle Section (Custom Actions): Action trigger to open the Custom Actions modal for shuffling, manual reveal, or entering Edit Mode
 * - Bottom Section (Draw Pile): Horizontal preview of upcoming cards (face-up or face-down determined solely by each card's `isRevealed` property)
 * - Action Button: Large tap target for advancing turns ("NEXT TURN") or cycling to the next round ("START NEW ROUND")
 * - Header: Round tracker and "End Game" reset control
 * - Edit Mode: Renders inline drag-and-drop EditModeController when "Move Cards" is triggered
 */
const GameplayScreen: React.FC = () => {
  const [isCustomActionsOpen, setIsCustomActionsOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const {
    drawPile,
    discardPile,
    roundNumber,
    nextTurn,
    endGame
  } = useGameStore();

  // The active turn is represented by the top card of the discard pile
  const currentTurn = discardPile.length > 0 ? discardPile[discardPile.length - 1] : null;

  if (isEditMode) {
    return (
      <EditModeController 
        onCancel={() => setIsEditMode(false)}
        onSave={(success) => {
          setIsEditMode(false);
          if (success) {
            toast.success('Cards have been moved!');
          } else {
            toast.error('Failed to move cards. Invalid operation.');
          }
        }}
      />
    );
  }

  const handleNextTurn = () => {
    nextTurn();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '10px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h2 style={{ margin: 0 }}>Round {roundNumber}</h2>
        <button onClick={endGame} style={{ padding: '8px 12px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '4px' }}>End Game</button>
      </div>

      {/* Discard Pile */}
      <div style={{ height: '80px', display: 'flex', gap: '5px', overflowX: 'auto', alignItems: 'center', backgroundColor: '#222', padding: '5px', borderRadius: '8px' }}>
        {discardPile.slice(-6).map((card, idx) => {
          const showFace = !!card.isRevealed;
          return (
            <img 
              key={idx} 
              src={showFace ? card.imageFaceUrl : CARD_BACK_URL} 
              alt={showFace ? card.type : 'Card Back'} 
              style={{ flex: '0 0 calc((100% - 25px) / 6)', height: '100%', objectFit: 'contain' }} 
            />
          );
        })}
        {discardPile.length === 0 && <span style={{ color: '#888', margin: 'auto' }}>Discard Pile</span>}
      </div>

      {/* Current Turn */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', margin: '20px 0' }}>
        {currentTurn ? (
          <>
            <img src={currentTurn.imageFaceUrl} alt={currentTurn.type} style={{ maxHeight: '40vh', maxWidth: '100%', objectFit: 'contain' }} />
            <h2 style={{ marginTop: '10px' }}>{currentTurn.type === 'Wild' ? 'WILD TURN - Players Decide' : currentTurn.type}</h2>
          </>
        ) : (
          <h2>Round Over</h2>
        )}
      </div>

      {/* Custom Actions Button */}
      <div style={{ padding: '0 20px', marginBottom: '10px' }}>
        <button
          onClick={() => setIsCustomActionsOpen(true)}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: '#3f51b5',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
          }}
        >
          Custom Actions
        </button>
      </div>

      {/* Draw Pile Preview */}
      <div style={{ height: '80px', display: 'flex', gap: '5px', overflowX: 'auto', alignItems: 'center', backgroundColor: '#222', padding: '5px', borderRadius: '8px', marginBottom: '20px' }}>
        {drawPile.map((card, idx) => {
          const showFace = !!card.isRevealed;

          return (
            <img 
              key={idx} 
              src={showFace ? card.imageFaceUrl : CARD_BACK_URL} 
              alt={showFace ? card.type : 'Card Back'} 
              style={{ flex: '0 0 calc((100% - 25px) / 6)', height: '100%', objectFit: 'contain' }} 
            />
          );
        })}
        {drawPile.length === 0 && <span style={{ color: '#888', margin: 'auto' }}>Draw Pile Empty</span>}
      </div>

      <button
        onClick={handleNextTurn}
        style={{
          width: '100%',
          padding: '20px',
          backgroundColor: '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '24px',
          fontWeight: 'bold',
          marginBottom: '20px'
        }}
      >
        {drawPile.length > 0 ? 'NEXT TURN' : 'START NEW ROUND'}
      </button>

      <CustomActionsModal 
        isOpen={isCustomActionsOpen} 
        onClose={() => setIsCustomActionsOpen(false)}
        onEnterEditMode={() => setIsEditMode(true)}
      />
    </div>
  );
};

export default GameplayScreen;
