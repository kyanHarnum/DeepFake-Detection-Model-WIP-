"""
Configuration — load from environment variables or .env file.
Copy .env.example → .env and fill in your keys.
"""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # ── HuggingFace ────────────────────────────────────────────────────────────
    HUGGINGFACE_API_TOKEN: str = ""
    HUGGINGFACE_MODEL: str = "prithivMLmods/deepfake-detector-model-v1"

    # ── DeepSafe (self-hosted Docker on localhost) ─────────────────────────────
    DEEPSAFE_BASE_URL: str = "http://localhost:8888"
    DEEPSAFE_ENABLED: bool = True

    # ── DeepFake-o-Meter (University at Buffalo) ───────────────────────────────
    DEEPOMETER_BASE_URL: str = "https://zinc.cse.buffalo.edu/ubmdfl/deep-o-meter/api/v2"
    DEEPOMETER_API_KEY: Optional[str] = None   # Register free at their site
    DEEPOMETER_ENABLED: bool = True

    # ── Resemble AI (audio deepfake) ───────────────────────────────────────────
    RESEMBLE_API_KEY: str = ""
    RESEMBLE_BASE_URL: str = "https://app.resemble.ai/api/v2"
    RESEMBLE_ENABLED: bool = True

    # ── Scoring weights (must sum to 1.0) ─────────────────────────────────────
    WEIGHT_HUGGINGFACE: float = 0.25
    WEIGHT_DEEPSAFE: float = 0.30
    WEIGHT_DEEPOMETER: float = 0.30
    WEIGHT_RESEMBLE: float = 0.15   # Only applied when audio detector runs

    # ── Thresholds ────────────────────────────────────────────────────────────
    THRESHOLD_BLOCK: float = 0.80      # Auto-block above this
    THRESHOLD_FLAG: float = 0.55       # Flag for review above this
    THRESHOLD_PASS: float = 0.55       # Pass below this

    # ── General ───────────────────────────────────────────────────────────────
    MAX_FILE_SIZE_MB: int = 100
    SCAN_TIMEOUT_SECONDS: int = 60
    LOG_LEVEL: str = "INFO"
    ENVIRONMENT: str = "development"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
