"""Application configuration loaded from environment variables.

Uses pydantic-settings so every value is validated and typed. Nothing is
hard-coded — the same code runs locally (Neon dev DB) and in production by
swapping the `.env` / platform env vars.
"""

from functools import lru_cache
from typing import Any

from sqlalchemy.engine import make_url
from pydantic_settings import BaseSettings, SettingsConfigDict

# libpq query params that asyncpg does not accept as connect kwargs.
_LIBPQ_ONLY_PARAMS = {"sslmode", "channel_binding"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- App ---
    PROJECT_NAME: str = "Ecommerce Store API"
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: str = "development"  # development | production
    DEBUG: bool = True
    SQL_ECHO: bool = False  # log every SQL statement (verbose; for debugging)

    # --- Database ---
    # SQLAlchemy async URL, e.g. postgresql+asyncpg://user:pass@host/db
    DATABASE_URL: str = "sqlite+aiosqlite:///./dev.db"

    # --- Auth / JWT ---
    SECRET_KEY: str = "change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    PASSWORD_RESET_EXPIRE_MINUTES: int = 30
    JWT_ALGORITHM: str = "HS256"

    # Cookie settings for the refresh token (cross-site in prod).
    COOKIE_SECURE: bool = False  # True in production (HTTPS only)
    COOKIE_SAMESITE: str = "lax"  # "none" in production for cross-site
    COOKIE_DOMAIN: str | None = None

    # --- CORS ---
    # Comma-separated list of allowed frontend origins.
    CORS_ORIGINS: str = "http://localhost:3000"

    # --- Cloudinary (product images) ---
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    # --- Email (Resend) ---
    # Transactional email for order confirmations + password resets. When
    # RESEND_API_KEY is empty the sender no-ops (logs only), so local dev and
    # tests run without any email account.
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "Meher <onboarding@resend.dev>"
    # Where new-order alerts go (the store owner). Empty = skip the alert.
    ADMIN_NOTIFICATION_EMAIL: str = ""
    # Public storefront base URL — used to build links inside emails.
    FRONTEND_URL: str = "http://localhost:3000"

    # --- AI shopping assistant ---
    # Tool-using "agent-lite" over the catalog/orders. Disabled (503) when off.
    ASSISTANT_ENABLED: bool = True
    # Active model key from services/assistant/models.py REGISTRY.
    ASSISTANT_MODEL: str = "openai:gpt-4.1-mini"
    # Dev convenience: let a request pick a model (for A/B comparison). Keep
    # False in production so the public can't drive up cost on a pricey model.
    ASSISTANT_ALLOW_MODEL_OVERRIDE: bool = True
    # Cap the agent loop (LLM turns) and the history window (messages) to bound
    # latency and token cost.
    ASSISTANT_MAX_TURNS: int = 8
    ASSISTANT_MAX_HISTORY: int = 20
    # Provider keys. OpenAI enables the tracing dashboard; Groq is a free
    # OpenAI-compatible alternative for comparison. Either may be empty.
    OPENAI_API_KEY: str = ""
    GROQ_API_KEY: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def sqlalchemy_url(self) -> str:
        """DATABASE_URL with libpq-only query params removed.

        Neon connection strings carry `?sslmode=require&channel_binding=require`,
        which asyncpg rejects as keyword args. We strip them here and re-add SSL
        via `db_connect_args` instead.
        """
        url = make_url(self.DATABASE_URL)
        clean_query = {
            k: v for k, v in url.query.items() if k not in _LIBPQ_ONLY_PARAMS
        }
        return url.set(query=clean_query).render_as_string(hide_password=False)

    @property
    def db_connect_args(self) -> dict[str, Any]:
        """asyncpg connect args: enable SSL and disable the prepared-statement
        cache (required for Neon's PgBouncer pooler)."""
        if not self.DATABASE_URL.startswith("postgresql+asyncpg"):
            return {}
        url = make_url(self.DATABASE_URL)
        args: dict[str, Any] = {"statement_cache_size": 0}
        if url.query.get("sslmode", "require") != "disable":
            args["ssl"] = True
        return args


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()