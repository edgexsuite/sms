import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  CalendarDays, Save, CheckCircle2, RefreshCw, BookOpen,
  Printer, Download, Search, Filter, ChevronLeft, ChevronRight,
  Calculator, FlaskConical, PenTool, Book, Globe, Cpu, Palette,
  Users, UserCheck, Sparkles, FileText, Check, AlertCircle, Eye,
  Layers, Clock, Award, ShieldCheck, ClipboardCheck, Calendar,
  Copy, LayoutGrid, List, FileSpreadsheet, Upload, UploadCloud, FileUp, X
} from 'lucide-react';

import * as XLSX from 'xlsx';
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
  const navigate = useNavigate();
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
  const [allSubjects, setAllSubjects] = useState<any[]>([]);
  const [myStaffId, setMyStaffId] = useState<string | null>(null);

  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [schoolInfo, setSchoolInfo] = useState<any>(null);

  const [assignedSlots, setAssignedSlots] = useState<Slot[]>([]);
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingAll, setSavingAll] = useState(false);

  // Import Modal & Template State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importStatus, setImportStatus] = useState<{ success?: string; error?: string; logs?: string[] } | null>(null);

  // Export Dropdown & Print State
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  // Active Selected Day for Single-Day Filter Tab View (optional 'all' or specific date)
  const [activeDayFilter, setActiveDayFilter] = useState<string>('all');
  const [printLayoutMode, setPrintLayoutMode] = useState<'daywise' | 'subjectwise'>('daywise');


  // Trigger Native Nastaleeq Day-Wise Print / PDF
  const triggerDayWisePrint = (targetDate?: string) => {
    if (planItems.length === 0) {
      alert('No lesson plan data found for this selection to export.');
      return;
    }
    if (targetDate) setActiveDayFilter(targetDate);
    setPrintLayoutMode('daywise');
    setTimeout(() => {
      window.print();
    }, 80);
  };

  // Trigger Native Nastaleeq Subject-Wise Print / PDF
  const triggerSubjectWisePrint = () => {
    if (planItems.length === 0) {
      alert('No lesson plan data found for this selection to export.');
      return;
    }
    setPrintLayoutMode('subjectwise');
    setTimeout(() => {
      window.print();
    }, 80);
  };

  // ─── Download Excel Template for Lesson Plans ──────────────────────────────
  const downloadExcelTemplate = () => {
    const headers = [
      'Class Name',
      'Subject Name',
      'Teacher Name',
      'Week Start',
      'Unit / Chapter',
      'Learning Outcomes (SLOs)',
      'Resources Needed',
      'Teacher Remarks',
      'Mon Topic', 'Mon Classwork', 'Mon Homework', 'Mon Quiz/Test',
      'Tue Topic', 'Tue Classwork', 'Tue Homework', 'Tue Quiz/Test',
      'Wed Topic', 'Wed Classwork', 'Wed Homework', 'Wed Quiz/Test',
      'Thu Topic', 'Thu Classwork', 'Thu Homework', 'Thu Quiz/Test',
      'Fri Topic', 'Fri Classwork', 'Fri Homework', 'Fri Quiz/Test',
      'Sat Topic', 'Sat Classwork', 'Sat Homework', 'Sat Quiz/Test',
    ];

    const rows: any[][] = [];
    const dDates = rangeDays.map(rd => rd.date);

    if (assignedSlots.length > 0) {
      assignedSlots.forEach(slot => {
        const item = planItems.find(p => p.class_id === slot.class_id && p.subject_id === slot.subject_id);
        const d = item?.days || {};
        rows.push([
          `${slot.class_name} ${slot.section}`.trim(),
          slot.subject_name,
          slot.teacher_name || allTeachers.find(t => t.id === (selectedTeacherId || myStaffId))?.full_name || '',
          activeRange.start,
          item?.unit_chapter || '',
          item?.learning_outcomes || '',
          item?.resources_needed || '',
          item?.teacher_remarks || '',
          d[dDates[0]]?.topic || '', d[dDates[0]]?.classwork || '', d[dDates[0]]?.homework || '', d[dDates[0]]?.quiz_test || '',
          d[dDates[1]]?.topic || '', d[dDates[1]]?.classwork || '', d[dDates[1]]?.homework || '', d[dDates[1]]?.quiz_test || '',
          d[dDates[2]]?.topic || '', d[dDates[2]]?.classwork || '', d[dDates[2]]?.homework || '', d[dDates[2]]?.quiz_test || '',
          d[dDates[3]]?.topic || '', d[dDates[3]]?.classwork || '', d[dDates[3]]?.homework || '', d[dDates[3]]?.quiz_test || '',
          d[dDates[4]]?.topic || '', d[dDates[4]]?.classwork || '', d[dDates[4]]?.homework || '', d[dDates[4]]?.quiz_test || '',
          d[dDates[5]]?.topic || '', d[dDates[5]]?.classwork || '', d[dDates[5]]?.homework || '', d[dDates[5]]?.quiz_test || '',
        ]);
      });
    } else {
      rows.push([
        'Grade 4',
        'Urdu',
        allTeachers.find(t => t.id === (selectedTeacherId || myStaffId))?.full_name || 'Mariyam Munir',
        activeRange.start,
        'حروفِ جار اور قواعد',
        'طلبہ حروفِ جار، اسمِ معرفہ اور اسمِ صفت کی پہچان کر سکیں گے۔',
        'درسی کتاب صفحہ 12-15، وائٹ بورڈ، فلیش کارڈز',
        'ہفتہ وار جائزہ اور دہرائی کا انعقاد کیا جائے گا۔',
        'حروفِ جار (تعارف اور تفہیم)', 'حروفِ جار (کا، کی، کے، کو، سے، میں، پر) کی تعریف اور بورڈ پر مشق', 'کتاب کا صفحہ نمبر 14 مشق سوال 1 حل کریں', '',
        'اسمِ معرفہ اور اسمِ نکرہ', 'خاص ناموں (معرفہ) اور عام ناموں (نکرہ) کی مثالوں کے ساتھ وضاحت', 'پانچ معرفہ اور پانچ نکرہ اسماء کاپی پر لکھ کر لائیں', 'مختصر زبانی سوالات',
        'اسمِ صفت (خوبیاں اور خصوصیات)', 'جملوں میں اسمِ صفت کی شناخت اور ان کا استعمال سمجھنا', 'کتاب کی مشق نمبر 3 مکمل کریں', 'اسم صفت کی مثالوں کا ٹیسٹ',
        'جملہ سازی اور قواعد کا عملی استعمال', 'حروفِ جار اور اسمِ معرفہ/نکرہ کو ملا کر جملے بنانے کی مشق', 'دیے گئے پانچ الفاظ پر مشتمل بامعنی جملے بنائیں', '',
        'دہرائی اور تفہیمی سرگرمی', 'ہفتے بھر کے اسباق کی اجتماعی دہرائی اور فلیش کارڈ گیم', 'ہفتہ وار ٹیسٹ کی مکمل تیاری کر کے آئیں', '',
        'ہفتہ وار تحریری جائزہ (Weekly Quiz)', 'قواعد کے تمام اسباق پر مشتمل 15 منٹ کا تحریری کوئز', 'اگلے ہفتے کے سبق کی ریڈنگ', 'Urdu Grammar Quiz 1'
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [
      { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 12 },
      { wch: 22 }, { wch: 30 }, { wch: 20 }, { wch: 20 },
      { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 15 },
      { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 15 },
      { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 15 },
      { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 15 },
      { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 15 },
      { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 15 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lesson_Plan_Template');
    XLSX.writeFile(wb, `Lesson_Plan_Template_${activeRange.start}.xlsx`);
  };

  // ─── Process Excel / CSV Import File ───────────────────────────────────────
  const processImportFile = async (file: File) => {
    if (!userRole?.school_id) return;
    setImportLoading(true);
    setImportStatus(null);
    const logs: string[] = [];

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const firstSheetName = wb.SheetNames[0];
      const ws = wb.Sheets[firstSheetName];
      const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (rawRows.length === 0) {
        throw new Error('The uploaded spreadsheet contains no data rows.');
      }

      logs.push(`Found ${rawRows.length} rows in "${firstSheetName}".`);

      const upsertRows: any[] = [];
      const dDates = rangeDays.map(rd => rd.date);

      rawRows.forEach((row, idx) => {
        const norm: Record<string, string> = {};
        Object.entries(row).forEach(([k, v]) => {
          norm[k.toLowerCase().replace(/[^a-z0-9]/g, '')] = String(v).trim();
        });

        const rawClassName = norm['classname'] || norm['class'] || '';
        const rawSubjectName = norm['subjectname'] || norm['subject'] || '';
        const rawTeacherName = norm['teachername'] || norm['teacher'] || norm['faculty'] || '';
        const rawWeekStart = norm['weekstart'] || norm['week'] || activeRange.start;

        // Match Class
        const matchedClass = allClasses.find(c => {
          const full = `${c.name} ${c.section}`.toLowerCase().trim();
          const simple = c.name.toLowerCase().trim();
          const target = rawClassName.toLowerCase().trim();
          return full === target || simple === target || full.includes(target) || target.includes(simple);
        }) || (selectedClassId ? allClasses.find(c => c.id === selectedClassId) : null);

        // Match Subject
        const matchedSubject = allSubjects.find(s => {
          const sName = s.subject_name.toLowerCase().trim();
          const target = rawSubjectName.toLowerCase().trim();
          const classMatch = matchedClass ? s.class_id === matchedClass.id : true;
          return classMatch && (sName === target || sName.includes(target) || target.includes(sName));
        });

        // Match Teacher
        const matchedTeacher = allTeachers.find(t => {
          const tName = t.full_name.toLowerCase().trim();
          const target = rawTeacherName.toLowerCase().trim();
          return tName === target || tName.includes(target) || target.includes(tName);
        }) || allTeachers.find(t => t.id === (selectedTeacherId || myStaffId)) || null;

        const resolvedTeacherId = matchedTeacher?.id || selectedTeacherId || myStaffId || null;

        if (!matchedClass || !matchedSubject || !resolvedTeacherId) {
          logs.push(`Row ${idx + 1}: Skipped (Class: "${rawClassName}", Subject: "${rawSubjectName}") — could not match class/subject.`);
          return;
        }

        // Parse 6 Days (Mon - Sat)
        const daysMap: Record<string, DayPlanDetail> = {};
        const prefixes = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        prefixes.forEach((pref, pIdx) => {
          const dayDate = dDates[pIdx] || '';
          if (!dayDate) return;

          const topic = norm[`${pref}topic`] || norm[`${pref}topiccovered`] || norm[`${pref}topiclesson`] || '';
          const classwork = norm[`${pref}classwork`] || norm[`${pref}cw`] || norm[`${pref}classworkactivities`] || '';
          const homework = norm[`${pref}homework`] || norm[`${pref}hw`] || norm[`${pref}homeworkassignments`] || '';
          const quiz = norm[`${pref}quiz`] || norm[`${pref}quiztest`] || norm[`${pref}test`] || '';

          daysMap[dayDate] = {
            topic,
            classwork,
            homework,
            quiz_test: quiz,
          };
        });

        upsertRows.push({
          school_id: userRole.school_id,
          teacher_id: resolvedTeacherId,
          class_id: matchedClass.id,
          subject_id: matchedSubject.id,
          week_start: rawWeekStart || activeRange.start,
          week_end: activeRange.end,
          unit_chapter: norm['unitchapter'] || norm['unit'] || norm['chapter'] || '',
          learning_outcomes: norm['learningoutcomes'] || norm['learningoutcomesslos'] || norm['slos'] || norm['slo'] || '',
          resources_needed: norm['resourcesneeded'] || norm['resources'] || norm['materials'] || '',
          teacher_remarks: norm['teacherremarks'] || norm['remarks'] || norm['notes'] || '',
          days: daysMap,
          updated_at: new Date().toISOString()
        });

        logs.push(`Row ${idx + 1}: Matched → ${matchedClass.name} | ${matchedSubject.subject_name} | ${matchedTeacher?.full_name || 'Faculty'}`);
      });

      if (upsertRows.length === 0) {
        throw new Error('No rows could be matched to existing Classes and Subjects. Please verify names in your sheet.');
      }

      // Upsert into Supabase
      const { error: upsertErr } = await supabase
        .from('lesson_plans')
        .upsert(upsertRows, { onConflict: 'school_id,teacher_id,class_id,subject_id,week_start' });

      if (upsertErr) throw upsertErr;

      setImportStatus({
        success: `Successfully imported ${upsertRows.length} subject lesson plans for week ${activeRange.start}!`,
        logs,
      });

      await fetchSlots();
    } catch (err: any) {
      console.error('[TeacherPlanner] Import error:', err);
      setImportStatus({
        error: err.message || 'Failed to import lesson plan file.',
        logs,
      });
    } finally {
      setImportLoading(false);
    }
  };


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

      try {
        const [
          { data: cls },
          { data: teachers },
          { data: subs },
          { data: sch },
          { data: staffByUid }
        ] = await Promise.all([
          supabase.from('classes').select('id, name, section, class_teacher_id').eq('school_id', userRole.school_id).order('name'),
          supabase.from('staff').select('id, full_name, role').eq('school_id', userRole.school_id).eq('is_deleted', false).order('full_name'),
          supabase.from('subjects').select('id, subject_name, class_id').eq('school_id', userRole.school_id),
          supabase.from('schools').select('*').eq('id', userRole.school_id).single(),
          (!resolvedStaffId && userRole.user_id) 
            ? supabase.from('staff').select('id, full_name').eq('school_id', userRole.school_id).eq('user_id', userRole.user_id).maybeSingle()
            : Promise.resolve({ data: null })
        ]);

        if (staffByUid?.id) {
          resolvedStaffId = staffByUid.id;
        }

        if (cls) {
          setAllClasses(cls);
          if (inchargeClassIds && inchargeClassIds.length > 0) {
            const ic = cls.find((c: any) => inchargeClassIds.includes(c.id));
            if (ic) setSelectedClassId(ic.id);
            else if (cls.length > 0) setSelectedClassId(cls[0].id);
          } else if (cls.length > 0) {
            setSelectedClassId(cls[0].id);
          }
        }

        if (teachers) setAllTeachers(teachers);
        if (subs) setAllSubjects(subs);
        if (sch) setSchoolInfo(sch);

        if (resolvedStaffId) {
          setMyStaffId(resolvedStaffId);
          setSelectedTeacherId(resolvedStaffId);
          if (!isExecutive && !canClassView) {
            setViewMode('teacher');
          }
        } else if (teachers && teachers.length > 0 && !selectedTeacherId) {
          setSelectedTeacherId(teachers[0].id);
        }
      } catch (err) {
        console.error('[TeacherPlanner] Error in fetchInit:', err);
      }
    };
    fetchInit();
  }, [userRole?.school_id, userRole?.staff_id, userRole?.user_id]);



  // ─── Fetch Slots & Saved Plans ──────────────────────────────────────────────
  const fetchSlots = useCallback(async () => {
    if (!userRole?.school_id) return;
    setLoading(true);

    try {
      let slots: Slot[] = [];

      if (viewMode === 'class' && selectedClassId) {
        const { data } = await supabase
          .from('timetable_slots')
          .select('subject_id, teacher_id')
          .eq('class_id', selectedClassId)
          .eq('school_id', userRole.school_id);

        const cls = allClasses.find(c => c.id === selectedClassId);
        const seen = new Set<string>();
        (data || []).forEach((s: any) => {
          if (s.subject_id && !seen.has(s.subject_id)) {
            seen.add(s.subject_id);
            const sub = allSubjects.find(sub => sub.id === s.subject_id);
            const teacher = allTeachers.find(t => t.id === s.teacher_id);
            slots.push({
              class_id: selectedClassId,
              class_name: cls?.name || 'Class',
              section: cls?.section || '',
              subject_id: s.subject_id,
              subject_name: sub?.subject_name || 'Subject',
              teacher_id: s.teacher_id,
              teacher_name: teacher?.full_name || 'Assigned Faculty',
            });
          }
        });

        // Fallback: If no timetable slots for this class, load all subjects for this class
        if (slots.length === 0) {
          const classSubs = allSubjects.filter(s => s.class_id === selectedClassId);
          const assignedTeacherId = cls?.class_teacher_id || myStaffId || undefined;
          const assignedTeacherName = allTeachers.find(t => t.id === assignedTeacherId)?.full_name || 'Class Incharge';

          classSubs.forEach((s: any) => {
            slots.push({
              class_id: selectedClassId,
              class_name: cls?.name || 'Class',
              section: cls?.section || '',
              subject_id: s.id,
              subject_name: s.subject_name || 'Subject',
              teacher_id: assignedTeacherId,
              teacher_name: assignedTeacherName,
            });
          });
        }
      } else if (viewMode === 'teacher' && (selectedTeacherId || myStaffId)) {
        const tid = selectedTeacherId || myStaffId;
        const { data } = await supabase
          .from('timetable_slots')
          .select('class_id, subject_id')
          .eq('teacher_id', tid)
          .eq('school_id', userRole.school_id);

        const seen = new Set<string>();
        (data || []).forEach((s: any) => {
          if (s.class_id && s.subject_id) {
            const key = `${s.class_id}__${s.subject_id}`;
            if (!seen.has(key)) {
              seen.add(key);
              const cls = allClasses.find(c => c.id === s.class_id);
              const sub = allSubjects.find(sub => sub.id === s.subject_id);
              slots.push({
                class_id: s.class_id,
                class_name: cls?.name || 'Class',
                section: cls?.section || '',
                subject_id: s.subject_id,
                subject_name: sub?.subject_name || 'Subject',
                teacher_id: tid,
                teacher_name: allTeachers.find(t => t.id === tid)?.full_name || 'Me',
              });
            }
          }
        });

        // Fallback 1: If no timetable slots, check classes where this teacher is Class Incharge
        if (slots.length === 0 && tid) {
          const inchargeClasses = allClasses.filter(c => c.class_teacher_id === tid);
          if (inchargeClasses.length > 0) {
            const classIds = inchargeClasses.map(c => c.id);
            const subData = allSubjects.filter(s => classIds.includes(s.class_id));

            subData.forEach((s: any) => {
              const cls = inchargeClasses.find(c => c.id === s.class_id);
              slots.push({
                class_id: s.class_id,
                class_name: cls?.name || 'Class',
                section: cls?.section || '',
                subject_id: s.id,
                subject_name: s.subject_name || 'Subject',
                teacher_id: tid,
                teacher_name: allTeachers.find(t => t.id === tid)?.full_name || 'Me',
              });
            });
          }
        }

        // Fallback 2: Check if any lesson_plans exist for this teacher
        if (slots.length === 0 && tid) {
          const { data: lpRows } = await supabase
            .from('lesson_plans')
            .select('class_id, subject_id')
            .eq('teacher_id', tid)
            .eq('school_id', userRole.school_id);

          const lpSeen = new Set<string>();
          (lpRows || []).forEach((lp: any) => {
            if (lp.class_id && lp.subject_id) {
              const key = `${lp.class_id}__${lp.subject_id}`;
              if (!lpSeen.has(key)) {
                lpSeen.add(key);
                const cls = allClasses.find(c => c.id === lp.class_id);
                const sub = allSubjects.find(sub => sub.id === lp.subject_id);
                slots.push({
                  class_id: lp.class_id,
                  class_name: cls?.name || 'Class',
                  section: cls?.section || '',
                  subject_id: lp.subject_id,
                  subject_name: sub?.subject_name || 'Subject',
                  teacher_id: tid,
                  teacher_name: allTeachers.find(t => t.id === tid)?.full_name || 'Me',
                });
              }
            }
          });
        }
      }

      setAssignedSlots(slots);

      // ─── Fetch Saved Plans from lesson_plans table ───────────────────────────
      let plansQuery = supabase
        .from('lesson_plans')
        .select('class_id, subject_id, teacher_id, unit_chapter, learning_outcomes, resources_needed, teacher_remarks, days')
        .eq('school_id', userRole.school_id)
        .eq('week_start', activeRange.start);

      if (viewMode === 'teacher') {
        const tid = selectedTeacherId || myStaffId;
        if (tid) plansQuery = plansQuery.eq('teacher_id', tid);
      } else if (viewMode === 'class' && selectedClassId) {
        plansQuery = plansQuery.eq('class_id', selectedClassId);
      }

      const { data: planRows, error: plansError } = await plansQuery;
      if (plansError) console.warn('lesson_plans fetch error:', plansError.message);

      const savedPlansMap: Record<string, any> = {};
      (planRows || []).forEach(row => {
        const key = `${row.class_id}__${row.subject_id}`;
        savedPlansMap[key] = {
          unit_chapter: row.unit_chapter || '',
          learning_outcomes: row.learning_outcomes || '',
          resources_needed: row.resources_needed || '',
          teacher_remarks: row.teacher_remarks || '',
          days: row.days || {},
        };
      });

      const items: PlanItem[] = slots.map(slot => {
        const key = `${slot.class_id}__${slot.subject_id}`;
        const saved = savedPlansMap[key] || {};
        const savedDays: Record<string, DayPlanDetail> = saved.days || {};

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
      console.error('[TeacherPlanner] Error in fetchSlots:', err);
    } finally {
      setLoading(false);
    }
  }, [userRole?.school_id, viewMode, selectedClassId, selectedTeacherId, myStaffId, allClasses, allTeachers, allSubjects, rangeDays, activeRange.start]);

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

  // ─── Save to lesson_plans Table (Upsert one row per class+subject+week) ─────
  const persistPlansToDatabase = async (itemsToSave: PlanItem[]) => {
    if (!userRole?.school_id) return false;

    const teacherId = selectedTeacherId || myStaffId || null;

    // Build upsert rows — one per class+subject combination
    const upsertRows = itemsToSave.map(item => ({
      school_id: userRole.school_id,
      teacher_id: item.teacher_id || teacherId,
      class_id: item.class_id,
      subject_id: item.subject_id,
      week_start: activeRange.start,
      week_end: activeRange.end,
      unit_chapter: item.unit_chapter || '',
      learning_outcomes: item.learning_outcomes || '',
      resources_needed: item.resources_needed || '',
      teacher_remarks: item.teacher_remarks || '',
      days: item.days || {},
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('lesson_plans')
      .upsert(upsertRows, {
        onConflict: 'school_id,teacher_id,class_id,subject_id,week_start',
        ignoreDuplicates: false,
      });

    if (error) throw error;
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
      {/* ── Urdu Nastaleeq & Print Layout Stylesheet ── */}
      <style>{`
        .urdu-text, .font-nastaleeq {
          font-family: 'Noto Nastaliq Urdu', 'Inter', serif !important;
          unicode-bidi: plaintext;
          text-align: start;
        }
        @media print {
          body { background: white !important; margin: 0 !important; padding: 0 !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; width: 100% !important; }
          @page { size: landscape; margin: 6mm; }
          .planner-print-layout {
            width: 100%;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            margin: 0 !important;
          }
          .urdu-text, .font-nastaleeq {
            font-family: 'Noto Nastaliq Urdu', 'Inter', serif !important;
            unicode-bidi: plaintext !important;
            text-align: start !important;
          }
          table { page-break-after: auto; width: 100% !important; border-collapse: collapse !important; }
          tr { page-break-inside: avoid !important; }
        }
        .print-only { display: none; }
      `}</style>

      {/* ── Control Header ── */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm no-print space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Left: Branding & Title */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-tr from-indigo-600 to-indigo-500 rounded-2xl flex items-center justify-center text-white shadow-md shadow-indigo-200">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight">
                  Curriculum & Lesson Planner
                </h1>
                <span className="px-2.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-full text-[10px] font-black tracking-widest uppercase">
                  {duration}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-semibold">
                Weekly syllabus, SLOs, topics & daily diary entries
              </p>
            </div>
          </div>

          {/* Right: Actions Bar */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Duration Mode Switcher */}
            <div className="bg-slate-100 p-1 rounded-2xl flex gap-1 border border-slate-200">
              {(['weekly', '15days', 'monthly', 'custom'] as PlanDuration[]).map(d => (
                <button
                  key={d}
                  onClick={() => {
                    setDuration(d);
                    setActiveDayFilter('all');
                  }}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-black transition-all capitalize',
                    duration === d ? 'bg-white shadow-xs text-indigo-700' : 'text-slate-500 hover:text-slate-900'
                  )}
                >
                  {d === 'weekly' ? 'Weekly' : d === '15days' ? '15 Days' : d === 'monthly' ? 'Monthly' : 'Custom'}
                </button>
              ))}
            </div>

            <div className="h-6 w-px bg-slate-200 mx-0.5 hidden sm:block" />

            {/* Print & PDF Dropdown */}
            <div className="relative" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="h-9 px-3.5 rounded-xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 text-xs font-black flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
              >
                <Printer className="w-4 h-4 text-indigo-600" />
                <span>Print & PDF</span>
                <ChevronRight className={cn('w-3.5 h-3.5 transition-transform', showExportMenu ? '-rotate-90' : 'rotate-90')} />
              </button>

              {showExportMenu && (
                <div className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-2xl shadow-xl border border-slate-200 p-1.5 z-40 space-y-1 animate-in fade-in-50 zoom-in-95 duration-100">
                  <button
                    onClick={() => {
                      setShowExportMenu(false);
                      triggerDayWisePrint();
                    }}
                    className="w-full px-3 py-2 text-left rounded-xl hover:bg-indigo-50/70 text-slate-700 hover:text-indigo-700 text-xs font-black flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div>
                      <div>Print Gazette (Nastaleeq)</div>
                      <div className="text-[10px] text-slate-400 font-normal">Day-wise landscape print sheet</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setShowExportMenu(false);
                      handleDayWisePDFExport(activeDayFilter !== 'all' ? activeDayFilter : undefined);
                    }}
                    className="w-full px-3 py-2 text-left rounded-xl hover:bg-indigo-50/70 text-slate-700 hover:text-indigo-700 text-xs font-black flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div>
                      <div>Download Day-Wise PDF</div>
                      <div className="text-[10px] text-slate-400 font-normal">Standard PDF export</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setShowExportMenu(false);
                      triggerSubjectWisePrint();
                    }}
                    className="w-full px-3 py-2 text-left rounded-xl hover:bg-indigo-50/70 text-slate-700 hover:text-indigo-700 text-xs font-black flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <BookOpen className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div>
                      <div>Subject-Wise Syllabus PDF</div>
                      <div className="text-[10px] text-slate-400 font-normal">Grouped by course/subject</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Template Download */}
            <button
              onClick={downloadExcelTemplate}
              className="h-9 px-3 rounded-xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100 text-emerald-800 text-xs font-black flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
              title="Download pre-filled Excel spreadsheet template for this week"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline">Excel</span> Template
            </button>

            {/* Import Button */}
            <button
              onClick={() => {
                setImportStatus(null);
                setShowImportModal(true);
              }}
              className="h-9 px-3 rounded-xl border border-purple-200 bg-purple-50/60 hover:bg-purple-100 text-purple-800 text-xs font-black flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
              title="Import Lesson Plans from Excel or CSV file"
            >
              <Upload className="w-4 h-4 text-purple-600" />
              Import Plan
            </button>

            {/* Compliance Report (Coordinators & Admins) */}
            {isAdmin && (
              <button
                onClick={() => navigate('/planner/report')}
                className="h-9 px-3 rounded-xl border border-teal-200 bg-teal-50/60 hover:bg-teal-100 text-teal-800 text-xs font-black flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                title="Open Lesson Planner Submission & Compliance Report"
              >
                <CheckCircle2 className="w-4 h-4 text-teal-600" />
                <span className="hidden sm:inline">Audit</span> Report
              </button>
            )}

            {/* Save All Plans Button */}
            <button
              onClick={saveAllPlans}
              disabled={savingAll}
              className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-98 disabled:opacity-50 text-white text-xs font-black flex items-center gap-2 transition-all shadow-md shadow-indigo-200 cursor-pointer"
            >
              {savingAll ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 text-white" />
                  <span>Save All Plans</span>
                </>
              )}
            </button>

          </div>
        </div>
      </div>



      {/* ── Perspective & Date Controls Bar ── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm no-print items-center">
        
        {/* Mode Selector (Teacher View vs Class View) */}
        <div className="md:col-span-4 flex items-center gap-2">
          {canClassView ? (
            <div className="bg-slate-100 p-1 rounded-xl flex gap-1 border border-slate-200 w-full">
              <button
                onClick={() => setViewMode('teacher')}
                className={cn(
                  'flex-1 py-1.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5',
                  viewMode === 'teacher' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                )}
              >
                <PenTool className="w-3.5 h-3.5" /> My Planner
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
          ) : (
            <div className="bg-indigo-50 border border-indigo-200 px-3.5 py-1.5 rounded-xl text-xs font-black text-indigo-800 flex items-center gap-2 w-full">
              <PenTool className="w-4 h-4 text-indigo-600" />
              <span>Faculty Lesson Planner</span>
            </div>
          )}
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
                {(isExecutive ? allClasses : allClasses.filter(c => inchargeClassIds.includes(c.id) || c.class_teacher_id === myStaffId)).map(c => (
                  <option key={c.id} value={c.id}>
                    Class: {c.name} {c.section} {inchargeClassIds.includes(c.id) ? '★ (My Incharge Class)' : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : !isExecutive ? (
            <div className="w-full px-3.5 py-2 text-xs font-black bg-slate-50 border border-slate-200 rounded-xl text-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Faculty: <b>{allTeachers.find(t => t.id === (selectedTeacherId || myStaffId))?.full_name || 'My Planner'}</b></span>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Logged In</span>
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

      {/* ── Planner Editor & Viewer (Screen Only) ── */}
      <div className="no-print space-y-4">
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
                      dir="auto"
                      value={item.unit_chapter}
                      onChange={e => updateGeneralField(idx, 'unit_chapter', e.target.value)}
                      placeholder="e.g. Unit 4: Linear Equations / سبق نمبر 4"
                      className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 urdu-text font-['Noto_Nastaliq_Urdu',_'Inter',_serif]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-indigo-700 uppercase tracking-wider">
                      🎯 Learning Outcomes & Objectives (SLOs)
                    </label>
                    <input
                      type="text"
                      dir="auto"
                      value={item.learning_outcomes}
                      onChange={e => updateGeneralField(idx, 'learning_outcomes', e.target.value)}
                      placeholder="e.g. Students will solve word problems / تدریسی مقاصد"
                      className="w-full px-3 py-2 text-xs font-bold bg-white border border-indigo-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 urdu-text font-['Noto_Nastaliq_Urdu',_'Inter',_serif]"
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
                                dir="auto"
                                value={dayDetail.topic || ''}
                                onChange={e => updateDayField(idx, d.date, 'topic', e.target.value)}
                                placeholder="Topic name / سبق کا عنوان..."
                                className="w-full px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white urdu-text font-['Noto_Nastaliq_Urdu',_'Inter',_serif]"
                              />
                            </div>

                            {/* Classwork / Lab */}
                            <div className="space-y-1">
                              <label className="block text-[10px] font-black text-emerald-700 uppercase tracking-wider">
                                🧪 Classwork & In-Class Task
                              </label>
                              <input
                                type="text"
                                dir="auto"
                                value={dayDetail.classwork || ''}
                                onChange={e => updateDayField(idx, d.date, 'classwork', e.target.value)}
                                placeholder="Reading, problem solving / جماعت کا کام..."
                                className="w-full px-3 py-1.5 text-xs font-semibold bg-emerald-50/40 border border-emerald-100 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white urdu-text font-['Noto_Nastaliq_Urdu',_'Inter',_serif]"
                              />
                            </div>

                            {/* Homework & Diary Task */}
                            <div className="space-y-1">
                              <label className="block text-[10px] font-black text-amber-700 uppercase tracking-wider">
                                📝 Homework & Assignment
                              </label>
                              <input
                                type="text"
                                dir="auto"
                                value={dayDetail.homework || ''}
                                onChange={e => updateDayField(idx, d.date, 'homework', e.target.value)}
                                placeholder="Q1 to Q5 / گھر کا کام..."
                                className="w-full px-3 py-1.5 text-xs font-semibold bg-amber-50/40 border border-amber-100 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white urdu-text font-['Noto_Nastaliq_Urdu',_'Inter',_serif]"
                              />
                            </div>

                            {/* Quiz / Oral Test */}
                            <div className="space-y-1">
                              <label className="block text-[10px] font-black text-rose-600 uppercase tracking-wider">
                                ⏱️ Quiz / Test (If any)
                              </label>
                              <input
                                type="text"
                                dir="auto"
                                value={dayDetail.quiz_test || ''}
                                onChange={e => updateDayField(idx, d.date, 'quiz_test', e.target.value)}
                                placeholder="Friday test, oral quiz / ٹیسٹ..."
                                className="w-full px-3 py-1.5 text-xs font-semibold bg-rose-50/40 border border-rose-100 rounded-lg outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white urdu-text font-['Noto_Nastaliq_Urdu',_'Inter',_serif]"
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
      </div>

      {/* ── PRINT ONLY HIGH-DEFINITION HTML LAYOUT (Rendered on window.print() / Save as PDF) ── */}
      <div className="print-only">
        <div className="planner-print-layout" style={{ padding: '0 0 15px 0', background: 'white' }}>
          {/* Top Banner */}
          <div style={{ height: '8px', background: 'linear-gradient(90deg, #1e1b4b, #4338ca, #087fe5)', marginBottom: '12px' }} />

          {/* Header */}
          <div style={{ padding: '0 25px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', paddingBottom: '6px', borderBottom: '2px solid #1e1b4b', marginBottom: '8px' }}>
              {schoolInfo?.logo_url && (
                <img src={schoolInfo.logo_url} crossOrigin="anonymous" style={{ width: '50px', height: '50px', objectFit: 'contain', marginRight: '15px' }} alt="logo" />
              )}
              <div style={{ flexGrow: 1, textAlign: 'center' }}>
                <h1 style={{ fontSize: '20px', fontWeight: '900', color: '#1e1b4b', margin: '0', textTransform: 'uppercase', letterSpacing: '-0.3px' }}>
                  {schoolInfo?.name || 'School Planner'}
                </h1>
                <p style={{ fontSize: '10px', color: '#475569', fontWeight: '700', margin: '2px 0 0 0' }}>{schoolInfo?.address || ''}</p>
                <div style={{ marginTop: '4px' }}>
                  <span style={{ background: '#1e1b4b', color: 'white', padding: '3px 20px', borderRadius: '50px', fontWeight: '900', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    {viewMode === 'class' ? `Class Lesson Plan: Grade ${selectedClsObj?.name} ${selectedClsObj?.section}` : `Teacher Lesson Plan: ${allTeachers.find(t => t.id === (selectedTeacherId || myStaffId))?.full_name || 'Staff'}`}
                    {' · '}{duration.toUpperCase()} ({activeRange.label})
                  </span>
                </div>
              </div>
              <div style={{ width: '50px' }} />
            </div>

            {/* Range & Details Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontWeight: '900', fontSize: '11px', border: '1.5px solid #1e1b4b', padding: '6px 15px', background: '#f8fafc', color: '#1e1b4b', borderRadius: '4px', marginBottom: '10px' }}>
              <span>PERIOD: {activeRange.label} ({rangeDays.length} Teaching Days)</span>
              <span>{viewMode === 'class' ? `CLASS: ${selectedClsObj?.name} ${selectedClsObj?.section}` : `FACULTY: ${allTeachers.find(t => t.id === (selectedTeacherId || myStaffId))?.full_name || 'Assigned Teacher'}`}</span>
            </div>

            {/* Dual Print Layout Rendering */}
            {printLayoutMode === 'subjectwise' ? (
              /* ── Subject-Wise Print Blocks ── */
              <div>
                {planItems.map((item, itemIdx) => (
                  <div key={itemIdx} style={{ marginBottom: '16px', pageBreakInside: 'avoid' }}>
                    {/* Subject Header Banner */}
                    <div style={{ background: '#1e1b4b', color: 'white', padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '4px 4px 0 0' }}>
                      <span style={{ fontWeight: '900', fontSize: '11px', textTransform: 'uppercase' }}>
                        📚 {item.subject_name} ({item.class_name}) — Teacher: {item.teacher_name}
                      </span>
                      <span style={{ fontSize: '9px', opacity: 0.8, textTransform: 'uppercase' }}>
                        {duration.toUpperCase()} ({activeRange.label})
                      </span>
                    </div>

                    {/* Unit & SLOs Strip */}
                    <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderTop: 'none', padding: '6px 10px', fontSize: '9px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div className="urdu-text" dir="auto" style={{ fontWeight: '800', color: '#1e1b4b' }}>
                        📖 <strong>Unit / Chapter:</strong> {item.unit_chapter || 'In Progress'}
                      </div>
                      {item.learning_outcomes && (
                        <div className="urdu-text" dir="auto" style={{ fontWeight: '700', color: '#4338ca' }}>
                          🎯 <strong>Learning Outcomes (SLOs):</strong> {item.learning_outcomes}
                        </div>
                      )}
                    </div>

                    {/* Subject Days Table */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #1e1b4b', tableLayout: 'fixed' }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9', color: '#1e1b4b', fontSize: '9px', fontWeight: '900', textTransform: 'uppercase' }}>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px', width: '15%', textAlign: 'center' }}>Day &amp; Date</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px', width: '28%', textAlign: 'center' }}>Topic / Lesson Covered</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px', width: '26%', textAlign: 'center' }}>Classwork &amp; Activities</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px', width: '21%', textAlign: 'center' }}>Homework / Assignment</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px', width: '10%', textAlign: 'center' }}>Quiz / Test</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rangeDays.map((d, dIdx) => {
                          const dayDetail = item.days[d.date] || { topic: '', classwork: '', homework: '', quiz_test: '' };
                          return (
                            <tr key={dIdx} style={{ background: dIdx % 2 === 0 ? 'white' : '#f8fafc', fontSize: '9.5px' }}>
                              <td style={{ border: '1px solid #cbd5e1', padding: '6px', fontWeight: '900', textAlign: 'center' }}>
                                <div style={{ color: '#1e1b4b' }}>{d.dayName}</div>
                                <div style={{ color: '#64748b', fontSize: '8.5px' }}>{d.formattedDate}</div>
                              </td>
                              <td className="urdu-text" dir="auto" style={{ border: '1px solid #cbd5e1', padding: '6px', verticalAlign: 'top', textAlign: 'start' }}>
                                {dayDetail.topic || '—'}
                              </td>
                              <td className="urdu-text" dir="auto" style={{ border: '1px solid #cbd5e1', padding: '6px', verticalAlign: 'top', textAlign: 'start' }}>
                                {dayDetail.classwork || '—'}
                              </td>
                              <td className="urdu-text" dir="auto" style={{ border: '1px solid #cbd5e1', padding: '6px', verticalAlign: 'top', textAlign: 'start' }}>
                                {dayDetail.homework || '—'}
                              </td>
                              <td className="urdu-text" dir="auto" style={{ border: '1px solid #cbd5e1', padding: '6px', verticalAlign: 'top', textAlign: 'center' }}>
                                {dayDetail.quiz_test || '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            ) : (
              /* ── Day-Wise Print Blocks ── */
              <div>
                {displayDays.map(d => (
                  <div key={d.date} style={{ marginBottom: '14px', pageBreakInside: 'avoid' }}>
                    <div style={{ background: '#1e1b4b', color: 'white', padding: '4px 10px', fontWeight: '900', fontSize: '10px', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between', borderRadius: '3px 3px 0 0' }}>
                      <span>📅 {d.dayName.toUpperCase()} — {d.formattedDate}</span>
                      <span>{d.date}</span>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #1e1b4b', tableLayout: 'fixed' }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9', color: '#1e1b4b', fontSize: '9px', fontWeight: '900', textTransform: 'uppercase' }}>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px', width: '15%', textAlign: 'center' }}>Subject &amp; Teacher</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px', width: '28%', textAlign: 'center' }}>Lesson / Topic Covered</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px', width: '26%', textAlign: 'center' }}>Classwork &amp; In-Class Task</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px', width: '21%', textAlign: 'center' }}>Homework / Assignment</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px', width: '10%', textAlign: 'center' }}>Quiz / Test</th>
                        </tr>
                      </thead>
                      <tbody>
                        {planItems.map((item, itemIdx) => {
                          const dayDetail = item.days[d.date] || { topic: '', classwork: '', homework: '', quiz_test: '' };
                          return (
                            <tr key={itemIdx} style={{ background: itemIdx % 2 === 0 ? 'white' : '#f8fafc', fontSize: '9.5px' }}>
                              <td style={{ border: '1px solid #cbd5e1', padding: '6px', fontWeight: '800', textAlign: 'center' }}>
                                <div style={{ color: '#1e1b4b', fontWeight: '900' }}>{item.subject_name}</div>
                                <div style={{ color: '#64748b', fontSize: '8.5px', marginTop: '2px' }}>{item.class_name} · {item.teacher_name}</div>
                              </td>
                              <td className="urdu-text" dir="auto" style={{ border: '1px solid #cbd5e1', padding: '6px', verticalAlign: 'top', textAlign: 'start' }}>
                                {dayDetail.topic || '—'}
                              </td>
                              <td className="urdu-text" dir="auto" style={{ border: '1px solid #cbd5e1', padding: '6px', verticalAlign: 'top', textAlign: 'start' }}>
                                {dayDetail.classwork || '—'}
                              </td>
                              <td className="urdu-text" dir="auto" style={{ border: '1px solid #cbd5e1', padding: '6px', verticalAlign: 'top', textAlign: 'start' }}>
                                {dayDetail.homework || '—'}
                              </td>
                              <td className="urdu-text" dir="auto" style={{ border: '1px solid #cbd5e1', padding: '6px', verticalAlign: 'top', textAlign: 'center' }}>
                                {dayDetail.quiz_test || '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}

            {/* Signature Area */}
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', margin: '30px 0 10px 0', pageBreakInside: 'avoid' }}>
              <div style={{ textAlign: 'center', width: '200px' }}>
                <div style={{ borderTop: '1.5px solid #1e1b4b', paddingTop: '6px', fontWeight: '900', color: '#1e1b4b', fontSize: '10px', textTransform: 'uppercase' }}>Subject Teacher Signature</div>
              </div>
              <div style={{ textAlign: 'center', width: '200px' }}>
                <div style={{ borderTop: '1.5px solid #1e1b4b', paddingTop: '6px', fontWeight: '900', color: '#1e1b4b', fontSize: '10px', textTransform: 'uppercase' }}>Class Incharge Signature</div>
              </div>
              <div style={{ textAlign: 'center', width: '200px' }}>
                <div style={{ borderTop: '1.5px solid #1e1b4b', paddingTop: '6px', fontWeight: '900', color: '#1e1b4b', fontSize: '10px', textTransform: 'uppercase' }}>Principal / Coordinator</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Import Lesson Plan Modal ── */}
      {showImportModal && (
        <div 
          className="fixed inset-0 z-[9999] overflow-y-auto flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-xs no-print animate-in fade-in duration-150"
          onClick={() => setShowImportModal(false)}
        >
          <div 
            className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 p-5 sm:p-6 space-y-4 my-auto max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-50 text-purple-600 rounded-2xl border border-purple-100 shrink-0">
                  <FileSpreadsheet className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900">Import Lesson Plans from Excel / CSV</h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 font-semibold">Upload spreadsheet for week starting <b>{activeRange.start}</b></p>
                </div>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Template Help & Download */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 sm:p-4 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-black text-slate-800">Need the standard spreadsheet format?</span>
                  <button
                    onClick={downloadExcelTemplate}
                    className="inline-flex items-center justify-center gap-1.5 text-xs font-black text-emerald-700 hover:text-emerald-800 bg-emerald-100/70 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" /> Download Template (.xlsx)
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                  The spreadsheet contains columns for <b>Class Name</b>, <b>Subject Name</b>, <b>Unit/Chapter</b>, <b>SLOs</b>, and day columns (<b>Mon Topic</b>, <b>Mon Classwork</b>, <b>Mon Homework</b>, <b>Mon Quiz</b>, etc.).
                </p>
              </div>

              {/* File Upload Zone */}
              <div className="border-2 border-dashed border-purple-200 hover:border-purple-400 bg-purple-50/20 hover:bg-purple-50/50 transition-all rounded-2xl p-5 sm:p-6 text-center">
                <input
                  type="file"
                  id="lesson-plan-file-input"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  disabled={importLoading}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) processImportFile(file);
                  }}
                />
                <label htmlFor="lesson-plan-file-input" className="cursor-pointer flex flex-col items-center justify-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 shadow-xs">
                    {importLoading ? (
                      <RefreshCw className="w-6 h-6 animate-spin text-purple-600" />
                    ) : (
                      <UploadCloud className="w-6 h-6 text-purple-600" />
                    )}
                  </div>
                  <div className="text-xs sm:text-sm font-black text-slate-800">
                    {importLoading ? 'Processing & Importing Plans...' : 'Click to Browse or Drag & Drop File'}
                  </div>
                  <div className="text-[11px] text-slate-400 font-semibold">Supports .xlsx, .xls, and .csv files</div>
                </label>
              </div>

              {/* Status & Logs */}
              {importStatus && (
                <div className="space-y-2">
                  {importStatus.success && (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-black flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{importStatus.success}</span>
                    </div>
                  )}
                  {importStatus.error && (
                    <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-black flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{importStatus.error}</span>
                    </div>
                  )}

                  {importStatus.logs && importStatus.logs.length > 0 && (
                    <div className="max-h-36 overflow-y-auto bg-slate-900 text-slate-100 p-3 rounded-xl text-[11px] font-mono space-y-1">
                      {importStatus.logs.map((log, lIdx) => (
                        <div key={lIdx} className="text-slate-300">
                          {log}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

