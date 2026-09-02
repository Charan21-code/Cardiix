import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Info, FileText, Utensils, Sparkles } from 'lucide-react';
import { groqService } from '../services/groqService';
import { Message } from '../types';

const ChatAssistant: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      text: "Hello! I'm Cardiix, your AI health assistant. I can help you with:\n\n- Symptom analysis based on your reports\n- Personalized diet plans\n- Health insights and recommendations\n- General health questions\n\nHow can I assist you today?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [medicalReports, setMedicalReports] = useState<any[]>([]);
  const [reportsLoaded, setReportsLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMedicalReports();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const loadMedicalReports = async () => {
    try {
      const reports = await groqService.fetchMedicalReports();
      setMedicalReports(reports);
      setReportsLoaded(true);
    } catch (error) {
      console.error('Error loading reports:', error);
      setReportsLoaded(true);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', text: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    const userInput = input;
    setInput('');
    setIsLoading(true);

    try {
      const chatHistory = messages.map(m => ({ role: m.role, text: m.text }));
      chatHistory.push({ role: 'user', text: userInput });

      const response = await groqService.chatWithContext(chatHistory, medicalReports);

      const botMessage: Message = {
        role: 'model',
        text: response || "I'm sorry, I couldn't process that. Please try again.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'model',
        text: "An error occurred. Please check your AI connection.",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const generateDietPlan = async () => {
    if (isLoading) return;
    const userMessage: Message = { role: 'user', text: "Generate a personalized diet plan for me based on my medical history", timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    try {
      const response = await groqService.generateDietPlan("General health and wellness considering medical conditions", medicalReports);
      setMessages(prev => [...prev, { role: 'model', text: response, timestamp: new Date() }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: "Failed to generate diet plan.", timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const getHealthInsights = async () => {
    if (isLoading || medicalReports.length === 0) return;
    const userMessage: Message = { role: 'user', text: "Analyze my medical reports and give me health insights", timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    try {
      const response = await groqService.getHealthInsights(medicalReports);
      setMessages(prev => [...prev, { role: 'model', text: response, timestamp: new Date() }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: "Failed to generate insights.", timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white max-w-4xl mx-auto shadow-sm border-x border-slate-200 animate-in fade-in duration-500 relative">

      {/* Header Info */}
      <div className="px-8 py-5 bg-white border-b border-slate-100 flex items-center justify-between z-10 sticky top-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </div>
          <div>
            <h2 className="font-display font-bold text-slate-900 text-lg">Vivitsu AI</h2>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {medicalReports.length} Reports Synchronized
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-rose-600 font-semibold bg-rose-50 px-3 py-1.5 rounded-full border border-rose-100">
          <Info size={14} />
          Emergency? Call 911.
        </div>
      </div>

      {/* Quick Actions */}
      {reportsLoaded && (
        <div className="px-8 py-4 bg-slate-50 border-b border-slate-100 flex gap-3 overflow-x-auto custom-scrollbar">
          <button
            onClick={generateDietPlan}
            disabled={isLoading}
            className="px-5 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-100 transition-colors flex items-center gap-2 whitespace-nowrap disabled:opacity-50 shadow-sm"
          >
            <Utensils size={16} className="text-amber-500" />
            Get Diet Plan
          </button>
          <button
            onClick={getHealthInsights}
            disabled={isLoading || medicalReports.length === 0}
            className="px-5 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-100 transition-colors flex items-center gap-2 whitespace-nowrap disabled:opacity-50 shadow-sm"
          >
            <Sparkles size={16} className="text-amber-500" />
            Health Insights
          </button>
          <div className="px-5 py-2 bg-transparent text-slate-500 rounded-xl text-sm font-semibold flex items-center gap-2 whitespace-nowrap">
            <FileText size={16} />
            {medicalReports.length} Reports Analyzed
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-8 bg-[#fafafa]">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${msg.role === 'user' ? 'bg-crimson-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
              }`}>
              {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
            </div>
            <div className={`max-w-[85%] rounded-[1.5rem] p-6 shadow-sm ${msg.role === 'user'
                ? 'bg-crimson-600 text-white rounded-tr-none'
                : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
              }`}>
              <div className="prose prose-slate max-w-none text-sm leading-relaxed">
                {msg.text.split('\n').map((line, idx) => (
                  <p key={idx} className={`mb-2 last:mb-0 ${line.startsWith('-') ? 'ml-4' : ''} whitespace-pre-wrap`}>
                    {line}
                  </p>
                ))}
              </div>
              <div className={`text-[10px] mt-3 font-semibold opacity-50 uppercase tracking-widest ${msg.role === 'user' ? 'text-right' : ''}`}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
              <Bot size={20} className="text-crimson-600 animate-pulse" />
            </div>
            <div className="bg-white rounded-[1.5rem] p-6 border border-slate-200 rounded-tl-none flex items-center gap-3 shadow-sm">
              <Loader2 size={16} className="animate-spin text-crimson-600" />
              <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">Vivitsu is reasoning...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-8 border-t border-slate-200 bg-white">
        <div className="flex gap-4 items-end bg-slate-50 p-2 rounded-2xl border border-slate-200 focus-within:ring-2 focus-within:ring-crimson-500/50 focus-within:border-crimson-500 transition-all">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask about symptoms, diet, or health advice..."
            className="flex-1 min-h-[44px] max-h-[150px] p-3 pl-4 bg-transparent outline-none resize-none text-slate-800 text-sm font-medium"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="p-3 bg-crimson-600 text-white rounded-xl hover:bg-crimson-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md mb-1 mr-1"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatAssistant;

