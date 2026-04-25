from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.models import User
from app.db.repository import F1Repository
from app.db.session import get_db
from app.schemas.predict import PredictionRequest, PredictionResponse
from app.services.predictor_service import PredictorService


router = APIRouter()
service = PredictorService()


@router.post("/predict", response_model=PredictionResponse)
def predict_race(
    payload: PredictionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PredictionResponse:
    response = service.predict(payload)
    F1Repository(db).save_activity(
        user_id=current_user.id,
        activity_type="prediction",
        title=f"Prediction - {payload.race_name}",
        summary=f"Projected winner: {response.predicted_order[0].driver}",
        payload={
            "request": payload.model_dump(),
            "response": response.model_dump(),
        },
    )
    return response
