import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { cn, formatDate } from '../lib/utils';
import {
  BookOpen, Users, ClipboardList, CalendarCheck,
  ChevronRight, GraduationCap, CheckCircle2, XCircle,
  Clock, BarChart2, CalendarDays, Award, AlertCircle, Save,
  RefreshCw, ChevronDown, ChevronUp, UserCheck, CalendarOff,
  Plus, X, Briefcase, FileText, TrendingUp, MessageCircle, ChevronLeft, Flag, Send, Search,
  Star, Package, ShoppingCart, Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ChatInterface from '../components/ChatInterface';

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

// ── Constants ─────────────────────────────────────────────────────────────────

const LEAVE_TYPES = [
  'Casual Leave', 'Sick Leave', 'Annual Leave',
  'Emergency Leave', 'Hajj Leave', 'Maternity Leave',
  'Paternity Leave', 'Study Leave', 'Unpaid Leave',
];

const STATUS_CONFIG: Record<AttStatus, { label: string; short: string; bg: string; text: string; ring: string }> = {
  present: { label: 'Present', short: 'P',  bg: 'bg-emerald-500', text: 'text-white', ring: 'ring-emerald-400' },
  absent:  { label: 'Absent',  short: 'A',  bg: 'bg-red-500',     text: 'text-white', ring: 'ring-red-400'     },
  late:    { label: 'Late',    short: 'L',  bg: 'bg-amber-500',   text: 'text-white', ring: 'ring-amber-400'   },
  leave:   { label: 'Leave',   short: 'Lv', bg: 'bg-slate-400',   text: 'text-white', ring: 'ring-slate-300'   },
};

const LEAVE_STATUS_STYLES: Record<string, string> = {
  pending:  'bg-amber-100 text-amber-800 border-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ── Helpers ───────────────────────────────────────────────────────────────────

const calcLeaveDays = (from: string, to: string): number => {
  if (!from || !to) return 0;
  const d1 = new Date(from), d2 = new Date(to);
  return Math.max(1, Math.floor((d2.getTime() - d1.getTime()) / 86400000) + 1);
};

const formatTime = (t: string) => {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h);
  return `${hour % 12 || 12}:${m} ${hour < 12 ? 'AM' : 'PM'}`;
};

const isCurrentPeriod = (start: string, end: string): boolean => {
  if (!start || !end) return false;
  const now = new Date();
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin   = eh * 60 + em;
  const nowMin   = now.getHours() * 60 + now.getMinutes();
  return nowMin >= startMin && nowMin <= endMin;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function TeacherDashboard() {
  const { userRole, user } = useAuth();
  const attSectionRef = React.useRef<HTMLDivElement>(null);

  const [staffId,   setStaffId]   = useState<string | null>(null);
  const [staffName, setStaffName] = useState('');
  const [staffInfo, setStaffInfo] = useState<any>(null);   // photo, designation, dept
  const [schoolInfo,setSchoolInfo]= useState<any>(null);   // logo, name
  const [loading,   setLoading]   = useState(true);

  const [assignedClasses,    setAssignedClasses]    = useState<ClassSummary[]>([]);
  const [diaryStatus,        setDiaryStatus]        = useState<DiaryStatus[]>([]);
  const [recentResults,      setRecentResults]      = useState<any[]>([]);
  const [classTeacherClasses,setClassTeacherClasses]= useState<ClassTeacher[]>([]);
  const [todaySlots,         setTodaySlots]         = useState<any[]>([]);
  const [myLeaves,           setMyLeaves]           = useState<any[]>([]);

  // Attendance panel
  const [attOpen,    setAttOpen]    = useState(false);
  const [attClassId, setAttClassId] = useState('');
  const [attDate,    setAttDate]    = useState(new Date().toISOString().split('T')[0]);
  const [attStudents,setAttStudents]= useState<AttStudent[]>([]);
  const [attMarks,   setAttMarks]   = useState<Record<string, AttStatus>>({});
  const [attLoading, setAttLoading] = useState(false);
  const [savingAtt,  setSavingAtt]  = useState(false);
  const [attSaved,   setAttSaved]   = useState(false);
  const [attError,   setAttError]   = useState('');

  // Complaint modal
  const [showComplaintModal,  setShowComplaintModal]  = useState(false);
  const [submittingComplaint, setSubmittingComplaint] = useState(false);
  const [complaintSubmitted,  setComplaintSubmitted]  = useState(false);
  const [complaintForm, setComplaintForm] = useState({
    type:     'complaint' as 'complaint' | 'feedback' | 'suggestion' | 'query',
    category: '',
    title:    '',
    description: '',
    priority: 'normal' as 'low' | 'normal' | 'high' | 'urgent',
  });

  // Leave modal
  const [showLeaveModal,  setShowLeaveModal]  = useState(false);
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [leaveSubmitted,  setLeaveSubmitted]  = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    leave_type: 'Casual Leave',
    from_date:  new Date().toISOString().split('T')[0],
    to_date:    new Date().toISOString().split('T')[0],
    reason:     '',
    is_half_day:false,
    student_id: '',
  });

  // Chat Center
  const [chatOpen,    setChatOpen]    = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Student Leaves (for Class Teachers)
  const [studentLeaves, setStudentLeaves] = useState<any[]>([]);
  const [allStudents,   setAllStudents]   = useState<any[]>([]);
  const [isSelfLeave,   setIsSelfLeave]   = useState(true); // Toggle for leave modal

  // Evaluation
  const [recentEvals,       setRecentEvals]       = useState<any[]>([]);
  const [examTypes,         setExamTypes]         = useState<any[]>([]);
  const [showEvalModal,     setShowEvalModal]     = useState(false);
  const [savingEval,        setSavingEval]        = useState(false);
  const [evalSubmitted,     setEvalSubmitted]     = useState(false);
  const [evalStudentList,   setEvalStudentList]   = useState<any[]>([]);
  const [evalFormState, setEvalFormState] = useState({
    class_id: '', student_id: '', exam_type_id: '', feedback: '',
    ratings: {} as Record<string, number>,
    evaluation_date: new Date().toISOString().split('T')[0],
  });

  // Stationery
  const [stationeryRequests,   setStationeryRequests]   = useState<any[]>([]);
  const [showStationeryModal,  setShowStationeryModal]  = useState(false);
  const [savingStationery,     setSavingStationery]     = useState(false);
  const [stationerySubmitted,  setStationerySubmitted]  = useState(false);
  const [stationeryItems,      setStationeryItems]      = useState([{ name: '', qty: 1 }]);
  const [stationeryPurpose,    setStationeryPurpose]    = useState('');
  const [stationeryUrgency,    setStationeryUrgency]    = useState<'normal'|'urgent'>('normal');

  const today        = new Date().toISOString().split('T')[0];
  const todayDayName = DAY_NAMES[new Date().getDay()];

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!userRole?.school_id) return;
    // Fetch school info
    supabase.from('schools').select('name, logo_url').eq('id', userRole.school_id).maybeSingle()
      .then(({ data }) => setSchoolInfo(data));
    resolveStaffId();
  }, [userRole?.school_id]);

  const resolveStaffId = async () => {
    // Pre-fill name from Supabase Auth metadata immediately (avoids "Teacher" fallback)
    const metaName = user?.user_metadata?.full_name || user?.user_metadata?.name || '';
    if (metaName) setStaffName(metaName);

    let sid = userRole?.staff_id || null;
    if (!sid) {
      // Use user.email from Supabase Auth (userRole has no email field)
      const email = user?.email || '';
      if (email) {
        const { data } = await supabase.from('staff').select('id, full_name')
          .eq('school_id', userRole?.school_id).eq('email', email).maybeSingle();
        if (data) { sid = data.id; if (data.full_name) setStaffName(data.full_name); }
      }
    }
    if (sid) setStaffId(sid);
    else setLoading(false);
  };

  useEffect(() => {
    if (staffId) loadAll(staffId);
  }, [staffId]);

  const loadAll = async (sid: string) => {
    setLoading(true);
    await Promise.all([
      fetchStaffInfo(sid),
      fetchAssignedClasses(sid),
      fetchDiaryStatus(sid),
      fetchRecentResults(sid),
      fetchClassTeacherClasses(sid),
      fetchTodayTimetable(sid),
      fetchMyLeaves(sid),
      fetchStudentLeaves(sid),
      fetchAllClassStudents(sid),
      fetchRecentEvals(sid),
      fetchExamTypes(),
      fetchStationery(sid),
    ]);
    setLoading(false);
    fetchUnreadCount(sid);
  };

  const fetchUnreadCount = async (sid: string) => {
    const { count } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', sid)
      .eq('is_read', false);
    setUnreadCount(count || 0);
  };

  // ── Data Fetchers ─────────────────────────────────────────────────────────

  const fetchStaffInfo = async (sid: string) => {
    const { data } = await supabase.from('staff')
      .select('full_name, photograph_url')
      .eq('id', sid).maybeSingle();
    if (data) {
      setStaffInfo(data);
      if (data.full_name) setStaffName(data.full_name);
    }
  };

  const fetchTodayTimetable = async (sid: string) => {
    const { data } = await supabase
      .from('timetable_slots')
      .select('id, period_number, start_time, end_time, subjects(subject_name), classes(name, section)')
      .eq('teacher_id', sid)
      .eq('school_id', userRole?.school_id)
      .eq('day_of_week', todayDayName)
      .order('period_number');
    setTodaySlots(data || []);
  };

  const fetchMyLeaves = async (sid: string) => {
    const { data } = await supabase
      .from('leave_applications')
      .select('id, leave_type, from_date, to_date, total_days, status, reason, created_at')
      .eq('staff_id', sid)
      .eq('school_id', userRole?.school_id)
      .order('created_at', { ascending: false })
      .limit(8);
    setMyLeaves(data || []);
  };

  const fetchAssignedClasses = async (sid: string) => {
    const { data: slots } = await supabase
      .from('timetable_slots')
      .select('class_id, classes(name, section), subject_id, subjects(subject_name)')
      .eq('teacher_id', sid).eq('school_id', userRole?.school_id);

    if (!slots || slots.length === 0) return;

    const classMap = new Map<string, { name: string; section: string; subjects: Set<string> }>();
    slots.forEach((s: any) => {
      if (!classMap.has(s.class_id))
        classMap.set(s.class_id, { name: s.classes?.name || '?', section: s.classes?.section || '', subjects: new Set() });
      if (s.subjects?.subject_name) classMap.get(s.class_id)!.subjects.add(s.subjects.subject_name);
    });

    const classIds = Array.from(classMap.keys());
    const { data: students } = await supabase.from('students').select('id, class_id')
      .eq('school_id', userRole?.school_id).eq('status', 'active').eq('is_deleted', false).in('class_id', classIds);

    const countMap  = new Map<string, number>();
    const stuCidMap = new Map<string, string>();
    (students || []).forEach((s: any) => {
      countMap.set(s.class_id, (countMap.get(s.class_id) || 0) + 1);
      stuCidMap.set(s.id, s.class_id);
    });

    const stuIds = [...stuCidMap.keys()];
    const { data: att } = stuIds.length > 0
      ? await supabase.from('attendance').select('student_id, status')
          .eq('school_id', userRole?.school_id).eq('date', today).in('student_id', stuIds)
      : { data: [] };

    const attMap = new Map<string, { present: number; absent: number; total: number }>();
    (att || []).forEach((a: any) => {
      const cid = stuCidMap.get(a.student_id);
      if (!cid) return;
      if (!attMap.has(cid)) attMap.set(cid, { present: 0, absent: 0, total: 0 });
      const e = attMap.get(cid)!;
      e.total++;
      if (a.status === 'present') e.present++;
      else if (a.status === 'absent') e.absent++;
    });

    const summaries: ClassSummary[] = Array.from(classMap.entries()).map(([cid, info]) => {
      const a = attMap.get(cid);
      return {
        class_id: cid, class_name: info.name, section: info.section,
        subjects: Array.from(info.subjects),
        student_count: countMap.get(cid) || 0,
        today_present: a?.present || 0, today_absent: a?.absent || 0, today_marked: (a?.total || 0) > 0,
      };
    });
    summaries.sort((a, b) => `${a.class_name}${a.section}`.localeCompare(`${b.class_name}${b.section}`));
    setAssignedClasses(summaries);
  };

  const fetchDiaryStatus = async (sid: string) => {
    const { data: slots } = await supabase.from('timetable_slots')
      .select('class_id, classes(name, section), subject_id, subjects(subject_name)')
      .eq('teacher_id', sid).eq('school_id', userRole?.school_id);
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

    const { data: diaries } = await supabase.from('teacher_diary').select('class_id, subject_id, diary_date')
      .eq('teacher_id', sid).eq('school_id', userRole?.school_id).order('diary_date', { ascending: false });

    const lastMap = new Map<string, string>();
    (diaries || []).forEach((d: any) => {
      const key = `${d.class_id}__${d.subject_id}`;
      if (!lastMap.has(key)) lastMap.set(key, d.diary_date);
    });

    setDiaryStatus(pairs.map(p => ({
      class_id: p.class_id, class_name: p.class_name, section: p.section,
      subject_name: p.subject_name,
      last_entry_date: lastMap.get(`${p.class_id}__${p.subject_id}`) || null,
    })).sort((a, b) => (a.last_entry_date || '0').localeCompare(b.last_entry_date || '0')));
  };

  const fetchRecentResults = async (sid: string) => {
    const { data: slots } = await supabase.from('timetable_slots').select('class_id')
      .eq('teacher_id', sid).eq('school_id', userRole?.school_id).limit(20);
    if (!slots?.length) return;
    const classIds = [...new Set(slots.map((s: any) => s.class_id))];
    const stuIds   = ((await supabase.from('students').select('id').in('class_id', classIds)).data || []).map((s: any) => s.id);
    if (!stuIds.length) return;
    const { data } = await supabase.from('exam_results')
      .select('student_id, obtained_marks, total_marks, grade, students(full_name), subjects(subject_name)')
      .eq('school_id', userRole?.school_id).in('student_id', stuIds)
      .order('created_at', { ascending: false }).limit(5);
    if (data) setRecentResults(data);
  };

  const fetchClassTeacherClasses = async (sid: string) => {
    const { data } = await supabase.from('classes').select('id, name, section')
      .eq('school_id', userRole?.school_id).eq('class_teacher_id', sid);
    const classes = (data || []) as ClassTeacher[];
    setClassTeacherClasses(classes);
    if (classes.length > 0) setAttClassId(classes[0].id);
  };

  const fetchStudentLeaves = async (sid: string) => {
    // 1. Find classes where this staff is class teacher
    const { data: myClasses } = await supabase.from('classes').select('id')
      .eq('school_id', userRole?.school_id).eq('class_teacher_id', sid);
    const classIds = (myClasses || []).map(c => c.id);
    if (classIds.length === 0) return;

    // 2. Fetch student leaves for these classes
    const { data } = await supabase.from('leave_applications')
      .select('*, students!inner(full_name, roll_number, class_id, classes(name, section))')
      .eq('school_id', userRole?.school_id)
      .eq('applicant_type', 'student')
      .in('students.class_id', classIds)
      .order('created_at', { ascending: false });
    if (data) setStudentLeaves(data);
  };

  const fetchAllClassStudents = async (sid: string) => {
    const { data: slots } = await supabase.from('timetable_slots').select('class_id')
      .eq('teacher_id', sid).eq('school_id', userRole?.school_id);
    const classIds = [...new Set((slots || []).map(s => s.class_id))]; // unique class IDs
    // But better: just fetch students of assignedClasses
    const { data } = await supabase.from('students').select('id, full_name, roll_number, class_id, classes(name, section)')
      .eq('school_id', userRole?.school_id)
      .eq('status', 'active')
      .eq('is_deleted', false)
      .order('full_name');
    if (data) setAllStudents(data);
  };

  const fetchRecentEvals = async (sid: string) => {
    const { data } = await supabase.from('evaluations')
      .select('*, student:students(full_name, roll_number), exam_type:exam_types(name)')
      .eq('school_id', userRole?.school_id)
      .eq('target_type', 'student')
      .order('evaluation_date', { ascending: false })
      .limit(10);
    if (data) setRecentEvals(data);
  };

  const fetchExamTypes = async () => {
    const { data } = await supabase.from('exam_types')
      .select('id, name').eq('school_id', userRole?.school_id).order('created_at');
    if (data) setExamTypes(data);
  };

  const fetchStationery = async (sid: string) => {
    const { data } = await supabase.from('complaints')
      .select('*')
      .eq('school_id', userRole?.school_id)
      .eq('category', 'Stationery Request')
      .eq('user_id', userRole?.user_id || '')
      .order('created_at', { ascending: false })
      .limit(8);
    if (data) {
      const rows = data.map(r => ({
        ...r,
        priority: r.priority || 'normal'
      }));
      setStationeryRequests(rows);
    }
  };

  // ── Attendance panel ──────────────────────────────────────────────────────

  const loadAttendance = useCallback(async (classId: string, date: string) => {
    if (!classId) return;
    setAttLoading(true); setAttSaved(false); setAttError('');
    const { data: stuData } = await supabase.from('students')
      .select('id, full_name, roll_number, photograph_url')
      .eq('class_id', classId).eq('school_id', userRole?.school_id)
      .eq('status', 'active')
      .eq('is_deleted', false)
      .order('roll_number');
    const students = (stuData || []) as AttStudent[];
    setAttStudents(students);
    if (students.length > 0) {
      const { data: existing } = await supabase.from('attendance').select('student_id, status')
        .eq('school_id', userRole?.school_id).eq('date', date).in('student_id', students.map(s => s.id));
      const marks: Record<string, AttStatus> = {};
      students.forEach(s => { marks[s.id] = 'present'; });
      (existing || []).forEach((r: any) => { marks[r.student_id] = r.status as AttStatus; });
      setAttMarks(marks);
    } else setAttMarks({});
    setAttLoading(false);
  }, [userRole?.school_id]);

  useEffect(() => {
    if (attOpen && attClassId) loadAttendance(attClassId, attDate);
  }, [attOpen, attClassId, attDate, loadAttendance]);

  const markAll = (status: AttStatus) => {
    const m: Record<string, AttStatus> = {};
    attStudents.forEach(s => { m[s.id] = status; });
    setAttMarks(m); setAttSaved(false);
  };

  const handleSaveAttendance = async () => {
    if (!attClassId || attStudents.length === 0) return;
    setSavingAtt(true); setAttError(''); setAttSaved(false);
    const rows = attStudents.map(s => ({
      school_id: userRole!.school_id, student_id: s.id, date: attDate, status: attMarks[s.id] || 'present',
    }));
    const studentIds = rows.map(r => r.student_id);
    await supabase.from('attendance').delete()
      .eq('school_id', userRole!.school_id)
      .eq('date', attDate)
      .in('student_id', studentIds);
    const { error } = await supabase.from('attendance').insert(rows);
    if (error) setAttError(error.message);
    else { setAttSaved(true); fetchAssignedClasses(staffId!); }
    setSavingAtt(false);
  };

  // ── Complaint Submission ──────────────────────────────────────────────────

  const handleSubmitComplaint = async () => {
    if (!complaintForm.category || !complaintForm.title.trim() || !complaintForm.description.trim()) {
      alert('Please fill in all required fields.'); return;
    }
    setSubmittingComplaint(true);
    const authorName = staffInfo?.full_name || staffName || user?.user_metadata?.full_name || user?.email || 'Teacher';
    const { error } = await supabase.from('complaints').insert([{
      school_id:         userRole!.school_id,
      user_id:           userRole?.user_id || null,
      type:              complaintForm.type,
      category:          complaintForm.category,
      title:             complaintForm.title.trim(),
      description:       complaintForm.description.trim(),
      priority:          complaintForm.priority,
      status:            'pending',
      submitted_by_type: 'teacher',
      submitted_by_name: authorName,
      responses:         [],
    }]);
    setSubmittingComplaint(false);
    if (error) { alert('Failed: ' + error.message); return; }
    setShowComplaintModal(false);
    setComplaintForm({ type: 'complaint', category: '', title: '', description: '', priority: 'normal' });
    setComplaintSubmitted(true);
    setTimeout(() => setComplaintSubmitted(false), 4000);
  };

  // ── Leave Application ─────────────────────────────────────────────────────

  const handleSubmitLeave = async () => {
    if (!staffId) return;
    if (!isSelfLeave && !leaveForm.student_id) return alert('Please select a student.');
    if (leaveForm.to_date < leaveForm.from_date) return alert('End date cannot be before start date.');
    if (!leaveForm.reason.trim()) return alert('Please provide a reason for leave.');
    setSubmittingLeave(true);
    
    const payload: any = {
      school_id:      userRole!.school_id,
      applicant_type: isSelfLeave ? 'staff' : 'student',
      leave_type:     leaveForm.leave_type,
      from_date:      leaveForm.from_date,
      to_date:        leaveForm.to_date,
      is_half_day:    leaveForm.is_half_day,
      reason:         leaveForm.reason,
      status:         isSelfLeave ? 'pending' : 'approved', // Student leaves by teacher are auto-approved
    };

    if (isSelfLeave) payload.staff_id = staffId;
    else payload.student_id = leaveForm.student_id;

    const { error } = await supabase.from('leave_applications').insert([payload]);
    if (error) { alert(error.message); setSubmittingLeave(false); return; }
    
    // If student leave applied by teacher, sync with attendance
    if (!isSelfLeave) {
       await syncLeaveWithAttendance({ ...payload, student_id: leaveForm.student_id });
    }

    setSubmittingLeave(false);
    setShowLeaveModal(false);
    setLeaveSubmitted(true);
    setLeaveForm({ leave_type: 'Casual Leave', from_date: today, to_date: today, reason: '', is_half_day: false, student_id: '' });
    fetchMyLeaves(staffId);
    fetchStudentLeaves(staffId);
    setTimeout(() => setLeaveSubmitted(false), 4000);
  };

  const updateStudentLeaveStatus = async (id: string, status: string, leave: any) => {
    const { error } = await supabase.from('leave_applications')
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { alert(error.message); return; }
    
    if (status === 'approved') {
       await syncLeaveWithAttendance(leave);
    }
    fetchStudentLeaves(staffId!);
  };

  const syncLeaveWithAttendance = async (leave: any) => {
    const dates: string[] = [];
    let curr = new Date(leave.from_date);
    const end = new Date(leave.to_date);
    while (curr <= end) {
      dates.push(curr.toISOString().split('T')[0]);
      curr.setDate(curr.getDate() + 1);
    }
    const attRows = dates.map(d => ({
      school_id: userRole!.school_id,
      student_id: leave.student_id,
      date: d,
      status: 'leave' as AttStatus
    }));
    await supabase.from('attendance').delete()
      .eq('school_id', userRole!.school_id)
      .eq('student_id', leave.student_id)
      .in('date', dates);
    await supabase.from('attendance').insert(attRows);
  };

  // ── Evaluation handler ────────────────────────────────────────────────────

  const STUDENT_RATING_KEYS = ['Behavior', 'Punctuality', 'Participation', 'Academic Interest'];

  const handleSaveEval = async () => {
    if (!evalFormState.student_id) return alert('Please select a student.');
    if (Object.keys(evalFormState.ratings).length === 0) return alert('Please rate at least one category.');
    setSavingEval(true);
    const payload: any = {
      school_id: userRole!.school_id,
      target_type: 'student',
      student_id: evalFormState.student_id,
      ratings: evalFormState.ratings,
      feedback: evalFormState.feedback,
      evaluation_date: evalFormState.evaluation_date,
    };
    if (evalFormState.exam_type_id) payload.exam_type_id = evalFormState.exam_type_id;
    const { error } = await supabase.from('evaluations').insert([payload]);
    setSavingEval(false);
    if (error) { alert(error.message); return; }
    setShowEvalModal(false);
    setEvalFormState({ class_id: '', student_id: '', exam_type_id: '', feedback: '', ratings: {}, evaluation_date: today });
    setEvalSubmitted(true);
    fetchRecentEvals(staffId!);
    setTimeout(() => setEvalSubmitted(false), 4000);
  };

  const loadEvalStudents = async (classId: string) => {
    if (!classId) { setEvalStudentList([]); return; }
    const { data } = await supabase.from('students')
      .select('id, full_name, roll_number').eq('class_id', classId)
      .eq('school_id', userRole?.school_id).eq('status', 'active').eq('is_deleted', false).order('roll_number');
    setEvalStudentList(data || []);
  };

  // ── Stationery handler ────────────────────────────────────────────────────

  const handleSaveStationery = async () => {
    const valid = stationeryItems.filter(i => i.name.trim());
    if (!valid.length) return alert('Add at least one item.');
    if (!stationeryPurpose.trim()) return alert('Please state the purpose.');
    setSavingStationery(true);
    const description = `Items requested:\n${valid.map(i => `• ${i.name} × ${i.qty}`).join('\n')}\n\nPurpose: ${stationeryPurpose}`;
    const { error } = await supabase.from('complaints').insert([{
      school_id:         userRole!.school_id,
      user_id:           userRole?.user_id || null,
      type:              'query',
      category:          'Stationery Request',
      title:             `Stationery Request — ${new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}`,
      description,
      priority:          stationeryUrgency,
      status:            'pending',
      submitted_by_type: 'teacher',
      submitted_by_name: staffInfo?.full_name || staffName || 'Teacher',
      responses:         [],
    }]);
    setSavingStationery(false);
    if (error) { alert(error.message); return; }
    setShowStationeryModal(false);
    setStationeryItems([{ name: '', qty: 1 }]);
    setStationeryPurpose('');
    setStationerySubmitted(true);
    fetchStationery(staffId!);
    setTimeout(() => setStationerySubmitted(false), 4000);
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const totalStudents    = assignedClasses.reduce((s, c) => s + c.student_count, 0);
  const totalPresent     = assignedClasses.reduce((s, c) => s + c.today_present, 0);
  const diaryFilledToday = diaryStatus.filter(d => d.last_entry_date === today).length;
  const pendingLeaves    = myLeaves.filter(l => l.status === 'pending').length;

  const classTeacherLabel = classTeacherClasses.length > 0
    ? classTeacherClasses.map(c => `${c.name} ${c.section}`).join(', ') : null;

  const attPresentCount = Object.values(attMarks).filter(v => v === 'present').length;
  const attAbsentCount  = Object.values(attMarks).filter(v => v === 'absent').length;
  const attLateCount    = Object.values(attMarks).filter(v => v === 'late').length;
  const attLeaveCount   = Object.values(attMarks).filter(v => v === 'leave').length;

  const leaveDays = calcLeaveDays(leaveForm.from_date, leaveForm.to_date);

  // All classes this teacher can mark attendance for
  const attendanceClasses = classTeacherClasses.length > 0
    ? classTeacherClasses.map(c => ({ id: c.id, name: c.name, section: c.section }))
    : assignedClasses.map(c => ({ id: c.class_id, name: c.class_name, section: c.section }));

  // ── Loading / error states ────────────────────────────────────────────────

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
      <p className="text-orange-700 mt-2 text-sm">Your login account hasn't been linked to a staff record yet. Ask your school administrator to link your account in Staff → User Accounts.</p>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
    <div className="max-w-7xl mx-auto space-y-5">

      {/* ══════════════════════════════════════════════════════════════════
          PROFILE BANNER
      ══════════════════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-500 rounded-2xl p-6 text-white shadow-xl shadow-indigo-200 overflow-hidden relative">
        {/* Decorative rings */}
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="absolute -bottom-12 right-20 w-32 h-32 rounded-full bg-white/5" />

        <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
          {/* Left: Photo + Info */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl border-2 border-white/30 shadow-lg shrink-0 overflow-hidden bg-indigo-500 flex items-center justify-center">
              {staffInfo?.photograph_url
                ? <img src={staffInfo.photograph_url} alt="" className="w-full h-full object-cover" />
                : <span className="text-2xl font-black text-white">{staffName.charAt(0)}</span>
              }
            </div>
            <div>
              <p className="text-indigo-200 text-[10px] font-black uppercase tracking-[0.2em]">Teacher Portal</p>
              <h1 className="text-2xl font-black leading-tight">{staffName || 'Teacher'}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {staffInfo?.designation && (
                  <span className="text-indigo-200 text-xs font-medium">{staffInfo.designation}</span>
                )}
                {staffInfo?.department && (
                  <span className="text-[10px] bg-indigo-500/60 border border-indigo-400/40 px-2 py-0.5 rounded-full font-bold">
                    {staffInfo.department}
                  </span>
                )}
                {classTeacherLabel && (
                  <span className="text-[10px] bg-white/15 border border-white/20 px-2 py-0.5 rounded-full font-bold">
                    Class Teacher: {classTeacherLabel}
                  </span>
                )}
              </div>
              <p className="text-indigo-300 text-xs mt-1.5">
                {formatDate(new Date())}
              </p>
            </div>
          </div>

          {/* Right: School logo + Action buttons */}
          <div className="flex flex-col items-start md:items-end gap-3 shrink-0">
            {schoolInfo?.logo_url && (
              <img src={schoolInfo.logo_url} alt="School" className="h-10 object-contain opacity-80 hidden md:block" />
            )}
            <div className="flex flex-wrap gap-2">
              <Link to="/diary"
                className="flex items-center gap-2 bg-white text-indigo-700 font-bold px-4 py-2 rounded-xl text-xs hover:bg-indigo-50 transition shadow-md">
                <ClipboardList className="w-3.5 h-3.5" /> Open Diary
              </Link>
              <button
                onClick={() => setShowLeaveModal(true)}
                className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 border border-indigo-400 text-white font-bold px-4 py-2 rounded-xl text-xs transition">
                <CalendarOff className="w-3.5 h-3.5" /> Apply Leave
                {pendingLeaves > 0 && (
                  <span className="bg-amber-400 text-amber-900 text-[9px] font-black px-1.5 py-0.5 rounded-full">{pendingLeaves}</span>
                )}
              </button>
              <button
                onClick={() => setChatOpen(true)}
                className="flex items-center gap-2 bg-white text-indigo-700 font-bold px-4 py-2 rounded-xl text-xs hover:bg-indigo-50 transition shadow-md relative">
                <MessageCircle className="w-3.5 h-3.5" /> Messages
                {unreadCount > 0 && (
                  <span className="absolute -top-2 -right-2 flex h-5 w-5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex items-center justify-center rounded-full h-5 w-5 bg-gradient-to-tr from-indigo-600 to-violet-600 text-white text-[10px] font-black shadow-lg ring-2 ring-white">
                      {unreadCount}
                    </span>
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  setAttOpen(true);
                  setTimeout(() => {
                    attSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 100);
                }}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-4 py-2 rounded-xl text-xs transition shadow-md">
                <CalendarCheck className="w-3.5 h-3.5" /> Mark Attendance
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          DIARY ALERT BANNER
      ══════════════════════════════════════════════════════════════════ */}
      {diaryStatus.length > 0 && (
        <div className={cn(
          'rounded-xl border px-5 py-3 flex items-center justify-between gap-4',
          diaryFilledToday === diaryStatus.length
            ? 'bg-emerald-50 border-emerald-200'
            : diaryFilledToday > 0
              ? 'bg-amber-50 border-amber-300'
              : 'bg-red-50 border-red-200'
        )}>
          <div className="flex items-center gap-2.5">
            {diaryFilledToday === diaryStatus.length
              ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              : <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            }
            <div>
              {diaryFilledToday === diaryStatus.length ? (
                <p className="text-sm font-black text-emerald-800">All diary entries complete for today ✓</p>
              ) : (
                <p className="text-sm font-black text-amber-900">
                  {diaryStatus.length - diaryFilledToday} diary {diaryStatus.length - diaryFilledToday === 1 ? 'entry' : 'entries'} pending for today
                </p>
              )}
              <p className="text-[10px] text-gray-500 mt-0.5">{diaryFilledToday} of {diaryStatus.length} filled</p>
            </div>
          </div>
          <Link to="/diary"
            className="shrink-0 text-xs font-black px-4 py-2 bg-white border border-gray-200 rounded-xl text-indigo-600 hover:bg-indigo-50 transition shadow-sm">
            {diaryFilledToday === diaryStatus.length ? 'View Diary' : 'Fill Now →'}
          </Link>
        </div>
      )}

      {/* ── Quick Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Assigned Classes',   value: assignedClasses.length,                        icon: BookOpen,      color: 'indigo'  },
          { label: 'Total Students',     value: totalStudents,                                  icon: Users,         color: 'blue'    },
          { label: 'Present Today',      value: totalPresent,                                   icon: CheckCircle2,  color: 'emerald' },
          { label: 'Diary Today',        value: `${diaryFilledToday}/${diaryStatus.length}`,    icon: ClipboardList, color: 'amber'   },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className={`w-9 h-9 rounded-xl bg-${color}-100 flex items-center justify-center mb-3`}>
              <Icon className={`w-5 h-5 text-${color}-600`} />
            </div>
            <p className="text-2xl font-black text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 font-medium mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          TODAY'S TIMETABLE STRIP
      ══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-black text-gray-900 text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-600" />
            Today's Schedule
            <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">{todayDayName}</span>
          </h2>
          <Link to="/timetable" className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1">
            Full Timetable <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        {todaySlots.length === 0 ? (
          <div className="px-5 py-6 text-center text-sm text-gray-400">
            {todayDayName === 'Sunday' ? '🎉 Sunday — enjoy your day off!' : 'No classes scheduled for today.'}
          </div>
        ) : (
          <div className="flex gap-3 px-5 py-4 overflow-x-auto pb-4">
            {todaySlots.map(slot => {
              const active = isCurrentPeriod(slot.start_time, slot.end_time);
              return (
                <div key={slot.id} className={cn(
                  'shrink-0 rounded-xl border p-3 min-w-[130px] text-center transition-all',
                  active
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100 scale-105'
                    : 'bg-gray-50 border-gray-200 hover:border-indigo-200 hover:bg-indigo-50/50'
                )}>
                  <p className={cn('text-[9px] font-black uppercase tracking-widest', active ? 'text-indigo-200' : 'text-gray-400')}>
                    Period {slot.period_number}
                  </p>
                  <p className={cn('text-sm font-black mt-1 leading-tight', active ? 'text-white' : 'text-gray-800')}>
                    {(slot as any).subjects?.subject_name || '—'}
                  </p>
                  <p className={cn('text-[10px] mt-0.5', active ? 'text-indigo-200' : 'text-gray-500')}>
                    {(slot as any).classes?.name} {(slot as any).classes?.section}
                  </p>
                  <p className={cn('text-[10px] mt-1.5 font-bold', active ? 'text-indigo-200' : 'text-gray-400')}>
                    {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                  </p>
                  {active && (
                    <span className="inline-block mt-1.5 text-[9px] bg-white/20 text-white px-2 py-0.5 rounded-full font-black tracking-widest">
                      NOW
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          INLINE ATTENDANCE PANEL
      ══════════════════════════════════════════════════════════════════ */}
      {attendanceClasses.length > 0 && (
        <div ref={attSectionRef} className="bg-white rounded-2xl border border-indigo-100 shadow-sm overflow-hidden">
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
                  {attendanceClasses.map(c => `${c.name} ${c.section}`).join(' · ')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!attOpen && (
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">Click to mark</span>
              )}
              {attOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </div>
          </button>

          {attOpen && (
            <div className="border-t border-indigo-50 animate-in slide-in-from-top-2 duration-300">
              <div className="px-4 py-4 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex flex-1 gap-3 flex-wrap">
                  {attendanceClasses.length > 1 && (
                    <div className="flex-1 min-w-[140px]">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Target Class</label>
                      <select value={attClassId} onChange={e => { setAttClassId(e.target.value); setAttSaved(false); }}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none">
                        {attendanceClasses.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Roll Call Date</label>
                    <input type="date" value={attDate} max={today}
                      onChange={e => { setAttDate(e.target.value); setAttSaved(false); }}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                   <button onClick={() => markAll('present')} className="flex-1 md:flex-none text-[10px] font-black uppercase whitespace-nowrap bg-green-100 text-green-700 px-4 py-2 rounded-lg hover:bg-green-200 transition">All Present</button>
                   <button onClick={() => markAll('absent')} className="flex-1 md:flex-none text-[10px] font-black uppercase whitespace-nowrap bg-red-100 text-red-700 px-4 py-2 rounded-lg hover:bg-red-200 transition">All Absent</button>
                </div>
              </div>

              <div className="p-4 md:p-6 bg-white overflow-y-auto max-h-[600px]">
                {attLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Roster...</p>
                  </div>
                ) : attStudents.length === 0 ? (
                  <div className="text-center py-12">
                    <AlertCircle className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm font-medium">No active students found for this class.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {attStudents.map(student => {
                      const st = attMarks[student.id] || 'present';
                      return (
                        <div key={student.id} className={`flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-xl border transition-all duration-200 ${
                          st === 'present' ? 'bg-green-50 border-green-200' : 
                          st === 'absent' ? 'bg-red-50 border-red-200' : 
                          st === 'late' ? 'bg-yellow-50 border-yellow-200' : 
                          'bg-gray-50 border-gray-200'
                        }`}>
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-lg bg-white border border-indigo-100 flex items-center justify-center text-[10px] font-black text-indigo-600 shadow-sm shrink-0">
                              {student.roll_number}
                            </span>
                            <div>
                              <p className="font-bold text-xs sm:text-sm text-gray-900">{student.full_name}</p>
                              {st === 'absent' && <p className="text-[10px] text-red-600 font-bold flex items-center gap-1 mt-0.5"><AlertCircle className="w-3 h-3"/> Marked Absent</p>}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-4 md:flex md:flex-wrap gap-1.5 w-full md:w-auto shrink-0">
                            {(['present', 'absent', 'late', 'leave'] as AttStatus[]).map(s => {
                              const cfg = STATUS_CONFIG[s];
                              const active = st === s;
                              return (
                                <button key={s}
                                  onClick={() => { setAttMarks(p => ({ ...p, [student.id]: s })); setAttSaved(false); }}
                                  className={`flex justify-center items-center py-2 md:px-4 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all ${
                                    active 
                                      ? `${cfg.bg} text-white shadow-md scale-105` 
                                      : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100 shadow-sm'
                                  }`}
                                >
                                  <span className="md:hidden">{cfg.short}</span>
                                  <span className="hidden md:inline whitespace-nowrap">{cfg.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex gap-4 text-[10px] font-black uppercase tracking-wider flex-wrap">
                  <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">{attPresentCount} present</span>
                  <span className="text-red-600 bg-red-50 px-2 py-1 rounded-md border border-red-100">{attAbsentCount} absent</span>
                  {attLateCount > 0 && <span className="text-amber-600 bg-amber-50 px-2 py-1 rounded-md border border-amber-100">{attLateCount} late</span>}
                  <span className="text-slate-400 bg-white px-2 py-1 rounded-md border border-slate-200">Total: {attStudents.length}</span>
                </div>
                <div className="flex items-center gap-3 justify-end">
                  {attSaved && <p className="text-emerald-600 text-xs font-bold animate-bounce flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Attendance Logged!</p>}
                  <button onClick={handleSaveAttendance} disabled={savingAtt || attStudents.length === 0}
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-100 active:scale-95 disabled:opacity-50">
                    {savingAtt ? <><RefreshCw className="w-4 h-4 animate-spin" /> Syncing...</> : <><Save className="w-4 h-4" /> Save & Lock Register</>}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── My Classes (left 2/3) ── */}
        <div className="lg:col-span-2 space-y-5">

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-black text-gray-900 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-indigo-600" /> My Classes
              </h2>
              <span className="text-xs text-gray-400 font-bold">{assignedClasses.length} class{assignedClasses.length !== 1 ? 'es' : ''}</span>
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
                  <div key={cls.class_id} className="px-5 py-4 hover:bg-gray-50/70 transition">
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
                          <p className="text-xs text-emerald-600 font-bold mt-0.5">{cls.today_present}P / {cls.today_absent}A today</p>
                        ) : (
                          <p className="text-xs text-amber-600 font-medium mt-0.5 flex items-center gap-1 justify-end">
                            <Clock className="w-3 h-3" /> Not marked
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

                    {/* Quick action buttons */}
                    <div className="flex gap-2 mt-3">
                      <Link to={`/result/teacher-marks?classId=${cls.class_id}`}
                        className="flex items-center gap-1.5 text-[10px] font-black text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg transition">
                        <BarChart2 className="w-3 h-3" /> Enter Marks
                      </Link>
                      <Link to={`/diary?classId=${cls.class_id}`}
                        className="flex items-center gap-1.5 text-[10px] font-black text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg transition">
                        <ClipboardList className="w-3 h-3" /> Open Diary
                      </Link>
                      <Link to={`/students?classId=${cls.class_id}`}
                        className="flex items-center gap-1.5 text-[10px] font-black text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg transition">
                        <Users className="w-3 h-3" /> Students
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Results */}
          {recentResults.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-black text-gray-900 text-sm flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-500" /> Recent Results Entered
                </h2>
                <Link to="/result/teacher-marks" className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1">
                  Enter Marks <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="divide-y divide-gray-100">
                {recentResults.map((r, i) => {
                  const pct = r.total_marks > 0 ? Math.round((r.obtained_marks / r.total_marks) * 100) : 0;
                  return (
                    <div key={i} className="px-5 py-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-gray-800">{r.students?.full_name}</p>
                        <p className="text-[10px] text-gray-400">{r.subjects?.subject_name}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs font-black text-indigo-700">{r.obtained_marks}/{r.total_marks}</p>
                          <p className="text-[10px] text-gray-500">{pct}%</p>
                        </div>
                        {r.grade && (
                          <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-full',
                            pct >= 50 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                          )}>{r.grade}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {/* ── Evaluation Section ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-black text-gray-900 text-sm flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500" /> Student Evaluations
              </h2>
              <button onClick={() => setShowEvalModal(true)}
                className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg transition">
                <Plus className="w-3 h-3" /> Evaluate
              </button>
            </div>
            <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
              {recentEvals.length === 0 ? (
                <div className="p-6 text-center">
                  <Star className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No evaluations yet.</p>
                  <button onClick={() => setShowEvalModal(true)}
                    className="mt-2 text-xs text-amber-600 font-bold hover:underline">Evaluate a student →</button>
                </div>
              ) : recentEvals.map(ev => {
                const rVals = Object.values(ev.ratings || {}) as number[];
                const avg = rVals.length ? (rVals.reduce((a,b) => a + b, 0) / rVals.length).toFixed(1) : '—';
                return (
                  <div key={ev.id} className="px-4 py-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-800 truncate">{ev.student?.full_name}</p>
                      <p className="text-[10px] text-gray-400">Roll #{ev.student?.roll_number}
                        {ev.exam_type?.name ? ` · ${ev.exam_type.name}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {[1,2,3,4,5].map(i => (
                        <Star key={i} className={`w-3 h-3 ${i <= Math.round(Number(avg)) ? 'text-amber-400 fill-current' : 'text-gray-200'}`} />
                      ))}
                      <span className="text-[10px] font-black text-amber-600 ml-1">{avg}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {recentEvals.length > 0 && (
              <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 text-center">
                <Link to="/evaluation" className="text-[10px] font-black text-indigo-600 hover:underline">
                  View All in Evaluation Module →
                </Link>
              </div>
            )}
          </div>

        </div>

        {/* ── Right Column ── */}
        <div className="space-y-5">

          {/* Diary Status */}
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
                <div className="p-6 text-center text-gray-400 text-sm">No class assignments yet.</div>
              ) : diaryStatus.map((d, i) => {
                const isToday   = d.last_entry_date === today;
                const daysSince = d.last_entry_date
                  ? Math.floor((new Date(today).getTime() - new Date(d.last_entry_date).getTime()) / 86400000) : null;
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
              })}
            </div>
          </div>

          {/* My Leave Applications */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-black text-gray-900 text-sm flex items-center gap-2">
                <CalendarOff className="w-4 h-4 text-indigo-600" /> My Leave Applications
              </h2>
              <button onClick={() => setShowLeaveModal(true)}
                className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" /> Apply
              </button>
            </div>
            <div className="divide-y divide-gray-100 max-h-56 overflow-y-auto">
              {myLeaves.length === 0 ? (
                <div className="p-6 text-center">
                  <CalendarOff className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No leave applications yet.</p>
                  <button onClick={() => setShowLeaveModal(true)}
                    className="mt-2 text-xs text-indigo-600 font-bold hover:underline">Apply for leave →</button>
                </div>
              ) : myLeaves.map(l => (
                <div key={l.id} className="px-4 py-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-800 truncate">{l.leave_type}</p>
                    <p className="text-[10px] text-gray-400">{l.from_date} → {l.to_date} · {l.total_days} day{l.total_days !== 1 ? 's' : ''}</p>
                  </div>
                  <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-full border shrink-0', LEAVE_STATUS_STYLES[l.status] || 'bg-gray-100 text-gray-600 border-gray-200')}>
                    {l.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Student Leave Management (Class Teacher only) */}
          {classTeacherClasses.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-black text-gray-900 text-sm flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-600" /> Student Leave Requests
                </h2>
                {studentLeaves.filter(l => l.status === 'pending').length > 0 && (
                  <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                    {studentLeaves.filter(l => l.status === 'pending').length} New
                  </span>
                )}
              </div>
              <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                {studentLeaves.length === 0 ? (
                  <div className="p-6 text-center">
                    <UserCheck className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-400 font-medium">No student leave requests.</p>
                  </div>
                ) : studentLeaves.map(l => (
                  <div key={l.id} className="px-4 py-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-black text-gray-900 truncate">{l.students?.full_name}</p>
                        <p className="text-[10px] font-bold text-gray-400">Roll #{l.students?.roll_number} · {l.leave_type}</p>
                      </div>
                      <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-full border shrink-0', LEAVE_STATUS_STYLES[l.status] || 'bg-gray-100 text-gray-600 border-gray-200')}>
                        {l.status}
                      </span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5">
                       <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Duration & Reason</p>
                       <p className="text-[10px] font-bold text-gray-700">{l.from_date} → {l.to_date}</p>
                       <p className="text-[11px] text-gray-600 mt-1 italic">"{l.reason || 'No reason provided'}"</p>
                    </div>
                    {l.status === 'pending' && (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => updateStudentLeaveStatus(l.id, 'approved', l)}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase py-2 rounded-lg shadow-sm transition"
                        >
                          Approve
                        </button>
                        <button 
                          onClick={() => updateStudentLeaveStatus(l.id, 'rejected', l)}
                          className="flex-1 bg-white border border-gray-200 text-red-600 hover:bg-red-50 text-[10px] font-black uppercase py-2 rounded-lg transition"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Stationery Requests ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-black text-gray-900 text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-violet-600" /> Stationery Requests
              </h2>
              <button onClick={() => setShowStationeryModal(true)}
                className="flex items-center gap-1 text-xs font-bold text-violet-600 bg-violet-50 hover:bg-violet-100 border border-violet-200 px-3 py-1.5 rounded-lg transition">
                <Plus className="w-3 h-3" /> Request
              </button>
            </div>
            <div className="divide-y divide-gray-100 max-h-56 overflow-y-auto">
              {stationeryRequests.length === 0 ? (
                <div className="p-6 text-center">
                  <ShoppingCart className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No stationery requests yet.</p>
                  <button onClick={() => setShowStationeryModal(true)}
                    className="mt-2 text-xs text-violet-600 font-bold hover:underline">Request items →</button>
                </div>
              ) : stationeryRequests.map(r => {
                const statusStyle = r.status === 'resolved'
                  ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                  : r.status === 'rejected'
                    ? 'bg-red-100 text-red-700 border-red-200'
                    : 'bg-amber-100 text-amber-700 border-amber-200';
                return (
                  <div key={r.id} className="px-4 py-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-800 truncate">{r.title}</p>
                      <p className="text-[10px] text-gray-400">{new Date(r.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border shrink-0 capitalize ${statusStyle}`}>
                      {r.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-5 text-white space-y-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Quick Actions</h3>
            {/* Mark Attendance — opens inline panel on this page */}
            <button
              onClick={() => {
                setAttOpen(true);
                setTimeout(() => attSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
              }}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 rounded-xl transition border border-emerald-500/20">
              <div className="flex items-center gap-3">
                <CalendarCheck className="w-4 h-4 text-emerald-300" />
                <span className="text-sm font-bold text-emerald-200">Mark Attendance</span>
              </div>
              <ChevronRight className="w-4 h-4 text-emerald-400" />
            </button>
            {[
              { to: '/diary',                icon: ClipboardList, label: "Fill Today's Diary"   },
              { to: '/result/teacher-marks', icon: BarChart2,     label: 'Enter Marks'           },
              { to: '/timetable',            icon: CalendarDays,  label: 'View Timetable'        },
              { to: '/result/reporting',     icon: FileText,      label: 'Report Cards'          },
            ].map(({ to, icon: Icon, label }) => (
              <Link key={to} to={to}
                className="flex items-center justify-between px-4 py-2.5 bg-white/8 hover:bg-white/15 rounded-xl transition">
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-slate-300" />
                  <span className="text-sm font-bold">{label}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </Link>
            ))}
            <button onClick={() => setShowLeaveModal(true)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-white/8 hover:bg-white/15 rounded-xl transition mt-1">
              <div className="flex items-center gap-3">
                <CalendarOff className="w-4 h-4 text-slate-300" />
                <span className="text-sm font-bold">Apply for Leave</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </button>
            <button onClick={() => setShowComplaintModal(true)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-white/8 hover:bg-white/15 rounded-xl transition">
              <div className="flex items-center gap-3">
                <Flag className="w-4 h-4 text-slate-300" />
                <span className="text-sm font-bold">Report an Issue</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </button>
          </div>

        </div>
      </div>

    </div>{/* end max-w-7xl wrapper */}

    {/* ── All modals & toasts rendered via portal so fixed positioning is always viewport-relative ── */}
    {createPortal(
      <>
      {/* Toasts */}
      {leaveSubmitted && (
        <div className="fixed top-4 right-4 z-[9999] bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-bold text-sm">Leave application submitted! Admin will review it shortly.</span>
        </div>
      )}
      {complaintSubmitted && (
        <div className="fixed top-16 right-4 z-[9999] bg-indigo-600 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-in slide-in-from-top-2">
          <Flag className="w-5 h-5" />
          <span className="font-bold text-sm">Issue reported! Admin will review it shortly.</span>
        </div>
      )}

      {/* Eval + Stationery toasts */}
      {evalSubmitted && (
        <div className="fixed top-28 right-4 z-[9999] bg-amber-500 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-in slide-in-from-top-2">
          <Star className="w-5 h-5 fill-current" />
          <span className="font-bold text-sm">Evaluation saved successfully!</span>
        </div>
      )}
      {stationerySubmitted && (
        <div className="fixed top-28 right-4 z-[9999] bg-violet-600 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-in slide-in-from-top-2">
          <Package className="w-5 h-5" />
          <span className="font-bold text-sm">Stationery request submitted!</span>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          EVALUATION MODAL
      ══════════════════════════════════════════════════════════════════ */}
      {showEvalModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowEvalModal(false)} />
          <div className="bg-white rounded-3xl w-full max-w-lg relative z-10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="px-6 py-5 flex items-center justify-between bg-gradient-to-r from-amber-500 to-orange-500 text-white shrink-0">
              <div>
                <h2 className="font-black text-lg">Evaluate Student</h2>
                <p className="text-amber-100 text-xs mt-0.5">Rate behavior, punctuality & participation</p>
              </div>
              <button onClick={() => setShowEvalModal(false)} className="p-2 hover:bg-white/20 rounded-xl transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 overflow-y-auto bg-gray-50">
              {/* Class + Exam */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Class</label>
                  <select
                    value={evalFormState.class_id}
                    onChange={e => { setEvalFormState(f => ({ ...f, class_id: e.target.value, student_id: '' })); loadEvalStudents(e.target.value); }}
                    className="w-full bg-white border border-gray-200 px-3 py-2.5 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-amber-400/30">
                    <option value="">-- Select Class --</option>
                    {assignedClasses.map(c => <option key={c.class_id} value={c.class_id}>{c.class_name} {c.section}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Link to Exam</label>
                  <select
                    value={evalFormState.exam_type_id}
                    onChange={e => setEvalFormState(f => ({ ...f, exam_type_id: e.target.value }))}
                    className="w-full bg-white border border-gray-200 px-3 py-2.5 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-amber-400/30">
                    <option value="">-- No Exam --</option>
                    {examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Student */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Student <span className="text-red-500">*</span></label>
                <select
                  value={evalFormState.student_id}
                  onChange={e => setEvalFormState(f => ({ ...f, student_id: e.target.value }))}
                  className="w-full bg-white border border-gray-200 px-3 py-2.5 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-amber-400/30">
                  <option value="">-- Select Student --</option>
                  {evalStudentList.map(s => <option key={s.id} value={s.id}>{s.roll_number} — {s.full_name}</option>)}
                </select>
              </div>

              {/* Star Ratings */}
              <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Rating Matrix (tap stars)</p>
                {STUDENT_RATING_KEYS.map(key => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-700 w-36 shrink-0">{key}</span>
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map(star => (
                        <button key={star} type="button"
                          onClick={() => setEvalFormState(f => ({ ...f, ratings: { ...f.ratings, [key]: star } }))}
                          className={`w-8 h-8 rounded-lg transition-all ${star <= (evalFormState.ratings[key] || 0) ? 'text-amber-400 bg-amber-50' : 'text-gray-200 hover:text-amber-200 bg-gray-50'}`}>
                          <Star className={`w-5 h-5 mx-auto ${star <= (evalFormState.ratings[key] || 0) ? 'fill-current' : ''}`} />
                        </button>
                      ))}
                    </div>
                    <span className="text-xs font-black text-gray-400 w-8 text-right">{evalFormState.ratings[key] || 0}/5</span>
                  </div>
                ))}
              </div>

              {/* Feedback */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Teacher Remarks</label>
                <textarea rows={2}
                  value={evalFormState.feedback}
                  onChange={e => setEvalFormState(f => ({ ...f, feedback: e.target.value }))}
                  placeholder="Optional written remarks..."
                  className="w-full bg-white border border-gray-200 px-3 py-2.5 rounded-xl text-sm font-medium resize-none outline-none focus:ring-2 focus:ring-amber-400/30" />
              </div>

              {/* Date */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Evaluation Date</label>
                <input type="date" value={evalFormState.evaluation_date}
                  onChange={e => setEvalFormState(f => ({ ...f, evaluation_date: e.target.value }))}
                  className="w-full bg-white border border-gray-200 px-3 py-2.5 rounded-xl text-sm font-bold" />
              </div>
            </div>

            <div className="px-6 py-4 bg-white border-t border-gray-100 flex gap-3 shrink-0">
              <button onClick={() => setShowEvalModal(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition text-sm">Cancel</button>
              <button onClick={handleSaveEval} disabled={savingEval}
                className="flex-[2] py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl shadow-lg shadow-amber-100 transition flex items-center justify-center gap-2 text-sm">
                {savingEval ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />}
                {savingEval ? 'Saving...' : 'Save Evaluation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          STATIONERY REQUEST MODAL
      ══════════════════════════════════════════════════════════════════ */}
      {showStationeryModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowStationeryModal(false)} />
          <div className="bg-white rounded-3xl w-full max-w-lg relative z-10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="px-6 py-5 flex items-center justify-between bg-gradient-to-r from-violet-600 to-purple-600 text-white shrink-0">
              <div>
                <h2 className="font-black text-lg">Request Stationery</h2>
                <p className="text-violet-100 text-xs mt-0.5">Admin will review and approve your request</p>
              </div>
              <button onClick={() => setShowStationeryModal(false)} className="p-2 hover:bg-white/20 rounded-xl transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 overflow-y-auto bg-gray-50">
              {/* Items list */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Items Needed</label>
                  <button type="button" onClick={() => setStationeryItems(items => [...items, { name: '', qty: 1 }])}
                    className="text-[10px] font-black text-violet-600 bg-violet-50 hover:bg-violet-100 px-2 py-1 rounded-lg transition flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add Item
                  </button>
                </div>
                <div className="space-y-2">
                  {stationeryItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="text" placeholder={`Item ${idx + 1} (e.g. Chalk, Marker)`}
                        value={item.name}
                        onChange={e => setStationeryItems(items => items.map((it, i) => i === idx ? { ...it, name: e.target.value } : it))}
                        className="flex-1 bg-white border border-gray-200 px-3 py-2 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-violet-400/30" />
                      <input
                        type="number" min={1} max={999} placeholder="Qty"
                        value={item.qty}
                        onChange={e => setStationeryItems(items => items.map((it, i) => i === idx ? { ...it, qty: Number(e.target.value) } : it))}
                        className="w-20 bg-white border border-gray-200 px-3 py-2 rounded-xl text-sm font-bold text-center outline-none focus:ring-2 focus:ring-violet-400/30" />
                      {stationeryItems.length > 1 && (
                        <button type="button" onClick={() => setStationeryItems(items => items.filter((_, i) => i !== idx))}
                          className="w-8 h-8 shrink-0 bg-red-50 hover:bg-red-100 rounded-lg flex items-center justify-center text-red-500 transition">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Purpose */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Purpose / Class Use <span className="text-red-500">*</span></label>
                <textarea rows={2}
                  value={stationeryPurpose}
                  onChange={e => setStationeryPurpose(e.target.value)}
                  placeholder="e.g. Classroom teaching, Science lab, Grade 5 exams..."
                  className="w-full bg-white border border-gray-200 px-3 py-2.5 rounded-xl text-sm font-medium resize-none outline-none focus:ring-2 focus:ring-violet-400/30" />
              </div>

              {/* Urgency */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Urgency</label>
                <div className="flex gap-2">
                  {(['normal', 'urgent'] as const).map(u => (
                    <button key={u} type="button" onClick={() => setStationeryUrgency(u)}
                      className={`flex-1 py-2 rounded-xl border-2 text-xs font-bold capitalize transition-all ${
                        stationeryUrgency === u ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 bg-white text-gray-500'
                      }`}>{u}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-white border-t border-gray-100 flex gap-3 shrink-0">
              <button onClick={() => setShowStationeryModal(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition text-sm">Cancel</button>
              <button onClick={handleSaveStationery} disabled={savingStationery}
                className="flex-[2] py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-2xl shadow-lg shadow-violet-100 transition flex items-center justify-center gap-2 text-sm">
                {savingStationery ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                {savingStationery ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          COMPLAINT / FEEDBACK MODAL
      ══════════════════════════════════════════════════════════════════ */}
      {showComplaintModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowComplaintModal(false)} />
          <div className="bg-white rounded-3xl w-full max-w-lg relative z-10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 flex items-center justify-between bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
              <div>
                <h2 className="font-black text-lg">Report an Issue</h2>
                <p className="text-indigo-200 text-xs mt-0.5">Complaint · Feedback · Suggestion · Query</p>
              </div>
              <button onClick={() => setShowComplaintModal(false)} className="p-2 hover:bg-white/20 rounded-xl transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 bg-gray-50">
              {/* Type */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Type</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['complaint', 'feedback', 'suggestion', 'query'] as const).map(t => (
                    <button key={t} type="button"
                      onClick={() => setComplaintForm(f => ({ ...f, type: t }))}
                      className={`py-2 rounded-xl border-2 text-[10px] font-bold capitalize transition-all ${
                        complaintForm.type === t
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 bg-white text-gray-500'
                      }`}
                    >{t}</button>
                  ))}
                </div>
              </div>

              {/* Category + Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Category <span className="text-red-500">*</span></label>
                  <select
                    value={complaintForm.category}
                    onChange={e => setComplaintForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full bg-white border border-gray-200 px-3 py-2.5 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400"
                  >
                    <option value="">Select...</option>
                    {['Facilities','Transport','Academics','Discipline','Staff Behavior','Fees / Billing','Cleanliness','Security','Curriculum','IT / Technology','Other'].map(c =>
                      <option key={c} value={c}>{c}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Priority</label>
                  <select
                    value={complaintForm.priority}
                    onChange={e => setComplaintForm(f => ({ ...f, priority: e.target.value as any }))}
                    className="w-full bg-white border border-gray-200 px-3 py-2.5 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400"
                  >
                    {['low','normal','high','urgent'].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
                  </select>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Subject / Title <span className="text-red-500">*</span></label>
                <input
                  value={complaintForm.title}
                  onChange={e => setComplaintForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Brief subject line..."
                  className="w-full bg-white border border-gray-200 px-3 py-2.5 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Description <span className="text-red-500">*</span></label>
                <textarea
                  rows={4} value={complaintForm.description}
                  onChange={e => setComplaintForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the issue in detail..."
                  className="w-full bg-white border border-gray-200 px-3 py-2.5 rounded-xl text-sm font-medium resize-none outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-white border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowComplaintModal(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition-all text-sm">Cancel</button>
              <button
                onClick={handleSubmitComplaint}
                disabled={submittingComplaint}
                className="flex-[2] py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
              >
                {submittingComplaint
                  ? <RefreshCw className="w-4 h-4 animate-spin" />
                  : <Send className="w-4 h-4" />
                }
                {submittingComplaint ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          LEAVE APPLICATION MODAL
      ══════════════════════════════════════════════════════════════════ */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowLeaveModal(false)} />
          
          <div className="bg-white rounded-3xl w-full max-w-lg relative z-10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-indigo-600 to-indigo-500 text-white">
              <div>
                <h2 className="font-black text-lg">Apply for Leave</h2>
                <p className="text-indigo-200 text-xs mt-0.5">Application will be sent to admin for approval</p>
              </div>
              <button onClick={() => setShowLeaveModal(false)} className="p-2 hover:bg-white/20 rounded-xl transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Applicant Type Selection */}
              <div className="flex bg-slate-100 p-1 rounded-xl mb-2">
                <button 
                  onClick={() => setIsSelfLeave(true)}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                    isSelfLeave ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  My Leave
                </button>
                <button 
                  onClick={() => setIsSelfLeave(false)}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                    !isSelfLeave ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  Student Leave
                </button>
              </div>

              {!isSelfLeave && (
                <div className="animate-in slide-in-from-top-2 duration-300">
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5">Select Student</label>
                  <select
                    value={leaveForm.student_id}
                    onChange={e => setLeaveForm(p => ({ ...p, student_id: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  >
                    <option value="">— Choose Student —</option>
                    {allStudents.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.full_name} (Roll #{s.roll_number})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Leave Type */}
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5">Leave Type</label>
                <select
                  value={leaveForm.leave_type}
                  onChange={e => setLeaveForm(p => ({ ...p, leave_type: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                >
                  {LEAVE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5">From Date</label>
                  <input
                    type="date"
                    value={leaveForm.from_date}
                    onChange={e => setLeaveForm(p => ({
                      ...p,
                      from_date: e.target.value,
                      to_date: e.target.value > p.to_date ? e.target.value : p.to_date,
                    }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5">To Date</label>
                  <input
                    type="date"
                    value={leaveForm.to_date}
                    min={leaveForm.from_date}
                    onChange={e => setLeaveForm(p => ({ ...p, to_date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* Days Calculated */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black text-indigo-700 uppercase tracking-widest">Total Days Requested</p>
                  {leaveForm.is_half_day && (
                    <p className="text-[10px] text-indigo-400 mt-0.5">Half day — counts as 0.5 days</p>
                  )}
                </div>
                <span className="text-3xl font-black text-indigo-600">
                  {leaveForm.is_half_day ? '½' : leaveDays}
                </span>
              </div>

              {/* Half Day Toggle */}
              <div
                className="flex items-center gap-3 cursor-pointer"
                onClick={() => setLeaveForm(p => ({ ...p, is_half_day: !p.is_half_day }))}
              >
                <div className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0',
                  leaveForm.is_half_day ? 'bg-indigo-600' : 'bg-gray-200'
                )}>
                  <span className={cn(
                    'inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform',
                    leaveForm.is_half_day ? 'translate-x-5' : 'translate-x-0.5'
                  )} />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">Half Day Leave</p>
                  <p className="text-[10px] text-gray-400">Select if you need only half a day off</p>
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5">
                  Reason for Leave <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={leaveForm.reason}
                  onChange={e => setLeaveForm(p => ({ ...p, reason: e.target.value }))}
                  placeholder="Describe the reason for your leave application…"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                />
                {leaveForm.reason.length < 10 && leaveForm.reason.length > 0 && (
                  <p className="text-[10px] text-amber-600 mt-1">Please provide more detail (at least 10 characters)</p>
                )}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 bg-gray-50">
              <button
                onClick={() => setShowLeaveModal(false)}
                className="flex-1 border border-gray-200 bg-white rounded-xl py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitLeave}
                disabled={submittingLeave || leaveForm.reason.trim().length < 10}
                className="flex-1 bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-black hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submittingLeave
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> Submitting…</>
                  : <><Briefcase className="w-4 h-4" /> Submit Application</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Chat Center Drawer ── */}
      {chatOpen && (
        <MessageCenter
          staffId={staffId!}
          schoolId={userRole!.school_id}
          onClose={() => {
            setChatOpen(false);
            fetchUnreadCount(staffId!);
          }}
        />
      )}
      </>, document.body
    )}
    </>
  );
}

// ─── MESSAGE CENTER COMPONENT ────────────────────────────────────────────────
function MessageCenter({ staffId, schoolId, onClose }: { staffId: string; schoolId: string; onClose: () => void }) {
  const [students, setStudents] = useState<any[]>([]);
  const [contactsLoaded, setContactsLoaded] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [recentChats, setRecentChats] = useState<any[]>([]);
  const [view, setView] = useState<'recent' | 'all'>('recent');
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [selectedThread, setSelectedThread] = useState<any | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchInbox();
  }, []);

  // Switch to "All Students" tab — lazy-load contacts on first open
  const handleViewAll = () => {
    setView('all');
    setSearch('');
    if (!contactsLoaded && !contactsLoading) {
      loadContacts();
    }
  };

  const fetchInbox = async () => {
    setLoading(true);
    setFetchError('');
    await fetchRecentChats();
    setLoading(false);
  };

  const fetchData = async () => {
    setLoading(true);
    setFetchError('');
    await fetchRecentChats();
    setLoading(false);
  };

  const loadContacts = async () => {
    setContactsLoading(true);
    await fetchChatContacts();
    setContactsLoaded(true);
    setContactsLoading(false);
  };

  const fetchRecentChats = async () => {
    try {
      // 1. Fetch messages first (avoiding join due to potential schema cache issues)
      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('id, student_id, sender_id, receiver_id, sender_type, receiver_type, message, created_at, is_read')
        .eq('school_id', schoolId)
        .or(`sender_id.eq.${staffId},receiver_id.eq.${staffId}`)
        .order('created_at', { ascending: false });

      if (error) {
        setFetchError(error.message);
        console.error('Error fetching recent chats:', error);
        return;
      }
      if (!messages || messages.length === 0) {
        setRecentChats([]);
        return;
      }

      // 2. Extract unique student IDs to fetch their details
      const studentIds = [...new Set(messages.map((m: any) => m.student_id).filter(Boolean))];
      let studentMap: Record<string, any> = {};

      if (studentIds.length > 0) {
        const { data: stuData, error: stuError } = await supabase
          .from('students')
          .select('id, full_name, roll_number, photograph_url, parent_id, classes(name, section)')
          .in('id', studentIds);
        
        if (stuError) {
          console.error('Error fetching students for chats:', stuError);
        }
        if (stuData) {
          stuData.forEach(s => { studentMap[s.id] = s; });
        }
      }

      // 3. Process conversations — group and count unread per thread
      const convMap = new Map<string, any>();

      messages.forEach((m: any) => {
        const targetId = m.sender_id === staffId ? m.receiver_id : m.sender_id;
        const targetType = m.sender_id === staffId ? m.receiver_type : m.sender_type;
        const key = `${m.student_id}_${targetId}`;

        if (!convMap.has(key)) {
          // First (most recent) message sets the preview
          convMap.set(key, {
            ...m,
            targetId,
            targetType,
            lastMessage: m.message,
            lastDate: m.created_at,
            unreadCount: 0,
            student: studentMap[m.student_id] || null
          });
        }
        // Accumulate unread count across all messages in thread
        if (!m.is_read && m.receiver_id === staffId) {
          convMap.get(key).unreadCount += 1;
        }
      });
      setRecentChats(Array.from(convMap.values()));
    } catch (err: any) {
      setFetchError(err?.message || 'Unexpected error');
      console.error('Unexpected error in fetchRecentChats:', err);
    }
  };

  const fetchChatContacts = async () => {
    try {
      const { data: ctClasses, error: err1 } = await supabase.from('classes')
        .select('id').eq('school_id', schoolId).eq('class_teacher_id', staffId);
      
      if (err1) { setFetchError(err1.message); return; }

      const { data: ttSlots, error: err2 } = await supabase.from('timetable_slots')
        .select('class_id').eq('school_id', schoolId).eq('teacher_id', staffId);
      
      if (err2) { setFetchError(err2.message); return; }

      const ctIds = (ctClasses || []).map(c => c.id);
      const taughtIds = (ttSlots || []).map(s => s.class_id);
      const allClassIds = [...new Set([...ctIds, ...taughtIds])];

      let query = supabase.from('students')
        .select('id, full_name, roll_number, photograph_url, parent_id, class_id, classes(name, section)')
        .eq('school_id', schoolId).eq('status', 'active');

      if (allClassIds.length > 0) query = query.in('class_id', allClassIds);

      const { data: stuData, error: err3 } = await query.order('full_name').limit(150);
      
      if (err3) { setFetchError(err3.message); return; }
      
      setStudents(stuData || []);
    } catch (err: any) {
      setFetchError(err?.message || 'Unexpected error');
      console.error('Error fetching chat contacts:', err);
    }
  };

  const filteredStudents = students.filter(s => {
    const q = search.toLowerCase();
    return s.full_name.toLowerCase().includes(q) || (s.classes?.name || '').toLowerCase().includes(q);
  });

  const filteredRecent = recentChats.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.student?.full_name || '').toLowerCase().includes(q) ||
           (c.lastMessage || '').toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-[110] flex justify-end overflow-hidden">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />
      
      <motion.div 
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col"
      >
        {/* Premium Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-500 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12 blur-xl" />
          
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-inner">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="font-black text-xl tracking-tight">Message Center</h2>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                <p className="text-[10px] text-indigo-100 font-bold uppercase tracking-widest">Teacher-Parent Connect</p>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition relative z-10"><X className="w-6 h-6" /></button>
        </div>

        {!selectedThread ? (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Tab Navigation with Animated Indicator */}
            <div className="flex px-4 pt-4 border-b border-gray-50 relative">
              {(() => {
                const totalUnread = recentChats.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
                return [
                  { id: 'recent', label: 'Inbox', icon: Clock, badge: totalUnread },
                  { id: 'all', label: 'New Chat', icon: Users, badge: 0 }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => tab.id === 'all' ? handleViewAll() : (setView('recent'), setSearch(''))}
                    className={cn(
                      "flex-1 pb-3 text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 relative",
                      view === tab.id ? "text-indigo-600" : "text-gray-400 hover:text-gray-600"
                    )}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                    {tab.badge > 0 && (
                      <span className="bg-indigo-600 text-white text-[8px] font-black rounded-full w-4 h-4 flex items-center justify-center">
                        {tab.badge > 9 ? '9+' : tab.badge}
                      </span>
                    )}
                    {view === tab.id && (
                      <motion.div
                        layoutId="tab-indicator"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600"
                      />
                    )}
                  </button>
                ));
              })()}
            </div>

            {/* Premium Search Bar */}
            <div className="p-4 bg-slate-50/50">
              <div className="relative group">
                <input 
                  type="text" 
                  placeholder={view === 'recent' ? "Search inbox..." : "Search students..."}
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition shadow-sm" 
                />
                <Search className="absolute left-4 top-3.5 w-4 h-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <AnimatePresence mode="wait">
                {fetchError ? (
                  <motion.div 
                    key="error"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-10 text-center"
                  >
                    <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                    <p className="text-sm text-red-600 font-bold mb-2">Failed to load data</p>
                    <p className="text-xs text-gray-500 mb-6">{fetchError}</p>
                    <button 
                      onClick={fetchData}
                      className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition"
                    >
                      Try Again
                    </button>
                  </motion.div>
                ) : loading ? (
                  <motion.div 
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-10 text-center"
                  >
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-sm text-gray-500 font-bold uppercase tracking-widest">Syncing Inbox...</p>
                  </motion.div>
                ) : view === 'recent' ? (
                  <motion.div 
                    key="recent"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="divide-y divide-gray-50"
                  >
                    {filteredRecent.length === 0 ? (
                      <div className="p-16 text-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                          <MessageCircle className="w-10 h-10 text-slate-300" />
                        </div>
                        <p className="text-gray-900 font-black text-sm mb-1">No Conversations Yet</p>
                        <p className="text-gray-400 text-xs font-medium italic mb-6">Select a student from the directory to start a chat.</p>
                        <button
                          onClick={handleViewAll}
                          className="px-6 py-2.5 bg-indigo-50 text-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition shadow-sm"
                        >
                          Start a New Chat
                        </button>
                      </div>
                    ) : (
                      filteredRecent.map((chat, idx) => (
                        <motion.button 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          key={`${chat.student_id}_${chat.targetId}`}
                          onClick={() => setSelectedThread({
                            student: chat.student,
                            studentId: chat.student_id,
                            targetId: chat.targetId,
                            type: chat.targetType,
                            name: chat.targetType === 'parent' 
                              ? `Parent of ${chat.student?.full_name?.split(' ')[0] || 'Student'}` 
                              : (chat.student?.full_name || `Student (${chat.student_id?.slice(0, 4)})`)
                          })}
                          className="w-full text-left p-4 hover:bg-indigo-50/50 transition-all flex items-center gap-4 relative group"
                        >
                          <div className="relative">
                            <div className="w-14 h-14 rounded-[22px] bg-slate-100 flex items-center justify-center overflow-hidden border border-gray-100 shrink-0 group-hover:scale-105 transition-transform duration-300 shadow-sm">
                              {chat.student?.photograph_url 
                                ? <img src={chat.student.photograph_url} className="w-full h-full object-cover" alt="" />
                                : <span className="text-gray-400 font-black text-xl">{chat.student?.full_name.charAt(0)}</span>
                              }
                            </div>
                            <div className={cn(
                              "absolute -bottom-1 -right-1 w-5 h-5 rounded-lg border-2 border-white flex items-center justify-center shadow-sm",
                              chat.targetType === 'parent' ? "bg-emerald-500" : "bg-indigo-500"
                            )}>
                              {chat.targetType === 'parent' ? <Users className="w-3 h-3 text-white" /> : <GraduationCap className="w-3 h-3 text-white" />}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                              <p className="font-black text-gray-900 text-sm truncate pr-2">
                                {chat.targetType === 'parent' ? 'Parent of ' : ''}{chat.student?.full_name}
                              </p>
                              <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter shrink-0 mt-0.5">
                                {formatDate(chat.lastDate)}
                              </span>
                            </div>
                            <p className={`text-xs truncate mt-1 leading-relaxed ${chat.unreadCount > 0 ? 'text-indigo-600 font-black' : 'text-gray-500 font-medium'}`}>
                              {chat.sender_id === staffId ? <span className="text-gray-400 font-bold">You: </span> : ''}{chat.lastMessage}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-500 font-black rounded uppercase">
                                {chat.student?.classes?.name}
                              </span>
                              <span className={cn(
                                "text-[9px] px-1.5 py-0.5 font-black rounded uppercase",
                                chat.targetType === 'parent' ? "bg-emerald-50 text-emerald-600" : "bg-indigo-50 text-indigo-600"
                              )}>
                                {chat.targetType === 'parent' ? 'Parent Portal' : 'Student Portal'}
                              </span>
                            </div>
                          </div>
                          {chat.unreadCount > 0 && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 min-w-[20px] h-5 px-1.5 bg-indigo-600 rounded-full ring-4 ring-indigo-50 shadow-sm flex items-center justify-center">
                              <span className="text-[9px] font-black text-white">{chat.unreadCount > 9 ? '9+' : chat.unreadCount}</span>
                            </div>
                          )}
                        </motion.button>
                      ))
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="all"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="divide-y divide-gray-50"
                  >
                    {contactsLoading ? (
                      <div className="p-16 text-center">
                        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-sm text-gray-500 font-bold uppercase tracking-widest">Loading contacts...</p>
                      </div>
                    ) : filteredStudents.length === 0 ? (
                      <div className="p-16 text-center">
                        <p className="text-gray-400 text-sm font-black italic">No matching students found.</p>
                      </div>
                    ) : (
                      filteredStudents.map((student, idx) => (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.02 }}
                          key={student.id} 
                          className="p-5 hover:bg-slate-50 transition-all group"
                        >
                          <div className="flex items-center gap-4 mb-4">
                            <div className="w-14 h-14 rounded-[20px] bg-slate-100 overflow-hidden flex items-center justify-center border border-gray-100 shadow-sm">
                              {student.photograph_url 
                                ? <img src={student.photograph_url} className="w-full h-full object-cover" alt="" />
                                : <span className="text-gray-400 font-black text-xl">{student.full_name.charAt(0)}</span>
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-black text-gray-900 text-sm truncate">{student.full_name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded">
                                  {student.classes ? `${student.classes.name} ${student.classes.section}` : 'Unassigned'}
                                </span>
                                {student.roll_number && (
                                  <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded">
                                    #{student.roll_number}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              onClick={() => setSelectedThread({
                                student,
                                studentId: student.id,
                                targetId: student.parent_id,
                                type: 'parent',
                                name: `Parent of ${student.full_name?.split(' ')[0] || 'Student'}`
                              })}
                              disabled={!student.parent_id}
                              className="flex items-center justify-center gap-2 py-3 bg-white border border-emerald-200 text-emerald-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-50 transition-all shadow-sm disabled:opacity-30 disabled:grayscale active:scale-95"
                            >
                              <Users className="w-3.5 h-3.5" /> Parent
                            </button>
                            <button
                              onClick={() => setSelectedThread({ 
                                student, 
                                studentId: student.id,
                                targetId: student.id, 
                                type: 'student',
                                name: student.full_name
                              })}
                              className="flex items-center justify-center gap-2 py-3 bg-white border border-indigo-200 text-indigo-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-sm active:scale-95"
                            >
                              <GraduationCap className="w-3.5 h-3.5" /> Student
                            </button>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 bg-white">
            {/* Thread Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-4 bg-slate-50/50">
              <button 
                onClick={() => setSelectedThread(null)} 
                className="w-10 h-10 flex items-center justify-center hover:bg-white rounded-2xl border border-transparent hover:border-gray-100 transition shadow-sm"
              >
                <ChevronLeft className="w-6 h-6 text-gray-600" />
              </button>
              <div className="flex-1">
                <p className="font-black text-gray-900 leading-tight">{selectedThread.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={cn(
                    "text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded",
                    selectedThread.type === 'parent' ? "bg-emerald-100 text-emerald-700" : "bg-indigo-100 text-indigo-700"
                  )}>
                    {selectedThread.type === 'parent' ? 'Parent Access' : 'Student Access'}
                  </span>
                  <span className="text-[9px] text-gray-400 font-bold uppercase">Student: {selectedThread.student?.full_name || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Chat Interface Integration */}
            <div className="flex-1 flex flex-col min-h-0 p-4">
              <ChatInterface
                schoolId={schoolId}
                currentUserId={staffId}
                currentUserType="staff"
                targetUserId={selectedThread.targetId}
                targetUserType={selectedThread.type}
                studentId={selectedThread.student?.id || selectedThread.studentId}
                targetName={selectedThread.name}
              />
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
