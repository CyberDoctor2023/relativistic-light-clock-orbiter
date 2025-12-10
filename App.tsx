import React, { useState, useRef } from 'react';
import { SimulationCanvas } from './components/SimulationCanvas';
import { Controls } from './components/Controls';
import { RelativeView } from './components/RelativeView';
import { SimulationScenario } from './types';

const App: React.FC = () => {
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [orbitSpeed, setOrbitSpeed] = useState<number>(0.0);
  const [showTrail, setShowTrail] = useState<boolean>(true);
  const [scenario, setScenario] = useState<SimulationScenario>(SimulationScenario.EARTH_ORBIT);
  const [resetKey, setResetKey] = useState<number>(0);

  // Shared state to synchronize the photon position between the main simulation and the relative view
  const sharedSimState = useRef({ photonPhase: 0.5, photonDir: 1 });

  const handleTogglePlay = () => setIsRunning(!isRunning);
  
  const handleReset = () => {
    setIsRunning(false);
    setOrbitSpeed(0.0);
    setResetKey(prev => prev + 1);
    
    // Reset shared state
    sharedSimState.current = { photonPhase: 0.5, photonDir: 1 };

    setTimeout(() => setIsRunning(true), 100);
  };

  const handleScenarioChange = (s: SimulationScenario) => {
    setScenario(s);
  };

  const getTitle = () => {
    switch(scenario) {
      case SimulationScenario.LINEAR: return "LINEAR RELATIVITY";
      case SimulationScenario.EARTH_ORBIT: return "ORBITAL FRAME";
      case SimulationScenario.SOLAR_SYSTEM: return "HELIOCENTRIC";
      case SimulationScenario.GALAXY: return "GALACTIC SCALE";
      default: return "RELATIVISTIC CLOCK";
    }
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden text-white font-sans selection:bg-white/20">
      
      {/* Elegant HUD Header */}
      <div className="absolute top-8 left-8 z-10 pointer-events-none">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-1 h-12 bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.8)]" />
          <div>
             <h2 className="text-xs text-cyan-400 tracking-[0.3em] uppercase font-semibold mb-1">Simulation</h2>
             <h1 className="text-3xl md:text-5xl font-thin tracking-tighter text-white drop-shadow-2xl">
              {getTitle()}
             </h1>
          </div>
        </div>
        
        <div className="mt-4 max-w-sm pl-4 border-l border-white/10 text-white/60 text-sm leading-relaxed backdrop-blur-sm">
          <p>
            Visualize time dilation effects. The photon path appears <span className="text-cyan-300">straight</span> to the astronaut (Right) but <span className="text-amber-300">curved</span> to the observer (Main).
          </p>
        </div>
      </div>

      {/* Main Simulation */}
      <div key={resetKey} className="w-full h-full">
        <SimulationCanvas 
          isRunning={isRunning}
          orbitSpeedMultiplier={orbitSpeed}
          showTrail={showTrail}
          scenario={scenario}
          sharedSimState={sharedSimState}
        />
      </div>

      {/* Real-time 3D Relative View */}
      <RelativeView 
        isRunning={isRunning} 
        speed={orbitSpeed} 
        sharedSimState={sharedSimState}
      />

      {/* Controls */}
      <Controls 
        isRunning={isRunning}
        onTogglePlay={handleTogglePlay}
        speed={orbitSpeed}
        onSpeedChange={setOrbitSpeed}
        showTrail={showTrail}
        onToggleTrail={() => setShowTrail(!showTrail)}
        scenario={scenario}
        onScenarioChange={handleScenarioChange}
        onReset={handleReset}
      />
    </div>
  );
};

export default App;