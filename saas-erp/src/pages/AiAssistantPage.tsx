import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bot, Sparkles, Send, RefreshCw, User, Check, Copy, 
  Share2, Zap, Phone, AlertCircle, Clock, MessageSquare, 
  Receipt, ArrowUpRight, CheckCircle2, ShieldCheck, Activity,
  Users, Building2, CalendarCheck
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { streamGemini, fetchSchoolContext, buildSystemPrompt, SchoolContext } from '../lib/gemini';
import { supabase } from '../lib/supabase';
import { PageHeader } from '../components/ui/PageHeader';

interface Message {
  role: 'user' | 'model';
  text: string;
}

export default function AiAssistantPage() {
  const { userRole, schoolInfo } = useAuth();
  const navigate = useNavigate();
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
    if (userRole?.school_id) {
      loadContext();
    }
  }, [userRole?.school_id]);

  const loadContext = async () => {
    if (!userRole?.school_id) return;
    try {
      const ctx = await fetchSchoolContext(userRole.school_id);
      setSchoolContext(ctx);
    } catch (err) {
      console.warn('Failed to load context:', err);
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
      setMessages(prev => [...prev, { role: 'model', text: `Note: ${err.message || 'Error communicating with assistant.'}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const executeTask = async (taskName: string, params: any) => {
    try {
      setTaskFeedback('Executing action on your behalf...');

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
          <div className="mt-3 p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                Ready to Broadcast: <b>{params.title}</b>
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-black uppercase">
                Audience: {params.target || 'All'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => executeTask('broadcast_notification', params)}
                className="flex-1 py-2 px-4 bg-[#0071e3] hover:bg-[#0077ed] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <Zap className="w-4 h-4" /> Confirm &amp; Broadcast to School Dashboard
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
          <div className="mt-3 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100 flex flex-col gap-2">
            <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-emerald-600" />
              WhatsApp Message Ready for {params.phone}
            </span>
            <button
              onClick={() => executeTask('prepare_whatsapp', params)}
              className="py-2 px-4 bg-[#25D366] hover:bg-[#20ba59] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Share2 className="w-4 h-4" /> Open in WhatsApp
            </button>
          </div>
        );
      }
      else if (taskName === 'show_absentees' && schoolContext?.recentAbsentees) {
        taskBlock = (
          <div className="mt-3 p-3.5 rounded-2xl bg-amber-50 border border-amber-100 flex flex-col gap-2 text-xs">
            <span className="font-bold text-amber-950 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              Today's Absent Students ({schoolContext.recentAbsentees.length})
            </span>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {schoolContext.recentAbsentees.map((s, i) => (
                <div key={i} className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-amber-200/60">
                  <span className="font-semibold text-slate-800">{s.name} <span className="text-[10px] text-slate-400">({s.class})</span></span>
                  <button
                    onClick={() => executeTask('prepare_whatsapp', {
                      phone: s.phone || '',
                      message: `Dear Parent, your child ${s.name} is marked ABSENT today at ${schoolInfo?.name || 'school'}. Please inform us if on leave.`
                    })}
                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-lg border border-emerald-200"
                  >
                    WhatsApp Alert
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      }
      else if (taskName === 'show_fee_defaulters' && schoolContext?.topDefaulters) {
        taskBlock = (
          <div className="mt-3 p-3.5 rounded-2xl bg-rose-50 border border-rose-100 flex flex-col gap-2 text-xs">
            <span className="font-bold text-rose-950 flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-rose-600" />
              Top Outstanding Accounts
            </span>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {schoolContext.topDefaulters.map((d, i) => (
                <div key={i} className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-rose-200/60">
                  <div>
                    <span className="font-semibold text-slate-800">{d.name}</span>
                    <p className="text-[10px] text-rose-600 font-bold">Due: PKR {d.dues.toLocaleString()}</p>
                  </div>
                  <button
                    onClick={() => executeTask('prepare_whatsapp', {
                      phone: d.phone || '',
                      message: `Dear Parent, this is a reminder from ${schoolInfo?.name || 'School'} regarding pending dues of PKR ${d.dues.toLocaleString()} for ${d.name}. Kindly submit dues at the earliest.`
                    })}
                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-lg border border-emerald-200"
                  >
                    Remind WhatsApp
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      }
      else if (taskName === 'review_leaves' && schoolContext?.pendingLeaveList) {
        taskBlock = (
          <div className="mt-3 p-3.5 rounded-2xl bg-indigo-50 border border-indigo-100 flex flex-col gap-2 text-xs">
            <span className="font-bold text-indigo-950 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-600" />
              Pending Staff Leave Applications
            </span>
            <div className="space-y-2">
              {schoolContext.pendingLeaveList.map((l, i) => (
                <div key={i} className="bg-white p-3 rounded-xl border border-indigo-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900">{l.staffName}</span>
                    <span className="text-[10px] text-slate-500">{l.dates}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mb-2">Reason: {l.reason}</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => executeTask('approve_leave', { id: l.id })}
                      className="px-3.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => executeTask('reject_leave', { id: l.id })}
                      className="px-3.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
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
      else if (taskName === 'navigate_to') {
        taskBlock = (
          <div className="mt-2.5">
            <button
              onClick={() => executeTask('navigate_to', params)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <ArrowUpRight className="w-4 h-4" /> {params.label || 'Open Section'}
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
    <div className="max-w-6xl mx-auto space-y-3.5 animate-aura-in pb-12">
      <PageHeader
        title="AI Executive Assistant"
        subtitle="Autonomous copilot for school management, broadcasting circulars, and instant administrative task execution."
        actions={
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Default Free Engine Active
            </span>
            <button
              onClick={() => setMessages([])}
              className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-colors"
            >
              Clear Conversation
            </button>
          </div>
        }
      />

      {/* Live School Context Strip */}
      {schoolContext && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <div className="bg-white rounded-xl border border-slate-200/80 p-2.5 shadow-xs">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Students</p>
            <p className="text-base font-black text-slate-800">{schoolContext.studentCount ?? '—'}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/80 p-2.5 shadow-xs">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Staff</p>
            <p className="text-base font-black text-slate-800">{schoolContext.staffCount ?? '—'}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/80 p-2.5 shadow-xs">
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Attendance</p>
            <p className="text-base font-black text-emerald-600">
              {schoolContext.attPct !== null ? `${schoolContext.attPct}%` : 'Pending'}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/80 p-2.5 shadow-xs">
            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Collection</p>
            <p className="text-base font-black text-indigo-600">
              {schoolContext.collectionPct !== null ? `${schoolContext.collectionPct}%` : '—'}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/80 p-2.5 shadow-xs">
            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Pending Leaves</p>
            <p className="text-base font-black text-amber-600">{schoolContext.pendingLeave}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/80 p-2.5 shadow-xs">
            <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Open Complaints</p>
            <p className="text-base font-black text-rose-600">{schoolContext.openComplaints}</p>
          </div>
        </div>
      )}

      {/* Task Feedback Banner */}
      {taskFeedback && (
        <div className="px-4 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-xs text-center animate-fade-in">
          {taskFeedback}
        </div>
      )}

      {/* Main Chat Interface */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col h-[600px] overflow-hidden">
        
        {/* Messages Scroll Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 custom-scrollbar">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-5 px-4 select-none">
              <div className="w-16 h-16 rounded-3xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#0071e3]">
                <Bot className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-slate-900 font-bold text-lg">
                  Welcome, Principal &amp; Executive Administrator
                </h3>
                <p className="text-slate-500 text-xs max-w-md mt-1">
                  I can draft circulars, broadcast notifications to all parents, review today's attendance, check fee defaulters, and approve staff leaves automatically.
                </p>
              </div>

              {/* Action Prompt Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 w-full max-w-3xl pt-2">
                {[
                  { title: '📢 Draft Smog Holiday Notice', desc: 'Prepares circular & broadcasts to dashboard', q: 'Draft a smog holiday notice for tomorrow and broadcast it' },
                  { title: '📊 Today’s Absent Students', desc: 'Checks attendance & lists absentees', q: 'Who is absent today? Show today attendance summary' },
                  { title: '💳 Top Fee Defaulters', desc: 'Summarizes dues & provides WhatsApp reminder', q: 'Show fee collection summary and top unpaid defaulters' },
                  { title: '📝 Review Staff Leaves', desc: 'Lists pending leave requests with 1-click approval', q: 'Show pending staff leave applications' },
                  { title: '🤝 Parent-Teacher Meeting', desc: 'Drafts official PTM circular for Saturday', q: 'Draft a circular for Parent-Teacher Meeting this Saturday' },
                  { title: '⚖️ Review Open Complaints', desc: 'Checks parent and student inquiries', q: 'Show open complaints that need attention' }
                ].map((item, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(item.q)}
                    className="text-left p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/60 hover:border-indigo-200 border border-slate-200/60 transition-all text-xs cursor-pointer group"
                  >
                    <p className="font-bold text-slate-800 group-hover:text-indigo-700">{item.title}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                key={i}
                className={cn(
                  "flex gap-3",
                  m.role === 'user' ? "flex-row-reverse" : "flex-row"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-xs",
                  m.role === 'user' ? "bg-slate-800 text-white" : "bg-[#0071e3] text-white"
                )}>
                  {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={cn(
                  "max-w-[80%] p-4 rounded-2xl text-[13px] leading-relaxed shadow-xs",
                  m.role === 'user' 
                    ? "bg-[#0071e3] text-white rounded-tr-none font-medium" 
                    : "bg-slate-50 text-slate-900 rounded-tl-none border border-slate-200/80"
                )}>
                  {renderMessageContent(m.text, i)}
                </div>
              </motion.div>
            ))
          )}

          {isLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#0071e3] flex items-center justify-center text-white shrink-0 animate-pulse">
                <Bot className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-1.5 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                <span className="w-2 h-2 rounded-full bg-[#0071e3] animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 rounded-full bg-[#0071e3] animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 rounded-full bg-[#0071e3] animate-bounce" />
              </div>
            </div>
          )}
        </div>

        {/* Bottom Input Field */}
        <div className="p-4 bg-slate-50 border-t border-slate-200/80">
          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask EduBot: 'Draft a holiday notice for tomorrow', 'Who is absent today?', 'Show fee defaulters'..."
              className="flex-1 bg-white border border-slate-200 focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/10 rounded-xl py-3 px-4 text-xs font-medium text-slate-900 placeholder:text-slate-400 transition-all outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="h-10 px-5 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>Send</span>
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
