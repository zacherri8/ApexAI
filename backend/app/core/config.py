from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    api_prefix: str = "/api/v1"
    app_env: str = "development"
    cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
    )
    database_url: str = "sqlite:///./apexai.db"
    jwt_secret: str = "development-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"


settings = Settings()
