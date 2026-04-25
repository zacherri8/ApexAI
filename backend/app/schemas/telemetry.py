from pydantic import BaseModel, Field


class TelemetryPoint(BaseModel):
    distance: float
    speed: float
    throttle: float
    brake: float
    gear: int


class TelemetrySeries(BaseModel):
    driver: str
    team: str
    points: list[TelemetryPoint]


class TelemetryResponse(BaseModel):
    series: list[TelemetrySeries]
    available_drivers: list[str]
    source: str = "fastf1"
    notice: str | None = None


class TelemetryQuery(BaseModel):
    drivers: list[str] = Field(default_factory=list)
