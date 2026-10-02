import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useGameStore } from '../store';
import scrapedData from '../../data/scraped/aeons_end_all.json';
import { matchesOwned } from '../utils/expansions';
import { useOwnedExpansions } from '../hooks/useOwnedExpansions';
import { MyExpansionsChip } from '../components/MyExpansions';
import SupplySlot from '../components/SupplySlot';
import { solveSupplyRandomizer, isCardMatch } from '../supplyRandomizerEngine';
import { ScrapedSupplyCard } from '../types/scraped';
import styles from './SupplyRandomizerScreen.module.css';

const allCards: ScrapedSupplyCard[] = scrapedData.supply;

/**
 * Supply Randomizer screen component.
 * Allows players to configure custom market slots with type, cost, and search criteria
 * and run intelligent backtracking randomization to build unique 9-card (or custom-sized)
 * market supplies. The card pool is restricted to the app-wide "Expansions" setting,
 * which "Clear All" never changes.
 */
export default function SupplyRandomizerScreen() {
  const randomizerSlots = useGameStore((state) => state.randomizerSlots);
  const randomizedResult = useGameStore((state) => state.randomizedResult);
  
  const addSlot = useGameStore((state) => state.addSlot);
  const removeSlot = useGameStore((state) => state.removeSlot);
  const updateSlot = useGameStore((state) => state.updateSlot);
  const setRandomizedResult = useGameStore((state) => state.setRandomizedResult);
  const clearRandomizer = useGameStore((state) => state.clearRandomizer);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { ownedSet, isAll, label: ownedLabel } = useOwnedExpansions();

  // Single card pool used by randomize, single-slot re-roll, live previews and zero-match checks
  const availableCardsPool = useMemo(
    () => allCards.filter(card => matchesOwned(card, ownedSet)),
    [ownedSet]
  );

  const handleAddSlot = () => {
    addSlot({
      id: crypto.randomUUID(),
      cardTypes: ['Gem', 'Relic', 'Spell'],
      costRange: [0, 10],
      searchTerm: '',
    });
    setErrorMsg(null);
  };

  const handleClearAll = () => {
    clearRandomizer();
    setErrorMsg(null);
  };

  const handleRandomize = () => {
    setErrorMsg(null);
    const result = solveSupplyRandomizer(randomizerSlots, availableCardsPool);
    if (result) {
      setRandomizedResult(result);
    } else {
      setErrorMsg(isAll
        ? "Not enough unique cards to satisfy all slot criteria."
        : `Not enough unique cards to satisfy all slot criteria. Your Expansions setting (${ownedLabel}) limits the card pool — add expansions or loosen slot criteria.`);
      setRandomizedResult({});
    }
  };

  const handleRerollSlot = (slotId: string) => {
    const slot = randomizerSlots.find(s => s.id === slotId);
    if (!slot) return;

    // Identify cards assigned to OTHER slots to guarantee uniqueness across supply
    const otherAssignedIds = new Set(
      Object.entries(randomizedResult)
        .filter(([id]) => id !== slotId)
        .map(([_, card]) => card.id)
    );

    const candidates = availableCardsPool.filter(card => !otherAssignedIds.has(card.id) && isCardMatch(card, slot));

    if (candidates.length === 0) {
      toast.error("No other matching cards available without duplicate.");
      return;
    }

    const currentCard = randomizedResult[slotId];
    const alternatives = candidates.filter(c => !currentCard || c.id !== currentCard.id);
    const pool = alternatives.length > 0 ? alternatives : candidates;
    const picked = pool[Math.floor(Math.random() * pool.length)];

    setRandomizedResult({
      ...randomizedResult,
      [slotId]: picked
    });
    toast.success(`Randomized: ${picked.name}`);
  };

  const handleEditCriteria = (slotId: string) => {
    const updated = { ...randomizedResult };
    delete updated[slotId];
    setRandomizedResult(updated);
  };

  const hasZeroMatches = randomizerSlots.some(slot => {
    const matches = availableCardsPool.filter(card => isCardMatch(card, slot));
    return matches.length === 0;
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', backgroundColor: '#1a1a1a' }}>
      <div style={{ padding: '1rem', borderBottom: '1px solid #555' }}>
        <h2 style={{ marginTop: 0, color: 'white' }}>Supply Randomizer</h2>
        
        <MyExpansionsChip />
        
        <div className={styles.actionsContainer}>
          <div className={styles.managementButtons}>
            <button 
              onClick={handleAddSlot}
              className={styles.addSlotBtn}
            >
              + Add Slot
            </button>
            <button 
              onClick={handleClearAll}
              className={styles.clearAllBtn}
            >
              Clear All
            </button>
          </div>
          <button 
            onClick={handleRandomize}
            disabled={hasZeroMatches || randomizerSlots.length === 0}
            className={`${styles.randomizeBtn} ${hasZeroMatches || randomizerSlots.length === 0 ? styles.randomizeBtnDisabled : styles.randomizeBtnEnabled}`}
          >
            Randomize
          </button>
        </div>

        {hasZeroMatches && !isAll && (
          <p style={{ margin: '0.5rem 0 0 0', color: '#999', fontSize: '0.9rem' }}>
            Some slots have no matching cards in your selected expansions.
          </p>
        )}
        
        {errorMsg && (
          <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'rgba(244, 67, 54, 0.2)', border: '1px solid #f44336', borderRadius: '4px', color: '#ffcdd2' }}>
            {errorMsg}
          </div>
        )}
      </div>

      <div className={styles.slotsGrid}>
        {randomizerSlots.map(slot => (
          <SupplySlot 
            key={slot.id}
            criteria={slot}
            availableCards={availableCardsPool}
            assignedCard={randomizedResult[slot.id] || null}
            onUpdate={updateSlot}
            onRemove={removeSlot}
            onReroll={handleRerollSlot}
            onEditCriteria={handleEditCriteria}
          />
        ))}
        {randomizerSlots.length === 0 && (
          <div style={{ color: '#888', gridColumn: '1 / -1', textAlign: 'center', padding: '2rem' }}>
            Click "+ Add Slot" to start building a supply.
          </div>
        )}
      </div>
    </div>
  );
}
