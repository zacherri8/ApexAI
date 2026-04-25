from datetime import datetime, timezone
import json
import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Driver, KnowledgeDocument, Race, Result, SavedActivity, User


def _tokenize_terms(value: str) -> set[str]:
    normalized = value.lower().replace("tyres", "tyre").replace("tires", "tyre")
    tokens = set(re.findall(r"[a-z0-9]+", normalized))
    stop_words = {
        "a",
        "an",
        "and",
        "are",
        "does",
        "for",
        "formula",
        "how",
        "in",
        "is",
        "of",
        "the",
        "to",
        "what",
        "when",
        "who",
        "why",
    }
    return {token for token in tokens if token not in stop_words}


def _build_lap(speed: int, throttle: int, brake: int, gear: int, offset: int) -> list[dict[str, float | int]]:
    points: list[dict[str, float | int]] = []
    for index in range(12):
        points.append(
            {
                "distance": index * 430,
                "speed": max(110, speed + ((index % 4) * 12) - offset),
                "throttle": max(40, min(100, throttle + ((index % 3) * 5) - offset // 2)),
                "brake": max(0, min(100, brake + (18 if index in (3, 8) else 0) + offset // 3)),
                "gear": max(3, min(8, gear + (1 if index % 5 == 0 else 0))),
            }
        )
    return points


class F1Repository:
    telemetry_profiles = {
        "Max Verstappen": _build_lap(302, 86, 16, 7, 2),
        "Sergio Perez": _build_lap(296, 83, 18, 7, 5),
        "Lando Norris": _build_lap(297, 84, 18, 7, 3),
        "Oscar Piastri": _build_lap(295, 83, 19, 7, 4),
        "Charles Leclerc": _build_lap(294, 83, 19, 7, 4),
        "Carlos Sainz": _build_lap(292, 82, 20, 7, 5),
        "Lewis Hamilton": _build_lap(291, 82, 20, 6, 5),
        "George Russell": _build_lap(290, 81, 21, 6, 6),
        "Fernando Alonso": _build_lap(288, 80, 22, 6, 7),
        "Lance Stroll": _build_lap(286, 79, 23, 6, 8),
        "Pierre Gasly": _build_lap(285, 79, 23, 6, 8),
        "Esteban Ocon": _build_lap(284, 78, 24, 6, 9),
        "Yuki Tsunoda": _build_lap(287, 80, 22, 6, 7),
        "Daniel Ricciardo": _build_lap(283, 78, 24, 6, 10),
        "Alex Albon": _build_lap(286, 79, 23, 6, 8),
        "Logan Sargeant": _build_lap(279, 76, 26, 6, 12),
        "Valtteri Bottas": _build_lap(281, 77, 25, 6, 11),
        "Zhou Guanyu": _build_lap(280, 76, 25, 6, 11),
        "Nico Hulkenberg": _build_lap(282, 77, 24, 6, 10),
        "Kevin Magnussen": _build_lap(281, 77, 24, 6, 10),
    }

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_user_by_username(self, username: str) -> User | None:
        return self.db.scalar(select(User).where(User.username == username))

    def update_user_profile(self, username: str, payload: dict[str, str]) -> User | None:
        user = self.get_user_by_username(username)
        if not user:
            return None

        for field, value in payload.items():
            setattr(user, field, value)

        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def save_activity(
        self,
        user_id: int,
        activity_type: str,
        title: str,
        summary: str,
        payload: dict,
    ) -> SavedActivity:
        activity = SavedActivity(
            user_id=user_id,
            activity_type=activity_type,
            title=title,
            summary=summary,
            payload=json.dumps(payload),
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        self.db.add(activity)
        self.db.commit()
        self.db.refresh(activity)
        return activity

    def list_activities_for_user(self, user_id: int) -> list[SavedActivity]:
        return self.db.scalars(
            select(SavedActivity)
            .where(SavedActivity.user_id == user_id)
            .order_by(SavedActivity.id.desc())
        ).all()

    def get_drivers(self) -> list[dict]:
        drivers = self.db.scalars(select(Driver).order_by(Driver.id)).all()
        return [{"id": driver.id, "name": driver.name, "team": driver.team} for driver in drivers]

    def get_races(self) -> list[dict]:
        races = self.db.scalars(select(Race).order_by(Race.id)).all()
        return [{"id": race.id, "track": race.track, "date": race.date} for race in races]

    def get_results(self) -> list[dict]:
        results = self.db.scalars(select(Result).order_by(Result.race_id.desc(), Result.position.asc())).all()
        return [
            {
                "position": result.position,
                "driver_id": result.driver_id,
                "race_id": result.race_id,
                "points": result.points,
                "driver_name": result.driver.name,
                "team_name": result.driver.team,
            }
            for result in results
        ]

    def get_telemetry(self, drivers: list[str] | None = None) -> dict[str, list[dict]]:
        if not drivers:
            return self.telemetry_profiles
        return {driver: self.telemetry_profiles[driver] for driver in drivers if driver in self.telemetry_profiles}

    def search_knowledge(self, query: str) -> list[dict]:
        docs = self.db.scalars(select(KnowledgeDocument)).all()
        query_terms = _tokenize_terms(query)
        scored: list[tuple[int, dict]] = []
        for item in docs:
            payload = {"topic": item.topic, "content": item.content}
            topic_terms = _tokenize_terms(item.topic.replace("-", " "))
            content_terms = _tokenize_terms(item.content)
            score = (len(query_terms & topic_terms) * 3) + len(query_terms & content_terms)
            scored.append((score, payload))
        scored.sort(key=lambda item: item[0], reverse=True)
        return [item for score, item in scored if score > 0][:3] or [payload for _, payload in scored[:2]]
