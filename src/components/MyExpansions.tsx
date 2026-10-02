import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useGameStore } from '../store';
import { useOwnedExpansions } from '../hooks/useOwnedExpansions';
import { ALL_EXPANSIONS, formatOwnedList } from '../utils/expansions';
import styles from './MyExpansions.module.css';

/*
 * UI for the app-wide "Expansions" setting.
 *
 * Security note: every expansion name rendered here comes from ALL_EXPANSIONS (bundled data)
 * or from useOwnedExpansions().owned (an intersection with ALL_EXPANSIONS). The raw persisted
 * array is never rendered. Names are only ever React text children / attribute strings.
 */

const cx = (...classes: (string | false | undefined)[]): string => classes.filter(Boolean).join(' ');

interface MyExpansionsPickerProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal picker for the app-wide "Expansions" setting. Reads and writes the store directly,
 * so every instance (Home, each tool screen) is identical. Every tap applies immediately;
 * closing (Done / backdrop / Escape) never discards changes.
 */
export function MyExpansionsPicker({ isOpen, onClose }: MyExpansionsPickerProps) {
  if (!isOpen) return null;
  // Rendering the dialog as its own component resets the picker-local search text on close.
  return <MyExpansionsDialog onClose={onClose} />;
}

function MyExpansionsDialog({ onClose }: { onClose: () => void }) {
  const toggleOwnedExpansion = useGameStore((state) => state.toggleOwnedExpansion);
  const setOwnedExpansions = useGameStore((state) => state.setOwnedExpansions);
  const { ownedSet, isAll, count, total } = useOwnedExpansions();

  const [searchQuery, setSearchQuery] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();

  // Lock background body scrolling while open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Move focus to the heading (not the search box, to avoid popping the phone keyboard)
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // Plain case-insensitive substring match; never builds a RegExp from user input.
  const visibleExpansions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return ALL_EXPANSIONS;
    return ALL_EXPANSIONS.filter((name) => name.toLowerCase().includes(query));
  }, [searchQuery]);

  const statusText = isAll
    ? 'None selected — showing all expansions'
    : `${count} of ${total} selected`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.dialog}>
        <div className={styles.header}>
          <h3 id={titleId} ref={headingRef} tabIndex={-1} className={styles.title}>
            Expansions
          </h3>
          <p className={styles.subtitle}>Applies to all tools. Tap the ones you own.</p>
          <p className={styles.status} aria-live="polite">{statusText}</p>
        </div>

        <div className={styles.searchWrap}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${total} expansions...`}
            aria-label="Search expansions"
            className={cx(styles.searchInput, styles.focusable)}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className={cx(styles.searchClear, styles.focusable)}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        <div className={styles.bulkActions}>
          <button
            type="button"
            onClick={() => setOwnedExpansions(ALL_EXPANSIONS)}
            className={cx(styles.bulkBtn, styles.focusable)}
          >
            Select All ({total})
          </button>
          <button
            type="button"
            onClick={() => setOwnedExpansions([])}
            className={cx(styles.bulkBtn, styles.focusable)}
          >
            Clear Selection
          </button>
        </div>

        <div className={styles.tileGrid}>
          {visibleExpansions.length === 0 ? (
            <div className={styles.noMatches}>No matching expansions found</div>
          ) : (
            visibleExpansions.map((name) => {
              const selected = ownedSet !== null && ownedSet.has(name);
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleOwnedExpansion(name)}
                  className={cx(styles.tile, selected && styles.tileSelected, styles.focusable)}
                >
                  <span className={styles.tileName}>{name}</span>
                  <span
                    aria-hidden="true"
                    className={cx(styles.tileMark, selected && styles.tileMarkSelected)}
                  >
                    {selected ? '✓' : ''}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className={cx(styles.doneBtn, styles.focusable)}
        >
          Done
        </button>
      </div>
    </div>
  );
}

interface OpenPickerProps {
  /** Opens the Expansions picker */
  onOpen: () => void;
}

/**
 * Compact, always-visible indicator of the app-wide setting, shown on the Home screen and on
 * each filtered tool screen.
 */
export function MyExpansionsChip({ onOpen }: OpenPickerProps) {
  const { isAll, label } = useOwnedExpansions();
  const ariaLabel = isAll
    ? 'Expansions: All, applies to all tools. Edit'
    : `Expansions: ${label} selected, applies to all tools. Edit`;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={ariaLabel}
      className={cx(styles.chip, styles.focusable)}
    >
      <span className={styles.chipText}>
        <span className={styles.chipTitle}>Expansions</span>
        <span className={styles.chipSubtitle}>applies to all tools</span>
      </span>
      <span className={styles.chipPill}>{label} ›</span>
    </button>
  );
}

interface OwnedEmptyStateProps extends OpenPickerProps {
  /** Plural noun for the screen's items, e.g. "cards", "mages", "nemeses" */
  itemLabel: string;
}

/**
 * Zero-results state shown when the Expansions selection itself excludes every item on a
 * screen. Deliberately offers no "Clear all filters" action, since clearing cannot fix it.
 */
export function MyExpansionsEmptyState({ itemLabel, onOpen }: OwnedEmptyStateProps) {
  const { owned } = useOwnedExpansions();
  return (
    <div className={styles.emptyState}>
      <p className={styles.emptyTitle}>None of your selected expansions contain {itemLabel}.</p>
      <p className={styles.emptyDetail}>Selected: {formatOwnedList(owned)}</p>
      <p className={styles.emptyDetail}>(Clearing filters will not change this.)</p>
      <button type="button" onClick={onOpen} className={cx(styles.editBtn, styles.focusable)}>
        Edit Expansions
      </button>
    </div>
  );
}

/**
 * Muted note shown with "no matching results" when the Expansions setting is restricting the search.
 * Renders nothing when the selection is "All".
 */
export function MyExpansionsSearchingNote({ onOpen }: OpenPickerProps) {
  const { isAll, label } = useOwnedExpansions();
  if (isAll) return null;
  return (
    <p className={styles.searchingNote}>
      Searching within selected expansions ({label})
      <button type="button" onClick={onOpen} className={cx(styles.inlineLink, styles.focusable)}>
        Edit
      </button>
    </p>
  );
}
