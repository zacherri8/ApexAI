from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(100))
    role: Mapped[str] = mapped_column(String(100), default="Race Strategist")
    favorite_team: Mapped[str] = mapped_column(String(100), default="McLaren")
    favorite_driver: Mapped[str] = mapped_column(String(100), default="Lando Norris")
    location: Mapped[str] = mapped_column(String(100), default="Bengaluru, India")
    profile_image: Mapped[str] = mapped_column(Text, default="")
    bio: Mapped[str] = mapped_column(
        Text,
        default="Telemetry-first race fan building faster reads on drivers, tyre life, and strategy windows.",
    )
    activities: Mapped[list["SavedActivity"]] = relationship(back_populates="user")


class Driver(Base):
    __tablename__ = "drivers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    team: Mapped[str] = mapped_column(String(100), index=True)
    results: Mapped[list["Result"]] = relationship(back_populates="driver")


class Race(Base):
    __tablename__ = "races"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    track: Mapped[str] = mapped_column(String(100), index=True)
    date: Mapped[str] = mapped_column(String(20))
    results: Mapped[list["Result"]] = relationship(back_populates="race")


class Result(Base):
    __tablename__ = "results"
    __table_args__ = (UniqueConstraint("driver_id", "race_id", name="uq_driver_race_result"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    position: Mapped[int] = mapped_column(Integer)
    points: Mapped[int] = mapped_column(Integer)
    driver_id: Mapped[int] = mapped_column(ForeignKey("drivers.id"))
    race_id: Mapped[int] = mapped_column(ForeignKey("races.id"))

    driver: Mapped[Driver] = relationship(back_populates="results")
    race: Mapped[Race] = relationship(back_populates="results")


class KnowledgeDocument(Base):
    __tablename__ = "knowledge_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    topic: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    content: Mapped[str] = mapped_column(Text)


class SavedActivity(Base):
    __tablename__ = "saved_activities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    activity_type: Mapped[str] = mapped_column(String(50), index=True)
    title: Mapped[str] = mapped_column(String(200))
    summary: Mapped[str] = mapped_column(Text)
    payload: Mapped[str] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String(40), index=True)

    user: Mapped[User] = relationship(back_populates="activities")
