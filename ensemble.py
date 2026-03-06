"""
Ensemble Scoring Engine
=======================
Combines results from all detectors into a single weighted fake probability.

Scoring strategy:
  - Only detectors that SUCCESSFULLY ran contribute to the ensemble
  - Weights are re-normalized across successful detectors
  - If only 1 detector ran, its score is used directly with a confidence penalty
  - Cross-modal bonus: if both video + audio signal fake, confidence boosted

Threat levels:
  - BLOCK : ensemble >= THRESHOLD_BLOCK (0.80)
  - FLAG  : ensemble >= THRESHOLD_FLAG  (0.55)
  - PASS  : ensemble <  THRESHOLD_FLAG
"""

from typing import List, Dict, Tuple
from app.core.config import settings
from app.core.models import DetectorResult, ThreatLevel
from app.core.logger import logger


# Base weights per detector (normalized dynamically based on who ran)
BASE_WEIGHTS: Dict[str, float] = {
    "huggingface_siglip":        0.25,
    "huggingface_siglip_local":  0.25,
    "deepsafe_ensemble":         0.30,
    "deepometer_ub":             0.30,
    "resemble_detect2b":         0.15,  # Audio-only weight
}


def compute_ensemble_score(
    detectors: List[DetectorResult],
) -> Tuple[float, float, ThreatLevel]:
    """
    Compute weighted ensemble fake probability from detector results.

    Args:
        detectors: List of DetectorResult objects (ran or not)

    Returns:
        Tuple of (ensemble_fake_probability, confidence, threat_level)
    """
    successful = [d for d in detectors if d.ran and d.fake_probability is not None]

    if not successful:
        logger.warning("[Ensemble] No detectors returned results — returning neutral score")
        return 0.5, 0.0, ThreatLevel.FLAG

    # Build weight map from successful detectors only
    weight_map = {}
    for d in successful:
        w = BASE_WEIGHTS.get(d.detector, 0.20)
        weight_map[d.detector] = w

    # Normalize weights to sum to 1.0
    total_weight = sum(weight_map.values())
    normalized = {k: v / total_weight for k, v in weight_map.items()}

    # Weighted average
    ensemble = sum(
        d.fake_probability * normalized[d.detector]
        for d in successful
    )
    ensemble = round(min(max(ensemble, 0.0), 1.0), 4)

    # Confidence = how many detectors agree
    confidence = _compute_agreement_confidence(successful, ensemble)

    # Cross-modal amplification: if both visual + audio say fake
    has_visual_fake = any(
        d.fake_probability >= 0.7
        for d in successful
        if d.detector in ("huggingface_siglip", "huggingface_siglip_local", "deepsafe_ensemble", "deepometer_ub")
    )
    has_audio_fake = any(
        d.fake_probability >= 0.7
        for d in successful
        if d.detector == "resemble_detect2b"
    )
    if has_visual_fake and has_audio_fake:
        ensemble = min(ensemble * 1.08, 1.0)  # +8% boost when both modalities agree
        confidence = min(confidence * 1.05, 1.0)
        logger.info("[Ensemble] Cross-modal agreement boost applied")

    # Single-detector confidence penalty
    if len(successful) == 1:
        confidence = min(confidence * 0.75, 0.75)
        logger.info(f"[Ensemble] Single detector penalty applied (only {successful[0].detector} ran)")

    ensemble = round(ensemble, 4)
    confidence = round(confidence, 4)
    threat_level = _determine_threat_level(ensemble)

    logger.info(
        f"[Ensemble] fake_prob={ensemble:.3f} confidence={confidence:.3f} "
        f"threat={threat_level} ({len(successful)}/{len(detectors)} detectors ran)"
    )

    return ensemble, confidence, threat_level


def _compute_agreement_confidence(
    successful: List[DetectorResult],
    ensemble: float,
) -> float:
    """
    Confidence = degree of agreement between detectors.
    Higher when all detectors say the same thing.
    """
    if len(successful) == 1:
        d = successful[0]
        return d.confidence if d.confidence is not None else max(d.fake_probability, 1 - d.fake_probability)

    # Check how many agree with ensemble direction
    threshold = 0.5
    ensemble_label = "fake" if ensemble >= threshold else "real"
    agreeing = [
        d for d in successful
        if (d.fake_probability >= threshold) == (ensemble >= threshold)
    ]
    agreement_ratio = len(agreeing) / len(successful)

    # Average individual confidences
    avg_confidence = sum(
        d.confidence if d.confidence is not None else max(d.fake_probability, 1 - d.fake_probability)
        for d in successful
    ) / len(successful)

    # Final confidence = blend of agreement + avg confidence
    final = (agreement_ratio * 0.5) + (avg_confidence * 0.5)
    return round(min(final, 1.0), 4)


def _determine_threat_level(fake_probability: float) -> ThreatLevel:
    """Map fake probability to action."""
    if fake_probability >= settings.THRESHOLD_BLOCK:
        return ThreatLevel.BLOCK
    elif fake_probability >= settings.THRESHOLD_FLAG:
        return ThreatLevel.FLAG
    else:
        return ThreatLevel.PASS


def build_detector_summary(detectors: List[DetectorResult]) -> Dict:
    """Generate a human-readable summary of detector results."""
    ran = [d for d in detectors if d.ran]
    failed = [d for d in detectors if not d.ran and d.enabled]
    disabled = [d for d in detectors if not d.enabled]

    return {
        "ran": [d.detector for d in ran],
        "failed": [{"detector": d.detector, "error": d.error} for d in failed],
        "disabled": [d.detector for d in disabled],
        "votes": {
            d.detector: {
                "label": d.label,
                "fake_probability": d.fake_probability,
                "latency_ms": d.latency_ms,
            }
            for d in ran
        },
    }
