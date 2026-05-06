import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Star, Save, CheckCircle2, AlertTriangle, RefreshCw,
  BookOpen, ChevronDown, Info, CalendarDays, PenLine, RotateCcw,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { fetchGradingPolicy, getGradeFromPolicy, GradingBracket } from '../../lib/gradingUtils';

// ── Grade helpers ─────────────────────────────────────────────────────────────
const GRADE_COLORS: Record<string, string> = {
  'A+': 'text-emerald-700 bg-emerald-50', 'A': 'text-green-700 bg-green-50',
  'B':  'text-blue-700 bg-blue-50',        'C': 'text-yellow-700 bg-yellow-50',
  'D':  'text-orange-700 bg-orange-50',    'F': 'text-red-700 bg-red-50',
};

const MONTH_NAMES = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec',
];

function monthYearLabel(my: string | null | undefined) {
  if (!my) return null;
  const [y, m] = my.split('-');
  const mIdx = parseInt(m, 10) - 1;
  if (isNaN(mIdx) || mIdx < 0 || mIdx > 11) return my;
  return `${MONTH_NAMES[mIdx]} ${y}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface ClassRow   { id: string; name: string; section: string }
interface SubjectRow { id: string; subject_name: string; total_marks: number; passing_marks: number }
interface StudentRow { id: string; full_name: string; roll_number: string; photograph_url?: string }
interface ExamType   { id: string; name: string; session: string; month_year: string | null; weightage: number }

export default function TeacherMarks() {
  const { userRole } = useAuth();
  const [searchParams] = useSearchParams();
  const isTeacher = ['teacher', 'staff'].includes(userRole?.role || '');
  const isAdmin   = ['admin', 'principal', 'director'].includes(userRole?.role || '');

  // Deep-link params from ResultStatus page
  const preClassId   = searchParams.get('classId')    || '';
  const preSubjectId = searchParams.get('subjectId')  || '';
  const preExamId    = searchParams.get('examTypeId') || '';

  // ── Data ──────────────────────────────────────────────────────────────────
  const [allClasses,  setAllClasses]  = useState<ClassRow[]>([]);
  const [allSubjects, setAllSubjects] = useState<SubjectRow[]>([]);
  const [students,    setStudents]    = useState<StudentRow[]>([]);
  const [examTypes,   setExamTypes]   = useState<ExamType[]>([]);

  // Teacher assignment maps
  const [assignedSubsByClass, setAssignedSubsByClass] = useState<Map<string, Set<string>>>(new Map());
  const [assignedClassIds,    setAssignedClassIds]    = useState<Set<string>>(new Set());
  const [assignmentCount,     setAssignmentCount]     = useState(0);

  // ── Selections ────────────────────────────────────────────────────────────
  const [selectedExam,    setSelectedExam]    = useState('');
  const [selectedClass,   setSelectedClass]   = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');

  const [marks,      setMarks]      = useState<Record<string, string>>({});
  const [absent,     setAbsent]     = useState<Record<string, boolean>>({});
  const [examConfig, setExamConfig] = useState<{ total_marks: number; passing_marks: number } | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [hasExisting, setHasExisting] = useState(false); // true = marks already saved in DB
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(true);
  const [gradingBrackets, setGradingBrackets] = useState<GradingBracket[]>([]);
  // Track which students were absent in DB so we can delete their record on revert
  const [prevAbsentIds, setPrevAbsentIds] = useState<Set<string>>(new Set());

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (userRole?.school_id) {
      init();
      fetchGradingPolicy(userRole.school_id).then(setGradingBrackets);
    }
  }, [userRole]);

  useEffect(() => {
    if (selectedClass) {
      fetchSubjectsForClass();
      setSelectedSubject('');
      resetData();
    }
  }, [selectedClass]);

  useEffect(() => {
    if (selectedExam && selectedClass && selectedSubject) {
      loadExisting();
    } else {
      resetData();
      if (selectedClass) fetchStudentsForClass();
    }
  }, [selectedExam, selectedClass, selectedSubject]);

  const resetData = () => {
    setMarks({});
    setAbsent({});
    setExamConfig(null);
    setSaved(false);
    setHasExisting(false);
    setError('');
    setPrevAbsentIds(new Set());
  };

  // ── Init: fetch classes + exams ───────────────────────────────────────────
  const init = async () => {
    setLoading(true);
    const sid = userRole!.school_id;

    const { data: et } = await supabase
      .from('exam_types')
      .select('id, name, session, month_year, weightage')
      .eq('school_id', sid)
      .order('created_at', { ascending: false });
    setExamTypes((et || []) as ExamType[]);

    if (isAdmin) {
      const { data: cls } = await supabase
        .from('classes')
        .select('id, name, section')
        .eq('school_id', sid)
        .order('name');
      setAllClasses(cls || []);
    } else {
      const staffId = userRole!.staff_id;

      const [{ data: slots }, { data: classTeacherClasses }] = await Promise.all([
        staffId
          ? supabase
              .from('timetable_slots')
              .select('class_id, subject_id')
              .eq('teacher_id', staffId)
              .eq('school_id', sid)
          : Promise.resolve({ data: [] }),
        staffId
          ? supabase
              .from('classes')
              .select('id, name, section')
              .eq('school_id', sid)
              .eq('class_teacher_id', staffId)
          : Promise.resolve({ data: [] }),
      ]);

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

      for (const c of (classTeacherClasses || []) as ClassRow[]) {
        classSet.add(c.id);
      }

      setAssignedSubsByClass(subsByClass);
      setAssignedClassIds(classSet);
      setAssignmentCount(slotCount);

      if (classSet.size > 0) {
        const { data: cls } = await supabase
          .from('classes')
          .select('id, name, section')
          .eq('school_id', sid)
          .in('id', [...classSet])
          .order('name');
        setAllClasses(cls || []);
        if ((cls || []).length === 1) setSelectedClass(cls![0].id);
      } else {
        setAllClasses([]);
      }
    }

    // Apply deep-link params from ResultStatus (if any)
    if (preExamId)    setSelectedExam(preExamId);
    if (preClassId)   setSelectedClass(preClassId);
    // subject is set after fetchSubjectsForClass runs (see useEffect below)

    setLoading(false);
  };

  const fetchSubjectsForClass = async () => {
    const { data } = await supabase
      .from('subjects')
      .select('id, subject_name, total_marks, passing_marks')
      .eq('class_id', selectedClass)
      .order('subject_name');
    setAllSubjects(data || []);
    // Apply deep-link subject param once subjects are loaded
    if (preSubjectId && (data || []).some(s => s.id === preSubjectId)) {
      setSelectedSubject(preSubjectId);
    }
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

  // ── Load existing marks for selected exam + class + subject ───────────────
  const loadExisting = async () => {
    resetData();
    try {
      const [cfgRes, resRes, stuRes] = await Promise.all([
        supabase
          .from('exam_subject_config')
          .select('total_marks, passing_marks')
          .eq('exam_type_id', selectedExam)
          .eq('subject_id', selectedSubject)
          .maybeSingle(),
        supabase
          .from('exam_results')
          .select('student_id, obtained_marks, is_absent')
          .eq('school_id', userRole!.school_id)
          .eq('exam_type_id', selectedExam)
          .eq('subject_id', selectedSubject)
          .eq('class_id', selectedClass),
        supabase
          .from('students')
          .select('id, full_name, roll_number, photograph_url')
          .eq('class_id', selectedClass)
          .eq('status', 'active')
          .order('roll_number'),
      ]);

      if (stuRes.data) setStudents(stuRes.data);
      if (cfgRes.data) setExamConfig(cfgRes.data);

      if (resRes.data && resRes.data.length > 0 && stuRes.data) {
        // Only show marks for students in THIS class
        const studentIds = new Set(stuRes.data.map(s => s.id));
        const m: Record<string, string> = {};
        const absMap: Record<string, boolean> = {};
        resRes.data.forEach((r: any) => {
          if (!studentIds.has(r.student_id)) return;
          // Detect absent by is_absent column
          if (r.is_absent) {
            absMap[r.student_id] = true;
          } else {
            m[r.student_id] = String(r.obtained_marks);
          }
        });
        if (Object.keys(absMap).length > 0) setAbsent(absMap);
        // Remember which students were absent in the DB so we can delete on revert
        setPrevAbsentIds(new Set(Object.keys(absMap)));
        if (Object.keys(m).length > 0 || Object.keys(absMap).length > 0) {
          setMarks(m);
          setHasExisting(true);
          setSaved(true);
        }
      }
    } catch (err: any) {
      console.error('loadExisting error:', err);
    }
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const sub = visibleSubjects.find(s => s.id === selectedSubject);
    if (!selectedExam) {
      setError('Please select an Exam before saving.');
      return;
    }
    if (!sub || !userRole?.school_id) return;
    setSaving(true); setError(''); setSaved(false);

    const totalMarks   = examConfig?.total_marks   || sub.total_marks;
    const passingMarks = examConfig?.passing_marks || sub.passing_marks;

    try {
      // ── Step 1: Delete records for students who were previously absent
      //    but have been un-toggled (reverted) and have no marks entered ───
      const revertedIds = students
        .filter(s =>
          prevAbsentIds.has(s.id) &&
          !absent[s.id] &&
          (marks[s.id] === undefined || marks[s.id] === '')
        )
        .map(s => s.id);

      if (revertedIds.length > 0) {
        const { error: delErr } = await supabase
          .from('exam_results')
          .delete()
          .eq('school_id', userRole!.school_id)
          .eq('exam_type_id', selectedExam)
          .eq('subject_id', selectedSubject)
          .in('student_id', revertedIds);
        if (delErr) throw delErr;
        // Remove from prevAbsentIds so a re-save doesn't attempt to delete again
        setPrevAbsentIds(prev => {
          const s = new Set(prev);
          revertedIds.forEach(id => s.delete(id));
          return s;
        });
      }

      // ── Step 2: Upsert students who have marks entered OR are still absent ─
      const toUpsert = students.filter(s =>
        (marks[s.id] !== undefined && marks[s.id] !== '') || absent[s.id]
      );

      if (toUpsert.length > 0) {
        const inserts = toUpsert.map(s => {
          const isAbsent = absent[s.id] ?? false;
          const obtained = isAbsent ? 0 : Number(marks[s.id]);
          return {
            school_id:      userRole!.school_id,
            student_id:     s.id,
            exam_type_id:   selectedExam,
            subject_id:     selectedSubject,
            class_id:       selectedClass,
            obtained_marks: obtained,
            total_marks:    totalMarks,
            grade:          isAbsent ? 'Ab' : getGradeFromPolicy(obtained, totalMarks, gradingBrackets).grade,
            is_absent:      isAbsent,
          };
        });

        const { error: upsertErr } = await supabase
          .from('exam_results')
          .upsert(inserts, { onConflict: 'exam_type_id,student_id,subject_id' });
        if (upsertErr) throw upsertErr;
      }

      const totalProcessed = revertedIds.length + toUpsert.length;
      if (totalProcessed === 0) { setSaving(false); return; }

      setSaved(true);
      setHasExisting(true);
    } catch (err: any) {
      setError(err.message);
    }
    setSaving(false);
  };


  // ── Derived: which subjects to show ──────────────────────────────────────
  const visibleSubjects: SubjectRow[] = (() => {
    if (isAdmin || !selectedClass) return allSubjects;
    const assigned = assignedSubsByClass.get(selectedClass);
    if (!assigned || assigned.size === 0) return allSubjects;
    return allSubjects.filter(s => assigned.has(s.id));
  })();

  // ── Grouped exam list for dropdown ────────────────────────────────────────
  // Group by name, sort each group by month_year desc
  const examGroups = examTypes.reduce<Record<string, ExamType[]>>((acc, et) => {
    if (!acc[et.name]) acc[et.name] = [];
    acc[et.name].push(et);
    return acc;
  }, {});
  (Object.values(examGroups) as ExamType[][]).forEach(arr =>
    arr.sort((a, b) => (b.month_year || '').localeCompare(a.month_year || '')),
  );

  const selectedSub  = visibleSubjects.find(s => s.id === selectedSubject);
  const selectedExamObj = examTypes.find(e => e.id === selectedExam);
  const filledCount = Object.values(marks).filter(v => v !== '').length + Object.values(absent).filter(Boolean).length;
  // Count how many absent records will be cleared on next save
  const revertedCount = students.filter(s =>
    prevAbsentIds.has(s.id) && !absent[s.id] && (marks[s.id] === undefined || marks[s.id] === '')
  ).length;

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center min-h-[300px]">
      <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  );

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

      {/* Teacher assignment banner */}
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
              Assigned to{' '}
              <span className="text-indigo-900">{assignedClassIds.size} class{assignedClassIds.size !== 1 ? 'es' : ''}</span>
              {' '}with{' '}
              <span className="text-indigo-900">{assignmentCount} timetable slot{assignmentCount !== 1 ? 's' : ''}</span>.
            </span>
          ) : (
            <span>No timetable slots found — showing all subjects. Ask admin to update the timetable.</span>
          )}
        </div>
      )}

      {/* Exam status banner — shown after exam + class + subject selected */}
      {selectedExam && selectedClass && selectedSubject && (
        hasExisting ? (
          <div className="flex items-start gap-3 rounded-2xl px-4 py-3 bg-amber-50 border border-amber-200 text-sm">
            <PenLine className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-black text-amber-800">Editing Existing Marks</p>
              <p className="text-amber-700 text-xs mt-0.5">
                This exam already has saved marks for this class. You are updating them.
                {selectedExamObj?.month_year &&
                  ` These are the ${monthYearLabel(selectedExamObj.month_year)} results.`}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-2xl px-4 py-3 bg-emerald-50 border border-emerald-200 text-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-black text-emerald-800">Fresh Exam — No Marks Yet</p>
              <p className="text-emerald-700 text-xs mt-0.5">
                No marks have been saved for this exam yet. Enter marks and click Save.
                {selectedExamObj?.month_year &&
                  ` This will be saved as the ${monthYearLabel(selectedExamObj.month_year)} result.`}
              </p>
            </div>
          </div>
        )
      )}

      {/* Selectors */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Exam selector — grouped by name */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
              Exam / Test
            </label>
            <div className="relative">
              <select
                value={selectedExam}
                onChange={e => { setSelectedExam(e.target.value); resetData(); }}
                className="w-full appearance-none px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold pr-9 focus:ring-2 focus:ring-amber-400 outline-none transition"
              >
                <option value="">— Select Exam —</option>
                {(Object.entries(examGroups) as [string, ExamType[]][]).map(([groupName, items]) =>
                  items.length === 1 && !items[0].month_year ? (
                    // Single instance, no month — show flat
                    <option key={items[0].id} value={items[0].id}>
                      {items[0].name}
                    </option>
                  ) : (
                    // Multiple instances or has month — show as optgroup
                    <optgroup key={groupName} label={groupName}>
                      {items.map(et => (
                        <option key={et.id} value={et.id}>
                          {et.month_year
                            ? `${monthYearLabel(et.month_year)}`
                            : et.name}
                          {et.session ? ` (${et.session})` : ''}
                        </option>
                      ))}
                    </optgroup>
                  )
                )}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            {/* Show selected exam label */}
            {selectedExamObj && (
              <p className="text-[10px] text-indigo-600 font-black mt-1 flex items-center gap-1">
                {selectedExamObj.month_year && (
                  <><CalendarDays className="w-3 h-3" />{monthYearLabel(selectedExamObj.month_year)}</>
                )}
              </p>
            )}
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
                onChange={e => { setSelectedSubject(e.target.value); setMarks({}); setSaved(false); setHasExisting(false); }}
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
            {isTeacher && selectedClass && visibleSubjects.length === 0 && (
              <p className="text-[10px] text-amber-600 font-bold mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> No assigned subjects for this class
              </p>
            )}
          </div>

          {/* Marks info */}
          {selectedSub ? (
            <div className="flex flex-col justify-center gap-1 p-3 bg-amber-50 border border-amber-100 rounded-xl">
              <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Marks Info</p>
              <p className="text-sm font-black text-amber-800">
                Total: {examConfig?.total_marks || selectedSub.total_marks}
              </p>
              <p className="text-xs font-bold text-amber-600">
                Passing: {examConfig?.passing_marks || selectedSub.passing_marks}
              </p>
              {examConfig && (
                <p className="text-[8px] font-black text-amber-400 uppercase italic">Custom for this exam</p>
              )}
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
                {selectedExamObj?.month_year && (
                  <span className="ml-2 text-indigo-600 normal-case font-bold text-xs">
                    ({monthYearLabel(selectedExamObj.month_year)})
                  </span>
                )}
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
                  setMarks(m); setAbsent({}); setSaved(false);
                }}
                className="text-[11px] font-black text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition"
              >
                Mark All 0
              </button>
              <button
                onClick={() => {
                  const a: Record<string, boolean> = {};
                  students.forEach(s => { a[s.id] = true; });
                  setAbsent(a); setMarks({}); setSaved(false);
                }}
                className="text-[11px] font-black text-orange-500 hover:text-orange-700 px-3 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 transition"
              >
                Mark All Absent
              </button>
              <button
                onClick={() => { setMarks({}); setAbsent({}); setSaved(false); }}
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
                    Marks <span className="text-slate-300">/ {examConfig?.total_marks || selectedSub.total_marks}</span>
                  </th>
                  <th className="text-center px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-16">Absent</th>
                  <th className="text-center px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-20">Grade</th>
                  <th className="text-center px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-20">Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student, i) => {
                  const val     = marks[student.id] ?? '';
                  const num     = val === '' ? null : Number(val);
                  const totalMarks = examConfig?.total_marks || selectedSub.total_marks;
                  const gradeRes = num !== null && !isNaN(num)
                    ? getGradeFromPolicy(num, totalMarks, gradingBrackets)
                    : null;
                  const grade   = gradeRes?.grade ?? null;
                  const invalid = num !== null && (isNaN(num) || num < 0 || num > totalMarks);

                  const isAbsent = absent[student.id] ?? false;
                  // Was saved as absent in DB, but teacher un-toggled and hasn't entered marks
                  const isReverted = prevAbsentIds.has(student.id) && !isAbsent && val === '';

                  return (
                    <tr
                      key={student.id}
                      className={cn(
                        'border-b border-slate-50 hover:bg-slate-50/50 transition-colors',
                        isAbsent    ? 'bg-orange-50/60' :
                        isReverted  ? 'bg-yellow-50/70' :
                        i % 2 !== 0 ? 'bg-slate-50/20' : '',
                      )}
                    >
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
                          type="text"
                          inputMode="numeric"
                          value={val}
                          disabled={isAbsent}
                          onChange={e => {
                            const raw = e.target.value.replace(/[^0-9.]/g, '');
                            const n   = parseFloat(raw);
                            if (raw !== '' && !isNaN(n) && n > totalMarks) return;
                            setMarks(p => ({ ...p, [student.id]: raw }));
                            setSaved(false);
                          }}
                          placeholder="—"
                          className={cn(
                            'w-full text-center font-black text-sm px-2 py-1.5 rounded-lg border transition focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-40 disabled:bg-slate-50',
                            invalid
                              ? 'border-red-300 bg-red-50 text-red-600'
                              : 'border-slate-200 bg-white text-slate-900',
                          )}
                        />
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <button
                          title={isAbsent ? 'Click to revert absent mark' : isReverted ? 'Mark absent again' : 'Mark as absent'}
                          onClick={() => {
                            setAbsent(p => {
                              const next = { ...p };
                              if (next[student.id]) delete next[student.id];
                              else next[student.id] = true;
                              return next;
                            });
                            if (!absent[student.id]) {
                              setMarks(p => { const n = { ...p }; delete n[student.id]; return n; });
                            }
                            setSaved(false);
                          }}
                          className={cn(
                            'flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-lg border transition',
                            isAbsent
                              ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                              : isReverted
                              ? 'bg-yellow-100 text-yellow-700 border-yellow-300 hover:bg-orange-50 hover:text-orange-600'
                              : 'bg-white text-orange-400 border-orange-200 hover:bg-orange-50'
                          )}
                        >
                          {isAbsent
                            ? <><RotateCcw className="w-3 h-3" /> Ab</>
                            : 'Ab'}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {isAbsent ? (
                          <span className="text-xs font-black px-2.5 py-1 rounded-full text-orange-700 bg-orange-100">
                            Ab
                          </span>
                        ) : grade && !invalid ? (
                          <span className={cn('text-xs font-black px-2.5 py-1 rounded-full', GRADE_COLORS[grade] || '')}>
                            {grade}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {isAbsent ? (
                          <span className="text-[10px] text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded-full">Absent</span>
                        ) : isReverted ? (
                          <span className="text-[10px] text-yellow-600 font-bold bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full" title="Absent record will be removed on Save">
                            ↩ Will clear
                          </span>
                        ) : val === '' ? (
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
                  const t = examConfig?.total_marks || selectedSub.total_marks;
                  return v !== '' && !isNaN(n) && getGradeFromPolicy(n, t, gradingBrackets).status === 'Pass';
                }).length} pass
              </span>
              <span className="text-red-500">
                {Object.values(marks).filter(v => {
                  const n = Number(v);
                  const t = examConfig?.total_marks || selectedSub.total_marks;
                  return v !== '' && !isNaN(n) && getGradeFromPolicy(n, t, gradingBrackets).status !== 'Pass';
                }).length} fail
              </span>
              <span className="text-orange-500">
                {Object.values(absent).filter(Boolean).length} absent
              </span>
              <span className="text-slate-400">{students.length - filledCount} pending</span>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {error && (
                <p className="text-red-500 text-xs font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />{error}
                </p>
              )}
              {saved && !error && (
                <p className="text-emerald-600 text-xs font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Saved successfully!
                </p>
              )}
              {revertedCount > 0 && !saving && (
                <p className="text-[10px] text-yellow-600 font-bold bg-yellow-50 border border-yellow-200 px-2.5 py-1.5 rounded-lg">
                  ↩ {revertedCount} absent mark{revertedCount !== 1 ? 's' : ''} will be removed
                </p>
              )}
              <button
                onClick={handleSave}
                disabled={saving || (filledCount === 0 && revertedCount === 0)}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition active:scale-95 disabled:opacity-50 shadow-lg shadow-amber-100"
              >
                {saving
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving…</>
                  : <><Save className="w-4 h-4" /> {hasExisting ? 'Update' : 'Save'}{filledCount > 0 ? ` ${filledCount}` : ''}{revertedCount > 0 ? ` · Clear ${revertedCount}` : ''}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {selectedExam && selectedClass && selectedSubject && students.length === 0 && (
        <div className="text-center py-12 bg-white rounded-3xl border border-slate-200">
          <p className="text-slate-400 font-bold text-sm">No active students found in this class.</p>
        </div>
      )}
    </div>
  );
}
