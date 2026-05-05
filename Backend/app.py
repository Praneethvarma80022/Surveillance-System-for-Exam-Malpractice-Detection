"""
ProctorGuard Backend API
Flask server for malpractice detection
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import os
from dotenv import load_dotenv
import logging
from datetime import datetime
import json
import base64

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)
socketio = SocketIO(
    app, 
    cors_allowed_origins="*",
    async_mode='threading',
    logger=False,
    engineio_logger=False,
    ping_timeout=60,
    ping_interval=25
)

app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024
app.config["JSON_SORT_KEYS"] = False

proctor_model = None
mobile_sessions = {}
event_counters = {}
STORAGE_DIR = os.path.join(os.path.dirname(__file__), "storage")
LOG_FILE = os.path.join(STORAGE_DIR, "encrypted_logs.jsonl")
RECORDINGS_DIR = os.path.join(STORAGE_DIR, "recordings")
CHUNKS_DIR = os.path.join(STORAGE_DIR, "chunks")
SNAPSHOTS_DIR = os.path.join(STORAGE_DIR, "snapshots")


def ensure_storage():
    os.makedirs(STORAGE_DIR, exist_ok=True)
    os.makedirs(RECORDINGS_DIR, exist_ok=True)
    os.makedirs(CHUNKS_DIR, exist_ok=True)
    os.makedirs(SNAPSHOTS_DIR, exist_ok=True)


def sanitize_session_id(session_id):
    if not session_id:
        return "unknown"
    safe = "".join(ch for ch in session_id if ch.isalnum() or ch in "-_")
    return safe[:64] or "unknown"


def sanitize_for_json(obj):
    """Convert non-JSON-safe values into serializable types."""
    if isinstance(obj, datetime):
        return obj.isoformat()

    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}

    if isinstance(obj, (list, tuple)):
        return [sanitize_for_json(v) for v in obj]

    if isinstance(obj, (str, int, float, bool)) or obj is None:
        return obj

    try:
        return str(obj)
    except Exception:
        return None


def log_detection_event(session_id, detection):
    ensure_storage()
    safe_session = sanitize_session_id(session_id)
    payload = {k: v for k, v in detection.items() if k != "annotated_frame"}
    entry = {
        "ts": datetime.utcnow().isoformat(),
        "session_id": safe_session,
        "event_type": "detection",
        "payload": sanitize_for_json(payload)
    }

    with open(LOG_FILE, "a", encoding="utf-8") as handle:
        handle.write(json.dumps(entry) + "\n")


def log_metric_event(session_id, event_type, meta=None):
    ensure_storage()
    safe_session = sanitize_session_id(session_id)
    if safe_session not in event_counters:
        event_counters[safe_session] = {}
    event_counters[safe_session][event_type] = event_counters[safe_session].get(event_type, 0) + 1

    entry = {
        "ts": datetime.utcnow().isoformat(),
        "session_id": safe_session,
        "event_type": event_type,
        "meta": sanitize_for_json(meta or {})
    }
    with open(LOG_FILE, "a", encoding="utf-8") as handle:
        handle.write(json.dumps(entry) + "\n")


@app.before_request
def initialize_models():
    """Initialize models lazily on the first request."""
    global proctor_model
    if proctor_model is None:
        try:
            from models import ProctorAIModel
            proctor_model = ProctorAIModel()
            logger.info("Proctor AI Model initialized successfully")
        except Exception as exc:
            logger.error(f"Failed to initialize Proctor AI Model: {exc}")
            return jsonify({"error": "Failed to initialize detection models"}), 500


@app.route("/api/v1/network-info", methods=["GET"])
def network_info():
    """Return the server's local network IP so mobile devices can connect."""
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
    except Exception:
        ip = "127.0.0.1"
    return jsonify({"ip": ip}), 200


@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "ProctorGuard Malpractice Detection API",
        "version": "1.0.0"
    }), 200


@app.route("/api/v1/detect/frame", methods=["POST"])
def detect_frame():
    try:
        data = request.get_json()
        if not data or "frame" not in data:
            return jsonify({"error": "Missing frame data"}), 400

        frame_data = data["frame"]
        session_id = data.get("session_id", "unknown")
        include_annotated_frame = data.get("include_frame", False)

        result = proctor_model.process_frame(frame_data, include_frame=include_annotated_frame)
        if "error" in result:
            logger.error(f"Detection error for session {session_id}: {result['error']}")
            return jsonify(sanitize_for_json(result)), 400

        result["session_id"] = session_id
        
        # Log detection boxes for debugging
        face_info = result.get("facial_analysis", {})
        object_info = result.get("object_analysis", {})
        face_boxes = face_info.get("face_boxes", [])
        person_boxes = object_info.get("person_boxes", [])
        phone_boxes = object_info.get("phone_boxes", [])
        
        logger.info(f'[HTTP DETECT] Boxes detected - Faces: {len(face_boxes)}, Persons: {len(person_boxes)}, Phones: {len(phone_boxes)}')

        if result.get("risk_level") in ["high", "critical"]:
            logger.warning(
                f"High-risk activity detected in session {session_id}: {result.get('all_anomalies')}"
            )

        log_detection_event(session_id, result)

        return jsonify(sanitize_for_json(result)), 200
    except Exception as exc:
        logger.error(f"Error in frame detection: {exc}")
        return jsonify({"error": f"Internal server error: {exc}"}), 500


@app.route("/api/v1/detect/batch", methods=["POST"])
def detect_batch():
    try:
        data = request.get_json()
        if not data or "frames" not in data:
            return jsonify({"error": "Missing frames data"}), 400

        frames = data["frames"]
        session_id = data.get("session_id", "unknown")

        if not isinstance(frames, list) or len(frames) == 0:
            return jsonify({"error": "Frames must be a non-empty list"}), 400

        detections = []
        for frame_data in frames:
            result = proctor_model.process_frame(frame_data)
            if "error" not in result:
                detections.append(result)

        response = {
            "session_id": session_id,
            "total_frames": len(frames),
            "processed_frames": len(detections),
            "detections": detections,
            "summary": proctor_model.get_statistics()
        }

        return jsonify(sanitize_for_json(response)), 200
    except Exception as exc:
        logger.error(f"Error in batch detection: {exc}")
        return jsonify({"error": f"Internal server error: {exc}"}), 500


@app.route("/api/v1/statistics", methods=["GET"])
def get_statistics():
    try:
        stats = proctor_model.get_statistics()
        stats["event_counters"] = event_counters
        return jsonify(sanitize_for_json(stats)), 200
    except Exception as exc:
        logger.error(f"Error getting statistics: {exc}")
        return jsonify({"error": f"Internal server error: {exc}"}), 500


@app.route("/api/v1/events", methods=["POST"])
def ingest_event_metric():
    try:
        data = request.get_json()
        session_id = data.get("session_id") if data else None
        event_type = data.get("event_type") if data else None
        meta = data.get("meta") if data else {}

        if not session_id or not event_type:
            return jsonify({"error": "Missing session_id or event_type"}), 400

        log_metric_event(session_id, event_type, meta)
        return jsonify({"status": "ok"}), 200
    except Exception as exc:
        logger.error(f"Error ingesting event metric: {exc}")
        return jsonify({"error": str(exc)}), 500


@app.route("/api/v1/config", methods=["GET"])
def get_config():
    config = {
        "detection": {
            "enabled": True,
            "frame_rate": 3,
            "risk_levels": {
                "critical": {"threshold": 85},
                "high": {"threshold": 60},
                "medium": {"threshold": 35},
                "low": {"threshold": 0}
            }
        },
        "mobile": {
            "heartbeat_seconds": 10
        }
    }
    return jsonify(config), 200


@app.route("/api/v1/mobile/register", methods=["POST"])
def register_mobile():
    try:
        data = request.get_json()
        session_id = data.get("session_id") if data else None
        status = data.get("status", "active") if data else "active"

        if not session_id:
            return jsonify({"error": "Missing session_id"}), 400

        mobile_sessions[session_id] = {
            "status": status,
            "last_seen": datetime.utcnow().isoformat()
        }

        logger.info(f"Mobile session {session_id} registered as {status}")
        return jsonify({"session_id": session_id, "status": status}), 200
    except Exception as exc:
        logger.error(f"Error registering mobile session: {exc}")
        return jsonify({"error": str(exc)}), 500


@app.route("/api/v1/mobile/status", methods=["GET"])
def mobile_status():
    try:
        session_id = request.args.get("session_id")
        if not session_id:
            return jsonify({"error": "Missing session_id"}), 400

        info = mobile_sessions.get(session_id)
        if not info:
            return jsonify({"session_id": session_id, "status": "unknown"}), 200

        return jsonify({
            "session_id": session_id,
            "status": info.get("status", "unknown"),
            "last_seen": info.get("last_seen")
        }), 200
    except Exception as exc:
        logger.error(f"Error getting mobile status: {exc}")
        return jsonify({"error": str(exc)}), 500


@app.route("/api/v1/session/upload-chunk", methods=["POST", "OPTIONS"])
def upload_chunk():
    """Receive a video chunk from the mobile camera recorder."""
    if request.method == "OPTIONS":
        return "", 204

    try:
        session_id = request.form.get("sessionId")
        timestamp = request.form.get("timestamp", datetime.utcnow().isoformat())
        chunk = request.files.get("chunk")

        if not session_id:
            return jsonify({"error": "Missing sessionId"}), 400

        ensure_storage()
        safe_session = sanitize_session_id(session_id)

        # Per-session directory under chunks/
        session_dir = os.path.join(CHUNKS_DIR, safe_session)
        os.makedirs(session_dir, exist_ok=True)

        if chunk:
            # Save the binary blob
            ts_slug = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
            filename = f"chunk_{ts_slug}.webm"
            filepath = os.path.join(session_dir, filename)
            chunk.save(filepath)
            size = os.path.getsize(filepath)
            logger.info(f"[CHUNK] Saved {filename} ({size} bytes) for session {safe_session}")
        else:
            # Fallback: store raw body if no multipart file
            raw = request.get_data()
            if raw:
                ts_slug = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
                filename = f"chunk_{ts_slug}.webm"
                filepath = os.path.join(session_dir, filename)
                with open(filepath, "wb") as f:
                    f.write(raw)
                logger.info(f"[CHUNK] Saved raw {filename} ({len(raw)} bytes) for session {safe_session}")

        return jsonify({"status": "ok", "timestamp": timestamp}), 200
    except Exception as exc:
        logger.error(f"[CHUNK] Error saving chunk: {exc}")
        return jsonify({"error": str(exc)}), 500


@app.route("/api/v1/session/heartbeat", methods=["POST", "OPTIONS"])
def session_heartbeat():
    """Handle heartbeat from mobile camera for session keepalive."""
    if request.method == "OPTIONS":
        return "", 204
    
    try:
        data = request.get_json() or {}
        session_id = data.get("sessionId")
        
        if not session_id:
            return jsonify({"error": "Missing sessionId"}), 400
        
        # Update or create session
        if session_id not in mobile_sessions:
            mobile_sessions[session_id] = {}
        
        mobile_sessions[session_id]["last_heartbeat"] = datetime.utcnow().isoformat()
        mobile_sessions[session_id]["status"] = data.get("status", "active")
        
        logger.info(f"Heartbeat received for session {session_id}")
        return jsonify({"status": "ok", "timestamp": datetime.utcnow().isoformat()}), 200
    except Exception as exc:
        logger.error(f"Error processing heartbeat: {exc}")
        return jsonify({"error": str(exc)}), 500


@app.route("/api/v1/session/<session_id>/status", methods=["GET", "OPTIONS"])
def session_status(session_id):
    """Check session status and stop signal from backend."""
    if request.method == "OPTIONS":
        return "", 204
    
    try:
        if not session_id:
            return jsonify({"error": "Missing session_id"}), 400
        
        info = mobile_sessions.get(session_id, {})
        
        return jsonify({
            "session_id": session_id,
            "status": info.get("status", "active"),
            "should_stop_recording": info.get("should_stop", False),
            "last_heartbeat": info.get("last_heartbeat"),
            "timestamp": datetime.utcnow().isoformat()
        }), 200
    except Exception as exc:
        logger.error(f"Error getting session status: {exc}")
        return jsonify({"error": str(exc)}), 500


@app.route("/api/v1/logs", methods=["POST"])
def ingest_logs():
    try:
        data = request.get_json()
        session_id = data.get("session_id") if data else None
        encrypted = data.get("encrypted") if data else None

        if not session_id or not encrypted:
            return jsonify({"error": "Missing session_id or encrypted payload"}), 400

        ensure_storage()
        safe_session = sanitize_session_id(session_id)
        entry = {
            "ts": datetime.utcnow().isoformat(),
            "session_id": safe_session,
            "encrypted": encrypted
        }

        with open(LOG_FILE, "a", encoding="utf-8") as handle:
            handle.write(json.dumps(entry) + "\n")

        return jsonify({"status": "ok"}), 200
    except Exception as exc:
        logger.error(f"Error ingesting logs: {exc}")
        return jsonify({"error": str(exc)}), 500


@app.route("/api/v1/recordings", methods=["POST"])
def ingest_recordings():
    try:
        data = request.get_json()
        session_id = data.get("session_id") if data else None
        encrypted = data.get("encrypted") if data else None
        meta = data.get("meta") if data else {}

        if not session_id or not encrypted:
            return jsonify({"error": "Missing session_id or encrypted payload"}), 400

        ensure_storage()
        safe_session = sanitize_session_id(session_id)
        file_path = os.path.join(RECORDINGS_DIR, f"{safe_session}.jsonl")

        entry = {
            "ts": datetime.utcnow().isoformat(),
            "session_id": safe_session,
            "meta": meta,
            "encrypted": encrypted
        }

        with open(file_path, "a", encoding="utf-8") as handle:
            handle.write(json.dumps(entry) + "\n")

        return jsonify({"status": "ok"}), 200
    except Exception as exc:
        logger.error(f"Error ingesting recordings: {exc}")
        return jsonify({"error": str(exc)}), 500


@socketio.on("connect")
def socket_connect():
    logger.info('[BACKEND SOCKET] Client connected')
    # Initialize models on first Socket.IO connection
    global proctor_model
    if proctor_model is None:
        try:
            from models import ProctorAIModel
            logger.info('[BACKEND SOCKET] Initializing Proctor AI Model...')
            proctor_model = ProctorAIModel()
            logger.info('[BACKEND SOCKET] Proctor AI Model initialized successfully')
        except Exception as exc:
            logger.error(f'[BACKEND SOCKET] Failed to initialize model: {exc}', exc_info=True)
    
    emit("connected", {"status": "ok"})


@socketio.on("disconnect")
def socket_disconnect():
    logger.info('[BACKEND SOCKET] Client disconnected')


@socketio.on("frame")
def socket_frame(data):
    try:
        logger.info('[BACKEND SOCKET] Frame received from client')
        
        # Ensure model is initialized
        global proctor_model
        if proctor_model is None:
            logger.error('[BACKEND SOCKET] Proctor model not initialized')
            emit("detection", {"error": "Detection model not available"})
            return
        
        if not data or "frame" not in data:
            logger.error('[BACKEND SOCKET] Missing frame data in request')
            emit("detection", {"error": "Missing frame data"})
            return

        session_id = data.get("session_id", "unknown")
        frame_data = data["frame"]
        
        # Validate frame data
        if not isinstance(frame_data, str) or len(frame_data) < 100:
            logger.error(f'[BACKEND SOCKET] Invalid frame data for session {session_id}, size: {len(frame_data) if isinstance(frame_data, str) else "not string"}')
            emit("detection", {"error": "Invalid frame data"})
            return
            
        logger.info(f'[BACKEND SOCKET] Processing frame for session {session_id}, frame size: {len(frame_data)} bytes')

        result = proctor_model.process_frame(frame_data, include_frame=False)
        logger.info(f'[BACKEND SOCKET] Frame processing complete, result keys: {list(result.keys())}')
        
        # Log detailed detection information for debugging
        if "error" not in result:
            face_info = result.get("facial_analysis", {})
            object_info = result.get("object_analysis", {})
            face_boxes = face_info.get("face_boxes", [])
            person_boxes = object_info.get("person_boxes", [])
            phone_boxes = object_info.get("phone_boxes", [])
            
            logger.info(f'[BACKEND SOCKET] Boxes detected - Faces: {len(face_boxes)}, Persons: {len(person_boxes)}, Phones: {len(phone_boxes)}')
            logger.debug(f'[BACKEND SOCKET] Face detection: {face_info.get("face_detected")}, Multiple: {face_info.get("multiple_faces")}')
            logger.debug(f'[BACKEND SOCKET] Phone detected: {object_info.get("phone_detected")}, Person count: {object_info.get("person_count")}')
            logger.debug(f'[BACKEND SOCKET] Anomalies: {result.get("all_anomalies")}')
            
            # Log actual box coordinates for debugging
            if face_boxes:
                logger.info(f'[BACKEND SOCKET] Face boxes: {face_boxes}')
            if person_boxes:
                logger.info(f'[BACKEND SOCKET] Person boxes: {person_boxes}')
        
        if "error" in result:
            logger.error(f'[BACKEND SOCKET] Detection error: {result["error"]}')
            emit("detection", sanitize_for_json(result))
            return

        result["session_id"] = session_id
        if result.get("risk_level") in ["high", "critical"]:
            logger.warning(
                f"[BACKEND SOCKET] High-risk activity detected in session {session_id}: {result.get('all_anomalies')}"
            )

        log_detection_event(session_id, result)
        logger.info(f'[BACKEND SOCKET] Emitting detection result to client for session {session_id}')
        emit("detection", sanitize_for_json(result))
        logger.info('[BACKEND SOCKET] Detection result emitted successfully')
    except Exception as exc:
        logger.error(f'[BACKEND SOCKET] Exception in socket_frame: {exc}', exc_info=True)
        emit("detection", {"error": f"Internal server error: {exc}"})



@app.route("/api/v1/recordings/index", methods=["GET"])
def recordings_index():
    try:
        ensure_storage()
        index = {}
        for name in os.listdir(RECORDINGS_DIR):
            if not name.endswith(".jsonl"):
                continue
            session_id = name.replace(".jsonl", "")
            path = os.path.join(RECORDINGS_DIR, name)
            try:
                with open(path, "r", encoding="utf-8") as handle:
                    count = sum(1 for _ in handle)
                size = os.path.getsize(path)
            except Exception:
                count = 0
                size = 0
            index[session_id] = {"chunks": count, "size": size}

        return jsonify({"sessions": index}), 200
    except Exception as exc:
        logger.error(f"Error listing recordings: {exc}")
        return jsonify({"error": str(exc)}), 500


@app.route("/api/v1/recordings/download", methods=["GET"])
def recordings_download():
    try:
        session_id = request.args.get("session_id")
        if not session_id:
            return jsonify({"error": "Missing session_id"}), 400

        ensure_storage()
        safe_session = sanitize_session_id(session_id)
        file_path = os.path.join(RECORDINGS_DIR, f"{safe_session}.jsonl")
        if not os.path.exists(file_path):
            return jsonify({"error": "Recording not found"}), 404

        return send_file(
            file_path,
            mimetype="application/json",
            as_attachment=True,
            download_name=f"recording_{safe_session}.jsonl"
        )
    except Exception as exc:
        logger.error(f"Error downloading recording: {exc}")
        return jsonify({"error": str(exc)}), 500


@app.route("/api/v1/snapshots/store", methods=["POST"])
def store_snapshot():
    """Store a snapshot with detection metadata for violation evidence"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Missing request data"}), 400

        session_id = data.get("session_id")
        snapshot_data = data.get("snapshot")  # base64 encoded image
        metadata = data.get("metadata", {})  # reason, severity, timestamp, etc.

        if not session_id or not snapshot_data:
            return jsonify({"error": "Missing session_id or snapshot data"}), 400

        ensure_storage()
        safe_session = sanitize_session_id(session_id)
        session_snap_dir = os.path.join(SNAPSHOTS_DIR, safe_session)
        os.makedirs(session_snap_dir, exist_ok=True)

        # Decode and save the actual snapshot image to disk
        snapshot_filename = None
        try:
            raw_b64 = snapshot_data
            if raw_b64.startswith("data:image"):
                raw_b64 = raw_b64.split(",", 1)[1]
            image_bytes = base64.b64decode(raw_b64)
            ts_slug = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
            snapshot_filename = f"snap_{ts_slug}.jpg"
            filepath = os.path.join(session_snap_dir, snapshot_filename)
            with open(filepath, "wb") as img_file:
                img_file.write(image_bytes)
            logger.info(f"[SNAPSHOTS] Saved image {snapshot_filename} ({len(image_bytes)} bytes) for session {safe_session}")
        except Exception as img_err:
            logger.error(f"[SNAPSHOTS] Failed to save snapshot image: {img_err}")

        # Log snapshot metadata
        snapshot_entry = {
            "ts": datetime.utcnow().isoformat(),
            "session_id": safe_session,
            "event_type": "snapshot",
            "metadata": sanitize_for_json(metadata),
            "snapshot_file": snapshot_filename,
            "snapshot_stored": snapshot_filename is not None
        }

        with open(LOG_FILE, "a", encoding="utf-8") as handle:
            handle.write(json.dumps(snapshot_entry) + "\n")

        logger.info(f"[SNAPSHOTS] Stored snapshot for session {safe_session}, reason: {metadata.get('reason', 'unknown')}")

        return jsonify({
            "status": "ok",
            "session_id": session_id,
            "snapshot_file": snapshot_filename,
            "timestamp": snapshot_entry["ts"]
        }), 200
    except Exception as exc:
        logger.error(f"[SNAPSHOTS] Error storing snapshot: {exc}")
        return jsonify({"error": str(exc)}), 500


@app.errorhandler(404)
def not_found(_error):
    return jsonify({"error": "Endpoint not found"}), 404


@app.errorhandler(405)
def method_not_allowed(_error):
    return jsonify({"error": "Method not allowed"}), 405


@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {error}")
    return jsonify({"error": "Internal server error"}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("DEBUG", "False") == "True"

    logger.info(f"Starting ProctorGuard API on port {port}")
    logger.info(f"Debug mode: {debug}")

    socketio.run(app, host="0.0.0.0", port=port, debug=debug)
