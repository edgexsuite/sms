import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  CalendarDays,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download,
  Printer,
  Search,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Send,
  Sparkles,
  Layers,
  GraduationCap,
  ArrowUpRight,
  Filter,
  Check,
  X,
  RefreshCw,
} from 'lucide-react';
import { Card, Btn } from '../../components/ui';
import { cn } from '../../lib/utils';

// Helper: Dates
const toLocalDateStr = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getWeekRange = (dateStr: string) => {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMon);

  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);

  return {
    start: toLocalDateStr(monday),
    end: toLocalDateStr(saturday),
    label: `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${saturday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
  };
};

interface TeacherSubmissionSummary {
  staff_id: string;
  full_name: string;
  role: string;
  phone?: string;
  assigned_slots: {
    class_id: string;
    class_name: string;
    section: string;
    subject_id: string;
    subject_name: string;
  }[];
  submitted_subjects_count: number;
  total_subjects_count: number;
  total_topics_planned: number;
  has_learning_outcomes: boolean;
  status: 'submitted' | 'partial' | 'pending';
  last_updated_at?: string;
  plans_detail: Record<string, any>;
}

interface ClassSubmissionSummary {
  class_id: string;
  class_name: string;
  section: string;
  class_teacher_name?: string;
  subjects: {
    subject_id: string;
    subject_name: string;
    teacher_id?: string;
    teacher_name: string;
    teacher_phone?: string;
    is_submitted: boolean;
    topics_count: number;
    unit_chapter?: string;
    learning_outcomes?: string;
    last_updated_at?: string;
  }[];
  submitted_count: number;
  total_count: number;
  completion_pct: number;
}

export default function PlannerReport() {
  const { userRole } = useAuth();
  const navigate = useNavigate();

  // State
  const [baseDate, setBaseDate] = useState(toLocalDateStr(new Date()));
  const [viewMode, setViewMode] = useState<'teacher' | 'class' | 'matrix'>('teacher');
  const [filterStatus, setFilterStatus] = useState<'all' | 'submitted' | 'pending'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Data
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [allStaff, setAllStaff] = useState<any[]>([]);
  const [allClasses, setAllClasses] = useState<any[]>([]);
  const [allSubjects, setAllSubjects] = useState<any[]>([]);
  const [allTimetableSlots, setAllTimetableSlots] = useState<any[]>([]);
  const [formRecords, setFormRecords] = useState<any[]>([]);

  // Computed Current Week Range
  const activeRange = useMemo(() => getWeekRange(baseDate), [baseDate]);

  const shiftPeriod = (weeksDelta: number) => {
    const d = new Date(baseDate + 'T00:00:00');
    d.setDate(d.getDate() + weeksDelta * 7);
    setBaseDate(toLocalDateStr(d));
  };

  // ─── Fetch All Metadata & Saved Form Data ──────────────────────────────────
  const fetchReportData = useCallback(async () => {
    if (!userRole?.school_id) return;
    setLoading(true);

    try {
      const periodId = `weekly_${activeRange.start}_${activeRange.end}`;

      const [
        { data: sch },
        { data: staff },
        { data: cls },
        { data: subs },
        { data: slots },
        { data: forms },
      ] = await Promise.all([
        supabase.from('schools').select('*').eq('id', userRole.school_id).single(),
        supabase.from('staff').select('id, full_name, role, phone, is_active').eq('school_id', userRole.school_id).eq('is_active', true).eq('is_deleted', false).order('full_name'),
        supabase.from('classes').select('id, name, section, class_teacher_id').eq('school_id', userRole.school_id).order('name'),
        supabase.from('subjects').select('id, subject_name, class_id, teacher_id').eq('school_id', userRole.school_id),
        supabase.from('timetable_slots').select('id, class_id, subject_id, teacher_id').eq('school_id', userRole.school_id),
        supabase.from('form_settings').select('id, form_name, sections_config, created_at, updated_at').eq('school_id', userRole.school_id).ilike('form_name', `%planner%${periodId}%`),
      ]);

      if (sch) setSchoolInfo(sch);
      if (staff) setAllStaff(staff);
      if (cls) setAllClasses(cls);
      if (subs) setAllSubjects(subs);
      if (slots) setAllTimetableSlots(slots);
      if (forms) setFormRecords(forms);
    } catch (err) {
      console.error('Error fetching planner report data:', err);
    } finally {
      setLoading(false);
    }
  }, [userRole?.school_id, activeRange.start, activeRange.end]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // ─── Compile Merged Plan Lookup Map for Active Week ─────────────────────────
  const activeWeekPlansMap = useMemo(() => {
    const map: Record<string, any> = {};
    formRecords.forEach(row => {
      const plans = row.sections_config?.plans || {};
      Object.entries(plans).forEach(([key, planVal]) => {
        if (planVal && typeof planVal === 'object') {
          map[key] = {
            ...(map[key] || {}),
            ...planVal,
            days: {
              ...(map[key]?.days || {}),
              ...(planVal as any)?.days || {},
            },
          };
        }
      });
    });
    return map;
  }, [formRecords]);

  // ─── Build Teacher Submission Summaries ────────────────────────────────────
  const teacherSummaries: TeacherSubmissionSummary[] = useMemo(() => {
    // Determine teaching staff (staff assigned in timetable slots or subjects)
    const activeTeachers = allStaff.filter(st => {
      const isTeacherRole = ['teacher', 'faculty', 'instructor', 'coordinator'].some(r => (st.role || '').toLowerCase().includes(r));
      const hasSlots = allTimetableSlots.some(s => s.teacher_id === st.id);
      const hasSubs = allSubjects.some(s => s.teacher_id === st.id);
      return isTeacherRole || hasSlots || hasSubs;
    });

    return activeTeachers.map(teacher => {
      // Find assigned teaching slots
      const slotMap = new Map<string, { class_id: string; class_name: string; section: string; subject_id: string; subject_name: string }>();

      // From Timetable
      allTimetableSlots.filter(s => s.teacher_id === teacher.id).forEach(s => {
        const cls = allClasses.find(c => c.id === s.class_id);
        const sub = allSubjects.find(sub => sub.id === s.subject_id);
        if (s.class_id && s.subject_id && sub) {
          const key = `${s.class_id}__${s.subject_id}`;
          slotMap.set(key, {
            class_id: s.class_id,
            class_name: cls?.name || 'Class',
            section: cls?.section || '',
            subject_id: s.subject_id,
            subject_name: sub?.subject_name || 'Subject',
          });
        }
      });

      // From Direct Subject Assignment
      allSubjects.filter(s => s.teacher_id === teacher.id).forEach(s => {
        const cls = allClasses.find(c => c.id === s.class_id);
        if (s.class_id && s.id) {
          const key = `${s.class_id}__${s.id}`;
          if (!slotMap.has(key)) {
            slotMap.set(key, {
              class_id: s.class_id,
              class_name: cls?.name || 'Class',
              section: cls?.section || '',
              subject_id: s.id,
              subject_name: s.subject_name || 'Subject',
            });
          }
        }
      });

      const assignedSlots = Array.from(slotMap.values());

      let submittedCount = 0;
      let totalTopics = 0;
      let hasSLOs = false;
      let lastUpdated: string | undefined = undefined;
      const plansDetail: Record<string, any> = {};

      assignedSlots.forEach(slot => {
        const key = `${slot.class_id}__${slot.subject_id}`;
        const plan = activeWeekPlansMap[key];

        if (plan) {
          plansDetail[key] = plan;
          const daysWithContent = Object.values(plan.days || {}).filter((d: any) => d.topic || d.classwork || d.homework || d.quiz_test);
          if (daysWithContent.length > 0 || plan.unit_chapter) {
            submittedCount++;
            totalTopics += daysWithContent.length;
            if (plan.learning_outcomes) hasSLOs = true;
            if (plan.updated_at && (!lastUpdated || plan.updated_at > lastUpdated)) {
              lastUpdated = plan.updated_at;
            }
          }
        }
      });

      let status: 'submitted' | 'partial' | 'pending' = 'pending';
      if (assignedSlots.length > 0) {
        if (submittedCount === assignedSlots.length && submittedCount > 0) {
          status = 'submitted';
        } else if (submittedCount > 0) {
          status = 'partial';
        }
      }

      return {
        staff_id: teacher.id,
        full_name: teacher.full_name,
        role: teacher.role || 'Teacher',
        phone: teacher.phone,
        assigned_slots: assignedSlots,
        submitted_subjects_count: submittedCount,
        total_subjects_count: assignedSlots.length,
        total_topics_planned: totalTopics,
        has_learning_outcomes: hasSLOs,
        status,
        last_updated_at: lastUpdated,
        plans_detail: plansDetail,
      };
    });
  }, [allStaff, allTimetableSlots, allSubjects, allClasses, activeWeekPlansMap]);

  // ─── Build Class Submission Summaries ──────────────────────────────────────
  const classSummaries: ClassSubmissionSummary[] = useMemo(() => {
    return allClasses.map(cls => {
      const clsTeacher = allStaff.find(s => s.id === cls.class_teacher_id);
      const classSubs = allSubjects.filter(s => s.class_id === cls.id);

      const subjectsData = classSubs.map(sub => {
        // Find assigned teacher
        let teacher = allStaff.find(s => s.id === sub.teacher_id);
        if (!teacher) {
          const slot = allTimetableSlots.find(s => s.class_id === cls.id && s.subject_id === sub.id && s.teacher_id);
          if (slot) teacher = allStaff.find(s => s.id === slot.teacher_id);
        }

        const key = `${cls.id}__${sub.id}`;
        const plan = activeWeekPlansMap[key];
        const daysWithContent = Object.values(plan?.days || {}).filter((d: any) => d.topic || d.classwork || d.homework || d.quiz_test);
        const isSubmitted = daysWithContent.length > 0 || !!plan?.unit_chapter;

        return {
          subject_id: sub.id,
          subject_name: sub.subject_name,
          teacher_id: teacher?.id,
          teacher_name: teacher?.full_name || 'Unassigned',
          teacher_phone: teacher?.phone,
          is_submitted: isSubmitted,
          topics_count: daysWithContent.length,
          unit_chapter: plan?.unit_chapter,
          learning_outcomes: plan?.learning_outcomes,
          last_updated_at: plan?.updated_at,
        };
      });

      const submittedCount = subjectsData.filter(s => s.is_submitted).length;
      const totalCount = subjectsData.length;
      const completionPct = totalCount > 0 ? Math.round((submittedCount / totalCount) * 100) : 0;

      return {
        class_id: cls.id,
        class_name: cls.name,
        section: cls.section || '',
        class_teacher_name: clsTeacher?.full_name || 'Not Appointed',
        subjects: subjectsData,
        submitted_count: submittedCount,
        total_count: totalCount,
        completion_pct: completionPct,
      };
    });
  }, [allClasses, allSubjects, allStaff, allTimetableSlots, activeWeekPlansMap]);

  // ─── Filtered Data Lists ───────────────────────────────────────────────────
  const filteredTeachers = useMemo(() => {
    return teacherSummaries.filter(t => {
      const matchSearch = t.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.assigned_slots.some(s => s.subject_name.toLowerCase().includes(searchQuery.toLowerCase()) || s.class_name.toLowerCase().includes(searchQuery.toLowerCase()));
      if (!matchSearch) return false;
      if (filterStatus === 'submitted') return t.status === 'submitted';
      if (filterStatus === 'pending') return t.status === 'pending' || t.status === 'partial';
      return true;
    });
  }, [teacherSummaries, searchQuery, filterStatus]);

  const filteredClasses = useMemo(() => {
    return classSummaries.filter(c => {
      const matchSearch = c.class_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.section.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.subjects.some(s => s.subject_name.toLowerCase().includes(searchQuery.toLowerCase()) || s.teacher_name.toLowerCase().includes(searchQuery.toLowerCase()));
      if (!matchSearch) return false;
      if (filterStatus === 'submitted') return c.completion_pct === 100;
      if (filterStatus === 'pending') return c.completion_pct < 100;
      return true;
    });
  }, [classSummaries, searchQuery, filterStatus]);

  // ─── Executive KPI Metrics ─────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalTeachers = teacherSummaries.length;
    const submittedTeachers = teacherSummaries.filter(t => t.status === 'submitted').length;
    const partialTeachers = teacherSummaries.filter(t => t.status === 'partial').length;
    const pendingTeachers = teacherSummaries.filter(t => t.status === 'pending').length;

    const totalSubjects = teacherSummaries.reduce((acc, t) => acc + t.total_subjects_count, 0);
    const submittedSubjects = teacherSummaries.reduce((acc, t) => acc + t.submitted_subjects_count, 0);
    const totalTopics = teacherSummaries.reduce((acc, t) => acc + t.total_topics_planned, 0);

    const complianceRate = totalTeachers > 0 ? Math.round(((submittedTeachers + partialTeachers * 0.5) / totalTeachers) * 100) : 0;

    return {
      totalTeachers,
      submittedTeachers,
      partialTeachers,
      pendingTeachers,
      totalSubjects,
      submittedSubjects,
      totalTopics,
      complianceRate,
    };
  }, [teacherSummaries]);

  // ─── WhatsApp Reminder Generator ──────────────────────────────────────────
  const sendWhatsAppReminder = (teacher: TeacherSubmissionSummary) => {
    const phone = teacher.phone ? teacher.phone.replace(/[^0-9]/g, '') : '';
    const cleanPhone = phone.startsWith('0') ? '92' + phone.slice(1) : phone.startsWith('92') ? phone : '92' + phone;

    const message = encodeURIComponent(
      `Assalam-o-Alaikum ${teacher.full_name} Sahib/Madam,\n\n` +
      `This is a gentle reminder from *${schoolInfo?.name || 'School Administration'}* regarding the *Curriculum & Lesson Planner* for the week of *${activeRange.label}*.\n\n` +
      `Your current submission status is: *${teacher.status.toUpperCase()}* (${teacher.submitted_subjects_count}/${teacher.total_subjects_count} Subjects Filled).\n\n` +
      `Kindly log in to the School Portal and finalize your lesson plans.\n\n` +
      `Portal Link: ${window.location.origin}/diary/planner\n\n` +
      `Thank you for your dedication to academic excellence.`
    );

    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
  };

  // ─── Export to Excel (.xlsx) ────────────────────────────────────────────────
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // 1. Teacher Compliance Sheet
    const teacherData = teacherSummaries.map(t => ({
      'Teacher Name': t.full_name,
      'Designation / Role': t.role,
      'Contact Phone': t.phone || 'N/A',
      'Assigned Subjects': t.assigned_slots.map(s => `${s.subject_name} (${s.class_name} ${s.section})`).join(', '),
      'Total Assigned': t.total_subjects_count,
      'Submitted Subjects': t.submitted_subjects_count,
      'Submission Status': t.status.toUpperCase(),
      'Total Days/Topics Planned': t.total_topics_planned,
      'Learning Outcomes Added': t.has_learning_outcomes ? 'YES' : 'NO',
      'Last Updated': t.last_updated_at ? new Date(t.last_updated_at).toLocaleString() : 'Not updated',
    }));
    const wsTeacher = XLSX.utils.json_to_sheet(teacherData);
    XLSX.utils.book_append_sheet(wb, wsTeacher, 'Teacher Compliance');

    // 2. Class Coverage Sheet
    const classData: any[] = [];
    classSummaries.forEach(c => {
      c.subjects.forEach(s => {
        classData.push({
          'Class': `${c.class_name} ${c.section}`.trim(),
          'Class Teacher': c.class_teacher_name,
          'Subject': s.subject_name,
          'Subject Teacher': s.teacher_name,
          'Status': s.is_submitted ? 'SUBMITTED' : 'PENDING',
          'Unit / Chapter': s.unit_chapter || '—',
          'Learning Outcomes': s.learning_outcomes || '—',
          'Teaching Days Planned': s.topics_count,
        });
      });
    });
    const wsClass = XLSX.utils.json_to_sheet(classData);
    XLSX.utils.book_append_sheet(wb, wsClass, 'Class Subject Plans');

    XLSX.writeFile(wb, `Lesson_Planner_Audit_Report_${activeRange.start}_to_${activeRange.end}.xlsx`);
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-4">
      {/* ── Print Stylesheet ── */}
      <style>{`
        .urdu-text { font-family: 'Noto Nastaliq Urdu', 'Inter', serif !important; unicode-bidi: plaintext; text-align: start; }
        @media print {
          body { background: white !important; margin: 0 !important; padding: 0 !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; width: 100% !important; }
          @page { size: landscape; margin: 6mm; }
          table { width: 100% !important; border-collapse: collapse !important; }
          th, td { border: 1px solid #cbd5e1 !important; padding: 4px 6px !important; }
        }
        .print-only { display: none; }
      `}</style>

      {/* ── Control Header ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm no-print">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-100">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              Lesson Planner Compliance &amp; Audit Report
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-black tracking-widest uppercase">
                Audit Matrix
              </span>
            </h1>
            <p className="text-xs text-slate-500 font-bold">
              Track teacher planner submissions, syllabus coverage, and class completion rate
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Btn
            variant="outline"
            size="sm"
            onClick={() => navigate('/diary/planner')}
            className="text-xs h-9 px-3 border-slate-200 font-bold"
          >
            <BookOpen className="w-4 h-4 mr-1.5 text-indigo-600" />
            ✍️ Open Planner Editor
          </Btn>

          <Btn
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            className="text-xs h-9 px-3 border-emerald-300 text-emerald-700 bg-emerald-50/50 hover:bg-emerald-100 font-bold"
          >
            <Download className="w-4 h-4 mr-1.5 text-emerald-600" />
            📊 Export Excel (.xlsx)
          </Btn>

          <Btn
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="text-xs h-9 px-3 border-slate-300 font-bold"
          >
            <Printer className="w-4 h-4 mr-1.5 text-slate-600" />
            🖨️ Print Gazette
          </Btn>

          <Btn
            variant="primary"
            size="sm"
            onClick={fetchReportData}
            disabled={loading}
            className="text-xs h-9 px-3 bg-emerald-600 hover:bg-emerald-700"
          >
            <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', loading && 'animate-spin')} />
            Refresh
          </Btn>
        </div>
      </div>

      {/* ── Executive KPI Metric Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 no-print">
        {/* Compliance Rate */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Submission Rate</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <b className="text-2xl font-black text-slate-900">{stats.complianceRate}%</b>
              <span className={cn('text-xs font-bold', stats.complianceRate >= 80 ? 'text-emerald-600' : 'text-amber-600')}>
                {stats.submittedTeachers}/{stats.totalTeachers} Faculty
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>

        {/* Fully Submitted */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider block">Completed Planners</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <b className="text-2xl font-black text-emerald-700">{stats.submittedTeachers}</b>
              <span className="text-xs font-bold text-slate-400">Teachers</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100/60 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Pending Submissions */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-rose-500 uppercase tracking-wider block">Pending / Defaulters</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <b className="text-2xl font-black text-rose-600">{stats.pendingTeachers + stats.partialTeachers}</b>
              <span className="text-xs font-bold text-slate-400">Needs Followup</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        {/* Total Topics Planned */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-wider block">Teaching Days Planned</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <b className="text-2xl font-black text-indigo-700">{stats.totalTopics}</b>
              <span className="text-xs font-bold text-slate-400">Lessons Logged</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ── Filters & Perspective Switcher Bar ── */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm no-print space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Perspective Switcher */}
          <div className="bg-slate-100 p-1 rounded-xl flex gap-1 border border-slate-200 shrink-0">
            <button
              onClick={() => setViewMode('teacher')}
              className={cn(
                'px-4 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 uppercase tracking-wider',
                viewMode === 'teacher' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <Users className="w-3.5 h-3.5" /> Teacher View
            </button>
            <button
              onClick={() => setViewMode('class')}
              className={cn(
                'px-4 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 uppercase tracking-wider',
                viewMode === 'class' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <GraduationCap className="w-3.5 h-3.5" /> Class View
            </button>
          </div>

          {/* Week Date Navigator Strip */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 shrink-0">
            <button
              onClick={() => shiftPeriod(-1)}
              className="p-1 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
              title="Previous Week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-center min-w-[200px]">
              <span className="text-xs font-black text-slate-900 uppercase tracking-tight block">
                Week: {activeRange.label}
              </span>
              <span className="text-[9px] font-bold text-slate-400">
                {activeRange.start} to {activeRange.end}
              </span>
            </div>
            <button
              onClick={() => shiftPeriod(1)}
              className="p-1 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
              title="Next Week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Status Filter Buttons */}
          <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200 shrink-0">
            {(['all', 'submitted', 'pending'] as ('all' | 'submitted' | 'pending')[]).map(st => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={cn(
                  'px-3 py-1 rounded-lg text-[11px] font-black uppercase transition-all',
                  filterStatus === st ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500 hover:text-slate-800'
                )}
              >
                {st === 'all' ? 'All' : st === 'submitted' ? '✅ Submitted' : '❌ Pending'}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search teacher, class, subject..."
              className="w-full pl-8 pr-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
            />
          </div>
        </div>
      </div>

      {/* ── Main Report Content ── */}
      {loading ? (
        <Card className="py-20 flex flex-col items-center justify-center shadow-sm border-slate-100 no-print">
          <div className="w-10 h-10 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-4">Generating Compliance Audit...</p>
        </Card>
      ) : viewMode === 'teacher' ? (
        /* ── Teacher View Table ── */
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden no-print">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-black text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Faculty Member</th>
                  <th className="py-3 px-4">Assigned Subjects &amp; Classes</th>
                  <th className="py-3 px-4 text-center">Coverage</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">SLOs</th>
                  <th className="py-3 px-4">Last Updated</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium">
                {filteredTeachers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-bold">
                      No matching faculty records found for this filter.
                    </td>
                  </tr>
                ) : (
                  filteredTeachers.map(teacher => {
                    const isCompleted = teacher.status === 'submitted';
                    const isPartial = teacher.status === 'partial';

                    return (
                      <tr key={teacher.staff_id} className="hover:bg-slate-50/60 transition-colors">
                        {/* Teacher Info */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className={cn(
                              'w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0',
                              isCompleted ? 'bg-emerald-100 text-emerald-800' : isPartial ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                            )}>
                              {teacher.full_name.charAt(0)}
                            </div>
                            <div>
                              <b className="text-slate-900 font-black block text-xs leading-tight">{teacher.full_name}</b>
                              <span className="text-[10px] font-bold text-slate-400">{teacher.role}</span>
                            </div>
                          </div>
                        </td>

                        {/* Assigned Subjects Badges */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1.5 max-w-md">
                            {teacher.assigned_slots.length === 0 ? (
                              <span className="text-[10px] text-slate-400 italic">No assigned subjects</span>
                            ) : (
                              teacher.assigned_slots.map(s => {
                                const key = `${s.class_id}__${s.subject_id}`;
                                const isFilled = !!teacher.plans_detail[key];
                                return (
                                  <span
                                    key={key}
                                    className={cn(
                                      'px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1',
                                      isFilled
                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                        : 'bg-slate-50 border-slate-200 text-slate-500'
                                    )}
                                  >
                                    {isFilled ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <X className="w-2.5 h-2.5 text-slate-400" />}
                                    {s.subject_name} ({s.class_name})
                                  </span>
                                );
                              })
                            )}
                          </div>
                        </td>

                        {/* Coverage Count */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-xs font-black text-slate-900">
                              {teacher.submitted_subjects_count} / {teacher.total_subjects_count}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400">
                              {teacher.total_topics_planned} Lessons
                            </span>
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={cn(
                              'px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1',
                              isCompleted
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : isPartial
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            )}
                          >
                            {isCompleted ? <CheckCircle2 className="w-3 h-3" /> : isPartial ? <Clock className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                            {teacher.status}
                          </span>
                        </td>

                        {/* SLOs Badge */}
                        <td className="py-3.5 px-4 text-center">
                          {teacher.has_learning_outcomes ? (
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[10px] font-black">
                              Defined
                            </span>
                          ) : (
                            <span className="text-slate-300 text-[10px] font-bold">—</span>
                          )}
                        </td>

                        {/* Last Updated */}
                        <td className="py-3.5 px-4">
                          <span className="text-[10px] font-bold text-slate-500 block">
                            {teacher.last_updated_at ? new Date(teacher.last_updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Pending'}
                          </span>
                        </td>

                        {/* Action Buttons */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Btn
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/diary/planner`)}
                              className="text-[10px] h-7 px-2.5 font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                              title="Open Planner"
                            >
                              <ArrowUpRight className="w-3 h-3 mr-1" /> View Plan
                            </Btn>

                            {!isCompleted && teacher.phone && (
                              <button
                                onClick={() => sendWhatsAppReminder(teacher)}
                                className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 flex items-center justify-center transition shadow-xs"
                                title="Send WhatsApp Reminder"
                              >
                                <Send className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ── Class View Grid ── */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 no-print">
          {filteredClasses.map(cls => (
            <div key={cls.class_id} className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 space-y-3">
              {/* Class Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                    {cls.class_name} {cls.section}
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400">
                    Incharge: <span className="text-slate-700">{cls.class_teacher_name}</span>
                  </p>
                </div>

                <div className="text-right">
                  <span className={cn(
                    'px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider',
                    cls.completion_pct === 100
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : cls.completion_pct > 0
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  )}>
                    {cls.submitted_count} / {cls.total_count} ({cls.completion_pct}%)
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all duration-500 rounded-full',
                    cls.completion_pct === 100 ? 'bg-emerald-500' : cls.completion_pct > 0 ? 'bg-amber-500' : 'bg-rose-400'
                  )}
                  style={{ width: `${cls.completion_pct}%` }}
                />
              </div>

              {/* Subject Breakdown List */}
              <div className="space-y-1.5 pt-1">
                {cls.subjects.map(s => (
                  <div
                    key={s.subject_id}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-50/70 border border-slate-100 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 font-black',
                        s.is_submitted ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'
                      )}>
                        {s.is_submitted ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      </div>
                      <div>
                        <b className="text-slate-900 font-bold block leading-tight">{s.subject_name}</b>
                        <small className="text-[10px] text-slate-400">{s.teacher_name}</small>
                      </div>
                    </div>

                    <div className="text-right">
                      {s.is_submitted ? (
                        <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                          {s.topics_count} Days Logged
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-rose-500 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                          Pending
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── PRINT ONLY HIGH-DEFINITION AUDIT GAZETTE ── */}
      <div className="print-only">
        <div style={{ padding: '10px 20px', background: 'white' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', borderBottom: '2px solid #1e1b4b', paddingBottom: '8px', marginBottom: '12px' }}>
            {schoolInfo?.logo_url && (
              <img src={schoolInfo.logo_url} crossOrigin="anonymous" style={{ width: '45px', height: '45px', objectFit: 'contain', marginRight: '15px' }} alt="logo" />
            )}
            <div style={{ flexGrow: 1, textAlign: 'center' }}>
              <h1 style={{ fontSize: '18px', fontWeight: '900', color: '#1e1b4b', margin: 0, textTransform: 'uppercase' }}>
                {schoolInfo?.name || 'School Report'}
              </h1>
              <p style={{ fontSize: '10px', color: '#64748b', margin: '2px 0 0 0', fontWeight: '700' }}>
                LESSON PLANNER COMPLIANCE &amp; SUBMISSION AUDIT GAZETTE
              </p>
              <div style={{ marginTop: '4px' }}>
                <span style={{ background: '#1e1b4b', color: 'white', padding: '2px 16px', borderRadius: '50px', fontSize: '9px', fontWeight: '900' }}>
                  WEEK: {activeRange.label} (COMPLIANCE: {stats.complianceRate}%)
                </span>
              </div>
            </div>
            <div style={{ width: '45px' }} />
          </div>

          {/* Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #1e1b4b', fontSize: '9px' }}>
            <thead>
              <tr style={{ background: '#1e1b4b', color: 'white', fontWeight: '900', textTransform: 'uppercase' }}>
                <th style={{ border: '1px solid #cbd5e1', padding: '6px', width: '22%' }}>Teacher Name</th>
                <th style={{ border: '1px solid #cbd5e1', padding: '6px', width: '15%' }}>Designation</th>
                <th style={{ border: '1px solid #cbd5e1', padding: '6px', width: '33%' }}>Assigned Subjects</th>
                <th style={{ border: '1px solid #cbd5e1', padding: '6px', width: '10%', textAlign: 'center' }}>Status</th>
                <th style={{ border: '1px solid #cbd5e1', padding: '6px', width: '10%', textAlign: 'center' }}>Coverage</th>
                <th style={{ border: '1px solid #cbd5e1', padding: '6px', width: '10%', textAlign: 'center' }}>SLOs</th>
              </tr>
            </thead>
            <tbody>
              {teacherSummaries.map((t, idx) => (
                <tr key={idx} style={{ background: idx % 2 === 0 ? 'white' : '#f8fafc' }}>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px', fontWeight: '800' }}>{t.full_name}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{t.role}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>
                    {t.assigned_slots.map(s => `${s.subject_name} (${s.class_name})`).join(', ')}
                  </td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'center', fontWeight: '900', color: t.status === 'submitted' ? '#059669' : t.status === 'partial' ? '#d97706' : '#dc2626' }}>
                    {t.status.toUpperCase()}
                  </td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'center', fontWeight: '800' }}>
                    {t.submitted_subjects_count} / {t.total_subjects_count}
                  </td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'center' }}>
                    {t.has_learning_outcomes ? 'YES' : 'NO'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Signatures */}
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', margin: '40px 0 10px 0', pageBreakInside: 'avoid' }}>
            <div style={{ textAlign: 'center', width: '200px' }}>
              <div style={{ borderTop: '1.5px solid #1e1b4b', paddingTop: '6px', fontWeight: '900', color: '#1e1b4b', fontSize: '9px', textTransform: 'uppercase' }}>Academic Coordinator</div>
            </div>
            <div style={{ textAlign: 'center', width: '200px' }}>
              <div style={{ borderTop: '1.5px solid #1e1b4b', paddingTop: '6px', fontWeight: '900', color: '#1e1b4b', fontSize: '9px', textTransform: 'uppercase' }}>Vice Principal</div>
            </div>
            <div style={{ textAlign: 'center', width: '200px' }}>
              <div style={{ borderTop: '1.5px solid #1e1b4b', paddingTop: '6px', fontWeight: '900', color: '#1e1b4b', fontSize: '9px', textTransform: 'uppercase' }}>Principal / Director</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
