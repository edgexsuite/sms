import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate, cn } from '../lib/utils';
import {
  Clock, Printer, Save, X, PlusCircle, Trash2, BookOpen,
  AlertTriangle, ChevronUp, ChevronDown, Edit2, Coffee,
  Layers, Link2, Users, Plus, Copy, Calendar, Settings, RefreshCw,
  Download, GraduationCap, User, School, FileText, ChevronRight,
} from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────────────────

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Used when a class has no template assigned */
const FALLBACK_ROWS: TemplateRow[] = [
  { id: '_f1', template_id: '', school_id: '', sort_order: 1, label: 'Period 1',    slot_type: 'period',   start_time: '08:00', end_time: '08:45' },
  { id: '_f2', template_id: '', school_id: '', sort_order: 2, label: 'Period 2',    slot_type: 'period',   start_time: '08:45', end_time: '09:30' },
  { id: '_f3', template_id: '', school_id: '', sort_order: 3, label: 'Period 3',    slot_type: 'period',   start_time: '09:30', end_time: '10:15' },
  { id: '_f4', template_id: '', school_id: '', sort_order: 4, label: 'Short Break', slot_type: 'break',    start_time: '10:15', end_time: '10:30' },
  { id: '_f5', template_id: '', school_id: '', sort_order: 5, label: 'Period 4',    slot_type: 'period',   start_time: '10:30', end_time: '11:15' },
  { id: '_f6', template_id: '', school_id: '', sort_order: 6, label: 'Period 5',    slot_type: 'period',   start_time: '11:15', end_time: '12:00' },
  { id: '_f7', template_id: '', school_id: '', sort_order: 7, label: 'Lunch Break', slot_type: 'break',    start_time: '12:00', end_time: '12:30' },
  { id: '_f8', template_id: '', school_id: '', sort_order: 8, label: 'Period 6',    slot_type: 'period',   start_time: '12:30', end_time: '13:15' },
];

const MONTESSORI_PRESET = [
  { sort_order: 1, label: 'Assembly',            slot_type: 'assembly', start_time: '08:00', end_time: '08:20' },
  { sort_order: 2, label: 'Circle Time',         slot_type: 'period',   start_time: '08:20', end_time: '09:00' },
  { sort_order: 3, label: 'Activity 1',          slot_type: 'period',   start_time: '09:00', end_time: '09:45' },
  { sort_order: 4, label: 'Snack Break',         slot_type: 'break',    start_time: '09:45', end_time: '10:00' },
  { sort_order: 5, label: 'Activity 2',          slot_type: 'period',   start_time: '10:00', end_time: '10:45' },
  { sort_order: 6, label: 'Outdoor Play',        slot_type: 'period',   start_time: '10:45', end_time: '11:30' },
  { sort_order: 7, label: 'Lunch Break',         slot_type: 'break',    start_time: '11:30', end_time: '12:00' },
  { sort_order: 8, label: 'Quiet Time',          slot_type: 'period',   start_time: '12:00', end_time: '12:45' },
  { sort_order: 9, label: 'Story / Dismissal',   slot_type: 'period',   start_time: '12:45', end_time: '13:15' },
];

const GRADE_18_PRESET = [
  { sort_order: 1, label: 'Assembly',    slot_type: 'assembly', start_time: '08:00', end_time: '08:20' },
  { sort_order: 2, label: 'Period 1',   slot_type: 'period',   start_time: '08:20', end_time: '09:05' },
  { sort_order: 3, label: 'Period 2',   slot_type: 'period',   start_time: '09:05', end_time: '09:50' },
  { sort_order: 4, label: 'Short Break',slot_type: 'break',    start_time: '09:50', end_time: '10:05' },
  { sort_order: 5, label: 'Period 3',   slot_type: 'period',   start_time: '10:05', end_time: '10:50' },
  { sort_order: 6, label: 'Period 4',   slot_type: 'period',   start_time: '10:50', end_time: '11:35' },
  { sort_order: 7, label: 'Lunch Break',slot_type: 'break',    start_time: '11:35', end_time: '12:10' },
  { sort_order: 8, label: 'Period 5',   slot_type: 'period',   start_time: '12:10', end_time: '12:55' },
  { sort_order: 9, label: 'Period 6',   slot_type: 'period',   start_time: '12:55', end_time: '13:40' },
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface TemplateRow {
  id: string;
  template_id: string;
  school_id: string;
  sort_order: number;
  label: string;
  slot_type: 'period' | 'break' | 'assembly';
  start_time: string;
  end_time: string;
}

interface Template {
  id: string;
  school_id: string;
  name: string;
  description: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const durMin = (s: string, e: string) =>
  s && e ? Math.max(0, Math.round(
    (new Date(`2000-01-01T${e}`).getTime() - new Date(`2000-01-01T${s}`).getTime()) / 60000
  )) : 0;

// ─── Component ───────────────────────────────────────────────────────────────

export default function Timetable() {
  const { userRole } = useAuth();
  const sid = userRole?.school_id;
  const isTeacher = userRole?.role === 'teacher';
  const staffId = userRole?.staff_id;

  // ── Global ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'grid' | 'templates' | 'assignments'>('grid');
  const [loading, setLoading] = useState(false);

  // ── Master data ──────────────────────────────────────────────────────────
  const [classes, setClasses]               = useState<any[]>([]);
  const [teachers, setTeachers]             = useState<any[]>([]);
  const [subjects, setSubjects]             = useState<any[]>([]);
  const [templates, setTemplates]           = useState<Template[]>([]);
  const [allTemplateRows, setAllTemplateRows] = useState<Record<string, TemplateRow[]>>({});
  const [allSchoolSlots, setAllSchoolSlots] = useState<any[]>([]);

  // ── Grid ──────────────────────────────────────────────────────────────────
  const [selectedClass,    setSelectedClass]    = useState('');
  const [selectedDay,      setSelectedDay]      = useState('Monday');
  const [viewMode,         setViewMode]         = useState<'individual' | 'master' | 'teacher' | 'assign'>(isTeacher ? 'teacher' : 'individual');
  const [matrixTemplateId, setMatrixTemplateId] = useState('');
  const [slots,            setSlots]            = useState<any[]>([]);

  // ── Teacher Schedule browse (admin) ─────────────────────────────────────
  const [browseTeacherId, setBrowseTeacherId] = useState('');

  // ── Teacher Assignment view ──────────────────────────────────────────────
  const [assignDay,            setAssignDay]            = useState('Monday');
  const [teacherAssignChanges, setTeacherAssignChanges] = useState<Record<string, string>>({}); // key: `${classId}::${periodNum}` value: teacher_id | ''
  const [savingTeacherAssign,  setSavingTeacherAssign]  = useState(false);

  // ── Day copy panel ───────────────────────────────────────────────────────
  const [showCopyPanel,  setShowCopyPanel]  = useState(false);
  const [copyTargetDays, setCopyTargetDays] = useState<Set<string>>(new Set());
  const [copying,        setCopying]        = useState(false);

  // ── Print / PDF modal ────────────────────────────────────────────────────
  const [showPrintModal,  setShowPrintModal]  = useState(false);
  const [printMode,       setPrintMode]       = useState<'class' | 'teacher' | 'school'>('class');
  const [printClassId,    setPrintClassId]    = useState('');
  const [printTeacherId,  setPrintTeacherId]  = useState('');
  const [printDay,        setPrintDay]        = useState('all');
  const [generating,      setGenerating]      = useState(false);

  // ── School branding ──────────────────────────────────────────────────────
  const [schoolInfo, setSchoolInfo] = useState<{ name: string; address: string; phone: string; logo_url: string | null } | null>(null);

  // ── Signature options ────────────────────────────────────────────────────
  const [sigPrincipal,   setSigPrincipal]   = useState(true);
  const [sigCoordinator, setSigCoordinator] = useState(true);
  const [sigDate,        setSigDate]        = useState(true);

  // ── Slot editor ──────────────────────────────────────────────────────────
  const [editSlot, setEditSlot]           = useState<{ row: TemplateRow; day: string; classId: string } | null>(null);
  const [slotForm, setSlotForm]           = useState({ subject_id: '', teacher_id: '', start_time: '', end_time: '', is_combined: false });
  const [conflictInfo, setConflictInfo]   = useState<any[]>([]);
  const [saving, setSaving]               = useState(false);

  // ── Break/Assembly editor ────────────────────────────────────────────────
  const [editBreakRow, setEditBreakRow]   = useState<TemplateRow | null>(null);
  const [breakForm, setBreakForm]         = useState({ label: '', start_time: '', end_time: '' });
  const [savingBreak, setSavingBreak]     = useState(false);

  // ── Template editor ──────────────────────────────────────────────────────
  const [showTplEditor, setShowTplEditor] = useState(false);
  const [editingTpl, setEditingTpl]       = useState<Template | null>(null);
  const [tplForm, setTplForm]             = useState({ name: '', description: '' });
  const [tplRows, setTplRows]             = useState<any[]>([]);
  const [savingTpl, setSavingTpl]         = useState(false);

  // ── Assignment tab ───────────────────────────────────────────────────────
  const [assignments, setAssignments]               = useState<Record<string, string>>({});
  const [savingAssignments, setSavingAssignments]   = useState(false);

  // ─── Data fetching ────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    if (!sid) return;
    setLoading(true);
    try {
      const [
        { data: cls },
        { data: tchr },
        { data: tmpls },
        { data: tplRowsData },
        { data: allSlots },
        { data: school },
      ] = await Promise.all([
        supabase.from('classes').select('id, name, section, period_template_id').eq('school_id', sid).order('name').order('section'),
        supabase.from('staff').select('id, full_name, role').eq('school_id', sid).eq('is_active', true).eq('is_deleted', false).order('full_name'),
        supabase.from('period_templates').select('*').eq('school_id', sid).order('created_at'),
        supabase.from('period_template_rows').select('*').eq('school_id', sid).order('sort_order'),
        supabase.from('timetable_slots').select('*, subjects(subject_name), staff(full_name), classes(name, section)').eq('school_id', sid),
        supabase.from('schools').select('name, address, contact_phone, logo_url').eq('id', sid).maybeSingle(),
      ]);

      if (cls) {
        setClasses(cls);
        const asgn: Record<string, string> = {};
        cls.forEach((c: any) => { asgn[c.id] = c.period_template_id || ''; });
        setAssignments(asgn);
      }
      if (tchr) setTeachers(tchr);
      if (allSlots) setAllSchoolSlots(allSlots);
      if (school) setSchoolInfo({ name: school.name || '', address: school.address || '', phone: school.contact_phone || '', logo_url: school.logo_url || null });

      if (tmpls) {
        setTemplates(tmpls);
        if (tmpls.length > 0 && !matrixTemplateId) setMatrixTemplateId(tmpls[0].id);
      }

      if (tplRowsData) {
        const grouped: Record<string, TemplateRow[]> = {};
        (tplRowsData as TemplateRow[]).forEach(r => {
          if (!grouped[r.template_id]) grouped[r.template_id] = [];
          grouped[r.template_id].push(r);
        });
        setAllTemplateRows(grouped);
      }
    } catch (err) {
      console.error('fetchAll error:', err);
    }
    setLoading(false);
  }, [sid]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fetchSlots = useCallback(async () => {
    if (!selectedClass || !sid) return;
    const [{ data: mine }, { data: all }] = await Promise.all([
      supabase.from('timetable_slots').select('*, subjects(subject_name), staff(full_name)').eq('class_id', selectedClass).order('period_number'),
      supabase.from('timetable_slots').select('*, subjects(subject_name), staff(full_name), classes(name, section)').eq('school_id', sid),
    ]);
    if (mine) setSlots(mine);
    if (all) setAllSchoolSlots(all);
  }, [selectedClass, sid]);

  useEffect(() => {
    if (selectedClass) { fetchSubjects(selectedClass); fetchSlots(); }
    else setSlots([]);
  }, [selectedClass]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchSubjects = async (classId: string) => {
    const { data } = await supabase.from('subjects').select('*').eq('class_id', classId).order('subject_name');
    if (data) setSubjects(data);
  };

  // ─── Template row helpers ─────────────────────────────────────────────────

  const getClassRows = (classId: string): TemplateRow[] => {
    const cls = classes.find(c => c.id === classId);
    if (!cls?.period_template_id) return FALLBACK_ROWS;
    return allTemplateRows[cls.period_template_id] || FALLBACK_ROWS;
  };

  /** Build a comprehensive row list covering ALL periods/breaks used across the whole school.
   *  Merges FALLBACK_ROWS, every class template, and any extra period_numbers in live slots. */
  const getSchoolRows = (): TemplateRow[] => {
    // If we are in Matrix mode and have a specific template selected, use ONLY those rows
    if (viewMode === 'master' && matrixTemplateId) {
      return allTemplateRows[matrixTemplateId] || FALLBACK_ROWS;
    }

    // If we are in Individual mode, use ONLY that class's rows
    if (viewMode === 'individual' && selectedClass) {
      return getClassRows(selectedClass);
    }

    // Otherwise (Teacher view or Master with no template), we merge.
    // To avoid "Ef-1" seeing "Grade 10" timings, we build a map where the key is sort_order
    // BUT we prioritize the rows from the class the teacher is currently looking at (if any)
    const rowMap = new Map<number, TemplateRow>();
    
    // Start with Fallback
    FALLBACK_ROWS.forEach(r => rowMap.set(r.sort_order, r));
    
    // If a class is selected, its template rows take absolute priority
    if (selectedClass) {
      getClassRows(selectedClass).forEach(r => rowMap.set(r.sort_order, r));
    } else if (matrixTemplateId) {
      (allTemplateRows[matrixTemplateId] || []).forEach(r => rowMap.set(r.sort_order, r));
    } else {
      // General merge (least accurate, used for school-wide printouts)
      (Object.values(allTemplateRows) as TemplateRow[][]).forEach(tRows => {
        tRows.forEach(r => rowMap.set(r.sort_order, r));
      });
    }

    return Array.from(rowMap.values()).sort((a, b) => a.sort_order - b.sort_order);
  };

  const getMatrixRows = (): TemplateRow[] => {
    if (!matrixTemplateId) return FALLBACK_ROWS;
    return allTemplateRows[matrixTemplateId] || FALLBACK_ROWS;
  };

  /** Find a saved slot matching a template row + day + class */
  const findSlot = (row: TemplateRow, day: string, classId: string) =>
    allSchoolSlots.find(s =>
      s.day_of_week === day &&
      s.class_id === classId &&
      ((!row.id.startsWith('_f') && s.template_row_id === row.id) || s.period_number === row.sort_order)
    );

  // ─── Conflict detection ───────────────────────────────────────────────────

  const checkConflict = async (teacherId: string, day: string, periodNum: number, classId: string) => {
    if (!teacherId) { setConflictInfo([]); return; }
    const { data } = await supabase
      .from('timetable_slots')
      .select('*, classes(name, section)')
      .eq('school_id', sid!)
      .eq('teacher_id', teacherId)
      .eq('day_of_week', day)
      .eq('period_number', periodNum)
      .neq('class_id', classId);
    setConflictInfo(data || []);
  };

  // ─── Slot editor ──────────────────────────────────────────────────────────

  const openSlotEditor = async (row: TemplateRow, day: string, classId: string) => {
    if (row.slot_type !== 'period') {
      // Break / assembly → open time editor instead
      if (!row.id.startsWith('_f')) {
        setEditBreakRow(row);
        setBreakForm({ label: row.label, start_time: row.start_time, end_time: row.end_time });
      }
      return;
    }
    await fetchSubjects(classId);
    const existing = findSlot(row, day, classId);
    setConflictInfo([]);
    setEditSlot({ row, day, classId });
    setSlotForm({
      subject_id:  existing?.subject_id  || '',
      teacher_id:  existing?.teacher_id  || '',
      start_time:  existing?.start_time  || row.start_time,
      end_time:    existing?.end_time    || row.end_time,
      is_combined: existing?.is_combined_class || false,
    });
    if (existing?.teacher_id) {
      checkConflict(existing.teacher_id, day, row.sort_order, classId);
    }
  };

  const handleSaveSlot = async () => {
    if (!editSlot) return;
    if (!slotForm.subject_id) return alert('Please select a subject.');
    setSaving(true);
    try {
      const { row, day, classId } = editSlot;
      const payload = {
        school_id:        sid,
        class_id:         classId,
        day_of_week:      day,
        period_number:    row.sort_order,
        template_row_id:  row.id.startsWith('_f') ? null : row.id,
        slot_label:       row.label,
        start_time:       slotForm.start_time || row.start_time,
        end_time:         slotForm.end_time   || row.end_time,
        subject_id:       slotForm.subject_id,
        teacher_id:       slotForm.teacher_id || null,
        is_combined_class:slotForm.is_combined,
      };
      const { error } = await supabase
        .from('timetable_slots')
        .upsert([payload], { onConflict: 'class_id,day_of_week,period_number' });
      if (error) throw error;
      setEditSlot(null);
      fetchSlots();
      fetchAll();
    } catch (err: any) { alert(err.message); }
    setSaving(false);
  };

  const handleClearSlot = async () => {
    if (!editSlot || !confirm('Clear this slot?')) return;
    const { row, day, classId } = editSlot;
    const existing = findSlot(row, day, classId);
    if (existing) {
      await supabase.from('timetable_slots').delete().eq('id', existing.id);
      fetchSlots();
      fetchAll();
    }
    setEditSlot(null);
  };

  // ─── Break/Assembly editor ────────────────────────────────────────────────

  const handleSaveBreak = async () => {
    if (!editBreakRow) return;
    setSavingBreak(true);
    try {
      const { error } = await supabase
        .from('period_template_rows')
        .update({ label: breakForm.label, start_time: breakForm.start_time, end_time: breakForm.end_time })
        .eq('id', editBreakRow.id);
      if (error) throw error;
      setEditBreakRow(null);
      fetchAll();
    } catch (err: any) { alert(err.message); }
    setSavingBreak(false);
  };

  // ─── Template CRUD ────────────────────────────────────────────────────────

  const openNewTemplate = () => {
    setEditingTpl(null);
    setTplForm({ name: '', description: '' });
    setTplRows([{ tempId: Date.now(), label: 'Period 1', slot_type: 'period', start_time: '08:00', end_time: '08:45' }]);
    setShowTplEditor(true);
  };

  const openEditTemplate = (tpl: Template) => {
    setEditingTpl(tpl);
    setTplForm({ name: tpl.name, description: (tpl as any).description || '' });
    setTplRows((allTemplateRows[tpl.id] || []).map(r => ({ ...r, tempId: r.id })));
    setShowTplEditor(true);
  };

  const applyPreset = async (preset: any[], name: string, desc: string) => {
    if (!sid) return;
    try {
      const { data: tpl, error: e1 } = await supabase
        .from('period_templates')
        .insert({ school_id: sid, name, description: desc })
        .select().single();
      if (e1) throw e1;
      const rows = preset.map(r => ({ ...r, template_id: tpl.id, school_id: sid }));
      const { error: e2 } = await supabase.from('period_template_rows').insert(rows);
      if (e2) throw e2;
      await fetchAll();
      alert(`"${name}" template created!`);
    } catch (err: any) { alert(err.message); }
  };

  const handleSaveTemplate = async () => {
    if (!tplForm.name.trim()) return alert('Template name is required.');
    setSavingTpl(true);
    try {
      let templateId = editingTpl?.id;
      if (!editingTpl) {
        const { data: tpl, error } = await supabase
          .from('period_templates')
          .insert({ school_id: sid, name: tplForm.name, description: tplForm.description })
          .select().single();
        if (error) throw error;
        templateId = tpl.id;
      } else {
        const { error } = await supabase
          .from('period_templates')
          .update({ name: tplForm.name, description: tplForm.description })
          .eq('id', editingTpl.id);
        if (error) throw error;
        await supabase.from('period_template_rows').delete().eq('template_id', editingTpl.id);
      }
      if (tplRows.length > 0) {
        const rowsToInsert = tplRows.map((r: any, i: number) => ({
          template_id: templateId,
          school_id:   sid,
          sort_order:  i + 1,
          label:       r.label,
          slot_type:   r.slot_type,
          start_time:  r.start_time || null,
          end_time:    r.end_time   || null,
        }));
        const { error } = await supabase.from('period_template_rows').insert(rowsToInsert);
        if (error) throw error;
      }
      setShowTplEditor(false);
      await fetchAll();
    } catch (err: any) { alert(err.message); }
    setSavingTpl(false);
  };

  const handleDeleteTemplate = async (tplId: string) => {
    if (!confirm('Delete this template? Classes using it will revert to the default structure.')) return;
    await supabase.from('period_templates').delete().eq('id', tplId);
    fetchAll();
  };

  // ─── Assignment save ──────────────────────────────────────────────────────

  const handleSaveAssignments = async () => {
    setSavingAssignments(true);
    try {
      await Promise.all(
        Object.entries(assignments).map(([classId, templateId]) =>
          supabase.from('classes')
            .update({ period_template_id: templateId || null })
            .eq('id', classId)
        )
      );
      await fetchAll();
      alert('Assignments saved!');
    } catch (err: any) { alert(err.message); }
    setSavingAssignments(false);
  };

  // ─── Copy day (single or multiple targets) ───────────────────────────────

  const copyDayToTargets = async (from: string, targets: string[]) => {
    if (targets.length === 0) return;
    setCopying(true);
    try {
      // Fetch source slots once
      const srcQuery = supabase.from('timetable_slots').select('*').eq('day_of_week', from);
      const scoped = selectedClass
        ? srcQuery.eq('class_id', selectedClass)
        : srcQuery.eq('school_id', sid!);
      const { data: src, error: srcErr } = await scoped;
      if (srcErr) throw srcErr;

      // For each target day: delete existing, then insert clones
      await Promise.all(targets.map(async (day) => {
        const delQuery = supabase.from('timetable_slots').delete().eq('day_of_week', day);
        await (selectedClass ? delQuery.eq('class_id', selectedClass) : delQuery.eq('school_id', sid!));
        if (src && src.length > 0) {
          const clones = src.map(({ id, created_at, day_of_week, ...rest }: any) => ({
            ...rest, day_of_week: day,
          }));
          const { error: insErr } = await supabase.from('timetable_slots').insert(clones);
          if (insErr) throw insErr;
        }
      }));

      fetchSlots();
      fetchAll();
    } catch (err: any) { alert(err.message); }
    setCopying(false);
  };

  // ── Teacher Assignment: bulk save ────────────────────────────────────────

  const handleSaveTeacherAssignments = async () => {
    if (!sid) return;
    const entries = Object.entries(teacherAssignChanges);
    if (entries.length === 0) return;
    setSavingTeacherAssign(true);
    try {
      for (const [key, teacherId] of entries) {
        const [classId, periodNumStr] = key.split('::');
        const periodNum = Number(periodNumStr);
        const existing = allSchoolSlots.find(
          s => s.class_id === classId && s.day_of_week === assignDay && s.period_number === periodNum
        );
        if (!existing) continue; // can't assign teacher to a slot with no subject
        const { error } = await supabase
          .from('timetable_slots')
          .update({ teacher_id: teacherId || null })
          .eq('id', existing.id);
        if (error) throw error;
      }
      setTeacherAssignChanges({});
      await fetchAll();
    } catch (err: any) { alert(err.message); }
    setSavingTeacherAssign(false);
  };

  const handleCopyToMany = async () => {
    const targets = [...copyTargetDays];
    if (targets.length === 0) return;
    const scope = selectedClass
      ? `class ${classes.find(c => c.id === selectedClass)?.name ?? ''}`
      : 'all classes';
    if (!confirm(
      `Copy ${selectedDay}'s timetable (${scope}) to: ${targets.join(', ')}?\n\nThis will overwrite those days.`
    )) return;
    await copyDayToTargets(selectedDay, targets);
    setCopyTargetDays(new Set());
    setShowCopyPanel(false);
  };

  /** Legacy single-target clone (kept for compatibility) */
  const handleCloneDay = (from: string, to: string) => copyDayToTargets(from, [to]);

  // ─── PDF / Print helpers ──────────────────────────────────────────────────

  /**
   * Professional ink-friendly PDF header.
   * Layout (top-to-bottom):
   *  - 0.8mm indigo top rule
   *  - School name (bold) + address/phone  (right side: logo placeholder)
   *  - thin separator rule
   *  - "TIME TABLE" title (large, centred) | mode label (right) | date (right)
   *  - 0.5mm bottom rule
   * Total height ≈ 38mm  →  table startY = 40
   */
  const pdfHeader = (doc: jsPDF, modeLabel: string, _subtitle: string) => {
    const W = doc.internal.pageSize.getWidth();
    const ACCENT = [63, 81, 181] as [number, number, number]; // indigo-700

    // ── top rule ──────────────────────────────────────────────────────────
    doc.setFillColor(...ACCENT);
    doc.rect(0, 0, W, 1.2, 'F');

    // ── school block ──────────────────────────────────────────────────────
    const schoolY = 7;
    if (schoolInfo?.name) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(30, 41, 59);
      doc.text(schoolInfo.name, W / 2, schoolY, { align: 'center' });

      if (schoolInfo.address || schoolInfo.phone) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        const detail = [schoolInfo.address, schoolInfo.phone].filter(Boolean).join('   •   ');
        doc.text(detail, W / 2, schoolY + 6, { align: 'center' });
      }
    }

    // ── thin separator ────────────────────────────────────────────────────
    const sepY = 17;
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(0.3);
    doc.line(8, sepY, W - 8, sepY);

    // ── "TIME TABLE" title row ────────────────────────────────────────────
    const titleY = 24;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text('TIME TABLE', W / 2, titleY, { align: 'center' });

    // mode label (left)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(63, 81, 181);
    doc.text(modeLabel, 8, titleY);

    // date (right)
    const d = formatDate(new Date());
    doc.setTextColor(100, 116, 139);
    doc.text(d, W - 8, titleY, { align: 'right' });

    // ── bottom rule ───────────────────────────────────────────────────────
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(0.5);
    doc.line(0, 28, W, 28);

    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(0, 0, 0);
  };

  /** Draw signature lines at the bottom of the last page */
  const pdfSignature = (doc: jsPDF, afterY: number) => {
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const sigs: string[] = [
      ...(sigPrincipal   ? ['Principal']   : []),
      ...(sigCoordinator ? ['Coordinator'] : []),
      ...(sigDate        ? ['Date']        : []),
    ];
    if (sigs.length === 0) return;

    // Place signatures 18mm from page bottom or 10mm below table, whichever is lower
    const sigY = Math.max(afterY + 14, H - 22);
    if (sigY >= H - 8) return; // no room

    const colW = (W - 20) / sigs.length;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.4);
    doc.setTextColor(71, 85, 105);

    sigs.forEach((label, i) => {
      const cx = 10 + i * colW + colW / 2;
      const lineLeft  = cx - colW * 0.32;
      const lineRight = cx + colW * 0.32;
      doc.line(lineLeft, sigY, lineRight, sigY);
      doc.text(label, cx, sigY + 5, { align: 'center' });
    });

    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(0, 0, 0);
  };

  /** Timetable PDF — All classes as rows, periods as columns, cell = Subject + Teacher */
  const generateClassPDF = (_classId?: string) => {
    const schoolRows = getSchoolRows().filter(r => r.slot_type === 'period');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
    pdfHeader(doc, 'Class-wise', `${classes.length} classes  ·  ${schoolRows.length} periods`);

    // Head: Class | Period1 | Period2 | ...
    const head = [['Class', ...schoolRows.map(r => `${r.label}\n${r.start_time}–${r.end_time}`)]];
    const body: any[] = classes.map(cls => {
      const cells: any[] = schoolRows.map(row => {
        const ref = allSchoolSlots.find(s => s.day_of_week === 'Monday' && s.class_id === cls.id && s.period_number === row.sort_order)
                 ?? allSchoolSlots.find(s => s.class_id === cls.id && s.period_number === row.sort_order);
        if (!ref) return { content: '—', styles: { textColor: [200, 200, 200], halign: 'center' as const, fontSize: 6 } };
        return {
          content: `${ref.subjects?.subject_name || '—'}\n${ref.staff?.full_name || ''}`,
          styles: { fontSize: 6.5 },
        };
      });
      return [
        { content: `${cls.name} ${cls.section}`, styles: { fontStyle: 'bold', fillColor: [241, 245, 249], fontSize: 7 } },
        ...cells,
      ];
    });

    const pageW = doc.internal.pageSize.getWidth();
    const classColW = 24;
    const periodColW = Math.max(18, (pageW - 10 - classColW) / schoolRows.length);

    autoTable(doc, {
      head, body,
      startY: 32,
      margin: { left: 5, right: 5, top: 32, bottom: 28 },
      theme: 'grid',
      headStyles: { fillColor: [63, 81, 181], textColor: 255, fontStyle: 'bold', fontSize: 7, halign: 'center', cellPadding: { top: 3, bottom: 3, left: 2, right: 2 } },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: classColW, fontStyle: 'bold', fillColor: [241, 245, 249] },
        ...Object.fromEntries(schoolRows.map((_, i) => [i + 1, { cellWidth: periodColW, halign: 'center' as const }])),
      },
      styles: { fontSize: 6.5, cellPadding: { top: 3, bottom: 3, left: 2, right: 2 }, overflow: 'linebreak', lineColor: [226, 232, 240] },
      rowPageBreak: 'avoid',
    });

    pdfSignature(doc, (doc as any).lastAutoTable?.finalY ?? 32);
    doc.save('Class_Timetable_All.pdf');
  };

  /** Timetable PDF — All teachers as rows, periods as columns, cell = Subject + Class */
  const generateTeacherPDF = (_teacherId?: string) => {
    const schoolRows = getSchoolRows().filter(r => r.slot_type === 'period');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
    pdfHeader(doc, 'Teacher-wise', `${teachers.length} teachers  ·  ${schoolRows.length} periods`);

    // Head: Teacher | Period1 | Period2 | ...
    const head = [['Teacher', ...schoolRows.map(r => `${r.label}\n${r.start_time}–${r.end_time}`)]];
    const body: any[] = teachers.map(teacher => {
      const tSlots = allSchoolSlots.filter(s => s.teacher_id === teacher.id);
      const cells: any[] = schoolRows.map(row => {
        const ref = tSlots.find(s => s.day_of_week === 'Monday' && s.period_number === row.sort_order)
                 ?? tSlots.find(s => s.period_number === row.sort_order);
        if (!ref) return { content: 'Free', styles: { textColor: [203, 213, 225], halign: 'center' as const, fontSize: 6 } };
        const cls = classes.find(c => c.id === ref.class_id);
        return {
          content: `${ref.subjects?.subject_name || '—'}\n${cls ? `${cls.name} ${cls.section}` : ''}`,
          styles: { fontSize: 6.5 },
        };
      });
      return [
        { content: `${teacher.full_name}\n${teacher.role || ''}`, styles: { fontStyle: 'bold', fillColor: [240, 253, 244], fontSize: 7 } },
        ...cells,
      ];
    });

    const pageW = doc.internal.pageSize.getWidth();
    const teacherColW = 32;
    const periodColW = Math.max(18, (pageW - 10 - teacherColW) / schoolRows.length);

    autoTable(doc, {
      head, body,
      startY: 32,
      margin: { left: 5, right: 5, top: 32, bottom: 28 },
      theme: 'grid',
      headStyles: { fillColor: [63, 81, 181], textColor: 255, fontStyle: 'bold', fontSize: 7, halign: 'center', cellPadding: { top: 3, bottom: 3, left: 2, right: 2 } },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: teacherColW, fontStyle: 'bold', fillColor: [241, 245, 249] },
        ...Object.fromEntries(schoolRows.map((_, i) => [i + 1, { cellWidth: periodColW, halign: 'center' as const }])),
      },
      styles: { fontSize: 6.5, cellPadding: { top: 3, bottom: 3, left: 2, right: 2 }, overflow: 'linebreak', lineColor: [226, 232, 240] },
      rowPageBreak: 'avoid',
    });

    pdfSignature(doc, (doc as any).lastAutoTable?.finalY ?? 32);
    doc.save('Teacher_Timetable_All.pdf');
  };

  /** Timetable PDF — Whole school, one entry per cell (Mon as reference).
   *  Assumes timetable is same every day.
   *  Any day with different TIMING is collected and printed as a footnote table at the bottom.
   */
  const generateSchoolPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
    pdfHeader(doc, 'School-wise', `${classes.length} classes  ·  Mon–Sat`);

    const rows = getSchoolRows();
    const pageW = doc.internal.pageSize.getWidth(); // A3 landscape ≈ 420mm
    const periodColW = 28;
    const dynColW = Math.max(20, (pageW - 10 - periodColW) / classes.length);

    // Collect timing exceptions: days whose slot time ≠ reference (Monday) time
    type TimingException = { period: string; day: string; classLabel: string; time: string };
    const timingExceptions: TimingException[] = [];

    const head = [['Period / Time', ...classes.map(c => `${c.name}\n${c.section}`)]];
    const body: any[] = [];

    rows.forEach(row => {
      if (row.slot_type !== 'period') {
        body.push([{
          content: `${row.slot_type === 'break' ? '☕' : '🎒'}  ${row.label}  (${row.start_time} – ${row.end_time})`,
          colSpan: classes.length + 1,
          styles: {
            fillColor: row.slot_type === 'break' ? [255, 251, 235] : [238, 242, 255],
            textColor: row.slot_type === 'break' ? [146, 64, 14] : [79, 70, 229],
            fontStyle: 'bold', halign: 'center', fontSize: 6.5,
          },
        }]);
        return;
      }

      body.push([
        {
          content: `${row.label}\n${row.start_time}–${row.end_time}`,
          styles: { fontStyle: 'bold', fontSize: 7, fillColor: [241, 245, 249] },
        },
        ...classes.map(cls => {
          // Use Monday as the reference slot; fall back to any day
          const ref = allSchoolSlots.find(s => s.day_of_week === 'Monday' && s.class_id === cls.id && s.period_number === row.sort_order)
                   ?? allSchoolSlots.find(s => s.class_id === cls.id && s.period_number === row.sort_order);

          if (!ref) return { content: '—', styles: { textColor: [200, 200, 200], halign: 'center' as const, fontSize: 6 } };

          // Detect timing differences on other days
          DAYS.forEach(day => {
            const daySlot = allSchoolSlots.find(s => s.day_of_week === day && s.class_id === cls.id && s.period_number === row.sort_order);
            if (!daySlot || !daySlot.start_time) return;
            const refTime = ref.start_time || row.start_time;
            if (daySlot.start_time !== refTime) {
              timingExceptions.push({
                period:     row.label,
                day,
                classLabel: `${cls.name} ${cls.section}`,
                time:       `${daySlot.start_time} – ${daySlot.end_time}`,
              });
            }
          });

          return {
            content: `${ref.subjects?.subject_name || '—'}\n${ref.staff?.full_name || ''}`,
            styles: { fontSize: 6.5 },
          };
        }),
      ]);
    });

    autoTable(doc, {
      head,
      body,
      startY: 32,
      margin: { left: 5, right: 5, top: 32, bottom: 28 },
      theme: 'grid',
      headStyles: {
        fillColor: [63, 81, 181], textColor: 255, fontStyle: 'bold',
        fontSize: 7, halign: 'center',
        cellPadding: { top: 3, bottom: 3, left: 2, right: 2 },
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: periodColW, fontStyle: 'bold', fillColor: [241, 245, 249] },
        ...Object.fromEntries(classes.map((_, i) => [i + 1, { cellWidth: dynColW, halign: 'center' as const }])),
      },
      styles: {
        fontSize: 6.5,
        cellPadding: { top: 3, bottom: 3, left: 2, right: 2 },
        overflow: 'linebreak',
        lineColor: [226, 232, 240],
      },
      rowPageBreak: 'avoid',
    });

    // ── Timing exceptions footnote ────────────────────────────────────────
    if (timingExceptions.length > 0) {
      const lastY = (doc as any).lastAutoTable?.finalY ?? 26;
      const noteY = lastY + 8;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(146, 64, 14);
      doc.text('⚠  Schedule Timing Variations  (periods below have different timings on specific days)', 5, noteY);

      autoTable(doc, {
        head: [['Period', 'Day', 'Class', 'Actual Time on That Day']],
        body: timingExceptions.map(e => [e.period, e.day, e.classLabel, e.time]),
        startY: noteY + 4,
        margin: { left: 5, right: 5 },
        theme: 'grid',
        headStyles: { fillColor: [255, 237, 213], textColor: [154, 52, 18], fontStyle: 'bold', fontSize: 7 },
        styles: { fontSize: 6.5, cellPadding: { top: 2, bottom: 2, left: 3, right: 3 } },
        columnStyles: { 0: { cellWidth: 26 }, 1: { cellWidth: 22 }, 2: { cellWidth: 30 } },
      });
    }

    pdfSignature(doc, (doc as any).lastAutoTable?.finalY ?? 32);
    doc.save('School_Timetable.pdf');
  };

  /** Open a printable HTML page in a new window */
  const openPrintWindow = (mode: 'class' | 'teacher' | 'school', id: string, _day: string) => {
    const title = mode === 'class'
      ? (() => { const c = classes.find(x => x.id === id); return c ? `${c.name} ${c.section}` : ''; })()
      : mode === 'teacher'
      ? (teachers.find(t => t.id === id)?.full_name ?? '')
      : 'School Timetable — All Days';

    // Build class-wise HTML table: rows = classes, cols = periods, cell = Subject + Teacher
    const buildClassAllRows = (periodRows: TemplateRow[]) => {
      const periodOnly = periodRows.filter(r => r.slot_type === 'period');
      const header = `<tr><th style="min-width:70px">Class</th>${periodOnly.map(r => `<th>${r.label}<br/><small>${r.start_time}–${r.end_time}</small></th>`).join('')}</tr>`;
      const rows = classes.map(cls => {
        const cells = periodOnly.map(row => {
          const ref = allSchoolSlots.find(s => s.day_of_week === 'Monday' && s.class_id === cls.id && s.period_number === row.sort_order)
                   ?? allSchoolSlots.find(s => s.class_id === cls.id && s.period_number === row.sort_order);
          if (!ref) return `<td><span class="empty">—</span></td>`;
          return `<td><strong>${ref.subjects?.subject_name || '—'}</strong><br/><span>${ref.staff?.full_name || ''}</span></td>`;
        }).join('');
        return `<tr><td class="period-col"><strong>${cls.name} ${cls.section}</strong></td>${cells}</tr>`;
      }).join('');
      return { header, rows };
    };

    // Build teacher-wise HTML table: rows = teachers, cols = periods, cell = Subject + Class
    const buildTeacherAllRows = (periodRows: TemplateRow[]) => {
      const periodOnly = periodRows.filter(r => r.slot_type === 'period');
      const header = `<tr><th style="min-width:80px">Teacher</th>${periodOnly.map(r => `<th>${r.label}<br/><small>${r.start_time}–${r.end_time}</small></th>`).join('')}</tr>`;
      const rows = teachers.map(teacher => {
        const tSlots = allSchoolSlots.filter(s => s.teacher_id === teacher.id);
        const cells = periodOnly.map(row => {
          const ref = tSlots.find(s => s.day_of_week === 'Monday' && s.period_number === row.sort_order)
                   ?? tSlots.find(s => s.period_number === row.sort_order);
          if (!ref) return `<td><span class="free">Free</span></td>`;
          const cls = classes.find(c => c.id === ref.class_id);
          return `<td><strong>${ref.subjects?.subject_name || '—'}</strong><br/><span>${cls ? `${cls.name} ${cls.section}` : ''}</span></td>`;
        }).join('');
        return `<tr><td class="period-col"><strong>${teacher.full_name}</strong><br/><small>${teacher.role || ''}</small></td>${cells}</tr>`;
      }).join('');
      return { header, rows };
    };

    // Build school table rows — single clean entry per cell (Mon as reference), collect timing exceptions
    type HtmlTimingException = { period: string; day: string; classLabel: string; time: string };
    const htmlTimingExceptions: HtmlTimingException[] = [];

    const buildSchoolRows = (rows: TemplateRow[]) =>
      rows.map(row => {
        if (row.slot_type !== 'period') {
          return `<tr class="break-row"><td colspan="${classes.length + 1}">${row.slot_type === 'break' ? '☕' : '🎒'} ${row.label} &nbsp;(${row.start_time} – ${row.end_time})</td></tr>`;
        }
        const cells = classes.map(cls => {
          // Use Monday as reference; fall back to first available day slot
          const ref = allSchoolSlots.find(sl => sl.day_of_week === 'Monday'  && sl.class_id === cls.id && sl.period_number === row.sort_order)
                   || allSchoolSlots.find(sl => sl.class_id === cls.id && sl.period_number === row.sort_order);
          if (!ref) return `<td><span class="empty">—</span></td>`;
          const subj    = ref.subjects?.subject_name || '—';
          const teacher = ref.staff?.full_name       || '';
          // Detect timing exceptions across all days
          DAYS.forEach(day => {
            const s = allSchoolSlots.find(sl => sl.day_of_week === day && sl.class_id === cls.id && sl.period_number === row.sort_order);
            if (s && s.start_time && s.start_time !== ref.start_time) {
              htmlTimingExceptions.push({
                period: row.label,
                day,
                classLabel: `${cls.name} ${cls.section}`,
                time: `${s.start_time} – ${s.end_time}`,
              });
            }
          });
          return `<td><strong>${subj}</strong><br/><span>${teacher}</span></td>`;
        }).join('');
        return `<tr><td class="period-col"><strong>${row.label}</strong><br/><small>${row.start_time} – ${row.end_time}</small></td>${cells}</tr>`;
      }).join('');

    const allSchoolRowsFull = getSchoolRows();
    const classHeaders = classes.map(c => `<th>${c.name} ${c.section}</th>`).join('');

    // School mode
    const schoolTableRows = mode === 'school' ? buildSchoolRows(allSchoolRowsFull) : '';
    const schoolExceptionsHtml = (mode === 'school' && htmlTimingExceptions.length > 0)
      ? `<div class="exceptions-section">
           <div class="exceptions-header">⚠ Schedule Timing Variations (days with different timing)</div>
           <table class="exceptions-table">
             <thead><tr><th>Period</th><th>Day</th><th>Class</th><th>Actual Time on That Day</th></tr></thead>
             <tbody>${htmlTimingExceptions.map(e =>
               `<tr><td>${e.period}</td><td>${e.day}</td><td>${e.classLabel}</td><td>${e.time}</td></tr>`
             ).join('')}</tbody>
           </table>
         </div>`
      : '';

    // Class / teacher mode — all-in-one tables
    const classBuilt   = mode === 'class'   ? buildClassAllRows(allSchoolRowsFull)   : null;
    const teacherBuilt = mode === 'teacher' ? buildTeacherAllRows(allSchoolRowsFull) : null;

    const tables = mode === 'school'
      ? `<table>
           <thead><tr><th style="width:72px">Period / Time</th>${classHeaders}</tr></thead>
           <tbody>${schoolTableRows}</tbody>
         </table>
         ${schoolExceptionsHtml}`
      : mode === 'class'
      ? `<table>
           <thead>${classBuilt!.header}</thead>
           <tbody>${classBuilt!.rows}</tbody>
         </table>`
      : `<table>
           <thead>${teacherBuilt!.header}</thead>
           <tbody>${teacherBuilt!.rows}</tbody>
         </table>`;

    const modeLabel = mode === 'class' ? 'Class-wise' : mode === 'teacher' ? 'Teacher-wise' : 'School-wise';
    const dateStr   = formatDate(new Date());

    const sigSections: string[] = [
      ...(sigPrincipal   ? [`<div class="sig-block"><div class="sig-line"></div><div class="sig-label">Principal</div></div>`]   : []),
      ...(sigCoordinator ? [`<div class="sig-block"><div class="sig-line"></div><div class="sig-label">Coordinator</div></div>`] : []),
      ...(sigDate        ? [`<div class="sig-block"><div class="sig-line"></div><div class="sig-label">Date</div></div>`]        : []),
    ];
    const signatureHtml = sigSections.length > 0
      ? `<div class="sig-row">${sigSections.join('')}</div>`
      : '';

    const html = `<!DOCTYPE html><html><head><title>TIME TABLE — ${modeLabel}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; padding: 10px; font-size: 9px; color: #1e293b; background: #fff; }

      /* ── Professional header ── */
      .doc-header { border-top: 3px solid #3f51b5; padding-top: 6px; margin-bottom: 10px; }
      .school-row { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 4px; }
      .school-logo { height: 38px; width: 38px; object-fit: contain; border-radius: 4px; }
      .school-name { font-size: 15px; font-weight: 900; color: #1e293b; text-align: center; }
      .school-detail { font-size: 7.5px; color: #64748b; text-align: center; margin-bottom: 4px; }
      .sep-line { border: none; border-top: 1px solid #3f51b5; margin: 4px 0; opacity: 0.4; }
      .title-row { display: flex; align-items: baseline; justify-content: space-between; }
      .doc-title { font-size: 13px; font-weight: 900; color: #1e293b; letter-spacing: 2px; flex: 1; text-align: center; }
      .mode-badge { font-size: 7.5px; font-weight: 700; color: #3f51b5; background: #e8eaf6; padding: 2px 7px; border-radius: 20px; white-space: nowrap; }
      .doc-date { font-size: 7px; color: #94a3b8; white-space: nowrap; min-width: 70px; text-align: right; }
      .bottom-rule { border: none; border-top: 1.5px solid #3f51b5; margin: 5px 0 8px; }

      /* ── Table ── */
      table { width: 100%; border-collapse: collapse; margin-bottom: 8px; table-layout: fixed; }
      th { background: #3f51b5; color: #fff; padding: 4px 3px; font-size: 7px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; word-break: break-word; text-align: center; }
      td { border: 1px solid #e2e8f0; padding: 3px 4px; vertical-align: top; font-size: 8px; word-break: break-word; }
      td strong { display: block; font-size: 8px; font-weight: 700; color: #1e293b; }
      td span, td small { font-size: 7px; color: #64748b; }
      .period-col { background: #f1f5f9; font-weight: 700; white-space: nowrap; color: #334155; }
      .break-row td { background: #fefce8; color: #92400e; font-weight: bold; text-align: center; font-size: 7.5px; padding: 3px; }
      .empty { color: #cbd5e1; }
      .free { color: #94a3b8; font-style: italic; }
      tr:nth-child(even):not(.break-row) td:not(.period-col) { background: #f8fafc; }

      /* ── Exceptions ── */
      .exceptions-section { margin-top: 10px; }
      .exceptions-header { background: #fef3c7; color: #92400e; font-weight: bold; font-size: 8px; padding: 3px 8px; border-left: 3px solid #f59e0b; margin-bottom: 3px; }
      .exceptions-table { width: auto; border-collapse: collapse; font-size: 8px; }
      .exceptions-table th { background: #fef3c7; color: #92400e; padding: 3px 8px; font-size: 7.5px; text-transform: uppercase; }
      .exceptions-table td { border: 1px solid #fde68a; padding: 2px 8px; color: #78350f; }

      /* ── Signatures ── */
      .sig-row { display: flex; justify-content: space-around; margin-top: 28px; padding: 0 20px; }
      .sig-block { flex: 1; text-align: center; padding: 0 16px; }
      .sig-line { border-top: 1px solid #64748b; margin-bottom: 5px; }
      .sig-label { font-size: 8px; color: #475569; font-weight: 600; letter-spacing: 0.5px; }

      /* ── Print ── */
      .print-btn { margin-bottom: 10px; padding: 7px 18px; background: #3f51b5; color: #fff; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 11px; }
      @media print {
        body { padding: 4px; }
        .no-print { display: none !important; }
        @page { margin: 8mm; size: A3 landscape; }
      }
    </style></head>
    <body>
    <button class="print-btn no-print" onclick="window.print()">🖨 Print</button>

    <div class="doc-header">
      <div class="school-row">
        ${schoolInfo?.logo_url ? `<img src="${schoolInfo.logo_url}" class="school-logo" onerror="this.style.display='none'"/>` : ''}
        <div class="school-name">${schoolInfo?.name || 'School'}</div>
      </div>
      ${(schoolInfo?.address || schoolInfo?.phone) ? `<div class="school-detail">${[schoolInfo?.address, schoolInfo?.phone].filter(Boolean).join('   •   ')}</div>` : ''}
      <hr class="sep-line"/>
      <div class="title-row">
        <span class="mode-badge">${modeLabel}</span>
        <span class="doc-title">TIME TABLE</span>
        <span class="doc-date">${dateStr}</span>
      </div>
      <hr class="bottom-rule"/>
    </div>

    ${tables}
    ${signatureHtml}
    </body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  };

  const handleGeneratePDF = () => {
    setGenerating(true);
    try {
      if (printMode === 'class')   generateClassPDF();
      if (printMode === 'teacher') generateTeacherPDF();
      if (printMode === 'school')  generateSchoolPDF();
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    if (printMode === 'class')   openPrintWindow('class',   '', '');
    if (printMode === 'teacher') openPrintWindow('teacher', '', '');
    if (printMode === 'school')  openPrintWindow('school',  '', '');
  };

  // ─── Computed ─────────────────────────────────────────────────────────────

  const currentClassRows    = selectedClass ? getClassRows(selectedClass) : FALLBACK_ROWS;
  const matrixRows          = getMatrixRows();
  const currentClassObj     = classes.find(c => c.id === selectedClass);
  const currentTemplateName = currentClassObj?.period_template_id
    ? (templates.find(t => t.id === currentClassObj.period_template_id)?.name ?? 'Custom')
    : 'Default (no template)';

  // ─── Render helpers ───────────────────────────────────────────────────────

  const renderBreakBanner = (row: TemplateRow, colSpan: number, showEditBtn = false) => {
    const isBreak = row.slot_type === 'break';
    const dur = durMin(row.start_time, row.end_time);
    const icon = isBreak ? '☕' : '🎒';
    const bg   = isBreak ? 'bg-amber-50 border-amber-100'       : 'bg-indigo-50 border-indigo-100';
    const txt  = isBreak ? 'text-amber-700'                      : 'text-indigo-700';
    const sub  = isBreak ? 'text-amber-500'                      : 'text-indigo-400';
    return (
      <tr key={row.id} className={bg}>
        <td className={`px-4 py-2 sticky left-0 z-10 border-y ${bg}`}>
          <div className="flex items-center gap-2">
            {isBreak
              ? <Coffee className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              : <Users  className="w-3.5 h-3.5 text-indigo-500 shrink-0" />}
            <div className="min-w-0">
              <p className={`text-xs font-black ${txt}`}>{row.label}</p>
              <p className={`text-[10px] ${sub}`}>{row.start_time} – {row.end_time} · {dur} min</p>
            </div>
            {showEditBtn && !row.id.startsWith('_f') && (
              <button
                onClick={() => { setEditBreakRow(row); setBreakForm({ label: row.label, start_time: row.start_time, end_time: row.end_time }); }}
                className={`ml-auto p-1 rounded ${isBreak ? 'text-amber-400 hover:text-amber-600' : 'text-indigo-400 hover:text-indigo-600'}`}
                title="Edit timing">
                <Edit2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </td>
        <td colSpan={colSpan} className={`border-y ${bg}`}>
          <div className={`h-6 flex items-center justify-center`}>
            <span className={`text-[10px] font-bold ${sub} uppercase tracking-widest`}>{icon} {row.label}</span>
          </div>
        </td>
      </tr>
    );
  };

  const renderSlotCell = (row: TemplateRow, day: string, classId: string, isHighlight = false) => {
    const slot      = findSlot(row, day, classId);
    const conflicts = slot?.teacher_id
      ? allSchoolSlots.filter(s => s.teacher_id === slot.teacher_id && s.day_of_week === day && s.period_number === row.sort_order && s.class_id !== classId)
      : [];
    const isCombined = slot?.is_combined_class;

    return (
      <td
        key={`${day}-${classId}`}
        className={cn(
          'p-1.5 border-r border-slate-50',
          !isTeacher && 'cursor-pointer',
          isHighlight ? 'bg-indigo-50/20' : ''
        )}
        onClick={() => !isTeacher && openSlotEditor(row, day, classId)}
      >
        {slot ? (
          <div className={`p-2 rounded-xl border-2 min-h-[64px] flex flex-col justify-center relative ${
            isCombined             ? 'bg-amber-50 border-amber-200' :
            conflicts.length > 0  ? 'bg-rose-50 border-rose-200'   :
            'bg-slate-50 border-transparent hover:border-indigo-200 hover:bg-white hover:shadow-sm'
          }`}>
            <p className="text-[11px] font-black text-slate-900 uppercase leading-tight truncate">{slot.subjects?.subject_name}</p>
            <p className="text-[10px] text-slate-400 mt-0.5 italic truncate">
              {viewMode === 'teacher' ? (slot.classes ? `${slot.classes.name} ${slot.classes.section}` : 'No class') : (slot.staff?.full_name || 'No teacher')}
            </p>
            <p className="text-[9px] text-slate-300 mt-0.5 tabular-nums">{slot.start_time} – {slot.end_time}</p>
            {isCombined && (
              <span className="absolute top-1 right-1 bg-amber-400 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full">JOINT</span>
            )}
            {!isCombined && conflicts.length > 0 && (
              <span className="absolute top-1 right-1 bg-rose-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full animate-pulse">CLASH</span>
            )}
          </div>
        ) : (
          <div className={cn(
            'w-full min-h-[64px] border-2 border-dashed rounded-xl flex items-center justify-center transition-all group',
            isTeacher ? 'border-slate-50 opacity-50' : 'border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/20'
          )}>
            {!isTeacher && <PlusCircle className="w-4 h-4 text-slate-200 group-hover:text-indigo-400 transition-colors" />}
          </div>
        )}
      </td>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 max-w-full">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #e2e8f0; padding: 6px 8px; font-size: 10px; }
          @page { size: A3 landscape; margin: 10mm; }
        }
      `}</style>

      {/* ── Page header ── */}
      <div className="no-print flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Clock className="w-7 h-7 text-indigo-600" /> 
            {isTeacher ? 'My Weekly Schedule' : 'Timetable Manager'}
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {isTeacher ? 'View your full weekly teaching schedule and period timings.' : 'Template-driven scheduling · break & assembly timing · combined class support.'}
          </p>
        </div>
        <button onClick={() => { setShowPrintModal(true); setPrintClassId(selectedClass || (classes[0]?.id ?? '')); setPrintTeacherId(teachers[0]?.id ?? ''); setPrintDay(selectedDay); }} className="no-print flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow hover:bg-slate-800 transition">
          <Printer className="w-4 h-4" /> Print / Export PDF
        </button>
      </div>

      {/* ── Tab bar ── */}
      {!isTeacher && (
        <div className="no-print flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          {([
            { id: 'grid',        label: 'Timetable Grid',       icon: Calendar },
            { id: 'templates',   label: 'Period Templates',      icon: Layers   },
            { id: 'assignments', label: 'Class → Template',      icon: Link2    },
          ] as const).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-white text-indigo-600 shadow' : 'text-slate-500 hover:text-slate-700'}`}>
              <tab.icon className="w-4 h-4" />{tab.label}
            </button>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB — GRID
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'grid' && (
        <div className="space-y-4">
          {/* Controls row */}
          <div className="no-print flex flex-wrap items-center gap-3">
            {/* View toggle */}
            <div className="flex bg-white border border-slate-200 rounded-xl p-1 shrink-0">
              {isTeacher ? (
                <button 
                  className="px-4 py-2 rounded-lg text-xs font-black bg-indigo-600 text-white uppercase tracking-widest shadow-sm">
                  Teacher View
                </button>
              ) : (
                <>
                  <button onClick={() => setViewMode('individual')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition ${viewMode === 'individual' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                    Class View
                  </button>
                  <button onClick={() => setViewMode('master')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition ${viewMode === 'master' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                    Master Matrix
                  </button>
                  <button onClick={() => setViewMode('teacher')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition ${viewMode === 'teacher' ? 'bg-violet-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                    <User className="w-3.5 h-3.5" /> Teacher Schedule
                  </button>
                  <button
                    onClick={() => { setViewMode('assign'); setTeacherAssignChanges({}); }}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition ${viewMode === 'assign' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                    <Users className="w-3.5 h-3.5" /> Assign Teachers
                  </button>
                </>
              )}
            </div>

            {/* Day pills */}
            <div className="flex flex-wrap gap-1">
              {DAYS.map(d => (
                <button key={d} onClick={() => setSelectedDay(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${selectedDay === d ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                  {d.slice(0, 3)}
                </button>
              ))}
            </div>

            {/* Copy Day panel */}
            {!isTeacher && (
              <div className="relative ml-auto no-print">
                <button
                  onClick={() => { setShowCopyPanel(p => !p); setCopyTargetDays(new Set()); }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition border ${
                    showCopyPanel
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy {selectedDay.slice(0, 3)}
                  {copyTargetDays.size > 0 && (
                    <span className="bg-white text-indigo-600 text-[9px] font-black px-1.5 py-0.5 rounded-full ml-0.5">
                      {copyTargetDays.size}
                    </span>
                  )}
                </button>
                {showCopyPanel && (
                  <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-2xl border border-slate-200 shadow-2xl z-[100] p-4 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-50">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Copy {selectedDay} to:</h4>
                      <button onClick={() => setShowCopyPanel(false)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    
                    <div className="space-y-1 mb-4">
                      {DAYS.filter(d => d !== selectedDay).map(day => (
                        <label key={day} className={cn(
                          "flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors border",
                          copyTargetDays.has(day) 
                            ? "bg-indigo-50 border-indigo-100 text-indigo-700" 
                            : "bg-white border-transparent text-slate-600 hover:bg-slate-50"
                        )}>
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={copyTargetDays.has(day)}
                            onChange={() => {
                              const next = new Set(copyTargetDays);
                              if (next.has(day)) next.delete(day);
                              else next.add(day);
                              setCopyTargetDays(next);
                            }}
                          />
                          <div className={cn(
                            "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                            copyTargetDays.has(day) ? "bg-indigo-600 border-indigo-600" : "bg-white border-slate-200"
                          )}>
                            {copyTargetDays.has(day) && <Plus className="w-2.5 h-2.5 text-white" />}
                          </div>
                          <span className="text-sm font-bold">{day}</span>
                        </label>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <button
                        onClick={handleCopyToMany}
                        disabled={copying || copyTargetDays.size === 0}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition disabled:opacity-50 shadow-lg shadow-indigo-100"
                      >
                        {copying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Apply Clones
                      </button>
                      <button
                        onClick={() => setCopyTargetDays(new Set(DAYS.filter(d => d !== selectedDay)))}
                        className="w-full py-1.5 text-[10px] font-black text-indigo-400 hover:text-indigo-600 uppercase tracking-widest"
                      >
                        Select All Working Days
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Individual (class view): rows = periods, cols = days ── */}
          {viewMode === 'individual' && (
            <div className="space-y-3">
              {/* Class selector */}
              <div className="no-print flex flex-wrap items-center gap-4 bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                <div className="flex-1 min-w-[180px]">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Select Class</label>
                  <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none">
                    <option value="">Choose class…</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name} — {c.section}</option>)}
                  </select>
                </div>
                {selectedClass && (
                  <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 px-4 py-2.5 rounded-xl">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
                      <Layers className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">Active Template</p>
                      <p className="text-xs font-black text-indigo-900">{currentTemplateName}</p>
                    </div>
                    <button 
                      onClick={() => setActiveTab('assignments')} 
                      className="ml-4 p-2 text-indigo-400 hover:text-indigo-600 hover:bg-white rounded-lg transition"
                      title="Change Assignment"
                    >
                      <Link2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 no-print ml-auto">
                  <span className="w-3 h-3 rounded bg-amber-300 inline-block"></span> Joint/Combined
                  <span className="w-3 h-3 rounded bg-rose-400 inline-block ml-2"></span> Conflict
                </div>
              </div>

              {selectedClass ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-slate-900 text-white">
                          <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest sticky left-0 bg-slate-900 z-20 w-44">Time Slot</th>
                          {DAYS.map(day => (
                            <th key={day} className={`px-3 py-3 text-center text-[10px] font-black uppercase tracking-widest border-l border-slate-800 ${day === selectedDay ? 'bg-indigo-700' : ''}`}>
                              {day.slice(0, 3)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {currentClassRows.map(row => {
                          if (row.slot_type !== 'period') {
                            return renderBreakBanner(row, DAYS.length, true);
                          }
                          return (
                            <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                              <td className="px-4 py-3 sticky left-0 bg-white z-10 border-r border-slate-100">
                                <p className="text-xs font-black text-slate-900">{row.label}</p>
                                <p className="text-[10px] font-bold text-slate-400 mt-0.5 tabular-nums">{row.start_time} – {row.end_time}</p>
                              </td>
                              {DAYS.map(day => renderSlotCell(row, day, selectedClass, day === selectedDay))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-24 bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <div className="text-center">
                    <BookOpen className="w-16 h-16 text-slate-100 mx-auto mb-4" />
                    <p className="text-slate-300 font-bold">Select a class to view its timetable</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Teacher Schedule View: rows = periods, cols = days ── */}
          {viewMode === 'teacher' && (() => {
            // Admin browses any teacher; teacher sees own schedule
            const viewTeacherId = isTeacher ? (staffId || '') : browseTeacherId;
            const viewTeacher = teachers.find(t => t.id === viewTeacherId);
            const teacherSlots = allSchoolSlots.filter(s => s.teacher_id === viewTeacherId);
            const totalPeriods = teacherSlots.length;
            const periodsToday = teacherSlots.filter(s => s.day_of_week === selectedDay).length;

            return (
              <div className="space-y-3">
                {/* Teacher picker (admin only) */}
                {!isTeacher && (
                  <div className="no-print flex flex-wrap items-center gap-4 bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Select Teacher</label>
                      <select value={browseTeacherId} onChange={e => setBrowseTeacherId(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-violet-500 outline-none">
                        <option value="">Choose teacher…</option>
                        {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}{t.role ? ` (${t.role})` : ''}</option>)}
                      </select>
                    </div>
                    {viewTeacher && (
                      <div className="flex items-center gap-3 bg-violet-50 border border-violet-100 px-4 py-2.5 rounded-xl">
                        <div className="w-8 h-8 bg-violet-600 rounded-full flex items-center justify-center text-white font-black text-xs">
                          {viewTeacher.full_name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-black text-violet-900">{viewTeacher.full_name}</p>
                          <p className="text-[10px] font-bold text-violet-500">{totalPeriods} total periods &bull; {periodsToday} today ({selectedDay.slice(0,3)})</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {viewTeacherId ? (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-slate-900 text-white">
                            <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest sticky left-0 bg-slate-900 z-20 w-44">Time Slot</th>
                            {DAYS.map(day => (
                              <th key={day} className={`px-3 py-3 text-center text-[10px] font-black uppercase tracking-widest border-l border-slate-800 ${day === selectedDay ? 'bg-violet-700' : ''}`}>
                                {day.slice(0, 3)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {getSchoolRows().map(row => {
                            if (row.slot_type !== 'period') {
                              return renderBreakBanner(row, DAYS.length, false);
                            }
                            return (
                              <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                                <td className="px-4 py-3 sticky left-0 bg-white z-10 border-r border-slate-100">
                                  <p className="text-xs font-black text-slate-900">{row.label}</p>
                                  <p className="text-[10px] font-bold text-slate-400 mt-0.5 tabular-nums">{row.start_time} – {row.end_time}</p>
                                </td>
                                {DAYS.map(day => {
                                  const slot = allSchoolSlots.find(s => s.teacher_id === viewTeacherId && s.day_of_week === day && s.period_number === row.sort_order);
                                  return renderSlotCell(row, day, slot?.class_id || '', day === selectedDay);
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-center">
                      <User className="w-14 h-14 text-slate-100 mx-auto mb-3" />
                      <p className="text-slate-300 font-bold">Select a teacher above to view their schedule</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          {viewMode === 'master' && (
            <div className="space-y-3">
              <div className="no-print flex flex-wrap items-center gap-4 bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Template Rows</label>
                  <select value={matrixTemplateId} onChange={e => setMatrixTemplateId(e.target.value)}
                    className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none">
                    <option value="">Default (fallback)</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 mt-4">
                  <span><span className="w-3 h-3 rounded bg-amber-300 inline-block mr-1"></span> Joint</span>
                  <span><span className="w-3 h-3 rounded bg-rose-400 inline-block mr-1"></span> Conflict</span>
                  <span><span className="text-slate-300 italic mr-1">diff. template</span> = class uses different template</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white">
                        <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest sticky left-0 bg-slate-900 z-20 w-40">Time Slot</th>
                        {classes.map(cls => (
                          <th key={cls.id} className="px-2 py-3 text-center text-[10px] font-black uppercase tracking-widest border-l border-slate-800 min-w-[120px]">
                            <span className="block">{cls.name}</span>
                            <span className="text-white/50 text-[8px] font-bold">{cls.section}</span>
                            {matrixTemplateId && cls.period_template_id && cls.period_template_id !== matrixTemplateId && (
                              <span className="block text-[7px] bg-white/10 rounded mt-0.5 px-1 italic">diff. template</span>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matrixRows.map(row => {
                        if (row.slot_type !== 'period') {
                          const isBreak = row.slot_type === 'break';
                          const bg  = isBreak ? 'bg-amber-50 border-amber-100' : 'bg-indigo-50 border-indigo-100';
                          const txt = isBreak ? 'text-amber-600' : 'text-indigo-600';
                          const sub = isBreak ? 'text-amber-400' : 'text-indigo-400';
                          const icon = isBreak ? '☕' : '🎒';
                          return (
                            <tr key={row.id} className={bg}>
                              <td className={`px-4 py-2 sticky left-0 z-10 border-y ${bg}`}>
                                <p className={`text-[10px] font-black ${txt}`}>{icon} {row.label}</p>
                                <p className={`text-[9px] ${sub} tabular-nums`}>{row.start_time} – {row.end_time}</p>
                              </td>
                              <td colSpan={classes.length} className={`border-y ${bg}`}>
                                <div className="h-5 flex items-center justify-center">
                                  <span className={`text-[9px] font-bold ${sub} opacity-50 uppercase tracking-widest`}>{row.label}</span>
                                </div>
                              </td>
                            </tr>
                          );
                        }
                        return (
                          <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                            <td className="px-4 py-2 sticky left-0 bg-white z-10 border-r border-slate-100">
                              <p className="text-xs font-black text-slate-800">{row.label}</p>
                              <p className="text-[10px] text-slate-400 tabular-nums">{row.start_time} – {row.end_time}</p>
                            </td>
                            {classes.map(cls => renderSlotCell(row, selectedDay, cls.id))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Teacher Assignment view ── */}
          {viewMode === 'assign' && (() => {
            // Build the period rows from the first available template or fallback
            const assignRows = matrixTemplateId
              ? (allTemplateRows[matrixTemplateId] || FALLBACK_ROWS)
              : (Object.values(allTemplateRows)[0] as TemplateRow[] | undefined) || FALLBACK_ROWS;
            const periodRows = assignRows.filter(r => r.slot_type === 'period');
            const changeCount = Object.keys(teacherAssignChanges).length;

            // Helper: get current teacher_id for a cell (pending change takes priority)
            const getCellTeacher = (classId: string, periodNum: number): string => {
              const key = `${classId}::${periodNum}`;
              if (key in teacherAssignChanges) return teacherAssignChanges[key];
              const slot = allSchoolSlots.find(
                s => s.class_id === classId && s.day_of_week === assignDay && s.period_number === periodNum
              );
              return slot?.teacher_id || '';
            };

            // Helper: detect conflict — teacher already in another class this period/day
            const hasConflict = (classId: string, periodNum: number, teacherId: string): boolean => {
              if (!teacherId) return false;
              return allSchoolSlots.some(
                s => s.teacher_id === teacherId &&
                     s.day_of_week === assignDay &&
                     s.period_number === periodNum &&
                     s.class_id !== classId
              ) || Object.entries(teacherAssignChanges).some(([k, v]) => {
                const [kClass, kPeriod] = k.split('::');
                return v === teacherId && kClass !== classId && Number(kPeriod) === periodNum;
              });
            };

            return (
              <div className="space-y-3">
                {/* Toolbar */}
                <div className="no-print flex flex-wrap items-center gap-3 bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Day</p>
                    <div className="flex gap-1 flex-wrap">
                      {DAYS.map(d => (
                        <button key={d}
                          onClick={() => { setAssignDay(d); setTeacherAssignChanges({}); }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${assignDay === d ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                          {d.slice(0, 3)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-3">
                    {changeCount > 0 && (
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                        {changeCount} unsaved change{changeCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    <button
                      onClick={handleSaveTeacherAssignments}
                      disabled={savingTeacherAssign || changeCount === 0}
                      className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition disabled:opacity-40 shadow-lg shadow-emerald-100"
                    >
                      {savingTeacherAssign ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Save Assignments
                    </button>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-4 text-[10px] font-bold text-slate-400 px-1">
                  <span><span className="inline-block w-3 h-3 rounded bg-emerald-100 border border-emerald-300 mr-1" />Changed</span>
                  <span><span className="inline-block w-3 h-3 rounded bg-rose-100 border border-rose-300 mr-1" />Conflict</span>
                  <span><span className="inline-block w-3 h-3 rounded bg-slate-100 border border-slate-200 mr-1" />No subject (skip)</span>
                </div>

                {/* Assignment matrix */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-slate-900 text-white">
                          <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest sticky left-0 bg-slate-900 z-20 w-40 whitespace-nowrap">Period</th>
                          {classes.map(cls => (
                            <th key={cls.id} className="px-2 py-3 text-center text-[10px] font-black uppercase tracking-widest border-l border-slate-800 min-w-[140px]">
                              <span className="block">{cls.name}</span>
                              <span className="text-white/50 text-[8px] font-bold">{cls.section}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {assignRows.map(row => {
                          // Break / assembly rows — render spanning banner
                          if (row.slot_type !== 'period') {
                            const isBreak = row.slot_type === 'break';
                            const bg  = isBreak ? 'bg-amber-50 border-amber-100' : 'bg-indigo-50 border-indigo-100';
                            const txt = isBreak ? 'text-amber-600' : 'text-indigo-600';
                            const sub = isBreak ? 'text-amber-400' : 'text-indigo-400';
                            const icon = isBreak ? '☕' : '🎒';
                            return (
                              <tr key={row.id} className={bg}>
                                <td className={`px-4 py-2 sticky left-0 z-10 border-y ${bg}`}>
                                  <p className={`text-[10px] font-black ${txt}`}>{icon} {row.label}</p>
                                  <p className={`text-[9px] ${sub} tabular-nums`}>{row.start_time} – {row.end_time}</p>
                                </td>
                                <td colSpan={classes.length} className={`border-y ${bg}`}>
                                  <div className="h-5 flex items-center justify-center">
                                    <span className={`text-[9px] font-bold ${sub} opacity-50 uppercase tracking-widest`}>{row.label}</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          }

                          return (
                            <tr key={row.id} className="border-b border-slate-100">
                              <td className="px-4 py-3 sticky left-0 bg-white z-10 border-r border-slate-100 whitespace-nowrap">
                                <p className="text-xs font-black text-slate-900">{row.label}</p>
                                <p className="text-[10px] font-bold text-slate-400 tabular-nums">{row.start_time} – {row.end_time}</p>
                              </td>
                              {classes.map(cls => {
                                const slot = allSchoolSlots.find(
                                  s => s.class_id === cls.id && s.day_of_week === assignDay && s.period_number === row.sort_order
                                );
                                const key = `${cls.id}::${row.sort_order}`;
                                const currentTeacher = getCellTeacher(cls.id, row.sort_order);
                                const pending = key in teacherAssignChanges;
                                const conflict = hasConflict(cls.id, row.sort_order, currentTeacher);

                                if (!slot) {
                                  return (
                                    <td key={cls.id} className="p-2 border-r border-slate-50">
                                      <div className="flex items-center justify-center min-h-[52px] rounded-xl bg-slate-50 border border-slate-100">
                                        <span className="text-[9px] font-bold text-slate-300">No subject</span>
                                      </div>
                                    </td>
                                  );
                                }

                                return (
                                  <td key={cls.id} className="p-2 border-r border-slate-50">
                                    <div className={`p-2 rounded-xl border-2 min-h-[52px] flex flex-col justify-between gap-1.5 transition-all ${
                                      conflict  ? 'bg-rose-50 border-rose-300' :
                                      pending   ? 'bg-emerald-50 border-emerald-300' :
                                                  'bg-slate-50 border-slate-100'
                                    }`}>
                                      <p className="text-[10px] font-black text-slate-800 uppercase leading-tight truncate">
                                        {slot.subjects?.subject_name || '—'}
                                      </p>
                                      <select
                                        value={currentTeacher}
                                        onChange={e => {
                                          setTeacherAssignChanges(prev => ({ ...prev, [key]: e.target.value }));
                                        }}
                                        className={`w-full text-[10px] font-bold rounded-lg border px-1.5 py-1 outline-none focus:ring-1 focus:ring-emerald-400 truncate ${
                                          conflict ? 'border-rose-300 bg-rose-50 text-rose-700' :
                                          pending  ? 'border-emerald-300 bg-white text-emerald-800' :
                                                     'border-slate-200 bg-white text-slate-600'
                                        }`}
                                      >
                                        <option value="">Unassigned</option>
                                        {teachers.map(t => (
                                          <option key={t.id} value={t.id}>{t.full_name}</option>
                                        ))}
                                      </select>
                                      {conflict && (
                                        <p className="text-[8px] font-black text-rose-600 uppercase tracking-wide flex items-center gap-0.5">
                                          <AlertTriangle className="w-2.5 h-2.5 shrink-0" /> Clash
                                        </p>
                                      )}
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
                </div>

                {classes.length === 0 && (
                  <div className="flex items-center justify-center py-16 text-slate-300 font-bold">
                    No classes found. Add classes first.
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB — PERIOD TEMPLATES
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'templates' && (
        <div className="space-y-5">
          {/* Preset banner (shown when no templates exist) */}
          {templates.length === 0 && (
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 p-6">
              <h3 className="font-black text-slate-800 mb-1">Quick Start — Apply a Preset</h3>
              <p className="text-sm text-slate-500 mb-4">No templates yet. Choose a preset or create a custom one.</p>
              <div className="flex flex-wrap gap-3">
                <button onClick={() => applyPreset(MONTESSORI_PRESET, 'Montessori', 'Pre-school / Montessori schedule')}
                  className="px-5 py-2.5 bg-purple-600 text-white rounded-xl font-bold text-sm hover:bg-purple-700 transition shadow">
                  🌸 Montessori Preset
                </button>
                <button onClick={() => applyPreset(GRADE_18_PRESET, 'Grade 1–8', 'Standard primary / secondary schedule')}
                  className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition shadow">
                  📚 Grade 1–8 Preset
                </button>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="flex justify-between items-center flex-wrap gap-3">
            <h2 className="text-lg font-black text-slate-800">Period Templates <span className="text-slate-400 font-bold text-base">({templates.length})</span></h2>
            <div className="flex gap-2 flex-wrap">
              {templates.length > 0 && (
                <>
                  <button onClick={() => applyPreset(MONTESSORI_PRESET, 'Montessori (Preset)', '')}
                    className="px-3 py-2 border border-purple-200 text-purple-600 rounded-xl font-bold text-xs hover:bg-purple-50">
                    + Montessori Preset
                  </button>
                  <button onClick={() => applyPreset(GRADE_18_PRESET, 'Grade 1–8 (Preset)', '')}
                    className="px-3 py-2 border border-indigo-200 text-indigo-600 rounded-xl font-bold text-xs hover:bg-indigo-50">
                    + Grade 1–8 Preset
                  </button>
                </>
              )}
              <button onClick={openNewTemplate}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 shadow">
                <Plus className="w-4 h-4" /> New Template
              </button>
            </div>
          </div>

          {/* Template cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map(tpl => {
              const rows = allTemplateRows[tpl.id] || [];
              const classesUsing = classes.filter(c => c.period_template_id === tpl.id);
              return (
                <div key={tpl.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-start gap-3">
                    <div>
                      <h3 className="font-black text-slate-900">{tpl.name}</h3>
                      {(tpl as any).description && <p className="text-xs text-slate-400 mt-0.5">{(tpl as any).description}</p>}
                      <div className="flex gap-3 mt-2 text-[10px] font-bold text-slate-500">
                        <span>{rows.filter(r => r.slot_type === 'period').length} periods</span>
                        <span>{rows.filter(r => r.slot_type === 'break').length} breaks</span>
                        <span>{rows.filter(r => r.slot_type === 'assembly').length} assembly</span>
                        <span className="text-indigo-600">{classesUsing.length} class{classesUsing.length !== 1 ? 'es' : ''}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => openEditTemplate(tpl)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteTemplate(tpl.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
                    {rows.map(row => (
                      <div key={row.id} className={`px-5 py-2.5 flex items-center gap-3 ${
                        row.slot_type === 'break'    ? 'bg-amber-50' :
                        row.slot_type === 'assembly' ? 'bg-indigo-50' : ''
                      }`}>
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          row.slot_type === 'period'   ? 'bg-indigo-500' :
                          row.slot_type === 'break'    ? 'bg-amber-400' :
                          'bg-purple-400'
                        }`} />
                        <span className="text-xs font-bold text-slate-700 flex-1 min-w-0 truncate">{row.label}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          row.slot_type === 'period'   ? 'bg-indigo-100 text-indigo-700' :
                          row.slot_type === 'break'    ? 'bg-amber-100 text-amber-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>{row.slot_type}</span>
                        <span className="text-[10px] text-slate-400 tabular-nums shrink-0">{row.start_time}–{row.end_time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB — CLASS → TEMPLATE ASSIGNMENTS
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'assignments' && (
        <div className="space-y-4">
          <div className="flex justify-between items-start flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-800">Class → Template Assignments</h2>
              <p className="text-sm text-slate-500 mt-0.5">Assign a period template to each class. Classes without a template use the default 8-period structure.</p>
            </div>
            <button onClick={handleSaveAssignments} disabled={savingAssignments}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 shadow">
              <Save className="w-4 h-4" /> {savingAssignments ? 'Saving…' : 'Save Assignments'}
            </button>
          </div>

          {templates.length === 0 && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              <p className="text-sm text-amber-700 font-medium">
                No templates yet.{' '}
                <button onClick={() => setActiveTab('templates')} className="underline font-bold">Go to Period Templates</button>
                {' '}tab first.
              </p>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-5 py-3 text-left text-xs font-black uppercase text-slate-500 tracking-widest">Class</th>
                  <th className="px-5 py-3 text-left text-xs font-black uppercase text-slate-500 tracking-widest">Section</th>
                  <th className="px-5 py-3 text-left text-xs font-black uppercase text-slate-500 tracking-widest">Period Template</th>
                  <th className="px-5 py-3 text-left text-xs font-black uppercase text-slate-500 tracking-widest">Rows</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classes.map(cls => {
                  const assignedId = assignments[cls.id] || '';
                  const tpl = templates.find(t => t.id === assignedId);
                  const rowCount = tpl ? (allTemplateRows[tpl.id] || []).length : 0;
                  return (
                    <tr key={cls.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-bold text-slate-900 text-sm">{cls.name}</td>
                      <td className="px-5 py-3 text-slate-500 text-sm">{cls.section}</td>
                      <td className="px-5 py-3">
                        <select value={assignedId}
                          onChange={e => setAssignments(prev => ({ ...prev, [cls.id]: e.target.value }))}
                          className="w-64 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none">
                          <option value="">Default (8-period fallback)</option>
                          {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-500">
                        {tpl
                          ? <span className="font-bold text-indigo-600">{rowCount} rows</span>
                          : <span className="italic text-slate-300">Default</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL — Slot Editor (period rows)
      ══════════════════════════════════════════════════════════════════ */}
      {editSlot && createPortal(
        <div className="fixed inset-0 bg-slate-950/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Header */}
            <div className="bg-slate-900 px-6 py-5 flex justify-between items-center">
              <div>
                <h3 className="font-black text-white text-base">{editSlot.row.label}</h3>
                <p className="text-slate-400 text-xs mt-0.5">
                  {editSlot.day} · {classes.find(c => c.id === editSlot.classId)?.name ?? ''} · {editSlot.row.start_time}–{editSlot.row.end_time}
                </p>
              </div>
              <button onClick={() => setEditSlot(null)} className="w-8 h-8 flex items-center justify-center text-white/50 hover:text-white rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Custom start / end (overrides template default) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Start Time</label>
                  <input type="time" value={slotForm.start_time}
                    onChange={e => setSlotForm(p => ({ ...p, start_time: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">End Time</label>
                  <input type="time" value={slotForm.end_time}
                    onChange={e => setSlotForm(p => ({ ...p, end_time: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Subject *</label>
                <select value={slotForm.subject_id}
                  onChange={e => setSlotForm(p => ({ ...p, subject_id: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none">
                  <option value="">— Select subject —</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
                </select>
                {subjects.length === 0 && (
                  <p className="text-xs text-orange-500 mt-1">No subjects found. Add them in Classes → Subject Management first.</p>
                )}
              </div>

              {/* Teacher */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Teacher</label>
                <select value={slotForm.teacher_id}
                  onChange={e => {
                    const tid = e.target.value;
                    setSlotForm(p => ({ ...p, teacher_id: tid }));
                    checkConflict(tid, editSlot.day, editSlot.row.sort_order, editSlot.classId);
                  }}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none">
                  <option value="">— Unassigned —</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name} ({t.role})</option>)}
                </select>

                {/* Conflict warning */}
                {conflictInfo.length > 0 && (
                  <div className={`mt-2 p-3 rounded-xl border ${slotForm.is_combined ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200'}`}>
                    <div className="flex items-start gap-2">
                      <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${slotForm.is_combined ? 'text-amber-500' : 'text-rose-500'}`} />
                      <div className="flex-1">
                        <p className={`text-xs font-bold ${slotForm.is_combined ? 'text-amber-700' : 'text-rose-700'}`}>
                          {slotForm.is_combined
                            ? 'Combined class mode — this teacher is intentionally shared.'
                            : `Teacher already assigned to ${conflictInfo.map(c => `${c.classes?.name}-${c.classes?.section}`).join(', ')} on ${editSlot.day}.`}
                        </p>
                      </div>
                      <label className="flex items-center gap-1.5 cursor-pointer ml-2 shrink-0">
                        <input type="checkbox" checked={slotForm.is_combined}
                          onChange={e => setSlotForm(p => ({ ...p, is_combined: e.target.checked }))}
                          className="rounded accent-amber-500" />
                        <span className="text-[10px] font-bold text-slate-600 whitespace-nowrap">Combined Class</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Teacher daily schedule preview */}
                {slotForm.teacher_id && (
                  <div className="mt-3 p-3 bg-slate-900 rounded-xl">
                    <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-2">Teacher's {editSlot.day} Schedule</p>
                    <div className="flex flex-wrap gap-1.5">
                      {getClassRows(editSlot.classId).filter(r => r.slot_type === 'period').map(r => {
                        const busy = allSchoolSlots.find(s =>
                          s.teacher_id === slotForm.teacher_id &&
                          s.day_of_week === editSlot.day &&
                          s.period_number === r.sort_order
                        );
                        return (
                          <div key={r.id} className={`px-2 py-1 rounded text-[8px] font-bold ${busy ? 'bg-rose-500 text-white' : 'bg-white/10 text-white/30'}`}>
                            {r.label}: {busy ? (busy.classes?.name ?? 'Busy') : 'Free'}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between">
              <button onClick={handleClearSlot} className="px-4 py-2 text-rose-500 font-bold text-sm hover:bg-rose-50 rounded-xl transition">
                Clear Slot
              </button>
              <div className="flex gap-2">
                <button onClick={() => setEditSlot(null)} className="px-4 py-2 text-slate-500 font-bold text-sm hover:bg-slate-100 rounded-xl transition">Cancel</button>
                <button onClick={handleSaveSlot} disabled={saving}
                  className="px-5 py-2 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 shadow">
                  <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Slot'}
                </button>
              </div>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL — Break / Assembly Time Editor
      ══════════════════════════════════════════════════════════════════ */}
      {editBreakRow && createPortal(
        <div className="fixed inset-0 bg-slate-950/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className={`px-6 py-5 flex justify-between items-center ${editBreakRow.slot_type === 'break' ? 'bg-amber-500' : 'bg-indigo-600'}`}>
              <div>
                <h3 className="font-black text-white text-base">
                  {editBreakRow.slot_type === 'break' ? '☕ Edit Break Timing' : '🎒 Edit Assembly Timing'}
                </h3>
                <p className="text-white/70 text-xs mt-0.5">Changes apply to all classes using this template</p>
              </div>
              <button onClick={() => setEditBreakRow(null)} className="w-8 h-8 flex items-center justify-center text-white/50 hover:text-white rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Label</label>
                <input type="text" value={breakForm.label}
                  onChange={e => setBreakForm(p => ({ ...p, label: e.target.value }))}
                  placeholder="e.g. Short Break, Lunch, Assembly…"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Start Time</label>
                  <input type="time" value={breakForm.start_time}
                    onChange={e => setBreakForm(p => ({ ...p, start_time: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">End Time</label>
                  <input type="time" value={breakForm.end_time}
                    onChange={e => setBreakForm(p => ({ ...p, end_time: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>
              {breakForm.start_time && breakForm.end_time && (
                <p className="text-xs text-center text-slate-400">
                  Duration: <strong>{durMin(breakForm.start_time, breakForm.end_time)} minutes</strong>
                </p>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setEditBreakRow(null)} className="px-4 py-2 text-slate-500 font-bold text-sm hover:bg-slate-100 rounded-xl">Cancel</button>
              <button onClick={handleSaveBreak} disabled={savingBreak}
                className="px-5 py-2 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 shadow">
                <Save className="w-4 h-4" /> {savingBreak ? 'Saving…' : 'Update Timing'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL — Print / Export PDF
      ══════════════════════════════════════════════════════════════════ */}
      {showPrintModal && createPortal(
        <div className="fixed inset-0 bg-slate-950/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

            {/* Header */}
            <div className="bg-slate-900 px-6 py-5 flex justify-between items-center">
              <div>
                <h3 className="font-black text-white text-base flex items-center gap-2">
                  <Printer className="w-4 h-4 text-indigo-400" /> Print / Export PDF
                </h3>
                <p className="text-slate-400 text-xs mt-0.5">Choose a view type then download PDF or open print preview</p>
              </div>
              <button onClick={() => setShowPrintModal(false)} className="w-8 h-8 flex items-center justify-center text-white/50 hover:text-white rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">

              {/* Mode tabs */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Timetable Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: 'class',   label: 'Class-wise',    icon: GraduationCap, desc: 'One class, all days',  color: 'indigo' },
                    { id: 'teacher', label: 'Teacher-wise',  icon: User,          desc: 'One teacher\'s schedule', color: 'emerald' },
                    { id: 'school',  label: 'Whole School',  icon: School,        desc: 'All days, all classes',  color: 'violet' },
                  ] as const).map(m => (
                    <button key={m.id} onClick={() => setPrintMode(m.id)}
                      className={`flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition ${
                        printMode === m.id
                          ? m.color === 'indigo'   ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : m.color === 'emerald'  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          :                          'border-violet-500 bg-violet-50 text-violet-700'
                          : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                      }`}>
                      <m.icon className="w-5 h-5" />
                      <span className="text-xs font-black">{m.label}</span>
                      <span className="text-[9px] leading-tight text-center opacity-70">{m.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Class-wise info */}
              {printMode === 'class' && (
                <div className="flex items-start gap-3 bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                  <GraduationCap className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-indigo-800 mb-1">All classes in one table — A3 landscape</p>
                    <p className="text-xs text-indigo-600 leading-relaxed">
                      Rows = all {classes.length} classes  ·  Columns = all {getSchoolRows().filter(r => r.slot_type === 'period').length} periods<br/>
                      Each cell shows <strong>Subject + Teacher</strong> (Monday reference)
                    </p>
                  </div>
                </div>
              )}

              {/* Teacher-wise info */}
              {printMode === 'teacher' && (
                <div className="flex items-start gap-3 bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                  <User className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-emerald-800 mb-1">All teachers in one table — A3 landscape</p>
                    <p className="text-xs text-emerald-600 leading-relaxed">
                      Rows = all {teachers.length} teachers  ·  Columns = all {getSchoolRows().filter(r => r.slot_type === 'period').length} periods<br/>
                      Each cell shows <strong>Subject + Grade/Class</strong> (Monday reference)
                    </p>
                  </div>
                </div>
              )}

              {/* School info banner */}
              {printMode === 'school' && (
                <div className="flex items-start gap-3 bg-violet-50 rounded-xl p-4 border border-violet-100">
                  <School className="w-5 h-5 text-violet-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-violet-800 mb-1">Master timetable — all {classes.length} classes × all periods</p>
                    <p className="text-xs text-violet-600 leading-relaxed">
                      Rows = periods  ·  Columns = classes  ·  Cell = Subject + Teacher<br/>
                      Timing variations (e.g. Friday) noted as a footnote below the table.
                    </p>
                  </div>
                </div>
              )}

              {/* School branding preview */}
              {schoolInfo?.name && (
                <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
                  {schoolInfo.logo_url && <img src={schoolInfo.logo_url} alt="logo" className="h-8 w-8 object-contain rounded" onError={e => (e.currentTarget.style.display = 'none')} />}
                  <div>
                    <p className="text-xs font-black text-slate-700">{schoolInfo.name}</p>
                    {(schoolInfo.address || schoolInfo.phone) && <p className="text-[10px] text-slate-400">{[schoolInfo.address, schoolInfo.phone].filter(Boolean).join('  ·  ')}</p>}
                  </div>
                  <span className="ml-auto text-[9px] text-slate-400 italic">branding on PDF</span>
                </div>
              )}

              {/* Signature options */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Signature Lines at Bottom</p>
                <div className="flex gap-4 flex-wrap">
                  {([
                    { label: 'Principal',   val: sigPrincipal,   set: setSigPrincipal },
                    { label: 'Coordinator', val: sigCoordinator, set: setSigCoordinator },
                    { label: 'Date',        val: sigDate,        set: setSigDate },
                  ] as const).map(({ label, val, set }) => (
                    <label key={label} className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={val} onChange={e => set(e.target.checked)}
                        className="w-4 h-4 rounded accent-indigo-600" />
                      <span className="text-xs font-semibold text-slate-600">{label}</span>
                    </label>
                  ))}
                </div>
                {(sigPrincipal || sigCoordinator || sigDate) && (
                  <div className="mt-3 flex gap-6 border-t border-slate-200 pt-3">
                    {sigPrincipal   && <div className="flex-1 text-center"><div className="border-t border-slate-400 mb-1 mx-4"/><p className="text-[9px] text-slate-500">Principal</p></div>}
                    {sigCoordinator && <div className="flex-1 text-center"><div className="border-t border-slate-400 mb-1 mx-4"/><p className="text-[9px] text-slate-500">Coordinator</p></div>}
                    {sigDate        && <div className="flex-1 text-center"><div className="border-t border-slate-400 mb-1 mx-4"/><p className="text-[9px] text-slate-500">Date</p></div>}
                  </div>
                )}
              </div>
            </div>

            {/* Footer buttons */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
              <button onClick={() => setShowPrintModal(false)} className="px-4 py-2 text-slate-500 font-bold text-sm hover:bg-slate-100 rounded-xl transition">
                Cancel
              </button>
              <div className="flex gap-2">
                {/* Print preview */}
                <button
                  onClick={handlePrint}
                  disabled={
                    (printMode === 'class' && !printClassId) ||
                    (printMode === 'teacher' && !printTeacherId)
                  }
                  className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 font-bold text-sm rounded-xl hover:bg-slate-100 disabled:opacity-40 transition">
                  <Printer className="w-4 h-4" /> Print Preview
                </button>
                {/* Download PDF */}
                <button
                  onClick={handleGeneratePDF}
                  disabled={
                    generating ||
                    (printMode === 'class' && !printClassId) ||
                    (printMode === 'teacher' && !printTeacherId)
                  }
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-700 disabled:opacity-40 shadow transition">
                  {generating
                    ? <><RefreshCw className="w-4 h-4 animate-spin" /> Generating…</>
                    : <><Download className="w-4 h-4" /> Download PDF</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL — Template Editor (create / edit)
      ══════════════════════════════════════════════════════════════════ */}
      {showTplEditor && createPortal(
        <div className="fixed inset-0 bg-slate-950/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-slate-900 px-6 py-5 flex justify-between items-center shrink-0">
              <h3 className="font-black text-white">{editingTpl ? 'Edit Template' : 'New Period Template'}</h3>
              <button onClick={() => setShowTplEditor(false)} className="w-8 h-8 flex items-center justify-center text-white/50 hover:text-white rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Name + Description */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Template Name *</label>
                  <input type="text" value={tplForm.name}
                    onChange={e => setTplForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Montessori, Grade 1–8…"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Description (optional)</label>
                  <input type="text" value={tplForm.description}
                    onChange={e => setTplForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Brief note…"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>

              {/* Row builder */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Time Slots ({tplRows.length})
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTplRows(p => [...p, { tempId: Date.now(), label: `Period ${p.filter((r: any) => r.slot_type === 'period').length + 1}`, slot_type: 'period', start_time: '', end_time: '' }])}
                      className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-200">
                      + Period
                    </button>
                    <button
                      onClick={() => setTplRows(p => [...p, { tempId: Date.now(), label: 'Short Break', slot_type: 'break', start_time: '', end_time: '' }])}
                      className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold hover:bg-amber-200">
                      + Break
                    </button>
                    <button
                      onClick={() => setTplRows(p => [...p, { tempId: Date.now(), label: 'Assembly', slot_type: 'assembly', start_time: '', end_time: '' }])}
                      className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-xs font-bold hover:bg-purple-200">
                      + Assembly
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {tplRows.map((row: any, idx: number) => (
                    <div key={row.tempId ?? row.id} className={`flex items-center gap-2 p-3 rounded-xl border ${
                      row.slot_type === 'break'    ? 'bg-amber-50 border-amber-200' :
                      row.slot_type === 'assembly' ? 'bg-purple-50 border-purple-200' :
                      'bg-slate-50 border-slate-200'
                    }`}>
                      {/* Reorder */}
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button disabled={idx === 0}
                          onClick={() => { const r = [...tplRows]; [r[idx-1], r[idx]] = [r[idx], r[idx-1]]; setTplRows(r); }}
                          className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-20">
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <button disabled={idx === tplRows.length - 1}
                          onClick={() => { const r = [...tplRows]; [r[idx+1], r[idx]] = [r[idx], r[idx+1]]; setTplRows(r); }}
                          className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-20">
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Type pills */}
                      <div className="flex gap-1 shrink-0">
                        {(['period', 'break', 'assembly'] as const).map(t => (
                          <button key={t}
                            onClick={() => setTplRows(p => p.map((r: any, i: number) => i === idx ? { ...r, slot_type: t } : r))}
                            className={`px-2 py-0.5 rounded text-[9px] font-black capitalize transition ${row.slot_type === t
                              ? t === 'period'   ? 'bg-indigo-600 text-white'
                              : t === 'break'    ? 'bg-amber-500 text-white'
                              :                    'bg-purple-600 text-white'
                              : 'bg-white text-slate-400 hover:text-slate-700'}`}>
                            {t}
                          </button>
                        ))}
                      </div>

                      {/* Label */}
                      <input type="text" value={row.label}
                        onChange={e => setTplRows(p => p.map((r: any, i: number) => i === idx ? { ...r, label: e.target.value } : r))}
                        placeholder="Label…"
                        className="flex-1 min-w-0 bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500" />

                      {/* Start / end */}
                      <input type="time" value={row.start_time}
                        onChange={e => setTplRows(p => p.map((r: any, i: number) => i === idx ? { ...r, start_time: e.target.value } : r))}
                        className="w-24 shrink-0 bg-white px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
                      <span className="text-slate-300 text-xs shrink-0">–</span>
                      <input type="time" value={row.end_time}
                        onChange={e => setTplRows(p => p.map((r: any, i: number) => i === idx ? { ...r, end_time: e.target.value } : r))}
                        className="w-24 shrink-0 bg-white px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500" />

                      {/* Delete */}
                      <button onClick={() => setTplRows(p => p.filter((_: any, i: number) => i !== idx))}
                        className="p-1 text-slate-300 hover:text-rose-500 shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  {tplRows.length === 0 && (
                    <div className="text-center py-10 text-slate-300 text-sm border-2 border-dashed border-slate-200 rounded-xl">
                      Add rows using Period, Break, or Assembly buttons above
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0">
              <button onClick={() => setShowTplEditor(false)} className="px-4 py-2 text-slate-500 font-bold text-sm hover:bg-slate-100 rounded-xl">Cancel</button>
              <button onClick={handleSaveTemplate} disabled={savingTpl}
                className="px-5 py-2 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 shadow">
                <Save className="w-4 h-4" /> {savingTpl ? 'Saving…' : editingTpl ? 'Update Template' : 'Create Template'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
}
