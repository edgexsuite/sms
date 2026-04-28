import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { FileText, Printer, Users, Loader2 } from 'lucide-react';
import { ReportCardLayoutRenderer, DEFAULT_REPORT_CUSTOM } from '../../lib/reportCardTemplates';

const getGrade = (obtained: number, total: number, passing: number) => {
  if (total === 0) return { grade: '—', status: '—', pct: 0 };
  const pct = Math.round((obtained / total) * 100);
  const grade = pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B' : pct >= 60 ? 'C' : pct >= 50 ? 'D' : 'F';
  return { grade, status: obtained >= passing ? 'Pass' : 'Fail', pct };
};

export default function ResultReporting() {
  const { userRole } = useAuth();
  const [examTypes, setExamTypes] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [classResults, setClassResults] = useState<any[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [rcSettings, setRcSettings] = useState<any>(null);

  const [selectedExamType, setSelectedExamType] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [loading, setLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);

  // Batch print: array of { student, results } for all students in class
  const [batchCards, setBatchCards] = useState<any[]>([]);
  const [printMode, setPrintMode] = useState<'single' | 'batch'>('single');

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
  useEffect(() => {
    if (selectedExamType && selectedClass && students.length > 0) fetchAllClassResults();
  }, [selectedExamType, selectedClass, students.length]);

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
      supabase.from('students').select('id, full_name, roll_number, photograph_url').eq('class_id', selectedClass).eq('status', 'active').order('roll_number'),
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

  const fetchAllClassResults = async () => {
    const ids = students.map(s => s.id);
    if (!ids.length) return;
    const { data } = await supabase.from('exam_results').select('student_id, obtained_marks').eq('exam_type_id', selectedExamType).in('student_id', ids);
    if (data) setClassResults(data);
  };

  const computePosition = (studentId: string): { position: number; outOf: number } => {
    if (!classResults.length) return { position: 0, outOf: 0 };
    const totals: Record<string, number> = {};
    classResults.forEach(r => { totals[r.student_id] = (totals[r.student_id] || 0) + r.obtained_marks; });
    const sorted = Object.entries(totals).sort(([, a], [, b]) => b - a);
    const pos = sorted.findIndex(([id]) => id === studentId) + 1;
    return { position: pos, outOf: sorted.length };
  };

  // Build batch cards for all students
  const handlePrintClass = async () => {
    if (!selectedExamType || !selectedClass || !subjects.length) return;
    setBatchLoading(true);
    setBatchCards([]);

    // Fetch ALL results for ALL students in one query
    const ids = students.map(s => s.id);
    const { data: allRes } = await supabase.from('exam_results').select('*').eq('exam_type_id', selectedExamType).in('student_id', ids);

    // Build position map
    const totals: Record<string, number> = {};
    (allRes || []).forEach((r: any) => { totals[r.student_id] = (totals[r.student_id] || 0) + r.obtained_marks; });
    const sorted = Object.entries(totals).sort(([, a], [, b]) => b - a);

    const cards = students.map(stu => {
      const stuResults = (allRes || []).filter((r: any) => r.student_id === stu.id);
      let obtained = 0, grand = 0, fails = 0;
      const subjectRows = subjects.map((subj: any) => {
        const r = stuResults.find((res: any) => res.subject_id === subj.id);
        const { grade, status } = r ? getGrade(r.obtained_marks, r.total_marks, subj.passing_marks || 33) : { grade: 'AB', status: 'Absent' };
        if (r) { obtained += r.obtained_marks; grand += r.total_marks; }
        else { grand += subj.total_marks || 100; }
        if (status !== 'Pass') fails++;
        return { name: subj.subject_name, marks: r?.obtained_marks ?? 0, total: subj.total_marks || 100, grade, status };
      });
      const pct = grand > 0 ? Math.round((obtained / grand) * 100) : 0;
      const overallGrade = pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B' : pct >= 60 ? 'C' : pct >= 50 ? 'D' : 'F';
      const pos = sorted.findIndex(([id]) => id === stu.id) + 1;
      return { student: stu, subjects: subjectRows, obtained, grand, pct, grade: overallGrade, fails, position: pos };
    });

    setBatchCards(cards);
    setBatchLoading(false);
    setPrintMode('batch');
    setTimeout(() => window.print(), 400);
  };

  // Single student card data
  const currentExam = examTypes.find(e => e.id === selectedExamType);
  const currentClass = classes.find(c => c.id === selectedClass);
  const currentStudent = students.find(s => s.id === selectedStudent);

  let totalObtained = 0, grandTotal = 0, failSubjects = 0;
  const subjectRows = subjects.map(subj => {
    const r = results.find(res => res.subject_id === subj.id);
    const { grade, status } = r ? getGrade(r.obtained_marks, r.total_marks, subj.passing_marks || 33) : { grade: 'AB', status: 'Absent' };
    if (r) { totalObtained += r.obtained_marks; grandTotal += r.total_marks; }
    else { grandTotal += subj.total_marks || 100; }
    if (status !== 'Pass') failSubjects++;
    return { subj, r, grade, status };
  });

  const overallPct = grandTotal > 0 ? Math.round((totalObtained / grandTotal) * 100) : 0;
  const overallGrade = overallPct >= 90 ? 'A+' : overallPct >= 80 ? 'A' : overallPct >= 70 ? 'B' : overallPct >= 60 ? 'C' : overallPct >= 50 ? 'D' : 'F';
  const { position, outOf } = computePosition(selectedStudent);

  const template = rcSettings?.template || 'classic';
  const customization = rcSettings?.layout_config?.customization || DEFAULT_REPORT_CUSTOM;
  const activeFields = rcSettings?.fields || ['school_logo', 'gpa_summary', 'teacher_remarks'];

  const commonCardProps = {
    template, customization, activeFields,
    schoolName: schoolInfo?.name || '',
    schoolLogo: schoolInfo?.logo_url || null,
    examName: currentExam?.name || '',
    examSession: currentExam?.session || '',
    className: `${currentClass?.name} — ${currentClass?.section}`,
    totalStudents: outOf > 0 ? outOf : students.length || undefined,
    finalStatus: failSubjects === 0 ? 'PROMOTED' : 'NOT PROMOTED',
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; margin: 0; padding: 0; }
          .result-card-wrapper {
            width: 210mm !important;
            min-height: 297mm !important;
            height: auto !important;
            page-break-inside: avoid !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            border: none !important;
            margin: 0 !important;
          }
          .result-card-wrapper:not(:last-child) {
            page-break-after: always !important;
          }
          @page { size: A4 portrait; margin: 0; }
        }
      `}</style>

      {/* Header */}
      <div className="no-print">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-6 h-6 text-teal-600" /> Individual Result Cards
        </h1>
        <p className="text-gray-500 text-sm mt-1">Generate printable result cards for individual students or the whole class.</p>
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
          <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedStudent(''); }} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-medium text-sm">
            <option value="">-- Select Class --</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name} — {c.section}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Student</label>
          <select value={selectedStudent} onChange={e => { setSelectedStudent(e.target.value); setPrintMode('single'); }} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-medium text-sm">
            <option value="">-- Select Student --</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.roll_number} — {s.full_name}</option>)}
          </select>
        </div>
      </div>

      {/* Action buttons */}
      {selectedExamType && selectedClass && subjects.length > 0 && (
        <div className="no-print flex flex-wrap gap-3 justify-end">
          {/* Print single student */}
          {selectedStudent && !loading && (
            <button onClick={() => { setPrintMode('single'); setTimeout(() => window.print(), 100); }}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-lg font-bold shadow transition">
              <Printer className="w-4 h-4" /> Print This Card
            </button>
          )}

          {/* Print whole class */}
          <button onClick={handlePrintClass} disabled={batchLoading}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-5 py-2 rounded-lg font-bold shadow transition">
            {batchLoading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Preparing {students.length} cards...</>
              : <><Users className="w-4 h-4" /> Print All Class ({students.length} students)</>
            }
          </button>
        </div>
      )}

      {/* SINGLE student card */}
      {printMode === 'single' && selectedStudent && subjects.length > 0 && !loading && (
        <div className="w-full overflow-x-auto custom-scrollbar pb-4 print:overflow-visible">
          <div className="result-card-wrapper bg-white shadow-lg border border-gray-200 overflow-hidden mx-auto min-w-[210mm]">
            <ReportCardLayoutRenderer
              {...commonCardProps}
              studentName={currentStudent?.full_name || ''}
              rollNumber={String(currentStudent?.roll_number || '')}
              studentPhoto={currentStudent?.photograph_url || null}
              subjects={subjectRows.map(row => ({
                name: row.subj.subject_name,
                marks: row.r?.obtained_marks ?? 0,
                total: row.subj.total_marks || 100,
                grade: row.grade,
                status: row.status,
              }))}
              totalMarks={grandTotal}
              obtainedMarks={totalObtained}
              percentage={overallPct}
              grade={overallGrade}
              attendance={'N/A'}
              positionInClass={position > 0 ? position : undefined}
              totalStudents={outOf > 0 ? outOf : undefined}
              finalStatus={failSubjects === 0 ? 'PROMOTED' : 'NOT PROMOTED'}
            />
          </div>
        </div>
      )}

      {/* BATCH: all class cards (only shown during print via CSS) */}
      {printMode === 'batch' && batchCards.length > 0 && (
        <div>
          {batchCards.map((card, idx) => (
            <div key={idx} className="result-card-wrapper bg-white overflow-hidden">
              <ReportCardLayoutRenderer
                {...commonCardProps}
                studentName={card.student.full_name}
                rollNumber={String(card.student.roll_number)}
                studentPhoto={card.student.photograph_url || null}
                subjects={card.subjects}
                totalMarks={card.grand}
                obtainedMarks={card.obtained}
                percentage={card.pct}
                grade={card.grade}
                attendance={'N/A'}
                positionInClass={card.position > 0 ? card.position : undefined}
                totalStudents={batchCards.length}
                finalStatus={card.fails === 0 ? 'PROMOTED' : 'NOT PROMOTED'}
              />
            </div>
          ))}
          {/* Screen summary after batch generation */}
          <div className="no-print bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-center">
            <p className="text-indigo-700 font-bold">✅ {batchCards.length} report cards generated and sent to printer.</p>
            <p className="text-indigo-500 text-sm mt-1">Each card is on its own A4 page.</p>
          </div>
        </div>
      )}
    </div>
  );
}
