import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Exam, ExamSession } from "@/entities/all";
import { detectionService } from "@/api/detectionService";
import "./Exam_New.css";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, RadioGroup, RadioGroupItem, Textarea, Label, Alert, AlertDescription, Dialog, DialogContent, DialogHeader, DialogTitle, Container } from "@/components/ui";
import { 
  Clock, 
  Camera, 
  Shield, 
  AlertTriangle, 
  Hand,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Send,
  Maximize,
  XCircle,
  AlertOctagon,
  Eye,
  Video,
  AlertCircle,
  Info
} from "lucide-react";

import ExamTimer from "@/components/exam/ExamTimer";
import IntegrityCheck from "@/components/exam/IntegrityCheck";
import QuestionNavigation from "@/components/exam/QuestionNavigation";
import QRCodeDisplay from "@/components/exam/QRCodeDisplay";
import { sendEncryptedLog, sendEncryptedRecordingChunk, sendEncryptedSnapshot, sendEventMetric } from "@/utils/securityCrypto";

class ExamErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.setState({ error, info });
    console.error('Exam page render error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="exam-error-boundary" style={{padding: 24}}>
          <h2 style={{color: '#ff6b6b'}}>An error occurred while loading the exam</h2>
          <p style={{color: '#fff'}}>Please report the error below to the instructor or try reloading the page.</p>
          <pre style={{whiteSpace: 'pre-wrap', color: '#eee', background: '#111', padding: 12, borderRadius: 6}}>
            {String(this.state.error && this.state.error.toString())}
            {this.state.info && '\n' + (this.state.info.componentStack || '')}
          </pre>
          <div style={{marginTop: 12}}>
            <button onClick={() => window.location.reload()} style={{padding: '8px 12px'}}>Reload</button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function ExamPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Try multiple ways to get examId
  let urlExamId = searchParams.get('examId') ? decodeURIComponent(searchParams.get('examId')) : null;
  let localStorageExamId = localStorage.getItem('proctorguard_exam_id');
  let sessionStorageExamId = sessionStorage.getItem('proctorguard_exam_id');
  
  // Use URL param if available, then localStorage, then sessionStorage
  const examId = urlExamId || localStorageExamId || sessionStorageExamId;
  
  console.log('[EXAM PAGE] examId lookup:', {
    from_url: urlExamId,
    from_localStorage: localStorageExamId,
    from_sessionStorage: sessionStorageExamId,
    final_examId: examId,
    all_searchParams: Object.fromEntries(searchParams)
  });
  const videoRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const initializingRef = useRef(false);
  const integrityIntervalRef = useRef(null);
  const recorderRef = useRef(null);
  const recordingStreamRef = useRef(null);
  const recorderChunkIndexRef = useRef(0);
  const audioContextRef = useRef(null);
  const audioIntervalRef = useRef(null);
  const lastActionRef = useRef({});
  const devtoolsIntervalRef = useRef(null);
  const toastTimerRef = useRef(null);
  const lockCountdownRef = useRef(null);
  
  const [exam, setExam] = useState(null);
  const [session, setSession] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [_isMonitoring, setIsMonitoring] = useState(true);
  const [showIntegrityCheck, setShowIntegrityCheck] = useState(false);
  const [integrityTimer, setIntegrityTimer] = useState(30);
  const [flags, setFlags] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [_fullscreenWarning, setFullscreenWarning] = useState(false);
  const [currentViolation, setCurrentViolation] = useState(null);
  const [violationCount, setViolationCount] = useState(0);
  const [showViolationAlert, setShowViolationAlert] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [_warningCount, _setWarningCount] = useState(0);
  const [_lastDetectionType, _setLastDetectionType] = useState(null);
  const [_tabSwitchCount, setTabSwitchCount] = useState(0);
  const [_mobileConfirmed, setMobileConfirmed] = useState(false);
  const [keystrokeData, setKeystrokeData] = useState([]);
  const [mouseData, setMouseData] = useState([]);
  const [keyDownTime, setKeyDownTime] = useState({});
  const [_cameraStatus, setCameraStatus] = useState("inactive");
  const [_audioStatus, setAudioStatus] = useState("inactive");
  const [monitoringBlocked, setMonitoringBlocked] = useState(false);
  const [monitoringError, setMonitoringError] = useState("");
  const [latestDetection, setLatestDetection] = useState(null);
  const [monitoringStatus, setMonitoringStatus] = useState("normal");
  const [currentAlertMessage, setCurrentAlertMessage] = useState("");
  const [eventLog, setEventLog] = useState([]);
  const [examLocked, setExamLocked] = useState(false);
  const [lockReason, setLockReason] = useState("");
  const [lockType, setLockType] = useState("");
  const [lockCountdown, setLockCountdown] = useState(0);
  const [toast, setToast] = useState(null);
  const [_shortcutViolationCount, setShortcutViolationCount] = useState(0);
  const [_escPressCount, setEscPressCount] = useState(0);
  const [focusViolationCount, setFocusViolationCount] = useState(0);
  // Exam flow stages: 'qr', 'fullscreen', 'exam'
  const [examStage, setExamStage] = useState('qr');
  const credentialId = localStorage.getItem('proctorguard_credential_id');

  useEffect(() => {
    if (examStage === 'exam') {
      localStorage.setItem('proctorguard_exam_lock', 'true');
    } else {
      localStorage.removeItem('proctorguard_exam_lock');
    }
    window.dispatchEvent(new Event('proctorguard_exam_lock'));

    return () => {
      localStorage.removeItem('proctorguard_exam_lock');
      window.dispatchEvent(new Event('proctorguard_exam_lock'));
    };
  }, [examStage]);

  const shouldThrottle = useCallback((key, windowMs = 1500) => {
    const now = Date.now();
    const last = lastActionRef.current[key] || 0;
    if (now - last < windowMs) {
      return true;
    }
    lastActionRef.current[key] = now;
    return false;
  }, []);

  const appendEventLog = useCallback((entry) => {
    setEventLog((prev) => [entry, ...prev].slice(0, 50));
  }, []);

  const showToast = useCallback((message, tone = "warning") => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    const id = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    setToast({ id, message, tone });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 2600);
  }, []);

  const activateLock = useCallback((reason, type, countdown = 0) => {
    setExamLocked(true);
    setLockReason(reason);
    setLockType(type);
    setLockCountdown(countdown);
  }, []);

  const clearLock = useCallback(() => {
    setExamLocked(false);
    setLockReason("");
    setLockType("");
    setLockCountdown(0);
  }, []);

  const captureViolationScreenshot = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    if (!width || !height) return null;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.85);
  }, []);

  const logMonitoringEvent = useCallback((message, severity = "warning", options = {}) => {
    const screenshot = options.capture ? captureViolationScreenshot() : null;
    appendEventLog({
      id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      message,
      severity,
      type: options.type || "event",
      screenshot
    });
  }, [appendEventLog, captureViolationScreenshot]);

  const logSecurityEvent = useCallback((eventType, details = {}, severity = "info") => {
    if (!session) return;
    sendEncryptedLog(session.id, {
      ts: new Date().toISOString(),
      event_type: eventType,
      severity,
      details
    });
    sendEventMetric(session.id, eventType, { severity, ...details });
  }, [session]);

  const recordSnapshot = useCallback((reason, severity, detectionType) => {
    if (!session) return;
    if (shouldThrottle("snapshot", 5000)) return;

    const snapshot = captureViolationScreenshot();
    if (!snapshot) return;

    const entry = {
      id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      reason,
      severity,
      detection_type: detectionType || "unknown",
      exam_credential_id: credentialId || "unknown"
    };

    sendEncryptedSnapshot(session.id, snapshot, {
      ...entry,
      session_id: session.id
    });

    setTimeout(() => {
      ExamSession.update(session.id, {
        proctoring_data: {
          ...session.proctoring_data,
          snapshots: [...(session.proctoring_data?.snapshots || []), { ...entry, image: snapshot }]
        }
      }).catch(err => console.error("Error updating snapshots:", err));
    }, 800);
  }, [session, shouldThrottle, captureViolationScreenshot, credentialId]);

  const addViolation = useCallback((reason, severity = "high", detectionType) => {
    if (examStage !== 'exam') {
      return;
    }
    
    // Immediately record as violation (no warning system) for faster detection
    // Only throttle to prevent duplicate detections within 2 seconds
    if (shouldThrottle(`violation_${detectionType}`, 2000)) {
      return; // Skip if same type detected within last 2 seconds
    }
    
    // Record violation immediately
    const violation = {
      timestamp: new Date().toISOString(),
      reason,
      severity
    };
    
    setFlags(prev => [...prev, violation]);
    setViolationCount(prev => prev + 1);
    setCurrentViolation(violation);
    setShowViolationAlert(true);
    
    logMonitoringEvent(reason, "malpractice", { type: detectionType, capture: severity === "high" || severity === "critical" });
    logSecurityEvent("violation", { reason, detectionType, severity }, severity);
    
    // Always capture snapshots for violations
    if (severity === "high" || severity === "critical" || severity === "medium") {
      recordSnapshot(reason, severity, detectionType);
    }
    
    // Auto-hide alert after 5 seconds
    setTimeout(() => {
      setShowViolationAlert(false);
    }, 4000);
    
    // Update session with new flag (debounced)
    if (session) {
      setTimeout(() => {
        ExamSession.update(session.id, {
          proctoring_data: {
            ...session.proctoring_data,
            flags: [...(session.proctoring_data?.flags || []), violation]
          }
        }).catch(err => console.error("Error updating session:", err));
      }, 1000);
    }
  }, [session, examStage, logSecurityEvent, logMonitoringEvent, recordSnapshot, shouldThrottle]);

  const drawDetectionOverlay = useCallback((detection) => {
    const video = videoRef.current;
    const canvas = overlayCanvasRef.current;
    if (!video || !canvas) return;

    const rect = video.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    const frameSize = detection?.frame_size || {};
    const sourceWidth = frameSize.width || video.videoWidth || 1280;
    const sourceHeight = frameSize.height || video.videoHeight || 720;
    if (!sourceWidth || !sourceHeight) return;
    const scaleX = width / sourceWidth;
    const scaleY = height / sourceHeight;

    const faceBoxes = detection?.facial_analysis?.face_boxes || [];
    const personBoxes = detection?.object_analysis?.person_boxes || [];
    const overlayBoxes = faceBoxes.length > 0 ? faceBoxes : personBoxes;
    const primaryIndex = Number.isInteger(detection?.facial_analysis?.primary_face_index)
      ? detection.facial_analysis.primary_face_index
      : 0;

    console.log('[OVERLAY] Drawing bounding boxes:', {
      canvasSize: { width, height },
      sourceSize: { width: sourceWidth, height: sourceHeight },
      scale: { x: scaleX, y: scaleY },
      faceBoxes: faceBoxes.length,
      personBoxes: personBoxes.length,
      overlayBoxes: overlayBoxes.length,
      phoneBoxes: (detection?.object_analysis?.phone_boxes || []).length
    });

    let extraPersonIndex = 2;
    overlayBoxes.forEach((box, index) => {
      const [x1, y1, x2, y2] = box;
      const scaledX = x1 * scaleX;
      const scaledY = y1 * scaleY;
      const scaledW = (x2 - x1) * scaleX;
      const scaledH = (y2 - y1) * scaleY;

      console.log(`[OVERLAY] Drawing box ${index}:`, {
        original: [x1, y1, x2, y2],
        scaled: [scaledX, scaledY, scaledW, scaledH]
      });

      const isPrimary = index === primaryIndex;
      const label = isPrimary ? "Candidate" : `Person ${extraPersonIndex++}`;
      ctx.strokeStyle = isPrimary ? "#22c55e" : "#ef4444";
      ctx.lineWidth = 2;
      ctx.strokeRect(scaledX, scaledY, scaledW, scaledH);

      const labelPadding = 6;
      ctx.font = "12px Manrope, sans-serif";
      const textWidth = ctx.measureText(label).width;
      ctx.fillStyle = isPrimary ? "rgba(34, 197, 94, 0.9)" : "rgba(239, 68, 68, 0.9)";
      ctx.fillRect(scaledX, Math.max(0, scaledY - 18), textWidth + labelPadding * 2, 16);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(label, scaledX + labelPadding, Math.max(12, scaledY - 6));
    });

    const phoneBoxes = detection?.object_analysis?.phone_boxes || [];
    phoneBoxes.forEach((box) => {
      const [x, y, w, h] = box;
      const scaledX = x * scaleX;
      const scaledY = y * scaleY;
      const scaledW = w * scaleX;
      const scaledH = h * scaleY;
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = 2;
      ctx.strokeRect(scaledX, scaledY, scaledW, scaledH);
    });
  }, []);

  const handleDetectionResult = useCallback((detection) => {
    if (!detection || !exam || examStage !== 'exam') return;

    setLatestDetection(detection);
    drawDetectionOverlay(detection);

    // Process detection results and trigger violations immediately
    const { all_anomalies, risk_level } = detection;

    const faceDetected = detection?.facial_analysis?.face_detected;
    const multipleFaces = detection?.facial_analysis?.multiple_faces;
    const phoneDetected = detection?.object_analysis?.phone_detected || detection?.object_analysis?.suspicious_objects;
    const suspiciousLabels = detection?.object_analysis?.suspicious_labels || [];
    const audioAnomaly = detection?.audio_analysis?.audio_anomaly;
    const screenActivity = detection?.motion_analysis?.suspicious_motion;
    
    // Debug logging for bounding boxes
    const faceBoxes = detection?.facial_analysis?.face_boxes || [];
    const personBoxes = detection?.object_analysis?.person_boxes || [];
    const phoneBoxes = detection?.object_analysis?.phone_boxes || [];
    console.log('[DETECTION] Boxes received:', {
      faces: faceBoxes.length,
      persons: personBoxes.length,
      phones: phoneBoxes.length,
      risk_level,
      anomalies: all_anomalies,
      faceDetected,
      multipleFaces
    });
    
    // Alert if no person detected
    if (faceDetected === false) {
      console.warn('⚠️ [DETECTION] NO PERSON DETECTED IN FRAME!');
    }
    if (multipleFaces === true) {
      console.warn('⚠️ [DETECTION] MULTIPLE PERSONS DETECTED IN FRAME!');
    }

    const statusFromSignal = (signal) => {
      if (signal === true) return 'alert';
      if (signal === false) return 'clear';
      return 'scanning';
    };

    let alertMessage = "";
    if (multipleFaces) {
      alertMessage = "⚠️ Multiple persons detected - only you should be visible!";
    } else if (faceDetected === false) {
      alertMessage = "🚨 NO PERSON DETECTED - Show your face to the camera!";
    } else if (suspiciousLabels.length > 0) {
      alertMessage = `⚠️ Suspicious object detected: ${suspiciousLabels.join(", ")}`;
    } else if (screenActivity) {
      alertMessage = "⚠️ Unusual movement detected - face the camera";
    }
    setCurrentAlertMessage(alertMessage);

    let status = "normal";
    if (faceDetected === false) {
      status = "warning";  // High priority for no person
    } else if (multipleFaces || risk_level === "high" || risk_level === "critical") {
      status = "malpractice";
    } else if (risk_level === "medium" || screenActivity) {
      status = "warning";
    }
    setMonitoringStatus(status);

    setMonitoringScans({
      faceDetection: faceDetected === false ? 'alert' : statusFromSignal(faceDetected),
      multiplePersons: statusFromSignal(multipleFaces),
      phoneDetection: statusFromSignal(phoneDetected || suspiciousLabels.length > 0),
      audioMonitoring: statusFromSignal(audioAnomaly),
      screenActivity: statusFromSignal(screenActivity)
    });
    
    // Log detection events for tracking (info level for normal monitoring)
    if (!shouldThrottle('detection_log', 5000)) {
      const personCount = personBoxes.length || (faceBoxes.length > 0 ? faceBoxes.length : 0);
      if (all_anomalies && all_anomalies.length > 0) {
        logMonitoringEvent(
          `Detection: ${all_anomalies.join(', ')} (Risk: ${risk_level})`,
          risk_level === 'critical' || risk_level === 'high' ? 'malpractice' : 'warning',
          { type: 'detection', capture: false }
        );
      } else if (personCount > 0) {
        logMonitoringEvent(
          `Monitoring: ${personCount} person(s) detected - Status normal`,
          'info',
          { type: 'monitoring', capture: false }
        );
      }
    }

    // Process anomalies and trigger violations immediately (no throttling)
    if (all_anomalies && all_anomalies.length > 0) {
      all_anomalies.forEach(anomaly => {
        switch (anomaly) {
          case 'face_not_detected':
            addViolation('Face not detected in camera - ensure your face is visible', 'critical', 'face_not_detected');
            break;
          case 'multiple_faces_detected':
            addViolation('Multiple faces detected - only you should be visible', 'critical', 'multiple_faces');
            break;
          case 'suspicious_objects_detected':
            addViolation(`Unauthorized objects detected (${suspiciousLabels.join(", ") || "unknown"}) - remove any phones or materials`, 'critical', 'suspicious_objects');
            break;
          case 'suspicious_hand_movement':
            addViolation('Suspicious hand movement detected - keep hands visible', 'high', 'suspicious_movement');
            break;
          default:
            break;
        }
      });
    }

    // If critical risk level, flag exam immediately
    if (risk_level === 'critical') {
      console.warn('CRITICAL risk detected:', detection);
      addViolation('Critical malpractice indicators detected', 'critical', 'critical_risk');
    }
  }, [exam, examStage, addViolation, drawDetectionOverlay, shouldThrottle, logMonitoringEvent]);

  useEffect(() => {
    const handleResize = () => {
      if (latestDetection) {
        drawDetectionOverlay(latestDetection);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [latestDetection, drawDetectionOverlay]);

  useEffect(() => {
    if (!examLocked || lockCountdown <= 0) return undefined;
    if (lockCountdownRef.current) {
      clearInterval(lockCountdownRef.current);
    }
    lockCountdownRef.current = setInterval(() => {
      setLockCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => {
      if (lockCountdownRef.current) {
        clearInterval(lockCountdownRef.current);
        lockCountdownRef.current = null;
      }
    };
  }, [examLocked, lockCountdown]);

  useEffect(() => () => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    if (lockCountdownRef.current) {
      clearInterval(lockCountdownRef.current);
    }
  }, []);

  const initializeExam = useCallback(async () => {
    if (!examId || initializingRef.current) {
      if (!examId) {
        console.error('[EXAM PAGE] ERROR: No examId provided');
        console.error('[EXAM PAGE] Check:');
        console.error('  - localStorage proctorguard_exam_id:', localStorage.getItem('proctorguard_exam_id'));
        navigate(createPageUrl("Dashboard"));
      }
      return;
    }
    
    initializingRef.current = true;
    
    try {
      console.log('[EXAM PAGE] initializeExam: start with examId:', examId);
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const examData = await Exam.filter({ id: examId });
      if (!examData || examData.length === 0) {
        console.error('[EXAM PAGE] Exam not found for examId:', examId);
        navigate(createPageUrl("Dashboard"));
        initializingRef.current = false;
        return;
      }
      
      const examRecord = examData[0];
      setExam(examRecord);
      setTimeRemaining(examRecord.duration_minutes * 60);
      
      // Create exam session
      // Use the stored student identifier from login/verification
      const studentId = localStorage.getItem('proctorguard_student_id') || 
                       localStorage.getItem('proctorguard_credential_id') || 
                       "unknown_student";

      const sessionData = await ExamSession.create({
        exam_id: examId,
        student_id: studentId,
        status: "in_progress",
        start_time: new Date().toISOString(),
        answers: [],
        proctoring_data: {
          integrity_checks: [],
          flags: [],
          video_url: `encrypted_video_${Date.now()}.mp4`,
          detection_enabled: true
        }
      });
      setSession(sessionData);
      console.log('[EXAM PAGE] initializeExam: finished successfully');
      // Session created. QR code will be shown; wait for mobile confirmation
    } catch (error) {
      console.error("[EXAM PAGE] Error initializing exam:", error);
      if (error.response?.status === 429) {
        // Rate limit error - retry after delay
        setTimeout(() => {
          initializingRef.current = false;
          initializeExam();
        }, 2000);
      }
    } finally {
      initializingRef.current = false;
    }
  }, [examId, navigate]);

  const startMonitoring = useCallback(async () => {
    try {
      setMonitoringError("");
      console.log('[EXAM PAGE] Starting monitoring - requesting camera and audio...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: true
      });
      console.log('[EXAM PAGE] Stream acquired successfully:', {
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        console.log('[EXAM PAGE] Stream assigned to video element');
        
        // Log when video is ready
        videoRef.current.onloadedmetadata = () => {
          console.log('[EXAM PAGE] Video metadata loaded:', {
            width: videoRef.current.videoWidth,
            height: videoRef.current.videoHeight,
            readyState: videoRef.current.readyState
          });
        };
      }
      
      const hasVideo = stream.getVideoTracks().length > 0;
      const hasAudio = stream.getAudioTracks().length > 0;
      console.log('[EXAM PAGE] Stream validation:', { hasVideo, hasAudio });
      
      if (!hasVideo || !hasAudio) {
        console.error('[EXAM PAGE] Stream missing tracks:', { hasVideo, hasAudio });
        stream.getTracks().forEach(track => track.stop());
        recordingStreamRef.current = null;
        setCameraStatus(hasVideo ? "active" : "inactive");
        setAudioStatus(hasAudio ? "active" : "inactive");
        setMonitoringError("Camera and microphone must both be available.");
        setMonitoringBlocked(true);
        logSecurityEvent("monitoring_failed", { hasVideo, hasAudio }, "critical");
        addViolation("Camera/microphone unavailable", "critical", "media_missing");
        return null;
      }
      recordingStreamRef.current = stream;
      recorderChunkIndexRef.current = 0;
      setIsMonitoring(true);
      setCameraStatus("active");
      setAudioStatus("active");
      setMonitoringBlocked(false);
      logSecurityEvent("monitoring_started", { hasAudio: true, hasVideo: true });
      console.log('[EXAM PAGE] Monitoring started successfully');
      return stream;
    } catch (error) {
      console.error("[EXAM PAGE] Error starting monitoring:", error);
      console.error('[EXAM PAGE] Error details:', {
        name: error?.name,
        message: error?.message,
        toString: String(error)
      });
      setCameraStatus("inactive");
      setAudioStatus("inactive");
      setMonitoringError(`Camera and microphone access are required. Error: ${error?.message || 'Unknown error'}`);
      setMonitoringBlocked(true);
      logSecurityEvent("monitoring_failed", { message: error?.message || String(error) }, "critical");
      addViolation("Camera/microphone access blocked", "critical", "media_permission");
      return null;
    }
  }, [addViolation, logSecurityEvent]);

  const enterFullscreen = useCallback(() => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().then(() => {
        setIsFullscreen(true);
        setFullscreenWarning(false);
      }).catch(() => {
        setFullscreenWarning(true);
      });
    }
  }, []);

  const startRecording = useCallback((stream) => {
    if (!stream) {
      console.log('[EXAM PAGE] startRecording: No stream provided');
      return;
    }
    console.log('[EXAM PAGE] startRecording: Starting MediaRecorder');
    if (!window.MediaRecorder) {
      console.error('[EXAM PAGE] MediaRecorder not available');
      logSecurityEvent("recording_unavailable", { reason: "MediaRecorder not supported" }, "warning");
      return;
    }

    try {
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8,opus" });
      console.log('[EXAM PAGE] MediaRecorder created:', {
        state: recorder.state,
        mimeType: recorder.mimeType
      });
      
      recorder.ondataavailable = async (event) => {
        console.log('[EXAM PAGE] Recording chunk available:', event.data.size);
        if (!event.data || event.data.size === 0 || !session) return;
        const buffer = await event.data.arrayBuffer();
        const index = recorderChunkIndexRef.current++;
        sendEncryptedRecordingChunk(session.id, buffer, {
          index,
          ts: new Date().toISOString(),
          type: event.data.type || "video/webm"
        });
      };
      
      recorder.onerror = (event) => {
        console.error('[EXAM PAGE] Recording error:', event.error);
      };
      
      recorder.start(5000);
      console.log('[EXAM PAGE] MediaRecorder started');
      recorderRef.current = recorder;
      logSecurityEvent("recording_started");
    } catch (err) {
      console.error('[EXAM PAGE] Error starting recording:', err);
      logSecurityEvent("recording_error", { message: err?.message || String(err) }, "warning");
    }
  }, [logSecurityEvent, session]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current) {
      try {
        if (recorderRef.current.state !== "inactive") {
          recorderRef.current.stop();
        }
      } catch (err) {
        console.warn("Failed to stop recorder", err);
      }
      recorderRef.current = null;
      logSecurityEvent("recording_stopped");
    }
  }, [logSecurityEvent]);

  const startAudioMonitor = useCallback((stream) => {
    if (!stream) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      const data = new Uint8Array(analyser.fftSize);
      let loudCount = 0;

      audioIntervalRef.current = setInterval(() => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) {
          const val = (data[i] - 128) / 128;
          sum += val * val;
        }
        const rms = Math.sqrt(sum / data.length);

        if (rms > 0.12) {
          loudCount += 1;
        } else {
          loudCount = 0;
        }

        if (loudCount >= 3) {
          loudCount = 0;
          addViolation("Background noise detected", "high", "audio_anomaly");
          logSecurityEvent("audio_anomaly", { rms });
        }
      }, 1000);

      audioContextRef.current = ctx;
      logSecurityEvent("audio_monitoring_started");
    } catch (err) {
      logSecurityEvent("audio_monitoring_failed", { message: err?.message || String(err) }, "warning");
    }
  }, [addViolation, logSecurityEvent]);

  const stopAudioMonitor = useCallback(() => {
    if (audioIntervalRef.current) {
      clearInterval(audioIntervalRef.current);
      audioIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    logSecurityEvent("audio_monitoring_stopped");
  }, [logSecurityEvent]);

  const handleMonitoringRetry = useCallback(async () => {
    const stream = await startMonitoring();
    if (stream) {
      startRecording(stream);
      startAudioMonitor(stream);
      setMonitoringBlocked(false);
    }
  }, [startMonitoring, startRecording, startAudioMonitor]);

  const beginExamFlow = useCallback(async () => {
    // Called when exam stage begins to start monitoring and detection
    try {
      console.log('[EXAM PAGE] beginExamFlow: starting monitoring and detection');
      logSecurityEvent("exam_started", { stage: "exam" });
      logSecurityEvent("environment", {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        deviceMemory: navigator.deviceMemory || null,
        hardwareConcurrency: navigator.hardwareConcurrency || null,
        screen: {
          width: window.screen?.width || null,
          height: window.screen?.height || null,
          pixelRatio: window.devicePixelRatio || null
        },
        vmHint: /vmware|virtualbox|qemu|xen|hyper-v|parallels/i.test(navigator.userAgent)
      });
      
      // Start local media monitoring (fullscreen is triggered by user button click)
      console.log('[EXAM PAGE] Step 1: Starting monitoring...');
      const stream = await startMonitoring();
      if (!stream) {
        console.error('[EXAM PAGE] Failed to get stream from startMonitoring');
        return;
      }
      console.log('[EXAM PAGE] Step 1 complete: Stream obtained');

      console.log('[EXAM PAGE] Step 2: Starting recording...');
      startRecording(stream);
      console.log('[EXAM PAGE] Step 2 complete: Recording started');
      
      console.log('[EXAM PAGE] Step 3: Starting audio monitor...');
      startAudioMonitor(stream);
      console.log('[EXAM PAGE] Step 3 complete: Audio monitor started');

      // Initialize detection service now that camera is confirmed
      try {
        console.log('[EXAM PAGE] Step 4: Checking detection service health...');
        const isAvailable = await detectionService.checkHealth();
        console.log('[EXAM PAGE] Detection service available:', isAvailable);
        
        if (isAvailable) {
          console.log('[EXAM PAGE] Malpractice detection service available');
          if (videoRef.current && session) {
            console.log('[EXAM PAGE] Step 5: Initializing detection with sessionId:', session.id);
            await detectionService.initializeWebcam(videoRef.current, session.id, stream);
            console.log('[EXAM PAGE] Step 5 complete: Webcam initialized');
            
            console.log('[EXAM PAGE] Step 6: Starting detection...');
            detectionService.startDetection((detection) => {
              console.log('[EXAM PAGE] Detection result received:', detection);
              handleDetectionResult(detection);
            });
            console.log('[EXAM PAGE] Step 6 complete: Detection started');
          } else {
            console.warn('[EXAM PAGE] videoRef or session missing:', { videoRef: !!videoRef.current, session: !!session });
          }
        } else {
          console.warn('[EXAM PAGE] Malpractice detection service not available - local monitoring only');
        }
      } catch (error) {
        console.warn('[EXAM PAGE] Could not initialize detection service:', error);
      }
      
      console.log('[EXAM PAGE] beginExamFlow complete');
    } catch (e) {
      console.error('[EXAM PAGE] Error beginning exam flow:', e);
    }
  }, [startMonitoring, startRecording, startAudioMonitor, handleDetectionResult, session, logSecurityEvent]);

  const waitForMobileActive = useCallback(async (sessionId, attempts = 6, intervalMs = 1000) => {
    const API_BASE = import.meta.env.VITE_DETECTION_API_URL || 'http://localhost:5000/api/v1';
    for (let i = 0; i < attempts; i++) {
      try {
        const res = await fetch(`${API_BASE}/mobile/status?session_id=${encodeURIComponent(sessionId)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.status === 'active') return true;
        }
      } catch (error) {
        // ignore
        console.error(error);
      }
      await new Promise(r => setTimeout(r, intervalMs));
    }
    return false;
  }, []);
  const handleMobileConfirm = useCallback(async () => {
    if (!session) {
      // no session yet; can't confirm
      setExamStage('fullscreen');
      setMobileConfirmed(true);
      logSecurityEvent("mobile_confirmed", { status: "unknown_session" });
      return;
    }

    // Wait briefly for mobile page to register with backend
    const active = await waitForMobileActive(session.id, 8, 1000);
    if (active) {
      setExamStage('fullscreen');
      setMobileConfirmed(true);
      logSecurityEvent("mobile_confirmed", { status: "active" });
    } else {
      // Proceed but warn user
      setExamStage('fullscreen');
      setMobileConfirmed(true);
      logSecurityEvent("mobile_confirmed", { status: "inactive" }, "warning");
      console.warn('Mobile camera did not report active status; proceeding anyway');
    }
  }, [session, waitForMobileActive, logSecurityEvent]);

  const handleFullscreenChange = useCallback(() => {
    const isCurrentlyFullscreen = !!document.fullscreenElement || !!document.webkitFullscreenElement;
    setIsFullscreen(isCurrentlyFullscreen);
    
    // Only enforce fullscreen during active exam stage
    if (!isCurrentlyFullscreen && examStage === 'exam') {
      console.log('Fullscreen exit detected during exam - activating lock');
      setFullscreenWarning(true);
      activateLock("Fullscreen mode is required during the exam. Please re-enter fullscreen to continue.", "fullscreen", 0);
      addViolation("Exited fullscreen mode during exam", "high", "fullscreen_exit");
      logSecurityEvent("fullscreen_exit", {}, "high");
      showToast("Fullscreen exit detected - Exam paused", "warning");
    }
    
    if (isCurrentlyFullscreen && examStage === 'exam') {
      console.log('Fullscreen restored');
      setFullscreenWarning(false);
      if (lockType === "fullscreen") {
        clearLock();
        showToast("Fullscreen restored - Exam resumed", "success");
      }
    }
  }, [examStage, addViolation, logSecurityEvent, activateLock, showToast, lockType, clearLock, setFullscreenWarning]);

  const handleVisibilityChange = useCallback(() => {
    if (document.hidden && exam && examStage === 'exam') {
      if (!shouldThrottle("visibility_violation", 1000)) {
        setFocusViolationCount(prev => prev + 1);
        setTabSwitchCount(prev => prev + 1);
        activateLock("Tab switch detected. Return to the exam to continue.", "tab", 5);
        addViolation("Tab switched or window minimized during exam", "critical", "tab_switch");
        logSecurityEvent("tab_switch", { type: "visibility" }, "critical");
        showToast("Tab switch detected - Violation recorded", "warning");
      }
      return;
    }
    if (!document.hidden && lockType === "tab" && examStage === 'exam') {
      clearLock();
      showToast("Exam resumed", "success");
    }
  }, [exam, examStage, addViolation, logSecurityEvent, activateLock, showToast, lockType, clearLock, shouldThrottle]);

  const handleWindowBlur = useCallback(() => {
    if (examStage !== 'exam') return;
    if (!shouldThrottle("window_blur_violation", 1000)) {
      setFocusViolationCount(prev => prev + 1);
      setTabSwitchCount(prev => prev + 1);
      activateLock("Window focus lost. Return to the exam to continue.", "tab", 5);
      addViolation("Window focus lost during exam", "critical", "window_blur");
      logSecurityEvent("window_blur", {}, "critical");
      showToast("Tab switch detected - Violation recorded", "warning");
    }
  }, [examStage, addViolation, logSecurityEvent, activateLock, showToast, shouldThrottle]);

  const handleWindowFocus = useCallback(() => {
    if (examStage !== 'exam') return;
    if (!document.hidden && lockType === "tab") {
      clearLock();
      showToast("Exam resumed", "success");
    }
  }, [examStage, lockType, clearLock, showToast]);

  const handleRestrictedKey = useCallback((e) => {
    if (examStage !== 'exam') return;

    const targetTag = e.target?.tagName?.toLowerCase();
    const isTypingField = targetTag === 'input' || targetTag === 'textarea';

    const key = e.key;
    const lower = key.toLowerCase();
    const isCtrl = e.ctrlKey || e.metaKey;
    const isAlt = e.altKey;
    const isShift = e.shiftKey;
    const isModifierPressed = isCtrl || isAlt;

    const blockedKeys = new Set([
      "Escape",
      "Tab",
      "Meta",
      "OS",
      "PrintScreen",
      "F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12"
    ]);

    const blockedCombos = [
      isAlt && key === "Tab",
      isCtrl && key === "Tab",
      isCtrl && isShift && key === "Tab",
      isAlt && key === "F4",
      isCtrl && lower === "c",
      isCtrl && lower === "v",
      isCtrl && lower === "x",
      isCtrl && lower === "s",
      isCtrl && lower === "p",
      isCtrl && lower === "u",
      isCtrl && lower === "a",
      isCtrl && lower === "r",
      isCtrl && lower === "t",
      isCtrl && lower === "n",
      isCtrl && lower === "w",
      isCtrl && isShift && (lower === "i" || lower === "j" || lower === "c")
    ];

    const isAlwaysBlocked = key === "Escape" || key === "Tab";
    const isBlocked = blockedKeys.has(key) || blockedCombos.some(Boolean) || isModifierPressed;
    
    if ((isAlwaysBlocked || isBlocked) && (!isTypingField || isAlwaysBlocked || isModifierPressed)) {
      e.preventDefault();
      e.stopPropagation();
      
      // Handle Escape key - force fullscreen
      if (key === "Escape") {
        setEscPressCount(prev => prev + 1);
        activateLock("Fullscreen mode is required during the exam. Please re-enter fullscreen to continue.", "fullscreen", 8);
        enterFullscreen();
        addViolation("Pressed Escape key - attempting to exit fullscreen", "high", "escape_key");
        logSecurityEvent("escape_key", {}, "high");
        showToast("Escape key is disabled during the exam", "warning");
      }
      
      // Handle Tab key - record violation
      if (key === "Tab") {
        addViolation("Pressed Tab key during exam", "high", "tab_key");
        logSecurityEvent("tab_key", {}, "high");
        showToast("Tab key is disabled during the exam", "warning");
      }
      
      // Record shortcut violations
      if (!shouldThrottle("shortcut", 1200)) {
        setShortcutViolationCount(prev => prev + 1);
        addViolation(`Blocked shortcut: ${key}`, "high", "shortcut");
        logSecurityEvent("shortcut_blocked", { key, ctrl: isCtrl, alt: isAlt, shift: isShift }, "high");
        showToast("Keyboard shortcuts are disabled during the exam.", "warning");
      }
    }
  }, [examStage, addViolation, logSecurityEvent, shouldThrottle, activateLock, enterFullscreen, showToast]);

  useEffect(() => {
    if (examStage !== 'exam') return;

    const ensureExamRoute = () => {
      if (!window.location.hash.includes("/Exam")) {
        window.location.hash = `#/Exam?examId=${examId}`;
      }
    };

    const handlePopState = () => {
      ensureExamRoute();
      addViolation("Navigation attempt detected", "high", "nav_back");
      logSecurityEvent("nav_back", { hash: window.location.hash }, "high");
    };

    const handleHashChange = () => {
      ensureExamRoute();
    };

    window.history.pushState({ exam_lock: true }, "", window.location.href);
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [examStage, examId, addViolation, logSecurityEvent]);

  const handleContextMenu = useCallback((e) => {
    if (examStage !== 'exam') return;
    e.preventDefault();
    if (!shouldThrottle("contextmenu", 1500)) {
      addViolation("Right-click blocked", "medium", "context_menu");
      logSecurityEvent("context_menu", {}, "medium");
      showToast("Suspicious activity detected. Please stay focused on the exam.", "warning");
    }
  }, [examStage, addViolation, logSecurityEvent, shouldThrottle, showToast]);

  const handleSelection = useCallback((e) => {
    if (examStage !== 'exam') return;
    e.preventDefault();
    if (!shouldThrottle("selection", 1500)) {
      addViolation("Text selection blocked", "medium", "selection");
      logSecurityEvent("selection_blocked", {}, "medium");
      showToast("Suspicious activity detected. Please stay focused on the exam.", "warning");
    }
  }, [examStage, addViolation, logSecurityEvent, shouldThrottle, showToast]);

  const handleClipboardEvent = useCallback((e) => {
    if (examStage !== 'exam') return;
    e.preventDefault();
    if (!shouldThrottle("clipboard", 1500)) {
      addViolation("Copy/paste blocked", "high", "clipboard");
      logSecurityEvent("clipboard_blocked", { type: e.type }, "high");
      showToast("Keyboard shortcuts are disabled during the exam.", "warning");
    }
  }, [examStage, addViolation, logSecurityEvent, shouldThrottle, showToast]);

  const handleDragStart = useCallback((e) => {
    if (examStage !== 'exam') return;
    e.preventDefault();
    if (!shouldThrottle("drag", 1500)) {
      addViolation("Drag action blocked", "medium", "drag" );
      logSecurityEvent("drag_blocked", {}, "medium");
      showToast("Suspicious activity detected. Please stay focused on the exam.", "warning");
    }
  }, [examStage, addViolation, logSecurityEvent, shouldThrottle, showToast]);

  const trackKeystroke = useCallback((e) => {
    if (!exam || examStage !== 'exam') return;

    // Detect copy-paste shortcuts
    if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'v')) {
      addViolation(`Copy-paste shortcut detected: ${e.key === 'c' ? 'Copy' : 'Paste'}`, "high", "copy_paste");
    }

    // Track key down time
    if (e.type === 'keydown' && !e.repeat) {
      setKeyDownTime(prev => ({
        ...prev,
        [e.key]: Date.now()
      }));
    }

    // Track key up and calculate duration
    if (e.type === 'keyup') {
      const downTime = keyDownTime[e.key];
      if (downTime) {
        const duration = Date.now() - downTime;
        const keystroke = {
          timestamp: new Date().toISOString(),
          key: e.key.length === 1 ? e.key : '[special]',
          duration,
          question_index: currentQuestion
        };
        
        setKeystrokeData(prev => [...prev, keystroke]);
        
        setKeyDownTime(prev => {
          const newData = { ...prev };
          delete newData[e.key];
          return newData;
        });
      }
    }
  }, [exam, examStage, currentQuestion, keyDownTime, addViolation]);

  const trackMouseMovement = useCallback((e) => {
    if (!exam || examStage !== 'exam') return;

    // Sample mouse data (every 2 seconds to avoid too much data)
    const now = Date.now();
    const lastMouseTrack = mouseData[mouseData.length - 1];
    
    if (!lastMouseTrack || now - new Date(lastMouseTrack.timestamp).getTime() > 2000) {
      const mouseEvent = {
        timestamp: new Date().toISOString(),
        x: e.clientX,
        y: e.clientY,
        event_type: e.type
      };
      
      setMouseData(prev => [...prev.slice(-50), mouseEvent]); // Keep last 50 events
    }
  }, [exam, examStage, mouseData]);

  const _terminateExam = useCallback(() => {
    if (session) {
      ExamSession.update(session.id, {
        status: "terminated",
        end_time: new Date().toISOString(),
        proctoring_data: {
          ...session.proctoring_data,
          flags: flags
        }
      }).catch(err => console.error("Error terminating exam:", err));
    }
    navigate(createPageUrl("Dashboard"));
  }, [session, flags, navigate]);

  const handleIntegrityCheckFail = useCallback(() => {
    setShowIntegrityCheck(false);
    addViolation("Failed integrity check - did not show hands within time limit", "critical");
  }, [addViolation]);

  const [_monitoringScans, setMonitoringScans] = useState({
    faceDetection: 'scanning',
    multiplePersons: 'scanning',
    phoneDetection: 'scanning',
    audioMonitoring: 'scanning',
    screenActivity: 'scanning'
  });

  const triggerIntegrityCheck = useCallback(() => {
    setShowIntegrityCheck(true);
    setIntegrityTimer(30);
    
    const countdown = setInterval(() => {
      setIntegrityTimer(prev => {
        if (prev <= 1) {
          clearInterval(countdown);
          handleIntegrityCheckFail();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [handleIntegrityCheckFail]);


  const submitExam = useCallback(async (autoSubmit = false) => {
    try {
      console.log('submitExam called:', { autoSubmit, violationCount, timeRemaining });
      logSecurityEvent("exam_submit", { autoSubmit, violationCount, timeRemaining });
      
      // Stop detection service
      try {
        detectionService.stopDetection();
      } catch (error) {
        console.warn("Error stopping detection service:", error);
      }

      stopRecording();
      stopAudioMonitor();

      // Stop camera stream
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }

      const answersArray = Object.entries(answers).map(([questionIndex, data]) => ({
        question_index: parseInt(questionIndex),
        answer: data.answer,
        timestamp: data.timestamp
      }));

      const totalQuestions = exam?.questions?.length || 0;
      const answeredQuestions = answersArray.length;
      const mockScore = Math.floor((answeredQuestions / totalQuestions) * 100);

      if (session) {
        await ExamSession.update(session.id, {
          status: violationCount >= 3 || autoSubmit ? "flagged" : (flags.length > 0 ? "flagged" : "completed"),
          student_id: session.student_id || session.studentId || null,
          end_time: new Date().toISOString(),
          answers: answersArray,
          score: mockScore,
          proctoring_data: {
            ...session.proctoring_data,
            flags: flags,
            auto_submitted: autoSubmit,
            total_violations: violationCount,
            keystroke_data: keystrokeData,
            mouse_data: mouseData
          }
        });
      }

      if (document.fullscreenElement) {
        document.exitFullscreen();
      }

      localStorage.removeItem('proctorguard_exam_lock');
      window.dispatchEvent(new Event('proctorguard_exam_lock'));

      navigate(createPageUrl("ExamComplete"));
    } catch (error) {
      console.error("Error submitting exam:", error);
    }
  }, [answers, exam, session, flags, navigate, violationCount, timeRemaining, keystrokeData, mouseData, stopRecording, stopAudioMonitor, logSecurityEvent]);

  useEffect(() => {
    if (examStage !== "exam") return;
    // Trigger auto-submit after 2 focus violations (tab switches)
    if (focusViolationCount >= 2) {
      console.log('Auto-submit triggered - 2 focus violations reached');
      addViolation("Repeated focus loss detected - exam being auto-submitted", "critical", "focus_loss_final");
      showToast("Auto-submitting exam due to repeated tab switches...", "warning");
      setTimeout(() => submitExam(true), 2000);
    }
  }, [focusViolationCount, examStage, submitExam, addViolation, showToast]);

  // Auto-submit after 3 violations
  useEffect(() => {
    if (examStage === 'exam' && violationCount >= 3) {
      console.log('Auto-submit triggered - 3 violations reached');
      showToast("Auto-submitting exam due to violations...", "warning");
      
      const autoSubmitTimer = setTimeout(() => {
        submitExam(true);
      }, 3000); // Reduced from 5 to 3 seconds
      
      return () => clearTimeout(autoSubmitTimer);
    }
  }, [examStage, violationCount, submitExam, showToast]);

  useEffect(() => {
    if (examStage !== 'exam') return;

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
      addViolation("Refresh or close attempt detected", "high", "before_unload");
      logSecurityEvent("refresh_attempt", {}, "high");
    };

    const devtoolsCheck = () => {
      const widthDiff = Math.abs(window.outerWidth - window.innerWidth);
      const heightDiff = Math.abs(window.outerHeight - window.innerHeight);
      if (widthDiff > 160 || heightDiff > 160) {
        if (!shouldThrottle("devtools", 5000)) {
          addViolation("Developer tools detected", "critical", "devtools");
          logSecurityEvent("devtools_detected", { widthDiff, heightDiff }, "critical");
          showToast("Suspicious activity detected. Please stay focused on the exam.", "warning");
        }
      }
    };

    devtoolsIntervalRef.current = setInterval(devtoolsCheck, 2000);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("focus", handleWindowFocus);

    const previousSelect = document.body.style.userSelect;
    const previousPointer = document.body.style.webkitUserSelect;
    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";

    return () => {
      if (devtoolsIntervalRef.current) {
        clearInterval(devtoolsIntervalRef.current);
        devtoolsIntervalRef.current = null;
      }
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("focus", handleWindowFocus);
      document.body.style.userSelect = previousSelect;
      document.body.style.webkitUserSelect = previousPointer;
    };
  }, [examStage, addViolation, logSecurityEvent, shouldThrottle, showToast, handleWindowFocus]);

  useEffect(() => {
    if (examId && !exam) {
      const currentVideo = videoRef.current;
      console.log('Main initialization effect - examId:', examId);
      initializeExam();
      // Do not auto-start monitoring or request fullscreen here — must be user-initiated.
      
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('blur', handleWindowBlur);
      document.addEventListener('keydown', trackKeystroke);
      document.addEventListener('keyup', trackKeystroke);
      document.addEventListener('keydown', handleRestrictedKey, true);
      document.addEventListener('contextmenu', handleContextMenu, true);
      document.addEventListener('copy', handleClipboardEvent, true);
      document.addEventListener('cut', handleClipboardEvent, true);
      document.addEventListener('paste', handleClipboardEvent, true);
      document.addEventListener('selectstart', handleSelection, true);
      document.addEventListener('dragstart', handleDragStart, true);
      document.addEventListener('mousemove', trackMouseMovement);
      document.addEventListener('click', trackMouseMovement);

      return () => {
        // Stop detection service on cleanup
        try {
          detectionService.stopDetection();
        } catch (error) {
          console.warn("Error stopping detection service on cleanup:", error);
        }

        stopRecording();
        stopAudioMonitor();

        // Stop camera stream
        if (currentVideo && currentVideo.srcObject) {
          const tracks = currentVideo.srcObject.getTracks();
          tracks.forEach(track => track.stop());
          currentVideo.srcObject = null;
        }
        recordingStreamRef.current = null;
        setCameraStatus("inactive");
        setAudioStatus("inactive");

        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('blur', handleWindowBlur);
        document.removeEventListener('keydown', trackKeystroke);
        document.removeEventListener('keyup', trackKeystroke);
        document.removeEventListener('keydown', handleRestrictedKey, true);
        document.removeEventListener('contextmenu', handleContextMenu, true);
        document.removeEventListener('copy', handleClipboardEvent, true);
        document.removeEventListener('cut', handleClipboardEvent, true);
        document.removeEventListener('paste', handleClipboardEvent, true);
        document.removeEventListener('selectstart', handleSelection, true);
        document.removeEventListener('dragstart', handleDragStart, true);
        document.removeEventListener('mousemove', trackMouseMovement);
        document.removeEventListener('click', trackMouseMovement);
      };
    }
  }, [examId, exam, initializeExam, startMonitoring, enterFullscreen, handleFullscreenChange, handleVisibilityChange, handleWindowBlur, handleRestrictedKey, handleContextMenu, handleClipboardEvent, handleSelection, handleDragStart, trackKeystroke, trackMouseMovement, stopRecording, stopAudioMonitor]);

  useEffect(() => {
    const isCurrentlyFullscreen = !!document.fullscreenElement || !!document.webkitFullscreenElement;
    setIsFullscreen(isCurrentlyFullscreen);
  }, [examStage]);

  // Separate effect for integrity checks - only run when exam is loaded
  useEffect(() => {
    if (!exam || examStage !== 'exam') return;

    // Random integrity checks
    integrityIntervalRef.current = setInterval(() => {
      if (Math.random() < 0.3) {
        triggerIntegrityCheck();
      }
    }, 120000);

    return () => {
      if (integrityIntervalRef.current) clearInterval(integrityIntervalRef.current);
    };
  }, [exam, examStage, triggerIntegrityCheck]);

  const handleIntegrityCheckPass = useCallback(() => {
    setShowIntegrityCheck(false);
    if (session) {
      const updatedChecks = [
        ...(session.proctoring_data?.integrity_checks || []),
        {
          timestamp: new Date().toISOString(),
          type: "hand_verification",
          result: "passed"
        }
      ];
      
      // Debounce this update
      setTimeout(() => {
        ExamSession.update(session.id, {
          proctoring_data: {
            ...session.proctoring_data,
            integrity_checks: updatedChecks
          }
        }).catch(err => console.error("Error updating integrity check:", err));
      }, 500);
    }
  }, [session]);

  const handleAnswerChange = (questionIndex, answer) => {
    setAnswers(prev => ({
      ...prev,
      [questionIndex]: {
        answer,
        timestamp: new Date().toISOString()
      }
    }));
  };

  if (!exam) {
    return (
      <div className="exam-loading">
        <div className="exam-loading-spinner"></div>
        <p>Loading exam...</p>
      </div>
    );
  }

  // Stage 1: QR Code Scanner
  if (examStage === 'qr') {
    return (
      <ExamErrorBoundary>
        <div className="exam-container exam-stage exam-stage-qr">
          <QRCodeDisplay
            sessionId={session?.id}
            onConfirm={handleMobileConfirm}
          />
        </div>
      </ExamErrorBoundary>
    );
  }

  // Stage 2: Fullscreen Requirement (also shown if user exits fullscreen during exam)
  if (!isFullscreen && (examStage === 'fullscreen' || examStage === 'exam')) {
    return (
      <ExamErrorBoundary>
        <div className="exam-container exam-stage exam-stage-fullscreen">
          <Card className="exam-stage-card">
            <CardHeader>
              <CardTitle className="exam-stage-title flex items-center gap-2">
                <Maximize className="w-5 h-5 text-yellow-500" />
                Fullscreen Mode Required
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="exam-stage-text">
                For the security and integrity of this exam, you must enter fullscreen mode. Your entire screen will be dedicated to the exam.
              </p>
              <div className="exam-stage-warning">
                <p className="text-sm font-semibold">
                  ⚠️ You must remain in fullscreen mode throughout the entire exam. Exiting will be recorded as a violation.
                </p>
              </div>
              <Button 
                onClick={() => {
                  enterFullscreen();
                  // Start exam flow after fullscreen when needed
                  if (examStage !== 'exam') {
                    setTimeout(() => {
                      setExamStage('exam');
                      beginExamFlow();
                    }, 100);
                  }
                }} 
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <Maximize className="w-4 h-4 mr-2" />
                Enable Fullscreen & Begin Exam
              </Button>
            </CardContent>
          </Card>
        </div>
      </ExamErrorBoundary>
    );
  }

  // Stage 3: Exam
  if (examStage !== 'exam') {
    // Only render exam UI when in exam stage
    return null;
  }

  const question = exam.questions?.[currentQuestion];
  const totalQuestions = exam.questions?.length || 0;
  const isAnswered = (index) => {
    const entry = answers[index];
    if (!entry) return false;
    const value = entry.answer;
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim().length > 0;
    return true;
  };
  const answeredCount = Object.keys(answers).filter((index) => isAnswered(Number(index))).length;
  const overallProgress = totalQuestions ? Math.round((answeredCount / totalQuestions) * 100) : 0;
  const _questionProgress = totalQuestions ? Math.round(((currentQuestion + 1) / totalQuestions) * 100) : 0;

  return (
    <ExamErrorBoundary>
    <div className={`exam-container ${examLocked ? "exam-is-locked" : ""}`}>
      {toast && (
        <div className={`exam-toast exam-toast-${toast.tone}`}>
          <AlertCircle className="w-4 h-4" />
          <span>{toast.message}</span>
        </div>
      )}
      {/* Critical Violation Alert - Shows when 3 violations reached */}
      {violationCount >= 3 && (
        <div className="exam-violation-alert">
          <div className="exam-violation-content">
            <Alert className="bg-red-800 border-red-600 text-white shadow-2xl">
              <AlertOctagon className="h-8 w-8 text-red-200" />
              <AlertDescription>
                <div className="space-y-4">
                  <h3 className="text-2xl font-bold text-red-100">EXAM TERMINATION WARNING</h3>
                  <p className="text-red-200 text-lg">
                    You have accumulated {violationCount} violations. Your exam is being automatically submitted due to multiple malpractice detections.
                  </p>
                  <div className="bg-red-900/50 rounded-lg p-4 space-y-2">
                    <p className="font-semibold text-red-100">Detected Violations:</p>
                    {flags.slice(-3).map((flag, index) => (
                      <div key={index} className="flex items-center gap-2 text-red-200">
                        <XCircle className="w-4 h-4" />
                        <span className="text-sm">{flag.reason}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-red-100 font-semibold">Submitting exam in 5 seconds...</p>
                  <div className="w-full bg-red-700 rounded-full h-2">
                    <div className="bg-red-300 h-2 rounded-full animate-pulse" style={{width: '100%'}}></div>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      )}

      {/* Real-time Violation Alert */}
      {showViolationAlert && currentViolation && violationCount < 3 && (
        <div className="fixed top-4 right-4 z-[9998] animate-in slide-in-from-right">
          <Alert variant={currentViolation.isWarning ? "default" : "destructive"} 
                 className={`${currentViolation.isWarning ? 'bg-yellow-900 border-yellow-600' : 'bg-red-900 border-red-600'} shadow-2xl min-w-[400px]`}>
            <AlertTriangle className={`h-5 w-5 ${currentViolation.isWarning ? 'text-yellow-200' : 'text-red-200'} animate-pulse`} />
            <AlertDescription>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className={`font-bold ${currentViolation.isWarning ? 'text-yellow-100' : 'text-red-100'}`}>
                    {currentViolation.isWarning ? '⚠️ MALPRACTICE WARNING' : '🚨 VIOLATION DETECTED'}
                  </h4>
                  {!currentViolation.isWarning && (
                    <Badge variant="destructive" className="bg-red-700">
                      {violationCount}/3
                    </Badge>
                  )}
                </div>
                <p className={`${currentViolation.isWarning ? 'text-yellow-200' : 'text-red-200'} font-semibold`}>
                  {currentViolation.reason}
                </p>
                {currentViolation.isWarning ? (
                  <p className="text-yellow-300 text-sm">
                    This is a warning. Repeated detection will count as a violation. {_warningCount}/2 warnings given.
                  </p>
                ) : (
                  <>
                    <p className="text-red-300 text-sm">
                      {violationCount === 1 && "First violation - 2 more will result in automatic submission"}
                      {violationCount === 2 && "Second violation - 1 more will result in automatic submission"}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 bg-red-800 rounded-full h-2">
                        <div 
                          className="bg-red-400 h-2 rounded-full transition-all duration-300" 
                          style={{width: `${(violationCount / 3) * 100}%`}}
                        ></div>
                      </div>
                      <span className="text-xs text-red-200">{3 - violationCount} remaining</span>
                    </div>
                  </>
                )}
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {examLocked && (
        <div className="exam-lock-overlay">
          <div className="exam-lock-modal">
            <div className="exam-lock-icon">
              <Maximize className="w-5 h-5" />
            </div>
            <h3>Exam Paused</h3>
            <p>{lockReason}</p>
            {lockCountdown > 0 && (
              <div className="exam-lock-countdown">
                Re-locking in <strong>{lockCountdown}s</strong>
              </div>
            )}
            <Button
              onClick={() => {
                if (lockType === "fullscreen") {
                  enterFullscreen();
                }
                if (lockType === "tab") {
                  clearLock();
                  showToast("Exam resumed", "success");
                }
              }}
              className="exam-lock-btn"
            >
              Enable Fullscreen Mode
            </Button>
          </div>
        </div>
      )}

      {/* Monitoring Blocked */}
      {monitoringBlocked && (
        <div className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center">
          <Alert className="max-w-md bg-slate-900/90 border-red-600">
            <AlertTriangle className="h-5 w-5 text-red-200" />
            <AlertDescription className="text-white">
              <h3 className="font-bold text-lg mb-2">Camera and Microphone Required</h3>
              <p className="mb-4">{monitoringError || "Enable camera and microphone to continue the exam."}</p>
              <Button onClick={handleMonitoringRetry} className="w-full bg-blue-600 hover:bg-blue-700">
                Retry Access
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Top Bar */}
      <div className="exam-header-new">
        <div className="exam-header-left">
          <Shield className="w-5 h-5 text-blue-600" />
          <h1 className="exam-header-title">{exam.title}</h1>
        </div>
        <div className="exam-header-right">
          <div className="exam-header-stat">
            <Clock className="w-4 h-4" />
            <ExamTimer 
              timeRemaining={timeRemaining}
              onTimeUp={() => {
                logSecurityEvent("time_up", { timeRemaining: 0 });
                submitExam(false);
              }}
              setTimeRemaining={setTimeRemaining}
            />
          </div>
          <div className={`exam-header-stat ${
            violationCount === 0 ? 'text-green-600' :
            violationCount >= 2 ? 'text-red-600' : 'text-orange-600'
          }`}>
            <AlertOctagon className="w-4 h-4" />
            <span>Violations: {violationCount}/3</span>
          </div>
          <div className="exam-header-stat text-green-600">
            <Eye className="w-4 h-4" />
            <span>Monitoring Active</span>
          </div>
        </div>
      </div>

      {violationCount > 0 && violationCount < 3 && (
        <div className="exam-warning-banner-new">
          <AlertTriangle className="w-4 h-4" />
          <span>{violationCount} violation(s) recorded. Further violations may auto-submit the exam.</span>
        </div>
      )}

      <div className="exam-main-layout-new">
        {/* Main Content */}
        <div className="exam-content-area-new">
          <div className="exam-question-card">
              {/* Question Header */}
              <div className="exam-question-header-new">
                <span className="exam-question-label">Question {currentQuestion + 1}</span>
                <span className="exam-question-marks">Marks: {question?.points || 1}</span>
              </div>

              {question && (
                <div className="exam-question-text-new">
                  <p>{question.question}</p>
                </div>
              )}

              {/* Answer Options */}
              {question && question.options && (
                <div className="exam-answer-options-new">
                  {question.options.map((option, idx) => {
                    const optionLabel = String.fromCharCode(65 + idx); // A, B, C, D
                    const isSelected = answers[currentQuestion]?.answer === option;
                    return (
                      <label 
                        key={idx} 
                        className={`exam-answer-option-new ${
                          isSelected ? 'exam-answer-option-selected' : ''
                        }`}
                      >
                        <input 
                          type="radio" 
                          name="answer" 
                          value={option} 
                          checked={isSelected}
                          onChange={(e) => handleAnswerChange(currentQuestion, e.target.value)}
                          className="exam-answer-radio-hidden"
                        />
                        <div className="exam-answer-option-marker">{optionLabel}</div>
                        <div className="exam-answer-option-text">{option}</div>
                      </label>
                    );
                  })}</div>
              )}

              {/* Action Bar */}
              <div className="exam-action-bar-new">
                <div className="exam-action-left">
                  <button 
                    className="exam-action-btn exam-action-btn-secondary"
                    onClick={() => {
                      setAnswers(prev => ({ ...prev, [currentQuestion]: null }));
                      showToast('Response cleared', 'success');
                    }}
                    type="button"
                  >
                    Clear Response
                  </button>
                  <button 
                    className="exam-action-btn exam-action-btn-secondary"
                    onClick={() => {
                      showToast('Marked for review', 'success');
                    }}
                    type="button"
                  >
                    Mark for Review
                  </button>
                </div>
                <div className="exam-action-right">
                  <button 
                    className="exam-action-btn exam-action-btn-secondary"
                    onClick={() => currentQuestion > 0 && setCurrentQuestion(currentQuestion - 1)}
                    disabled={currentQuestion === 0}
                    type="button"
                  >
                    ← Previous
                  </button>
                  <button 
                    className="exam-action-btn exam-action-btn-primary"
                    onClick={() => {
                      if (currentQuestion < totalQuestions - 1) {
                        setCurrentQuestion(currentQuestion + 1);
                      } else {
                        setShowSubmitConfirm(true);
                      }
                    }}
                    type="button"
                  >
                    {currentQuestion < totalQuestions - 1 ? 'Next →' : 'Submit'}
                  </button>
                </div>
              </div>
            </div>
          </div>

        {/* Right Sidebar */}
        <div className="exam-right-sidebar-new">
          {/* Candidate Info */}
          <div className="exam-candidate-card-new">
            <div className="exam-candidate-avatar-new">
              {exam?.title?.charAt(0) || 'C'}
            </div>
            <div className="exam-candidate-info-new">
              <div className="exam-candidate-name">Candidate Name</div>
              <div className="exam-candidate-id">ID: {session?.id?.slice(0, 12) || 'N/A'}</div>
            </div>
          </div>

          {/* Question Palette */}
          <div className="exam-palette-section-new">
            <h3 className="exam-palette-title-new">Question Palette</h3>
            <div className="exam-palette-legend-new">
              <div className="exam-palette-legend-item">
                <div className="exam-palette-legend-box exam-palette-answered"></div>
                <span>Answered</span>
              </div>
              <div className="exam-palette-legend-item">
                <div className="exam-palette-legend-box exam-palette-not-answered"></div>
                <span>Not Answered</span>
              </div>
              <div className="exam-palette-legend-item">
                <div className="exam-palette-legend-box exam-palette-review"></div>
                <span>Review</span>
              </div>
              <div className="exam-palette-legend-item">
                <div className="exam-palette-legend-box exam-palette-not-visited"></div>
                <span>Not Visited</span>
              </div>
            </div>
            <div className="exam-palette-grid-new">
              {Array.from({ length: totalQuestions }, (_, index) => {
                const answered = isAnswered(index);
                const isCurrent = index === currentQuestion;
                const visited = index <= currentQuestion;
                return (
                  <button
                    key={index}
                    className={`exam-palette-item-new ${
                      isCurrent ? 'exam-palette-current' : ''
                    } ${
                      answered ? 'exam-palette-answered' : !visited ? 'exam-palette-not-visited' : 'exam-palette-not-answered'
                    }`}
                    onClick={() => setCurrentQuestion(index)}
                    type="button"
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>
            <div className="exam-palette-summary">
              {answeredCount}/{totalQuestions} answered
            </div>
          </div>

          {/* Monitoring Panel */}
          <div className="exam-monitoring-panel-new">
            <h3 className="exam-monitoring-title-new">
              <Video className="w-4 h-4" />
              Live Monitoring
            </h3>
            
            <div className="exam-camera-feed-new">
              <video
                ref={videoRef}
                className="exam-camera-video-new"
                autoPlay
                playsInline
                muted
              />
              <canvas
                ref={overlayCanvasRef}
                className="exam-camera-overlay-new"
              />
              <div className={`exam-camera-status-new exam-camera-status-${
                monitoringStatus === 'malpractice' ? 'danger' :
                monitoringStatus === 'warning' ? 'warning' : 'normal'
              }`}>
                {monitoringStatus === 'normal' && <CheckCircle className="w-4 h-4" />}
                {monitoringStatus === 'warning' && <AlertTriangle className="w-4 h-4" />}
                {monitoringStatus === 'malpractice' && <AlertOctagon className="w-4 h-4" />}
                <span>
                  {monitoringStatus === 'malpractice' ? 'Malpractice' :
                   monitoringStatus === 'warning' ? 'Warning' : 'Normal'}
                </span>
              </div>
              {currentAlertMessage && (
                <div className="exam-camera-alert-msg-new">
                  {currentAlertMessage}
                </div>
              )}
            </div>

            {/* Event Log - Show Recent Violations */}
            <div className="exam-event-log-new">
              <div className="exam-event-log-header-new">
                <span>Recent Events</span>
                <span className="exam-event-log-count">{eventLog.length + flags.length}</span>
              </div>
              <div className="exam-event-log-list-new">
                {(eventLog.length === 0 && flags.length === 0) ? (
                  <p className="exam-event-log-empty">No events recorded.</p>
                ) : (
                  <>
                    {/* Show violations from flags first */}
                    {flags.slice(-3).reverse().map((flag, idx) => (
                      <div key={`flag-${idx}`} className="exam-event-log-item-new">
                        <div className="exam-event-icon-new exam-event-icon-danger">
                          <AlertOctagon className="w-3 h-3" />
                        </div>
                        <div className="exam-event-content-new">
                          <div className="exam-event-message-new">🚨 {flag.reason}</div>
                          <div className="exam-event-time-new">{new Date(flag.timestamp).toLocaleTimeString()}</div>
                        </div>
                      </div>
                    ))}
                    {/* Show other events */}
                    {eventLog.slice(-2).reverse().map((log, idx) => (
                      <div key={`log-${idx}`} className="exam-event-log-item-new">
                        <div className={`exam-event-icon-new exam-event-icon-${
                          log.severity === 'malpractice' ? 'danger' :
                          log.severity === 'warning' ? 'warning' : 'info'
                        }`}>
                          {log.severity === 'malpractice' && <AlertOctagon className="w-3 h-3" />}
                          {log.severity === 'warning' && <AlertTriangle className="w-3 h-3" />}
                          {log.severity === 'info' && <Info className="w-3 h-3" />}
                        </div>
                        <div className="exam-event-content-new">
                          <div className="exam-event-message-new">{log.message}</div>
                          <div className="exam-event-time-new">{new Date(log.timestamp).toLocaleTimeString()}</div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="exam-submit-bar">
        <div className="exam-submit-progress">
          <div className="exam-submit-progress-bar" style={{ width: `${overallProgress}%` }}></div>
        </div>
        <div className="exam-submit-meta">
          <div className="exam-submit-count">{answeredCount} of {totalQuestions} answered</div>
          <div className="exam-submit-hint">{overallProgress}% complete</div>
        </div>
        <Button
          onClick={() => setShowSubmitConfirm(true)}
          className="exam-submit-floating"
          disabled={violationCount >= 3}
        >
          <Send className="w-4 h-4 mr-2" />
          Submit Exam
        </Button>
      </div>

      {/* Integrity Check Modal */}
      <IntegrityCheck
        isOpen={showIntegrityCheck}
        timeRemaining={integrityTimer}
        onPass={handleIntegrityCheckPass}
        onFail={handleIntegrityCheckFail}
      />

      <Dialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <DialogContent className="exam-submit-dialog">
          <DialogHeader>
            <DialogTitle className="exam-submit-dialog-title">Confirm Exam Submission</DialogTitle>
          </DialogHeader>
          <div className="exam-submit-dialog-body">
            <p>You are about to submit your exam. This action cannot be undone.</p>
            <div className="exam-submit-dialog-stats">
              <div>
                <span>Answered</span>
                <strong>{answeredCount} / {totalQuestions}</strong>
              </div>
              <div>
                <span>Violations</span>
                <strong>{violationCount} / 3</strong>
              </div>
            </div>
          </div>
          <div className="exam-submit-dialog-actions">
            <Button variant="outline" onClick={() => setShowSubmitConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={() => { setShowSubmitConfirm(false); submitExam(false); }} className="exam-submit-confirm">
              Submit Now
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="exam-instructions-dialog">
          <DialogHeader>
            <DialogTitle className="exam-submit-dialog-title">Exam Instructions</DialogTitle>
          </DialogHeader>
          <div className="exam-instructions-body">
            <p>Please follow these monitoring rules throughout the exam:</p>
            <ul className="exam-instructions-list">
              <li>Keep your face clearly visible to the camera.</li>
              <li>Remain in fullscreen mode for the entire exam.</li>
              <li>Do not switch tabs or open new windows.</li>
              <li>No phones, notes, or external devices are allowed.</li>
              <li>Keep your hands visible and avoid suspicious movements.</li>
              <li>Mobile camera must remain active for environment monitoring.</li>
              <li>Repeated warnings will convert into violations.</li>
              <li>Three violations will automatically submit the exam.</li>
            </ul>
          </div>
          <div className="exam-submit-dialog-actions">
            <Button onClick={() => setShowInstructions(false)} className="exam-submit-confirm">
              I Understand
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
    </ExamErrorBoundary>
  );
}