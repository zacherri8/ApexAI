import {
  DriverPosition,
  ReplayDataset,
  ReplaySnapshot,
  ReplaySpeed,
} from "@/types/replay";

export function clampReplayTime(time: number, duration: number): number {
  return Math.min(Math.max(time, 0), duration);
}

export function interpolateValue(start: number, end: number, ratio: number): number {
  return start + (end - start) * ratio;
}

function clonePosition(position: DriverPosition, timestamp: number): DriverPosition {
  return {
    ...position,
    timestamp,
  };
}

export function interpolateDriverPosition(
  before: DriverPosition,
  after: DriverPosition,
  timestamp: number,
): DriverPosition {
  const delta = after.timestamp - before.timestamp;
  if (delta <= 0) {
    return clonePosition(after, timestamp);
  }

  const ratio = (timestamp - before.timestamp) / delta;
  return {
    ...before,
    timestamp,
    x: interpolateValue(before.x, after.x, ratio),
    y: interpolateValue(before.y, after.y, ratio),
    lap: ratio < 0.5 ? before.lap : after.lap,
    position: ratio < 0.5 ? before.position : after.position,
    speedKph:
      before.speedKph !== undefined && after.speedKph !== undefined
        ? interpolateValue(before.speedKph, after.speedKph, ratio)
        : before.speedKph,
  };
}

export function getReplaySnapshot(dataset: ReplayDataset, timestamp: number): ReplaySnapshot {
  const currentTime = clampReplayTime(timestamp, dataset.durationMs);
  const frames = dataset.frames;

  if (!frames.length) {
    return { timestamp: currentTime, progress: 0, positions: [] };
  }

  let nextFrameIndex = frames.findIndex((frame) => frame.timestamp >= currentTime);
  if (nextFrameIndex === -1) {
    nextFrameIndex = frames.length - 1;
  }

  const previousFrame = frames[Math.max(0, nextFrameIndex - 1)];
  const nextFrame = frames[nextFrameIndex];
  const previousByDriver = new Map(previousFrame.positions.map((position) => [position.driverId, position]));

  const positions = nextFrame.positions.map((nextPosition) => {
    const previousPosition = previousByDriver.get(nextPosition.driverId);
    if (!previousPosition || previousPosition.timestamp === nextPosition.timestamp) {
      return clonePosition(nextPosition, currentTime);
    }
    return interpolateDriverPosition(previousPosition, nextPosition, currentTime);
  });

  return {
    timestamp: currentTime,
    progress: dataset.durationMs > 0 ? currentTime / dataset.durationMs : 0,
    positions,
  };
}

export class ReplayClock {
  private currentTime: number;
  private lastFrameTime = 0;
  private duration: number;
  private speed: ReplaySpeed;

  constructor(duration: number, initialSpeed: ReplaySpeed = 1) {
    this.currentTime = 0;
    this.duration = duration;
    this.speed = initialSpeed;
  }

  get time(): number {
    return this.currentTime;
  }

  setSpeed(speed: ReplaySpeed): void {
    this.speed = speed;
  }

  seek(time: number): void {
    this.currentTime = clampReplayTime(time, this.duration);
    this.lastFrameTime = 0;
  }

  reset(): void {
    this.seek(0);
  }

  tick(now: number): number {
    if (!this.lastFrameTime) {
      this.lastFrameTime = now;
      return this.currentTime;
    }

    const elapsed = now - this.lastFrameTime;
    this.lastFrameTime = now;
    this.currentTime = clampReplayTime(this.currentTime + elapsed * this.speed, this.duration);
    return this.currentTime;
  }
}
