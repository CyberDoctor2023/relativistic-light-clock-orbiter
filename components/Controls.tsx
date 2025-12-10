import React from 'react';
import { SimulationScenario } from '../types';

interface ControlsProps {
  isRunning: boolean;
  onTogglePlay: () => void;
  speed: number;
  onSpeedChange: (val: number) => void;
  showTrail: boolean;
  onToggleTrail: () => void;
  scenario: SimulationScenario;
  onScenarioChange: (s: SimulationScenario) => void;
  onReset: () => void;
}

export const Controls: React.FC<ControlsProps> = ({
  isRunning,
  onTogglePlay,
  speed,
  onSpeedChange,
  showTrail,
  onToggleTrail,
  scenario,
  onScenarioChange,
  onReset
}) => {
  
  // Calculate Lorentz Factor (Gamma)
  // gamma = 1 / sqrt(1 - v^2/c^2)
  // speed is v/c (0 to 0.99)
  const gamma = 1 / Math.sqrt(1 - (speed * speed));
  const timeDilationRatio = gamma.toFixed(2);

  return (
    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-6 z-20 w-[90vw] max-w-3xl">
      
      {/* Scenario Selector - Glass Pill */}
      <div className="flex p-1 bg-black/80 backdrop-blur-md border border-white/10 rounded-full shadow-lg">
        {[
          { id: SimulationScenario.LINEAR, label: 'LINEAR' },
          { id: SimulationScenario.EARTH_ORBIT, label: 'ORBIT' },
          { id: SimulationScenario.SOLAR_SYSTEM, label: 'SOLAR' },
          { id: SimulationScenario.GALAXY, label: 'GALAXY' },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => onScenarioChange(item.id)}
            className={`px-6 py-2 text-[10px] font-bold tracking-widest transition-all rounded-full ${
              scenario === item.id
                ? 'bg-white/10 text-cyan-300 border border-white/10 shadow-[0_0_10px_rgba(0,255,255,0.2)]'
                : 'text-white/40 hover:text-white hover:bg-white/5'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Main Control Panel */}
      <div className="flex items-center gap-8 px-10 py-5 bg-black/80 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl">
        
        {/* Play/Pause */}
        <button
          onClick={onTogglePlay}
          className="group flex items-center justify-center w-12 h-12 rounded-full border border-white/10 hover:border-cyan-400 hover:bg-cyan-500/10 text-white transition-all"
        >
          {isRunning ? (
             <svg className="w-4 h-4 fill-current group-hover:fill-cyan-400" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
          ) : (
             <svg className="w-4 h-4 fill-current ml-0.5 group-hover:fill-cyan-400" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>
          )}
        </button>

        <div className="h-6 w-px bg-white/10" />

        {/* Speed Control */}
        <div className="flex flex-col w-48 gap-2">
          <div className="flex justify-between items-end text-[9px] uppercase tracking-widest font-mono">
            <span className="text-cyan-500/70">Time Dilation</span>
            <span className="text-white">{(speed * 100).toFixed(0)}% c</span>
          </div>
          <input
            type="range"
            min="0"
            max="0.99"
            step="0.01"
            value={speed}
            onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
            className="w-full h-0.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-cyan-400"
          />
          <div className="flex justify-between text-[9px] font-mono text-white/40">
             <span>Normal</span>
             <span className={speed > 0.1 ? 'text-amber-400' : ''}>Slowed: {timeDilationRatio}x</span>
          </div>
        </div>

        <div className="h-6 w-px bg-white/10" />

        {/* Trail Toggle */}
        <button 
           onClick={onToggleTrail}
           className={`text-[10px] uppercase tracking-widest font-bold transition-colors hover:text-white ${showTrail ? 'text-cyan-400' : 'text-white/30'}`}
        >
           {showTrail ? 'Hide Path' : 'Show Path'}
        </button>

        {/* Reset */}
        <button onClick={onReset} className="text-white/30 hover:text-white transition-colors" title="Reset System">
           <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        </button>
      </div>
    </div>
  );
};