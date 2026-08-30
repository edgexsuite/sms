import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  CalendarDays, Save, CheckCircle2, RefreshCw, BookOpen,
  Printer, Download, Search, Filter, ChevronLeft, ChevronRight,
  Calculator, FlaskConical, PenTool, Book, Globe, Cpu, Palette,
  Users, UserCheck, Sparkles, FileText, Check, AlertCircle, Eye,
  Layers, Clock, Award, ShieldCheck, ClipboardCheck, Calendar,
  Copy, LayoutGrid, List
} from 'lucide-react';
import { cn, formatDate, formatDateTime, getBase64Image } from '../../lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PageHeader, Card, Btn, Badge } from '../../components/ui';

// ─── Types ───────────────────────────────────────────────────────────────────
type PlanDuration = 'weekly' | '15days' | 'monthly' | 'custom';

interface Slot {
  class_id: string;
  class_name: string;
  section: string;
  subject_id: string;
  subject_name: string;
  teacher_id?: string;
  teacher_name?: string;
}

export interface DayPlanDetail {
  topic: string;
  classwork: string;
  homework: string;
  quiz_test?: string;
}

export interface PlanItem {
  class_id: string;
  subject_id: string;
  teacher_id?: string;
  teacher_name?: string;
  subject_name: string;
  class_name: string;
  unit_chapter: string;
  learning_outcomes: string;
  resources_needed: string;
  teacher_remarks: string;
  days: Record<string, DayPlanDetail>; // keyed by date "YYYY-MM-DD"
  saving?: boolean;
  saved?: boolean;
}

export interface RangeDay {
  date: string;
  dayName: string;
  dayShort: string;
  formattedDate: string;
}

// ─── Subject Meta Helper ───────────────────────────────────────────────────
const getSubjectMeta = (name: string = '') => {
  const n = name.toLowerCase();
  if (n.includes('math')) return { icon: Calculator, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' };
  if (n.includes('sci') || n.includes('bio') || n.includes('phys') || n.includes('chem')) 
    return { icon: FlaskConical, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' };
  if (n.includes('eng')) return { icon: Book, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' };
  if (n.includes('urd') || n.includes('ara') || n.includes('isl')) 
    return { icon: PenTool, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200' };
  if (n.includes('comp') || n.includes('it')) 
    return { icon: Cpu, color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' };
  if (n.includes('his') || n.includes('soc') || n.includes('geo')) 
    return { icon: Globe, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' };
  if (n.includes('art') || n.includes('draw')) 
    return { icon: Palette, color: 'text-pink-600', bg: 'bg-pink-50', border: 'border-pink-200' };
  return { icon: BookOpen, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' };
};

// Local Timezone-Safe Date formatters
const toLocalDateStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const parseLocalDate = (str: string): Date => {
  if (!str) return new Date();
  const parts = str.split('-').map(Number);
  if (parts.length === 3) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  return new Date(str);
};

// Date helpers
const getWeekRange = (dateStr: string) => {
  const d = parseLocalDate(dateStr);
  const day = d.getDay(); // 0 is Sun, 1 is Mon
  const diffToMon = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.getFullYear(), d.getMonth(), diffToMon);
  const sat = new Date(d.getFullYear(), d.getMonth(), diffToMon + 5);
  return {
    start: toLocalDateStr(mon),
    end: toLocalDateStr(sat),
    label: `${formatDate(mon)} — ${formatDate(sat)}`
  };
};

const get15DaysRange = (dateStr: string) => {
  const d = parseLocalDate(dateStr);
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();
  if (day <= 15) {
    const start = new Date(year, month, 1);
    const end = new Date(year, month, 15);
    return {
      start: toLocalDateStr(start),
      end: toLocalDateStr(end),
      label: `1st Half: 01-${String(month + 1).padStart(2, '0')}-${year} to 15-${String(month + 1).padStart(2, '0')}-${year}`
    };
  } else {
    const start = new Date(year, month, 16);
    const end = new Date(year, month + 1, 0); // Last day of month
    return {
      start: toLocalDateStr(start),
      end: toLocalDateStr(end),
      label: `2nd Half: 16-${String(month + 1).padStart(2, '0')}-${year} to ${end.getDate()}-${String(month + 1).padStart(2, '0')}-${year}`
    };
  }
};

const getMonthRange = (dateStr: string) => {
  const d = parseLocalDate(dateStr);
  const year = d.getFullYear();
  const month = d.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return {
    start: toLocalDateStr(start),
    end: toLocalDateStr(end),
    label: `${monthNames[month]} ${year} (Full Month)`
  };
};

// Generate list of working days between start & end
const generateDaysInRange = (startStr: string, endStr: string): RangeDay[] => {
  const days: RangeDay[] = [];
  const start = parseLocalDate(startStr);
  const end = parseLocalDate(endStr);
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayShorts = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  while (cur <= end) {
    const dayOfWeek = cur.getDay();
    if (dayOfWeek !== 0) { // Skip Sunday for standard school calendar
      const dStr = toLocalDateStr(cur);
      days.push({
        date: dStr,
        dayName: dayNames[dayOfWeek],
        dayShort: dayShorts[dayOfWeek],
        formattedDate: formatDate(cur),
      });
    }
    cur.setDate(cur.getDate() + 1);
  }
  return days;
};

export default function TeacherPlanner() {
  const { userRole, isClassIncharge, canManageClassDiary, inchargeClassIds } = useAuth();
  const isTeacher = userRole?.role === 'teacher';
  const isExecutive = ['admin', 'director', 'principal', 'vice_principal', 'academic_coordinator', 'campus_coordinator', 'section_coordinator'].includes(userRole?.role || '');
  const isAdmin = isExecutive || canManageClassDiary();
  const canClassView = isAdmin || isClassIncharge();

  // State
  const [duration, setDuration] = useState<PlanDuration>('weekly');
  const [baseDate, setBaseDate] = useState(toLocalDateStr(new Date()));
  const [customStart, setCustomStart] = useState(toLocalDateStr(new Date()));
  const [customEnd, setCustomEnd] = useState(toLocalDateStr(new Date()));

  const [viewMode, setViewMode] = useState<'teacher' | 'class'>(canClassView && !isTeacher ? 'class' : 'teacher');
  const [allClasses, setAllClasses] = useState<any[]>([]);
  const [allTeachers, setAllTeachers] = useState<any[]>([]);
  const [myStaffId, setMyStaffId] = useState<string | null>(null);

  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [schoolInfo, setSchoolInfo] = useState<any>(null);

  const [assignedSlots, setAssignedSlots] = useState<Slot[]>([]);
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingAll, setSavingAll] = useState(false);

  // Active Selected Day for Single-Day Filter Tab View (optional 'all' or specific date)
  const [activeDayFilter, setActiveDayFilter] = useState<string>('all');

  // Range Computation
  const activeRange = useMemo(() => {
    if (duration === 'weekly') return getWeekRange(baseDate);
    if (duration === '15days') return get15DaysRange(baseDate);
    if (duration === 'monthly') return getMonthRange(baseDate);
    return {
      start: customStart,
      end: customEnd,
      label: `${formatDate(customStart)} — ${formatDate(customEnd)}`
    };
  }, [duration, baseDate, customStart, customEnd]);

  // Working Days in the Range
  const rangeDays = useMemo(() => {
    return generateDaysInRange(activeRange.start, activeRange.end);
  }, [activeRange.start, activeRange.end]);

  // Form Key for Storage
  const storageFormKey = useMemo(() => {
    const periodId = `${duration}_${activeRange.start}_${activeRange.end}`;
    if (viewMode === 'class') {
      return `planner_cls_${selectedClassId}_${periodId}`;
    }
    return `planner_tch_${selectedTeacherId || myStaffId}_${periodId}`;
  }, [duration, activeRange, viewMode, selectedClassId, selectedTeacherId, myStaffId]);

  // ─── Fetch Metadata ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userRole?.school_id) return;
    const fetchInit = async () => {
      let resolvedStaffId = userRole.staff_id || null;

      const [
        { data: cls },
        { data: teachers },
        { data: sch },
        { data: staffLookup }
      ] = await Promise.all([
        supabase.from('classes').select('id, name, section, class_teacher_id').eq('school_id', userRole.school_id).order('name'),
        supabase.from('staff').select('id, full_name, role').eq('school_id', userRole.school_id).eq('is_active', true).eq('is_deleted', false).order('full_name'),
        supabase.from('schools').select('*').eq('id', userRole.school_id).single(),
        (!resolvedStaffId && userRole.user_id) 
          ? supabase.from('staff').select('id, full_name').eq('school_id', userRole.school_id).eq('user_id', userRole.user_id).maybeSingle()
          : Promise.resolve({ data: null })
      ]);

      if (staffLookup?.data) {
        resolvedStaffId = staffLookup.data.id;
      }

      if (cls) {
        setAllClasses(cls);
        if (inchargeClassIds.length > 0) {
          const ic = cls.find((c: any) => inchargeClassIds.includes(c.id));
          if (ic) setSelectedClassId(ic.id);
        } else if (cls.length > 0) {
          setSelectedClassId(cls[0].id);
        }
      }

      if (teachers) setAllTeachers(teachers);
      if (sch) setSchoolInfo(sch);

      if (resolvedStaffId) {
        setMyStaffId(resolvedStaffId);
        if (userRole.role === 'teacher' || !selectedTeacherId) {
          setSelectedTeacherId(resolvedStaffId);
          setViewMode('teacher');
        }
      } else if (teachers && teachers.length > 0 && !selectedTeacherId) {
        setSelectedTeacherId(teachers[0].id);
      }
    };
    fetchInit();
  }, [userRole]);

  // ─── Fetch Slots & Saved Plans ──────────────────────────────────────────────
  const fetchSlots = useCallback(async () => {
    if (!userRole?.school_id) return;
    setLoading(true);

    let slots: Slot[] = [];

    if (viewMode === 'class' && selectedClassId) {
      const { data } = await supabase
        .from('timetable_slots')
        .select('subject_id, subjects(subject_name), teacher_id, staff(full_name)')
        .eq('class_id', selectedClassId)
        .eq('school_id', userRole.school_id);

      const cls = allClasses.find(c => c.id === selectedClassId);
      const seen = new Set<string>();
      (data || []).forEach((s: any) => {
        if (s.subject_id && !seen.has(s.subject_id)) {
          seen.add(s.subject_id);
          slots.push({
            class_id: selectedClassId,
            class_name: cls?.name || 'Class',
            section: cls?.section || '',
            subject_id: s.subject_id,
            subject_name: s.subjects?.subject_name || 'Subject',
            teacher_id: s.teacher_id,
            teacher_name: s.staff?.full_name || 'Assigned Faculty',
          });
        }
      });

      // Fallback: If no slots created yet, load all subjects for this class
      if (slots.length === 0) {
        const { data: subData } = await supabase
          .from('subjects')
          .select('id, subject_name, class_id, classes(name, section)')
          .eq('class_id', selectedClassId)
          .eq('school_id', userRole.school_id);
        (subData || []).forEach((s: any) => {
          slots.push({
            class_id: selectedClassId,
            class_name: cls?.name || s.classes?.name || 'Class',
            section: cls?.section || s.classes?.section || '',
            subject_id: s.id,
            subject_name: s.subject_name || 'Subject',
            teacher_name: 'Assigned Faculty',
          });
        });
      }
    } else if (viewMode === 'teacher' && (selectedTeacherId || myStaffId)) {
      const tid = selectedTeacherId || myStaffId;
      const { data } = await supabase
        .from('timetable_slots')
        .select('class_id, classes(name, section), subject_id, subjects(subject_name)')
        .eq('teacher_id', tid)
        .eq('school_id', userRole.school_id);

      const seen = new Set<string>();
      (data || []).forEach((s: any) => {
        if (s.class_id && s.subject_id) {
          const key = `${s.class_id}__${s.subject_id}`;
          if (!seen.has(key)) {
            seen.add(key);
            slots.push({
              class_id: s.class_id,
              class_name: s.classes?.name || 'Class',
              section: s.classes?.section || '',
              subject_id: s.subject_id,
              subject_name: s.subjects?.subject_name || 'Subject',
              teacher_id: tid,
              teacher_name: allTeachers.find(t => t.id === tid)?.full_name || 'Me',
            });
          }
        }
      });

      // Fallback: If no timetable slots, check subjects assigned directly to teacher
      if (slots.length === 0 && tid) {
        const { data: subData } = await supabase
          .from('subjects')
          .select('id, subject_name, class_id, classes(name, section)')
          .eq('teacher_id', tid)
          .eq('school_id', userRole.school_id);

        (subData || []).forEach((s: any) => {
          slots.push({
            class_id: s.class_id,
            class_name: s.classes?.name || 'Class',
            section: s.classes?.section || '',
            subject_id: s.id,
            subject_name: s.subject_name || 'Subject',
            teacher_id: tid,
            teacher_name: allTeachers.find(t => t.id === tid)?.full_name || 'Me',
          });
        });
      }
    }

    setAssignedSlots(slots);

    // ─── Fetch Saved Plans from form_settings ───
    try {
      const { data: formRes } = await supabase
        .from('form_settings')
        .select('sections_config')
        .eq('school_id', userRole.school_id)
        .eq('form_name', storageFormKey)
        .maybeSingle();

      const savedPlansMap: Record<string, any> = formRes?.sections_config?.plans || {};

      const items: PlanItem[] = slots.map(slot => {
        const key = `${slot.class_id}__${slot.subject_id}`;
        const saved = savedPlansMap[key] || {};
        const savedDays: Record<string, DayPlanDetail> = saved.days || {};

        // Ensure every date in rangeDays has a default object
        const populatedDays: Record<string, DayPlanDetail> = {};
        const savedDayEntries = Object.entries(savedDays);

        rangeDays.forEach((d, dayIndex) => {
          let matched = savedDays[d.date];

          if (!matched || (!matched.topic && !matched.classwork && !matched.homework && !matched.quiz_test)) {
            const foundBySub = savedDayEntries.find(([k, v]) => (k === d.date || k.includes(d.date) || d.date.includes(k)) && (v?.topic || v?.classwork || v?.homework || v?.quiz_test));
            if (foundBySub) matched = foundBySub[1];
          }

          if (!matched || (!matched.topic && !matched.classwork && !matched.homework && !matched.quiz_test)) {
            if (savedDayEntries[dayIndex] && (savedDayEntries[dayIndex][1]?.topic || savedDayEntries[dayIndex][1]?.classwork || savedDayEntries[dayIndex][1]?.homework || savedDayEntries[dayIndex][1]?.quiz_test)) {
              matched = savedDayEntries[dayIndex][1];
            }
          }

          populatedDays[d.date] = {
            topic: matched?.topic || '',
            classwork: matched?.classwork || '',
            homework: matched?.homework || '',
            quiz_test: matched?.quiz_test || '',
          };
        });

        return {
          class_id: slot.class_id,
          subject_id: slot.subject_id,
          teacher_id: slot.teacher_id,
          teacher_name: slot.teacher_name,
          subject_name: slot.subject_name,
          class_name: `${slot.class_name} ${slot.section}`.trim(),
          unit_chapter: saved.unit_chapter || '',
          learning_outcomes: saved.learning_outcomes || '',
          resources_needed: saved.resources_needed || '',
          teacher_remarks: saved.teacher_remarks || '',
          days: populatedDays,
          saving: false,
          saved: false,
        };
      });

      setPlanItems(items);
    } catch (err) {
      console.error('Error fetching planner:', err);
    } finally {
      setLoading(false);
    }
  }, [userRole?.school_id, viewMode, selectedClassId, selectedTeacherId, myStaffId, allClasses, allTeachers, storageFormKey, rangeDays]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  // ─── Update Item Field (Deep Immutable) ───────────────────────────────────
  const updateGeneralField = (subjectIdx: number, field: keyof PlanItem, value: string) => {
    setPlanItems(prev => {
      const next = [...prev];
      if (!next[subjectIdx]) return prev;
      next[subjectIdx] = {
        ...next[subjectIdx],
        [field]: value,
        saved: false,
      };
      return next;
    });
  };

  const updateDayField = (subjectIdx: number, dateKey: string, field: keyof DayPlanDetail, value: string) => {
    setPlanItems(prev => {
      const next = [...prev];
      if (!next[subjectIdx]) return prev;
      const target = { ...next[subjectIdx] };
      const currentDays = { ...(target.days || {}) };
      const currentDay = { ...(currentDays[dateKey] || { topic: '', classwork: '', homework: '', quiz_test: '' }) };
      
      currentDay[field] = value;
      currentDays[dateKey] = currentDay;
      target.days = currentDays;
      target.saved = false;
      next[subjectIdx] = target;
      return next;
    });
  };

  // ─── Save Helper Function (Resilient Update or Insert) ──────────────────────
  const persistPlansToDatabase = async (itemsToSave: PlanItem[]) => {
    if (!userRole?.school_id) return false;

    const plansMap: Record<string, any> = {};
    itemsToSave.forEach(item => {
      const key = `${item.class_id}__${item.subject_id}`;
      plansMap[key] = {
        unit_chapter: item.unit_chapter || '',
        learning_outcomes: item.learning_outcomes || '',
        resources_needed: item.resources_needed || '',
        teacher_remarks: item.teacher_remarks || '',
        teacher_name: item.teacher_name || '',
        subject_name: item.subject_name || '',
        class_name: item.class_name || '',
        days: item.days,
        updated_at: new Date().toISOString(),
      };
    });

    const payload = {
      period_type: duration,
      start_date: activeRange.start,
      end_date: activeRange.end,
      plans: plansMap,
      updated_at: new Date().toISOString(),
    };

    // Check existing record first to guarantee 100% database compatibility
    const { data: existing } = await supabase
      .from('form_settings')
      .select('id, sections_config')
      .eq('school_id', userRole.school_id)
      .eq('form_name', storageFormKey)
      .maybeSingle();

    if (existing?.id) {
      const mergedPlans = { ...(existing.sections_config?.plans || {}), ...plansMap };
      const { error } = await supabase
        .from('form_settings')
        .update({
          sections_config: {
            ...payload,
            plans: mergedPlans,
          }
        })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('form_settings')
        .insert([{
          school_id: userRole.school_id,
          form_name: storageFormKey,
          sections_config: payload,
        }]);
      if (error) throw error;
    }

    return true;
  };

  // ─── Save All Plans ────────────────────────────────────────────────────────
  const saveAllPlans = async () => {
    if (!userRole?.school_id) return;
    setSavingAll(true);

    try {
      await persistPlansToDatabase(planItems);
      setPlanItems(prev => prev.map(item => ({ ...item, saved: true, saving: false })));
      setTimeout(() => {
        setPlanItems(prev => prev.map(item => ({ ...item, saved: false })));
      }, 4000);
    } catch (err: any) {
      alert('Error saving planner: ' + err.message);
    } finally {
      setSavingAll(false);
    }
  };

  // ─── Save Individual Subject Plan ──────────────────────────────────────────
  const saveSingleSubjectPlan = async (subjectIdx: number) => {
    if (!userRole?.school_id) return;
    const targetItem = planItems[subjectIdx];
    if (!targetItem) return;

    setPlanItems(prev => prev.map((item, i) => i === subjectIdx ? { ...item, saving: true } : item));

    try {
      await persistPlansToDatabase(planItems);
      setPlanItems(prev => prev.map((item, i) => i === subjectIdx ? { ...item, saving: false, saved: true } : item));
      setTimeout(() => {
        setPlanItems(prev => prev.map((item, i) => i === subjectIdx ? { ...item, saved: false } : item));
      }, 4000);
    } catch (err: any) {
      setPlanItems(prev => prev.map((item, i) => i === subjectIdx ? { ...item, saving: false } : item));
      alert('Error saving lesson plan: ' + err.message);
    }
  };

  // Shift Dates
  const shiftPeriod = (direction: -1 | 1) => {
    const d = parseLocalDate(baseDate);
    if (duration === 'weekly') {
      d.setDate(d.getDate() + direction * 7);
    } else if (duration === '15days') {
      d.setDate(d.getDate() + direction * 15);
    } else if (duration === 'monthly') {
      d.setMonth(d.getMonth() + direction);
    }
    setBaseDate(toLocalDateStr(d));
  };

  // ─── Subject-Wise PDF Export ──────────────────────────────────────────────
  const handleSubjectWisePDFExport = async () => {
    if (planItems.length === 0) {
      alert('No lesson plan data found for this selection to export. Please select a class or teacher with subjects.');
      return;
    }

    const doc = new jsPDF('l', 'mm', 'a4');
    const pw = doc.internal.pageSize.width;
    const ph = doc.internal.pageSize.height;

    // School Header
    if (schoolInfo?.logo_url) {
      try {
        const b64 = await getBase64Image(schoolInfo.logo_url);
        doc.addImage(b64, 'PNG', 14, 8, 20, 20);
      } catch (err) {}
    }

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(schoolInfo?.name || 'School Report', pw / 2, 16, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(schoolInfo?.address || '', pw / 2, 22, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    const targetLabel = viewMode === 'class'
      ? `SUBJECT-WISE CURRICULUM & LESSON PLANNER — ${allClasses.find(c => c.id === selectedClassId)?.name || 'Class'} ${allClasses.find(c => c.id === selectedClassId)?.section || ''}`
      : `SUBJECT-WISE TEACHER LESSON PLANNER — ${allTeachers.find(t => t.id === (selectedTeacherId || myStaffId))?.full_name || 'Faculty'}`;
    doc.text(targetLabel.toUpperCase(), pw / 2, 30, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Duration: ${duration.toUpperCase()} | Range: ${activeRange.label} | Generated: ${formatDate(new Date())}`, pw / 2, 36, { align: 'center' });

    doc.setDrawColor(200);
    doc.setLineWidth(0.3);
    doc.line(14, 39, pw - 14, 39);

    // Build Day-by-Day Comprehensive Table with Section Headers
    const head = [['Subject / Course', 'Class / Teacher', 'Day & Date', 'Topic / Lesson Covered', 'Classwork & Activities', 'Homework & Assignments', 'Test / Quiz']];
    const body: any[] = [];

    planItems.forEach(item => {
      const unitText = item.unit_chapter ? `Unit / Chapter: ${item.unit_chapter}` : 'Unit / Chapter: In Progress';
      const outcomesText = item.learning_outcomes ? ` | Outcomes: ${item.learning_outcomes}` : '';
      
      body.push([
        {
          content: `${item.subject_name.toUpperCase()} (${item.class_name}) — Teacher: ${item.teacher_name || 'Faculty'}\n${unitText}${outcomesText}`,
          colSpan: 7,
          styles: { fillColor: [240, 244, 255], textColor: [30, 58, 138], fontStyle: 'bold', fontSize: 8, cellPadding: 3 }
        }
      ]);

      rangeDays.forEach((d, dayIndex) => {
        let dayDetail = item.days?.[d.date];
        if (!dayDetail || (!dayDetail.topic && !dayDetail.classwork && !dayDetail.homework && !dayDetail.quiz_test)) {
          const entry = Object.entries(item.days || {}).find(([k, v]) => (k === d.date || k.includes(d.date) || d.date.includes(k)) && (v.topic || v.classwork || v.homework || v.quiz_test));
          if (entry) dayDetail = entry[1];
        }
        if (!dayDetail || (!dayDetail.topic && !dayDetail.classwork && !dayDetail.homework && !dayDetail.quiz_test)) {
          const allDayVals = Object.values(item.days || {});
          if (allDayVals[dayIndex] && (allDayVals[dayIndex].topic || allDayVals[dayIndex].classwork || allDayVals[dayIndex].homework || allDayVals[dayIndex].quiz_test)) {
            dayDetail = allDayVals[dayIndex];
          }
        }
        dayDetail = dayDetail || { topic: '', classwork: '', homework: '', quiz_test: '' };

        body.push([
          item.subject_name,
          viewMode === 'class' ? (item.teacher_name || 'Faculty') : item.class_name,
          `${d.dayShort}\n${d.formattedDate}`,
          dayDetail.topic || '—',
          dayDetail.classwork || '—',
          dayDetail.homework || '—',
          dayDetail.quiz_test || '—',
        ]);
      });
    });

    autoTable(doc, {
      startY: 42,
      head: head,
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [13, 21, 38], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 26, fontStyle: 'bold' },
        1: { cellWidth: 26 },
        2: { cellWidth: 24, fontStyle: 'bold', halign: 'center' },
        3: { cellWidth: 55 },
        4: { cellWidth: 55 },
        5: { cellWidth: 55 },
        6: { cellWidth: 25 },
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 12;
    if (finalY < ph - 25) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('_____________________________', 20, finalY);
      doc.text('Subject Teacher Signature', 20, finalY + 5);

      doc.text('_____________________________', pw / 2 - 25, finalY);
      doc.text('Class Incharge Signature', pw / 2 - 25, finalY + 5);

      doc.text('_____________________________', pw - 70, finalY);
      doc.text('Principal / Coordinator Approval', pw - 70, finalY + 5);
    }

    doc.save(`SubjectWise_Planner_${duration}_${activeRange.start}.pdf`);
  };

  // ─── Day-Wise PDF Export ───────────────────────────────────────────────────
  const handleDayWisePDFExport = async (targetDate?: string) => {
    if (planItems.length === 0) {
      alert('No lesson plan data found for this selection to export.');
      return;
    }

    const doc = new jsPDF('l', 'mm', 'a4');
    const pw = doc.internal.pageSize.width;
    const ph = doc.internal.pageSize.height;

    // School Header
    if (schoolInfo?.logo_url) {
      try {
        const b64 = await getBase64Image(schoolInfo.logo_url);
        doc.addImage(b64, 'PNG', 14, 8, 20, 20);
      } catch (err) {}
    }

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(schoolInfo?.name || 'School Report', pw / 2, 16, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(schoolInfo?.address || '', pw / 2, 22, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    const targetLabel = viewMode === 'class'
      ? `DAY-WISE CLASS LESSON SCHEDULE — ${allClasses.find(c => c.id === selectedClassId)?.name || 'Class'} ${allClasses.find(c => c.id === selectedClassId)?.section || ''}`
      : `DAY-WISE TEACHER LESSON SCHEDULE — ${allTeachers.find(t => t.id === (selectedTeacherId || myStaffId))?.full_name || 'Faculty'}`;
    doc.text(targetLabel.toUpperCase(), pw / 2, 30, { align: 'center' });

    const daysToExport = targetDate ? rangeDays.filter(d => d.date === targetDate) : rangeDays;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const subTitle = targetDate 
      ? `Day: ${daysToExport[0]?.dayName || ''} (${daysToExport[0]?.formattedDate || targetDate}) | Generated: ${formatDate(new Date())}`
      : `Duration: ${duration.toUpperCase()} | Range: ${activeRange.label} | Generated: ${formatDate(new Date())}`;
    doc.text(subTitle, pw / 2, 36, { align: 'center' });

    doc.setDrawColor(200);
    doc.setLineWidth(0.3);
    doc.line(14, 39, pw - 14, 39);

    const head = [['Subject / Course', 'Class', 'Teacher', 'Topic / Lesson Covered', 'Classwork & Activities', 'Homework & Assignments', 'Test / Quiz']];
    const body: any[] = [];

    daysToExport.forEach((d, dayIndex) => {
      body.push([
        {
          content: `${d.dayName.toUpperCase()} — Date: ${d.formattedDate}`,
          colSpan: 7,
          styles: { fillColor: [13, 21, 38], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9, cellPadding: 3.5 }
        }
      ]);

      planItems.forEach(item => {
        let dayDetail = item.days?.[d.date];
        if (!dayDetail || (!dayDetail.topic && !dayDetail.classwork && !dayDetail.homework && !dayDetail.quiz_test)) {
          const entry = Object.entries(item.days || {}).find(([k, v]) => (k === d.date || k.includes(d.date) || d.date.includes(k)) && (v.topic || v.classwork || v.homework || v.quiz_test));
          if (entry) dayDetail = entry[1];
        }
        if (!dayDetail || (!dayDetail.topic && !dayDetail.classwork && !dayDetail.homework && !dayDetail.quiz_test)) {
          const allDayVals = Object.values(item.days || {});
          if (allDayVals[dayIndex] && (allDayVals[dayIndex].topic || allDayVals[dayIndex].classwork || allDayVals[dayIndex].homework || allDayVals[dayIndex].quiz_test)) {
            dayDetail = allDayVals[dayIndex];
          }
        }
        dayDetail = dayDetail || { topic: '', classwork: '', homework: '', quiz_test: '' };

        body.push([
          item.subject_name,
          item.class_name,
          item.teacher_name || 'Faculty',
          dayDetail.topic || '—',
          dayDetail.classwork || '—',
          dayDetail.homework || '—',
          dayDetail.quiz_test || '—',
        ]);
      });
    });

    autoTable(doc, {
      startY: 42,
      head: head,
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 7.5, cellPadding: 2.5, overflow: 'linebreak' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 28, fontStyle: 'bold' },
        1: { cellWidth: 20 },
        2: { cellWidth: 28 },
        3: { cellWidth: 62 },
        4: { cellWidth: 55 },
        5: { cellWidth: 55 },
        6: { cellWidth: 22 },
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 12;
    if (finalY < ph - 25) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('_____________________________', 20, finalY);
      doc.text('Subject Teacher Signature', 20, finalY + 5);

      doc.text('_____________________________', pw / 2 - 25, finalY);
      doc.text('Class Incharge Signature', pw / 2 - 25, finalY + 5);

      doc.text('_____________________________', pw - 70, finalY);
      doc.text('Principal / Coordinator Approval', pw - 70, finalY + 5);
    }

    const filename = targetDate
      ? `Day_Lesson_Plan_${targetDate}.pdf`
      : `DayWise_Lesson_Planner_${duration}_${activeRange.start}.pdf`;
    doc.save(filename);
  };

  const selectedClsObj = allClasses.find(c => c.id === selectedClassId);

  // Filtered days to display in the UI based on activeDayFilter
  const displayDays = useMemo(() => {
    if (activeDayFilter === 'all') return rangeDays;
    return rangeDays.filter(d => d.date === activeDayFilter);
  }, [rangeDays, activeDayFilter]);

  return (
    <div className="max-w-[1600px] mx-auto space-y-4">
      {/* ── Control Header ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm no-print">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              Curriculum & Lesson Planner
              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-black tracking-widest uppercase">
                {duration}
              </span>
            </h1>
            <p className="text-xs text-slate-500 font-bold">
              Day-by-day lesson planning with exact dates, topics, classwork, and homework
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Duration Mode Switcher */}
          <div className="bg-slate-100 p-1 rounded-xl flex gap-1 border border-slate-200">
            {(['weekly', '15days', 'monthly', 'custom'] as PlanDuration[]).map(d => (
              <button
                key={d}
                onClick={() => {
                  setDuration(d);
                  setActiveDayFilter('all');
                }}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-black transition-all uppercase tracking-wider',
                  duration === d ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-800'
                )}
              >
                {d === 'weekly' ? 'Weekly' : d === '15days' ? '15 Days' : d === 'monthly' ? 'Monthly' : 'Custom'}
              </button>
            ))}
          </div>

          <div className="h-8 w-px bg-slate-200 mx-1 hidden sm:block" />

          {/* Print & PDF Buttons */}
          <Btn variant="outline" size="sm" onClick={() => window.print()} className="text-xs h-9 px-3">
            <Printer className="w-4 h-4 mr-1.5" /> Print Sheet
          </Btn>
          
          {/* Dual PDF Options */}
          <Btn
            variant="outline"
            size="sm"
            onClick={() => handleDayWisePDFExport(activeDayFilter !== 'all' ? activeDayFilter : undefined)}
            className="text-xs h-9 px-3 border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 font-bold"
            title="Download Day-Wise Lesson Plan PDF grouped by Day/Date"
          >
            <Download className="w-4 h-4 mr-1.5 text-indigo-600" />
            {activeDayFilter !== 'all' ? '📄 Day PDF' : '📄 Day-Wise PDF'}
          </Btn>

          <Btn
            variant="outline"
            size="sm"
            onClick={handleSubjectWisePDFExport}
            className="text-xs h-9 px-3 border-slate-200 font-bold"
            title="Download Subject-Wise Lesson Plan PDF grouped by Subject"
          >
            <BookOpen className="w-4 h-4 mr-1.5 text-slate-600" />
            📚 Subject-Wise PDF
          </Btn>

          <Btn variant="primary" size="sm" onClick={saveAllPlans} disabled={savingAll} className="text-xs h-9 px-4 font-black shadow-md shadow-indigo-100">
            <Save className="w-4 h-4 mr-1.5" /> {savingAll ? 'Saving...' : 'Save All Plans'}
          </Btn>
        </div>
      </div>

      {/* ── Perspective & Date Controls Bar ── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm no-print items-center">
        
        {/* Mode Selector (Teacher View vs Class View) */}
        <div className="md:col-span-4 flex items-center gap-2">
          <div className="bg-slate-100 p-1 rounded-xl flex gap-1 border border-slate-200 w-full">
            <button
              onClick={() => setViewMode('teacher')}
              className={cn(
                'flex-1 py-1.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5',
                viewMode === 'teacher' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <PenTool className="w-3.5 h-3.5" /> Teacher Mode
            </button>
            <button
              onClick={() => setViewMode('class')}
              className={cn(
                'flex-1 py-1.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5',
                viewMode === 'class' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <Users className="w-3.5 h-3.5" /> Class Incharge View
            </button>
          </div>
        </div>

        {/* Dropdown for Selection (Class or Teacher) */}
        <div className="md:col-span-4">
          {viewMode === 'class' ? (
            <div className="relative">
              <select
                value={selectedClassId}
                onChange={e => setSelectedClassId(e.target.value)}
                className="w-full px-3.5 py-2 text-xs font-black bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                {allClasses.map(c => (
                  <option key={c.id} value={c.id}>
                    Class: {c.name} {c.section} {inchargeClassIds.includes(c.id) ? '★ (My Incharge Class)' : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="relative">
              <select
                value={selectedTeacherId || myStaffId || ''}
                onChange={e => setSelectedTeacherId(e.target.value)}
                className="w-full px-3.5 py-2 text-xs font-black bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                {allTeachers.map(t => (
                  <option key={t.id} value={t.id}>
                    Teacher: {t.full_name} {t.id === myStaffId ? '(You)' : ''} {t.role ? `· ${t.role}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Date Navigator Strip */}
        <div className="md:col-span-4 flex items-center justify-end gap-2">
          {duration !== 'custom' ? (
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <button
                onClick={() => shiftPeriod(-1)}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
                title="Previous Period"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="text-center">
                <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight block">
                  {activeRange.label}
                </span>
                <span className="text-[9px] font-bold text-slate-400">
                  {formatDate(activeRange.start)} to {formatDate(activeRange.end)} ({rangeDays.length} Teaching Days)
                </span>
              </div>
              <button
                onClick={() => shiftPeriod(1)}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
                title="Next Period"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Day Selector Quick-Filter Bar ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-sm no-print">
        <button
          onClick={() => setActiveDayFilter('all')}
          className={cn(
            'flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black transition-all whitespace-nowrap',
            activeDayFilter === 'all'
              ? 'bg-[#0d1526] text-white shadow-sm'
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
          )}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>All Days ({rangeDays.length})</span>
        </button>

        <div className="h-5 w-px bg-slate-200 mx-1 shrink-0" />

        {rangeDays.map(d => {
          const isSelected = activeDayFilter === d.date;
          return (
            <button
              key={d.date}
              onClick={() => setActiveDayFilter(d.date)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all whitespace-nowrap border',
                isSelected
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              <Calendar className="w-3 h-3 text-indigo-400" />
              <span>{d.dayName}</span>
              <span className={cn(
                'px-1.5 py-0.2 rounded text-[10px]',
                isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              )}>
                {d.formattedDate}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Printable Header (Only Visible When Printing) ── */}
      <div className="hidden print:flex flex-col items-center justify-center p-6 border-b-2 border-slate-200 mb-6 text-center">
        {schoolInfo?.logo_url && (
          <img src={schoolInfo.logo_url} className="w-16 h-16 object-contain mb-2" alt="Logo" />
        )}
        <h2 className="text-2xl font-black uppercase tracking-widest text-[#0d1526]">{schoolInfo?.name || 'School Planner'}</h2>
        <p className="text-xs text-slate-500 font-bold">{schoolInfo?.address || ''}</p>
        <div className="mt-3 px-4 py-1 bg-slate-100 rounded-full border border-slate-300 inline-block">
          <span className="text-xs font-black uppercase text-slate-800">
            {viewMode === 'class' ? `Class Planner: ${selectedClsObj?.name} ${selectedClsObj?.section}` : 'Teacher Lesson Planner'}
            {' · '}{duration.toUpperCase()} ({activeRange.label})
          </span>
        </div>
      </div>

      {/* ── Planner Editor & Viewer ── */}
      {loading ? (
        <Card className="py-20 flex flex-col items-center justify-center shadow-sm border-slate-100">
          <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-4">Loading Lesson Plan...</p>
        </Card>
      ) : planItems.length === 0 ? (
        <Card className="py-20 text-center shadow-sm border-slate-100">
          <BookOpen className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <h3 className="text-sm font-black text-slate-500 uppercase">No Timetable Subjects Assigned</h3>
          <p className="text-xs text-slate-400 mt-1">
            {viewMode === 'class'
              ? 'No timetable slots or subjects configured for this class yet.'
              : 'No teaching slots assigned to this teacher in the Timetable.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {planItems.map((item, idx) => {
            const meta = getSubjectMeta(item.subject_name);
            const Icon = meta.icon;
            return (
              <div
                key={`${item.class_id}__${item.subject_id}`}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 hover:shadow-md transition-all space-y-4"
              >
                {/* Subject Header Strip */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm', meta.bg, meta.color, meta.border)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                          {item.subject_name}
                        </h3>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-black uppercase">
                          {item.class_name}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                        Teacher: <span className="text-slate-700">{item.teacher_name || 'Unassigned'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.saved && (
                      <span className="flex items-center gap-1 text-[11px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 animate-fade-in">
                        <Check className="w-3.5 h-3.5" /> Saved
                      </span>
                    )}
                    <Btn
                      variant="outline"
                      size="sm"
                      onClick={() => saveSingleSubjectPlan(idx)}
                      disabled={item.saving || savingAll}
                      className="text-xs h-8 px-3 font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                    >
                      <Save className="w-3.5 h-3.5 mr-1" />
                      {item.saving ? 'Saving...' : 'Save Subject'}
                    </Btn>
                  </div>
                </div>

                {/* Overall Unit & Learning Objectives for the Period */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider">
                      📖 Overall Unit / Chapter & Syllabus Target
                    </label>
                    <input
                      type="text"
                      value={item.unit_chapter}
                      onChange={e => updateGeneralField(idx, 'unit_chapter', e.target.value)}
                      placeholder="e.g. Unit 4: Linear Equations & Word Problems"
                      className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-indigo-700 uppercase tracking-wider">
                      🎯 Learning Outcomes & Objectives (SLOs)
                    </label>
                    <input
                      type="text"
                      value={item.learning_outcomes}
                      onChange={e => updateGeneralField(idx, 'learning_outcomes', e.target.value)}
                      placeholder="e.g. Students will solve 2-variable linear equations"
                      className="w-full px-3 py-2 text-xs font-bold bg-white border border-indigo-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* ── Day-by-Day Planning Rows with Explicit Date and Day Name ── */}
                <div className="space-y-2.5 pt-1">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4 text-indigo-600" />
                    Day-by-Day Detailed Lesson & Homework Breakdown:
                  </h4>

                  <div className="space-y-2.5">
                    {displayDays.map(d => {
                      const dayDetail = item.days[d.date] || { topic: '', classwork: '', homework: '', quiz_test: '' };
                      return (
                        <div
                          key={d.date}
                          className="bg-white rounded-xl border-2 border-slate-100 hover:border-indigo-100 transition-all p-3 space-y-2 shadow-sm"
                        >
                          {/* Day & Date Header Banner */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                                <Calendar className="w-3.5 h-3.5" />
                                {d.dayName}
                              </span>
                              <span className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg text-xs font-mono font-black border border-slate-200">
                                📅 Date: {d.formattedDate}
                              </span>
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              {d.date}
                            </span>
                          </div>

                          {/* Day Inputs: Topic, Classwork, Homework, Assessment */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
                            {/* Topic Planned */}
                            <div className="space-y-1">
                              <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider">
                                📘 Lesson / Topic to Cover
                              </label>
                              <input
                                type="text"
                                value={dayDetail.topic || ''}
                                onChange={e => updateDayField(idx, d.date, 'topic', e.target.value)}
                                placeholder="Topic name / exercise..."
                                className="w-full px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                              />
                            </div>

                            {/* Classwork / Lab */}
                            <div className="space-y-1">
                              <label className="block text-[10px] font-black text-emerald-700 uppercase tracking-wider">
                                🧪 Classwork & In-Class Task
                              </label>
                              <input
                                type="text"
                                value={dayDetail.classwork || ''}
                                onChange={e => updateDayField(idx, d.date, 'classwork', e.target.value)}
                                placeholder="Reading, problem solving..."
                                className="w-full px-3 py-1.5 text-xs font-semibold bg-emerald-50/40 border border-emerald-100 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                              />
                            </div>

                            {/* Homework & Diary Task */}
                            <div className="space-y-1">
                              <label className="block text-[10px] font-black text-amber-700 uppercase tracking-wider">
                                📝 Homework & Assignment
                              </label>
                              <input
                                type="text"
                                value={dayDetail.homework || ''}
                                onChange={e => updateDayField(idx, d.date, 'homework', e.target.value)}
                                placeholder="Q1 to Q5 on notebook..."
                                className="w-full px-3 py-1.5 text-xs font-semibold bg-amber-50/40 border border-amber-100 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                              />
                            </div>

                            {/* Quiz / Oral Test */}
                            <div className="space-y-1">
                              <label className="block text-[10px] font-black text-rose-600 uppercase tracking-wider">
                                ⏱️ Quiz / Test (If any)
                              </label>
                              <input
                                type="text"
                                value={dayDetail.quiz_test || ''}
                                onChange={e => updateDayField(idx, d.date, 'quiz_test', e.target.value)}
                                placeholder="Friday test, oral quiz..."
                                className="w-full px-3 py-1.5 text-xs font-semibold bg-rose-50/40 border border-rose-100 rounded-lg outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Floating Save Footer Bar */}
          <div className="bg-[#0d1526] text-white p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg no-print">
            <div className="flex items-center gap-3">
              <ClipboardCheck className="w-5 h-5 text-indigo-400" />
              <div>
                <p className="text-xs font-black uppercase tracking-wider">
                  {planItems.length} Subject Planners Ready for {activeRange.label} ({rangeDays.length} Teaching Days)
                </p>
                <p className="text-[10px] text-slate-400 font-bold">
                  Class Incharge and Principal can review, approve, and print this lesson plan anytime.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Btn variant="primary" size="sm" onClick={saveAllPlans} disabled={savingAll} className="px-5 py-2 font-black text-xs">
                <Save className="w-4 h-4 mr-2" /> {savingAll ? 'Saving Changes...' : 'Save Lesson Plan'}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ── Print Signatures Footer (Only visible on paper print) ── */}
      <div className="hidden print:grid grid-cols-3 gap-8 pt-12 text-center text-xs font-bold text-slate-800">
        <div>
          <div className="border-b border-slate-400 mb-2" />
          <p>Subject Teacher Signature</p>
        </div>
        <div>
          <div className="border-b border-slate-400 mb-2" />
          <p>Class Incharge Signature</p>
        </div>
        <div>
          <div className="border-b border-slate-400 mb-2" />
          <p>Principal / Coordinator Approval</p>
        </div>
      </div>
    </div>
  );
}
