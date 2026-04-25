from pydantic import BaseModel


class SavedActivityResponse(BaseModel):
    id: int
    activity_type: str
    title: str
    summary: str
    payload: str
    created_at: str


class SavedActivityListResponse(BaseModel):
    activities: list[SavedActivityResponse]
