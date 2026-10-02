import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import scrapedData from '../../data/scraped/aeons_end_all.json';
import { ScrapedSupplyCard } from '../types/scraped';
import { getSupplyCardById } from '../utils/cards';
import { MAX_UPLOAD_BYTES, shrinkImage } from '../utils/image';
import { toNumber } from '../utils/numbers';
import { matchesSearch } from '../utils/text';
import { ScannerAuthError, fetchLoggedIn, scanImage, signInUrl, signOutUrl } from '../utils/scannerApi';
import CardDisplayItem from '../components/CardDisplayItem';
import WikiImage from '../components/WikiImage';
import { Modal, ModalButton } from '../components/Modal';
import styles from './ScannerScreen.module.css';

const allCards: ScrapedSupplyCard[] = scrapedData.supply;

/** Query parameter holding the supply's card ids, so the page URL is a share link. */
const CARDS_PARAM = 'cards';
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PICKER_LIMIT = 50;

/** A supply position; the key stays stable while cards are reordered or swapped. */
interface SupplyEntry {
  key: string;
  card: ScrapedSupplyCard;
}

const toEntry = (card: ScrapedSupplyCard): SupplyEntry => ({ key: crypto.randomUUID(), card });

/** Supply from the URL; unknown ids are skipped. */
function readSupplyFromUrl(): SupplyEntry[] {
  const raw = new URLSearchParams(window.location.search).get(CARDS_PARAM);
  if (!raw) return [];
  return raw
    .split(',')
    .map((id) => getSupplyCardById(id.trim()))
    .filter((card): card is ScrapedSupplyCard => !!card)
    .map(toEntry);
}

/** The current page URL holding this supply; an empty supply has no parameter. */
function urlWithSupply(entries: SupplyEntry[]): URL {
  const url = new URL(window.location.href);
  if (entries.length > 0) {
    url.searchParams.set(CARDS_PARAM, entries.map((e) => e.card.id).join(','));
  } else {
    url.searchParams.delete(CARDS_PARAM);
  }
  return url;
}

/** Writes the supply to the URL without adding a history entry. */
function writeSupplyToUrl(entries: SupplyEntry[]) {
  window.history.replaceState(window.history.state, '', urlWithSupply(entries));
}

/** Path, query and hash of the page holding this supply, to return to after login or logout. */
function pageWithSupply(entries: SupplyEntry[]): string {
  const url = urlWithSupply(entries);
  return url.pathname + url.search + url.hash;
}

const byCostThenName = (a: ScrapedSupplyCard, b: ScrapedSupplyCard) =>
  toNumber(a.cost) - toNumber(b.cost) || a.name.localeCompare(b.name);

/** Highest cost first; cards with equal costs keep their order. */
const byCostDescending = (a: ScrapedSupplyCard, b: ScrapedSupplyCard) => toNumber(b.cost) - toNumber(a.cost);

interface SupplyTileProps {
  entry: SupplyEntry;
  showImages: boolean;
  onSwap: () => void;
  onRemove: () => void;
}

/** One supply card with its drag handle, swap and remove controls. */
function SupplyTile({ entry, showImages, onSwap, onRemove }: SupplyTileProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: entry.key });
  const { card } = entry;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
    zIndex: isDragging ? 10 : undefined,
  };

  const controls = (
    <>
      <button
        ref={setActivatorNodeRef}
        className={`${styles.iconBtn} ${styles.dragHandle}`}
        title="Drag to reorder"
        aria-label={`Reorder ${card.name}`}
        {...attributes}
        {...listeners}
      >
        &#10303;
      </button>
      <button className={styles.iconBtn} onClick={onSwap} title="Swap card" aria-label={`Swap ${card.name}`}>
        &#8644;
      </button>
      <button
        className={`${styles.iconBtn} ${styles.removeBtn}`}
        onClick={onRemove}
        title="Remove card"
        aria-label={`Remove ${card.name}`}
      >
        &#10005;
      </button>
    </>
  );

  return (
    <div ref={setNodeRef} style={style}>
      {showImages ? (
        <div className={styles.imageTile}>
          <div className={styles.tileActions}>
            <span className={styles.tileName} title={card.name}>{card.name}</span>
            {controls}
          </div>
          <WikiImage name={card.name} />
        </div>
      ) : (
        <CardDisplayItem card={card} headerExtra={controls} />
      )}
    </div>
  );
}

interface CardPickerProps {
  isOpen: boolean;
  title: string;
  onSelect: (card: ScrapedSupplyCard) => void;
  onClose: () => void;
}

/** Searchable list of every supply card. */
function CardPicker({ isOpen, title, onSelect, onClose }: CardPickerProps) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (isOpen) setQuery('');
  }, [isOpen]);

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    return allCards.filter((c) => matchesSearch(query, [c.name])).sort(byCostThenName);
  }, [query]);

  return (
    <Modal isOpen={isOpen} title={title} maxWidth="480px">
      <input
        type="text"
        className={styles.searchInput}
        placeholder="Search by card name..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
      <div className={styles.pickerList}>
        {!query.trim() && <p className={styles.pickerHint}>Type a card name to search.</p>}
        {query.trim() && matches.length === 0 && (
          <p className={styles.pickerHint}>No cards match "{query.trim()}".</p>
        )}
        {matches.slice(0, PICKER_LIMIT).map((c) => (
          <button key={c.id} className={styles.pickerItem} onClick={() => onSelect(c)}>
            <strong>{c.name}</strong> — {c.type} (Cost: {c.cost})
          </button>
        ))}
      </div>
      <ModalButton onClick={onClose}>Cancel</ModalButton>
    </Modal>
  );
}

/** Summary of a finished scan, shown as a toast. */
function reportScan(total: number, added: number, unmatched: string[]) {
  const plural = (n: number) => `${n} card${n === 1 ? '' : 's'}`;
  if (total === 0) {
    toast.error('No supply cards were detected in the photo.');
  } else if (unmatched.length === 0) {
    toast.success(`Detected ${plural(total)}; all added to the supply.`);
  } else {
    toast(
      `Detected ${plural(total)}; ${added} added.\n${plural(unmatched.length)} not recognized:\n` +
        unmatched.map((name) => `• ${name}`).join('\n'),
      { icon: '⚠️', duration: 8000, style: { whiteSpace: 'pre-line' } },
    );
  }
}

/**
 * Supply Scanner screen.
 *
 * Detects supply cards in a photo through the scanner service (login required), and lets anyone
 * build, reorder and edit a supply by hand. The supply lives in the page URL, so the address is
 * always a share link.
 */
export default function ScannerScreen() {
  const [supply, setSupply] = useState<SupplyEntry[]>(readSupplyFromUrl);
  // False while the login is being checked too, which shows the login link
  const [loggedIn, setLoggedIn] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [showImages, setShowImages] = useState(true);
  // Key of the entry being swapped, null when adding, undefined when the picker is closed
  const [pickerTarget, setPickerTarget] = useState<string | null | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchLoggedIn()
      .then((result) => {
        if (!cancelled) setLoggedIn(result);
      })
      .catch((err) => console.error('Login check failed', err));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    writeSupplyToUrl(supply);
  }, [supply]);

  // Leaving the screen drops the supply from the URL so other tools don't carry it
  useEffect(() => () => writeSupplyToUrl([]), []);

  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setSupply((prev) => {
      const from = prev.findIndex((e) => e.key === active.id);
      const to = prev.findIndex((e) => e.key === over.id);
      return from < 0 || to < 0 ? prev : arrayMove(prev, from, to);
    });
  };

  const processFile = async (original: File) => {
    if (!ACCEPTED_TYPES.includes(original.type)) {
      toast.error('Unsupported image format. Please use JPEG, PNG or WebP.');
      return;
    }
    setIsScanning(true);
    try {
      const file = original.size > MAX_UPLOAD_BYTES ? await shrinkImage(original) : original;
      const result = await scanImage(file);
      if (result.cards.length > 0) {
        const scanned = [...result.cards].sort(byCostDescending).map(toEntry);
        setSupply((prev) => [...prev, ...scanned]);
      }
      reportScan(result.total, result.cards.length, result.unmatched);
    } catch (err) {
      console.error('Scan failed', err);
      if (err instanceof ScannerAuthError) setLoggedIn(false);
      toast.error(`Scan failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) await processFile(file);
  };

  const isFileDrag = (e: React.DragEvent) => e.dataTransfer.types.includes('Files');

  const handleFileDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleFileDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDraggingFile(false);
  };

  const handleFileDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file && !isScanning) await processFile(file);
  };

  const handlePick = (card: ScrapedSupplyCard) => {
    const target = pickerTarget;
    setSupply((prev) =>
      target ? prev.map((e) => (e.key === target ? { key: e.key, card } : e)) : [...prev, toEntry(card)],
    );
    setPickerTarget(undefined);
  };

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>Supply Scanner</h2>
          {loggedIn ? (
            <a className={styles.authLink} href={signOutUrl(pageWithSupply(supply))}>Log out</a>
          ) : (
            <a className={styles.authLink} href={signInUrl(pageWithSupply(supply))}>Log in</a>
          )}
        </div>

        {!loggedIn && (
          <p className={styles.notice}>Log in to scan a photo of your supply. You can still add cards by hand.</p>
        )}

        {loggedIn && (
          <div
            className={`${styles.dropzone} ${isDraggingFile ? styles.dropzoneActive : ''}`}
            onDragEnter={handleFileDragOver}
            onDragOver={handleFileDragOver}
            onDragLeave={handleFileDragLeave}
            onDrop={handleFileDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileInput}
              data-testid="scan-file-input"
            />
            <button
              className={styles.primaryBtn}
              onClick={() => fileInputRef.current?.click()}
              disabled={isScanning}
            >
              {isScanning ? 'Scanning…' : 'Scan a Photo'}
            </button>
            <p className={styles.dropzoneHint}>
              {isDraggingFile
                ? 'Drop the photo to scan it'
                : 'Take a photo or choose one, or drop it here. JPEG, PNG or WebP; large photos are shrunk automatically.'}
            </p>
          </div>
        )}

        <div className={styles.actions}>
          <button className={styles.secondaryBtn} onClick={() => setPickerTarget(null)}>
            + Add Card
          </button>
          <button className={styles.secondaryBtn} onClick={() => setShowImages((prev) => !prev)}>
            {showImages ? 'Show Descriptions' : 'Show Images'}
          </button>
          <button className={styles.dangerBtn} onClick={() => setSupply([])} disabled={supply.length === 0}>
            Clear All
          </button>
        </div>
      </div>

      {supply.length === 0 ? (
        <p className={styles.emptyGrid}>No cards in the supply yet.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={supply.map((e) => e.key)} strategy={rectSortingStrategy}>
            <div className={`${styles.grid} ${showImages ? styles.gridImages : ''}`}>
              {supply.map((entry) => (
                <SupplyTile
                  key={entry.key}
                  entry={entry}
                  showImages={showImages}
                  onSwap={() => setPickerTarget(entry.key)}
                  onRemove={() => setSupply((prev) => prev.filter((e) => e.key !== entry.key))}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <CardPicker
        isOpen={pickerTarget !== undefined}
        title={pickerTarget ? 'Swap Card' : 'Add Card'}
        onSelect={handlePick}
        onClose={() => setPickerTarget(undefined)}
      />
    </div>
  );
}
