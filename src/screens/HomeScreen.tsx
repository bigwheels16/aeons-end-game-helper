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
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const formatBuildTime = (isoString?: string): string => {
  const date = isoString ? new Date(isoString) : new Date();
  const validDate = isNaN(date.getTime()) ? new Date() : date;

  const day = String(validDate.getDate()).padStart(2, '0');
  const month = MONTHS[validDate.getMonth()];
  const year = validDate.getFullYear();

  let hours = validDate.getHours();
  const minutes = String(validDate.getMinutes()).padStart(2, '0');
  const seconds = String(validDate.getSeconds()).padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';

  hours = hours % 12 || 12;

  const timeZone = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' })
    .formatToParts(validDate)
    .find((part) => part.type === 'timeZoneName')?.value;

  const tzSuffix = timeZone ? ` ${timeZone}` : '';

  return `${day}-${month}-${year} ${hours}:${minutes}:${seconds} ${period}${tzSuffix}`;
};


const HomeScreen: React.FC<HomeScreenProps> = ({ onSelectTool }) => {
  const buttonStyle: React.CSSProperties = {
    padding: '1.5rem 2rem',
    fontSize: '1.25rem',
    backgroundColor: '#2b6cb0',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    width: '100%',
  };

  return (
    <div
      style={{
        padding: '2rem 1rem',
        textAlign: 'center',
        fontFamily: 'sans-serif',
        maxWidth: '480px',
        width: '100%',
        margin: '0 auto',
        boxSizing: 'border-box',
        overflowY: 'auto',
      }}
    >
      <h1>Aeon's End Tools</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'stretch' }}>
        <button
          onClick={() => onSelectTool('turn-order')}
          style={buttonStyle}
        >
          Turn Order Helper
        </button>
        <button
          onClick={() => onSelectTool('randomizer')}
          style={buttonStyle}
        >
          Supply Randomizer
        </button>
        <button
          onClick={() => onSelectTool('card-search')}
          style={buttonStyle}
        >
          Supply Card Search
        </button>
        <button
          onClick={() => onSelectTool('mage-search')}
          style={buttonStyle}
        >
          Mage Search
        </button>
        <button
          onClick={() => onSelectTool('nemesis-search')}
          style={buttonStyle}
        >
          Nemesis Search
        </button>
      </div>

      <div style={{ marginTop: '3rem', fontSize: '0.9rem', color: '#888' }}>
        Images and game information provided by <a href="https://aeonsend.wiki.gg/" target="_blank" rel="noopener noreferrer" style={{ color: '#2b6cb0', textDecoration: 'none' }}>https://aeonsend.wiki.gg/</a>
      </div>
      <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#666' }}>
        Last Updated at {formatBuildTime(import.meta.env.VITE_BUILD_TIME)}
      </div>

      <div style={{ marginTop: '2rem', fontSize: '0.75rem', color: '#777', lineHeight: 1.5, textAlign: 'center' }}>
        <p style={{ margin: '0 0 0.75rem 0' }}>
          Disclaimer: This tool is an unofficial, fan-made project and is not affiliated with, endorsed, or sponsored by Indie Boards & Cards or Action Phase Games.
        </p>
        <p style={{ margin: 0 }}>
          Aeon’s End and all associated logos, character names, card text, and artwork are trademarks and copyrights of Indie Boards & Cards. No copyright or trademark infringement is intended. All rights belong to their respective owners.
        </p>
      </div>
    </div>
  );
};

export default HomeScreen;

