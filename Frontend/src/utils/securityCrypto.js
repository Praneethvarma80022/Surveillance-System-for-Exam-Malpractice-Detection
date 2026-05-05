const API_BASE = import.meta.env.VITE_DETECTION_API_URL || "http://localhost:5000/api/v1";
const CLIENT_SECRET = import.meta.env.VITE_CLIENT_ENC_SECRET || "proctorguard_demo_secret";
const keyCache = new Map();

const encoder = new TextEncoder();

const toBase64 = (bytes) => {
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
};

const toBytes = (data) => {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return encoder.encode(String(data));
};

const deriveKey = async (sessionId) => {
  if (keyCache.has(sessionId)) {
    return keyCache.get(sessionId);
  }

  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(CLIENT_SECRET),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  const salt = encoder.encode(sessionId || "proctorguard");
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  keyCache.set(sessionId, key);
  return key;
};

const encryptBytes = async (key, bytes) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    bytes
  );

  return {
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(cipher))
  };
};

export const sendEncryptedLog = async (sessionId, payload) => {
  if (!sessionId) return;
  try {
    const key = await deriveKey(sessionId);
    const bodyBytes = toBytes(JSON.stringify(payload));
    const encrypted = await encryptBytes(key, bodyBytes);

    await fetch(`${API_BASE}/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        encrypted
      })
    });
  } catch (err) {
    console.warn("Failed to send encrypted log", err);
  }
};

export const sendEventMetric = async (sessionId, eventType, meta = {}) => {
  if (!sessionId || !eventType) return;
  try {
    await fetch(`${API_BASE}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        event_type: eventType,
        meta
      })
    });
  } catch (err) {
    console.warn("Failed to send event metric", err);
  }
};

export const sendEncryptedRecordingChunk = async (sessionId, chunk, meta = {}) => {
  if (!sessionId) return;
  try {
    const key = await deriveKey(sessionId);
    const bytes = toBytes(chunk);
    const encrypted = await encryptBytes(key, bytes);

    await fetch(`${API_BASE}/recordings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        meta,
        encrypted
      })
    });
  } catch (err) {
    console.warn("Failed to send encrypted recording", err);
  }
};

export const sendEncryptedSnapshot = async (sessionId, snapshotDataUrl, meta = {}) => {
  if (!sessionId || !snapshotDataUrl) return;
  try {
    // Send to encrypted recordings endpoint
    const key = await deriveKey(sessionId);
    const bytes = toBytes(snapshotDataUrl);
    const encrypted = await encryptBytes(key, bytes);

    await fetch(`${API_BASE}/recordings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        meta: { ...meta, type: "snapshot" },
        encrypted
      })
    });

    // Also send to dedicated snapshots endpoint for better tracking
    await fetch(`${API_BASE}/snapshots/store`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        snapshot: snapshotDataUrl,
        metadata: meta
      })
    });
  } catch (err) {
    console.warn("Failed to send encrypted snapshot", err);
  }
};
