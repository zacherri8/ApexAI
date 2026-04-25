from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    question: str = Field(min_length=3)
    year: int | None = None


class ChatResponse(BaseModel):
    answer: str
    context: list[str]
