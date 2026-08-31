import React from 'react';
import { VisibilityOption } from './store';

export const OptionCard: React.FC<{ title: string; active: boolean; onClick: () => void }> = ({ title, active, onClick }) => (
  <div onClick={onClick} style={{
    flex: 1,
    padding: '15px 10px',
    border: active ? '2px solid #4CAF50' : '2px solid #555',
    backgroundColor: active ? 'rgba(76, 175, 80, 0.2)' : '#222',
    color: active ? '#fff' : '#ccc',
    borderRadius: '8px',
    cursor: 'pointer',
    textAlign: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
    userSelect: 'none'
  }}>
    {title}
  </div>
);

export interface GameOptionsData {
  playerCount: number | 'custom';
  allowConsecutiveNemesis: boolean;
  allowConsecutivePlayer: boolean;
  visibilityOption: VisibilityOption;
}

interface GameOptionsFormProps {
  options: GameOptionsData;
  onChange: (options: GameOptionsData) => void;
}

export const GameOptionsForm: React.FC<GameOptionsFormProps> = ({ options, onChange }) => {
  const updateOption = <K extends keyof GameOptionsData>(key: K, value: GameOptionsData[K]) => {
    onChange({ ...options, [key]: value });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' }}>
      <div>
        <h4 style={{ margin: '0 0 10px 0', color: 'inherit' }}>Player Count</h4>
        <div style={{ display: 'flex', gap: '10px' }}>
          {([1, 2, 3, 4, 'Custom'] as const).map(opt => (
            <OptionCard 
              key={opt} 
              title={`${opt}`} 
              active={options.playerCount === (opt === 'Custom' ? 'custom' : opt)} 
              onClick={() => {
                if (opt === 'Custom') {
                  updateOption('playerCount', 'custom');
                  window.location.hash = 'custom-deck-builder';
                } else {
                  updateOption('playerCount', opt);
                }
              }} 
            />
          ))}
        </div>
      </div>

      <div>
        <h4 style={{ margin: '0 0 10px 0', color: 'inherit' }} title="Toggle whether the Nemesis or the same Player can take multiple turns in a row.">
          Consecutive Turns <span style={{ fontSize: '0.8em', color: '#888', cursor: 'help' }}>ⓘ</span>
        </h4>
        <div style={{ display: 'flex', gap: '10px' }}>
          <OptionCard 
            title="Nemesis" 
            active={options.allowConsecutiveNemesis} 
            onClick={() => updateOption('allowConsecutiveNemesis', !options.allowConsecutiveNemesis)} 
          />
          <OptionCard 
            title="Same Player" 
            active={options.allowConsecutivePlayer} 
            onClick={() => updateOption('allowConsecutivePlayer', !options.allowConsecutivePlayer)} 
          />
        </div>
      </div>

      <div>
        <h4 style={{ margin: '0 0 10px 0', color: 'inherit' }} title="Control which upcoming turn cards are revealed to the players.">
          Card Visibility <span style={{ fontSize: '0.8em', color: '#888', cursor: 'help' }}>ⓘ</span>
        </h4>
        <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
          <OptionCard 
            title="Current turn" 
            active={options.visibilityOption === 'current'} 
            onClick={() => updateOption('visibilityOption', 'current')} 
          />
          <OptionCard 
            title="Current and next turn" 
            active={options.visibilityOption === 'next'} 
            onClick={() => updateOption('visibilityOption', 'next')} 
          />
          <OptionCard 
            title="All turns" 
            active={options.visibilityOption === 'all'} 
            onClick={() => updateOption('visibilityOption', 'all')} 
          />
        </div>
      </div>
    </div>
  );
};
