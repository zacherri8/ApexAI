from dataclasses import dataclass


@dataclass(slots=True)
class Driver:
    id: int
    name: str
    team: str


@dataclass(slots=True)
class Race:
    id: int
    track: str
    date: str
