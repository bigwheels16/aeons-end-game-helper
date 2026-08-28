import { useState } from 'react';
import { useGameStore } from './store';
import { CARD_BACK_URL } from './deckEngine';
import { CustomActionsModal } from './CustomActionsModal';

/**
 * Gameplay Screen Component.
 *
 * Displays the active game state with a mobile-optimized layout:
 * - Top Section (Discard Pile): Horizontal scroll of up to 6 previously played cards in the active round
 * - Center Section (Current Turn): Prominent active card display with official artwork and turn designation banner
 * - Middle Section (Custom Actions): Action trigger to open the Custom Actions modal for shuffling or moving cards
 * - Bottom Section (Draw Pile): Horizontal preview of upcoming cards (face-down or revealed based on visibility settings)
 * - Action Button: Large tap target for advancing turns ("NEXT TURN") or cycling to the next round ("START NEW ROUND")
 * - Header: Round tracker and "End Game" reset control
 */
const GameplayScreen: React.FC = () => {
  const [isCustomActionsOpen, setIsCustomActionsOpen] = useState(false);
  const {
    currentTurn,
    drawPile,
    discardPile,
    roundNumber,
    visibilityOption,
    nextTurn,
    endGame
  } = useGameStore();

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
        {([...discardPile, currentTurn].filter(c => c !== null) as typeof discardPile).slice(-6).map((card, idx) => (
          <img key={idx} src={card.imageFaceUrl} alt={card.type} style={{ flex: '0 0 calc((100% - 25px) / 6)', height: '100%', objectFit: 'contain' }} />
        ))}
        {discardPile.length === 0 && !currentTurn && <span style={{ color: '#888', margin: 'auto' }}>Discard Pile</span>}
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
          let showFace = false;
          if (visibilityOption === 'all') showFace = true;
          if (visibilityOption === 'next' && idx === 0) showFace = true;

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
      />
    </div>
  );
};

export default GameplayScreen;
