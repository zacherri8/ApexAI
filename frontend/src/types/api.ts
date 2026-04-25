export type TelemetryPoint = {
  distance: number;
  speed: number;
  throttle: number;
  brake: number;
  gear: number;
};

export type TelemetrySeries = {
  driver: string;
  team: string;
  points: TelemetryPoint[];
};

export type TelemetryResponse = {
  series: TelemetrySeries[];
  available_drivers: string[];
  source: string;
  notice?: string | null;
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
