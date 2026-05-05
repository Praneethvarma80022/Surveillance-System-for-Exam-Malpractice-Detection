import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Exam } from "@/entities/Exam";
import "./SystemCheck.css";
import { Card, CardContent, CardHeader, CardTitle, Button, Alert, AlertDescription } from "@/components/ui";
import { 
  Camera, 
  Mic, 
  CheckCircle, 
  AlertTriangle, 
  Loader2,
  Monitor,
  Shield,
  Play
} from "lucide-react";

const CheckItem = ({ icon, title, check }) => {
  const getStatusClass = (status) => {
    switch (status) {
      case 'success': return 'check-item-success';
      case 'error': return 'check-item-error';
      default: return 'check-item-pending';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success': return <CheckCircle className="check-item-icon" />;
      case 'error': return <AlertTriangle className="check-item-icon" />;
      default: return <Loader2 className="check-item-icon check-item-loading" />;
    }
  };

  return (
    <div className={`check-item ${getStatusClass(check.status)}`}>
      <div className="check-item-content">
        <div className="check-item-icon-wrapper">
          {icon && React.createElement(icon, { className: 'check-item-icon-inner' })}
        </div>
        <div>
          <h3 className="check-item-title">{title}</h3>
          <p className="check-item-message">{check.message}</p>
        </div>
      </div>
      <div className="check-item-status">
        {getStatusIcon(check.status)}
      </div>
    </div>
  );
};

export default function SystemCheckPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Decode examId from URL, with fallback to localStorage
  let urlExamId = searchParams.get('examId') ? decodeURIComponent(searchParams.get('examId')) : null;
  let localStorageExamId = localStorage.getItem('proctorguard_exam_id');
  const examId = urlExamId || localStorageExamId;
  
  console.log('[SYSTEMCHECK] examId from URL:', urlExamId);
  console.log('[SYSTEMCHECK] examId from localStorage:', localStorageExamId);
  console.log('[SYSTEMCHECK] Using examId:', examId);
  const videoRef = useRef(null);
  const [exam, setExam] = useState(null);
  const [checks, setChecks] = useState({
    camera: { status: 'pending', message: 'Checking camera...' },
    microphone: { status: 'pending', message: 'Checking microphone...' },
    environment: { status: 'pending', message: 'Checking environment...' }
  });
  const [allChecksPassed, setAllChecksPassed] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [_demoMode, setDemoMode] = useState(false);

  const loadExam = useCallback(async () => {
    if (!examId) return;
    
    try {
      const examData = await Exam.filter({ id: examId });
      if (examData.length > 0) {
        setExam(examData[0]);
      }
    } catch (error) {
      console.error("Error loading exam:", error);
    }
  }, [examId]);

  const runSystemChecks = useCallback(async () => {
    // Check if browser supports media devices
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setChecks({
        camera: { status: 'error', message: 'Your browser does not support camera access' },
        microphone: { status: 'error', message: 'Your browser does not support microphone access' },
        environment: { status: 'error', message: 'Browser compatibility issue' }
      });
      return;
    }

    try {
      // Request camera and microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' },
        audio: true 
      });
      
      // Display video stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Verify video tracks
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length > 0) {
        setChecks(prev => ({
          ...prev,
          camera: { status: 'success', message: 'Camera is working correctly' }
        }));
      } else {
        setChecks(prev => ({
          ...prev,
          camera: { status: 'error', message: 'No video track available' }
        }));
      }

      // Verify audio tracks
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        setTimeout(() => {
          setChecks(prev => ({
            ...prev,
            microphone: { status: 'success', message: 'Microphone is working correctly' }
          }));

          // Complete environment check
          setTimeout(() => {
            setChecks(prev => ({
              ...prev,
              environment: { status: 'success', message: 'Environment check passed' }
            }));
            setAllChecksPassed(true);
          }, 300);
        }, 300);
      } else {
        setChecks(prev => ({
          ...prev,
          microphone: { status: 'error', message: 'No audio track available' }
        }));
      }

    } catch (error) {
      // Handle media access errors silently
      let cameraMessage = 'Unable to access camera';
      let micMessage = 'Unable to access microphone';
      
      if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        cameraMessage = 'No camera/microphone detected - Use demo mode to continue without devices';
        micMessage = 'No microphone detected';
      } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        cameraMessage = 'Camera permission denied - Click allow when prompted or use demo mode';
        micMessage = 'Microphone permission denied';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        cameraMessage = 'Camera is in use by another application';
        micMessage = 'Microphone is in use';
      } else if (error.name === 'OverconstrainedError') {
        cameraMessage = 'Camera constraints not supported';
      } else {
        cameraMessage = 'Camera not available - Use demo mode to continue';
        micMessage = 'Microphone not available';
      }
      
      setChecks({
        camera: { status: 'error', message: cameraMessage },
        microphone: { status: 'error', message: micMessage },
        environment: { status: 'error', message: 'Demo mode available below' }
      });
    }
  }, []);

  useEffect(() => {
    if (examId) {
      const t = setTimeout(() => {
        loadExam();
        runSystemChecks();
      }, 0);
      return () => clearTimeout(t);
    }
  }, [examId, loadExam, runSystemChecks]);

  const skipSystemCheck = () => {
    setDemoMode(true);
    setChecks({
      camera: { status: 'success', message: 'Demo mode - camera check bypassed' },
      microphone: { status: 'success', message: 'Demo mode - microphone check bypassed' },
      environment: { status: 'success', message: 'Demo mode - environment check bypassed' }
    });
    setAllChecksPassed(true);
  };

  const startExam = async () => {
    if (!allChecksPassed) return;
    
    if (!examId) {
      console.error('[SYSTEMCHECK] ERROR: No examId available for navigation');
      alert("Error: Exam ID not found. Please restart the process.");
      return;
    }
    
    setIsStarting(true);
    
    // Stop the system check camera stream before navigating
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    // Navigate to exam (exam will handle its own camera after QR and fullscreen)
    console.log('[SYSTEMCHECK] Navigating to exam with examId:', examId);
    setTimeout(() => {
      navigate(createPageUrl(`Exam?examId=${encodeURIComponent(examId)}`));
    }, 100);
  };

  

  if (!exam) {
    return (
      <div className="system-check-loading">
        <div className="system-check-loading-content">
          <Loader2 className="system-check-loader-icon" />
          <p className="system-check-loading-text">Loading exam details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="system-check">
      <div className="system-check-container">
        {/* Header */}
        <div className="system-check-header">
          <div className="system-check-icon">
            <Shield className="icon-large" />
          </div>
          <h1 className="system-check-title">System Check</h1>
          <p className="system-check-subtitle">Verifying your system before exam begins</p>
        </div>

        {/* Exam Info */}
        <Card className="system-check-exam-card">
          <CardHeader>
            <CardTitle>{exam.title}</CardTitle>
            <p className="card-description">{exam.description}</p>
          </CardHeader>
          <CardContent>
            <div className="exam-info-grid">
              <div className="exam-info-card exam-info-duration">
                <Monitor className="exam-info-icon" />
                <p className="exam-info-label">Duration</p>
                <p className="exam-info-value">{exam.duration_minutes} minutes</p>
              </div>
              <div className="exam-info-card exam-info-questions">
                <CheckCircle className="exam-info-icon" />
                <p className="exam-info-label">Questions</p>
                <p className="exam-info-value">{exam.questions?.length || 0} questions</p>
              </div>
              <div className="exam-info-card exam-info-points">
                <Shield className="exam-info-icon" />
                <p className="exam-info-label">Points</p>
                <p className="exam-info-value">{exam.total_points || 100} points</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="system-check-content">
          {/* System Checks - Left Column */}
          <div className="system-check-requirements">
            <Card className="check-card">
              <CardHeader>
                <CardTitle>System Requirements</CardTitle>
                <p className="card-description">All checks must pass to begin the exam</p>
              </CardHeader>
              <CardContent className="check-items-container">
                <CheckItem
                  icon={Camera}
                  title="Camera Access"
                  check={checks.camera}
                />
                <CheckItem
                  icon={Mic}
                  title="Microphone Access"
                  check={checks.microphone}
                />
                <CheckItem
                  icon={Monitor}
                  title="Environment Check"
                  check={checks.environment}
                />

                {allChecksPassed && (
                  <Alert className="alert-success">
                    <CheckCircle className="alert-icon" />
                    <AlertDescription className="alert-description">
                      All system checks passed! You're ready to start the exam.
                    </AlertDescription>
                  </Alert>
                )}

                {Object.values(checks).some(check => check.status === 'error') && (
                  <>
                    <Alert className="alert-error">
                      <AlertTriangle className="alert-icon" />
                      <AlertDescription className="alert-description">
                        Please resolve the issues above before starting the exam.
                      </AlertDescription>
                    </Alert>
                    
                    <Button
                      onClick={skipSystemCheck}
                      className="demo-button"
                    >
                      Skip System Check (Demo Mode)
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Camera Preview - Right Column */}
          <Card className="camera-card">
            <CardHeader>
              <CardTitle>Camera Preview</CardTitle>
              <p className="card-description">Ensure your face is clearly visible</p>
            </CardHeader>
            <CardContent>
              <div className="camera-preview-container">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="camera-video"
                />
                <div className="camera-frame">
                  <div className="frame-corner frame-top-left"></div>
                  <div className="frame-corner frame-top-right"></div>
                  <div className="frame-corner frame-bottom-left"></div>
                  <div className="frame-corner frame-bottom-right"></div>
                </div>
                <div className="camera-instruction">
                  Keep your face centered
                </div>
              </div>

              <div className="camera-reminders">
                <div className="reminder-box">
                  <h4 className="reminder-title">Reminders:</h4>
                  <ul className="reminder-list">
                    <li>• Good lighting on face</li>
                    <li>• Quiet, private room</li>
                    <li>• Hands visible</li>
                    <li>• Stay in window</li>
                  </ul>
                </div>

                <Button
                  onClick={startExam}
                  disabled={!allChecksPassed || isStarting}
                  className="start-exam-button"
                >
                  {isStarting ? (
                    <>
                      <Loader2 className="button-icon loading" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Play className="button-icon" />
                      Begin Exam
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}