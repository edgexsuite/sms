import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Briefcase, CalendarCheck, CheckCircle, XCircle, Clock,
  Save, Hash, Umbrella, Coffee, Sun, Calendar,
  LogIn, LogOut, AlertTriangle,
} from 'lucide-react';
import { PageHeader, Card, Btn, Badge, Input, EmptyState } from '../../components/ui';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type Session = 'arrival' | 'departure';

interface AttRow {
  id?: string;
  status: string;
  arrival_time?: string | null;
  departure_time?: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ARRIVAL_STATUSES = [
  { key: 'present',          icon: CheckCircle, label: 'Present',  bg: 'bg-emerald-600' },
  { key: 'late',             icon: Clock,       label: 'Late',     bg: 'bg-amber-500'   },
  { key: 'absent',           icon: XCircle,     label: 'Absent',   bg: 'bg-rose-600'    },
  { key: 'half_day',         icon: Hash,        label: 'Half Day', bg: 'bg-indigo-600'  },
  { key: 'complementary_off',icon: Coffee,      label: 'Paid Off', bg: 'bg-slate-700'   },
];

const STATUS_STYLE: Record<string, string> = {
  present:           'border-emerald-100 bg-emerald-50/30',
  late:              'border-amber-100   bg-amber-50/30',
  absent:            'border-rose-100    bg-rose-50/30',
  half_day:          'border-indigo-100  bg-indigo-50/30',
  complementary_off: 'border-slate-200   bg-slate-50',
  vacation:          'border-purple-100  bg-purple-50/30',
};

const STATUS_BADGE: Record<string, string> = {
  present:           'bg-emerald-100 text-emerald-700',
  late:              'bg-amber-100   text-amber-700',
  absent:            'bg-rose-100    text-rose-700',
  half_day:          'bg-indigo-100  text-indigo-700',
  complementary_off: 'bg-slate-100   text-slate-600',
  vacation:          'bg-purple-100  text-purple-700',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Current time in Pakistan Standard Time (GMT+5), returns "HH:MM" */
function nowTime() {
  const parts = new Intl.DateTimeFormat('en-PK', {
    timeZone: 'Asia/Karachi',
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   false,
  }).formatToParts(new Date());
  const h = parts.find(p => p.type === 'hour')?.value   ?? '00';
  const m = parts.find(p => p.type === 'minute')?.value ?? '00';
  // Intl may return '24' for midnight — normalise
  return `${h === '24' ? '00' : h}:${m}`;
}

function fmt12(t?: string | null) {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${m.toString().padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StaffAttendance() {
  const { userRole, user } = useAuth();

  const [date, setDate]             = useState(new Date().toISOString().split('T')[0]);
  const [session, setSession]       = useState<Session>('arrival');
  const [staffList, setStaffList]   = useState<any[]>([]);
  const [attMap, setAttMap]         = useState<Record<string, AttRow>>({});
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [vacationToday, setVacation]= useState<any>(null);
  const [isSunday, setIsSunday]     = useState(false);
  const [savedMsg, setSavedMsg]     = useState('');

  // ── Fetch ───────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!userRole?.school_id) return;
    setLoading(true);

    const d = new Date(date);
    setIsSunday(d.getDay() === 0);

    const [{ data: stData }, { data: attData }, { data: vacData }] = await Promise.all([
      supabase.from('staff')
        .select('id, full_name, role, department, employment_type, photograph_url')
        .eq('school_id', userRole.school_id)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .order('full_name'),
      supabase.from('attendance')
        .select('id, staff_id, status, arrival_time, departure_time')
        .eq('school_id', userRole.school_id)
        .eq('date', date)
        .not('staff_id', 'is', null),
      supabase.from('vacations')
        .select('*')
        .eq('school_id', userRole.school_id)
        .lte('start_date', date)
        .gte('end_date', date)
        .limit(1),
    ]);

    setVacation(vacData && vacData.length > 0 ? vacData[0] : null);
    if (stData) setStaffList(stData);

    const map: Record<string, AttRow> = {};
    const isHoliday = d.getDay() === 0 || (vacData && vacData.length > 0);
    stData?.forEach(s => {
      map[s.id] = { status: isHoliday ? (d.getDay() === 0 ? 'present' : 'vacation') : 'present' };
    });
    attData?.forEach((a: any) => {
      map[a.staff_id] = { id: a.id, status: a.status, arrival_time: a.arrival_time, departure_time: a.departure_time };
    });
    setAttMap(map);
    setLoading(false);
  }, [userRole?.school_id, date]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Mark all helpers ────────────────────────────────────────────────────────

  const markAllStatus = (status: string) =>
    setAttMap(prev => {
      const next = { ...prev };
      staffList.forEach(s => { next[s.id] = { ...next[s.id], status }; });
      return next;
    });

  const setArrivalAll = () =>
    setAttMap(prev => {
      const next = { ...prev };
      const t = nowTime();
      staffList.forEach(s => { if (!next[s.id]?.arrival_time) next[s.id] = { ...next[s.id], arrival_time: t }; });
      return next;
    });

  const setDepartureAll = () =>
    setAttMap(prev => {
      const next = { ...prev };
      const t = nowTime();
      staffList.forEach(s => { if (!next[s.id]?.departure_time) next[s.id] = { ...next[s.id], departure_time: t }; });
      return next;
    });

  // ── Per-staff field updaters ─────────────────────────────────────────────────

  /**
   * Set status for a staff member.
   * In the arrival session, auto-stamp arrival time (GMT+5) if not already set
   * and the status implies physical presence (not absent / paid-off).
   */
  const setStatus = (id: string, status: string) =>
    setAttMap(prev => {
      const row = prev[id] ?? { status: 'present' };
      const needsArrival = session === 'arrival' &&
        !row.arrival_time &&
        !['absent', 'complementary_off', 'vacation'].includes(status);
      return {
        ...prev,
        [id]: {
          ...row,
          status,
          ...(needsArrival ? { arrival_time: nowTime() } : {}),
        },
      };
    });

  const setArrival = (id: string, t: string) =>
    setAttMap(prev => ({ ...prev, [id]: { ...prev[id], arrival_time: t || null } }));

  const setDepart  = (id: string, t: string) =>
    setAttMap(prev => ({ ...prev, [id]: { ...prev[id], departure_time: t || null } }));

  const markHalfLeave = (id: string) =>
    setAttMap(prev => ({
      ...prev,
      [id]: { ...prev[id], status: 'half_day', departure_time: prev[id]?.departure_time || nowTime() },
    }));

  // ── Save ─────────────────────────────────────────────────────────────────────

  const saveAttendance = async () => {
    if (!userRole?.school_id) return;
    setSaving(true);
    try {
      for (const s of staffList) {
        const row = attMap[s.id] || { status: 'present' };
        const payload = {
          school_id:      userRole.school_id,
          staff_id:       s.id,
          date,
          status:         row.status,
          arrival_time:   row.arrival_time   ?? null,
          departure_time: row.departure_time ?? null,
          created_by:     user?.id,
        };
        if (row.id) {
          await supabase.from('attendance').update({
            status:         payload.status,
            arrival_time:   payload.arrival_time,
            departure_time: payload.departure_time,
          }).eq('id', row.id);
        } else {
          const { data: ins } = await supabase.from('attendance').insert(payload).select('id').single();
          if (ins) setAttMap(prev => ({ ...prev, [s.id]: { ...prev[s.id], id: ins.id } }));
        }
      }
      setSavedMsg(session === 'arrival' ? 'Arrival register saved ✓' : 'Departure register saved ✓');
      setTimeout(() => setSavedMsg(''), 3000);
    } catch (err: any) { alert(err.message); }
    setSaving(false);
  };

  // ── Stats ────────────────────────────────────────────────────────────────────

  const counts = {
    present:  staffList.filter(s => attMap[s.id]?.status === 'present').length,
    absent:   staffList.filter(s => attMap[s.id]?.status === 'absent').length,
    late:     staffList.filter(s => attMap[s.id]?.status === 'late').length,
    half_day: staffList.filter(s => attMap[s.id]?.status === 'half_day').length,
    arrived:  staffList.filter(s => attMap[s.id]?.arrival_time).length,
    departed: staffList.filter(s => attMap[s.id]?.departure_time).length,
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <PageHeader
        title="Staff Attendance"
        subtitle="Mark arrival & departure, record times, flag early leavers"
        actions={
          <div className="flex gap-2 flex-wrap">
            {isSunday && <Badge variant="warning" className="px-3 py-1.5 text-xs"><Sun className="w-3.5 h-3.5 mr-1.5" />Sunday</Badge>}
            {vacationToday && <Badge variant="indigo" className="px-3 py-1.5 text-xs"><Umbrella className="w-3.5 h-3.5 mr-1.5" />{vacationToday.name}</Badge>}
          </div>
        }
      />

      {/* ── Controls ── */}
      <Card className="p-5">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} icon={Calendar} />

          {/* Session tabs */}
          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Session</label>
            <div className="flex rounded-xl overflow-hidden border border-slate-200 w-fit">
              {(['arrival', 'departure'] as Session[]).map(s => (
                <button key={s} onClick={() => setSession(s)}
                  className={cn(
                    'flex items-center gap-2 px-5 py-2.5 text-xs font-black uppercase tracking-widest transition-all',
                    session === s
                      ? s === 'arrival' ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white'
                      : 'bg-white text-slate-500 hover:bg-slate-50'
                  )}>
                  {s === 'arrival' ? <LogIn className="w-3.5 h-3.5" /> : <LogOut className="w-3.5 h-3.5" />}
                  {s === 'arrival' ? 'Arrival' : 'Departure'}
                </button>
              ))}
            </div>
          </div>

          {/* Bulk actions */}
          <div className="flex gap-2 flex-wrap">
            {session === 'arrival' ? (
              <>
                <Btn variant="outline" size="sm" onClick={() => markAllStatus('present')}
                  className="text-[10px] tracking-widest border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                  All Present
                </Btn>
                <Btn variant="outline" size="sm" onClick={() => markAllStatus('absent')}
                  className="text-[10px] tracking-widest border-rose-200 text-rose-600 hover:bg-rose-50">
                  All Absent
                </Btn>
                <Btn variant="outline" size="sm" onClick={setArrivalAll}
                  className="text-[10px] tracking-widest border-slate-200">
                  <Clock className="w-3.5 h-3.5 mr-1" />Stamp All Now
                </Btn>
              </>
            ) : (
              <Btn variant="outline" size="sm" onClick={setDepartureAll}
                className="text-[10px] tracking-widest border-slate-200">
                <Clock className="w-3.5 h-3.5 mr-1" />Stamp All Now
              </Btn>
            )}
          </div>
        </div>
      </Card>

      {/* ── Summary strip ── */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {[
          { label: 'Present',  value: counts.present,  cls: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
          { label: 'Absent',   value: counts.absent,   cls: 'text-rose-700    bg-rose-50    border-rose-100'    },
          { label: 'Late',     value: counts.late,     cls: 'text-amber-700   bg-amber-50   border-amber-100'   },
          { label: 'Half Day', value: counts.half_day, cls: 'text-indigo-700  bg-indigo-50  border-indigo-100'  },
          { label: 'Arrived',  value: counts.arrived,  cls: 'text-teal-700    bg-teal-50    border-teal-100'    },
          { label: 'Departed', value: counts.departed, cls: 'text-purple-700  bg-purple-50  border-purple-100'  },
        ].map(c => (
          <div key={c.label} className={cn('rounded-xl border px-3 py-2 text-center', c.cls)}>
            <p className="text-xl font-black leading-none">{c.value}</p>
            <p className="text-[9px] font-black uppercase tracking-widest mt-1 opacity-70">{c.label}</p>
          </div>
        ))}
      </div>

      {/* ── Staff list ── */}
      <Card className="p-0 overflow-hidden border-none shadow-xl">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              {session === 'arrival'
                ? <><LogIn  className="w-4 h-4 text-emerald-600" />Morning Arrival</>
                : <><LogOut className="w-4 h-4 text-indigo-600"  />Afternoon Departure</>}
            </h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{staffList.length} Personnel</p>
          </div>
          <div className="flex items-center gap-3">
            <AnimatePresence>
              {savedMsg && (
                <motion.span initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                  className="text-xs font-black text-emerald-600">
                  {savedMsg}
                </motion.span>
              )}
            </AnimatePresence>
            <Btn variant="primary" disabled={saving || staffList.length === 0} onClick={saveAttendance} icon={Save}
              className={cn('px-8 shadow-md', session === 'arrival' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200')}>
              {saving ? 'Saving…' : session === 'arrival' ? 'Save Arrival' : 'Save Departure'}
            </Btn>
          </div>
        </div>

        <div className="p-5 bg-white overflow-y-auto max-h-[620px]">
          {loading ? (
            <div className="py-20 text-center">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="mt-3 text-slate-400 font-bold text-[10px] uppercase tracking-widest">Syncing…</p>
            </div>
          ) : staffList.length === 0 ? (
            <EmptyState icon={Briefcase} title="No Staff Found" description="No active staff personnel found." />
          ) : (
            <div className="space-y-2">
              {staffList.map((emp, i) => {
                const att = attMap[emp.id] || { status: 'present' };
                const st  = att.status;

                return (
                  <motion.div key={emp.id}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.015 }}
                    className={cn('rounded-2xl border-2 p-3 transition-all', STATUS_STYLE[st] || 'border-slate-100 bg-white')}
                  >
                    {/* Top row: avatar + name + status badge + (departure: half-leave btn) */}
                    <div className="flex items-center gap-3 mb-2.5">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                        {emp.photograph_url
                          ? <img src={emp.photograph_url} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center bg-indigo-50 text-indigo-400"><Briefcase className="w-4 h-4" /></div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 text-sm leading-tight">{emp.full_name}</p>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">
                          {emp.role}{emp.department ? ` · ${emp.department}` : ''}
                        </p>
                      </div>

                      {/* Status pill */}
                      <span className={cn('text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest shrink-0', STATUS_BADGE[st] || 'bg-slate-100 text-slate-500')}>
                        {st.replace('_', ' ')}
                      </span>

                      {/* Departure: half-leave quick button */}
                      {session === 'departure' && st !== 'absent' && (
                        <button onClick={() => markHalfLeave(emp.id)}
                          className={cn(
                            'flex items-center gap-1 text-[9px] font-black px-2 py-1 rounded-lg border transition-all shrink-0',
                            st === 'half_day'
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'
                          )}>
                          <AlertTriangle className="w-3 h-3" />
                          {st === 'half_day' ? 'Half Leave ✓' : 'Half Leave'}
                        </button>
                      )}
                    </div>

                    {/* Bottom row: time inputs */}
                    {session === 'arrival' ? (
                      <div className="flex flex-col sm:flex-row gap-2">
                        {/* Status buttons */}
                        <div className="flex gap-1.5 flex-1">
                          {ARRIVAL_STATUSES.map(btn => (
                            <button key={btn.key} onClick={() => setStatus(emp.id, btn.key)} title={btn.label}
                              className={cn(
                                'flex-1 h-8 rounded-lg flex items-center justify-center border transition-all text-[10px] font-black gap-1',
                                st === btn.key
                                  ? `${btn.bg} text-white border-transparent shadow-sm`
                                  : 'bg-slate-50 text-slate-400 border-slate-100 hover:border-slate-300'
                              )}>
                              <btn.icon className="w-3.5 h-3.5" />
                            </button>
                          ))}
                        </div>

                        {/* Arrival time */}
                        <div className="flex items-center gap-2 shrink-0">
                          <LogIn className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Arrival</p>
                            <div className="flex items-center gap-1">
                              <input type="time" value={att.arrival_time || ''}
                                onChange={e => setArrival(emp.id, e.target.value)}
                                className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 font-bold text-emerald-700 w-28" />
                              <button onClick={() => setArrival(emp.id, nowTime())} title="Stamp current GMT+5 time"
                                className="text-[8px] font-black px-1.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-100 transition-all whitespace-nowrap">
                                Now
                              </button>
                            </div>
                          </div>
                          {att.arrival_time && (
                            <span className="text-[10px] font-black text-emerald-600">{fmt12(att.arrival_time)}</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Departure session */
                      <div className="flex items-center gap-3">
                        {/* Show arrival time if recorded */}
                        {att.arrival_time && (
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <LogIn className="w-3 h-3" />
                            <span className="text-[10px] font-bold">{fmt12(att.arrival_time)}</span>
                          </div>
                        )}
                        {att.arrival_time && <span className="text-slate-200">→</span>}

                        {/* Departure time input */}
                        <div className="flex items-center gap-2">
                          <LogOut className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Departure</p>
                            <div className="flex items-center gap-1">
                              <input type="time" value={att.departure_time || ''}
                                onChange={e => setDepart(emp.id, e.target.value)}
                                className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 font-bold text-indigo-700 w-28" />
                              <button onClick={() => setDepart(emp.id, nowTime())} title="Stamp current GMT+5 time"
                                className="text-[8px] font-black px-1.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 hover:bg-indigo-100 transition-all whitespace-nowrap">
                                Now
                              </button>
                            </div>
                          </div>
                          {att.departure_time && (
                            <span className="text-[10px] font-black text-indigo-600">{fmt12(att.departure_time)}</span>
                          )}
                        </div>

                        {/* Working hours */}
                        {att.arrival_time && att.departure_time && (() => {
                          const [ah, am] = att.arrival_time!.split(':').map(Number);
                          const [dh, dm] = att.departure_time!.split(':').map(Number);
                          const mins = (dh * 60 + dm) - (ah * 60 + am);
                          if (mins <= 0) return null;
                          return (
                            <span className="ml-auto text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                              {Math.floor(mins / 60)}h {(mins % 60).toString().padStart(2,'0')}m
                            </span>
                          );
                        })()}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
