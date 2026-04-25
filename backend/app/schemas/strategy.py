from pydantic import BaseModel, Field


class StrategyRequest(BaseModel):
    driver: str
    lap: int = Field(ge=1)
    position: int = Field(ge=1)
    tyre_compound: str
    tyre_age: int = Field(ge=0)
    fuel_load: float = Field(ge=0)
    weather: str
    year: int | None = None
    grand_prix: str | None = None
    session: str | None = None


class StrategyResponse(BaseModel):
    recommendation: str
    pit_window: str
    tyre_advice: str
    push_mode: str
    rationale: list[str]
