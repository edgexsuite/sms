import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import * as XLSX from 'xlsx';
import {
  Upload, Download, FileSpreadsheet, CheckCircle2, AlertTriangle,
  Save, RefreshCw, ChevronRight, X, Table2
} from 'lucide-react';
import { cn } from '../../lib/utils';

const getGrade = (obtained: number, total: number, passing: number): string => {
  if (obtained < passing) return 'F';
  const pct = (obtained / total) * 100;
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 50) return 'D';
  return 'F';
};

const GRADE_COLORS: Record<string, string> = {
  'A+': 'text-emerald-700 bg-emerald-50 border-emerald-200',
  'A':  'text-green-700 bg-green-50 border-green-200',
  'B':  'text-blue-700 bg-blue-50 border-blue-200',
  'C':  'text-yellow-700 bg-yellow-50 border-yellow-200',
  'D':  'text-orange-700 bg-orange-50 border-orange-200',
  'F':  'text-red-700 bg-red-50 border-red-200',
};

interface ParsedRow {
  roll_number: number;
  student_name: string;
  student_id: string | null;
  obtained_marks: number;
  valid: boolean;
  error?: string;
}

export default function ImportResult() {
  const { userRole } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [examTypes, setExamTypes] = useState<any[]>([]);
  const [classes, setClasses]     = useState<any[]>([]);
  const [subjects, setSubjects]   = useState<any[]>([]);
  const [students, setStudents]   = useState<any[]>([]);

  const [selectedExam,    setSelectedExam]    = useState('');
  const [selectedClass,   setSelectedClass]   = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [totalMarks,      setTotalMarks]      = useState(100);
  const [passingMarks,    setPassingMarks]    = useState(33);

  const [step,        setStep]        = useState<1|2|3>(1);
  const [parsedRows,  setParsedRows]  = useState<ParsedRow[]>([]);
  const [fileName,    setFileName]    = useState('');
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [saveError,   setSaveError]   = useState('');

  useEffect(() => { if (userRole?.school_id) fetchInit(); }, [userRole]);
  useEffect(() => { if (selectedClass) { fetchSubjects(); fetchStudents(); } }, [selectedClass]);

  const fetchInit = async () => {
    const [{ data: et }, { data: cls }] = await Promise.all([
      supabase.from('exam_types').select('*').eq('school_id', userRole!.school_id).order('name'),
      supabase.from('classes').select('id,name,section').eq('school_id', userRole!.school_id).order('name'),
    ]);
    setExamTypes(et || []);
    setClasses(cls || []);
  };

  const fetchSubjects = async () => {
    const { data } = await supabase.from('subjects').select('*').eq('class_id', selectedClass).order('subject_name');
    setSubjects(data || []);
  };

  const fetchStudents = async () => {
    const { data } = await supabase
      .from('students')
      .select('id, full_name, roll_number')
      .eq('class_id', selectedClass)
      .eq('status', 'active')
      .order('roll_number');
    setStudents(data || []);
  };

  /* ── Download sample Excel ─────────────────────────────────────── */
  const downloadSample = () => {
    const sampleData = [
      ['Roll Number', 'Student Name', 'Obtained Marks'],
      ...( students.length > 0
        ? students.slice(0, 5).map(s => [s.roll_number, s.full_name, ''])
        : [
            [1, 'Ahmed Raza Khan', 85],
            [2, 'Sara Imtiaz', 92],
            [3, 'Muhammad Ali', 67],
            [4, 'Fatima Noor', 78],
            [5, 'Usman Tariq', 55],
          ]
      ),
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(sampleData);

    // Column widths
    ws['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 18 }];

    XLSX.utils.book_append_sheet(wb, ws, 'Marks');

    // Instructions sheet
    const infoData = [
      ['INSTRUCTIONS FOR FILLING THIS SHEET'],
      [''],
      ['1. Do NOT change the column headers (Row 1)'],
      ['2. Roll Number must match the roll number in the system'],
      ['3. Obtained Marks must be a number (0 to Total Marks)'],
      ['4. Leave Obtained Marks blank for absent students'],
      [`5. Total Marks for this exam: ${totalMarks}`],
      [`6. Passing Marks: ${passingMarks}`],
      ['7. Save the file as .xlsx or .xls before uploading'],
    ];
    const wsInfo = XLSX.utils.aoa_to_sheet(infoData);
    wsInfo['!cols'] = [{ wch: 50 }];
    XLSX.utils.book_append_sheet(wb, wsInfo, 'Instructions');

    const cls = classes.find(c => c.id === selectedClass);
    const sub = subjects.find(s => s.id === selectedSubject);
    const exam = examTypes.find(e => e.id === selectedExam);
    const filename = `marks_${cls?.name || 'class'}_${sub?.subject_name || 'subject'}_${exam?.name || 'exam'}.xlsx`
      .replace(/\s+/g, '_').toLowerCase();

    XLSX.writeFile(wb, filename);
  };

  /* ── Parse uploaded Excel ─────────────────────────────────────── */
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setSaved(false);
    setSaveError('');

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        // Skip header row
        const dataRows = rows.slice(1).filter(r => r[0] !== '' && r[0] !== undefined);

        const parsed: ParsedRow[] = dataRows.map(row => {
          const roll = Number(row[0]);
          const name = String(row[1] || '').trim();
          const obtained = row[2] === '' || row[2] === undefined || row[2] === null ? null : Number(row[2]);

          const matchedStudent = students.find(s => s.roll_number === roll);

          if (!roll || isNaN(roll)) {
            return { roll_number: roll, student_name: name, student_id: null, obtained_marks: 0, valid: false, error: 'Invalid roll number' };
          }
          if (!matchedStudent) {
            return { roll_number: roll, student_name: name, student_id: null, obtained_marks: 0, valid: false, error: 'Roll not found in system' };
          }
          if (obtained === null) {
            return { roll_number: roll, student_name: matchedStudent.full_name, student_id: matchedStudent.id, obtained_marks: 0, valid: true, error: 'Absent (0 marks)' };
          }
          if (isNaN(obtained) || obtained < 0 || obtained > totalMarks) {
            return { roll_number: roll, student_name: matchedStudent.full_name, student_id: matchedStudent.id, obtained_marks: 0, valid: false, error: `Marks must be 0–${totalMarks}` };
          }

          return {
            roll_number: roll,
            student_name: matchedStudent.full_name,
            student_id: matchedStudent.id,
            obtained_marks: obtained,
            valid: true,
          };
        });

        setParsedRows(parsed);
        setStep(3);
      } catch (err) {
        alert('Failed to parse file. Please use the downloaded sample template.');
      }
    };
    reader.readAsArrayBuffer(file);
    // reset input so same file can be re-uploaded
    e.target.value = '';
  };

  /* ── Save to DB ──────────────────────────────────────────────── */
  const handleSave = async () => {
    if (!userRole?.school_id) return;
    setSaving(true);
    setSaveError('');

    const validRows = parsedRows.filter(r => r.valid && r.student_id);
    const inserts = validRows.map(r => ({
      school_id:      userRole!.school_id,
      student_id:     r.student_id,
      exam_type_id:   selectedExam,
      subject_id:     selectedSubject,
      class_id:       selectedClass,
      obtained_marks: r.obtained_marks,
      total_marks:    totalMarks,
      passing_marks:  passingMarks,
      grade:          getGrade(r.obtained_marks, totalMarks, passingMarks),
    }));

    const { error } = await supabase
      .from('results')
      .upsert(inserts, { onConflict: 'student_id,exam_type_id,subject_id' });

    if (error) {
      setSaveError(error.message);
    } else {
      setSaved(true);
    }
    setSaving(false);
  };

  const validCount   = parsedRows.filter(r => r.valid).length;
  const invalidCount = parsedRows.filter(r => !r.valid).length;
  const selectedCls  = classes.find(c => c.id === selectedClass);
  const selectedSub  = subjects.find(s => s.id === selectedSubject);
  const selectedExamType = examTypes.find(e => e.id === selectedExam);

  const step1Done = selectedExam && selectedClass && selectedSubject;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight">
          <FileSpreadsheet className="w-7 h-7 text-emerald-600" /> Import Results from Excel
        </h1>
        <p className="text-slate-500 text-sm mt-1">Upload a filled marks sheet to bulk-import results for an entire class.</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {['Select Exam & Class', 'Upload Sheet', 'Review & Save'].map((label, i) => {
          const num = i + 1;
          const active  = step === num;
          const done    = step > num || (num === 1 && !!step1Done);
          return (
            <React.Fragment key={label}>
              <div className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black transition-all',
                active ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200'
                  : done ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
              )}>
                <span className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0',
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

      {/* ── Step 1: Context ─────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">1</span>
          Select Exam, Class &amp; Subject
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Exam Type</label>
            <select value={selectedExam} onChange={e => setSelectedExam(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-400 outline-none transition">
              <option value="">— Select —</option>
              {examTypes.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Class</label>
            <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedSubject(''); setParsedRows([]); setStep(1); }}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-400 outline-none transition">
              <option value="">— Select —</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Subject</label>
            <select value={selectedSubject} onChange={e => { setSelectedSubject(e.target.value); setParsedRows([]); setStep(1); }}
              disabled={!selectedClass}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-400 outline-none transition disabled:opacity-50">
              <option value="">— Select —</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Total / Passing</label>
            <div className="flex gap-2">
              <input type="number" value={totalMarks} onChange={e => setTotalMarks(Number(e.target.value))} min={1} max={1000}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-400 outline-none"
                placeholder="Total" />
              <input type="number" value={passingMarks} onChange={e => setPassingMarks(Number(e.target.value))} min={0} max={totalMarks}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-400 outline-none"
                placeholder="Pass" />
            </div>
          </div>
        </div>
        {step1Done && (
          <button
            onClick={() => setStep(2)}
            className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition active:scale-95"
          >
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Step 2: Upload ─────────────────────────────────────── */}
      {step >= 2 && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">2</span>
            Download Template &amp; Upload Filled Sheet
          </h2>

          {/* Context summary */}
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Exam', value: selectedExamType?.name },
              { label: 'Class', value: `${selectedCls?.name} ${selectedCls?.section}` },
              { label: 'Subject', value: selectedSub?.subject_name },
              { label: 'Total Marks', value: totalMarks },
              { label: 'Passing', value: passingMarks },
            ].map(b => (
              <div key={b.label} className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{b.label}: </span>
                <span className="text-xs font-black text-slate-700">{b.value}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Download template */}
            <button
              onClick={downloadSample}
              className="flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed border-emerald-200 bg-emerald-50 rounded-2xl hover:border-emerald-400 hover:bg-emerald-100 transition group"
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200 group-hover:scale-110 transition-transform">
                <Download className="w-6 h-6 text-white" />
              </div>
              <div className="text-center">
                <p className="font-black text-emerald-700 text-sm">Download Template</p>
                <p className="text-[11px] text-emerald-600 mt-0.5">
                  {students.length > 0
                    ? `Pre-filled with ${students.length} student names & roll numbers`
                    : 'Sample Excel with instructions'}
                </p>
              </div>
            </button>

            {/* Upload filled sheet */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed border-slate-200 bg-slate-50 rounded-2xl hover:border-indigo-300 hover:bg-indigo-50 transition group"
            >
              <div className="w-12 h-12 rounded-xl bg-slate-700 flex items-center justify-center shadow-lg group-hover:bg-indigo-600 group-hover:scale-110 transition-all">
                <Upload className="w-6 h-6 text-white" />
              </div>
              <div className="text-center">
                <p className="font-black text-slate-700 text-sm group-hover:text-indigo-700 transition-colors">Upload Filled Sheet</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {fileName ? <span className="text-indigo-600 font-bold">{fileName}</span> : '.xlsx or .xls file'}
                </p>
              </div>
            </button>
          </div>

          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
        </div>
      )}

      {/* ── Step 3: Preview & Save ─────────────────────────────── */}
      {step === 3 && parsedRows.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">3</span>
              Review Imported Data
            </h2>
            <div className="flex gap-2 flex-wrap">
              <span className="text-xs font-black bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100">
                ✓ {validCount} valid
              </span>
              {invalidCount > 0 && (
                <span className="text-xs font-black bg-red-50 text-red-700 px-3 py-1 rounded-full border border-red-100">
                  ✗ {invalidCount} errors
                </span>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Roll #</th>
                  <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Name</th>
                  <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Obtained</th>
                  <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Grade</th>
                  <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody>
                {parsedRows.map((row, i) => {
                  const grade = row.valid ? getGrade(row.obtained_marks, totalMarks, passingMarks) : '—';
                  return (
                    <tr key={i} className={cn(
                      'border-b border-slate-50 transition-colors',
                      !row.valid ? 'bg-red-50/50' : i % 2 === 0 ? '' : 'bg-slate-50/40'
                    )}>
                      <td className="px-4 py-3 font-black text-indigo-600">#{row.roll_number}</td>
                      <td className="px-4 py-3 font-bold text-slate-800">{row.student_name}</td>
                      <td className="px-4 py-3">
                        <span className="font-black text-slate-900">{row.obtained_marks}</span>
                        <span className="text-slate-400 text-xs">/{totalMarks}</span>
                      </td>
                      <td className="px-4 py-3">
                        {row.valid && (
                          <span className={cn('text-xs font-black px-2 py-0.5 rounded-full border', GRADE_COLORS[grade] || '')}>
                            {grade}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.valid ? (
                          row.error ? (
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{row.error}</span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">✓ Ready</span>
                          )
                        ) : (
                          <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full flex items-center gap-1 w-fit">
                            <X className="w-3 h-3" /> {row.error}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Save / error */}
          {saveError && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 text-sm font-bold">
              <AlertTriangle className="w-5 h-5 shrink-0" /> {saveError}
            </div>
          )}
          {saved && (
            <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-700 text-sm font-black">
              <CheckCircle2 className="w-5 h-5 shrink-0" /> {validCount} results saved successfully!
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleSave}
              disabled={saving || validCount === 0 || saved}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition active:scale-95 disabled:opacity-50"
            >
              {saving
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving…</>
                : <><Save className="w-4 h-4" /> Save {validCount} Results</>
              }
            </button>
            <button
              onClick={() => { setParsedRows([]); setStep(2); setFileName(''); setSaved(false); setSaveError(''); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-widest transition"
            >
              <RefreshCw className="w-4 h-4" /> Re-upload
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
