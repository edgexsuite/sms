import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Briefcase, Calendar, Search, Printer, Download,
  CheckCircle, XCircle, Clock, Coffee, Umbrella,
  AlertTriangle, ChevronDown, ChevronUp, Users,
} from 'lucide-react';
import { PageHeader, Card, Btn, Badge, Input } from '../../components/ui';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { exportToExcel } from '../../lib/exportUtils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AttendanceRow {
  id?: string;
  staff_id: string;
  date: string;
  status: string;
  arrival_time?: string | null;
  departure_time?: string | null;
  notes?: string | null;
}

interface StaffMember {
  id: string;
  full_name: string;
  role: string;
  department: string;
  photograph_url?: string;
  employment_type?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  present:  { label: 'Present',  color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle },
  absent:   { label: 'Absent',   color: 'bg-red-100 text-red-700 border-red-200',             icon: XCircle },
  late:     { label: 'Late',     color: 'bg-amber-100 text-amber-700 border-amber-200',       icon: Clock },
  leave:    { label: 'Leave',    color: 'bg-blue-100 text-blue-700 border-blue-200',          icon: Coffee },
  vacation: { label: 'Holiday',  color: 'bg-purple-100 text-purple-700 border-purple-200',    icon: Umbrella },
  half_day: { label: 'Half Day', color: 'bg-orange-100 text-orange-700 border-orange-200',    icon: AlertTriangle },
};

function workingHours(arrival?: string | null, departure?: string | null): string {
  if (!arrival || !departure) return '—';
  const [ah, am] = arrival.split(':').map(Number);
  const [dh, dm] = departure.split(':').map(Number);
  const totalMin = (dh * 60 + dm) - (ah * 60 + am);
  if (totalMin <= 0) return '—';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

function fmt12(t?: string | null): string {
  if (!t) return '—';
  const [hh, mm] = t.split(':').map(Number);
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const h = hh % 12 || 12;
  return `${h}:${mm.toString().padStart(2, '0')} ${ampm}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StaffDailyReport() {
  const { userRole } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [attMap, setAttMap] = useState<Record<string, AttendanceRow>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTimes, setEditTimes] = useState<{ arrival: string; departure: string; notes: string }>({ arrival: '', departure: '', notes: '' });

  const [departments, setDepartments] = useState<string[]>([]);
  const [schoolName, setSchoolName] = useState('');
  const [schoolLogo, setSchoolLogo] = useState('');
  const [sortCol, setSortCol] = useState<'name' | 'arrival' | 'departure' | 'hours'>('name');
  const [sortAsc, setSortAsc] = useState(true);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!userRole?.school_id) return;
    setLoading(true);

    const [{ data: stData }, { data: attData }, { data: sch }] = await Promise.all([
      supabase.from('staff')
        .select('id, full_name, role, department, employment_type, photograph_url')
        .eq('school_id', userRole.school_id)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .order('full_name'),
      supabase.from('attendance')
        .select('id, staff_id, date, status, arrival_time, departure_time, notes')
        .eq('school_id', userRole.school_id)
        .eq('date', date)
        .not('staff_id', 'is', null),
      supabase.from('schools').select('name, logo_url').eq('id', userRole.school_id).maybeSingle(),
    ]);

    if (stData) {
      setStaffList(stData);
      const depts = [...new Set(stData.map((s: any) => s.department).filter(Boolean))].sort() as string[];
      setDepartments(depts);
    }
    if (sch) { setSchoolName(sch.name || ''); setSchoolLogo(sch.logo_url || ''); }

    const map: Record<string, AttendanceRow> = {};
    (attData || []).forEach((a: any) => { map[a.staff_id] = a; });
    setAttMap(map);
    setLoading(false);
  }, [userRole?.school_id, date]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Save times ────────────────────────────────────────────────────────────

  const saveTimes = async (staffId: string) => {
    if (!userRole?.school_id) return;
    setSaving(staffId);
    const existing = attMap[staffId];
    const payload = {
      school_id: userRole.school_id,
      staff_id: staffId,
      date,
      status: existing?.status || 'present',
      arrival_time:   editTimes.arrival   || null,
      departure_time: editTimes.departure || null,
      notes: editTimes.notes || null,
    };
    if (existing?.id) {
      await supabase.from('attendance').update({
        arrival_time: payload.arrival_time,
        departure_time: payload.departure_time,
        notes: payload.notes,
      }).eq('id', existing.id);
    } else {
      await supabase.from('attendance').insert(payload);
    }
    setAttMap(prev => ({
      ...prev,
      [staffId]: { ...(prev[staffId] || { staff_id: staffId, date, status: 'present' }), ...payload },
    }));
    setEditingId(null);
    setSaving(null);
  };

  // ── Derived data ──────────────────────────────────────────────────────────

  const filtered = staffList
    .filter(s => {
      if (search && !s.full_name.toLowerCase().includes(search.toLowerCase())) return false;
      if (deptFilter && s.department !== deptFilter) return false;
      const att = attMap[s.id];
      if (statusFilter && (att?.status || 'present') !== statusFilter) return false;
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortCol === 'name') cmp = a.full_name.localeCompare(b.full_name);
      else if (sortCol === 'arrival')   cmp = (attMap[a.id]?.arrival_time || '').localeCompare(attMap[b.id]?.arrival_time || '');
      else if (sortCol === 'departure') cmp = (attMap[a.id]?.departure_time || '').localeCompare(attMap[b.id]?.departure_time || '');
      else if (sortCol === 'hours') {
        const hrs = (s: StaffMember) => {
          const att = attMap[s.id];
          if (!att?.arrival_time || !att?.departure_time) return -1;
          const [ah, am] = att.arrival_time.split(':').map(Number);
          const [dh, dm] = att.departure_time.split(':').map(Number);
          return (dh * 60 + dm) - (ah * 60 + am);
        };
        cmp = hrs(a) - hrs(b);
      }
      return sortAsc ? cmp : -cmp;
    });

  const counts = {
    total:    staffList.length,
    present:  staffList.filter(s => (attMap[s.id]?.status || 'present') === 'present').length,
    absent:   staffList.filter(s => attMap[s.id]?.status === 'absent').length,
    late:     staffList.filter(s => attMap[s.id]?.status === 'late').length,
    leave:    staffList.filter(s => attMap[s.id]?.status === 'leave').length,
    half_day: staffList.filter(s => attMap[s.id]?.status === 'half_day').length,
  };

  const avgArrival = (() => {
    const times = staffList.map(s => attMap[s.id]?.arrival_time).filter(Boolean) as string[];
    if (!times.length) return null;
    const avg = times.reduce((s, t) => {
      const [h, m] = t.split(':').map(Number);
      return s + h * 60 + m;
    }, 0) / times.length;
    return `${Math.floor(avg / 60).toString().padStart(2, '0')}:${Math.round(avg % 60).toString().padStart(2, '0')}`;
  })();

  const handleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortAsc(a => !a);
    else { setSortCol(col); setSortAsc(true); }
  };

  const exportData = () => {
    const rows = filtered.map(s => {
      const att = attMap[s.id];
      return {
        'Staff Name':      s.full_name,
        'Role':            s.role || '—',
        'Department':      s.department || '—',
        'Status':          STATUS_CONFIG[att?.status || 'present']?.label || 'Present',
        'Arrival Time':    fmt12(att?.arrival_time),
        'Departure Time':  fmt12(att?.departure_time),
        'Working Hours':   workingHours(att?.arrival_time, att?.departure_time),
        'Notes':           att?.notes || '',
      };
    });
    exportToExcel(rows, `Staff_Daily_Report_${date}`);
  };

  const SortIcon = ({ col }: { col: typeof sortCol }) =>
    sortCol === col
      ? sortAsc ? <ChevronUp className="w-3 h-3 inline ml-0.5" /> : <ChevronDown className="w-3 h-3 inline ml-0.5" />
      : <ChevronDown className="w-3 h-3 inline ml-0.5 opacity-30" />;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

      {/* ── Screen-only top bar ── */}
      <div className="no-print flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-black text-slate-900 uppercase tracking-tight">Staff Daily Report</h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Arrival · Departure · Working hours</p>
        </div>
        <div className="flex gap-2">
          <Btn variant="outline" size="sm" icon={Download} onClick={exportData}>Export</Btn>
          <Btn variant="outline" size="sm" icon={Printer} onClick={() => window.print()}>Print</Btn>
        </div>
      </div>

      {/* ── Print-only school header ── */}
      <div className="sdr-print-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {schoolLogo && (
            <img src={schoolLogo} alt={schoolName}
              style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', border: '1px solid #e2e8f0', flexShrink: 0 }} />
          )}
          <div>
            <p style={{ fontWeight: 900, fontSize: 15, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>{schoolName}</p>
            <p style={{ fontWeight: 700, fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 2 }}>
              Staff Daily Attendance Report
            </p>
          </div>
        </div>
        <p style={{ fontWeight: 700, fontSize: 9, color: '#475569', textAlign: 'right' }}>
          {new Date(date + 'T00:00:00').toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* ── Filters ── */}
      <Card className="p-4 no-print">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Input
            label="Date"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            icon={Calendar}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Search Staff</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Name…"
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Department</label>
            <select
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
            >
              <option value="">All Departments</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
            >
              <option value="">All Statuses</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 print:grid-cols-6 gap-3">
        {[
          { label: 'Total Staff',  value: counts.total,    color: 'bg-slate-50 border-slate-200',     text: 'text-slate-800' },
          { label: 'Present',      value: counts.present,  color: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
          { label: 'Absent',       value: counts.absent,   color: 'bg-red-50 border-red-200',         text: 'text-red-700' },
          { label: 'Late',         value: counts.late,     color: 'bg-amber-50 border-amber-200',     text: 'text-amber-700' },
          { label: 'On Leave',     value: counts.leave,    color: 'bg-blue-50 border-blue-200',       text: 'text-blue-700' },
          { label: 'Half Day',     value: counts.half_day, color: 'bg-orange-50 border-orange-200',   text: 'text-orange-700' },
        ].map(c => (
          <div key={c.label} className={cn('rounded-xl border px-4 py-3 text-center', c.color)}>
            <p className={cn('text-2xl font-black', c.text)}>{c.value}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* ── Avg Arrival Banner ── */}
      {avgArrival && (
        <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5 no-print">
          <Clock className="w-4 h-4 text-indigo-500 shrink-0" />
          <p className="text-xs font-bold text-indigo-700">
            Average arrival time today: <span className="font-black">{fmt12(avgArrival)}</span>
          </p>
        </div>
      )}

      {/* ── Table ── */}
      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center gap-3 text-slate-400">
            <Clock className="w-8 h-8 animate-spin" />
            <p className="text-sm font-bold">Loading attendance…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 flex flex-col items-center gap-3 text-slate-400">
            <Users className="w-10 h-10 opacity-20" />
            <p className="text-sm font-bold">No staff found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <button onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-slate-800">
                      Staff <SortIcon col="name" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Department / Role</th>
                  <th className="text-center px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                  <th className="text-center px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <button onClick={() => handleSort('arrival')} className="flex items-center gap-1 mx-auto hover:text-slate-800">
                      Arrival <SortIcon col="arrival" />
                    </button>
                  </th>
                  <th className="text-center px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <button onClick={() => handleSort('departure')} className="flex items-center gap-1 mx-auto hover:text-slate-800">
                      Departure <SortIcon col="departure" />
                    </button>
                  </th>
                  <th className="text-center px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <button onClick={() => handleSort('hours')} className="flex items-center gap-1 mx-auto hover:text-slate-800">
                      Hrs Worked <SortIcon col="hours" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Notes</th>
                  <th className="text-center px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest no-print">Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((s, idx) => {
                  const att = attMap[s.id];
                  const status = att?.status || 'present';
                  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.present;
                  const Icon = cfg.icon;
                  const isEditing = editingId === s.id;

                  return (
                    <React.Fragment key={s.id}>
                      <motion.tr
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.015 }}
                        className={cn('hover:bg-slate-50/80 transition-colors', isEditing && 'bg-indigo-50/50')}
                      >
                        {/* Name */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {s.photograph_url ? (
                              <img src={s.photograph_url} alt={s.full_name} className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-200" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-black text-indigo-700 shrink-0">
                                {s.full_name[0]}
                              </div>
                            )}
                            <div>
                              <p className="font-bold text-slate-900 text-sm leading-tight">{s.full_name}</p>
                              {s.employment_type && (
                                <p className="text-[10px] text-slate-400 capitalize">{s.employment_type.replace('_', ' ')}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Dept / Role */}
                        <td className="px-4 py-3">
                          <p className="text-xs font-bold text-slate-700">{s.department || '—'}</p>
                          <p className="text-[10px] text-slate-400 capitalize">{s.role || '—'}</p>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3 text-center">
                          <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black border', cfg.color)}>
                            <Icon className="w-3 h-3" />
                            {cfg.label}
                          </span>
                        </td>

                        {/* Arrival */}
                        <td className="px-4 py-3 text-center">
                          <span className={cn('text-sm font-black tabular-nums', att?.arrival_time ? 'text-emerald-700' : 'text-slate-300')}>
                            {fmt12(att?.arrival_time)}
                          </span>
                        </td>

                        {/* Departure */}
                        <td className="px-4 py-3 text-center">
                          <span className={cn('text-sm font-black tabular-nums', att?.departure_time ? 'text-indigo-700' : 'text-slate-300')}>
                            {fmt12(att?.departure_time)}
                          </span>
                        </td>

                        {/* Hours */}
                        <td className="px-4 py-3 text-center">
                          <span className={cn('text-sm font-black tabular-nums', att?.arrival_time && att?.departure_time ? 'text-slate-800' : 'text-slate-300')}>
                            {workingHours(att?.arrival_time, att?.departure_time)}
                          </span>
                        </td>

                        {/* Notes */}
                        <td className="px-4 py-3">
                          <span className="text-xs text-slate-500">{att?.notes || '—'}</span>
                        </td>

                        {/* Edit button */}
                        <td className="px-4 py-3 text-center no-print">
                          <button
                            onClick={() => {
                              if (isEditing) { setEditingId(null); return; }
                              setEditingId(s.id);
                              setEditTimes({
                                arrival:   att?.arrival_time   || '',
                                departure: att?.departure_time || '',
                                notes:     att?.notes         || '',
                              });
                            }}
                            className={cn(
                              'text-[10px] font-black px-2.5 py-1.5 rounded-lg border transition-all',
                              isEditing
                                ? 'bg-slate-100 text-slate-600 border-slate-200'
                                : 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100'
                            )}
                          >
                            {isEditing ? 'Cancel' : 'Edit'}
                          </button>
                        </td>
                      </motion.tr>

                      {/* Inline time editor */}
                      <AnimatePresence>
                        {isEditing && (
                          <motion.tr
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="no-print"
                          >
                            <td colSpan={8} className="px-4 pb-4 bg-indigo-50/40 border-b border-indigo-100">
                              <div className="flex flex-wrap items-end gap-3 pt-2">
                                <div>
                                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Arrival Time</label>
                                  <input
                                    type="time"
                                    value={editTimes.arrival}
                                    onChange={e => setEditTimes(p => ({ ...p, arrival: e.target.value }))}
                                    className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 font-bold text-emerald-700"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Departure Time</label>
                                  <input
                                    type="time"
                                    value={editTimes.departure}
                                    onChange={e => setEditTimes(p => ({ ...p, departure: e.target.value }))}
                                    className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 font-bold text-indigo-700"
                                  />
                                </div>
                                <div className="flex-1 min-w-[160px]">
                                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Notes</label>
                                  <input
                                    type="text"
                                    value={editTimes.notes}
                                    onChange={e => setEditTimes(p => ({ ...p, notes: e.target.value }))}
                                    placeholder="Optional remark…"
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                                  />
                                </div>
                                {editTimes.arrival && editTimes.departure && (
                                  <div className="px-3 py-2 bg-white border border-slate-200 rounded-xl">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Duration</p>
                                    <p className="text-sm font-black text-slate-800">{workingHours(editTimes.arrival, editTimes.departure)}</p>
                                  </div>
                                )}
                                <button
                                  onClick={() => saveTimes(s.id)}
                                  disabled={saving === s.id}
                                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-black rounded-xl transition-all"
                                >
                                  {saving === s.id ? 'Saving…' : 'Save'}
                                </button>
                              </div>
                            </td>
                          </motion.tr>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>

            {/* Print footer */}
            <div className="hidden print:flex justify-between items-center px-4 py-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 font-bold">
              <span>Total: {filtered.length} staff</span>
              <span>Present: {counts.present} · Absent: {counts.absent} · Late: {counts.late} · Leave: {counts.leave}</span>
              <span>Printed: {new Date().toLocaleDateString('en-PK')}</span>
            </div>
          </div>
        )}
      </Card>

      <style>{`
        /* ── Screen: hide the print-only header ── */
        .sdr-print-header { display: none; }

        @media print {
          @page { size: A4 landscape; margin: 6mm 8mm; }

          /* Show our own print header */
          .sdr-print-header {
            display: flex !important;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2px solid #1e293b;
            padding-bottom: 6px;
            margin-bottom: 6px;
          }

          /* ── Kill layout chrome ── */
          .no-print { display: none !important; }
          header, aside, nav { display: none !important; }

          /* Suppress the DashboardLayout global print header specifically
             (it's a sibling div before <main> with py-5 border-b-2 border-slate-300) */
          .flex-1.flex.flex-col > div:not(main):not(.sdr-wrapper) { display: none !important; }

          /* Remove all wrapper padding */
          body, #root { background: white !important; margin: 0 !important; padding: 0 !important; }
          .theme-shell { padding: 0 !important; overflow: visible !important; }
          main { padding: 0 !important; }

          /* ── Page content wrapper ── */
          .max-w-7xl { max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
          .space-y-6 > * + * { margin-top: 5px !important; }

          /* ── Summary cards: compact single row ── */
          .grid.print\\:grid-cols-6 { display: flex !important; gap: 4px !important; margin-bottom: 4px !important; }
          .grid.print\\:grid-cols-6 > div { flex: 1 !important; padding: 3px 5px !important; border-radius: 6px !important; }
          .grid.print\\:grid-cols-6 p:first-child { font-size: 13px !important; line-height: 1 !important; }
          .grid.print\\:grid-cols-6 p:last-child  { font-size: 6.5px !important; margin-top: 1px !important; }

          /* ── Table: very compact ── */
          table { font-size: 8px !important; border-collapse: collapse !important; width: 100% !important; }
          th    { padding: 3px 5px !important; font-size: 7px !important; }
          td    { padding: 2.5px 5px !important; }

          /* Avatar smaller */
          img.rounded-full, div.rounded-full.w-8 { width: 18px !important; height: 18px !important; font-size: 7px !important; }

          /* Status badge tighter */
          span.rounded-full { padding: 1px 4px !important; font-size: 7px !important; gap: 2px !important; }
          span.rounded-full svg { width: 8px !important; height: 8px !important; }

          /* No mid-row breaks */
          tbody tr { page-break-inside: avoid !important; }
        }
      `}</style>
    </div>
  );
}
