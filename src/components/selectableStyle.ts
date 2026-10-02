import { CSSProperties } from 'react';

/** Look of a toggle pill or option card: green border and tint when selected. */
export function selectableStyle(selected: boolean, borderWidth = 1): CSSProperties {
  return {
    border: `${borderWidth}px solid ${selected ? '#4CAF50' : '#555'}`,
    backgroundColor: selected ? 'rgba(76, 175, 80, 0.2)' : '#222',
    color: selected ? '#fff' : '#ccc',
    cursor: 'pointer',
    transition: 'all 0.2s',
  };
}

/** A small toggle pill, e.g. a card type filter. */
export function pillStyle(selected: boolean): CSSProperties {
  return { padding: '0.25rem 0.75rem', borderRadius: '4px', ...selectableStyle(selected) };
}
