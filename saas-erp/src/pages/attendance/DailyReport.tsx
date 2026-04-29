import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CalendarCheck, Download, Printer, ChevronDown, ChevronRight, Users, X } from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';
import { cn, formatDate } from '../../lib/utils';

interface ClassSummary {
  class_id: string;
  class_name: string;
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

const STATUS_COLOR: Record<string, string> = {
  present: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  absent:  'bg-rose-100 text-rose-700 border-rose-200',
  late:    'bg-amber-100 text-amber-700 border-amber-200',
  leave:   'bg-blue-100 text-blue-700 border-blue-200',
};
const statusBadge = (s: string | null) =>
  cn('text-[9px] font-black px-2 py-0.5 rounded-full border shrink-0', STATUS_COLOR[s ?? ''] ?? 'bg-slate-100 text-slate-400 border-slate-200');

const pctBadge = (pct: number, na = false) =>
  cn('inline-block px-2 py-0.5 rounded-full text-xs font-bold',
    na ? 'bg-slate-100 text-slate-400'
       : pct >= 80 ? 'bg-emerald-100 text-emerald-700'
       : pct >= 60 ? 'bg-yellow-100 text-yellow-700'
       : 'bg-red-100 text-red-700');

export default function DailyReport() {
  const { userRole } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [summary, setSummary] = useState<ClassSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [searchStudent, setSearchStudent] = useState('');

  useEffect(() => {
    if (userRole?.school_id) fetchReport();
  }, [userRole, date]);

  const fetchReport = async () => {
    setLoading(true);
    const sid = userRole!.school_id;

    const [{ data: classes }, { data: students }, { data: attData }] = await Promise.all([
      supabase.from('classes').select('id, name, section').eq('school_id', sid).order('name'),
      supabase.from('students').select('id, full_name, roll_number, class_id').eq('school_id', sid).eq('status', 'active').eq('is_deleted', false).order('roll_number'),
      supabase.from('attendance').select('student_id, status, arrival_time, departure_time')
        .eq('school_id', sid).eq('date', date).not('student_id', 'is', null),
    ]);

    if (!classes) { setLoading(false); return; }

    const attMap: Record<string, { status: string; arrival_time: string | null; departure_time: string | null }> = {};
    attData?.forEach(a => { attMap[a.student_id] = { status: a.status, arrival_time: a.arrival_time, departure_time: a.departure_time }; });

    const studentsByClass: Record<string, typeof students> = {};
    students?.forEach(s => {
      if (!studentsByClass[s.class_id]) studentsByClass[s.class_id] = [];
      studentsByClass[s.class_id].push(s);
    });

    const result: ClassSummary[] = classes.map(cls => {
      const classStudents = studentsByClass[cls.id] || [];
      let present = 0, absent = 0, leave = 0, late = 0, not_marked = 0;
      const studentsDetail: StudentAtt[] = classStudents.map((s: any) => {
        const att = attMap[s.id];
        if (!att) { not_marked++; return { id: s.id, name: s.full_name, roll_number: s.roll_number, status: null, arrival_time: null, departure_time: null }; }
        if (att.status === 'present') present++;
        else if (att.status === 'absent') absent++;
        else if (att.status === 'leave') leave++;
        else if (att.status === 'late') late++;
        return { id: s.id, name: s.full_name, roll_number: s.roll_number, status: att.status, arrival_time: att.arrival_time, departure_time: att.departure_time };
      });
      const marked = present + absent + leave + late;
      return {
        class_id: cls.id,
        class_name: `${cls.name}${cls.section ? '-' + cls.section : ''}`,
        total: classStudents.length, present, absent, leave, late, not_marked,
        attendance_pct: marked > 0 ? Math.round((present / marked) * 100) : 0,
        students: studentsDetail,
      };
    });

    setSummary(result);
    setLoading(false);
  };

  // Derived totals
  const displayed = summary.filter(c => classFilter === 'all' || c.class_id === classFilter);
  const schoolTotal = displayed.reduce((a, s) => ({
    total: a.total + s.total, present: a.present + s.present,
    absent: a.absent + s.absent, leave: a.leave + s.leave, late: a.late + s.late, not_marked: a.not_marked + s.not_marked,
  }), { total: 0, present: 0, absent: 0, leave: 0, late: 0, not_marked: 0 });
  const overallPct = (schoolTotal.present + schoolTotal.absent) > 0
    ? Math.round((schoolTotal.present / (schoolTotal.present + schoolTotal.absent)) * 100) : 0;

  const toggleClass = (classId: string) =>
    setExpandedClass(prev => prev === classId ? null : classId);

  const STATUS_FILTERS = [
    { key: 'all',        label: 'All',        active: 'bg-gray-800 text-white border-gray-800' },
    { key: 'present',    label: 'Present',    active: 'bg-emerald-500 text-white border-emerald-500' },
    { key: 'absent',     label: 'Absent',     active: 'bg-rose-500 text-white border-rose-500' },
    { key: 'late',       label: 'Late',       active: 'bg-amber-500 text-white border-amber-500' },
    { key: 'leave',      label: 'Leave',      active: 'bg-blue-500 text-white border-blue-500' },
    { key: 'not_marked', label: 'Not Marked', active: 'bg-slate-500 text-white border-slate-500' },
  ];

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          .no-print { display:none!important; }
          body { background:white; }
          table { border-collapse: collapse; }
          th, td { border: 1px solid #e5e7eb; }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-wrap justify-between items-start gap-3 no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-blue-600" /> Daily Attendance Report
          </h1>
          <p className="text-gray-500 text-sm mt-1">Class-wise attendance summary with student drill-down.</p>
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
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="no-print bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
            <input type="date" value={date}
              onChange={e => { setDate(e.target.value); setExpandedClass(null); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Class</label>
            <select value={classFilter} onChange={e => setClassFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 min-w-[160px]">
              <option value="all">All Classes</option>
              {summary.map(c => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
            </select>
          </div>
          <div className="ml-auto">
            <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
            <div className="relative">
              <input value={searchStudent} onChange={e => setSearchStudent(e.target.value)}
                placeholder="Name or roll #..."
                className="border border-gray-300 rounded-lg pl-3 pr-8 py-2 text-sm focus:ring-2 focus:ring-blue-500 w-48" />
              {searchStudent && (
                <button onClick={() => setSearchStudent('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
        {/* Status filter pills */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Filter by Status</label>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map(sf => (
              <button key={sf.key} onClick={() => setStatusFilter(sf.key)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all border',
                  statusFilter === sf.key ? sf.active : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400')}>
                {sf.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {[
          { label: 'Total',    value: schoolTotal.total,    color: 'text-gray-800',    bg: 'bg-gray-50',    border: 'border-gray-200' },
          { label: 'Present',  value: schoolTotal.present,  color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { label: 'Absent',   value: schoolTotal.absent,   color: 'text-rose-700',    bg: 'bg-rose-50',    border: 'border-rose-100' },
          { label: 'Late',     value: schoolTotal.late,     color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-100' },
          { label: 'On Leave', value: schoolTotal.leave,    color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-100' },
          {
            label: 'Att. %',
            value: `${overallPct}%`,
            color: overallPct >= 80 ? 'text-emerald-700' : overallPct >= 60 ? 'text-yellow-700' : 'text-red-700',
            bg: overallPct >= 80 ? 'bg-emerald-50' : overallPct >= 60 ? 'bg-yellow-50' : 'bg-red-50',
            border: overallPct >= 80 ? 'border-emerald-100' : overallPct >= 60 ? 'border-yellow-100' : 'border-red-100',
          },
        ].map(m => (
          <div key={m.label} className={cn('rounded-xl border p-4 text-center', m.bg, m.border)}>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{m.label}</p>
            <p className={`text-2xl font-black mt-1 ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Table header bar */}
        <div className="px-5 py-3.5 border-b border-gray-200 flex items-center gap-3">
          <Users className="w-4 h-4 text-gray-500" />
          <h2 className="font-semibold text-gray-800">{formatDate(date)}</h2>
          {classFilter !== 'all' && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
              Filtered: {displayed[0]?.class_name}
            </span>
          )}
          {statusFilter !== 'all' && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold capitalize">
              Status: {statusFilter.replace('_', ' ')}
            </span>
          )}
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-gray-400 text-sm mt-3">Loading attendance data…</p>
          </div>
        ) : displayed.length === 0 ? (
          <div className="p-12 text-center text-gray-400">No classes found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="w-8 px-4 py-3" />
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Class</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-emerald-600 uppercase tracking-wider">Present</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-rose-500 uppercase tracking-wider">Absent</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-blue-500 uppercase tracking-wider">Leave</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-amber-500 uppercase tracking-wider">Late</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">Not Marked</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Att. %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayed.map(cls => {
                  let studentsToShow = cls.students;
                  if (statusFilter === 'not_marked') studentsToShow = studentsToShow.filter(s => s.status === null);
                  else if (statusFilter !== 'all') studentsToShow = studentsToShow.filter(s => s.status === statusFilter);
                  if (searchStudent) studentsToShow = studentsToShow.filter(s =>
                    s.name.toLowerCase().includes(searchStudent.toLowerCase()) ||
                    String(s.roll_number).includes(searchStudent));

                  const isExpanded = expandedClass === cls.class_id;
                  const allNotMarked = cls.not_marked === cls.total;

                  return (
                    <React.Fragment key={cls.class_id}>
                      {/* Class summary row */}
                      <tr
                        onClick={() => toggleClass(cls.class_id)}
                        className="cursor-pointer hover:bg-blue-50 transition-colors"
                      >
                        <td className="px-4 py-3 text-gray-400">
                          {isExpanded
                            ? <ChevronDown className="w-4 h-4" />
                            : <ChevronRight className="w-4 h-4" />}
                        </td>
                        <td className="px-4 py-3 font-bold text-gray-900">{cls.class_name}</td>
                        <td className="px-4 py-3 text-center text-gray-600">{cls.total}</td>
                        <td className="px-4 py-3 text-center font-semibold text-emerald-600">{cls.present}</td>
                        <td className="px-4 py-3 text-center font-semibold text-rose-600">{cls.absent}</td>
                        <td className="px-4 py-3 text-center text-blue-600">{cls.leave}</td>
                        <td className="px-4 py-3 text-center text-amber-600">{cls.late}</td>
                        <td className="px-4 py-3 text-center text-slate-400 text-xs">
                          {cls.not_marked > 0
                            ? <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold">{cls.not_marked}</span>
                            : <span className="text-emerald-400">✓</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={pctBadge(cls.attendance_pct, allNotMarked)}>
                            {allNotMarked ? 'N/A' : `${cls.attendance_pct}%`}
                          </span>
                        </td>
                      </tr>

                      {/* Drill-down row */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={9} className="bg-slate-50 px-6 pb-5 pt-3 border-t border-slate-200">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
                              {cls.class_name} — {studentsToShow.length} student{studentsToShow.length !== 1 ? 's' : ''} shown
                            </p>
                            {studentsToShow.length === 0 ? (
                              <p className="text-xs text-slate-400 italic py-2">No students match the current filter.</p>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                                {studentsToShow.map(s => (
                                  <div key={s.id}
                                    className={cn('flex items-center gap-2.5 p-2.5 rounded-xl border',
                                      s.status === 'absent' ? 'bg-rose-50 border-rose-100' :
                                      s.status === 'present' ? 'bg-emerald-50 border-emerald-100' :
                                      s.status === 'late' ? 'bg-amber-50 border-amber-100' :
                                      s.status === 'leave' ? 'bg-blue-50 border-blue-100' : 'bg-white border-slate-200')}>
                                    <span className="text-[10px] font-black text-slate-400 w-10 shrink-0">#{s.roll_number}</span>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-bold text-slate-800 truncate">{s.name}</p>
                                      {s.arrival_time && (
                                        <p className="text-[10px] text-slate-400">
                                          In: {s.arrival_time}{s.departure_time ? ` · Out: ${s.departure_time}` : ''}
                                        </p>
                                      )}
                                    </div>
                                    <span className={statusBadge(s.status)}>
                                      {s.status?.toUpperCase() ?? 'N/M'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 border-t-2 border-gray-300 font-bold text-sm">
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-gray-800 uppercase tracking-wide text-xs">School Total</td>
                  <td className="px-4 py-3 text-center text-gray-700">{schoolTotal.total}</td>
                  <td className="px-4 py-3 text-center text-emerald-700">{schoolTotal.present}</td>
                  <td className="px-4 py-3 text-center text-rose-700">{schoolTotal.absent}</td>
                  <td className="px-4 py-3 text-center text-blue-700">{schoolTotal.leave}</td>
                  <td className="px-4 py-3 text-center text-amber-600">{schoolTotal.late}</td>
                  <td className="px-4 py-3 text-center text-slate-500">{schoolTotal.not_marked}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={pctBadge(overallPct)}>
                      {overallPct}%
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
