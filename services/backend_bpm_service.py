#!/usr/bin/env python3
"""
FastAPI Backend for Heart Rate Detection
Receives video from React frontend and processes it
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import cv2
import numpy as np
from scipy import signal
from scipy.fft import fft
import tempfile
import os
from collections import deque

app = FastAPI()

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your React app URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class BPMProcessor:
    def __init__(self, fps=30):
        self.fps = fps
        self.face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
    
    def extract_forehead_roi(self, frame, face):
        """Extract forehead region"""
        x, y, w, h = face
        roi_y = y + int(h * 0.2)
        roi_h = int(h * 0.15)
        roi_x = x + int(w * 0.3)
        roi_w = int(w * 0.4)
        roi = frame[roi_y:roi_y+roi_h, roi_x:roi_x+roi_w]
        return roi
    
    def calculate_bpm(self, rgb_signals):
        """Calculate BPM using POS algorithm"""
        if len(rgb_signals) < self.fps * 5:  # Need minimum 5 seconds
            return None, "Insufficient Data", 0
        
        rgb_array = np.array(rgb_signals)
        rgb_mean = np.mean(rgb_array, axis=0)
        rgb_std = np.std(rgb_array, axis=0) + 1e-10
        rgb_normalized = (rgb_array - rgb_mean) / rgb_std
        
        R = rgb_normalized[:, 0]
        G = rgb_normalized[:, 1]
        B = rgb_normalized[:, 2]
        
        X = R - G
        Y = R + G - 2 * B
        
        alpha = np.std(X) / (np.std(Y) + 1e-10)
        pulse_signal = X - alpha * Y
        
        # Bandpass filter (0.7-3.5 Hz = 42-210 BPM)
        sos = signal.butter(4, [0.7, 3.5], btype='band', fs=self.fps, output='sos')
        pulse_filtered = signal.sosfilt(sos, pulse_signal)
        pulse_filtered = signal.detrend(pulse_filtered)
        
        # FFT analysis
        n = len(pulse_filtered)
        fft_data = np.abs(fft(pulse_filtered))[:n//2]
        freqs = np.fft.fftfreq(n, 1.0/self.fps)[:n//2]
        
        valid_idx = (freqs >= 0.7) & (freqs <= 3.5)
        freqs = freqs[valid_idx]
        fft_data = fft_data[valid_idx]
        
        if len(fft_data) == 0:
            return None, "No Valid Data", 0
        
        peak_idx = np.argmax(fft_data)
        peak_freq = freqs[peak_idx]
        peak_power = fft_data[peak_idx]
        mean_power = np.mean(fft_data)
        
        if peak_power < 1.5 * mean_power:
            return None, "Weak Signal", 0
        
        bpm = peak_freq * 60.0
        snr = peak_power / mean_power
        
        confidence = min(100, (snr / 3.0) * 100)  # Convert SNR to confidence %
        
        quality = "Poor"
        if snr > 3.0:
            quality = "Excellent"
        elif snr > 2.0:
            quality = "Good"
        elif snr > 1.5:
            quality = "Fair"
        
        return bpm, quality, confidence
    
    def process_video(self, video_path):
        """Process uploaded video file - Optimized for 30-second recordings"""
        cap = cv2.VideoCapture(video_path)
        
        if not cap.isOpened():
            raise ValueError("Cannot open video file")
        
        # Get FPS only — frame count metadata is unreliable for converted MP4s
        fps = int(cap.get(cv2.CAP_PROP_FPS))
        
        if fps == 0 or fps > 120:
            fps = 30
        
        print(f"📹 Starting frame-by-frame processing at {fps} FPS")
        
        self.fps = fps
        rgb_values = []
        frame_count = 0
        face_detected_frames = 0
        consecutive_no_face = 0
        MAX_NO_FACE_FRAMES = fps * 5  # Allow 5 seconds without face detection
        
        print("🔍 Processing frames...")
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            
            # Face detection with improved parameters
            faces = self.face_cascade.detectMultiScale(
                gray, 
                scaleFactor=1.1, 
                minNeighbors=5, 
                minSize=(100, 100),  # Slightly smaller minimum
                flags=cv2.CASCADE_SCALE_IMAGE
            )
            
            # ✅ Improved face handling
            if len(faces) > 0:
                # Use largest face
                face = max(faces, key=lambda f: f[2] * f[3])
                roi = self.extract_forehead_roi(frame_rgb, face)
                
                if roi.size > 0 and roi.shape[0] > 10 and roi.shape[1] > 10:  # Valid ROI size
                    avg_rgb = np.mean(roi.reshape(-1, 3), axis=0)
                    rgb_values.append(avg_rgb)
                    face_detected_frames += 1
                    consecutive_no_face = 0  # Reset counter
                else:
                    consecutive_no_face += 1
            else:
                consecutive_no_face += 1
            
            frame_count += 1
            
            # ✅ Early warning for poor face detection
            if consecutive_no_face > MAX_NO_FACE_FRAMES:
                print("⚠️  Too many frames without face detection")
                break

        cap.release()

        video_duration = round(frame_count / fps, 1) if fps > 0 else 0.0
        actual_duration = round(face_detected_frames / fps, 1) if fps > 0 else 0.0
        face_detection_rate = (face_detected_frames / frame_count * 100.0) if frame_count > 0 else 0.0

        if video_duration < 10:
            return {
                "success": False,
                "error": f"Video too short ({video_duration}s actual). Need at least 10 seconds for analysis.",
                "duration_seconds": video_duration,
                "frames_processed": frame_count,
                "face_frames": face_detected_frames,
                "required_duration": 10
            }
        
        # ✅ Enhanced validation for 30-second recordings
        if len(rgb_values) < fps * 15:  # Need at least 15 seconds of actual data
            return {
                "success": False,
                "error": f"Insufficient quality data. Got {actual_duration:.1f}s of face data (need 15s+). Detection rate: {face_detection_rate:.1f}%",
                "duration_seconds": video_duration,
                "actual_face_duration": actual_duration,
                "detection_rate": round(face_detection_rate, 1),
                "frames_processed": frame_count,
                "face_frames": face_detected_frames
            }
        
        # Calculate BPM
        bpm, quality, confidence = self.calculate_bpm(rgb_values)
        
        if bpm is None or bpm < 40 or bpm > 200:
            return {
                "success": False,
                "error": f"No valid heart rate detected. Quality: {quality or 'Unknown'}, Confidence: {confidence or 0}%. Try better lighting.",
                "duration_seconds": video_duration,
                "actual_face_duration": actual_duration,
                "detection_rate": round(face_detection_rate, 1),
                "frames_processed": frame_count,
                "face_frames": face_detected_frames
            }
        
        # ✅ More realistic BP estimation (still experimental)
        # Base values for resting adult + HR correlation
        systolic = int(105 + (bpm - 65) * 0.8)  # Slightly more responsive
        diastolic = int(70 + (bpm - 65) * 0.5)
        
        # Clamp realistic ranges
        systolic = max(90, min(160, systolic))
        diastolic = max(60, min(100, diastolic))
        
        # ✅ Better HRV estimation
        hrv = int(75 - (bpm - 65) * 0.4)
        hrv = max(25, min(95, hrv))
        
        # ✅ Stress index combining multiple factors
        hr_factor = max(0, (bpm - 70) / 30 * 40)  # Elevated HR
        low_hrv_factor = max(0, (75 - hrv) / 50 * 30)  # Low variability
        stress_index = hr_factor + low_hrv_factor
        stress_index = min(100, stress_index)
        
        # ✅ Quality score based on multiple metrics
        quality_score = (
            min(100, face_detection_rate * 1.2) +  # Face detection consistency
            confidence +                           # Signal confidence
            min(30, len(rgb_values) / fps * 3)     # Duration bonus
        ) / 3
        
        return {
            "success": True,
            "heart_rate": round(bpm, 1),
            "quality": quality,
            "confidence": round(confidence, 1),
            "quality_score": round(quality_score, 1),
            "hrv": hrv,
            "blood_pressure": {
                "systolic": systolic,
                "diastolic": diastolic
            },
            "stress_index": round(stress_index, 1),
            "frames_processed": frame_count,
            "face_frames": face_detected_frames,
            "duration_seconds": video_duration,
            "actual_face_duration": round(actual_duration, 1),
            "detection_rate": round(face_detection_rate, 1)
        }



@app.post("/analyze")
async def analyze_video(file: UploadFile = File(...)):
    """
    Endpoint to receive video from React and return heart rate analysis
    """
    try:
        # Validate file type
        if not file.content_type.startswith('video/'):
            raise HTTPException(status_code=400, detail="File must be a video")
        
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        mp4_path = tmp_path.replace('.webm', '.mp4')
        video_to_process = tmp_path
        
        try:
            import subprocess
            subprocess.run(
                ['ffmpeg', '-y', '-i', tmp_path, '-c:v', 'libx264', '-preset', 'ultrafast', mp4_path],
                check=True, capture_output=True
            )
            if os.path.exists(mp4_path) and os.path.getsize(mp4_path) > 0:
                video_to_process = mp4_path
        except Exception as ffmpeg_err:
            print(f"⚠️ FFmpeg conversion skipped/failed ({ffmpeg_err}), using original file")

        try:
            # Process video
            processor = BPMProcessor()
            result = processor.process_video(video_to_process)
            
            return JSONResponse(content=result)
        
        finally:
            # Clean up temp file
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
            if os.path.exists(mp4_path):
                os.remove(mp4_path)
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/")
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "service": "BPM Detection Service"}


if __name__ == "__main__":
    import uvicorn
    print("🫀 Starting Heart Rate Detection Service on http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
