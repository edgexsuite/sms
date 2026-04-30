import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { LayoutDashboard, Printer, TrendingUp } from 'lucide-react';
import { fetchGradingPolicy, getGradeFromPolicy, GradingBracket } from '../../lib/gradingUtils';

const GRADE_COLORS: Record<string, string> = {
  'A+': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'A': 'bg-green-100 text-green-800 border-green-200',
  'B': 'bg-blue-100 text-blue-800 border-blue-200',
  'C': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'D': 'bg-orange-100 text-orange-800 border-orange-200',
  'F': 'bg-red-100 text-red-800 border-red-200',
};

export default function ConsolidatedResult() {
  const { userRole } = useAuth();
  const [examTypes, setExamTypes] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [gradingBrackets, setGradingBrackets] = useState<GradingBracket[]>([]);

  const [selectedExamType, setSelectedExamType] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (userRole?.school_id) {
    fetchInit();
    fetchGradingPolicy(userRole.school_id).then(setGradingBrackets);
  }}, [userRole]);
  useEffect(() => { if (selectedClass) fetchClassData(); }, [selectedClass]);
  useEffect(() => { if (selectedExamType && selectedClass) fetchResults(); }, [selectedExamType, selectedClass]);

  const fetchInit = async () => {
    const [{ data: et }, { data: cls }] = await Promise.all([
      supabase.from('exam_types').select('*').eq('school_id', userRole?.school_id).order('created_at'),
      supabase.from('classes').select('id, name, section').eq('school_id', userRole?.school_id).order('name'),
    ]);
    if (et) setExamTypes(et);
    if (cls) setClasses(cls);
  };

  const fetchClassData = async () => {
    const [{ data: subs }, { data: stus }] = await Promise.all([
      supabase.from('subjects').select('*').eq('class_id', selectedClass).order('subject_name'),
      supabase.from('students').select('id, full_name, roll_number').eq('class_id', selectedClass).eq('status', 'active').order('roll_number'),
    ]);
    if (subs) setSubjects(subs);
    if (stus) setStudents(stus);
  };

  const fetchResults = async () => {
    setLoading(true);
    const { data } = await supabase.from('exam_results')
      .select('*')
      .eq('exam_type_id', selectedExamType)
      .in('student_id', students.length > 0 ? students.map(s => s.id) : ['00000000-0000-0000-0000-000000000000']);
    if (data) setResults(data);
    setLoading(false);
  };

  const getResult = (studentId: string, subjectId: string) =>
    results.find(r => r.student_id === studentId && r.subject_id === subjectId);

  // Build consolidated per-student data
  const consolidatedData = students.map(stu => {
    let totalObtained = 0;
    let grandTotal = 0;
    let failCount = 0;

    const subjectResults = subjects.map(subj => {
      const r = getResult(stu.id, subj.id);
      if (r) {
        const g = getGradeFromPolicy(r.obtained_marks, r.total_marks, gradingBrackets);
        totalObtained += r.obtained_marks;
        grandTotal    += r.total_marks;
        if (g.status !== 'Pass') failCount++;
      } else {
        grandTotal += subj.total_marks || 100;
      }
      return { subject: subj, result: r };
    });

    const overallG       = getGradeFromPolicy(totalObtained, grandTotal, gradingBrackets);
    const overallPct     = overallG.pct;
    const overallGrade   = overallG.grade;
    const status         = failCount > 0 ? 'FAIL' : 'PASS';

    return { student: stu, subjectResults, totalObtained, grandTotal, overallPct, overallGrade, status };
  }).sort((a, b) => b.overallPct - a.overallPct);

  // Assign position after sort
  consolidatedData.forEach((d, i) => { (d as any).position = i + 1; });

  const currentExam = examTypes.find(e => e.id === selectedExamType);
  const currentClass = classes.find(c => c.id === selectedClass);

  return (
    <div className="space-y-6 max-w-full">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          table { font-size: 8px; border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #000; padding: 2px 4px; text-align: center; }
          .text-left { text-align: left !important; }
          @page { size: landscape; margin: 10mm; }
        }
      `}</style>

      <div className="no-print flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-violet-600" /> Consolidated Result Sheet
          </h1>
          <p className="text-gray-500 text-sm mt-1">Full class result with position ranking and grade analysis. Print-ready.</p>
        </div>
        <button onClick={() => window.print()} disabled={results.length === 0} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-5 py-2.5 rounded-lg font-bold shadow disabled:opacity-50 transition">
          <Printer className="w-4 h-4" /> Print Sheet
        </button>
      </div>

      <div className="no-print bg-white rounded-xl shadow-sm border border-gray-200 p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Exam Type</label>
          <select value={selectedExamType} onChange={e => setSelectedExamType(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg font-medium text-sm">
            <option value="">-- Select Exam --</option>
            {examTypes.map(e => <option key={e.id} value={e.id}>{e.name} ({e.session})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Class</label>
          <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg font-medium text-sm">
            <option value="">-- Select Class --</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name} — {c.section}</option>)}
          </select>
        </div>
      </div>

      {selectedExamType && selectedClass && (
        <>
          {/* Print Header */}
          <div className="hidden print:block text-center mb-4">
            <h1 className="text-2xl font-black uppercase">CONSOLIDATED RESULT SHEET</h1>
            <p className="text-sm font-bold mt-1">{currentExam?.name} — Session {currentExam?.session}</p>
            <p className="text-sm font-bold">Class: {currentClass?.name} {currentClass?.section}</p>
          </div>

          {/* Summary Stats */}
          {!loading && consolidatedData.length > 0 && (
            <div className="no-print grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Students', value: students.length, color: 'text-violet-700 bg-violet-50 border-violet-200' },
                { label: 'Passed', value: consolidatedData.filter(d => d.status === 'PASS').length, color: 'text-green-700 bg-green-50 border-green-200' },
                { label: 'Failed', value: consolidatedData.filter(d => d.status === 'FAIL').length, color: 'text-red-700 bg-red-50 border-red-200' },
                { label: 'Class Avg %', value: `${Math.round(consolidatedData.reduce((a, d) => a + d.overallPct, 0) / consolidatedData.length)}%`, color: 'text-blue-700 bg-blue-50 border-blue-200' },
              ].map(stat => (
                <div key={stat.label} className={`rounded-xl border p-4 ${stat.color}`}>
                  <p className="text-3xl font-black">{stat.value}</p>
                  <p className="text-xs font-semibold mt-1 uppercase tracking-wide opacity-80">{stat.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Result Table */}
          {loading ? (
            <div className="bg-white rounded-xl p-12 text-center text-gray-500">Generating result sheet...</div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-violet-50 border-b border-violet-200">
                    <th className="px-3 py-2 text-left text-xs font-bold text-violet-800 uppercase sticky left-0 bg-violet-50"># Pos</th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-violet-800 uppercase sticky left-8 bg-violet-50">Student</th>
                    {subjects.map(s => (
                      <th key={s.id} className="px-2 py-2 text-center text-xs font-bold text-violet-800 whitespace-nowrap">{s.subject_name}<br /><span className="font-normal opacity-60">/{s.total_marks}</span></th>
                    ))}
                    <th className="px-3 py-2 text-center text-xs font-bold text-violet-800 uppercase">Total</th>
                    <th className="px-3 py-2 text-center text-xs font-bold text-violet-800 uppercase">%</th>
                    <th className="px-3 py-2 text-center text-xs font-bold text-violet-800 uppercase">Grade</th>
                    <th className="px-3 py-2 text-center text-xs font-bold text-violet-800 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {consolidatedData.map((row: any) => (
                    <tr key={row.student.id} className={`border-b border-gray-100 hover:bg-gray-50 ${row.status === 'FAIL' ? 'bg-red-50/30' : ''}`}>
                      <td className="px-3 py-2.5 font-black text-gray-700 text-center sticky left-0 bg-white">
                        {row.position === 1 ? '🥇' : row.position === 2 ? '🥈' : row.position === 3 ? '🥉' : `#${row.position}`}
                      </td>
                      <td className="px-3 py-2.5 sticky left-8 bg-white">
                        <p className="font-bold text-gray-900">{row.student.full_name}</p>
                        <p className="text-xs text-gray-400 font-mono">Roll: {row.student.roll_number}</p>
                      </td>
                      {row.subjectResults.map(({ subject, result }: any) => {
                        const isPassing = result && result.obtained_marks >= (subject.passing_marks || 33);
                        return (
                          <td key={subject.id} className={`px-2 py-2.5 text-center font-bold ${result ? (isPassing ? 'text-green-700' : 'text-red-600') : 'text-gray-300'}`}>
                            {result ? result.obtained_marks : '—'}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5 text-center font-black text-gray-900">{row.totalObtained}<span className="text-gray-400 font-normal text-xs">/{row.grandTotal}</span></td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`text-sm font-black flex items-center justify-center gap-1 ${row.overallPct >= 60 ? 'text-green-600' : 'text-red-600'}`}>
                          <TrendingUp className="w-3 h-3" />{row.overallPct}%
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-black border ${GRADE_COLORS[row.overallGrade] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>{row.overallGrade}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-black ${row.status === 'PASS' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{row.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
