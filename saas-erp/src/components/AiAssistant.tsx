import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, X, Send, Bot, User, Maximize2, Minimize2, 
  RefreshCw, MessageSquare, Brain, Zap, Activity
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { streamGemini, fetchSchoolContext, buildSystemPrompt } from '../lib/gemini';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { Btn } from './ui';

export default function AiAssistant() {
  const { userRole, schoolInfo } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [schoolContext, setSchoolContext] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    const handleToggle = () => setIsOpen(true);
    window.addEventListener('toggle-ai-assistant', handleToggle);
    return () => window.removeEventListener('toggle-ai-assistant', handleToggle);
  }, []);

  useEffect(() => {
    if (isOpen && !schoolContext && userRole?.school_id) {
      loadContext();
    }
  }, [isOpen, userRole]);

  const loadContext = async () => {
    try {
      const ctx = await fetchSchoolContext(userRole!.school_id);
      setSchoolContext(ctx);
    } catch (err) {
      console.error('Failed to load AI context:', err);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      // Ensure we have a context, even if it's minimal
      const currentContext = schoolContext || { 
        studentCount: null, staffCount: null, presentToday: 0, absentToday: 0, 
        totalMarkedToday: 0, attPct: null, feeCollected: 0, feeDue: 0, 
        collectionPct: null, openComplaints: 0, pendingLeave: 0, date: new Date().toISOString().split('T')[0] 
      };
      
      const systemPrompt = buildSystemPrompt(currentContext, schoolInfo?.name || 'this school');
      let fullResponse = '';
      
      // Add empty message for model to stream into
      setMessages(prev => [...prev, { role: 'model', text: '' }]);

      for await (const chunk of streamGemini(systemPrompt, [...messages, { role: 'user', text: userMessage }])) {
        fullResponse += chunk;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1].text = fullResponse;
          return updated;
        });
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'model', text: `ERROR: ${err.message || 'Failed to get response.'}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const executeTask = async (taskName: string, params: any) => {
    try {
      if (taskName === 'broadcast_notification') {
        const { error } = await supabase.from('notifications').insert([{
          school_id: userRole?.school_id,
          title: params.title,
          message: params.message,
          target_audience: params.target || 'all'
        }]);
        if (error) throw error;
        setMessages(prev => [...prev, { role: 'model', text: `✅ SUCCESS: Broadcast "${params.title}" has been sent to ${params.target || 'all'}.` }]);
      } else if (taskName === 'prepare_whatsapp') {
        const url = `https://wa.me/${params.phone.replace(/\D/g, '')}?text=${encodeURIComponent(params.message)}`;
        window.open(url, '_blank');
        setMessages(prev => [...prev, { role: 'model', text: `✅ WhatsApp chat opened for ${params.phone}.` }]);
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'model', text: `❌ TASK FAILED: ${err.message}` }]);
    }
  };

  const renderMessage = (text: string, role: 'user' | 'model') => {
    // Check for task tags
    const taskMatch = text.match(/\[\[TASK: (.*?), (.*?)\]\]/);
    let cleanText = text;
    let taskAction: React.ReactNode = null;

    if (taskMatch) {
      cleanText = text.replace(taskMatch[0], '').trim();
      try {
        const name = taskMatch[1];
        const params = JSON.parse(taskMatch[2]);
        taskAction = (
          <div className="mt-3 pt-3 border-t border-white/10">
            <button
              onClick={() => executeTask(name, params)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
            >
              <Zap className="w-3.5 h-3.5" /> Run Task: {name.replace('_', ' ')}
            </button>
          </div>
        );
      } catch (e) {
        console.error('Failed to parse task:', e);
      }
    }

    return (
      <>
        <p className="whitespace-pre-wrap">{cleanText}</p>
        {taskAction}
      </>
    );
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <motion.button
        whileHover={{ scale: 1.1, rotate: 5 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-[110] w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-2xl transition-all duration-500",
          isOpen ? "opacity-0 pointer-events-none scale-0" : "opacity-100 scale-100",
          "bg-gradient-to-br from-indigo-600 via-indigo-500 to-sky-400 border border-white/20 shadow-indigo-500/40"
        )}
      >
        <div className="absolute inset-0 bg-white/20 rounded-2xl animate-pulse blur-xl" />
        <Sparkles className="w-7 h-7 relative z-10" />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20, x: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20, x: 20 }}
            className={cn(
              "fixed z-[120] bottom-6 right-6 flex flex-col bg-slate-950 border border-white/10 shadow-[0_32px_128px_-16px_rgba(0,0,0,0.8)] rounded-[2.5rem] overflow-hidden backdrop-blur-3xl",
              isExpanded ? "top-6 left-6 sm:left-auto sm:w-[500px]" : "w-[380px] h-[600px] max-h-[85vh]"
            )}
          >
            {/* AI Header */}
            <div className="p-6 bg-slate-900/50 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                    EduBot AI
                    <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">Automated Assistant</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsExpanded(!isExpanded)} 
                  className="p-2 hover:bg-white/5 rounded-lg text-slate-400 transition-colors"
                >
                  {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button 
                  onClick={() => setIsOpen(false)} 
                  className="p-2 hover:bg-rose-500/10 hover:text-rose-500 rounded-lg text-slate-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Chat Canvas */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar scroll-smooth"
            >
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-6 px-4">
                  <div className="w-20 h-20 rounded-3xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400 animate-bounce">
                    <Brain className="w-10 h-10" />
                  </div>
                  <div>
                    <h4 className="text-white font-black text-lg uppercase tracking-tight">Your Intelligent Copilot</h4>
                    <p className="text-slate-400 text-xs font-bold leading-relaxed max-w-[240px] mt-2">
                      I can now perform tasks like broadcasting notices or sending reminders.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 w-full">
                    {[
                      "Draft a holiday notice for tomorrow",
                      "Summarize today's attendance",
                      "What needs my attention?"
                    ].map(q => (
                      <button
                        key={q}
                        onClick={() => { setInput(q); }}
                        className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-white/5 p-3 rounded-xl hover:bg-indigo-600 hover:text-white transition-all border border-white/5 text-center"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m, i) => (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={i}
                    className={cn(
                      "flex gap-4",
                      m.role === 'user' ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-lg",
                      m.role === 'user' ? "bg-slate-800 text-slate-400" : "bg-indigo-600 text-white"
                    )}>
                      {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>
                    <div className={cn(
                      "max-w-[85%] p-4 rounded-2xl text-[13px] leading-relaxed",
                      m.role === 'user' 
                        ? "bg-indigo-600 text-white rounded-tr-none shadow-xl shadow-indigo-900/20 font-bold" 
                        : "bg-slate-900 text-slate-200 rounded-tl-none border border-white/5 shadow-2xl"
                    )}>
                      {renderMessage(m.text, m.role)}
                    </div>
                  </motion.div>
                ))
              )}
              {isLoading && (
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0 animate-pulse">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="flex items-center gap-1.5 p-4 rounded-2xl bg-slate-900 border border-white/5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" />
                  </div>
                </div>
              )}
            </div>

            {/* Input Hub */}
            <div className="p-6 bg-slate-900/50 border-t border-white/10">
              <form onSubmit={handleSend} className="relative flex items-center gap-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Message EduBot..."
                    className="w-full bg-slate-800 border-none rounded-2xl py-4 pl-6 pr-12 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 transition-all outline-none font-bold"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full transition-all duration-500",
                      schoolContext ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-slate-600"
                    )} />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="w-12 h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white flex items-center justify-center transition-all shadow-xl shadow-indigo-600/20 active:scale-95"
                >
                  {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </form>
              <div className="mt-4 flex items-center justify-between px-2">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-amber-500" />
                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Low Latency</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-3 h-3 text-emerald-500" />
                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Live Sync</span>
                  </div>
                </div>
                <button 
                  onClick={() => setMessages([])} 
                  className="text-[9px] font-black uppercase text-slate-500 hover:text-indigo-400 tracking-widest transition-colors"
                >
                  Clear Chat
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
