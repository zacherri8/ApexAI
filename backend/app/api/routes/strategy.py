from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.models import User
from app.db.repository import F1Repository
from app.db.session import get_db
from app.schemas.strategy import StrategyRequest, StrategyResponse
from app.services.strategy_service import StrategyService


router = APIRouter()
service = StrategyService()


@router.post("/strategy", response_model=StrategyResponse)
def generate_strategy(
    payload: StrategyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StrategyResponse:
    response = service.generate_strategy(payload)
    F1Repository(db).save_activity(
        user_id=current_user.id,
        activity_type="strategy",
        title=f"Strategy Call - {payload.driver}",
        summary=response.recommendation,
        payload={
            "request": payload.model_dump(),
            "response": response.model_dump(),
        },
    )
    return response
