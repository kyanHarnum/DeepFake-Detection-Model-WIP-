"""
DeepShield Detection API
========================
Unified deepfake detection backend that orchestrates:
  - HuggingFace SigLIP  → image classification
  - DeepSafe Docker API → video ensemble
  - DeepFake-o-Meter   → multi-modal academic ensemble
  - Resemble AI        → audio/voice detection

Run:
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
"""

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

from app.core.config import settings
from app.core.logger import logger
from app.api.routes import router

app = FastAPI(
    title="DeepShield Detection API",
    description="Unified deepfake detection engine — image, video, and audio.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # Lock this down in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    return {"status": "online", "version": "1.0.0", "service": "DeepShield"}


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
