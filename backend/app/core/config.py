from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore")

    # SQLite DB file under `backend/`
    database_url: str = ""
    secret_key: str = "CHANGE_ME_SUPER_SECRET_KEY"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24

    # CORS
    cors_allow_origins: str = "*"


def get_settings() -> Settings:
    settings = Settings()
    if not settings.database_url:
        backend_dir = Path(__file__).resolve().parents[2]  # .../backend
        db_path = backend_dir / "app.db"
        settings.database_url = f"sqlite:///{db_path}"
    return settings

