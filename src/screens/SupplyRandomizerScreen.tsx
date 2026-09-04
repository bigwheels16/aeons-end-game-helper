import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useGameStore } from '../store';
import scrapedData from '../../data/scraped/aeons_end_all.json';
import { getUniqueExpansions } from '../utils/cards';
import ExpansionFilter from '../components/ExpansionFilter';
import SupplySlot from '../components/SupplySlot';
import { solveSupplyRandomizer, isCardMatch } from '../supplyRandomizerEngine';
import { ScrapedSupplyCard } from '../types/scraped';
import styles from './SupplyRandomizerScreen.module.css';

const allCards: ScrapedSupplyCard[] = scrapedData.supply || [];

/**
 * Supply Randomizer screen component.
 * Allows players to configure custom market slots with type, cost, and search criteria,
 * filter by expansions, and run intelligent backtracking randomization to build
 * unique 9-card (or custom-sized) market supplies.
 */
export default function SupplyRandomizerScreen() {
  const randomizerExpansions = useGameStore((state) => state.randomizerExpansions);
  const randomizerSlots = useGameStore((state) => state.randomizerSlots);
  const randomizedResult = useGameStore((state) => state.randomizedResult);
  
  const setRandomizerExpansions = useGameStore((state) => state.setRandomizerExpansions);
  const addSlot = useGameStore((state) => state.addSlot);
  const removeSlot = useGameStore((state) => state.removeSlot);
  const updateSlot = useGameStore((state) => state.updateSlot);
  const setRandomizedResult = useGameStore((state) => state.setRandomizedResult);
  const clearRandomizer = useGameStore((state) => state.clearRandomizer);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const allExpansions = useMemo(() => getUniqueExpansions(allCards), []);

  const toggleExpansion = (exp: string) => {
    setRandomizerExpansions(
      randomizerExpansions.includes(exp)
        ? randomizerExpansions.filter(e => e !== exp)
        : [...randomizerExpansions, exp]
    );
  };

  const activeExpansions = randomizerExpansions.length > 0 ? randomizerExpansions : allExpansions;

  const availableCardsPool = useMemo(() => {
    return allCards.filter(card => 
      card.expansions && card.expansions.some(e => activeExpansions.includes(e))
    );
  }, [activeExpansions]);

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
    if (randomizerSlots.length === 0) {
      setErrorMsg("Add at least one slot before randomizing.");
      return;
    }

    const result = solveSupplyRandomizer(randomizerSlots, availableCardsPool);
    if (result) {
      setRandomizedResult(result);
    } else {
      setErrorMsg("Not enough unique cards to satisfy all slot criteria.");
      setRandomizedResult({});
    }
  };

  const handleRerollSlot = (slotId: string) => {
    const slot = randomizerSlots.find(s => s.id === slotId);
    if (!slot) return;

    // Identify cards assigned to OTHER slots to guarantee uniqueness across supply
    const otherAssignedNames = new Set(
      Object.entries(randomizedResult)
        .filter(([id, card]) => id !== slotId && card)
        .map(([_, card]) => card.name)
    );

    const candidates = availableCardsPool.filter(card => {
      if (!card || otherAssignedNames.has(card.name)) return false;
      return isCardMatch(card, slot);
    });

    if (candidates.length === 0) {
      toast.error("No other matching cards available without duplicate.");
      return;
    }

    const currentCard = randomizedResult[slotId];
    const alternatives = candidates.filter(c => !currentCard || c.name !== currentCard.name);
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
        
        <ExpansionFilter
          allExpansions={allExpansions}
          selectedExpansions={randomizerExpansions}
          onToggleExpansion={toggleExpansion}
          onSelectAll={() => setRandomizerExpansions(allExpansions)}
          onClearAll={() => setRandomizerExpansions([])}
        />
        
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
            slotId={slot.id}
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
