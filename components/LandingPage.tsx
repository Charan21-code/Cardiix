import React from 'react';
import { motion } from 'framer-motion';
import { Activity, Eye, FileText, ArrowRight, ShieldCheck, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-orange-50 text-slate-900 font-sans selection:bg-orange-200 selection:text-orange-900 overflow-x-hidden">

      {/* Navigation */}
      <div className="px-12 py-6">
        <nav className="pointer-events-auto shadow-orange-900/10 rounded-full px-6 py-0 flex items-center justify-between w-11/12 max-w-5xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
              <Heart className="text-white" size={20} fill="currentColor" />
            </div>
            <span className="font-display font-bold text-4xl tracking-tight text-slate-900">Cardiix</span>
          </div>
        </nav>
      </div>

      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col md:flex-row items-center justify-center overflow-hidden px-6 pt-16 pb-12 gap-12 max-w-7xl mx-auto">
        <div className="absolute inset-x-0 bottom-0 -z-10 h-1/3 bg-white" />

        {/* Animated Background Orbs (Orange/Peach) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none -z-20">
          <motion.div
            animate={{
              y: [0, -50, 0],
              x: [0, 30, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-orange-200/50 rounded-full blur-3xl opacity-60 mix-blend-multiply"
          />
          <motion.div
            animate={{
              y: [0, 50, 0],
              x: [0, -40, 0],
              scale: [1, 1.2, 1],
            }}
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
            className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-amber-200/40 rounded-full blur-3xl opacity-50 mix-blend-multiply"
          />
        </div>

        {/* Left Column: Text */}
        <div className="flex-1 text-center md:text-left z-10 w-full">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-900/10 border border-orange-700/20 text-orange-700 font-medium text-sm mb-6 shadow-sm backdrop-blur-sm">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-600"></span>
              </span>
              Next-Gen Cardiovascular Screening
            </div>
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-display font-bold text-slate-950 leading-tight tracking-tight mb-8">
              Intelligence for <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-500">
                Your Vitality.
              </span>
            </h1>
            <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl leading-relaxed">
              Cardiix leverages advanced remote photoplethysmography (rPPG), computer vision, and clinical AI to provide non-invasive, instant cardiovascular insights.
            </p>

            <div className="flex flex-col sm:flex-row items-center md:items-start justify-center md:justify-start gap-4">
              <Link
                to="/dashboard"
                className="px-8 py-4 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold text-lg hover:shadow-xl hover:shadow-orange-500/20 transition-all flex items-center gap-3 w-full sm:w-auto justify-center"
              >
                Launch Dashboard
                <ArrowRight size={20} />
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Right Column: 3D Element */}
        <div className="flex-1 w-full max-w-lg z-10 hidden md:block" style={{ perspective: '1000px' }}>
          <motion.div
            animate={{
              rotateX: [5, -10, 5],
              rotateY: [-15, 10, -15],
              y: [-10, 10, -10]
            }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="w-full bg-white/80 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-2xl border border-white/50 relative"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* 3D Floating Inner Elements */}
            <motion.div
              className="absolute -right-8 -top-8 bg-orange-100 p-4 rounded-2xl shadow-xl border border-white"
              style={{ transform: 'translateZ(60px)' }}
            >
              <Heart size={32} className="text-orange-500" />
            </motion.div>

            <div style={{ transform: 'translateZ(30px)' }}>
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                  <Activity size={24} className="text-slate-600" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">Live Vitals</div>
                  <div className="text-2xl font-bold text-slate-800">Scanning...</div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="h-4 bg-slate-100 rounded-full w-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-orange-400 to-red-400"
                    animate={{ width: ["30%", "80%", "40%"] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>
                <div className="h-4 bg-slate-100 rounded-full w-4/5 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-red-400 to-rose-400"
                    animate={{ width: ["60%", "20%", "70%"] }}
                    transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>
                <div className="h-4 bg-slate-100 rounded-full w-3/4 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-amber-400 to-orange-400"
                    animate={{ width: ["40%", "90%", "50%"] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Pulse Animation Graphic */}
        <motion.div
          className="mt-20 w-full max-w-5xl h-32 relative border-b border-slate-200"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 1 }}
        >
          <svg className="w-full h-full" viewBox="0 0 1000 100" preserveAspectRatio="none">
            <motion.path
              d="M0,50 L300,50 L330,50 L350,10 L380,90 L410,30 L430,60 L450,50 L700,50 L730,50 L750,10 L780,90 L810,30 L830,60 L850,50 L1000,50"
              fill="none"
              stroke="#e11d48"
              strokeWidth="3"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 2, ease: "linear", repeat: Infinity, repeatType: "loop" }}
            />
          </svg>
        </motion.div>
      </section>

      {/* Science & Features Section */}
      <section className="py-32 px-6 bg-white relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="font-display font-bold text-4xl md:text-5xl text-slate-950 mb-4">The Science Behind Cardiix</h2>
            <p className="text-slate-600 text-lg max-w-2xl mx-auto">Three core pillars of multi-modal, non-invasive health analysis operating seamlessly on the edge.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1, duration: 0.5 }}
              whileHover={{ y: -10, scale: 1.02 }}
              className="bg-white p-10 rounded-3xl border border-slate-200 shadow-md hover:shadow-xl hover:border-crimson-200 transition-all duration-300 group"
            >
              <div className="w-16 h-16 rounded-2xl bg-crimson-50 shadow-sm flex items-center justify-center mb-8 border border-crimson-100 group-hover:border-crimson-200 transition-colors">
                <Activity className="text-crimson-600" size={32} />
              </div>
              <h3 className="font-display font-bold text-2xl text-slate-900 mb-4">rPPG Vital Scanning</h3>
              <p className="text-slate-600 leading-relaxed">
                Utilizing Plane-Orthogonal-to-Skin (POS) algorithms and Fast Fourier Transforms (FFT) to extract heart rate, HRV, and blood pressure estimates purely from webcam video.
              </p>
            </motion.div>

            {/* Feature 2 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.5 }}
              whileHover={{ y: -10, scale: 1.02 }}
              className="bg-white p-10 rounded-3xl border border-slate-200 shadow-md hover:shadow-xl hover:border-crimson-200 transition-all duration-300 group"
            >
              <div className="w-16 h-16 rounded-2xl bg-crimson-50 shadow-sm flex items-center justify-center mb-8 border border-crimson-100 group-hover:border-crimson-200 transition-colors">
                <Eye className="text-crimson-600" size={32} />
              </div>
              <h3 className="font-display font-bold text-2xl text-slate-900 mb-4">Corneal Arcus Detection</h3>
              <p className="text-slate-600 leading-relaxed">
                Advanced spatial computer vision (Hough Circles & telea inpainting) analyzes high-res eye imagery for Arcus Senilis, a visual biomarker for systemic hypercholesterolemia.
              </p>
            </motion.div>

            {/* Feature 3 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3, duration: 0.5 }}
              whileHover={{ y: -10, scale: 1.02 }}
              className="bg-white p-10 rounded-3xl border border-slate-200 shadow-md hover:shadow-xl hover:border-crimson-200 transition-all duration-300 group"
            >
              <div className="w-16 h-16 rounded-2xl bg-crimson-50 shadow-sm flex items-center justify-center mb-8 border border-crimson-100 group-hover:border-crimson-200 transition-colors">
                <FileText className="text-crimson-600" size={32} />
              </div>
              <h3 className="font-display font-bold text-2xl text-slate-900 mb-4">AI OCR Lipid Parsing</h3>
              <p className="text-slate-600 leading-relaxed">
                Drag-and-drop physical lab reports for instant Tesseract OCR extraction. Powered by Groq and Gemini models to provide clinical summaries and dietary recommendations.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Compliance / Footer */}
      <footer className="py-12 border-t border-slate-200 bg-white px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3 text-slate-600">
            <ShieldCheck size={24} />
            <span className="text-sm">Strictly for educational & early-screening purposes. Not a certified medical device.</span>
          </div>
          <div className="font-display font-bold text-xl text-slate-700">
            Cardiix
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
