import React, { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
  useDroppable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CARD_BACK_URL } from './deckEngine';
import { useGameStore } from './store';

/**
 * Properties for the EditModeController component.
 */
interface EditModeControllerProps {
  /** Callback triggered when changes are discarded to return to gameplay without modifying state */
  onCancel: () => void;
  /** Callback triggered after attempting to commit modified card arrangements, receiving true if successful and false if validation failed */
  onSave: (success: boolean) => void;
}

/**
 * Sortable card component wrapping an individual turn order card with dnd-kit sortable behaviors.
 *
 * Utilizes `useSortable` for drag-and-drop interactions and enforces `touchAction: 'none'`
 * to prevent gesture conflicts on mobile devices.
 *
 * @param card - The turn order card object
 * @param showFace - Whether to render the face image or card back based on snapshot `isRevealed` visibility
 */
const SortableCard = ({ card, showFace }: { card: Card; showFace: boolean }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id, data: { type: 'Card', card } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    flex: '0 0 calc((100% - 25px) / 6)',
    height: '80px',
    opacity: isDragging ? 0.4 : 1,
    touchAction: 'none',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <img
        src={showFace ? card.imageFaceUrl : CARD_BACK_URL}
        alt={showFace ? card.type : 'Card Back'}
        style={{ height: '100%', objectFit: 'contain' }}
        draggable={false}
      />
    </div>
  );
};

/**
 * Droppable container component wrapping pile lists with `useDroppable`.
 *
 * Ensures that both the Draw Pile and Discard Pile remain valid and visible drop zones
 * even when completely empty.
 *
 * @param id - Unique droppable identifier ('draw-pile' or 'discard-pile')
 * @param children - Sortable card items or placeholder content rendered inside the container
 */
const DroppableContainer = ({ id, children }: { id: string, children: React.ReactNode }) => {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} style={{ minHeight: '90px', display: 'flex', gap: '5px', overflowX: 'auto', alignItems: 'center', backgroundColor: '#333', padding: '10px', borderRadius: '8px', border: '2px dashed #666' }}>
      {children}
    </div>
  );
};

/**
 * Edit Mode Controller Component.
 *
 * Provides an inline drag-and-drop interface powered by `@dnd-kit/core` and `@dnd-kit/sortable`
 * for manipulating the turn order deck during an active round:
 * - Allows transferring cards between Draw and Discard piles.
 * - Allows reordering cards within either pile.
 * - Manages component-local state so gameplay state is not mutated until explicitly saved.
 * - Freezes pre-edit card visibility (face-up vs face-down via `isRevealed`) throughout drag interactions.
 * - Supports keyboard and pointer/touch sensors with distance-based drag thresholds.
 * - Renders Save and Cancel controls in the action header.
 */
export const EditModeController: React.FC<EditModeControllerProps> = ({ onCancel, onSave }) => {
  const { drawPile, discardPile, setPiles } = useGameStore();

  const [localDrawPile, setLocalDrawPile] = useState<Card[]>(() => [...drawPile]);
  const [localDiscardPile, setLocalDiscardPile] = useState<Card[]>(() => [...discardPile]);
  
  const [activeCard, setActiveCard] = useState<Card | null>(null);

  // Freeze card face visibility (face-up vs face-down) based on each card's `isRevealed` status
  // upon entering Edit Mode, ensuring visual consistency during drag interactions.
  const [frozenVisibility] = useState<Record<string, boolean>>(() => {
    const v: Record<string, boolean> = {};
    drawPile.forEach(card => {
      v[card.id] = !!card.isRevealed;
    });
    discardPile.forEach(card => {
      v[card.id] = !!card.isRevealed;
    });
    return v;
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const { card } = active.data.current as { card: Card };
    setActiveCard(card);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveInDraw = localDrawPile.some(c => c.id === activeId);
    const isOverInDraw = localDrawPile.some(c => c.id === overId) || overId === 'draw-pile';
    
    if (isActiveInDraw && !isOverInDraw) {
      setLocalDrawPile(prev => prev.filter(c => c.id !== activeId));
      setLocalDiscardPile(prev => {
        const overIndex = overId === 'discard-pile' ? prev.length : prev.findIndex(c => c.id === overId);
        return [
          ...prev.slice(0, overIndex),
          active.data.current?.card,
          ...prev.slice(overIndex)
        ] as Card[];
      });
    } else if (!isActiveInDraw && isOverInDraw) {
      setLocalDiscardPile(prev => prev.filter(c => c.id !== activeId));
      setLocalDrawPile(prev => {
        const overIndex = overId === 'draw-pile' ? prev.length : prev.findIndex(c => c.id === overId);
        return [
          ...prev.slice(0, overIndex),
          active.data.current?.card,
          ...prev.slice(overIndex)
        ] as Card[];
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveInDraw = localDrawPile.some(c => c.id === activeId);
    const isOverInDraw = localDrawPile.some(c => c.id === overId) || overId === 'draw-pile';

    if (isActiveInDraw && isOverInDraw) {
      const oldIndex = localDrawPile.findIndex(c => c.id === activeId);
      const newIndex = localDrawPile.findIndex(c => c.id === overId);
      setLocalDrawPile(arrayMove(localDrawPile, oldIndex, newIndex !== -1 ? newIndex : localDrawPile.length - 1));
    } else if (!isActiveInDraw && !isOverInDraw) {
      const oldIndex = localDiscardPile.findIndex(c => c.id === activeId);
      const newIndex = localDiscardPile.findIndex(c => c.id === overId);
      setLocalDiscardPile(arrayMove(localDiscardPile, oldIndex, newIndex !== -1 ? newIndex : localDiscardPile.length - 1));
    }
  };

  const handleSave = () => {
    const success = setPiles(localDrawPile, localDiscardPile);
    onSave(success);
  };

  const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.5',
        },
      },
    }),
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '10px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={onCancel} style={{ padding: '10px 20px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>Cancel</button>
        <h2 style={{ margin: 0 }}>Edit Mode</h2>
        <button onClick={handleSave} style={{ padding: '10px 20px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>Save</button>
      </div>

      <DndContext 
        sensors={sensors} 
        collisionDetection={closestCorners} 
        onDragStart={handleDragStart} 
        onDragOver={handleDragOver} 
        onDragEnd={handleDragEnd}
      >
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div>
            <h3>Discard Pile</h3>
            <SortableContext id="discard-pile" items={localDiscardPile.map(c => c.id)} strategy={horizontalListSortingStrategy}>
              <DroppableContainer id="discard-pile">
                {localDiscardPile.map((card) => (
                  <SortableCard key={card.id} card={card} showFace={frozenVisibility[card.id]} />
                ))}
                {localDiscardPile.length === 0 && <span style={{ color: '#888', margin: 'auto' }}>Drag cards here</span>}
              </DroppableContainer>
            </SortableContext>
          </div>

          <div>
            <h3>Draw Pile</h3>
            <SortableContext id="draw-pile" items={localDrawPile.map(c => c.id)} strategy={horizontalListSortingStrategy}>
              <DroppableContainer id="draw-pile">
                {localDrawPile.map((card) => (
                  <SortableCard key={card.id} card={card} showFace={frozenVisibility[card.id]} />
                ))}
                {localDrawPile.length === 0 && <span style={{ color: '#888', margin: 'auto' }}>Drag cards here</span>}
              </DroppableContainer>
            </SortableContext>
          </div>
          
        </div>

        <DragOverlay dropAnimation={dropAnimation}>
          {activeCard ? (
            <div style={{ flex: '0 0 calc((100% - 25px) / 6)', height: '80px' }}>
              <img
                src={frozenVisibility[activeCard.id] ? activeCard.imageFaceUrl : CARD_BACK_URL}
                alt={frozenVisibility[activeCard.id] ? activeCard.type : 'Card Back'}
                style={{ height: '100%', objectFit: 'contain' }}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};
