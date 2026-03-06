"""
Detector 3: DeepFake-o-Meter (University at Buffalo)
=====================================================
Org    : UB Media Forensics Lab (DARPA/NSF funded)
Repo   : github.com/yuezunli/deepfake-o-meter
Site   : zinc.cse.buffalo.edu/ubmdfl/deep-o-meter
License: Open Source (research use)
Cost   : Free (register for API key)
Models : 18 state-of-the-art detectors across video, image, audio

This is the academic gold standard — used by journalists and law enforcement.
Register at the site above to get a free API key, or self-host the full stack.

Self-host:
    git clone https://github.com/yuezunli/deepfake-o-meter
    # Follow their Docker setup instructions
"""

import time
import asyncio
import httpx
from typing import Optional, List

from app.core.config import settings
from app.core.models import DetectorResult
from app.core.logger import logger

# All 18 detectors available — use "all" or pick specific ones
ALL_DETECTORS = "all"
FAST_DETECTORS = ["FaceForensics", "XceptionNet", "EfficientNet", "CNNDetection"]


async def run_deepometer_detector(
    file_bytes: bytes,
    filename: str,
    media_type: str = "video",
    detectors: str = ALL_DETECTORS,
) -> DetectorResult:
    """
    Submit media to DeepFake-o-Meter for multi-model analysis.

    Args:
        file_bytes: Raw file bytes
        filename: Original filename
        media_type: "video", "image", or "audio"
        detectors: "all" or comma-separated detector names

    Returns:
        DetectorResult with ensemble of 18 academic detectors
    """
    start = time.monotonic()
    detector_name = "deepometer_ub"

    if not settings.DEEPOMETER_ENABLED:
        return DetectorResult(
            detector=detector_name, enabled=False, ran=False,
            error="DeepFake-o-Meter disabled in config",
        )

    if not settings.DEEPOMETER_API_KEY:
        logger.warning("[DeepFake-o-Meter] No API key set. Register free at zinc.cse.buffalo.edu")
        return DetectorResult(
            detector=detector_name, enabled=True, ran=False,
            error=(
                "DEEPOMETER_API_KEY not set. "
                "Register free at: https://zinc.cse.buffalo.edu/ubmdfl/deep-o-meter/landing_page"
            ),
        )

    url = f"{settings.DEEPOMETER_BASE_URL}/analyze"
    headers = {
        "Authorization": f"Bearer {settings.DEEPOMETER_API_KEY}",
        "Accept": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=settings.SCAN_TIMEOUT_SECONDS) as client:
            logger.info(f"[DeepFake-o-Meter] Sending {filename} ({media_type}) with detectors={detectors}")

            response = await client.post(
                url,
                headers=headers,
                files={"file": (filename, file_bytes)},
                data={
                    "media_type": media_type,
                    "detectors": detectors,
                    "return_all": "true",
                },
            )
            response.raise_for_status()
            data = response.json()

        fake_prob, breakdown = _parse_deepometer_response(data)
        latency_ms = int((time.monotonic() - start) * 1000)

        logger.info(
            f"[DeepFake-o-Meter] {filename} → fake_prob={fake_prob:.3f} "
            f"({len(breakdown)} detectors, {latency_ms}ms)"
        )

        return DetectorResult(
            detector=detector_name,
            enabled=True,
            ran=True,
            fake_probability=fake_prob,
            confidence=max(fake_prob, 1 - fake_prob),
            label="FAKE" if fake_prob >= 0.5 else "REAL",
            raw_response={"ensemble": fake_prob, "breakdown": breakdown, "raw": data},
            latency_ms=latency_ms,
        )

    except httpx.ConnectError:
        msg = f"Cannot reach DeepFake-o-Meter at {settings.DEEPOMETER_BASE_URL}"
        logger.warning(f"[DeepFake-o-Meter] {msg}")
        return DetectorResult(
            detector=detector_name, enabled=True, ran=False,
            error=msg,
            latency_ms=int((time.monotonic() - start) * 1000),
        )
    except httpx.HTTPStatusError as e:
        logger.error(f"[DeepFake-o-Meter] HTTP {e.response.status_code}: {e.response.text[:300]}")
        return DetectorResult(
            detector=detector_name, enabled=True, ran=False,
            error=f"HTTP {e.response.status_code}: {e.response.text[:200]}",
            latency_ms=int((time.monotonic() - start) * 1000),
        )
    except Exception as e:
        logger.error(f"[DeepFake-o-Meter] Unexpected error: {e}")
        return DetectorResult(
            detector=detector_name, enabled=True, ran=False,
            error=str(e),
            latency_ms=int((time.monotonic() - start) * 1000),
        )


def _parse_deepometer_response(data: dict):
    """
    Parse DeepFake-o-Meter API response.

    Expected format:
    {
      "deepfake_probability": 0.87,
      "detectors": {
        "FaceForensics": {"probability": 0.91, "label": "fake"},
        "XceptionNet":   {"probability": 0.84, "label": "fake"},
        ...
      }
    }
    """
    breakdown = {}

    # Top-level ensemble score
    if "deepfake_probability" in data:
        ensemble = float(data["deepfake_probability"])
    elif "result" in data:
        ensemble = float(data["result"].get("deepfake_probability", 0.5))
    else:
        ensemble = None

    # Per-detector breakdown
    detectors_raw = data.get("detectors", data.get("results", {}))
    if isinstance(detectors_raw, dict):
        for name, result in detectors_raw.items():
            if isinstance(result, dict):
                prob = result.get("probability", result.get("score", result.get("fake_prob")))
                if prob is not None:
                    breakdown[name] = float(prob)
            elif isinstance(result, (int, float)):
                breakdown[name] = float(result)

    # If no top-level ensemble, compute from breakdown
    if ensemble is None and breakdown:
        ensemble = sum(breakdown.values()) / len(breakdown)
    elif ensemble is None:
        ensemble = 0.5

    return round(ensemble, 4), breakdown
