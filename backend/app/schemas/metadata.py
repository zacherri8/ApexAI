from pydantic import BaseModel


class DriverSummary(BaseModel):
    id: int
    name: str
    team: str


class RaceSummary(BaseModel):
    id: int
    track: str
    date: str


class ResultSummary(BaseModel):
    position: int
    driver_id: int
    race_id: int
    points: int
    driver_name: str | None = None
    team_name: str | None = None


class FeaturedRaceContext(BaseModel):
    race_name: str
    winner: str
    podium: list[str]
    weather: str
    key_stat: str
    headline_events: list[str]
    insights: list[str]


class MetadataResponse(BaseModel):
    season: int
    source: str
    available_sessions: list[str]
    drivers: list[DriverSummary]
    races: list[RaceSummary]
    results: list[ResultSummary]
    featured_race_context: FeaturedRaceContext


class SeasonCalendarResponse(BaseModel):
    season: int
    source: str
    available_sessions: list[str]
    races: list[RaceSummary]
    notice: str | None = None


class WeekendContextResponse(BaseModel):
    season: int
    grand_prix: str
    session: str
    source: str
    available_sessions: list[str]
    drivers: list[DriverSummary]
    weather: str
    summary: str
    insights: list[str]
    notice: str | None = None
