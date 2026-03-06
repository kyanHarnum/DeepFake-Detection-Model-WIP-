"""
Scan Orchestrator
=================
Routes uploaded media to the correct detectors in parallel,
then hands results to the ensemble scorer.

Media routing:
  IMAGE → HuggingFace + DeepSafe + DeepFake-o-Meter
  VIDEO → DeepSafe + DeepFake-o-Meter
  AUDIO → Resemble AI + DeepFake-o-Meter (audio mode)
"""

import asyncio
import uuid
import time
from datetime import datetime, timezone
from pathlib import Path

from app.core.config import settings
from app.core.models import DetectorResult, MediaType, ScanResult
from app.core.ensemble import compute_ensemble_score, build_detector_summary
from app.core.logger import logger
from app.detectors.huggingface_detector import run_huggingface_detector
from app.detectors.deepsafe_detector import run_deepsafe_detector
from app.detectors.deepometer_detector import run_deepometer_detector
from app.detectors.resemble_detector import run_resemble_detector


IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff"}
VIDEO_EXTS = {".mp4", ".avi", ".mov", ".mkv", ".webm", ".flv"}
AUDIO_EXTS = {".wav", ".mp3", ".m4a", ".ogg", ".flac", ".aac"}


def detect_media_type(filename: str) -> MediaType:
    """Infer media type from file extension."""
    ext = Path(filename).suffix.lower()
    if ext in IMAGE_EXTS:
        return MediaType.IMAGE
    elif ext in VIDEO_EXTS:
        return MediaType.VIDEO
    elif ext in AUDIO_EXTS:
        return MediaType.AUDIO
    else:
        # Default to image for unknown types
        logger.warning(f"Unknown extension '{ext}', defaulting to IMAGE")
        return MediaType.IMAGE


async def scan_media(
    file_bytes: bytes,
    filename: str,
    media_type: MediaType = None,
) -> ScanResult:
    """
    Main entry point. Orchestrate all detectors in parallel.

    Args:
        file_bytes: Raw file content
        filename: Original filename
        media_type: Override auto-detection if provided

    Returns:
        ScanResult with ensemble verdict and per-detector breakdown
    """
    scan_id = str(uuid.uuid4())
    overall_start = time.monotonic()

    if media_type is None:
        media_type = detect_media_type(filename)

    logger.info(f"[Scan {scan_id[:8]}] Starting scan: {filename} ({media_type}, {len(file_bytes)} bytes)")

    # ── Route to appropriate detectors ────────────────────────────────────────

    tasks = []

    if media_type == MediaType.IMAGE:
        tasks = [
            run_huggingface_detector(file_bytes, filename),
            run_deepsafe_detector(file_bytes, filename, media_type="image"),
            run_deepometer_detector(file_bytes, filename, media_type="image"),
        ]

    elif media_type == MediaType.VIDEO:
        tasks = [
            run_deepsafe_detector(file_bytes, filename, media_type="video"),
            run_deepometer_detector(file_bytes, filename, media_type="video"),
        ]

    elif media_type == MediaType.AUDIO:
        tasks = [
            run_resemble_detector(file_bytes, filename),
            run_deepometer_detector(file_bytes, filename, media_type="audio"),
        ]

    # ── Run all detectors concurrently ────────────────────────────────────────
    detector_results: list[DetectorResult] = await asyncio.gather(*tasks, return_exceptions=False)

    # ── Compute ensemble score ────────────────────────────────────────────────
    ensemble_prob, confidence, threat_level = compute_ensemble_score(detector_results)

    total_latency = int((time.monotonic() - overall_start) * 1000)
    ran_count = sum(1 for d in detector_results if d.ran)

    logger.info(
        f"[Scan {scan_id[:8]}] Complete: threat={threat_level} "
        f"fake_prob={ensemble_prob:.3f} ({ran_count}/{len(detector_results)} detectors, {total_latency}ms)"
    )

    # ── Build notes ───────────────────────────────────────────────────────────
    notes = _build_notes(ensemble_prob, threat_level, detector_results, ran_count)

    return ScanResult(
        scan_id=scan_id,
        media_type=media_type,
        filename=filename,
        file_size_bytes=len(file_bytes),
        ensemble_fake_probability=ensemble_prob,
        threat_level=threat_level,
        confidence=confidence,
        detectors=detector_results,
        detectors_run=len(detector_results),
        detectors_succeeded=ran_count,
        total_latency_ms=total_latency,
        timestamp=datetime.now(timezone.utc).isoformat(),
        notes=notes,
    )


def _build_notes(ensemble_prob, threat_level, detectors, ran_count) -> str:
    """Generate human-readable explanation of the verdict."""
    parts = []

    if ran_count == 0:
        return "No detectors could run. Check API keys and service availability."

    if threat_level.value == "block":
        parts.append(f"HIGH CONFIDENCE DEEPFAKE ({ensemble_prob:.0%} probability).")
    elif threat_level.value == "flag":
        parts.append(f"Suspicious media flagged for review ({ensemble_prob:.0%} fake probability).")
    else:
        parts.append(f"Media appears authentic ({ensemble_prob:.0%} fake probability).")

    failed = [d for d in detectors if not d.ran and d.enabled]
    if failed:
        names = ", ".join(d.detector for d in failed)
        parts.append(f"Note: {len(failed)} detector(s) unavailable ({names}) — check config.")

    return " ".join(parts)
