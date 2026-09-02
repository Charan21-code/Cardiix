import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Droplets, Activity, Zap, Wind, ArrowUpRight, ArrowDownRight, Clock, ShieldCheck, WifiOff, AlertCircle, Terminal, Info, Cpu, Eye, Upload, Loader, Heart, FileText } from 'lucide-react';
import { localServices, ServiceStatus } from '../services/localServices';
import supabase from './supabaseClient.js';
import { Sparkles, X } from 'lucide-react';
import { motion } from 'framer-motion';

interface HealthData {
  id?: number;
  bpm: number;
  spo2: number;
  created_at: string;
}

interface ClinicalReport {
  id?: string | number;
  _id?: string;
  type?: string;
  timestamp?: string;
  uploadedAt?: string;
  createdAt?: string;
  status?: string;
  aiInterpretation?: string;
  confidence?: number;
  severity?: string;
  risk?: string;
}

const Dashboard: React.FC = () => {
  const [history, setHistory] = useState<any[]>([]);
  const [backendStatus, setBackendStatus] = useState<ServiceStatus | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [eyeImage, setEyeImage] = useState<File | null>(null);
  const [eyeAnalysis, setEyeAnalysis] = useState<string>('');
  const [analyzing, setAnalyzing] = useState(false);
  const [reports, setReports] = useState<ClinicalReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ClinicalReport | null>(null);

  // Real-time health data from Supabase
  const [latestHealthData, setLatestHealthData] = useState<HealthData | null>(null);
  const [healthHistory, setHealthHistory] = useState<HealthData[]>([]);
  const [supabaseConnected, setSupabaseConnected] = useState(false);

  useEffect(() => {
    fetchUserReports();
  }, []);

  const fetchUserReports = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8000/api/user/reports');
      const data = await response.json();
      const normalizedReports = Array.isArray(data?.reports) ? data.reports : [];
      setReports([...normalizedReports].sort((a: ClinicalReport, b: ClinicalReport) =>
        new Date(getReportDate(b)).getTime() - new Date(getReportDate(a)).getTime()
      ));
    } catch (error) {
      console.error('Failed to fetch:', error);
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const getReportDate = (report: ClinicalReport) => report.timestamp || report.uploadedAt || report.createdAt || new Date().toISOString();
  const getReportType = (report: ClinicalReport) => report.type || 'Clinical Report';
  const getReportStatus = (report: ClinicalReport) => report.status || 'Completed';
  const getReportRisk = (report: ClinicalReport) => (report.risk || 'not_available').replace(/_/g, ' ').toUpperCase();

  const ReportAnalysisModal = ({ report, onClose }: { report: ClinicalReport; onClose: () => void }) => {
    const reportStatus = getReportStatus(report);

    return (
      <div className="fixed inset-0 bg-orange-200backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
        <div className="bg-white rounded-[2rem] border border-slate-200 max-w-4xl max-h-[90vh] w-full overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="p-8 border-b border-slate-100 bg-ivory-50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-crimson-50 rounded-2xl flex items-center justify-center border border-crimson-100">
                  <Eye size={24} className="text-crimson-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-display font-bold text-slate-900">{getReportType(report)}</h2>
                  <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                    <span>{new Date(getReportDate(report)).toLocaleDateString()}</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${reportStatus === 'Completed' ? 'bg-emerald-50 text-emerald-600' :
                      reportStatus === 'Processing' ? 'bg-amber-50 text-amber-600' :
                        'bg-red-50 text-red-600'
                      }`}>
                      {reportStatus}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-xl transition-all group"
              >
                <X size={20} className="text-slate-400 group-hover:text-slate-700" />
              </button>
            </div>
          </div>

          {/* Analysis Content */}
          <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-6">
            {/* AI Interpretation */}
            <div className="bg-gradient-to-r from-crimson-50 to-ivory-50 p-6 rounded-2xl border border-crimson-100/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                  <Sparkles size={20} className="text-crimson-600" />
                </div>
                <div>
                  <h4 className="font-bold text-lg text-slate-800">AI Clinical Summary</h4>
                  <p className="text-xs text-slate-500">Automated analysis by Vivitsu AI</p>
                </div>
              </div>
              <p className="text-slate-700 text-sm leading-relaxed font-medium">
                "{report.aiInterpretation || 'No interpretation is available for this report yet.'}"
              </p>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="text-xs text-slate-500 uppercase font-bold tracking-wide mb-1">Confidence</div>
                <div className="text-2xl font-black text-slate-800">{report.confidence ?? 'N/A'}{typeof report.confidence === 'number' ? '%' : ''}</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="text-xs text-slate-500 uppercase font-bold tracking-wide mb-1">Severity</div>
                <div className={`text-xl font-bold ${report.severity === 'Severe' ? 'text-red-600' :
                  report.severity === 'Moderate' ? 'text-amber-600' :
                    report.severity === 'Mild' ? 'text-yellow-600' : 'text-emerald-600'
                  }`}>
                  {report.severity || 'Unknown'}
                </div>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="text-xs text-slate-500 uppercase font-bold tracking-wide mb-1">Risk Level</div>
                <div className={`text-xl font-bold ${report.risk === 'elevated_risk' ? 'text-red-600' :
                  report.risk === 'possible_elevated' ? 'text-amber-600' :
                    'text-emerald-600'
                  }`}>
                  {getReportRisk(report)}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100">
              <button className="flex-1 bg-crimson-600 hover:bg-crimson-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md hover:shadow-lg">
                Download Report PDF
              </button>
              <button className="flex-1 bg-white hover:bg-slate-50 text-slate-700 font-bold py-3 px-6 rounded-xl border border-slate-200 transition-all">
                Share with Doctor
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  useEffect(() => {
    const fetchInitialHealthData = async () => {
      try {
        const { data: latestData, error: latestError } = await supabase
          .from('health_readings')
          .select('bpm, spo2, created_at')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (latestData) {
          setLatestHealthData(latestData);
          setSupabaseConnected(true);
        }

        const { data: historyData } = await supabase
          .from('health_readings')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);

        if (historyData) {
          setHealthHistory(historyData.reverse());
        }
      } catch (error) {
        setSupabaseConnected(false);
      }
    };

    fetchInitialHealthData();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('health_readings_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'health_readings' },
        (payload) => {
          setLatestHealthData(payload.new as HealthData);
          setHealthHistory((prev) => [...prev, payload.new as HealthData].slice(-20));
          setSupabaseConnected(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const { backend } = await localServices.checkHealth();
        setBackendStatus(backend);
        const data = await localServices.getScanHistory();

        let allScans = [...data];
        const localScanStr = localStorage.getItem('cardiix_latest_scan');
        if (localScanStr) {
          try {
            const localScan = JSON.parse(localScanStr);
            if (!allScans.some((s: any) => s.timestamp === localScan.timestamp)) {
              allScans.push(localScan);
            }
          } catch (e) { }
        }

        allScans.sort((a: any, b: any) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());
        setHistory(allScans);
      } catch (err) {
        console.error('Error loading dashboard scan history:', err);
      }
    };

    loadData();

    const handleScanUpdate = () => loadData();
    window.addEventListener('cardiix_scan_updated', handleScanUpdate);
    return () => {
      window.removeEventListener('cardiix_scan_updated', handleScanUpdate);
    };
  }, []);

  const chartData = healthHistory.length > 0
    ? healthHistory.map(h => ({
      time: new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      heartRate: h.bpm,
      oxygen: h.spo2
    }))
    : history.length > 0
      ? history.map(h => ({
        time: new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        heartRate: h.heartRate
      }))
      : [
        { time: '08:00', heartRate: 72 },
        { time: '10:00', heartRate: 85 },
        { time: '12:00', heartRate: 78 },
        { time: '14:00', heartRate: 92 },
      ];

  const latest = history[history.length - 1];
  const API_BASE_URL = ((import.meta as any).env?.VITE_EYE_API_URL as string | undefined) || 'http://localhost:5004';

  const handleEyeAnalysis = async () => {
    if (!eyeImage) return;
    setAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append('file', eyeImage);
      const response = await fetch(`${API_BASE_URL}/analyze`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      setEyeAnalysis(formatAnalysisResult(result));
    } catch (error) {
      setEyeAnalysis('Failed to analyze image. Please ensure the backend server is running on port 5004.');
    } finally {
      setAnalyzing(false);
    }
  };

  const formatAnalysisResult = (result: any) => {
    if (!result.success) return 'Analysis failed. Please try with a clearer eye image.';
    const {
      arcus_detected,
      arcus_severity = 'unknown',
      cholesterol_risk = 'not_available',
      confidence = 0,
      details = {}
    } = result;

    return [
      'Eye Analysis Complete',
      '',
      `Status: ${arcus_detected ? 'Corneal Arcus Detected' : 'No Arcus Detected'}`,
      `Severity: ${arcus_severity.toUpperCase()}`,
      `Cholesterol Risk: ${cholesterol_risk.replace(/_/g, ' ').toUpperCase()}`,
      `Confidence: ${(Number(confidence) * 100).toFixed(1)}%`,
      '',
      'Technical Details:',
      `- Ring Intensity: ${details.mean_ring_intensity ?? 'N/A'}`,
      `- Iris Intensity: ${details.mean_iris_intensity ?? 'N/A'}`,
      `- Contrast Ratio: ${details.contrast_ratio ?? 'N/A'}x`,
      `- Uniform Pattern: ${details.is_uniform_ring ? 'Yes' : 'No'}`,
      `- Bright Segments: ${details.segments_bright ?? 'N/A'}/12`,
      `- Iris Radius: ${details.iris_radius ?? 'N/A'} pixels`,
      '',
      'Important: This is a visual screening tool only and not a medical diagnosis.',
    ].join('\n');
  };
  return (
    <div className="p-8 md:p-12 max-w-[1600px] mx-auto space-y-12 animate-in fade-in duration-500">

      {/* Header & Status */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-4xl font-display font-bold text-slate-900 tracking-tight mb-2">Overview</h2>
          <p className="text-slate-600 text-lg">Your cardiovascular insights, real-time.</p>
        </div>
        {supabaseConnected && latestHealthData && (
          <div className="bg-emerald-50 border border-emerald-100 px-4 py-2 rounded-full flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-sm font-semibold text-emerald-700">
              Live Stream - Last update: {new Date(latestHealthData.created_at).toLocaleTimeString()}
            </span>
          </div>
        )}
      </div>

      {backendStatus && !backendStatus.ok && (
        <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-r-2xl shadow-sm flex items-start gap-4">
          <WifiOff size={24} className="text-red-500 mt-1 shrink-0" />
          <div>
            <h3 className="text-lg font-bold text-red-900">Backend Connection Failed</h3>
            <p className="text-red-700 text-sm mt-1 mb-2">{backendStatus.message}</p>
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="text-xs font-bold bg-red-100 text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-200 transition-colors"
            >
              {showDebug ? 'Hide Details' : 'Show Details'}
            </button>
            {showDebug && (
              <code className="block mt-4 text-[11px] text-red-800 bg-red-100/50 p-4 rounded-xl">
                {backendStatus.rawError}
              </code>
            )}
          </div>
        </div>
      )}

      {/* KPI Open Canvas Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Heart Rate */}
        <motion.div whileHover={{ y: -8, scale: 1.02 }} transition={{ type: 'spring', stiffness: 300 }} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-crimson-100/50 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 text-slate-50 opacity-50 pointer-events-none group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500">
            <Heart size={140} fill="currentColor" />
          </div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-6">
              <div className="w-12 h-12 rounded-xl bg-crimson-50 flex items-center justify-center text-crimson-600">
                <Activity size={24} />
              </div>
              <ArrowUpRight size={20} className="text-crimson-500" />
            </div>
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-1">Heart Rate</p>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-display font-bold text-slate-900 tracking-tighter">
                {latestHealthData?.bpm || latest?.heartRate || '72'}
              </span>
              <span className="text-slate-400 font-medium">bpm</span>
            </div>
          </div>
        </motion.div>

        {/* Blood Pressure */}
        <motion.div whileHover={{ y: -8, scale: 1.02 }} transition={{ type: 'spring', stiffness: 300 }} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 text-slate-50 opacity-50 pointer-events-none group-hover:scale-110 group-hover:-rotate-12 transition-transform duration-500">
            <Droplets size={140} fill="currentColor" />
          </div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-6">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                <Droplets size={24} />
              </div>
              <ArrowDownRight size={20} className="text-emerald-500" />
            </div>
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-1">Est. Blood Pressure</p>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-display font-bold text-slate-900 tracking-tighter">
                {latest?.bloodPressure ? `${latest.bloodPressure.systolic}/${latest.bloodPressure.diastolic}` : '120/80'}
              </span>
              <span className="text-slate-400 font-medium">mmHg</span>
            </div>
          </div>
        </motion.div>

        {/* SpO2 */}
        <motion.div whileHover={{ y: -8, scale: 1.02 }} transition={{ type: 'spring', stiffness: 300 }} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 text-slate-50 opacity-50 pointer-events-none group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500">
            <Wind size={140} fill="currentColor" />
          </div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-6">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                <Wind size={24} />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Stable</span>
            </div>
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-1">Oxygen Saturation</p>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-display font-bold text-slate-900 tracking-tighter">
                {latestHealthData?.spo2 || '98'}
              </span>
              <span className="text-slate-400 font-medium">%</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Main Grid: Chart & Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Timeline Chart */}
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-2xl font-display font-bold text-slate-900">Vitals Timeline</h3>
              <p className="text-sm text-slate-500">Historical trend analysis</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
              <Clock size={14} className={supabaseConnected ? "text-emerald-500" : "text-slate-400"} />
              {supabaseConnected ? 'Live Data Sync' : 'Local History'}
            </div>
          </div>

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorHeart" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e11d48" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#e11d48" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorOxygen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#78716c" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#78716c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#a8a29e', fontSize: 11, fontWeight: 500 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#a8a29e', fontSize: 11, fontWeight: 500 }} />
                <Tooltip
                  cursor={{ stroke: '#e7e5e4', strokeWidth: 1, strokeDasharray: '4 4' }}
                  contentStyle={{ borderRadius: '16px', border: '1px solid #e7e5e4', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', fontWeight: 500, padding: '12px' }}
                />
                <Area type="monotone" dataKey="heartRate" stroke="#e11d48" strokeWidth={3} fillOpacity={1} fill="url(#colorHeart)" />
                {healthHistory.length > 0 && (
                  <Area type="monotone" dataKey="oxygen" stroke="#78716c" strokeWidth={2} fillOpacity={1} fill="url(#colorOxygen)" />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Health Analysis List */}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col relative overflow-hidden">
          <div className="relative z-10 flex-1 flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-200">
                <ShieldCheck size={20} className="text-slate-700" />
              </div>
              <div>
                <h3 className="text-xl font-display font-bold text-slate-900">Clinical Reports</h3>
                <p className="text-xs text-slate-500">Recent AI interpretations</p>
              </div>
            </div>

            <div className="flex-1 space-y-4">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader className="animate-spin text-crimson-600" size={24} />
                </div>
              ) : reports.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{reports[0].type}</div>
                      <div className="text-xs text-slate-500">{new Date(reports[0].timestamp).toLocaleDateString()}</div>
                    </div>
                    <button
                      onClick={() => setSelectedReport(reports[0])}
                      className="text-crimson-600 hover:text-crimson-700 text-sm font-semibold px-4 py-2 bg-crimson-50 rounded-xl transition-all hover:bg-crimson-100"
                    >
                      View
                    </button>
                  </div>

                  <div className="space-y-2">
                    {reports.slice(1, 4).map((report) => (
                      <div
                        key={report.id}
                        className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-all border border-transparent hover:border-slate-100"
                        onClick={() => setSelectedReport(report)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                            {report.type === 'Eye Scan' ? <Eye size={14} className="text-slate-600" /> : <Activity size={14} className="text-slate-600" />}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800 text-sm">{report.type}</div>
                            <div className="text-[10px] text-slate-500 uppercase tracking-wider">{report.status}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col items-center text-center gap-4 h-full justify-center">
                  <div className="p-3 bg-white rounded-full shadow-sm">
                    <FileText size={24} className="text-slate-400" />
                  </div>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    No clinical reports found. Upload a lab report or run a scan to generate insights.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Eye Analysis Uploader */}
      <div className="bg-white p-8 md:p-10 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute right-0 bottom-0 opacity-[0.03] pointer-events-none w-64 h-64 -mb-10 -mr-10">
          <Eye size={256} />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row gap-10">
          <div className="md:w-1/3">
            <h3 className="text-2xl font-display font-bold text-slate-900 mb-2">Corneal Arcus Detection</h3>
            <p className="text-slate-600 mb-6 leading-relaxed">
              Upload a high-resolution image of an eye to detect peripheral lipid rings (Arcus Senilis), a known biomarker for hypercholesterolemia.
            </p>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-sm text-slate-500 flex items-start gap-3">
              <Info size={16} className="mt-0.5 shrink-0 text-slate-400" />
              <p>Ensure good lighting and minimal reflections. Face the camera directly for best results.</p>
            </div>
          </div>

          <div className="md:w-2/3 flex flex-col gap-6">
            <label className="flex-1 cursor-pointer group">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setEyeImage(e.target.files?.[0] || null)}
                className="hidden"
                id="eye-image-input"
              />
              <div className="h-full min-h-[160px] p-8 border-2 border-dashed border-slate-200 rounded-3xl group-hover:border-crimson-400 group-hover:bg-crimson-50/30 transition-all flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4 border border-slate-100 group-hover:scale-110 transition-transform duration-300">
                  <Upload size={24} className="text-slate-400 group-hover:text-crimson-500" />
                </div>
                <p className="text-base font-bold text-slate-700">
                  {eyeImage ? eyeImage.name : 'Drag & drop or click to upload'}
                </p>
                <p className="text-sm text-slate-500 mt-1">PNG, JPG up to 10MB</p>
              </div>
            </label>

            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <button
                onClick={handleEyeAnalysis}
                disabled={!eyeImage || analyzing}
                className="w-full sm:w-auto px-8 py-3.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {analyzing ? <Loader size={18} className="animate-spin" /> : <Eye size={18} />}
                {analyzing ? 'Processing Analysis...' : 'Run Analysis'}
              </button>
            </div>

            {eyeAnalysis && (
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 mt-4 animate-in fade-in slide-in-from-bottom-4">
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Diagnostic Output</h4>
                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap font-mono text-sm">{eyeAnalysis}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedReport && (
        <ReportAnalysisModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;

