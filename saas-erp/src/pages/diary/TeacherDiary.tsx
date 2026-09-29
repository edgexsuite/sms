import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  ClipboardList, Save, Calendar, Users, Printer,
  ChevronLeft, ChevronRight, BookOpen, CheckCircle2,
  AlertCircle, Calculator, FlaskConical, PenTool,
  Book, Globe, Cpu, Palette, CalendarDays, Download,
  CalendarRange, Sparkles, RefreshCw, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDate, getBase64Image } from '../../lib/utils';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { registerUrduFont, getFontForText, containsUrdu } from '../../lib/pdfFontUtils';
import { PageHeader, Card, Btn, EmptyState } from '../../components/ui';

// ─── Timestamp Formatter ──────────────────────────────────────────────────────
export const formatDiaryTimestamp = (isoString?: string | null): string => {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
};

// ─── EF & Week Helpers ────────────────────────────────────────────────────────
export const isEFClass = (className?: string, section?: string): boolean => {
  if (!className && !section) return false;
  const str = `${className || ''} ${section || ''}`.toUpperCase().trim();
  return (
    str.includes('EF') ||
    str.includes('EARLY FOUNDATION') ||
    str.includes('BEG') ||
    /EF[- ]?[123]/i.test(str)
  );
};

export const getMonday = (dateStr: string): string => {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  return mon.toISOString().split('T')[0];
};

export const getWeekDays = (mondayStr: string) => {
  const days = [];
  const names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const shortNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  for (let i = 0; i < 5; i++) {
    const d = new Date(mondayStr);
    d.setDate(d.getDate() + i);
    const dateIso = d.toISOString().split('T')[0];
    days.push({
      date: dateIso,
      name: names[i],
      short: shortNames[i],
      formatted: formatDate(dateIso),
    });
  }
  return days;
};

// ─── Types ───────────────────────────────────────────────────────────────────
interface Slot {
  class_id: string;
  class_name: string;
  section: string;
  subject_id: string;
  subject_name: string;
  teacher_id?: string;
  teacher_name?: string;
}

interface DiaryRow {
  slot: Slot;
  topic_covered: string;
  homework: string;
  activity_notes: string;
  next_plan: string;
  existingId: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  saving: boolean;
  saved: boolean;
}

// ─── Subject Meta Helper ───────────────────────────────────────────────────
const getSubjectMeta = (name: string = '') => {
  const n = name.toLowerCase();
  if (n.includes('math')) return { icon: Calculator, color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' }; // Blue
  if (n.includes('sci') || n.includes('bio') || n.includes('phys') || n.includes('chem')) 
    return { icon: FlaskConical, color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0' }; // Emerald
  if (n.includes('eng')) return { icon: Book, color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' }; // Indigo
  if (n.includes('urd') || n.includes('ara') || n.includes('isl')) 
    return { icon: PenTool, color: '#0d9488', bg: '#f0fdfa', border: '#99fadc' }; // Teal
  if (n.includes('comp') || n.includes('it')) 
    return { icon: Cpu, color: '#475569', bg: '#f1f5f9', border: '#cbd5e1' }; // Slate
  if (n.includes('his') || n.includes('soc') || n.includes('geo')) 
    return { icon: Globe, color: '#d97706', bg: '#fffbeb', border: '#fde68a' }; // Amber
  if (n.includes('art') || n.includes('draw')) 
    return { icon: Palette, color: '#db2777', bg: '#fdf2f8', border: '#fbcfe8' }; // Pink
  
  return { icon: BookOpen, color: '#4f46e5', bg: '#f5f3ff', border: '#ddd6fe' }; // Default Indigo
};

// ─── Main Component ──────────────────────────────────────────────────────────
export default function TeacherDiary() {
  const { userRole, isClassIncharge, canManageClassDiary, inchargeClassIds } = useAuth();
  const isTeacher = userRole?.role === 'teacher';
  const isExecutive = ['admin', 'director', 'principal', 'vice_principal', 'academic_coordinator', 'campus_coordinator', 'section_coordinator'].includes(userRole?.role || '');
  const isAdmin = isExecutive || canManageClassDiary();
  const canClassView = isAdmin || isClassIncharge();

  const [myStaffId, setMyStaffId] = useState<string | null>(null);
  const [allTeachers, setAllTeachers] = useState<any[]>([]);
  const [allClasses, setAllClasses] = useState<any[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedTeacherName, setSelectedTeacherName] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedClassName, setSelectedClassName] = useState('');
  const [viewMode, setViewMode] = useState<'teacher' | 'class'>(canClassView && !isAdmin ? 'class' : 'teacher');
  const [assignedSlots, setAssignedSlots] = useState<Slot[]>([]);
  const [viewDate, setViewDate] = useState(new Date().toISOString().split('T')[0]);
  const [rows, setRows] = useState<DiaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [scheduleActive, setScheduleActive] = useState(false); // true when diary_schedule filters apply

  // ── Weekly Diary & Early Foundation (EF) State ─────────────────────────────
  const [diaryPeriod, setDiaryPeriod] = useState<'daily' | 'weekly'>('daily');
  const [weekStart, setWeekStart] = useState<string>(() => getMonday(new Date().toISOString().split('T')[0]));
  const [weeklyData, setWeeklyData] = useState<Record<string, Record<string, { topic: string; homework: string; activity: string; id?: string; createdAt?: string; saving?: boolean; saved?: boolean }>>>({});
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [weeklySaving, setWeeklySaving] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [activeDayIndex, setActiveDayIndex] = useState(0);

  const [schoolInfo, setSchoolInfo] = useState<{
    name: string; 
    address: string; 
    logo_url?: string;
    diary_settings?: {
      show_topic_covered: boolean;
      show_homework: boolean;
      show_activity_notes: boolean;
      show_next_plan: boolean;
    }
  } | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const selectedClassObj = useMemo(() => allClasses.find(c => c.id === selectedClassId), [allClasses, selectedClassId]);
  const isEF = useMemo(() => isEFClass(selectedClassObj?.name, selectedClassObj?.section), [selectedClassObj]);
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);

  // If user selects an EF class, default to weekly view for effortless planning
  useEffect(() => {
    if (selectedClassId && isEFClass(selectedClassObj?.name, selectedClassObj?.section)) {
      setDiaryPeriod('weekly');
    }
  }, [selectedClassId, selectedClassObj]);

  // ─── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userRole?.school_id) return;
    fetchSchoolInfo();
    fetchAllClasses();
    if (isTeacher) {
      fetchMyStaffRecord();
    } else {
      fetchAllTeachers();
    }
  }, [userRole]);

  const fetchSchoolInfo = async () => {
    const { data } = await supabase
      .from('schools')
      .select('name, address, logo_url, diary_settings')
      .eq('id', userRole?.school_id)
      .maybeSingle();

    if (data) {
      if (data.logo_url && !data.logo_url.startsWith('http')) {
        const { data: publicURL } = supabase.storage.from('logos').getPublicUrl(data.logo_url);
        data.logo_url = publicURL.publicUrl;
      }
      setSchoolInfo(data);
    }
  };

  const fetchMyStaffRecord = async () => {
    if (userRole?.staff_id) {
      const { data } = await supabase
        .from('staff')
        .select('id, full_name')
        .eq('id', userRole.staff_id)
        .eq('is_deleted', false)
        .maybeSingle();
      if (data) {
        setMyStaffId(data.id);
        setSelectedTeacherId(data.id);
        setSelectedTeacherName(data.full_name);
        return;
      }
    }
    const { data: byEmail } = await supabase
      .from('staff')
      .select('id, full_name')
      .eq('school_id', userRole?.school_id)
      .eq('email', userRole?.email || '')
      .eq('is_deleted', false)
      .maybeSingle();
    if (byEmail) {
      setMyStaffId(byEmail.id);
      setSelectedTeacherId(byEmail.id);
      setSelectedTeacherName(byEmail.full_name);
    }
  };

  const fetchAllTeachers = async () => {
    const { data } = await supabase
      .from('staff')
      .select('id, full_name, role')
      .eq('school_id', userRole?.school_id)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('full_name');
    if (data) setAllTeachers(data);
  };

  const fetchAllClasses = async () => {
    const { data } = await supabase
      .from('classes')
      .select('id, name, section, class_teacher_id')
      .eq('school_id', userRole?.school_id)
      .order('name');
    if (data) {
      setAllClasses(data);
      // Auto select incharge class if in class view mode
      if (inchargeClassIds.length > 0 && !selectedClassId) {
        const inchargeCls = data.find((c: any) => inchargeClassIds.includes(c.id));
        if (inchargeCls) {
          setSelectedClassId(inchargeCls.id);
          setSelectedClassName(`${inchargeCls.name} ${inchargeCls.section}`);
        }
      }
    }
  };

  useEffect(() => {
    if (viewMode === 'class' && inchargeClassIds.length > 0 && !selectedClassId && allClasses.length > 0) {
      const inchargeCls = allClasses.find((c: any) => inchargeClassIds.includes(c.id));
      if (inchargeCls) {
        setSelectedClassId(inchargeCls.id);
        setSelectedClassName(`${inchargeCls.name} ${inchargeCls.section}`);
      }
    }
  }, [viewMode, inchargeClassIds, allClasses]);

  useEffect(() => {
    if (viewMode === 'teacher') {
      if (selectedTeacherId) fetchAssignedSlots();
      else setAssignedSlots([]);
    } else {
      if (selectedClassId) fetchClassSlots();
      else setAssignedSlots([]);
    }
  }, [selectedTeacherId, selectedClassId, viewMode]);

  const fetchClassSlots = async () => {
    const { data } = await supabase
      .from('timetable_slots')
      .select('subject_id, subjects(subject_name), teacher_id, staff(full_name)')
      .eq('class_id', selectedClassId)
      .eq('school_id', userRole?.school_id);

    const cls = allClasses.find(c => c.id === selectedClassId);
    let unique: Slot[] = [];

    if (data && data.length > 0) {
      const seen = new Set<string>();
      data.forEach((s: any) => {
        if (!seen.has(s.subject_id)) {
          seen.add(s.subject_id);
          unique.push({
            class_id: selectedClassId,
            class_name: cls?.name || '?',
            section: cls?.section || '',
            subject_id: s.subject_id,
            subject_name: s.subjects?.subject_name || 'General',
            teacher_id: s.teacher_id,
            teacher_name: s.staff?.full_name || 'Unassigned',
          });
        }
      });
    }

    // Fallback: If no timetable slots (common for EF classes & new classes), fetch class subjects directly
    if (unique.length === 0) {
      const { data: subData } = await supabase
        .from('subjects')
        .select('id, subject_name')
        .eq('class_id', selectedClassId)
        .order('subject_name');

      if (subData && subData.length > 0) {
        unique = subData.map((sub: any) => ({
          class_id: selectedClassId,
          class_name: cls?.name || '?',
          section: cls?.section || '',
          subject_id: sub.id,
          subject_name: sub.subject_name || 'General',
          teacher_id: cls?.class_teacher_id || myStaffId || undefined,
          teacher_name: allTeachers.find(t => t.id === cls?.class_teacher_id)?.full_name || 'Class Incharge',
        }));
      }
    }

    unique.sort((a, b) => a.subject_name.localeCompare(b.subject_name));
    setAssignedSlots(unique);
  };

  const fetchAssignedSlots = async () => {
    const { data } = await supabase
      .from('timetable_slots')
      .select('class_id, classes(name, section), subject_id, subjects(subject_name)')
      .eq('teacher_id', selectedTeacherId)
      .eq('school_id', userRole?.school_id);

    if (data) {
      const seen = new Set<string>();
      const unique: Slot[] = [];
      data.forEach((s: any) => {
        const key = `${s.class_id}__${s.subject_id}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push({
            class_id: s.class_id,
            class_name: s.classes?.name || '?',
            section: s.classes?.section || '',
            subject_id: s.subject_id,
            subject_name: s.subjects?.subject_name || 'General',
          });
        }
      });
      unique.sort((a, b) =>
        `${a.class_name}${a.section}${a.subject_name}`.localeCompare(`${b.class_name}${b.section}${b.subject_name}`)
      );
      setAssignedSlots(unique);
    }
  };

  useEffect(() => {
    if (assignedSlots.length > 0 && (viewMode === 'class' ? selectedClassId : selectedTeacherId)) {
      buildRows();
    } else {
      setRows([]);
    }
  }, [assignedSlots, viewDate, selectedTeacherId, selectedClassId, viewMode]);

  const buildRows = async () => {
    setLoading(true);

    // ── Diary Schedule filter ──────────────────────────────────────────────
    const DAYS_EN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const dayOfWeek = DAYS_EN[new Date(viewDate).getDay()];

    let slotsToUse: Slot[] = [];

    if (viewMode === 'class' && selectedClassId) {
      // ── Class view ────────────────────────────────────────────────────────
      const { data: schedRows } = await supabase
        .from('diary_schedule')
        .select('subject_id, slot_order, subjects(subject_name)')
        .eq('class_id', selectedClassId)
        .eq('school_id', userRole?.school_id)
        .eq('day_of_week', dayOfWeek)
        .order('slot_order');

      if (schedRows && schedRows.length > 0) {
        setScheduleActive(true);
        const cls = allClasses.find((c: any) => c.id === selectedClassId);
        slotsToUse = schedRows.map((r: any) => {
          const existing = assignedSlots.find(s =>
            s.subject_id === r.subject_id && s.class_id === selectedClassId
          );
          return {
            class_id:     selectedClassId,
            class_name:   cls?.name || '',
            section:      cls?.section || '',
            subject_id:   r.subject_id,
            subject_name: (r.subjects as any)?.subject_name || existing?.subject_name || '—',
            teacher_id:   existing?.teacher_id || myStaffId || undefined,
            teacher_name: existing?.teacher_name || 'Unassigned',
          };
        });
      } else {
        setScheduleActive(false);
        slotsToUse = assignedSlots;
      }

    } else {
      // ── Teacher view: one batch query for all teacher's classes ───────────
      const uniqueClassIds: string[] = Array.from(new Set(assignedSlots.map(s => s.class_id)));

      const { data: schedRows } = await supabase
        .from('diary_schedule')
        .select('class_id, subject_id, slot_order, subjects(subject_name)')
        .in('class_id', uniqueClassIds)
        .eq('school_id', userRole?.school_id)
        .eq('day_of_week', dayOfWeek)
        .order('slot_order');

      // Group schedule rows by class_id
      const schedByClass = new Map<string, any[]>();
      (schedRows || []).forEach((r: any) => {
        if (!schedByClass.has(r.class_id)) schedByClass.set(r.class_id, []);
        schedByClass.get(r.class_id)!.push(r);
      });

      setScheduleActive(schedByClass.size > 0);

      // Per class: apply its schedule, or fall back to all teacher subjects
      uniqueClassIds.forEach(classId => {
        const classSchedule = schedByClass.get(classId);
        const teacherSlotsForClass = assignedSlots.filter(s => s.class_id === classId);

        if (classSchedule && classSchedule.length > 0) {
          // Include only the teacher's subjects that appear in this class's schedule
          classSchedule.forEach((r: any) => {
            const existing = teacherSlotsForClass.find(s => s.subject_id === r.subject_id);
            if (existing) slotsToUse.push(existing);
          });
        } else {
          // No schedule for this class — show all teacher subjects for it
          slotsToUse.push(...teacherSlotsForClass);
        }
      });
    }

    // ── Fetch existing diary entries for this date ─────────────────────────
    let query = supabase
      .from('teacher_diary')
      .select('*, staff(full_name)')
      .eq('school_id', userRole?.school_id)
      .eq('diary_date', viewDate);

    if (viewMode === 'teacher') {
      query = query.eq('teacher_id', selectedTeacherId);
    } else {
      query = query.eq('class_id', selectedClassId);
    }

    const { data: existing } = await query;
    const existingMap = new Map<string, any>();
    (existing || []).forEach((e: any) => {
      existingMap.set(`${e.class_id}__${e.subject_id}`, e);
    });

    const newRows: DiaryRow[] = slotsToUse.map(slot => {
      const key = `${slot.class_id}__${slot.subject_id}`;
      const found = existingMap.get(key);
      return {
        slot: {
          ...slot,
          teacher_name: found?.staff?.full_name || slot.teacher_name || 'Unassigned'
        },
        topic_covered: found?.topic_covered || '',
        homework: found?.homework || '',
        activity_notes: found?.activity_notes || '',
        next_plan: found?.next_plan || '',
        existingId: found?.id || null,
        createdAt: found?.created_at || null,
        updatedAt: found?.updated_at || null,
        saving: false,
        saved: false,
      };
    });
    setRows(newRows);
    setLoading(false);
  };

  const updateRow = (index: number, field: keyof DiaryRow, value: string) => {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, [field]: value, saved: false } : r));
  };

  const saveRow = async (index: number) => {
    const row = rows[index];
    if (!row.homework.trim()) {
      alert('Home Assignments / Task is required before saving.');
      return;
    }
    setRows(prev => prev.map((r, i) => i === index ? { ...r, saving: true } : r));
    try {
      const activeTeacherId = viewMode === 'teacher' ? selectedTeacherId : (row.slot.teacher_id || myStaffId || selectedTeacherId);
      if (!activeTeacherId) throw new Error("No teacher assigned to this subject. Please select a teacher or ensure staff account is linked.");

      const payload = {
        school_id: userRole?.school_id,
        teacher_id: activeTeacherId,
        class_id: row.slot.class_id,
        subject_id: row.slot.subject_id,
        diary_date: viewDate,
        topic_covered: row.topic_covered,
        homework: row.homework || null,
        activity_notes: row.activity_notes || null,
        next_plan: row.next_plan || null,
      };
      const { error } = await supabase
        .from('teacher_diary')
        .upsert([payload], { onConflict: 'teacher_id,class_id,subject_id,diary_date' });
      if (error) throw error;
      const now = new Date().toISOString();
      setRows(prev => prev.map((r, i) => i === index ? { ...r, saving: false, saved: true, createdAt: r.createdAt || now } : r));
      setTimeout(() => {
        setRows(prev => prev.map((r, i) => i === index ? { ...r, saved: false } : r));
      }, 3000);
    } catch (err: any) {
      alert(err.message);
      setRows(prev => prev.map((r, i) => i === index ? { ...r, saving: false } : r));
    }
  };

  const saveAll = async () => {
    const toSave = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.homework.trim());
    for (const { i } of toSave) {
      await saveRow(i);
    }
  };

  const shiftDate = (days: number) => {
    const d = new Date(viewDate);
    d.setDate(d.getDate() + days);
    setViewDate(d.toISOString().split('T')[0]);
  };

  const shiftWeek = (weeks: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + weeks * 7);
    setWeekStart(d.toISOString().split('T')[0]);
  };

  // ── Weekly Diary Data Handlers ─────────────────────────────────────────────
  useEffect(() => {
    if (viewMode === 'class' && selectedClassId && diaryPeriod === 'weekly') {
      fetchWeeklyData();
    }
  }, [viewMode, selectedClassId, weekStart, diaryPeriod]);

  const fetchWeeklyData = async () => {
    if (!selectedClassId || !userRole?.school_id) return;
    setWeeklyLoading(true);
    try {
      const mondayStr = weekDays[0].date;
      const fridayStr = weekDays[4].date;

      const { data, error } = await supabase
        .from('teacher_diary')
        .select('*')
        .eq('school_id', userRole.school_id)
        .eq('class_id', selectedClassId)
        .gte('diary_date', mondayStr)
        .lte('diary_date', fridayStr);

      if (error) throw error;

      const map: Record<string, Record<string, { topic: string; homework: string; activity: string; id?: string; createdAt?: string; saving?: boolean; saved?: boolean }>> = {};
      (data || []).forEach((row: any) => {
        if (!map[row.subject_id]) map[row.subject_id] = {};
        map[row.subject_id][row.diary_date] = {
          topic: row.topic_covered || '',
          homework: row.homework || '',
          activity: row.activity_notes || '',
          id: row.id,
          createdAt: row.created_at || null,
          saving: false,
          saved: false,
        };
      });
      setWeeklyData(map);
    } catch (err: any) {
      console.error('Error fetching weekly diary:', err);
    } finally {
      setWeeklyLoading(false);
    }
  };

  const updateWeeklyCell = (subjectId: string, date: string, field: 'topic' | 'homework' | 'activity', value: string) => {
    setWeeklyData(prev => {
      const subMap = prev[subjectId] || {};
      const current = subMap[date] || { topic: '', homework: '', activity: '' };
      return {
        ...prev,
        [subjectId]: {
          ...subMap,
          [date]: { ...current, [field]: value, saved: false }
        }
      };
    });
  };

  const saveWeeklyCell = async (subjectId: string, date: string, teacherId?: string) => {
    const cell = weeklyData[subjectId]?.[date] || { topic: '', homework: '', activity: '' };
    setWeeklyData(prev => ({
      ...prev,
      [subjectId]: {
        ...(prev[subjectId] || {}),
        [date]: { ...cell, saving: true }
      }
    }));

    try {
      const activeTeacherId = teacherId || myStaffId || selectedTeacherId;
      if (!activeTeacherId) throw new Error("No teacher assigned to this subject.");

      const payload = {
        school_id: userRole?.school_id,
        teacher_id: activeTeacherId,
        class_id: selectedClassId,
        subject_id: subjectId,
        diary_date: date,
        topic_covered: cell.topic || '',
        homework: cell.homework || null,
        activity_notes: cell.activity || null,
      };

      const { data, error } = await supabase
        .from('teacher_diary')
        .upsert([payload], { onConflict: 'teacher_id,class_id,subject_id,diary_date' })
        .select('id')
        .single();

      if (error) throw error;
      setWeeklyData(prev => ({
        ...prev,
        [subjectId]: {
          ...(prev[subjectId] || {}),
          [date]: { ...cell, id: data?.id, createdAt: cell.createdAt || new Date().toISOString(), saving: false, saved: true }
        }
      }));
      setTimeout(() => {
        setWeeklyData(prev => ({
          ...prev,
          [subjectId]: {
            ...(prev[subjectId] || {}),
            [date]: { ...(prev[subjectId]?.[date] || cell), saved: false }
          }
        }));
      }, 3000);
    } catch (err: any) {
      alert(err.message);
      setWeeklyData(prev => ({
        ...prev,
        [subjectId]: {
          ...(prev[subjectId] || {}),
          [date]: { ...cell, saving: false }
        }
      }));
    }
  };

  const saveWeeklyAll = async () => {
    setWeeklySaving(true);
    try {
      const upserts: any[] = [];
      assignedSlots.forEach(slot => {
        weekDays.forEach(day => {
          const cell = weeklyData[slot.subject_id]?.[day.date];
          if (cell && (cell.topic?.trim() || cell.homework?.trim() || cell.activity?.trim())) {
            upserts.push({
              school_id: userRole?.school_id,
              teacher_id: slot.teacher_id || myStaffId || selectedTeacherId,
              class_id: selectedClassId,
              subject_id: slot.subject_id,
              diary_date: day.date,
              topic_covered: cell.topic || '',
              homework: cell.homework || null,
              activity_notes: cell.activity || null,
            });
          }
        });
      });

      if (upserts.length === 0) {
        alert('No filled entries to save.');
        setWeeklySaving(false);
        return;
      }

      const { error } = await supabase
        .from('teacher_diary')
        .upsert(upserts, { onConflict: 'teacher_id,class_id,subject_id,diary_date' });

      if (error) throw error;
      alert(`Successfully saved ${upserts.length} weekly diary entries!`);
      fetchWeeklyData();
    } catch (err: any) {
      alert('Save failed: ' + err.message);
    } finally {
      setWeeklySaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // ── Render container to high-res PDF with authentic Urdu Nastaliq ───────────
  const exportContainerToPDF = async (fileName: string): Promise<boolean> => {
    if (!reportRef.current) return false;

    // Explicitly preload web fonts (including Noto Nastaliq Urdu and Inter)
    try {
      if ((document as any).fonts) {
        await Promise.all([
          document.fonts.load('400 16px "Noto Nastaliq Urdu"'),
          document.fonts.load('500 16px "Noto Nastaliq Urdu"'),
          document.fonts.load('600 16px "Noto Nastaliq Urdu"'),
          document.fonts.load('700 16px "Noto Nastaliq Urdu"'),
          document.fonts.load('400 13px "Inter"'),
          document.fonts.load('600 13px "Inter"'),
          document.fonts.load('700 13px "Inter"'),
          (document as any).fonts.ready
        ]);
      }
    } catch (fontErr) {
      console.warn('Font preload warning:', fontErr);
    }

    const element = reportRef.current;
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#fffdfa',
      logging: false,
      windowWidth: 1200,
      onclone: (clonedDoc) => {
        // CRITICAL: html2canvas breaks Arabic/Urdu into isolated single letters if styles.letterSpacing !== 0.
        // Inject global override inside the cloned iframe document to strictly enforce 0px letter-spacing.
        const styleEl = clonedDoc.createElement('style');
        styleEl.innerHTML = `
          *, *::before, *::after {
            letter-spacing: 0px !important;
          }
          body {
            letter-spacing: 0px !important;
          }
          #hidden-report-container, #hidden-report-container * {
            letter-spacing: 0px !important;
            word-break: normal !important;
            overflow-wrap: normal !important;
          }
          .font-nastaleeq, .urdu-text, [dir="rtl"] {
            letter-spacing: 0px !important;
            word-break: normal !important;
            overflow-wrap: normal !important;
            font-family: 'Noto Nastaliq Urdu', 'Noto Naskh Arabic', serif !important;
          }
        `;
        clonedDoc.head.appendChild(styleEl);

        const fontLink = clonedDoc.createElement('link');
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Nastaliq+Urdu:wght@400;500;600;700&display=swap';
        clonedDoc.head.appendChild(fontLink);

        const clonedReport = clonedDoc.getElementById('hidden-report-container');
        if (clonedReport) {
          clonedReport.style.position = 'static';
          clonedReport.style.margin = '0 auto';
          clonedReport.style.width = '1120px';
          clonedReport.style.minWidth = '1120px';
          clonedReport.style.letterSpacing = '0px';

          // Force inline letterSpacing: 0px on all elements inside cloned container
          const allDescendants = clonedReport.querySelectorAll('*');
          allDescendants.forEach((el) => {
            const h = el as HTMLElement;
            if (h.style) {
              h.style.setProperty('letter-spacing', '0px', 'important');
              h.style.setProperty('word-break', 'normal', 'important');
              h.style.setProperty('overflow-wrap', 'normal', 'important');
            }
          });
        }
        const parentPrintOnly = clonedDoc.querySelector('.print-only') as HTMLElement | null;
        if (parentPrintOnly) {
          parentPrintOnly.style.position = 'static';
          parentPrintOnly.style.left = '0';
          parentPrintOnly.style.top = '0';
          parentPrintOnly.style.opacity = '1';
          parentPrintOnly.style.display = 'block';
          parentPrintOnly.style.width = '1120px';
          parentPrintOnly.style.zIndex = '1';
          parentPrintOnly.style.letterSpacing = '0px';
        }
      }
    });

    const doc = new jsPDF('l', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const imgHeight = (canvas.height * pageWidth) / canvas.width;

    if (imgHeight <= pageHeight) {
      doc.addImage(imgData, 'JPEG', 0, 0, pageWidth, imgHeight);
    } else {
      let heightLeft = imgHeight;
      let position = 0;
      doc.addImage(imgData, 'JPEG', 0, position, pageWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position -= pageHeight;
        doc.addPage();
        doc.addImage(imgData, 'JPEG', 0, position, pageWidth, imgHeight);
        heightLeft -= pageHeight;
      }
    }

    doc.save(fileName);
    return true;
  };

  // ── Direct PDF Download (Solves print issues on old devices) ───────────────
  const handleDownloadPDF = async () => {
    if (rows.length === 0) {
      alert('No diary entries found to export.');
      return;
    }
    setPdfDownloading(true);
    const fileName = `Diary_${(viewMode === 'class' ? selectedClassName : selectedTeacherName).replace(/[^a-zA-Z0-9]/g, '_')}_${viewDate}.pdf`;
    try {
      // 1. Primary: High-res canvas capture (preserves 100% authentic Urdu Nastaliq & styling)
      try {
        const exported = await exportContainerToPDF(fileName);
        if (exported) return;
      } catch (canvasErr) {
        console.warn('Canvas export failed, falling back to vector autoTable:', canvasErr);
      }

      // 2. Fallback: Vector jsPDF with embedded Noto Naskh Arabic TTF font
      const doc = new jsPDF('l', 'mm', 'a4');
      const urduFontLoaded = await registerUrduFont(doc);
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      const startY = 10;

      if (schoolInfo?.logo_url) {
        try {
          const b64 = await getBase64Image(schoolInfo.logo_url);
          doc.addImage(b64, 'PNG', margin, startY, 20, 20);
        } catch (e) {
          console.warn('Logo error:', e);
        }
      }

      const textX = schoolInfo?.logo_url ? margin + 24 : margin;
      const schoolName = (schoolInfo?.name || 'School Diary').toUpperCase();
      doc.setFont(getFontForText(schoolName, urduFontLoaded), 'bold');
      doc.setFontSize(15);
      doc.setTextColor(30, 27, 75);
      doc.text(schoolName, textX, startY + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      if (schoolInfo?.address) {
        doc.text(schoolInfo.address, textX, startY + 11);
      }

      const badgeText = viewMode === 'class' ? 'CLASS ACADEMIC DIARY' : 'TEACHER DAILY RECORD';
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(67, 56, 202);
      doc.text(badgeText, pageWidth - margin, startY + 6, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      const metaRight = viewMode === 'class'
        ? `Class: Grade ${selectedClassName}`
        : `Staff: ${selectedTeacherName}`;
      doc.text(`Date: ${formattedDate}  |  ${metaRight}`, pageWidth - margin, startY + 11, { align: 'right' });

      doc.setDrawColor(30, 27, 75);
      doc.setLineWidth(0.6);
      doc.line(margin, startY + 22, pageWidth - margin, startY + 22);

      const head = [[
        viewMode === 'class' ? 'Subject' : 'Class',
        viewMode === 'class' ? 'Teacher' : 'Subject',
        'Home Assignments'
      ]];

      const body = rows.map(r => [
        viewMode === 'class' ? r.slot.subject_name : r.slot.class_name,
        viewMode === 'class' ? (r.slot.teacher_name || '—') : r.slot.subject_name,
        r.homework || '—'
      ]);

      autoTable(doc, {
        startY: startY + 25,
        margin: { left: margin, right: margin, bottom: 22 },
        head: head,
        body: body,
        theme: 'grid',
        styles: {
          font: urduFontLoaded ? 'NotoNaskhArabic' : 'helvetica',
          fontSize: 8.5,
          cellPadding: 3.5,
          valign: 'top',
          textColor: [30, 41, 59],
          lineColor: [203, 213, 225],
          lineWidth: 0.2,
          overflow: 'linebreak',
        },
        headStyles: {
          font: 'helvetica',
          fillColor: [30, 27, 75],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8.5,
          halign: 'center',
          cellPadding: 3.5,
        },
        columnStyles: {
          0: { cellWidth: 42, fontStyle: 'bold', halign: 'center' },
          1: { cellWidth: 38, halign: 'center' },
          2: { cellWidth: 197 },
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        didDrawPage: (data) => {
          const footerY = pageHeight - 16;
          doc.setDrawColor(30, 27, 75);
          doc.setLineWidth(0.5);

          doc.line(margin + 20, footerY, margin + 80, footerY);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(30, 27, 75);
          doc.text('CLASS TEACHER SIGNATURE', margin + 50, footerY + 4, { align: 'center' });

          doc.line(pageWidth - margin - 80, footerY, pageWidth - margin - 20, footerY);
          doc.text('PRINCIPAL / SUPERVISOR', pageWidth - margin - 50, footerY + 4, { align: 'center' });

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(148, 163, 184);
          doc.text(`Page ${data.pageNumber} of ${doc.getNumberOfPages()}`, pageWidth / 2, footerY + 4, { align: 'center' });
        }
      });

      doc.save(fileName);
    } catch (err: any) {
      console.error('PDF error:', err);
      alert('Failed to generate PDF: ' + err.message);
    } finally {
      setPdfDownloading(false);
    }
  };

  // ── Weekly PDF Download for Early Foundation (EF) ───────────────────────────
  const handleDownloadWeeklyPDF = async () => {
    if (assignedSlots.length === 0) {
      alert('No subjects found for this class.');
      return;
    }
    setPdfDownloading(true);
    const fileName = `Weekly_Diary_EF_${selectedClassName.replace(/[^a-zA-Z0-9]/g, '_')}_${weekDays[0].date}.pdf`;
    try {
      // 1. Primary: High-res canvas capture (preserves 100% authentic Urdu Nastaliq & styling)
      try {
        const exported = await exportContainerToPDF(fileName);
        if (exported) return;
      } catch (canvasErr) {
        console.warn('Canvas weekly export failed, falling back to vector autoTable:', canvasErr);
      }

      // 2. Fallback: Vector jsPDF with embedded Noto Naskh Arabic TTF font
      const doc = new jsPDF('l', 'mm', 'a4');
      const urduFontLoaded = await registerUrduFont(doc);
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      const startY = 10;

      if (schoolInfo?.logo_url) {
        try {
          const b64 = await getBase64Image(schoolInfo.logo_url);
          doc.addImage(b64, 'PNG', margin, startY, 20, 20);
        } catch (e) {
          console.warn('Logo error:', e);
        }
      }

      const textX = schoolInfo?.logo_url ? margin + 24 : margin;
      const weeklySchoolName = (schoolInfo?.name || 'School Diary').toUpperCase();
      doc.setFont(getFontForText(weeklySchoolName, urduFontLoaded), 'bold');
      doc.setFontSize(15);
      doc.setTextColor(30, 27, 75);
      doc.text(weeklySchoolName, textX, startY + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      if (schoolInfo?.address) {
        doc.text(schoolInfo.address, textX, startY + 11);
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(67, 56, 202);
      doc.text('EARLY FOUNDATION WEEKLY DIARY', pageWidth - margin, startY + 6, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      const weekLabel = `Week: ${weekDays[0].formatted} to ${weekDays[4].formatted}`;
      doc.text(`Class: Grade ${selectedClassName}  |  ${weekLabel}`, pageWidth - margin, startY + 11, { align: 'right' });

      doc.setDrawColor(30, 27, 75);
      doc.setLineWidth(0.6);
      doc.line(margin, startY + 22, pageWidth - margin, startY + 22);

      const dayWidth = (pageWidth - margin * 2 - 32) / 5;

      const head = [[
        'Subject',
        ...weekDays.map(d => `${d.name.toUpperCase()}\n(${d.formatted})`)
      ]];

      const body = assignedSlots.map(slot => {
        const row = [slot.subject_name];
        weekDays.forEach(day => {
          const cell = weeklyData[slot.subject_id]?.[day.date];
          let content = '';
          if (cell?.topic) content += `Topic: ${cell.topic}\n`;
          if (cell?.homework) content += `HW: ${cell.homework}\n`;
          if (cell?.activity) content += `Note: ${cell.activity}`;
          row.push(content.trim() || '—');
        });
        return row;
      });

      autoTable(doc, {
        startY: startY + 25,
        margin: { left: margin, right: margin, bottom: 22 },
        head: head,
        body: body,
        theme: 'grid',
        styles: {
          font: urduFontLoaded ? 'NotoNaskhArabic' : 'helvetica',
          fontSize: 7.5,
          cellPadding: 2.5,
          valign: 'top',
          textColor: [30, 41, 59],
          lineColor: [203, 213, 225],
          lineWidth: 0.2,
          overflow: 'linebreak',
        },
        headStyles: {
          font: 'helvetica',
          fillColor: [30, 27, 75],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8,
          halign: 'center',
          cellPadding: 3,
        },
        columnStyles: {
          0: { cellWidth: 32, fontStyle: 'bold', halign: 'center' },
          1: { cellWidth: dayWidth },
          2: { cellWidth: dayWidth },
          3: { cellWidth: dayWidth },
          4: { cellWidth: dayWidth },
          5: { cellWidth: dayWidth },
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        didDrawPage: (data) => {
          const footerY = pageHeight - 16;
          doc.setDrawColor(30, 27, 75);
          doc.setLineWidth(0.5);

          doc.line(margin + 20, footerY, margin + 80, footerY);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(30, 27, 75);
          doc.text('CLASS TEACHER SIGNATURE', margin + 50, footerY + 4, { align: 'center' });

          doc.line(pageWidth - margin - 80, footerY, pageWidth - margin - 20, footerY);
          doc.text('EARLY YEARS SUPERVISOR / PRINCIPAL', pageWidth - margin - 50, footerY + 4, { align: 'center' });

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(148, 163, 184);
          doc.text(`Page ${data.pageNumber} of ${doc.getNumberOfPages()}`, pageWidth / 2, footerY + 4, { align: 'center' });
        }
      });

      doc.save(fileName);
    } catch (err: any) {
      console.error('Weekly PDF error:', err);
      alert('Failed to generate weekly PDF: ' + err.message);
    } finally {
      setPdfDownloading(false);
    }
  };

  const formattedDate = formatDate(viewDate);
  const filledCount = rows.filter(r => r.homework.trim()).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <style>{`
        .print-only {
          position: fixed;
          left: 0;
          top: 0;
          width: 1120px;
          opacity: 0;
          pointer-events: none;
          z-index: -9999;
          background: #fffdfa;
        }
        #hidden-report-container, #hidden-report-container * {
          letter-spacing: 0px !important;
          word-break: normal !important;
          overflow-wrap: normal !important;
        }
        .urdu-text, [dir="rtl"] {
          letter-spacing: 0px !important;
          word-break: normal !important;
          overflow-wrap: normal !important;
        }
        @media print {
          body { background: white !important; margin: 0 !important; padding: 0 !important; letter-spacing: 0px !important; }
          .no-print { display: none !important; }
          .print-only {
            display: block !important;
            position: static !important;
            width: 100% !important;
            opacity: 1 !important;
            left: auto !important;
            top: auto !important;
            z-index: auto !important;
          }
          @page { size: landscape; margin: 5mm; }
          .diary-print-layout { 
            width: 100%; 
            background: #fffdfa !important; 
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            transform: scale(0.88);
            transform-origin: top center;
            margin: 0 !important;
            letter-spacing: 0px !important;
          }
          table { page-break-after: avoid !important; width: 100% !important; letter-spacing: 0px !important; }
          tr { page-break-inside: avoid !important; }
          .sign-area { page-break-inside: avoid !important; }
          .urdu-text { font-family: 'Noto Nastaliq Urdu', 'Noto Naskh Arabic', serif !important; unicode-bidi: plaintext; text-align: start; font-size: 13px; line-height: 2.6 !important; letter-spacing: 0px !important; word-break: normal !important; overflow-wrap: normal !important; }
          thead { display: table-row-group !important; }
        }
      `}</style>
      <div className="no-print space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <PageHeader 
        title={viewMode === 'class' ? (diaryPeriod === 'weekly' ? 'Early Foundation Weekly Diary' : 'Class Diary') : 'Teacher Diary'}
        subtitle={viewMode === 'class'
              ? (diaryPeriod === 'weekly' ? `Weekly curriculum schedule for Grade ${selectedClassName || 'Selected Class'}.` : `Unified daily report for Grade ${selectedClassName || 'Selected Class'}.`)
              : isTeacher ? 'Fill in your daily lesson plan.' : 'View diary entries by individual teacher.'}
        actions={
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto no-print">
          {canClassView && (
            <div className="bg-slate-100 p-1 rounded-xl flex items-center mr-2">
              <button onClick={() => { setViewMode('teacher'); setDiaryPeriod('daily'); }} className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'teacher' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Teacher</button>
              <button onClick={() => setViewMode('class')} className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'class' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Class</button>
            </div>
          )}

          {viewMode === 'class' && (
            <div className="bg-slate-100 p-1 rounded-xl flex items-center mr-2">
              <button
                onClick={() => setDiaryPeriod('daily')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${diaryPeriod === 'daily' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
              >
                Daily
              </button>
              <button
                onClick={() => setDiaryPeriod('weekly')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${diaryPeriod === 'weekly' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
              >
                <CalendarRange className="w-3.5 h-3.5" />
                <span>Weekly</span>
                {isEF && <span className="bg-pink-100 text-pink-700 text-[9px] px-1 rounded font-black">EF</span>}
              </button>
            </div>
          )}

          {isAdmin && (
            <a
              href="/diary/schedule"
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold hover:bg-emerald-100 transition"
            >
              <CalendarDays className="w-3.5 h-3.5" /> Manage Schedule
            </a>
          )}

          {diaryPeriod === 'daily' && rows.length > 0 && (
            <span className={`flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1.5 rounded-full ${
              scheduleActive
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-50 text-amber-600'
            }`}>
              {scheduleActive ? '📅 Schedule Active' : '⚠️ No schedule — all subjects'}
            </span>
          )}

          {/* Direct PDF Download button for old devices & mobile */}
          <Btn 
            onClick={diaryPeriod === 'weekly' ? handleDownloadWeeklyPDF : handleDownloadPDF} 
            disabled={(viewMode === 'teacher' ? !selectedTeacherId : !selectedClassId) || (diaryPeriod === 'daily' ? rows.length === 0 : assignedSlots.length === 0) || pdfDownloading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
          >
            <Download className="w-4 h-4" /> {pdfDownloading ? 'Generating...' : diaryPeriod === 'weekly' ? 'Download Weekly PDF' : 'Download PDF'}
          </Btn>

          <Btn onClick={handlePrint} disabled={(viewMode === 'teacher' ? !selectedTeacherId : !selectedClassId) || (diaryPeriod === 'daily' ? rows.length === 0 : assignedSlots.length === 0)}>
            <Printer className="w-4 h-4" /> Print
          </Btn>
        </div>
        }
      />

      {/* ── Controls ─────────────────────────────────────────────────────────── */}
      <Card className="p-4 no-print border-b border-slate-100">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {isAdmin && viewMode === 'teacher' && (
            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}>
              <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Teacher</label>
              <select value={selectedTeacherId} onChange={e => { const t = allTeachers.find(x => x.id === e.target.value); setSelectedTeacherId(e.target.value); setSelectedTeacherName(t?.full_name || ''); }}
                className="w-full border border-slate-200 px-3 py-2.5 rounded-xl bg-slate-50 text-[13px] font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all">
                <option value="">— Select Teacher —</option>
                {allTeachers.map(t => (<option key={t.id} value={t.id}>{t.full_name}</option>))}
              </select>
            </motion.div>
          )}
          {viewMode === 'class' && (
            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}>
              <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5" /> Class
                {isEF && <span className="ml-1.5 text-[9px] bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded-full font-black">Early Foundation</span>}
              </label>
              <select value={selectedClassId} onChange={e => { const c = allClasses.find(x => x.id === e.target.value); setSelectedClassId(e.target.value); setSelectedClassName(c ? `${c.name} ${c.section}` : ''); }}
                className="w-full border border-slate-200 px-3 py-2.5 rounded-xl bg-slate-50 text-[13px] font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all">
                <option value="">— Select Class —</option>
                {allClasses.map(c => {
                  const isIncharge = inchargeClassIds.includes(c.id);
                  const isEarly = isEFClass(c.name, c.section);
                  return (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.section} {isEarly ? '🌸 (Early Foundation)' : ''} {isIncharge ? '⭐ (Incharge)' : ''}
                    </option>
                  );
                })}
              </select>
            </motion.div>
          )}

          {/* Date Picker (Daily mode) vs Week Picker (Weekly mode) */}
          {diaryPeriod === 'daily' ? (
            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Date</label>
              <div className="flex items-center gap-1">
                <button onClick={() => shiftDate(-1)} className="p-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 shrink-0 transition-colors"><ChevronLeft className="w-4 h-4 text-slate-500" /></button>
                <input type="date" value={viewDate} onChange={e => setViewDate(e.target.value)} className="flex-1 border border-slate-200 px-2 py-2.5 rounded-xl text-[13px] text-center font-bold text-slate-700 min-w-0 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer" />
                <button onClick={() => shiftDate(1)} className="p-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 shrink-0 transition-colors"><ChevronRight className="w-4 h-4 text-slate-500" /></button>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <CalendarRange className="w-3.5 h-3.5 text-indigo-600" /> Week Range (Mon – Fri)
              </label>
              <div className="flex items-center gap-1">
                <button onClick={() => shiftWeek(-1)} className="p-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 shrink-0 transition-colors" title="Previous Week">
                  <ChevronLeft className="w-4 h-4 text-slate-500" />
                </button>
                <div className="flex-1 border border-indigo-100 bg-indigo-50/60 px-2 py-2.5 rounded-xl text-[12px] text-center font-black text-indigo-950 min-w-0">
                  {weekDays[0]?.formatted} — {weekDays[4]?.formatted}
                </div>
                <button onClick={() => shiftWeek(1)} className="p-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 shrink-0 transition-colors" title="Next Week">
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            </div>
          )}

          <div className="sm:col-span-2 md:col-span-1 flex items-end">
            {diaryPeriod === 'daily' ? (
              <button onClick={saveAll} disabled={(viewMode === 'teacher' ? !selectedTeacherId : !selectedClassId) || filledCount === 0}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg shadow-emerald-200 disabled:opacity-40 transition-all text-[13px] active:scale-95">
                <Save className="w-4 h-4" /> Save All ({filledCount} filled)
              </button>
            ) : (
              <button onClick={saveWeeklyAll} disabled={!selectedClassId || weeklySaving || weeklyLoading || assignedSlots.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg shadow-emerald-200 disabled:opacity-40 transition-all text-[13px] active:scale-95">
                <Save className="w-4 h-4" /> {weeklySaving ? 'Saving...' : 'Save Entire Week'}
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* ── Main Diary Section ──────────────────────────────────────────────── */}
      {diaryPeriod === 'weekly' && viewMode === 'class' ? (
        selectedClassId ? (
          weeklyLoading ? (
            <div className="bg-white rounded-2xl p-12 text-center text-slate-400 border border-slate-200">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" />
              Loading weekly diary for {selectedClassName}...
            </div>
          ) : assignedSlots.length === 0 ? (
            <EmptyState title="No Subjects Found" description="Please assign subjects to this class in Classes & Subjects management." />
          ) : (
            <div className="space-y-4">
              {/* Mobile View: Day Tabs & Subject Cards */}
              <div className="md:hidden space-y-3">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {weekDays.map((d, idx) => (
                    <button
                      key={d.date}
                      onClick={() => setActiveDayIndex(idx)}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider text-center transition-all shrink-0 ${
                        activeDayIndex === idx
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-white border border-slate-200 text-slate-600'
                      }`}
                    >
                      <div>{d.short}</div>
                      <div className="text-[10px] opacity-80">{d.formatted.slice(0, 5)}</div>
                    </button>
                  ))}
                </div>

                <div className="space-y-3">
                  {assignedSlots.map((slot) => {
                    const meta = getSubjectMeta(slot.subject_name);
                    const activeDay = weekDays[activeDayIndex];
                    const cell = weeklyData[slot.subject_id]?.[activeDay.date] || { topic: '', homework: '', activity: '' };
                    return (
                      <div key={`${slot.subject_id}_${activeDay.date}`} className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm overflow-hidden p-4 space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs" style={{ backgroundColor: `${meta.color}20`, color: meta.color }}>
                              {slot.subject_name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-black text-slate-900 text-xs">{slot.subject_name}</p>
                              <p className="text-[10px] text-slate-400">{activeDay.name} ({activeDay.formatted})</p>
                            </div>
                          </div>
                          <button
                            onClick={() => saveWeeklyCell(slot.subject_id, activeDay.date, slot.teacher_id)}
                            disabled={cell.saving}
                            className="px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition"
                          >
                            {cell.saved ? '✓ Saved' : cell.saving ? '...' : 'Save'}
                          </button>
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Topic / Activities</label>
                          <textarea
                            rows={2}
                            dir="auto"
                            value={cell.topic}
                            onChange={e => updateWeeklyCell(slot.subject_id, activeDay.date, 'topic', e.target.value)}
                            placeholder="e.g. Rhyme reciting, letter tracing..."
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Homework / Home Activity</label>
                          <textarea
                            rows={2}
                            dir="auto"
                            value={cell.homework}
                            onChange={e => updateWeeklyCell(slot.subject_id, activeDay.date, 'homework', e.target.value)}
                            placeholder="Home practice, coloring..."
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Desktop View: Full 5-Day Matrix Table */}
              <Card className="hidden md:block overflow-hidden shadow-sm border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white">
                        <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider w-[150px] border-r border-slate-800">
                          Subject
                        </th>
                        {weekDays.map(d => (
                          <th key={d.date} className="px-3 py-2 text-center border-r border-slate-800 last:border-r-0 min-w-[190px]">
                            <div className="text-[11px] font-black uppercase tracking-wider text-indigo-200">{d.name}</div>
                            <div className="text-[9px] font-mono text-slate-400 font-normal">{d.formatted}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {assignedSlots.map((slot) => {
                        const meta = getSubjectMeta(slot.subject_name);
                        const Icon = meta.icon;
                        return (
                          <tr key={slot.subject_id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3 align-top border-r border-slate-200 bg-slate-50/40">
                              <div className="flex items-center gap-2 mb-1">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${meta.color}20` }}>
                                  <Icon className="w-4 h-4" style={{ color: meta.color }} />
                                </div>
                                <span className="font-black text-slate-900 text-xs">{slot.subject_name}</span>
                              </div>
                              <span className="text-[9px] text-slate-400 block font-medium">
                                {slot.teacher_name || 'Assigned Staff'}
                              </span>
                            </td>

                            {weekDays.map(d => {
                              const cell = weeklyData[slot.subject_id]?.[d.date] || { topic: '', homework: '', activity: '' };
                              return (
                                <td key={d.date} className="px-2.5 py-2 align-top border-r border-slate-200 last:border-r-0">
                                  <div className="space-y-1.5">
                                    <div>
                                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight block">Topic / Lesson</span>
                                      <textarea
                                        rows={2}
                                        dir="auto"
                                        value={cell.topic}
                                        onChange={e => updateWeeklyCell(slot.subject_id, d.date, 'topic', e.target.value)}
                                        placeholder="Lesson / topic..."
                                        className="w-full border border-slate-200 hover:border-indigo-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                                      />
                                    </div>
                                    <div>
                                      <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-tight block">Homework</span>
                                      <textarea
                                        rows={2}
                                        dir="auto"
                                        value={cell.homework}
                                        onChange={e => updateWeeklyCell(slot.subject_id, d.date, 'homework', e.target.value)}
                                        placeholder="Homework..."
                                        className="w-full border border-slate-200 hover:border-indigo-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-indigo-50/20"
                                      />
                                    </div>
                                    <div className="flex items-center justify-between pt-0.5">
                                      {cell.saved ? (
                                        <span className="text-[9px] text-emerald-600 font-bold flex items-center gap-0.5">
                                          <CheckCircle2 className="w-3 h-3" /> Saved
                                        </span>
                                      ) : (cell as any).createdAt ? (
                                        <span className="text-[8.5px] text-slate-500 font-semibold flex items-center gap-0.5 truncate" title={`Added: ${new Date((cell as any).createdAt).toLocaleString()}`}>
                                          <Clock className="w-2.5 h-2.5 text-indigo-500 shrink-0" />
                                          {formatDiaryTimestamp((cell as any).createdAt).split(',')[1] || formatDiaryTimestamp((cell as any).createdAt)}
                                        </span>
                                      ) : <span />}
                                      <button
                                        onClick={() => saveWeeklyCell(slot.subject_id, d.date, slot.teacher_id)}
                                        disabled={cell.saving || (!cell.topic.trim() && !cell.homework.trim())}
                                        className="px-2 py-0.5 text-[9px] font-black rounded bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-600 transition disabled:opacity-30"
                                      >
                                        {cell.saving ? '...' : 'Save'}
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )
        ) : null
      ) : (
        /* Daily View */
        (viewMode === 'teacher' ? selectedTeacherId : selectedClassId) && (loading ? (
          <div className="bg-white rounded-xl p-10 text-center text-gray-400 border border-gray-200">Loading diary...</div>
        ) : rows.length > 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">

            {/* Mobile: card per subject */}
            <div className="md:hidden space-y-3">
              {rows.map((row, idx) => (
                <React.Fragment key={`card_${row.slot.class_id}_${row.slot.subject_id}`}>
                  <DiaryCard
                    row={row}
                    index={idx}
                    viewMode={viewMode}
                    onUpdate={updateRow}
                    onSave={saveRow}
                    diarySettings={schoolInfo?.diary_settings}
                  />
                </React.Fragment>
              ))}
            </div>

            {/* Desktop: table */}
            <Card className="hidden md:block overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-[180px]">{viewMode === 'class' ? 'Subject' : 'Class'}</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-[220px]">{viewMode === 'class' ? 'Teacher / Status' : 'Subject / Status'}</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-indigo-700 uppercase tracking-wider">Home Assignments <span className="text-rose-500">*</span></th>
                      <th className="px-3 py-3 w-[90px] no-print"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row, idx) => (
                      <DiaryTableRow 
                        key={`${row.slot.class_id}_${row.slot.subject_id}`} 
                        row={row} 
                        index={idx} 
                        viewMode={viewMode} 
                        onUpdate={updateRow} 
                        onSave={saveRow} 
                        diarySettings={schoolInfo?.diary_settings}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="flex items-center justify-between gap-3 text-sm flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1 text-emerald-700 font-bold"><CheckCircle2 className="w-4 h-4" />{filledCount} of {rows.length} entries filled</span>
                {filledCount < rows.length && (<span className="flex items-center gap-1 text-amber-600 font-medium"><AlertCircle className="w-3.5 h-3.5" />{rows.length - filledCount} remaining</span>)}
              </div>
              {rows.some(r => r.createdAt) && (
                <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                  <Clock className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Latest Submission: <strong className="text-slate-800 font-bold">{formatDiaryTimestamp(rows.map(r => r.createdAt).filter(Boolean).sort().reverse()[0])}</strong></span>
                </div>
              )}
            </div>
          </motion.div>
        ) : null)
      )}
    </div>

      {/* ── PRINT ONLY LAYOUT (HIDDEN ON SCREEN) ────────────────────────── */}
      <div className="print-only" style={{ letterSpacing: '0px' }}>
        <div ref={reportRef} id="hidden-report-container" className="diary-print-layout" style={{ padding: '0 0 15px 0', letterSpacing: '0px' }}>
          <div className="top-banner" style={{ height: '10px', background: 'linear-gradient(90deg, #1e1b4b, #4338ca, #10b981)', marginBottom: '15px' }}></div>
          <div style={{ padding: '0 35px', boxSizing: 'border-box', letterSpacing: '0px' }}>
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', paddingBottom: '6px', borderBottom: '2px solid #1e1b4b', marginBottom: '8px', boxSizing: 'border-box' }}>
            {schoolInfo?.logo_url && (
              <img src={schoolInfo.logo_url} crossOrigin="anonymous" style={{ width: '55px', height: '55px', objectFit: 'contain', marginRight: '15px' }} alt="logo" />
            )}
            <div style={{ flexGrow: 1, textAlign: 'center' }}>
              <h1 style={{ fontSize: '22px', fontWeight: '900', color: '#1e1b4b', margin: '0', letterSpacing: '0px', textTransform: 'uppercase' }}>{schoolInfo?.name || 'School Diary'}</h1>
              <p style={{ fontSize: '11px', color: '#475569', fontWeight: '700', marginTop: '1px', letterSpacing: '0px' }}>{schoolInfo?.address}</p>
              <div style={{ marginTop: '6px' }}>
                 <span style={{ background: 'linear-gradient(135deg, #1e1b4b, #4338ca)', color: 'white', padding: '4px 28px', borderRadius: '50px', fontWeight: '900', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                   {viewMode === 'class' ? 'Class Academic Diary' : 'Professional Staff Record'}
                 </span>
              </div>
            </div>
            <div style={{ width: '55px' }}></div> 
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontWeight: '900', fontSize: '12px', border: '2px solid #1e1b4b', padding: '8px 25px', background: '#f8fafc', color: '#1e1b4b', borderRadius: '4px', boxSizing: 'border-box', marginBottom: '12px', fontFamily: "'Inter', sans-serif", letterSpacing: '0px' }}>
            <span>{diaryPeriod === 'weekly' ? `WEEK: ${weekDays[0]?.formatted} — ${weekDays[4]?.formatted}` : `DATED: ${formattedDate}`}</span>
            <span>
              {viewMode === 'class' 
                ? `CLASS: GRADE ${(selectedClassName || '').replace(/^(CLASS[:\s]*|GRADE[:\s]*)+/gi, '').trim().toUpperCase()}`
                : `STAFF: ${selectedTeacherName.toUpperCase()}`}
            </span>
          </div>

          {diaryPeriod === 'weekly' ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #1e1b4b', background: 'white', tableLayout: 'fixed', boxSizing: 'border-box', letterSpacing: '0px' }}>
              <thead>
                <tr>
                  <th style={{ border: '1.5px solid #1e1b4b', padding: '10px 8px', background: '#1e1b4b', width: '15%', textAlign: 'center', color: '#fff', fontWeight: '900', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0px' }}>Subject</th>
                  {weekDays.map(d => (
                    <th key={d.date} style={{ border: '1.5px solid #1e1b4b', padding: '10px 8px', background: '#1e1b4b', width: '17%', textAlign: 'center', color: '#fff', fontWeight: '900', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0px' }}>
                      {d.name}<br /><span style={{ fontSize: '8px', opacity: 0.8 }}>({d.formatted})</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assignedSlots.map((slot, idx) => (
                  <tr key={idx} style={{ background: idx % 2 === 0 ? 'white' : 'rgba(241, 245, 249, 0.4)' }}>
                    <td style={{ border: '1px solid #cbd5e1', padding: '8px', fontWeight: 'bold', fontSize: '10px', color: '#1e1b4b', textAlign: 'center', letterSpacing: '0px' }}>
                      {slot.subject_name}
                    </td>
                    {weekDays.map(d => {
                      const cell = weeklyData[slot.subject_id]?.[d.date];
                      return (
                        <td key={d.date} style={{ border: '1px solid #cbd5e1', padding: '6px 8px', fontSize: '9px', verticalAlign: 'top', letterSpacing: '0px' }}>
                          {cell?.topic && (
                            <div style={{ fontWeight: 'bold', marginBottom: '2px', direction: containsUrdu(cell.topic) ? 'rtl' : 'ltr', fontFamily: containsUrdu(cell.topic) ? "'Noto Nastaliq Urdu', 'Noto Naskh Arabic', serif" : 'inherit', lineHeight: containsUrdu(cell.topic) ? '2.2' : 'inherit', letterSpacing: '0px', wordBreak: 'normal', overflowWrap: 'normal' }}>
                              {cell.topic}
                            </div>
                          )}
                          {cell?.homework && (
                            <div style={{ color: '#4338ca', direction: containsUrdu(cell.homework) ? 'rtl' : 'ltr', fontFamily: containsUrdu(cell.homework) ? "'Noto Nastaliq Urdu', 'Noto Naskh Arabic', serif" : 'inherit', lineHeight: containsUrdu(cell.homework) ? '2.2' : 'inherit', letterSpacing: '0px', wordBreak: 'normal', overflowWrap: 'normal' }}>
                              HW: {cell.homework}
                            </div>
                          )}
                          {cell?.activity && (
                            <div style={{ color: '#64748b', fontStyle: 'italic', direction: containsUrdu(cell.activity) ? 'rtl' : 'ltr', fontFamily: containsUrdu(cell.activity) ? "'Noto Nastaliq Urdu', 'Noto Naskh Arabic', serif" : 'inherit', lineHeight: containsUrdu(cell.activity) ? '2.2' : 'inherit', letterSpacing: '0px', wordBreak: 'normal', overflowWrap: 'normal' }}>
                              Note: {cell.activity}
                            </div>
                          )}
                          {!cell?.topic && !cell?.homework && !cell?.activity && <span style={{ color: '#cbd5e1' }}>—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #1e1b4b', background: 'white', tableLayout: 'fixed', boxSizing: 'border-box', letterSpacing: '0px' }}>
              <thead>
                <tr>
                  <th style={{ border: '1.5px solid #1e1b4b', padding: '12px 8px', background: '#1e1b4b', width: '20%', textAlign: 'center', color: '#ffffff', fontWeight: '900', fontSize: '11px', textTransform: 'uppercase', verticalAlign: 'middle', fontFamily: "'Inter', sans-serif", letterSpacing: '0px' }}>
                    <div style={{ padding: '2px 0', lineHeight: '1.4', letterSpacing: '0px' }}>{viewMode === 'class' ? 'Subject' : 'Class'}</div>
                  </th>
                  <th style={{ border: '1.5px solid #1e1b4b', padding: '12px 8px', background: '#1e1b4b', width: '18%', textAlign: 'center', color: '#ffffff', fontWeight: '900', fontSize: '11px', textTransform: 'uppercase', verticalAlign: 'middle', fontFamily: "'Inter', sans-serif", letterSpacing: '0px' }}>
                    <div style={{ padding: '2px 0', lineHeight: '1.4', letterSpacing: '0px' }}>{viewMode === 'class' ? 'Teacher' : 'Subject'}</div>
                  </th>
                  <th style={{ border: '1.5px solid #1e1b4b', padding: '12px 8px', background: '#1e1b4b', width: '62%', textAlign: 'center', color: '#ffffff', fontWeight: '900', fontSize: '11px', textTransform: 'uppercase', verticalAlign: 'middle', fontFamily: "'Inter', sans-serif", letterSpacing: '0px' }}>
                    <div style={{ padding: '2px 0', lineHeight: '1.4', letterSpacing: '0px' }}>Home Assignments</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const meta = getSubjectMeta(viewMode === 'class' ? row.slot.subject_name : row.slot.class_name);
                  const ReportIcon = meta.icon;
                  const isUrdu = containsUrdu(row.homework || '');
                  return (
                    <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                      <td style={{ border: '1px solid #cbd5e1', padding: '10px 12px', borderLeft: `8px solid ${meta.color}`, verticalAlign: 'middle', textAlign: 'center', background: '#ffffff', letterSpacing: '0px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', letterSpacing: '0px' }}>
                           <div style={{ color: meta.color, background: `${meta.color}15`, padding: '4px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <ReportIcon style={{ width: '16px', height: '16px' }} />
                           </div>
                           <span style={{ fontWeight: '900', color: '#1e1b4b', fontSize: '11px', fontFamily: "'Inter', sans-serif", letterSpacing: '0px' }}>{viewMode === 'class' ? row.slot.subject_name : row.slot.class_name}</span>
                        </div>
                      </td>
                      <td style={{ border: '1px solid #cbd5e1', padding: '10px 12px', fontSize: '11px', fontWeight: '700', color: '#334155', textAlign: 'center', verticalAlign: 'middle', fontFamily: "'Inter', sans-serif", letterSpacing: '0px' }}>{viewMode === 'class' ? row.slot.teacher_name : row.slot.subject_name}</td>
                      <td 
                        style={{ 
                          border: '1px solid #cbd5e1', 
                          verticalAlign: 'middle', 
                          padding: isUrdu ? '10px 22px 26px 22px' : '12px 18px', 
                          background: '#ffffff',
                          letterSpacing: '0px',
                        }}
                      >
                        <div 
                          dir={isUrdu ? 'rtl' : 'ltr'} 
                          style={{ 
                            direction: isUrdu ? 'rtl' : 'ltr',
                            fontFamily: isUrdu 
                              ? "'Noto Nastaliq Urdu', 'Noto Naskh Arabic', serif" 
                              : "'Inter', system-ui, -apple-system, sans-serif",
                            fontSize: isUrdu ? '15.5px' : '13px',
                            fontWeight: isUrdu ? '600' : '500',
                            lineHeight: isUrdu ? '2.8' : '1.5',
                            textAlign: isUrdu ? 'right' : 'left',
                            color: '#0f172a',
                            overflow: 'visible',
                            wordBreak: 'normal',
                            overflowWrap: 'normal',
                            letterSpacing: '0px',
                            paddingBottom: isUrdu ? '8px' : '0',
                          }}
                        >
                          {row.homework || '—'}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <div className="sign-area" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', margin: '40px 0 0 0', pageBreakInside: 'avoid', boxSizing: 'border-box' }}>
            <div style={{ textAlign: 'center', width: '250px' }}>
              <div style={{ borderTop: '2px solid #1e1b4b', paddingTop: '10px', fontWeight: '900', color: '#1e1b4b', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase' }}>Class Teacher Signature</div>
            </div>
            <div style={{ textAlign: 'center', width: '250px' }}>
              <div style={{ borderTop: '2px solid #1e1b4b', paddingTop: '10px', fontWeight: '900', color: '#1e1b4b', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase' }}>Principal / Supervisor</div>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Mobile Card Component ────────────────────────────────────────────────────
function DiaryCard({
  row, index, onUpdate, onSave, viewMode, diarySettings
}: {
  row: DiaryRow;
  index: number;
  onUpdate: (i: number, field: keyof DiaryRow, value: string) => void;
  onSave: (i: number) => void | Promise<void>;
  viewMode: 'teacher' | 'class';
  diarySettings?: any;
}) {
  const meta = getSubjectMeta(viewMode === 'class' ? row.slot.subject_name : row.slot.class_name);
  const Icon = meta.icon;

  const cardField = (field: 'topic_covered' | 'homework' | 'activity_notes' | 'next_plan', label: string, placeholder: string, required = false) => (
    <div>
      <label className="block text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: meta.color }}>
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <textarea
        rows={3}
        dir="auto"
        value={row[field] as string}
        onChange={e => onUpdate(index, field, e.target.value)}
        placeholder={placeholder}
        className="w-full border rounded-xl px-4 py-3 text-sm resize-none outline-none transition focus:ring-2 font-['Inter',_'Noto_Nastaliq_Urdu',_serif]"
        style={{
          borderColor: row[field] ? meta.color : '#e2e8f0',
          // @ts-ignore
          '--tw-ring-color': meta.color,
          backgroundColor: row[field] ? `${meta.color}08` : 'transparent',
          unicodeBidi: 'plaintext',
          textAlign: 'start',
          letterSpacing: '0px'
        }}
      />
    </div>
  );

  return (
    <div className={`bg-white rounded-2xl border-2 shadow-sm overflow-hidden transition-all ${row.saved ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200'}`}>
      {/* Card header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: meta.bg, borderBottom: `2px solid ${meta.border}` }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${meta.color}18` }}>
            <Icon className="w-5 h-5" style={{ color: meta.color }} />
          </div>
          <div>
            <p className="font-black text-slate-900 text-sm leading-tight">
              {viewMode === 'class' ? row.slot.subject_name : row.slot.class_name}
            </p>
            <p className="text-[10px] font-bold text-slate-500 mt-0.5">
              {viewMode === 'class' ? row.slot.teacher_name : row.slot.subject_name}
            </p>
          </div>
        </div>
        {row.saved ? (
          <span className="flex items-center gap-1 text-emerald-600 font-bold text-[10px] bg-emerald-100 px-2.5 py-1.5 rounded-lg">
            <CheckCircle2 className="w-3.5 h-3.5" /> Saved
          </span>
        ) : (
          <button
            onClick={() => onSave(index)}
            disabled={row.saving || !row.homework.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-bold rounded-lg shadow disabled:opacity-40 transition"
            style={{ backgroundColor: meta.color }}
          >
            <Save className="w-3 h-3" />{row.saving ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>

      {/* Card fields */}
      <div className="p-4 space-y-3">
        {cardField('homework', 'Home Assignments', 'Write home assignments, tasks, or diary notes here…', true)}
        {row.createdAt ? (
          <div 
            className="flex items-center gap-1.5 text-[11px] text-slate-600 bg-slate-50 border border-slate-200/70 px-2.5 py-1.5 rounded-lg"
            title={`Submitted: ${new Date(row.createdAt).toLocaleString()}`}
          >
            <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span>Entry Added: <strong className="font-bold text-slate-800">{formatDiaryTimestamp(row.createdAt)}</strong></span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[11px] text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/50">
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span>Not submitted yet</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Desktop Table Row ────────────────────────────────────────────────────────
function DiaryTableRow({
  row, index, onUpdate, onSave, viewMode, diarySettings
}: {
  key?: React.Key;
  row: DiaryRow;
  index: number;
  onUpdate: (i: number, field: keyof DiaryRow, value: string) => void;
  onSave: (i: number) => void | Promise<void>;
  viewMode: 'teacher' | 'class';
  diarySettings?: any;
}) {
  const meta = getSubjectMeta(viewMode === 'class' ? row.slot.subject_name : row.slot.class_name);
  const Icon = meta.icon;

  const cellInput = (field: 'topic_covered' | 'homework' | 'activity_notes' | 'next_plan', placeholder: string) => (
    <textarea 
      rows={3} 
      dir="auto"
      value={row[field] as string} 
      onChange={e => onUpdate(index, field, e.target.value)} 
      placeholder={placeholder} 
      className={cn(
        "w-full border-2 border-transparent hover:border-indigo-100 focus:ring-1 transition outline-none leading-relaxed font-['Inter',_'Noto_Nastaliq_Urdu',_sans-serif] rounded-xl px-4 py-3 text-sm resize-none bg-transparent focus:bg-white",
        "focus:ring-offset-2"
      )}
      style={{ 
        // @ts-ignore
        '--tw-ring-color': meta.color,
        borderBottomColor: row[field] ? meta.color : 'transparent',
        unicodeBidi: 'plaintext',
        textAlign: 'start',
        letterSpacing: '0px'
      }}
    />
  );

  return (
    <tr className={`group hover:bg-slate-50 transition-colors ${row.saved ? 'bg-emerald-50/40' : ''}`}>
      <td className="px-4 py-4 align-top">
        <div className="flex items-start gap-3">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
            style={{ backgroundColor: meta.bg, border: `1px solid ${meta.border}` }}
          >
            <Icon className="w-5 h-5" style={{ color: meta.color }} />
          </div>
          <div>
            <p className="font-black text-slate-900 text-sm leading-tight">
              {viewMode === 'class' ? row.slot.subject_name : row.slot.class_name}
            </p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              {viewMode === 'class' ? 'Subject Entry' : `Grade ${row.slot.section}`}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-4 align-top">
        <div className="flex flex-col gap-1.5">
          <span 
            className="inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight"
            style={{ backgroundColor: meta.bg, color: meta.color }}
          >
            {viewMode === 'class' ? row.slot.teacher_name : row.slot.subject_name}
          </span>
          {viewMode === 'class' && (
            <span className="text-[9px] text-slate-400 font-bold ml-1">ASSIGNED STAFF</span>
          )}

          {/* Admin submission timestamp badge */}
          {row.createdAt ? (
            <div 
              className="inline-flex items-center gap-1.5 mt-0.5 px-2 py-1 rounded-md bg-indigo-50/80 border border-indigo-100/90 text-indigo-950 text-[10.5px] font-medium shadow-2xs w-fit"
              title={`Diary entry added/submitted on: ${new Date(row.createdAt).toLocaleString()}`}
            >
              <Clock className="w-3 h-3 text-indigo-600 shrink-0" />
              <span>Added: <strong className="font-bold text-indigo-900">{formatDiaryTimestamp(row.createdAt)}</strong></span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1 mt-0.5 text-[10px] text-amber-600 font-medium bg-amber-50/90 px-1.5 py-0.5 rounded border border-amber-200/50 w-fit">
              <AlertCircle className="w-2.5 h-2.5 shrink-0" />
              <span>Not submitted</span>
            </div>
          )}
        </div>
      </td>
      <td className="px-4 py-2 align-top">
        {cellInput('homework', 'Write home assignments, tasks, or diary notes here...')}
      </td>
      <td className="px-4 py-4 align-top no-print">
        {row.saved ? (
          <span className="flex items-center gap-1 text-emerald-600 font-bold text-[10px]"><CheckCircle2 className="w-3.5 h-3.5" /> Saved</span>
        ) : (
          <button 
            onClick={() => onSave(index)} 
            disabled={row.saving || !row.homework.trim()} 
            className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow disabled:opacity-40 transition whitespace-nowrap"
          >
            <Save className="w-3 h-3" />{row.saving ? '...' : 'Save'}
          </button>
        )}
      </td>
    </tr>
  );
}
