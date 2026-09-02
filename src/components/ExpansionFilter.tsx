

interface ExpansionFilterProps {
  allExpansions: string[];
  selectedExpansions: string[];
  onToggleExpansion: (expansion: string) => void;
}

export default function ExpansionFilter({
  allExpansions,
  selectedExpansions,
  onToggleExpansion,
}: ExpansionFilterProps) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <strong style={{ color: '#ccc' }}>Expansions:</strong>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
        {allExpansions.map(exp => (
          <button
            key={exp}
            onClick={() => onToggleExpansion(exp)}
            style={{
              padding: '0.25rem 0.75rem',
              borderRadius: '16px',
              border: selectedExpansions.includes(exp) ? '1px solid #4CAF50' : '1px solid #555',
              backgroundColor: selectedExpansions.includes(exp) ? 'rgba(76, 175, 80, 0.2)' : '#222',
              color: selectedExpansions.includes(exp) ? '#fff' : '#ccc',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {exp}
          </button>
        ))}
      </div>
    </div>
  );
}
