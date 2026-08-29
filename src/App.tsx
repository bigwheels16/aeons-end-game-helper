import { Toaster } from 'react-hot-toast';
import { useGameStore } from './store';
import ConfigScreen from './ConfigScreen';
import GameplayScreen from './GameplayScreen';

/**
 * Root Application Component.
 *
 * Manages view routing between the Setup Configuration screen and the Active Gameplay screen
 * based on the `isPlaying` state in the Zustand store.
 */
function App() {
  const isPlaying = useGameStore((state) => state.isPlaying);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {!isPlaying ? <ConfigScreen /> : <GameplayScreen />}
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
