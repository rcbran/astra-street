export type CircuitId = 'riviera' | 'forest' | 'marina';
export type Weather = 'sunset' | 'clear' | 'rain';
export type Quality = 'eco' | 'balanced' | 'ultra';
export type GameMode = 'race' | 'time-trial';
export type Phase =
  | 'loading'
  | 'menu'
  | 'countdown'
  | 'racing'
  | 'paused'
  | 'finished';
export interface Settings {
  quality: Quality;
  sound: boolean;
  camera: 'chase' | 'cockpit';
  assists: boolean;
}
export interface RaceOptions {
  circuit: CircuitId;
  weather: Weather;
  mode: GameMode;
}
export interface Telemetry {
  phase: Phase;
  speed: number;
  gear: number;
  rpm: number;
  lap: number;
  laps: number;
  lapTime: number;
  lastLap: number;
  bestLap: number;
  raceTime: number;
  position: number;
  racers: number;
  boost: number;
  boosting: boolean;
  score: number;
  chain: number;
  multiplier: number;
  drifting: boolean;
  progress: number;
  fps: number;
  frameMs: number;
  renderMs: number;
  gpuMs: number | null;
  pixelRatio: number;
  drawCalls: number;
  triangles: number;
  countdown: number;
  offTrack: boolean;
  brake: number;
  throttle: number;
  opponents: {
    progress: number;
    color: string;
    name: string;
    position: number;
  }[];
  message: string;
  quality: Quality;
  finishedPosition: number;
  newBest: boolean;
}
export const INITIAL_TELEMETRY: Telemetry = {
  phase: 'loading',
  speed: 0,
  gear: 1,
  rpm: 0,
  lap: 1,
  laps: 2,
  lapTime: 0,
  lastLap: 0,
  bestLap: 0,
  raceTime: 0,
  position: 8,
  racers: 8,
  boost: 100,
  boosting: false,
  score: 0,
  chain: 0,
  multiplier: 1,
  drifting: false,
  progress: 0,
  fps: 0,
  frameMs: 0,
  renderMs: 0,
  gpuMs: null,
  pixelRatio: 1,
  drawCalls: 0,
  triangles: 0,
  countdown: 3,
  offTrack: false,
  brake: 0,
  throttle: 0,
  opponents: [],
  message: '',
  quality: 'balanced',
  finishedPosition: 0,
  newBest: false,
};
export const DEFAULT_SETTINGS: Settings = {
  quality: 'balanced',
  sound: true,
  camera: 'chase',
  assists: true,
};
export function formatTime(seconds: number) {
  if (!seconds || !Number.isFinite(seconds)) return '—:——.———';
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds % 60).toFixed(3).padStart(6, '0')}`;
}
