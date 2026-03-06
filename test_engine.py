"""
Test Suite for DeepShield Detection Engine
==========================================
Tests cover:
  - Ensemble scoring logic (no external services needed)
  - Media type detection
  - Threat level thresholds
  - Response parsing for each detector
  - API route structure

Run:
    pytest tests/ -v
    pytest tests/ -v --tb=short  # less verbose
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock

from app.core.models import DetectorResult, MediaType, ThreatLevel
from app.core.ensemble import compute_ensemble_score, build_detector_summary
from app.core.scanner import detect_media_type
from app.detectors.huggingface_detector import _extract_fake_probability
from app.detectors.deepometer_detector import _parse_deepometer_response
from app.detectors.resemble_detector import _parse_resemble_response


# ── Ensemble scoring tests ─────────────────────────────────────────────────────

class TestEnsembleScoring:

    def _make_result(self, detector, fake_prob, ran=True, confidence=None):
        return DetectorResult(
            detector=detector,
            enabled=True,
            ran=ran,
            fake_probability=fake_prob if ran else None,
            confidence=confidence or (max(fake_prob, 1 - fake_prob) if ran else None),
            label="FAKE" if (ran and fake_prob >= 0.5) else "REAL",
        )

    def test_all_detectors_agree_fake(self):
        results = [
            self._make_result("huggingface_siglip", 0.95),
            self._make_result("deepsafe_ensemble", 0.91),
            self._make_result("deepometer_ub", 0.88),
        ]
        prob, conf, level = compute_ensemble_score(results)
        assert prob >= 0.80
        assert level == ThreatLevel.BLOCK

    def test_all_detectors_agree_real(self):
        results = [
            self._make_result("huggingface_siglip", 0.08),
            self._make_result("deepsafe_ensemble", 0.12),
            self._make_result("deepometer_ub", 0.10),
        ]
        prob, conf, level = compute_ensemble_score(results)
        assert prob < 0.55
        assert level == ThreatLevel.PASS

    def test_mixed_signals_flag(self):
        results = [
            self._make_result("huggingface_siglip", 0.72),
            self._make_result("deepsafe_ensemble", 0.45),
            self._make_result("deepometer_ub", 0.60),
        ]
        prob, conf, level = compute_ensemble_score(results)
        assert level in (ThreatLevel.FLAG, ThreatLevel.BLOCK)

    def test_no_detectors_ran(self):
        results = [
            self._make_result("huggingface_siglip", 0.0, ran=False),
            self._make_result("deepsafe_ensemble", 0.0, ran=False),
        ]
        prob, conf, level = compute_ensemble_score(results)
        assert prob == 0.5
        assert level == ThreatLevel.FLAG

    def test_single_detector_confidence_penalty(self):
        results = [
            self._make_result("deepsafe_ensemble", 0.0, ran=False),
            self._make_result("deepometer_ub", 0.90),
        ]
        _, conf, _ = compute_ensemble_score(results)
        assert conf <= 0.75  # Penalty applied

    def test_cross_modal_boost(self):
        results = [
            self._make_result("deepsafe_ensemble", 0.78),
            self._make_result("deepometer_ub", 0.75),
            self._make_result("resemble_detect2b", 0.82),
        ]
        prob, _, _ = compute_ensemble_score(results)
        # Should be boosted slightly above raw weighted average
        raw_avg = (0.78 * 0.30 + 0.75 * 0.30 + 0.82 * 0.15) / (0.30 + 0.30 + 0.15)
        assert prob >= raw_avg

    def test_probability_always_clamped(self):
        results = [
            self._make_result("huggingface_siglip", 0.99),
            self._make_result("deepsafe_ensemble", 0.99),
            self._make_result("deepometer_ub", 0.99),
            self._make_result("resemble_detect2b", 0.99),
        ]
        prob, _, _ = compute_ensemble_score(results)
        assert 0.0 <= prob <= 1.0


# ── Media type detection tests ─────────────────────────────────────────────────

class TestMediaTypeDetection:

    def test_image_extensions(self):
        for ext in ["photo.jpg", "image.jpeg", "picture.PNG", "frame.webp"]:
            assert detect_media_type(ext) == MediaType.IMAGE

    def test_video_extensions(self):
        for ext in ["video.mp4", "clip.avi", "recording.MOV", "file.mkv"]:
            assert detect_media_type(ext) == MediaType.VIDEO

    def test_audio_extensions(self):
        for ext in ["call.wav", "voice.mp3", "audio.m4a", "recording.flac"]:
            assert detect_media_type(ext) == MediaType.AUDIO

    def test_unknown_defaults_to_image(self):
        assert detect_media_type("file.xyz") == MediaType.IMAGE


# ── Parser tests ───────────────────────────────────────────────────────────────

class TestHuggingFaceParsing:

    def test_fake_label_extracted(self):
        data = [{"label": "Fake", "score": 0.94}, {"label": "Real", "score": 0.06}]
        assert _extract_fake_probability(data) == 0.94

    def test_deepfake_label_variant(self):
        data = [{"label": "deepfake", "score": 0.82}, {"label": "authentic", "score": 0.18}]
        assert _extract_fake_probability(data) == 0.82

    def test_real_first_no_fake_label(self):
        data = [{"label": "Real", "score": 0.91}, {"label": "Unknown", "score": 0.09}]
        # Falls back to first entry
        assert _extract_fake_probability(data) == 0.91

    def test_empty_list(self):
        assert _extract_fake_probability([]) == 0.5


class TestDeepometerParsing:

    def test_standard_response(self):
        data = {
            "deepfake_probability": 0.87,
            "detectors": {
                "FaceForensics": {"probability": 0.91},
                "XceptionNet": {"probability": 0.84},
            }
        }
        prob, breakdown = _parse_deepometer_response(data)
        assert prob == 0.87
        assert "FaceForensics" in breakdown
        assert breakdown["XceptionNet"] == 0.84

    def test_fallback_to_breakdown_average(self):
        data = {
            "detectors": {
                "ModelA": {"probability": 0.80},
                "ModelB": {"probability": 0.60},
            }
        }
        prob, breakdown = _parse_deepometer_response(data)
        assert abs(prob - 0.70) < 0.01

    def test_empty_response(self):
        prob, breakdown = _parse_deepometer_response({})
        assert prob == 0.5
        assert breakdown == {}


class TestResembleParsing:

    def test_synthetic_prediction(self):
        data = {"prediction": "synthetic", "confidence": 0.96, "detected_language": "en"}
        prob, lang, extra = _parse_resemble_response(data)
        assert prob == 0.96
        assert lang == "en"

    def test_human_prediction(self):
        data = {"prediction": "human", "confidence": 0.91, "detected_language": "fr"}
        prob, lang, extra = _parse_resemble_response(data)
        assert prob == 0.09  # 1.0 - 0.91

    def test_segment_analysis(self):
        data = {
            "prediction": "synthetic", "confidence": 0.85,
            "detected_language": "es",
            "segments": [
                {"start": 0, "end": 2, "prediction": "synthetic", "confidence": 0.9},
                {"start": 2, "end": 4, "prediction": "human", "confidence": 0.7},
                {"start": 4, "end": 6, "prediction": "synthetic", "confidence": 0.88},
            ]
        }
        prob, lang, extra = _parse_resemble_response(data)
        assert extra["segment_count"] == 3
        assert extra["synthetic_segment_count"] == 2
        assert abs(extra["synthetic_segment_ratio"] - 0.667) < 0.01

    def test_is_synthetic_boolean(self):
        data = {"is_synthetic": True}
        prob, _, _ = _parse_resemble_response(data)
        assert prob == 0.9


# ── Detector summary tests ─────────────────────────────────────────────────────

class TestDetectorSummary:

    def test_summary_structure(self):
        results = [
            DetectorResult(detector="huggingface_siglip", enabled=True, ran=True, fake_probability=0.9, label="FAKE"),
            DetectorResult(detector="deepsafe_ensemble", enabled=True, ran=False, error="Docker not running"),
            DetectorResult(detector="deepometer_ub", enabled=False, ran=False),
        ]
        summary = build_detector_summary(results)
        assert "huggingface_siglip" in summary["ran"]
        assert len(summary["failed"]) == 1
        assert "deepometer_ub" in summary["disabled"]
        assert "huggingface_siglip" in summary["votes"]
