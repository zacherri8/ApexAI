export type ReplaySpeed = 0.5 | 1 | 2 | 4;

export type ReplayDriver = {
  id: string;
  code: string;
  name: string;
  team: string;
  color: string;
};

export type DriverPosition = {
  driverId: string;
  timestamp: number;
  x: number;
  y: number;
  lap: number;
  position: number;
  speedKph?: number;
};

export type ReplayFrame = {
  timestamp: number;
  positions: DriverPosition[];
};

export type TrackPoint = {
  x: number;
  y: number;
};

export type ReplayTrack = {
  id: string;
  name: string;
  points: TrackPoint[];
};

export type ReplayDataset = {
  id: string;
  eventName: string;
  season: number;
  source: string;
  telemetryAvailable: boolean;
  notice?: string | null;
  durationMs: number;
  track: ReplayTrack;
  drivers: ReplayDriver[];
  frames: ReplayFrame[];
};

export type ReplaySnapshot = {
  timestamp: number;
  progress: number;
  positions: DriverPosition[];
};

export type ReplayState = {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  speed: ReplaySpeed;
};
