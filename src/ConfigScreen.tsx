import { useGameStore, VisibilityOption } from './store';

/**
 * Configuration Screen Component.
 *
 * Allows the user to configure game parameters before starting:
 * - Player count selection (1, 2, 3, or 4 players)
 * - Nemesis rules toggle ("Allow consecutive Nemesis turns")
 * - Turn visibility options (Current only, Current + Next, All following)
 * - Start game action to initialize the deck and begin Round 1
 */
const ConfigScreen: React.FC = () => {
  const {
    playerCount,
    setPlayerCount,
    allowConsecutiveNemesis,
    setAllowConsecutiveNemesis,
    allowConsecutivePlayer,
    setAllowConsecutivePlayer,
    visibilityOption,
    setVisibilityOption,
    startGame,
    nextTurn
  } = useGameStore();

  const handleStart = () => {
    startGame();
    nextTurn();
  };

  return (
    <div style={{ padding: '20px', maxWidth: '400px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <h1 style={{ textAlign: 'center' }}>Aeon's End Setup</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <h3>Player Count</h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          {[1, 2, 3, 4].map(num => (
            <button
              key={num}
              onClick={() => setPlayerCount(num)}
              style={{
                flex: 1,
                padding: '15px 0',
                backgroundColor: playerCount === num ? '#4CAF50' : '#333',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '18px'
              }}
            >
              {num}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>Game Options</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '16px', marginBottom: '10px' }}>
          <input
            type="checkbox"
            checked={allowConsecutiveNemesis}
            onChange={(e) => setAllowConsecutiveNemesis(e.target.checked)}
            style={{ width: '20px', height: '20px' }}
          />
          Allow consecutive Nemesis turns
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '16px' }}>
          <input
            type="checkbox"
            checked={allowConsecutivePlayer}
            onChange={(e) => setAllowConsecutivePlayer(e.target.checked)}
            style={{ width: '20px', height: '20px' }}
          />
          Allow consecutive turns of same player
        </label>
      </div>

      <div style={{ marginBottom: '30px' }}>
        <h3>Visibility Options</h3>
        <select
          value={visibilityOption}
          onChange={(e) => setVisibilityOption(e.target.value as VisibilityOption)}
          style={{ width: '100%', padding: '15px', fontSize: '16px', backgroundColor: '#333', color: 'white', border: 'none', borderRadius: '8px' }}
        >
          <option value="current">Show only current turn</option>
          <option value="next">Show current and next turn</option>
          <option value="all">Show all turns</option>
        </select>
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
