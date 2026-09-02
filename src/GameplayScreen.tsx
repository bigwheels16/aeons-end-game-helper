import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useGameStore } from './store';
import { CARD_BACK_URL, Card } from './deckEngine';
import { CustomActionsModal } from './CustomActionsModal';
import { GameOptionsModal } from './GameOptionsModal';
import { HistoryModal } from './HistoryModal';
import { Modal, ModalButton } from './Modal';
import styles from './GameplayScreen.module.css';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  DragOverlay,
  useDroppable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableCardProps {
  id: string;
  card: Card;
  showFace: boolean;
  isSelected?: boolean;
  isDimmed?: boolean;
  interactive?: boolean;
  onClick?: () => void;
}

const SortableCard = (props: SortableCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.id, disabled: !props.interactive });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  let cardClasses = styles.cardImage;
  if (props.interactive) cardClasses += ` ${styles.cardImageInteractive}`;
  if (props.isSelected) cardClasses += ` ${styles.cardSelected}`;
  if (props.isDimmed) cardClasses += ` ${styles.cardDimmed}`;
  
  return (
    <img 
      ref={setNodeRef}
      style={{...style, touchAction: 'none'}}
      {...attributes}
      {...listeners}
      src={props.showFace ? props.card.imageFaceUrl : CARD_BACK_URL} 
      alt={props.showFace ? props.card.type : 'Card Back'} 
      className={cardClasses}
      aria-selected={props.isSelected}
      draggable={false}
    />
  );
};

interface CardPileProps {
  cards: Card[];
  limit?: number;
  emptyText: string;
  customClass?: string;
  onCardClick?: (idx: number) => void;
  selectedIndices?: Set<number>;
  dimUnselected?: boolean;
  interactive?: boolean;
  isDragMode?: boolean;
  containerId: string;
}

const CardPile = ({ cards, limit, emptyText, customClass, onCardClick, selectedIndices, dimUnselected, interactive, isDragMode, containerId }: CardPileProps) => {
  const displayCards = limit ? cards.slice(-limit) : cards;
  const offset = limit ? Math.max(0, cards.length - limit) : 0;
  
  const { setNodeRef } = useDroppable({
    id: containerId,
    disabled: !isDragMode,
  });

  const cardIds = displayCards.map(c => c.id);

  return (
    <div 
      ref={setNodeRef}
      className={`${styles.pileContainer} ${customClass || ''}`.trim()} 
      aria-live="polite"
    >
      <SortableContext items={cardIds} strategy={horizontalListSortingStrategy}>
        {displayCards.map((card, idx) => {
          const actualIdx = offset + idx;
          const showFace = !!card.isRevealed;
          const isSelected = selectedIndices?.has(actualIdx);
          const isDimmed = dimUnselected && !isSelected && showFace;
          
          if (isDragMode) {
            return (
              <SortableCard
                key={card.id}
                id={card.id}
                card={card}
                showFace={showFace}
                isSelected={isSelected}
                isDimmed={isDimmed}
                interactive={interactive}
              />
            );
          }

          let cardClasses = styles.cardImage;
          if (interactive) cardClasses += ` ${styles.cardImageInteractive}`;
          if (isSelected) cardClasses += ` ${styles.cardSelected}`;
          if (isDimmed) cardClasses += ` ${styles.cardDimmed}`;
          
          return (
            <img 
              key={card.id} 
              src={showFace ? card.imageFaceUrl : CARD_BACK_URL} 
              alt={showFace ? card.type : 'Card Back'} 
              className={cardClasses}
              onClick={() => {
                if (onCardClick && (!isDimmed || (dimUnselected && !showFace))) {
                  onCardClick(actualIdx);
                }
              }}
              aria-selected={isSelected}
              draggable={false}
            />
          );
        })}
      </SortableContext>
      {cards.length === 0 && <span className={styles.emptyText}>{emptyText}</span>}
    </div>
  );
};

const CurrentTurnDisplay = ({ currentTurn }: { currentTurn: Card | null }) => {
  const showFace = currentTurn ? !!currentTurn.isRevealed : false;
  return (
    <div className={styles.currentTurnContainer}>
      {currentTurn ? (
        <>
          <img src={showFace ? currentTurn.imageFaceUrl : CARD_BACK_URL} alt={showFace ? currentTurn.type : 'Card Back'} className={styles.currentTurnImage} />
        </>
      ) : (
        <h2>Round Over</h2>
      )}
    </div>
  );
};

const GameplayScreen: React.FC = () => {
  const [isCustomActionsOpen, setIsCustomActionsOpen] = useState(false);
  const [isEndGameModalOpen, setIsEndGameModalOpen] = useState(false);
  const [isGameOptionsModalOpen, setIsGameOptionsModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const {
    drawPile,
    discardPile,
    roundNumber,
    nextTurn,
    endGame,
    setPiles,
    revealCards
  } = useGameStore();

  const [specialMode, setSpecialMode] = useState<'NONE' | 'MOVE' | 'REVEAL'>('NONE');
  
  // Local state for special modes
  const [localDrawPile, setLocalDrawPile] = useState<Card[]>([]);
  const [localDiscardPile, setLocalDiscardPile] = useState<Card[]>([]);
  const [revealSelection, setRevealSelection] = useState<Set<number>>(new Set());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    if (specialMode !== 'NONE') {
      setLocalDrawPile([...drawPile]);
      setLocalDiscardPile([...discardPile]);
      setRevealSelection(new Set());
      setHasUnsavedChanges(false);
    }
  }, [specialMode, drawPile, discardPile]);

  const currentTurn = specialMode === 'NONE' 
    ? (discardPile.length > 0 ? discardPile[discardPile.length - 1] : null)
    : (localDiscardPile.length > 0 ? localDiscardPile[localDiscardPile.length - 1] : null);

  const handleNextTurn = () => {
    if (specialMode === 'NONE') {
      nextTurn();
    }
  };
  
  const enterMoveMode = () => {
    setSpecialMode('MOVE');
    setIsCustomActionsOpen(false);
  };
  
  const enterRevealMode = () => {
    if (drawPile.length === 0) {
      toast.error('No cards in draw pile to reveal.');
      return;
    }
    setSpecialMode('REVEAL');
    setIsCustomActionsOpen(false);
  };

  const handleConfirm = () => {
    if (specialMode === 'MOVE') {
      const success = setPiles(localDrawPile, localDiscardPile);
      if (success) {
        toast.success('Cards have been moved!');
      } else {
        toast.error('Failed to move cards. Invalid operation.');
      }
    } else if (specialMode === 'REVEAL') {
      revealCards(Array.from(revealSelection));
      toast.success('Cards have been revealed!');
    }
    setSpecialMode('NONE');
  };

  const handleCancel = () => {
    setSpecialMode('NONE');
  };

  const handleDrawPileClick = (idx: number) => {
    if (specialMode === 'REVEAL') {
      const newSelection = new Set(revealSelection);
      if (newSelection.has(idx)) {
        newSelection.delete(idx);
      } else {
        newSelection.add(idx);
      }
      setRevealSelection(newSelection);
      setHasUnsavedChanges(true);
    } else if (specialMode === 'MOVE') {
      // Move from draw to discard
      const card = localDrawPile[idx];
      const newDraw = [...localDrawPile];
      newDraw.splice(idx, 1);
      setLocalDrawPile(newDraw);
      setLocalDiscardPile([...localDiscardPile, card]);
      setHasUnsavedChanges(true);
    }
  };

  const handleDiscardPileClick = (idx: number) => {
    if (specialMode === 'MOVE') {
      // Move from discard to draw (top)
      const card = localDiscardPile[idx];
      const newDiscard = [...localDiscardPile];
      newDiscard.splice(idx, 1);
      setLocalDiscardPile(newDiscard);
      setLocalDrawPile([card, ...localDrawPile]);
      setHasUnsavedChanges(true);
    }
  };

  const activeDrawPile = specialMode === 'NONE' ? drawPile : localDrawPile;
  const activeDiscardPile = specialMode === 'NONE' ? discardPile : localDiscardPile;

  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [activeId, setActiveId] = useState<string | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    const drawPileIds = localDrawPile.map(c => c.id);
    const discardPileIds = localDiscardPile.map(c => c.id);

    const findContainer = (id: string) => {
      if (drawPileIds.includes(id) || id === 'draw-pile-container') return 'draw';
      if (discardPileIds.includes(id) || id === 'discard-pile-container') return 'discard';
      return null;
    };

    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);

    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return;
    }

    setHasUnsavedChanges(true);
    
    const activePile = activeContainer === 'draw' ? localDrawPile : localDiscardPile;
    const overPile = overContainer === 'draw' ? localDrawPile : localDiscardPile;
    
    const activeIndex = activePile.findIndex(c => c.id === activeId);
    let overIndex = overPile.findIndex(c => c.id === overId);
    
    if (overId === `${overContainer}-pile-container`) {
      overIndex = overPile.length;
    } else if (overIndex >= 0) {
      const isBelowOverItem = over && active.rect.current.translated && active.rect.current.translated.top > over.rect.top + over.rect.height;
      const modifier = isBelowOverItem ? 1 : 0;
      overIndex = overIndex >= 0 ? overIndex + modifier : overPile.length;
    }

    const newActivePile = [...activePile];
    const newOverPile = [...overPile];
    const [movedCard] = newActivePile.splice(activeIndex, 1);
    
    newOverPile.splice(overIndex, 0, movedCard);

    if (activeContainer === 'draw') {
      setLocalDrawPile(newActivePile);
      setLocalDiscardPile(newOverPile);
    } else {
      setLocalDiscardPile(newActivePile);
      setLocalDrawPile(newOverPile);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const drawPileIds = localDrawPile.map(c => c.id);
    const discardPileIds = localDiscardPile.map(c => c.id);

    const findContainer = (id: string) => {
      if (drawPileIds.includes(id) || id === 'draw-pile-container') return 'draw';
      if (discardPileIds.includes(id) || id === 'discard-pile-container') return 'discard';
      return null;
    };

    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);

    if (!activeContainer || !overContainer || activeContainer !== overContainer) {
      return;
    }

    const pile = activeContainer === 'draw' ? localDrawPile : localDiscardPile;
    const activeIndex = pile.findIndex(c => c.id === activeId);
    let overIndex = pile.findIndex(c => c.id === overId);
    
    if (overIndex < 0) {
      overIndex = activeIndex;
    }

    if (activeIndex !== overIndex) {
      setHasUnsavedChanges(true);
      const newPile = arrayMove(pile, activeIndex, overIndex);
      if (activeContainer === 'draw') {
        setLocalDrawPile(newPile);
      } else {
        setLocalDiscardPile(newPile);
      }
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        {specialMode === 'NONE' ? (
          <>
            <h2 className={styles.roundText}>Round {roundNumber}</h2>
            <div className={styles.buttonGroup}>
              <button
                onClick={() => setIsCustomActionsOpen(true)}
                className={styles.customActionsBtn}
              >
                Special Actions
              </button>
              <button 
                onClick={() => setIsEndGameModalOpen(true)} 
                className={styles.endGameBtn}
              >
                End Game
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className={styles.roundText}>{specialMode === 'MOVE' ? 'Move mode' : 'Reveal mode'}</h2>
            <div className={styles.buttonGroup}>
              <button onClick={handleCancel} className={styles.cancelBtn}>Cancel</button>
              <button onClick={handleConfirm} className={styles.confirmBtn} disabled={!hasUnsavedChanges}>Confirm</button>
            </div>
          </>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <CardPile 
          containerId="discard-pile-container"
          cards={activeDiscardPile} 
          limit={specialMode === 'NONE' ? 6 : undefined} 
          emptyText="Discard Pile" 
          customClass={specialMode === 'MOVE' ? styles.interactivePile : ''}
          interactive={specialMode === 'MOVE'}
          onCardClick={handleDiscardPileClick}
          isDragMode={specialMode === 'MOVE'}
        />
        
        <CurrentTurnDisplay currentTurn={currentTurn} />

        <CardPile 
          containerId="draw-pile-container"
          cards={activeDrawPile} 
          emptyText="Draw Pile Empty" 
          customClass={`${styles.pileContainerBottom} ${(specialMode === 'MOVE' || specialMode === 'REVEAL') ? styles.interactivePile : ''}`}
          interactive={specialMode === 'MOVE' || specialMode === 'REVEAL'}
          onCardClick={handleDrawPileClick}
          selectedIndices={specialMode === 'REVEAL' ? revealSelection : undefined}
          dimUnselected={specialMode === 'REVEAL'}
          isDragMode={specialMode === 'MOVE'}
        />
        
        <DragOverlay>
          {activeId ? (() => {
            const card = [...localDrawPile, ...localDiscardPile].find(c => c.id === activeId);
            if (!card) return null;
            const showFace = !!card.isRevealed;
            return (
              <img 
                src={showFace ? card.imageFaceUrl : CARD_BACK_URL} 
                alt={showFace ? card.type : 'Card Back'} 
                className={`${styles.cardImage} ${styles.cardImageInteractive}`}
                style={{ opacity: 0.8 }}
                draggable={false}
              />
            );
          })() : null}
        </DragOverlay>
      </DndContext>

      {specialMode === 'NONE' && (
        <button
          onClick={handleNextTurn}
          className={styles.nextTurnBtn}
        >
          {drawPile.length > 0 ? 'NEXT TURN' : 'START NEW ROUND'}
        </button>
      )}

      <CustomActionsModal 
        isOpen={isCustomActionsOpen} 
        onClose={() => setIsCustomActionsOpen(false)}
        onEnterEditMode={enterMoveMode}
        onEnterRevealMode={enterRevealMode}
        onOpenGameOptions={() => setIsGameOptionsModalOpen(true)}
        onOpenHistory={() => setIsHistoryModalOpen(true)}
      />

      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
      />

      <GameOptionsModal 
        isOpen={isGameOptionsModalOpen} 
        onClose={() => setIsGameOptionsModalOpen(false)} 
      />

      <Modal isOpen={isEndGameModalOpen} title="End Game?">
        <p style={{ color: '#ccc', marginBottom: '20px' }}>Are you sure you want to end the game?</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
          <ModalButton onClick={() => setIsEndGameModalOpen(false)} style={{ flex: 1 }}>
            Cancel
          </ModalButton>
          <ModalButton 
            variant="danger" 
            onClick={() => {
              setIsEndGameModalOpen(false);
              endGame();
            }} 
            style={{ flex: 1 }}
          >
            OK
          </ModalButton>
        </div>
      </Modal>
    </div>
  );
};

export default GameplayScreen;
