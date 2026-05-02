import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  CalendarCheck, Download, Printer, ChevronDown, ChevronRight,
  Users, X, AlertTriangle, CheckCircle2, TrendingUp, Filter, Search, Calendar, Clock, Umbrella
} from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';
import { cn, formatDate } from '../../lib/utils';
import { PageHeader, Card, Btn, Badge, Select, Input, EmptyState } from '../../components/ui';
import { motion, AnimatePresence } from 'framer-motion';

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

const STATUS_FILTERS = [
  { key: 'all',        label: 'All',         variant: 'neutral' as const },
  { key: 'present',    label: 'Present',     variant: 'success' as const },
  { key: 'absent',     label: 'Absent',      variant: 'danger' as const },
  { key: 'late',       label: 'Late',        variant: 'warning' as const },
  { key: 'leave',      label: 'Leave',       variant: 'info' as const },
  { key: 'vacation',   label: 'Vacation',    variant: 'info' as const },
  { key: 'not_marked', label: 'Unmarked',    variant: 'neutral' as const },
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
  const [activeVacation, setActiveVacation] = useState<any>(null);

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
      supabase.from('vacations').select('*').eq('school_id', sid),
    ]);
    if (!classes) { setLoading(false); return; }

    const vMatch = (arguments[0] as any[]).find((v: any) => date >= v.start_date && date <= v.end_date);
    setActiveVacation(vMatch || null);

    const attMap: Record<string, { status: string; arrival_time: string | null; departure_time: string | null }> = {};
    attData?.forEach(a => { attMap[a.student_id] = { status: a.status, arrival_time: a.arrival_time, departure_time: a.departure_time }; });

    const byClass: Record<string, typeof students> = {};
    students?.forEach(s => { if (!byClass[s.class_id]) byClass[s.class_id] = []; byClass[s.class_id].push(s); });

    const result: ClassSummary[] = classes.map(cls => {
      const cs = byClass[cls.id] || [];
      let present = 0, absent = 0, leave = 0, late = 0, vacation = 0, not_marked = 0;
      const detail: StudentAtt[] = cs.map((s: any) => {
        const a = attMap[s.id];
        if (!a) { 
          if (vMatch) { vacation++; return { id: s.id, name: s.full_name, roll_number: s.roll_number, status: 'vacation', arrival_time: null, departure_time: null }; }
          not_marked++; return { id: s.id, name: s.full_name, roll_number: s.roll_number, status: null, arrival_time: null, departure_time: null }; 
        }
        if (a.status === 'present') present++;
        else if (a.status === 'absent') absent++;
        else if (a.status === 'leave') leave++;
        else if (a.status === 'late') late++;
        else if (a.status === 'vacation') vacation++;
        return { id: s.id, name: s.full_name, roll_number: s.roll_number, status: a.status, arrival_time: a.arrival_time, departure_time: a.departure_time };
      });
      const marked = present + absent + leave + late + vacation;
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
          const allElements = clonedDoc.getElementsByTagName('*');
          for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i] as HTMLElement;
            const style = window.getComputedStyle(el);
            if (style.color.includes('oklch')) el.style.color = 'rgb(0,0,0)';
            if (style.backgroundColor.includes('oklch')) el.style.backgroundColor = 'rgba(0,0,0,0)';
            if (style.borderColor.includes('oklch')) el.style.borderColor = 'rgba(0,0,0,0)';
          }
          const printHeader = clonedDoc.querySelector('.hidden.print\\:flex') as HTMLElement;
          if (printHeader) {
            printHeader.style.display = 'flex';
            printHeader.style.flexDirection = 'column';
          }
          const noPrint = clonedDoc.querySelectorAll('.no-print');
          noPrint.forEach(n => (n as HTMLElement).style.display = 'none');
          
          const container = clonedDoc.querySelector('.print-scale') as HTMLElement;
          if (container) {
            container.style.width = '1120px';
            container.style.padding = '20px';
            container.style.zoom = '1';
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
      window.print();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <style>{`
        @media print {
          @page { size: landscape; margin: 5mm; }
          .no-print { display:none!important; }
          body { background:white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-scale { zoom: 0.85; width: 100%; }
          table { border-collapse:collapse; width: 100%; font-size: 11px !important; table-layout: auto !important; break-inside: avoid !important; }
          th,td { border:1px solid #e5e7eb; padding:4px 6px !important; line-height: 1.1 !important; }
        }
      `}</style>

      {/* PRINT-ONLY HEADER */}
      <div className="hidden print:flex flex-col items-center justify-center pb-4 mb-4 border-b-2 border-slate-900">
        <h1 className="text-2xl font-black uppercase tracking-widest text-slate-900">Daily Attendance Report</h1>
        <p className="text-sm font-bold text-slate-500 mt-1">{formatDate(date)}</p>
      </div>

      <PageHeader
        title="Daily Report"
        subtitle="Class-wise attendance summary and student drill-down."
        actions={
          <div className="flex flex-wrap gap-3 no-print">
            <Btn
              variant="outline"
              onClick={() => exportToCSV(`daily-att-${date}`, displayed.map(c => ({
                class_name: c.class_name, total: c.total, present: c.present, absent: c.absent,
                leave: c.leave, late: c.late, not_marked: c.not_marked, pct: c.attendance_pct,
              })), [
                { header: 'Class', key: 'class_name' }, { header: 'Total', key: 'total' },
                { header: 'Present', key: 'present' }, { header: 'Absent', key: 'absent' },
                { header: 'Leave', key: 'leave' }, { header: 'Late', key: 'late' },
                { header: 'Not Marked', key: 'not_marked' }, { header: 'Att %', key: 'pct' },
              ])}
              icon={Download}
            >
              CSV
            </Btn>
            <Btn variant="outline" onClick={() => window.print()} icon={Printer}>
              Print
            </Btn>
            <Btn variant="primary" onClick={handleDownloadPDF} icon={Download} disabled={loading}>
              {loading ? 'Processing...' : 'PDF Report'}
            </Btn>
          </div>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-6">
        {[
          { label: 'Total Enrolled', value: T.total, icon: Users, color: 'slate' },
          { label: 'Present Today', value: T.present, icon: CheckCircle2, color: 'emerald' },
          { label: 'Absent Today', value: T.absent, icon: X, color: 'rose' },
          { label: 'Arrived Late', value: T.late, icon: Clock, color: 'amber' },
          { label: 'On Holiday', value: activeVacation ? T.total : summary.reduce((a,b) => a + (b as any).vacation, 0), icon: Umbrella, color: 'sky' },
          { label: 'Att. Rate', value: `${overallPct}%`, icon: TrendingUp, color: overallPct >= 90 ? 'emerald' : overallPct >= 75 ? 'indigo' : 'rose' },
        ].map((stat) => (
          <Card key={stat.label} className="p-4 flex flex-col items-center text-center">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center mb-3",
              stat.color === 'emerald' ? "bg-emerald-50 text-emerald-600" :
              stat.color === 'rose' ? "bg-rose-50 text-rose-600" :
              stat.color === 'amber' ? "bg-amber-50 text-amber-600" :
              stat.color === 'indigo' ? "bg-indigo-50 text-indigo-600" :
              stat.color === 'sky' ? "bg-sky-50 text-sky-600" :
              "bg-slate-50 text-slate-600"
            )}>
              <stat.icon className="w-5 h-5" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{stat.label}</p>
            <p className="text-xl font-black text-slate-900 mt-1">{stat.value}</p>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="p-6 no-print">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          <Input
            label="Report Date"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            icon={Calendar}
          />
          <Select
            label="Class Filter"
            value={classFilter}
            onChange={e => setClassFilter(e.target.value)}
            icon={Filter}
          >
            <option value="all">All Classes</option>
            {summary.map(c => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
          </Select>
          <Input
            label="Search Student"
            placeholder="Name or roll number..."
            value={searchStudent}
            onChange={e => setSearchStudent(e.target.value)}
            icon={Search}
          />
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {STATUS_FILTERS.map(sf => (
            <Btn
              key={sf.key}
              variant={statusFilter === sf.key ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(sf.key)}
              className="text-[10px] tracking-widest"
            >
              {sf.label}
            </Btn>
          ))}
        </div>
      </Card>

      {/* Main Table */}
      <Card className="p-0 overflow-hidden border-none shadow-xl">
        <div className="overflow-x-auto print-scale">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="p-4 w-10 no-print" />
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Class Info</th>
                <th className="p-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Total</th>
                <th className="p-4 text-center text-[10px] font-black uppercase tracking-widest text-emerald-600">Present</th>
                <th className="p-4 text-center text-[10px] font-black uppercase tracking-widest text-rose-600">Absent</th>
                <th className="p-4 text-center text-[10px] font-black uppercase tracking-widest text-indigo-600">Leave</th>
                <th className="p-4 text-center text-[10px] font-black uppercase tracking-widest text-amber-600">Late</th>
                <th className="p-4 text-center text-[10px] font-black uppercase tracking-widest text-orange-600">Unmarked</th>
                <th className="p-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Attendance %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-20 text-center">
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="mt-4 text-slate-400 font-bold uppercase text-[10px] tracking-widest">Loading Report...</p>
                  </td>
                </tr>
              ) : displayed.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-0">
                    {activeVacation ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-4 bg-sky-50/30">
                        <div className="w-16 h-16 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 shadow-inner">
                          <Umbrella className="w-8 h-8" />
                        </div>
                        <div className="text-center">
                          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">{activeVacation.name}</h3>
                          <p className="text-xs font-bold text-sky-600 uppercase tracking-widest mt-1">Institutional Holiday Active</p>
                        </div>
                      </div>
                    ) : (
                      <EmptyState
                        icon={CalendarCheck}
                        title="No Attendance Records"
                        description="No classes or attendance records found for this date."
                      />
                    )}
                  </td>
                </tr>
              ) : (
                displayed.map((cls, idx) => {
                  const isExpanded = expandedClass === cls.class_id;
                  const allNA = cls.not_marked === cls.total;
                  const c = pctColor(cls.attendance_pct, allNA);
                  
                  return (
                    <React.Fragment key={cls.class_id}>
                      <tr 
                        onClick={() => setExpandedClass(prev => prev === cls.class_id ? null : cls.class_id)}
                        className={cn(
                          "cursor-pointer hover:bg-slate-50 transition-all group",
                          isExpanded && "bg-indigo-50/30"
                        )}
                      >
                        <td className="p-4 no-print text-slate-300 group-hover:text-indigo-600">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </td>
                        <td className="p-4">
                          <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{cls.class_name}</p>
                          {cls.class_teacher && <p className="text-[10px] font-bold text-slate-400 mt-0.5">{cls.class_teacher}</p>}
                        </td>
                        <td className="p-4 text-center font-bold text-slate-500">{cls.total}</td>
                        <td className="p-4 text-center">
                          <span className="text-lg font-black text-emerald-600">{cls.present}</span>
                        </td>
                        <td className="p-4 text-center">
                          <span className={cn(
                            "inline-flex items-center justify-center px-2.5 py-0.5 rounded-lg text-sm font-black transition-all",
                            cls.absent > 0 ? "bg-rose-100 text-rose-700" : "text-slate-200"
                          )}>
                            {cls.absent}
                          </span>
                        </td>
                        <td className="p-4 text-center text-sm font-bold text-indigo-600">{cls.leave}</td>
                        <td className="p-4 text-center text-sm font-bold text-amber-600">{cls.late}</td>
                        <td className="p-4 text-center">
                          <Badge variant={cls.not_marked > 0 ? 'warning' : 'success'}>
                            {cls.not_marked > 0 ? cls.not_marked : 'Full'}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col items-center gap-1.5">
                            <span className={cn("text-xs font-black", c.text)}>{allNA ? 'N/A' : `${cls.attendance_pct}%`}</span>
                            {!allNA && (
                              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className={cn("h-full rounded-full", c.bar)} style={{ width: `${cls.attendance_pct}%` }} />
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="no-print">
                          <td colSpan={9} className="p-0 border-b border-indigo-100 bg-indigo-50/10">
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="p-6 overflow-hidden"
                            >
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {cls.students
                                  .filter(s => {
                                    const matchStatus = statusFilter === 'all' || 
                                      (statusFilter === 'not_marked' && !s.status) || 
                                      s.status === statusFilter;
                                    const matchSearch = !searchStudent || 
                                      s.name.toLowerCase().includes(searchStudent.toLowerCase()) || 
                                      String(s.roll_number).includes(searchStudent);
                                    return matchStatus && matchSearch;
                                  })
                                  .map(s => (
                                    <div key={s.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-indigo-200 transition-all">
                                      <div className="flex items-center gap-3">
                                        <div className={cn(
                                          "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black text-white",
                                          s.status === 'present' ? "bg-emerald-500" :
                                          s.status === 'absent' ? "bg-rose-500" :
                                          s.status === 'late' ? "bg-amber-500" :
                                          s.status === 'leave' ? "bg-indigo-500" : 
                                          s.status === 'vacation' ? "bg-sky-500" : "bg-slate-300"
                                        )}>
                                          {s.roll_number}
                                        </div>
                                        <div>
                                          <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{s.name}</p>
                                          <p className="text-[9px] font-bold text-slate-400 mt-0.5">
                                            {s.status ? s.status.toUpperCase() : 'NOT MARKED'}
                                          </p>
                                        </div>
                                      </div>
                                      {s.arrival_time && (
                                        <div className="text-right">
                                          <p className="text-[9px] font-black text-slate-500">{s.arrival_time.slice(0, 5)}</p>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-900 text-white">
                <td className="p-6 no-print" />
                <td className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Grand Total</td>
                <td className="p-6 text-center text-base font-black">{T.total}</td>
                <td className="p-6 text-center text-2xl font-black text-emerald-400">{T.present}</td>
                <td className="p-6 text-center text-2xl font-black text-rose-400">{T.absent}</td>
                <td className="p-6 text-center text-base font-black text-indigo-300">{T.leave}</td>
                <td className="p-6 text-center text-base font-black text-amber-300">{T.late}</td>
                <td className="p-6 text-center">
                  <Badge variant={T.not_marked > 0 ? 'warning' : 'success'} className="bg-white/10 text-white border-white/10">
                    {T.not_marked}
                  </Badge>
                </td>
                <td className="p-6 text-center text-2xl font-black text-indigo-400">{overallPct}%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}
