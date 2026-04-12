import { useEffect, useState } from 'react';
import { Search, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AttendanceRow {
  id: string;
  status: string;
  date: string;
  notes: string;
  students: { profiles: { first_name: string; last_name: string } };
  classes: { name: string; subject: string };
}

interface Student { id: string; profiles: { first_name: string; last_name: string } }
interface ClassRow { id: string; name: string; subject: string }

type Status = 'present' | 'absent' | 'late' | 'excused';

export default function Attendance() {
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [markMode, setMarkMode] = useState(false);
  const [markData, setMarkData] = useState<Record<string, Status>>({});
  const [saving, setSaving] = useState(false);

  async function load() {
    const [{ data: att }, { data: s }, { data: c }] = await Promise.all([
      supabase.from('attendance').select('*, students(profiles(first_name, last_name)), classes(name, subject)').order('date', { ascending: false }).limit(100),
      supabase.from('students').select('id, profiles(first_name, last_name)'),
      supabase.from('classes').select('id, name, subject'),
    ]);
    setRecords((att as AttendanceRow[]) ?? []);
    setStudents((s as Student[]) ?? []);
    setClasses((c as ClassRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function startMarkMode() {
    if (!selectedClass) { alert('Please select a class first'); return; }
    const init: Record<string, Status> = {};
    students.forEach(s => { init[s.id] = 'present'; });
    setMarkData(init);
    setMarkMode(true);
  }

  async function saveAttendance() {
    setSaving(true);
    const rows = Object.entries(markData).map(([studentId, status]) => ({
      class_id: selectedClass,
      date: selectedDate,
      student_id: studentId,
      status,
      notes: null,
    }));
    await supabase.from('attendance').upsert(rows, { onConflict: 'student_id,class_id,date' });
    setMarkMode(false);
    load();
    setSaving(false);
  }

  const filtered = records.filter(r =>
    `${r.students?.profiles?.first_name} ${r.students?.profiles?.last_name} ${r.classes?.name}`
      .toLowerCase().includes(search.toLowerCase())
  );

  const statusColors: Record<string, string> = {
    present: 'bg-green-100 text-green-700',
    absent: 'bg-red-100 text-red-700',
    late: 'bg-yellow-100 text-yellow-700',
    excused: 'bg-blue-100 text-blue-700',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Attendance</h2>
        <button onClick={startMarkMode} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Save className="w-4 h-4" /> Mark Attendance
        </button>
      </div>

      {markMode && (
        <div className="bg-white rounded-xl shadow-sm mb-6 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Mark Attendance</h3>
            <div className="flex gap-3">
              <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select class</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name} — {c.subject}</option>)}
              </select>
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {students.map(s => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-800">{s.profiles.first_name} {s.profiles.last_name}</span>
                <div className="flex gap-2">
                  {(['present', 'absent', 'late', 'excused'] as Status[]).map(status => (
                    <button
                      key={status}
                      onClick={() => setMarkData(d => ({ ...d, [s.id]: status }))}
                      className={`px-3 py-1 rounded text-xs font-medium capitalize transition-colors ${markData[s.id] === status ? statusColors[status] + ' ring-2 ring-offset-1 ring-current' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => setMarkMode(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button onClick={saveAttendance} disabled={saving} className="flex-1 px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-60">{saving ? 'Saving...' : 'Save Attendance'}</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search attendance records..." className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                <tr>
                  {['Student', 'Class', 'Date', 'Status', 'Notes'].map(h => (
                    <th key={h} className="px-6 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">No attendance records found</td></tr>
                ) : filtered.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-800">{r.students?.profiles?.first_name} {r.students?.profiles?.last_name}</td>
                    <td className="px-6 py-4 text-gray-600">{r.classes?.name}</td>
                    <td className="px-6 py-4 text-gray-500">{new Date(r.date).toLocaleDateString()}</td>
                    <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${statusColors[r.status]}`}>{r.status}</span></td>
                    <td className="px-6 py-4 text-gray-400 text-xs">{r.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
