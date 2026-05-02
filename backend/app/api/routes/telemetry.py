from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.schemas.telemetry import TelemetryResponse
from app.services.telemetry_service import TelemetryService


router = APIRouter()
service = TelemetryService()


@router.get("/telemetry", response_model=TelemetryResponse)
def get_telemetry(
    drivers: list[str] = Query(default=[]),
    lap_selections: list[str] = Query(default=[]),
    year: int | None = None,
    grand_prix: str | None = None,
    session: str | None = None,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TelemetryResponse:
    return service.list_telemetry(db, drivers or None, year, grand_prix, session, lap_selections or None)
