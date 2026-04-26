import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Star, Save, CheckCircle2, AlertTriangle, RefreshCw, BookOpen, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

const getGrade = (obtained: number, total: number, passing: number): string => {
  if (obtained < passing) return 'F';
  const pct = (obtained / total) * 100;
  if (pct >= 90) return 'A+'; if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';  if (pct >= 60) return 'C';
  if (pct >= 50) return 'D';  return 'F';
};
const GRADE_COLORS: Record<string, string> = {
  'A+': 'text-emerald-700 bg-emerald-50', 'A': 'text-green-700 bg-green-50',
  'B': 'text-blue-700 bg-blue-50',       'C': 'text-yellow-700 bg-yellow-50',
  'D': 'text-orange-700 bg-orange-50',   'F': 'text-red-700 bg-red-50',
};

export default function TeacherMarks() {
  const { userRole } = useAuth();
  const isTeacher = userRole?.role === 'teacher';
  const isAdmin   = ['admin', 'principal', 'director'].includes(userRole?.role || '');

  const [examTypes,  setExamTypes]  = useState<any[]>([]);
  const [classes,    setClasses]    = useState<any[]>([]);
  const [subjects,   setSubjects]   = useState<any[]>([]);
  const [students,   setStudents]   = useState<any[]>([]);

  const [selectedExam,    setSelectedExam]    = useState('');
  const [selectedClass,   setSelectedClass]   = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');

  const [marks,    setMarks]   = useState<Record<string, string>>({});
  const [saving,   setSaving]  = useState(false);
  const [saved,    setSaved]   = useState(false);
  const [error,    setError]   = useState('');
  const [loading,  setLoading] = useState(true);

  useEffect(() => { if (userRole?.school_id) init(); }, [userRole]);
  useEffect(() => {
    if (selectedClass) { fetchSubjects(); fetchStudents(); setSelectedSubject(''); setMarks({}); setSaved(false); }
  }, [selectedClass]);
  useEffect(() => {
    if (selectedExam && selectedClass && selectedSubject) loadExisting();
  }, [selectedExam, selectedClass, selectedSubject]);

  const init = async () => {
    setLoading(true);
    const [{ data: et }, { data: cls }] = await Promise.all([
      supabase.from('exam_types').select('*').eq('school_id', userRole!.school_id).order('name'),
      isTeacher
        ? supabase.from('classes').select('id,name,section').eq('school_id', userRole!.school_id).eq('class_teacher_id', userRole!.staff_id ?? '')
        : supabase.from('classes').select('id,name,section').eq('school_id', userRole!.school_id).order('name'),
    ]);
    setExamTypes(et || []);
    const clsList = cls || [];
    setClasses(clsList);
    // Auto-select class for teachers if only one
    if (isTeacher && clsList.length === 1) setSelectedClass(clsList[0].id);
    setLoading(false);
  };

  const fetchSubjects = async () => {
    const { data } = await supabase.from('subjects')
      .select('id,subject_name,total_marks,passing_marks')
      .eq('class_id', selectedClass).order('subject_name');
    setSubjects(data || []);
  };

  const fetchStudents = async () => {
    const { data } = await supabase.from('students')
      .select('id,full_name,roll_number,photograph_url')
      .eq('class_id', selectedClass).eq('status', 'active').order('roll_number');
    setStudents(data || []);
  };

  const loadExisting = async () => {
    const { data } = await supabase.from('results')
      .select('student_id,obtained_marks')
      .eq('exam_type_id', selectedExam)
      .eq('subject_id', selectedSubject)
      .eq('class_id', selectedClass);
    if (data) {
      const m: Record<string, string> = {};
      data.forEach((r: any) => { m[r.student_id] = String(r.obtained_marks); });
      setMarks(m);
    }
  };

  const handleSave = async () => {
    const sub = subjects.find(s => s.id === selectedSubject);
    if (!sub || !userRole?.school_id) return;
    setSaving(true); setError(''); setSaved(false);

    const inserts = students
      .filter(s => marks[s.id] !== undefined && marks[s.id] !== '')
      .map(s => ({
        school_id:      userRole!.school_id,
        student_id:     s.id,
        exam_type_id:   selectedExam,
        subject_id:     selectedSubject,
        class_id:       selectedClass,
        obtained_marks: Number(marks[s.id]),
        total_marks:    sub.total_marks,
        passing_marks:  sub.passing_marks,
        grade:          getGrade(Number(marks[s.id]), sub.total_marks, sub.passing_marks),
      }));

    const { error: err } = await supabase.from('results')
      .upsert(inserts, { onConflict: 'student_id,exam_type_id,subject_id' });

    if (err) setError(err.message);
    else setSaved(true);
    setSaving(false);
  };

  const selectedSub = subjects.find(s => s.id === selectedSubject);
  const filledCount = Object.values(marks).filter(v => v !== '').length;

  if (loading) return (
    <div className="flex items-center justify-center min-h-[300px]">
      <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  );

  if (isTeacher && classes.length === 0) return (
    <div className="text-center py-20">
      <BookOpen className="w-16 h-16 mx-auto text-slate-200 mb-4" />
      <h2 className="text-lg font-black text-slate-700">No Class Assigned</h2>
      <p className="text-slate-400 text-sm mt-2">You have not been assigned as class teacher to any class yet.</p>
      <p className="text-slate-400 text-sm">Ask your admin to assign you in Class &amp; Section Setup.</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight">
          <Star className="w-7 h-7 text-amber-500" /> Enter Marks
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {isTeacher ? 'Enter marks for your assigned class and subjects.' : 'Enter marks for any class and subject.'}
        </p>
      </div>

      {/* Selectors */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Exam */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Exam Type</label>
            <div className="relative">
              <select value={selectedExam} onChange={e => { setSelectedExam(e.target.value); setSaved(false); }}
                className="w-full appearance-none px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold pr-9 focus:ring-2 focus:ring-amber-400 outline-none transition">
                <option value="">— Select —</option>
                {examTypes.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Class — locked for teachers */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
              Class {isTeacher && <span className="text-amber-500">(your class)</span>}
            </label>
            <div className="relative">
              <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} disabled={isTeacher && classes.length === 1}
                className="w-full appearance-none px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold pr-9 focus:ring-2 focus:ring-amber-400 outline-none transition disabled:opacity-70 disabled:cursor-not-allowed">
                <option value="">— Select —</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Subject</label>
            <div className="relative">
              <select value={selectedSubject} onChange={e => { setSelectedSubject(e.target.value); setMarks({}); setSaved(false); }}
                disabled={!selectedClass}
                className="w-full appearance-none px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold pr-9 focus:ring-2 focus:ring-amber-400 outline-none transition disabled:opacity-50">
                <option value="">— Select —</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Info */}
          {selectedSub && (
            <div className="flex flex-col justify-center gap-1 p-3 bg-amber-50 border border-amber-100 rounded-xl">
              <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Marks Info</p>
              <p className="text-sm font-black text-amber-800">Total: {selectedSub.total_marks}</p>
              <p className="text-xs font-bold text-amber-600">Passing: {selectedSub.passing_marks}</p>
            </div>
          )}
        </div>
      </div>

      {/* Marks table */}
      {selectedExam && selectedClass && selectedSubject && students.length > 0 && selectedSub && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-black text-slate-900 text-sm uppercase tracking-wide">
                {subjects.find(s => s.id === selectedSubject)?.subject_name} Marks
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">{students.length} students · {filledCount} filled</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { const m: Record<string,string> = {}; students.forEach(s => { m[s.id] = '0'; }); setMarks(m); }}
                className="text-[11px] font-black text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition">
                Mark All 0
              </button>
              <button onClick={() => setMarks({})}
                className="text-[11px] font-black text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition">
                Clear All
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-12">Roll</th>
                  <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Student</th>
                  <th className="text-center px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-32">
                    Marks <span className="text-slate-300">/ {selectedSub.total_marks}</span>
                  </th>
                  <th className="text-center px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-20">Grade</th>
                  <th className="text-center px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-20">Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student, i) => {
                  const val  = marks[student.id] ?? '';
                  const num  = val === '' ? null : Number(val);
                  const grade = num !== null && !isNaN(num) ? getGrade(num, selectedSub.total_marks, selectedSub.passing_marks) : null;
                  const invalid = num !== null && (isNaN(num) || num < 0 || num > selectedSub.total_marks);
                  return (
                    <tr key={student.id} className={cn('border-b border-slate-50 hover:bg-slate-50/50 transition-colors', i % 2 === 0 ? '' : 'bg-slate-50/20')}>
                      <td className="px-4 py-2.5">
                        <span className="font-black text-indigo-600 text-sm">#{student.roll_number}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                            {student.photograph_url
                              ? <img src={student.photograph_url} alt="" className="w-full h-full object-cover" />
                              : <span className="text-slate-500 font-black text-xs">{student.full_name?.charAt(0)}</span>}
                          </div>
                          <span className="font-bold text-slate-800 text-sm">{student.full_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="number" min={0} max={selectedSub.total_marks}
                          value={val}
                          onChange={e => { setMarks(p => ({ ...p, [student.id]: e.target.value })); setSaved(false); }}
                          placeholder="—"
                          className={cn(
                            'w-full text-center font-black text-sm px-2 py-1.5 rounded-lg border transition focus:outline-none focus:ring-2 focus:ring-amber-400',
                            invalid ? 'border-red-300 bg-red-50 text-red-600' : 'border-slate-200 bg-white text-slate-900'
                          )}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {grade && !invalid && (
                          <span className={cn('text-xs font-black px-2.5 py-1 rounded-full', GRADE_COLORS[grade] || '')}>
                            {grade}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {val === '' ? (
                          <span className="text-[10px] text-slate-300 font-bold">pending</span>
                        ) : invalid ? (
                          <span className="text-[10px] text-red-500 font-bold">invalid</span>
                        ) : grade === 'F' ? (
                          <span className="text-[10px] text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded-full">Fail</span>
                        ) : (
                          <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">Pass</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex gap-3 text-xs font-black flex-wrap">
              <span className="text-emerald-600">{Object.values(marks).filter(v => v !== '' && !isNaN(Number(v)) && getGrade(Number(v), selectedSub.total_marks, selectedSub.passing_marks) !== 'F').length} pass</span>
              <span className="text-red-500">{Object.values(marks).filter(v => v !== '' && !isNaN(Number(v)) && getGrade(Number(v), selectedSub.total_marks, selectedSub.passing_marks) === 'F').length} fail</span>
              <span className="text-slate-400">{students.length - filledCount} pending</span>
            </div>
            <div className="flex gap-3 flex-wrap">
              {error && <p className="text-red-500 text-xs font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{error}</p>}
              {saved && <p className="text-emerald-600 text-xs font-bold flex items-center gap-1"><CheckCircle2 className="w-4 h-4" />Saved!</p>}
              <button onClick={handleSave} disabled={saving || filledCount === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition active:scale-95 disabled:opacity-50 shadow-lg shadow-amber-100">
                {saving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save {filledCount} Marks</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
