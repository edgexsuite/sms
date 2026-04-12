import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { UserX, Download } from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';

interface AbsentRecord {
  student_id: string;
  full_name: string;
  roll_number: number;
  class_name: string;
  parent_whatsapp: string;
}

export default function AbsentStudentList() {
  const { userRole } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [classFilter, setClassFilter] = useState('');
  const [classes, setClasses] = useState<any[]>([]);
  const [absentList, setAbsentList] = useState<AbsentRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (userRole?.school_id) fetchClasses();
  }, [userRole]);

  useEffect(() => {
    if (userRole?.school_id && date) fetchAbsent();
  }, [date, classFilter, userRole]);

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('id, name, section').eq('school_id', userRole!.school_id).order('name');
    setClasses(data || []);
  };

  const fetchAbsent = async () => {
    setLoading(true);
    const sid = userRole!.school_id;

    let query = supabase
      .from('attendance')
      .select('student_id, student:student_id(full_name, roll_number, class:class_id(name, section), parent:parent_id(whatsapp_number))')
      .eq('school_id', sid)
      .eq('date', date)
      .eq('status', 'absent');

    const { data: absentData } = await query;

    let result = (absentData || []).map((a: any) => ({
      student_id: a.student_id,
      full_name: a.student?.full_name || '',
      roll_number: a.student?.roll_number || 0,
      class_name: a.student?.class ? `${a.student.class.name}-${a.student.class.section}` : '-',
      class_id: a.student?.class?.id || '',
      parent_whatsapp: a.student?.parent?.whatsapp_number || '',
    }));

    if (classFilter) result = result.filter((r: any) => r.class_id === classFilter);
    result.sort((a: any, b: any) => a.roll_number - b.roll_number);
    setAbsentList(result);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UserX className="w-6 h-6 text-red-600" /> Daily Absent Student List
          </h1>
          <p className="text-gray-500 text-sm mt-1">View all absent students for a selected date.</p>
        </div>
        <button onClick={() => exportToCSV(`absent-${date}`, absentList, [
          { header: 'Roll No', key: 'roll_number' }, { header: 'Name', key: 'full_name' },
          { header: 'Class', key: 'class_name' }, { header: 'Parent WhatsApp', key: 'parent_whatsapp' },
        ])} className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      <div className="flex gap-4 flex-wrap">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Class</label>
          <select value={classFilter} onChange={e => setClassFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500">
            <option value="">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}-{c.section}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
        <p className="text-red-800 font-medium">
          {loading ? 'Loading...' : `${absentList.length} student${absentList.length !== 1 ? 's' : ''} absent on ${new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading absent list...</div>
        ) : absentList.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <UserX className="w-10 h-10 mx-auto mb-3 text-gray-200" />
            <p>No absent students recorded for this date.</p>
            <p className="text-xs mt-1">Make sure attendance was marked for this day.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-gray-500">#</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Roll No</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Student Name</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Class</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Parent WhatsApp</th>
                <th className="px-6 py-3 text-center font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {absentList.map((r, i) => (
                <tr key={r.student_id} className="hover:bg-red-50">
                  <td className="px-6 py-4 text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-6 py-4 font-mono text-gray-600">{r.roll_number}</td>
                  <td className="px-6 py-4 font-medium text-gray-900">{r.full_name}</td>
                  <td className="px-6 py-4 text-gray-600">{r.class_name}</td>
                  <td className="px-6 py-4 text-gray-500 font-mono text-xs">{r.parent_whatsapp || '—'}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Absent</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
