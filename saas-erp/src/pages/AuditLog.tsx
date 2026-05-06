/**
 * AuditLog.tsx — Activity audit trail viewer for admins/principals.
 * Shows who did what, when. Filterable by module, action, user, date.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Shield, RefreshCw, Download, Search, Filter,
  ChevronDown, ChevronRight, Calendar, User,
  LogIn, LogOut, Plus, Pencil, Trash2, CreditCard,
  FileDown, Printer, CheckCircle, XCircle, Users,
  Info, Clock,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { exportToCSV } from '../lib/exportUtils';

// ─── Config ──────────────────────────────────────────────────────────────────
const PAGE_SIZE = 50;

const ACTION_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  LOGIN:   { label: 'Login',   color: 'bg-indigo-100 text-indigo-700',  icon: LogIn       },
  LOGOUT:  { label: 'Logout',  color: 'bg-slate-100  text-slate-600',   icon: LogOut      },
  CREATE:  { label: 'Create',  color: 'bg-emerald-100 text-emerald-700', icon: Plus        },
  UPDATE:  { label: 'Update',  color: 'bg-sky-100    text-sky-700',     icon: Pencil      },
  DELETE:  { label: 'Delete',  color: 'bg-rose-100   text-rose-700',    icon: Trash2      },
  PAY:     { label: 'Payment', color: 'bg-green-100  text-green-700',   icon: CreditCard  },
  REFUND:  { label: 'Refund',  color: 'bg-amber-100  text-amber-700',   icon: CreditCard  },
  EXPORT:  { label: 'Export',  color: 'bg-orange-100 text-orange-700',  icon: FileDown    },
  PRINT:   { label: 'Print',   color: 'bg-purple-100 text-purple-700',  icon: Printer     },
  APPROVE: { label: 'Approve', color: 'bg-teal-100   text-teal-700',    icon: CheckCircle },
  REJECT:  { label: 'Reject',  color: 'bg-red-100    text-red-700',     icon: XCircle     },
  ASSIGN:  { label: 'Assign',  color: 'bg-violet-100 text-violet-700',  icon: Users       },
  MARK:    { label: 'Mark',    color: 'bg-yellow-100 text-yellow-700',  icon: Pencil      },
};

const MODULE_COLOURS: Record<string, string> = {
  Auth:          'bg-indigo-50  text-indigo-600',
  Students:      'bg-blue-50    text-blue-600',
  Staff:         'bg-violet-50  text-violet-600',
  Fees:          'bg-emerald-50 text-emerald-600',
  Expenses:      'bg-orange-50  text-orange-600',
  Attendance:    'bg-sky-50     text-sky-600',
  Results:       'bg-amber-50   text-amber-600',
  Payroll:       'bg-lime-50    text-lime-700',
  Accounting:    'bg-teal-50    text-teal-600',
  Leave:         'bg-rose-50    text-rose-600',
  Timetable:     'bg-purple-50  text-purple-600',
  Settings:      'bg-slate-100  text-slate-600',
  Reports:       'bg-cyan-50    text-cyan-600',
  Communication: 'bg-pink-50    text-pink-600',
  Diary:         'bg-yellow-50  text-yellow-700',
  Library:       'bg-green-50   text-green-600',
  Inventory:     'bg-stone-100  text-stone-600',
  Transport:     'bg-red-50     text-red-600',
  Parents:       'bg-fuchsia-50 text-fuchsia-600',
};

const ROLE_COLOURS: Record<string, string> = {
  admin:               'bg-rose-100 text-rose-700',
  principal:           'bg-purple-100 text-purple-700',
  director:            'bg-indigo-100 text-indigo-700',
  vice_principal:      'bg-violet-100 text-violet-700',
  teacher:             'bg-sky-100 text-sky-700',
  accountant:          'bg-emerald-100 text-emerald-700',
  staff:               'bg-slate-100 text-slate-600',
  campus_coordinator:  'bg-teal-100 text-teal-700',
  academic_coordinator:'bg-blue-100 text-blue-700',
  section_coordinator: 'bg-cyan-100 text-cyan-700',
  librarian:           'bg-amber-100 text-amber-700',
};

function formatRelative(dateStr: string): string {
  const now = new Date();
  const d   = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1)  return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24)  return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7)  return `${diffDay}d ago`;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatFull(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AuditLog() {
  const { userRole } = useAuth();
  const sid = userRole?.school_id;

  const [logs,         setLogs]         = useState<any[]>([]);
  const [total,        setTotal]        = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [page,         setPage]         = useState(0);

  // Filters
  const [dateFrom,     setDateFrom]     = useState('');
  const [dateTo,       setDateTo]       = useState('');
  const [filterModule, setFilterModule] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterUser,   setFilterUser]   = useState('');
  const [search,       setSearch]       = useState('');

  // Summary stats
  const [stats, setStats] = useState<{
    today: number; week: number;
    topModules: { module: string; count: number }[];
    topUsers:   { user_name: string; user_role: string; count: number }[];
  } | null>(null);

  // Expanded row for metadata
  const [expanded, setExpanded] = useState<string | null>(null);

  // Realtime subscription ref
  const realtimeRef = useRef<any>(null);

  // ─── Fetch logs ────────────────────────────────────────────────────────────
  const fetchLogs = useCallback(async (resetPage = false) => {
    if (!sid) return;
    setLoading(true);
    const offset = resetPage ? 0 : page * PAGE_SIZE;
    if (resetPage) setPage(0);

    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .eq('school_id', sid)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (dateFrom)     query = query.gte('created_at', dateFrom + 'T00:00:00');
    if (dateTo)       query = query.lte('created_at', dateTo   + 'T23:59:59');
    if (filterModule) query = query.eq('module', filterModule);
    if (filterAction) query = query.eq('action', filterAction);
    if (filterUser)   query = query.ilike('user_name', `%${filterUser}%`);
    if (search)       query = query.ilike('description', `%${search}%`);

    const { data, count } = await query;
    setLogs(data || []);
    setTotal(count || 0);
    setLoading(false);
  }, [sid, page, dateFrom, dateTo, filterModule, filterAction, filterUser, search]);

  // ─── Fetch summary stats ───────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    if (!sid) return;
    const now    = new Date();
    const today  = now.toISOString().slice(0, 10);
    const weekAgo = new Date(now.getTime() - 7 * 864e5).toISOString().slice(0, 10);

    const [{ count: todayCount }, { count: weekCount }, { data: allRecent }] = await Promise.all([
      supabase.from('audit_logs').select('*', { count: 'exact', head: true })
        .eq('school_id', sid).gte('created_at', today + 'T00:00:00'),
      supabase.from('audit_logs').select('*', { count: 'exact', head: true })
        .eq('school_id', sid).gte('created_at', weekAgo + 'T00:00:00'),
      supabase.from('audit_logs').select('module,user_name,user_role')
        .eq('school_id', sid).gte('created_at', weekAgo + 'T00:00:00'),
    ]);

    // Count by module
    const modCounts: Record<string, number> = {};
    const userCounts: Record<string, { user_role: string; count: number }> = {};
    (allRecent || []).forEach((r: any) => {
      modCounts[r.module]  = (modCounts[r.module]  || 0) + 1;
      if (!userCounts[r.user_name]) userCounts[r.user_name] = { user_role: r.user_role, count: 0 };
      userCounts[r.user_name].count++;
    });

    const topModules = Object.entries(modCounts)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([module, count]) => ({ module, count }));

    const topUsers = Object.entries(userCounts)
      .sort((a, b) => b[1].count - a[1].count).slice(0, 5)
      .map(([user_name, v]) => ({ user_name, user_role: v.user_role, count: v.count }));

    setStats({ today: todayCount || 0, week: weekCount || 0, topModules, topUsers });
  }, [sid]);

  useEffect(() => { fetchLogs(true); fetchStats(); }, [sid, dateFrom, dateTo, filterModule, filterAction, filterUser, search]);
  useEffect(() => { if (page > 0) fetchLogs(); }, [page]);

  // ─── Realtime subscription ─────────────────────────────────────────────────
  useEffect(() => {
    if (!sid) return;
    const channel = supabase
      .channel('audit-realtime')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'audit_logs',
        filter: `school_id=eq.${sid}`,
      }, () => {
        fetchLogs(true);
        fetchStats();
      })
      .subscribe();
    realtimeRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [sid]);

  // ─── Export ────────────────────────────────────────────────────────────────
  const handleExport = () => {
    exportToCSV('audit-log', logs, [
      { header: 'Date/Time',   key: (r: any) => formatFull(r.created_at) },
      { header: 'User',        key: 'user_name' },
      { header: 'Role',        key: 'user_role' },
      { header: 'Action',      key: 'action' },
      { header: 'Module',      key: 'module' },
      { header: 'Entity',      key: 'entity_name' },
      { header: 'Description', key: 'description' },
    ]);
  };

  // ─── Distinct modules/actions from current data for filter dropdowns ───────
  const allModules = Array.from(new Set(logs.map(l => l.module))).sort();
  const allActions = Object.keys(ACTION_META);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto space-y-4">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-indigo-600" /> Audit Log
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Complete activity trail — who did what and when.
            <span className="ml-2 inline-flex items-center gap-1 text-emerald-600 text-xs font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
              Live
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { fetchLogs(true); fetchStats(); }}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-bold hover:bg-indigo-100 transition"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* ── Summary Stats ───────────────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

          {/* Today */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-indigo-400" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Today</p>
            </div>
            <p className="text-3xl font-black text-indigo-600">{stats.today}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">activities logged</p>
          </div>

          {/* This week */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-sky-400" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Last 7 Days</p>
            </div>
            <p className="text-3xl font-black text-sky-600">{stats.week}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">total activities</p>
          </div>

          {/* Top modules */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Most Active Modules</p>
            <div className="space-y-1">
              {stats.topModules.slice(0, 3).map(({ module, count }) => (
                <div key={module} className="flex items-center justify-between">
                  <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-full', MODULE_COLOURS[module] || 'bg-slate-100 text-slate-600')}>{module}</span>
                  <span className="text-[10px] font-black text-slate-500">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top users */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Most Active Users</p>
            <div className="space-y-1">
              {stats.topUsers.slice(0, 3).map(({ user_name, user_role, count }) => (
                <div key={user_name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <User className="w-3 h-3 text-slate-300 shrink-0" />
                    <span className="text-[10px] font-bold text-slate-700 truncate">{user_name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={cn('text-[9px] font-black px-1.5 py-0.5 rounded-full', ROLE_COLOURS[user_role] || 'bg-slate-100 text-slate-500')}>{user_role}</span>
                    <span className="text-[10px] font-black text-slate-400">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />

          {/* Search description */}
          <div className="relative min-w-[180px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search activity…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-indigo-400 outline-none"
            />
          </div>

          {/* User filter */}
          <input
            type="text"
            placeholder="Filter by user…"
            value={filterUser}
            onChange={e => setFilterUser(e.target.value)}
            className="px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-indigo-400 outline-none w-36"
          />

          {/* Module filter */}
          <div className="relative">
            <select
              value={filterModule}
              onChange={e => setFilterModule(e.target.value)}
              className="appearance-none px-3 pr-8 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-indigo-400 outline-none"
            >
              <option value="">All Modules</option>
              {Object.keys(MODULE_COLOURS).map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
          </div>

          {/* Action filter */}
          <div className="relative">
            <select
              value={filterAction}
              onChange={e => setFilterAction(e.target.value)}
              className="appearance-none px-3 pr-8 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-indigo-400 outline-none"
            >
              <option value="">All Actions</option>
              {allActions.map(a => (
                <option key={a} value={a}>{ACTION_META[a]?.label || a}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-indigo-400 outline-none" />
            <span className="text-slate-300 text-xs font-bold">→</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-indigo-400 outline-none" />
          </div>

          {/* Clear */}
          {(search || filterModule || filterAction || filterUser || dateFrom || dateTo) && (
            <button
              onClick={() => { setSearch(''); setFilterModule(''); setFilterAction(''); setFilterUser(''); setDateFrom(''); setDateTo(''); }}
              className="text-[10px] font-black text-rose-500 hover:text-rose-700 px-2 py-1 rounded-lg hover:bg-rose-50 transition"
            >
              Clear ×
            </button>
          )}
        </div>
      </div>

      {/* ── Log Table ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {loading ? 'Loading…' : `${total.toLocaleString()} record${total !== 1 ? 's' : ''}`}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2 text-xs">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                className="px-2 py-1 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition font-bold">‹</button>
              <span className="text-slate-500 font-bold">{page + 1} / {totalPages}</span>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                className="px-2 py-1 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition font-bold">›</button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="py-20 text-center">
            <Shield className="w-12 h-12 text-slate-100 mx-auto mb-3" />
            <p className="text-slate-300 font-bold text-sm">No activity found for the selected filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {logs.map(log => {
              const actionMeta = ACTION_META[log.action] || { label: log.action, color: 'bg-slate-100 text-slate-600', icon: Info };
              const ActionIcon = actionMeta.icon;
              const isExpanded = expanded === log.id;
              const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0;

              return (
                <div key={log.id} className={cn('px-4 py-3 hover:bg-slate-50/60 transition-colors', isExpanded && 'bg-slate-50')}>
                  <div className="flex items-start gap-3">

                    {/* Action icon */}
                    <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5', actionMeta.color)}>
                      <ActionIcon className="w-3.5 h-3.5" />
                    </div>

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        {/* User */}
                        <span className="text-sm font-black text-slate-900">{log.user_name}</span>
                        {/* Role */}
                        <span className={cn('text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase', ROLE_COLOURS[log.user_role] || 'bg-slate-100 text-slate-500')}>
                          {log.user_role}
                        </span>
                        {/* Action */}
                        <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-full', actionMeta.color)}>
                          {actionMeta.label}
                        </span>
                        {/* Module */}
                        <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-full', MODULE_COLOURS[log.module] || 'bg-slate-100 text-slate-600')}>
                          {log.module}
                        </span>
                        {log.entity_name && (
                          <span className="text-[10px] text-slate-400 font-medium truncate max-w-[160px]">
                            · {log.entity_name}
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      <p className="text-sm text-slate-600 font-medium leading-snug">{log.description}</p>

                      {/* Metadata expand */}
                      {hasMetadata && (
                        <>
                          <button
                            onClick={() => setExpanded(isExpanded ? null : log.id)}
                            className="mt-1 flex items-center gap-1 text-[10px] font-black text-indigo-500 hover:text-indigo-700 transition"
                          >
                            <ChevronRight className={cn('w-3 h-3 transition-transform', isExpanded && 'rotate-90')} />
                            {isExpanded ? 'Hide' : 'Show'} details
                          </button>
                          {isExpanded && (
                            <pre className="mt-2 text-[10px] bg-slate-900 text-slate-100 rounded-xl p-3 overflow-x-auto font-mono leading-relaxed">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          )}
                        </>
                      )}
                    </div>

                    {/* Timestamp */}
                    <div className="text-right shrink-0">
                      <p className="text-[11px] font-bold text-slate-400" title={formatFull(log.created_at)}>
                        {formatRelative(log.created_at)}
                      </p>
                      <p className="text-[9px] text-slate-300 mt-0.5">
                        {new Date(log.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
            <p className="text-[10px] text-slate-400 font-bold">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total.toLocaleString()}
            </p>
            <div className="flex items-center gap-2 text-xs">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition font-bold text-slate-600">
                ← Prev
              </button>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition font-bold text-slate-600">
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Usage tip ───────────────────────────────────────────────────── */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex gap-3">
        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-700">
          <p className="font-black mb-1">Adding audit logs to more pages</p>
          <p className="font-medium opacity-80">
            Import <code className="bg-indigo-100 px-1 rounded font-mono">logActivity</code> from <code className="bg-indigo-100 px-1 rounded font-mono">../../lib/auditLog</code> and call it after any important DB operation.
            Login/logout events are tracked automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
