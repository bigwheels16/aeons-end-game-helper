import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ItemCategory, useGameStore } from '../store';
import styles from './NoteButton.module.css';

const NOTE_COLOR = '#64b5f6';

export interface NoteButtonProps {
  category: ItemCategory;
  /** Bundled record id: the notes key. */
  id: string;
  /** Display name: used in the editor title and the aria-label. */
  name: string;
}

/** Note page icon; filled when the item has a note. */
function NoteIcon({ filled }: { filled: boolean }) {
  const lineColor = filled ? '#222' : NOTE_COLOR;
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4.5 3.5h15a1 1 0 0 1 1 1V15l-5.5 5.5h-10.5a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1z"
        fill={filled ? NOTE_COLOR : 'none'}
        stroke={NOTE_COLOR}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M20.5 15H16a1 1 0 0 0-1 1v4.5M7.5 8.5h9M7.5 12h5.5"
        fill="none"
        stroke={lineColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface NoteDialogProps {
  name: string;
  /** The saved note; '' when there is none. */
  note: string;
  /** Stores the trimmed note; '' deletes it. */
  onSave: (text: string) => void;
  onClose: () => void;
}

/** Edits one note; nothing is stored until Save. Cancel or Escape closes without saving. */
function NoteDialog({ name, note, onSave, onClose }: NoteDialogProps) {
  const [text, setText] = useState(note);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const titleId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const trimmed = text.trim();

  // A new note focuses the text box; an existing one the heading, so the phone keyboard stays closed
  useEffect(() => {
    (note ? headingRef : textareaRef).current?.focus();
  }, []);

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
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Delete asks for a second tap
  const handleDelete = () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    onSave('');
  };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby={titleId} className={styles.backdrop}>
      <div className={styles.dialog}>
        <h3 id={titleId} ref={headingRef} tabIndex={-1} className={styles.title}>
          Note on {name}
        </h3>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Note"
          placeholder="Write a note..."
          rows={6}
          className={`${styles.textarea} ${styles.focusable}`}
        />
        <div className={styles.actions}>
          {note && (
            <button
              type="button"
              onClick={handleDelete}
              className={`${styles.actionBtn} ${styles.dangerBtn} ${styles.focusable}`}
            >
              {confirmingDelete ? 'Confirm Delete' : 'Delete'}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className={`${styles.actionBtn} ${styles.secondaryBtn} ${styles.focusable}`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(trimmed)}
            disabled={!trimmed}
            className={`${styles.actionBtn} ${styles.primaryBtn} ${styles.focusable}`}
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * Note icon button that opens an editor for the user's persisted note on one item.
 * Shows an outline when there is no note and a filled icon when there is one; hovering shows the note.
 */
export default function NoteButton({ category, id, name }: NoteButtonProps) {
  const note = useGameStore((state) => state.notes[category][id]);
  const setNote = useGameStore((state) => state.setNote);
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    setIsOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-label={note ? `Edit note on ${name}` : `Add note on ${name}`}
        title={note ?? 'Add note'}
        className={`${styles.iconBtn} ${styles.focusable}`}
      >
        <NoteIcon filled={!!note} />
      </button>
      {isOpen && (
        <NoteDialog
          name={name}
          note={note ?? ''}
          onSave={(text) => {
            setNote(category, id, text);
            close();
          }}
          onClose={close}
        />
      )}
    </>
  );
}
