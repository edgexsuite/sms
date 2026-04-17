import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, User, Sparkles, TrendingUp, AlertCircle, CheckCircle, RefreshCw, DollarSign, Users, CalendarCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { fetchSchoolContext, buildSystemPrompt, streamGemini, SchoolContext } from '../lib/gemini';

interface Message {
  id: number;
  role: 'user' | 'model';
  text: string;
  streaming?: boolean;
}

const SUGGESTED = [
  "How is today's attendance looking?",
  "Which students have pending fees this month?",
  "Give me a summary of the school's current status.",
  "What should I focus on today?",
  "How many complaints are unresolved?",
  "Draft a fee reminder message for parents.",
];

export default function AIAssistant() {
  const { userRole } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, role: 'model', text: "Hello! I'm EduBot, your AI school assistant powered by Groq. I have live access to your school's attendance, fees, and staff data. How can I help you today?" }
  ]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [ctx, setCtx] = useState<SchoolContext | null>(null);
  const [schoolName, setSchoolName] = useState('School');
  const [ctxLoading, setCtxLoading] = useState(true);
  const [ctxError, setCtxError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (userRole?.school_id) loadContext();
  }, [userRole]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadContext = async () => {
    setCtxLoading(true);
    setCtxError('');
    try {
      const [context, { data: school, error: schoolError }] = await Promise.all([
        fetchSchoolContext(userRole!.school_id),
        supabase.from('schools').select('name').eq('id', userRole!.school_id).maybeSingle(),
      ]);

      if (schoolError) throw schoolError;

      setCtx(context);
      setSchoolName(school?.name || 'School');
    } catch (err: any) {
      setCtx(null);
      setCtxError(err.message || 'Failed to load AI assistant data.');
    } finally {
      setCtxLoading(false);
    }
  };

  const handleSend = async (text?: string) => {
    const userText = (text || query).trim();
    if (!userText || loading) return;
    setQuery('');

    const userMsg: Message = { id: Date.now(), role: 'user', text: userText };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    const botId = Date.now() + 1;
    setMessages(prev => [...prev, { id: botId, role: 'model', text: '', streaming: true }]);

    try {
      if (!ctx) {
        throw new Error(ctxError || 'Live school data is not available yet. Please refresh and try again.');
      }

      const systemPrompt = buildSystemPrompt(ctx, schoolName);
      const history = [...messages, userMsg]
        .filter(m => m.text.length > 0)
        .map(m => ({ role: m.role, text: m.text }));

      let fullText = '';
      for await (const chunk of streamGemini(systemPrompt, history)) {
        fullText += chunk;
        setMessages(prev => prev.map(m => m.id === botId ? { ...m, text: fullText } : m));
      }
      setMessages(prev => prev.map(m => m.id === botId ? { ...m, streaming: false } : m));
    } catch (err: any) {
      setMessages(prev => prev.map(m => m.id === botId
        ? { ...m, text: `Error: ${err.message || 'Failed to get response from Groq.'}`, streaming: false }
        : m
      ));
    }
    setLoading(false);
    inputRef.current?.focus();
  };

  const formatText = (text: string) => {
    // Simple markdown-like formatting
    return text
      .split('\n')
      .map((line, i) => {
        if (line.startsWith('**') && line.endsWith('**')) {
          return <p key={i} className="font-bold">{line.slice(2, -2)}</p>;
        }
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return <p key={i} className="ml-3">• {line.slice(2)}</p>;
        }
        if (line.startsWith('## ')) {
          return <p key={i} className="font-bold text-sm uppercase tracking-wide mt-1">{line.slice(3)}</p>;
        }
        if (line === '') return <br key={i} />;
        // Bold inline
        const parts = line.split(/\*\*(.+?)\*\*/g);
        return <p key={i}>{parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}</p>;
      });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Bot className="w-6 h-6 text-blue-600" /> AI Assistant
          <span className="ml-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">Groq</span>
        </h1>
        <button onClick={loadContext} disabled={ctxLoading}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
          <RefreshCw className={`w-3.5 h-3.5 ${ctxLoading ? 'animate-spin' : ''}`} />
          Refresh Data
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat Interface */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[620px]">
          <div className="px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-xl flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">EduBot</h2>
              <p className="text-xs text-blue-100">
                {ctxLoading
                  ? 'Loading school data...'
                  : ctxError
                    ? 'Live data unavailable'
                    : `${ctx?.studentCount ?? '?'} students · ${ctx?.staffCount ?? '?'} staff · Live data`}
              </p>
            </div>
          </div>

          <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-gray-50/30">
            {ctxError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {ctxError}
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-gray-200' : 'bg-blue-100'}`}>
                  {msg.role === 'user'
                    ? <User className="w-4 h-4 text-gray-600" />
                    : <Bot className="w-4 h-4 text-blue-600" />}
                </div>
                <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-none'
                    : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none shadow-sm'
                }`}>
                  {msg.role === 'model' ? formatText(msg.text) : msg.text}
                  {msg.streaming && (
                    <span className="inline-flex gap-0.5 ml-1">
                      <span className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="p-4 border-t border-gray-200 bg-white rounded-b-xl">
            <form onSubmit={e => { e.preventDefault(); handleSend(); }} className="flex gap-2">
              <input ref={inputRef}
                type="text" value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Ask about attendance, fees, students, staff..."
                disabled={loading || ctxLoading}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-full text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-gray-50"
              />
              <button type="submit" disabled={!query.trim() || loading || ctxLoading}
                className="p-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-40 transition-colors">
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Right Panel */}
        <div className="space-y-4">
          {/* Live Stats */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-yellow-500" />
              <h3 className="text-sm font-bold text-gray-900">Live School Stats</h3>
            </div>
            {ctxLoading ? (
              <div className="p-5 space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}
              </div>
            ) : ctx ? (
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <CalendarCheck className="w-5 h-5 text-blue-600 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-blue-900">Today's Attendance</p>
                    <p className="text-sm font-bold text-blue-700">
                      {ctx.attPct !== null ? `${ctx.attPct}%` : 'Not marked'}{' '}
                      {ctx.totalMarkedToday > 0 && <span className="text-xs font-normal">({ctx.presentToday}✓ {ctx.absentToday}✗)</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                  <DollarSign className="w-5 h-5 text-green-600 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-green-900">Fee Collection (This Month)</p>
                    <p className="text-sm font-bold text-green-700">
                      {ctx.collectionPct !== null ? `${ctx.collectionPct}%` : 'No data'}
                      {ctx.feeDue > 0 && <span className="text-xs font-normal ml-1">({ctx.feeCollected.toLocaleString()} / {ctx.feeDue.toLocaleString()})</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                  <Users className="w-5 h-5 text-purple-600 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-purple-900">School Strength</p>
                    <p className="text-sm font-bold text-purple-700">{ctx.studentCount} students · {ctx.staffCount} staff</p>
                  </div>
                </div>
                {ctx.openComplaints > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-red-900">Open Complaints</p>
                      <p className="text-sm font-bold text-red-700">{ctx.openComplaints} unresolved</p>
                    </div>
                  </div>
                )}
                {ctx.absentToday > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-orange-500 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-orange-900">Attention Needed</p>
                      <p className="text-sm font-bold text-orange-700">{ctx.absentToday} students absent today</p>
                    </div>
                  </div>
                )}
                {ctx.collectionPct !== null && ctx.collectionPct >= 90 && (
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-green-900">On Track</p>
                      <p className="text-sm font-bold text-green-700">Fee collection above 90%</p>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Suggested Queries */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-200">
              <h3 className="text-sm font-bold text-gray-900">Suggested Questions</h3>
            </div>
            <div className="p-3 space-y-1.5">
              {SUGGESTED.map((s, i) => (
                <button key={i} onClick={() => handleSend(s)} disabled={loading || ctxLoading}
                  className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-800 border border-gray-200 hover:border-blue-200 rounded-lg transition-colors disabled:opacity-40">
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
