import React, { useState } from 'react';
import { Upload, FileText, Search, AlertCircle, CheckCircle2, Loader2, Image as ImageIcon } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const ReportAnalyzer: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
      setAnalysis(null);
    }
  };

  const downloadReportPDF = async () => {
    const reportElement = document.getElementById('report-summary');
    
    if (!reportElement) {
      alert('Report not found');
      return;
    }

    try {
      alert('Generating PDF...');
      const canvas = await html2canvas(reportElement, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= 297;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= 297;
      }

      pdf.save('Medical_Report.pdf');
      alert('PDF downloaded successfully!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF');
    }
  };

  const analyzeFile = async () => {
    if (!previewUrl || !selectedFile) return;

    setIsAnalyzing(true);
    setAnalysis(null);

    try {
      const base64Data = previewUrl.split(',')[1];
      
      const response = await fetch('http://localhost:5001/api/medical/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64Data,
          mimeType: selectedFile.type
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status}`);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned HTML instead of JSON. Check backend URL.");
      }

      const result = await response.json();
      
      if (result.success && result.analysis) {
        setAnalysis(result.analysis);
      } else {
        setAnalysis("⚠️ Analysis completed but no results returned.");
      }
      
    } catch (error: any) {
      console.error("Full Analysis Error:", error);
      
      if (error.message.includes('Failed to fetch')) {
        setAnalysis("❌ Cannot connect to backend. Is it running on port 5001?");
      } else if (error.message.includes('HTML')) {
        setAnalysis("❌ Wrong URL - getting HTML instead of API response. Check console.");
      } else {
        setAnalysis(`❌ Error: ${error.message}`);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="p-8 md:p-12 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      
      <div className="mb-10">
        <h2 className="text-4xl font-display font-bold text-slate-900 tracking-tight">Report Analyzer</h2>
        <p className="text-slate-600 font-medium text-lg mt-2">AI-powered medical document parsing</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Upload Section */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center justify-center min-h-[440px] text-center group hover:border-crimson-400 hover:shadow-md transition-all relative overflow-hidden">
            {/* Background Icon */}
            <div className="absolute -right-10 -bottom-10 opacity-[0.03] pointer-events-none">
              <FileText size={256} />
            </div>

            {previewUrl ? (
              <div className="w-full h-full flex flex-col items-center relative z-10">
                <img 
                  src={previewUrl} 
                  alt="Report Preview" 
                  className="max-h-[280px] w-auto rounded-xl shadow-lg mb-8 border border-slate-100 object-contain" 
                />
                <div className="flex w-full gap-4 mt-auto">
                  <button 
                    onClick={() => {setSelectedFile(null); setPreviewUrl(null); setAnalysis(null);}}
                    className="flex-1 py-3.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold transition-colors"
                  >
                    Clear
                  </button>
                  <button 
                    onClick={analyzeFile}
                    disabled={isAnalyzing}
                    className="flex-[2] py-3.5 bg-crimson-600 text-white rounded-xl hover:bg-crimson-700 font-bold transition-colors shadow-md flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:cursor-not-allowed"
                  >
                    {isAnalyzing ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                    {isAnalyzing ? 'Analyzing Document...' : 'Run Analysis'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-20 h-20 bg-ivory-50 border border-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-crimson-50 group-hover:text-crimson-600 transition-all shadow-sm">
                  <Upload size={32} />
                </div>
                <h3 className="text-xl font-display font-bold text-slate-900 mb-2">Upload Medical Report</h3>
                <p className="text-slate-500 mb-8 max-w-[280px] text-sm leading-relaxed">
                  Upload a clear photo of your lab results, blood work, or doctor's note for AI interpretation.
                </p>
                <label className="cursor-pointer bg-slate-900 text-white px-8 py-3.5 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-md">
                  Select File
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                </label>
                <p className="mt-6 text-xs font-semibold text-slate-400 uppercase tracking-widest">Supported: JPG, PNG (Max 5MB)</p>
              </div>
            )}
          </div>

          <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl flex gap-4">
            <AlertCircle size={24} className="text-emerald-600 shrink-0" />
            <div>
              <h4 className="font-bold text-emerald-900 mb-1 text-sm">How it works</h4>
              <p className="text-emerald-800 text-xs leading-relaxed opacity-90">
                Our AI scans the image to identify medical terminology and values. It cross-references normal ranges to help you understand your data before your doctor's visit.
              </p>
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="lg:col-span-7 flex flex-col h-full">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm min-h-[500px] flex-1 flex flex-col overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-200 to-slate-300"></div>
            {analysis && <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-crimson-400 to-crimson-600"></div>}

            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 className="text-lg font-display font-bold text-slate-900 flex items-center gap-2">
                <FileText size={20} className="text-slate-500" />
                Diagnostic Readout
              </h3>
              {analysis && (
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 uppercase tracking-widest bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200">
                  <CheckCircle2 size={12} />
                  Complete
                </span>
              )}
            </div>

            <div className="flex-1 p-8 bg-white overflow-y-auto custom-scrollbar">
              {!analysis && !isAnalyzing ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-6 opacity-60">
                  <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 shadow-sm">
                    <ImageIcon size={48} className="text-slate-300" />
                  </div>
                  <p className="text-sm font-semibold uppercase tracking-widest text-slate-400">Waiting for Document</p>
                </div>
              ) : isAnalyzing ? (
                <div className="h-full flex flex-col items-center justify-center space-y-6">
                  <div className="relative">
                    <Loader2 size={64} className="text-crimson-500 animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Search size={20} className="text-crimson-300" />
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <h4 className="text-lg font-bold text-slate-800">Processing Document</h4>
                    <p className="text-sm text-slate-500 animate-pulse">Running advanced OCR and clinical reasoning...</p>
                  </div>
                </div>
              ) : (
                <div id="report-summary" className="max-w-none text-slate-700 text-sm">
                  {analysis?.split('\n').map((line, i) => {
                    if (line.startsWith('#')) return <h4 key={i} className="text-slate-900 font-display font-bold text-lg mt-6 mb-3 border-b border-slate-100 pb-2">{line.replace(/#/g, '')}</h4>;
                    if (line.startsWith('*')) return <div key={i} className="flex gap-2 mb-2"><div className="w-1.5 h-1.5 rounded-full bg-crimson-500 mt-1.5 shrink-0"></div><p>{line.replace(/\*/g, '').trim()}</p></div>;
                    return <p key={i} className="mb-4 leading-relaxed">{line}</p>;
                  })}
                </div>
              )}
            </div>
            
            {analysis && (
              <div className="p-6 bg-slate-50 border-t border-slate-100">
                <button 
                  className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl hover:bg-slate-800 transition-colors shadow-md text-sm flex items-center justify-center gap-2"
                  onClick={downloadReportPDF}
                >
                  <FileText size={18} />
                  Export to PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportAnalyzer;
