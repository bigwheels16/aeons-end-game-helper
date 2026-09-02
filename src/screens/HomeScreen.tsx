import React from 'react';

interface HomeScreenProps {
  onSelectTool: (tool: string) => void;
}

/**
 * Home Screen Component.
 *
 * Serves as the central navigation hub for selecting available Aeon's End tools
 * (Turn Order Helper and Card Search).
 */
const HomeScreen: React.FC<HomeScreenProps> = ({ onSelectTool }) => {
  return (
    <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1>Aeon's End Tools</h1>
      <p style={{ marginBottom: '2rem', color: '#555' }}>
        Select a tool to use for your game:
      </p>
      
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={() => onSelectTool('turn-order')}
          style={{
            padding: '1.5rem 2rem',
            fontSize: '1.25rem',
            backgroundColor: '#2b6cb0',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            
          }}
        >
          Turn Order Helper
        </button>
        <button
          onClick={() => onSelectTool('card-search')}
          style={{
            padding: '1.5rem 2rem',
            fontSize: '1.25rem',
            backgroundColor: '#2b6cb0',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            
          }}
        >
          Card Search
        </button>
        <button
          onClick={() => onSelectTool('mage-search')}
          style={{
            padding: '1.5rem 2rem',
            fontSize: '1.25rem',
            backgroundColor: '#2b6cb0',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            
          }}
        >
          Mage Search
        </button>
        <button
          onClick={() => onSelectTool('nemesis-search')}
          style={{
            padding: '1.5rem 2rem',
            fontSize: '1.25rem',
            backgroundColor: '#2b6cb0',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            
          }}
        >
          Nemesis Search
        </button>
      </div>

      <div style={{ marginTop: '3rem', fontSize: '0.9rem', color: '#888' }}>
        Images provided by: <a href="https://aeonsend.wiki.gg/" target="_blank" rel="noopener noreferrer" style={{ color: '#2b6cb0', textDecoration: 'none' }}>https://aeonsend.wiki.gg/</a>
      </div>
      <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#666' }}>
        Last Updated at: {import.meta.env.VITE_BUILD_TIME || 'Local Dev'}
      </div>
    </div>
  );
};

export default HomeScreen;

