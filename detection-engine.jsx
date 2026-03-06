import { useState } from "react";

const STACK = [
  {
    tier: "T1",
    tierLabel: "Academic",
    name: "DeepFake-o-Meter",
    org: "University at Buffalo",
    modalities: ["Video", "Audio", "Image"],
    models: 18,
    accuracy: "Multi-model ensemble",
    license: "Open Source",
    cost: "Free",
    selfHost: true,
    apiReady: true,
    color: "#00c8ff",
    desc: "Gold standard academic platform backed by DARPA & NSF. 18 detectors. Used by journalists and law enforcement.",
    integration: `# Python integration example
import requests

def analyze_media(file_path, media_type="video"):
    url = "https://zinc.cse.buffalo.edu/ubmdfl/deep-o-meter/api/v2/analyze"
    with open(file_path, "rb") as f:
        response = requests.post(url, files={"file": f},
            data={"media_type": media_type, "detectors": "all"})
    return response.json()

result = analyze_media("suspect_video.mp4")
print(result["deepfake_probability"])`,
    link: "https://zinc.cse.buffalo.edu/ubmdfl/deep-o-meter/landing_page",
    github: "https://github.com/yuezunli/deepfake-o-meter"
  },
  {
    tier: "T1",
    tierLabel: "Academic",
    name: "FaceForensics++",
    org: "TU Munich / Google",
    modalities: ["Video", "Image"],
    models: 4,
    accuracy: "~99% on benchmark",
    license: "Research License",
    cost: "Free",
    selfHost: true,
    apiReady: false,
    color: "#00c8ff",
    desc: "1.8M+ manipulated images. The industry-standard training dataset. Run locally or use pretrained weights.",
    integration: `# Run FaceForensics++ detection locally
# 1. Clone the repo
git clone https://github.com/ondyari/FaceForensics

# 2. Install dependencies
pip install -r requirements.txt

# 3. Download pretrained model weights
python download_models.py --dataset all

# 4. Run inference
python detect_from_video.py \\
  -i suspect_video.mp4 \\
  -m model/xception/full/binary_detection`,
    link: "https://github.com/ondyari/FaceForensics",
    github: "https://github.com/ondyari/FaceForensics"
  },
  {
    tier: "T2",
    tierLabel: "OSS Engine",
    name: "DeepSafe",
    org: "Open Source Community",
    modalities: ["Video", "Image"],
    models: 3,
    accuracy: "Ensemble-boosted",
    license: "MIT",
    cost: "Free",
    selfHost: true,
    apiReady: true,
    color: "#a78bfa",
    desc: "Docker-based microservices. Each model isolated. NPR, UFD, and Cross Efficient ViT. Enterprise-grade architecture you can own.",
    integration: `# Deploy DeepSafe locally with Docker
git clone https://github.com/siddharthksah/DeepSafe
cd DeepSafe

# Build and start all containers
docker-compose up --build

# Call the API
curl -X POST http://localhost:8000/analyze \\
  -F "file=@suspect_image.jpg" \\
  -H "Authorization: Bearer YOUR_TOKEN"

# Response: { "fake_probability": 0.94, "model_votes": {...} }`,
    link: "https://github.com/siddharthksah/DeepSafe",
    github: "https://github.com/siddharthksah/DeepSafe"
  },
  {
    tier: "T2",
    tierLabel: "OSS Model",
    name: "deepfake-detector-model-v1",
    org: "Hugging Face / prithivMLmods",
    modalities: ["Image"],
    models: 1,
    accuracy: "94.4%",
    license: "Apache 2.0",
    cost: "Free",
    selfHost: true,
    apiReady: true,
    color: "#a78bfa",
    desc: "SigLIP-based vision model. Zero setup via Hugging Face Inference API. Ideal for real-time image classification.",
    integration: `# Option A: Hugging Face Inference API (zero setup)
import requests

API_URL = "https://api-inference.huggingface.co/models/prithivMLmods/deepfake-detector-model-v1"
headers = {"Authorization": "Bearer YOUR_HF_TOKEN"}  # Free tier

def detect_image(image_bytes):
    response = requests.post(API_URL, headers=headers, data=image_bytes)
    return response.json()

# Option B: Local inference
from transformers import AutoImageProcessor, SiglipForImageClassification
from PIL import Image
import torch

model = SiglipForImageClassification.from_pretrained("prithivMLmods/deepfake-detector-model-v1")
processor = AutoImageProcessor.from_pretrained("prithivMLmods/deepfake-detector-model-v1")

image = Image.open("suspect.jpg").convert("RGB")
inputs = processor(images=image, return_tensors="pt")
with torch.no_grad():
    logits = model(**inputs).logits
probs = torch.nn.functional.softmax(logits, dim=1).squeeze().tolist()
print({"fake": probs[0], "real": probs[1]})`,
    link: "https://huggingface.co/prithivMLmods/deepfake-detector-model-v1",
    github: "https://huggingface.co/prithivMLmods/deepfake-detector-model-v1"
  },
  {
    tier: "T2",
    tierLabel: "OSS Toolkit",
    name: "Deepstar",
    org: "ZeroFox",
    modalities: ["Video"],
    models: null,
    accuracy: "Toolkit (varies)",
    license: "Open Source",
    cost: "Free",
    selfHost: true,
    apiReady: false,
    color: "#a78bfa",
    desc: "Plugin-based detection toolkit with a curated video library for training. Best for building custom pipelines.",
    integration: `# Clone Deepstar toolkit
git clone https://github.com/zerofox-oss/deepstar

# Install
pip install -e .

# Run detection on a video
from deepstar.command_line_tool.command_line_tool import CommandLineTool

cmd = CommandLineTool()
cmd.run(['video-streams', 'insert', 'file://path/to/suspect_video.mp4'])
cmd.run(['video-frames', 'insert', '--video-stream-id', '1'])
cmd.run(['face-tracks', 'insert', '--video-frame-set-id', '1'])`,
    link: "https://github.com/zerofox-oss/deepstar",
    github: "https://github.com/zerofox-oss/deepstar"
  },
  {
    tier: "T3",
    tierLabel: "Audio",
    name: "DETECT-2B",
    org: "Resemble AI",
    modalities: ["Audio"],
    models: 1,
    accuracy: "94–98%",
    license: "Commercial (free tier)",
    cost: "Free tier",
    selfHost: false,
    apiReady: true,
    color: "#34d399",
    desc: "Mamba-SSM architecture. 30+ languages. Works on compressed/noisy audio. Best audio deepfake detector available.",
    integration: `# Resemble AI - Audio Deepfake Detection API
import requests

def detect_voice_deepfake(audio_file_path):
    url = "https://app.resemble.ai/api/v2/detect"
    headers = {"Authorization": "Token YOUR_RESEMBLE_API_KEY"}
    
    with open(audio_file_path, "rb") as f:
        response = requests.post(url,
            headers=headers,
            files={"audio": f},
            data={"model": "detect-2b"})
    
    result = response.json()
    return {
        "is_synthetic": result["prediction"] == "synthetic",
        "confidence": result["confidence"],
        "language": result["detected_language"]
    }

verdict = detect_voice_deepfake("suspicious_call.wav")
print(verdict)`,
    link: "https://www.resemble.ai/detect",
    github: None
  },
];

const ARCH_LAYERS = [
  { label: "INPUT LAYER", items: ["Live Video Feed", "Uploaded Image", "Audio Stream", "Recorded Call"], color: "#334155" },
  { label: "PRE-PROCESSING", items: ["Face Extraction (OpenCV)", "Frame Sampling", "Audio Segmentation", "Format Normalization"], color: "#1e3a5f" },
  { label: "DETECTION ENSEMBLE", items: ["DeepFake-o-Meter (18 models)", "HuggingFace SigLIP", "FaceForensics++ XceptionNet", "DETECT-2B Audio"], color: "#1a2a4a" },
  { label: "SCORING LAYER", items: ["Weighted Confidence Averaging", "Anomaly Threshold Check", "Cross-Modal Validation", "False Positive Filter"], color: "#1a3a2a" },
  { label: "ACTION LAYER", items: ["Block / Flag / Pass", "Alert Security Team", "Log to Database", "Quarantine Media"], color: "#2a1a1a" },
];

export default function DetectionEngine() {
  const [activeCard, setActiveCard] = useState(0);
  const [activeTab, setActiveTab] = useState("tools");
  const card = STACK[activeCard];

  const tierColors = { T1: "#00c8ff", T2: "#a78bfa", T3: "#34d399" };
  const modalityColors = { Video: "#3b82f6", Audio: "#10b981", Image: "#f59e0b" };

  return (
    <div style={{ minHeight: "100vh", background: "#050912", fontFamily: "'JetBrains Mono', 'Fira Code', monospace", color: "#c8d8f0", padding: 24 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&family=Syne:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #0a0f1e; }
        ::-webkit-scrollbar-thumb { background: #1e2d4a; border-radius: 2px; }
        pre { white-space: pre-wrap; word-break: break-word; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes glow { 0%,100%{box-shadow:0 0 8px #00c8ff22} 50%{box-shadow:0 0 20px #00c8ff44} }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 22 }}>⚙️</span>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, color: "#e8f0ff", letterSpacing: "-0.02em" }}>
            DETECTION ENGINE <span style={{ color: "#00c8ff" }}>STACK</span>
          </h1>
        </div>
        <p style={{ fontSize: 11, color: "#3a5070", letterSpacing: "0.1em" }}>FREE & OPEN SOURCE · PRODUCTION READY · SELF-HOSTABLE</p>
      </div>

      {/* Tab Nav */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #1a2a3a", marginBottom: 24 }}>
        {["tools", "architecture", "quickstart"].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            background: "none", border: "none", padding: "10px 20px",
            color: activeTab === tab ? "#00c8ff" : "#3a5070",
            borderBottom: activeTab === tab ? "2px solid #00c8ff" : "2px solid transparent",
            fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase",
            cursor: "pointer", fontFamily: "inherit", transition: "color 0.2s"
          }}>{tab}</button>
        ))}
      </div>

      {/* TOOLS TAB */}
      {activeTab === "tools" && (
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16, height: "calc(100vh - 160px)", minHeight: 500 }}>
          {/* Tool List */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", paddingRight: 8 }}>
            {STACK.map((tool, i) => (
              <div key={i} onClick={() => setActiveCard(i)} style={{
                padding: "14px 16px", borderRadius: 8, cursor: "pointer",
                border: `1px solid ${activeCard === i ? tierColors[tool.tier] + "66" : "#1a2a3a"}`,
                background: activeCard === i ? tierColors[tool.tier] + "0d" : "#0a0f1e",
                transition: "all 0.2s", animation: "fadeUp 0.3s ease both",
                animationDelay: `${i * 60}ms`
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: activeCard === i ? "#e8f0ff" : "#8aa0c0", marginBottom: 2 }}>{tool.name}</div>
                    <div style={{ fontSize: 10, color: "#3a5070" }}>{tool.org}</div>
                  </div>
                  <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, background: tierColors[tool.tier] + "22", color: tierColors[tool.tier], border: `1px solid ${tierColors[tool.tier]}44`, fontWeight: 600 }}>{tool.tierLabel}</span>
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {tool.modalities.map(m => (
                    <span key={m} style={{ fontSize: 9, padding: "1px 5px", borderRadius: 2, background: modalityColors[m] + "22", color: modalityColors[m], border: `1px solid ${modalityColors[m]}33` }}>{m}</span>
                  ))}
                  <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 2, background: "#34d39922", color: "#34d399", border: "1px solid #34d39933" }}>{tool.cost}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Detail Panel */}
          <div style={{ background: "#0a0f1e", border: `1px solid ${tierColors[card.tier]}33`, borderRadius: 10, padding: 24, overflowY: "auto", animation: "fadeUp 0.2s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, color: "#e8f0ff", marginBottom: 4 }}>{card.name}</h2>
                <div style={{ fontSize: 11, color: "#3a5070" }}>{card.org}</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {card.apiReady && <span style={{ fontSize: 9, padding: "3px 8px", borderRadius: 3, background: "#00c8ff22", color: "#00c8ff", border: "1px solid #00c8ff44" }}>API READY</span>}
                {card.selfHost && <span style={{ fontSize: 9, padding: "3px 8px", borderRadius: 3, background: "#a78bfa22", color: "#a78bfa", border: "1px solid #a78bfa44" }}>SELF-HOSTABLE</span>}
              </div>
            </div>

            <p style={{ fontSize: 12, color: "#8aa0c0", lineHeight: 1.7, marginBottom: 20, padding: "12px 14px", background: "#060912", borderRadius: 6, borderLeft: `3px solid ${tierColors[card.tier]}` }}>{card.desc}</p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 20 }}>
              {[
                ["Accuracy", card.accuracy],
                ["License", card.license],
                ["Models", card.models ? `${card.models} detectors` : "Toolkit"],
              ].map(([label, val]) => (
                <div key={label} style={{ background: "#060912", borderRadius: 6, padding: "10px 12px", border: "1px solid #1a2a3a" }}>
                  <div style={{ fontSize: 9, color: "#3a5070", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 12, color: "#8aa0c0" }}>{val}</div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: "#3a5070", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Integration Code</div>
              <div style={{ background: "#030710", borderRadius: 8, padding: 16, border: "1px solid #1a2a3a", overflowX: "auto" }}>
                <pre style={{ fontSize: 11, color: "#7090b0", lineHeight: 1.7 }}>{card.integration}</pre>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <a href={card.link} target="_blank" rel="noreferrer" style={{ padding: "8px 16px", background: tierColors[card.tier] + "22", color: tierColors[card.tier], border: `1px solid ${tierColors[card.tier]}44`, borderRadius: 5, fontSize: 11, textDecoration: "none", letterSpacing: "0.05em" }}>→ VISIT PROJECT</a>
              {card.github && <a href={card.github} target="_blank" rel="noreferrer" style={{ padding: "8px 16px", background: "#1a2a3a", color: "#8aa0c0", border: "1px solid #1a2a3a", borderRadius: 5, fontSize: 11, textDecoration: "none" }}>⬡ GITHUB</a>}
            </div>
          </div>
        </div>
      )}

      {/* ARCHITECTURE TAB */}
      {activeTab === "architecture" && (
        <div style={{ maxWidth: 700 }}>
          <p style={{ fontSize: 12, color: "#3a5070", marginBottom: 24 }}>End-to-end data flow from media ingestion to action. Each layer maps to specific open-source tools.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {ARCH_LAYERS.map((layer, i) => (
              <div key={i} style={{ animation: `fadeUp 0.4s ease both`, animationDelay: `${i * 100}ms` }}>
                <div style={{ background: layer.color, border: "1px solid #1a2a3a", borderRadius: i === 0 ? "8px 8px 0 0" : i === ARCH_LAYERS.length - 1 ? "0 0 8px 8px" : 0, padding: "14px 20px", borderBottom: i < ARCH_LAYERS.length - 1 ? "none" : undefined }}>
                  <div style={{ fontSize: 9, color: "#3a5070", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 10 }}>
                    <span style={{ color: "#00c8ff", marginRight: 6 }}>0{i + 1}</span>{layer.label}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {layer.items.map(item => (
                      <span key={item} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 4, background: "#0a0f1e88", border: "1px solid #1a2a3a", color: "#8aa0c0" }}>{item}</span>
                    ))}
                  </div>
                </div>
                {i < ARCH_LAYERS.length - 1 && (
                  <div style={{ display: "flex", justifyContent: "center", padding: "4px 0", color: "#1a3a5a", fontSize: 16 }}>↓</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QUICKSTART TAB */}
      {activeTab === "quickstart" && (
        <div style={{ maxWidth: 680 }}>
          <p style={{ fontSize: 12, color: "#3a5070", marginBottom: 24 }}>Recommended build order to get your detection engine live as fast as possible.</p>
          {[
            {
              step: "01", title: "Start with HuggingFace Image Detection",
              time: "~1 hour", tag: "Image",
              desc: "No infrastructure needed. Use the free Inference API for deepfake-detector-model-v1. Wire it to your dashboard's image upload endpoint. This gets you live image detection immediately.",
              cmd: `pip install transformers torch pillow\npython -c "from transformers import pipeline; d = pipeline('image-classification', model='prithivMLmods/deepfake-detector-model-v1'); print(d('test.jpg'))"`
            },
            {
              step: "02", title: "Deploy DeepSafe via Docker",
              time: "~2-4 hours", tag: "Video",
              desc: "Clone DeepSafe, run docker-compose up, and you have a full ensemble video detection API on localhost:8000. Point your dashboard's video scan endpoint here.",
              cmd: `git clone https://github.com/siddharthksah/DeepSafe\ncd DeepSafe && docker-compose up --build\n# Dashboard → http://localhost:8888`
            },
            {
              step: "03", title: "Add Audio via Resemble AI Free Tier",
              time: "~30 min", tag: "Audio",
              desc: "Sign up at resemble.ai, get a free API key, integrate DETECT-2B into your voice call monitoring pipeline. 94–98% accuracy, 30+ languages.",
              cmd: `pip install requests\n# Set env var: RESEMBLE_KEY=your_key\n# POST audio files to https://app.resemble.ai/api/v2/detect`
            },
            {
              step: "04", title: "Register with DeepFake-o-Meter for Ensemble",
              time: "~1 hour", tag: "All Modalities",
              desc: "Create a free account at the University of Buffalo platform. Use their API to cross-validate suspicious media through 18 research-grade models — your ultimate second-opinion engine.",
              cmd: `# API docs: zinc.cse.buffalo.edu/ubmdfl/deep-o-meter\n# Self-host: github.com/yuezunli/deepfake-o-meter\n# Free account → access to 18 detection models`
            },
          ].map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 16, marginBottom: 20, animation: `fadeUp 0.4s ease both`, animationDelay: `${i * 100}ms` }}>
              <div style={{ width: 40, flexShrink: 0, paddingTop: 2 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#0a1628", border: "1px solid #1a3a5a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#00c8ff", fontWeight: 700 }}>{s.step}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontFamily: "'Syne', sans-serif", fontWeight: 700, color: "#e8f0ff" }}>{s.title}</span>
                  <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, background: "#00c8ff22", color: "#00c8ff", border: "1px solid #00c8ff33" }}>{s.tag}</span>
                  <span style={{ fontSize: 9, color: "#3a5070", marginLeft: "auto" }}>{s.time}</span>
                </div>
                <p style={{ fontSize: 12, color: "#6a8090", lineHeight: 1.7, marginBottom: 10 }}>{s.desc}</p>
                <div style={{ background: "#030710", borderRadius: 6, padding: "10px 14px", border: "1px solid #1a2a3a" }}>
                  <pre style={{ fontSize: 11, color: "#5a7890", lineHeight: 1.7 }}>{s.cmd}</pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
