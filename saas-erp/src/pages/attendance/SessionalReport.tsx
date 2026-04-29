import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { BarChart2, Download } from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';

interface StudentStat {
  student_id: string;
  full_name: string;
  roll_number: number;
  class_name: string;
  total_days: number;
  present: number;
  absent: number;
  leave: number;
  late: number;
  attendance_pct: number;
}

export default function SessionalReport() {
  const { userRole } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [stats, setStats] = useState<StudentStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'roll' | 'pct'>('roll');

  useEffect(() => {
    if (userRole?.school_id) fetchClasses();
  }, [userRole]);

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('id, name, section').eq('school_id', userRole!.school_id).order('name');
    setClasses(data || []);
  };

  const fetchReport = async () => {
    if (!selectedClass || !startDate || !endDate) return;
    setLoading(true);
    const sid = userRole!.school_id;

    const [{ data: students }, { data: attData }] = await Promise.all([
      supabase.from('students').select('id, full_name, roll_number').eq('school_id', sid).eq('class_id', selectedClass).eq('status', 'active').eq('is_deleted', false).order('roll_number'),
      supabase.from('attendance').select('student_id, status, date').eq('school_id', sid).gte('date', startDate).lte('date', endDate),
    ]);

    if (!students) { setLoading(false); return; }

    const attByStudent: Record<string, { present: number; absent: number; leave: number; late: number }> = {};
    students.forEach(s => { attByStudent[s.id] = { present: 0, absent: 0, leave: 0, late: 0 }; });
    attData?.forEach(a => {
      if (!attByStudent[a.student_id]) return;
      if (a.status === 'present') attByStudent[a.student_id].present++;
      else if (a.status === 'absent') attByStudent[a.student_id].absent++;
      else if (a.status === 'leave') attByStudent[a.student_id].leave++;
      else if (a.status === 'late') attByStudent[a.student_id].late++;
    });

    const cls = classes.find(c => c.id === selectedClass);
    const className = cls ? `${cls.name}-${cls.section}` : '';

    const result: StudentStat[] = students.map(s => {
      const a = attByStudent[s.id];
      const total = a.present + a.absent + a.leave + a.late;
      return {
        student_id: s.id, full_name: s.full_name, roll_number: s.roll_number,
        class_name: className, total_days: total,
        ...a,
        attendance_pct: total > 0 ? Math.round((a.present / total) * 100) : 0,
      };
    });

    setStats(result);
    setLoading(false);
  };

  const sorted = [...stats].sort((a, b) => sortBy === 'roll' ? a.roll_number - b.roll_number : b.attendance_pct - a.attendance_pct);

  const avgPct = stats.length > 0 ? Math.round(stats.reduce((s, r) => s + r.attendance_pct, 0) / stats.length) : 0;
  const below75 = stats.filter(s => s.attendance_pct < 75).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-indigo-600" /> Sessional Attendance Report
          </h1>
          <p className="text-gray-500 text-sm mt-1">Student-wise attendance percentage for any date range.</p>
        </div>
        {stats.length > 0 && (
          <button onClick={() => exportToCSV(`sessional-${selectedClass}-${startDate}-${endDate}`, sorted, [
            { header: 'Roll No', key: 'roll_number' }, { header: 'Student', key: 'full_name' }, { header: 'Class', key: 'class_name' },
            { header: 'Total Days', key: 'total_days' }, { header: 'Present', key: 'present' }, { header: 'Absent', key: 'absent' },
            { header: 'Leave', key: 'leave' }, { header: 'Late', key: 'late' }, { header: 'Attendance %', key: 'attendance_pct' },
          ])} className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4" /> Export
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Class</label>
            <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
              <option value="">Select class...</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}-{c.section}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
          </div>
          <button onClick={fetchReport} disabled={!selectedClass || loading}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {stats.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Class Average</p>
              <p className={`text-2xl font-black mt-1 ${avgPct >= 80 ? 'text-green-600' : avgPct >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>{avgPct}%</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Students</p>
              <p className="text-2xl font-black text-gray-800 mt-1">{stats.length}</p>
            </div>
            <div className={`rounded-xl shadow-sm border p-5 ${below75 > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Below 75%</p>
              <p className={`text-2xl font-black mt-1 ${below75 > 0 ? 'text-red-600' : 'text-green-600'}`}>{below75}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="font-semibold text-gray-800">Student Attendance Details</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Sort by:</span>
                <button onClick={() => setSortBy('roll')} className={`px-3 py-1 text-xs rounded-lg font-medium ${sortBy === 'roll' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>Roll No</button>
                <button onClick={() => setSortBy('pct')} className={`px-3 py-1 text-xs rounded-lg font-medium ${sortBy === 'pct' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>Attendance %</button>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Roll No</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Student Name</th>
                  <th className="px-6 py-3 text-center font-medium text-gray-500">Days</th>
                  <th className="px-6 py-3 text-center font-medium text-green-600">Present</th>
                  <th className="px-6 py-3 text-center font-medium text-red-600">Absent</th>
                  <th className="px-6 py-3 text-center font-medium text-yellow-600">Leave</th>
                  <th className="px-6 py-3 text-center font-medium text-blue-600">Att. %</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500 w-40">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sorted.map(s => (
                  <tr key={s.student_id} className={`hover:bg-gray-50 ${s.attendance_pct < 75 && s.total_days > 0 ? 'bg-red-50' : ''}`}>
                    <td className="px-6 py-4 font-mono text-gray-600">{s.roll_number}</td>
                    <td className="px-6 py-4 font-medium text-gray-900">{s.full_name}</td>
                    <td className="px-6 py-4 text-center text-gray-600">{s.total_days}</td>
                    <td className="px-6 py-4 text-center font-medium text-green-600">{s.present}</td>
                    <td className="px-6 py-4 text-center font-medium text-red-600">{s.absent}</td>
                    <td className="px-6 py-4 text-center text-yellow-600">{s.leave}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-1 text-xs font-bold rounded-full ${s.attendance_pct >= 80 ? 'bg-green-100 text-green-800' : s.attendance_pct >= 60 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                        {s.total_days > 0 ? `${s.attendance_pct}%` : 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className={`h-2 rounded-full ${s.attendance_pct >= 80 ? 'bg-green-500' : s.attendance_pct >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${s.attendance_pct}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {stats.length === 0 && !loading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center text-gray-400">
          <BarChart2 className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p>Select a class and date range, then click Generate Report.</p>
        </div>
      )}
    </div>
  );
}
