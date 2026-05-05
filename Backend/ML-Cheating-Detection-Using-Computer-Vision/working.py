import numpy as np
import cv2
import time


def convertToRGB(img):
    return cv2.cvtColor(img, cv2.COLOR_BGR2RGB)


def detect_faces(f_cascade, colored_img, scaleFactor=1.1, minNeighbors=5):
    img_copy = np.copy(colored_img)
    gray = cv2.cvtColor(img_copy, cv2.COLOR_BGR2GRAY)
    faces = f_cascade.detectMultiScale(gray, scaleFactor=scaleFactor, minNeighbors=minNeighbors)
    
    for (x, y, w, h) in faces:
        cv2.rectangle(img_copy, (x, y), (x + w, y + h), (0, 255, 0), 2)
    
    return img_copy, faces


def detect_faces_with_timing(cascade_classifier, image, cascade_name="Cascade"):
    t_start = time.time()
    result_img, faces = detect_faces(cascade_classifier, image)
    t_end = time.time()
    detection_time = t_end - t_start
    
    print(f'{cascade_name} Detection: {len(faces)} faces found in {round(detection_time, 3)} seconds')
    return result_img, faces, detection_time


def compare_cascades(haar_cascade, lbp_cascade, test_image):
    print("=" * 50)
    haar_img, haar_faces, haar_time = detect_faces_with_timing(haar_cascade, test_image, "Haar")
    lbp_img, lbp_faces, lbp_time = detect_faces_with_timing(lbp_cascade, test_image, "LBP")
    
    print(f"Haar: {len(haar_faces)} faces | Time: {round(haar_time, 3)}s")
    print(f"LBP: {len(lbp_faces)} faces | Time: {round(lbp_time, 3)}s")
    print("=" * 50)
    
    return {
        'haar': {'image': haar_img, 'faces': haar_faces, 'time': haar_time},
        'lbp': {'image': lbp_img, 'faces': lbp_faces, 'time': lbp_time}
    }


if __name__ == "__main__":
    haar_cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
    lbp_cascade_path = cv2.data.haarcascades + 'lbpcascade_frontalface.xml'
    
    haar_face_cascade = cv2.CascadeClassifier(haar_cascade_path)
    lbp_face_cascade = cv2.CascadeClassifier(lbp_cascade_path)
    
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("Error: Could not open camera")
        exit()
    
    print("Press 'q' to quit, 'h' for Haar, 'l' for LBP, 'c' for comparison")
    mode = 'haar'
    
    while True:
        ret, frame = cap.read()
        if not ret:
            print("Error: Could not read frame")
            break
        
        key = cv2.waitKey(1) & 0xFF
        
        if key == ord('q'):
            break
        elif key == ord('h'):
            mode = 'haar'
            print("Switched to Haar cascade")
        elif key == ord('l'):
            mode = 'lbp'
            print("Switched to LBP cascade")
        elif key == ord('c'):
            compare_cascades(haar_face_cascade, lbp_face_cascade, frame)
        
        if mode == 'haar':
            result_frame, faces = detect_faces(haar_face_cascade, frame)
            cv2.putText(result_frame, f'Haar: {len(faces)} faces', (10, 30), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        else:
            result_frame, faces = detect_faces(lbp_face_cascade, frame)
            cv2.putText(result_frame, f'LBP: {len(faces)} faces', (10, 30), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        
        cv2.imshow('Face Detection', result_frame)
    
    cap.release()
    cv2.destroyAllWindows()
