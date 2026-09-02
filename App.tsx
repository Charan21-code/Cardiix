import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ChatAssistant from './components/ChatAssistant';
import ReportAnalyzer from './components/ReportAnalyzer';
import VitalScan from './components/VitalScan';
import LandingPage from './components/LandingPage';
import { AlertCircle } from 'lucide-react';

const DashboardLayout: React.FC = () => {
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  return (
    <div className="flex flex-col h-screen bg-[#fff2e8] overflow-hidden font-sans relative">
      {/* Disclaimer Modal */}
      {showDisclaimer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border border-crimson-100 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center gap-3 text-crimson-600 mb-4">
              <AlertCircle size={28} />
              <h2 className="text-xl font-display font-bold">Medical Disclaimer</h2>
            </div>
            <p className="text-slate-600 mb-6 leading-relaxed">
              Cardiix (Vivitsu Medical AI) is an AI assistant and is <strong>not a substitute for professional medical advice</strong>, diagnosis, or treatment. 
              Always seek the advice of your physician.
            </p>
            <button 
              onClick={() => setShowDisclaimer(false)}
              className="w-full bg-crimson-600 hover:bg-crimson-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg"
            >
              I Understand & Agree
            </button>
          </div>
        </div>
      )}

      {/* Top Floating Nav */}
      <div className="absolute top-6 left-0 right-0 z-40 flex justify-center pointer-events-none">
        <div className="pointer-events-auto">
          <Sidebar />
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative bg-[#fff2e8] pt-28">
        {/* Dynamic Content */}
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="scan" element={<VitalScan />} />
          <Route path="reports" element={<ReportAnalyzer />} />
          <Route path="chat" element={<ChatAssistant />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
