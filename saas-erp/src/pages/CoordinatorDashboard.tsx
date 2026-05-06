import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { formatDate, cn } from '../lib/utils';
import {
  Users, GraduationCap, CalendarCheck, BookOpen,
  CheckCircle2, XCircle, Clock, AlertTriangle, ChevronRight,
  RefreshCw, CalendarOff, FileText, BarChart3, TrendingUp,
  ClipboardList, Award, Briefcase, Building2, CheckCheck, Printer, Radio,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClassAtt {
  class_id: string;
  class_name: string;
  section: string;
  total_students: number;
  present: number;
  absent: number;
  leave: number;
  marked: boolean;
}

interface DiaryRow {
  staff_id: string;
  staff_name: string;
  class_name: string;
  subject_name: string;
  topic: string | null;
  submitted: boolean;
}

interface TimetableSlot {
  day_of_week: string;
  period_number: number;
  class_name: string;
  section: string;
  subject_name: string;
  teacher_name: string;
  start_time: string | null;
  end_time: string | null;
}

// Format "HH:MM:SS" → "8:00 AM"
const fmtTime = (t: string | null) => {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  return `${hour % 12 || 12}:${m} ${hour < 12 ? 'AM' : 'PM'}`;
};

interface LeaveRequest {
  id: string;
  staff_name: string;
  leave_type: string;
  from_date: string;
  to_date: string;
  total_days: number;
  reason: string;
  status: string;
}

interface ExamRow {
  id: string;
  exam_date: string;
  exam_type: string;
  class_name: string;
  subject_name: string;
  start_time: string | null;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT: Record<string, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed',
  Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat',
};

const ROLE_LABEL: Record<string, string> = {
  academic_coordinator: 'Academic Coordinator',
  campus_coordinator:   'Campus Coordinator',
  section_coordinator:  'Section Coordinator',
};

// ── Sub-component: Stat card ───────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: 'indigo' | 'emerald' | 'amber' | 'rose' | 'teal';
}) {
  const bg: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600', emerald: 'bg-emerald-50 text-emerald-600',
    amber:  'bg-amber-50 text-amber-600',   rose:    'bg-rose-50 text-rose-600',
    teal:   'bg-teal-50 text-teal-600',
  };
  const val: Record<string, string> = {
    indigo: 'text-indigo-700', emerald: 'text-emerald-700',
    amber:  'text-amber-700',  rose:    'text-rose-700', teal: 'text-teal-700',
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${bg[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <p className={`text-2xl font-black mt-0.5 ${val[color]}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function CoordinatorDashboard() {
  const { userRole, user } = useAuth();
  const sid = userRole?.school_id;

  const today      = new Date().toISOString().split('T')[0];
  const todayName  = DAYS[new Date().getDay() - 1] ?? 'Monday';
  const [activeDay, setActiveDay] = useState(todayName);

  // State
  const [loading,        setLoading]        = useState(true);
  const [staffName,      setStaffName]      = useState('');
  const [staffInfo,      setStaffInfo]      = useState<any>(null);
  const [schoolInfo,     setSchoolInfo]     = useState<any>(null);
  const [totalClasses,   setTotalClasses]   = useState(0);
  const [totalStudents,  setTotalStudents]  = useState(0);
  const [classAtt,       setClassAtt]       = useState<ClassAtt[]>([]);
  const [diaryRows,      setDiaryRows]      = useState<DiaryRow[]>([]);
  const [timetable,      setTimetable]      = useState<TimetableSlot[]>([]);
  const [leaves,         setLeaves]         = useState<LeaveRequest[]>([]);
  const [exams,          setExams]          = useState<ExamRow[]>([]);
  const [leaveSaving,    setLeaveSaving]    = useState<string | null>(null);

  // Active tabs
  const [attTab,  setAttTab]  = useState<'today' | 'summary'>('today');

  // Live clock for current-period detection (updates every 30 s)
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Timetable class filter
  const [ttClassFilter, setTtClassFilter] = useState('');

  const fetchAll = useCallback(async () => {
    if (!sid) return;
    setLoading(true);

    try {
      // Pre-fill name from auth metadata
      const meta = user?.user_metadata;
      if (meta?.full_name || meta?.name) setStaffName(meta.full_name || meta.name);

      const [
        schoolRes,
        classesRes,
        studentsRes,
        attRes,
        diaryRes,
        allStaffDiaryRes,
        ttRes,
        leaveRes,
        examRes,
        staffInfoRes,
      ] = await Promise.all([
        supabase.from('schools').select('name, logo_url, address').eq('id', sid).maybeSingle(),
        supabase.from('classes').select('id, name, section').eq('school_id', sid).order('name'),
        supabase.from('students').select('id, class_id').eq('school_id', sid).eq('status', 'active'),
        supabase.from('attendance').select('student_id, status').eq('school_id', sid).eq('date', today),
        supabase.from('teacher_diary')
          .select('staff_id, topic_covered, subjects(subject_name), classes(name, section)')
          .eq('school_id', sid).eq('diary_date', today),
        supabase.from('timetable_slots')
          .select('staff_id, class_id, staff(full_name), classes(name, section), subjects(subject_name)')
          .eq('school_id', sid),
        supabase.from('timetable_slots')
          .select('day_of_week, period_number, start_time, end_time, staff(full_name), classes(name, section), subjects(subject_name)')
          .eq('school_id', sid).order('period_number'),
        supabase.from('leave_applications')
          .select('id, leave_type, from_date, to_date, total_days, reason, status, staff(full_name)')
          .eq('school_id', sid).eq('status', 'pending').order('from_date'),
        supabase.from('exam_schedules')
          .select('id, exam_date, start_time, exam_types(name), classes(name), subjects(subject_name)')
          .eq('school_id', sid).gte('exam_date', today).order('exam_date').limit(10),
        supabase.from('staff').select('full_name, photograph_url, department, role')
          .eq('school_id', sid)
          .eq('user_id', user?.id ?? '')
          .maybeSingle(),
      ]);

      if (schoolRes.data)   setSchoolInfo(schoolRes.data);
      if (staffInfoRes.data) {
        setStaffInfo(staffInfoRes.data);
        if (staffInfoRes.data.full_name) setStaffName(staffInfoRes.data.full_name);
      }

      const classes = classesRes.data ?? [];
      setTotalClasses(classes.length);

      const students = studentsRes.data ?? [];
      setTotalStudents(students.length);

      // ── Attendance: group by class (attendance table has no class_id — cross-ref via students) ──
      const attRecords = attRes.data ?? [];
      // Build a map: student_id → status
      const attByStudent: Record<string, string> = {};
      attRecords.forEach((a: any) => { attByStudent[a.student_id] = a.status; });

      // Build a map: class_id → student ids
      const studentsByClass: Record<string, string[]> = {};
      students.forEach((s: any) => {
        if (!studentsByClass[s.class_id]) studentsByClass[s.class_id] = [];
        studentsByClass[s.class_id].push(s.id);
      });

      const classAttData: ClassAtt[] = classes.map((c: any) => {
        const classStudentIds = studentsByClass[c.id] ?? [];
        // Count using the actual status strings stored by MarkAttendance
        let present = 0, absent = 0, leave = 0, marked = false;
        classStudentIds.forEach(sid => {
          const st = attByStudent[sid];
          if (st !== undefined) marked = true;
          if (st === 'present' || st === 'late') present++;
          else if (st === 'absent')              absent++;
          else if (st === 'leave')               leave++;
        });
        return {
          class_id: c.id,
          class_name: c.name,
          section: c.section || '',
          total_students: classStudentIds.length,
          present, absent, leave,
          marked,
        };
      });
      setClassAtt(classAttData);

      // ── Diary status: who submitted today vs who teaches today ───────────
      // timetable_slots uses staff_id; teacher_diary uses staff_id
      const diarySubmitted = diaryRes.data ?? [];
      const allTeacherSlots = allStaffDiaryRes.data ?? [];
      // Build a map: staff_id → { name, class_name, subject_name }
      const teacherMap: Record<string, { name: string; class_name: string; subject_name: string }> = {};
      allTeacherSlots.forEach((slot: any) => {
        if (!slot.staff_id || !slot.staff?.full_name) return;
        if (!teacherMap[slot.staff_id]) {
          teacherMap[slot.staff_id] = {
            name:         slot.staff.full_name,
            class_name:   (slot.classes as any)?.name ?? '—',
            subject_name: (slot.subjects as any)?.subject_name ?? '—',
          };
        }
      });
      const submittedIds = new Set(diarySubmitted.map((d: any) => d.staff_id));
      const diaryData: DiaryRow[] = Object.entries(teacherMap).map(([staffId, info]) => {
        const entry = diarySubmitted.find((d: any) => d.staff_id === staffId);
        return {
          staff_id:     staffId,
          staff_name:   info.name,
          class_name:   (entry?.classes as any)?.name   ?? info.class_name,
          subject_name: (entry?.subjects as any)?.subject_name ?? info.subject_name,
          topic:        entry?.topic_covered    ?? null,
          submitted:    submittedIds.has(staffId),
        };
      });
      setDiaryRows(diaryData.sort((a, b) =>
        (b.submitted ? 1 : 0) - (a.submitted ? 1 : 0) || a.staff_name.localeCompare(b.staff_name)
      ));

      // ── Timetable ────────────────────────────────────────────────────────
      const ttData: TimetableSlot[] = (ttRes.data ?? []).map((s: any) => ({
        day_of_week:   s.day_of_week,
        period_number: Number(s.period_number),
        class_name:    (s.classes as any)?.name    ?? '—',
        section:       (s.classes as any)?.section ?? '',
        subject_name:  (s.subjects as any)?.subject_name ?? '—',
        teacher_name:  (s.staff as any)?.full_name ?? '—',
        start_time:    s.start_time  ?? null,
        end_time:      s.end_time    ?? null,
      }));
      setTimetable(ttData);

      // ── Leave requests ───────────────────────────────────────────────────
      setLeaves((leaveRes.data ?? []).map((l: any) => ({
        id:          l.id,
        staff_name:  l.staff?.full_name ?? '—',
        leave_type:  l.leave_type,
        from_date:   l.from_date,
        to_date:     l.to_date,
        total_days:  l.total_days,
        reason:      l.reason,
        status:      l.status,
      })));

      // ── Exams ────────────────────────────────────────────────────────────
      setExams((examRes.data ?? []).map((e: any) => ({
        id:           e.id,
        exam_date:    e.exam_date,
        start_time:   e.start_time,
        exam_type:    e.exam_types?.name    ?? '—',
        class_name:   e.classes?.name       ?? '—',
        subject_name: e.subjects?.subject_name ?? '—',
      })));
    } catch (err) {
      console.error('CoordinatorDashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [sid, user?.id, today]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Leave approve / reject ────────────────────────────────────────────────
  const handleLeave = async (id: string, status: 'approved' | 'rejected') => {
    setLeaveSaving(id);
    await supabase.from('leave_applications').update({ status }).eq('id', id);
    setLeaves(prev => prev.filter(l => l.id !== id));
    setLeaveSaving(null);
  };

  // ── Derived stats ─────────────────────────────────────────────────────────
  const totalPresent    = classAtt.reduce((s, c) => s + c.present, 0);
  const totalMarked     = classAtt.filter(c => c.marked).length;
  const attPct          = totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : 0;
  const diarySubmitted  = diaryRows.filter(d => d.submitted).length;

  // Timetable: unique periods on selected day + class filter
  const daySlots        = timetable.filter(s => s.day_of_week === activeDay);
  const filteredDaySlots = ttClassFilter
    ? daySlots.filter(s => `${s.class_name}|||${s.section}` === ttClassFilter)
    : daySlots;
  const periods         = [...new Set(filteredDaySlots.map(s => s.period_number))].sort((a, b) => Number(a) - Number(b));

  // Unique class list from ALL timetable data (for filter dropdown)
  const ttClasses = [...new Map<string, { name: string; section: string }>(
    timetable.map(s => [`${s.class_name}|||${s.section}`, { name: s.class_name, section: s.section }])
  ).values()].sort((a, b) => a.name.localeCompare(b.name));

  // Current period detection: is now between start_time and end_time?
  const isLive = (startTime: string | null, endTime: string | null): boolean => {
    if (!startTime || !endTime || activeDay !== todayName) return false;
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const startMin = sh * 60 + sm;
    const endMin   = eh * 60 + em;
    const nowMin   = now.getHours() * 60 + now.getMinutes();
    return nowMin >= startMin && nowMin <= endMin;
  };

  // ── PDF: Print Attendance Report ─────────────────────────────────────────
  const handlePrintAttendance = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pw = doc.internal.pageSize.getWidth();

    if (schoolInfo?.name) {
      doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text(schoolInfo.name, pw / 2, 15, { align: 'center' });
    }
    doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.text('Daily Attendance Report', pw / 2, schoolInfo?.name ? 23 : 15, { align: 'center' });
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    const yMeta = schoolInfo?.name ? 31 : 23;
    doc.text(`Date: ${formatDate(today)}`, 14, yMeta);
    doc.text(
      `Overall: ${attPct}%  ·  ${totalMarked} of ${totalClasses} classes marked`,
      14, yMeta + 6,
    );

    autoTable(doc, {
      startY: yMeta + 13,
      head: [['Class', 'Sec', 'Total', 'Present', 'Absent', 'Leave', '%', 'Status']],
      body: classAtt.map(c => {
        const pct = c.total_students > 0 ? Math.round((c.present / c.total_students) * 100) : 0;
        return [c.class_name, c.section || '—', c.total_students, c.present, c.absent, c.leave, `${pct}%`, c.marked ? '✓ Marked' : '✗ Not Marked'];
      }),
      foot: [[
        'TOTAL', '',
        totalStudents, totalPresent,
        classAtt.reduce((s, c) => s + c.absent, 0),
        classAtt.reduce((s, c) => s + c.leave, 0),
        `${attPct}%`,
        `${totalMarked}/${totalClasses} marked`,
      ]],
      headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      footStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 0: { cellWidth: 30 }, 7: { cellWidth: 28 } },
      didParseCell: (data: any) => {
        if (data.section !== 'body') return;
        if (data.column.index === 6) {
          const n = parseInt(data.cell.raw as string);
          if (!isNaN(n)) data.cell.styles.textColor = n >= 85 ? [5, 150, 105] : n >= 70 ? [217, 119, 6] : [220, 38, 38];
        }
        if (data.column.index === 7) {
          const raw = data.cell.raw as string;
          data.cell.styles.textColor = raw.startsWith('✓') ? [5, 150, 105] : [220, 38, 38];
        }
      },
    });
    doc.save(`Attendance_${today}.pdf`);
  };

  // ── PDF: Print Diary Status ───────────────────────────────────────────────
  const handlePrintDiary = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pw = doc.internal.pageSize.getWidth();
    const completionPct = diaryRows.length > 0 ? Math.round((diarySubmitted / diaryRows.length) * 100) : 0;

    if (schoolInfo?.name) {
      doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text(schoolInfo.name, pw / 2, 15, { align: 'center' });
    }
    doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.text('Teacher Diary Submission Report', pw / 2, schoolInfo?.name ? 23 : 15, { align: 'center' });
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    const yMeta = schoolInfo?.name ? 31 : 23;
    doc.text(`Date: ${formatDate(today)}`, 14, yMeta);
    doc.text(
      `${diarySubmitted} of ${diaryRows.length} teachers submitted  ·  ${completionPct}% completion`,
      14, yMeta + 6,
    );

    autoTable(doc, {
      startY: yMeta + 13,
      head: [['#', 'Teacher', 'Class', 'Subject', 'Topic Covered', 'Status']],
      body: diaryRows.map((r, i) => [
        i + 1, r.staff_name, r.class_name, r.subject_name,
        r.topic || '—',
        r.submitted ? '✓ Submitted' : '✗ Pending',
      ]),
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 0: { cellWidth: 8 }, 4: { cellWidth: 50 } },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 5) {
          const raw = data.cell.raw as string;
          data.cell.styles.textColor = raw.startsWith('✓') ? [5, 150, 105] : [220, 38, 38];
        }
      },
    });
    doc.save(`DiaryStatus_${today}.pdf`);
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center p-20">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-slate-500 font-medium">Loading coordinator dashboard…</p>
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto space-y-5">

      {/* ── Header banner ─────────────────────────────────────────────── */}
      <div className="relative bg-gradient-to-r from-teal-700 via-teal-600 to-cyan-500 rounded-2xl p-6 text-white shadow-xl shadow-teal-200 overflow-hidden">
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="absolute -bottom-10 right-24 w-28 h-28 rounded-full bg-white/5" />
        <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl border-2 border-white/30 shadow-lg shrink-0 overflow-hidden bg-teal-500 flex items-center justify-center">
              {staffInfo?.photograph_url
                ? <img src={staffInfo.photograph_url} alt="" className="w-full h-full object-cover" />
                : <span className="text-2xl font-black text-white">{(staffName || 'C').charAt(0)}</span>}
            </div>
            <div>
              <p className="text-teal-200 text-[10px] font-black uppercase tracking-[0.2em]">
                {ROLE_LABEL[userRole?.role ?? ''] ?? 'Coordinator'} Portal
              </p>
              <h1 className="text-2xl font-black leading-tight">{staffName || 'Coordinator'}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {staffInfo?.department && (
                  <span className="inline-flex items-center gap-1 text-xs bg-white/15 px-2.5 py-0.5 rounded-full">
                    <Building2 className="w-3 h-3" /> {staffInfo.department}
                  </span>
                )}
                {schoolInfo?.name && (
                  <span className="inline-flex items-center gap-1 text-xs bg-white/15 px-2.5 py-0.5 rounded-full">
                    <GraduationCap className="w-3 h-3" /> {schoolInfo.name}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-teal-200 text-[10px] font-black uppercase tracking-widest">Today</p>
              <p className="text-white font-black text-sm">{formatDate(today)}</p>
              <p className="text-teal-200 text-xs">{todayName}</p>
            </div>
            <button onClick={fetchAll} className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total Classes"    value={totalClasses}  icon={BookOpen}      color="indigo"  sub="Active classes" />
        <KpiCard label="Total Students"   value={totalStudents} icon={GraduationCap} color="teal"    sub="Enrolled & active" />
        <KpiCard
          label="Attendance Today"
          value={`${attPct}%`}
          icon={CalendarCheck}
          color={attPct >= 85 ? 'emerald' : attPct >= 70 ? 'amber' : 'rose'}
          sub={`${totalPresent} present · ${totalMarked}/${totalClasses} classes marked`}
        />
        <KpiCard
          label="Diary Submitted"
          value={`${diarySubmitted}/${diaryRows.length}`}
          icon={ClipboardList}
          color={diarySubmitted === diaryRows.length && diaryRows.length > 0 ? 'emerald' : 'amber'}
          sub="Teachers submitted today"
        />
      </div>

      {/* ── Attendance + Diary (2 columns) ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Daily Attendance */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-teal-600" />
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">Daily Attendance</h2>
              <span className="text-[10px] font-bold text-slate-400">{formatDate(today)}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrintAttendance}
                title="Download PDF"
                className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-black text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors"
              >
                <Printer className="w-3 h-3" /> PDF
              </button>
              <Link to="/attendance" className="flex items-center gap-1 text-[10px] font-black text-teal-600 hover:underline">
                Full Report <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Class</th>
                  <th className="px-3 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Total</th>
                  <th className="px-3 py-2.5 text-[10px] font-black text-emerald-500 uppercase tracking-widest text-center">P</th>
                  <th className="px-3 py-2.5 text-[10px] font-black text-rose-500 uppercase tracking-widest text-center">A</th>
                  <th className="px-3 py-2.5 text-[10px] font-black text-amber-500 uppercase tracking-widest text-center">L</th>
                  <th className="px-3 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">%</th>
                  <th className="px-3 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {classAtt.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-300 text-sm">No classes found.</td></tr>
                ) : classAtt.map(c => {
                  const pct = c.total_students > 0 ? Math.round((c.present / c.total_students) * 100) : 0;
                  const pctColor = pct >= 85 ? 'text-emerald-600 bg-emerald-50' : pct >= 70 ? 'text-amber-600 bg-amber-50' : 'text-rose-600 bg-rose-50';
                  return (
                    <tr key={c.class_id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5">
                        <p className="text-xs font-bold text-slate-800">{c.class_name}</p>
                        {c.section && <p className="text-[10px] text-slate-400">{c.section}</p>}
                      </td>
                      <td className="px-3 py-2.5 text-xs font-bold text-slate-500 text-center">{c.total_students}</td>
                      <td className="px-3 py-2.5 text-xs font-black text-emerald-600 text-center">{c.present}</td>
                      <td className="px-3 py-2.5 text-xs font-black text-rose-500 text-center">{c.absent}</td>
                      <td className="px-3 py-2.5 text-xs font-black text-amber-500 text-center">{c.leave}</td>
                      <td className="px-3 py-2.5 text-center">
                        {c.marked ? (
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${pctColor}`}>{pct}%</span>
                        ) : (
                          <span className="text-[10px] text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {c.marked
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                          : <span className="text-[10px] font-bold text-rose-400 bg-rose-50 px-2 py-0.5 rounded-full">Not Marked</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Summary bar */}
          {classAtt.length > 0 && (
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 text-xs">
                <span className="font-bold text-slate-600">School Total:</span>
                <span className="font-black text-emerald-600">{totalPresent} Present</span>
                <span className="font-black text-rose-500">{classAtt.reduce((s, c) => s + c.absent, 0)} Absent</span>
              </div>
              <div className={cn(
                "text-sm font-black px-3 py-1 rounded-lg",
                attPct >= 85 ? "bg-emerald-100 text-emerald-700" : attPct >= 70 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"
              )}>{attPct}%</div>
            </div>
          )}
        </div>

        {/* Diary Submission Status */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">Diary Status</h2>
              <span className="text-[10px] font-bold text-slate-400">{formatDate(today)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                {diarySubmitted} submitted
              </span>
              <span className="text-[10px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">
                {diaryRows.length - diarySubmitted} pending
              </span>
              <button
                onClick={handlePrintDiary}
                title="Download PDF"
                className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-black text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
              >
                <Printer className="w-3 h-3" /> PDF
              </button>
            </div>
          </div>
          <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
            {diaryRows.length === 0 ? (
              <div className="px-4 py-10 text-center text-slate-300 text-sm">No timetable data available.</div>
            ) : diaryRows.map(row => (
              <div key={row.staff_id} className={cn(
                "flex items-center gap-3 px-4 py-3",
                row.submitted ? "bg-white" : "bg-rose-50/30"
              )}>
                <div className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm font-black",
                  row.submitted ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-500"
                )}>
                  {row.submitted ? <CheckCheck className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">{row.staff_name}</p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {row.class_name} · {row.subject_name}
                    {row.topic && <span className="text-slate-500 italic"> — {row.topic}</span>}
                  </p>
                </div>
                {row.submitted
                  ? <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">Submitted</span>
                  : <span className="text-[9px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full shrink-0">Pending</span>}
              </div>
            ))}
          </div>
          {diaryRows.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-100 bg-slate-50">
              <div className="w-full bg-slate-200 rounded-full h-1.5">
                <div
                  className={cn("h-1.5 rounded-full transition-all", diarySubmitted === diaryRows.length ? "bg-emerald-500" : "bg-indigo-500")}
                  style={{ width: `${diaryRows.length > 0 ? Math.round((diarySubmitted / diaryRows.length) * 100) : 0}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1 text-right font-bold">
                {diaryRows.length > 0 ? Math.round((diarySubmitted / diaryRows.length) * 100) : 0}% completion
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Timetable ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-purple-600" />
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">School Timetable</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Class filter */}
            <select
              value={ttClassFilter}
              onChange={e => setTtClassFilter(e.target.value)}
              className="text-[10px] font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-purple-300"
            >
              <option value="">All Classes</option>
              {ttClasses.map(c => (
                <option key={`${c.name}|||${c.section}`} value={`${c.name}|||${c.section}`}>
                  {c.name}{c.section ? ` (${c.section})` : ''}
                </option>
              ))}
            </select>
            {/* Day tabs */}
            <div className="flex bg-slate-100 p-0.5 rounded-xl gap-0.5 overflow-x-auto">
              {DAYS.map(d => (
                <button
                  key={d}
                  onClick={() => { setActiveDay(d); setTtClassFilter(''); }}
                  className={cn(
                    "px-3 py-1.5 text-[10px] font-black rounded-lg transition-all whitespace-nowrap",
                    activeDay === d
                      ? "bg-white text-purple-700 shadow-sm"
                      : d === todayName
                      ? "text-purple-500 hover:text-purple-700"
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {DAY_SHORT[d]}
                  {d === todayName && <span className="ml-1 w-1 h-1 rounded-full bg-purple-500 inline-block mb-0.5" />}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          {filteredDaySlots.length === 0 ? (
            <div className="px-4 py-12 text-center text-slate-300 text-sm">
              {daySlots.length === 0
                ? `No classes scheduled for ${activeDay}.`
                : 'No classes match the selected filter.'}
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest w-24">Period / Time</th>
                  <th className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Class</th>
                  <th className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Subject</th>
                  <th className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Teacher</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {periods.map(period => {
                  const slots = filteredDaySlots.filter(s => s.period_number === period);
                  const live  = slots.some(s => isLive(s.start_time, s.end_time));
                  return slots.map((slot, idx) => (
                    <tr
                      key={`${period}-${idx}`}
                      className={cn(
                        "transition-colors",
                        live
                          ? "bg-purple-50 border-l-4 border-l-purple-500"
                          : "hover:bg-slate-50"
                      )}
                    >
                      {idx === 0 && (
                        <td rowSpan={slots.length} className="px-4 py-2.5 text-center align-top">
                          <span className={cn(
                            "w-8 h-8 rounded-xl text-xs font-black flex items-center justify-center mx-auto",
                            live ? "bg-purple-600 text-white" : "bg-purple-100 text-purple-700"
                          )}>
                            {period}
                          </span>
                          {slot.start_time && (
                            <p className="text-[9px] text-slate-400 mt-1 whitespace-nowrap">
                              {fmtTime(slot.start_time)}
                            </p>
                          )}
                          {slot.end_time && (
                            <p className="text-[9px] text-slate-400 whitespace-nowrap">
                              {fmtTime(slot.end_time)}
                            </p>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-2.5">
                        <span className="text-xs font-bold text-slate-800">{slot.class_name}</span>
                        {slot.section && <span className="text-[10px] text-slate-400 ml-1">({slot.section})</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={cn(
                          "text-xs font-bold px-2 py-0.5 rounded-lg",
                          live ? "text-purple-700 bg-purple-100" : "text-indigo-600 bg-indigo-50"
                        )}>{slot.subject_name}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs font-bold text-slate-600">{slot.teacher_name}</span>
                        {live && (
                          <span className="ml-2 inline-flex items-center gap-0.5 text-[9px] font-black text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded-full">
                            <Radio className="w-2.5 h-2.5" /> LIVE
                          </span>
                        )}
                      </td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="px-5 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <p className="text-[10px] text-slate-400 font-bold">{filteredDaySlots.length} classes scheduled on {activeDay}</p>
          <Link to="/timetable" className="flex items-center gap-1 text-[10px] font-black text-purple-600 hover:underline">
            Full Timetable <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* ── Leave Requests + Upcoming Exams ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Pending Leave Requests */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarOff className="w-4 h-4 text-amber-600" />
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">Pending Leave</h2>
              {leaves.length > 0 && (
                <span className="text-[10px] font-black text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">{leaves.length}</span>
              )}
            </div>
            <Link to="/leave/staff" className="flex items-center gap-1 text-[10px] font-black text-amber-600 hover:underline">
              All Leaves <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {leaves.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <CalendarOff className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-slate-300 text-sm font-bold">No pending leave requests</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {leaves.map(lv => (
                <div key={lv.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                    <Briefcase className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-slate-800">{lv.staff_name}</p>
                    <p className="text-[10px] text-slate-500">
                      <span className="font-bold text-amber-600">{lv.leave_type}</span>
                      {' · '}{formatDate(lv.from_date)} → {formatDate(lv.to_date)}
                      {' · '}<span className="font-bold">{lv.total_days}d</span>
                    </p>
                    {lv.reason && <p className="text-[10px] text-slate-400 italic truncate mt-0.5">{lv.reason}</p>}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => handleLeave(lv.id, 'approved')}
                      disabled={leaveSaving === lv.id}
                      className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg transition-colors disabled:opacity-50"
                      title="Approve"
                    >
                      {leaveSaving === lv.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => handleLeave(lv.id, 'rejected')}
                      disabled={leaveSaving === lv.id}
                      className="p-1.5 bg-rose-100 hover:bg-rose-200 text-rose-600 rounded-lg transition-colors disabled:opacity-50"
                      title="Reject"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Exams */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">Upcoming Exams</h2>
            </div>
            <Link to="/result/exam-schedule" className="flex items-center gap-1 text-[10px] font-black text-indigo-600 hover:underline">
              Full Schedule <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {exams.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <Award className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-slate-300 text-sm font-bold">No upcoming exams scheduled</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {exams.map(ex => {
                const daysLeft = Math.ceil((new Date(ex.exam_date).getTime() - new Date().getTime()) / 86400000);
                return (
                  <div key={ex.id} className="flex items-center gap-3 px-4 py-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 text-center",
                      daysLeft === 0 ? "bg-rose-100 text-rose-700" : daysLeft <= 3 ? "bg-amber-100 text-amber-700" : "bg-indigo-50 text-indigo-700"
                    )}>
                      <span className="text-xs font-black leading-none">{new Date(ex.exam_date).getDate()}</span>
                      <span className="text-[8px] font-bold uppercase">
                        {new Date(ex.exam_date).toLocaleString('default', { month: 'short' })}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-slate-800 truncate">{ex.subject_name}</p>
                      <p className="text-[10px] text-slate-400">
                        <span className="font-bold text-indigo-600">{ex.exam_type}</span>
                        {' · '}{ex.class_name}
                        {ex.start_time && ` · ${ex.start_time}`}
                      </p>
                    </div>
                    <span className={cn(
                      "text-[9px] font-black px-2 py-0.5 rounded-full shrink-0",
                      daysLeft === 0 ? "bg-rose-100 text-rose-600" :
                      daysLeft <= 3 ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-500"
                    )}>
                      {daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft}d`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* ── Quick Links ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Mark Attendance',   path: '/attendance',              icon: CalendarCheck, color: 'bg-teal-50 text-teal-700 border-teal-100 hover:border-teal-300'    },
          { label: 'Results & Exams',   path: '/result',                  icon: Award,         color: 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:border-indigo-300' },
          { label: 'Student List',      path: '/students',                icon: GraduationCap, color: 'bg-blue-50 text-blue-700 border-blue-100 hover:border-blue-300'     },
          { label: 'Reports',           path: '/reports/master-summary',  icon: BarChart3,     color: 'bg-purple-50 text-purple-700 border-purple-100 hover:border-purple-300' },
        ].map(({ label, path, icon: Icon, color }) => (
          <Link key={path} to={path}
            className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all group ${color}`}>
            <Icon className="w-5 h-5 shrink-0" />
            <span className="text-xs font-black">{label}</span>
            <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-40 group-hover:opacity-100 transition-opacity" />
          </Link>
        ))}
      </div>

    </div>
  );
}
