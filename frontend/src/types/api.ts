export type TelemetryPoint = {
  time: number;
  distance: number;
  speed: number;
  throttle: number;
  brake: number;
  gear: number;
  drs?: number | null;
  rpm?: number | null;
  steering?: number | null;
};

export type TelemetrySeries = {
  series_key: string;
  label: string;
  driver: string;
  team: string;
  color: string;
  lap_number?: number | null;
  lap_time_seconds?: number | null;
  compound?: string | null;
  is_reference: boolean;
  points: TelemetryPoint[];
};

export type TelemetryDriverMetrics = {
  series_key: string;
  label: string;
  driver: string;
  team: string;
  color: string;
  lap_number?: number | null;
  compound?: string | null;
  tyre_life?: number | null;
  fastest_lap_seconds?: number | null;
  sector_1_seconds?: number | null;
  sector_2_seconds?: number | null;
  sector_3_seconds?: number | null;
  top_speed: number;
  average_speed: number;
  average_throttle: number;
  brake_pct: number;
  drs_pct?: number | null;
  top_rpm?: number | null;
  average_rpm?: number | null;
  gear_changes: number;
};

export type TelemetryLapOption = {
  driver: string;
  lap_number: number;
  lap_time_seconds: number;
  compound?: string | null;
  tyre_life?: number | null;
  is_best: boolean;
};

export type TelemetryMicroSector = {
  series_key: string;
  label: string;
  driver: string;
  segment: number;
  start_distance: number;
  end_distance: number;
  time_seconds: number;
  delta_to_best: number;
  corner_type: string;
};

export type TelemetryCornerBreakdown = {
  corner: string;
  corner_label?: string | null;
  corner_hint?: string | null;
  official_corner_name?: string | null;
  corner_type: string;
  confidence_score?: number | null;
  segmentation_quality?: string | null;
  start_distance: number;
  apex_distance: number;
  end_distance: number;
  entry_delta: Record<string, number>;
  apex_delta: Record<string, number>;
  exit_delta: Record<string, number>;
  braking_points: Record<string, number>;
  throttle_pickups: Record<string, number>;
};

export type TelemetryPerformanceSummary = {
  series_key: string;
  label: string;
  driver: string;
  lap_rank?: number | null;
  delta_to_best_seconds?: number | null;
  benchmark_summary?: string | null;
  coaching_focus?: string | null;
  braking_style: string;
  throttle_style: string;
  corner_profile: string;
  consistency_score: number;
  mistakes: string[];
  summary: string;
};

export type TelemetryBenchmarkRanking = {
  series_key: string;
  label: string;
  driver: string;
  overall_rank?: number | null;
  lap_delta_to_best?: number | null;
  braking_rank?: number | null;
  apex_rank?: number | null;
  exit_rank?: number | null;
  straight_line_rank?: number | null;
  consistency_rank?: number | null;
  main_loss_corner?: string | null;
  main_loss_seconds?: number | null;
  summary: string;
};

export type TelemetryPairCornerDelta = {
  corner: string;
  corner_label?: string | null;
  corner_type: string;
  total_delta: number;
  entry_delta: number;
  apex_delta: number;
  exit_delta: number;
  braking_point_delta?: number | null;
  throttle_pickup_delta?: number | null;
};

export type TelemetryPairDelta = {
  reference_series_key: string;
  reference_label: string;
  comparison_series_key: string;
  comparison_label: string;
  lap_delta?: number | null;
  corner_deltas: TelemetryPairCornerDelta[];
  biggest_gain_corner?: string | null;
  biggest_loss_corner?: string | null;
  summary: string;
};

export type TelemetryTrackPoint = {
  x: number;
  y: number;
  distance: number;
};

export type TelemetryTrackCorner = {
  corner: string;
  corner_label?: string | null;
  corner_hint?: string | null;
  official_corner_name?: string | null;
  corner_type: string;
  confidence_score?: number | null;
  distance: number;
  x: number;
  y: number;
};

export type TelemetryTrackMap = {
  points: TelemetryTrackPoint[];
  corners: TelemetryTrackCorner[];
};

export type TelemetryCacheMetadata = {
  cache_hit: boolean;
  cache_key?: string | null;
  generated_at?: string | null;
  series_count: number;
  unavailable_reason?: string | null;
  diagnostics: string[];
};

export type TelemetryResponse = {
  series: TelemetrySeries[];
  metrics: TelemetryDriverMetrics[];
  available_drivers: string[];
  lap_options: TelemetryLapOption[];
  micro_sectors: TelemetryMicroSector[];
  corner_breakdown: TelemetryCornerBreakdown[];
  performance: TelemetryPerformanceSummary[];
  benchmark_rankings: TelemetryBenchmarkRanking[];
  pair_deltas: TelemetryPairDelta[];
  track_map: TelemetryTrackMap;
  cache_metadata: TelemetryCacheMetadata;
  source: string;
  notice?: string | null;
  unavailable_reason?: string | null;
  weather?: string | null;
  session_summary?: string | null;
  insights: string[];
};

export type DriverSummary = {
  id: number;
  name: string;
  team: string;
};

export type RaceSummary = {
  id: number;
  track: string;
  date: string;
};

export type ResultSummary = {
  position: number;
  driver_id: number;
  race_id: number;
  points: number;
  driver_name?: string;
  team_name?: string;
};

export type FeaturedRaceContext = {
  race_name: string;
  winner: string;
  podium: string[];
  weather: string;
  key_stat: string;
  headline_events: string[];
  insights: string[];
};

export type MetadataResponse = {
  season: number;
  source: string;
  available_sessions: string[];
  drivers: DriverSummary[];
  races: RaceSummary[];
  results: ResultSummary[];
  featured_race_context: FeaturedRaceContext;
};

export type SeasonCalendarResponse = {
  season: number;
  source: string;
  available_sessions: string[];
  races: RaceSummary[];
  notice?: string | null;
};

export type WeekendContextResponse = {
  season: number;
  grand_prix: string;
  session: string;
  source: string;
  available_sessions: string[];
  drivers: DriverSummary[];
  weather: string;
  summary: string;
  insights: string[];
  notice?: string | null;
};

export type StrategyRequest = {
  driver: string;
  lap: number;
  position: number;
  tyre_compound: string;
  tyre_age: number;
  fuel_load: number;
  weather: string;
  year?: number;
  grand_prix?: string;
  session?: string;
};

export type StrategyResponse = {
  recommendation: string;
  pit_window: string;
  tyre_advice: string;
  push_mode: string;
  rationale: string[];
};

export type ReportRequest = {
  race_name: string;
  winning_driver: string;
  podium: string[];
  headline_events: string[];
  weather: string;
  key_stat: string;
};

export type ReportResponse = {
  summary: string;
  bullets: string[];
};

export type PredictorDriver = {
  name: string;
  team: string;
  qualifying_position: number;
  momentum_score: number;
  tyre_management: number;
  reliability: number;
};

export type PredictionResponse = {
  race_name: string;
  predicted_order: Array<{
    position: number;
    driver: string;
    team: string;
    score: number;
  }>;
};

export type ChatResponse = {
  answer: string;
  context: string[];
};

export type SavedActivity = {
  id: number;
  activity_type: string;
  title: string;
  summary: string;
  payload: string;
  created_at: string;
};

export type SavedActivityListResponse = {
  activities: SavedActivity[];
};

export type LoginRequest = {
  username: string;
  password: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
};

export type UserResponse = {
  username: string;
  full_name: string;
  role: string;
  favorite_team: string;
  favorite_driver: string;
  location: string;
  profile_image: string;
  bio: string;
};

export type UserProfileUpdate = {
  full_name: string;
  role: string;
  favorite_team: string;
  favorite_driver: string;
  location: string;
  profile_image: string;
  bio: string;
};
