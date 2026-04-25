from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.schemas.metadata import MetadataResponse, SeasonCalendarResponse, WeekendContextResponse
from app.services.fastf1_service import FastF1Service


class MetadataService:
    def get_season_calendar(self, year: int) -> SeasonCalendarResponse:
        fastf1_payload = FastF1Service(None).load_season_calendar(year)
        if fastf1_payload:
            return SeasonCalendarResponse(**fastf1_payload)

        return SeasonCalendarResponse(
            season=year,
            source="fastf1-unavailable",
            available_sessions=FastF1Service.available_sessions,
            races=[],
            notice=(
                f"FastF1 could not load the {year} season schedule in the current environment. "
                "Restart the backend with internet access or a warmed FastF1 cache to browse this year."
            ),
        )

    def get_metadata(self, db: Session, year: int | None = None) -> MetadataResponse:
        target_year = year or datetime.now(timezone.utc).year
        explicit_year_requested = year is not None
        fastf1_payload = FastF1Service(db).load_season_metadata(target_year)
        if fastf1_payload:
            return MetadataResponse(**fastf1_payload)

        if explicit_year_requested:
            return MetadataResponse(
                season=target_year,
                source="fastf1-unavailable",
                available_sessions=FastF1Service.available_sessions,
                drivers=[],
                races=[],
                results=[],
                featured_race_context=FastF1Service._build_unavailable_featured_context(target_year),
            )

        return MetadataResponse(
            season=target_year,
            source="fastf1-unavailable",
            available_sessions=FastF1Service.available_sessions,
            drivers=[],
            races=[],
            results=[],
            featured_race_context=FastF1Service._build_unavailable_featured_context(target_year),
        )

    def get_weekend_context(
        self,
        db: Session,
        year: int,
        grand_prix: str,
        session: str,
    ) -> WeekendContextResponse:
        fastf1_service = FastF1Service(db)
        fastf1_payload = fastf1_service.load_weekend_context(year, grand_prix, session)
        if fastf1_payload:
            return WeekendContextResponse(**fastf1_payload)

        season_metadata = fastf1_service.load_season_metadata(year)
        if season_metadata:
            return WeekendContextResponse(
                season=year,
                grand_prix=grand_prix,
                session=session,
                source="fastf1-season",
                available_sessions=FastF1Service.available_sessions,
                drivers=season_metadata["drivers"],
                weather="FastF1 session weather was unavailable, so season-level FastF1 roster data is being shown.",
                summary=f"FastF1 season data loaded for {year}, but the specific {grand_prix} {session} session could not be opened.",
                insights=[
                    "Season roster data is still coming from FastF1 for the selected year.",
                    "The specific session did not expose the full weekend context in the current environment.",
                    "Retry the same Grand Prix/session after the backend cache has warmed if this is a recent selection.",
                ],
                notice="FastF1 could not load the exact session context, so season-level FastF1 data is being used instead.",
            )

        return WeekendContextResponse(
            season=year,
            grand_prix=grand_prix,
            session=session,
            source="fastf1-unavailable",
            available_sessions=FastF1Service.available_sessions,
            drivers=[],
            weather="FastF1 data unavailable in the current environment.",
            summary=f"FastF1 could not load the {grand_prix} {year} {session} session.",
            insights=[
                "No fake session data is being substituted here.",
                "No local roster is being injected for the selected session.",
                "Restart the backend with network access or a warmed FastF1 cache to load the real session context.",
            ],
            notice="FastF1 could not load the selected weekend context. No local fallback driver data is being injected.",
        )
