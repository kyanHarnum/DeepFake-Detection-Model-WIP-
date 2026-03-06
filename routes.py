"""
API Routes
==========
POST /api/v1/scan         — Single file scan
POST /api/v1/scan/batch   — Multiple files (up to 10)
GET  /api/v1/scan/{id}    — Get cached result (in-memory, extend with Redis/DB)
GET  /api/v1/detectors    — List detector status / health
"""

import uuid
from typing import Optional, List
from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.models import MediaType, ScanResult, BatchScanResult
from app.core.scanner import scan_media, detect_media_type
from app.core.logger import logger

router = APIRouter()

# In-memory result cache (replace with Redis or DB in production)
_scan_cache: dict[str, ScanResult] = {}
MAX_CACHE_SIZE = 500


# ── Single file scan ───────────────────────────────────────────────────────────

@router.post("/scan", response_model=ScanResult, summary="Scan a single media file for deepfakes")
async def scan_single(
    file: UploadFile = File(..., description="Image, video, or audio file to analyze"),
    media_type: Optional[MediaType] = Query(None, description="Override auto media type detection"),
):
    """
    Upload a file and run it through the full detection ensemble.

    - **Images**: HuggingFace SigLIP + DeepSafe + DeepFake-o-Meter
    - **Videos**: DeepSafe + DeepFake-o-Meter
    - **Audio**: Resemble AI DETECT-2B + DeepFake-o-Meter

    Returns a unified score, per-detector breakdown, and a threat level:
    - `pass`  — Media appears authentic
    - `flag`  — Suspicious, needs human review
    - `block` — High-confidence deepfake detected
    """
    # Validate file size
    file_bytes = await file.read()
    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024

    if len(file_bytes) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Max size: {settings.MAX_FILE_SIZE_MB}MB"
        )

    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded.")

    filename = file.filename or "upload"

    logger.info(f"[API] /scan — {filename} ({len(file_bytes)} bytes)")

    result = await scan_media(
        file_bytes=file_bytes,
        filename=filename,
        media_type=media_type,
    )

    # Cache result
    _cache_result(result)

    return result


# ── Batch scan ─────────────────────────────────────────────────────────────────

@router.post("/scan/batch", response_model=BatchScanResult, summary="Scan multiple files at once")
async def scan_batch(
    files: List[UploadFile] = File(..., description="Up to 10 files to scan simultaneously"),
):
    """Scan up to 10 files in parallel. Each file is analyzed independently."""

    if len(files) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 files per batch request.")

    import asyncio
    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024

    async def _scan_one(upload: UploadFile) -> ScanResult:
        data = await upload.read()
        if len(data) > max_bytes:
            raise HTTPException(413, f"{upload.filename} exceeds {settings.MAX_FILE_SIZE_MB}MB limit")
        return await scan_media(data, upload.filename or "upload")

    results = await asyncio.gather(*[_scan_one(f) for f in files], return_exceptions=True)

    valid_results = []
    for r in results:
        if isinstance(r, Exception):
            logger.error(f"[API] Batch item failed: {r}")
        else:
            valid_results.append(r)
            _cache_result(r)

    blocked = [r for r in valid_results if r.threat_level.value == "block"]
    flagged = [r for r in valid_results if r.threat_level.value == "flag"]
    passed  = [r for r in valid_results if r.threat_level.value == "pass"]

    return BatchScanResult(
        batch_id=str(uuid.uuid4()),
        total_files=len(files),
        results=valid_results,
        summary={
            "blocked": len(blocked),
            "flagged": len(flagged),
            "passed": len(passed),
            "errors": len(files) - len(valid_results),
            "avg_fake_probability": round(
                sum(r.ensemble_fake_probability for r in valid_results) / len(valid_results), 4
            ) if valid_results else 0,
        }
    )


# ── Get cached result ──────────────────────────────────────────────────────────

@router.get("/scan/{scan_id}", response_model=ScanResult, summary="Retrieve a previous scan result")
async def get_scan_result(scan_id: str):
    """Retrieve a previously computed scan result by scan ID."""
    result = _scan_cache.get(scan_id)
    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"Scan '{scan_id}' not found. Results are cached in-memory only."
        )
    return result


# ── Detector health ────────────────────────────────────────────────────────────

@router.get("/detectors", summary="Check detector availability and config status")
async def get_detector_status():
    """Returns which detectors are configured and ready to run."""
    return {
        "detectors": [
            {
                "name": "huggingface_siglip",
                "description": "SigLIP image classifier via HuggingFace Inference API",
                "modalities": ["image"],
                "status": "ready" if settings.HUGGINGFACE_API_TOKEN else "needs_key",
                "setup": "Set HUGGINGFACE_API_TOKEN in .env — free at huggingface.co",
                "weight": 0.25,
            },
            {
                "name": "deepsafe_ensemble",
                "description": "DeepSafe Docker ensemble (NPR + UFD + Cross Efficient ViT)",
                "modalities": ["image", "video"],
                "enabled": settings.DEEPSAFE_ENABLED,
                "status": "ready" if settings.DEEPSAFE_ENABLED else "disabled",
                "setup": "Run: cd DeepSafe && docker-compose up --build",
                "endpoint": settings.DEEPSAFE_BASE_URL,
                "weight": 0.30,
            },
            {
                "name": "deepometer_ub",
                "description": "DeepFake-o-Meter — University at Buffalo (18 academic models)",
                "modalities": ["image", "video", "audio"],
                "enabled": settings.DEEPOMETER_ENABLED,
                "status": "ready" if (settings.DEEPOMETER_ENABLED and settings.DEEPOMETER_API_KEY) else (
                    "disabled" if not settings.DEEPOMETER_ENABLED else "needs_key"
                ),
                "setup": "Register free at: zinc.cse.buffalo.edu/ubmdfl/deep-o-meter/landing_page",
                "weight": 0.30,
            },
            {
                "name": "resemble_detect2b",
                "description": "Resemble AI DETECT-2B — synthetic voice detection",
                "modalities": ["audio"],
                "enabled": settings.RESEMBLE_ENABLED,
                "status": "ready" if (settings.RESEMBLE_ENABLED and settings.RESEMBLE_API_KEY) else (
                    "disabled" if not settings.RESEMBLE_ENABLED else "needs_key"
                ),
                "setup": "Sign up at resemble.ai and set RESEMBLE_API_KEY in .env",
                "weight": 0.15,
            },
        ],
        "thresholds": {
            "block": settings.THRESHOLD_BLOCK,
            "flag": settings.THRESHOLD_FLAG,
        },
        "config": {
            "max_file_size_mb": settings.MAX_FILE_SIZE_MB,
            "scan_timeout_seconds": settings.SCAN_TIMEOUT_SECONDS,
            "environment": settings.ENVIRONMENT,
        }
    }


# ── Helpers ────────────────────────────────────────────────────────────────────

def _cache_result(result: ScanResult):
    """Store result in memory cache with LRU eviction."""
    global _scan_cache
    if len(_scan_cache) >= MAX_CACHE_SIZE:
        # Drop oldest entry
        oldest_key = next(iter(_scan_cache))
        del _scan_cache[oldest_key]
    _scan_cache[result.scan_id] = result
