import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CalendarCheck, Download, Printer, ChevronDown, ChevronRight, Users, X } from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';
import { cn } from '../../lib/utils';

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
      supabase.from('students').select('id, full_name, roll_number, class_id').eq('school_id', sid).eq('status', 'active').order('roll_number'),
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
        class_name: `${cls.name}-${cls.section}`,
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

  const toggleClass = (classId: string) => setExpandedClass(prev => prev === classId ? null : classId);

  const statusColor = (s: string | null) => {
    if (s === 'present') return 'bg-emerald-100 text-emerald-700';
    if (s === 'absent') return 'bg-rose-100 text-rose-700';
    if (s === 'late') return 'bg-amber-100 text-amber-700';
    if (s === 'leave') return 'bg-blue-100 text-blue-700';
    return 'bg-slate-100 text-slate-400';
  };

  return (
    <div className="space-y-6">
      <style>{`@media print { .no-print { display:none!important; } body { background:white; } }`}</style>

      {/* Header */}
      <div className="flex justify-between items-start no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-blue-600" /> Daily Attendance Report
          </h1>
          <p className="text-gray-500 text-sm mt-1">Class-wise attendance summary with student drill-down.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportToCSV(`daily-att-${date}`, displayed.map(c => ({
            class_name: c.class_name, total: c.total, present: c.present, absent: c.absent,
            leave: c.leave, late: c.late, not_marked: c.not_marked, pct: c.attendance_pct,
          })), [
            { header: 'Class', key: 'class_name' }, { header: 'Total', key: 'total' },
            { header: 'Present', key: 'present' }, { header: 'Absent', key: 'absent' },
            { header: 'Leave', key: 'leave' }, { header: 'Late', key: 'late' },
            { header: 'Not Marked', key: 'not_marked' }, { header: 'Att %', key: 'pct' },
          ])} className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>

      {/* Filters Row */}
      <div className="no-print flex flex-wrap items-center gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
          <input type="date" value={date} onChange={e => { setDate(e.target.value); setExpandedClass(null); }}
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
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Status Filter</label>
          <div className="flex gap-1">
            {['all', 'present', 'absent', 'late', 'leave'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={cn('px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all border',
                  statusFilter === s
                    ? s === 'absent' ? 'bg-rose-500 text-white border-rose-500'
                    : s === 'present' ? 'bg-emerald-500 text-white border-emerald-500'
                    : s === 'late' ? 'bg-amber-500 text-white border-amber-500'
                    : s === 'leave' ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-gray-800 text-white border-gray-800'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400')}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="ml-auto">
          <div className="relative">
            <input value={searchStudent} onChange={e => setSearchStudent(e.target.value)}
              placeholder="Search student..."
              className="border border-gray-300 rounded-lg pl-3 pr-8 py-2 text-sm focus:ring-2 focus:ring-blue-500 w-48" />
            {searchStudent && (
              <button onClick={() => setSearchStudent('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {[
          { label: 'Total', value: schoolTotal.total, color: 'text-gray-800' },
          { label: 'Present', value: schoolTotal.present, color: 'text-emerald-600' },
          { label: 'Absent', value: schoolTotal.absent, color: 'text-red-600' },
          { label: 'Late', value: schoolTotal.late, color: 'text-orange-500' },
          { label: 'On Leave', value: schoolTotal.leave, color: 'text-blue-600' },
          {
            label: 'Att. %', value: `${overallPct}%`,
            color: overallPct >= 80 ? 'text-emerald-600' : overallPct >= 60 ? 'text-yellow-600' : 'text-red-600',
          },
        ].map(m => (
          <div key={m.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{m.label}</p>
            <p className={`text-2xl font-black mt-1 ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Class Table with Expandable Student Details */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center gap-3">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Users className="w-4 h-4" />
            {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </h2>
          {classFilter !== 'all' && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
              Filtered: {displayed[0]?.class_name}
            </span>
          )}
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading...</div>
        ) : displayed.length === 0 ? (
          <div className="p-12 text-center text-gray-400">No classes found.</div>
        ) : (
          <div>
            {displayed.map(cls => {
              // Filter students
              let studentsToShow = cls.students;
              if (statusFilter !== 'all') studentsToShow = studentsToShow.filter(s => s.status === statusFilter || (statusFilter === 'present' && s.status === null && false));
              if (searchStudent) studentsToShow = studentsToShow.filter(s => s.name.toLowerCase().includes(searchStudent.toLowerCase()) || String(s.roll_number).includes(searchStudent));

              const isExpanded = expandedClass === cls.class_id;

              return (
                <div key={cls.class_id} className="border-b border-gray-100 last:border-0">
                  {/* Class Summary Row */}
                  <button
                    onClick={() => toggleClass(cls.class_id)}
                    className="w-full flex items-center text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="px-4 py-3 w-8 shrink-0 text-gray-400">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                    <table className="flex-1 text-sm">
                      <tbody>
                        <tr>
                          <td className="py-3 px-2 font-bold text-gray-900 w-32">{cls.class_name}</td>
                          <td className="py-3 px-3 text-center text-gray-600 w-16">{cls.total}</td>
                          <td className="py-3 px-3 text-center font-medium text-emerald-600 w-16">{cls.present}</td>
                          <td className="py-3 px-3 text-center font-medium text-red-600 w-16">{cls.absent}</td>
                          <td className="py-3 px-3 text-center text-yellow-600 w-16">{cls.leave}</td>
                          <td className="py-3 px-3 text-center text-orange-500 w-16">{cls.late}</td>
                          <td className="py-3 px-3 text-center text-gray-300 w-20 text-xs">{cls.not_marked > 0 ? cls.not_marked : '—'}</td>
                          <td className="py-3 px-3 text-center w-20">
                            <span className={cn('px-2 py-0.5 text-xs font-bold rounded-full',
                              cls.attendance_pct >= 80 ? 'bg-green-100 text-green-800' :
                              cls.attendance_pct >= 60 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800')}>
                              {cls.not_marked === cls.total ? 'N/A' : `${cls.attendance_pct}%`}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </button>

                  {/* Student Drill-Down */}
                  {isExpanded && (
                    <div className="bg-slate-50 border-t border-slate-100 px-8 pb-4 pt-3">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
                        {cls.class_name} — Student Detail ({studentsToShow.length} shown)
                      </p>
                      {studentsToShow.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-2">No students match current filters.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {studentsToShow.map(s => (
                            <div key={s.id} className={cn('flex items-center gap-3 p-2.5 rounded-xl border',
                              s.status === 'absent' ? 'bg-rose-50 border-rose-100' :
                              s.status === 'present' ? 'bg-emerald-50 border-emerald-100' :
                              s.status === 'late' ? 'bg-amber-50 border-amber-100' :
                              s.status === 'leave' ? 'bg-blue-50 border-blue-100' : 'bg-white border-slate-200')}>
                              <span className="text-[10px] font-black text-slate-400 w-14 shrink-0 truncate">#{s.roll_number}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-800 truncate">{s.name}</p>
                                {s.arrival_time && <p className="text-[10px] text-slate-400">In: {s.arrival_time} {s.departure_time ? `· Out: ${s.departure_time}` : ''}</p>}
                              </div>
                              <span className={cn('text-[9px] font-black px-2 py-0.5 rounded-full shrink-0', statusColor(s.status))}>
                                {s.status?.toUpperCase() || 'N/M'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Footer row */}
            <div className="flex items-center bg-gray-50 border-t-2 border-gray-300 px-12 py-3 text-sm font-bold">
              <span className="flex-1 text-gray-800 w-32">SCHOOL TOTAL</span>
              <span className="text-center text-gray-700 w-16 px-3">{schoolTotal.total}</span>
              <span className="text-center text-emerald-700 w-16 px-3">{schoolTotal.present}</span>
              <span className="text-center text-red-700 w-16 px-3">{schoolTotal.absent}</span>
              <span className="text-center text-yellow-700 w-16 px-3">{schoolTotal.leave}</span>
              <span className="text-center text-orange-600 w-16 px-3">{schoolTotal.late}</span>
              <span className="text-center text-gray-400 w-20 px-3">{schoolTotal.not_marked}</span>
              <span className="text-center w-20 px-3">
                <span className={cn('px-2 py-0.5 text-xs font-bold rounded-full',
                  overallPct >= 80 ? 'bg-green-100 text-green-800' : overallPct >= 60 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800')}>
                  {overallPct}%
                </span>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
