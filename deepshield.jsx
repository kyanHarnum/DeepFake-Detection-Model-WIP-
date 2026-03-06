import { useState, useEffect, useRef } from "react";

const THREAT_DATA = [
  { id: 1, time: "14:32:01", type: "Video Call", threat: "Face Swap Detected", confidence: 94, status: "blocked", user: "CFO Meeting Room", severity: "critical" },
  { id: 2, time: "14:28:44", type: "Audio", threat: "Synthetic Voice", confidence: 87, status: "flagged", user: "HR Line ext.204", severity: "high" },
  { id: 3, time: "14:15:09", type: "Video Call", threat: "Liveness Fail", confidence: 76, status: "flagged", user: "Remote Onboarding", severity: "high" },
  { id: 4, time: "13:58:22", type: "Image", threat: "GAN Artifact", confidence: 91, status: "blocked", user: "ID Verification", severity: "critical" },
  { id: 5, time: "13:44:17", type: "Audio", threat: "Clone Voice", confidence: 83, status: "flagged", user: "Executive Voicemail", severity: "high" },
  { id: 6, time: "13:31:05", type: "Video Call", threat: "Lip Sync Mismatch", confidence: 68, status: "reviewing", user: "Sales Call #1194", severity: "medium" },
];

const METRICS = [
  { label: "Scans Today", value: "12,847", delta: "+8.2%", up: true },
  { label: "Threats Blocked", value: "23", delta: "+3 this hour", up: false },
  { label: "Avg Confidence", value: "91.4%", delta: "+1.1%", up: true },
  { label: "False Positive Rate", value: "0.3%", delta: "-0.1%", up: true },
];

const DETECTION_MODULES = [
  { name: "Facial Inconsistency", icon: "👁", active: true, coverage: 98 },
  { name: "Voice Biometrics", icon: "🎙", active: true, coverage: 94 },
  { name: "Liveness Detection", icon: "⚡", active: true, coverage: 97 },
  { name: "GAN Fingerprinting", icon: "🔬", active: true, coverage: 91 },
  { name: "Metadata Forensics", icon: "🧬", active: true, coverage: 89 },
  { name: "Behavioral Biometrics", icon: "🧠", active: false, coverage: 0 },
];

const BAR_DATA = [62, 45, 78, 34, 91, 56, 23, 87, 44, 67, 38, 95];
const BAR_LABELS = ["2am","3am","4am","5am","6am","7am","8am","9am","10am","11am","12pm","1pm"];

function PulseRing({ active }) {
  return (
    <span style={{ position: "relative", display: "inline-block", width: 10, height: 10 }}>
      <span style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        background: active ? "#00ff88" : "#ff4455",
        animation: active ? "pulse 2s infinite" : "none"
      }} />
      {active && <span style={{
        position: "absolute", inset: -4, borderRadius: "50%",
        border: "2px solid #00ff8844",
        animation: "ripple 2s infinite"
      }} />}
    </span>
  );
}

function ThreatRow({ item, index }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), index * 80); }, []);
  const colors = { critical: "#ff2244", high: "#ff8800", medium: "#ffcc00", low: "#00ff88" };
  const statusColors = { blocked: "#ff2244", flagged: "#ff8800", reviewing: "#4488ff" };
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "80px 90px 1fr 120px 90px 90px",
      padding: "10px 16px", borderBottom: "1px solid #1a1f2e",
      opacity: visible ? 1 : 0, transform: visible ? "none" : "translateX(-10px)",
      transition: "all 0.3s ease", fontSize: 12, alignItems: "center",
      background: index % 2 === 0 ? "transparent" : "#0a0d1a44",
    }}>
      <span style={{ color: "#556" }}>{item.time}</span>
      <span style={{ color: "#8899bb" }}>{item.type}</span>
      <span style={{ color: "#dde", fontWeight: 500 }}>{item.threat}</span>
      <span style={{ color: "#8899bb" }}>{item.user}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ flex: 1, height: 4, background: "#1a1f2e", borderRadius: 2 }}>
          <div style={{ width: `${item.confidence}%`, height: "100%", borderRadius: 2, background: colors[item.severity] }} />
        </div>
        <span style={{ color: colors[item.severity], minWidth: 30, textAlign: "right" }}>{item.confidence}%</span>
      </div>
      <span style={{
        padding: "2px 8px", borderRadius: 3, fontSize: 11, fontWeight: 600, textTransform: "uppercase",
        letterSpacing: "0.05em", background: statusColors[item.status] + "22", color: statusColors[item.status],
        border: `1px solid ${statusColors[item.status]}44`, textAlign: "center"
      }}>{item.status}</span>
    </div>
  );
}

export default function DeepShield() {
  const [liveScore, setLiveScore] = useState(91);
  const [tick, setTick] = useState(0);
  const [activeTab, setActiveTab] = useState("threats");
  const canvasRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveScore(s => Math.max(85, Math.min(99, s + (Math.random() - 0.48) * 2)));
      setTick(t => t + 1);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  // Draw waveform canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = "#00ff88";
    ctx.lineWidth = 1.5;
    ctx.shadowColor = "#00ff88";
    ctx.shadowBlur = 6;
    ctx.beginPath();
    for (let x = 0; x < W; x++) {
      const t2 = (x / W) * Math.PI * 12 + tick * 0.3;
      const y = H / 2 + Math.sin(t2) * 12 + Math.sin(t2 * 2.3) * 6 + Math.sin(t2 * 0.7) * 8;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }, [tick]);

  const circumference = 2 * Math.PI * 54;
  const dashOffset = circumference - (liveScore / 100) * circumference;

  return (
    <div style={{
      minHeight: "100vh", background: "#060810",
      fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
      color: "#ccd", padding: 24,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&family=IBM+Plex+Sans:wght@300;400;600;700&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes ripple { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(2.5);opacity:0} }
        @keyframes blink { 0%,100%{opacity:1} 49%{opacity:1} 50%{opacity:0.2} 51%{opacity:0.2} }
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:#0a0d1a} ::-webkit-scrollbar-thumb{background:#223}
        * { box-sizing: border-box; }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, background: "linear-gradient(135deg, #00ff88, #0088ff)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🛡</div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, fontFamily: "'IBM Plex Sans', sans-serif", letterSpacing: "-0.02em", color: "#eef" }}>
              DEEP<span style={{ color: "#00ff88" }}>SHIELD</span>
            </h1>
            <span style={{ fontSize: 10, color: "#445", border: "1px solid #223", padding: "2px 6px", borderRadius: 3 }}>v0.9.1-BETA</span>
          </div>
          <p style={{ margin: 0, fontSize: 11, color: "#445", letterSpacing: "0.1em" }}>DEEPFAKE DETECTION & IDENTITY SECURITY PLATFORM</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end", marginBottom: 6 }}>
            <PulseRing active={true} />
            <span style={{ fontSize: 11, color: "#00ff88", letterSpacing: "0.1em" }}>SYSTEM ONLINE</span>
          </div>
          <div style={{ fontSize: 11, color: "#445", animation: "blink 3s infinite" }}>● LIVE MONITORING ACTIVE</div>
        </div>
      </div>

      {/* Metric Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {METRICS.map((m, i) => (
          <div key={i} style={{ background: "#0a0d1a", border: "1px solid #1a1f2e", borderRadius: 8, padding: "16px 18px" }}>
            <div style={{ fontSize: 10, color: "#556", letterSpacing: "0.1em", marginBottom: 8, textTransform: "uppercase" }}>{m.label}</div>
            <div style={{ fontSize: 26, fontWeight: 600, color: "#eef", fontFamily: "'IBM Plex Sans', sans-serif", marginBottom: 4 }}>{m.value}</div>
            <div style={{ fontSize: 11, color: m.up ? "#00ff88" : "#ff8844" }}>{m.delta}</div>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16, marginBottom: 16 }}>

        {/* Threat Feed */}
        <div style={{ background: "#0a0d1a", border: "1px solid #1a1f2e", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ display: "flex", borderBottom: "1px solid #1a1f2e", padding: "0 16px" }}>
            {["threats", "analytics", "policies"].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                background: "none", border: "none", padding: "14px 16px 12px",
                color: activeTab === tab ? "#00ff88" : "#445",
                borderBottom: activeTab === tab ? "2px solid #00ff88" : "2px solid transparent",
                fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer",
                fontFamily: "inherit", transition: "color 0.2s"
              }}>{tab}</button>
            ))}
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#445" }}>
              <span style={{ color: "#ff4455", animation: "blink 1.5s infinite" }}>●</span> LIVE
            </div>
          </div>

          {activeTab === "threats" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "80px 90px 1fr 120px 90px 90px", padding: "8px 16px", borderBottom: "1px solid #1a1f2e", fontSize: 10, color: "#334", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                <span>Time</span><span>Type</span><span>Threat</span><span>Source</span><span>Confidence</span><span>Status</span>
              </div>
              {THREAT_DATA.map((item, i) => <ThreatRow key={item.id} item={item} index={i} />)}
            </>
          )}

          {activeTab === "analytics" && (
            <div style={{ padding: 20 }}>
              <div style={{ fontSize: 12, color: "#667", marginBottom: 16 }}>Threat Volume — Last 12 Hours</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100 }}>
                {BAR_DATA.map((v, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{ width: "100%", height: v, background: `linear-gradient(to top, #0088ff, #00ff88)`, borderRadius: "3px 3px 0 0", opacity: 0.8 }} />
                    <span style={{ fontSize: 9, color: "#334" }}>{BAR_LABELS[i]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "policies" && (
            <div style={{ padding: 20, display: "grid", gap: 10 }}>
              {[
                { name: "Auto-block face swap attempts", status: "on" },
                { name: "Flag synthetic voice calls", status: "on" },
                { name: "Require liveness check for exec access", status: "on" },
                { name: "Notify security team on critical threats", status: "on" },
                { name: "Log all scan metadata", status: "on" },
                { name: "AI-generated content watermark scan", status: "off" },
              ].map((p, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#060810", borderRadius: 6, border: "1px solid #1a1f2e" }}>
                  <span style={{ fontSize: 12, color: "#99aacc" }}>{p.name}</span>
                  <div style={{ width: 36, height: 20, borderRadius: 10, background: p.status === "on" ? "#00ff8833" : "#1a1f2e", border: `1px solid ${p.status === "on" ? "#00ff88" : "#223"}`, display: "flex", alignItems: "center", padding: "0 3px", justifyContent: p.status === "on" ? "flex-end" : "flex-start" }}>
                    <div style={{ width: 14, height: 14, borderRadius: "50%", background: p.status === "on" ? "#00ff88" : "#334" }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Live Score */}
          <div style={{ background: "#0a0d1a", border: "1px solid #1a1f2e", borderRadius: 8, padding: 20, textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "#445", letterSpacing: "0.1em", marginBottom: 16, textTransform: "uppercase" }}>Live Trust Score</div>
            <svg width="130" height="130" style={{ margin: "0 auto", display: "block" }}>
              <circle cx="65" cy="65" r="54" fill="none" stroke="#1a1f2e" strokeWidth="8" />
              <circle cx="65" cy="65" r="54" fill="none" stroke="url(#scoreGrad)" strokeWidth="8"
                strokeDasharray={circumference} strokeDashoffset={dashOffset}
                strokeLinecap="round" transform="rotate(-90 65 65)"
                style={{ transition: "stroke-dashoffset 0.8s ease" }} />
              <defs>
                <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#0088ff" />
                  <stop offset="100%" stopColor="#00ff88" />
                </linearGradient>
              </defs>
              <text x="65" y="60" textAnchor="middle" fill="#eef" fontSize="26" fontWeight="600" fontFamily="IBM Plex Mono">{Math.round(liveScore)}</text>
              <text x="65" y="78" textAnchor="middle" fill="#445" fontSize="10" fontFamily="IBM Plex Mono">/ 100</text>
            </svg>
            <div style={{ fontSize: 11, color: "#00ff88", marginTop: 8 }}>● NOMINAL</div>
          </div>

          {/* Waveform */}
          <div style={{ background: "#0a0d1a", border: "1px solid #1a1f2e", borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 10, color: "#445", letterSpacing: "0.1em", marginBottom: 10, textTransform: "uppercase" }}>Voice Analysis</div>
            <canvas ref={canvasRef} width={240} height={50} style={{ width: "100%", display: "block" }} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 10, color: "#334" }}>
              <span>Frequency</span><span style={{ color: "#00ff88" }}>AUTHENTIC</span>
            </div>
          </div>

          {/* Detection Modules */}
          <div style={{ background: "#0a0d1a", border: "1px solid #1a1f2e", borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 10, color: "#445", letterSpacing: "0.1em", marginBottom: 12, textTransform: "uppercase" }}>Detection Modules</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {DETECTION_MODULES.map((mod, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14 }}>{mod.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: 10, color: mod.active ? "#99aacc" : "#334" }}>{mod.name}</span>
                      {mod.active && <span style={{ fontSize: 10, color: "#445" }}>{mod.coverage}%</span>}
                    </div>
                    <div style={{ height: 3, background: "#1a1f2e", borderRadius: 2 }}>
                      {mod.active && <div style={{ width: `${mod.coverage}%`, height: "100%", borderRadius: 2, background: "linear-gradient(to right, #0088ff, #00ff88)" }} />}
                    </div>
                  </div>
                  <PulseRing active={mod.active} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#334", borderTop: "1px solid #1a1f2e", paddingTop: 12 }}>
        <span>DEEPSHIELD SECURITY PLATFORM — BETA BUILD</span>
        <span>LAST SCAN: {new Date().toLocaleTimeString()}</span>
        <span>NODES ACTIVE: 4/4</span>
      </div>
    </div>
  );
}
