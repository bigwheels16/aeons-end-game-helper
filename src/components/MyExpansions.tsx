import { ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ExpansionProfile, useGameStore } from '../store';
import { useOwnedExpansions } from '../hooks/useOwnedExpansions';
import { ALL_EXPANSIONS, formatOwnedList, getEffectiveOwned } from '../utils/expansions';
import styles from './MyExpansions.module.css';

/* UI for the app-wide "Expansions" setting. */

const cx = (...classes: (string | false | undefined)[]): string => classes.filter(Boolean).join(' ');

interface MyExpansionsPickerProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal picker for the app-wide "Expansions" setting. Reads and writes the store directly,
 * so every instance (Home, each tool screen) is identical. Every tap applies immediately;
 * closing (Done / backdrop / Escape) never discards changes. Profiles are edited in a draft
 * that is only kept on Save.
 */
export function MyExpansionsPicker({ isOpen, onClose }: MyExpansionsPickerProps) {
  if (!isOpen) return null;
  // Rendering the dialog as its own component resets the picker-local search text on close.
  return <MyExpansionsDialog onClose={onClose} />;
}

function MyExpansionsDialog({ onClose }: { onClose: () => void }) {
  // The profile being created or edited; null shows the selection
  const [editing, setEditing] = useState<ExpansionProfile | null>(null);
  const titleId = useId();

  // Backdrop and Escape leave the profile editor first, then close the picker
  const dismiss = () => (editing ? setEditing(null) : onClose());

  // Lock background body scrolling while open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') dismiss();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div className={styles.dialog}>
        {editing ? (
          <ProfileEditor titleId={titleId} profile={editing} onDone={() => setEditing(null)} />
        ) : (
          <SelectionView titleId={titleId} onEditProfile={setEditing} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

/** Dialog heading that takes focus when shown (not the search box, to avoid popping the phone keyboard). */
function DialogHeading({ id, children }: { id: string; children: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <h3 id={id} ref={ref} tabIndex={-1} className={styles.title}>
      {children}
    </h3>
  );
}

interface SelectionViewProps {
  titleId: string;
  onEditProfile: (profile: ExpansionProfile) => void;
  onClose: () => void;
}

function SelectionView({ titleId, onEditProfile, onClose }: SelectionViewProps) {
  const toggleOwnedExpansion = useGameStore((state) => state.toggleOwnedExpansion);
  const setOwnedExpansions = useGameStore((state) => state.setOwnedExpansions);
  const { ownedSet, isAll, count, total } = useOwnedExpansions();

  const statusText = isAll
    ? 'None selected — showing all expansions'
    : `${count} of ${total} selected`;

  return (
    <>
      <div className={styles.header}>
        <DialogHeading id={titleId}>Expansions</DialogHeading>
        <p className={styles.subtitle}>Applies to all tools. Tap the ones you own.</p>
        <p className={styles.status} aria-live="polite">{statusText}</p>
      </div>

      <ProfileList onEdit={onEditProfile} />

      <ExpansionTiles
        selected={ownedSet}
        onToggle={toggleOwnedExpansion}
        onSetAll={setOwnedExpansions}
      />

      <button
        type="button"
        onClick={onClose}
        className={cx(styles.actionBtn, styles.primaryBtn, styles.focusable)}
      >
        Done
      </button>
    </>
  );
}

/** Profile on/off toggles, each with an edit button, and New Profile (which starts from the current selection). */
function ProfileList({ onEdit }: { onEdit: (profile: ExpansionProfile) => void }) {
  const profiles = useGameStore((state) => state.expansionProfiles);
  const activeIds = useGameStore((state) => state.activeProfileIds);
  const toggleExpansionProfile = useGameStore((state) => state.toggleExpansionProfile);
  const { owned, activeProfileNames } = useOwnedExpansions();

  return (
    <div className={styles.profiles}>
      <p className={styles.sectionLabel}>Profiles</p>
      <div className={styles.profileList}>
        {profiles.map((profile) => {
          const active = activeIds.includes(profile.id);
          return (
            <div key={profile.id} className={cx(styles.profile, active && styles.profileActive)}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => toggleExpansionProfile(profile.id)}
                className={cx(styles.profileToggle, styles.focusable)}
              >
                {active && <span aria-hidden="true">✓ </span>}
                {profile.name}
              </button>
              <button
                type="button"
                aria-label={`Edit profile ${profile.name}`}
                onClick={() => onEdit(profile)}
                className={cx(styles.profileEdit, styles.focusable)}
              >
                ✎
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => onEdit({ id: crypto.randomUUID(), name: '', expansions: owned })}
          className={cx(styles.profileNew, styles.focusable)}
        >
          + New Profile
        </button>
      </div>
      {activeProfileNames.length > 0 && (
        <p className={styles.profilesNote}>Changing the expansions below turns the profiles off.</p>
      )}
    </div>
  );
}

interface ProfileEditorProps {
  titleId: string;
  profile: ExpansionProfile;
  onDone: () => void;
}

/** Creates or edits a profile; nothing is stored until Save. */
function ProfileEditor({ titleId, profile, onDone }: ProfileEditorProps) {
  const saveExpansionProfile = useGameStore((state) => state.saveExpansionProfile);
  const deleteExpansionProfile = useGameStore((state) => state.deleteExpansionProfile);
  const isNew = useGameStore((state) => !state.expansionProfiles.some((p) => p.id === profile.id));

  const [name, setName] = useState(profile.name);
  const [expansions, setExpansions] = useState(() => getEffectiveOwned(profile.expansions));
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const selected = useMemo(() => new Set(expansions), [expansions]);

  const trimmedName = name.trim();
  const canSave = trimmedName !== '' && expansions.length > 0;
  const statusText = expansions.length === 0
    ? 'Pick at least one expansion'
    : `${expansions.length} of ${ALL_EXPANSIONS.length} selected`;

  const toggle = (exp: string) => {
    setExpansions((current) =>
      getEffectiveOwned(current.includes(exp) ? current.filter((e) => e !== exp) : [...current, exp])
    );
  };

  const handleSave = () => {
    saveExpansionProfile({ id: profile.id, name: trimmedName, expansions });
    onDone();
  };

  // Delete asks for a second tap
  const handleDelete = () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    deleteExpansionProfile(profile.id);
    onDone();
  };

  return (
    <>
      <div className={styles.header}>
        <DialogHeading id={titleId}>{isNew ? 'New Profile' : 'Edit Profile'}</DialogHeading>
        <p className={styles.subtitle}>Name the profile and tap its expansions.</p>
        <p className={styles.status} aria-live="polite">{statusText}</p>
      </div>

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        placeholder="Profile name"
        aria-label="Profile name"
        className={cx(styles.textInput, styles.nameInput, styles.focusable)}
      />

      <ExpansionTiles
        selected={selected}
        onToggle={toggle}
        onSetAll={(names) => setExpansions([...names])}
      />

      <div className={styles.editorActions}>
        {!isNew && (
          <button
            type="button"
            onClick={handleDelete}
            className={cx(styles.actionBtn, styles.dangerBtn, styles.focusable)}
          >
            {confirmingDelete ? 'Confirm Delete' : 'Delete'}
          </button>
        )}
        <button
          type="button"
          onClick={onDone}
          className={cx(styles.actionBtn, styles.secondaryBtn, styles.focusable)}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className={cx(styles.actionBtn, styles.primaryBtn, styles.focusable)}
        >
          Save
        </button>
      </div>
    </>
  );
}

interface ExpansionTilesProps {
  /** Selected expansions; null selects none. */
  selected: ReadonlySet<string> | null;
  onToggle: (name: string) => void;
  /** Replaces the selection (Select All / Clear Selection). */
  onSetAll: (names: readonly string[]) => void;
}

/** Search box, Select All / Clear Selection, and a toggle tile per expansion. */
function ExpansionTiles({ selected, onToggle, onSetAll }: ExpansionTilesProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const total = ALL_EXPANSIONS.length;

  const visibleExpansions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return ALL_EXPANSIONS;
    return ALL_EXPANSIONS.filter((name) => name.toLowerCase().includes(query));
  }, [searchQuery]);

  return (
    <>
      <div className={styles.searchWrap}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`Search ${total} expansions...`}
          aria-label="Search expansions"
          className={cx(styles.textInput, styles.searchInput, styles.focusable)}
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
          onClick={() => onSetAll(ALL_EXPANSIONS)}
          className={cx(styles.bulkBtn, styles.focusable)}
        >
          Select All ({total})
        </button>
        <button
          type="button"
          onClick={() => onSetAll([])}
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
            const isSelected = selected !== null && selected.has(name);
            return (
              <button
                key={name}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onToggle(name)}
                className={cx(styles.tile, isSelected && styles.tileSelected, styles.focusable)}
              >
                <span className={styles.tileName}>{name}</span>
                <span
                  aria-hidden="true"
                  className={cx(styles.tileMark, isSelected && styles.tileMarkSelected)}
                >
                  {isSelected ? '✓' : ''}
                </span>
              </button>
            );
          })
        )}
      </div>
    </>
  );
}

/**
 * Compact, always-visible indicator of the app-wide setting, shown on the Home screen and on
 * each filtered tool screen. Opens its own picker.
 */
export function MyExpansionsChip() {
  const { isAll, label, activeProfileNames } = useOwnedExpansions();
  const [pickerOpen, setPickerOpen] = useState(false);
  const selection = isAll ? 'All' : `${label} selected`;
  const profiles = activeProfileNames.length > 0 ? ` from profiles ${activeProfileNames.join(', ')}` : '';
  const ariaLabel = `Expansions: ${selection}${profiles}, applies to all tools. Edit`;

  return (
    <>
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        aria-haspopup="dialog"
        aria-label={ariaLabel}
        className={cx(styles.chip, styles.focusable)}
      >
        <span className={styles.chipText}>
          <span className={styles.chipTitle}>Expansions</span>
          <span className={styles.chipSubtitle}>applies to all tools</span>
          {activeProfileNames.length > 0 && (
            <span className={styles.chipProfiles}>{activeProfileNames.join(' + ')}</span>
          )}
        </span>
        <span className={styles.chipPill}>{label} ›</span>
      </button>
      <MyExpansionsPicker isOpen={pickerOpen} onClose={() => setPickerOpen(false)} />
    </>
  );
}

interface OpenPickerProps {
  /**
   * Opens the Expansions picker. The caller owns the picker because this component unmounts as
   * soon as a picked expansion changes the results, which would close a picker it owned.
   */
  onOpen: () => void;
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
