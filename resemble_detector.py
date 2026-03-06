"""
Detector 4: Resemble AI — DETECT-2B Audio Deepfake Detection
=============================================================
Site   : resemble.ai/detect
License: Commercial (free tier available)
Cost   : Free tier (limited monthly minutes)
Model  : Mamba-SSM architecture (DETECT-2B)
Accuracy: 94–98% across 30+ languages
Best for: Voice calls, audio recordings, voicemail

Sign up free at: https://app.resemble.ai/register
Get API key from: https://app.resemble.ai/account/api_key
"""

import time
import asyncio
import httpx
from pathlib import Path

from app.core.config import settings
from app.core.models import DetectorResult
from app.core.logger import logger

SUPPORTED_AUDIO_FORMATS = {".wav", ".mp3", ".m4a", ".ogg", ".flac", ".aac", ".webm"}


async def run_resemble_detector(
    file_bytes: bytes,
    filename: str,
) -> DetectorResult:
    """
    Detect AI-synthesized/cloned voice using Resemble AI DETECT-2B.

    Args:
        file_bytes: Raw audio file bytes
        filename: Original filename (used to determine format)

    Returns:
        DetectorResult indicating synthetic vs authentic voice
    """
    start = time.monotonic()
    detector_name = "resemble_detect2b"

    if not settings.RESEMBLE_ENABLED:
        return DetectorResult(
            detector=detector_name, enabled=False, ran=False,
            error="Resemble AI disabled in config (RESEMBLE_ENABLED=False)",
        )

    if not settings.RESEMBLE_API_KEY:
        return DetectorResult(
            detector=detector_name, enabled=True, ran=False,
            error=(
                "RESEMBLE_API_KEY not set. "
                "Get your free API key at: https://app.resemble.ai/account/api_key"
            ),
        )

    ext = Path(filename).suffix.lower()
    if ext not in SUPPORTED_AUDIO_FORMATS:
        return DetectorResult(
            detector=detector_name, enabled=True, ran=False,
            error=f"Unsupported audio format: {ext}. Supported: {SUPPORTED_AUDIO_FORMATS}",
        )

    # Map file extension to MIME type
    mime_types = {
        ".wav": "audio/wav", ".mp3": "audio/mpeg", ".m4a": "audio/mp4",
        ".ogg": "audio/ogg", ".flac": "audio/flac", ".aac": "audio/aac",
        ".webm": "audio/webm",
    }
    content_type = mime_types.get(ext, "audio/wav")

    url = f"{settings.RESEMBLE_BASE_URL}/detect"
    headers = {
        "Authorization": f"Token {settings.RESEMBLE_API_KEY}",
        "Accept": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=settings.SCAN_TIMEOUT_SECONDS) as client:
            logger.info(f"[Resemble AI] Sending {filename} ({len(file_bytes)} bytes)...")

            response = await client.post(
                url,
                headers=headers,
                files={"audio": (filename, file_bytes, content_type)},
                data={"model": "detect-2b"},
            )
            response.raise_for_status()
            data = response.json()

        fake_prob, language, extra = _parse_resemble_response(data)
        latency_ms = int((time.monotonic() - start) * 1000)

        logger.info(
            f"[Resemble AI] {filename} → fake_prob={fake_prob:.3f} "
            f"lang={language} ({latency_ms}ms)"
        )

        return DetectorResult(
            detector=detector_name,
            enabled=True,
            ran=True,
            fake_probability=fake_prob,
            confidence=max(fake_prob, 1 - fake_prob),
            label="SYNTHETIC" if fake_prob >= 0.5 else "AUTHENTIC",
            raw_response={**data, "parsed_language": language, **extra},
            latency_ms=latency_ms,
        )

    except httpx.ConnectError:
        msg = f"Cannot reach Resemble AI at {settings.RESEMBLE_BASE_URL}"
        logger.warning(f"[Resemble AI] {msg}")
        return DetectorResult(
            detector=detector_name, enabled=True, ran=False,
            error=msg,
            latency_ms=int((time.monotonic() - start) * 1000),
        )
    except httpx.HTTPStatusError as e:
        logger.error(f"[Resemble AI] HTTP {e.response.status_code}: {e.response.text[:200]}")
        return DetectorResult(
            detector=detector_name, enabled=True, ran=False,
            error=f"HTTP {e.response.status_code}: {e.response.text[:200]}",
            latency_ms=int((time.monotonic() - start) * 1000),
        )
    except Exception as e:
        logger.error(f"[Resemble AI] Unexpected error: {e}")
        return DetectorResult(
            detector=detector_name, enabled=True, ran=False,
            error=str(e),
            latency_ms=int((time.monotonic() - start) * 1000),
        )


def _parse_resemble_response(data: dict):
    """
    Parse Resemble AI DETECT-2B response.

    Expected format:
    {
      "prediction": "synthetic",   // or "human"
      "confidence": 0.96,
      "detected_language": "en",
      "segments": [                // optional, per-segment breakdown
        {"start": 0.0, "end": 2.5, "prediction": "synthetic", "confidence": 0.98},
        ...
      ]
    }
    """
    language = data.get("detected_language", "unknown")
    extra = {}

    # Parse main prediction
    if "prediction" in data and "confidence" in data:
        prediction = data["prediction"].lower()
        confidence = float(data["confidence"])
        fake_prob = confidence if "synthetic" in prediction or "fake" in prediction else 1.0 - confidence

    elif "score" in data:
        fake_prob = float(data["score"])

    elif "is_synthetic" in data:
        fake_prob = 0.9 if data["is_synthetic"] else 0.1

    else:
        fake_prob = 0.5

    # Collect segment-level analysis if available
    if "segments" in data and data["segments"]:
        segments = data["segments"]
        synthetic_segments = [
            s for s in segments
            if "synthetic" in s.get("prediction", "").lower()
        ]
        extra["segment_count"] = len(segments)
        extra["synthetic_segment_count"] = len(synthetic_segments)
        extra["synthetic_segment_ratio"] = round(
            len(synthetic_segments) / len(segments), 3
        ) if segments else 0.0

    return round(fake_prob, 4), language, extra
