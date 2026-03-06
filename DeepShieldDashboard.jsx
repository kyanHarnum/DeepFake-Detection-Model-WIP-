import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG — point this at your running backend
// ─────────────────────────────────────────────────────────────────────────────
const API_BASE = "http://localhost:8000/api/v1";

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE HELPERS (persists logs across sessions via window.storage)
// ─────────────────────────────────────────────────────────────────────────────
const STORAGE_KEY = "deepshield-scan-logs";

async function loadLogs() {
  try {
    const res = await window.storage.get(STORAGE_KEY);
    return res ? JSON.parse(res.value) : [];
  } catch { return []; }
}

async function saveLogs(logs) {
  try {
    await window.storage.set(STORAGE_KEY, JSON.stringify(logs.slice(0, 200)));
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// API CALLS
// ─────────────────────────────────────────────────────────────────────────────
async function callScanAPI(file, onProgress) {
  const formData = new FormData();
  formData.append("file", file);
  onProgress?.("uploading");
  const res = await fetch(`${API_BASE}/scan`, { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  onProgress?.("processing");
  return res.json();
}

async function fetchDetectorStatus() {
  const res = await fetch(`${API_BASE}/detectors`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function checkHealth() {
  const res = await fetch(`${API_BASE.replace("/api/v1", "")}/health`);
  return res.ok;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const THREAT_META = {
  block:   { color: "#ff2b4e", bg: "#ff2b4e18", label: "BLOCKED",  icon: "⛔" },
  flag:    { color: "#ff9500", bg: "#ff950018", label: "FLAGGED",  icon: "⚠️" },
  pass:    { color: "#00e87a", bg: "#00e87a18", label: "PASSED",   icon: "✓"  },
};

const DETECTOR_LABELS = {
  huggingface_siglip:       "HuggingFace SigLIP",
  huggingface_siglip_local: "HuggingFace SigLIP (local)",
  deepsafe_ensemble:        "DeepSafe Ensemble",
  deepometer_ub:            "DeepFake-o-Meter (UB)",
  resemble_detect2b:        "Resemble DETECT-2B",
};

const MEDIA_ICONS = { image: "🖼", video: "🎬", audio: "🎙" };

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────────────────────────────────────────
function fmt(p) { return `${Math.round(p * 100)}%`; }
function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString("en-CA", { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit", second:"2-digit" });
}
function shortId(id) { return id?.slice(0, 8).toUpperCase() ?? "—"; }

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function Pill({ children, color, bg }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 9px", borderRadius: 3,
      fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
      color, background: bg, border: `1px solid ${color}44`,
    }}>{children}</span>
  );
}

function MeterBar({ value, color, height = 6 }) {
  return (
    <div style={{ width: "100%", height, background: "#161d2e", borderRadius: height / 2, overflow: "hidden" }}>
      <div style={{
        width: `${Math.round(value * 100)}%`, height: "100%",
        background: color, borderRadius: height / 2,
        transition: "width 0.6s cubic-bezier(.4,0,.2,1)",
        boxShadow: `0 0 8px ${color}88`,
      }} />
    </div>
  );
}

function CircleGauge({ value, size = 100, color }) {
  const r = (size / 2) - 10;
  const circ = 2 * Math.PI * r;
  const dash = circ - value * circ;
  return (
    <svg width={size} height={size} style={{ display: "block" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#161d2e" strokeWidth={8} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={circ} strokeDashoffset={dash} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(.4,0,.2,1)", filter: `drop-shadow(0 0 6px ${color})` }}
      />
      <text x={size/2} y={size/2 + 6} textAnchor="middle"
        fill={color} fontSize={size * 0.22} fontWeight="700" fontFamily="'Space Mono', monospace">
        {fmt(value)}
      </text>
    </svg>
  );
}

function StatusDot({ online }) {
  return (
    <span style={{ position: "relative", display: "inline-block", width: 8, height: 8, flexShrink: 0 }}>
      <span style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        background: online ? "#00e87a" : "#ff2b4e",
      }} />
      {online && <span style={{
        position: "absolute", inset: -3, borderRadius: "50%",
        border: "1.5px solid #00e87a66",
        animation: "rippleAnim 2s ease-out infinite",
      }} />}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCAN DETAIL MODAL
// ─────────────────────────────────────────────────────────────────────────────
function ScanDetailModal({ scan, onClose }) {
  if (!scan) return null;
  const tm = THREAT_META[scan.threat_level] || THREAT_META.pass;
  const succeeded = scan.detectors?.filter(d => d.ran) ?? [];
  const failed    = scan.detectors?.filter(d => !d.ran && d.enabled) ?? [];

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#000000cc", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
      padding: 24,
    }} onClick={onClose}>
      <div style={{
        background: "#0b1120", border: "1px solid #1e2d45", borderRadius: 12,
        width: "100%", maxWidth: 680, maxHeight: "90vh", overflowY: "auto",
        boxShadow: `0 0 60px ${tm.color}22`,
        animation: "slideUp 0.25s cubic-bezier(.4,0,.2,1)",
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #1e2d45", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 20 }}>{MEDIA_ICONS[scan.media_type]}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#e8f2ff", fontFamily: "'Syne', sans-serif" }}>{scan.filename}</span>
              <Pill color={tm.color} bg={tm.bg}>{tm.icon} {tm.label}</Pill>
            </div>
            <div style={{ fontSize: 11, color: "#3a5070", letterSpacing: "0.05em" }}>
              SCAN ID: {scan.scan_id} · {fmtDate(scan.timestamp)} · {scan.total_latency_ms}ms · {(scan.file_size_bytes / 1024).toFixed(1)}KB
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#3a5070", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        {/* Ensemble score */}
        <div style={{ padding: "24px", borderBottom: "1px solid #1e2d45", display: "flex", alignItems: "center", gap: 32 }}>
          <CircleGauge value={scan.ensemble_fake_probability} size={110} color={tm.color} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: "#3a5070", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Ensemble Fake Probability</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: tm.color, fontFamily: "'Syne', sans-serif", lineHeight: 1, marginBottom: 8 }}>
              {fmt(scan.ensemble_fake_probability)}
            </div>
            <div style={{ fontSize: 12, color: "#8aa0c0", lineHeight: 1.6 }}>{scan.notes}</div>
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Pill color="#3a8fff" bg="#3a8fff18">Confidence: {fmt(scan.confidence)}</Pill>
              <Pill color="#8a9ab0" bg="#8a9ab018">{succeeded.length}/{scan.detectors_run} detectors ran</Pill>
            </div>
          </div>
        </div>

        {/* Per-detector breakdown */}
        <div style={{ padding: "20px 24px" }}>
          <div style={{ fontSize: 11, color: "#3a5070", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>Detector Breakdown</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {scan.detectors?.map((d, i) => {
              const label = DETECTOR_LABELS[d.detector] || d.detector;
              const prob = d.fake_probability ?? 0;
              const barColor = d.ran ? (prob >= 0.8 ? "#ff2b4e" : prob >= 0.55 ? "#ff9500" : "#00e87a") : "#2a3a4a";
              return (
                <div key={i} style={{ background: "#080e1c", borderRadius: 8, padding: "12px 14px", border: "1px solid #1e2d45" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <StatusDot online={d.ran} />
                      <span style={{ fontSize: 12, color: d.ran ? "#c8d8f0" : "#3a5070", fontWeight: 500 }}>{label}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {d.ran
                        ? <span style={{ fontSize: 13, fontWeight: 700, color: barColor, fontFamily: "'Space Mono', monospace" }}>{fmt(prob)}</span>
                        : <span style={{ fontSize: 10, color: "#3a5070" }}>OFFLINE</span>
                      }
                      {d.latency_ms && <span style={{ fontSize: 10, color: "#2a4060" }}>{d.latency_ms}ms</span>}
                    </div>
                  </div>
                  {d.ran
                    ? <MeterBar value={prob} color={barColor} height={5} />
                    : <div style={{ fontSize: 10, color: "#ff9500", marginTop: 2 }}>⚠ {d.error?.slice(0, 120)}</div>
                  }
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UPLOAD ZONE
// ─────────────────────────────────────────────────────────────────────────────
function UploadZone({ onScanComplete, apiOnline }) {
  const [dragging, setDragging] = useState(false);
  const [scanState, setScanState] = useState("idle"); // idle | uploading | processing | done | error
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef();

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    if (!apiOnline) { setError("Backend offline. Start with: uvicorn app.main:app --port 8000"); return; }
    setScanState("uploading");
    setError("");
    try {
      const result = await callScanAPI(file, setProgress);
      setScanState("done");
      onScanComplete(result);
      setTimeout(() => setScanState("idle"), 2000);
    } catch (e) {
      setError(e.message);
      setScanState("error");
      setTimeout(() => setScanState("idle"), 4000);
    }
  }, [apiOnline, onScanComplete]);

  const onDrop = (e) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const stateContent = {
    idle: { icon: "⬆", text: "Drop image, video, or audio to scan", sub: "JPG · PNG · MP4 · MOV · WAV · MP3 · up to 100MB" },
    uploading: { icon: "⟳", text: "Uploading to detection engine...", sub: "Sending to backend API" },
    processing: { icon: "⬡", text: "Running detectors in parallel...", sub: "HuggingFace · DeepSafe · DeepFake-o-Meter · Resemble AI" },
    done: { icon: "✓", text: "Scan complete", sub: "Result logged below" },
    error: { icon: "✕", text: "Scan failed", sub: error },
  };
  const s = stateContent[scanState];
  const isScanning = scanState === "uploading" || scanState === "processing";
  const borderColor = scanState === "error" ? "#ff2b4e" : scanState === "done" ? "#00e87a" : dragging ? "#3a8fff" : "#1e2d45";

  return (
    <div
      style={{
        border: `2px dashed ${borderColor}`,
        borderRadius: 10, padding: "28px 20px",
        textAlign: "center", cursor: isScanning ? "default" : "pointer",
        background: dragging ? "#3a8fff08" : "#080e1c",
        transition: "all 0.2s",
      }}
      onClick={() => !isScanning && fileRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <input ref={fileRef} type="file" style={{ display: "none" }}
        accept="image/*,video/*,audio/*,.mp4,.mov,.avi,.mkv,.wav,.mp3,.m4a,.flac"
        onChange={e => handleFile(e.target.files[0])} />
      <div style={{
        fontSize: 28, marginBottom: 10,
        animation: isScanning ? "spinAnim 1.2s linear infinite" : "none",
        display: "inline-block",
      }}>{s.icon}</div>
      <div style={{ fontSize: 13, color: scanState === "error" ? "#ff2b4e" : scanState === "done" ? "#00e87a" : "#c8d8f0", fontWeight: 600, marginBottom: 4 }}>{s.text}</div>
      <div style={{ fontSize: 11, color: "#3a5070" }}>{s.sub}</div>
      {!apiOnline && (
        <div style={{ marginTop: 10, fontSize: 10, color: "#ff9500", padding: "6px 12px", background: "#ff950012", borderRadius: 4, border: "1px solid #ff950033", display: "inline-block" }}>
          ⚠ Backend offline — uvicorn app.main:app --host 0.0.0.0 --port 8000
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOG ROW
// ─────────────────────────────────────────────────────────────────────────────
function LogRow({ scan, index, onClick }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), index * 40); return () => clearTimeout(t); }, []);
  const tm = THREAT_META[scan.threat_level] || THREAT_META.pass;
  const prob = scan.ensemble_fake_probability;

  return (
    <tr onClick={onClick} style={{
      cursor: "pointer",
      opacity: visible ? 1 : 0,
      transform: visible ? "none" : "translateY(-4px)",
      transition: "opacity 0.25s ease, transform 0.25s ease, background 0.15s",
      background: "transparent",
    }}
    onMouseEnter={e => e.currentTarget.style.background = "#0f1928"}
    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      <td style={{ padding: "10px 14px", fontSize: 11, color: "#3a5070", fontFamily: "'Space Mono', monospace", whiteSpace: "nowrap" }}>{shortId(scan.scan_id)}</td>
      <td style={{ padding: "10px 14px" }}>
        <span style={{ fontSize: 12 }}>{MEDIA_ICONS[scan.media_type]}</span>{" "}
        <span style={{ fontSize: 11, color: "#8aa0c0" }}>{scan.filename?.slice(0, 28)}{scan.filename?.length > 28 ? "…" : ""}</span>
      </td>
      <td style={{ padding: "10px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <MeterBar value={prob} color={tm.color} height={4} />
          <span style={{ fontSize: 12, fontWeight: 700, color: tm.color, minWidth: 38, textAlign: "right", fontFamily: "'Space Mono', monospace" }}>{fmt(prob)}</span>
        </div>
      </td>
      <td style={{ padding: "10px 14px" }}>
        <Pill color={tm.color} bg={tm.bg}>{tm.icon} {tm.label}</Pill>
      </td>
      <td style={{ padding: "10px 14px", fontSize: 11, color: "#2a4060", fontFamily: "'Space Mono', monospace", whiteSpace: "nowrap" }}>
        {scan.detectors_succeeded ?? 0}/{scan.detectors_run ?? 0} detectors
      </td>
      <td style={{ padding: "10px 14px", fontSize: 11, color: "#2a4060", whiteSpace: "nowrap" }}>
        {fmtDate(scan.timestamp)}
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STATS CARD
// ─────────────────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = "#3a8fff", accent }) {
  return (
    <div style={{ background: "#0b1120", border: `1px solid ${color}22`, borderRadius: 10, padding: "18px 20px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: color, opacity: 0.6 }} />
      <div style={{ fontSize: 10, color: "#3a5070", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color, fontFamily: "'Syne', sans-serif", lineHeight: 1, marginBottom: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#2a4060" }}>{sub}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DETECTOR STATUS PANEL
// ─────────────────────────────────────────────────────────────────────────────
function DetectorPanel({ detectors, loading }) {
  if (loading) return <div style={{ color: "#2a4060", fontSize: 12, padding: 12 }}>Loading detector status…</div>;
  if (!detectors) return (
    <div style={{ color: "#ff9500", fontSize: 11, padding: 12, background: "#ff950010", borderRadius: 6, border: "1px solid #ff950033" }}>
      Backend offline — detectors unreachable. Start your FastAPI server.
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {detectors.map((d, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#080e1c", borderRadius: 7, border: "1px solid #1e2d45" }}>
          <StatusDot online={d.status === "ready"} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: d.status === "ready" ? "#c8d8f0" : "#3a5070", fontWeight: 500, marginBottom: 2 }}>{d.name}</div>
            <div style={{ fontSize: 10, color: "#2a4060" }}>{d.modalities?.join(" · ")}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
              color: d.status === "ready" ? "#00e87a" : d.status === "needs_key" ? "#ff9500" : "#ff2b4e",
              padding: "2px 7px", borderRadius: 3, border: `1px solid currentColor`, opacity: 0.9
            }}>{d.status?.toUpperCase().replace("_", " ")}</div>
            <div style={{ fontSize: 9, color: "#2a4060", marginTop: 3 }}>w={d.weight}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
export default function DeepShieldDashboard() {
  const [logs, setLogs] = useState([]);
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [selectedScan, setSelectedScan] = useState(null);
  const [detectors, setDetectors] = useState(null);
  const [detectorsLoading, setDetectorsLoading] = useState(true);
  const [apiOnline, setApiOnline] = useState(false);
  const [activeTab, setActiveTab] = useState("scan");
  const [filterLevel, setFilterLevel] = useState("all");
  const [logSearch, setLogSearch] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);
  const pollingRef = useRef();

  // Load persisted logs on mount
  useEffect(() => {
    loadLogs().then(stored => {
      setLogs(stored);
      setLogsLoaded(true);
    });
  }, []);

  // Save logs whenever they change
  useEffect(() => {
    if (logsLoaded) saveLogs(logs);
  }, [logs, logsLoaded]);

  // Poll backend health + detector status
  const pollBackend = useCallback(async () => {
    try {
      const alive = await checkHealth();
      setApiOnline(alive);
      setLastChecked(new Date());
      if (alive) {
        try {
          const data = await fetchDetectorStatus();
          setDetectors(data.detectors ?? []);
        } catch {}
      } else {
        setDetectors(null);
      }
    } catch {
      setApiOnline(false);
      setDetectors(null);
      setLastChecked(new Date());
    }
    setDetectorsLoading(false);
  }, []);

  useEffect(() => {
    pollBackend();
    pollingRef.current = setInterval(pollBackend, 8000);
    return () => clearInterval(pollingRef.current);
  }, [pollBackend]);

  const handleScanComplete = useCallback((result) => {
    const enriched = { ...result, _scannedAt: new Date().toISOString() };
    setLogs(prev => [enriched, ...prev]);
    setSelectedScan(enriched);
    setActiveTab("logs");
  }, []);

  // Stats
  const total = logs.length;
  const blocked = logs.filter(l => l.threat_level === "block").length;
  const flagged = logs.filter(l => l.threat_level === "flag").length;
  const passed  = logs.filter(l => l.threat_level === "pass").length;
  const avgProb = total > 0 ? logs.reduce((a, l) => a + l.ensemble_fake_probability, 0) / total : 0;

  // Filtered logs
  const filteredLogs = logs.filter(l => {
    const matchLevel = filterLevel === "all" || l.threat_level === filterLevel;
    const q = logSearch.toLowerCase();
    const matchSearch = !q || l.filename?.toLowerCase().includes(q) || l.scan_id?.includes(q) || l.media_type?.includes(q);
    return matchLevel && matchSearch;
  });

  const TABS = [
    { id: "scan",      label: "SCAN" },
    { id: "logs",      label: `LOGS ${total > 0 ? `(${total})` : ""}` },
    { id: "detectors", label: "DETECTORS" },
    { id: "setup",     label: "SETUP" },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#060c18",
      fontFamily: "'Space Mono', 'Courier New', monospace",
      color: "#c8d8f0",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #060c18; }
        ::-webkit-scrollbar-thumb { background: #1e2d45; border-radius: 2px; }
        table { border-collapse: collapse; width: 100%; }
        th { text-align: left; }
        @keyframes spinAnim { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
        @keyframes rippleAnim { 0%{transform:scale(1);opacity:.7} 100%{transform:scale(2.2);opacity:0} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
        .tab-btn:hover { color: #c8d8f0 !important; }
        .clear-btn:hover { background: #ff2b4e22 !important; color: #ff2b4e !important; }
      `}</style>

      {/* ── Top Bar ────────────────────────────────────────────────────────── */}
      <div style={{ borderBottom: "1px solid #1e2d45", padding: "0 28px", display: "flex", alignItems: "stretch", justifyContent: "space-between", height: 56 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 30, height: 30, background: "linear-gradient(135deg, #00e87a, #3a8fff)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🛡</div>
          <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 17, color: "#e8f2ff", letterSpacing: "-0.02em" }}>
            DEEP<span style={{ color: "#00e87a" }}>SHIELD</span>
          </span>
          <span style={{ fontSize: 9, color: "#2a4060", border: "1px solid #1e2d45", padding: "2px 6px", borderRadius: 3 }}>v1.0</span>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", alignItems: "stretch", gap: 2 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className="tab-btn" style={{
              background: "none", border: "none",
              borderBottom: activeTab === t.id ? "2px solid #3a8fff" : "2px solid transparent",
              color: activeTab === t.id ? "#3a8fff" : "#2a4060",
              fontSize: 10, letterSpacing: "0.1em", padding: "0 16px",
              cursor: "pointer", fontFamily: "inherit", transition: "color 0.15s",
            }}>{t.label}</button>
          ))}
        </div>

        {/* Status */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <StatusDot online={apiOnline} />
          <span style={{ fontSize: 10, color: apiOnline ? "#00e87a" : "#ff2b4e" }}>
            {apiOnline ? "API ONLINE" : "API OFFLINE"}
          </span>
          {lastChecked && <span style={{ fontSize: 9, color: "#1e2d45" }}>{lastChecked.toLocaleTimeString()}</span>}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div style={{ padding: 24 }}>

        {/* ── SCAN TAB ─────────────────────────────────────────────────────── */}
        {activeTab === "scan" && (
          <div style={{ maxWidth: 860, margin: "0 auto", animation: "fadeIn 0.3s ease" }}>
            {/* Stats row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
              <StatCard label="Total Scans" value={total} sub="all time" color="#3a8fff" />
              <StatCard label="Blocked" value={blocked} sub="high confidence fake" color="#ff2b4e" />
              <StatCard label="Flagged" value={flagged} sub="needs review" color="#ff9500" />
              <StatCard label="Avg Fake Prob" value={total > 0 ? fmt(avgProb) : "—"} sub={`${passed} passed`} color="#00e87a" />
            </div>

            {/* Upload */}
            <div style={{ background: "#0b1120", border: "1px solid #1e2d45", borderRadius: 12, padding: 24, marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: "#3a5070", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
                🔍 New Scan
              </div>
              <UploadZone onScanComplete={handleScanComplete} apiOnline={apiOnline} />
            </div>

            {/* Recent scans mini-list */}
            {logs.length > 0 && (
              <div style={{ background: "#0b1120", border: "1px solid #1e2d45", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ padding: "14px 20px", borderBottom: "1px solid #1e2d45", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "#3a5070", letterSpacing: "0.1em", textTransform: "uppercase" }}>Recent Scans</span>
                  <button onClick={() => setActiveTab("logs")} style={{ background: "none", border: "none", fontSize: 10, color: "#3a8fff", cursor: "pointer", fontFamily: "inherit" }}>View all →</button>
                </div>
                <table>
                  <tbody>
                    {logs.slice(0, 5).map((s, i) => (
                      <LogRow key={s.scan_id} scan={s} index={i} onClick={() => setSelectedScan(s)} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── LOGS TAB ─────────────────────────────────────────────────────── */}
        {activeTab === "logs" && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            {/* Toolbar */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
              <input
                value={logSearch}
                onChange={e => setLogSearch(e.target.value)}
                placeholder="Search filename, scan ID…"
                style={{
                  background: "#0b1120", border: "1px solid #1e2d45", borderRadius: 6,
                  padding: "8px 12px", color: "#c8d8f0", fontSize: 11, fontFamily: "inherit",
                  width: 240, outline: "none",
                }}
              />
              {["all", "block", "flag", "pass"].map(lvl => {
                const active = filterLevel === lvl;
                const meta = THREAT_META[lvl] || { color: "#3a8fff", bg: "#3a8fff18" };
                return (
                  <button key={lvl} onClick={() => setFilterLevel(lvl)} style={{
                    padding: "6px 12px", borderRadius: 5, fontSize: 10,
                    fontFamily: "inherit", cursor: "pointer", letterSpacing: "0.06em",
                    fontWeight: active ? 700 : 400,
                    background: active ? meta.bg : "transparent",
                    color: active ? meta.color : "#3a5070",
                    border: `1px solid ${active ? meta.color + "44" : "#1e2d45"}`,
                    transition: "all 0.15s",
                  }}>{lvl.toUpperCase()}{lvl !== "all" ? ` (${logs.filter(l => l.threat_level === lvl).length})` : ""}</button>
                );
              })}
              <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "#2a4060" }}>{filteredLogs.length} results</span>
                {logs.length > 0 && (
                  showClearConfirm
                    ? <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => { setLogs([]); setShowClearConfirm(false); }} style={{ padding: "5px 10px", background: "#ff2b4e", color: "#fff", border: "none", borderRadius: 4, fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>Confirm clear</button>
                        <button onClick={() => setShowClearConfirm(false)} style={{ padding: "5px 10px", background: "#1e2d45", color: "#8aa0c0", border: "none", borderRadius: 4, fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                      </div>
                    : <button onClick={() => setShowClearConfirm(true)} className="clear-btn" style={{
                        padding: "5px 12px", background: "#0b1120", color: "#3a5070",
                        border: "1px solid #1e2d45", borderRadius: 4, fontSize: 10, cursor: "pointer",
                        fontFamily: "inherit", transition: "all 0.15s",
                      }}>Clear logs</button>
                )}
              </div>
            </div>

            {/* Table */}
            {filteredLogs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "#2a4060", fontSize: 13 }}>
                {logs.length === 0 ? "No scans yet — drop a file in the Scan tab to get started." : "No results match your filter."}
              </div>
            ) : (
              <div style={{ background: "#0b1120", border: "1px solid #1e2d45", borderRadius: 12, overflow: "hidden" }}>
                <table>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #1e2d45" }}>
                      {["ID", "File", "Fake Prob", "Verdict", "Detectors", "Timestamp"].map(h => (
                        <th key={h} style={{ padding: "10px 14px", fontSize: 9, color: "#2a4060", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((s, i) => (
                      <LogRow key={s.scan_id} scan={s} index={i} onClick={() => setSelectedScan(s)} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── DETECTORS TAB ────────────────────────────────────────────────── */}
        {activeTab === "detectors" && (
          <div style={{ maxWidth: 700, animation: "fadeIn 0.3s ease" }}>
            <div style={{ background: "#0b1120", border: "1px solid #1e2d45", borderRadius: 12, padding: 24, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "#3a5070", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>Live Detector Status</div>
              <DetectorPanel detectors={detectors} loading={detectorsLoading} />
            </div>
            {detectors && (
              <div style={{ background: "#0b1120", border: "1px solid #1e2d45", borderRadius: 12, padding: 24 }}>
                <div style={{ fontSize: 11, color: "#3a5070", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>Scoring Weights</div>
                {detectors.map((d, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <span style={{ fontSize: 11, color: "#8aa0c0", width: 220, flexShrink: 0 }}>{d.name}</span>
                    <MeterBar value={d.weight ?? 0} color={d.status === "ready" ? "#3a8fff" : "#2a3a4a"} height={6} />
                    <span style={{ fontSize: 11, color: "#3a5070", width: 36, textAlign: "right" }}>{Math.round((d.weight ?? 0) * 100)}%</span>
                  </div>
                ))}
                <div style={{ marginTop: 16, padding: "10px 14px", background: "#080e1c", borderRadius: 6, fontSize: 11, color: "#2a4060", border: "1px solid #1e2d45" }}>
                  Weights auto-normalize when detectors are offline. Detectors with <span style={{ color: "#ff9500" }}>needs_key</span> status require API keys in your <code style={{ color: "#3a8fff" }}>.env</code> file.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SETUP TAB ────────────────────────────────────────────────────── */}
        {activeTab === "setup" && (
          <div style={{ maxWidth: 720, animation: "fadeIn 0.3s ease" }}>
            {[
              {
                step: "01", title: "Install & run the backend", color: "#3a8fff",
                content: `pip install -r requirements.txt
cp .env.example .env
# Edit .env — add API keys (see steps below)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`
              },
              {
                step: "02", title: "HuggingFace API token (free)", color: "#a78bfa",
                content: `# 1. Create free account at https://huggingface.co/join
# 2. Go to https://huggingface.co/settings/tokens
# 3. Create a token (read access is fine)
# 4. Add to .env:
HUGGINGFACE_API_TOKEN=hf_xxxxxxxxxxxxxxxxxxxx`
              },
              {
                step: "03", title: "DeepSafe Docker (video + image ensemble)", color: "#00e87a",
                content: `git clone https://github.com/siddharthksah/DeepSafe
cd DeepSafe && docker-compose up --build
# Runs at http://localhost:8888 — no config needed`
              },
              {
                step: "04", title: "DeepFake-o-Meter API key (free)", color: "#ff9500",
                content: `# Register at:
# https://zinc.cse.buffalo.edu/ubmdfl/deep-o-meter/landing_page
# Add to .env:
DEEPOMETER_API_KEY=your_key_here`
              },
              {
                step: "05", title: "Resemble AI audio detection (free tier)", color: "#ff6b9d",
                content: `# Sign up at https://app.resemble.ai/register
# Get API key at https://app.resemble.ai/account/api_key
# Add to .env:
RESEMBLE_API_KEY=your_resemble_key_here`
              },
              {
                step: "06", title: "Connect this dashboard", color: "#c8d8f0",
                content: `# This dashboard calls:
#   http://localhost:8000/api/v1/scan         ← single file scan
#   http://localhost:8000/api/v1/detectors    ← health check
#   http://localhost:8000/health              ← API ping
#
# To change the API URL, edit API_BASE at the top of this file.
# For production, deploy backend behind nginx + HTTPS.`
              },
            ].map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 16, marginBottom: 20 }}>
                <div style={{ flexShrink: 0, paddingTop: 2 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", border: `2px solid ${s.color}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: s.color, fontWeight: 700 }}>{s.step}</div>
                </div>
                <div style={{ flex: 1, background: "#0b1120", borderRadius: 10, border: `1px solid ${s.color}22`, overflow: "hidden" }}>
                  <div style={{ padding: "12px 16px", borderBottom: `1px solid ${s.color}18`, fontSize: 13, color: "#e8f2ff", fontFamily: "'Syne', sans-serif", fontWeight: 700 }}>{s.title}</div>
                  <div style={{ padding: "12px 16px", background: "#060c18" }}>
                    <pre style={{ fontSize: 11, color: "#6a8090", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{s.content}</pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Scan Detail Modal ───────────────────────────────────────────────── */}
      {selectedScan && <ScanDetailModal scan={selectedScan} onClose={() => setSelectedScan(null)} />}
    </div>
  );
}
