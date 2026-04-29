import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Hash, Printer, Download } from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';
import { formatDate } from '../../lib/utils';

interface SlipData {
  student_id: string;
  full_name: string;
  roll_number: number;
  father_name: string;
  class_name: string;
  exam_name: string;
  session: string;
  subjects: { name: string; date: string; time: string }[];
}

export default function RollNumberSlips() {
  const { userRole } = useAuth();
  const [examTypes, setExamTypes] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [slips, setSlips] = useState<SlipData[]>([]);
  const [loading, setLoading] = useState(false);
  const [schoolName, setSchoolName] = useState('');

  useEffect(() => {
    if (userRole?.school_id) { fetchExams(); fetchClasses(); fetchSchool(); }
  }, [userRole]);

  const fetchSchool = async () => {
    const { data } = await supabase.from('schools').select('name').eq('id', userRole!.school_id).maybeSingle();
    setSchoolName(data?.name || 'School');
  };

  const fetchExams = async () => {
    const { data } = await supabase.from('exam_types').select('id, name, session').eq('school_id', userRole!.school_id).order('created_at', { ascending: false });
    setExamTypes(data || []);
  };

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('id, name, section').eq('school_id', userRole!.school_id).order('name');
    setClasses(data || []);
  };

  const generateSlips = async () => {
    if (!selectedExam || !selectedClass) return;
    setLoading(true);
    const sid = userRole!.school_id;

    // Get exam info
    const exam = examTypes.find(e => e.id === selectedExam);
    const cls = classes.find(c => c.id === selectedClass);

    // Get students
    const { data: students } = await supabase
      .from('students')
      .select('id, full_name, roll_number, parent:parent_id(father_name)')
      .eq('school_id', sid)
      .eq('class_id', selectedClass)
      .eq('status', 'active')
      .order('roll_number');

    // Get exam schedule for this class
    const { data: schedule } = await supabase
      .from('exam_schedules')
      .select('exam_date, start_time, end_time, subject:subject_id(subject_name)')
      .eq('school_id', sid)
      .eq('exam_type_id', selectedExam)
      .eq('class_id', selectedClass)
      .order('exam_date');

    const subjects = (schedule || []).map((s: any) => ({
      name: s.subject?.subject_name || 'Unknown',
      date: s.exam_date ? formatDate(s.exam_date) : 'TBD',
      time: s.start_time ? `${s.start_time} - ${s.end_time}` : 'TBD',
    }));

    const result: SlipData[] = (students || []).map((s: any) => ({
      student_id: s.id,
      full_name: s.full_name,
      roll_number: s.roll_number,
      father_name: s.parent?.father_name || '',
      class_name: cls ? `${cls.name}-${cls.section}` : '',
      exam_name: exam?.name || '',
      session: exam?.session || '',
      subjects,
    }));

    setSlips(result);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; margin: 0; padding: 10px; font-family: sans-serif; }
          .slip-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          .slip-card { break-inside: avoid; border: 2px solid #000; padding: 12px; margin-bottom: 12px; }
          .slip-card table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 8px; }
          .slip-card table th, .slip-card table td { border: 1px solid #ccc; padding: 3px 5px; }
        }
        @media screen { .slip-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; } }
      `}</style>

      <div className="no-print flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Hash className="w-6 h-6 text-indigo-600" /> Roll Number Slips
          </h1>
          <p className="text-gray-500 text-sm mt-1">Generate printable admit cards / roll number slips for exams.</p>
        </div>
        <div className="flex gap-2">
          {slips.length > 0 && (
            <>
              <button onClick={() => exportToCSV('roll-number-slips', slips, [
                { header: 'Roll No', key: 'roll_number' }, { header: 'Student', key: 'full_name' },
                { header: 'Father', key: 'father_name' }, { header: 'Class', key: 'class_name' }, { header: 'Exam', key: 'exam_name' },
              ])} className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
                <Download className="w-4 h-4" /> Export List
              </button>
              <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
                <Printer className="w-4 h-4" /> Print All Slips
              </button>
            </>
          )}
        </div>
      </div>

      <div className="no-print bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Exam</label>
            <select value={selectedExam} onChange={e => setSelectedExam(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
              <option value="">Select exam...</option>
              {examTypes.map(e => <option key={e.id} value={e.id}>{e.name} {e.session ? `(${e.session})` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Class</label>
            <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
              <option value="">Select class...</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}-{c.section}</option>)}
            </select>
          </div>
          <button onClick={generateSlips} disabled={!selectedExam || !selectedClass || loading}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {loading ? 'Generating...' : 'Generate Slips'}
          </button>
        </div>
      </div>

      {slips.length === 0 && !loading && (
        <div className="no-print bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center text-gray-400">
          <Hash className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p>Select an exam and class, then click Generate Slips.</p>
        </div>
      )}

      {slips.length > 0 && (
        <>
          <p className="no-print text-sm text-gray-500">{slips.length} slips generated · Click Print All Slips to print</p>
          <div className="slip-grid">
            {slips.map(slip => (
              <div key={slip.student_id} className="slip-card bg-white rounded-xl border-2 border-gray-300 p-4 shadow-sm">
                {/* Header */}
                <div className="text-center border-b border-gray-200 pb-3 mb-3">
                  <h2 className="font-bold text-gray-900 text-base">{schoolName}</h2>
                  <p className="text-sm font-semibold text-indigo-700 mt-0.5">{slip.exam_name}</p>
                  {slip.session && <p className="text-xs text-gray-400">{slip.session}</p>}
                  <p className="text-xs font-bold text-gray-600 mt-1 uppercase tracking-wide">Admit Card / Roll Number Slip</p>
                </div>

                {/* Student Info */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-3">
                  <div><span className="text-gray-400">Roll No:</span> <strong className="text-gray-900 font-mono text-base">{slip.roll_number}</strong></div>
                  <div><span className="text-gray-400">Class:</span> <strong className="text-gray-900">{slip.class_name}</strong></div>
                  <div className="col-span-2"><span className="text-gray-400">Name:</span> <strong className="text-gray-900">{slip.full_name}</strong></div>
                  {slip.father_name && <div className="col-span-2"><span className="text-gray-400">Father:</span> <span className="text-gray-700">{slip.father_name}</span></div>}
                </div>

                {/* Exam Schedule */}
                {slip.subjects.length > 0 && (
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-200 px-2 py-1 text-left font-medium text-gray-600">Subject</th>
                        <th className="border border-gray-200 px-2 py-1 text-left font-medium text-gray-600">Date</th>
                        <th className="border border-gray-200 px-2 py-1 text-left font-medium text-gray-600">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {slip.subjects.map((s, i) => (
                        <tr key={i} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                          <td className="border border-gray-200 px-2 py-1 text-gray-800 font-medium">{s.name}</td>
                          <td className="border border-gray-200 px-2 py-1 text-gray-600">{s.date}</td>
                          <td className="border border-gray-200 px-2 py-1 text-gray-600">{s.time}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {slip.subjects.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-2 italic">No exam schedule added yet.</p>
                )}

                <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-end">
                  <p className="text-xs text-gray-300">Issued: {formatDate(new Date())}</p>
                  <div className="text-right">
                    <div className="border-b border-gray-400 w-24 mb-0.5" />
                    <p className="text-xs text-gray-400">Signature</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
