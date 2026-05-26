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
    corner_label: str | None = None
    corner_hint: str | None = None
    official_corner_name: str | None = None
    corner_type: str
    confidence_score: float | None = None
    segmentation_quality: str | None = None
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
    lap_rank: int | None = None
    delta_to_best_seconds: float | None = None
    benchmark_summary: str | None = None
    coaching_focus: str | None = None
    braking_style: str
    throttle_style: str
    corner_profile: str
    consistency_score: float
    mistakes: list[str] = Field(default_factory=list)
    summary: str


class TelemetryBenchmarkRanking(BaseModel):
    series_key: str
    label: str
    driver: str
    overall_rank: int | None = None
    lap_delta_to_best: float | None = None
    braking_rank: int | None = None
    apex_rank: int | None = None
    exit_rank: int | None = None
    straight_line_rank: int | None = None
    consistency_rank: int | None = None
    main_loss_corner: str | None = None
    main_loss_seconds: float | None = None
    summary: str


class TelemetryPairCornerDelta(BaseModel):
    corner: str
    corner_label: str | None = None
    corner_type: str
    total_delta: float
    entry_delta: float
    apex_delta: float
    exit_delta: float
    braking_point_delta: float | None = None
    throttle_pickup_delta: float | None = None


class TelemetryPairDelta(BaseModel):
    reference_series_key: str
    reference_label: str
    comparison_series_key: str
    comparison_label: str
    lap_delta: float | None = None
    corner_deltas: list[TelemetryPairCornerDelta] = Field(default_factory=list)
    biggest_gain_corner: str | None = None
    biggest_loss_corner: str | None = None
    summary: str


class TelemetryTrackPoint(BaseModel):
    x: float
    y: float
    distance: float


class TelemetryTrackCorner(BaseModel):
    corner: str
    corner_label: str | None = None
    corner_hint: str | None = None
    official_corner_name: str | None = None
    corner_type: str
    confidence_score: float | None = None
    distance: float
    x: float
    y: float


class TelemetryTrackMap(BaseModel):
    points: list[TelemetryTrackPoint] = Field(default_factory=list)
    corners: list[TelemetryTrackCorner] = Field(default_factory=list)


class TelemetryCacheMetadata(BaseModel):
    cache_hit: bool = False
    cache_key: str | None = None
    generated_at: str | None = None
    series_count: int = 0
    unavailable_reason: str | None = None
    diagnostics: list[str] = Field(default_factory=list)


class TelemetryResponse(BaseModel):
    series: list[TelemetrySeries]
    metrics: list[TelemetryDriverMetrics]
    available_drivers: list[str]
    lap_options: list[TelemetryLapOption] = Field(default_factory=list)
    micro_sectors: list[TelemetryMicroSector] = Field(default_factory=list)
    corner_breakdown: list[TelemetryCornerBreakdown] = Field(default_factory=list)
    performance: list[TelemetryPerformanceSummary] = Field(default_factory=list)
    benchmark_rankings: list[TelemetryBenchmarkRanking] = Field(default_factory=list)
    pair_deltas: list[TelemetryPairDelta] = Field(default_factory=list)
    track_map: TelemetryTrackMap = Field(default_factory=TelemetryTrackMap)
    cache_metadata: TelemetryCacheMetadata = Field(default_factory=TelemetryCacheMetadata)
    source: str = "fastf1"
    notice: str | None = None
    unavailable_reason: str | None = None
    weather: str | None = None
    session_summary: str | None = None
    insights: list[str] = Field(default_factory=list)


class TelemetryQuery(BaseModel):
    drivers: list[str] = Field(default_factory=list)
    lap_selections: list[str] = Field(default_factory=list)
