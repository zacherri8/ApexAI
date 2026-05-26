from __future__ import annotations

from datetime import datetime, timezone
import math
import os
from pathlib import Path
import statistics

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
    _session_telemetry_cache: dict[tuple[int, str, str, tuple[str, ...], tuple[str, ...]], dict] = {}
    _lap_telemetry_cache: dict[tuple[int, str, str, str, int], dict | None] = {}
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
    official_corner_names = {
        "silverstone": {
            1: "Abbey",
            2: "Farm Curve",
            3: "Village",
            4: "The Loop",
            5: "Aintree",
            6: "Brooklands",
            7: "Luffield",
            8: "Copse",
        },
        "monza": {
            1: "Rettifilo",
            2: "Curva Grande",
            3: "Roggia",
            4: "Lesmo 1",
            5: "Lesmo 2",
            6: "Ascari",
            7: "Parabolica",
        },
        "monaco": {
            1: "Sainte Devote",
            2: "Beau Rivage",
            3: "Massenet",
            4: "Casino",
            5: "Mirabeau",
            6: "Grand Hotel Hairpin",
            7: "Portier",
            8: "Nouvelle Chicane",
        },
        "australian": {
            1: "Jones",
            2: "Brabham",
            3: "Whiteford",
            4: "Marina",
            5: "Lauda",
            6: "Clark",
            7: "Waite",
            8: "Hill",
        },
        "bahrain": {
            1: "Turn 1",
            2: "Turn 4",
            3: "Turn 8",
            4: "Turn 10",
            5: "Turn 11",
            6: "Turn 13",
            7: "Turn 14",
        },
        "spa": {
            1: "La Source",
            2: "Eau Rouge",
            3: "Raidillon",
            4: "Les Combes",
            5: "Bruxelles",
            6: "Pouhon",
            7: "Stavelot",
            8: "Bus Stop",
        },
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

    def load_session_telemetry(
        self,
        year: int,
        grand_prix: str,
        session: str,
        selected_drivers: list[str] | None = None,
        lap_selections: list[str] | None = None,
    ) -> dict:
        selected_driver_key = tuple(sorted(selected_drivers or []))
        lap_selection_key = tuple(sorted(lap_selections or []))
        key = self._session_key(year, grand_prix, session) + (selected_driver_key, lap_selection_key)
        if key in self._session_telemetry_cache:
            return self._mark_telemetry_cache_hit(self._session_telemetry_cache[key])
        if not fastf1:
            self._session_telemetry_cache[key] = self._empty_telemetry_bundle(
                "fastf1_not_installed",
                ["FastF1 is not importable in this backend environment."],
                self._telemetry_cache_key(year, grand_prix, session, selected_driver_key, lap_selection_key),
            )
            return self._session_telemetry_cache[key]

        race_session = self._load_session(year, grand_prix, session)
        if not race_session:
            self._session_telemetry_cache[key] = self._empty_telemetry_bundle(
                "session_unavailable",
                [f"FastF1 could not load {grand_prix} {year} {session}."],
                self._telemetry_cache_key(year, grand_prix, session, selected_driver_key, lap_selection_key),
            )
            return self._session_telemetry_cache[key]

        selected_lookup = self._parse_lap_selection_entries(lap_selections)
        telemetry: list[dict] = []
        available_drivers: list[str] = []
        lap_options: list[dict] = []
        diagnostics: list[str] = []
        for index, driver_code in enumerate(race_session.drivers, start=1):
            try:
                driver_info = race_session.get_driver(driver_code)
                full_name = str(
                    driver_info.get("FullName")
                    or driver_info.get("BroadcastName")
                    or driver_info.get("Abbreviation")
                    or driver_code
                )
                team_name = str(driver_info.get("TeamName") or "Unknown")
                if selected_drivers and full_name not in selected_drivers:
                    continue
                available_drivers.append(full_name)
                driver_laps = race_session.laps.pick_drivers(driver_code)
                driver_laps = driver_laps[driver_laps["LapTime"].notna()].sort_values("LapTime")
                if driver_laps.empty:
                    diagnostics.append(f"No timed laps available for {full_name}.")
                    continue
                selected_laps = self._pick_selected_laps(driver_laps, selected_lookup, full_name, str(driver_code))
                if not selected_laps:
                    diagnostics.append(f"No selected lap matched for {full_name}.")
                    continue
                lap_options.extend(self._build_lap_options(driver_laps, full_name))
                for selected_lap in selected_laps:
                    lap_payload = self._build_lap_payload(year, grand_prix, session, driver_code, selected_lap)
                    if not lap_payload:
                        diagnostics.append(f"Telemetry stream missing for {full_name} lap {int(getattr(selected_lap, 'LapNumber', 0) or 0)}.")
                        continue
                    points = lap_payload["points"]
                    if not points:
                        diagnostics.append(f"Telemetry stream returned no samples for {full_name} lap {int(getattr(selected_lap, 'LapNumber', 0) or 0)}.")
                        continue
                    lap_number = int(getattr(selected_lap, "LapNumber", 0) or 0) or None
                    lap_time_seconds = self._lap_seconds(getattr(selected_lap, "LapTime", None))
                    label = self._series_label(full_name, lap_number)
                    series_key = self._series_key(driver_code, full_name, lap_number, session)
                    telemetry.append(
                        {
                            "series_key": series_key,
                            "label": label,
                            "driver": full_name,
                            "team": team_name,
                            "color": self._team_color(team_name, index),
                            "lap_number": lap_number,
                            "lap_time_seconds": lap_time_seconds,
                            "compound": str(getattr(selected_lap, "Compound", "") or "") or None,
                            "is_reference": False,
                            "points": points,
                            "track_map_points": lap_payload.get("track_map_points", []),
                            "metrics": self._build_telemetry_metrics(
                                series_key,
                                label,
                                full_name,
                                team_name,
                                points,
                                selected_lap,
                                index,
                            ),
                            "lap_samples": self._extract_lap_time_samples(driver_laps, selected_lap),
                        }
                    )
            except Exception:  # pragma: no cover - FastF1 session irregularities
                diagnostics.append(f"FastF1 could not process driver {driver_code}.")
                continue
        unavailable_reason = self._telemetry_unavailable_reason(telemetry, available_drivers, selected_drivers)
        payload = self._compose_telemetry_bundle(
            race_session,
            grand_prix,
            year,
            session,
            telemetry,
            available_drivers,
            lap_options,
            diagnostics,
            unavailable_reason,
            self._telemetry_cache_key(year, grand_prix, session, selected_driver_key, lap_selection_key),
        )
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

    @staticmethod
    def _parse_lap_selection_entries(selections: list[str] | None) -> list[tuple[str, int]]:
        parsed: list[tuple[str, int]] = []
        for selection in selections or []:
            if ":" not in selection:
                continue
            driver, lap_value = selection.split(":", 1)
            driver = driver.strip()
            try:
                parsed.append((driver, int(lap_value)))
            except (TypeError, ValueError):
                continue
        return parsed

    @staticmethod
    def _pick_selected_laps(
        driver_laps,
        selected_lookup: list[tuple[str, int]],
        full_name: str,
        driver_code: str,
        max_overlays: int = 3,
    ):
        preferred_laps = [
            lap_number
            for driver_name, lap_number in selected_lookup
            if driver_name == full_name or driver_name == driver_code
        ]
        if not preferred_laps:
            return [driver_laps.iloc[0]] if len(driver_laps) else []

        selections = []
        seen_laps: set[int] = set()
        for preferred_lap in preferred_laps:
            if preferred_lap in seen_laps:
                continue
            matching_lap = driver_laps[driver_laps["LapNumber"] == preferred_lap]
            if matching_lap.empty:
                continue
            selections.append(matching_lap.iloc[0])
            seen_laps.add(preferred_lap)
            if len(selections) >= max_overlays:
                break
        return selections or ([driver_laps.iloc[0]] if len(driver_laps) else [])

    @staticmethod
    def _series_label(driver: str, lap_number: int | None) -> str:
        return f"{driver} L{lap_number}" if lap_number else driver

    @staticmethod
    def _series_key(driver_code: str, driver: str, lap_number: int | None, session: str) -> str:
        base = f"{driver_code}-{session}-{lap_number or 'na'}-{driver}".lower()
        return base.replace(" ", "-")

    def _build_lap_options(self, driver_laps, full_name: str, limit: int = 5) -> list[dict]:
        options: list[dict] = []
        for index, lap in enumerate(driver_laps.head(limit).itertuples(), start=1):
            options.append(
                {
                    "driver": full_name,
                    "lap_number": int(getattr(lap, "LapNumber", 0) or 0),
                    "lap_time_seconds": self._lap_seconds(getattr(lap, "LapTime", None)) or 0.0,
                    "compound": str(getattr(lap, "Compound", "") or "") or None,
                    "tyre_life": int(getattr(lap, "TyreLife", 0) or 0) or None,
                    "is_best": index == 1,
                }
            )
        return options

    def _build_lap_payload(self, year: int, grand_prix: str, session: str, driver_code: str, lap) -> dict | None:
        lap_number = int(getattr(lap, "LapNumber", 0) or 0)
        key = (year, grand_prix.strip().lower(), session.strip().upper(), str(driver_code), lap_number)
        if key in self._lap_telemetry_cache:
            return self._lap_telemetry_cache[key]

        try:
            car_data = lap.get_car_data().add_distance()
        except Exception:  # pragma: no cover
            self._lap_telemetry_cache[key] = None
            return None

        steering_samples = self._build_steering_samples(lap)
        track_map_points = self._build_track_map_points(lap, car_data)
        points = self._downsample_telemetry_points(
            [
                {
                    "time": round(float(getattr(row, "Time").total_seconds()), 3),
                    "distance": float(row.Distance),
                    "speed": float(row.Speed),
                    "throttle": float(row.Throttle),
                    "brake": float(row.Brake),
                    "gear": int(row.nGear),
                    "drs": int(getattr(row, "DRS", 0)) if getattr(row, "DRS", None) is not None else None,
                    "rpm": int(getattr(row, "RPM", 0)) if getattr(row, "RPM", None) is not None else None,
                    "steering": self._interpolate_steering(
                        steering_samples,
                        float(getattr(row, "Time").total_seconds()),
                    ),
                }
                for row in car_data.itertuples()
                if hasattr(getattr(row, "Time", None), "total_seconds")
            ]
        )
        payload = {"points": points, "track_map_points": track_map_points}
        self._lap_telemetry_cache[key] = payload
        return payload

    @staticmethod
    def _build_steering_samples(lap) -> list[dict]:
        get_pos_data = getattr(lap, "get_pos_data", None)
        if not callable(get_pos_data):
            return []
        try:
            pos_data = get_pos_data()
        except Exception:  # pragma: no cover
            return []
        if pos_data is None or getattr(pos_data, "empty", True):
            return []

        points: list[dict] = []
        for row in pos_data.itertuples():
            timestamp_value = getattr(row, "Time", None)
            if not hasattr(timestamp_value, "total_seconds"):
                continue
            points.append(
                {
                    "time": float(timestamp_value.total_seconds()),
                    "x": float(getattr(row, "X", 0.0)),
                    "y": float(getattr(row, "Y", 0.0)),
                }
            )
        if len(points) < 3:
            return []

        headings: list[float] = []
        for index in range(1, len(points)):
            dx = points[index]["x"] - points[index - 1]["x"]
            dy = points[index]["y"] - points[index - 1]["y"]
            headings.append(math.degrees(math.atan2(dy, dx)))

        samples: list[dict] = []
        for index in range(1, len(points) - 1):
            previous_heading = headings[index - 1]
            next_heading = headings[index]
            delta = next_heading - previous_heading
            while delta > 180:
                delta -= 360
            while delta < -180:
                delta += 360
            samples.append({"time": points[index]["time"], "steering": max(-100.0, min(100.0, delta * 2.5))})
        return samples

    @staticmethod
    def _interpolate_steering(samples: list[dict], target_time: float) -> float | None:
        if not samples:
            return None
        if target_time <= samples[0]["time"]:
            return round(samples[0]["steering"], 2)
        if target_time >= samples[-1]["time"]:
            return round(samples[-1]["steering"], 2)
        for index in range(1, len(samples)):
            after = samples[index]
            before = samples[index - 1]
            if after["time"] >= target_time:
                span = max(after["time"] - before["time"], 1e-6)
                ratio = (target_time - before["time"]) / span
                return round(before["steering"] + (after["steering"] - before["steering"]) * ratio, 2)
        return round(samples[-1]["steering"], 2)

    @staticmethod
    def _extract_lap_time_samples(driver_laps, selected_lap, limit: int = 5) -> list[float]:
        samples = [
            value
            for value in (
                FastF1Service._lap_seconds(getattr(lap, "LapTime", None))
                for lap in driver_laps.head(limit).itertuples()
            )
            if value is not None
        ]
        selected_seconds = FastF1Service._lap_seconds(getattr(selected_lap, "LapTime", None))
        if selected_seconds is not None and selected_seconds not in samples:
            samples.insert(0, selected_seconds)
        return samples[:limit]

    @staticmethod
    def _build_track_map_points(lap, car_data, limit: int = 180) -> list[dict]:
        get_pos_data = getattr(lap, "get_pos_data", None)
        if not callable(get_pos_data):
            return []
        try:
            pos_data = get_pos_data()
        except Exception:  # pragma: no cover
            return []
        if pos_data is None or getattr(pos_data, "empty", True):
            return []

        distance_samples: list[tuple[float, float]] = []
        for row in car_data.itertuples():
            timestamp_value = getattr(row, "Time", None)
            if not hasattr(timestamp_value, "total_seconds"):
                continue
            distance_samples.append((float(timestamp_value.total_seconds()), float(getattr(row, "Distance", 0.0))))
        if len(distance_samples) < 2:
            return []

        raw_points: list[dict] = []
        for row in pos_data.itertuples():
            timestamp_value = getattr(row, "Time", None)
            if not hasattr(timestamp_value, "total_seconds"):
                continue
            time_value = float(timestamp_value.total_seconds())
            raw_points.append(
                {
                    "time": time_value,
                    "x": float(getattr(row, "X", 0.0)),
                    "y": float(getattr(row, "Y", 0.0)),
                    "distance": FastF1Service._interpolate_distance(distance_samples, time_value),
                }
            )
        if len(raw_points) < 5:
            return []

        xs = [point["x"] for point in raw_points]
        ys = [point["y"] for point in raw_points]
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        span_x = max(max_x - min_x, 1e-6)
        span_y = max(max_y - min_y, 1e-6)

        normalized = [
          {
              "x": round(((point["x"] - min_x) / span_x) * 100, 2),
              "y": round(100 - ((point["y"] - min_y) / span_y) * 100, 2),
              "distance": round(point["distance"], 1),
          }
          for point in raw_points
        ]

        if len(normalized) <= limit:
            return normalized
        step = max(1, len(normalized) // limit)
        reduced = normalized[::step]
        if reduced[-1] != normalized[-1]:
            reduced.append(normalized[-1])
        return reduced

    @staticmethod
    def _interpolate_distance(distance_samples: list[tuple[float, float]], target_time: float) -> float:
        if target_time <= distance_samples[0][0]:
            return distance_samples[0][1]
        if target_time >= distance_samples[-1][0]:
            return distance_samples[-1][1]
        for index in range(1, len(distance_samples)):
            after_time, after_distance = distance_samples[index]
            before_time, before_distance = distance_samples[index - 1]
            if after_time >= target_time:
                span = max(after_time - before_time, 1e-6)
                ratio = (target_time - before_time) / span
                return before_distance + (after_distance - before_distance) * ratio
        return distance_samples[-1][1]

    def _compose_telemetry_bundle(
        self,
        race_session,
        grand_prix: str,
        year: int,
        session: str,
        telemetry: list[dict],
        available_drivers: list[str],
        lap_options: list[dict],
        diagnostics: list[str] | None = None,
        unavailable_reason: str | None = None,
        cache_key: str | None = None,
    ) -> dict:
        series = list(telemetry)
        series.sort(key=lambda item: item["metrics"]["fastest_lap_seconds"] or float("inf"))
        if series:
            series[0]["is_reference"] = True

        metrics = [item["metrics"] for item in series]
        micro_sectors = self._build_micro_sectors(series)
        corner_breakdown = self._build_corner_breakdown(series, grand_prix)
        performance = self._build_performance_summary(series, corner_breakdown)
        benchmark_rankings = self._build_benchmark_rankings(series, corner_breakdown)
        pair_deltas = self._build_pair_deltas(series, corner_breakdown)
        track_map = self._build_track_map(series, corner_breakdown)
        return {
            "series": series,
            "metrics": metrics,
            "available_drivers": sorted(set(available_drivers)),
            "lap_options": lap_options,
            "micro_sectors": micro_sectors,
            "corner_breakdown": corner_breakdown,
            "performance": performance,
            "benchmark_rankings": benchmark_rankings,
            "pair_deltas": pair_deltas,
            "track_map": track_map,
            "weather": self._describe_weather(race_session),
            "session_summary": self._build_telemetry_summary(race_session, grand_prix, year, session, telemetry),
            "insights": self._build_telemetry_insights(metrics, None, self._describe_weather(race_session)),
            "unavailable_reason": unavailable_reason,
            "cache_metadata": {
                "cache_hit": False,
                "cache_key": cache_key,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "series_count": len(series),
                "unavailable_reason": unavailable_reason,
                "diagnostics": diagnostics or [],
            },
        }

    @staticmethod
    def _build_track_map(series: list[dict], corner_breakdown: list[dict]) -> dict:
        if not series:
            return {"points": [], "corners": []}
        reference = series[0]
        points = reference.get("track_map_points") or []
        if not points:
            return {"points": [], "corners": []}

        corners: list[dict] = []
        for corner in corner_breakdown:
            distance = float(corner["apex_distance"])
            nearest = min(points, key=lambda point: abs(point["distance"] - distance))
            corners.append(
                {
                    "corner": corner["corner"],
                    "corner_label": corner.get("corner_label"),
                    "corner_hint": corner.get("corner_hint"),
                    "official_corner_name": corner.get("official_corner_name"),
                    "corner_type": corner["corner_type"],
                    "confidence_score": corner.get("confidence_score"),
                    "distance": round(distance, 1),
                    "x": nearest["x"],
                    "y": nearest["y"],
                }
            )
        return {"points": points, "corners": corners}

    def _build_micro_sectors(self, series: list[dict], segments: int = 12) -> list[dict]:
        if not series:
            return []
        max_distance = min((item["points"][-1]["distance"] for item in series if item["points"]), default=0.0)
        if max_distance <= 0:
            return []
        edges = [max_distance * segment / segments for segment in range(segments + 1)]
        output: list[dict] = []
        reference = series[0]
        series_metadata = {
            item["label"]: {
                "series_key": item["series_key"],
                "driver": item["driver"],
                "label": item["label"],
            }
            for item in series
        }
        for segment in range(segments):
            start_distance = edges[segment]
            end_distance = edges[segment + 1]
            segment_times: dict[str, float] = {}
            segment_speeds: dict[str, float] = {}
            for item in series:
                start_time = self._time_at_distance(item["points"], start_distance)
                end_time = self._time_at_distance(item["points"], end_distance)
                speed = self._value_at_distance(item["points"], (start_distance + end_distance) / 2, "speed")
                if start_time is None or end_time is None or speed is None:
                    continue
                segment_times[item["label"]] = max(0.0, round(end_time - start_time, 4))
                segment_speeds[item["label"]] = speed
            if not segment_times:
                continue
            best_time = min(segment_times.values())
            corner_type = self._corner_type_from_speed(segment_speeds.get(reference["label"], min(segment_speeds.values())))
            for driver, time_seconds in segment_times.items():
                metadata = series_metadata.get(driver, {})
                output.append(
                    {
                        "driver": metadata.get("driver", driver),
                        "label": metadata.get("label", driver),
                        "series_key": metadata.get("series_key", driver.lower().replace(" ", "-")),
                        "segment": segment + 1,
                        "start_distance": round(start_distance, 1),
                        "end_distance": round(end_distance, 1),
                        "time_seconds": round(time_seconds, 4),
                        "delta_to_best": round(time_seconds - best_time, 4),
                        "corner_type": corner_type,
                    }
                )
        return output

    def _build_corner_breakdown(self, series: list[dict], grand_prix: str | None = None) -> list[dict]:
        if not series:
            return []
        reference = series[0]
        reference_points = reference["points"]
        zones = self._detect_corner_zones(reference_points)
        if not zones:
            return []

        output: list[dict] = []
        for corner_index, (zone_start, zone_end) in enumerate(zones[:8], start=1):
            zone = reference_points[zone_start : zone_end + 1]
            apex_point = min(zone, key=lambda point: point["speed"])
            start_distance = max(0.0, zone[0]["distance"] - 50)
            apex_distance = apex_point["distance"]
            end_distance = min(reference_points[-1]["distance"], zone[-1]["distance"] + 70)
            confidence = self._corner_confidence(zone, start_distance, apex_distance, end_distance)
            official_name = self._official_corner_name(grand_prix or "", corner_index)
            entry_times: dict[str, float] = {}
            apex_times: dict[str, float] = {}
            exit_times: dict[str, float] = {}
            braking_map: dict[str, float] = {}
            throttle_map: dict[str, float] = {}
            for item in series:
                points = item["points"]
                entry_start = self._time_at_distance(points, start_distance)
                apex_time = self._time_at_distance(points, apex_distance)
                exit_time = self._time_at_distance(points, end_distance)
                if entry_start is None or apex_time is None or exit_time is None:
                    continue
                braking_point = round(self._braking_point(points, start_distance, apex_distance), 1)
                throttle_pickup = round(self._throttle_pickup(points, apex_distance, end_distance), 1)
                braking_map[item["label"]] = braking_point
                throttle_map[item["label"]] = throttle_pickup

                entry_end_distance, apex_end_distance = self._phase_distances(
                    start_distance,
                    apex_distance,
                    end_distance,
                    braking_point,
                    throttle_pickup,
                )
                entry_end_time = self._time_at_distance(points, entry_end_distance)
                apex_end_time = self._time_at_distance(points, apex_end_distance)
                if entry_end_time is None or apex_end_time is None:
                    continue

                entry_times[item["label"]] = max(0.0, entry_end_time - entry_start)
                apex_times[item["label"]] = max(0.0, apex_end_time - entry_end_time)
                exit_times[item["label"]] = max(0.0, exit_time - apex_end_time)
            if not entry_times:
                continue
            best_entry = min(entry_times.values())
            best_apex = min(apex_times.values())
            best_exit = min(exit_times.values())
            output.append(
                {
                    "corner": f"T{corner_index}",
                    "corner_label": self._corner_label(corner_index, apex_point, start_distance, end_distance, official_name),
                    "corner_hint": self._corner_hint(apex_point, start_distance, end_distance, official_name),
                    "official_corner_name": official_name,
                    "corner_type": self._corner_type_from_speed(apex_point["speed"]),
                    "confidence_score": confidence,
                    "segmentation_quality": self._segmentation_quality(confidence),
                    "start_distance": round(start_distance, 1),
                    "apex_distance": round(apex_distance, 1),
                    "end_distance": round(end_distance, 1),
                    "entry_delta": {driver: round(value - best_entry, 4) for driver, value in entry_times.items()},
                    "apex_delta": {driver: round(value - best_apex, 4) for driver, value in apex_times.items()},
                    "exit_delta": {driver: round(value - best_exit, 4) for driver, value in exit_times.items()},
                    "braking_points": braking_map,
                    "throttle_pickups": throttle_map,
                }
            )
        return output

    @staticmethod
    def _detect_corner_zones(reference_points: list[dict]) -> list[tuple[int, int]]:
        if not reference_points:
            return []

        raw_zones: list[tuple[int, int]] = []
        start_index: int | None = None
        for index, point in enumerate(reference_points):
            brake = float(point.get("brake") or 0.0)
            throttle = float(point.get("throttle") or 0.0)
            steering = abs(float(point.get("steering") or 0.0))
            speed = float(point.get("speed") or 0.0)
            activity = brake > 8 or steering > 16 or (throttle < 45 and speed < 215)

            if activity and start_index is None:
                start_index = index
            elif not activity and start_index is not None:
                if index - start_index >= 4:
                    raw_zones.append((start_index, index - 1))
                start_index = None

        if start_index is not None and len(reference_points) - start_index >= 4:
            raw_zones.append((start_index, len(reference_points) - 1))

        if not raw_zones:
            return []

        merged: list[tuple[int, int]] = [raw_zones[0]]
        for zone_start, zone_end in raw_zones[1:]:
            previous_start, previous_end = merged[-1]
            if zone_start - previous_end <= 6:
                merged[-1] = (previous_start, zone_end)
            else:
                merged.append((zone_start, zone_end))

        filtered: list[tuple[int, int]] = []
        last_apex_distance = -1_000.0
        for zone_start, zone_end in merged:
            zone = reference_points[zone_start : zone_end + 1]
            apex_point = min(zone, key=lambda point: point["speed"])
            apex_distance = float(apex_point["distance"])
            if apex_distance - last_apex_distance < 120:
                continue
            filtered.append((zone_start, zone_end))
            last_apex_distance = apex_distance

        return filtered

    @staticmethod
    def _phase_distances(
        start_distance: float,
        apex_distance: float,
        end_distance: float,
        braking_point: float,
        throttle_pickup: float,
    ) -> tuple[float, float]:
        entry_end = braking_point if start_distance + 8 < braking_point < apex_distance - 5 else start_distance + (apex_distance - start_distance) * 0.55
        apex_end = throttle_pickup if apex_distance + 5 < throttle_pickup < end_distance - 8 else apex_distance + (end_distance - apex_distance) * 0.45

        entry_end = max(start_distance + 5, min(entry_end, apex_distance - 3))
        apex_end = max(entry_end + 3, min(apex_end, end_distance - 5))

        return round(entry_end, 1), round(apex_end, 1)

    def _build_performance_summary(self, series: list[dict], corner_breakdown: list[dict] | None = None) -> list[dict]:
        summaries: list[dict] = []
        ranked_series = sorted(
            [item for item in series if item["metrics"].get("fastest_lap_seconds") is not None],
            key=lambda item: item["metrics"]["fastest_lap_seconds"],
        )
        rank_by_label = {item["label"]: index + 1 for index, item in enumerate(ranked_series)}
        best_lap = ranked_series[0]["metrics"]["fastest_lap_seconds"] if ranked_series else None
        corner_focus = self._corner_focus_by_label(corner_breakdown or [])

        for item in series:
            metric = item["metrics"]
            lap_samples = item.get("lap_samples", [])
            consistency = self._consistency_score(lap_samples)
            braking_style = "Aggressive" if metric["brake_pct"] > 20 else "Smooth" if metric["brake_pct"] < 13 else "Balanced"
            throttle_style = "Early throttle" if metric["average_throttle"] >= 72 else "Measured throttle" if metric["average_throttle"] >= 60 else "Late throttle"
            corner_profile = self._dominant_corner_profile(item["points"])
            mistakes = self._detect_mistakes(item["points"], metric, consistency)
            lap_time = metric.get("fastest_lap_seconds")
            lap_rank = rank_by_label.get(item["label"])
            delta_to_best = round(lap_time - best_lap, 3) if lap_time is not None and best_lap is not None else None
            focus = corner_focus.get(item["label"])
            if focus:
                mistakes.append(f"Benchmark deficit peaks at {focus['corner_label']}")
            coaching_focus = self._coaching_focus(metric, focus, braking_style, throttle_style)
            benchmark_summary = (
                f"P{lap_rank} of {len(ranked_series)} selected traces"
                + (f", {delta_to_best:+.3f}s to the benchmark lap." if delta_to_best is not None else ".")
                if lap_rank
                else "Lap benchmark rank unavailable for this trace."
            )
            summaries.append(
                {
                    "series_key": item["series_key"],
                    "label": item["label"],
                    "driver": item["driver"],
                    "lap_rank": lap_rank,
                    "delta_to_best_seconds": delta_to_best,
                    "benchmark_summary": benchmark_summary,
                    "coaching_focus": coaching_focus,
                    "braking_style": braking_style,
                    "throttle_style": throttle_style,
                    "corner_profile": corner_profile,
                    "consistency_score": round(consistency, 1),
                    "mistakes": mistakes[:3],
                    "summary": (
                        f"{item['label']} is {benchmark_summary.lower()} "
                        f"The coaching read is {coaching_focus.lower()}"
                    ),
                }
            )
        return summaries

    def _build_benchmark_rankings(self, series: list[dict], corner_breakdown: list[dict]) -> list[dict]:
        if not series:
            return []

        lap_rank = self._rank_series(series, lambda item: item["metrics"].get("fastest_lap_seconds"), lower_is_better=True)
        straight_rank = self._rank_series(series, lambda item: item["metrics"].get("top_speed"), lower_is_better=False)
        consistency_rank = self._rank_series(series, lambda item: self._consistency_score(item.get("lap_samples", [])), lower_is_better=False)
        phase_rankings = self._phase_rankings(series, corner_breakdown)
        best_lap = min(
            (item["metrics"].get("fastest_lap_seconds") for item in series if item["metrics"].get("fastest_lap_seconds") is not None),
            default=None,
        )
        focus = self._corner_focus_by_label(corner_breakdown)
        rankings: list[dict] = []
        for item in series:
            metric = item["metrics"]
            lap_time = metric.get("fastest_lap_seconds")
            delta = round(lap_time - best_lap, 3) if lap_time is not None and best_lap is not None else None
            loss = focus.get(item["label"])
            main_loss_corner = loss.get("corner_label") if loss and loss.get("total", 0) > 0.02 else None
            main_loss_seconds = round(loss["total"], 4) if loss and loss.get("total", 0) > 0.02 else None
            summary = (
                f"{item['label']} ranks P{lap_rank.get(item['label'], '--')} on selected-lap pace"
                + (f" and is {delta:+.3f}s from the selected benchmark." if delta is not None else ".")
            )
            if main_loss_corner:
                summary += f" Main backend-identified loss is {main_loss_corner}."
            rankings.append(
                {
                    "series_key": item["series_key"],
                    "label": item["label"],
                    "driver": item["driver"],
                    "overall_rank": lap_rank.get(item["label"]),
                    "lap_delta_to_best": delta,
                    "braking_rank": phase_rankings["entry"].get(item["label"]),
                    "apex_rank": phase_rankings["apex"].get(item["label"]),
                    "exit_rank": phase_rankings["exit"].get(item["label"]),
                    "straight_line_rank": straight_rank.get(item["label"]),
                    "consistency_rank": consistency_rank.get(item["label"]),
                    "main_loss_corner": main_loss_corner,
                    "main_loss_seconds": main_loss_seconds,
                    "summary": summary,
                }
            )
        return sorted(rankings, key=lambda item: item.get("overall_rank") or 999)

    @staticmethod
    def _rank_series(series: list[dict], value_getter, lower_is_better: bool = True) -> dict[str, int]:
        rows = []
        for item in series:
            value = value_getter(item)
            if value is None:
                continue
            rows.append((item["label"], float(value)))
        rows.sort(key=lambda row: row[1], reverse=not lower_is_better)
        return {label: index + 1 for index, (label, _) in enumerate(rows)}

    @staticmethod
    def _phase_rankings(series: list[dict], corner_breakdown: list[dict]) -> dict[str, dict[str, int]]:
        labels = [item["label"] for item in series]
        phase_totals = {
            "entry": {label: 0.0 for label in labels},
            "apex": {label: 0.0 for label in labels},
            "exit": {label: 0.0 for label in labels},
        }
        phase_keys = {"entry": "entry_delta", "apex": "apex_delta", "exit": "exit_delta"}
        for corner in corner_breakdown:
            for phase, key in phase_keys.items():
                for label in labels:
                    phase_totals[phase][label] += float(corner.get(key, {}).get(label, 0.0) or 0.0)
        rankings: dict[str, dict[str, int]] = {}
        for phase, totals in phase_totals.items():
            sorted_rows = sorted(totals.items(), key=lambda row: row[1])
            rankings[phase] = {label: index + 1 for index, (label, _) in enumerate(sorted_rows)}
        return rankings

    @staticmethod
    def _build_pair_deltas(series: list[dict], corner_breakdown: list[dict]) -> list[dict]:
        if len(series) < 2:
            return []

        output: list[dict] = []
        for reference in series:
            for comparison in series:
                if reference["series_key"] == comparison["series_key"]:
                    continue
                reference_lap = reference["metrics"].get("fastest_lap_seconds")
                comparison_lap = comparison["metrics"].get("fastest_lap_seconds")
                corner_deltas: list[dict] = []
                for corner in corner_breakdown:
                    entry_delta = float(corner.get("entry_delta", {}).get(comparison["label"], 0.0) or 0.0) - float(corner.get("entry_delta", {}).get(reference["label"], 0.0) or 0.0)
                    apex_delta = float(corner.get("apex_delta", {}).get(comparison["label"], 0.0) or 0.0) - float(corner.get("apex_delta", {}).get(reference["label"], 0.0) or 0.0)
                    exit_delta = float(corner.get("exit_delta", {}).get(comparison["label"], 0.0) or 0.0) - float(corner.get("exit_delta", {}).get(reference["label"], 0.0) or 0.0)
                    braking_reference = corner.get("braking_points", {}).get(reference["label"])
                    braking_comparison = corner.get("braking_points", {}).get(comparison["label"])
                    throttle_reference = corner.get("throttle_pickups", {}).get(reference["label"])
                    throttle_comparison = corner.get("throttle_pickups", {}).get(comparison["label"])
                    corner_deltas.append(
                        {
                            "corner": corner.get("corner", ""),
                            "corner_label": corner.get("corner_label"),
                            "corner_type": corner.get("corner_type", "Mixed"),
                            "total_delta": round(entry_delta + apex_delta + exit_delta, 4),
                            "entry_delta": round(entry_delta, 4),
                            "apex_delta": round(apex_delta, 4),
                            "exit_delta": round(exit_delta, 4),
                            "braking_point_delta": round(float(braking_comparison) - float(braking_reference), 1)
                            if braking_reference is not None and braking_comparison is not None
                            else None,
                            "throttle_pickup_delta": round(float(throttle_comparison) - float(throttle_reference), 1)
                            if throttle_reference is not None and throttle_comparison is not None
                            else None,
                        }
                    )
                biggest_gain = min(corner_deltas, key=lambda item: item["total_delta"], default=None)
                biggest_loss = max(corner_deltas, key=lambda item: item["total_delta"], default=None)
                lap_delta = round(comparison_lap - reference_lap, 3) if reference_lap is not None and comparison_lap is not None else None
                output.append(
                    {
                        "reference_series_key": reference["series_key"],
                        "reference_label": reference["label"],
                        "comparison_series_key": comparison["series_key"],
                        "comparison_label": comparison["label"],
                        "lap_delta": lap_delta,
                        "corner_deltas": corner_deltas,
                        "biggest_gain_corner": biggest_gain.get("corner_label") if biggest_gain else None,
                        "biggest_loss_corner": biggest_loss.get("corner_label") if biggest_loss else None,
                        "summary": (
                            f"{comparison['label']} is {lap_delta:+.3f}s versus {reference['label']}."
                            if lap_delta is not None
                            else f"{comparison['label']} versus {reference['label']} has no complete lap-time delta."
                        ),
                    }
                )
        return output

    @staticmethod
    def _corner_shape(point: dict) -> str:
        speed = float(point.get("speed") or 0.0)
        steering = float(point.get("steering") or 0.0)
        direction = "left" if steering < -3 else "right" if steering > 3 else "balanced"
        if speed < 115:
            shape = "stop"
        elif speed < 180:
            shape = "bend"
        else:
            shape = "sweep"
        return f"{direction} {shape}" if direction != "balanced" else shape

    def _corner_label(
        self,
        corner_index: int,
        apex_point: dict,
        start_distance: float,
        end_distance: float,
        official_name: str | None = None,
    ) -> str:
        corner_type = self._corner_type_from_speed(apex_point["speed"])
        shape = self._corner_shape(apex_point).title()
        length = max(0.0, end_distance - start_distance)
        zone = "complex" if length > 260 else "corner"
        base_label = f"T{corner_index} {corner_type} {shape} {zone}"
        return f"{base_label} - {official_name}" if official_name else base_label

    def _corner_hint(
        self,
        apex_point: dict,
        start_distance: float,
        end_distance: float,
        official_name: str | None = None,
    ) -> str:
        apex_km = float(apex_point.get("distance") or 0.0) / 1000
        length = max(0.0, end_distance - start_distance)
        name_prefix = f"{official_name}: " if official_name else ""
        return f"{name_prefix}{self._corner_shape(apex_point).title()} at {apex_km:.2f} km, {length:.0f} m analysis window"

    @classmethod
    def _official_corner_name(cls, grand_prix: str, corner_index: int) -> str | None:
        normalized = grand_prix.strip().lower()
        for key, corner_names in cls.official_corner_names.items():
            if key in normalized:
                return corner_names.get(corner_index)
        return None

    @staticmethod
    def _corner_confidence(zone: list[dict], start_distance: float, apex_distance: float, end_distance: float) -> float:
        if not zone:
            return 0.0
        speeds = [float(point.get("speed") or 0.0) for point in zone]
        steering_samples = [abs(float(point.get("steering") or 0.0)) for point in zone]
        brake_samples = [float(point.get("brake") or 0.0) for point in zone]
        throttle_samples = [float(point.get("throttle") or 0.0) for point in zone]
        speed_drop = max(speeds, default=0.0) - min(speeds, default=0.0)
        window_length = max(1.0, end_distance - start_distance)
        apex_balance = 1.0 - min(1.0, abs((apex_distance - start_distance) / window_length - 0.5) * 1.6)
        activity_ratio = sum(
            1
            for brake, throttle, steering, speed in zip(brake_samples, throttle_samples, steering_samples, speeds)
            if brake > 8 or steering > 16 or (throttle < 45 and speed < 215)
        ) / max(len(zone), 1)
        sample_score = min(1.0, len(zone) / 10)
        speed_score = min(1.0, speed_drop / 80)
        confidence = (sample_score * 0.25) + (speed_score * 0.25) + (activity_ratio * 0.3) + (apex_balance * 0.2)
        return round(max(0.0, min(1.0, confidence)) * 100, 1)

    @staticmethod
    def _segmentation_quality(confidence: float) -> str:
        if confidence >= 78:
            return "high"
        if confidence >= 55:
            return "medium"
        return "low"

    @staticmethod
    def _corner_focus_by_label(corner_breakdown: list[dict]) -> dict[str, dict]:
        focus: dict[str, dict] = {}
        for corner in corner_breakdown:
            phase_maps = [corner.get("entry_delta", {}), corner.get("apex_delta", {}), corner.get("exit_delta", {})]
            labels = set().union(*(phase_map.keys() for phase_map in phase_maps))
            for label in labels:
                total = sum(float(phase_map.get(label, 0.0) or 0.0) for phase_map in phase_maps)
                current = focus.get(label)
                if current is None or total > current["total"]:
                    focus[label] = {
                        "total": total,
                        "corner": corner.get("corner", ""),
                        "corner_label": corner.get("corner_label") or corner.get("corner", ""),
                        "corner_type": corner.get("corner_type", "Mixed"),
                    }
        return focus

    @staticmethod
    def _coaching_focus(metric: dict, focus: dict | None, braking_style: str, throttle_style: str) -> str:
        focus_text = (
            f"prioritize {focus['corner_label']} where the trace gives away {focus['total']:.3f}s"
            if focus and focus.get("total", 0) > 0.03
            else "protect the current corner baseline because no single corner dominates the loss"
        )
        if braking_style == "Aggressive":
            return f"{focus_text}; release brake pressure more progressively before the apex."
        if throttle_style == "Late throttle":
            return f"{focus_text}; bring throttle pickup earlier once steering starts unwinding."
        if metric.get("gear_changes", 0) > 18:
            return f"{focus_text}; simplify the gear sequence through the slowest phase."
        return f"{focus_text}; keep the same entry shape and look for cleaner exit commitment."

    @staticmethod
    def _consistency_score(lap_samples: list[float]) -> float:
        if len(lap_samples) < 2:
            return 100.0
        stdev = statistics.pstdev(lap_samples)
        return max(0.0, min(100.0, 100 - (stdev * 120)))

    @staticmethod
    def _dominant_corner_profile(points: list[dict]) -> str:
        if not points:
            return "Mixed"
        speeds = [point["speed"] for point in points]
        avg_speed = sum(speeds) / max(len(speeds), 1)
        return FastF1Service._corner_type_from_speed(avg_speed)

    def _detect_mistakes(self, points: list[dict], metric: dict, consistency: float) -> list[str]:
        mistakes: list[str] = []
        if metric["brake_pct"] > 23:
            mistakes.append("Over-braking trend in heavier stops")
        if metric["average_throttle"] < 58:
            mistakes.append("Late throttle application on corner exits")
        if metric["gear_changes"] > 18:
            mistakes.append("Busy low-speed balance with extra gear corrections")
        if consistency < 94:
            mistakes.append("Lap execution variance is higher than the session baseline")
        steering_peaks = [abs(point.get("steering") or 0) for point in points]
        if steering_peaks and max(steering_peaks) > 70:
            mistakes.append("Potential missed-apex corrections through peak steering zones")
        return mistakes[:3]

    @staticmethod
    def _time_at_distance(points: list[dict], distance: float) -> float | None:
        if not points:
            return None
        if distance <= points[0]["distance"]:
            return points[0]["time"]
        if distance >= points[-1]["distance"]:
            return points[-1]["time"]
        for index in range(1, len(points)):
            after = points[index]
            before = points[index - 1]
            if after["distance"] >= distance:
                span = max(after["distance"] - before["distance"], 1e-6)
                ratio = (distance - before["distance"]) / span
                return before["time"] + (after["time"] - before["time"]) * ratio
        return points[-1]["time"]

    @staticmethod
    def _value_at_distance(points: list[dict], distance: float, key: str) -> float | None:
        if not points:
            return None
        if distance <= points[0]["distance"]:
            return float(points[0].get(key) or 0.0)
        if distance >= points[-1]["distance"]:
            return float(points[-1].get(key) or 0.0)
        for index in range(1, len(points)):
            after = points[index]
            before = points[index - 1]
            if after["distance"] >= distance:
                span = max(after["distance"] - before["distance"], 1e-6)
                ratio = (distance - before["distance"]) / span
                before_value = float(before.get(key) or 0.0)
                after_value = float(after.get(key) or 0.0)
                return before_value + (after_value - before_value) * ratio
        return float(points[-1].get(key) or 0.0)

    @staticmethod
    def _corner_type_from_speed(speed: float) -> str:
        if speed < 120:
            return "Slow"
        if speed < 200:
            return "Medium"
        return "Fast"

    def _braking_point(self, points: list[dict], start_distance: float, apex_distance: float) -> float:
        for point in points:
            if start_distance <= point["distance"] <= apex_distance and point["brake"] > 10:
                return point["distance"]
        return apex_distance

    def _throttle_pickup(self, points: list[dict], apex_distance: float, end_distance: float) -> float:
        for point in points:
            if apex_distance <= point["distance"] <= end_distance and point["throttle"] > 60:
                return point["distance"]
        return end_distance

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

    @staticmethod
    def _empty_telemetry_bundle(
        unavailable_reason: str = "telemetry_unavailable",
        diagnostics: list[str] | None = None,
        cache_key: str | None = None,
    ) -> dict:
        return {
            "series": [],
            "metrics": [],
            "available_drivers": [],
            "lap_options": [],
            "micro_sectors": [],
            "corner_breakdown": [],
            "performance": [],
            "benchmark_rankings": [],
            "pair_deltas": [],
            "track_map": {"points": [], "corners": []},
            "cache_metadata": {
                "cache_hit": False,
                "cache_key": cache_key,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "series_count": 0,
                "unavailable_reason": unavailable_reason,
                "diagnostics": diagnostics or [],
            },
            "unavailable_reason": unavailable_reason,
            "weather": None,
            "session_summary": None,
            "insights": [],
        }

    @staticmethod
    def _mark_telemetry_cache_hit(payload: dict) -> dict:
        cached = {**payload}
        metadata = {**cached.get("cache_metadata", {})}
        metadata["cache_hit"] = True
        cached["cache_metadata"] = metadata
        return cached

    @staticmethod
    def _telemetry_cache_key(
        year: int,
        grand_prix: str,
        session: str,
        selected_driver_key: tuple[str, ...],
        lap_selection_key: tuple[str, ...],
    ) -> str:
        drivers = ",".join(selected_driver_key) if selected_driver_key else "all"
        laps = ",".join(lap_selection_key) if lap_selection_key else "fastest"
        return f"{year}:{grand_prix.strip().lower()}:{session.strip().upper()}:drivers={drivers}:laps={laps}"

    @staticmethod
    def _telemetry_unavailable_reason(
        telemetry: list[dict],
        available_drivers: list[str],
        selected_drivers: list[str] | None,
    ) -> str | None:
        if telemetry:
            return None
        if selected_drivers and not available_drivers:
            return "selected_drivers_unavailable"
        if available_drivers:
            return "telemetry_stream_missing"
        return "driver_roster_unavailable"

    @staticmethod
    def _downsample_telemetry_points(points: list[dict], limit: int = 240) -> list[dict]:
        if len(points) <= limit:
            return points
        step = max(1, len(points) // limit)
        reduced = points[::step]
        if reduced[-1] != points[-1]:
            reduced.append(points[-1])
        return reduced

    def _build_telemetry_metrics(
        self,
        series_key: str,
        label: str,
        driver: str,
        team: str,
        points: list[dict],
        lap,
        index: int,
    ) -> dict:
        speeds = [point["speed"] for point in points]
        throttles = [point["throttle"] for point in points]
        brakes = [point["brake"] for point in points]
        drs_samples = [point["drs"] for point in points if point["drs"] is not None]
        rpm_samples = [point["rpm"] for point in points if point["rpm"] is not None]
        gear_changes = sum(
            1 for point_index in range(1, len(points)) if points[point_index]["gear"] != points[point_index - 1]["gear"]
        )

        return {
            "series_key": series_key,
            "label": label,
            "driver": driver,
            "team": team,
            "color": self._team_color(team, index),
            "lap_number": int(getattr(lap, "LapNumber", 0) or 0) or None,
            "compound": str(getattr(lap, "Compound", "") or "") or None,
            "tyre_life": int(getattr(lap, "TyreLife", 0) or 0) or None,
            "fastest_lap_seconds": self._lap_seconds(getattr(lap, "LapTime", None)),
            "sector_1_seconds": self._lap_seconds(getattr(lap, "Sector1Time", None)),
            "sector_2_seconds": self._lap_seconds(getattr(lap, "Sector2Time", None)),
            "sector_3_seconds": self._lap_seconds(getattr(lap, "Sector3Time", None)),
            "top_speed": round(max(speeds, default=0), 1),
            "average_speed": round(sum(speeds) / max(len(speeds), 1), 1),
            "average_throttle": round(sum(throttles) / max(len(throttles), 1), 1),
            "brake_pct": round((sum(1 for brake in brakes if brake > 0) / max(len(brakes), 1)) * 100, 1),
            "drs_pct": round((sum(1 for sample in drs_samples if sample and sample > 0) / max(len(drs_samples), 1)) * 100, 1)
            if drs_samples
            else None,
            "top_rpm": max(rpm_samples, default=None),
            "average_rpm": round(sum(rpm_samples) / max(len(rpm_samples), 1), 0) if rpm_samples else None,
            "gear_changes": gear_changes,
        }

    @staticmethod
    def _lap_seconds(value) -> float | None:
        if value is None or not hasattr(value, "total_seconds"):
            return None
        try:
            return round(float(value.total_seconds()), 3)
        except Exception:  # pragma: no cover
            return None

    def _filter_telemetry_bundle(self, payload: dict, selected_drivers: list[str] | None = None) -> dict:
        series = payload.get("series", [])
        if selected_drivers:
            selected = set(selected_drivers)
            series = [item for item in series if item["driver"] in selected]
        metrics = [item["metrics"] for item in series]
        insights = self._build_telemetry_insights(metrics, payload.get("session_summary"), payload.get("weather"))
        return {
            "series": [
                {
                    "driver": item["driver"],
                    "series_key": item["series_key"],
                    "label": item["label"],
                    "team": item["team"],
                    "color": item["color"],
                    "lap_number": item.get("lap_number"),
                    "lap_time_seconds": item.get("lap_time_seconds"),
                    "compound": item.get("compound"),
                    "is_reference": item.get("is_reference", False),
                    "points": item["points"],
                }
                for item in series
            ],
            "metrics": metrics,
            "available_drivers": payload.get("available_drivers", []),
            "lap_options": payload.get("lap_options", []),
            "micro_sectors": payload.get("micro_sectors", []),
            "corner_breakdown": payload.get("corner_breakdown", []),
            "performance": payload.get("performance", []),
            "benchmark_rankings": payload.get("benchmark_rankings", []),
            "pair_deltas": payload.get("pair_deltas", []),
            "track_map": payload.get("track_map", {"points": [], "corners": []}),
            "cache_metadata": payload.get("cache_metadata", {}),
            "unavailable_reason": payload.get("unavailable_reason"),
            "weather": payload.get("weather"),
            "session_summary": payload.get("session_summary"),
            "insights": insights,
        }

    @staticmethod
    def _build_telemetry_summary(race_session, grand_prix: str, year: int, session: str, telemetry: dict[str, dict]) -> str:
        event_name = str(getattr(race_session.event, "EventName", grand_prix) or grand_prix)
        session_label = FastF1Service._session_display_name(session)
        return (
            f"{event_name} {year} {session_label}: FastF1 telemetry loaded {len(telemetry)} selected lap overlays "
            f"for the chosen session."
        )

    @staticmethod
    def _build_telemetry_insights(metrics: list[dict], session_summary: str | None, weather: str | None) -> list[str]:
        insights: list[str] = []
        if session_summary:
            insights.append(session_summary)
        if weather:
            insights.append(weather)
        if not metrics:
            return insights

        sorted_by_lap = [metric for metric in metrics if metric.get("fastest_lap_seconds") is not None]
        sorted_by_lap.sort(key=lambda item: item["fastest_lap_seconds"])
        if sorted_by_lap:
            leader = sorted_by_lap[0]
            insights.append(
                f"{leader.get('label') or leader['driver']} set the fastest selected lap at {leader['fastest_lap_seconds']:.3f}s "
                f"on {leader.get('compound') or 'the recorded compound'}."
            )
        top_speed_driver = max(metrics, key=lambda item: item["top_speed"])
        insights.append(
            f"{top_speed_driver.get('label') or top_speed_driver['driver']} reached the highest straight-line speed at {top_speed_driver['top_speed']:.1f} km/h."
        )
        throttle_driver = max(metrics, key=lambda item: item["average_throttle"])
        brake_driver = max(metrics, key=lambda item: item["brake_pct"])
        insights.append(
            f"{throttle_driver.get('label') or throttle_driver['driver']} carried the strongest throttle commitment, while {brake_driver.get('label') or brake_driver['driver']} spent the largest share of the lap on the brakes."
        )
        return insights[:4]

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
