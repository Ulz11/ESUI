"""App settings loaded from environment variables.

Pydantic-settings reads from `.env` first, then process env. Production
secrets are injected via Fly.io secrets / Vercel env.
"""

from typing import Annotated, Any, Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # core
    app_env: Literal["development", "staging", "production"] = "development"
    secret_key: str = "dev-secret-change-me-in-prod-min-32-chars"
    # NoDecode disables pydantic-settings's default JSON decode for list fields,
    # so the validator below is the only parser. Accepts CSV or JSON arrays.
    allowed_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000"]

    # allowlist (only these emails can sign in)
    esui_email: str = ""
    badrushk_email: str = ""

    # postgres
    database_url: str = "postgresql+asyncpg://esui:esui@localhost:5432/esui"

    # redis
    redis_url: str = "redis://localhost:6379/0"

    # r2
    r2_endpoint_url: str = ""
    r2_bucket: str = "esui-files"
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""

    # anthropic
    anthropic_api_key: str = ""
    opus_model_id: str = "claude-opus-4-7"
    sonnet_model_id: str = "claude-sonnet-4-6"
    haiku_model_id: str = "claude-haiku-4-5"

    # google gemini
    google_api_key: str = ""
    gemini_model_id: str = "gemini-3.1-pro"

    # perplexity (sonar)
    perplexity_api_key: str = ""
    perplexity_research_model_id: str = "sonar-deep-research"
    perplexity_reasoning_model_id: str = "sonar-reasoning-pro"

    # voyage embeddings
    voyage_api_key: str = ""

    # unstructured
    unstructured_api_key: str = ""
    unstructured_api_url: str = "https://api.unstructured.io"

    # email
    resend_api_key: str = ""
    resend_from: str = "auth@esui.app"

    # cost guard
    daily_cost_cap_usd: float = 20.0

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def _split_origins(cls, v: Any) -> Any:
        """Accept input as JSON array OR comma-separated string OR list."""
        if isinstance(v, str):
            s = v.strip()
            if s.startswith("["):
                # JSON array string — parse it ourselves (NoDecode disabled the auto path).
                import json
                return json.loads(s)
            return [item.strip() for item in s.split(",") if item.strip()]
        return v

    @property
    def allowlisted_emails(self) -> set[str]:
        return {e.strip().lower() for e in (self.esui_email, self.badrushk_email) if e}


settings = Settings()
