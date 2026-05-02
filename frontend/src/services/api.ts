import {
  ChatResponse,
  LoginRequest,
  MetadataResponse,
  PredictionResponse,
  PredictorDriver,
  ReportRequest,
  ReportResponse,
  SavedActivityListResponse,
  SeasonCalendarResponse,
  StrategyRequest,
  StrategyResponse,
  TelemetryResponse,
  TokenResponse,
  UserProfileUpdate,
  UserResponse,
  WeekendContextResponse,
} from "@/types/api";
import { ReplayDataset } from "@/types/replay";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

async function request<T>(path: string, options?: RequestInit, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function getMetadata(token?: string, year?: number) {
  const query = year ? `?year=${encodeURIComponent(String(year))}` : "";
  return request<MetadataResponse>(`/metadata${query}`, undefined, token);
}

export function getSeasons(token?: string) {
  return request<number[]>("/seasons", undefined, token);
}

export function getSeasonCalendar(year: number, token?: string) {
  return request<SeasonCalendarResponse>(`/calendar?year=${encodeURIComponent(String(year))}`, undefined, token);
}

export function getWeekendContext(
  options: { year: number; grandPrix: string; session: string },
  token?: string,
) {
  const query = [
    `year=${encodeURIComponent(String(options.year))}`,
    `grand_prix=${encodeURIComponent(options.grandPrix)}`,
    `session=${encodeURIComponent(options.session)}`,
  ].join("&");
  return request<WeekendContextResponse>(`/weekend-context?${query}`, undefined, token);
}

export function getTelemetry(
  drivers: string[] = [],
  options?: { year?: number; grandPrix?: string; session?: string; lapSelections?: Record<string, number[]> },
  token?: string,
) {
  const lapSelections = Object.entries(options?.lapSelections ?? {}).flatMap(([driver, laps]) =>
    (laps ?? []).map((lap) => `${driver}:${lap}`),
  );
  const queryParts = [
    ...drivers.map((driver) => `drivers=${encodeURIComponent(driver)}`),
    ...(options?.year ? [`year=${encodeURIComponent(String(options.year))}`] : []),
    ...(options?.grandPrix ? [`grand_prix=${encodeURIComponent(options.grandPrix)}`] : []),
    ...(options?.session ? [`session=${encodeURIComponent(options.session)}`] : []),
    ...lapSelections.map((selection) => `lap_selections=${encodeURIComponent(selection)}`),
  ];
  const query = queryParts.length ? `?${queryParts.join("&")}` : "";
  return request<TelemetryResponse>(`/telemetry${query}`, undefined, token);
}

export function getReplayDataset(
  options: { year?: number; grandPrix?: string; session?: string; drivers?: number } = {},
  token?: string,
) {
  const queryParts = [
    ...(options.year ? [`year=${encodeURIComponent(String(options.year))}`] : []),
    ...(options.grandPrix ? [`grand_prix=${encodeURIComponent(options.grandPrix)}`] : []),
    ...(options.session ? [`session=${encodeURIComponent(options.session)}`] : []),
    ...(options.drivers ? [`drivers=${encodeURIComponent(String(options.drivers))}`] : []),
  ];
  const query = queryParts.length ? `?${queryParts.join("&")}` : "";
  return request<ReplayDataset>(`/replay${query}`, undefined, token);
}

export function getStrategy(payload: StrategyRequest, token?: string) {
  return request<StrategyResponse>("/strategy", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function getReport(payload: ReportRequest, token?: string) {
  return request<ReportResponse>("/report", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function getPrediction(race_name: string, drivers: PredictorDriver[], token?: string) {
  return request<PredictionResponse>("/predict", {
    method: "POST",
    body: JSON.stringify({ race_name, drivers }),
  }, token);
}

export function askChatbot(question: string, token?: string, year?: number) {
  return request<ChatResponse>("/chat", {
    method: "POST",
    body: JSON.stringify({ question, year }),
  }, token);
}

export function getHistory(token?: string) {
  return request<SavedActivityListResponse>("/history", undefined, token);
}

export function loginRequest(payload: LoginRequest) {
  return request<TokenResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getCurrentUser(token: string) {
  return request<UserResponse>("/auth/me", undefined, token);
}

export function updateProfileRequest(payload: UserProfileUpdate, token: string) {
  return request<UserResponse>(
    "/auth/profile",
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
    token,
  );
}
