import { ReactNode, useState } from 'react';
import {
  MyExpansionsChip,
  MyExpansionsEmptyState,
  MyExpansionsPicker,
  MyExpansionsSearchingNote,
} from './MyExpansions';

export interface SearchScreenLayoutProps {
  /** Screen name; the heading adds the result count. */
  title: string;
  /** Plural noun for the items, e.g. "cards". */
  itemLabel: string;
  /** The search box. */
  search: { label: string; placeholder: string; value: string; onChange: (value: string) => void };
  /** Resets this screen's own filters. The app-wide Expansions setting is never cleared here. */
  onClear: () => void;
  /** True when the Expansions setting excludes every item, so no filter change can help. */
  noOwnedItems: boolean;
  /** One element per matching item. */
  results: ReactNode[];
  /** Minimum width of a results grid column, e.g. "250px". */
  itemMinWidth: string;
  /** Gap between results, e.g. "1rem". */
  itemGap: string;
  /** This screen's own filter controls, shown between the search box and the Clear button. */
  children?: ReactNode;
  /** Shown next to the "Clear All Filters" button. */
  clearNote?: ReactNode;
  /** Shown under the "No matching ..." message. */
  noMatchActions?: ReactNode;
}

/**
 * Shared frame of the search screens: heading with result count, Expansions chip, search box,
 * the screen's own filters, "Clear All Filters", and the empty, no-match or results grid body.
 */
export default function SearchScreenLayout({
  title,
  itemLabel,
  search,
  onClear,
  noOwnedItems,
  results,
  itemMinWidth,
  itemGap,
  children,
  clearNote,
  noMatchActions,
}: SearchScreenLayoutProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const openPicker = () => setPickerOpen(true);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', backgroundColor: '#1a1a1a' }}>
      <div style={{ padding: '1rem', borderBottom: '1px solid #555' }}>
        <h2 style={{ marginTop: 0, color: 'white' }}>{title} ({results.length} results)</h2>

        <MyExpansionsChip />

        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '1rem' }}>
          <label style={{ color: '#ccc', marginBottom: '4px' }}>{search.label}</label>
          <input
            type="text"
            value={search.value}
            onChange={e => search.onChange(e.target.value)}
            placeholder={search.placeholder}
            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#333', color: 'white' }}
          />
        </div>

        {children}

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            onClick={onClear}
            style={{
              padding: '0.5rem 1rem',
              cursor: 'pointer',
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontWeight: 'bold'
            }}
          >
            Clear All Filters
          </button>
          {clearNote}
        </div>
      </div>

      <div style={{ padding: '1rem', backgroundColor: '#1a1a1a' }}>
        {noOwnedItems ? (
          <MyExpansionsEmptyState itemLabel={itemLabel} onOpen={openPicker} />
        ) : results.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <p style={{ fontSize: '1.25rem', color: '#ccc' }}>No matching {itemLabel} found.</p>
            <MyExpansionsSearchingNote onOpen={openPicker} />
            {noMatchActions}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${itemMinWidth}, 1fr))`, gap: itemGap }}>
            {results}
          </div>
        )}
      </div>

      <MyExpansionsPicker isOpen={pickerOpen} onClose={() => setPickerOpen(false)} />
    </div>
  );
}
