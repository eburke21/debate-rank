from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://debaterank:localdev@localhost:5432/debaterank"
    ANTHROPIC_API_KEY: str = ""
    CORS_ORIGINS: str = "http://localhost:5173"
    RATE_LIMIT_PER_MINUTE: int = 10

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

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
