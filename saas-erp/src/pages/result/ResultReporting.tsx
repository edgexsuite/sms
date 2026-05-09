import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { FileText, Printer, Users, Loader2, AlertTriangle, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { ReportCardLayoutRenderer, DEFAULT_REPORT_CUSTOM } from '../../lib/reportCardTemplates';
import {
  fetchGradingPolicy, fetchResultConfig, getGradeFromPolicy,
  calculateGPA, buildActiveFields, GradingBracket,
} from '../../lib/gradingUtils';

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
  const [gradingBrackets, setGradingBrackets] = useState<GradingBracket[]>([]);
  const [resultConfig, setResultConfig] = useState<any>(null);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, number>>({});
  const [examConfigs, setExamConfigs] = useState<Record<string, { total_marks: number; passing_marks: number }>>({});

  const [selectedExamType, setSelectedExamType] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [loading, setLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);

  const [batchCards, setBatchCards] = useState<any[]>([]);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [selectedBatchClasses, setSelectedBatchClasses] = useState<string[]>([]);
  const [batchMultipleLoading, setBatchMultipleLoading] = useState(false);
  const [printMode, setPrintMode] = useState<'single' | 'batch'>('single');
  const [evaluationMap, setEvaluationMap] = useState<Record<string, { ratings: Record<string, number>; feedback?: string }>>({});
  const [twoPerPage, setTwoPerPage] = useState(false);

  useEffect(() => {
    if (userRole?.school_id) {
      fetchInit();
      Promise.all([
        supabase.from('schools').select('*').eq('id', userRole.school_id).single(),
        supabase.from('report_card_settings').select('*').eq('school_id', userRole.school_id).maybeSingle(),
        fetchGradingPolicy(userRole.school_id),
        fetchResultConfig(userRole.school_id),
      ]).then(([{ data: school }, { data: settings }, brackets, rConfig]) => {
        if (school) setSchoolInfo(school);
        if (settings) setRcSettings(settings);
        setGradingBrackets(brackets);
        setResultConfig(rConfig);
      });
    }
  }, [userRole]);

  useEffect(() => { if (selectedClass) fetchClassData(); }, [selectedClass]);
  useEffect(() => { if (selectedExamType && selectedStudent) fetchStudentResults(); }, [selectedExamType, selectedStudent]);
  useEffect(() => {
    if (selectedExamType && selectedClass && students.length > 0) {
      fetchAllClassResults();
      fetchExamConfigs();
    }
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
    const [{ data }, { data: allEvalData }, { data: attData }] = await Promise.all([
      supabase.from('exam_results').select('*').eq('exam_type_id', selectedExamType).eq('student_id', selectedStudent),
      supabase.from('evaluations').select('student_id, ratings, feedback, exam_type_id, evaluation_date').eq('student_id', selectedStudent).eq('school_id', userRole!.school_id).order('evaluation_date', { ascending: false }),
      supabase.from('attendance').select('id').eq('student_id', selectedStudent).eq('status', 'present'),
    ]);
    if (data) setResults(data);
    if (allEvalData && allEvalData.length > 0) {
      const exactMatch = allEvalData.find((e: any) => e.exam_type_id === selectedExamType);
      const bestEval = exactMatch || allEvalData[0];
      setEvaluationMap(prev => ({ ...prev, [selectedStudent]: { ratings: bestEval.ratings || {}, feedback: bestEval.feedback } }));
    }
    if (attData) {
      setAttendanceMap(prev => ({ ...prev, [selectedStudent]: attData.length }));
    }
    setLoading(false);
  };

  const fetchAllClassResults = async () => {
    const ids = students.map(s => s.id);
    if (!ids.length) return;
    const { data } = await supabase.from('exam_results').select('student_id, obtained_marks').eq('exam_type_id', selectedExamType).in('student_id', ids);
    if (data) setClassResults(data);
  };

  const fetchExamConfigs = async () => {
    if (!selectedExamType || !selectedClass) return;
    const { data } = await supabase
      .from('exam_subject_config')
      .select('subject_id, total_marks, passing_marks')
      .eq('exam_type_id', selectedExamType)
      .eq('school_id', userRole?.school_id);
    
    if (data) {
      const mapping: Record<string, { total_marks: number; passing_marks: number }> = {};
      data.forEach(d => {
        mapping[d.subject_id] = { total_marks: d.total_marks, passing_marks: d.passing_marks };
      });
      setExamConfigs(mapping);
    } else {
      setExamConfigs({});
    }
  };

  const computePosition = (studentId: string): { position: number; outOf: number } => {
    if (!classResults.length) return { position: 0, outOf: 0 };
    const totals: Record<string, number> = {};
    classResults.forEach(r => { totals[r.student_id] = (totals[r.student_id] || 0) + r.obtained_marks; });
    const sorted = Object.entries(totals).sort(([, a], [, b]) => b - a);
    const ranks: Record<string, number> = {};
    let denseRank = 1;
    sorted.forEach(([id, marks], i) => {
      if (i > 0 && marks !== sorted[i - 1][1]) {
        denseRank++;
      }
      ranks[id] = denseRank;
    });
    const pos = ranks[studentId] || 0;
    return { position: pos, outOf: sorted.length };
  };

    const handlePrintMultipleClasses = async () => {
    if (!selectedExamType || selectedBatchClasses.length === 0) return;
    
    setBatchMultipleLoading(true);
    setBatchCards([]);

    try {
      const { data: stus } = await supabase
        .from('students')
        .select('id, full_name, roll_number, photograph_url, class_id')
        .in('class_id', selectedBatchClasses)
        .eq('status', 'active')
        .order('roll_number');
      
      if (!stus || stus.length === 0) {
        alert('No active students found in selected classes.');
        setBatchMultipleLoading(false);
        return;
      }

      const classIds = [...new Set(stus.map(s => s.class_id))];
      const studentIds = stus.map(s => s.id);

      const { data: subs } = await supabase
        .from('subjects')
        .select('*')
        .in('class_id', classIds);

      const { data: clsDetails } = await supabase
        .from('classes')
        .select('id, name, section')
        .in('id', classIds);

      const [{ data: allRes }, { data: allEvalsForExam }, { data: allEvalsAny }, { data: allAtt }, { data: allExamConfigs }] = await Promise.all([
        supabase.from('exam_results').select('*').eq('exam_type_id', selectedExamType).in('student_id', studentIds),
        supabase.from('evaluations').select('student_id, ratings, feedback, exam_type_id, evaluation_date').eq('exam_type_id', selectedExamType).in('student_id', studentIds),
        supabase.from('evaluations').select('student_id, ratings, feedback, exam_type_id, evaluation_date').in('student_id', studentIds).eq('school_id', userRole!.school_id).order('evaluation_date', { ascending: false }),
        supabase.from('attendance').select('student_id').eq('status', 'present').in('student_id', studentIds),
        supabase.from('exam_subject_config').select('subject_id, total_marks, passing_marks').eq('exam_type_id', selectedExamType).eq('school_id', userRole?.school_id),
      ]);

      const examConfigMap: Record<string, any> = {};
      (allExamConfigs || []).forEach(c => { examConfigMap[c.subject_id] = c; });

      const evalMap: Record<string, any> = {};
      const latestAnyEval: Record<string, any> = {};
      (allEvalsAny || []).forEach((e: any) => { if (!latestAnyEval[e.student_id]) latestAnyEval[e.student_id] = e; });
      const exactEvalMap: Record<string, any> = {};
      (allEvalsForExam || []).forEach((e: any) => { exactEvalMap[e.student_id] = e; });
      studentIds.forEach(id => {
        const best = exactEvalMap[id] || latestAnyEval[id];
        if (best) evalMap[id] = { ratings: best.ratings || {}, feedback: best.feedback };
      });

      const attCount: Record<string, number> = {};
      (allAtt || []).forEach((a: any) => { attCount[a.student_id] = (attCount[a.student_id] || 0) + 1; });

      let cards: any[] = [];

      classIds.forEach(cid => {
        const classStudents = stus.filter(s => s.class_id === cid);
        const classSubjects = (subs || []).filter((s: any) => s.class_id === cid);
        const cInfo = (clsDetails || []).find((c: any) => c.id === cid);
        const classNameStr = cInfo ? cInfo.name : 'Class';

        const totals: Record<string, number> = {};
        const classRes = (allRes || []).filter((r: any) => classStudents.some(cs => cs.id === r.student_id));
        classRes.forEach((r: any) => { totals[r.student_id] = (totals[r.student_id] || 0) + r.obtained_marks; });
        const sorted = Object.entries(totals).sort(([, a], [, b]) => (b as number) - (a as number));
        const ranks: Record<string, number> = {};
        let denseRank = 1;
        sorted.forEach(([id, marks], i) => {
          if (i > 0 && marks !== sorted[i - 1][1]) {
            denseRank++;
          }
          ranks[id] = denseRank;
        });

        const classCards = classStudents.map(stu => {
          const stuResults = classRes.filter((r: any) => r.student_id === stu.id);
          let obtained = 0, grand = 0, fails = 0;
          const subjectRows = classSubjects.map((subj: any) => {
            const r = stuResults.find((res: any) => res.subject_id === subj.id);
            const eCfg = examConfigMap[subj.id];
            const actualTotal = eCfg ? eCfg.total_marks : (subj.total_marks || 100);

            if (r) {
              const isAbs = r.is_absent || r.grade === 'Ab' || r.grade === 'AB';
              const g = getGradeFromPolicy(r.obtained_marks, actualTotal, gradingBrackets);
              if (g.status !== 'Pass') fails++;
              obtained += r.obtained_marks; grand += actualTotal;
              return { 
                name: subj.subject_name, 
                marks: isAbs ? 'Ab' : r.obtained_marks, 
                total: actualTotal, 
                grade: isAbs ? 'AB' : g.grade, 
                status: isAbs ? 'Absent' : g.status 
              };
            } else {
              grand += actualTotal; fails++;
              return { name: subj.subject_name, marks: 'Ab', total: actualTotal, grade: 'AB', status: 'Absent' };
            }
          });
          const overallG = getGradeFromPolicy(obtained, grand, gradingBrackets);
          const pos = ranks[stu.id] || 0;
          const presentDays = attCount[stu.id] || 0;
          return {
            student: stu, subjects: subjectRows, obtained, grand,
            pct: overallG.pct, grade: overallG.grade, remarks: overallG.remarks,
            gpa: calculateGPA(overallG.grade), fails, position: pos, totalClassStudents: classStudents.length,
            evaluation: evalMap[stu.id] || null,
            attendance: presentDays > 0 ? `${presentDays} days` : 'N/A',
            classNameStr
          };
        });
        cards = [...cards, ...classCards];
      });

      setBatchCards(cards);
      setIsBatchModalOpen(false);
      setPrintMode('batch');
      setTimeout(() => window.print(), 800);
    } catch (err) {
      console.error('Batch Print Error:', err);
      alert(`Error generating bulk report cards: ${err instanceof Error ? err.message : JSON.stringify(err)}`);
    } finally {
      setBatchMultipleLoading(false);
    }
  };

  // Build batch cards for all students
  const handlePrintClass = async () => {
    if (!selectedExamType || !selectedClass || !subjects.length) return;
    const ids = students.map(s => s.id);

    // ── Preflight: check for missing marks ──────────────────────────────────
    const { data: existingMarks } = await supabase
      .from('exam_results')
      .select('student_id, subject_id')
      .eq('exam_type_id', selectedExamType)
      .in('student_id', ids);
    const missing = students.length * subjects.length - (existingMarks?.length || 0);
    if (missing > 0) {
      const go = window.confirm(
        `⚠️ Pre-flight Warning\n\n${missing} mark entr${missing === 1 ? 'y is' : 'ies are'} missing ` +
        `(${existingMarks?.length || 0}/${students.length * subjects.length} filled).\n\n` +
        `Missing subjects will show as "AB" (Absent). Proceed anyway?`
      );
      if (!go) return;
    }

    setBatchLoading(true);
    setBatchCards([]);

    const [{ data: allRes }, { data: allEvalsForExam }, { data: allEvalsAny }, { data: allAtt }, { data: allExamConfigs }] = await Promise.all([
      supabase.from('exam_results').select('*').eq('exam_type_id', selectedExamType).in('student_id', ids),
      supabase.from('evaluations').select('student_id, ratings, feedback, exam_type_id, evaluation_date').eq('exam_type_id', selectedExamType).in('student_id', ids),
      supabase.from('evaluations').select('student_id, ratings, feedback, exam_type_id, evaluation_date').in('student_id', ids).eq('school_id', userRole!.school_id).order('evaluation_date', { ascending: false }),
      supabase.from('attendance').select('student_id').eq('status', 'present').in('student_id', ids),
      supabase.from('exam_subject_config').select('subject_id, total_marks, passing_marks').eq('exam_type_id', selectedExamType).eq('school_id', userRole?.school_id),
    ]);

    const examConfigMap: Record<string, any> = {};
    (allExamConfigs || []).forEach(c => { examConfigMap[c.subject_id] = c; });

    const evalMap: Record<string, { ratings: Record<string, number>; feedback?: string }> = {};
    const latestAnyEval: Record<string, any> = {};
    (allEvalsAny || []).forEach((e: any) => { if (!latestAnyEval[e.student_id]) latestAnyEval[e.student_id] = e; });
    const exactEvalMap: Record<string, any> = {};
    (allEvalsForExam || []).forEach((e: any) => { exactEvalMap[e.student_id] = e; });
    ids.forEach(id => {
      const best = exactEvalMap[id] || latestAnyEval[id];
      if (best) evalMap[id] = { ratings: best.ratings || {}, feedback: best.feedback };
    });
    setEvaluationMap(evalMap);

    // Attendance count per student
    const attCount: Record<string, number> = {};
    (allAtt || []).forEach((a: any) => { attCount[a.student_id] = (attCount[a.student_id] || 0) + 1; });
    setAttendanceMap(prev => ({ ...prev, ...attCount }));

    const totals: Record<string, number> = {};
    (allRes || []).forEach((r: any) => { totals[r.student_id] = (totals[r.student_id] || 0) + r.obtained_marks; });
    const sorted = Object.entries(totals).sort(([, a], [, b]) => b - a);
    const ranks: Record<string, number> = {};
    let denseRank = 1;
    sorted.forEach(([id, marks], i) => {
      if (i > 0 && marks !== sorted[i - 1][1]) {
        denseRank++;
      }
      ranks[id] = denseRank;
    });

    const cards = students.map(stu => {
      const stuResults = (allRes || []).filter((r: any) => r.student_id === stu.id);
      let obtained = 0, grand = 0, fails = 0;
      const subjectRows = subjects.map((subj: any) => {
        const r = stuResults.find((res: any) => res.subject_id === subj.id);
        const eCfg = examConfigMap[subj.id];
        const actualTotal = eCfg ? eCfg.total_marks : (subj.total_marks || 100);
        if (r) {
          const isAbs = r.is_absent || r.grade === 'Ab' || r.grade === 'AB';
          const g = getGradeFromPolicy(r.obtained_marks, actualTotal, gradingBrackets);
          if (g.status !== 'Pass') fails++;
          obtained += r.obtained_marks; grand += actualTotal;
          return { name: subj.subject_name, marks: isAbs ? 'Ab' : r.obtained_marks, total: actualTotal, grade: isAbs ? 'AB' : g.grade, status: isAbs ? 'Absent' : g.status };
        } else {
          grand += actualTotal; fails++;
          return { name: subj.subject_name, marks: 'Ab', total: actualTotal, grade: 'AB', status: 'Absent' };
        }
      });
      const overallG = getGradeFromPolicy(obtained, grand, gradingBrackets);
      const pos = ranks[stu.id] || 0;
      const presentDays = attCount[stu.id] || 0;
      return {
        student: stu, subjects: subjectRows, obtained, grand, classNameStr: currentClass?.name || 'Class', totalClassStudents: students.length,
        pct: overallG.pct, grade: overallG.grade, remarks: overallG.remarks,
        gpa: calculateGPA(overallG.grade), fails, position: pos,
        evaluation: evalMap[stu.id] || null,
        attendance: presentDays > 0 ? `${presentDays} days` : 'N/A',
      };
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
    const eCfg = examConfigs[subj.id];
    const actualTotal = eCfg ? eCfg.total_marks : (subj.total_marks || 100);
    if (r) {
      const g = getGradeFromPolicy(r.obtained_marks, actualTotal, gradingBrackets);
      if (g.status !== 'Pass') failSubjects++;
      totalObtained += r.obtained_marks; grandTotal += actualTotal;
      const isAbs = r.is_absent || r.grade === 'Ab' || r.grade === 'AB';
      return { subj, r, grade: isAbs ? 'AB' : g.grade, status: isAbs ? 'Absent' : g.status, remarks: g.remarks, actualTotal, isAbs };
    } else {
      grandTotal += actualTotal; failSubjects++;
      return { subj, r: null, grade: 'AB', status: 'Absent', remarks: '', actualTotal, isAbs: true };
    }
  });

  const overallG = getGradeFromPolicy(totalObtained, grandTotal, gradingBrackets);
  const overallGrade = overallG.grade;
  const overallPct   = overallG.pct;
  const { position, outOf } = computePosition(selectedStudent);
  const studentPresent = attendanceMap[selectedStudent];
  const attendanceDisplay = studentPresent !== undefined ? `${studentPresent} days` : 'N/A';

  const template = rcSettings?.template || 'classic';
  const customization = rcSettings?.layout_config?.customization || DEFAULT_REPORT_CUSTOM;
  const activeFields = buildActiveFields(rcSettings?.fields, resultConfig);

  const commonCardProps = {
    template, customization, activeFields,
    schoolName: schoolInfo?.name || '',
    schoolLogo: schoolInfo?.logo_url || null,
    examName: currentExam?.name || '',
    examSession: currentExam?.session || '',
    className: currentClass?.name || '',
    totalStudents: outOf > 0 ? outOf : students.length || undefined,
    finalStatus: failSubjects === 0 ? 'PROMOTED' : 'NOT PROMOTED',
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <style>{`
        @media print {
          * {
            box-shadow: none !important;
            filter: none !important;
            backdrop-filter: none !important;
            text-shadow: none !important;
          }
          .no-print { display: none !important; }
          body { background: white; margin: 0; padding: 0; }
        }
        ${twoPerPage ? `
          @media print {
            @page { size: A4 landscape; margin: 0; }
            .two-up-sheet {
              width: 297mm;
              height: 210mm;
              display: flex !important;
              page-break-after: always;
              page-break-inside: avoid;
              overflow: hidden;
            }
            .two-up-slot {
              width: 148.5mm;
              height: 210mm;
              overflow: hidden;
              position: relative;
              flex-shrink: 0;
            }
            .two-up-slot:first-child {
              border-right: 1px dashed #bbb;
            }
            .two-up-scale {
              position: absolute;
              top: 0;
              left: 0;
              transform: scale(0.707);
              transform-origin: top left;
            }
            .result-card-wrapper { display: none !important; }
          }
          .two-up-sheet { display: none; }
        ` : `
          @media print {
            @page { size: A4 portrait; margin: 0; }
            .result-card-wrapper {
              width: 210mm !important;
              height: 297mm !important;
              page-break-inside: avoid !important;
              box-shadow: none !important;
              border-radius: 0 !important;
              border: none !important;
              margin: 0 !important;
            }
            .result-card-wrapper:not(:last-child) {
              page-break-after: always !important;
            }
            .two-up-sheet { display: none !important; }
          }
        `}
      `}</style>

      {/* Header */}
      <div className="no-print">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-6 h-6 text-teal-600" /> Individual Result Cards
        </h1>
        <p className="text-gray-500 text-sm mt-1">Generate printable result cards for individual students or the whole class.</p>
        {gradingBrackets.length === 0 && (
          <div className="mt-3 flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            No custom grading policy found — using default scale. <a href="/result/grading-policy" className="underline ml-1 font-bold">Configure Grading Policy →</a>
          </div>
        )}
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
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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

            {/* General Action buttons (Exam level) */}
      {selectedExamType && (
        <div className="no-print flex flex-wrap gap-3 justify-end items-center mb-4 mt-2">
          {/* Print Multiple Classes Button */}
          <button onClick={() => setIsBatchModalOpen(true)}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg font-bold shadow transition">
            <Printer className="w-4 h-4" /> Print Multiple Classes
          </button>
        </div>
      )}

      {/* Class Action buttons */}
      {selectedExamType && selectedClass && subjects.length > 0 && (
        <div className="no-print flex flex-wrap gap-3 justify-end items-center">

          {/* 2-per-page toggle */}
          <label className="flex items-center gap-2 cursor-pointer bg-white border border-gray-200 px-4 py-2 rounded-lg shadow-sm select-none">
            <input
              type="checkbox"
              checked={twoPerPage}
              onChange={e => setTwoPerPage(e.target.checked)}
              className="w-4 h-4 accent-indigo-600 cursor-pointer"
            />
            <span className="text-sm font-semibold text-gray-700">2 cards / page</span>
            <span className="text-xs text-gray-400 hidden sm:inline">(landscape, saves paper)</span>
          </label>

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
              : <><Users className="w-4 h-4" /> Print This Class ({students.length} students)</>
            }
          </button>
        </div>
      )}

      {/* SINGLE student card */}
      {printMode === 'single' && selectedStudent && subjects.length > 0 && !loading && (() => {
        const singleProps = {
          ...commonCardProps,
          studentName: currentStudent?.full_name || '',
          rollNumber: String(currentStudent?.roll_number || ''),
          studentPhoto: currentStudent?.photograph_url || null,
          subjects: subjectRows.map(row => ({
            name: row.subj.subject_name,
            marks: row.isAbs ? 'Ab' : (row.r?.obtained_marks ?? 0),
            total: row.subj.total_marks || 100,
            grade: row.grade,
            status: row.status,
          })),
          totalMarks: grandTotal,
          obtainedMarks: totalObtained,
          percentage: overallPct,
          grade: overallGrade,
          attendance: attendanceDisplay,
          positionInClass: position > 0 ? position : undefined,
          totalStudents: outOf > 0 ? outOf : undefined,
          finalStatus: failSubjects === 0 ? 'PROMOTED' : 'NOT PROMOTED',
          evaluation: evaluationMap[selectedStudent] || undefined,
        };
        return (
          <div className="w-full overflow-x-auto custom-scrollbar pb-4 print:overflow-visible">
            {/* Screen preview — always one card */}
            <div className="result-card-wrapper bg-white shadow-lg border border-gray-200 overflow-hidden mx-auto min-w-[210mm]">
              <ReportCardLayoutRenderer {...singleProps} />
            </div>
            {/* Two-up print sheet (two copies: school + student) */}
            {twoPerPage && (
              <div className="two-up-sheet">
                <div className="two-up-slot">
                  <div className="two-up-scale"><ReportCardLayoutRenderer {...singleProps} /></div>
                </div>
                <div className="two-up-slot">
                  <div className="two-up-scale"><ReportCardLayoutRenderer {...singleProps} /></div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* BATCH: all class cards */}
      {printMode === 'batch' && batchCards.length > 0 && (
        <div>
          {(() => {
            const makeCardProps = (card: any) => ({
              ...commonCardProps,
              className: card.classNameStr || commonCardProps.className,
              studentName: card.student.full_name,
              rollNumber: String(card.student.roll_number),
              studentPhoto: card.student.photograph_url || null,
              subjects: card.subjects,
              totalMarks: card.grand,
              obtainedMarks: card.obtained,
              percentage: card.pct,
              grade: card.grade,
              attendance: card.attendance || 'N/A',
              positionInClass: card.position > 0 ? card.position : undefined,
              totalStudents: card.totalClassStudents || batchCards.length,
              finalStatus: card.fails === 0 ? 'PROMOTED' : 'NOT PROMOTED',
              evaluation: card.evaluation || undefined,
            });

            if (twoPerPage) {
              // Group into pairs → landscape sheets
              const pairs: any[][] = [];
              for (let i = 0; i < batchCards.length; i += 2) pairs.push(batchCards.slice(i, i + 2));
              return pairs.map((pair, pIdx) => (
                <div key={pIdx} className="two-up-sheet">
                  {pair.map((card, cIdx) => (
                    <div key={cIdx} className="two-up-slot">
                      <div className="two-up-scale">
                        <ReportCardLayoutRenderer {...makeCardProps(card)} />
                      </div>
                    </div>
                  ))}
                </div>
              ));
            }

            // Normal: one card per portrait page
            return batchCards.map((card, idx) => (
              <div key={idx} className="result-card-wrapper bg-white overflow-hidden">
                <ReportCardLayoutRenderer {...makeCardProps(card)} />
              </div>
            ));
          })()}

          {/* Screen summary */}
          <div className="no-print bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-center">
            <p className="text-indigo-700 font-bold">✅ {batchCards.length} report cards generated and sent to printer.</p>
            <p className="text-indigo-500 text-sm mt-1">
              {twoPerPage
                ? `Printed 2 per page (landscape) — ${Math.ceil(batchCards.length / 2)} sheets total.`
                : 'Each card is on its own A4 portrait page.'}
            </p>
          </div>
        </div>
      )}

      {/* Batch Modal */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm no-print">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Printer className="w-5 h-5 text-purple-600" />
                Select Classes
              </h3>
              <button onClick={() => setIsBatchModalOpen(false)} className="text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full p-1">
                &times;
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto custom-scrollbar flex-1">
              <p className="text-sm text-gray-500 mb-4">
                Select the classes you want to generate report cards for. The system will compile all students from these classes into a single PDF via your browser's Print dialog.
              </p>
              
              <div className="flex gap-3 mb-4">
                <button 
                  onClick={() => setSelectedBatchClasses(classes.map(c => c.id))}
                  className="text-sm font-medium text-purple-600 hover:text-purple-700"
                >
                  Select All
                </button>
                <button 
                  onClick={() => setSelectedBatchClasses([])}
                  className="text-sm font-medium text-gray-500 hover:text-gray-700"
                >
                  Deselect All
                </button>
              </div>

              <div className="space-y-2 border border-gray-200 rounded-lg p-3 max-h-[40vh] overflow-y-auto">
                {classes.map(c => (
                  <label key={c.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer border-b border-gray-100 last:border-0">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 accent-purple-600 cursor-pointer"
                      checked={selectedBatchClasses.includes(c.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedBatchClasses(prev => [...prev, c.id]);
                        else setSelectedBatchClasses(prev => prev.filter(id => id !== c.id));
                      }}
                    />
                    <span className="font-medium text-gray-800">{c.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 shrink-0">
              <button 
                onClick={() => setIsBatchModalOpen(false)}
                className="px-5 py-2 font-medium text-gray-700 hover:bg-gray-200 bg-gray-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button 
                onClick={handlePrintMultipleClasses}
                disabled={batchMultipleLoading || selectedBatchClasses.length === 0}
                className="flex items-center gap-2 px-5 py-2 font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow transition"
              >
                {batchMultipleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                {batchMultipleLoading ? 'Generating...' : `Print / Save PDF (${selectedBatchClasses.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}