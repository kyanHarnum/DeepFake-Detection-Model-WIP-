"""
Pydantic schemas for request/response models.
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, List
from enum import Enum


class MediaType(str, Enum):
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"


class ThreatLevel(str, Enum):
    PASS = "pass"
    FLAG = "flag"
    BLOCK = "block"


# ── Individual detector result ─────────────────────────────────────────────────

class DetectorResult(BaseModel):
    detector: str
    enabled: bool
    ran: bool
    fake_probability: Optional[float] = None   # 0.0 – 1.0
    confidence: Optional[float] = None         # 0.0 – 1.0
    label: Optional[str] = None                # "FAKE" | "REAL"
    raw_response: Optional[Dict] = None
    error: Optional[str] = None
    latency_ms: Optional[int] = None


# ── Ensemble / final verdict ───────────────────────────────────────────────────

class ScanResult(BaseModel):
    scan_id: str
    media_type: MediaType
    filename: str
    file_size_bytes: int

    # Ensemble score
    ensemble_fake_probability: float = Field(..., ge=0.0, le=1.0)
    threat_level: ThreatLevel
    confidence: float = Field(..., ge=0.0, le=1.0)

    # Per-detector breakdown
    detectors: List[DetectorResult]

    # Metadata
    detectors_run: int
    detectors_succeeded: int
    total_latency_ms: int
    timestamp: str
    notes: Optional[str] = None


# ── Batch scan ─────────────────────────────────────────────────────────────────

class BatchScanResult(BaseModel):
    batch_id: str
    total_files: int
    results: List[ScanResult]
    summary: Dict
