import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import {
  BookOpen, Users, ClipboardList, CalendarCheck,
  ChevronRight, GraduationCap,
  CheckCircle2, XCircle, Clock, BarChart2,
  CalendarDays, Award, AlertCircle, Save,
  RefreshCw, ChevronDown, ChevronUp, UserCheck,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClassSummary {
  class_id: string;
  class_name: string;
  section: string;
  subjects: string[];
  student_count: number;
  today_present: number;
  today_absent: number;
  today_marked: boolean;
}

interface DiaryStatus {
  class_id: string;
  class_name: string;
  section: string;
  subject_name: string;
  last_entry_date: string | null;
}

interface ClassTeacher {
  id: string;
  name: string;
  section: string;
}

type AttStatus = 'present' | 'absent' | 'late' | 'leave';

interface AttStudent {
  id: string;
  full_name: string;
  roll_number: string;
  photograph_url?: string;
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<AttStatus, { label: string; short: string; bg: string; text: string; ring: string }> = {
  present: { label: 'Present', short: 'P', bg: 'bg-emerald-500',  text: 'text-white', ring: 'ring-emerald-400' },
  absent:  { label: 'Absent',  short: 'A', bg: 'bg-red-500',     text: 'text-white', ring: 'ring-red-400'     },
  late:    { label: 'Late',    short: 'L', bg: 'bg-amber-500',   text: 'text-white', ring: 'ring-amber-400'   },
  leave:   { label: 'Leave',   short: 'Lv', bg: 'bg-slate-400',  text: 'text-white', ring: 'ring-slate-300'   },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function TeacherDashboard() {
  const { userRole } = useAuth();
  const [staffId, setStaffId]       = useState<string | null>(null);
  const [staffName, setStaffName]   = useState('');
  const [loading, setLoading]       = useState(true);

  const [assignedClasses, setAssignedClasses] = useState<ClassSummary[]>([]);
  const [diaryStatus,     setDiaryStatus]     = useState<DiaryStatus[]>([]);
  const [recentResults,   setRecentResults]   = useState<any[]>([]);

  // Class-teacher info (a teacher can be class teacher of multiple classes)
  const [classTeacherClasses, setClassTeacherClasses] = useState<ClassTeacher[]>([]);

  // ── Attendance panel state ────────────────────────────────────────────────
  const [attOpen,       setAttOpen]       = useState(false);
  const [attClassId,    setAttClassId]    = useState('');
  const [attDate,       setAttDate]       = useState(new Date().toISOString().split('T')[0]);
  const [attStudents,   setAttStudents]   = useState<AttStudent[]>([]);
  const [attMarks,      setAttMarks]      = useState<Record<string, AttStatus>>({});
  const [attLoading,    setAttLoading]    = useState(false);
  const [savingAtt,     setSavingAtt]     = useState(false);
  const [attSaved,      setAttSaved]      = useState(false);
  const [attError,      setAttError]      = useState('');

  const today = new Date().toISOString().split('T')[0];

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!userRole?.school_id) return;
    resolveStaffId();
  }, [userRole]);

  const resolveStaffId = async () => {
    if (userRole?.staff_id) {
      setStaffId(userRole.staff_id);
      fetchStaffName(userRole.staff_id);
      return;
    }
    const { data } = await supabase
      .from('staff')
      .select('id, full_name')
      .eq('school_id', userRole?.school_id)
      .eq('email', userRole?.email || '')
      .maybeSingle();
    if (data) {
      setStaffId(data.id);
      setStaffName(data.full_name);
    }
    setLoading(false);
  };

  const fetchStaffName = async (sid: string) => {
    const { data } = await supabase.from('staff').select('full_name').eq('id', sid).maybeSingle();
    if (data) setStaffName(data.full_name);
  };

  useEffect(() => {
    if (staffId) loadDashboardData();
  }, [staffId]);

  const loadDashboardData = async () => {
    setLoading(true);
    await Promise.all([
      fetchAssignedClasses(),
      fetchDiaryStatus(),
      fetchRecentResults(),
      fetchClassTeacherClasses(),
    ]);
    setLoading(false);
  };

  // ── Dashboard data fetchers ───────────────────────────────────────────────

  const fetchAssignedClasses = async () => {
    const { data: slots } = await supabase
      .from('timetable_slots')
      .select('class_id, classes(name, section), subject_id, subjects(subject_name)')
      .eq('teacher_id', staffId)
      .eq('school_id', userRole?.school_id);

    if (!slots || slots.length === 0) return;

    const classMap = new Map<string, { name: string; section: string; subjects: Set<string> }>();
    slots.forEach((s: any) => {
      if (!classMap.has(s.class_id)) {
        classMap.set(s.class_id, { name: s.classes?.name || '?', section: s.classes?.section || '', subjects: new Set() });
      }
      if (s.subjects?.subject_name) classMap.get(s.class_id)!.subjects.add(s.subjects.subject_name);
    });

    const classIds = Array.from(classMap.keys());

    const { data: students } = await supabase
      .from('students')
      .select('id, class_id')
      .eq('school_id', userRole?.school_id)
      .eq('status', 'active')
      .in('class_id', classIds);

    const studentCountMap = new Map<string, number>();
    const stuClassMap     = new Map<string, string>();
    (students || []).forEach((s: any) => {
      studentCountMap.set(s.class_id, (studentCountMap.get(s.class_id) || 0) + 1);
      stuClassMap.set(s.id, s.class_id);
    });

    const studentIds = [...stuClassMap.keys()];
    const { data: attendance } = studentIds.length > 0
      ? await supabase.from('attendance').select('student_id, status').eq('school_id', userRole?.school_id).eq('date', today).in('student_id', studentIds)
      : { data: [] };

    const attMap = new Map<string, { present: number; absent: number; total: number }>();
    (attendance || []).forEach((a: any) => {
      const cid = stuClassMap.get(a.student_id);
      if (!cid) return;
      if (!attMap.has(cid)) attMap.set(cid, { present: 0, absent: 0, total: 0 });
      const e = attMap.get(cid)!;
      e.total++;
      if (a.status === 'present') e.present++;
      else if (a.status === 'absent') e.absent++;
    });

    const summaries: ClassSummary[] = Array.from(classMap.entries()).map(([cid, info]) => {
      const att   = attMap.get(cid);
      const total = studentCountMap.get(cid) || 0;
      return {
        class_id: cid, class_name: info.name, section: info.section,
        subjects: Array.from(info.subjects),
        student_count: total,
        today_present: att?.present || 0,
        today_absent:  att?.absent  || 0,
        today_marked:  (att?.total  || 0) > 0,
      };
    });
    summaries.sort((a, b) => `${a.class_name}${a.section}`.localeCompare(`${b.class_name}${b.section}`));
    setAssignedClasses(summaries);
  };

  const fetchDiaryStatus = async () => {
    const { data: slots } = await supabase
      .from('timetable_slots')
      .select('class_id, classes(name, section), subject_id, subjects(subject_name)')
      .eq('teacher_id', staffId)
      .eq('school_id', userRole?.school_id);
    if (!slots) return;

    const seen  = new Set<string>();
    const pairs: Array<{ class_id: string; class_name: string; section: string; subject_id: string; subject_name: string }> = [];
    slots.forEach((s: any) => {
      const key = `${s.class_id}__${s.subject_id}`;
      if (!seen.has(key)) {
        seen.add(key);
        pairs.push({ class_id: s.class_id, class_name: s.classes?.name || '?', section: s.classes?.section || '', subject_id: s.subject_id, subject_name: s.subjects?.subject_name || 'General' });
      }
    });

    const { data: diaries } = await supabase
      .from('teacher_diary')
      .select('class_id, subject_id, diary_date')
      .eq('teacher_id', staffId)
      .eq('school_id', userRole?.school_id)
      .order('diary_date', { ascending: false });

    const lastEntryMap = new Map<string, string>();
    (diaries || []).forEach((d: any) => {
      const key = `${d.class_id}__${d.subject_id}`;
      if (!lastEntryMap.has(key)) lastEntryMap.set(key, d.diary_date);
    });

    const statuses: DiaryStatus[] = pairs.map(p => ({
      class_id: p.class_id, class_name: p.class_name, section: p.section,
      subject_name: p.subject_name,
      last_entry_date: lastEntryMap.get(`${p.class_id}__${p.subject_id}`) || null,
    }));
    statuses.sort((a, b) => (a.last_entry_date || '0').localeCompare(b.last_entry_date || '0'));
    setDiaryStatus(statuses);
  };

  const fetchRecentResults = async () => {
    const { data: slots } = await supabase
      .from('timetable_slots').select('class_id').eq('teacher_id', staffId).eq('school_id', userRole?.school_id).limit(20);
    if (!slots || slots.length === 0) return;

    const classIds       = [...new Set(slots.map((s: any) => s.class_id))];
    const classStudentIds = (await supabase.from('students').select('id').in('class_id', classIds)).data?.map((s: any) => s.id) ?? [];

    const { data } = classStudentIds.length > 0
      ? await supabase.from('exam_results')
          .select('student_id, obtained_marks, total_marks, grade, students(full_name), subjects(subject_name)')
          .eq('school_id', userRole?.school_id)
          .in('student_id', classStudentIds)
          .order('created_at', { ascending: false })
          .limit(5)
      : { data: [] };
    if (data) setRecentResults(data);
  };

  const fetchClassTeacherClasses = async () => {
    const { data } = await supabase
      .from('classes')
      .select('id, name, section')
      .eq('school_id', userRole?.school_id)
      .eq('class_teacher_id', staffId);

    const classes = (data || []) as ClassTeacher[];
    setClassTeacherClasses(classes);
    // Auto-select first class for attendance panel
    if (classes.length > 0) setAttClassId(classes[0].id);
  };

  // ── Attendance panel logic ─────────────────────────────────────────────────

  const loadAttendance = useCallback(async (classId: string, date: string) => {
    if (!classId) return;
    setAttLoading(true);
    setAttSaved(false);
    setAttError('');

    // Fetch students
    const { data: stuData } = await supabase
      .from('students')
      .select('id, full_name, roll_number, photograph_url')
      .eq('class_id', classId)
      .eq('school_id', userRole?.school_id)
      .eq('status', 'active')
      .order('roll_number');
    const students = (stuData || []) as AttStudent[];
    setAttStudents(students);

    // Fetch existing attendance for this date
    if (students.length > 0) {
      const { data: existing } = await supabase
        .from('attendance')
        .select('student_id, status')
        .eq('school_id', userRole?.school_id)
        .eq('date', date)
        .in('student_id', students.map(s => s.id));

      const marks: Record<string, AttStatus> = {};
      // Pre-fill all as present by default only if no records exist yet
      const hasExisting = (existing || []).length > 0;
      students.forEach(s => {
        marks[s.id] = hasExisting ? 'present' : 'present'; // always default present
      });
      (existing || []).forEach((r: any) => {
        marks[r.student_id] = r.status as AttStatus;
      });
      setAttMarks(marks);
    } else {
      setAttMarks({});
    }

    setAttLoading(false);
  }, [userRole?.school_id]);

  // Load when panel opens or class/date changes
  useEffect(() => {
    if (attOpen && attClassId) loadAttendance(attClassId, attDate);
  }, [attOpen, attClassId, attDate, loadAttendance]);

  const markAll = (status: AttStatus) => {
    const m: Record<string, AttStatus> = {};
    attStudents.forEach(s => { m[s.id] = status; });
    setAttMarks(m);
    setAttSaved(false);
  };

  const handleSaveAttendance = async () => {
    if (!attClassId || attStudents.length === 0) return;
    setSavingAtt(true);
    setAttError('');
    setAttSaved(false);

    const rows = attStudents.map(s => ({
      school_id:  userRole!.school_id,
      student_id: s.id,
      date:       attDate,
      status:     attMarks[s.id] || 'present',
    }));

    const { error } = await supabase
      .from('attendance')
      .upsert(rows, { onConflict: 'student_id,date' });

    if (error) {
      setAttError(error.message);
    } else {
      setAttSaved(true);
      // Refresh dashboard stats
      fetchAssignedClasses();
    }
    setSavingAtt(false);
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const totalStudents   = assignedClasses.reduce((s, c) => s + c.student_count, 0);
  const totalPresent    = assignedClasses.reduce((s, c) => s + c.today_present, 0);
  const diaryFilledToday = diaryStatus.filter(d => d.last_entry_date === today).length;

  const classTeacherLabel = classTeacherClasses.length > 0
    ? classTeacherClasses.map(c => `${c.name} ${c.section}`).join(', ')
    : null;

  const attPresentCount = Object.values(attMarks).filter(v => v === 'present').length;
  const attAbsentCount  = Object.values(attMarks).filter(v => v === 'absent').length;
  const attLateCount    = Object.values(attMarks).filter(v => v === 'late').length;
  const attLeaveCount   = Object.values(attMarks).filter(v => v === 'leave').length;

  // ── Loading / error states ─────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center p-20">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-500 font-medium">Loading your dashboard…</p>
      </div>
    </div>
  );

  if (!staffId) return (
    <div className="max-w-2xl mx-auto mt-20 text-center p-8 bg-orange-50 border border-orange-200 rounded-2xl">
      <AlertCircle className="w-12 h-12 text-orange-400 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-orange-900">Staff Record Not Linked</h2>
      <p className="text-orange-700 mt-2 text-sm">
        Your login account hasn't been linked to a staff record yet.
        Ask your school administrator to link your account in Staff → User Accounts.
      </p>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* ── Welcome banner ── */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-2xl p-6 text-white shadow-xl shadow-indigo-200">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <p className="text-indigo-200 text-sm font-medium">Teacher Dashboard</p>
            <h1 className="text-2xl font-black mt-1">Welcome, {staffName || 'Teacher'}</h1>
            {classTeacherLabel && (
              <p className="text-indigo-200 text-sm mt-1">
                Class Teacher of <span className="text-white font-bold">{classTeacherLabel}</span>
              </p>
            )}
            <p className="text-indigo-200 text-xs mt-2">
              {new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Link to="/diary"
              className="flex items-center gap-2 bg-white text-indigo-700 font-bold px-4 py-2 rounded-xl text-sm hover:bg-indigo-50 transition shadow">
              <ClipboardList className="w-4 h-4" /> Open Diary
            </Link>
            {classTeacherClasses.length > 0 ? (
              <button
                onClick={() => setAttOpen(o => !o)}
                className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white font-bold px-4 py-2 rounded-xl text-sm transition"
              >
                <CalendarCheck className="w-4 h-4" /> Mark Attendance
              </button>
            ) : (
              <Link to="/attendance"
                className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white font-bold px-4 py-2 rounded-xl text-sm transition">
                <CalendarCheck className="w-4 h-4" /> Mark Attendance
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Quick stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Assigned Classes',    value: assignedClasses.length,               icon: BookOpen,     color: 'indigo'  },
          { label: 'Total Students',      value: totalStudents,                         icon: Users,        color: 'blue'    },
          { label: 'Present Today',       value: totalPresent,                          icon: CheckCircle2, color: 'emerald' },
          { label: 'Diary Filled Today',  value: `${diaryFilledToday}/${diaryStatus.length}`, icon: ClipboardList, color: 'amber' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className={`w-9 h-9 rounded-lg bg-${color}-100 flex items-center justify-center mb-3`}>
              <Icon className={`w-5 h-5 text-${color}-600`} />
            </div>
            <p className="text-2xl font-black text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 font-medium mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          INLINE ATTENDANCE PANEL — shown when class teacher opens it
      ══════════════════════════════════════════════════════════════════ */}
      {classTeacherClasses.length > 0 && (
        <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm overflow-hidden">
          {/* Panel header — always visible, acts as toggle */}
          <button
            onClick={() => setAttOpen(o => !o)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-indigo-50/50 transition"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                <UserCheck className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <p className="font-black text-gray-900 text-sm">Mark Attendance</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {classTeacherClasses.map(c => `${c.name} ${c.section}`).join(' · ')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!attOpen && (
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                  Click to mark
                </span>
              )}
              {attOpen
                ? <ChevronUp   className="w-5 h-5 text-gray-400" />
                : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </div>
          </button>

          {/* Panel body */}
          {attOpen && (
            <div className="border-t border-indigo-50">
              {/* Controls: class selector + date */}
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center gap-4">
                {classTeacherClasses.length > 1 && (
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Class</label>
                    <select
                      value={attClassId}
                      onChange={e => { setAttClassId(e.target.value); setAttSaved(false); }}
                      className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      {classTeacherClasses.map(c => (
                        <option key={c.id} value={c.id}>{c.name} {c.section}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Date</label>
                  <input
                    type="date"
                    value={attDate}
                    max={today}
                    onChange={e => { setAttDate(e.target.value); setAttSaved(false); }}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                {/* Quick mark buttons */}
                <div className="ml-auto flex flex-wrap gap-2">
                  {(['present', 'absent', 'late', 'leave'] as AttStatus[]).map(s => (
                    <button key={s} onClick={() => markAll(s)}
                      className={`px-3 py-2 rounded-xl text-xs font-black transition ${STATUS_CONFIG[s].bg} ${STATUS_CONFIG[s].text} hover:opacity-80`}>
                      All {STATUS_CONFIG[s].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Student list */}
              {attLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin" />
                </div>
              ) : attStudents.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  No active students found in this class.
                </div>
              ) : (
                <div className="divide-y divide-slate-50 max-h-[480px] overflow-y-auto">
                  {attStudents.map((student, i) => {
                    const status = attMarks[student.id] || 'present';
                    return (
                      <div key={student.id}
                        className={`flex items-center gap-3 px-6 py-3 transition-colors ${
                          status === 'absent' ? 'bg-red-50/40' :
                          status === 'late'   ? 'bg-amber-50/40' :
                          status === 'leave'  ? 'bg-slate-50/60' : ''
                        }`}
                      >
                        {/* Roll + photo */}
                        <span className="text-xs font-black text-indigo-500 w-8 shrink-0 text-center">
                          {student.roll_number}
                        </span>
                        <div className="w-8 h-8 rounded-lg bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                          {student.photograph_url
                            ? <img src={student.photograph_url} alt="" className="w-full h-full object-cover" />
                            : <span className="text-slate-500 font-black text-xs">{student.full_name.charAt(0)}</span>}
                        </div>

                        {/* Name */}
                        <span className="flex-1 text-sm font-bold text-slate-800 min-w-0 truncate">
                          {student.full_name}
                        </span>

                        {/* Status buttons */}
                        <div className="flex gap-1 shrink-0">
                          {(['present', 'absent', 'late', 'leave'] as AttStatus[]).map(s => {
                            const cfg     = STATUS_CONFIG[s];
                            const active  = status === s;
                            return (
                              <button
                                key={s}
                                onClick={() => { setAttMarks(p => ({ ...p, [student.id]: s })); setAttSaved(false); }}
                                className={`w-9 h-8 rounded-lg text-xs font-black transition-all ${
                                  active
                                    ? `${cfg.bg} ${cfg.text} ring-2 ${cfg.ring} shadow-sm`
                                    : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                }`}
                                title={cfg.label}
                              >
                                {cfg.short}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Footer: summary + save */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Counts */}
                <div className="flex gap-4 text-xs font-black flex-wrap">
                  <span className="text-emerald-600">{attPresentCount} present</span>
                  <span className="text-red-500">{attAbsentCount} absent</span>
                  {attLateCount  > 0 && <span className="text-amber-600">{attLateCount} late</span>}
                  {attLeaveCount > 0 && <span className="text-slate-500">{attLeaveCount} leave</span>}
                  <span className="text-slate-300">/ {attStudents.length} total</span>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {attError && (
                    <p className="text-red-500 text-xs font-bold flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {attError}
                    </p>
                  )}
                  {attSaved && (
                    <p className="text-emerald-600 text-xs font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Attendance saved!
                    </p>
                  )}
                  <button
                    onClick={handleSaveAttendance}
                    disabled={savingAtt || attStudents.length === 0}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-widest rounded-xl transition disabled:opacity-50 shadow-lg shadow-indigo-100"
                  >
                    {savingAtt
                      ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving…</>
                      : <><Save className="w-4 h-4" /> Save Attendance</>}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Main content grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Assigned Classes ── */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-black text-gray-900 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-indigo-600" /> My Classes
              </h2>
              <span className="text-xs text-gray-400 font-bold">{assignedClasses.length} classes</span>
            </div>
            {assignedClasses.length === 0 ? (
              <div className="p-10 text-center">
                <BookOpen className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No classes assigned in timetable yet.</p>
                <p className="text-gray-400 text-xs mt-1">Ask admin to assign you subjects in the Timetable module.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {assignedClasses.map(cls => (
                  <div key={cls.class_id} className="px-5 py-4 hover:bg-gray-50 transition">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-lg shadow-indigo-100">
                          {cls.class_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-sm">{cls.class_name} — {cls.section}</p>
                          <p className="text-xs text-indigo-600 font-medium mt-0.5">{cls.subjects.join(' · ')}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-gray-700">{cls.student_count} students</p>
                        {cls.today_marked ? (
                          <p className="text-xs text-emerald-600 font-bold mt-0.5">
                            {cls.today_present}P / {cls.today_absent}A today
                          </p>
                        ) : (
                          <p className="text-xs text-amber-600 font-medium mt-0.5 flex items-center gap-1 justify-end">
                            <Clock className="w-3 h-3" /> Not marked today
                          </p>
                        )}
                      </div>
                    </div>
                    {cls.today_marked && cls.student_count > 0 && (
                      <div className="mt-3">
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${Math.round((cls.today_present / cls.student_count) * 100)}%` }} />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1 font-medium">
                          {Math.round((cls.today_present / cls.student_count) * 100)}% attendance rate
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="space-y-5">

          {/* Diary status */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-black text-gray-900 text-sm flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-indigo-600" /> Diary Status
              </h2>
              <Link to="/diary" className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1">
                Open <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
              {diaryStatus.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-sm">No assignments yet.</div>
              ) : (
                diaryStatus.map((d, i) => {
                  const isToday   = d.last_entry_date === today;
                  const daysSince = d.last_entry_date
                    ? Math.floor((new Date(today).getTime() - new Date(d.last_entry_date).getTime()) / 86400000)
                    : null;
                  return (
                    <div key={i} className="px-4 py-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-gray-800">{d.class_name} {d.section}</p>
                        <p className="text-[10px] text-gray-400">{d.subject_name}</p>
                      </div>
                      {isToday ? (
                        <span className="text-[10px] font-black px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">Today ✓</span>
                      ) : daysSince !== null ? (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${daysSince <= 1 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                          {daysSince}d ago
                        </span>
                      ) : (
                        <span className="text-[10px] font-black px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">Never</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Recent results */}
          {recentResults.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-black text-gray-900 text-sm flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-500" /> Recent Results
                </h2>
              </div>
              <div className="divide-y divide-gray-100">
                {recentResults.map((r, i) => (
                  <div key={i} className="px-4 py-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-gray-800">{r.students?.full_name}</p>
                      <p className="text-[10px] text-gray-400">{r.subjects?.subject_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-indigo-700">{r.obtained_marks}/{r.total_marks}</p>
                      {r.grade && <span className="text-[10px] font-bold text-gray-500">{r.grade}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-5 text-white space-y-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-300">Quick Actions</h3>
            {[
              { to: '/diary',       icon: ClipboardList, label: "Fill Today's Diary"   },
              { to: '/attendance',  icon: CalendarCheck, label: 'Attendance (Full Page)' },
              { to: '/result/teacher-marks', icon: BarChart2, label: 'Enter Marks'     },
              { to: '/timetable',   icon: CalendarDays,  label: 'View Timetable'       },
            ].map(({ to, icon: Icon, label }) => (
              <Link key={to} to={to}
                className="flex items-center justify-between px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition">
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-slate-300" />
                  <span className="text-sm font-bold">{label}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </Link>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
