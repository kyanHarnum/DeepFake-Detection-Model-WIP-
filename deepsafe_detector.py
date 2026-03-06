"""
Detector 2: DeepSafe — Self-hosted Docker Ensemble
===================================================
Repo   : github.com/siddharthksah/DeepSafe
License: MIT
Cost   : Free (self-hosted)
Models : NPR, UFD, Cross Efficient ViT (ensemble voting)
Best for: Video and image files

Setup (one-time):
    git clone https://github.com/siddharthksah/DeepSafe
    cd DeepSafe && docker-compose up --build
    # API available at http://localhost:8888

This detector calls that local Docker API.
"""

import time
import httpx
import asyncio
from pathlib import Path

from app.core.config import settings
from app.core.models import DetectorResult
from app.core.logger import logger


async def run_deepsafe_detector(
    file_bytes: bytes,
    filename: str,
    media_type: str = "image",
) -> DetectorResult:
    """
    Submit media to the self-hosted DeepSafe Docker API.

    Args:
        file_bytes: Raw file bytes (image or video)
        filename: Original filename
        media_type: "image" or "video"

    Returns:
        DetectorResult with ensemble vote
    """
    start = time.monotonic()
    detector_name = "deepsafe_ensemble"

    if not settings.DEEPSAFE_ENABLED:
        return DetectorResult(
            detector=detector_name, enabled=False, ran=False,
            error="DeepSafe disabled in config (DEEPSAFE_ENABLED=False)",
        )

    # Determine content type
    ext = Path(filename).suffix.lower()
    content_type_map = {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png", ".webp": "image/webp",
        ".mp4": "video/mp4", ".avi": "video/avi",
        ".mov": "video/quicktime", ".mkv": "video/x-matroska",
    }
    content_type = content_type_map.get(ext, "application/octet-stream")

    url = f"{settings.DEEPSAFE_BASE_URL}/analyze"

    try:
        async with httpx.AsyncClient(timeout=settings.SCAN_TIMEOUT_SECONDS) as client:
            logger.info(f"[DeepSafe] Sending {filename} ({len(file_bytes)} bytes) to {url}")

            response = await client.post(
                url,
                files={"file": (filename, file_bytes, content_type)},
            )
            response.raise_for_status()
            data = response.json()

        fake_prob = _parse_deepsafe_response(data)
        latency_ms = int((time.monotonic() - start) * 1000)

        logger.info(f"[DeepSafe] {filename} → fake_prob={fake_prob:.3f} ({latency_ms}ms)")

        return DetectorResult(
            detector=detector_name,
            enabled=True,
            ran=True,
            fake_probability=fake_prob,
            confidence=max(fake_prob, 1 - fake_prob),
            label="FAKE" if fake_prob >= 0.5 else "REAL",
            raw_response=data,
            latency_ms=latency_ms,
        )

    except httpx.ConnectError:
        msg = (
            "Cannot reach DeepSafe Docker container at "
            f"{settings.DEEPSAFE_BASE_URL}. "
            "Is it running? Try: cd DeepSafe && docker-compose up --build"
        )
        logger.warning(f"[DeepSafe] {msg}")
        return DetectorResult(
            detector=detector_name, enabled=True, ran=False,
            error=msg,
            latency_ms=int((time.monotonic() - start) * 1000),
        )
    except httpx.HTTPStatusError as e:
        logger.error(f"[DeepSafe] HTTP {e.response.status_code}: {e.response.text[:200]}")
        return DetectorResult(
            detector=detector_name, enabled=True, ran=False,
            error=f"HTTP {e.response.status_code}: {e.response.text[:200]}",
            latency_ms=int((time.monotonic() - start) * 1000),
        )
    except Exception as e:
        logger.error(f"[DeepSafe] Unexpected error: {e}")
        return DetectorResult(
            detector=detector_name, enabled=True, ran=False,
            error=str(e),
            latency_ms=int((time.monotonic() - start) * 1000),
        )


def _parse_deepsafe_response(data: dict) -> float:
    """
    Parse DeepSafe API response.
    Expected format (may vary by version):
      { "fake_probability": 0.87, "model_votes": {"NPR": 1, "UFD": 1, "ViT": 0} }
    or:
      { "prediction": "fake", "confidence": 0.87 }
    """
    # Try direct fake_probability field
    if "fake_probability" in data:
        return float(data["fake_probability"])

    # Try confidence + prediction
    if "confidence" in data and "prediction" in data:
        conf = float(data["confidence"])
        label = data["prediction"].lower()
        return conf if "fake" in label else 1.0 - conf

    # Try model_votes majority
    if "model_votes" in data:
        votes = data["model_votes"]
        fake_votes = sum(1 for v in votes.values() if v == 1)
        total_votes = len(votes)
        if total_votes > 0:
            return fake_votes / total_votes

    # Try result field
    if "result" in data:
        result = str(data["result"]).lower()
        if "fake" in result:
            return 0.85
        elif "real" in result:
            return 0.15

    logger.warning(f"[DeepSafe] Unrecognized response format: {data}")
    return 0.5  # Unknown — neutral score
