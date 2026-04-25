from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.models import User
from app.db.repository import F1Repository
from app.db.session import get_db
from app.schemas.report import ReportRequest, ReportResponse
from app.services.report_service import ReportService


router = APIRouter()
service = ReportService()


@router.post("/report", response_model=ReportResponse)
def generate_report(
    payload: ReportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReportResponse:
    response = service.generate_report(payload)
    F1Repository(db).save_activity(
        user_id=current_user.id,
        activity_type="report",
        title=f"Race Report - {payload.race_name}",
        summary=response.summary,
        payload={
            "request": payload.model_dump(),
            "response": response.model_dump(),
        },
    )
    return response
