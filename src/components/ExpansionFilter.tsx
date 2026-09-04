import { useState, useRef, useEffect, useMemo } from 'react';

interface ExpansionFilterProps {
  allExpansions: string[];
  selectedExpansions: string[];
  onToggleExpansion: (expansion: string) => void;
  onSelectAll?: () => void;
  onClearAll?: () => void;
}

/**
 * Custom hook to detect mobile viewport width (< 640px).
 */
function useIsMobile(breakpoint = 640): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(`(max-width: ${breakpoint}px)`);
    setIsMobile(media.matches);

    const listener = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    if (media.addEventListener) {
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    } else if ('addListener' in media) {
      // Fallback for older browsers
      (media as any).addListener(listener);
      return () => (media as any).removeListener(listener);
    }
  }, [breakpoint]);

  return isMobile;
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
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  // Close dropdown on click outside or Escape key press (desktop)
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent | TouchEvent) {
      // On mobile, the modal backdrop handles its own clicks
      if (!isMobile && containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isMobile]);

  // Lock background body scroll when mobile sheet is open
  useEffect(() => {
    if (isOpen && isMobile) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen, isMobile]);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen) {
      // Small timeout to allow mount and animation
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
    <div ref={containerRef} style={{ position: 'relative', marginBottom: '1rem', display: 'inline-block' }}>
      <strong style={{ color: '#ccc', display: 'block', marginBottom: '0.5rem' }}>Expansions:</strong>

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        aria-haspopup="listbox"
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
          {isOpen ? '▴' : '▾'}
        </span>
      </button>

      {/* Popover (Desktop) OR Bottom Sheet Modal (Mobile) */}
      {isOpen && (
        isMobile ? (
          /* Mobile Full-Width Bottom Sheet with Backdrop Scrim */
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
            }}
            onClick={e => {
              if (e.target === e.currentTarget) setIsOpen(false);
            }}
          >
            <div
              style={{
                backgroundColor: '#1e1e1e',
                borderTopLeftRadius: '16px',
                borderTopRightRadius: '16px',
                borderTop: '1px solid #444',
                maxHeight: '88vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.8)',
                padding: '0.75rem 1rem 1rem 1rem',
                boxSizing: 'border-box',
              }}
            >
              {/* Drag Handle Bar */}
              <div
                style={{
                  width: '40px',
                  height: '4px',
                  backgroundColor: '#555',
                  borderRadius: '2px',
                  margin: '0 auto 0.75rem auto',
                }}
              />

              {/* Modal Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.75rem',
                }}
              >
                <h3 style={{ margin: 0, color: '#fff', fontSize: '1.1rem' }}>
                  Filter Expansions {count > 0 && `(${count})`}
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
                  }}
                  aria-label="Close modal"
                >
                  ✕
                </button>
              </div>

              {/* Search Bar with Clear Icon */}
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

              {/* Quick Action Bulk Buttons */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
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
                    padding: '0.5rem',
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

              {/* Scrollable Checkbox List with 48px Thumb Touch Targets */}
              <div
                role="listbox"
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  marginBottom: '1rem',
                  overscrollBehavior: 'contain',
                }}
              >
                {filteredExpansions.length === 0 ? (
                  <div style={{ padding: '2rem 1rem', color: '#888', fontSize: '0.95rem', textAlign: 'center' }}>
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
                          minHeight: '48px',
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
                            width: '20px',
                            height: '20px',
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

              {/* Sticky Bottom Apply Button */}
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
                }}
              >
                Apply Filters {count > 0 && `(${count} Selected)`}
              </button>
            </div>
          </div>
        ) : (
          /* Desktop Anchored Popover Menu */
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              zIndex: 100,
              width: '320px',
              maxWidth: '90vw',
              backgroundColor: '#222',
              border: '1px solid #444',
              borderRadius: '8px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
              padding: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            {/* Search Input */}
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={`Search ${allExpansions.length} expansions...`}
              style={{
                padding: '0.4rem 0.6rem',
                borderRadius: '4px',
                border: '1px solid #555',
                backgroundColor: '#333',
                color: 'white',
                fontSize: '0.85rem',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={handleSelectAll}
                style={{
                  flex: 1,
                  padding: '0.3rem 0.5rem',
                  borderRadius: '4px',
                  border: '1px solid #555',
                  backgroundColor: '#333',
                  color: '#ccc',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                Select All
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                style={{
                  flex: 1,
                  padding: '0.3rem 0.5rem',
                  borderRadius: '4px',
                  border: '1px solid #555',
                  backgroundColor: '#333',
                  color: '#ccc',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                Clear
              </button>
            </div>

            {/* Scrollable Checkbox List */}
            <div
              role="listbox"
              style={{
                maxHeight: '240px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                paddingRight: '4px',
              }}
            >
              {filteredExpansions.length === 0 ? (
                <div style={{ padding: '0.75rem 0.5rem', color: '#888', fontSize: '0.85rem', textAlign: 'center' }}>
                  No expansions found
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
                        gap: '0.5rem',
                        padding: '0.35rem 0.5rem',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? 'rgba(76, 175, 80, 0.15)' : 'transparent',
                        color: isSelected ? '#4CAF50' : '#ddd',
                        fontSize: '0.85rem',
                        userSelect: 'none',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleExpansion(exp)}
                        style={{
                          accentColor: '#4CAF50',
                          cursor: 'pointer',
                        }}
                      />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {exp}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}
