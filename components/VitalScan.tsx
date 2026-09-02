import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, Activity, ShieldCheck, Loader2, Heart, AlertTriangle, CheckCircle, Wifi, WifiOff, Cpu, Info, FileText, Share2, Printer, Zap, XCircle, Database, Cloud } from 'lucide-react';
import { localServices, ServiceStatus } from '../services/localServices';
import { groqService } from '../services/groqService';
import { VitalScanResult } from '../types';

const VitalScan: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<VitalScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [serviceStatus, setServiceStatus] = useState<{backend: ServiceStatus, rppg: ServiceStatus} | null>(null);
  const [useProxy, setUseProxy] = useState(false);
  const [storageStatus, setStorageStatus] = useState<'local' | 'cloud' | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const isMounted = useRef(true);

  const performCheck = useCallback(async () => {
    try {
      const status = await localServices.checkHealth(useProxy);
      if (isMounted.current) setServiceStatus(status);
    } catch (e) {
      console.error("Health check failed", e);
    }
  }, [useProxy]);

  useEffect(() => {
    isMounted.current = true;
    startCamera();
    return () => {
      isMounted.current = false;
      stopCamera();
    };
  }, []);

  useEffect(() => {
    performCheck();
    const interval = setInterval(performCheck, 10000);
    return () => clearInterval(interval);
  }, [performCheck]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720, frameRate: 30 }, 
        audio: false 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => videoRef.current?.play();
      }
    } catch (err) {
      if (isMounted.current) setError("Camera access denied. Please check browser permissions.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
    }
  };

  const processRecording = async (capturedChunks: Blob[]) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setError(null);
    
    try {
      const blob = new Blob(capturedChunks, { type: 'video/webm' });
      if (blob.size === 0) throw new Error("No video data captured. Please hold still.");
      
      const formData = new FormData();
      formData.append('file', blob, 'recording.webm');
      
      const response = await fetch('http://localhost:8000/analyze', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const rppgData = await response.json();
      
      if (!rppgData.success) {
        throw new Error(rppgData.error || "Analysis failed");
      }
      
      let aiText = `### REPORT_STATUS: ${rppgData.heart_rate > 100 ? 'ELEVATED' : 'STABLE'}\n\n**Summary:** Heart rate analysis completed with ${rppgData.quality} signal quality (${rppgData.confidence}% confidence).\n\n**Clinical Findings:**\n* [BPM: ${Math.round(rppgData.heart_rate)}] - ${rppgData.quality} quality detection\n* [BP: ${rppgData.blood_pressure.systolic}/${rppgData.blood_pressure.diastolic}] - Estimated values\n* [HRV: ${rppgData.hrv}] - Heart rate variability\n\n**AI Verdict:** Analysis based on ${rppgData.duration_seconds.toFixed(1)}s video with ${rppgData.face_frames}/${rppgData.frames_processed} frames detected.`;
      
      const scanResult: VitalScanResult = {
        heartRate: Math.round(rppgData.heart_rate),
        hrv: rppgData.hrv,
        bloodPressure: {
          systolic: rppgData.blood_pressure.systolic,
          diastolic: rppgData.blood_pressure.diastolic
        },
        stressLevel: rppgData.stress_index > 50 ? 'High' : 'Normal',
        timestamp: new Date().toISOString(),
        aiInterpretation: aiText
      };

      let isCloudSaved = false;
      try {
        const saveResponse = await fetch('http://localhost:5001/api/vital-scan/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            heartRate: scanResult.heartRate,
            hrv: scanResult.hrv,
            bloodPressure: scanResult.bloodPressure,
            stressLevel: scanResult.stressLevel,
            aiInterpretation: scanResult.aiInterpretation,
            confidence: rppgData.confidence || 85.0
          })
        });

        const saveResult = await saveResponse.json();
        if (saveResult.success) isCloudSaved = true;
      } catch (saveErr) {}

      try {
        localStorage.setItem('cardiix_latest_scan', JSON.stringify(scanResult));
        const existingHistoryStr = localStorage.getItem('cardiix_scan_history');
        const existingHistory = existingHistoryStr ? JSON.parse(existingHistoryStr) : [];
        localStorage.setItem('cardiix_scan_history', JSON.stringify([...existingHistory, scanResult]));
        window.dispatchEvent(new Event('cardiix_scan_updated'));
      } catch(e) {}

      if (isMounted.current) {
        setResult(scanResult);
        setStorageStatus(isCloudSaved ? 'cloud' : 'local');
      }

    } catch (err: any) {
      console.error("Analysis Error:", err);
      if (isMounted.current) {
        setError(err.message || "Failed to analyze video");
      }
    } finally {
      if (isMounted.current) setIsProcessing(false);
    }
  };

  const startRecording = () => {
    if (isRecording || isProcessing) return;
    
    setError(null);
    setResult(null);
    chunksRef.current = [];
    setRecordingTime(0);
    setIsRecording(true);

    const startTime = Date.now();
    
    const timerId = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setRecordingTime(elapsed);
      
      if (elapsed >= 30) {
        clearInterval(timerId);
        forceStopRecording();
        return;
      }
    }, 1000);

    timerRef.current = timerId;

    if (videoRef.current?.srcObject) {
      try {
        const stream = videoRef.current.srcObject as MediaStream;
        let mimeType = 'video/webm;codecs=vp8';
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';
        
        const recorder = new MediaRecorder(stream, { 
          mimeType,
          videoBitsPerSecond: 2500000 
        });
        
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };
        
        recorder.onstop = () => {
          setTimeout(() => processRecording(chunksRef.current), 100);
        };

        recorder.onerror = (e) => {
          forceStopRecording();
        };

        recorder.start(1000);
        mediaRecorderRef.current = recorder;
        
      } catch (e) {
        setError("Recording failed. Check camera permissions.");
        forceStopRecording();
      }
    }
  };

  const forceStopRecording = useCallback(() => {
    setIsRecording(false);
    setRecordingTime(0);
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      } catch (e) {}
      mediaRecorderRef.current = null;
    }
    
    if (chunksRef.current.length > 0) {
      setTimeout(() => processRecording(chunksRef.current), 200);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (!isRecording) return;
    forceStopRecording();
  }, [isRecording, forceStopRecording]);

  const renderClinicalReport = (text: string) => {
    if (!text) return null;
    const lines = text.split('\n');
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {lines.map((line, i) => {
          if (line.startsWith('###')) {
            const status = line.replace(/###|REPORT_STATUS:/g, '').trim();
            const isStable = status.includes('OPTIMAL') || status.includes('STABLE');
            const color = isStable ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100';
            return (
              <div key={i} className={`px-6 py-4 rounded-2xl border font-bold text-center uppercase tracking-widest text-sm shadow-sm ${color}`}>
                Vital Status: {status}
              </div>
            );
          }
          if (line.includes('[BPM:') || line.includes('[BP:') || line.includes('[HRV:')) {
            const parts = line.split(/(\[.*?\])/g);
            return (
              <div key={i} className="flex items-start gap-4 mb-2 border-l-2 border-slate-200 pl-4 py-1">
                <p className="text-slate-700 text-sm leading-relaxed">
                  {parts.map((part, idx) => {
                    if (part.startsWith('[BPM:')) return <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded bg-crimson-50 text-crimson-700 font-bold text-xs mx-1">HR: {part.replace('[BPM:', '').replace(']', '')}</span>;
                    if (part.startsWith('[BP:')) return <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-xs mx-1">BP: {part.replace('[BP:', '').replace(']', '')}</span>;
                    if (part.startsWith('[HRV:')) return <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-xs mx-1">HRV: {part.replace('[HRV:', '').replace(']', '')}</span>;
                    return <span key={idx}>{part.replace(/\*/g, '')}</span>;
                  })}
                </p>
              </div>
            );
          }
          if (line.startsWith('**AI Verdict:**')) {
            return (
              <div key={i} className="mt-8 pt-6 border-t border-slate-100">
                <div className="bg-slate-50 rounded-2xl p-6 text-slate-800 border border-slate-200 relative overflow-hidden group shadow-sm">
                  <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-125 transition-transform duration-700"><Zap size={80} /></div>
                  <p className="text-xs font-bold uppercase tracking-widest text-crimson-600 mb-2">Final Verdict</p>
                  <p className="text-sm font-medium italic relative z-10 leading-relaxed">"{line.replace('**AI Verdict:**', '').trim()}"</p>
                </div>
              </div>
            );
          }
          if (line.startsWith('**')) return <h4 key={i} className="text-xs font-bold text-slate-800 uppercase tracking-widest mt-8 mb-3 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-crimson-500"></div>{line.replace(/\*\*/g, '')}</h4>;
          return line.trim() ? <p key={i} className="text-slate-600 text-sm leading-relaxed mb-1 pl-3.5">{line.replace(/\*/g, '')}</p> : null;
        })}
      </div>
    );
  };

  return (
    <div className="p-8 md:p-12 max-w-[1600px] mx-auto flex flex-col items-center animate-in fade-in duration-700">
      <div className="w-full flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6">
        <div className="mb-8">
          <h2 className="text-4xl font-display font-bold text-slate-900 tracking-tight">PhysNet Scan</h2>
          <p className="text-slate-600 text-lg mt-2">Real-time remote photoplethysmography analysis.</p>
          <div className="flex items-center gap-2 text-slate-600 font-medium mt-2">
            <Activity size={18} className="text-crimson-500" />
            <span>Biometric Signal Extraction Active</span>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => { setUseProxy(!useProxy); performCheck(); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold uppercase tracking-widest shadow-sm transition-all ${useProxy ? 'bg-crimson-600 text-white border-crimson-700' : 'bg-white text-crimson-600 border-crimson-100 hover:bg-crimson-50'}`}
          >
            {useProxy ? 'Proxy Active' : 'Enable Proxy'}
            <Zap size={14} className={useProxy ? 'animate-pulse' : ''} />
          </button>
          <div className="flex items-center gap-3 px-5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 text-xs font-bold uppercase tracking-widest shadow-sm">
            <Wifi size={14} />
            Live Mode
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full">
        {/* Camera View */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="relative aspect-video bg-slate-900 rounded-3xl overflow-hidden shadow-md group border border-slate-200">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1] opacity-90" />
            {isRecording && (
              <div className="absolute top-8 left-8">
                 <div className="bg-red-600 px-5 py-2.5 rounded-full text-white font-bold text-xs uppercase tracking-widest flex items-center gap-3 shadow-lg">
                    <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse"></div>
                    Capturing - {recordingTime}s
                 </div>
              </div>
            )}
            {!isRecording && !isProcessing && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-500">
                <button onClick={startRecording} className="bg-white text-slate-900 px-8 py-4 rounded-2xl font-bold text-lg flex items-center gap-3 shadow-xl hover:scale-105 active:scale-95 transition-all">
                  <Camera size={24} className="text-crimson-600" />
                  Start Capture
                </button>
              </div>
            )}
            {isProcessing && (
              <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl flex flex-col items-center justify-center text-white p-12 text-center">
                <Loader2 size={80} className="animate-spin text-crimson-500/50 mb-8" />
                <h3 className="text-2xl font-display font-bold mb-3 tracking-tight">Analyzing Data</h3>
                <p className="text-slate-200 text-sm">Processing physiological signals via FFT...</p>
              </div>
            )}
          </div>
          
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-6 relative overflow-hidden">
             <div className="absolute -left-12 opacity-5"><ShieldCheck size={180}/></div>
             <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl relative z-10"><ShieldCheck size={32} /></div>
             <div className="relative z-10">
               <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Privacy First</p>
               <p className="text-slate-900 font-bold text-lg">Local Edge Processing</p>
               <p className="text-slate-500 text-sm mt-1">Biometric data is processed directly on your device.</p>
             </div>
          </div>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-5 flex flex-col h-full">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-crimson-400 to-crimson-600"></div>
            
            <div className="p-8 border-b border-slate-100 bg-slate-50/50">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="font-display font-bold text-slate-900 text-2xl">Clinical Scan</h3>
                  <div className="flex items-center gap-2 mt-2">
                    {storageStatus === 'cloud' ? (
                      <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 uppercase bg-emerald-50 px-3 py-1 rounded-full"><Cloud size={12}/> Cloud Synced</span>
                    ) : storageStatus === 'local' ? (
                      <span className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 uppercase bg-amber-50 px-3 py-1 rounded-full"><Database size={12}/> Local Storage</span>
                    ) : null}
                  </div>
                </div>
                <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center"><FileText size={20} className="text-slate-600" /></div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Heart Rate</p>
                   <div className="flex items-baseline gap-1">
                     <p className="text-3xl font-display font-bold text-slate-900">{result?.heartRate || '--'}</p>
                     <span className="text-xs text-slate-400 font-medium">bpm</span>
                   </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Est. BP</p>
                   <div className="flex items-baseline gap-1">
                     <p className="text-3xl font-display font-bold text-slate-900">{result?.bloodPressure ? `${result.bloodPressure.systolic}/${result.bloodPressure.diastolic}` : '--/--'}</p>
                     <span className="text-xs text-slate-400 font-medium">mmHg</span>
                   </div>
                </div>
              </div>
            </div>

            <div className="flex-1 p-8 overflow-y-auto bg-white min-h-[300px] custom-scrollbar">
              {error ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                  <XCircle size={40} className="text-red-500" />
                  <h4 className="font-bold text-slate-900">Diagnostic Error</h4>
                  <p className="text-sm text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100">{error}</p>
                  <button onClick={() => {setError(null); startCamera();}} className="mt-4 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold shadow-md hover:bg-slate-800 transition-colors">Retry Scan</button>
                </div>
              ) : result ? (
                renderClinicalReport(result.aiInterpretation || '')
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-60">
                  <Activity size={48} className="text-slate-300" />
                  <div>
                    <h4 className="font-bold text-slate-600 text-lg mb-1">Awaiting Scan</h4>
                    <p className="text-sm text-slate-400">Position your face clearly in the frame and press Start Capture.</p>
                  </div>
                </div>
              )}
            </div>

            {result && (
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-4">
                <button onClick={() => setResult(null)} className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-100 transition-colors">Reset</button>
                <button onClick={() => window.print()} className="flex-[2] bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 shadow-md flex items-center justify-center gap-2 transition-colors"><Share2 size={18} /> Export Results</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VitalScan;
