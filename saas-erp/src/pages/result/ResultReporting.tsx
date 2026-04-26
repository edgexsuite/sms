import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { FileText, Printer, Search } from 'lucide-react';
import { ReportCardLayoutRenderer, DEFAULT_REPORT_CUSTOM } from '../../lib/reportCardTemplates';

const getGrade = (obtained: number, total: number, passing: number): { grade: string; status: string; pct: number } => {
  if (total === 0) return { grade: '—', status: '—', pct: 0 };
  const pct = Math.round((obtained / total) * 100);
  const grade = pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B' : pct >= 60 ? 'C' : pct >= 50 ? 'D' : 'F';
  const status = obtained >= passing ? 'Pass' : 'Fail';
  return { grade, status, pct };
};

export default function ResultReporting() {
  const { userRole } = useAuth();
  const [examTypes, setExamTypes] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [rcSettings, setRcSettings] = useState<any>(null);

  const [selectedExamType, setSelectedExamType] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (userRole?.school_id) {
      fetchInit();
      Promise.all([
        supabase.from('schools').select('*').eq('id', userRole.school_id).single(),
        supabase.from('report_card_settings').select('*').eq('school_id', userRole.school_id).maybeSingle()
      ]).then(([{ data: school }, { data: settings }]) => {
        if (school) setSchoolInfo(school);
        if (settings) setRcSettings(settings);
      });
    }
  }, [userRole]);

  useEffect(() => { if (selectedClass) fetchClassData(); }, [selectedClass]);
  useEffect(() => { if (selectedExamType && selectedStudent) fetchStudentResults(); }, [selectedExamType, selectedStudent]);

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

  const fetchStudentResults = async () => {
    setLoading(true);
    const { data } = await supabase.from('exam_results').select('*').eq('exam_type_id', selectedExamType).eq('student_id', selectedStudent);
    if (data) setResults(data);
    setLoading(false);
  };

  const currentExam = examTypes.find(e => e.id === selectedExamType);
  const currentClass = classes.find(c => c.id === selectedClass);
  const currentStudent = students.find(s => s.id === selectedStudent);

  let totalObtained = 0, grandTotal = 0, failSubjects = 0;
  const subjectRows = subjects.map(subj => {
    const r = results.find(res => res.subject_id === subj.id);
    const { grade, status, pct } = r ? getGrade(r.obtained_marks, r.total_marks, subj.passing_marks || 33) : { grade: 'AB', status: 'Absent', pct: 0 };
    if (r) { totalObtained += r.obtained_marks; grandTotal += r.total_marks; }
    else { grandTotal += subj.total_marks || 100; }
    if (status === 'Fail' || status === 'Absent') failSubjects++;
    return { subj, r, grade, status, pct };
  });

  const overallPct = grandTotal > 0 ? Math.round((totalObtained / grandTotal) * 100) : 0;
  const overallGrade = overallPct >= 90 ? 'A+' : overallPct >= 80 ? 'A' : overallPct >= 70 ? 'B' : overallPct >= 60 ? 'C' : overallPct >= 50 ? 'D' : 'F';
  const finalStatus = failSubjects === 0 ? 'PROMOTED' : 'NOT PROMOTED';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .result-card { box-shadow: none !important; border: 2px solid #000; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #555; padding: 4px 8px; }
          @page { size: portrait; margin: 12mm; }
        }
      `}</style>

      <div className="no-print">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-6 h-6 text-teal-600" /> Individual Result Cards
        </h1>
        <p className="text-gray-500 text-sm mt-1">Generate printable result cards for individual students to take home.</p>
      </div>

      {/* Selectors */}
      <div className="no-print bg-white rounded-xl shadow-sm border border-gray-200 p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Exam</label>
          <select value={selectedExamType} onChange={e => setSelectedExamType(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-medium text-sm">
            <option value="">-- Select Exam --</option>
            {examTypes.map(e => <option key={e.id} value={e.id}>{e.name} ({e.session})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Class</label>
          <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-medium text-sm">
            <option value="">-- Select Class --</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name} — {c.section}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Student</label>
          <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-medium text-sm">
            <option value="">-- Select Student --</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.roll_number} — {s.full_name}</option>)}
          </select>
        </div>
      </div>

      {/* Result Card */}
      {selectedExamType && selectedStudent && subjects.length > 0 && !loading && (
        <>
          <div className="no-print flex justify-end">
            <button onClick={() => window.print()} className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-lg font-bold shadow transition">
              <Printer className="w-4 h-4" /> Print Result Card
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            <ReportCardLayoutRenderer
              template={rcSettings?.template || 'classic'}
              studentName={currentStudent?.full_name || ''}
              rollNumber={currentStudent?.roll_number || ''}
              className={`${currentClass?.name} — ${currentClass?.section}`}
              schoolName={schoolInfo?.name || ''}
              schoolLogo={schoolInfo?.logo_url}
              activeFields={rcSettings?.fields || ['school_logo', 'student_photo', 'gpa_summary', 'teacher_remarks']}
              customization={rcSettings?.layout_config?.customization || DEFAULT_REPORT_CUSTOM}
              subjects={subjectRows.map(row => ({
                name: row.subj.subject_name,
                marks: row.r?.obtained_marks || 0,
                total: row.subj.total_marks || 100,
                grade: row.grade
              }))}
              totalMarks={grandTotal}
              obtainedMarks={totalObtained}
              percentage={overallPct}
              grade={overallGrade}
              attendance={currentStudent?.attendance || 'N/A'}
            />
          </div>

        </>
      )}
    </div>
  );
}
