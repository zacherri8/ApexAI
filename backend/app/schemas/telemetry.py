from pydantic import BaseModel, Field


class TelemetryPoint(BaseModel):
    time: float
    distance: float
    speed: float
    throttle: float
    brake: float
    gear: int
    drs: int | None = None
    rpm: int | None = None
    steering: float | None = None


class TelemetrySeries(BaseModel):
    series_key: str
    label: str
    driver: str
    team: str
    color: str
    lap_number: int | None = None
    lap_time_seconds: float | None = None
    compound: str | None = None
    is_reference: bool = False
    points: list[TelemetryPoint]


class TelemetryDriverMetrics(BaseModel):
    series_key: str
    label: str
    driver: str
    team: str
    color: str
    lap_number: int | None = None
    compound: str | None = None
    tyre_life: int | None = None
    fastest_lap_seconds: float | None = None
    sector_1_seconds: float | None = None
    sector_2_seconds: float | None = None
    sector_3_seconds: float | None = None
    top_speed: float
    average_speed: float
    average_throttle: float
    brake_pct: float
    drs_pct: float | None = None
    top_rpm: int | None = None
    average_rpm: float | None = None
    gear_changes: int


class TelemetryLapOption(BaseModel):
    driver: str
    lap_number: int
    lap_time_seconds: float
    compound: str | None = None
    tyre_life: int | None = None
    is_best: bool = False


class TelemetryMicroSector(BaseModel):
    series_key: str
    label: str
    driver: str
    segment: int
    start_distance: float
    end_distance: float
    time_seconds: float
    delta_to_best: float
    corner_type: str


class TelemetryCornerBreakdown(BaseModel):
    corner: str
    corner_type: str
    start_distance: float
    apex_distance: float
    end_distance: float
    entry_delta: dict[str, float]
    apex_delta: dict[str, float]
    exit_delta: dict[str, float]
    braking_points: dict[str, float]
    throttle_pickups: dict[str, float]


class TelemetryPerformanceSummary(BaseModel):
    series_key: str
    label: str
    driver: str
    braking_style: str
    throttle_style: str
    corner_profile: str
    consistency_score: float
    mistakes: list[str] = Field(default_factory=list)
    summary: str


class TelemetryResponse(BaseModel):
    series: list[TelemetrySeries]
    metrics: list[TelemetryDriverMetrics]
    available_drivers: list[str]
    lap_options: list[TelemetryLapOption] = Field(default_factory=list)
    micro_sectors: list[TelemetryMicroSector] = Field(default_factory=list)
    corner_breakdown: list[TelemetryCornerBreakdown] = Field(default_factory=list)
    performance: list[TelemetryPerformanceSummary] = Field(default_factory=list)
    source: str = "fastf1"
    notice: str | None = None
    weather: str | None = None
    session_summary: str | None = None
    insights: list[str] = Field(default_factory=list)


class TelemetryQuery(BaseModel):
    drivers: list[str] = Field(default_factory=list)
    lap_selections: list[str] = Field(default_factory=list)
