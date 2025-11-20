export interface Point {
  x: number;
  y: number;
}

export interface SimulationConfig {
  orbitSpeed: number;
  lightSpeed: number;
  trailLength: number;
  orbitRadius: number;
}

export enum SimulationScenario {
  LINEAR = 'LINEAR',
  EARTH_ORBIT = 'EARTH_ORBIT',
  SOLAR_SYSTEM = 'SOLAR_SYSTEM',
  GALAXY = 'GALAXY'
}

export enum ViewMode {
  EARTH_OBSERVER = 'EARTH_OBSERVER',
  ASTRONAUT_FRAME = 'ASTRONAUT_FRAME'
}