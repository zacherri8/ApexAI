try:
    from openai import OpenAI
except ImportError:  # pragma: no cover
    OpenAI = None
import re
from types import SimpleNamespace

from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.repository import F1Repository
from app.schemas.chat import ChatResponse
from app.services.metadata_service import MetadataService


class ChatService:
    TEAM_ALIASES = {
        "merc": "Mercedes",
        "mercedes": "Mercedes",
        "red bull racing": "Red Bull",
        "mclaren": "McLaren",
        "aston": "Aston Martin",
        "aston martin": "Aston Martin",
        "alpha tauri": "RB",
        "alphatauri": "RB",
        "rb": "RB",
        "kick sauber": "Sauber",
    }

    RACE_ALIASES = {
        "british gp": "Silverstone",
        "italian gp": "Italian Grand Prix",
        "australian gp": "Australia",
        "chinese gp": "China",
        "japanese gp": "Japan",
        "bahrain gp": "Bahrain",
        "saudi arabian gp": "Saudi Arabia",
        "miami gp": "Miami",
        "imola": "Emilia Romagna",
        "emilia romagna gp": "Emilia Romagna",
        "monaco gp": "Monaco",
        "spanish gp": "Spain",
        "canadian gp": "Canada",
        "austrian gp": "Austria",
        "belgian gp": "Belgium",
        "hungarian gp": "Hungary",
        "dutch gp": "Netherlands",
        "azerbaijan gp": "Azerbaijan",
        "singapore gp": "Singapore",
        "us gp": "United States",
        "united states gp": "United States",
        "mexican gp": "Mexico City",
        "mexico gp": "Mexico City",
        "brazilian gp": "Sao Paulo",
        "sao paulo gp": "Sao Paulo",
        "las vegas gp": "Las Vegas",
        "qatar gp": "Qatar",
        "abu dhabi gp": "Abu Dhabi",
    }

    def __init__(self) -> None:
        self.client = OpenAI(api_key=settings.openai_api_key) if settings.openai_api_key and OpenAI else None

    @staticmethod
    def _tokenize(question: str) -> set[str]:
        normalized = question.lower().replace("tires", "tyres")
        return set(re.findall(r"[a-z0-9]+", normalized))

    def _match_driver(self, question: str, metadata) -> dict | None:
        lowered_question = question.lower()
        question_terms = self._tokenize(question)
        best_match: dict | None = None

        for driver in metadata.drivers:
            driver_terms = self._tokenize(driver.name)
            surname = driver.name.split()[-1].lower()
            firstname = driver.name.split()[0].lower()
            if (
                driver.name.lower() in lowered_question
                or driver_terms.issubset(question_terms)
                or surname in question_terms
                or firstname in question_terms
            ):
                if not best_match or len(driver.name) > len(best_match["name"]):
                    best_match = {
                        "id": driver.id,
                        "name": driver.name,
                        "team": driver.team,
                    }

        return best_match

    def _match_team(self, question: str, metadata) -> str | None:
        lowered_question = question.lower()
        for alias, team in self.TEAM_ALIASES.items():
            if alias in lowered_question:
                return team
        for team in sorted({driver.team for driver in metadata.drivers}, key=len, reverse=True):
            if team.lower() in lowered_question:
                return team
        return None

    def _match_race(self, question: str, metadata) -> dict | None:
        lowered_question = question.lower()
        target_track = None
        for alias, race_name in self.RACE_ALIASES.items():
            if alias in lowered_question:
                target_track = race_name
                break
        for race in sorted(metadata.races, key=lambda item: len(item.track), reverse=True):
            if (
                race.track.lower() in lowered_question
                or (target_track and target_track.lower() in race.track.lower())
                or (target_track and race.track.lower() in target_track.lower())
            ):
                return {
                    "id": race.id,
                    "track": race.track,
                    "date": race.date,
                }
        return None

    @staticmethod
    def _question_has_any(question_terms: set[str], candidates: set[str]) -> bool:
        return bool(question_terms & candidates)

    def _build_driver_answer(self, driver: dict, metadata, question_terms: set[str]) -> str:
        races_by_id = {race.id: race.track for race in metadata.races}
        driver_results = [result for result in metadata.results if result.driver_id == driver["id"]]
        latest_result = driver_results[0] if driver_results else None
        teammates = [
            item.name for item in metadata.drivers if item.team == driver["team"] and item.name != driver["name"]
        ]
        wins = [result for result in driver_results if result.position == 1]

        if self._question_has_any(question_terms, {"team", "drive", "drives", "driving"}):
            return f"{driver['name']} drives for {driver['team']}."

        if self._question_has_any(question_terms, {"teammate", "teammates", "partner"}):
            if teammates:
                return f"{driver['name']}'s teammate is {', '.join(teammates)} at {driver['team']}."
            return f"{driver['name']} currently races for {driver['team']}."

        if self._question_has_any(question_terms, {"win", "wins", "won", "victory", "victories"}):
            if wins:
                latest_win_race = races_by_id.get(wins[0].race_id, "the latest listed Grand Prix")
                return (
                    f"In the current dataset, {driver['name']} has {len(wins)} listed win"
                    f"{'' if len(wins) == 1 else 's'}. The latest listed win is {latest_win_race}."
                )
            return f"In the current dataset, {driver['name']} has no listed win yet, and races for {driver['team']}."

        if latest_result:
            latest_race = races_by_id.get(latest_result.race_id, "the latest listed Grand Prix")
            return (
                f"{driver['name']} is a Formula 1 driver for {driver['team']}. "
                f"In the current dataset, their latest listed result is P{latest_result.position} at {latest_race}."
            )

        return f"{driver['name']} is a Formula 1 driver for {driver['team']}."

    def _build_team_answer(self, team: str, metadata, question_terms: set[str]) -> str:
        team_drivers = [driver.name for driver in metadata.drivers if driver.team == team]
        team_results = [result for result in metadata.results if result.team_name == team]
        best_result = min(team_results, key=lambda item: item.position) if team_results else None

        if self._question_has_any(question_terms, {"driver", "drivers", "lineup", "teammate", "teammates"}):
            return f"{team}'s current lineup in this dataset is {', '.join(team_drivers)}."

        if self._question_has_any(question_terms, {"best", "result", "finish", "finished"}):
            if best_result:
                return (
                    f"{team}'s best listed finish in the current dataset is P{best_result.position}, "
                    f"scored by {best_result.driver_name}."
                )
            return f"{team} is in the current driver roster, but there is no saved finishing result for the team yet."

        if team_drivers:
            return f"{team} is represented in the current dataset by {', '.join(team_drivers)}."
        return f"{team} is part of the current F1 team set in the app."

    def _build_race_answer(self, race: dict, metadata, question_terms: set[str]) -> str:
        race_results = [result for result in metadata.results if result.race_id == race["id"]]
        winner = next((result for result in race_results if result.position == 1), None)
        podium = [result.driver_name for result in race_results if result.position <= 3]

        if self._question_has_any(question_terms, {"when", "date"}):
            return f"The {race['track']} Grand Prix is listed for {race['date']}."

        if self._question_has_any(question_terms, {"who", "won", "winner", "victory"}):
            if winner:
                return f"{winner.driver_name} won the listed {race['track']} Grand Prix."
            return f"The {race['track']} Grand Prix is on the calendar, but there is no stored winner for it yet."

        if self._question_has_any(question_terms, {"podium", "top", "top3"}):
            if podium:
                return f"The listed podium for {race['track']} is {', '.join(podium)}."
            return f"The {race['track']} Grand Prix is on the calendar, but there is no stored podium for it yet."

        if winner:
            return f"{race['track']} is listed on {race['date']}, and the stored winner is {winner.driver_name}."
        return f"{race['track']} is listed on {race['date']} in the current F1 calendar."

    def _build_fallback_answer(self, question: str, context: list[str], featured) -> str:
        question_terms = self._tokenize(question)
        lowered_question = question.lower()
        question_mentions_featured_race = (
            featured.race_name.lower() in lowered_question
            or "featured race" in lowered_question
            or "who won" in lowered_question
            or "winner" in lowered_question
            or "podium" in lowered_question
        )
        knowledge_only = [item for item in context if not item.startswith("Featured race:") and not item.startswith("Weather:")]

        if {"soft", "hard"} & question_terms and {"tyre", "tyres"} & question_terms:
            return (
                "Soft tyres are usually quicker because they warm up faster and offer more peak grip, "
                "which helps with launch, corner entry, and short-run lap time. Hard tyres are normally slower "
                "over one lap, but they stay consistent for longer and resist degradation better over long stints."
            )

        if "undercut" in question_terms:
            return (
                "A team should consider the undercut when the current tyres are dropping away, traffic after the stop looks manageable, "
                "and clean air can unlock a meaningful lap-time gain. It becomes strongest when the out-lap pace advantage is big enough "
                "to offset pit-loss time."
            )

        if "drs" in question_terms and knowledge_only:
            return knowledge_only[0]

        if "ers" in question_terms and knowledge_only:
            return knowledge_only[0]

        if {"qualifying", "q1", "q2", "q3", "pole"} & question_terms and knowledge_only:
            return knowledge_only[0]

        if "sprint" in question_terms and knowledge_only:
            return knowledge_only[0]

        if {"point", "points", "scoring"} & question_terms and knowledge_only:
            return knowledge_only[0]

        if {"safety", "car", "vsc", "virtual"} & question_terms and knowledge_only:
            return knowledge_only[0]

        if {"tyre", "tyres", "degradation", "temperature", "compound", "compounds"} & question_terms and knowledge_only:
            return knowledge_only[0]

        if {"champion", "championship", "titles", "title"} & question_terms and knowledge_only:
            return knowledge_only[0]

        if {"flag", "flags", "blue", "yellow", "red"} & question_terms and knowledge_only:
            return " ".join(knowledge_only[:2])

        if {"penalty", "penalties", "steward", "stewards"} & question_terms and knowledge_only:
            return " ".join(knowledge_only[:2])

        if {"pit", "pits", "pitstop", "pitlane"} & question_terms and knowledge_only:
            return " ".join(knowledge_only[:2])

        if {"downforce", "aero", "aerodynamics", "drag", "dirty", "air", "slipstream"} & question_terms and knowledge_only:
            return " ".join(knowledge_only[:2])

        if question_mentions_featured_race:
            return (
                f"{featured.winner} won {featured.race_name}. The podium was {', '.join(featured.podium)}. "
                f"Race context: {featured.key_stat}."
            )

        if not metadata_has_fastf1_context:
            return (
                f"FastF1 season context for {featured.race_name} is unavailable right now, so I cannot answer that "
                "using live season data. I can still help with general F1 rules, strategy, tyres, DRS, ERS, points, "
                "and regulations from the built-in knowledge base."
            )

        if knowledge_only:
            return "Based on the current F1 knowledge base: " + " ".join(knowledge_only[:2])

        return (
            f"I do not have a strong built-in knowledge match for '{question}' yet. "
            "Ask about tyres, strategy, DRS, ERS, qualifying, sprint format, safety cars, points, championships, "
            "or a specific race weekend for the best answer."
        )

    def answer(self, db: Session, question: str, year: int | None = None) -> ChatResponse:
        repository = F1Repository(db)
        metadata = MetadataService().get_metadata(db, year)
        metadata_has_fastf1_context = bool(metadata.drivers or metadata.races or metadata.results)
        if not metadata_has_fastf1_context:
            metadata_dump = metadata.model_dump()
            featured_context = metadata_dump.pop("featured_race_context")
            metadata = SimpleNamespace(
                **metadata_dump,
                drivers=[],
                races=[],
                results=[],
                featured_race_context=SimpleNamespace(**featured_context),
            )
        featured = metadata.featured_race_context
        question_terms = self._tokenize(question)
        matched_driver = self._match_driver(question, metadata) if metadata_has_fastf1_context else None
        matched_team = self._match_team(question, metadata) if metadata_has_fastf1_context else None
        matched_race = self._match_race(question, metadata) if metadata_has_fastf1_context else None
        docs = repository.search_knowledge(question)
        question_mentions_featured_race = (
            featured.race_name.lower() in question.lower()
            or "featured race" in question.lower()
            or "grand prix" in question.lower()
            or "who won" in question.lower()
            or "winner" in question_terms
            or "podium" in question_terms
        )
        knowledge_context = [item["content"] for item in docs]
        race_context = [
            f"Featured race: {featured.race_name}. Winner: {featured.winner}. Podium: {', '.join(featured.podium)}.",
            f"Weather: {featured.weather}. Key stat: {featured.key_stat}.",
            *featured.insights,
        ]
        context = (race_context + knowledge_context) if question_mentions_featured_race else knowledge_context
        if matched_driver and not question_mentions_featured_race:
            answer = self._build_driver_answer(matched_driver, metadata, question_terms)
            return ChatResponse(answer=answer, context=[])
        if matched_team and not matched_driver and not question_mentions_featured_race:
            answer = self._build_team_answer(matched_team, metadata, question_terms)
            return ChatResponse(answer=answer, context=[])
        if matched_race:
            answer = self._build_race_answer(matched_race, metadata, question_terms)
            return ChatResponse(answer=answer, context=[])
        if self.client:
            completion = self.client.responses.create(
                model=settings.openai_model,
                input=[
                    {
                        "role": "system",
                        "content": (
                            "You are an F1 knowledge assistant. Answer the user's actual question directly and naturally. "
                            "Use structured driver, team, race, and regulation knowledge first. "
                            "Only use featured-race context if the user is clearly asking about that race or recent race outcomes. "
                            "If the context is partial, answer with the most accurate information available and explicitly note any limitation instead of forcing an unrelated answer."
                        ),
                    },
                    {
                        "role": "user",
                        "content": f"Question: {question}\n\nContext:\n- " + "\n- ".join(context),
                    },
                ],
            )
            answer = completion.output_text
        else:
            answer = self._build_fallback_answer(question, context, featured)
        response_context = (race_context + knowledge_context) if question_mentions_featured_race else knowledge_context
        return ChatResponse(answer=answer, context=response_context[:6])
