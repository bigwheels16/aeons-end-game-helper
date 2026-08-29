import { useState } from 'react';
import toast from 'react-hot-toast';
import { useGameStore } from './store';
import { CARD_BACK_URL } from './deckEngine';
import { CustomActionsModal } from './CustomActionsModal';
import { EditModeController } from './EditModeController';
import styles from './GameplayScreen.module.css';

/**
 * Renders the played cards in the discard pile.
 */
const DiscardPile = ({ cards }: { cards: any[] }) => (
  <div className={styles.pileContainer}>
    {cards.slice(-6).map((card, idx) => {
      const showFace = !!card.isRevealed;
      return (
        <img 
          key={idx} 
          src={showFace ? card.imageFaceUrl : CARD_BACK_URL} 
          alt={showFace ? card.type : 'Card Back'} 
          className={styles.cardImage} 
        />
      );
    })}
    {cards.length === 0 && <span className={styles.emptyText}>Discard Pile</span>}
  </div>
);

/**
 * Renders a preview of upcoming cards in the draw pile based on visibility rules.
 */
const DrawPilePreview = ({ cards }: { cards: any[] }) => (
  <div className={`${styles.pileContainer} ${styles.pileContainerBottom}`}>
    {cards.map((card, idx) => {
      const showFace = !!card.isRevealed;
      return (
        <img 
          key={idx} 
          src={showFace ? card.imageFaceUrl : CARD_BACK_URL} 
          alt={showFace ? card.type : 'Card Back'} 
          className={styles.cardImage} 
        />
      );
    })}
    {cards.length === 0 && <span className={styles.emptyText}>Draw Pile Empty</span>}
  </div>
);

/**
 * Displays the active turn card and its corresponding player or Nemesis title.
 */
const CurrentTurnDisplay = ({ currentTurn }: { currentTurn: any }) => (
  <div className={styles.currentTurnContainer}>
    {currentTurn ? (
      <>
        <img src={currentTurn.imageFaceUrl} alt={currentTurn.type} className={styles.currentTurnImage} />
        <h2 className={styles.currentTurnTitle}>{currentTurn.type === 'Wild' ? 'WILD TURN - Players Decide' : currentTurn.type}</h2>
      </>
    ) : (
      <h2>Round Over</h2>
    )}
  </div>
);

/**
 * Gameplay Screen Component.
 *
 * Renders the main turn management interface formatted for mobile screens without vertical scroll:
 * - Header bar displaying the round number and top-level action buttons ("Custom Actions" and "End Game")
 * - Discard pile queue (top)
 * - Prominent current turn card display (center)
 * - Upcoming draw pile preview (bottom)
 * - Full-width "Next Turn" / "Start New Round" action button
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
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.roundText}>Round {roundNumber}</h2>
        <div className={styles.buttonGroup}>
          <button
            onClick={() => setIsCustomActionsOpen(true)}
            className={styles.customActionsBtn}
          >
            Custom Actions
          </button>
          <button 
            onClick={endGame} 
            className={styles.endGameBtn}
          >
            End Game
          </button>
        </div>
      </div>

      <DiscardPile cards={discardPile} />
      
      <CurrentTurnDisplay currentTurn={currentTurn} />

      <DrawPilePreview cards={drawPile} />

      <button
        onClick={handleNextTurn}
        className={styles.nextTurnBtn}
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
