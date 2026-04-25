from pydantic import BaseModel


class ReplayDriver(BaseModel):
    id: str
    code: str
    name: str
    team: str
    color: str


class DriverPosition(BaseModel):
    driverId: str
    timestamp: float
    x: float
    y: float
    lap: int
    position: int
    speedKph: float | None = None


class ReplayFrame(BaseModel):
    timestamp: float
    positions: list[DriverPosition]


class TrackPoint(BaseModel):
    x: float
    y: float


class ReplayTrack(BaseModel):
    id: str
    name: str
    points: list[TrackPoint]


class ReplayDataset(BaseModel):
    id: str
    eventName: str
    season: int
    source: str
    telemetryAvailable: bool
    notice: str | None = None
    durationMs: float
    track: ReplayTrack
    drivers: list[ReplayDriver]
    frames: list[ReplayFrame]
