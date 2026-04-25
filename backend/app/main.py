from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.router import api_router
from app.core.config import settings
from app.db.seeder import seed_database
from app.db.session import Base, SessionLocal, engine


def ensure_user_profile_columns() -> None:
    if not str(engine.url).startswith("sqlite"):
        return

    expected_columns = {
        "role": "ALTER TABLE users ADD COLUMN role VARCHAR(100) DEFAULT 'Race Strategist'",
        "favorite_team": "ALTER TABLE users ADD COLUMN favorite_team VARCHAR(100) DEFAULT 'McLaren'",
        "favorite_driver": "ALTER TABLE users ADD COLUMN favorite_driver VARCHAR(100) DEFAULT 'Lando Norris'",
        "location": "ALTER TABLE users ADD COLUMN location VARCHAR(100) DEFAULT 'Bengaluru, India'",
        "profile_image": "ALTER TABLE users ADD COLUMN profile_image TEXT DEFAULT ''",
        "bio": "ALTER TABLE users ADD COLUMN bio TEXT DEFAULT 'Telemetry-first race fan building faster reads on drivers, tyre life, and strategy windows.'",
    }

    with engine.begin() as connection:
        existing_columns = {
            row[1]
            for row in connection.execute(text("PRAGMA table_info(users)")).fetchall()
        }
        for column, statement in expected_columns.items():
            if column not in existing_columns:
                connection.execute(text(statement))

        connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS saved_activities (
                    id INTEGER PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    activity_type VARCHAR(50) NOT NULL,
                    title VARCHAR(200) NOT NULL,
                    summary TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    created_at VARCHAR(40) NOT NULL,
                    FOREIGN KEY(user_id) REFERENCES users(id)
                )
                """
            )
        )


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_user_profile_columns()
    db: Session = SessionLocal()
    try:
        seed_database(db)
        yield
    finally:
        db.close()


app = FastAPI(
    title="F1 AI Analytics & Strategy Platform",
    version="1.0.0",
    description="AI-powered telemetry analytics, reporting, race prediction, and chat for Formula 1.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "F1 AI Analytics backend is running"}
