# app/core/config.py
from __future__ import annotations
from typing import Optional

# Prefer pydantic-settings (v2); fall back to Pydantic v1 BaseSettings.
try:
    from pydantic_settings import BaseSettings, SettingsConfigDict  # Pydantic v2 style
    from pydantic import Field, field_validator, model_validator
    _V2 = True
except Exception:
    from pydantic import BaseSettings, Field  # Pydantic v1 style
    try:
        from pydantic import validator, root_validator
    except Exception:  # Safety for very old pydantic
        validator = None
        root_validator = None
    SettingsConfigDict = None
    _V2 = False


class Settings(BaseSettings):
    # ---- Core LLM config (envs override these defaults) ----
    CHUTES_API_KEY: str = Field(default="")
    CHUTES_BASE_URL: str = Field(default="https://llm.chutes.ai")
    CHUTES_COMPLETIONS_PATH: str = Field(default="/v1/chat/completions")
    CHUTES_MODEL: str = Field(default="deepseek-ai/DeepSeek-V3-0324")
    CHUTES_TIMEOUT_SECONDS: int = Field(default=30)

    # ---- Pydantic settings config ----
    if _V2:
        model_config = SettingsConfigDict(
            env_file=".env",
            env_file_encoding="utf-8",
            case_sensitive=False,
            extra="ignore",
            env_ignore_empty=True,
        )
    else:
        class Config:
            env_file = ".env"
            case_sensitive = False
            extra = "ignore"

    # ---- Normalization / validation ----
    if _V2:
        @field_validator("CHUTES_API_KEY", "CHUTES_BASE_URL", "CHUTES_COMPLETIONS_PATH", "CHUTES_MODEL", mode="before")
        @classmethod
        def _strip(cls, v: Optional[str]):
            return v.strip() if isinstance(v, str) else v

        @field_validator("CHUTES_TIMEOUT_SECONDS", mode="after")
        @classmethod
        def _timeout_positive(cls, v: int) -> int:
            return max(1, int(v))

        @model_validator(mode="after")
        def _normalize_urls(self) -> "Settings":
            # Ensure no trailing slash on base URL
            if isinstance(self.CHUTES_BASE_URL, str):
                self.CHUTES_BASE_URL = self.CHUTES_BASE_URL.rstrip("/")

            # Ensure path starts with a single leading slash
            if isinstance(self.CHUTES_COMPLETIONS_PATH, str):
                p = self.CHUTES_COMPLETIONS_PATH.strip()
                if not p.startswith("/"):
                    p = "/" + p
                self.CHUTES_COMPLETIONS_PATH = p
            return self
    else:
        if validator:
            @validator("CHUTES_API_KEY", "CHUTES_BASE_URL", "CHUTES_COMPLETIONS_PATH", "CHUTES_MODEL", pre=True)
            def _strip_v1(cls, v):
                return v.strip() if isinstance(v, str) else v

            @validator("CHUTES_TIMEOUT_SECONDS", pre=True, always=True)
            def _timeout_positive_v1(cls, v):
                try:
                    return max(1, int(v))
                except Exception:
                    return 30

        if root_validator:
            @root_validator(pre=False)
            def _normalize_urls_v1(cls, values):
                base = values.get("CHUTES_BASE_URL")
                path = values.get("CHUTES_COMPLETIONS_PATH")

                if isinstance(base, str):
                    values["CHUTES_BASE_URL"] = base.rstrip("/")

                if isinstance(path, str):
                    p = path.strip()
                    if not p.startswith("/"):
                        p = "/" + p
                    values["CHUTES_COMPLETIONS_PATH"] = p
                return values

    # ---- Convenience helpers ----
    @property
    def full_completions_url(self) -> str:
        """Fully-qualified Chat Completions endpoint."""
        return f"{self.CHUTES_BASE_URL}{self.CHUTES_COMPLETIONS_PATH}"

    @property
    def has_api_key(self) -> bool:
        """True if an API key is present and non-empty."""
        return bool(self.CHUTES_API_KEY)


settings = Settings()
