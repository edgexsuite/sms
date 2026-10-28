import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, X, Send, Bot, User, Maximize2, Minimize2, 
  RefreshCw, MessageSquare, Brain, Zap, Activity, CheckCircle2,
  CalendarCheck, AlertCircle, Phone, ArrowUpRight, Copy, Check,
  Share2, Shield, Users, Receipt, Clock
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { streamGemini, fetchSchoolContext, buildSystemPrompt, SchoolContext } from '../lib/gemini';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';

interface Message {
  role: 'user' | 'model';
  text: string;
}

export default function AiAssistant() {
  const { userRole, schoolInfo } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = sessionStorage.getItem('edubot_chat_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [schoolContext, setSchoolContext] = useState<SchoolContext | null>(null);
  const [taskFeedback, setTaskFeedback] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Check if current user is an authorized executive/admin
  const isAuthorized = userRole && ['admin', 'director', 'principal', 'vice_principal', 'accountant', 'coordinator'].some(r => 
    userRole.role?.toLowerCase().includes(r)
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    try {
      sessionStorage.setItem('edubot_chat_history', JSON.stringify(messages));
    } catch {}
  }, [messages]);

  useEffect(() => {
    const handleToggle = () => setIsOpen(prev => !prev);
    window.addEventListener('toggle-ai-assistant', handleToggle);
    return () => window.removeEventListener('toggle-ai-assistant', handleToggle);
  }, []);

  useEffect(() => {
    if (isOpen && userRole?.school_id) {
      loadContext();
    }
  }, [isOpen, userRole?.school_id]);

  const loadContext = async () => {
    if (!userRole?.school_id) return;
    try {
      const ctx = await fetchSchoolContext(userRole.school_id);
      setSchoolContext(ctx);
    } catch (err) {
      console.warn('Failed to load AI context:', err);
    }
  };

  const handleSend = async (customPrompt?: string) => {
    const query = (customPrompt || input).trim();
    if (!query || isLoading) return;

    setInput('');
    const newMessages: Message[] = [...messages, { role: 'user', text: query }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const currentContext = schoolContext || { 
        studentCount: null, staffCount: null, presentToday: 0, absentToday: 0, 
        totalMarkedToday: 0, attPct: null, feeCollected: 0, feeDue: 0, 
        collectionPct: null, openComplaints: 0, pendingLeave: 0, date: new Date().toISOString().split('T')[0] 
      };
      
      const systemPrompt = buildSystemPrompt(currentContext, schoolInfo?.name || 'our school');
      let fullResponse = '';
      
      setMessages(prev => [...prev, { role: 'model', text: '' }]);

      for await (const chunk of streamGemini(systemPrompt, newMessages, currentContext, schoolInfo?.name || 'our school')) {
        fullResponse += chunk;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1].text = fullResponse;
          return updated;
        });
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'model', text: `Note: ${err.message || 'System encountered an issue. Using fallback response.'}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Task Execution Engine (Executes on behalf of Admin/Principal) ──────────
  const executeTask = async (taskName: string, params: any) => {
    try {
      setTaskFeedback('Executing task...');

      if (taskName === 'broadcast_notification') {
        const { error } = await supabase.from('notifications').insert([{
          school_id: userRole?.school_id,
          title: params.title,
          message: params.message,
          target_audience: params.target || 'all'
        }]);
        if (error) throw error;
        setTaskFeedback(`✅ Broadcast "${params.title}" posted successfully to school dashboard!`);
        setTimeout(() => setTaskFeedback(null), 4000);
      } 
      else if (taskName === 'prepare_whatsapp') {
        const phone = (params.phone || '').replace(/\D/g, '');
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(params.message || '')}`;
        window.open(url, '_blank');
        setTaskFeedback(`✅ WhatsApp opened for ${phone}.`);
        setTimeout(() => setTaskFeedback(null), 3000);
      }
      else if (taskName === 'approve_leave') {
        // Try leave_applications then leave_requests
        const { error: err1 } = await supabase
          .from('leave_applications')
          .update({ status: 'approved' })
          .eq('id', params.id);
        
        if (err1) {
          await supabase.from('leave_requests').update({ status: 'approved' }).eq('id', params.id);
        }
        setTaskFeedback(`✅ Leave application approved.`);
        loadContext();
        setTimeout(() => setTaskFeedback(null), 3000);
      }
      else if (taskName === 'reject_leave') {
        const { error: err1 } = await supabase
          .from('leave_applications')
          .update({ status: 'rejected' })
          .eq('id', params.id);
        
        if (err1) {
          await supabase.from('leave_requests').update({ status: 'rejected' }).eq('id', params.id);
        }
        setTaskFeedback(`Leave application rejected.`);
        loadContext();
        setTimeout(() => setTaskFeedback(null), 3000);
      }
      else if (taskName === 'resolve_complaint') {
        await supabase
          .from('complaints')
          .update({ status: 'resolved' })
          .eq('id', params.id);
        setTaskFeedback(`✅ Complaint marked as resolved.`);
        loadContext();
        setTimeout(() => setTaskFeedback(null), 3000);
      }
      else if (taskName === 'navigate_to') {
        navigate(params.path);
        setIsOpen(false);
      }
    } catch (err: any) {
      console.error('Task execution failed:', err);
      setTaskFeedback(`❌ Task Failed: ${err.message || 'Unknown error'}`);
      setTimeout(() => setTaskFeedback(null), 5000);
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Render message with embedded task blocks & interactive controls
  const renderMessageContent = (rawText: string, messageIndex: number) => {
    const taskMatch = rawText.match(/\[\[TASK:\s*([a-zA-Z0-9_]+),\s*([\s\S]*?)\]\]/);
    let cleanText = rawText;
    let taskBlock: React.ReactNode = null;

    if (taskMatch) {
      cleanText = rawText.replace(taskMatch[0], '').trim();
      const taskName = taskMatch[1];
      let params: any = {};
      try {
        params = JSON.parse(taskMatch[2]);
      } catch (e) {
        console.warn('Could not parse task parameters:', e);
      }

      if (taskName === 'broadcast_notification') {
        taskBlock = (
          <div className="mt-3 p-3 rounded-2xl bg-indigo-50 border border-indigo-100 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                Ready to Broadcast: <b>{params.title}</b>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-200/60 text-indigo-800 text-[10px] font-black uppercase">
                Audience: {params.target || 'All'}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={() => executeTask('broadcast_notification', params)}
                className="flex-1 py-2 px-3 bg-[#0071e3] hover:bg-[#0077ed] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Zap className="w-3.5 h-3.5" /> Confirm &amp; Broadcast to Dashboard
              </button>
              <button
                onClick={() => handleCopy(params.message || cleanText, messageIndex)}
                className="p-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs transition-colors"
                title="Copy text"
              >
                {copiedIndex === messageIndex ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        );
      } 
      else if (taskName === 'prepare_whatsapp') {
        taskBlock = (
          <div className="mt-3 p-3 rounded-2xl bg-emerald-50 border border-emerald-100 flex flex-col gap-2">
            <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-600" />
              WhatsApp Message Ready for {params.phone}
            </span>
            <button
              onClick={() => executeTask('prepare_whatsapp', params)}
              className="py-2 px-3 bg-[#25D366] hover:bg-[#20ba59] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Share2 className="w-3.5 h-3.5" /> Open in WhatsApp
            </button>
          </div>
        );
      }
      else if (taskName === 'show_absentees' && schoolContext?.recentAbsentees) {
        taskBlock = (
          <div className="mt-3 p-3 rounded-2xl bg-amber-50 border border-amber-100 flex flex-col gap-2 text-xs">
            <span className="font-bold text-amber-950 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              Today's Absent Students ({schoolContext.recentAbsentees.length})
            </span>
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {schoolContext.recentAbsentees.map((s, i) => (
                <div key={i} className="flex items-center justify-between bg-white p-2 rounded-xl border border-amber-200/60">
                  <span className="font-semibold text-slate-800">{s.name} <span className="text-[10px] text-slate-400">({s.class})</span></span>
                  <button
                    onClick={() => executeTask('prepare_whatsapp', {
                      phone: s.phone || '',
                      message: `Dear Parent, your child ${s.name} is marked ABSENT today at ${schoolInfo?.name || 'school'}. Please inform us if on leave.`
                    })}
                    className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-lg border border-emerald-200"
                  >
                    WhatsApp Alert
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => navigate('/attendance/daily-report')}
              className="text-[11px] font-bold text-indigo-600 hover:underline text-left mt-1"
            >
              View Full Attendance Sheet →
            </button>
          </div>
        );
      }
      else if (taskName === 'show_fee_defaulters' && schoolContext?.topDefaulters) {
        taskBlock = (
          <div className="mt-3 p-3 rounded-2xl bg-rose-50 border border-rose-100 flex flex-col gap-2 text-xs">
            <span className="font-bold text-rose-950 flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-rose-600" />
              Top Outstanding Accounts
            </span>
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {schoolContext.topDefaulters.map((d, i) => (
                <div key={i} className="flex items-center justify-between bg-white p-2 rounded-xl border border-rose-200/60">
                  <div>
                    <span className="font-semibold text-slate-800">{d.name}</span>
                    <p className="text-[10px] text-rose-600 font-bold">Due: PKR {d.dues.toLocaleString()}</p>
                  </div>
                  <button
                    onClick={() => executeTask('prepare_whatsapp', {
                      phone: d.phone || '',
                      message: `Dear Parent, this is a reminder from ${schoolInfo?.name || 'School'} regarding pending dues of PKR ${d.dues.toLocaleString()} for ${d.name}. Kindly submit dues at the earliest.`
                    })}
                    className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-lg border border-emerald-200"
                  >
                    Remind WhatsApp
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => navigate('/reports/arrears')}
              className="text-[11px] font-bold text-rose-700 hover:underline text-left mt-1"
            >
              Open Full Arrears Report →
            </button>
          </div>
        );
      }
      else if (taskName === 'review_leaves' && schoolContext?.pendingLeaveList) {
        taskBlock = (
          <div className="mt-3 p-3 rounded-2xl bg-indigo-50 border border-indigo-100 flex flex-col gap-2 text-xs">
            <span className="font-bold text-indigo-950 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              Pending Staff Leave Applications
            </span>
            <div className="space-y-2">
              {schoolContext.pendingLeaveList.map((l, i) => (
                <div key={i} className="bg-white p-2.5 rounded-xl border border-indigo-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900">{l.staffName}</span>
                    <span className="text-[10px] text-slate-500">{l.dates}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mb-2">Reason: {l.reason}</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => executeTask('approve_leave', { id: l.id })}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => executeTask('reject_leave', { id: l.id })}
                      className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold rounded-lg transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }
      else if (taskName === 'review_complaints' && schoolContext?.openComplaintList) {
        taskBlock = (
          <div className="mt-3 p-3 rounded-2xl bg-amber-50 border border-amber-100 flex flex-col gap-2 text-xs">
            <span className="font-bold text-amber-950 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
              Open Inquiries &amp; Complaints
            </span>
            <div className="space-y-2">
              {schoolContext.openComplaintList.map((c, i) => (
                <div key={i} className="bg-white p-2.5 rounded-xl border border-amber-100">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-bold text-slate-900">{c.title}</span>
                    <span className="text-[10px] text-slate-500 font-medium">From: {c.sender}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mb-2 line-clamp-2">{c.description}</p>
                  <button
                    onClick={() => executeTask('resolve_complaint', { id: c.id })}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition-colors"
                  >
                    Mark as Resolved
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      }
      else if (taskName === 'navigate_to') {
        taskBlock = (
          <div className="mt-2.5">
            <button
              onClick={() => executeTask('navigate_to', params)}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <ArrowUpRight className="w-3.5 h-3.5" /> {params.label || 'Open Section'}
            </button>
          </div>
        );
      }
    }

    return (
      <div className="space-y-2">
        <p className="whitespace-pre-wrap leading-relaxed">{cleanText}</p>
        {taskBlock}
      </div>
    );
  };

  return (
    <>
      {/* ── Floating Circular Trigger Button ─────────────────────────────── */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-[110] h-12 w-12 sm:h-13 sm:w-13 rounded-full flex items-center justify-center text-white shadow-[0_10px_25px_rgba(0,113,227,0.35)] transition-all duration-300 cursor-pointer",
          isOpen ? "opacity-0 pointer-events-none scale-0" : "opacity-100 scale-100",
          "bg-gradient-to-tr from-[#0071e3] to-sky-400 border border-white/40"
        )}
        title="Open AI Assistant (EduBot)"
      >
        <Sparkles className="w-6 h-6 text-white drop-shadow" />
      </motion.button>

      {/* ── Main AI Assistant Window ─────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className={cn(
              "fixed z-[120] bottom-4 right-4 sm:bottom-6 sm:right-6 flex flex-col bg-white/95 backdrop-blur-2xl border border-black/[0.08] shadow-[0_25px_70px_rgba(0,0,0,0.18)] rounded-[28px] overflow-hidden",
              isExpanded 
                ? "top-4 left-4 sm:top-6 sm:left-auto sm:w-[580px] h-[calc(100vh-2rem)]" 
                : "w-[calc(100vw-2rem)] sm:w-[420px] h-[580px] max-h-[85vh]"
            )}
          >
            {/* Header */}
            <div className="px-5 py-3.5 bg-gradient-to-b from-white to-[#fbfbfd] border-b border-black/[0.06] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#0071e3] to-sky-400 flex items-center justify-center text-white shadow-xs">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-[13px] font-bold text-[#1d1d1f]">EduBot Copilot</h3>
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-black uppercase">
                      Active
                    </span>
                  </div>
                  <p className="text-[10px] text-[#86868b] font-medium leading-none mt-0.5">
                    {schoolInfo?.name || 'School Management Executive AI'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 text-[#86868b]">
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-1.5 hover:bg-black/[0.04] rounded-lg hover:text-[#1d1d1f] transition-colors cursor-pointer"
                  title={isExpanded ? "Collapse" : "Expand"}
                >
                  {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Task Toast Notification */}
            {taskFeedback && (
              <div className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold text-center animate-fade-in shrink-0">
                {taskFeedback}
              </div>
            )}

            {/* Chat Body */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs font-medium custom-scrollbar"
            >
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 px-2 select-none">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#0071e3]">
                    <Sparkles className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="text-[#1d1d1f] font-semibold text-base tracking-tight">
                      How can I help you today?
                    </h4>
                    <p className="text-[#86868b] text-[12px] max-w-[280px] mt-1 leading-normal">
                      I can complete administrative tasks like broadcasting holiday notices, reviewing absentees, and messaging fee defaulters.
                    </p>
                  </div>

                  {/* Quick Task Pills */}
                  <div className="grid grid-cols-1 gap-1.5 w-full pt-1">
                    {[
                      { icon: '📢', label: 'Draft a Smog Holiday Notice', query: 'Draft a smog holiday notice for tomorrow and prepare broadcast' },
                      { icon: '📊', label: "Summarize Today's Attendance", query: "Who is absent today? Show today's attendance summary" },
                      { icon: '💳', label: 'Check Fee Collection & Defaulters', query: 'Show current fee collection status and top unpaid accounts' },
                      { icon: '📝', label: 'Review Pending Staff Leaves', query: 'Show pending staff leave applications' },
                      { icon: '🤝', label: 'Draft Parent Meeting (PTM) Circular', query: 'Draft an official circular for Parent-Teacher Meeting this Saturday' }
                    ].map((item, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSend(item.query)}
                        className="text-left text-[11px] font-medium text-[#1d1d1f] bg-black/[0.02] hover:bg-[#0071e3]/[0.08] hover:text-[#0071e3] p-2.5 rounded-xl transition-all border border-black/[0.04] flex items-center gap-2 cursor-pointer"
                      >
                        <span className="text-sm">{item.icon}</span>
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m, i) => (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={i}
                    className={cn(
                      "flex gap-2.5",
                      m.role === 'user' ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    <div className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-xs",
                      m.role === 'user' ? "bg-slate-200 text-slate-700" : "bg-[#0071e3] text-white"
                    )}>
                      {m.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                    </div>
                    <div className={cn(
                      "max-w-[85%] p-3.5 rounded-2xl text-[12.5px] leading-relaxed shadow-xs",
                      m.role === 'user' 
                        ? "bg-[#0071e3] text-white rounded-tr-none font-medium" 
                        : "bg-[#f5f5f7] text-[#1d1d1f] rounded-tl-none border border-black/[0.04]"
                    )}>
                      {renderMessageContent(m.text, i)}
                    </div>
                  </motion.div>
                ))
              )}

              {isLoading && (
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#0071e3] flex items-center justify-center text-white shrink-0 animate-pulse">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex items-center gap-1.5 p-3 rounded-2xl bg-[#f5f5f7] border border-black/[0.04]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0071e3] animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0071e3] animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0071e3] animate-bounce" />
                  </div>
                </div>
              )}
            </div>

            {/* Input Hub */}
            <div className="p-3.5 bg-white border-t border-black/[0.06] shrink-0">
              <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask EduBot to draft notices, check fees, or leaves..."
                  className="flex-1 bg-[#fbfbfd] border border-black/[0.08] focus:border-[#0071e3] focus:bg-white focus:ring-2 focus:ring-[#0071e3]/10 rounded-xl py-2 px-3 text-xs text-[#1d1d1f] placeholder:text-[#86868b] transition-all outline-none"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="w-9 h-9 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] disabled:opacity-40 text-white flex items-center justify-center transition-all shadow-xs shrink-0 cursor-pointer"
                  title="Send message"
                >
                  {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </form>

              <div className="mt-2 flex items-center justify-between text-[10px] text-[#86868b] px-1">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Free Autonomous School Copilot
                </span>
                <button
                  type="button"
                  onClick={() => setMessages([])}
                  className="hover:text-rose-600 transition-colors cursor-pointer"
                >
                  Clear History
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
