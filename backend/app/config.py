from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings

# Resolve the repo-root .env from this file's location so settings load no matter
# the working directory (e.g. running scripts from backend/). In containers the
# file is absent and pydantic-settings falls back to real environment variables.
ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://debaterank:localdev@localhost:5432/debaterank"
    ANTHROPIC_API_KEY: str = ""
    CORS_ORIGINS: str = "http://localhost:5173"
    RATE_LIMIT_PER_MINUTE: int = 10
    # Anthropic model used by the LLM judges. Successor to the retired
    # claude-sonnet-4-20250514 (same Sonnet tier / cost). Override via env to a
    # model your key can access (see `GET /v1/models`), e.g. claude-haiku-4-5.
    JUDGE_MODEL: str = "claude-sonnet-4-6"

    @field_validator("DATABASE_URL")
    @classmethod
    def ensure_asyncpg_driver(cls, value: str) -> str:
        """Normalize the DB URL to the asyncpg driver.

        Managed Postgres providers (e.g. Railway's ${{Postgres.DATABASE_URL}})
        hand out a plain `postgresql://` (or legacy `postgres://`) URL with no
        driver. SQLAlchemy's async engine requires an async driver, so upgrade
        the scheme. URLs that already specify a driver (`postgresql+asyncpg://`,
        `postgresql+psycopg2://`) are left untouched.
        """
        if value.startswith("postgres://"):
            value = "postgresql://" + value[len("postgres://") :]
        if value.startswith("postgresql://"):
            value = "postgresql+asyncpg://" + value[len("postgresql://") :]
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    model_config = {"env_file": ENV_FILE, "extra": "ignore"}


settings = Settings()
