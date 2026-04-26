import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import * as XLSX from 'xlsx';
import {
  Upload, Download, FileSpreadsheet, CheckCircle2, AlertTriangle,
  Save, RefreshCw, ChevronRight, X, ChevronDown,
} from 'lucide-react';
import { cn } from '../../lib/utils';

const getGrade = (pct: number): string => {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 50) return 'D';
  return 'F';
};
const GRADE_COLORS: Record<string, string> = {
  'A+': 'text-emerald-700 bg-emerald-50', 'A': 'text-green-700 bg-green-50',
  'B': 'text-blue-700 bg-blue-50', 'C': 'text-yellow-700 bg-yellow-50',
  'D': 'text-orange-700 bg-orange-50', 'F': 'text-red-700 bg-red-50',
};

interface SubjectMark {
  subject_id: string;
  subject_name: string;
  total_marks: number;
  passing_marks: number;
  obtained: number | null;   // null = absent/skip
  grade: string | null;
  error?: string;
}

interface ParsedStudent {
  roll_number: number;
  student_name: string;
  student_id: string | null;
  found: boolean;
  subjects: SubjectMark[];
}

export default function ImportResult() {
  const { userRole } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [examTypes, setExamTypes] = useState<any[]>([]);
  const [classes, setClasses]     = useState<any[]>([]);
  const [subjects, setSubjects]   = useState<any[]>([]);
  const [students, setStudents]   = useState<any[]>([]);

  const [selectedExam,  setSelectedExam]  = useState('');
  const [selectedClass, setSelectedClass] = useState('');

  const [step,       setStep]       = useState<1|2|3>(1);
  const [rows,       setRows]       = useState<ParsedStudent[]>([]);
  const [fileName,   setFileName]   = useState('');
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [saveError,  setSaveError]  = useState('');

  useEffect(() => { if (userRole?.school_id) fetchInit(); }, [userRole]);
  useEffect(() => {
    if (selectedClass) { fetchSubjects(); fetchStudents(); }
    else { setSubjects([]); setStudents([]); }
    setRows([]); setStep(1); setSaved(false); setSaveError('');
  }, [selectedClass]);

  const fetchInit = async () => {
    const [{ data: et }, { data: cls }] = await Promise.all([
      supabase.from('exam_types').select('*').eq('school_id', userRole!.school_id).order('name'),
      supabase.from('classes').select('id,name,section').eq('school_id', userRole!.school_id).order('name'),
    ]);
    setExamTypes(et || []);
    setClasses(cls || []);
  };

  const fetchSubjects = async () => {
    const { data } = await supabase.from('subjects')
      .select('id,subject_name,subject_code,total_marks,passing_marks')
      .eq('class_id', selectedClass).order('subject_name');
    setSubjects(data || []);
  };

  const fetchStudents = async () => {
    const { data } = await supabase.from('students')
      .select('id,full_name,roll_number')
      .eq('class_id', selectedClass).eq('status', 'active').order('roll_number');
    setStudents(data || []);
  };

  /* ── Download template ─────────────────────────────────────────── */
  const downloadTemplate = () => {
    const subjectCols = subjects.map(s => s.subject_name);
    const header = ['Roll No', 'Student Name', ...subjectCols];
    const dataRows = students.length > 0
      ? students.map(s => [s.roll_number, s.full_name, ...subjectCols.map(() => '')])
      : [[1, 'Ahmed Raza', ...subjectCols.map(() => '')],
         [2, 'Sara Imtiaz', ...subjectCols.map(() => '')]];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
    ws['!cols'] = [{ wch: 10 }, { wch: 28 }, ...subjectCols.map(() => ({ wch: 14 }))];
    XLSX.utils.book_append_sheet(wb, ws, 'Marks');

    // Info sheet
    const info = [
      ['HOW TO FILL THIS SHEET'],
      [''],
      ['• Do NOT modify column headers (Row 1)'],
      ['• Roll No must match exactly as in the system'],
      ['• Enter marks as numbers; leave blank for absent'],
      ['• Each subject column uses that subject\'s total/passing marks from system'],
      [''],
      ['Subject details:'],
      ['Subject', 'Total Marks', 'Passing Marks'],
      ...subjects.map(s => [s.subject_name, s.total_marks, s.passing_marks]),
    ];
    const wsInfo = XLSX.utils.aoa_to_sheet(info);
    wsInfo['!cols'] = [{ wch: 30 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsInfo, 'Instructions');

    const cls = classes.find(c => c.id === selectedClass);
    const exam = examTypes.find(e => e.id === selectedExam);
    XLSX.writeFile(wb,
      `marks_${(cls?.name || 'class').replace(/\s/g,'_')}_${(exam?.name || 'exam').replace(/\s/g,'_')}.xlsx`
    );
  };

  /* ── Parse uploaded file ───────────────────────────────────────── */
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setSaved(false); setSaveError('');

    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const wb = XLSX.read(new Uint8Array(ev.target!.result as ArrayBuffer), { type: 'array' });
        const sheetRows: any[][] = XLSX.utils.sheet_to_json(
          wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }
        );
        if (sheetRows.length < 2) { alert('Sheet appears empty.'); return; }

        const headerRow = sheetRows[0].map((h: any) => String(h).trim());
        // Find subject columns (everything after index 1)
        const sheetSubjectNames = headerRow.slice(2);

        const parsed: ParsedStudent[] = sheetRows.slice(1)
          .filter(r => r[0] !== '' && r[0] !== undefined)
          .map(row => {
            const roll = Number(row[0]);
            const match = students.find(s => s.roll_number === roll);

            const subjectMarks: SubjectMark[] = sheetSubjectNames.map((sName, i) => {
              const dbSubject = subjects.find(
                s => s.subject_name.toLowerCase().trim() === sName.toLowerCase().trim()
              );
              if (!dbSubject) return {
                subject_id: '', subject_name: sName,
                total_marks: 100, passing_marks: 33,
                obtained: null, grade: null, error: 'Subject not found in DB',
              };
              const rawVal = row[i + 2];
              const obtained = rawVal === '' || rawVal === undefined || rawVal === null
                ? null : Number(rawVal);
              if (obtained !== null && (isNaN(obtained) || obtained < 0 || obtained > dbSubject.total_marks)) {
                return {
                  subject_id: dbSubject.id, subject_name: sName,
                  total_marks: dbSubject.total_marks, passing_marks: dbSubject.passing_marks,
                  obtained: null, grade: null,
                  error: `Must be 0–${dbSubject.total_marks}`,
                };
              }
              const grade = obtained === null ? null
                : getGrade((obtained / dbSubject.total_marks) * 100);
              return {
                subject_id: dbSubject.id, subject_name: sName,
                total_marks: dbSubject.total_marks, passing_marks: dbSubject.passing_marks,
                obtained, grade,
              };
            });

            return {
              roll_number: roll,
              student_name: match?.full_name ?? String(row[1] || '').trim(),
              student_id: match?.id ?? null,
              found: !!match,
              subjects: subjectMarks,
            };
          });

        setRows(parsed);
        setStep(3);
      } catch { alert('Failed to parse file. Please use the downloaded template.'); }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  /* ── Save ─────────────────────────────────────────────────────── */
  const handleSave = async () => {
    if (!userRole?.school_id || !selectedExam) return;
    setSaving(true); setSaveError('');

    const inserts: any[] = [];
    rows.forEach(student => {
      if (!student.found || !student.student_id) return;
      student.subjects.forEach(sm => {
        if (!sm.subject_id || sm.obtained === null || sm.error) return;
        inserts.push({
          school_id:      userRole!.school_id,
          student_id:     student.student_id,
          exam_type_id:   selectedExam,
          subject_id:     sm.subject_id,
          class_id:       selectedClass,
          obtained_marks: sm.obtained,
          total_marks:    sm.total_marks,
          passing_marks:  sm.passing_marks,
          grade:          sm.grade,
        });
      });
    });

    if (inserts.length === 0) { setSaveError('No valid marks to save.'); setSaving(false); return; }

    const { error } = await supabase.from('results')
      .upsert(inserts, { onConflict: 'student_id,exam_type_id,subject_id' });

    if (error) setSaveError(error.message);
    else setSaved(true);
    setSaving(false);
  };

  const totalValid = rows.reduce((acc, r) =>
    acc + r.subjects.filter(s => s.obtained !== null && !s.error).length, 0);
  const step1Done = selectedExam && selectedClass && subjects.length > 0;
  const selectedClsObj  = classes.find(c => c.id === selectedClass);
  const selectedExamObj = examTypes.find(e => e.id === selectedExam);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight">
          <FileSpreadsheet className="w-7 h-7 text-emerald-600" /> Import Results from Excel
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Upload one sheet with all subjects as columns — import marks for an entire class at once.
        </p>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2 flex-wrap">
        {['Select Exam & Class', 'Upload Sheet', 'Review & Save'].map((label, i) => {
          const num = (i + 1) as 1|2|3;
          const active = step === num;
          const done   = step > num || (num === 1 && !!step1Done);
          return (
            <React.Fragment key={label}>
              <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black transition-all',
                active ? 'bg-emerald-600 text-white shadow-md' : done ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
              )}>
                <span className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0',
                  active ? 'bg-white text-emerald-600' : done ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-white'
                )}>
                  {done && !active ? <CheckCircle2 className="w-3.5 h-3.5" /> : num}
                </span>
                <span className="hidden sm:inline">{label}</span>
              </div>
              {i < 2 && <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />}
            </React.Fragment>
          );
        })}
      </div>

      {/* Step 1 */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">1</span>
          Exam Type &amp; Class
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: 'Exam Type', value: selectedExam, setter: setSelectedExam, opts: examTypes, getName: (e: any) => e.name },
            { label: 'Class',     value: selectedClass, setter: (v: string) => setSelectedClass(v), opts: classes, getName: (c: any) => `${c.name} ${c.section}` },
          ].map(f => (
            <div key={f.label}>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">{f.label}</label>
              <div className="relative">
                <select value={f.value} onChange={e => f.setter(e.target.value)}
                  className="w-full appearance-none px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold pr-9 focus:ring-2 focus:ring-emerald-400 outline-none transition">
                  <option value="">— Select —</option>
                  {f.opts.map((o: any) => <option key={o.id} value={o.id}>{f.getName(o)}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          ))}
        </div>

        {selectedClass && subjects.length === 0 && (
          <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-3 rounded-xl text-sm font-bold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            No subjects found for this class. Add subjects in Class &amp; Subjects → Subject Management first.
          </div>
        )}

        {selectedClass && subjects.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {subjects.map(s => (
              <span key={s.id} className="text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-full">
                {s.subject_name} ({s.total_marks}/{s.passing_marks})
              </span>
            ))}
          </div>
        )}

        {step1Done && (
          <button onClick={() => setStep(2)}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition active:scale-95">
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Step 2 */}
      {step >= 2 && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">2</span>
            Download Template &amp; Upload Filled Sheet
          </h2>

          <div className="flex flex-wrap gap-2 text-[11px]">
            {[
              selectedExamObj?.name && { label: 'Exam', val: selectedExamObj.name },
              selectedClsObj && { label: 'Class', val: `${selectedClsObj.name} ${selectedClsObj.section}` },
              { label: 'Subjects', val: subjects.length },
              { label: 'Students', val: students.length },
            ].filter(Boolean).map((b: any) => (
              <div key={b.label} className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5">
                <span className="font-black text-slate-400 uppercase tracking-widest">{b.label}: </span>
                <span className="font-black text-slate-700">{b.val}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button onClick={downloadTemplate}
              className="flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed border-emerald-200 bg-emerald-50 rounded-2xl hover:border-emerald-400 hover:bg-emerald-100 transition group">
              <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200 group-hover:scale-110 transition-transform">
                <Download className="w-6 h-6 text-white" />
              </div>
              <div className="text-center">
                <p className="font-black text-emerald-700">Download Template</p>
                <p className="text-[11px] text-emerald-600 mt-0.5">
                  {students.length > 0 ? `${students.length} students · ${subjects.length} subject columns` : 'Sample with all subject columns'}
                </p>
              </div>
            </button>

            <button onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed border-slate-200 bg-slate-50 rounded-2xl hover:border-indigo-300 hover:bg-indigo-50 transition group">
              <div className="w-12 h-12 rounded-xl bg-slate-700 flex items-center justify-center shadow-lg group-hover:bg-indigo-600 group-hover:scale-110 transition-all">
                <Upload className="w-6 h-6 text-white" />
              </div>
              <div className="text-center">
                <p className="font-black text-slate-700 group-hover:text-indigo-700 transition-colors">Upload Filled Sheet</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {fileName ? <span className="text-indigo-600 font-bold">{fileName}</span> : '.xlsx or .xls'}
                </p>
              </div>
            </button>
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
        </div>
      )}

      {/* Step 3 — multi-subject preview */}
      {step === 3 && rows.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">3</span>
              Review — {rows.length} Students · {subjects.length} Subjects
            </h2>
            <div className="flex gap-2 flex-wrap text-xs font-black">
              <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100">
                ✓ {totalValid} marks ready
              </span>
              <span className="bg-slate-50 text-slate-500 px-3 py-1 rounded-full border border-slate-100">
                {rows.filter(r => !r.found).length} unmatched rows
              </span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-3 py-2.5 font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Roll</th>
                  <th className="text-left px-3 py-2.5 font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Name</th>
                  {subjects.map(s => (
                    <th key={s.id} className="text-center px-3 py-2.5 font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                      {s.subject_name}
                      <div className="text-[9px] text-slate-300 font-medium normal-case tracking-normal">/{s.total_marks}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((student, i) => (
                  <tr key={i} className={cn('border-b border-slate-50', !student.found && 'bg-red-50/40')}>
                    <td className="px-3 py-2.5 font-black text-indigo-600 whitespace-nowrap">#{student.roll_number}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={cn('font-bold', student.found ? 'text-slate-800' : 'text-red-500 line-through')}>
                        {student.student_name}
                      </span>
                      {!student.found && <span className="ml-1 text-[9px] text-red-400 font-bold">not found</span>}
                    </td>
                    {subjects.map(sub => {
                      const sm = student.subjects.find(s => s.subject_id === sub.id);
                      if (!sm) return <td key={sub.id} className="px-3 py-2.5 text-center text-slate-200">—</td>;
                      if (sm.error) return (
                        <td key={sub.id} className="px-3 py-2.5 text-center">
                          <span className="text-red-500 font-bold text-[10px]">{sm.error}</span>
                        </td>
                      );
                      if (sm.obtained === null) return (
                        <td key={sub.id} className="px-3 py-2.5 text-center text-slate-300 text-[10px] font-bold">absent</td>
                      );
                      return (
                        <td key={sub.id} className="px-3 py-2.5 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="font-black text-slate-800">{sm.obtained}</span>
                            <span className={cn('text-[9px] font-black px-1.5 py-0.5 rounded-full', GRADE_COLORS[sm.grade!] || '')}>
                              {sm.grade}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {saveError && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 text-sm font-bold">
              <AlertTriangle className="w-5 h-5 shrink-0" /> {saveError}
            </div>
          )}
          {saved && (
            <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-700 font-black text-sm">
              <CheckCircle2 className="w-5 h-5 shrink-0" /> {totalValid} marks saved successfully!
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button onClick={handleSave} disabled={saving || totalValid === 0 || saved}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition active:scale-95 disabled:opacity-50">
              {saving
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving…</>
                : <><Save className="w-4 h-4" /> Save {totalValid} Marks</>}
            </button>
            <button onClick={() => { setRows([]); setStep(2); setFileName(''); setSaved(false); setSaveError(''); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase transition">
              <RefreshCw className="w-4 h-4" /> Re-upload
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
