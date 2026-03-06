"""
Detector 1: HuggingFace — deepfake-detector-model-v1
=====================================================
Model  : prithivMLmods/deepfake-detector-model-v1
Base   : Google SigLIP fine-tuned for binary deepfake classification
License: Apache 2.0
Cost   : Free (Inference API) or free self-hosted
Accuracy: ~94.4% on test benchmark

Two modes:
  - REMOTE: calls HuggingFace Inference API (zero infra, rate-limited)
  - LOCAL : loads model locally via transformers (no rate limits, needs GPU/CPU)

Set HUGGINGFACE_API_TOKEN in .env for remote mode.
"""

import time
import asyncio
import httpx
from typing import Optional

from app.core.config import settings
from app.core.models import DetectorResult
from app.core.logger import logger

HF_API_URL = f"https://api-inference.huggingface.co/models/{settings.HUGGINGFACE_MODEL}"


async def run_huggingface_detector(
    file_bytes: bytes,
    filename: str,
    use_local: bool = False,
) -> DetectorResult:
    """
    Run deepfake image detection via HuggingFace.

    Args:
        file_bytes: Raw image bytes
        filename: Original filename (for logging)
        use_local: If True, load model locally (requires transformers + torch)

    Returns:
        DetectorResult with fake_probability and label
    """
    start = time.monotonic()
    detector_name = "huggingface_siglip"

    if use_local:
        return await _run_local(file_bytes, filename, start, detector_name)
    else:
        return await _run_remote_api(file_bytes, filename, start, detector_name)


async def _run_remote_api(
    file_bytes: bytes,
    filename: str,
    start: float,
    detector_name: str,
) -> DetectorResult:
    """Call the HuggingFace Inference API (free tier, no GPU needed)."""

    if not settings.HUGGINGFACE_API_TOKEN:
        return DetectorResult(
            detector=detector_name,
            enabled=True,
            ran=False,
            error="HUGGINGFACE_API_TOKEN not set. Add it to your .env file.",
        )

    headers = {"Authorization": f"Bearer {settings.HUGGINGFACE_API_TOKEN}"}

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            logger.info(f"[HuggingFace] Sending {filename} to Inference API...")
            response = await client.post(HF_API_URL, headers=headers, content=file_bytes)

            if response.status_code == 503:
                # Model is loading — wait and retry once
                logger.warning("[HuggingFace] Model loading, retrying in 10s...")
                await asyncio.sleep(10)
                response = await client.post(HF_API_URL, headers=headers, content=file_bytes)

            response.raise_for_status()
            data = response.json()

        # Response format: [{"label": "Fake", "score": 0.94}, {"label": "Real", "score": 0.06}]
        fake_prob = _extract_fake_probability(data)
        latency_ms = int((time.monotonic() - start) * 1000)

        logger.info(f"[HuggingFace] {filename} → fake_prob={fake_prob:.3f} ({latency_ms}ms)")

        return DetectorResult(
            detector=detector_name,
            enabled=True,
            ran=True,
            fake_probability=fake_prob,
            confidence=max(fake_prob, 1 - fake_prob),
            label="FAKE" if fake_prob >= 0.5 else "REAL",
            raw_response={"predictions": data},
            latency_ms=latency_ms,
        )

    except httpx.HTTPStatusError as e:
        logger.error(f"[HuggingFace] HTTP error: {e.response.status_code} — {e.response.text}")
        return DetectorResult(
            detector=detector_name, enabled=True, ran=False,
            error=f"HTTP {e.response.status_code}: {e.response.text[:200]}",
            latency_ms=int((time.monotonic() - start) * 1000),
        )
    except Exception as e:
        logger.error(f"[HuggingFace] Unexpected error: {e}")
        return DetectorResult(
            detector=detector_name, enabled=True, ran=False,
            error=str(e),
            latency_ms=int((time.monotonic() - start) * 1000),
        )


async def _run_local(
    file_bytes: bytes,
    filename: str,
    start: float,
    detector_name: str,
) -> DetectorResult:
    """
    Run model locally using transformers + torch.
    Install: pip install transformers torch pillow

    This runs in a thread pool to avoid blocking the event loop.
    """
    try:
        import io
        from PIL import Image
        import torch
        from transformers import AutoImageProcessor, AutoModelForImageClassification

        def _infer():
            model_id = settings.HUGGINGFACE_MODEL
            processor = AutoImageProcessor.from_pretrained(model_id)
            model = AutoModelForImageClassification.from_pretrained(model_id)
            model.eval()

            image = Image.open(io.BytesIO(file_bytes)).convert("RGB")
            inputs = processor(images=image, return_tensors="pt")

            with torch.no_grad():
                logits = model(**inputs).logits

            probs = torch.nn.functional.softmax(logits, dim=1).squeeze().tolist()
            id2label = model.config.id2label

            results = [
                {"label": id2label[i], "score": round(float(p), 4)}
                for i, p in enumerate(probs)
            ]
            return results

        loop = asyncio.get_event_loop()
        data = await loop.run_in_executor(None, _infer)

        fake_prob = _extract_fake_probability(data)
        latency_ms = int((time.monotonic() - start) * 1000)

        logger.info(f"[HuggingFace/local] {filename} → fake_prob={fake_prob:.3f} ({latency_ms}ms)")

        return DetectorResult(
            detector=f"{detector_name}_local",
            enabled=True,
            ran=True,
            fake_probability=fake_prob,
            confidence=max(fake_prob, 1 - fake_prob),
            label="FAKE" if fake_prob >= 0.5 else "REAL",
            raw_response={"predictions": data},
            latency_ms=latency_ms,
        )

    except ImportError:
        return DetectorResult(
            detector=detector_name, enabled=True, ran=False,
            error="Local inference requires: pip install transformers torch pillow",
        )
    except Exception as e:
        logger.error(f"[HuggingFace/local] Error: {e}")
        return DetectorResult(
            detector=detector_name, enabled=True, ran=False,
            error=str(e),
            latency_ms=int((time.monotonic() - start) * 1000),
        )


def _extract_fake_probability(predictions: list) -> float:
    """Parse HuggingFace classification output to get fake probability."""
    for item in predictions:
        label = item.get("label", "").lower()
        if "fake" in label or "deepfake" in label or "manipulated" in label:
            return float(item["score"])
    # Fallback: assume first result is "fake"
    if predictions:
        return float(predictions[0]["score"])
    return 0.5
