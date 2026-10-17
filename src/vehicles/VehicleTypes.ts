export interface VehicleInput {
  throttle: number;    // 0 to 1
  brake: number;       // 0 to 1
  steer: number;       // -1 (left) to +1 (right)
  handbrake: boolean;  // space
  boost: boolean;      // Nitro / DRS
  shiftUp: boolean;    // Manual paddle up
  shiftDown: boolean;  // Manual paddle down
  toggleAuto: boolean; // Toggle M / A transmission
  reset: boolean;      // Reset upright on track
}

export interface VehicleTelemetry {
  speedKmh: number;
  rpm: number;
  gear: number;        // -1: R, 0: N, 1-6
  isAuto: boolean;
  throttle: number;
  brake: number;
  steer: number;
  gForceLat: number;   // In G units (-2.5g to +2.5g)
  gForceLong: number;  // In G units (-2.0g to +1.5g)
  boostLevel: number;  // 0 to 100%
  isBoosting: boolean;
  isBraking: boolean;
  slipRatio: number;   // 0 to 1
  onCurb: boolean;
  lapNumber: number;
  currentLapTime: number;
  lastLapTime: number;
  bestLapTime: number;
  currentSector: number; // 1, 2, or 3
  s1Delta: number | null;
  s2Delta: number | null;
  s3Delta: number | null;
  s1Status: 'none' | 'yellow' | 'green' | 'purple';
  s2Status: 'none' | 'yellow' | 'green' | 'purple';
  s3Status: 'none' | 'yellow' | 'green' | 'purple';
  trackProgress: number; // 0 to 1 along circuit
}

export interface CarVisualConfig {
  bodyColor: number;
  accentColor: number;
  glassColor?: number;
  rimColor?: number;
  caliperColor?: number;
  raceNumber: string;
}
