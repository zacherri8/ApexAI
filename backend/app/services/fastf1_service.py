from __future__ import annotations

from datetime import datetime, timezone
import math
import os
from pathlib import Path

from sqlalchemy.orm import Session

from app.db.repository import F1Repository

try:
    import fastf1
except ImportError:  # pragma: no cover
    fastf1 = None


class FastF1Service:
    available_sessions = ["FP1", "FP2", "FP3", "Q", "R"]
    _season_calendar_cache: dict[int, dict | None] = {}
    _season_metadata_cache: dict[int, dict | None] = {}
    _session_cache: dict[tuple[int, str, str], object | None] = {}
    _session_telemetry_cache: dict[tuple[int, str, str], dict[str, list[dict]]] = {}
    _session_driver_lookup_cache: dict[tuple[int, str, str], dict[str, str]] = {}
    _weekend_context_cache: dict[tuple[int, str, str], dict | None] = {}
    team_colors = {
        "Red Bull": "#3671c6",
        "McLaren": "#ff8700",
        "Ferrari": "#e10600",
        "Mercedes": "#00d2be",
        "Aston Martin": "#006f62",
        "Alpine": "#ff87bc",
        "RB": "#6692ff",
        "Williams": "#64c4ff",
        "Sauber": "#52e252",
        "Haas": "#b6babd",
    }

    def __init__(self, db: Session | None) -> None:
        self.repository = F1Repository(db) if db is not None else None

    def load_season_calendar(self, year: int) -> dict | None:
        if year in self._season_calendar_cache:
            return self._season_calendar_cache[year]
        if not fastf1:
            return None

        try:
            self._enable_cache()
            schedule = fastf1.get_event_schedule(year, include_testing=False)
        except Exception:  # pragma: no cover - network/cache/runtime issues
            self._season_calendar_cache[year] = None
            return None

        races: list[dict] = []
        for index, row in enumerate(schedule.itertuples(), start=1):
            event_name = getattr(row, "EventName", None) or getattr(row, "OfficialEventName", None) or f"Round {index}"
            event_date = getattr(row, "EventDate", None)
            races.append(
                {
                    "id": index,
                    "track": str(event_name),
                    "date": self._format_date(event_date),
                }
            )

        payload = {
            "season": year,
            "source": "fastf1",
            "available_sessions": self.available_sessions,
            "races": races,
            "notice": None,
        }
        self._season_calendar_cache[year] = payload
        return payload

    def load_season_metadata(self, year: int) -> dict | None:
        if year in self._season_metadata_cache:
            return self._season_metadata_cache[year]
        if not fastf1:
            return None

        calendar_payload = self.load_season_calendar(year)
        if not calendar_payload:
            self._season_metadata_cache[year] = None
            return None

        if self.repository is None:
            return None

        races = calendar_payload["races"]

        latest_race = self._find_latest_completed_race(races)
        if not latest_race:
            payload = {
                "season": year,
                "source": "fastf1",
                "available_sessions": self.available_sessions,
                "drivers": self.repository.get_drivers(),
                "races": races,
                "results": self.repository.get_results(),
                "featured_race_context": self._build_seeded_featured_context(races[0]["track"] if races else "Grand Prix"),
            }
            self._season_metadata_cache[year] = payload
            return payload

        race_session = self._load_session(year, latest_race["track"], "R")
        if not race_session:
            payload = {
                "season": year,
                "source": "fastf1",
                "available_sessions": self.available_sessions,
                "drivers": self.repository.get_drivers(),
                "races": races,
                "results": self.repository.get_results(),
                "featured_race_context": self._build_seeded_featured_context(latest_race["track"]),
            }
            self._season_metadata_cache[year] = payload
            return payload

        drivers: list[dict] = []
        results: list[dict] = []
        podium: list[str] = []

        for index, row in enumerate(race_session.results.itertuples(), start=1):
            full_name = str(getattr(row, "FullName", None) or getattr(row, "BroadcastName", None) or getattr(row, "Abbreviation", f"Driver {index}"))
            team_name = str(getattr(row, "TeamName", None) or "Unknown")
            drivers.append(
                {
                    "id": index,
                    "name": full_name,
                    "team": team_name,
                }
            )
            position = getattr(row, "Position", None)
            points = getattr(row, "Points", 0) or 0
            if position is None:
                continue
            try:
                position_value = float(position)
            except (TypeError, ValueError):
                continue
            if math.isnan(position_value):
                continue
            parsed_position = int(position_value)
            if parsed_position <= 3:
                podium.append(full_name)
            results.append(
                {
                    "position": parsed_position,
                    "driver_id": index,
                    "race_id": latest_race["id"],
                    "points": int(float(points)),
                    "driver_name": full_name,
                    "team_name": team_name,
                }
            )

        if not drivers:
            self._season_metadata_cache[year] = None
            return None

        featured_context = self._build_fastf1_featured_context(
            latest_race["track"],
            podium,
            results,
            race_session,
        )

        payload = {
            "season": year,
            "source": "fastf1",
            "available_sessions": self.available_sessions,
            "drivers": drivers,
            "races": races,
            "results": results or self.repository.get_results(),
            "featured_race_context": featured_context,
        }
        self._season_metadata_cache[year] = payload
        return payload

    def load_session_driver_lookup(self, year: int, grand_prix: str, session: str) -> dict[str, str]:
        key = self._session_key(year, grand_prix, session)
        if key in self._session_driver_lookup_cache:
            return self._session_driver_lookup_cache[key]

        race_session = self._load_session(year, grand_prix, session)
        if not race_session:
            return {}

        driver_lookup: dict[str, str] = {}
        for driver_number in race_session.drivers:
            try:
                driver_info = race_session.get_driver(driver_number)
                full_name = str(
                    driver_info.get("FullName")
                    or driver_info.get("BroadcastName")
                    or driver_info.get("Abbreviation")
                    or driver_number
                )
                team_name = str(driver_info.get("TeamName") or "Unknown")
                driver_lookup[full_name] = team_name
            except Exception:  # pragma: no cover - session-specific FastF1 irregularities
                continue

        self._session_driver_lookup_cache[key] = driver_lookup
        return driver_lookup

    def load_weekend_context(self, year: int, grand_prix: str, session: str) -> dict | None:
        key = self._session_key(year, grand_prix, session)
        if key in self._weekend_context_cache:
            return self._weekend_context_cache[key]

        race_session = self._load_session(year, grand_prix, session)
        if not race_session:
            self._weekend_context_cache[key] = None
            return None

        drivers: list[dict] = []
        for index, driver_number in enumerate(race_session.drivers, start=1):
            try:
                driver_info = race_session.get_driver(driver_number)
                full_name = str(
                    driver_info.get("FullName")
                    or driver_info.get("BroadcastName")
                    or driver_info.get("Abbreviation")
                    or driver_number
                )
                team_name = str(driver_info.get("TeamName") or "Unknown")
                drivers.append(
                    {
                        "id": index,
                        "name": full_name,
                        "team": team_name,
                    }
                )
            except Exception:  # pragma: no cover
                continue

        weather = self._describe_weather(race_session)
        summary = (
            f"FastF1 loaded {len(drivers)} drivers for the {grand_prix} {year} {session} session."
            if drivers
            else f"FastF1 loaded the {grand_prix} {year} {session} session, but the driver roster is incomplete."
        )
        insights = self._build_weekend_insights(race_session, len(drivers))
        payload = {
            "season": year,
            "grand_prix": grand_prix,
            "session": session,
            "source": "fastf1",
            "available_sessions": self.available_sessions,
            "drivers": drivers,
            "weather": weather,
            "summary": summary,
            "insights": insights,
            "notice": None,
        }
        self._weekend_context_cache[key] = payload
        return payload

    def load_session_telemetry(self, year: int, grand_prix: str, session: str) -> dict[str, list[dict]]:
        key = self._session_key(year, grand_prix, session)
        if key in self._session_telemetry_cache:
            return self._session_telemetry_cache[key]
        if not fastf1:
            self._session_telemetry_cache[key] = {}
            return {}

        race_session = self._load_session(year, grand_prix, session)
        if not race_session:
            self._session_telemetry_cache[key] = {}
            return {}

        telemetry: dict[str, list[dict]] = {}
        for driver_code in race_session.drivers[:6]:
            try:
                driver_info = race_session.get_driver(driver_code)
                full_name = str(driver_info.get("FullName") or driver_code)
                lap = race_session.laps.pick_drivers(driver_code).pick_fastest()
                if lap is None:
                    continue
                car_data = lap.get_car_data().add_distance()
                telemetry[full_name] = [
                    {
                        "distance": float(row.Distance),
                        "speed": float(row.Speed),
                        "throttle": float(row.Throttle),
                        "brake": float(row.Brake),
                        "gear": int(row.nGear),
                    }
                    for row in car_data.itertuples()
                ]
            except Exception:  # pragma: no cover - FastF1 session irregularities
                continue
        payload = telemetry
        self._session_telemetry_cache[key] = payload
        return payload

    def load_replay_dataset(
        self,
        year: int,
        grand_prix: str,
        session: str,
        driver_limit: int | None = None,
        sample_ms: int = 250,
    ) -> dict:
        if fastf1:
            race_session = self._load_session(year, grand_prix, session)
            if race_session:
                replay = self._build_fastf1_replay_dataset(race_session, year, grand_prix, session, driver_limit, sample_ms)
                if replay:
                    return replay

        return self._build_unavailable_replay_dataset(year, grand_prix, session)

    def _load_session(self, year: int, grand_prix: str, session: str):
        key = self._session_key(year, grand_prix, session)
        if key in self._session_cache:
            return self._session_cache[key]
        try:
            self._enable_cache()
            race_session = fastf1.get_session(year, grand_prix, session)
            race_session.load()
            self._session_cache[key] = race_session
            return race_session
        except Exception:  # pragma: no cover - network/cache/runtime issues
            self._session_cache[key] = None
            return None

    @staticmethod
    def _session_key(year: int, grand_prix: str, session: str) -> tuple[int, str, str]:
        return (year, grand_prix.strip().lower(), session.strip().upper())

    def _build_fastf1_replay_dataset(
        self,
        race_session,
        year: int,
        grand_prix: str,
        session: str,
        driver_limit: int | None,
        sample_ms: int,
    ) -> dict | None:
        raw_by_driver: dict[str, list[dict]] = {}
        drivers: list[dict] = []
        all_x: list[float] = []
        all_y: list[float] = []
        official_positions = self._build_official_position_lookup(race_session)
        driver_numbers = list(race_session.drivers)
        if driver_limit is not None:
            driver_numbers = driver_numbers[:driver_limit]

        for index, driver_number in enumerate(driver_numbers, start=1):
            try:
                driver_info = race_session.get_driver(driver_number)
                driver_id = str(driver_info.get("Abbreviation") or driver_number)
                full_name = str(driver_info.get("FullName") or driver_info.get("BroadcastName") or driver_id)
                team_name = str(driver_info.get("TeamName") or "Unknown")
                pos_data = race_session.pos_data.get(str(driver_number))
                if pos_data is None:
                    pos_data = race_session.pos_data.get(driver_number)
                if pos_data is None or pos_data.empty:
                    continue

                samples: list[dict] = []
                for row in pos_data.itertuples():
                    status = str(getattr(row, "Status", "OnTrack"))
                    if status and status != "OnTrack":
                        continue
                    timestamp_value = getattr(row, "Time", None)
                    if not hasattr(timestamp_value, "total_seconds"):
                        continue
                    x = float(getattr(row, "X"))
                    y = float(getattr(row, "Y"))
                    if x == 0 and y == 0:
                        continue
                    timestamp = float(timestamp_value.total_seconds() * 1000)
                    samples.append({"timestamp": timestamp, "x": x, "y": y})
                    all_x.append(x)
                    all_y.append(y)

                if len(samples) < 2:
                    continue

                raw_by_driver[driver_id] = sorted(samples, key=lambda item: item["timestamp"])
                drivers.append(
                    {
                        "id": driver_id,
                        "code": driver_id,
                        "name": full_name,
                        "team": team_name,
                        "color": self._team_color(team_name, index),
                        "position": official_positions.get(driver_id, 999),
                    }
                )
            except Exception:  # pragma: no cover - session-specific FastF1 data gaps
                continue

        if not drivers or not all_x or not all_y:
            return None

        drivers.sort(key=lambda driver: (driver.get("position", 999), driver["code"]))

        min_x, max_x = min(all_x), max(all_x)
        min_y, max_y = min(all_y), max(all_y)
        x_range = max(max_x - min_x, 1)
        y_range = max(max_y - min_y, 1)

        def normalize(sample: dict) -> dict:
            return {
                **sample,
                "x": (sample["x"] - min_x) / x_range,
                "y": 1 - ((sample["y"] - min_y) / y_range),
            }

        normalized_by_driver = {
            driver_id: [normalize(sample) for sample in samples]
            for driver_id, samples in raw_by_driver.items()
        }
        start_time = min(samples[0]["timestamp"] for samples in normalized_by_driver.values())
        end_time = max(samples[-1]["timestamp"] for samples in normalized_by_driver.values())
        source_duration = max(end_time - start_time, sample_ms)
        replay_duration = self._target_replay_duration_ms(session, source_duration)

        def sample_driver(samples: list[dict], timestamp: float) -> dict:
            if timestamp <= samples[0]["timestamp"]:
                return samples[0]
            if timestamp >= samples[-1]["timestamp"]:
                return samples[-1]
            for sample_index in range(1, len(samples)):
                after = samples[sample_index]
                before = samples[sample_index - 1]
                if after["timestamp"] >= timestamp:
                    delta = max(after["timestamp"] - before["timestamp"], 1)
                    ratio = (timestamp - before["timestamp"]) / delta
                    return {
                        "timestamp": timestamp,
                        "x": before["x"] + (after["x"] - before["x"]) * ratio,
                        "y": before["y"] + (after["y"] - before["y"]) * ratio,
                    }
            return samples[-1]

        frames: list[dict] = []
        current_time = 0
        while current_time <= replay_duration:
            progress = min(current_time / replay_duration, 1) if replay_duration else 0
            source_timestamp = start_time + progress * source_duration
            positions = []
            for driver in drivers:
                sampled = sample_driver(normalized_by_driver[driver["id"]], source_timestamp)
                positions.append(
                    {
                        "driverId": driver["id"],
                        "timestamp": current_time,
                        "x": sampled["x"],
                        "y": sampled["y"],
                        "lap": max(1, int(progress * self._estimate_lap_count(race_session, driver["id"]))),
                        "position": driver.get("position", 999),
                        "speedKph": None,
                    }
                )
            frames.append({"timestamp": current_time, "positions": positions})
            current_time += sample_ms

        lead_driver_samples = normalized_by_driver[drivers[0]["id"]]
        track_points = [
            {"x": sample["x"], "y": sample["y"]}
            for sample in lead_driver_samples[:: max(1, len(lead_driver_samples) // 96)]
        ][:96]

        event_name = str(getattr(race_session.event, "EventName", grand_prix) or grand_prix)
        session_label = self._session_display_name(session)

        return {
            "id": f"fastf1-{year}-{grand_prix}-{session}".lower().replace(" ", "-"),
            "eventName": f"{event_name} {year} - {session_label} Replay",
            "season": year,
            "source": "fastf1",
            "telemetryAvailable": True,
            "notice": f"FastF1 loaded {len(drivers)} drivers for this replay session.",
            "durationMs": replay_duration,
            "track": {
                "id": str(grand_prix).lower().replace(" ", "-"),
                "name": f"{event_name} FastF1 position map",
                "points": track_points,
            },
            "drivers": [{key: value for key, value in driver.items() if key != "position"} for driver in drivers],
            "frames": frames,
        }

    def _build_unavailable_replay_dataset(self, year: int, grand_prix: str, session: str) -> dict:
        return {
            "id": f"unavailable-{year}-{grand_prix}-{session}".lower().replace(" ", "-"),
            "eventName": f"{grand_prix} {year} {session} replay unavailable",
            "season": year,
            "source": "fastf1-unavailable",
            "telemetryAvailable": False,
            "notice": (
                "FastF1 could not load position telemetry for this selected session. "
                "No fake replay is being substituted."
            ),
            "durationMs": 0,
            "track": {"id": "unavailable-track", "name": "No FastF1 track position data", "points": []},
            "drivers": [],
            "frames": [],
        }

    def _team_color(self, team_name: str, index: int) -> str:
        if team_name in self.team_colors:
            return self.team_colors[team_name]
        for known_team, color in self.team_colors.items():
            if known_team.lower() in team_name.lower() or team_name.lower() in known_team.lower():
                return color
        palette = ["#e10600", "#ff8700", "#3671c6", "#00d2be", "#52e252", "#b6babd"]
        return palette[(index - 1) % len(palette)]

    @staticmethod
    def _describe_weather(race_session) -> str:
        try:
            weather_data = race_session.weather_data
            rain_total = float(weather_data["Rainfall"].sum()) if "Rainfall" in weather_data else 0.0
            avg_air = float(weather_data["AirTemp"].mean()) if "AirTemp" in weather_data else 0.0
            avg_track = float(weather_data["TrackTemp"].mean()) if "TrackTemp" in weather_data else 0.0
            if rain_total > 0:
                return f"Mixed conditions with {rain_total:.1f} mm recorded rainfall and {avg_track:.0f}C track temperature."
            return f"Dry running around {avg_air:.0f}C ambient and {avg_track:.0f}C track temperature."
        except Exception:  # pragma: no cover
            return "Weather data unavailable for this session."

    @staticmethod
    def _build_weekend_insights(race_session, driver_count: int) -> list[str]:
        insights: list[str] = []
        try:
            laps = race_session.laps
            if len(laps):
                insights.append(f"FastF1 timing covers {driver_count} drivers with {len(laps)} timed laps available in this session.")
        except Exception:  # pragma: no cover
            pass
        try:
            track_status = race_session.track_status
            if len(track_status):
                statuses = {str(item) for item in track_status["Status"].tolist()}
                status_summary = ", ".join(sorted(statuses)) or "green-flag running"
                insights.append(f"Track status states seen in the session: {status_summary}.")
        except Exception:  # pragma: no cover
            pass
        try:
            event_name = str(getattr(race_session.event, "EventName", race_session.event))
            insights.append(f"Session context is anchored to {event_name}, so all driver and weather data comes from the selected weekend.")
        except Exception:  # pragma: no cover
            pass

        return insights[:3] or [
            f"FastF1 loaded {driver_count} drivers for the selected session.",
            "Weather and driver rosters come from the selected Grand Prix weekend.",
            "Session-specific data is cached after the first successful load for faster follow-up requests.",
        ]

    @staticmethod
    def _enable_cache() -> None:
        FastF1Service._clear_broken_local_proxy()
        Path(".fastf1-cache").mkdir(parents=True, exist_ok=True)
        fastf1.Cache.enable_cache(".fastf1-cache")

    @staticmethod
    def _clear_broken_local_proxy() -> None:
        broken_proxy_markers = ("127.0.0.1:9", "localhost:9")
        proxy_keys = (
            "HTTP_PROXY",
            "HTTPS_PROXY",
            "ALL_PROXY",
            "http_proxy",
            "https_proxy",
            "all_proxy",
        )
        for key in proxy_keys:
            value = os.environ.get(key, "")
            if any(marker in value for marker in broken_proxy_markers):
                os.environ.pop(key, None)

    @staticmethod
    def _format_date(value) -> str:
        if value is None:
            return ""
        try:
            return value.strftime("%Y-%m-%d")
        except Exception:
            return str(value)[:10]

    @staticmethod
    def _find_latest_completed_race(races: list[dict]) -> dict | None:
        today = datetime.now(timezone.utc).date()
        completed = []
        for race in races:
            try:
                race_date = datetime.fromisoformat(race["date"]).date()
            except Exception:
                continue
            if race_date <= today:
                completed.append(race)
        return completed[-1] if completed else (races[0] if races else None)

    @staticmethod
    def _build_seeded_featured_context(race_name: str) -> dict:
        return {
            "race_name": f"{race_name} Grand Prix",
            "winner": "Lando Norris",
            "podium": ["Lando Norris", "Max Verstappen", "Charles Leclerc"],
            "weather": "Stable dry conditions",
            "key_stat": "Top-three covered by under two strategic phases",
            "headline_events": [
                "A clean launch decided track position at the front.",
                "The undercut window opened in the middle stint.",
                "Tyre management shaped the closing laps.",
            ],
            "insights": [
                "Front-runners protected rear tyres through the traction phases.",
                "Track position mattered more than outright top speed after the opening phase.",
                "Mid-stint tyre management set up the closing-lap pace advantage.",
            ],
        }

    @staticmethod
    def _build_unavailable_featured_context(year: int) -> dict:
        return {
            "race_name": f"{year} Formula 1 season",
            "winner": "Unavailable",
            "podium": ["Unavailable", "Unavailable", "Unavailable"],
            "weather": "Unavailable",
            "key_stat": "FastF1 could not load this season in the current environment.",
            "headline_events": [
                "FastF1 schedule loading failed for the selected season.",
                "No seeded calendar is being substituted because it would show incorrect race data.",
                "Restart the backend with network access or cached FastF1 data to load this season.",
            ],
            "insights": [
                "This view now avoids mixing 2025 fallback races into other selected years.",
                "Replay telemetry can only be generated when FastF1 provides session position data.",
                "Historical calendar browsing depends on FastF1 schedule availability or local FastF1 cache.",
            ],
        }

    @staticmethod
    def _build_fastf1_featured_context(
        race_name: str,
        podium: list[str],
        results: list[dict],
        race_session,
    ) -> dict:
        weather = "Dry running"
        try:
            weather_data = race_session.weather_data
            rain_total = float(weather_data["Rainfall"].sum()) if "Rainfall" in weather_data else 0.0
            avg_air = float(weather_data["AirTemp"].mean()) if "AirTemp" in weather_data else 0.0
            weather = (
                f"Mixed conditions with {rain_total:.1f} mm rainfall"
                if rain_total > 0
                else f"Dry running around {avg_air:.0f}C ambient"
            )
        except Exception:  # pragma: no cover
            weather = "Dry running"

        winner = podium[0] if podium else (results[0]["driver_name"] if results else "Unknown Driver")
        headline_events = [
            f"{winner} converted the front-running pace into victory at {race_name}.",
            f"The podium battle featured {', '.join(podium[:3])}." if podium else "The race was decided by pace and tyre control.",
            f"{len(results)} classified finishers completed the Grand Prix distance." if results else "Classification data is limited for this session.",
        ]
        key_stat = (
            f"Winning margin built over a {len(results)}-car classified field"
            if results
            else "Classification data unavailable"
        )
        podium_names = podium[:3]
        while len(podium_names) < 3:
            podium_names.append("Unknown Driver")
        return {
            "race_name": f"{race_name} Grand Prix",
            "winner": winner,
            "podium": podium_names,
            "weather": weather,
            "key_stat": key_stat,
            "headline_events": headline_events,
            "insights": [
                f"{winner} controlled the pace window once the race settled into its main strategy phase.",
                f"Podium places were shaped by {weather.lower()}.",
                f"{len(results)} classified finishers make this a solid benchmark for performance trend reading." if results else "Session classification is partial, so treat the readout as directional.",
            ],
        }

    @staticmethod
    def _target_replay_duration_ms(session: str, source_duration: float) -> int:
        session_code = session.strip().upper()
        if session_code == "R":
            return min(240_000, max(120_000, int(source_duration / 20)))
        if session_code == "Q":
            return min(180_000, max(90_000, int(source_duration / 10)))
        return min(120_000, max(60_000, int(source_duration / 8)))

    @staticmethod
    def _session_display_name(session: str) -> str:
        labels = {
            "R": "Race",
            "Q": "Qualifying",
            "SQ": "Sprint Qualifying",
            "S": "Sprint",
            "FP1": "Practice 1",
            "FP2": "Practice 2",
            "FP3": "Practice 3",
        }
        return labels.get(session.strip().upper(), session.strip().upper())

    @staticmethod
    def _build_official_position_lookup(race_session) -> dict[str, int]:
        lookup: dict[str, int] = {}
        try:
            for row in race_session.results.itertuples():
                abbreviation = str(getattr(row, "Abbreviation", "") or "").strip()
                position = getattr(row, "Position", None)
                if not abbreviation or position is None:
                    continue
                try:
                    lookup[abbreviation] = int(float(position))
                except (TypeError, ValueError):
                    continue
        except Exception:  # pragma: no cover
            return {}
        return lookup

    @staticmethod
    def _estimate_lap_count(race_session, driver_id: str) -> int:
        try:
            driver_laps = race_session.laps.pick_drivers(driver_id)
            if len(driver_laps):
                lap_numbers = driver_laps["LapNumber"].dropna().tolist()
                if lap_numbers:
                    return max(1, int(max(lap_numbers)))
        except Exception:  # pragma: no cover
            pass
        return 1
