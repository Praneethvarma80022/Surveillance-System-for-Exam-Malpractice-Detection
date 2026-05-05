/**
 * Malpractice Detection Service
 * Handles frame capture and communication with Python backend
 */

const DETECTION_API_URL = import.meta.env.VITE_DETECTION_API_URL || 'http://localhost:5000/api/v1';
const SOCKET_BASE_URL = import.meta.env.VITE_DETECTION_SOCKET_URL || DETECTION_API_URL.replace('/api/v1', '');

class MalpracticeDetectionService {
  constructor() {
    this.stream = null;
    this.videoElement = null;
    this.canvas = null;
    this.canvasContext = null;
    this.frameRate = 3; // 3 frames per second for detection
    this.frameInterval = 1000 / this.frameRate;
    this.lastFrameTime = 0;
    this.isRunning = false;
    this.sessionId = null;
    this.detectionHistory = [];
    this.requestAnimationFrameId = null;
    this.socket = null;
    this.onDetectionCallback = null;
    this.ownsStream = false;
    this._processingFrame = false;
  }

  /**
   * Initialize webcam and start detection
   */
  async initializeWebcam(videoElement, sessionId, existingStream = null) {
    try {
      console.log('[DETECTION SERVICE] initializeWebcam called with:', {
        hasVideoElement: !!videoElement,
        sessionId,
        hasExistingStream: !!existingStream
      });
      
      this.videoElement = videoElement;
      this.sessionId = sessionId;

      if (existingStream) {
        console.log('[DETECTION SERVICE] Using existing stream');
        this.stream = existingStream;
        this.ownsStream = false;
      } else {
        // Request camera permission
        console.log('[DETECTION SERVICE] Requesting camera permission for new stream');
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          },
          audio: true // For audio monitoring
        });
        console.log('[DETECTION SERVICE] New stream acquired');
        this.ownsStream = true;
      }

      // Attach stream to video element
      console.log('[DETECTION SERVICE] Attaching stream to video element');
      this.videoElement.srcObject = this.stream;

      // Wait for video to be ready
      await new Promise((resolve) => {
        const checkReady = () => {
          if (this.videoElement.readyState >= this.videoElement.HAVE_CURRENT_DATA) {
            console.log('[DETECTION SERVICE] Video element is ready:', {
              readyState: this.videoElement.readyState,
              videoWidth: this.videoElement.videoWidth,
              videoHeight: this.videoElement.videoHeight
            });
            resolve();
          } else {
            console.log('[DETECTION SERVICE] Waiting for video to be ready, readyState:', this.videoElement.readyState);
            setTimeout(checkReady, 100);
          }
        };
        checkReady();
      });

      // Initialize canvas for frame capture with actual video dimensions
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.videoElement.videoWidth || 1280;
      this.canvas.height = this.videoElement.videoHeight || 720;
      this.canvasContext = this.canvas.getContext('2d');

      // Smaller capture canvas for detection frames (reduces network payload and processing load)
      this._captureCanvas = document.createElement('canvas');
      this._captureCanvas.width = 640;
      this._captureCanvas.height = 360;
      this._captureContext = this._captureCanvas.getContext('2d');

      console.log('[DETECTION SERVICE] Canvas initialized with dimensions:', {
        width: this.canvas.width,
        height: this.canvas.height,
        videoWidth: this.videoElement.videoWidth,
        videoHeight: this.videoElement.videoHeight
      });

      // Connect Socket.IO and wait for connection
      console.log('[DETECTION SERVICE] Connecting to Socket.IO...');
      this._connectSocket();
      
      // Wait a bit for Socket connection to establish
      await new Promise((resolve) => {
        let attempts = 0;
        const checkSocket = () => {
          attempts++;
          if (this.socket && this.socket.connected) {
            console.log('[DETECTION SERVICE] Socket.IO connected successfully');
            resolve();
          } else if (attempts < 30) {
            console.log('[DETECTION SERVICE] Waiting for Socket.IO connection, attempt', attempts);
            setTimeout(checkSocket, 100);
          } else {
            console.warn('[DETECTION SERVICE] Socket.IO connection timeout, using HTTP fallback');
            resolve();
          }
        };
        checkSocket();
      });

      console.log('[DETECTION SERVICE] initializeWebcam complete');

      return true;
    } catch (error) {
      console.error('[DETECTION SERVICE] Error initializing webcam:', error);
      throw new Error(`Webcam initialization failed: ${error.message}`);
    }
  }

  /**
   * Start the detection loop
   */
  startDetection(onDetectionCallback) {
    if (this.isRunning) {
      console.warn('[DETECTION SERVICE] Detection already running');
      return;
    }
    
    this.isRunning = true;
    this.onDetectionCallback = onDetectionCallback;
    console.log('[DETECTION SERVICE] Starting malpractice detection...', {
      frameRate: this.frameRate,
      frameInterval: this.frameInterval,
      hasVideoElement: !!this.videoElement,
      hasCanvas: !!this.canvas
    });

    let frameCount = 0;
    const processFrame = () => {
      if (!this.isRunning) return;

      const now = performance.now();
      
      if (now - this.lastFrameTime >= this.frameInterval) {
        this.lastFrameTime = now;
        frameCount++;
        if (frameCount % 5 === 0) {
          console.log('[DETECTION SERVICE] Processing frame #', frameCount);
        }
        this._captureAndProcessFrame(onDetectionCallback);
      }

      this.requestAnimationFrameId = requestAnimationFrame(processFrame);
    };

    console.log('[DETECTION SERVICE] Starting animation frame loop');
    this.requestAnimationFrameId = requestAnimationFrame(processFrame);
  }

  /**
   * Stop detection and cleanup
   */
  stopDetection() {
    if (!this.isRunning) {
      // Already stopped, don't log multiple times
      return;
    }
    
    this.isRunning = false;
    this._processingFrame = false;

    if (this.requestAnimationFrameId) {
      cancelAnimationFrame(this.requestAnimationFrameId);
      this.requestAnimationFrameId = null;
    }

    if (this.stream && this.ownsStream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    console.log('Malpractice detection stopped');
  }

  /**
   * Capture frame and send to backend for analysis
   */
  async _captureAndProcessFrame(callback) {
    try {
      if (!this.videoElement) {
        console.warn('[DETECTION SERVICE] Video element not available');
        return;
      }
      
      if (this.videoElement.readyState < this.videoElement.HAVE_CURRENT_DATA) {
        console.log('[DETECTION SERVICE] Video not ready yet, readyState:', this.videoElement.readyState);
        return;
      }

      // Verify capture canvas context exists
      if (!this._captureContext) {
        console.error('[DETECTION SERVICE] Capture canvas not initialized');
        return;
      }

      // Skip if previous frame is still being processed (backpressure control)
      if (this._processingFrame) return;

      // Capture frame to smaller canvas for detection (reduces payload and processing)
      try {
        this._captureContext.drawImage(
          this.videoElement,
          0, 0,
          this._captureCanvas.width,
          this._captureCanvas.height
        );
      } catch (drawError) {
        console.error('[DETECTION SERVICE] Canvas drawImage failed:', drawError);
        return;
      }

      // Convert to base64 with reduced quality for faster transfer
      let frameData;
      try {
        frameData = this._captureCanvas.toDataURL('image/jpeg', 0.5);
        
        // Validate frame data
        if (!frameData || frameData.length < 100) {
          console.warn('[DETECTION SERVICE] Invalid frame data, too small:', frameData?.length);
          return;
        }
        
        console.log('[DETECTION SERVICE] Frame captured and converted to base64, size:', frameData.length);
      } catch (toDataError) {
        console.error('[DETECTION SERVICE] Canvas toDataURL failed:', toDataError);
        return;
      }

      // Try Socket.IO first if available
      if (this.socket && this.socket.connected) {
        console.log('[DETECTION SERVICE] Sending frame via Socket.IO');
        this._processingFrame = true;
        this.socket.emit('frame', {
          frame: frameData,
          session_id: this.sessionId
        });
        return;
      }

      // Fall back to HTTP if Socket.IO unavailable
      console.log('[DETECTION SERVICE] Socket.IO not connected, using HTTP fallback');
      this._processingFrame = true;
      const result = await this._sendFrame(frameData);
      this._processingFrame = false;
      if (result) {
        console.log('[DETECTION SERVICE] HTTP response received:', {
          hasAnomalies: !!result.all_anomalies,
          riskLevel: result.risk_level
        });
        this._handleDetectionResult(result, callback);
      } else {
        console.warn('[DETECTION SERVICE] HTTP detection failed, no result');
      }
    } catch (error) {
      this._processingFrame = false;
      console.error('[DETECTION SERVICE] Error processing frame:', error);
    }
  }

  _handleDetectionResult(result, callback) {
    if (!result) return;

    this.detectionHistory.push(result);

    // Keep only last 100 detections
    if (this.detectionHistory.length > 100) {
      this.detectionHistory.shift();
    }

    if (callback) {
      callback(result);
    }
  }

  _connectSocket() {
    if (this.socket) {
      console.log('[DETECTION SERVICE] Socket.IO already initialized');
      return;
    }

    console.log('[DETECTION SERVICE] Attempting to connect to Socket.IO at:', SOCKET_BASE_URL);

    import('socket.io-client').then(({ io }) => {
      try {
        this.socket = io(SOCKET_BASE_URL, {
          transports: ['websocket', 'polling'],
          reconnectionAttempts: 5,
          reconnectionDelay: 1000
        });

        this.socket.on('connect', () => {
          console.log('[DETECTION SERVICE] Socket.IO connected successfully');
        });

        this.socket.on('detection', (payload) => {
          this._processingFrame = false;
          console.log('[DETECTION SERVICE] Detection result received via Socket.IO:', {
            hasAnomalies: !!payload.all_anomalies,
            riskLevel: payload.risk_level
          });
          this._handleDetectionResult(payload, this.onDetectionCallback);
        });

        this.socket.on('connect_error', (error) => {
          console.warn('[DETECTION SERVICE] Socket.IO connection error:', error);
        });

        this.socket.on('disconnect', (reason) => {
          console.log('[DETECTION SERVICE] Socket.IO disconnected:', reason);
        });

        this.socket.on('error', (error) => {
          console.error('[DETECTION SERVICE] Socket.IO error:', error);
        });
      } catch (err) {
        console.error('[DETECTION SERVICE] Error setting up Socket.IO:', err);
      }
    }).catch((error) => {
      console.warn('[DETECTION SERVICE] Socket.IO client unavailable, will use HTTP fallback:', error);
    });
  }

  /**
   * Send frame to backend API for analysis
   */
  async _sendFrame(frameData) {
    try {
      const url = `${DETECTION_API_URL}/detect/frame`;
      console.log('[DETECTION SERVICE] Sending frame via HTTP to:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          frame: frameData,
          session_id: this.sessionId
        })
      });

      if (!response.ok) {
        console.error('[DETECTION SERVICE] HTTP Detection API error:', {
          status: response.status,
          statusText: response.statusText,
          url: url
        });
        return null;
      }

      const result = await response.json();
      console.log('[DETECTION SERVICE] HTTP detection response received:', {
        hasAnomalies: !!result.all_anomalies,
        riskLevel: result.risk_level,
        timestamp: result.timestamp
      });
      return result;
    } catch (error) {
      console.error('[DETECTION SERVICE] Error calling detection API:', {
        message: error.message,
        url: `${DETECTION_API_URL}/detect/frame`
      });
      return null;
    }
  }

  /**
   * Get detection statistics
   */
  async getStatistics() {
    try {
      const response = await fetch(`${DETECTION_API_URL}/statistics`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching statistics:', error);
      return null;
    }
  }

  /**
   * Get detection configuration
   */
  async getConfiguration() {
    try {
      const response = await fetch(`${DETECTION_API_URL}/config`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching configuration:', error);
      return null;
    }
  }

  /**
   * Check API health
   */
  async checkHealth() {
    try {
      const url = `${DETECTION_API_URL.replace('/api/v1', '')}/api/health`;
      console.log('[DETECTION SERVICE] Checking health at:', url);
      const response = await fetch(url, {
        method: 'GET'
      });

      console.log('[DETECTION SERVICE] Health check response:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText
      });
      
      return response.ok;
    } catch (error) {
      console.error('[DETECTION SERVICE] Health check failed:', error);
      console.error('[DETECTION SERVICE] Detection API is not available at:', DETECTION_API_URL);
      return false;
    }
  }

  /**
   * Get recent detection history
   */
  getDetectionHistory(limit = 10) {
    return this.detectionHistory.slice(-limit);
  }

  /**
   * Get anomalies summary
   */
  getAnomaliesSummary() {
    const summary = {
      total_anomalies: 0,
      face_not_detected: 0,
      multiple_faces: 0,
      suspicious_objects: 0,
      suspicious_movements: 0,
      high_risk_count: 0,
      critical_risk_count: 0
    };

    this.detectionHistory.forEach(detection => {
      if (detection.all_anomalies) {
        detection.all_anomalies.forEach(anomaly => {
          summary.total_anomalies++;
          
          if (anomaly === 'face_not_detected') summary.face_not_detected++;
          if (anomaly === 'multiple_faces_detected') summary.multiple_faces++;
          if (anomaly === 'suspicious_objects_detected') summary.suspicious_objects++;
          if (anomaly === 'suspicious_hand_movement') summary.suspicious_movements++;
        });
      }

      if (detection.risk_level === 'high') summary.high_risk_count++;
      if (detection.risk_level === 'critical') summary.critical_risk_count++;
    });

    return summary;
  }
}

// Export singleton instance
export const detectionService = new MalpracticeDetectionService();
export default MalpracticeDetectionService;
