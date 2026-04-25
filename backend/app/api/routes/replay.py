from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.schemas.replay import ReplayDataset
from app.services.fastf1_service import FastF1Service


router = APIRouter()


@router.get("/replay", response_model=ReplayDataset)
def get_replay(
    year: int = Query(default=2025),
    grand_prix: str = Query(default="Monza"),
    session: str = Query(default="R"),
    drivers: int | None = Query(default=None, ge=2, le=30),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReplayDataset:
    return ReplayDataset.model_validate(
        FastF1Service(db).load_replay_dataset(year, grand_prix, session, drivers)
    )
