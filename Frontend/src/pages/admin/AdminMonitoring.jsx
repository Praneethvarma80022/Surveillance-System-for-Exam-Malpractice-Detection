import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Exam, ExamSession } from "@/entities/all";
import "./AdminMonitoring.css";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Input, Alert, AlertDescription } from "@/components/ui";
import { 
  Video, 
  AlertTriangle, 
  AlertCircle,
  Users, 
  Eye, 
  Shield, 
  Clock,
  Search,
  MessageCircle,
  Ban,
  Flag,
  Play,
  Volume2,
  Maximize,
  Lock,
  Key,
  Database,
  Camera,
  Calendar
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui";

export default function AdminMonitoringPage() {
  const navigate = useNavigate();
  const apiBase = import.meta.env.VITE_DETECTION_API_URL || 'http://localhost:5000/api/v1';
  const socketUrlBase = import.meta.env.VITE_DETECTION_SOCKET_URL || apiBase.replace('/api/v1', '');
  
  const [activeSessions, setActiveSessions] = useState([]);
  const [storedVideos, setStoredVideos] = useState([]);
  const [_selectedSession, _setSelectedSession] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [_isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [authCode, setAuthCode] = useState("");
  const [authError, setAuthError] = useState("");
  const [authenticatedVideos, setAuthenticatedVideos] = useState(new Set());
  
  // Live frame state: maps session_id -> annotated_frame_data_url
  const [sessionFrames, setSessionFrames] = useState({});
  const socketRef = useRef(null);
  const frameCounterRef = useRef({});

  // Universal authentication code for demo
  const DEMO_AUTH_CODE = "123456";

  const loadMonitoringData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [exams, sessions, recordingIndex] = await Promise.all([
        Exam.list(),
        ExamSession.list(),
        fetch(`${apiBase}/recordings/index`)
          .then(res => (res.ok ? res.json() : { sessions: {} }))
          .catch(() => ({ sessions: {} }))
      ]);

      const recordingsBySession = recordingIndex?.sessions || {};

      const activeExamSessions = sessions.filter(session => 
        session.status === 'in_progress' || session.status === 'flagged'
      ).map(session => {
        const exam = exams.find(e => e.id === session.exam_id);
        return {
          ...session,
          examTitle: exam?.title || 'Unknown Exam',
          studentName: `Student ${session.student_id?.slice(-4)}`, // Use slice for student name
          timeRemaining: Math.floor(Math.random() * 3600),
          violations: session.proctoring_data?.flags?.length || 0
        };
      });

      // Get stored videos from completed/flagged sessions
      const storedVideoData = sessions.filter(session => 
        (session.status === 'completed' || session.status === 'flagged') &&
        (session.proctoring_data?.video_url || (session.proctoring_data?.snapshots || []).length > 0)
      ).map((session) => {
        const exam = exams.find(e => e.id === session.exam_id);
        const startTime = new Date(session.start_time);
        const endTime = session.end_time ? new Date(session.end_time) : null;
        const durationMinutes = endTime ? Math.floor((endTime - startTime) / 60000) : 0;
        const recordingMeta = recordingsBySession[session.id] || null;
        const snapshotsArray = session.proctoring_data?.snapshots || [];
        
        // Log snapshot count for debugging
        if (snapshotsArray.length > 0) {
          console.log(`Session ${session.id} has ${snapshotsArray.length} snapshots`);
        }
        
        return {
          id: session.id,
          studentName: `Student ${session.student_id}`, // Use full student ID
          examTitle: exam?.title || 'Unknown Exam',
          recordedDate: startTime.toLocaleDateString(),
          duration: `${durationMinutes} min`,
          violations: session.proctoring_data?.flags?.length || 0,
          status: session.status,
          score: session.score || 0, // Add score, default to 0 if not present
          videoUrl: session.proctoring_data?.video_url, // Use actual video URL
          authKey: DEMO_AUTH_CODE, // Use consistent auth code
          hasRecording: Boolean(recordingMeta),
          recordingChunks: recordingMeta?.chunks || 0,
          downloadUrl: `${apiBase}/recordings/download?session_id=${encodeURIComponent(session.id)}`,
          snapshots: snapshotsArray
        };
      });

      setActiveSessions(activeExamSessions);
      setStoredVideos(storedVideoData);
    } catch (error) {
      console.error("Error loading monitoring data:", error);
    }
    setIsLoading(false);
  }, [apiBase]);

  const checkAuthAndLoadData = useCallback(async () => {
    const authStatus = localStorage.getItem('proctorguard_auth') === 'verified';
    const userRole = localStorage.getItem('proctorguard_role');
    
    if (!authStatus || userRole !== 'admin') {
      navigate(createPageUrl("Verification"));
      return;
    }
    
    await loadMonitoringData();
  }, [navigate, loadMonitoringData]);

  const generateRandomAlert = useCallback(() => {
    const alertTypes = [
      { type: 'face_not_detected', message: 'Face not detected for 15 seconds', severity: 'high' },
      { type: 'multiple_faces', message: 'Multiple faces detected in frame', severity: 'critical' },
      { type: 'suspicious_movement', message: 'Suspicious hand movements detected', severity: 'medium' },
      { type: 'audio_anomaly', message: 'Unusual audio patterns detected', severity: 'medium' },
      { type: 'browser_switch', message: 'Attempted to switch browser tabs', severity: 'high' }
    ];

    if (activeSessions.length > 0 && Math.random() < 0.3) {
      const randomSession = activeSessions[Math.floor(Math.random() * activeSessions.length)];
      const randomAlert = alertTypes[Math.floor(Math.random() * alertTypes.length)];
      
      const newAlert = {
        id: Date.now(),
        sessionId: randomSession.id,
        studentName: randomSession.studentName,
        examTitle: randomSession.examTitle,
        ...randomAlert,
        timestamp: new Date().toLocaleTimeString()
      };

      setAlerts(prev => [newAlert, ...prev.slice(0, 19)]);
    }
  }, [activeSessions]);

  useEffect(() => {
    const t = setTimeout(() => checkAuthAndLoadData(), 0);
    // Simulate real-time updates
    const interval = setInterval(() => {
      generateRandomAlert();
    }, 15000);
    
    return () => {
      clearTimeout(t);
      clearInterval(interval);
    };
  }, [checkAuthAndLoadData, generateRandomAlert]);

  // Socket.IO listener for live detection frames
  useEffect(() => {
    console.log('[ADMIN MONITORING] Setting up Socket.IO connection for live frames...');
    
    import('socket.io-client').then(({ io }) => {
      try {
        const socket = io(socketUrlBase, {
          transports: ['websocket', 'polling'],
          reconnectionAttempts: 5,
          reconnectionDelay: 1000
        });

        socket.on('connect', () => {
          console.log('[ADMIN MONITORING] Socket.IO connected successfully');
        });

        socket.on('detection', (payload) => {
          console.log('[ADMIN MONITORING] Detection event received:', {
            sessionId: payload.session_id,
            hasAnnotatedFrame: !!payload.annotated_frame,
            riskLevel: payload.risk_level,
            anomalies: payload.all_anomalies
          });

          if (payload.annotated_frame && payload.session_id) {
            console.log(`[ADMIN MONITORING] Updating frame for session ${payload.session_id}`);
            
            // Update frame counter
            if (!frameCounterRef.current[payload.session_id]) {
              frameCounterRef.current[payload.session_id] = 0;
            }
            frameCounterRef.current[payload.session_id]++;

            // Store the annotated frame
            setSessionFrames(prevFrames => ({
              ...prevFrames,
              [payload.session_id]: {
                src: payload.annotated_frame,
                timestamp: new Date().toLocaleTimeString(),
                frameCount: frameCounterRef.current[payload.session_id],
                riskLevel: payload.risk_level,
                anomalies: payload.all_anomalies
              }
            }));

            console.log(`[ADMIN MONITORING] Frame #${frameCounterRef.current[payload.session_id]} displayed for session ${payload.session_id}`);
          } else {
            console.warn('[ADMIN MONITORING] Detection event missing annotated_frame or session_id', {
              hasFrame: !!payload.annotated_frame,
              hasSessionId: !!payload.session_id
            });
          }
        });

        socket.on('disconnect', (reason) => {
          console.log('[ADMIN MONITORING] Socket.IO disconnected:', reason);
        });

        socket.on('connect_error', (error) => {
          console.warn('[ADMIN MONITORING] Socket.IO connection error:', error);
        });

        socket.on('error', (error) => {
          console.error('[ADMIN MONITORING] Socket.IO error:', error);
        });

        socketRef.current = socket;

        return () => {
          console.log('[ADMIN MONITORING] Cleaning up Socket.IO connection');
          if (socket) {
            socket.disconnect();
          }
        };
      } catch (err) {
        console.error('[ADMIN MONITORING] Error initializing Socket.IO:', err);
      }
    }).catch(err => {
      console.warn('[ADMIN MONITORING] Socket.IO client not available:', err);
    });
  }, [socketUrlBase]);

  const handleVideoAccess = (video) => {
    setSelectedVideo(video);
    // If video is already authenticated, show modal directly
    if (authenticatedVideos.has(video.id)) {
      setShowVideoModal(true);
      setAuthError(""); // Clear any previous auth errors
    } else {
      setShowAuthDialog(true);
      setAuthCode("");
      setAuthError("");
    }
  };

  const validateAuthCode = () => {
    if (selectedVideo && authCode === selectedVideo.authKey) {
      setAuthenticatedVideos(prev => new Set([...prev, selectedVideo.id]));
      setShowAuthDialog(false);
      setShowVideoModal(true);
      setAuthError("");
    } else {
      setAuthError("Invalid authentication code. Please try again.");
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-amber-600 bg-amber-50 border-amber-200';
      default: return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const filteredSessions = activeSessions.filter(session =>
    session.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    session.examTitle.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredVideos = storedVideos.filter(video =>
    video.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    video.examTitle.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="admin-monitoring">
      <div className="monitoring-container">
        {/* Header */}
        <div className="monitoring-header">
          <div>
            <h1>
              <Video className="w-8 h-8" />
              Live Monitoring Center
            </h1>
            <p>Real-time proctoring and recorded session management</p>
          </div>
          <Button onClick={() => navigate(createPageUrl("AdminDashboard"))} variant="outline">
            Back to Dashboard
          </Button>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          <Card className="monitoring-stat-card monitoring-stat-blue">
            <CardContent className="p-6 text-center">
              <p className="text-2xl font-bold">{activeSessions.length}</p>
              <p className="text-blue-100 text-sm">Live Sessions</p>
            </CardContent>
          </Card>
          
          <Card className="monitoring-stat-card monitoring-stat-green">
            <CardContent className="p-6 text-center">
              <p className="text-2xl font-bold">{activeSessions.filter(s => s.status === 'in_progress').length}</p>
              <p className="text-green-100 text-sm">Active</p>
            </CardContent>
          </Card>
          
          <Card className="monitoring-stat-card monitoring-stat-amber">
            <CardContent className="p-6 text-center">
              <p className="text-2xl font-bold">{activeSessions.filter(s => s.status === 'flagged').length}</p>
              <p className="text-amber-100 text-sm">Flagged</p>
            </CardContent>
          </Card>
          
          <Card className="monitoring-stat-card monitoring-stat-purple">
            <CardContent className="p-6 text-center">
              <p className="text-2xl font-bold">{storedVideos.length}</p>
              <p className="text-purple-100 text-sm">Stored Videos</p>
            </CardContent>
          </Card>
          
          <Card className="monitoring-stat-card monitoring-stat-red">
            <CardContent className="p-6 text-center">
              <p className="text-2xl font-bold">{alerts.length}</p>
              <p className="text-red-100 text-sm">Alerts</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="stored" className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList className="bg-white/80 backdrop-blur-sm border-0 shadow-sm">
              <TabsTrigger value="live" className="flex items-center gap-2">
                <Video className="w-4 h-4" />
                Live Sessions ({activeSessions.length})
              </TabsTrigger>
              <TabsTrigger value="stored" className="flex items-center gap-2">
                <Database className="w-4 h-4" />
                Stored Videos ({storedVideos.length})
              </TabsTrigger>
            </TabsList>

            {/* Search */}
            <Card className="border-0 bg-white/80 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="relative w-80">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="text"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                    placeholder="Search sessions or videos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <TabsContent value="live" className="space-y-6">
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Live Video Grid */}
              <div className="lg:col-span-2">
                <Card className="border-0 bg-white/80 backdrop-blur-sm shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Video className="w-5 h-5" />
                      Live Video Feeds ({filteredSessions.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredSessions.map((session) => (
                        <Card key={session.id} className={`border-2 ${session.status === 'flagged' ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}>
                          <CardContent className="p-4">
                            <div className="space-y-3">
                              {/* Video Feed - Display Annotated Frame */}
                              <div className="relative bg-slate-900 rounded-lg aspect-video overflow-hidden">
                                {sessionFrames[session.id]?.src ? (
                                  <>
                                    <img 
                                      src={sessionFrames[session.id].src}
                                      alt={`Live feed for ${session.studentName}`}
                                      className="w-full h-full object-contain bg-slate-900"
                                      onError={(e) => {
                                        console.warn(`[ADMIN MONITORING] Failed to load image for session ${session.id}`);
                                        e.target.style.display = 'none';
                                      }}
                                    />
                                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded font-mono">
                                      Frame #{sessionFrames[session.id].frameCount}
                                    </div>
                                    <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                                      {sessionFrames[session.id].timestamp}
                                    </div>
                                  </>
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                                    <div className="text-center">
                                      <Video className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                                      <p className="text-slate-500 text-xs">Waiting for frames...</p>
                                      <p className="text-slate-600 text-xs mt-1">Detection active</p>
                                    </div>
                                  </div>
                                )}
                                <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                                  LIVE
                                </div>
                                <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                                  {formatTime(session.timeRemaining)}
                                </div>
                                {session.violations > 0 && (
                                  <div className="absolute bottom-8 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    {session.violations}
                                  </div>
                                )}
                                {sessionFrames[session.id]?.riskLevel && (
                                  <div className={`absolute top-10 right-2 text-white text-xs px-2 py-1 rounded font-semibold ${
                                    sessionFrames[session.id].riskLevel === 'critical' ? 'bg-red-600' :
                                    sessionFrames[session.id].riskLevel === 'high' ? 'bg-orange-600' :
                                    sessionFrames[session.id].riskLevel === 'medium' ? 'bg-yellow-600' :
                                    'bg-green-600'
                                  }`}>
                                    {sessionFrames[session.id].riskLevel.toUpperCase()}
                                  </div>
                                )}
                              </div>

                              {/* Student Info */}
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-semibold text-sm">{session.studentName}</p>
                                  <p className="text-xs text-slate-600 truncate max-w-32">{session.examTitle}</p>
                                </div>
                                <Badge className={session.status === 'flagged' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
                                  {session.status === 'flagged' ? 'Flagged' : 'Active'}
                                </Badge>
                              </div>

                              {/* Anomalies Display */}
                              {sessionFrames[session.id]?.anomalies && sessionFrames[session.id].anomalies.length > 0 && (
                                <div className="bg-red-50 border border-red-200 rounded p-2 text-xs">
                                  <p className="font-semibold text-red-700 mb-1">Detected Anomalies:</p>
                                  <ul className="text-red-600 space-y-1">
                                    {sessionFrames[session.id].anomalies.map((anom, idx) => (
                                      <li key={idx}>• {anom}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Controls */}
                              <div className="flex gap-1">
                                <Button size="sm" variant="outline" onClick={() => setShowVideoModal(true)} title="View live detection with bounding boxes">
                                  <Maximize className="w-3 h-3" />
                                  <span className="text-xs ml-1">View</span>
                                </Button>
                                <Button size="sm" variant="outline">
                                  <MessageCircle className="w-3 h-3" />
                                </Button>
                                <Button size="sm" variant="outline">
                                  <Flag className="w-3 h-3" />
                                </Button>
                                <Button size="sm" variant="destructive">
                                  <Ban className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {filteredSessions.length === 0 && (
                      <div className="text-center py-12 text-slate-500">
                        <Video className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                        <h3 className="text-xl font-semibold mb-2">No Active Sessions</h3>
                        <p>Live exam sessions will appear here when students are taking exams.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Alerts Panel */}
              <div>
                <Card className="border-0 bg-white/80 backdrop-blur-sm shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                      Real-Time Alerts
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 max-h-96 overflow-y-auto">
                    {alerts.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        <Shield className="w-12 h-12 mx-auto mb-3 text-green-500" />
                        <p className="text-sm">No alerts at this time</p>
                        <p className="text-xs text-slate-400">System monitoring all sessions</p>
                      </div>
                    ) : (
                      alerts.map((alert) => (
                        <Alert key={alert.id} className={getSeverityColor(alert.severity)}>
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            <div className="space-y-1">
                              <p className="font-semibold text-xs">{alert.studentName} - {alert.examTitle}</p>
                              <p className="text-sm">{alert.message}</p>
                              <p className="text-xs opacity-75">{alert.timestamp}</p>
                            </div>
                          </AlertDescription>
                        </Alert>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="stored" className="space-y-6">
            <Card className="border-0 bg-white/80 backdrop-blur-sm shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Stored Video Recordings ({filteredVideos.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Demo Auth Code Info */}
                <div className="auth-demo-box">
                  <Key className="auth-demo-icon" />
                  <div className="auth-demo-content">
                    <p className="auth-demo-title">Demo Authentication</p>
                    <p className="auth-demo-text">Use this code to access all encrypted videos:</p>
                    <div className="auth-demo-code">{DEMO_AUTH_CODE}</div>
                  </div>
                </div>

                <div className="video-grid">
                  {filteredVideos.map((video) => (
                    <Card key={video.id} className="monitoring-video-card">
                      <CardContent className="p-0">
                        <div className="space-y-0">
                          {/* Video Thumbnail */}
                          <div className="video-thumbnail">
                            <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
                              <Play className="w-12 h-12 text-slate-500" />
                            </div>
                            <div className="video-badge">
                              <Lock className="w-3 h-3" />
                              ENCRYPTED
                            </div>
                            <div className="video-duration">
                              {video.duration}
                            </div>
                            {video.violations > 0 && (
                              <div className="video-violations">
                                <AlertTriangle className="w-3 h-3" />
                                {video.violations} violations
                              </div>
                            )}
                            {video.snapshots?.length > 0 && (
                              <div className="video-violations" style={{ background: '#1f2937' }}>
                                <Camera className="w-3 h-3" />
                                {video.snapshots.length} snapshots
                              </div>
                            )}
                            {video.score !== undefined && (
                              <div className="video-score">
                                Score: {video.score}%
                              </div>
                            )}
                            <button 
                              onClick={() => handleVideoAccess(video)} 
                              className="video-thumbnail-button"
                            >
                              <div>
                                <Lock className="w-6 h-6 text-slate-900" />
                              </div>
                            </button>
                          </div>

                          {/* Video Info */}
                          <div className="video-info">
                            <div className="video-info-content">
                              <p className="video-student">{video.studentName}</p>
                              <p className="video-exam">{video.examTitle}</p>
                              <div className="video-meta">
                                <div className="video-meta-date">
                                  <Calendar className="w-3 h-3" />
                                  {video.recordedDate}
                                </div>
                                <Badge className={video.status === 'flagged' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}>
                                  {video.status === 'flagged' ? 'Flagged' : 'Completed'}
                                </Badge>
                              </div>
                              {video.violations > 0 && (
                                <div className="video-violations-text">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>{video.violations} malpractice violation{video.violations > 1 ? 's' : ''} detected</span>
                                </div>
                              )}
                            </div>

                            {/* Access Button */}
                            <button 
                              onClick={() => handleVideoAccess(video)}
                              className="video-access-button"
                            >
                              <Lock className="w-4 h-4" />
                              {authenticatedVideos.has(video.id) ? 'Play Video' : 'Access Video'}
                            </button>
                            {video.hasRecording && (
                              <a
                                href={video.downloadUrl}
                                className="video-access-button"
                                target="_blank"
                                rel="noreferrer"
                                title={`Download encrypted recording (${video.recordingChunks} chunks)`}
                              >
                                <Database className="w-4 h-4" />
                                Download Encrypted
                              </a>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {filteredVideos.length === 0 && (
                  <div className="text-center py-12 text-slate-500">
                    <Database className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                    <h3 className="text-xl font-semibold mb-2">No Stored Videos</h3>
                    <p>Completed exam recordings will appear here for review.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Video Authentication Dialog */}
        <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
          <DialogContent className="max-w-md">
            <div className="auth-dialog-header">
              <h2 className="auth-dialog-title">
                <Key className="auth-dialog-icon" />
                Video Access Authentication
              </h2>
            </div>
            <div className="auth-dialog-body">
              <div className="auth-secure-box">
                <Lock className="auth-secure-icon" />
                <h3 className="auth-secure-title">Secure Video Access</h3>
                <p className="auth-secure-text">Enter authentication code to view</p>
                <p className="auth-secure-info">{selectedVideo?.studentName} - {selectedVideo?.examTitle}</p>
              </div>

              <div className="auth-code-section">
                <label className="auth-code-label">Authentication Code</label>
                <input
                  type="password"
                  placeholder="••••••"
                  value={authCode}
                  onChange={(e) => setAuthCode(e.target.value)}
                  className="auth-code-input"
                  maxLength="6"
                />
              </div>

              {authError && (
                <div style={{background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '12px', display: 'flex', gap: '8px', alignItems: 'flex-start'}}>
                  <AlertCircle style={{width: '20px', height: '20px', color: '#dc2626', flexShrink: 0}} />
                  <span style={{color: '#991b1b', fontSize: '0.9rem', fontWeight: '500'}}>{authError}</span>
                </div>
              )}
              
              <div className="auth-demo-hint">
                <strong>Demo Code:</strong> <code>{DEMO_AUTH_CODE}</code>
              </div>

              <div className="auth-dialog-actions">
                <button className="auth-dialog-button cancel" onClick={() => setShowAuthDialog(false)}>
                  Cancel
                </button>
                <button className="auth-dialog-button access" onClick={validateAuthCode}>
                  <Key style={{width: '16px', height: '16px'}} />
                  Access Video
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Video Player Modal */}
        <Dialog open={showVideoModal} onOpenChange={setShowVideoModal}>
          <DialogContent className="max-w-4xl">
            <div className="video-dialog-header">
              <h2 className="video-dialog-title">Video Playback: {selectedVideo?.studentName}</h2>
              <div style={{background: selectedVideo?.status === 'flagged' ? '#fee2e2' : '#dbeafe', color: selectedVideo?.status === 'flagged' ? '#991b1b' : '#1e40af', padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '600'}}>
                {selectedVideo?.status === 'flagged' ? 'Flagged Session' : 'Completed Session'}
              </div>
            </div>
            <div className="video-dialog-body">
              <div className="video-player-container">
                {authenticatedVideos.has(selectedVideo?.id) && selectedVideo?.videoUrl ? (
                  <video
                    controls
                    autoPlay
                    src={selectedVideo.videoUrl}
                    onContextMenu={(e) => e.preventDefault()}
                  />
                ) : authenticatedVideos.has(selectedVideo?.id) && selectedVideo?.snapshots?.length > 0 ? (
                  <div className="video-placeholder" style={{background: 'linear-gradient(135deg, #1e3a8a 0%, #312e81 100%)'}}>
                    <Camera className="video-placeholder-icon" />
                    <p className="video-placeholder-title">Snapshots Available</p>
                    <p className="video-placeholder-text">{selectedVideo.snapshots.length} snapshot(s) captured during exam</p>
                    <div className="video-placeholder-info">
                      <p className="video-placeholder-secure">✓ Snapshots encrypted and stored securely</p>
                      <p className="video-placeholder-logged">✓ Scroll down to view captured snapshots</p>
                      {selectedVideo?.score !== undefined && (
                        <p className="video-placeholder-score">Score: {selectedVideo.score}%</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="video-placeholder">
                    <Play className="video-placeholder-icon" />
                    <p className="video-placeholder-title">Video Player</p>
                    <p className="video-placeholder-text">Exam recording for {selectedVideo?.studentName}</p>
                    <div className="video-placeholder-info">
                      <p className="video-placeholder-secure">✓ Video encrypted and stored securely</p>
                      <p className="video-placeholder-logged">✓ Access logged and monitored</p>
                      {selectedVideo?.score !== undefined && (
                        <p className="video-placeholder-score">Score: {selectedVideo.score}%</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {selectedVideo?.snapshots?.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Camera className="w-5 h-5" />
                    Captured Snapshots ({selectedVideo.snapshots.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedVideo.snapshots.map((snap, index) => (
                      <Card key={`${snap.id || index}`} className="border border-slate-200">
                        <CardContent className="p-3 space-y-2">
                          {snap.image ? (
                            <img
                              src={snap.image}
                              alt={`Snapshot ${index + 1}`}
                              className="w-full rounded-md border border-slate-200"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect fill="%23f1f5f9" width="400" height="300"/><text x="50%" y="50%" text-anchor="middle" fill="%2364748b" font-family="Arial">Image unavailable</text></svg>';
                              }}
                            />
                          ) : (
                            <div className="w-full h-48 bg-slate-100 rounded-md border border-slate-200 flex items-center justify-center">
                              <div className="text-center text-slate-400">
                                <Camera className="w-8 h-8 mx-auto mb-2" />
                                <p className="text-sm">No image data</p>
                              </div>
                            </div>
                          )}
                          <div className="text-xs text-slate-600 space-y-1">
                            <div className="flex justify-between">
                              <strong>Time:</strong> 
                              <span>{snap.timestamp ? new Date(snap.timestamp).toLocaleTimeString() : 'Unknown'}</span>
                            </div>
                            <div className="flex justify-between">
                              <strong>Reason:</strong> 
                              <span className="text-right ml-2">{snap.reason || 'Not specified'}</span>
                            </div>
                            <div className="flex justify-between">
                              <strong>Severity:</strong>
                              <Badge className={
                                snap.severity === 'critical' ? 'bg-red-100 text-red-800' :
                                snap.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                                'bg-amber-100 text-amber-800'
                              }>
                                {snap.severity || 'medium'}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
              <div className="video-dialog-controls">
                <button className="video-control-button">
                  <Volume2 style={{width: '16px', height: '16px'}} />
                  Audio Controls
                </button>
                <button className="video-control-button">
                  <Flag style={{width: '16px', height: '16px'}} />
                  Flag Violation
                </button>
                <button className="video-control-button">
                  <Eye style={{width: '16px', height: '16px'}} />
                  Full Analysis
                </button>
                <button className="video-control-button">
                  <Maximize style={{width: '16px', height: '16px'}} />
                  Full Screen
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}