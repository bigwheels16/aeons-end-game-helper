import { useState, useRef, useEffect, useMemo } from 'react';

interface ExpansionFilterProps {
  allExpansions: string[];
  selectedExpansions: string[];
  onToggleExpansion: (expansion: string) => void;
  onSelectAll?: () => void;
  onClearAll?: () => void;
}

export default function ExpansionFilter({
  allExpansions,
  selectedExpansions,
  onToggleExpansion,
  onSelectAll,
  onClearAll,
}: ExpansionFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Lock background body scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Close modal on Escape key press
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  const filteredExpansions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return allExpansions;
    return allExpansions.filter(exp => exp.toLowerCase().includes(query));
  }, [allExpansions, searchQuery]);

  const handleSelectAll = () => {
    if (onSelectAll) {
      onSelectAll();
    } else {
      allExpansions.forEach(exp => {
        if (!selectedExpansions.includes(exp)) {
          onToggleExpansion(exp);
        }
      });
    }
  };

  const handleClearAll = () => {
    if (onClearAll) {
      onClearAll();
    } else {
      selectedExpansions.forEach(exp => onToggleExpansion(exp));
    }
  };

  const count = selectedExpansions.length;
  const triggerLabel = count === 0 ? 'All Expansions' : `${count} Expansion${count === 1 ? '' : 's'} Selected`;

  return (
    <div style={{ marginBottom: '1rem', display: 'inline-block' }}>
      <strong style={{ color: '#ccc', display: 'block', marginBottom: '0.5rem' }}>Expansions:</strong>

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.45rem 0.85rem',
          backgroundColor: '#222',
          color: '#eee',
          border: isOpen || count > 0 ? '1px solid #4CAF50' : '1px solid #555',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '0.9rem',
          transition: 'all 0.2s',
        }}
      >
        <span>{triggerLabel}</span>
        {count > 0 && (
          <span
            style={{
              backgroundColor: '#4CAF50',
              color: '#fff',
              borderRadius: '10px',
              padding: '0.1rem 0.45rem',
              fontSize: '0.75rem',
              fontWeight: 'bold',
            }}
          >
            {count}
          </span>
        )}
        <span style={{ fontSize: '0.75rem', color: '#aaa', marginLeft: '0.25rem' }}>
          ▾
        </span>
      </button>

      {/* Unified Centered Modal Dialog */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="expansion-modal-title"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            boxSizing: 'border-box',
          }}
          onClick={e => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div
            style={{
              backgroundColor: '#1e1e1e',
              borderRadius: '12px',
              border: '1px solid #444',
              width: '100%',
              maxWidth: '480px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.8)',
              padding: '1.25rem',
              boxSizing: 'border-box',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
              }}
            >
              <h3 id="expansion-modal-title" style={{ margin: 0, color: '#fff', fontSize: '1.15rem' }}>
                Filter Expansions {count > 0 && `(${count} Selected)`}
              </h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#aaa',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                }}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={`Search ${allExpansions.length} expansions...`}
                style={{
                  width: '100%',
                  padding: '0.65rem 2rem 0.65rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid #555',
                  backgroundColor: '#2a2a2a',
                  color: 'white',
                  fontSize: '0.95rem',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#888',
                    fontSize: '1rem',
                    cursor: 'pointer',
                    padding: '4px',
                  }}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Bulk Action Buttons */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <button
                type="button"
                onClick={handleSelectAll}
                style={{
                  flex: 1,
                  padding: '0.45rem',
                  borderRadius: '6px',
                  border: '1px solid #555',
                  backgroundColor: '#2a2a2a',
                  color: '#ccc',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Select All ({allExpansions.length})
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                style={{
                  flex: 1,
                  padding: '0.45rem',
                  borderRadius: '6px',
                  border: '1px solid #555',
                  backgroundColor: '#2a2a2a',
                  color: '#ccc',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Clear Selection
              </button>
            </div>

            {/* Scrollable Checkbox List */}
            <div
              role="listbox"
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                marginBottom: '1.25rem',
                overscrollBehavior: 'contain',
                paddingRight: '4px',
              }}
            >
              {filteredExpansions.length === 0 ? (
                <div style={{ padding: '2.5rem 1rem', color: '#888', fontSize: '0.95rem', textAlign: 'center' }}>
                  No matching expansions found
                </div>
              ) : (
                filteredExpansions.map(exp => {
                  const isSelected = selectedExpansions.includes(exp);
                  return (
                    <label
                      key={exp}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        minHeight: '44px',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? 'rgba(76, 175, 80, 0.18)' : '#262626',
                        border: isSelected ? '1px solid #4CAF50' : '1px solid #383838',
                        color: isSelected ? '#4CAF50' : '#eee',
                        fontSize: '0.95rem',
                        userSelect: 'none',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleExpansion(exp)}
                        style={{
                          width: '18px',
                          height: '18px',
                          accentColor: '#4CAF50',
                          cursor: 'pointer',
                        }}
                      />
                      <span style={{ flex: 1, fontWeight: isSelected ? 600 : 400 }}>
                        {exp}
                      </span>
                    </label>
                  );
                })
              )}
            </div>

            {/* Bottom Apply Action Button */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '1rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
            >
              Apply Filters {count > 0 && `(${count} Selected)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
