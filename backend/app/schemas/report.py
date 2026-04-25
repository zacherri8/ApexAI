from pydantic import BaseModel, Field


class ReportRequest(BaseModel):
    race_name: str
    winning_driver: str
    podium: list[str] = Field(min_length=3, max_length=3)
    headline_events: list[str] = Field(default_factory=list)
    weather: str
    key_stat: str


class ReportResponse(BaseModel):
    summary: str
    bullets: list[str]
