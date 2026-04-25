import { DriverPosition, ReplayDataset, ReplayDriver, ReplayFrame, TrackPoint } from "@/types/replay";
import { getReplayDataset } from "@/services/api";

const mockDrivers: ReplayDriver[] = [
  { id: "NOR", code: "NOR", name: "Lando Norris", team: "McLaren", color: "#ff8700" },
  { id: "VER", code: "VER", name: "Max Verstappen", team: "Red Bull", color: "#3671c6" },
  { id: "LEC", code: "LEC", name: "Charles Leclerc", team: "Ferrari", color: "#e10600" },
  { id: "HAM", code: "HAM", name: "Lewis Hamilton", team: "Mercedes", color: "#00d2be" },
  { id: "PIA", code: "PIA", name: "Oscar Piastri", team: "McLaren", color: "#ffab40" },
  { id: "RUS", code: "RUS", name: "George Russell", team: "Mercedes", color: "#8df5e4" },
];

const mockTrackPoints: TrackPoint[] = [
  { x: 0.16, y: 0.58 },
  { x: 0.22, y: 0.28 },
  { x: 0.47, y: 0.18 },
  { x: 0.77, y: 0.22 },
  { x: 0.9, y: 0.42 },
  { x: 0.78, y: 0.7 },
  { x: 0.52, y: 0.82 },
  { x: 0.28, y: 0.78 },
];

function interpolateTrackPoint(points: TrackPoint[], progress: number): TrackPoint {
  const normalizedProgress = ((progress % 1) + 1) % 1;
  const scaled = normalizedProgress * points.length;
  const index = Math.floor(scaled);
  const nextIndex = (index + 1) % points.length;
  const ratio = scaled - index;
  const current = points[index];
  const next = points[nextIndex];

  return {
    x: current.x + (next.x - current.x) * ratio,
    y: current.y + (next.y - current.y) * ratio,
  };
}

function buildMockFrames(durationMs: number, intervalMs: number): ReplayFrame[] {
  const frames: ReplayFrame[] = [];
  const totalFrames = Math.floor(durationMs / intervalMs);

  for (let frameIndex = 0; frameIndex <= totalFrames; frameIndex += 1) {
    const timestamp = frameIndex * intervalMs;
    const baseProgress = timestamp / durationMs;
    const positions: DriverPosition[] = mockDrivers.map((driver, driverIndex) => {
      const driverOffset = driverIndex * 0.028;
      const phase = baseProgress + driverOffset + Math.sin(baseProgress * Math.PI * 2 + driverIndex) * 0.004;
      const trackPoint = interpolateTrackPoint(mockTrackPoints, phase);

      return {
        driverId: driver.id,
        timestamp,
        x: trackPoint.x,
        y: trackPoint.y,
        lap: Math.floor(phase * 3) + 1,
        position: driverIndex + 1,
        speedKph: Math.round(275 + Math.sin(phase * Math.PI * 6) * 42 - driverIndex * 2),
      };
    });

    frames.push({ timestamp, positions });
  }

  return frames;
}

export function getMockReplayDataset(): ReplayDataset {
  const durationMs = 90_000;
  return {
    id: "mock-silverstone-2025",
    eventName: "Silverstone Grand Prix Replay",
    season: 2025,
    source: "mock",
    telemetryAvailable: false,
    notice: "Mock replay dataset used because authenticated FastF1 data was not available.",
    durationMs,
    track: {
      id: "silverstone-lite",
      name: "Silverstone telemetry map",
      points: mockTrackPoints,
    },
    drivers: mockDrivers,
    frames: buildMockFrames(durationMs, 1_000),
  };
}

export async function loadReplayDataset(
  token?: string,
  options: { year?: number; grandPrix?: string; session?: string; drivers?: number } = {},
): Promise<ReplayDataset> {
  if (!token) {
    return getMockReplayDataset();
  }

  try {
    return await getReplayDataset(
      {
        year: options.year ?? 2025,
        grandPrix: options.grandPrix ?? "Monza",
        session: options.session ?? "R",
        ...(options.drivers ? { drivers: options.drivers } : {}),
      },
      token,
    );
  } catch (error) {
    console.warn("Replay API failed; returning an unavailable FastF1 state instead of mock telemetry.", error);
    const year = options.year ?? new Date().getFullYear();
    const grandPrix = options.grandPrix ?? "Selected Grand Prix";
    const session = options.session ?? "R";
    return {
      id: `frontend-unavailable-${year}-${grandPrix}-${session}`.toLowerCase().replace(/\s+/g, "-"),
      eventName: `${grandPrix} ${year} ${session} replay unavailable`,
      season: year,
      source: "fastf1-unavailable",
      telemetryAvailable: false,
      notice: "The replay request failed before FastF1 telemetry could be loaded. Try the same session again after the backend finishes caching.",
      durationMs: 0,
      track: {
        id: "unavailable-track",
        name: "No FastF1 track position data",
        points: [],
      },
      drivers: [],
      frames: [],
    };
  }
}
