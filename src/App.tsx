import { Toaster } from 'react-hot-toast';
import { useGameStore } from './store';
import ConfigScreen from './ConfigScreen';
import GameplayScreen from './GameplayScreen';
import HomeScreen from './HomeScreen';
import CardSearchScreen from './CardSearchScreen';
import MageSearchScreen from './MageSearchScreen';
import NemesisSearchScreen from './NemesisSearchScreen';

import { useEffect, useState } from 'react';

/**
 * Root Application Component.
 *
 * Manages top-level navigation between the Home Screen tool hub, the Turn Order Helper
 * (handling Setup Configuration and Active Gameplay states), and the Card Search tool,
 * alongside device wake lock handling and global toast notifications.
 */
function App() {
  const isPlaying = useGameStore((state) => state.isPlaying);
  
  const getToolFromHash = () => window.location.hash.replace(/^#/, '') || null;
  const [activeTool, setActiveToolState] = useState<string | null>(getToolFromHash());

  useEffect(() => {
    const handleHashChange = () => setActiveToolState(getToolFromHash());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const setActiveTool = (tool: string | null) => {
    window.location.hash = tool || '';
    setActiveToolState(tool);
  };

  useEffect(() => {
    let wakeLock: any = null;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch (err) {
        console.warn('Wake Lock request failed:', err);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    requestWakeLock();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock) {
        wakeLock.release().catch(() => {});
      }
    };
  }, []);

  let content;
  if (activeTool === null) {
    content = <HomeScreen onSelectTool={setActiveTool} />;
  } else if (activeTool === 'turn-order') {
    content = !isPlaying ? <ConfigScreen /> : <GameplayScreen />;
  } else if (activeTool === 'card-search') {
    content = <CardSearchScreen />;
  } else if (activeTool === 'mage-search') {
    content = <MageSearchScreen />;
  } else if (activeTool === 'nemesis-search') {
    content = <NemesisSearchScreen />;
  } else {
    content = <div>Unknown tool selected</div>;
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {activeTool !== null && (
        <div style={{ padding: '0.5rem', background: '#222', borderBottom: '1px solid #555', textAlign: 'left' }}>
          <button onClick={() => setActiveTool(null)} style={{ padding: '0.25rem 0.5rem', cursor: 'pointer', background: '#333', color: 'white', border: '1px solid #555', borderRadius: '4px' }}>
            &larr; Back to Tools
          </button>
        </div>
      )}
      {content}
      <Toaster 
        position="top-center" 
        toastOptions={{ duration: 3000 }} 
        containerStyle={{
          top: '50%',
          bottom: 'auto',
          transform: 'translateY(-50%)'
        }}
      />
    </div>
  );
}

export default App;
