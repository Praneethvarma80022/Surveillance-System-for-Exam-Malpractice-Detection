import React, { useEffect, useRef, useState } from 'react';
import './LiveFeedAnnotations.css';

/**
 * Component to display live detection feed with bounding boxes and annotations
 * Renders annotated frame from backend with face/object detection boxes
 */
export default function LiveFeedAnnotations({ annotatedFrame, detectionResult, sessionId }) {
  const canvasRef = useRef(null);
  const [displayDimensions, setDisplayDimensions] = useState({ width: 640, height: 480 });

  useEffect(() => {
    if (!annotatedFrame && !detectionResult) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // If we have an annotated frame from backend, use it
    if (annotatedFrame) {
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        setDisplayDimensions({ width: img.width, height: img.height });
      };
      img.onerror = () => console.error('Failed to load annotated frame');
      img.src = annotatedFrame;
      return;
    }

    // Otherwise, draw bounding boxes from detection result
    if (detectionResult) {
      drawDetectionBoxes(ctx, canvas, detectionResult);
    }
  }, [annotatedFrame, detectionResult]);

  const drawDetectionBoxes = (ctx, canvas, result) => {
    if (!result.facial_analysis && !result.object_analysis) return;

    // Clear canvas with semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw face boxes (green for normal, red for issues)
    const faceBoxes = result.facial_analysis?.face_boxes || [];
    const multipleFaces = result.facial_analysis?.multiple_faces;
    
    faceBoxes.forEach((box, idx) => {
      if (box.length === 4) {
        const [x1, y1, x2, y2] = box;
        ctx.strokeStyle = multipleFaces ? '#ff0000' : '#00ff00';
        ctx.lineWidth = 3;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        
        // Draw label
        ctx.fillStyle = ctx.strokeStyle;
        ctx.font = 'bold 14px Arial';
        ctx.fillText(`Face ${idx + 1}`, x1, y1 - 5);
      }
    });

    // Draw phone boxes (red for suspicious)
    const phoneBoxes = result.object_analysis?.phone_boxes || [];
    phoneBoxes.forEach((box, idx) => {
      const [x, y, w, h] = box;
      ctx.strokeStyle = '#ff6600';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, w, h);
      
      ctx.fillStyle = '#ff6600';
      ctx.font = 'bold 14px Arial';
      ctx.fillText('PHONE', x, y - 5);
    });

    // Draw status text
    const anomalies = result.all_anomalies || [];
    const riskLevel = result.risk_level;
    
    const statusColor = {
      'critical': '#ff0000',
      'high': '#ff6600',
      'medium': '#ffaa00',
      'low': '#00ff00'
    }[riskLevel] || '#ffffff';

    ctx.fillStyle = statusColor;
    ctx.font = 'bold 16px Arial';
    ctx.fillText(`Risk: ${riskLevel.toUpperCase()}`, 10, 30);
    
    if (anomalies.length > 0) {
      ctx.font = '12px Arial';
      anomalies.forEach((anomaly, idx) => {
        ctx.fillText(`• ${anomaly}`, 10, 50 + idx * 18);
      });
    }
  };

  return (
    <div className="live-feed-annotations">
      <div className="annotations-container">
        <canvas 
          ref={canvasRef}
          className="annotations-canvas"
          width={displayDimensions.width}
          height={displayDimensions.height}
        />
        {!annotatedFrame && !detectionResult && (
          <div className="annotations-loading">
            <div className="loading-spinner"></div>
            <p>Waiting for detection data...</p>
          </div>
        )}
      </div>
      {detectionResult && (
        <div className="annotations-info">
          <div className="info-item">
            <span className="info-label">Risk Level:</span>
            <span className={`info-value risk-${detectionResult.risk_level}`}>
              {detectionResult.risk_level?.toUpperCase()}
            </span>
          </div>
          {detectionResult.facial_analysis?.face_detected && (
            <div className="info-item">
              <span className="info-label">Faces:</span>
              <span className="info-value">
                {detectionResult.facial_analysis.multiple_faces ? '⚠️ Multiple' : '✓ Single'}
              </span>
            </div>
          )}
          {detectionResult.object_analysis?.phone_detected && (
            <div className="info-item">
              <span className="info-label">Phone:</span>
              <span className="info-value alert">🚫 DETECTED</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
