import React, { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle, Search, Plus, MessageSquare, CheckCircle, Clock,
  X, Filter, ChevronRight, User, AlertCircle, RefreshCw,
  Send, ArrowRight, Flag, Inbox, ThumbsUp, Eye, Shield,
  ChevronDown, Paperclip, MoreHorizontal, Tag, Calendar,
  Bell, UserCheck, Zap, TrendingUp, BarChart2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatDate } from '../lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Complaint {
  id: string;
  school_id: string;
  user_id?: string;
  type: 'complaint' | 'feedback' | 'suggestion' | 'query';
  category: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'forwarded' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  submitted_by_type: 'parent' | 'teacher' | 'staff' | 'admin';
  submitted_by_name: string;
  forwarded_to_role?: string;
  resolution_notes?: string;
  resolved_by?: string;
  resolved_at?: string;
  responses: Array<{
    id: string;
    author_name: string;
    author_role: string;
    message: string;
    timestamp: string;
    is_internal?: boolean;
  }>;
  created_at: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Facilities', 'Transport', 'Academics', 'Discipline',
  'Staff Behavior', 'Fees / Billing', 'Cleanliness', 'Security',
  'Communication', 'Curriculum', 'IT / Technology', 'Other',
];

const PRIORITY_CFG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  low:    { label: 'Low',    color: 'text-gray-500',  bg: 'bg-gray-100',   dot: 'bg-gray-400'   },
  normal: { label: 'Normal', color: 'text-blue-600',  bg: 'bg-blue-50',    dot: 'bg-blue-500'   },
  high:   { label: 'High',   color: 'text-amber-600', bg: 'bg-amber-50',   dot: 'bg-amber-500'  },
  urgent: { label: 'Urgent', color: 'text-red-600',   bg: 'bg-red-50',     dot: 'bg-red-500'    },
};

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending:     { label: 'Pending',     color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-200'  },
  in_progress: { label: 'In Progress', color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200'   },
  forwarded:   { label: 'Forwarded',   color: 'text-purple-700', bg: 'bg-purple-50',  border: 'border-purple-200' },
  resolved:    { label: 'Resolved',    color: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-200'  },
  closed:      { label: 'Closed',      color: 'text-gray-600',   bg: 'bg-gray-100',   border: 'border-gray-200'   },
};

const TYPE_CFG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  complaint:  { label: 'Complaint',  icon: AlertTriangle, color: 'text-red-500'    },
  feedback:   { label: 'Feedback',   icon: ThumbsUp,      color: 'text-blue-500'   },
  suggestion: { label: 'Suggestion', icon: Zap,           color: 'text-amber-500'  },
  query:      { label: 'Query',      icon: MessageSquare, color: 'text-purple-500' },
};

const FORWARD_ROLES = ['principal', 'director', 'admin', 'accountant'];

// ── Helper ─────────────────────────────────────────────────────────────────────

const timeAgo = (dt: string) => {
  const diff = Date.now() - new Date(dt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};


// ── Main Component ─────────────────────────────────────────────────────────────

export default function Complaints() {
  const { userRole, user } = useAuth();
  const role = userRole?.role || '';
  const isAdmin = ['admin', 'principal', 'director'].includes(role);
  const isStaff = ['admin', 'principal', 'director', 'staff', 'teacher'].includes(role);

  const [loading,    setLoading]    = useState(true);
  const [items,      setItems]      = useState<Complaint[]>([]);
  const [selected,   setSelected]   = useState<Complaint | null>(null);
  const [search,     setSearch]     = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // New ticket modal
  const [showNew,    setShowNew]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [newForm, setNewForm] = useState({
    type: 'complaint' as Complaint['type'],
    category: '',
    title: '',
    description: '',
    priority: 'normal' as Complaint['priority'],
    submitted_by_name: '',
  });

  // Reply
  const [replyText,    setReplyText]    = useState('');
  const [replyInternal,setReplyInternal]= useState(false);
  const [sendingReply, setSendingReply] = useState(false);

  // Forward
  const [showForward,   setShowForward]   = useState(false);
  const [forwardTo,     setForwardTo]     = useState('');
  const [forwardNote,   setForwardNote]   = useState('');
  const [forwarding,    setForwarding]    = useState(false);

  // Resolve
  const [showResolve,   setShowResolve]   = useState(false);
  const [resolveNote,   setResolveNote]   = useState('');
  const [resolving,     setResolving]     = useState(false);

  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (userRole?.school_id) fetchItems();
  }, [userRole?.school_id, typeFilter, statusFilter, priorityFilter]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selected?.responses]);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchItems = async () => {
    setLoading(true);
    let q = supabase
      .from('complaints')
      .select('*')
      .eq('school_id', userRole!.school_id)
      .order('created_at', { ascending: false });

    // Parents only see their own
    if (role === 'parent' && userRole?.user_id) {
      q = q.eq('user_id', userRole.user_id);
    }
    if (typeFilter     !== 'all') q = q.eq('type',     typeFilter);
    if (statusFilter   !== 'all') q = q.eq('status',   statusFilter);
    if (priorityFilter !== 'all') q = q.eq('priority', priorityFilter);

    const { data: complaintData } = await q;
    if (!complaintData) { setLoading(false); return; }

    // Fetch all responses from the new table for these complaints in one query
    const complaintIds = complaintData.map(c => c.id);
    const { data: newResponses } = complaintIds.length > 0
      ? await supabase
          .from('complaint_responses')
          .select('*')
          .in('complaint_id', complaintIds)
          .order('created_at', { ascending: true })
      : { data: [] as any[] };

    const responsesByComplaint: Record<string, any[]> = {};
    (newResponses || []).forEach(r => {
      if (!responsesByComplaint[r.complaint_id]) responsesByComplaint[r.complaint_id] = [];
      responsesByComplaint[r.complaint_id].push({
        id:          r.id,
        author_name: r.author_name,
        author_role: r.author_role,
        message:     r.message,
        timestamp:   r.created_at,
        is_internal: r.is_internal,
      });
    });

    const rows = complaintData.map(r => {
      // Merge legacy JSONB responses + new table responses, sorted by timestamp
      const legacyResponses: any[] = Array.isArray(r.responses) ? r.responses : [];
      const tableResponses:  any[] = responsesByComplaint[r.id] || [];
      const merged = [...legacyResponses, ...tableResponses]
        .sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
      return {
        ...r,
        responses: merged,
        type:              r.type              || 'complaint',
        priority:          r.priority          || 'normal',
        submitted_by_type: r.submitted_by_type || 'staff',
        submitted_by_name: r.submitted_by_name || 'Unknown',
      };
    }) as Complaint[];

    setItems(rows);
    // Refresh selected ticket if open
    if (selected) {
      const refreshed = rows.find(r => r.id === selected.id);
      if (refreshed) setSelected(refreshed);
    }
    setLoading(false);
  };

  // ── Submit New ─────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.category || !newForm.title || !newForm.description) return;
    setSaving(true);
    const submitterName = newForm.submitted_by_name ||
      user?.user_metadata?.full_name || user?.email || role;

    const payload: any = {
      school_id:         userRole!.school_id,
      user_id:           userRole?.user_id || null,
      type:              newForm.type,
      category:          newForm.category,
      title:             newForm.title,
      description:       newForm.description,
      priority:          newForm.priority,
      status:            'pending',
      submitted_by_type: role as any,
      submitted_by_name: submitterName,
    };

    const { error } = await supabase.from('complaints').insert([payload]);
    if (!error) {
      setShowNew(false);
      setNewForm({ type: 'complaint', category: '', title: '', description: '', priority: 'normal', submitted_by_name: '' });
      fetchItems();
    } else {
      alert('Failed to submit: ' + error.message);
    }
    setSaving(false);
  };

  // ── Reply ──────────────────────────────────────────────────────────────────

  const handleReply = async () => {
    if (!replyText.trim() || !selected) return;
    setSendingReply(true);
    const authorName = user?.user_metadata?.full_name || user?.email || role;
    const newStatus = selected.status === 'pending' ? 'in_progress' : selected.status;

    // Insert response into dedicated table (no JSONB append — safe for concurrent writes)
    const { error: respErr } = await supabase.from('complaint_responses').insert([{
      complaint_id: selected.id,
      school_id:    userRole!.school_id,
      author_name:  authorName,
      author_role:  role,
      message:      replyText.trim(),
      is_internal:  replyInternal,
    }]);

    // Update complaint status if needed (separate from response write)
    if (!respErr && newStatus !== selected.status) {
      await supabase.from('complaints').update({ status: newStatus }).eq('id', selected.id);
    }

    if (!respErr) {
      setReplyText('');
      setReplyInternal(false);
      fetchItems();
    }
    setSendingReply(false);
  };

  // ── Forward ────────────────────────────────────────────────────────────────

  const handleForward = async () => {
    if (!forwardTo || !selected) return;
    setForwarding(true);
    const authorName = user?.user_metadata?.full_name || user?.email || role;

    // Insert system message into the responses table
    const { error: respErr } = await supabase.from('complaint_responses').insert([{
      complaint_id: selected.id,
      school_id:    userRole!.school_id,
      author_name:  authorName,
      author_role:  role,
      message:      `🔀 Forwarded to **${forwardTo}**${forwardNote ? `: ${forwardNote}` : ''}`,
      is_internal:  true,
    }]);

    // Update complaint status + forwarded_to_role
    if (!respErr) {
      await supabase.from('complaints')
        .update({ status: 'forwarded', forwarded_to_role: forwardTo })
        .eq('id', selected.id);
    }

    if (!respErr) {
      setShowForward(false);
      setForwardTo('');
      setForwardNote('');
      fetchItems();
    }
    setForwarding(false);
  };

  // ── Resolve ────────────────────────────────────────────────────────────────

  const handleResolve = async () => {
    if (!selected) return;
    setResolving(true);
    const authorName = user?.user_metadata?.full_name || user?.email || role;

    // Insert resolution note as a response if provided
    if (resolveNote.trim()) {
      await supabase.from('complaint_responses').insert([{
        complaint_id: selected.id,
        school_id:    userRole!.school_id,
        author_name:  authorName,
        author_role:  role,
        message:      `✅ Resolved: ${resolveNote}`,
        is_internal:  false,
      }]);
    }

    const { error } = await supabase.from('complaints')
      .update({
        status:           'resolved',
        resolution_notes: resolveNote || null,
        resolved_at:      new Date().toISOString(),
      })
      .eq('id', selected.id);

    if (!error) {
      setShowResolve(false);
      setResolveNote('');
      fetchItems();
    }
    setResolving(false);
  };

  // ── Filter / stats ─────────────────────────────────────────────────────────

  const filtered = items.filter(c => {
    const q = search.toLowerCase();
    return !q || c.title.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q) ||
      c.submitted_by_name?.toLowerCase().includes(q);
  });

  const stats = {
    total:      items.length,
    pending:    items.filter(c => c.status === 'pending').length,
    inProgress: items.filter(c => c.status === 'in_progress' || c.status === 'forwarded').length,
    resolved:   items.filter(c => c.status === 'resolved' || c.status === 'closed').length,
    urgent:     items.filter(c => c.priority === 'urgent').length,
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col">

      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Inbox className="w-7 h-7 text-indigo-500" />
            Complaints &amp; Feedback
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Manage grievances, feedback, queries and forward to the right authority.
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" /> New Ticket
        </button>
      </div>

      {/* ── Stats Row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        {[
          { label: 'Total',       value: stats.total,      icon: BarChart2,   color: 'text-gray-600 bg-gray-50'    },
          { label: 'Pending',     value: stats.pending,    icon: Clock,       color: 'text-amber-600 bg-amber-50'  },
          { label: 'In Progress', value: stats.inProgress, icon: TrendingUp,  color: 'text-blue-600 bg-blue-50'    },
          { label: 'Resolved',    value: stats.resolved,   icon: CheckCircle, color: 'text-green-600 bg-green-50'  },
          { label: 'Urgent',      value: stats.urgent,     icon: Zap,         color: 'text-red-600 bg-red-50'      },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3 shadow-sm">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{s.label}</p>
                <p className="text-xl font-black text-gray-900 leading-tight">{s.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Main Split Panel ───────────────────────────────────────────────── */}
      <div className="flex-1 flex gap-4 min-h-0">

        {/* Left: List ──────────────────────────────────────────────────────── */}
        <div className={`flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden ${selected ? 'hidden lg:flex w-80 shrink-0' : 'flex-1'}`}>

          {/* Filters toolbar */}
          <div className="p-3 border-b border-gray-100 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text" placeholder="Search tickets..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all"
              />
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {/* Type filter */}
              {['all', 'complaint', 'feedback', 'suggestion', 'query'].map(t => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold capitalize transition-all ${
                    typeFilter === t ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {t === 'all' ? 'All Types' : t}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <select
                value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="flex-1 text-[10px] font-bold bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none"
              >
                <option value="all">All Status</option>
                {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <select
                value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
                className="flex-1 text-[10px] font-bold bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none"
              >
                <option value="all">All Priority</option>
                {Object.entries(PRIORITY_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>

          {/* Ticket list */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {loading ? (
              <div className="p-12 flex flex-col items-center gap-2 text-gray-400">
                <RefreshCw className="w-7 h-7 animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-widest">Loading...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 flex flex-col items-center gap-3 text-gray-400">
                <CheckCircle className="w-10 h-10 text-gray-200" />
                <p className="text-sm font-medium">No tickets found</p>
              </div>
            ) : filtered.map(c => {
              const TypeIcon = TYPE_CFG[c.type]?.icon || AlertTriangle;
              const pCfg = PRIORITY_CFG[c.priority] || PRIORITY_CFG.normal;
              const sCfg = STATUS_CFG[c.status]     || STATUS_CFG.pending;
              const isSelected = selected?.id === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className={`w-full text-left p-4 transition-colors ${isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5 ${isSelected ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                      <TypeIcon className={`w-4 h-4 ${TYPE_CFG[c.type]?.color || 'text-gray-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full border ${sCfg.bg} ${sCfg.color} ${sCfg.border}`}>
                          <span className={`w-1 h-1 rounded-full ${pCfg.dot}`} />
                          {sCfg.label}
                        </span>
                        {c.priority === 'urgent' && (
                          <span className="text-[9px] font-black text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full border border-red-100">URGENT</span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-gray-900 truncate">{c.title}</p>
                      <p className="text-[10px] text-gray-400 truncate">{c.category} · {c.submitted_by_name}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[9px] text-gray-400">{timeAgo(c.created_at)}</p>
                      {(c.responses?.length || 0) > 0 && (
                        <span className="mt-1 inline-flex items-center gap-0.5 text-[9px] text-indigo-500 font-bold">
                          <MessageSquare className="w-2.5 h-2.5" /> {c.responses.length}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Detail / Thread ─────────────────────────────────────────── */}
        {selected ? (
          <div className="flex-1 flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-h-0">

            {/* Detail Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-start gap-3">
              <button
                onClick={() => setSelected(null)}
                className="lg:hidden shrink-0 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  {/* Type badge */}
                  <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-gray-100`}>
                    {React.createElement(TYPE_CFG[selected.type]?.icon || AlertTriangle, { className: `w-3 h-3 ${TYPE_CFG[selected.type]?.color}` })}
                    {TYPE_CFG[selected.type]?.label}
                  </span>
                  {/* Status */}
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${STATUS_CFG[selected.status]?.bg} ${STATUS_CFG[selected.status]?.color} ${STATUS_CFG[selected.status]?.border}`}>
                    {STATUS_CFG[selected.status]?.label}
                  </span>
                  {/* Priority */}
                  <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${PRIORITY_CFG[selected.priority]?.bg} ${PRIORITY_CFG[selected.priority]?.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_CFG[selected.priority]?.dot}`} />
                    {PRIORITY_CFG[selected.priority]?.label}
                  </span>
                  {selected.forwarded_to_role && (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                      → {selected.forwarded_to_role}
                    </span>
                  )}
                </div>
                <h2 className="font-black text-gray-900 text-base leading-tight truncate">{selected.title}</h2>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  <span className="font-bold text-gray-600">{selected.category}</span>
                  {' · '}Submitted by <span className="font-bold">{selected.submitted_by_name}</span>
                  {' · '}{formatDate(selected.created_at)}
                </p>
              </div>

              {/* Admin Actions */}
              {isAdmin && selected.status !== 'resolved' && selected.status !== 'closed' && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setShowForward(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs font-bold hover:bg-purple-100 transition-all"
                  >
                    <ArrowRight className="w-3.5 h-3.5" /> Forward
                  </button>
                  <button
                    onClick={() => setShowResolve(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-bold hover:bg-green-100 transition-all"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Resolve
                  </button>
                </div>
              )}
            </div>

            {/* Original Description */}
            <div className="px-5 py-4 border-b border-gray-50 bg-gray-50/50">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Original Issue</p>
              <p className="text-sm text-gray-700 leading-relaxed">{selected.description}</p>
              {selected.resolution_notes && selected.status === 'resolved' && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                  <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">Resolution Summary</p>
                  <p className="text-xs text-green-800">{selected.resolution_notes}</p>
                </div>
              )}
            </div>

            {/* Response Thread */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0">
              {(selected.responses || []).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
                  <MessageSquare className="w-8 h-8 text-gray-200" />
                  <p className="text-xs font-medium">No responses yet</p>
                  <p className="text-[10px]">Be the first to respond to this ticket.</p>
                </div>
              ) : (
                (selected.responses || []).map((resp, i) => {
                  const isInternal = resp.is_internal;
                  const isMe = resp.author_name === (user?.user_metadata?.full_name || user?.email || role);
                  return (
                    <div key={resp.id || i} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                      <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white ${
                        isInternal ? 'bg-purple-500' : isMe ? 'bg-indigo-500' : 'bg-gray-400'
                      }`}>
                        {resp.author_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-black text-gray-500">{resp.author_name}</span>
                          <span className="text-[9px] text-gray-400 capitalize">{resp.author_role}</span>
                          {isInternal && (
                            <span className="text-[9px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full border border-purple-100">
                              Internal
                            </span>
                          )}
                          <span className="text-[9px] text-gray-400">{timeAgo(resp.timestamp)}</span>
                        </div>
                        <div className={`px-4 py-2.5 rounded-2xl text-xs leading-relaxed ${
                          isInternal
                            ? 'bg-purple-50 border border-purple-100 text-purple-800'
                            : isMe
                              ? 'bg-indigo-600 text-white'
                              : 'bg-gray-100 text-gray-800'
                        }`}>
                          {resp.message}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={threadEndRef} />
            </div>

            {/* Reply Box */}
            {(selected.status !== 'closed') && (
              <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
                {isAdmin && (
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      onClick={() => setReplyInternal(false)}
                      className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${!replyInternal ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'}`}
                    >
                      <Eye className="w-3 h-3 inline mr-1" />Public
                    </button>
                    <button
                      onClick={() => setReplyInternal(true)}
                      className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${replyInternal ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-500'}`}
                    >
                      <Shield className="w-3 h-3 inline mr-1" />Internal Note
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <textarea
                    rows={2}
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleReply(); }}
                    placeholder={replyInternal ? 'Add internal note (staff only)...' : 'Type your response... (Ctrl+Enter to send)'}
                    className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-medium resize-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all"
                  />
                  <button
                    onClick={handleReply}
                    disabled={!replyText.trim() || sendingReply}
                    className="self-end px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                  >
                    {sendingReply ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Empty state — desktop only */
          <div className="hidden lg:flex flex-1 flex-col items-center justify-center bg-white rounded-2xl border border-gray-200 shadow-sm text-gray-300">
            <Inbox className="w-16 h-16 mb-3" />
            <p className="font-bold text-gray-500">Select a ticket to view details</p>
            <p className="text-sm text-gray-400 mt-1">Choose any ticket from the list on the left</p>
          </div>
        )}
      </div>

      {/* ── New Ticket Modal ───────────────────────────────────────────────── */}
      {showNew && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-7 py-5 flex justify-between items-center text-white">
              <div>
                <h3 className="text-lg font-black tracking-tight">New Ticket</h3>
                <p className="text-indigo-200 text-[10px] mt-0.5 font-bold uppercase tracking-widest">Submit Complaint · Feedback · Query</p>
              </div>
              <button onClick={() => setShowNew(false)} className="bg-white/15 hover:bg-white/25 p-2 rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-7 space-y-4 bg-gray-50">
              {/* Type */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 pl-1">Type</label>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.entries(TYPE_CFG) as any[]).map(([k, cfg]) => {
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={k} type="button"
                        onClick={() => setNewForm(f => ({ ...f, type: k as any }))}
                        className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border-2 text-[10px] font-bold transition-all ${
                          newForm.type === k
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${cfg.color}`} />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Category + Priority row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 pl-1">Category <span className="text-red-500">*</span></label>
                  <select
                    required value={newForm.category} onChange={e => setNewForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full bg-white border border-gray-200 px-3 py-2.5 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none"
                  >
                    <option value="">Select...</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 pl-1">Priority</label>
                  <select
                    value={newForm.priority} onChange={e => setNewForm(f => ({ ...f, priority: e.target.value as any }))}
                    className="w-full bg-white border border-gray-200 px-3 py-2.5 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none"
                  >
                    {Object.entries(PRIORITY_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Your Name (only if not auto-resolved) */}
              {!user?.user_metadata?.full_name && (
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 pl-1">Your Name <span className="text-red-500">*</span></label>
                  <input
                    required value={newForm.submitted_by_name}
                    onChange={e => setNewForm(f => ({ ...f, submitted_by_name: e.target.value }))}
                    className="w-full bg-white border border-gray-200 px-3 py-2.5 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none"
                    placeholder="Full name"
                  />
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 pl-1">Subject / Title <span className="text-red-500">*</span></label>
                <input
                  required value={newForm.title} onChange={e => setNewForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Brief subject line..."
                  className="w-full bg-white border border-gray-200 px-3 py-2.5 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 pl-1">Description <span className="text-red-500">*</span></label>
                <textarea
                  required rows={4} value={newForm.description}
                  onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the issue or feedback in detail..."
                  className="w-full bg-white border border-gray-200 px-3 py-2.5 rounded-xl text-xs font-medium resize-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none"
                />
              </div>
            </form>

            <div className="px-7 py-5 bg-white border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowNew(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition-all text-sm">
                Cancel
              </button>
              <button
                onClick={handleSubmit as any}
                disabled={saving}
                className="flex-[2] py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {saving ? 'Submitting...' : 'Submit Ticket'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Forward Modal ──────────────────────────────────────────────────── */}
      {showForward && selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-purple-700 px-7 py-5 flex justify-between items-center text-white">
              <div>
                <h3 className="text-lg font-black">Forward Ticket</h3>
                <p className="text-purple-200 text-[10px] font-bold uppercase tracking-widest mt-0.5">Escalate to higher authority</p>
              </div>
              <button onClick={() => setShowForward(false)} className="bg-white/15 hover:bg-white/25 p-2 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-7 bg-gray-50 space-y-4">
              <div className="bg-white p-4 rounded-xl border border-gray-100 text-sm">
                <p className="font-black text-gray-800 text-xs uppercase tracking-wide text-gray-500 mb-1">Ticket</p>
                <p className="font-bold text-gray-900">{selected.title}</p>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Forward To <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {FORWARD_ROLES.map(r => (
                    <button
                      key={r} type="button"
                      onClick={() => setForwardTo(r)}
                      className={`py-2.5 rounded-xl border-2 text-xs font-bold capitalize transition-all ${
                        forwardTo === r ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 bg-white text-gray-500 hover:border-purple-200'
                      }`}
                    >
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Note (optional)</label>
                <textarea
                  rows={2} value={forwardNote} onChange={e => setForwardNote(e.target.value)}
                  placeholder="Reason for escalation..."
                  className="w-full bg-white border border-gray-200 px-3 py-2.5 rounded-xl text-xs font-medium resize-none outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400"
                />
              </div>
            </div>
            <div className="px-7 py-5 bg-white border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowForward(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-2xl text-sm">Cancel</button>
              <button
                onClick={handleForward}
                disabled={!forwardTo || forwarding}
                className="flex-[2] py-3 bg-purple-700 text-white font-bold rounded-2xl hover:bg-purple-800 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {forwarding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                Forward Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Resolve Modal ──────────────────────────────────────────────────── */}
      {showResolve && selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-green-700 px-7 py-5 flex justify-between items-center text-white">
              <div>
                <h3 className="text-lg font-black">Resolve Ticket</h3>
                <p className="text-green-200 text-[10px] font-bold uppercase tracking-widest mt-0.5">Mark as resolved &amp; notify submitter</p>
              </div>
              <button onClick={() => setShowResolve(false)} className="bg-white/15 hover:bg-white/25 p-2 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-7 bg-gray-50 space-y-4">
              <div className="bg-white p-4 rounded-xl border border-gray-100">
                <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Ticket</p>
                <p className="font-bold text-gray-900 text-sm">{selected.title}</p>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Resolution Summary (optional)</label>
                <textarea
                  rows={3} value={resolveNote} onChange={e => setResolveNote(e.target.value)}
                  placeholder="Describe how this was resolved..."
                  className="w-full bg-white border border-gray-200 px-3 py-2.5 rounded-xl text-xs font-medium resize-none outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                />
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-xs text-green-800 font-medium">
                This will close the ticket and mark it as resolved. The submitter will see the resolution note.
              </div>
            </div>
            <div className="px-7 py-5 bg-white border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowResolve(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-2xl text-sm">Cancel</button>
              <button
                onClick={handleResolve}
                disabled={resolving}
                className="flex-[2] py-3 bg-green-700 text-white font-bold rounded-2xl hover:bg-green-800 transition-all text-sm flex items-center justify-center gap-2"
              >
                {resolving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Mark as Resolved
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
