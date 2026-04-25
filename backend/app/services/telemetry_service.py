from sqlalchemy.orm import Session

from app.db.repository import F1Repository
from app.services.fastf1_service import FastF1Service
from app.schemas.telemetry import TelemetryResponse, TelemetrySeries


class TelemetryService:
    def list_telemetry(
        self,
        db: Session,
        drivers: list[str] | None = None,
        year: int | None = None,
        grand_prix: str | None = None,
        session: str | None = None,
    ) -> TelemetryResponse:
        repository = F1Repository(db)
        fastf1_service = FastF1Service(db)
        driver_lookup = {driver["name"]: driver["team"] for driver in repository.get_drivers()}
        if year and grand_prix and session:
            session_driver_lookup = fastf1_service.load_session_driver_lookup(year, grand_prix, session)
            if session_driver_lookup:
                driver_lookup = session_driver_lookup
            raw_series = fastf1_service.load_session_telemetry(year, grand_prix, session)
            if drivers:
                raw_series = {driver: points for driver, points in raw_series.items() if driver in drivers}
            source = "fastf1" if raw_series else "fastf1-unavailable"
            notice = None if raw_series else (
                f"FastF1 did not return telemetry for {grand_prix} {year} {session}. "
                "No local telemetry substitute is being injected."
            )
        else:
            raw_series = repository.get_telemetry(drivers)
            source = "local-fallback"
            notice = "No explicit season/weekend/session was provided, so local sample telemetry is being shown."
        series = [
            TelemetrySeries(driver=driver, team=driver_lookup.get(driver, "Unknown"), points=points)
            for driver, points in raw_series.items()
        ]
        return TelemetryResponse(
            series=series,
            available_drivers=list(driver_lookup),
            source=source,
            notice=notice,
        )
