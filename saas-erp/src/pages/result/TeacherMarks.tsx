import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Star, Save, CheckCircle2, AlertTriangle, RefreshCw,
  BookOpen, ChevronDown, Info, CalendarDays,
} from 'lucide-react';
import { cn } from '../../lib/utils';

// ── Grade helpers ─────────────────────────────────────────────────────────────
const getGrade = (obtained: number, total: number, passing: number): string => {
  if (obtained < passing) return 'F';
  const pct = (obtained / total) * 100;
  if (pct >= 90) return 'A+'; if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';  if (pct >= 60) return 'C';
  if (pct >= 50) return 'D';  return 'F';
};
const GRADE_COLORS: Record<string, string> = {
  'A+': 'text-emerald-700 bg-emerald-50', 'A': 'text-green-700 bg-green-50',
  'B':  'text-blue-700 bg-blue-50',        'C': 'text-yellow-700 bg-yellow-50',
  'D':  'text-orange-700 bg-orange-50',    'F': 'text-red-700 bg-red-50',
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface ClassRow    { id: string; name: string; section: string }
interface SubjectRow  { id: string; subject_name: string; total_marks: number; passing_marks: number }
interface StudentRow  { id: string; full_name: string; roll_number: string; photograph_url?: string }

export default function TeacherMarks() {
  const { userRole } = useAuth();
  const isTeacher = ['teacher', 'staff'].includes(userRole?.role || '');
  const isAdmin   = ['admin', 'principal', 'director'].includes(userRole?.role || '');

  // ── Data ──────────────────────────────────────────────────────────────────
  const [allClasses,  setAllClasses]  = useState<ClassRow[]>([]);
  const [allSubjects, setAllSubjects] = useState<SubjectRow[]>([]);   // subjects for selected class
  const [students,    setStudents]    = useState<StudentRow[]>([]);
  const [examTypes,   setExamTypes]   = useState<any[]>([]);

  // Teacher assignment maps (only populated for teacher/staff roles)
  // assignedSubsByClass: classId → Set of subjectIds from timetable
  const [assignedSubsByClass, setAssignedSubsByClass] = useState<Map<string, Set<string>>>(new Map());
  const [assignedClassIds,    setAssignedClassIds]    = useState<Set<string>>(new Set());
  const [assignmentCount,     setAssignmentCount]     = useState(0); // total timetable slots found

  // ── Selections ────────────────────────────────────────────────────────────
  const [selectedExam,    setSelectedExam]    = useState('');
  const [selectedClass,   setSelectedClass]   = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');

  // ── Marks state ───────────────────────────────────────────────────────────
  const [marks,   setMarks]   = useState<Record<string, string>>({});
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(true);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => { if (userRole?.school_id) init(); }, [userRole]);

  useEffect(() => {
    if (selectedClass) {
      fetchSubjectsForClass();
      fetchStudentsForClass();
      setSelectedSubject('');
      setMarks({});
      setSaved(false);
    }
  }, [selectedClass]);

  useEffect(() => {
    if (selectedExam && selectedClass && selectedSubject) loadExisting();
  }, [selectedExam, selectedClass, selectedSubject]);

  const init = async () => {
    setLoading(true);
    const sid = userRole!.school_id;

    // Always fetch exam types
    const { data: et } = await supabase
      .from('exam_types')
      .select('id, name')
      .eq('school_id', sid)
      .order('name');
    setExamTypes(et || []);

    if (isAdmin) {
      // Admins see everything
      const { data: cls } = await supabase
        .from('classes')
        .select('id, name, section')
        .eq('school_id', sid)
        .order('name');
      setAllClasses(cls || []);
    } else {
      // Teachers/staff: build assignment map from timetable_slots
      const staffId = userRole!.staff_id;

      const [{ data: slots }, { data: classTeacherClasses }] = await Promise.all([
        // Timetable assignments (class + subject per slot)
        staffId
          ? supabase
              .from('timetable_slots')
              .select('class_id, subject_id')
              .eq('teacher_id', staffId)
              .eq('school_id', sid)
          : Promise.resolve({ data: [] }),
        // Class-teacher assignment (fallback)
        staffId
          ? supabase
              .from('classes')
              .select('id, name, section')
              .eq('school_id', sid)
              .eq('class_teacher_id', staffId)
          : Promise.resolve({ data: [] }),
      ]);

      // Build assignment maps from timetable
      const subsByClass = new Map<string, Set<string>>();
      const classSet    = new Set<string>();
      let   slotCount   = 0;

      for (const slot of (slots || []) as { class_id: string; subject_id: string | null }[]) {
        if (!slot.class_id) continue;
        classSet.add(slot.class_id);
        if (slot.subject_id) {
          if (!subsByClass.has(slot.class_id)) subsByClass.set(slot.class_id, new Set());
          subsByClass.get(slot.class_id)!.add(slot.subject_id);
          slotCount++;
        }
      }

      // Add class-teacher classes to the allowed set (even if no timetable slots)
      for (const c of (classTeacherClasses || []) as ClassRow[]) {
        classSet.add(c.id);
      }

      setAssignedSubsByClass(subsByClass);
      setAssignedClassIds(classSet);
      setAssignmentCount(slotCount);

      // Fetch full class details for the allowed class IDs
      if (classSet.size > 0) {
        const { data: cls } = await supabase
          .from('classes')
          .select('id, name, section')
          .eq('school_id', sid)
          .in('id', [...classSet])
          .order('name');
        setAllClasses(cls || []);
        // Auto-select if only one class
        if ((cls || []).length === 1) setSelectedClass(cls![0].id);
      } else {
        setAllClasses([]);
      }
    }

    setLoading(false);
  };

  const fetchSubjectsForClass = async () => {
    const { data } = await supabase
      .from('subjects')
      .select('id, subject_name, total_marks, passing_marks')
      .eq('class_id', selectedClass)
      .order('subject_name');
    setAllSubjects(data || []);
  };

  const fetchStudentsForClass = async () => {
    const { data } = await supabase
      .from('students')
      .select('id, full_name, roll_number, photograph_url')
      .eq('class_id', selectedClass)
      .eq('status', 'active')
      .order('roll_number');
    setStudents(data || []);
  };

  const loadExisting = async () => {
    setSaved(false);
    // Filter by exam_type_id + subject_id; then cross-match to current class's students
    const { data } = await supabase
      .from('exam_results')
      .select('student_id, obtained_marks')
      .eq('exam_type_id', selectedExam)
      .eq('subject_id', selectedSubject);
    if (data && data.length > 0) {
      // Only pre-fill for students actually in this class
      const studentIds = new Set(students.map(s => s.id));
      const m: Record<string, string> = {};
      data.forEach((r: any) => {
        if (studentIds.has(r.student_id)) m[r.student_id] = String(r.obtained_marks);
      });
      setMarks(m);
    } else {
      setMarks({});
    }
  };

  const handleSave = async () => {
    const sub = visibleSubjects.find(s => s.id === selectedSubject);
    if (!sub || !userRole?.school_id) return;
    setSaving(true); setError(''); setSaved(false);

    const filled = students.filter(s => marks[s.id] !== undefined && marks[s.id] !== '');
    if (filled.length === 0) { setSaving(false); return; }

    const inserts = filled.map(s => ({
      school_id:      userRole!.school_id,
      student_id:     s.id,
      exam_type_id:   selectedExam,
      subject_id:     selectedSubject,
      obtained_marks: Number(marks[s.id]),
      total_marks:    sub.total_marks,
      grade:          getGrade(Number(marks[s.id]), sub.total_marks, sub.passing_marks),
    }));

    const { error: err } = await supabase
      .from('exam_results')
      .upsert(inserts, { onConflict: 'exam_type_id,student_id,subject_id' });

    if (err) setError(err.message);
    else setSaved(true);
    setSaving(false);
  };

  // ── Derived: which subjects to show in the dropdown ───────────────────────
  const visibleSubjects: SubjectRow[] = (() => {
    if (isAdmin || !selectedClass) return allSubjects;
    const assigned = assignedSubsByClass.get(selectedClass);
    if (!assigned || assigned.size === 0) {
      // No timetable slots for this class — show all subjects (class-teacher fallback)
      return allSubjects;
    }
    return allSubjects.filter(s => assigned.has(s.id));
  })();

  const selectedSub  = visibleSubjects.find(s => s.id === selectedSubject);
  const filledCount  = Object.values(marks).filter(v => v !== '').length;

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center min-h-[300px]">
      <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  );

  // ── No assignments at all (teacher/staff only) ────────────────────────────
  if (isTeacher && allClasses.length === 0) return (
    <div className="max-w-2xl mx-auto text-center py-20 space-y-4">
      <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto">
        <BookOpen className="w-10 h-10 text-slate-300" />
      </div>
      <h2 className="text-xl font-black text-slate-700">No Classes Assigned</h2>
      <p className="text-slate-400 text-sm leading-relaxed max-w-md mx-auto">
        You have not been assigned to any classes or subjects yet.<br />
        Ask your admin to add you to the <strong>Timetable</strong> or set you as a <strong>Class Teacher</strong>.
      </p>
      <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-700 text-sm font-bold mt-2">
        <Info className="w-4 h-4 shrink-0" />
        Assignments are read from the school timetable.
      </div>
    </div>
  );

  // ── Main UI ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight">
          <Star className="w-7 h-7 text-amber-500" /> Enter Marks
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {isAdmin
            ? 'Enter marks for any class and subject.'
            : 'Enter marks for your assigned classes and subjects.'}
        </p>
      </div>

      {/* Teacher assignment summary banner */}
      {isTeacher && (
        <div className={cn(
          'flex items-center gap-3 rounded-2xl px-4 py-3 border text-sm font-bold',
          assignmentCount > 0
            ? 'bg-indigo-50 border-indigo-100 text-indigo-700'
            : 'bg-amber-50 border-amber-100 text-amber-700',
        )}>
          <CalendarDays className="w-4 h-4 shrink-0" />
          {assignmentCount > 0 ? (
            <span>
              You are assigned to{' '}
              <span className="text-indigo-900">{assignedClassIds.size} class{assignedClassIds.size !== 1 ? 'es' : ''}</span>
              {' '}with{' '}
              <span className="text-indigo-900">{assignmentCount} timetable slot{assignmentCount !== 1 ? 's' : ''}</span>.
            </span>
          ) : (
            <span>
              No timetable slots found — showing all subjects for your class(es).
              Ask admin to update the timetable for subject-specific access.
            </span>
          )}
        </div>
      )}

      {/* Selectors */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Exam Type */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
              Exam Type
            </label>
            <div className="relative">
              <select
                value={selectedExam}
                onChange={e => { setSelectedExam(e.target.value); setSaved(false); }}
                className="w-full appearance-none px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold pr-9 focus:ring-2 focus:ring-amber-400 outline-none transition"
              >
                <option value="">— Select —</option>
                {examTypes.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Class */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
              Class{isTeacher && <span className="text-amber-500 ml-1">(assigned)</span>}
            </label>
            <div className="relative">
              <select
                value={selectedClass}
                onChange={e => setSelectedClass(e.target.value)}
                disabled={isTeacher && allClasses.length === 1}
                className="w-full appearance-none px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold pr-9 focus:ring-2 focus:ring-amber-400 outline-none transition disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <option value="">— Select —</option>
                {allClasses.map(c => (
                  <option key={c.id} value={c.id}>{c.name} {c.section}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
              Subject{isTeacher && selectedClass && assignedSubsByClass.get(selectedClass)?.size
                ? <span className="text-amber-500 ml-1">(your subjects)</span>
                : null}
            </label>
            <div className="relative">
              <select
                value={selectedSubject}
                onChange={e => { setSelectedSubject(e.target.value); setMarks({}); setSaved(false); }}
                disabled={!selectedClass}
                className="w-full appearance-none px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold pr-9 focus:ring-2 focus:ring-amber-400 outline-none transition disabled:opacity-50"
              >
                <option value="">— Select —</option>
                {visibleSubjects.map(s => (
                  <option key={s.id} value={s.id}>{s.subject_name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            {/* Warn if teacher has no timetable subjects for this class */}
            {isTeacher && selectedClass && visibleSubjects.length === 0 && (
              <p className="text-[10px] text-amber-600 font-bold mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> No assigned subjects for this class
              </p>
            )}
          </div>

          {/* Marks info card */}
          {selectedSub ? (
            <div className="flex flex-col justify-center gap-1 p-3 bg-amber-50 border border-amber-100 rounded-xl">
              <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Marks Info</p>
              <p className="text-sm font-black text-amber-800">Total: {selectedSub.total_marks}</p>
              <p className="text-xs font-bold text-amber-600">Passing: {selectedSub.passing_marks}</p>
            </div>
          ) : (
            <div className="flex flex-col justify-center gap-1 p-3 bg-slate-50 border border-slate-100 rounded-xl opacity-40">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Marks Info</p>
              <p className="text-xs text-slate-400">Select subject</p>
            </div>
          )}
        </div>
      </div>

      {/* Marks table */}
      {selectedExam && selectedClass && selectedSubject && students.length > 0 && selectedSub && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Table header bar */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="font-black text-slate-900 text-sm uppercase tracking-wide">
                {selectedSub.subject_name} — Marks Entry
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {students.length} students · {filledCount} filled · {students.length - filledCount} pending
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const m: Record<string, string> = {};
                  students.forEach(s => { m[s.id] = '0'; });
                  setMarks(m); setSaved(false);
                }}
                className="text-[11px] font-black text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition"
              >
                Mark All 0
              </button>
              <button
                onClick={() => { setMarks({}); setSaved(false); }}
                className="text-[11px] font-black text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition"
              >
                Clear All
              </button>
            </div>
          </div>

          {/* Scrollable table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-12">Roll</th>
                  <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Student</th>
                  <th className="text-center px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-36">
                    Marks <span className="text-slate-300">/ {selectedSub.total_marks}</span>
                  </th>
                  <th className="text-center px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-20">Grade</th>
                  <th className="text-center px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-20">Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student, i) => {
                  const val     = marks[student.id] ?? '';
                  const num     = val === '' ? null : Number(val);
                  const grade   = num !== null && !isNaN(num) ? getGrade(num, selectedSub.total_marks, selectedSub.passing_marks) : null;
                  const invalid = num !== null && (isNaN(num) || num < 0 || num > selectedSub.total_marks);
                  return (
                    <tr
                      key={student.id}
                      className={cn(
                        'border-b border-slate-50 hover:bg-slate-50/50 transition-colors',
                        i % 2 !== 0 && 'bg-slate-50/20',
                      )}
                    >
                      {/* Roll */}
                      <td className="px-4 py-2.5">
                        <span className="font-black text-indigo-600 text-sm">#{student.roll_number}</span>
                      </td>
                      {/* Name + photo */}
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
                      {/* Marks input */}
                      <td className="px-4 py-2.5">
                        <input
                          type="number"
                          min={0}
                          max={selectedSub.total_marks}
                          value={val}
                          onChange={e => { setMarks(p => ({ ...p, [student.id]: e.target.value })); setSaved(false); }}
                          placeholder="—"
                          className={cn(
                            'w-full text-center font-black text-sm px-2 py-1.5 rounded-lg border transition focus:outline-none focus:ring-2 focus:ring-amber-400',
                            invalid
                              ? 'border-red-300 bg-red-50 text-red-600'
                              : 'border-slate-200 bg-white text-slate-900',
                          )}
                        />
                      </td>
                      {/* Grade badge */}
                      <td className="px-4 py-2.5 text-center">
                        {grade && !invalid && (
                          <span className={cn('text-xs font-black px-2.5 py-1 rounded-full', GRADE_COLORS[grade] || '')}>
                            {grade}
                          </span>
                        )}
                      </td>
                      {/* Status */}
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

          {/* Footer: stats + save */}
          <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex gap-4 text-xs font-black flex-wrap">
              <span className="text-emerald-600">
                {Object.values(marks).filter(v => {
                  const n = Number(v);
                  return v !== '' && !isNaN(n) && getGrade(n, selectedSub.total_marks, selectedSub.passing_marks) !== 'F';
                }).length} pass
              </span>
              <span className="text-red-500">
                {Object.values(marks).filter(v => {
                  const n = Number(v);
                  return v !== '' && !isNaN(n) && getGrade(n, selectedSub.total_marks, selectedSub.passing_marks) === 'F';
                }).length} fail
              </span>
              <span className="text-slate-400">{students.length - filledCount} pending</span>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {error && (
                <p className="text-red-500 text-xs font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />{error}
                </p>
              )}
              {saved && (
                <p className="text-emerald-600 text-xs font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Saved successfully!
                </p>
              )}
              <button
                onClick={handleSave}
                disabled={saving || filledCount === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition active:scale-95 disabled:opacity-50 shadow-lg shadow-amber-100"
              >
                {saving
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving…</>
                  : <><Save className="w-4 h-4" /> Save {filledCount} Marks</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state: class + subject selected but no students */}
      {selectedExam && selectedClass && selectedSubject && students.length === 0 && (
        <div className="text-center py-12 bg-white rounded-3xl border border-slate-200">
          <p className="text-slate-400 font-bold text-sm">No active students found in this class.</p>
        </div>
      )}
    </div>
  );
}
