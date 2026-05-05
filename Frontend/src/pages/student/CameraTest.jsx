import React, { useRef, useState, useCallback } from "react";

/**
 * Minimal COCO-SSD + Camera test page.
 * Access via  /#/CameraTest
 *
 * It does three things:
 *   1. Opens the webcam.
 *   2. Loads COCO-SSD (lite_mobilenet_v2).
 *   3. Runs detection every 1.5 s and draws bounding boxes on a canvas overlay.
 */
export default function CameraTestPage() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const modelRef = useRef(null);
  const intervalRef = useRef(null);

  const [log, setLog] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | running | error
  const [predictions, setPredictions] = useState([]);

  const addLog = useCallback((msg) => {
    const ts = new Date().toLocaleTimeString();
    setLog((prev) => [`[${ts}] ${msg}`, ...prev].slice(0, 80));
  }, []);

  // ── Start everything ──────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    try {
      setStatus("loading");

      // 1. Camera
      addLog("Requesting camera…");
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("mediaDevices.getUserMedia not available – need HTTPS");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      addLog("Camera started ✓");

      // 2. TensorFlow + COCO-SSD
      addLog("Importing TensorFlow.js…");
      const tf = await import("@tensorflow/tfjs");
      addLog(`TF ${tf.version_core || tf.version?.tfjs || "?"} imported ✓`);

      addLog("Importing COCO-SSD…");
      const cocoSsd = await import("@tensorflow-models/coco-ssd");
      addLog("COCO-SSD module imported ✓");

      addLog("Loading model (lite_mobilenet_v2)… this may take 10-30 s");
      const t0 = Date.now();
      const model = await cocoSsd.load({ base: "lite_mobilenet_v2" });
      addLog(`Model loaded in ${((Date.now() - t0) / 1000).toFixed(1)} s ✓`);
      modelRef.current = model;

      // 3. Run detection loop
      setStatus("running");
      addLog("Detection loop started (1.5 s interval)");
      intervalRef.current = setInterval(() => runDetection(), 1500);
    } catch (err) {
      addLog(`ERROR: ${err.message}`);
      setStatus("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addLog]);

  // ── Single detection pass ─────────────────────────────────────────
  const runDetection = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const model = modelRef.current;

    if (!video || !model || video.readyState < 2) return;

    try {
      const preds = await model.detect(video);
      setPredictions(preds);

      // Draw overlay
      if (canvas) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        preds.forEach((p) => {
          const [x, y, w, h] = p.bbox;
          ctx.strokeStyle = "#00ff00";
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, w, h);
          ctx.fillStyle = "#00ff00";
          ctx.font = "14px monospace";
          ctx.fillText(`${p.class} ${(p.score * 100).toFixed(0)}%`, x, y > 16 ? y - 4 : y + 14);
        });
      }

      if (preds.length > 0) {
        setLog((prev) => [
          `[${new Date().toLocaleTimeString()}] Detected: ${preds.map((p) => `${p.class}(${(p.score * 100).toFixed(0)}%)`).join(", ")}`,
          ...prev,
        ].slice(0, 80));
      }
    } catch (err) {
      console.error("[CameraTest] detection error", err);
    }
  }, []);

  // ── Stop ──────────────────────────────────────────────────────────
  const handleStop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }

    modelRef.current = null;
    setPredictions([]);
    setStatus("idle");
    addLog("Stopped");
  }, [addLog]);

  // ── UI ────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: 16, fontFamily: "sans-serif", color: "#e2e8f0", backgroundColor: "#0f172a", minHeight: "100vh" }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>COCO-SSD Camera Test</h1>
      <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 16 }}>
        Status: <strong style={{ color: status === "running" ? "#4ade80" : status === "error" ? "#f87171" : "#fbbf24" }}>{status}</strong>
        {predictions.length > 0 && ` — ${predictions.length} object(s)`}
      </p>

      <div style={{ position: "relative", marginBottom: 12, borderRadius: 8, overflow: "hidden", background: "#000" }}>
        <video ref={videoRef} playsInline muted style={{ width: "100%", display: "block" }} />
        <canvas ref={canvasRef} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          onClick={handleStart}
          disabled={status === "loading" || status === "running"}
          style={{ padding: "8px 20px", borderRadius: 6, border: "none", background: "#2563eb", color: "#fff", cursor: "pointer", fontWeight: 600, opacity: status === "loading" || status === "running" ? 0.5 : 1 }}
        >
          {status === "loading" ? "Loading…" : "Start"}
        </button>
        <button
          onClick={handleStop}
          disabled={status === "idle"}
          style={{ padding: "8px 20px", borderRadius: 6, border: "none", background: "#dc2626", color: "#fff", cursor: "pointer", fontWeight: 600, opacity: status === "idle" ? 0.5 : 1 }}
        >
          Stop
        </button>
      </div>

      <div style={{ background: "#1e293b", borderRadius: 8, padding: 12, maxHeight: 260, overflowY: "auto", fontSize: 12, lineHeight: 1.6 }}>
        <p style={{ margin: 0, fontWeight: 700, marginBottom: 4 }}>Log</p>
        {log.length === 0 && <p style={{ color: "#64748b" }}>Press Start to begin…</p>}
        {log.map((l, i) => (
          <div key={i} style={{ color: l.includes("ERROR") ? "#f87171" : l.includes("✓") ? "#4ade80" : "#cbd5e1" }}>{l}</div>
        ))}
      </div>
    </div>
  );
}
