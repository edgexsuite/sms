import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  CalendarCheck, Download, Printer, ChevronDown, ChevronRight,
  Users, X, CheckCircle2, TrendingUp, Search, Calendar, Clock,
  Umbrella, BarChart2,
} from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';
import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';

// ── types ─────────────────────────────────────────────────────────────────────
interface ClassSummary {
  class_id: string;
  class_name: string;
  class_teacher?: string | null;
  total: number;
  present: number;
  absent: number;
  leave: number;
  late: number;
  vacation: number;
  not_marked: number;
  attendance_pct: number;
  students: StudentAtt[];
}

interface StudentAtt {
  id: string;
  name: string;
  roll_number: number;
  status: string | null;
  arrival_time: string | null;
}

// ── helpers ───────────────────────────────────────────────────────────────────
type Mode = 'daily' | 'weekly' | 'range';

const today = () => new Date().toISOString().split('T')[0];

function weekStart(d: string) {
  const dt = new Date(d);
  const day = dt.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday-based
  dt.setDate(dt.getDate() + diff);
  return dt.toISOString().split('T')[0];
}
function weekEnd(start: string) {
  const dt = new Date(start);
  dt.setDate(dt.getDate() + 6);
  return dt.toISOString().split('T')[0];
}

function fmt(d: string) {
  const [y, m, day] = d.split('-');
  return `${day}-${m}-${y}`;
}

const pctColor = (pct: number, na = false) =>
  na ? { bar: 'bg-slate-200', text: 'text-slate-400', badge: 'bg-slate-100 text-slate-500' }
  : pct >= 90 ? { bar: 'bg-emerald-500', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' }
  : pct >= 75 ? { bar: 'bg-blue-500',    text: 'text-blue-700',    badge: 'bg-blue-100 text-blue-700'    }
  : pct >= 60 ? { bar: 'bg-amber-400',   text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700'  }
  :             { bar: 'bg-rose-500',     text: 'text-rose-700',    badge: 'bg-rose-100 text-rose-700'    };

const STATUS_BADGE: Record<string, string> = {
  present:  'bg-emerald-100 text-emerald-700',
  absent:   'bg-rose-100 text-rose-700',
  late:     'bg-amber-100 text-amber-700',
  leave:    'bg-indigo-100 text-indigo-700',
  vacation: 'bg-sky-100 text-sky-700',
};

// ── component ─────────────────────────────────────────────────────────────────
export default function DailyReport() {
  const { userRole } = useAuth();

  // ── mode & date state ─────────────────────────────────────────────────────
  const [mode,      setMode]      = useState<Mode>('daily');
  const [date,      setDate]      = useState(today());
  const [rangeFrom, setRangeFrom] = useState(today());
  const [rangeTo,   setRangeTo]   = useState(today());

  // derived: from/to dates used in query
  const fromDate = mode === 'daily'  ? date
                 : mode === 'weekly' ? weekStart(date)
                 : rangeFrom;
  const toDate   = mode === 'daily'  ? date
                 : mode === 'weekly' ? weekEnd(weekStart(date))
                 : rangeTo;

  // ── report state ──────────────────────────────────────────────────────────
  const [summary,       setSummary]       = useState<ClassSummary[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [classFilter,   setClassFilter]   = useState('all');
  const [searchStudent, setSearchStudent] = useState('');
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [activeVacation, setActiveVacation] = useState<any>(null);
  const [generatingPDF,  setGeneratingPDF]  = useState(false);

  useEffect(() => { if (userRole?.school_id) fetchReport(); }, [userRole, date, mode, rangeFrom, rangeTo]);

  // ── fetch ─────────────────────────────────────────────────────────────────
  const fetchReport = async () => {
    setLoading(true);
    const sid = userRole!.school_id;

    const [{ data: classes }, { data: students }, { data: attData }, { data: vacData }] = await Promise.all([
      supabase.from('classes').select('id, name, section, staff(full_name)').eq('school_id', sid).order('name'),
      supabase.from('students').select('id, full_name, roll_number, class_id')
        .eq('school_id', sid).eq('status', 'active').eq('is_deleted', false).order('roll_number'),
      supabase.from('attendance').select('student_id, status, date, arrival_time, departure_time')
        .eq('school_id', sid).gte('date', fromDate).lte('date', toDate).not('student_id', 'is', null),
      supabase.from('vacations').select('*').eq('school_id', sid),
    ]);

    if (!classes) { setLoading(false); return; }

    const vMatch = (vacData || []).find((v: any) => fromDate >= v.start_date && fromDate <= v.end_date) || null;
    setActiveVacation(vMatch);

    // For multi-day mode: aggregate attendance per student (count each status across all days)
    // For single-day: same logic but only one day
    const attMap: Record<string, { present: number; absent: number; leave: number; late: number; vacation: number }> = {};
    (attData || []).forEach((a: any) => {
      if (!attMap[a.student_id]) attMap[a.student_id] = { present: 0, absent: 0, leave: 0, late: 0, vacation: 0 };
      const s = a.status?.toLowerCase();
      if      (s === 'present')  attMap[a.student_id].present++;
      else if (s === 'absent')   attMap[a.student_id].absent++;
      else if (s === 'leave')    attMap[a.student_id].leave++;
      else if (s === 'late')     attMap[a.student_id].late++;
      else if (s === 'vacation') attMap[a.student_id].vacation++;
    });

    // For single-day drill-down, keep arrival_time per student
    const arrivalMap: Record<string, string | null> = {};
    if (mode === 'daily') {
      (attData || []).forEach((a: any) => { arrivalMap[a.student_id] = a.arrival_time; });
    }

    const byClass: Record<string, typeof students> = {};
    (students || []).forEach((s: any) => {
      if (!byClass[s.class_id]) byClass[s.class_id] = [];
      byClass[s.class_id].push(s);
    });

    const result: ClassSummary[] = (classes || []).map((cls: any) => {
      const cs = byClass[cls.id] || [];
      let present = 0, absent = 0, leave = 0, late = 0, vacation = 0, not_marked = 0;

      const detail: StudentAtt[] = cs.map((s: any) => {
        const a = attMap[s.id];
        if (!a) {
          if (vMatch) { vacation++; return { id: s.id, name: s.full_name, roll_number: s.roll_number, status: 'vacation', arrival_time: null }; }
          not_marked++;
          return { id: s.id, name: s.full_name, roll_number: s.roll_number, status: null, arrival_time: null };
        }
        present  += a.present;
        absent   += a.absent;
        leave    += a.leave;
        late     += a.late;
        vacation += a.vacation;
        // dominant status for display in daily mode
        const domStatus = a.present > 0 ? 'present' : a.leave > 0 ? 'leave' : a.late > 0 ? 'late' : a.absent > 0 ? 'absent' : 'vacation';
        return {
          id: s.id, name: s.full_name, roll_number: s.roll_number,
          status: domStatus,
          arrival_time: arrivalMap[s.id] ?? null,
        };
      });

      const marked = present + absent + leave + late + vacation;
      return {
        class_id: cls.id,
        class_name: `${cls.name}${cls.section ? ' ' + cls.section : ''}`,
        class_teacher: (cls.staff as any)?.full_name ?? null,
        total: cs.length, present, absent, leave, late, vacation, not_marked,
        attendance_pct: (present + absent + late) > 0
          ? Math.round((present / (present + absent + late)) * 100) : 0,
        students: detail,
      };
    });

    setSummary(result.filter(c => c.total > 0));
    setLoading(false);
  };

  // ── totals ────────────────────────────────────────────────────────────────
  const displayed = summary.filter(c => classFilter === 'all' || c.class_id === classFilter);
  const T = displayed.reduce(
    (a, s) => ({
      total: a.total + s.total, present: a.present + s.present, absent: a.absent + s.absent,
      leave: a.leave + s.leave, late: a.late + s.late, not_marked: a.not_marked + s.not_marked,
      vacation: a.vacation + s.vacation,
    }),
    { total: 0, present: 0, absent: 0, leave: 0, late: 0, not_marked: 0, vacation: 0 },
  );
  const overallPct = (T.present + T.absent + T.late) > 0
    ? Math.round((T.present / (T.present + T.absent + T.late)) * 100) : 0;

  const dateLabel = mode === 'daily'
    ? fmt(date)
    : `${fmt(fromDate)} — ${fmt(toDate)}`;

  // ── PDF download via jsPDF autotable ──────────────────────────────────────
  const handleDownloadPDF = async () => {
    setGeneratingPDF(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new (jsPDF as any)({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      // School header
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Daily Attendance Report', 148, 14, { align: 'center' });
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(dateLabel, 148, 20, { align: 'center' });

      // Summary row
      doc.setFontSize(8);
      doc.text(
        `Total: ${T.total}   Present: ${T.present}   Absent: ${T.absent}   Leave: ${T.leave}   Late: ${T.late}   Unmarked: ${T.not_marked}   Attendance: ${overallPct}%`,
        148, 26, { align: 'center' },
      );

      // Table
      autoTable(doc, {
        startY: 30,
        head: [['#', 'Class', 'Teacher', 'Total', 'Present', 'Absent', 'Leave', 'Late', 'Unmarked', 'Att %']],
        body: displayed.map((c, i) => [
          i + 1, c.class_name, c.class_teacher || '—',
          c.total, c.present, c.absent, c.leave, c.late, c.not_marked,
          `${c.attendance_pct}%`,
        ]),
        foot: [['', 'GRAND TOTAL', '', T.total, T.present, T.absent, T.leave, T.late, T.not_marked, `${overallPct}%`]],
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
        footStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 8 },
          2: { cellWidth: 35 },
          9: { fontStyle: 'bold' },
        },
      });

      doc.save(`attendance-report-${fromDate}${mode !== 'daily' ? '-to-' + toDate : ''}.pdf`);
    } catch (err) {
      console.error('PDF error:', err);
      alert('PDF generation failed. Please try again.');
    }
    setGeneratingPDF(false);
  };

  // ── CSV export ─────────────────────────────────────────────────────────────
  const handleCSV = () => {
    exportToCSV(
      `attendance-${fromDate}`,
      displayed.map(c => ({
        class: c.class_name, teacher: c.class_teacher || '', total: c.total,
        present: c.present, absent: c.absent, leave: c.leave, late: c.late,
        unmarked: c.not_marked, pct: `${c.attendance_pct}%`,
      })),
      [
        { header: 'Class', key: 'class' }, { header: 'Teacher', key: 'teacher' },
        { header: 'Total', key: 'total' }, { header: 'Present', key: 'present' },
        { header: 'Absent', key: 'absent' }, { header: 'Leave', key: 'leave' },
        { header: 'Late', key: 'late' }, { header: 'Unmarked', key: 'unmarked' },
        { header: 'Att %', key: 'pct' },
      ],
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight">
            <CalendarCheck className="w-6 h-6 text-indigo-600" /> Attendance Report
          </h1>
          <p className="text-slate-400 text-xs mt-0.5">Class-wise summary · {dateLabel}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleCSV}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition">
            <Download className="w-4 h-4" /> CSV
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button onClick={handleDownloadPDF} disabled={generatingPDF}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-60">
            {generatingPDF
              ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating…</>
              : <><Download className="w-4 h-4" /> PDF</>}
          </button>
        </div>
      </div>

      {/* ── Mode + Date controls ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">

          {/* Mode tabs */}
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">View Mode</p>
            <div className="flex rounded-xl overflow-hidden border border-slate-200 text-xs font-bold">
              {(['daily','weekly','range'] as Mode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    'px-4 py-2 capitalize transition',
                    mode === m
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 hover:bg-slate-50',
                  )}
                >
                  {m === 'range' ? 'Date Range' : m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Date inputs */}
          {mode === 'daily' && (
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Date</p>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-400 outline-none" />
            </div>
          )}
          {mode === 'weekly' && (
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Any Day of the Week</p>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-400 outline-none" />
              <p className="text-[10px] text-indigo-600 font-bold mt-1">
                Week: {fmt(weekStart(date))} → {fmt(weekEnd(weekStart(date)))}
              </p>
            </div>
          )}
          {mode === 'range' && (
            <div className="flex gap-3 flex-wrap">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">From</p>
                <input type="date" value={rangeFrom} onChange={e => setRangeFrom(e.target.value)}
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-400 outline-none" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">To</p>
                <input type="date" value={rangeTo} min={rangeFrom} onChange={e => setRangeTo(e.target.value)}
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-400 outline-none" />
              </div>
            </div>
          )}

          {/* Class filter */}
          <div className="sm:ml-auto">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Class</p>
            <div className="relative">
              <select value={classFilter} onChange={e => setClassFilter(e.target.value)}
                className="border border-slate-200 rounded-xl pl-3 pr-8 py-2 text-sm font-bold text-slate-700 appearance-none focus:ring-2 focus:ring-indigo-400 outline-none bg-white">
                <option value="all">All Classes</option>
                {summary.map(c => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Search */}
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Search Student</p>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input type="text" placeholder="Name or roll…" value={searchStudent}
                onChange={e => setSearchStudent(e.target.value)}
                className="border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-400 outline-none w-44" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {[
          { label: 'Enrolled',  value: T.total,      icon: Users,         color: 'slate'   },
          { label: 'Present',   value: T.present,    icon: CheckCircle2,  color: 'emerald' },
          { label: 'Absent',    value: T.absent,     icon: X,             color: 'rose'    },
          { label: 'Late',      value: T.late,       icon: Clock,         color: 'amber'   },
          { label: 'On Leave',  value: T.leave,      icon: Umbrella,      color: 'indigo'  },
          { label: 'Att. Rate', value: `${overallPct}%`, icon: TrendingUp,
            color: overallPct >= 90 ? 'emerald' : overallPct >= 75 ? 'indigo' : 'rose' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex flex-col items-center text-center">
            <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center mb-2',
              s.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
              s.color === 'rose'    ? 'bg-rose-50 text-rose-600' :
              s.color === 'amber'   ? 'bg-amber-50 text-amber-600' :
              s.color === 'indigo'  ? 'bg-indigo-50 text-indigo-600' :
              'bg-slate-50 text-slate-600'
            )}>
              <s.icon className="w-4 h-4" />
            </div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{s.label}</p>
            <p className="text-lg font-black text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Main table ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Loading…</p>
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <CalendarCheck className="w-12 h-12 text-slate-200" />
            <p className="text-slate-400 font-bold text-sm">No attendance records for this period.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-3 w-8" />
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Class</th>
                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Total</th>
                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-emerald-600">Present</th>
                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-rose-600">Absent</th>
                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-indigo-600">Leave</th>
                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-amber-600">Late</th>
                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-orange-500">Unmarked</th>
                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Att %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {displayed.map(cls => {
                  const isExpanded = expandedClass === cls.class_id;
                  const allNA = cls.not_marked === cls.total;
                  const c = pctColor(cls.attendance_pct, allNA);
                  const filtered = cls.students.filter(s => {
                    if (!searchStudent) return true;
                    return s.name.toLowerCase().includes(searchStudent.toLowerCase())
                      || String(s.roll_number).includes(searchStudent);
                  });

                  return (
                    <React.Fragment key={cls.class_id}>
                      <tr
                        onClick={() => setExpandedClass(p => p === cls.class_id ? null : cls.class_id)}
                        className={cn('cursor-pointer hover:bg-slate-50 transition group', isExpanded && 'bg-indigo-50/30')}
                      >
                        <td className="px-4 py-3 text-slate-300 group-hover:text-indigo-500">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{cls.class_name}</p>
                          {cls.class_teacher && <p className="text-[10px] text-indigo-500 font-bold mt-0.5">{cls.class_teacher}</p>}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-slate-500 text-sm">{cls.total}</td>
                        <td className="px-4 py-3 text-center text-lg font-black text-emerald-600">{cls.present}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn('inline-flex items-center justify-center px-2 py-0.5 rounded-lg text-sm font-black',
                            cls.absent > 0 ? 'bg-rose-100 text-rose-700' : 'text-slate-200')}>
                            {cls.absent}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-sm font-bold text-indigo-600">{cls.leave}</td>
                        <td className="px-4 py-3 text-center text-sm font-bold text-amber-600">{cls.late}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn('text-xs font-black px-2 py-0.5 rounded-full',
                            cls.not_marked > 0 ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700')}>
                            {cls.not_marked > 0 ? cls.not_marked : 'Full'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col items-center gap-1">
                            <span className={cn('text-xs font-black', c.text)}>{allNA ? 'N/A' : `${cls.attendance_pct}%`}</span>
                            {!allNA && (
                              <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className={cn('h-full rounded-full', c.bar)} style={{ width: `${cls.attendance_pct}%` }} />
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded student drill-down */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={9} className="p-0 bg-indigo-50/20 border-b border-indigo-100">
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="p-4 overflow-hidden"
                            >
                              {filtered.length === 0 ? (
                                <p className="text-slate-400 text-xs text-center py-4">No students match the search.</p>
                              ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                                  {filtered.map(s => (
                                    <div key={s.id} className="bg-white rounded-xl border border-slate-100 px-3 py-2 flex items-center gap-2.5">
                                      <div className={cn(
                                        'w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0',
                                        s.status === 'present'  ? 'bg-emerald-500' :
                                        s.status === 'absent'   ? 'bg-rose-500' :
                                        s.status === 'late'     ? 'bg-amber-500' :
                                        s.status === 'leave'    ? 'bg-indigo-500' :
                                        s.status === 'vacation' ? 'bg-sky-500' : 'bg-slate-300'
                                      )}>
                                        {s.roll_number}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-xs font-black text-slate-800 truncate">{s.name}</p>
                                        <p className={cn('text-[9px] font-bold uppercase',
                                          STATUS_BADGE[s.status || '']?.split(' ')[1] || 'text-slate-400')}>
                                          {s.status ?? 'not marked'}
                                          {s.arrival_time ? ` · ${s.arrival_time.slice(0, 5)}` : ''}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 text-white">
                  <td className="px-4 py-4" />
                  <td className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Grand Total</td>
                  <td className="px-4 py-4 text-center font-black">{T.total}</td>
                  <td className="px-4 py-4 text-center text-xl font-black text-emerald-400">{T.present}</td>
                  <td className="px-4 py-4 text-center text-xl font-black text-rose-400">{T.absent}</td>
                  <td className="px-4 py-4 text-center font-black text-indigo-300">{T.leave}</td>
                  <td className="px-4 py-4 text-center font-black text-amber-300">{T.late}</td>
                  <td className="px-4 py-4 text-center">
                    <span className={cn('text-xs font-black px-2 py-0.5 rounded-full',
                      T.not_marked > 0 ? 'bg-orange-400/20 text-orange-300' : 'bg-emerald-400/20 text-emerald-300')}>
                      {T.not_marked}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center text-xl font-black text-indigo-300">{overallPct}%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* print styles */}
      <style>{`
        @media print {
          @page { size: landscape; margin: 8mm; }
          body > *:not(.print-root) { display: none !important; }
          .print-root { display: block !important; }
        }
      `}</style>
    </div>
  );
}
