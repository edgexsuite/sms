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
  const isExecutive = ['admin', 'director', 'principal', 'vice_principal', 'academic_coordinator', 'campus_coordinator', 'section_coordinator'].includes(userRole?.role || '');

  // State
  const [baseDate, setBaseDate] = useState(toLocalDateStr(new Date()));
  const [viewMode, setViewMode] = useState<'teacher' | 'class'>('teacher');
  const [filterStatus, setFilterStatus] = useState<'all' | 'submitted' | 'pending'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [hideZeroSubjectStaff, setHideZeroSubjectStaff] = useState(true);
  const [loading, setLoading] = useState(false);

  // Plan Detail Modal State
  const [activePlanModal, setActivePlanModal] = useState<{
    teacherName: string;
    className: string;
    section: string;
    subjectName: string;
    plan: any;
  } | null>(null);

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

  const fetchReportData = useCallback(async () => {
    if (!userRole?.school_id) return;
    setLoading(true);
    const sid = userRole.school_id;

    try {
      const [schRes, staffRes, clsRes, subsRes, slotsRes, formsRes] = await Promise.allSettled([
        // School info
        supabase.from('schools').select('*').eq('id', sid).single(),
        // Staff — exclude deleted
        supabase.from('staff')
          .select('id, full_name, role')
          .eq('school_id', sid)
          .eq('is_deleted', false)
          .order('full_name'),
        // Classes
        supabase.from('classes').select('id, name, section, class_teacher_id').eq('school_id', sid).order('name'),
        // Subjects
        supabase.from('subjects').select('id, subject_name, class_id').eq('school_id', sid),
        // Timetable slots
        supabase.from('timetable_slots').select('id, class_id, subject_id, teacher_id').eq('school_id', sid),
        // lesson_plans for the selected week
        supabase.from('lesson_plans')
          .select('teacher_id, class_id, subject_id, unit_chapter, learning_outcomes, resources_needed, teacher_remarks, days, updated_at')
          .eq('school_id', sid)
          .eq('week_start', activeRange.start),
      ]);

      // School
      if (schRes.status === 'fulfilled' && schRes.value.data) {
        setSchoolInfo(schRes.value.data);
      }

      // Staff
      const staffList = (staffRes.status === 'fulfilled' ? staffRes.value.data : null) || [];
      const clsList = (clsRes.status === 'fulfilled' ? clsRes.value.data : null) || [];
      const subsList = (subsRes.status === 'fulfilled' ? subsRes.value.data : null) || [];
      const slotsList = (slotsRes.status === 'fulfilled' ? slotsRes.value.data : null) || [];
      const plansList = (formsRes.status === 'fulfilled' ? formsRes.value.data : null) || [];

      setAllStaff(staffList);
      setAllClasses(clsList);
      setAllSubjects(subsList);
      setAllTimetableSlots(slotsList);
      setFormRecords(plansList);

    } catch (err) {
      console.error('[PlannerReport] Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  }, [userRole?.school_id, activeRange.start, activeRange.end]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // ─── Quick Assign Class Incharge ──────────────────────────────────────────
  const handleAssignIncharge = async (classId: string, teacherId: string) => {
    try {
      const { error } = await supabase
        .from('classes')
        .update({ class_teacher_id: teacherId || null })
        .eq('id', classId)
        .eq('school_id', userRole?.school_id);

      if (error) throw error;
      fetchReportData();
    } catch (err: any) {
      alert('Error updating incharge: ' + err.message);
    }
  };

  // ─── Content Detection Helper ─────────────────────────────────────────────
  const isDayFilled = (d: any) => {
    if (!d || typeof d !== 'object') return false;
    return Boolean(
      (typeof d.topic === 'string' && d.topic.trim()) ||
      (typeof d.classwork === 'string' && d.classwork.trim()) ||
      (typeof d.homework === 'string' && d.homework.trim()) ||
      (typeof d.quiz_test === 'string' && d.quiz_test.trim())
    );
  };

  const isPlanFilled = (plan: any) => {
    if (!plan) return false;
    if (plan.unit_chapter && String(plan.unit_chapter).trim()) return true;
    if (plan.learning_outcomes && String(plan.learning_outcomes).trim()) return true;
    if (plan.resources_needed && String(plan.resources_needed).trim()) return true;
    if (plan.teacher_remarks && String(plan.teacher_remarks).trim()) return true;
    const daysArr = Object.values(plan.days || {});
    return daysArr.some(isDayFilled);
  };

  const countPlanDays = (plan: any) => {
    if (!plan?.days) return 0;
    return Object.values(plan.days).filter(isDayFilled).length;
  };

  // ─── Build Plan Lookup Maps from lesson_plans rows ───────────────────────────
  // Map 1: by class+subject (for class view)
  const activeWeekPlansMap = useMemo(() => {
    const map: Record<string, any> = {};
    formRecords.forEach((row: any) => {
      const key = `${row.class_id}__${row.subject_id}`;
      const existing = map[key];
      const newPlan = {
        unit_chapter: row.unit_chapter || '',
        learning_outcomes: row.learning_outcomes || '',
        resources_needed: row.resources_needed || '',
        teacher_remarks: row.teacher_remarks || '',
        days: row.days || {},
        updated_at: row.updated_at,
        teacher_id: row.teacher_id,
      };
      if (!existing || (!isPlanFilled(existing) && isPlanFilled(newPlan)) || (newPlan.updated_at && (!existing.updated_at || newPlan.updated_at > existing.updated_at))) {
        map[key] = newPlan;
      }
    });
    return map;
  }, [formRecords]);

  // Map 2: by teacher+class+subject (for teacher view — exact match)
  const teacherPlansMap = useMemo(() => {
    const map: Record<string, any> = {};
    formRecords.forEach((row: any) => {
      if (row.teacher_id) {
        const key = `${row.teacher_id}__${row.class_id}__${row.subject_id}`;
        map[key] = {
          unit_chapter: row.unit_chapter || '',
          learning_outcomes: row.learning_outcomes || '',
          resources_needed: row.resources_needed || '',
          teacher_remarks: row.teacher_remarks || '',
          days: row.days || {},
          updated_at: row.updated_at,
          teacher_id: row.teacher_id,
        };
      }
    });
    return map;
  }, [formRecords]);

  // ─── Build Teacher Submission Summaries ────────────────────────────────────
  const teacherSummaries: TeacherSubmissionSummary[] = useMemo(() => {
    const activeTeachers = allStaff.filter(st => {
      const roleStr = (st.role || '').toLowerCase();
      const nonTeachingRoles = ['driver', 'conductor', 'guard', 'security', 'peon', 'ayah', 'cleaner', 'sweeper', 'maid'];
      const isNonTeaching = nonTeachingRoles.some(r => roleStr.includes(r));
      const hasSlots = allTimetableSlots.some(s => s.teacher_id === st.id);
      const hasPlans = formRecords.some((r: any) => r.teacher_id === st.id);
      return !isNonTeaching || hasSlots || hasPlans;
    });

    return activeTeachers.map(teacher => {
      const slotMap = new Map<string, { class_id: string; class_name: string; section: string; subject_id: string; subject_name: string }>();

      // 1. From timetable slots
      allTimetableSlots
        .filter(s => s.teacher_id === teacher.id && s.class_id && s.subject_id)
        .forEach(s => {
          const key = `${s.class_id}__${s.subject_id}`;
          if (!slotMap.has(key)) {
            const cls = allClasses.find(c => c.id === s.class_id);
            const sub = allSubjects.find(sub => sub.id === s.subject_id);
            slotMap.set(key, {
              class_id: s.class_id,
              class_name: cls?.name || 'Class',
              section: cls?.section || '',
              subject_id: s.subject_id,
              subject_name: sub?.subject_name || 'Subject',
            });
          }
        });

      // 2. From actual lesson_plans entered by this teacher
      formRecords
        .filter((r: any) => r.teacher_id === teacher.id && r.class_id && r.subject_id)
        .forEach((r: any) => {
          const key = `${r.class_id}__${r.subject_id}`;
          if (!slotMap.has(key)) {
            const cls = allClasses.find(c => c.id === r.class_id);
            const sub = allSubjects.find(sub => sub.id === r.subject_id);
            slotMap.set(key, {
              class_id: r.class_id,
              class_name: cls?.name || 'Class',
              section: cls?.section || '',
              subject_id: r.subject_id,
              subject_name: sub?.subject_name || 'Subject',
            });
          }
        });

      const assignedSlots = Array.from(slotMap.values());

      let submittedCount = 0;
      let totalTopics = 0;
      let hasSLOs = false;
      let lastUpdated: string | undefined = undefined;
      const plansDetail: Record<string, any> = {};

      assignedSlots.forEach(slot => {
        const classSubKey = `${slot.class_id}__${slot.subject_id}`;
        const tKey = `${teacher.id}__${slot.class_id}__${slot.subject_id}`;
        const plan = teacherPlansMap[tKey] || activeWeekPlansMap[classSubKey];

        if (plan) {
          plansDetail[classSubKey] = plan;
          const daysCount = countPlanDays(plan);
          if (isPlanFilled(plan)) {
            submittedCount++;
            totalTopics += daysCount;
            if (plan.learning_outcomes && String(plan.learning_outcomes).trim()) hasSLOs = true;
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
        phone: undefined,
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
  }, [allStaff, allTimetableSlots, allSubjects, allClasses, activeWeekPlansMap, teacherPlansMap, formRecords]);

  // ─── Build Class Submission Summaries ──────────────────────────────────────
  const classSummaries: ClassSubmissionSummary[] = useMemo(() => {
    return allClasses.map(cls => {
      const clsTeacher = (cls as any).staff?.full_name || allStaff.find(s => s.id === cls.class_teacher_id)?.full_name;

      const subMap = new Map<string, {
        subject_id: string;
        subject_name: string;
        teacher_id?: string;
        teacher_name: string;
        teacher_phone?: string;
      }>();

      // 1. From Timetable Slots
      allTimetableSlots.filter(s => s.class_id === cls.id && s.subject_id).forEach(s => {
        const sub = allSubjects.find(sub => sub.id === s.subject_id);
        const teacher = allStaff.find(st => st.id === s.teacher_id);
        const subName = sub?.subject_name || 'Subject';
        const teacherName = teacher?.full_name || 'Unassigned';

        if (!subMap.has(s.subject_id)) {
          subMap.set(s.subject_id, {
            subject_id: s.subject_id,
            subject_name: subName,
            teacher_id: s.teacher_id,
            teacher_name: teacherName,
            teacher_phone: undefined,
          });
        } else if (s.teacher_id && subMap.get(s.subject_id)?.teacher_name === 'Unassigned') {
          const existing = subMap.get(s.subject_id)!;
          existing.teacher_id = s.teacher_id;
          existing.teacher_name = teacherName;
        }
      });

      // 2. From Subjects table
      allSubjects.filter(s => s.class_id === cls.id).forEach(sub => {
        if (!subMap.has(sub.id)) {
          subMap.set(sub.id, {
            subject_id: sub.id,
            subject_name: sub.subject_name,
            teacher_id: undefined,
            teacher_name: 'Unassigned',
            teacher_phone: undefined,
          });
        }
      });

      // 3. From actual Lesson Plans for this class
      formRecords.filter((r: any) => r.class_id === cls.id && r.subject_id).forEach((r: any) => {
        const teacher = allStaff.find(st => st.id === r.teacher_id);
        const sub = allSubjects.find(sub => sub.id === r.subject_id);
        const subName = sub?.subject_name || 'Subject';
        const teacherName = teacher?.full_name || 'Unassigned';

        if (!subMap.has(r.subject_id)) {
          subMap.set(r.subject_id, {
            subject_id: r.subject_id,
            subject_name: subName,
            teacher_id: r.teacher_id,
            teacher_name: teacherName,
            teacher_phone: undefined,
          });
        } else if (r.teacher_id && subMap.get(r.subject_id)?.teacher_name === 'Unassigned') {
          const existing = subMap.get(r.subject_id)!;
          existing.teacher_id = r.teacher_id;
          existing.teacher_name = teacherName;
        }
      });

      const subjectsData = Array.from(subMap.values()).map(sub => {
        const key = `${cls.id}__${sub.subject_id}`;
        const plan = activeWeekPlansMap[key];
        const daysCount = countPlanDays(plan);
        const isSubmitted = isPlanFilled(plan);

        let resolvedTeacherName = sub.teacher_name;
        if (resolvedTeacherName === 'Unassigned' && plan?.teacher_id) {
          const teacher = allStaff.find(st => st.id === plan.teacher_id);
          if (teacher) resolvedTeacherName = teacher.full_name;
        }

        return {
          subject_id: sub.subject_id,
          subject_name: sub.subject_name,
          teacher_id: sub.teacher_id || plan?.teacher_id,
          teacher_name: resolvedTeacherName,
          teacher_phone: sub.teacher_phone,
          is_submitted: isSubmitted,
          topics_count: daysCount,
          unit_chapter: plan?.unit_chapter,
          learning_outcomes: plan?.learning_outcomes,
          last_updated_at: plan?.updated_at,
          plan_raw: plan,
        };
      });

      const submittedCount = subjectsData.filter(s => s.is_submitted).length;
      const totalCount = subjectsData.length;
      const completionPct = totalCount > 0 ? Math.round((submittedCount / totalCount) * 100) : 0;

      return {
        class_id: cls.id,
        class_name: cls.name,
        section: cls.section || '',
        class_teacher_name: clsTeacher || 'Not Appointed',
        subjects: subjectsData,
        submitted_count: submittedCount,
        total_count: totalCount,
        completion_pct: completionPct,
      };
    });
  }, [allClasses, allSubjects, allStaff, allTimetableSlots, activeWeekPlansMap, formRecords]);

  // ─── Filtered Data Lists with Flexible Search ──────────────────────────────
  const filteredTeachers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return teacherSummaries.filter(t => {
      // Hide staff with 0 assigned and 0 submitted if toggle is on
      if (hideZeroSubjectStaff && t.total_subjects_count === 0 && t.submitted_subjects_count === 0) {
        return false;
      }
      if (q) {
        const matchName = t.full_name.toLowerCase().includes(q);
        const matchRole = (t.role || '').toLowerCase().includes(q);
        const matchSlots = t.assigned_slots.some(s =>
          s.subject_name.toLowerCase().includes(q) ||
          s.class_name.toLowerCase().includes(q) ||
          `${s.class_name} ${s.section}`.toLowerCase().includes(q)
        );
        if (!matchName && !matchRole && !matchSlots) return false;
      }
      if (filterStatus === 'submitted') return t.status === 'submitted';
      if (filterStatus === 'pending') return t.status === 'pending' || t.status === 'partial';
      return true;
    });
  }, [teacherSummaries, searchQuery, filterStatus, hideZeroSubjectStaff]);

  const filteredClasses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return classSummaries.filter(c => {
      if (q) {
        const matchClassName = c.class_name.toLowerCase().includes(q) || `${c.class_name} ${c.section}`.toLowerCase().includes(q);
        const matchIncharge = (c.class_teacher_name || '').toLowerCase().includes(q);
        const matchSubjects = c.subjects.some(s =>
          s.subject_name.toLowerCase().includes(q) ||
          s.teacher_name.toLowerCase().includes(q)
        );
        if (!matchClassName && !matchIncharge && !matchSubjects) return false;
      }
      if (filterStatus === 'submitted') return c.completion_pct === 100;
      if (filterStatus === 'pending') return c.completion_pct < 100;
      return true;
    });
  }, [classSummaries, searchQuery, filterStatus]);

  // ─── Executive KPI Metrics ─────────────────────────────────────────────────
  const stats = useMemo(() => {
    const activeFaculty = teacherSummaries.filter(t => t.total_subjects_count > 0 || t.submitted_subjects_count > 0);
    const totalTeachers = activeFaculty.length;
    const submittedTeachers = activeFaculty.filter(t => t.status === 'submitted').length;
    const partialTeachers = activeFaculty.filter(t => t.status === 'partial').length;
    const pendingTeachers = activeFaculty.filter(t => t.status === 'pending').length;

    const totalSubjects = activeFaculty.reduce((acc, t) => acc + t.total_subjects_count, 0);
    const submittedSubjects = activeFaculty.reduce((acc, t) => acc + t.submitted_subjects_count, 0);
    const totalTopics = activeFaculty.reduce((acc, t) => acc + t.total_topics_planned, 0);

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

  // ─── Export to Excel (.xlsx) ────────────────────────────────────────────────
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    const teacherData = teacherSummaries.map(t => ({
      'Teacher Name': t.full_name,
      'Designation': t.role,
      'Assigned Subjects': t.assigned_slots.map(s => `${s.subject_name} (${s.class_name})`).join(', '),
      'Total Assigned': t.total_subjects_count,
      'Submitted Subjects': t.submitted_subjects_count,
      'Submission Status': t.status.toUpperCase(),
      'Total Teaching Days Logged': t.total_topics_planned,
      'SLOs Defined': t.has_learning_outcomes ? 'YES' : 'NO',
      'Last Updated': t.last_updated_at ? new Date(t.last_updated_at).toLocaleString() : 'Not updated',
    }));
    const wsTeacher = XLSX.utils.json_to_sheet(teacherData);
    XLSX.utils.book_append_sheet(wb, wsTeacher, 'Teacher Compliance');

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

    XLSX.writeFile(wb, `Lesson_Planner_Compliance_${activeRange.start}.xlsx`);
  };

  // Role Restriction: Accessible only to Coordinators, Principals, and Admins
  if (userRole && !isExecutive) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center space-y-4 no-print">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto shadow-sm">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Access Restricted</h2>
        <p className="text-xs text-slate-500 font-medium max-w-md mx-auto">
          The Lesson Planner Audit &amp; Compliance Report is only accessible to Academic Coordinators, Principals, and System Administrators.
        </p>
        <Btn variant="primary" onClick={() => navigate('/diary/planner')} className="font-bold text-xs">
          Return to My Lesson Planner
        </Btn>
      </div>
    );
  }

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
                Live Audit
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
            className="text-xs h-9 px-3 bg-emerald-600 hover:bg-emerald-700 font-bold"
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
              <Users className="w-3.5 h-3.5" /> Faculty View
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
              className="w-full pl-8 pr-8 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Sub-toolbar: Hide Unassigned Toggle */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
          <label className="flex items-center gap-2 font-bold text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideZeroSubjectStaff}
              onChange={e => setHideZeroSubjectStaff(e.target.checked)}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>Hide non-teaching staff (staff with 0 assigned subjects)</span>
          </label>
          <span className="text-[11px] font-bold text-slate-400">
            Showing {viewMode === 'teacher' ? `${filteredTeachers.length} Faculty Members` : `${filteredClasses.length} Classes`}
          </span>
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
                      No matching faculty records found.
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
                                const plan = teacher.plans_detail[key];
                                const isFilled = isPlanFilled(plan);
                                return (
                                  <button
                                    key={key}
                                    onClick={() => {
                                      if (plan) {
                                        setActivePlanModal({
                                          teacherName: teacher.full_name,
                                          className: s.class_name,
                                          section: s.section,
                                          subjectName: s.subject_name,
                                          plan,
                                        });
                                      }
                                    }}
                                    className={cn(
                                      'px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1 transition-all',
                                      isFilled
                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-300 cursor-pointer'
                                        : 'bg-slate-50 border-slate-200 text-slate-500 opacity-80 cursor-default'
                                    )}
                                    title={isFilled ? 'Click to preview plan details' : 'Not submitted yet'}
                                  >
                                    {isFilled ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <X className="w-2.5 h-2.5 text-slate-400" />}
                                    {s.subject_name} ({s.class_name})
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </td>

                        {/* Coverage Progress Bar */}
                        <td className="py-3.5 px-4 min-w-[140px]">
                          <div className="flex items-center justify-between text-[11px] font-black mb-1">
                            <span className="text-slate-800">{teacher.submitted_subjects_count} of {teacher.total_subjects_count} Sub</span>
                            <span className={cn(
                              teacher.submitted_subjects_count === teacher.total_subjects_count && teacher.total_subjects_count > 0
                                ? 'text-emerald-600'
                                : teacher.submitted_subjects_count > 0 ? 'text-amber-600' : 'text-slate-400'
                            )}>
                              {teacher.total_subjects_count > 0 ? Math.round((teacher.submitted_subjects_count / teacher.total_subjects_count) * 100) : 0}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full transition-all duration-300 rounded-full',
                                teacher.submitted_subjects_count === teacher.total_subjects_count && teacher.total_subjects_count > 0
                                  ? 'bg-emerald-500'
                                  : teacher.submitted_subjects_count > 0 ? 'bg-amber-500' : 'bg-slate-200'
                              )}
                              style={{ width: `${teacher.total_subjects_count > 0 ? (teacher.submitted_subjects_count / teacher.total_subjects_count) * 100 : 0}%` }}
                            />
                          </div>
                          <span className="text-[9px] font-bold text-slate-400 mt-1 block">
                            {teacher.total_topics_planned} Teaching Days Logged
                          </span>
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
                            {teacher.submitted_subjects_count > 0 && (
                              <Btn
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  // Open the first submitted plan in modal
                                  const firstKey = Object.keys(teacher.plans_detail)[0];
                                  if (firstKey) {
                                    const slot = teacher.assigned_slots.find(s => `${s.class_id}__${s.subject_id}` === firstKey);
                                    setActivePlanModal({
                                      teacherName: teacher.full_name,
                                      className: slot?.class_name || 'Class',
                                      section: slot?.section || '',
                                      subjectName: slot?.subject_name || 'Subject',
                                      plan: teacher.plans_detail[firstKey],
                                    });
                                  }
                                }}
                                className="text-[10px] h-7 px-2.5 font-bold border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                title="Inspect Lesson Plan"
                              >
                                👁️ View Plan
                              </Btn>
                            )}

                            <Btn
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/diary/planner`)}
                              className="text-[10px] h-7 px-2.5 font-bold border-slate-200 text-slate-700 hover:bg-slate-50"
                              title="Open Planner Editor"
                            >
                              <ArrowUpRight className="w-3 h-3 mr-1" /> Edit
                            </Btn>
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
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10px] font-bold text-slate-400">Incharge:</span>
                    {isExecutive ? (
                      <select
                        value={allClasses.find(c => c.id === cls.class_id)?.class_teacher_id || ''}
                        onChange={e => handleAssignIncharge(cls.class_id, e.target.value)}
                        className="text-[11px] font-black text-indigo-700 bg-indigo-50/70 border border-indigo-200 rounded-lg px-2 py-0.5 outline-none hover:bg-indigo-100 transition cursor-pointer"
                        title="Change or set Class Incharge"
                      >
                        <option value="">-- Not Appointed --</option>
                        {allStaff.map(st => (
                          <option key={st.id} value={st.id}>
                            {st.full_name} ({st.role || 'Staff'})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs font-black text-slate-700">{cls.class_teacher_name}</span>
                    )}
                  </div>
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
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
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
                {cls.subjects.length === 0 ? (
                  <div className="p-3 text-center text-slate-400 text-xs font-bold bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    No subjects scheduled for this class.
                  </div>
                ) : (
                  cls.subjects.map(s => (
                    <div
                      key={s.subject_id}
                      onClick={() => {
                        if (s.is_submitted && s.plan_raw) {
                          setActivePlanModal({
                            teacherName: s.teacher_name,
                            className: cls.class_name,
                            section: cls.section,
                            subjectName: s.subject_name,
                            plan: s.plan_raw,
                          });
                        }
                      }}
                      className={cn(
                        'flex items-center justify-between p-2 rounded-xl border text-xs transition-all',
                        s.is_submitted
                          ? 'bg-emerald-50/40 border-emerald-100 hover:bg-emerald-50 cursor-pointer'
                          : 'bg-slate-50/70 border-slate-100 cursor-default'
                      )}
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
                          <span className="text-[10px] font-black text-emerald-700 bg-emerald-100/70 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                            👁️ {s.topics_count} Days Logged
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-rose-500 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                            Pending
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── INTERACTIVE PLAN PREVIEW MODAL ── */}
      {activePlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight flex items-center gap-2">
                    {activePlanModal.subjectName} — {activePlanModal.className} {activePlanModal.section}
                  </h3>
                  <p className="text-xs text-slate-400 font-bold">
                    Faculty: <span className="text-emerald-400">{activePlanModal.teacherName}</span> | Week: {activeRange.label}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Btn
                  variant="outline"
                  size="sm"
                  onClick={() => window.print()}
                  className="text-xs h-8 px-3 border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 font-bold"
                >
                  <Printer className="w-3.5 h-3.5 mr-1 text-slate-300" />
                  Print Plan
                </Btn>
                <button
                  onClick={() => setActivePlanModal(null)}
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Unit & SLOs Banner */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-100">
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider block mb-1">
                    📖 Unit / Chapter / Theme
                  </span>
                  <p className="text-xs font-black text-slate-900 urdu-text">
                    {activePlanModal.plan?.unit_chapter || <span className="text-slate-400 font-normal italic">Not specified</span>}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-100">
                  <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider block mb-1">
                    🎯 Student Learning Outcomes (SLOs)
                  </span>
                  <p className="text-xs font-medium text-slate-800 urdu-text whitespace-pre-wrap">
                    {activePlanModal.plan?.learning_outcomes || <span className="text-slate-400 font-normal italic">Not specified</span>}
                  </p>
                </div>
              </div>

              {/* Day-by-Day Lesson Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-black text-slate-700 uppercase tracking-wider">
                      <th className="py-2.5 px-3 w-[15%]">Date / Day</th>
                      <th className="py-2.5 px-3 w-[30%]">Topic &amp; Concepts</th>
                      <th className="py-2.5 px-3 w-[30%]">Classwork / Activity</th>
                      <th className="py-2.5 px-3 w-[25%]">Homework / Assessment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Object.entries(activePlanModal.plan?.days || {}).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400 font-bold">
                          No daily entries logged for this week.
                        </td>
                      </tr>
                    ) : (
                      Object.entries(activePlanModal.plan.days).map(([dayKey, d]: [string, any], idx) => {
                        const dayName = new Date(dayKey + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });
                        return (
                          <tr key={dayKey} className={cn('hover:bg-slate-50/70 transition-colors', idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30')}>
                            <td className="py-3 px-3 align-top font-black text-slate-800">
                              <span className="block text-[11px]">{dayName}</span>
                              <span className="text-[9px] text-slate-400 font-bold">{dayKey}</span>
                            </td>
                            <td className="py-3 px-3 align-top urdu-text font-bold text-slate-900 leading-relaxed">
                              {d.topic || <span className="text-slate-300 font-normal">—</span>}
                            </td>
                            <td className="py-3 px-3 align-top urdu-text text-slate-700 leading-relaxed">
                              {d.classwork || <span className="text-slate-300 font-normal">—</span>}
                            </td>
                            <td className="py-3 px-3 align-top urdu-text text-slate-700 leading-relaxed">
                              {d.homework || d.quiz_test || <span className="text-slate-300 font-normal">—</span>}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Additional Remarks */}
              {(activePlanModal.plan?.resources_needed || activePlanModal.plan?.teacher_remarks) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  {activePlanModal.plan.resources_needed && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        📦 Teaching Resources / AV Aids
                      </span>
                      <p className="text-slate-800 font-medium urdu-text">{activePlanModal.plan.resources_needed}</p>
                    </div>
                  )}
                  {activePlanModal.plan.teacher_remarks && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        📝 Faculty Self-Evaluation / Notes
                      </span>
                      <p className="text-slate-800 font-medium urdu-text">{activePlanModal.plan.teacher_remarks}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-[10px] font-bold text-slate-400">
                Last updated: {activePlanModal.plan?.updated_at ? new Date(activePlanModal.plan.updated_at).toLocaleString() : 'N/A'}
              </span>
              <Btn
                variant="primary"
                size="sm"
                onClick={() => setActivePlanModal(null)}
                className="text-xs px-5 bg-slate-900 hover:bg-slate-800 font-bold"
              >
                Close Preview
              </Btn>
            </div>
          </div>
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
              {filteredTeachers.map((t, idx) => (
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

