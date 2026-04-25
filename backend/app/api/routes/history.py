from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.models import User
from app.db.repository import F1Repository
from app.db.session import get_db
from app.schemas.history import SavedActivityListResponse, SavedActivityResponse


router = APIRouter()


@router.get("/history", response_model=SavedActivityListResponse)
def list_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SavedActivityListResponse:
    activities = F1Repository(db).list_activities_for_user(current_user.id)
    return SavedActivityListResponse(
        activities=[
            SavedActivityResponse.model_validate(activity, from_attributes=True)
            for activity in activities
        ]
    )
