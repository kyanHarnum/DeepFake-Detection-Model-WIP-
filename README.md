# DeepShield Detection Engine

Unified deepfake detection backend — wires four best-in-class free/open-source
detectors into a single scored API endpoint.

```
POST /api/v1/scan        → upload a file, get a verdict
POST /api/v1/scan/batch  → scan up to 10 files at once
GET  /api/v1/detectors   → check which detectors are ready
GET  /health             → service health check
```

---

## Detection Stack

| Detector | Modality | Accuracy | Cost | Source |
|---|---|---|---|---|
| HuggingFace SigLIP | Image | 94.4% | Free API | huggingface.co |
| DeepSafe Docker | Image + Video | Ensemble | Free (self-host) | github.com/siddharthksah/DeepSafe |
| DeepFake-o-Meter | Image + Video + Audio | 18 models | Free (register) | UB Media Forensics Lab |
| Resemble DETECT-2B | Audio | 94–98% | Free tier | resemble.ai/detect |

---

## Quick Start

### 1. Clone & install

```bash
git clone https://github.com/your-org/deepshield
cd deepshield
pip install -r requirements.txt
```

### 2. Configure API keys

```bash
cp .env.example .env
# Edit .env and add your keys (see instructions below)
```

### 3. Start the API

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Test it

```bash
# Check health
curl http://localhost:8000/health

# Scan an image
curl -X POST http://localhost:8000/api/v1/scan \
  -F "file=@suspect_image.jpg"

# Check detector status
curl http://localhost:8000/api/v1/detectors
```

### 5. Open interactive docs

```
http://localhost:8000/docs
```

---

## Getting Your Free API Keys

### HuggingFace (Image detection)
1. Go to https://huggingface.co/join — create a free account
2. Visit https://huggingface.co/settings/tokens
3. Create a new token (read access is enough)
4. Add to `.env`: `HUGGINGFACE_API_TOKEN=hf_xxxxx`

### DeepSafe (Video + Image ensemble)
```bash
git clone https://github.com/siddharthksah/DeepSafe
cd DeepSafe
docker-compose up --build
# Runs on http://localhost:8888
```
No account needed — completely local.

### DeepFake-o-Meter (Academic multi-model)
1. Visit https://zinc.cse.buffalo.edu/ubmdfl/deep-o-meter/landing_page
2. Register for a free account
3. Get your API key from account settings
4. Add to `.env`: `DEEPOMETER_API_KEY=your_key`

Or self-host:
```bash
git clone https://github.com/yuezunli/deepfake-o-meter
# Follow their Docker setup instructions
```

### Resemble AI DETECT-2B (Audio/Voice)
1. Sign up free at https://app.resemble.ai/register
2. Visit https://app.resemble.ai/account/api_key
3. Add to `.env`: `RESEMBLE_API_KEY=your_key`

---

## Example Response

```json
{
  "scan_id": "3f2a1b4c-...",
  "media_type": "image",
  "filename": "suspect.jpg",
  "file_size_bytes": 284532,
  "ensemble_fake_probability": 0.8914,
  "threat_level": "block",
  "confidence": 0.923,
  "detectors_run": 3,
  "detectors_succeeded": 3,
  "total_latency_ms": 1842,
  "timestamp": "2026-03-05T14:32:01Z",
  "notes": "HIGH CONFIDENCE DEEPFAKE (89% probability).",
  "detectors": [
    {
      "detector": "huggingface_siglip",
      "ran": true,
      "fake_probability": 0.94,
      "confidence": 0.94,
      "label": "FAKE",
      "latency_ms": 823
    },
    {
      "detector": "deepsafe_ensemble",
      "ran": true,
      "fake_probability": 0.88,
      "confidence": 0.88,
      "label": "FAKE",
      "latency_ms": 1204
    },
    {
      "detector": "deepometer_ub",
      "ran": true,
      "fake_probability": 0.87,
      "confidence": 0.87,
      "label": "FAKE",
      "latency_ms": 1641
    }
  ]
}
```

---

## Threat Levels

| Level | Fake Probability | Action |
|---|---|---|
| `pass` | < 0.55 | Media appears authentic |
| `flag` | 0.55 – 0.79 | Queue for human review |
| `block` | ≥ 0.80 | Auto-block, alert security team |

Thresholds are configurable via `THRESHOLD_BLOCK` and `THRESHOLD_FLAG` in `.env`.

---

## Running Tests

```bash
# Run all tests
pytest tests/ -v

# With coverage report
pytest tests/ -v --cov=app --cov-report=term-missing
```

---

## Project Structure

```
deepshield/
├── app/
│   ├── main.py                        # FastAPI app entry point
│   ├── api/
│   │   └── routes.py                  # /scan, /scan/batch, /detectors endpoints
│   ├── core/
│   │   ├── config.py                  # Settings from .env
│   │   ├── models.py                  # Pydantic schemas
│   │   ├── scanner.py                 # Orchestrates parallel detection
│   │   ├── ensemble.py                # Weighted scoring + threat level
│   │   └── logger.py                  # Structured logging
│   └── detectors/
│       ├── huggingface_detector.py    # HuggingFace SigLIP
│       ├── deepsafe_detector.py       # DeepSafe Docker API
│       ├── deepometer_detector.py     # DeepFake-o-Meter (UB)
│       └── resemble_detector.py       # Resemble AI audio
├── tests/
│   └── test_engine.py                 # Full test suite
├── requirements.txt
├── .env.example
└── README.md
```
