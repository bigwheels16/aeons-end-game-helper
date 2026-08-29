import React from 'react';
import { useGameStore, VisibilityOption } from './store';
import { GameOptionsForm, GameOptionsData } from './GameOptionsForm';

/**
 * Configuration Screen Component.
 */
const ConfigScreen: React.FC = () => {
  const store = useGameStore();

  const handleStart = () => {
    store.startGame();
    store.nextTurn();
  };

  const handleOptionsChange = (options: GameOptionsData) => {
    store.setPlayerCount(options.playerCount);
    store.setAllowConsecutiveNemesis(options.allowConsecutiveNemesis);
    store.setAllowConsecutivePlayer(options.allowConsecutivePlayer);
    store.setVisibilityOption(options.visibilityOption);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '400px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <h1 style={{ textAlign: 'center' }}>Aeon's End Setup</h1>
      
      <div style={{ marginBottom: '30px' }}>
        <GameOptionsForm 
          options={{
            playerCount: store.playerCount,
            allowConsecutiveNemesis: store.allowConsecutiveNemesis,
            allowConsecutivePlayer: store.allowConsecutivePlayer,
            visibilityOption: store.visibilityOption,
          }}
          onChange={handleOptionsChange}
        />
      </div>

      <button
        onClick={handleStart}
        style={{
          width: '100%',
          padding: '20px',
          backgroundColor: '#2196F3',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '20px',
          fontWeight: 'bold'
        }}
      >
        START GAME
      </button>
    </div>
  );
};

export default ConfigScreen;
