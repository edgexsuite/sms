import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  CalendarCheck, Download, Printer, ChevronDown, ChevronRight,
  Users, X, AlertTriangle, CheckCircle2, TrendingUp
} from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';
import { cn, formatDate } from '../../lib/utils';

interface ClassSummary {
  class_id: string;
  class_name: string;
  class_teacher?: string | null;
  total: number;
  present: number;
  absent: number;
  leave: number;
  late: number;
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
  departure_time: string | null;
}

const pctColor = (pct: number, na = false) =>
  na ? { bar: 'bg-slate-200', text: 'text-slate-400', bg: 'bg-slate-50', badge: 'bg-slate-100 text-slate-500' }
  : pct >= 90 ? { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', badge: 'bg-emerald-100 text-emerald-700' }
  : pct >= 75 ? { bar: 'bg-blue-500',    text: 'text-blue-700',    bg: 'bg-blue-50',    badge: 'bg-blue-100 text-blue-700' }
  : pct >= 60 ? { bar: 'bg-amber-400',   text: 'text-amber-700',   bg: 'bg-amber-50',   badge: 'bg-amber-100 text-amber-700' }
  :             { bar: 'bg-rose-500',     text: 'text-rose-700',    bg: 'bg-rose-50',    badge: 'bg-rose-100 text-rose-700' };

const rowBorderColor = (pct: number, na: boolean) =>
  na ? 'border-l-slate-200'
  : pct >= 90 ? 'border-l-emerald-400'
  : pct >= 75 ? 'border-l-blue-400'
  : pct >= 60 ? 'border-l-amber-400'
  :             'border-l-rose-500';

const STUDENT_CARD: Record<string, string> = {
  present: 'bg-emerald-50 border-emerald-200',
  absent:  'bg-rose-50 border-rose-200',
  late:    'bg-amber-50 border-amber-200',
  leave:   'bg-blue-50 border-blue-200',
};
const STUDENT_BADGE: Record<string, string> = {
  present: 'bg-emerald-500 text-white',
  absent:  'bg-rose-500 text-white',
  late:    'bg-amber-500 text-white',
  leave:   'bg-blue-500 text-white',
};

const STATUS_FILTERS = [
  { key: 'all',        label: 'All',         on: 'bg-slate-800 text-white border-slate-800' },
  { key: 'present',    label: '● Present',   on: 'bg-emerald-500 text-white border-emerald-500' },
  { key: 'absent',     label: '● Absent',    on: 'bg-rose-500 text-white border-rose-500' },
  { key: 'late',       label: '● Late',      on: 'bg-amber-500 text-white border-amber-500' },
  { key: 'leave',      label: '● Leave',     on: 'bg-blue-500 text-white border-blue-500' },
  { key: 'not_marked', label: '○ Unmarked',  on: 'bg-slate-500 text-white border-slate-500' },
];

export default function DailyReport() {
  const { userRole } = useAuth();
  const [date, setDate]           = useState(new Date().toISOString().split('T')[0]);
  const [summary, setSummary]     = useState<ClassSummary[]>([]);
  const [loading, setLoading]     = useState(false);
  const [classFilter, setClassFilter]   = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [searchStudent, setSearchStudent] = useState('');

  useEffect(() => { if (userRole?.school_id) fetchReport(); }, [userRole, date]);

  const fetchReport = async () => {
    setLoading(true);
    const sid = userRole!.school_id;
    const [{ data: classes }, { data: students }, { data: attData }] = await Promise.all([
      supabase.from('classes').select('id, name, section, staff(full_name)').eq('school_id', sid).order('name'),
      supabase.from('students').select('id, full_name, roll_number, class_id')
        .eq('school_id', sid).eq('status', 'active').eq('is_deleted', false).order('roll_number'),
      supabase.from('attendance').select('student_id, status, arrival_time, departure_time')
        .eq('school_id', sid).eq('date', date).not('student_id', 'is', null),
    ]);
    if (!classes) { setLoading(false); return; }

    const attMap: Record<string, { status: string; arrival_time: string | null; departure_time: string | null }> = {};
    attData?.forEach(a => { attMap[a.student_id] = { status: a.status, arrival_time: a.arrival_time, departure_time: a.departure_time }; });

    const byClass: Record<string, typeof students> = {};
    students?.forEach(s => { if (!byClass[s.class_id]) byClass[s.class_id] = []; byClass[s.class_id].push(s); });

    const result: ClassSummary[] = classes.map(cls => {
      const cs = byClass[cls.id] || [];
      let present = 0, absent = 0, leave = 0, late = 0, not_marked = 0;
      const detail: StudentAtt[] = cs.map((s: any) => {
        const a = attMap[s.id];
        if (!a) { not_marked++; return { id: s.id, name: s.full_name, roll_number: s.roll_number, status: null, arrival_time: null, departure_time: null }; }
        if (a.status === 'present') present++;
        else if (a.status === 'absent') absent++;
        else if (a.status === 'leave') leave++;
        else if (a.status === 'late') late++;
        return { id: s.id, name: s.full_name, roll_number: s.roll_number, status: a.status, arrival_time: a.arrival_time, departure_time: a.departure_time };
      });
      const marked = present + absent + leave + late;
      return {
        class_id: cls.id,
        class_name: `${cls.name}${cls.section ? '-' + cls.section : ''}`,
        class_teacher: cls.staff?.full_name,
        total: cs.length, present, absent, leave, late, not_marked,
        attendance_pct: marked > 0 ? Math.round((present / marked) * 100) : 0,
        students: detail,
      };
    });
    setSummary(result);
    setLoading(false);
  };

  const displayed = summary.filter(c => classFilter === 'all' || c.class_id === classFilter);
  const T = displayed.reduce((a, s) => ({
    total: a.total + s.total, present: a.present + s.present, absent: a.absent + s.absent,
    leave: a.leave + s.leave, late: a.late + s.late, not_marked: a.not_marked + s.not_marked,
  }), { total: 0, present: 0, absent: 0, leave: 0, late: 0, not_marked: 0 });
  const overallPct = (T.present + T.absent) > 0 ? Math.round((T.present / (T.present + T.absent)) * 100) : 0;
  const oc = pctColor(overallPct, T.total === 0);

  const handleDownloadPDF = async () => {
    const element = document.querySelector('.print-scale') as HTMLElement;
    if (!element) return;

    setLoading(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          // Force all elements to use computed styles (which are usually RGB) 
          // to bypass the oklch parsing error in html2canvas
          const allElements = clonedDoc.getElementsByTagName('*');
          for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i] as HTMLElement;
            const style = window.getComputedStyle(el);
            // Replace problematic colors with their computed RGB equivalents
            if (style.color.includes('oklch')) el.style.color = 'rgb(0,0,0)';
            if (style.backgroundColor.includes('oklch')) el.style.backgroundColor = 'rgba(0,0,0,0)';
            if (style.borderColor.includes('oklch')) el.style.borderColor = 'rgba(0,0,0,0)';
          }
          // Ensure the print-only header is visible in the capture
          const printHeader = clonedDoc.querySelector('.hidden.print\\:flex') as HTMLElement;
          if (printHeader) {
            printHeader.style.display = 'flex';
            printHeader.style.flexDirection = 'column';
          }
          // Hide no-print elements
          const noPrint = clonedDoc.querySelectorAll('.no-print');
          noPrint.forEach(n => (n as HTMLElement).style.display = 'none');
          
          // Apply a specific width for the PDF layout
          const container = clonedDoc.querySelector('.print-scale') as HTMLElement;
          if (container) {
            container.style.width = '1120px'; // Landscape width
            container.style.padding = '20px';
            container.style.zoom = '1'; // Reset zoom for capture
          }
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`Daily_Attendance_Report_${date}.pdf`);
    } catch (error) {
      console.error('PDF generation error:', error);
      // Fallback to window.print if something goes wrong
      window.print();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <style>{`
        @media print {
          @page { size: landscape; margin: 5mm; }
          .no-print { display:none!important; }
          body { background:white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-scale { zoom: 0.85; width: 100%; }
          table { border-collapse:collapse; width: 100%; font-size: 11px !important; table-layout: auto !important; break-inside: avoid !important; }
          th,td { border:1px solid #e5e7eb; padding:4px 6px !important; line-height: 1.1 !important; }
          .shadow-sm { box-shadow: none !important; }
          .rounded-xl { border-radius: 4px !important; }
          .text-3xl { font-size: 1rem !important; }
          .py-4 { padding-top: 0.15rem !important; padding-bottom: 0.15rem !important; }
          .space-y-5 > * + * { margin-top: 0.25rem !important; }
          h1 { font-size: 1.125rem !important; margin: 0 !important; }
          p { margin: 0 !important; }
        }
      `}</style>

      {/* ── PRINT-ONLY REPORT TITLE ────────────────────────── */}
      <div className="hidden print:flex flex-col items-center justify-center pb-2 mb-2 border-b border-gray-200">
        <h1 className="text-xl font-black tracking-widest uppercase text-gray-900 leading-tight">Daily Attendance Report</h1>
      </div>

      <div className="print-scale space-y-5">
        {/* ── PAGE HEADER ───────────────────────────────────── */}
        <div className="flex flex-wrap justify-between items-center gap-3 no-print">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <CalendarCheck className="w-6 h-6 text-blue-600" />
              Daily Attendance Report
            </h1>
            <p className="text-gray-400 text-sm mt-0.5">Class-wise summary · click any row to drill down into student details</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => exportToCSV(`daily-att-${date}`, displayed.map(c => ({
                class_name: c.class_name, total: c.total, present: c.present, absent: c.absent,
                leave: c.leave, late: c.late, not_marked: c.not_marked, pct: c.attendance_pct,
              })), [
                { header: 'Class', key: 'class_name' }, { header: 'Total', key: 'total' },
                { header: 'Present', key: 'present' }, { header: 'Absent', key: 'absent' },
                { header: 'Leave', key: 'leave' }, { header: 'Late', key: 'late' },
                { header: 'Not Marked', key: 'not_marked' }, { header: 'Att %', key: 'pct' },
              ])}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <button onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
              <Printer className="w-4 h-4" /> Print
            </button>
            <button onClick={handleDownloadPDF}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-colors shadow-sm">
              <Download className="w-4 h-4" /> Download PDF
            </button>
          </div>
        </div>

        {/* ── SCHOOL-WIDE HERO STATS ─────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-4 text-center">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Total</p>
            <p className="text-3xl font-black text-gray-800">{T.total}</p>
            <p className="text-[11px] text-gray-400 mt-1">Students enrolled</p>
          </div>
          <div className="bg-emerald-500 rounded-xl shadow-sm px-4 py-4 text-center text-white">
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-1 opacity-80">Present</p>
            <p className="text-3xl font-black">{T.present}</p>
            <p className="text-[11px] mt-1 opacity-75">
              {T.total > 0 ? `${Math.round((T.present / T.total) * 100)}% of total` : '—'}
            </p>
          </div>
          <div className={cn('rounded-xl shadow-sm px-4 py-4 text-center', T.absent > 0 ? 'bg-rose-500 text-white' : 'bg-white border border-gray-200 text-gray-400')}>
            <p className={cn('text-[11px] font-semibold uppercase tracking-widest mb-1', T.absent > 0 ? 'opacity-80' : '')}>Absent</p>
            <p className="text-3xl font-black">{T.absent}</p>
            <p className={cn('text-[11px] mt-1', T.absent > 0 ? 'opacity-75' : 'text-gray-300')}>
              {T.absent > 0 && T.total > 0 ? `${Math.round((T.absent / T.total) * 100)}% of total` : 'All accounted for'}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-amber-100 shadow-sm px-4 py-4 text-center">
            <p className="text-[11px] font-semibold text-amber-500 uppercase tracking-widest mb-1">Late</p>
            <p className="text-3xl font-black text-amber-600">{T.late}</p>
            <p className="text-[11px] text-gray-400 mt-1">Arrived late</p>
          </div>
          <div className="bg-white rounded-xl border border-blue-100 shadow-sm px-4 py-4 text-center">
            <p className="text-[11px] font-semibold text-blue-500 uppercase tracking-widest mb-1">On Leave</p>
            <p className="text-3xl font-black text-blue-600">{T.leave}</p>
            <p className="text-[11px] text-gray-400 mt-1">Approved leave</p>
          </div>
          <div className={cn('rounded-xl border shadow-sm px-4 py-4 text-center', oc.bg,
            overallPct >= 90 ? 'border-emerald-200' : overallPct >= 75 ? 'border-blue-200' : overallPct >= 60 ? 'border-amber-200' : 'border-rose-200')}>
            <p className={cn('text-[11px] font-semibold uppercase tracking-widest mb-1', oc.text)}>Att. Rate</p>
            <p className={cn('text-3xl font-black', oc.text)}>{overallPct}%</p>
            <div className="mt-2 h-1.5 bg-white/60 rounded-full overflow-hidden">
              <div className={cn('h-full rounded-full transition-all', oc.bar)} style={{ width: `${overallPct}%` }} />
            </div>
          </div>
        </div>

        {/* ── FILTERS ───────────────────────────────────────── */}
        <div className="no-print bg-white border border-gray-200 rounded-xl shadow-sm p-4 space-y-3 mt-5">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Date</label>
              <input type="date" value={date}
                onChange={e => { setDate(e.target.value); setExpandedClass(null); }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Class</label>
              <select value={classFilter} onChange={e => setClassFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[160px]">
                <option value="all">All Classes</option>
                {summary.map(c => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
              </select>
            </div>
            <div className="ml-auto">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Search Student</label>
              <div className="relative">
                <input value={searchStudent} onChange={e => setSearchStudent(e.target.value)}
                  placeholder="Name or roll number…"
                  className="border border-gray-300 rounded-lg pl-3 pr-8 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent w-52" />
                {searchStudent && (
                  <button onClick={() => setSearchStudent('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Filter Students by Status</label>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_FILTERS.map(sf => (
                <button key={sf.key} onClick={() => setStatusFilter(sf.key)}
                  className={cn('px-3 py-1.5 rounded-lg text-xs font-bold transition-all border',
                    statusFilter === sf.key ? sf.on : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700')}>
                  {sf.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── MAIN TABLE ────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2.5">
              <Users className="w-4 h-4 text-gray-400" />
              <span className="font-semibold text-gray-700 text-sm">{formatDate(date)}</span>
              {classFilter !== 'all' && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full font-bold">
                  {displayed[0]?.class_name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs text-gray-400 font-medium">{displayed.length} classes</span>
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <div className="inline-block w-9 h-9 border-4 border-blue-100 border-t-blue-500 rounded-full animate-spin" />
              <p className="text-gray-400 text-sm mt-4">Loading attendance data…</p>
            </div>
          ) : displayed.length === 0 ? (
            <div className="py-20 text-center text-gray-400">No classes found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="w-10 pl-4" />
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider w-44">Class</th>
                    <th className="px-4 py-3 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider w-20">Total</th>
                    <th className="px-4 py-3 text-center text-[11px] font-bold text-emerald-600 uppercase tracking-wider w-28">✓ Present</th>
                    <th className="px-4 py-3 text-center text-[11px] font-bold text-rose-500 uppercase tracking-wider w-28">✕ Absent</th>
                    <th className="px-4 py-3 text-center text-[11px] font-bold text-blue-500 uppercase tracking-wider w-20">Leave</th>
                    <th className="px-4 py-3 text-center text-[11px] font-bold text-amber-500 uppercase tracking-wider w-20">Late</th>
                    <th className="px-4 py-3 text-center text-[11px] font-bold text-orange-500 uppercase tracking-wider w-28">Unmarked</th>
                    <th className="px-4 py-3 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider w-36">Attendance %</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((cls, idx) => {
                    const isExpanded = expandedClass === cls.class_id;
                    const allNA = cls.not_marked === cls.total;
                    const c = pctColor(cls.attendance_pct, allNA);
                    return (
                      <React.Fragment key={cls.class_id}>
                        <tr onClick={() => setExpandedClass(prev => prev === cls.class_id ? null : cls.class_id)}
                          className={cn('border-l-4 cursor-pointer transition-colors group border-b border-gray-100',
                            rowBorderColor(cls.attendance_pct, allNA), idx % 2 === 1 ? 'bg-gray-50/60' : 'bg-white',
                            isExpanded ? 'bg-blue-50/60' : 'hover:bg-blue-50/40')}>
                          <td className="pl-3 pr-1 py-3.5 text-gray-300 group-hover:text-blue-400">
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-blue-500" /> : <ChevronRight className="w-4 h-4" />}
                          </td>
                          <td className="px-4 py-3.5 w-44">
                            <span className="font-bold text-gray-900 text-sm">{cls.class_name}</span>
                            {cls.class_teacher && <p className="text-[10px] font-medium text-gray-400 mt-0.5 truncate">{cls.class_teacher}</p>}
                          </td>
                          <td className="px-4 py-3.5 text-center text-sm font-semibold text-gray-500">{cls.total}</td>
                          <td className="px-4 py-3.5 text-center">
                            <span className="text-xl font-black text-emerald-600">{cls.present}</span>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {cls.absent > 0 ? (
                              <span className="inline-flex items-center justify-center bg-rose-500 text-white text-sm font-black rounded-lg px-3 py-1 min-w-[2.5rem]">{cls.absent}</span>
                            ) : <span className="text-gray-200 text-xl font-black">0</span>}
                          </td>
                          <td className="px-4 py-3.5 text-center text-sm font-bold text-blue-600">{cls.leave || 0}</td>
                          <td className="px-4 py-3.5 text-center text-sm font-bold text-amber-600">{cls.late || 0}</td>
                          <td className="px-4 py-3.5 text-center">
                            {cls.not_marked > 0 ? (
                              <span className="inline-flex items-center gap-1.5 bg-orange-100 text-orange-700 text-sm font-black px-2.5 py-1 rounded-lg">
                                <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />{cls.not_marked}
                              </span>
                            ) : <CheckCircle2 className="w-4 h-4 text-emerald-300 mx-auto" />}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex flex-col items-center gap-1">
                              <span className={cn('text-sm font-black', c.text)}>{allNA ? 'N/A' : `${cls.attendance_pct}%`}</span>
                              {!allNA && <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className={cn('h-full rounded-full', c.bar)} style={{ width: `${cls.attendance_pct}%` }} /></div>}
                            </div>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-800 text-white">
                    <td className="pl-4 py-4" /><td className="px-4 py-4 text-xs font-black uppercase tracking-widest text-slate-300">School Total</td>
                    <td className="px-4 py-4 text-center text-slate-300 font-bold">{T.total}</td>
                    <td className="px-4 py-4 text-center text-xl font-black text-emerald-400">{T.present}</td>
                    <td className="px-4 py-4 text-center">
                      {T.absent > 0 ? <span className="bg-rose-500 text-white text-sm font-black rounded-lg px-3 py-0.5">{T.absent}</span> : <span className="text-slate-500 text-xl font-black">0</span>}
                    </td>
                    <td className="px-4 py-4 text-center text-blue-300 font-bold">{T.leave}</td>
                    <td className="px-4 py-4 text-center text-amber-300 font-bold">{T.late}</td>
                    <td className="px-4 py-4 text-center">
                      {T.not_marked > 0 ? <span className="bg-orange-500 text-white text-sm font-black px-2.5 py-0.5 rounded-lg">{T.not_marked}</span> : <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />}
                    </td>
                    <td className="px-4 py-4 text-center text-base font-black text-emerald-400">{overallPct}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
