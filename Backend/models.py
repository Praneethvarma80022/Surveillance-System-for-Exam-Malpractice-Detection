"""Detection model wrapper for ProctorGuard."""

from __future__ import annotations

import base64
import logging
import os
import time
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

try:
    import cv2
except Exception:  # pragma: no cover - optional dependency at runtime
    cv2 = None

try:
    import dlib
except Exception:  # pragma: no cover - optional dependency at runtime
    dlib = None


class ProctorAIModel:
    def __init__(self) -> None:
        self.total_frames = 0
        self.total_anomalies = 0
        self.risk_counts = {
            "low": 0,
            "medium": 0,
            "high": 0,
            "critical": 0,
        }
        self.logger = logging.getLogger(__name__)

        self._base_dir = os.path.dirname(__file__)
        self._ml_dir = os.path.join(self._base_dir, "ML-Cheating-Detection-Using-Computer-Vision")

        self._yolo_net = None
        self._yolo_classes: List[str] = []
        self._yolo_output_layers: List[str] = []
        self._yolo_conf_threshold = self._parse_float_env("YOLO_CONF_THRESHOLD", 0.5)
        self._yolo_nms_threshold = self._parse_float_env("YOLO_NMS_THRESHOLD", 0.4)
        labels_env = os.getenv(
            "SUSPICIOUS_YOLO_LABELS",
            "cell phone,book,laptop,remote,keyboard,mouse,tv"
        )
        self._suspicious_labels = {
            label.strip().lower()
            for label in labels_env.split(",")
            if label.strip()
        }
        self._face_detector = None
        self._shape_predictor = None

        self._models_ready = {
            "opencv": cv2 is not None,
            "dlib": dlib is not None,
            "yolo": False,
            "shape_predictor": False,
        }

        self._load_models()

    @staticmethod
    def _parse_float_env(name: str, default: float) -> float:
        raw = os.getenv(name)
        if raw is None:
            return default
        try:
            value = float(raw)
        except ValueError:
            return default
        if value <= 0 or value >= 1:
            return default
        return value

    def _load_models(self) -> None:
        if cv2 is None:
            self.logger.warning("OpenCV is not available; object detection disabled")
            return

        yolo_cfg = os.path.join(self._ml_dir, "yolov4.cfg")
        yolo_weights = os.path.join(self._ml_dir, "yolov4.weights")
        coco_names = os.path.join(self._ml_dir, "coco.names")

        if os.path.exists(yolo_cfg) and os.path.exists(yolo_weights) and os.path.exists(coco_names):
            try:
                self._yolo_net = cv2.dnn.readNet(yolo_weights, yolo_cfg)
                with open(coco_names, "r", encoding="utf-8") as handle:
                    self._yolo_classes = [line.strip() for line in handle.readlines()]
                layer_names = self._yolo_net.getLayerNames()
                self._yolo_output_layers = [layer_names[i - 1] for i in self._yolo_net.getUnconnectedOutLayers()]
                self._models_ready["yolo"] = True
            except Exception as exc:
                self.logger.warning("Failed to load YOLO model: %s", exc)
        else:
            self.logger.warning("YOLO files missing; phone detection disabled")

        if dlib is None:
            self.logger.warning("dlib is not available; face detection disabled")
            return

        try:
            self._face_detector = dlib.get_frontal_face_detector()
            self._models_ready["dlib"] = True
        except Exception as exc:
            self.logger.warning("Failed to load dlib face detector: %s", exc)

        predictor_path = os.path.join(self._ml_dir, "shape_predictor_68_face_landmarks.dat")
        if os.path.exists(predictor_path):
            try:
                self._shape_predictor = dlib.shape_predictor(predictor_path)
                self._models_ready["shape_predictor"] = True
            except Exception as exc:
                self.logger.warning("Failed to load shape predictor: %s", exc)
        else:
            self.logger.warning("Shape predictor file missing; head direction disabled")

    def _decode_frame(self, frame_data: str) -> Optional[np.ndarray]:
        if not frame_data or not isinstance(frame_data, str):
            return None

        # Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
        if frame_data.startswith("data:image"):
            try:
                # Split on comma and take the part after it
                frame_data = frame_data.split(",", 1)[1]
            except (IndexError, ValueError):
                return None

        # Handle potential whitespace
        frame_data = frame_data.strip()

        try:
            raw = base64.b64decode(frame_data)
            if len(raw) == 0:
                return None
        except Exception as e:
            self.logger.warning(f"Base64 decode failed: {e}")
            return None

        if cv2 is None:
            return None

        try:
            data = np.frombuffer(raw, dtype=np.uint8)
            image = cv2.imdecode(data, cv2.IMREAD_COLOR)
            
            # Validate decoded image
            if image is None or image.size == 0:
                self.logger.warning("Failed to decode image from frame data")
                return None
            
            return image
        except Exception as e:
            self.logger.warning(f"Image decode error: {e}")
            return None

    def _detect_faces(self, frame: np.ndarray) -> Tuple[Optional[bool], Optional[bool], Optional[str], List[Tuple[int, int, int, int]], Optional[int]]:
        if not self._models_ready.get("dlib") or self._face_detector is None:
            return None, None, None, [], None

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = self._face_detector(gray)
        face_count = len(faces)
        face_detected = face_count > 0
        multiple_faces = face_count > 1
        direction = None
        boxes: List[Tuple[int, int, int, int]] = []
        areas: List[int] = []
        valid_faces = []
        primary_index = None

        if face_detected:
            height, width = frame.shape[:2]
            for face in faces:
                x1, y1, x2, y2 = face.left(), face.top(), face.right(), face.bottom()
                x1 = max(0, x1)
                y1 = max(0, y1)
                x2 = min(width - 1, x2)
                y2 = min(height - 1, y2)
                if x2 <= x1 or y2 <= y1:
                    continue
                boxes.append((x1, y1, x2, y2))
                areas.append((x2 - x1) * (y2 - y1))
                valid_faces.append(face)

            if areas:
                primary_index = int(np.argmax(areas))

            if primary_index is not None and self._models_ready.get("shape_predictor") and self._shape_predictor is not None:
                primary_face = valid_faces[primary_index]
                landmarks = self._shape_predictor(gray, primary_face)
                nose_tip = landmarks.part(30).x
                left_eye = sum(landmarks.part(n).x for n in range(36, 42)) // 6
                right_eye = sum(landmarks.part(n).x for n in range(42, 48)) // 6

                if nose_tip < left_eye:
                    direction = "Left"
                elif nose_tip > right_eye:
                    direction = "Right"
                else:
                    direction = "Forward"

        return face_detected, multiple_faces, direction, boxes, primary_index

    def _detect_phone(self, frame: np.ndarray) -> Tuple[Optional[bool], List[Tuple[int, int, int, int]]]:
        if not self._models_ready.get("yolo") or self._yolo_net is None:
            return None, []

        height, width = frame.shape[:2]
        blob = cv2.dnn.blobFromImage(
            frame,
            scalefactor=0.00392,
            size=(416, 416),
            mean=(0, 0, 0),
            swapRB=True,
            crop=False,
        )
        self._yolo_net.setInput(blob)
        outputs = self._yolo_net.forward(self._yolo_output_layers)

        boxes: List[Tuple[int, int, int, int]] = []
        confs: List[float] = []
        class_ids: List[int] = []

        for output in outputs:
            for detect in output:
                scores = detect[5:]
                class_id = int(np.argmax(scores))
                conf = float(scores[class_id])
                if conf > self._yolo_conf_threshold:
                    center_x = int(detect[0] * width)
                    center_y = int(detect[1] * height)
                    w = int(detect[2] * width)
                    h = int(detect[3] * height)
                    x = int(center_x - w / 2)
                    y = int(center_y - h / 2)
                    boxes.append((x, y, w, h))
                    confs.append(conf)
                    class_ids.append(class_id)

        phone_detected = False
        filtered_boxes: List[Tuple[int, int, int, int]] = []
        if boxes:
            indexes = cv2.dnn.NMSBoxes(boxes, confs, self._yolo_conf_threshold, self._yolo_nms_threshold)
            if isinstance(indexes, (list, tuple, np.ndarray)):
                indexes = [int(i) for i in np.array(indexes).flatten().tolist()]
            else:
                indexes = []

            for i in indexes:
                label = self._yolo_classes[class_ids[i]] if class_ids[i] < len(self._yolo_classes) else ""
                if label == "cell phone":
                    phone_detected = True
                    filtered_boxes.append(boxes[i])

        return phone_detected, filtered_boxes

    def _detect_yolo_objects(
        self, frame: np.ndarray
    ) -> Tuple[Optional[bool], List[Tuple[int, int, int, int]], List[Tuple[int, int, int, int]], List[str]]:
        if not self._models_ready.get("yolo") or self._yolo_net is None:
            return None, [], [], []

        height, width = frame.shape[:2]
        blob = cv2.dnn.blobFromImage(
            frame,
            scalefactor=0.00392,
            size=(416, 416),
            mean=(0, 0, 0),
            swapRB=True,
            crop=False,
        )
        self._yolo_net.setInput(blob)
        outputs = self._yolo_net.forward(self._yolo_output_layers)

        boxes: List[Tuple[int, int, int, int]] = []
        confs: List[float] = []
        class_ids: List[int] = []

        for output in outputs:
            for detect in output:
                scores = detect[5:]
                class_id = int(np.argmax(scores))
                conf = float(scores[class_id])
                # Lower threshold for person detection (class 0 in COCO) to improve multi-person detection
                threshold = 0.3 if class_id == 0 else self._yolo_conf_threshold
                if conf > threshold:
                    center_x = int(detect[0] * width)
                    center_y = int(detect[1] * height)
                    w = int(detect[2] * width)
                    h = int(detect[3] * height)
                    x = int(center_x - w / 2)
                    y = int(center_y - h / 2)
                    boxes.append((x, y, w, h))
                    confs.append(conf)
                    class_ids.append(class_id)

        phone_boxes: List[Tuple[int, int, int, int]] = []
        person_boxes: List[Tuple[int, int, int, int]] = []
        suspicious_labels: List[str] = []
        phone_detected = False

        if boxes:
            indexes = cv2.dnn.NMSBoxes(boxes, confs, 0.3, self._yolo_nms_threshold)
            if isinstance(indexes, (list, tuple, np.ndarray)):
                indexes = [int(i) for i in np.array(indexes).flatten().tolist()]
            else:
                indexes = []

            for i in indexes:
                label = self._yolo_classes[class_ids[i]] if class_ids[i] < len(self._yolo_classes) else ""
                label_lower = label.lower()
                if label_lower == "cell phone":
                    phone_detected = True
                    phone_boxes.append(boxes[i])
                    if label_lower not in suspicious_labels:
                        suspicious_labels.append(label_lower)
                elif label_lower == "person":
                    x, y, w, h = boxes[i]
                    x1 = max(0, x)
                    y1 = max(0, y)
                    x2 = min(width - 1, x + w)
                    y2 = min(height - 1, y + h)
                    if x2 > x1 and y2 > y1:
                        person_boxes.append((x1, y1, x2, y2))
                elif label_lower in self._suspicious_labels:
                    if label_lower not in suspicious_labels:
                        suspicious_labels.append(label_lower)

        return phone_detected, phone_boxes, person_boxes, suspicious_labels

    def _annotate_frame(
        self,
        frame: np.ndarray,
        face_boxes: List[Tuple[int, int, int, int]],
        phone_boxes: List[Tuple[int, int, int, int]],
        person_boxes: List[Tuple[int, int, int, int]],
        suspicious_labels: List[str],
        status_text: str,
    ) -> np.ndarray:
        """
        Annotate frame with all detected objects:
        - Green: Face boxes
        - Blue: Person detection boxes with labels (person1, person2, etc.)
        - Red: Phone/suspicious object boxes
        - Yellow: Other suspicious objects
        """
        import logging
        logger = logging.getLogger(__name__)
        logger.debug(f'[ANNOTATE] Drawing: {len(face_boxes)} faces, {len(person_boxes)} persons, {len(phone_boxes)} phones, labels: {suspicious_labels}')
        
        annotated = frame.copy()
        h, w = frame.shape[:2]
        
        # Draw YOLO person detection boxes with labels
        for idx, (x, y, w_box, h_box) in enumerate(person_boxes, 1):
            # Draw bounding box
            cv2.rectangle(annotated, (x, y), (x + w_box, y + h_box), (255, 0, 0), 2)  # Blue for persons
            
            # Label: "person1", "person2", etc.
            label = f"person{idx}"
            label_size, _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
            label_x, label_y = x, y - 10
            
            # Draw background for label text
            cv2.rectangle(annotated, (label_x, label_y - label_size[1] - 5), 
                         (label_x + label_size[0] + 5, label_y + 5), (255, 0, 0), -1)
            
            # Draw label text
            cv2.putText(annotated, label, (label_x + 2, label_y - 3), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            
            # Draw pixel coordinates below box
            coords_text = f"({x},{y})-({x + w_box},{y + h_box})"
            cv2.putText(annotated, coords_text, (x, y + h_box + 20), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 1)
        
        # Draw face detection boxes (green)
        for (x1, y1, x2, y2) in face_boxes:
            cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(annotated, "FACE", (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
        
        # Draw phone/suspicious object boxes (red)
        for (x, y, w_box, h_box) in phone_boxes:
            cv2.rectangle(annotated, (x, y), (x + w_box, y + h_box), (0, 0, 255), 2)
            cv2.putText(annotated, "PHONE", (x, y - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)
        
        # Draw suspicious object labels if any
        if suspicious_labels:
            for label in suspicious_labels:
                cv2.putText(annotated, f"SUSPICIOUS: {label}", (10, 60), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 165, 255), 2)
        
        # Draw main status text
        cv2.putText(annotated, status_text, (10, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
        
        return annotated

    def process_frame(self, frame_data: str, include_frame: bool = False) -> Dict[str, Any]:
        frame = self._decode_frame(frame_data)
        if frame is None:
            return {"error": "Invalid frame data"}

        self.total_frames += 1

        face_detected, multiple_faces, direction, face_boxes, primary_index = self._detect_faces(frame)
        phone_detected, phone_boxes, person_boxes, suspicious_labels = self._detect_yolo_objects(frame)
        person_count = len(person_boxes)
        
        # Detailed logging for face detection logic
        import logging
        logger = logging.getLogger(__name__)
        
        logger.debug(f'[MODELS] Face detection: face_detected={face_detected}, multiple_faces={multiple_faces}, dlib_boxes={len(face_boxes)}')
        logger.debug(f'[MODELS] YOLO person detection: person_count={person_count}, boxes={len(person_boxes)}')
        logger.debug(f'[MODELS] YOLO phone detection: phone_detected={phone_detected}, phone_boxes={len(phone_boxes)}')
        logger.debug(f'[MODELS] Detection summary - Face boxes: {face_boxes}, Person boxes: {person_boxes}, Phone boxes: {phone_boxes}')
        
        # Enhanced detection logic combining dlib face detection and YOLO person detection
        # Priority: dlib face detection > YOLO person detection
        actual_face_detected = face_detected
        actual_multiple_faces = multiple_faces
        
        # CASE 1: dlib is working and detected faces - trust dlib completely
        if face_detected is True:
            logger.info(f'[MODELS] dlib detected faces: multiple_faces={multiple_faces}')
            # Cross-check with YOLO for multiple persons
            if multiple_faces is False and person_count > 1:
                actual_multiple_faces = True
                logger.warning(f'[MODELS] dlib found 1 face but YOLO found {person_count} persons - flagging multiple')
        
        # CASE 2: dlib didn't detect faces (False) or is unavailable (None) - use YOLO fallback
        elif face_detected is False or face_detected is None:
            logger.info(f'[MODELS] dlib face_detected={face_detected}, using YOLO fallback')
            
            # Use YOLO person detection as fallback
            if person_count == 0:
                # No persons detected by YOLO either - definitely no one present
                actual_face_detected = False
                actual_multiple_faces = False
                logger.warning(f'[MODELS] ⚠️ NO PERSON DETECTED - Both dlib and YOLO found nothing!')
            elif person_count == 1:
                # YOLO detected exactly one person - probably OK but dlib failed
                actual_face_detected = True  # Consider person detected
                actual_multiple_faces = False
                logger.info(f'[MODELS] dlib failed but YOLO found 1 person - considering valid')
            else:  # person_count > 1
                # YOLO detected multiple persons
                actual_face_detected = True
                actual_multiple_faces = True
                logger.warning(f'[MODELS] dlib failed but YOLO found {person_count} persons - flagging multiple')
        
        logger.info(f'[MODELS] ✓ FINAL DETECTION: face_detected={actual_face_detected}, multiple_faces={actual_multiple_faces}')

        suspicious_motion = False
        if direction and direction != "Forward":
            suspicious_motion = True

        anomalies: List[str] = []
        
        # Use the actual (computed) detection results for anomaly checking
        # CRITICAL: face_not_detected and multiple_faces_detected are MUTUALLY EXCLUSIVE
        if actual_face_detected is False:
            # No person detected at all
            anomalies.append("face_not_detected")
            logger.warning(f'[MODELS] 🚨 ANOMALY: face_not_detected (NO PERSON IN FRAME)')
        elif actual_face_detected is True and actual_multiple_faces:
            # Multiple persons detected
            anomalies.append("multiple_faces_detected")
            logger.warning(f'[MODELS] 🚨 ANOMALY: multiple_faces_detected (MULTIPLE PERSONS IN FRAME)')
        elif actual_face_detected is True and not actual_multiple_faces:
            # Single person detected - normal case
            logger.info(f'[MODELS] ✓ NORMAL: Single person detected')
        
        if phone_detected or suspicious_labels:
            anomalies.append("suspicious_objects_detected")
            logger.warning(f'[MODELS] 🚨 ANOMALY: suspicious_objects_detected ({suspicious_labels})')
        if suspicious_motion:
            anomalies.append("suspicious_hand_movement")
            logger.warning(f'[MODELS] ⚠️ ANOMALY: suspicious_hand_movement (direction={direction})')

        # Risk scoring using actual detection results
        risk_score = 0
        if actual_face_detected is False:
            risk_score += 50  # No person detected is very high risk
            logger.info(f'[MODELS] Risk +50 (no person detected)')
        elif actual_multiple_faces:
            risk_score += 45  # Multiple persons is very high risk
            logger.info(f'[MODELS] Risk +45 (multiple persons)')
        
        risk_score += 55 if phone_detected else 0
        risk_score += 25 if suspicious_labels and not phone_detected else 0
        risk_score += 30 if suspicious_motion else 0

        if risk_score >= 85:
            risk_level = "critical"
        elif risk_score >= 60:
            risk_level = "high"
        elif risk_score >= 35:
            risk_level = "medium"
        else:
            risk_level = "low"

        self.risk_counts[risk_level] += 1
        self.total_anomalies += len(anomalies)

        status_text = "Normal"
        if anomalies:
            status_text = ", ".join(anomalies)
            logger.info(f'[MODELS] STATUS: {status_text} (Risk: {risk_level}, Score: {risk_score})')
        if direction:
            status_text = f"{status_text} | Direction: {direction}"
        
        # Log summary for debugging
        logger.info(f'[MODELS] === DETECTION SUMMARY ===')
        logger.info(f'[MODELS] Person Status: face_detected={actual_face_detected}, multiple={actual_multiple_faces}')
        logger.info(f'[MODELS] Anomalies: {anomalies}')
        logger.info(f'[MODELS] Risk: {risk_level} (score={risk_score})')
        logger.info(f'[MODELS] =========================')

        result: Dict[str, Any] = {
            "timestamp": time.time(),
            "facial_analysis": {
                "face_detected": actual_face_detected,  # Use computed value
                "multiple_faces": actual_multiple_faces,  # Use computed value
                "direction": direction,
                "face_boxes": face_boxes,
                "primary_face_index": primary_index,
                "raw_dlib_face_detected": face_detected,  # Include raw dlib result for debugging
                "raw_dlib_multiple_faces": multiple_faces,  # Include raw dlib result for debugging
            },
            "object_analysis": {
                "phone_detected": phone_detected,
                "suspicious_objects": bool(suspicious_labels) or bool(phone_detected),
                "phone_boxes": phone_boxes,
                "person_count": person_count,
                "person_boxes": person_boxes,
                "suspicious_labels": suspicious_labels,
            },
            "motion_analysis": {
                "suspicious_motion": suspicious_motion,
            },
            "audio_analysis": {
                "audio_anomaly": False,
            },
            "all_anomalies": anomalies,
            "risk_level": risk_level,
            "overall_score": max(0, 100 - risk_score),
            "detection_summary": status_text,
            "model_status": dict(self._models_ready),
            "frame_size": {
                "width": int(frame.shape[1]),
                "height": int(frame.shape[0]),
            },
        }

        if include_frame and cv2 is not None:
            annotated = self._annotate_frame(frame, face_boxes, phone_boxes, person_boxes, suspicious_labels, status_text)
            ok, buffer = cv2.imencode(".jpg", annotated)
            if ok:
                result["annotated_frame"] = f"data:image/jpeg;base64,{base64.b64encode(buffer).decode('ascii')}"

        return result

    def get_statistics(self) -> Dict[str, Any]:
        return {
            "total_frames": self.total_frames,
            "total_anomalies": self.total_anomalies,
            "risk_counts": dict(self.risk_counts),
            "model_status": dict(self._models_ready),
        }
