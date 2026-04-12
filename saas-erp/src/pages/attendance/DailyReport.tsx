import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CalendarCheck, Download, Printer } from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';

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
}

export default function DailyReport() {
  const { userRole } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [summary, setSummary] = useState<ClassSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (userRole?.school_id) fetchReport();
  }, [userRole, date]);

  const fetchReport = async () => {
    setLoading(true);
    const sid = userRole!.school_id;

    // Get all classes with student count
    const { data: classes } = await supabase.from('classes').select('id, name, section').eq('school_id', sid).order('name');
    if (!classes) { setLoading(false); return; }

    // Get all students per class
    const { data: students } = await supabase.from('students').select('id, class_id').eq('school_id', sid).eq('status', 'active');
    const studentsByClass: Record<string, string[]> = {};
    students?.forEach(s => {
      if (!studentsByClass[s.class_id]) studentsByClass[s.class_id] = [];
      studentsByClass[s.class_id].push(s.id);
    });

    // Get attendance for this date
    const { data: attData } = await supabase
      .from('attendance')
      .select('student_id, status')
      .eq('school_id', sid)
      .eq('date', date);

    const attByStudent: Record<string, string> = {};
    attData?.forEach(a => { attByStudent[a.student_id] = a.status; });

    const result: ClassSummary[] = classes.map(cls => {
      const classStudents = studentsByClass[cls.id] || [];
      const total = classStudents.length;
      let present = 0, absent = 0, leave = 0, late = 0, not_marked = 0;
      classStudents.forEach(sid => {
        const status = attByStudent[sid];
        if (!status) { not_marked++; return; }
        if (status === 'present') present++;
        else if (status === 'absent') absent++;
        else if (status === 'leave') leave++;
        else if (status === 'late') late++;
      });
      const marked = present + absent + leave + late;
      return {
        class_id: cls.id,
        class_name: `${cls.name}-${cls.section}`,
        total, present, absent, leave, late, not_marked,
        attendance_pct: marked > 0 ? Math.round((present / marked) * 100) : 0,
      };
    });

    setSummary(result);
    setLoading(false);
  };

  const schoolTotal = { total: 0, present: 0, absent: 0, leave: 0, late: 0, not_marked: 0 };
  summary.forEach(s => { schoolTotal.total += s.total; schoolTotal.present += s.present; schoolTotal.absent += s.absent; schoolTotal.leave += s.leave; schoolTotal.late += s.late; schoolTotal.not_marked += s.not_marked; });
  const overallPct = (schoolTotal.present + schoolTotal.absent) > 0 ? Math.round((schoolTotal.present / (schoolTotal.present + schoolTotal.absent)) * 100) : 0;

  return (
    <div className="space-y-6">
      <style>{`@media print { .no-print { display:none!important; } body { background:white; } }`}</style>

      <div className="flex justify-between items-start no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-blue-600" /> Daily Attendance Report
          </h1>
          <p className="text-gray-500 text-sm mt-1">Class-wise attendance summary for any day.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportToCSV(`daily-attendance-${date}`, summary, [
            { header: 'Class', key: 'class_name' }, { header: 'Total', key: 'total' },
            { header: 'Present', key: 'present' }, { header: 'Absent', key: 'absent' },
            { header: 'Leave', key: 'leave' }, { header: 'Late', key: 'late' },
            { header: 'Not Marked', key: 'not_marked' }, { header: 'Attendance %', key: 'attendance_pct' },
          ])} className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 no-print">
        <label className="text-sm font-medium text-gray-600">Report Date:</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* School-wide summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Students', value: schoolTotal.total, color: 'text-gray-800' },
          { label: 'Present', value: schoolTotal.present, color: 'text-green-600' },
          { label: 'Absent', value: schoolTotal.absent, color: 'text-red-600' },
          { label: 'On Leave', value: schoolTotal.leave, color: 'text-yellow-600' },
          { label: 'Attendance %', value: `${overallPct}%`, color: overallPct >= 80 ? 'text-green-600' : overallPct >= 60 ? 'text-yellow-600' : 'text-red-600' },
        ].map(m => (
          <div key={m.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{m.label}</p>
            <p className={`text-2xl font-black mt-1 ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-800">Class-wise Breakdown — {new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h2>
        </div>
        {loading ? <div className="p-12 text-center text-gray-400">Loading report...</div> :
          summary.length === 0 ? <div className="p-12 text-center text-gray-400">No classes found.</div> : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Class</th>
                  <th className="px-6 py-3 text-center font-medium text-gray-500">Total</th>
                  <th className="px-6 py-3 text-center font-medium text-green-600">Present</th>
                  <th className="px-6 py-3 text-center font-medium text-red-600">Absent</th>
                  <th className="px-6 py-3 text-center font-medium text-yellow-600">Leave</th>
                  <th className="px-6 py-3 text-center font-medium text-orange-500">Late</th>
                  <th className="px-6 py-3 text-center font-medium text-gray-400">Not Marked</th>
                  <th className="px-6 py-3 text-center font-medium text-blue-600">Att. %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {summary.map(cls => (
                  <tr key={cls.class_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{cls.class_name}</td>
                    <td className="px-6 py-4 text-center text-gray-700">{cls.total}</td>
                    <td className="px-6 py-4 text-center font-medium text-green-600">{cls.present}</td>
                    <td className="px-6 py-4 text-center font-medium text-red-600">{cls.absent}</td>
                    <td className="px-6 py-4 text-center text-yellow-600">{cls.leave}</td>
                    <td className="px-6 py-4 text-center text-orange-500">{cls.late}</td>
                    <td className="px-6 py-4 text-center text-gray-400 text-xs">{cls.not_marked > 0 ? cls.not_marked : '—'}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-1 text-xs font-bold rounded-full ${cls.attendance_pct >= 80 ? 'bg-green-100 text-green-800' : cls.attendance_pct >= 60 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                        {cls.not_marked === cls.total ? 'N/A' : `${cls.attendance_pct}%`}
                      </span>
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-100 font-bold">
                  <td className="px-6 py-4 text-gray-900">SCHOOL TOTAL</td>
                  <td className="px-6 py-4 text-center">{schoolTotal.total}</td>
                  <td className="px-6 py-4 text-center text-green-700">{schoolTotal.present}</td>
                  <td className="px-6 py-4 text-center text-red-700">{schoolTotal.absent}</td>
                  <td className="px-6 py-4 text-center text-yellow-700">{schoolTotal.leave}</td>
                  <td className="px-6 py-4 text-center text-orange-600">{schoolTotal.late}</td>
                  <td className="px-6 py-4 text-center text-gray-400">{schoolTotal.not_marked}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 text-xs font-bold rounded-full ${overallPct >= 80 ? 'bg-green-100 text-green-800' : overallPct >= 60 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                      {overallPct}%
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          )}
      </div>
    </div>
  );
}
