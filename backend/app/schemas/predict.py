from pydantic import BaseModel, Field


class PredictorDriver(BaseModel):
    name: str
    team: str
    qualifying_position: int = Field(ge=1)
    momentum_score: float = Field(ge=0, le=100)
    tyre_management: float = Field(ge=0, le=100)
    reliability: float = Field(ge=0, le=100)


class PredictionRequest(BaseModel):
    race_name: str
    drivers: list[PredictorDriver] = Field(min_length=2)


class PredictedFinish(BaseModel):
    position: int
    driver: str
    team: str
    score: float


class PredictionResponse(BaseModel):
    race_name: str
    predicted_order: list[PredictedFinish]
