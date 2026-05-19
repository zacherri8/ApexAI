from sqlalchemy.orm import Session

from app.services.fastf1_service import FastF1Service
from app.schemas.telemetry import TelemetryDriverMetrics, TelemetryResponse, TelemetrySeries


class TelemetryService:
    def list_telemetry(
        self,
        db: Session,
        drivers: list[str] | None = None,
        year: int | None = None,
        grand_prix: str | None = None,
        session: str | None = None,
        lap_selections: list[str] | None = None,
    ) -> TelemetryResponse:
        fastf1_service = FastF1Service(db)
        if year and grand_prix and session:
            telemetry_bundle = fastf1_service.load_session_telemetry(
                year,
                grand_prix,
                session,
                drivers,
                lap_selections,
            )
            raw_series = telemetry_bundle.get("series", [])
            raw_metrics = telemetry_bundle.get("metrics", [])
            source = "fastf1" if raw_series else "fastf1-unavailable"
            notice = None if raw_series else (
                f"FastF1 did not return telemetry for {grand_prix} {year} {session}. "
                "No local telemetry substitute is being injected."
            )
        else:
            raw_series = []
            raw_metrics = []
            source = "fastf1-unavailable"
            notice = "A season, Grand Prix, and session must be provided to load FastF1 telemetry."
        series = [
            TelemetrySeries(
                series_key=item["series_key"],
                label=item["label"],
                driver=item["driver"],
                team=item["team"],
                color=item["color"],
                lap_number=item.get("lap_number"),
                lap_time_seconds=item.get("lap_time_seconds"),
                compound=item.get("compound"),
                is_reference=item.get("is_reference", False),
                points=item["points"],
            )
            for item in raw_series
        ]
        metrics = [TelemetryDriverMetrics(**metric) for metric in raw_metrics]
        return TelemetryResponse(
            series=series,
            metrics=metrics,
            available_drivers=telemetry_bundle.get("available_drivers", []) if year and grand_prix and session else [],
            lap_options=telemetry_bundle.get("lap_options", []) if year and grand_prix and session else [],
            micro_sectors=telemetry_bundle.get("micro_sectors", []) if year and grand_prix and session else [],
            corner_breakdown=telemetry_bundle.get("corner_breakdown", []) if year and grand_prix and session else [],
            performance=telemetry_bundle.get("performance", []) if year and grand_prix and session else [],
            track_map=telemetry_bundle.get("track_map", {"points": [], "corners": []}) if year and grand_prix and session else {"points": [], "corners": []},
            source=source,
            notice=notice,
            weather=telemetry_bundle.get("weather") if year and grand_prix and session else None,
            session_summary=telemetry_bundle.get("session_summary") if year and grand_prix and session else None,
            insights=telemetry_bundle.get("insights", []) if year and grand_prix and session else [],
        )
