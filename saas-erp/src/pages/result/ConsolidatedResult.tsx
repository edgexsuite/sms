import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  TableProperties, Printer, Download, TrendingUp,
  RefreshCw, Award, Users, CheckCircle, XCircle,
} from 'lucide-react';
import { fetchGradingPolicy, getGradeFromPolicy, GradingBracket } from '../../lib/gradingUtils';
import * as XLSX from 'xlsx';

// ── Grade colour map ──────────────────────────────────────────────────────────
const GRADE_COLORS: Record<string, { bg: string; text: string; print: string }> = {
  'A+': { bg: 'bg-emerald-100',  text: 'text-emerald-800', print: '#d1fae5' },
  'A':  { bg: 'bg-green-100',   text: 'text-green-800',   print: '#dcfce7' },
  'B':  { bg: 'bg-blue-100',    text: 'text-blue-800',    print: '#dbeafe' },
  'C':  { bg: 'bg-yellow-100',  text: 'text-yellow-800',  print: '#fef9c3' },
  'D':  { bg: 'bg-orange-100',  text: 'text-orange-800',  print: '#ffedd5' },
  'F':  { bg: 'bg-red-100',     text: 'text-red-800',     print: '#fee2e2' },
};

export default function ConsolidatedResult() {
  const { userRole } = useAuth();
  const sid = userRole?.school_id ?? '';

  const [examTypes,       setExamTypes]       = useState<any[]>([]);
  const [classes,         setClasses]         = useState<any[]>([]);
  const [subjects,        setSubjects]        = useState<any[]>([]);
  // examMarks: subject_id → { total_marks, passing_marks } from exam_subject_config
  const [examMarks,       setExamMarks]       = useState<Record<string, { total_marks: number; passing_marks: number }>>({});
  const [students,        setStudents]        = useState<any[]>([]);
  const [results,         setResults]         = useState<any[]>([]);
  const [gradingBrackets, setGradingBrackets] = useState<GradingBracket[]>([]);
  const [schoolName,      setSchoolName]      = useState('');

  const [selectedExamType, setSelectedExamType] = useState('');
  const [selectedClass,    setSelectedClass]    = useState('');
  const [loading,          setLoading]          = useState(false);

  const tableRef = useRef<HTMLDivElement>(null);

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sid) return;
    Promise.all([
      supabase.from('exam_types').select('*').eq('school_id', sid).order('created_at'),
      supabase.from('classes').select('id, name, section').eq('school_id', sid).order('name'),
      supabase.from('schools').select('name').eq('id', sid).maybeSingle(),
      fetchGradingPolicy(sid),
    ]).then(([{ data: et }, { data: cls }, { data: sch }, brackets]) => {
      if (et)  setExamTypes(et);
      if (cls) setClasses(cls);
      if (sch) setSchoolName((sch as any).name || '');
      setGradingBrackets(brackets);
    });
  }, [sid]);

  // ── Fetch class data when class changes ───────────────────────────────────
  useEffect(() => {
    if (!selectedClass) return;
    Promise.all([
      supabase.from('subjects').select('id, subject_name, total_marks, passing_marks').eq('school_id', sid).eq('class_id', selectedClass).order('subject_name'),
      supabase.from('students').select('id, full_name, roll_number').eq('school_id', sid).eq('class_id', selectedClass).eq('status', 'active').order('roll_number'),
    ]).then(([{ data: subs }, { data: stus }]) => {
      if (subs) setSubjects(subs);
      if (stus) setStudents(stus);
      setResults([]);
      setExamMarks({});
    });
  }, [selectedClass]);

  // ── Fetch exam_subject_config when exam or subjects change ────────────────
  useEffect(() => {
    if (!selectedExamType || subjects.length === 0) return;
    supabase
      .from('exam_subject_config')
      .select('subject_id, total_marks, passing_marks')
      .eq('school_id', sid)
      .eq('exam_type_id', selectedExamType)
      .in('subject_id', subjects.map(s => s.id))
      .then(({ data }) => {
        const map: Record<string, { total_marks: number; passing_marks: number }> = {};
        (data || []).forEach((r: any) => { map[r.subject_id] = { total_marks: r.total_marks, passing_marks: r.passing_marks }; });
        setExamMarks(map);
      });
  }, [selectedExamType, subjects]);

  // ── Fetch results when both exam + class selected ─────────────────────────
  useEffect(() => {
    if (!selectedExamType || students.length === 0 || !selectedClass) return;
    setLoading(true);
    const ids = students.map(s => s.id);

    supabase
      .from('exam_results')
      .select('student_id, subject_id, obtained_marks, total_marks, is_absent')
      .eq('school_id', sid)
      .eq('exam_type_id', selectedExamType)
      .in('student_id', ids)
      .then(({ data, error }) => {
        if (error) console.error('exam_results fetch error:', error.message);
        setResults(data || []);
        setLoading(false);
      });
  }, [selectedExamType, students, selectedClass]);


  // ── Effective marks: exam config takes priority, subject defaults as fallback ─
  const effectiveMarks = (subj: any) => {
    const cfg = examMarks[subj.id];
    return {
      total:   cfg ? Number(cfg.total_marks)   : Number(subj.total_marks   ?? 100),
      passing: cfg ? Number(cfg.passing_marks) : Number(subj.passing_marks ?? 33),
    };
  };

  // ── Build matrix ──────────────────────────────────────────────────────────
  const getResult = (studentId: string, subjectId: string) =>
    results.find(r => r.student_id === studentId && r.subject_id === subjectId);

  // Calculate total possible marks for the class (all subjects in this exam config)
  const classTotalPossible = subjects.reduce((sum, subj) => sum + effectiveMarks(subj).total, 0);

  const consolidatedData = students.map(stu => {
    let totalObtained = 0;
    let failCount     = 0;

    const subjectRows = subjects.map(subj => {
      const { total: maxMarks, passing: passMarks } = effectiveMarks(subj);
      const r = getResult(stu.id, subj.id);

      // No row at all — not yet entered
      if (!r) return { subject: subj, maxMarks, passMarks, obtained: null, absent: false, pass: null };

      // Absent — obtained remains 0, count as a subject in the denominator
      if (r.is_absent) return { subject: subj, maxMarks, passMarks, obtained: 0, absent: true, pass: false };

      // Has marks — include in calculation
      const obtained = Number(r.obtained_marks);
      totalObtained += obtained;
      const pass = obtained >= passMarks;
      if (pass === false) failCount++;
      return { subject: subj, maxMarks, passMarks, obtained, absent: false, pass };
    });

    const { grade, pct } = getGradeFromPolicy(totalObtained, classTotalPossible, gradingBrackets);
    const status = failCount >= 3 ? 'FAIL' : 'PASS';

    return { student: stu, subjectRows, totalObtained, grandTotal: classTotalPossible, pct, grade, status };
  }).sort((a, b) => b.totalObtained - a.totalObtained);

  // Dense Ranking: ties share position; next position is +1 (1, 1, 2, 2, 3)
  (() => {
    let denseRank = 1;
    consolidatedData.forEach((d, i) => {
      if (i > 0 && d.totalObtained !== consolidatedData[i - 1].totalObtained) {
        denseRank++;
      }
      (d as any).position = denseRank;
    });
  })();

  // ── Summary stats ─────────────────────────────────────────────────────────
  const passCount   = consolidatedData.filter(d => d.status === 'PASS').length;
  const failCount   = consolidatedData.filter(d => d.status === 'FAIL').length;
  const classAvgPct = consolidatedData.length > 0
    ? Math.round(consolidatedData.reduce((a, d) => a + d.pct, 0) / consolidatedData.length)
    : 0;

  // Top 3 positions (all students at positions 1, 2, 3 — including ties)
  const top3Students = consolidatedData.filter(d => (d as any).position <= 3);

  // Subject-wise class averages (bottom row)
  const subjectAvgs = subjects.map(subj => {
    const entries = results.filter(r => r.subject_id === subj.id && !r.is_absent);
    if (entries.length === 0) return null;
    return Math.round(entries.reduce((a, r) => a + Number(r.obtained_marks), 0) / entries.length);
  });

  // ── Excel export ──────────────────────────────────────────────────────────
  const handleExcelExport = () => {
    const currentExam  = examTypes.find(e => e.id === selectedExamType);
    const currentClass = classes.find(c => c.id === selectedClass);

    const header1 = ['', 'Roll', 'Student', ...subjects.map(s => s.subject_name), 'Total Obt', 'Max Marks', '%', 'Grade', 'Status'];
    const header2 = ['',  '',    '',        ...subjects.map(s => `Pass: ${s.passing_marks ?? '—'} / ${s.total_marks ?? 100}`), '', '', '', '', ''];

    const rows = consolidatedData.map((row: any) => [
      row.position,
      row.student.roll_number,
      row.student.full_name,
      ...row.subjectRows.map((sr: any) => sr.absent ? 'Ab' : sr.obtained ?? '—'),
      row.totalObtained,
      row.grandTotal,
      `${row.pct}%`,
      row.grade,
      row.status,
    ]);

    const avgRow = ['', '', 'Class Average', ...subjectAvgs.map(a => a ?? '—'), '', '', `${classAvgPct}%`, '', ''];

    const ws = XLSX.utils.aoa_to_sheet([
      [`${schoolName} — Consolidated Result Sheet`],
      [`Exam: ${currentExam?.name ?? ''} (${currentExam?.session ?? ''})`],
      [`Class: ${currentClass?.name ?? ''} ${currentClass?.section ?? ''}`],
      [],
      header1,
      header2,
      ...rows,
      [],
      avgRow,
    ]);

    // Column widths
    ws['!cols'] = [{ wch: 5 }, { wch: 8 }, { wch: 26 }, ...subjects.map(() => ({ wch: 12 })), { wch: 10 }, { wch: 10 }, { wch: 7 }, { wch: 8 }, { wch: 7 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Consolidated');
    XLSX.writeFile(wb, `Consolidated_${currentClass?.name ?? 'Class'}_${currentExam?.name ?? 'Exam'}.xlsx`);
  };

  // ── Derived display ───────────────────────────────────────────────────────
  const currentExam  = examTypes.find(e => e.id === selectedExamType);
  const currentClass = classes.find(c => c.id === selectedClass);
  const isReady      = selectedExamType && selectedClass && !loading && consolidatedData.length > 0;
  // show_pass_fail: true by default; false hides the Result column (e.g. monthly tests)
  const showPassFail = currentExam?.show_pass_fail !== false;

  return (
    <div className="space-y-6 max-w-full">
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; margin: 0; }
          table { font-size: 7.5px; border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #333; padding: 2px 3px; text-align: center; vertical-align: middle; }
          .text-left { text-align: left !important; }
          .print-fail-bg { background-color: #fee2e2 !important; }
          .print-pass-bg { background-color: #f0fdf4 !important; }
          /* Prevent tfoot from repeating on every printed page */
          tfoot { display: table-row-group !important; }
          @page { size: landscape; margin: 8mm; }
        }
      `}</style>

      {/* ── Header ── */}
      <div className="no-print flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TableProperties className="w-6 h-6 text-violet-600" /> Consolidated Result Sheet
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Full class result — all subjects, totals, rank, grade &amp; pass/fail. Print or export to Excel.
          </p>
        </div>
        <div className="flex gap-2">
          {isReady && (
            <>
              <button
                onClick={handleExcelExport}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg font-bold shadow text-sm transition"
              >
                <Download className="w-4 h-4" /> Excel
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 rounded-lg font-bold shadow text-sm transition"
              >
                <Printer className="w-4 h-4" /> Print
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="no-print bg-white rounded-xl shadow-sm border border-gray-200 p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Exam</label>
          <select
            value={selectedExamType}
            onChange={e => setSelectedExamType(e.target.value)}
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg font-medium text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">— Select Exam —</option>
            {examTypes.map(e => (
              <option key={e.id} value={e.id}>{e.name} ({e.session})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Class</label>
          <select
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg font-medium text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">— Select Class —</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.section ? ` — ${c.section}` : ''}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="bg-white rounded-xl p-14 text-center text-gray-500 border border-gray-200">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-violet-400" />
          <p className="font-semibold">Generating result sheet…</p>
        </div>
      )}

      {/* ── Results ── */}
      {!loading && selectedExamType && selectedClass && (
        <>
          {/* ── Print header (visible only in print) ── */}
          <div className="hidden print:block text-center mb-6">
            {schoolName && <h2 className="text-xl font-black uppercase tracking-wide">{schoolName}</h2>}
            <h1 className="text-lg font-black uppercase mt-1">Consolidated Result Sheet</h1>
            <p className="text-sm font-bold mt-1">
              {currentExam?.name} — Session: {currentExam?.session}
            </p>
            <p className="text-sm font-bold">
              Class: {currentClass?.name}{currentClass?.section ? ` (${currentClass.section})` : ''}
              &nbsp;|&nbsp; Total Students: {students.length}
              {showPassFail && <>&nbsp;|&nbsp; Pass: {passCount} &nbsp;|&nbsp; Fail: {failCount}</>}
              &nbsp;|&nbsp; Class Avg: {classAvgPct}%
            </p>
            <hr className="mt-2 border-black" />
          </div>

          {/* ── Summary stat cards ── */}
          {consolidatedData.length > 0 && (
            <div className="no-print grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Students', value: students.length,    icon: Users,       color: 'bg-violet-50 border-violet-200 text-violet-700', always: true },
                { label: 'Passed',         value: passCount,          icon: CheckCircle, color: 'bg-emerald-50 border-emerald-200 text-emerald-700', always: false },
                { label: 'Failed',         value: failCount,          icon: XCircle,     color: 'bg-red-50 border-red-200 text-red-700', always: false },
                { label: 'Class Average',  value: `${classAvgPct}%`,  icon: TrendingUp,  color: 'bg-blue-50 border-blue-200 text-blue-700', always: true },
              ].filter(stat => stat.always || showPassFail).map(stat => (
                <div key={stat.label} className={`rounded-xl border p-4 flex items-center gap-4 ${stat.color}`}>
                  <stat.icon className="w-8 h-8 opacity-60 shrink-0" />
                  <div>
                    <p className="text-2xl font-black">{stat.value}</p>
                    <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── No data state ── */}
          {consolidatedData.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-14 text-center text-gray-400">
              <Award className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-semibold text-gray-600">No students or results found</p>
              <p className="text-sm mt-1">Select a valid exam and class, then ensure marks have been entered.</p>
            </div>
          )}

          {/* ── Main table ── */}
          {consolidatedData.length > 0 && (
            <div ref={tableRef} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  {/* Row 1: headers */}
                  <tr className="bg-violet-700 text-white">
                    <th className="px-2 py-2.5 text-center text-xs font-black uppercase w-10 whitespace-nowrap sticky left-0 bg-violet-700">#</th>
                    <th className="px-2 py-2.5 text-center text-xs font-black uppercase whitespace-nowrap w-14">Roll</th>
                    <th className="px-3 py-2.5 text-left   text-xs font-black uppercase whitespace-nowrap min-w-[160px]">Student Name</th>
                    {subjects.map(s => (
                      <th key={s.id} className="px-2 py-2.5 text-center text-xs font-black whitespace-nowrap min-w-[80px]">
                        {s.subject_name}
                      </th>
                    ))}
                    <th className="px-2 py-2.5 text-center text-xs font-black uppercase whitespace-nowrap">Total</th>
                    <th className="px-2 py-2.5 text-center text-xs font-black uppercase whitespace-nowrap">%</th>
                    <th className="px-2 py-2.5 text-center text-xs font-black uppercase whitespace-nowrap">Grade</th>
                    {showPassFail && <th className="px-2 py-2.5 text-center text-xs font-black uppercase whitespace-nowrap">Result</th>}
                  </tr>
                  {/* Row 2: max marks + passing marks (from exam config if set, else subject defaults) */}
                  <tr className="bg-violet-50 border-b-2 border-violet-200">
                    <td colSpan={3} className="px-3 py-1 text-[10px] font-black text-violet-600 uppercase tracking-widest sticky left-0 bg-violet-50">
                      Max Marks →
                    </td>
                    {subjects.map(s => {
                      const em = effectiveMarks(s);
                      return (
                        <td key={s.id} className="px-2 py-1 text-center text-[10px] font-bold text-violet-700">
                          <span className="block">{em.total}</span>
                          <span className="block text-violet-400">Pass: {em.passing}</span>
                        </td>
                      );
                    })}
                    <td className="px-2 py-1 text-center text-[10px] font-bold text-violet-700">
                      {subjects.reduce((a, s) => a + effectiveMarks(s).total, 0)}
                    </td>
                    <td colSpan={3} />
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {consolidatedData.map((row: any, idx) => (
                    <tr
                      key={row.student.id}
                      className={showPassFail && row.status === 'FAIL' ? 'bg-red-50/50 print-fail-bg' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                    >
                      {/* Rank */}
                      <td className="px-1 py-2 text-center sticky left-0 bg-inherit">
                        {row.position === 1 ? (
                          <span className="inline-flex flex-col items-center leading-none">
                            <span className="text-lg">🥇</span>
                            <span className="text-[9px] font-black text-yellow-700 tracking-tight uppercase">1st</span>
                          </span>
                        ) : row.position === 2 ? (
                          <span className="inline-flex flex-col items-center leading-none">
                            <span className="text-lg">🥈</span>
                            <span className="text-[9px] font-black text-slate-500 tracking-tight uppercase">2nd</span>
                          </span>
                        ) : row.position === 3 ? (
                          <span className="inline-flex flex-col items-center leading-none">
                            <span className="text-lg">🥉</span>
                            <span className="text-[9px] font-black text-orange-700 tracking-tight uppercase">3rd</span>
                          </span>
                        ) : (
                          <span className="text-sm font-black text-gray-500">{row.position}</span>
                        )}
                      </td>
                      {/* Roll */}
                      <td className="px-2 py-2.5 text-center font-mono font-bold text-gray-600 text-xs">
                        {row.student.roll_number}
                      </td>
                      {/* Name */}
                      <td className="px-3 py-2.5 text-left">
                        <span className="font-semibold text-gray-900 text-sm">{row.student.full_name}</span>
                      </td>
                      {/* Per-subject marks */}
                      {row.subjectRows.map((sr: any) => {
                        if (sr.absent) {
                          return (
                            <td key={sr.subject.id} className="px-2 py-2.5 text-center text-[11px] font-black text-orange-600 bg-orange-50/70">
                              Ab
                            </td>
                          );
                        }
                        if (sr.obtained === null) {
                          return (
                            <td key={sr.subject.id} className="px-2 py-2.5 text-center text-gray-300 font-bold">
                              —
                            </td>
                          );
                        }
                        return (
                          <td
                            key={sr.subject.id}
                            className={`px-2 py-2.5 text-center font-bold text-sm ${
                              sr.pass
                                ? 'text-emerald-700'
                                : 'text-red-600 bg-red-100/60'
                            }`}
                          >
                            {sr.obtained}
                          </td>
                        );
                      })}
                      {/* Total */}
                      <td className="px-2 py-2.5 text-center font-black text-gray-900">
                        {row.totalObtained}
                        <span className="text-gray-400 font-normal text-[10px]">/{row.grandTotal}</span>
                      </td>
                      {/* % */}
                      <td className="px-2 py-2.5 text-center">
                        <span className={`text-sm font-black ${row.pct >= 50 ? 'text-emerald-700' : 'text-red-600'}`}>
                          {row.pct}%
                        </span>
                      </td>
                      {/* Grade */}
                      <td className="px-2 py-2.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-black border ${
                          GRADE_COLORS[row.grade]
                            ? `${GRADE_COLORS[row.grade].bg} ${GRADE_COLORS[row.grade].text} border-current/20`
                            : 'bg-gray-100 text-gray-700 border-gray-200'
                        }`}>
                          {row.grade}
                        </span>
                      </td>
                      {/* Status */}
                      {showPassFail && (
                        <td className="px-2 py-2.5 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                            row.status === 'PASS' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {row.status}
                          </span>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>

                {/* ── Footer: class averages ── */}
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-300 font-black text-slate-700">
                    <td colSpan={3} className="px-3 py-2.5 text-xs uppercase tracking-widest text-left">
                      Class Average
                    </td>
                    {subjectAvgs.map((avg, i) => (
                      <td key={i} className="px-2 py-2.5 text-center text-sm font-black text-slate-700">
                        {avg ?? '—'}
                      </td>
                    ))}
                    <td className="px-2 py-2.5 text-center text-sm font-black">—</td>
                    <td className="px-2 py-2.5 text-center text-sm font-black text-blue-700">{classAvgPct}%</td>
                    <td colSpan={2} />
                  </tr>
                  {/* Top 3 honour rows — one per student (ties grouped at same position) */}
                  {top3Students.map((row: any) => {
                    const pos = row.position as number;
                    const styles: Record<number, { row: string; border: string; medal: string; label: string; labelCls: string }> = {
                      1: { row: 'bg-yellow-50',  border: 'border-yellow-300', medal: '🥇', label: '1ST POSITION', labelCls: 'text-yellow-800' },
                      2: { row: 'bg-slate-100',  border: 'border-slate-300',  medal: '🥈', label: '2ND POSITION', labelCls: 'text-slate-600'  },
                      3: { row: 'bg-orange-50',  border: 'border-orange-300', medal: '🥉', label: '3RD POSITION', labelCls: 'text-orange-800' },
                    };
                    const s = styles[pos] ?? styles[3];
                    return (
                      <tr key={`top-${row.student.id}`} className={`${s.row} border-t ${s.border}`}>
                        <td colSpan={3} className={`px-3 py-1.5 text-xs font-black uppercase tracking-widest text-left ${s.labelCls}`}>
                          {s.medal} {s.label}: {row.student.full_name}
                        </td>
                        {subjects.map((_: any, i: number) => <td key={i} />)}
                        <td className={`px-2 py-1.5 text-center text-xs font-black ${s.labelCls}`}>
                          {row.totalObtained}/{row.grandTotal}
                        </td>
                        <td className={`px-2 py-1.5 text-center text-xs font-black ${s.labelCls}`}>{row.pct}%</td>
                        <td className={`px-2 py-1.5 text-center text-xs font-black ${s.labelCls}`}>{row.grade}</td>
                        <td />
                      </tr>
                    );
                  })}
                </tfoot>
              </table>
            </div>
          )}

          {/* ── Legend ── */}
          {consolidatedData.length > 0 && (
            <div className="no-print flex flex-wrap gap-4 text-xs text-gray-500 pb-2">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-100/60 border border-red-200 inline-block" /> Failing mark (below passing)</span>
              <span className="flex items-center gap-1.5"><span className="text-gray-300 font-bold">—</span>&nbsp;= Marks not entered</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-orange-50/70 border border-orange-200 inline-block" /> Ab = Absent (excluded from %)</span>
              <span className="flex items-center gap-1.5">Red row = overall FAIL</span>
              <span className="flex items-center gap-1.5">Rank = sorted by overall %</span>
              <span className="flex items-center gap-1.5">Max marks from exam config (falls back to subject defaults)</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
