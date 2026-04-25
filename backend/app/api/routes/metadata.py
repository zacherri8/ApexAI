from fastapi import APIRouter, Depends, Query
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.schemas.metadata import MetadataResponse, SeasonCalendarResponse, WeekendContextResponse
from app.services.metadata_service import MetadataService


router = APIRouter()
service = MetadataService()


@router.get("/metadata", response_model=MetadataResponse)
def get_metadata(
    year: int | None = Query(default=None),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MetadataResponse:
    return service.get_metadata(db, year)


@router.get("/calendar", response_model=SeasonCalendarResponse)
def get_calendar(
    year: int = Query(...),
    _: User = Depends(get_current_user),
) -> SeasonCalendarResponse:
    return service.get_season_calendar(year)


@router.get("/weekend-context", response_model=WeekendContextResponse)
def get_weekend_context(
    year: int = Query(...),
    grand_prix: str = Query(...),
    session: str = Query(default="R"),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WeekendContextResponse:
    return service.get_weekend_context(db, year, grand_prix, session)


@router.get("/seasons", response_model=list[int])
def get_seasons(_: User = Depends(get_current_user)) -> list[int]:
    current_year = datetime.now(timezone.utc).year
    return list(range(current_year, 1949, -1))
