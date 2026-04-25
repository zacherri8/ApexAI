from app.schemas.report import ReportRequest, ReportResponse


class ReportService:
    def generate_report(self, payload: ReportRequest) -> ReportResponse:
        second_place = payload.podium[1]
        third_place = payload.podium[2]
        headline = payload.headline_events[0] if payload.headline_events else "Strategic tyre timing defined the outcome."
        summary = (
            f"{payload.race_name} delivered a decisive victory for {payload.winning_driver}, "
            f"who converted strong pace into a controlled win ahead of {second_place} and {third_place}. "
            f"Weather conditions were {payload.weather.lower()}, while the decisive swing came from {payload.key_stat.lower()}."
        )
        bullets = [
            f"Podium: {', '.join(payload.podium)}.",
            f"Headline moment: {headline}",
            f"Race read: {payload.winning_driver} kept the race under control while the chasing pack traded track-position pressure behind.",
            f"Key stat: {payload.key_stat}.",
        ]
        return ReportResponse(summary=summary, bullets=bullets)
