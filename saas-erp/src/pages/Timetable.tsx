import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
  const [viewMode,         setViewMode]         = useState<'individual' | 'master'>('individual');
  const [matrixTemplateId, setMatrixTemplateId] = useState('');
  const [slots,            setSlots]            = useState<any[]>([]);

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
      ] = await Promise.all([
        supabase.from('classes').select('id, name, section, period_template_id').eq('school_id', sid).order('name').order('section'),
        supabase.from('staff').select('id, full_name, role').eq('school_id', sid).eq('is_active', true).order('full_name'),
        supabase.from('period_templates').select('*').eq('school_id', sid).order('created_at'),
        supabase.from('period_template_rows').select('*').eq('school_id', sid).order('sort_order'),
        supabase.from('timetable_slots').select('*, subjects(subject_name), staff(full_name), classes(name, section)').eq('school_id', sid),
      ]);

      if (cls) {
        setClasses(cls);
        const asgn: Record<string, string> = {};
        cls.forEach((c: any) => { asgn[c.id] = c.period_template_id || ''; });
        setAssignments(asgn);
      }
      if (tchr) setTeachers(tchr);
      if (allSlots) setAllSchoolSlots(allSlots);

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

  const schoolName = () => 'School Timetable'; // replaced below by actual school name if available

  /** Shared PDF header — school name + subtitle + date */
  const pdfHeader = (doc: jsPDF, title: string, subtitle: string) => {
    doc.setFillColor(30, 41, 59);   // slate-900
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(title, 10, 9);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle, 10, 16);
    const d = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    doc.text(`Generated: ${d}`, doc.internal.pageSize.getWidth() - 10, 16, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  };

  /** Timetable PDF — Class-wise (rows = periods, cols = days) */
  const generateClassPDF = (classId: string) => {
    const cls = classes.find(c => c.id === classId);
    if (!cls) return;
    const rows = getClassRows(classId);
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const title = `Class Timetable — ${cls.name} ${cls.section}`;
    const tplName = cls.period_template_id ? (templates.find(t => t.id === cls.period_template_id)?.name ?? 'Custom') : 'Default';
    pdfHeader(doc, title, `Template: ${tplName}  ·  ${rows.filter(r => r.slot_type === 'period').length} periods`);

    const head = [['Period / Time', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']];
    const body: any[] = [];

    rows.forEach(row => {
      if (row.slot_type !== 'period') {
        body.push([{
          content: `${row.slot_type === 'break' ? '☕' : '🎒'}  ${row.label}  (${row.start_time} – ${row.end_time})`,
          colSpan: 7,
          styles: {
            fillColor: row.slot_type === 'break' ? [255, 251, 235] : [238, 242, 255],
            textColor: row.slot_type === 'break' ? [146, 64, 14] : [79, 70, 229],
            fontStyle: 'bold',
            halign: 'center',
            fontSize: 7.5,
          },
        }]);
      } else {
        body.push([
          { content: `${row.label}\n${row.start_time} – ${row.end_time}`, styles: { fontStyle: 'bold', fontSize: 7.5 } },
          ...DAYS.map(day => {
            const slot = findSlot(row, day, classId);
            if (!slot) return { content: '—', styles: { textColor: [200, 200, 200], halign: 'center' } };
            return {
              content: `${slot.subjects?.subject_name || ''}\n${slot.staff?.full_name || 'No teacher'}`,
              styles: { fontSize: 7 },
            };
          }),
        ]);
      }
    });

    autoTable(doc, {
      head,
      body,
      startY: 26,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 28, fontStyle: 'bold', fillColor: [241, 245, 249] },
        1: { cellWidth: 36 }, 2: { cellWidth: 36 }, 3: { cellWidth: 36 },
        4: { cellWidth: 36 }, 5: { cellWidth: 36 }, 6: { cellWidth: 36 },
      },
      styles: { fontSize: 7.5, cellPadding: 3, overflow: 'linebreak', lineColor: [226, 232, 240] },
    });

    doc.save(`Timetable_${cls.name}_${cls.section}.pdf`);
  };

  /** Timetable PDF — Teacher-wise (rows = periods, cols = days, cells = subject + class) */
  const generateTeacherPDF = (teacherId: string) => {
    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher) return;
    const teacherSlots = allSchoolSlots.filter(s => s.teacher_id === teacherId);
    const periodNums = Array.from(new Set([...FALLBACK_ROWS.map(r => r.sort_order), ...teacherSlots.map(s => s.period_number)])).sort((a, b) => a - b);

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    pdfHeader(doc, `Teacher Schedule — ${teacher.full_name}`, `Role: ${teacher.role}  ·  ${teacherSlots.length} assigned periods`);

    const freeSlotsCount = periodNums.length * DAYS.length - teacherSlots.length;
    const head = [['Period / Time', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']];
    const body: any[] = periodNums.map(pn => {
      const ref = FALLBACK_ROWS.find(r => r.sort_order === pn);
      return [
        { content: `Period ${pn}${ref ? `\n${ref.start_time} – ${ref.end_time}` : ''}`, styles: { fontStyle: 'bold', fontSize: 7.5, fillColor: [241, 245, 249] } },
        ...DAYS.map(day => {
          const slot = teacherSlots.find(s => s.day_of_week === day && s.period_number === pn);
          if (!slot) return { content: 'Free', styles: { textColor: [200, 200, 200], halign: 'center', fontSize: 7 } };
          const cls = classes.find(c => c.id === slot.class_id);
          return {
            content: `${slot.subjects?.subject_name || '—'}\n${cls ? `${cls.name} ${cls.section}` : ''}`,
            styles: { fontSize: 7, textColor: slot.is_combined_class ? [146, 64, 14] : [0, 0, 0] },
          };
        }),
      ];
    });

    autoTable(doc, {
      head,
      body,
      startY: 26,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [240, 253, 244] },
      columnStyles: {
        0: { cellWidth: 28, fontStyle: 'bold', fillColor: [241, 245, 249] },
        1: { cellWidth: 36 }, 2: { cellWidth: 36 }, 3: { cellWidth: 36 },
        4: { cellWidth: 36 }, 5: { cellWidth: 36 }, 6: { cellWidth: 36 },
      },
      styles: { fontSize: 7.5, cellPadding: 3, overflow: 'linebreak', lineColor: [226, 232, 240] },
    });

    // Summary footer
    const finalY = (doc as any).lastAutoTable?.finalY ?? 26;
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(`Total assigned: ${teacherSlots.length} periods  |  Free: ${freeSlotsCount} periods`, 10, finalY + 6);

    doc.save(`Schedule_${teacher.full_name.replace(/ /g, '_')}.pdf`);
  };

  /** Timetable PDF — Whole school (rows = periods, cols = all classes) per day */
  const generateSchoolPDF = (day: string) => {
    const daysToGenerate = day === 'all' ? DAYS : [day];
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });

    daysToGenerate.forEach((d, pageIndex) => {
      if (pageIndex > 0) doc.addPage();
      pdfHeader(doc, `School Timetable — ${d}`, `${classes.length} classes  ·  All subjects & teachers`);

      const colW = Math.min(30, (390 - 28) / classes.length);
      const head = [['Period / Time', ...classes.map(c => `${c.name}\n${c.section}`)]];
      const body: any[] = [];

      FALLBACK_ROWS.forEach(row => {
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
        } else {
          body.push([
            { content: `${row.label}\n${row.start_time}–${row.end_time}`, styles: { fontStyle: 'bold', fontSize: 6.5, fillColor: [241, 245, 249] } },
            ...classes.map(cls => {
              const slot = allSchoolSlots.find(s =>
                s.day_of_week === d && s.class_id === cls.id &&
                (s.period_number === row.sort_order || s.template_row_id === row.id)
              );
              if (!slot) return { content: '', styles: { textColor: [220, 220, 220] } };
              return {
                content: `${slot.subjects?.subject_name || '—'}\n${slot.staff?.full_name ? slot.staff.full_name.split(' ').pop() : ''}`,
                styles: { fontSize: 6, textColor: slot.is_combined_class ? [146, 64, 14] : [0, 0, 0] },
              };
            }),
          ]);
        }
      });

      autoTable(doc, {
        head,
        body,
        startY: 26,
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 7, halign: 'center' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 28, fontStyle: 'bold', fillColor: [241, 245, 249] },
          ...Object.fromEntries(classes.map((_, i) => [i + 1, { cellWidth: colW, halign: 'center' }])),
        },
        styles: { fontSize: 6.5, cellPadding: 2, overflow: 'linebreak', lineColor: [226, 232, 240] },
      });
    });

    doc.save(`School_Timetable${day === 'all' ? '_AllDays' : `_${day}`}.pdf`);
  };

  /** Open a printable HTML page in a new window */
  const openPrintWindow = (mode: 'class' | 'teacher' | 'school', id: string, day: string) => {
    const title = mode === 'class'
      ? (() => { const c = classes.find(x => x.id === id); return c ? `${c.name} ${c.section}` : ''; })()
      : mode === 'teacher'
      ? (teachers.find(t => t.id === id)?.full_name ?? '')
      : `All Classes — ${day === 'all' ? 'All Days' : day}`;

    const buildRows = (rows: TemplateRow[], classId?: string, teacherId?: string, schoolDay?: string) =>
      rows.map(row => {
        if (row.slot_type !== 'period') {
          const cols = mode === 'school' ? classes.length : DAYS.length;
          return `<tr class="break-row"><td colspan="${cols + 1}">${row.slot_type === 'break' ? '☕' : '🎒'} ${row.label} &nbsp;(${row.start_time} – ${row.end_time})</td></tr>`;
        }
        const cells = mode === 'class' && classId
          ? DAYS.map(d => {
              const s = findSlot(row, d, classId);
              return `<td>${s ? `<strong>${s.subjects?.subject_name || ''}</strong><br/><span>${s.staff?.full_name || ''}</span>` : '<span class="empty">—</span>'}</td>`;
            }).join('')
          : mode === 'teacher' && teacherId
          ? DAYS.map(d => {
              const s = allSchoolSlots.find(sl => sl.teacher_id === teacherId && sl.day_of_week === d && sl.period_number === row.sort_order);
              if (!s) return `<td><span class="empty">Free</span></td>`;
              const c = classes.find(x => x.id === s.class_id);
              return `<td><strong>${s.subjects?.subject_name || ''}</strong><br/><span>${c ? `${c.name} ${c.section}` : ''}</span></td>`;
            }).join('')
          : mode === 'school' && schoolDay
          ? classes.map(cls => {
              const s = allSchoolSlots.find(sl => sl.day_of_week === schoolDay && sl.class_id === cls.id && sl.period_number === row.sort_order);
              if (!s) return `<td><span class="empty">—</span></td>`;
              return `<td><strong>${s.subjects?.subject_name || ''}</strong><br/><span>${s.staff?.full_name ? s.staff.full_name.split(' ').pop() : ''}</span></td>`;
            }).join('')
          : '';
        return `<tr><td class="period-col"><strong>${row.label}</strong><br/><span>${row.start_time} – ${row.end_time}</span></td>${cells}</tr>`;
      }).join('');

    const colHeaders = mode === 'class' || mode === 'teacher'
      ? DAYS.map(d => `<th>${d}</th>`).join('')
      : classes.map(c => `<th>${c.name}<br/><small>${c.section}</small></th>`).join('');

    const daysToShow = (mode === 'school' && day === 'all') ? DAYS : [mode === 'school' ? day : ''];

    const tables = mode === 'school' && day === 'all'
      ? DAYS.map(d => `
          <h3 style="margin:24px 0 8px; padding:6px 10px; background:#1e293b; color:#fff; border-radius:4px; font-size:13px;">📅 ${d}</h3>
          <table>
            <thead><tr><th>Period / Time</th>${classes.map(c => `<th>${c.name}<br/><small>${c.section}</small></th>`).join('')}</tr></thead>
            <tbody>${buildRows(FALLBACK_ROWS, undefined, undefined, d)}</tbody>
          </table>`).join('')
      : `<table>
          <thead><tr><th>Period / Time</th>${colHeaders}</tr></thead>
          <tbody>${buildRows(
            mode === 'class' && id ? getClassRows(id) : FALLBACK_ROWS,
            mode === 'class' ? id : undefined,
            mode === 'teacher' ? id : undefined,
            mode === 'school' ? day : undefined,
          )}</tbody>
        </table>`;

    const html = `<!DOCTYPE html><html><head><title>${title} — Timetable</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 12px; font-size: 11px; color: #1e293b; }
      .header { background: #1e293b; color: #fff; padding: 12px 16px; border-radius: 6px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; }
      .header h2 { margin: 0; font-size: 15px; } .header p { margin: 3px 0 0; font-size: 10px; opacity: 0.7; }
      .meta { font-size: 9px; opacity: 0.7; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
      th { background: #1e293b; color: #fff; padding: 7px 8px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; }
      td { border: 1px solid #e2e8f0; padding: 5px 7px; vertical-align: top; font-size: 9.5px; }
      td strong { display: block; font-size: 9.5px; }
      td span { font-size: 8.5px; color: #64748b; }
      .period-col { background: #f8fafc; font-size: 9px; white-space: nowrap; min-width: 70px; }
      .break-row td { background: #fefce8; color: #92400e; font-weight: bold; text-align: center; font-size: 9px; padding: 4px; }
      .empty { color: #cbd5e1; }
      tr:nth-child(even) td:not(.break-row td) { background: #f8fafc; }
      @media print { body { padding: 5px; } .no-print { display: none; } @page { margin: 8mm; size: A4 landscape; } }
      .print-btn { margin-bottom: 14px; padding: 8px 18px; background: #4f46e5; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12px; }
    </style></head>
    <body>
    <button class="print-btn no-print" onclick="window.print()">🖨 Print</button>
    <div class="header">
      <div><h2>${title}</h2><p>Timetable</p></div>
      <div class="meta">Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
    </div>
    ${tables}
    </body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  };

  const handleGeneratePDF = () => {
    setGenerating(true);
    try {
      if (printMode === 'class')   generateClassPDF(printClassId);
      if (printMode === 'teacher') generateTeacherPDF(printTeacherId);
      if (printMode === 'school')  generateSchoolPDF(printDay);
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    if (printMode === 'class')   openPrintWindow('class',   printClassId,   printDay);
    if (printMode === 'teacher') openPrintWindow('teacher', printTeacherId, printDay);
    if (printMode === 'school')  openPrintWindow('school',  '',             printDay);
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
        className={`p-1.5 border-r border-slate-50 cursor-pointer ${isHighlight ? 'bg-indigo-50/20' : ''}`}
        onClick={() => openSlotEditor(row, day, classId)}
      >
        {slot ? (
          <div className={`p-2 rounded-xl border-2 min-h-[64px] flex flex-col justify-center relative ${
            isCombined             ? 'bg-amber-50 border-amber-200' :
            conflicts.length > 0  ? 'bg-rose-50 border-rose-200'   :
            'bg-slate-50 border-transparent hover:border-indigo-200 hover:bg-white hover:shadow-sm'
          }`}>
            <p className="text-[11px] font-black text-slate-900 uppercase leading-tight truncate">{slot.subjects?.subject_name}</p>
            <p className="text-[10px] text-slate-400 mt-0.5 italic truncate">{slot.staff?.full_name || 'No teacher'}</p>
            <p className="text-[9px] text-slate-300 mt-0.5 tabular-nums">{slot.start_time} – {slot.end_time}</p>
            {isCombined && (
              <span className="absolute top-1 right-1 bg-amber-400 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full">JOINT</span>
            )}
            {!isCombined && conflicts.length > 0 && (
              <span className="absolute top-1 right-1 bg-rose-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full animate-pulse">CLASH</span>
            )}
          </div>
        ) : (
          <div className="w-full min-h-[64px] border-2 border-dashed border-slate-100 rounded-xl flex items-center justify-center hover:border-indigo-200 hover:bg-indigo-50/20 transition-all group">
            <PlusCircle className="w-4 h-4 text-slate-200 group-hover:text-indigo-400 transition-colors" />
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
            <Clock className="w-7 h-7 text-indigo-600" /> Timetable Manager
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Template-driven scheduling · break & assembly timing · combined class support.</p>
        </div>
        <button onClick={() => { setShowPrintModal(true); setPrintClassId(selectedClass || (classes[0]?.id ?? '')); setPrintTeacherId(teachers[0]?.id ?? ''); setPrintDay(selectedDay); }} className="no-print flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow hover:bg-slate-800 transition">
          <Printer className="w-4 h-4" /> Print / Export PDF
        </button>
      </div>

      {/* ── Tab bar ── */}
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

      {/* ══════════════════════════════════════════════════════════════════
          TAB — GRID
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'grid' && (
        <div className="space-y-4">
          {/* Controls row */}
          <div className="no-print flex flex-wrap items-center gap-3">
            {/* View toggle */}
            <div className="flex bg-white border border-slate-200 rounded-xl p-1 shrink-0">
              <button onClick={() => setViewMode('individual')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition ${viewMode === 'individual' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                Class View
              </button>
              <button onClick={() => setViewMode('master')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition ${viewMode === 'master' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                Master Matrix
              </button>
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
                <div className="absolute top-full right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 z-50 w-64">
                  {/* Panel header */}
                  <div className="mb-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Copy <span className="text-indigo-600">{selectedDay}</span> → select target days
                    </p>
                    {selectedClass && (
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Class: {classes.find(c => c.id === selectedClass)?.name ?? 'selected class'}
                      </p>
                    )}
                  </div>

                  {/* Select all / none */}
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => setCopyTargetDays(new Set(DAYS.filter(d => d !== selectedDay)))}
                      className="text-[10px] font-black text-indigo-600 hover:underline"
                    >
                      Select all
                    </button>
                    <span className="text-slate-200">·</span>
                    <button
                      onClick={() => setCopyTargetDays(new Set())}
                      className="text-[10px] font-black text-slate-400 hover:underline"
                    >
                      Clear
                    </button>
                  </div>

                  {/* Day checkboxes */}
                  <div className="space-y-0.5 mb-4">
                    {DAYS.map(d => {
                      const isSource  = d === selectedDay;
                      const isChecked = copyTargetDays.has(d);
                      return (
                        <label
                          key={d}
                          className={`flex items-center gap-2.5 px-2 py-2 rounded-xl cursor-pointer transition-colors ${
                            isSource
                              ? 'opacity-40 cursor-not-allowed'
                              : isChecked
                              ? 'bg-indigo-50'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={isSource}
                            checked={isChecked}
                            onChange={e => {
                              setCopyTargetDays(prev => {
                                const next = new Set(prev);
                                e.target.checked ? next.add(d) : next.delete(d);
                                return next;
                              });
                            }}
                            className="rounded accent-indigo-600 w-3.5 h-3.5"
                          />
                          <span className={`text-sm font-bold ${isSource ? 'text-slate-400' : isChecked ? 'text-indigo-700' : 'text-slate-700'}`}>
                            {d}
                          </span>
                          {isSource && (
                            <span className="ml-auto text-[9px] text-slate-400 font-bold bg-slate-100 px-1.5 py-0.5 rounded-full">source</span>
                          )}
                        </label>
                      );
                    })}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowCopyPanel(false); setCopyTargetDays(new Set()); }}
                      className="flex-1 px-3 py-2 text-slate-500 font-bold text-xs rounded-xl hover:bg-slate-100 transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCopyToMany}
                      disabled={copyTargetDays.size === 0 || copying}
                      className="flex-1 px-3 py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition flex items-center justify-center gap-1.5"
                    >
                      {copying ? (
                        <><RefreshCw className="w-3 h-3 animate-spin" /> Copying…</>
                      ) : (
                        <><Copy className="w-3 h-3" /> Apply to {copyTargetDays.size || '…'} day{copyTargetDays.size !== 1 ? 's' : ''}</>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
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
                    <Layers className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span className="text-xs font-bold text-indigo-700">{currentTemplateName}</span>
                    <button onClick={() => setActiveTab('assignments')} className="text-[10px] text-indigo-400 hover:text-indigo-700 underline ml-1">Change</button>
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

          {/* ── Master Matrix: rows = periods, cols = all classes ── */}
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
                    { id: 'school',  label: 'Whole School',  icon: School,        desc: 'All classes by day',  color: 'violet' },
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

              {/* Class picker */}
              {printMode === 'class' && (
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Select Class</label>
                  <select value={printClassId} onChange={e => setPrintClassId(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none">
                    <option value="">— Choose class —</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name} — {c.section}</option>)}
                  </select>
                  {printClassId && (
                    <p className="text-xs text-slate-400 mt-2">
                      Generates one A4 landscape page — rows = periods, columns = Mon–Sat
                    </p>
                  )}
                </div>
              )}

              {/* Teacher picker */}
              {printMode === 'teacher' && (
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Select Teacher</label>
                  <select value={printTeacherId} onChange={e => setPrintTeacherId(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none">
                    <option value="">— Choose teacher —</option>
                    {teachers.map(t => {
                      const count = allSchoolSlots.filter(s => s.teacher_id === t.id).length;
                      return <option key={t.id} value={t.id}>{t.full_name} ({count} periods)</option>;
                    })}
                  </select>
                  {printTeacherId && (
                    <p className="text-xs text-slate-400 mt-2">
                      Generates one A4 landscape page — full weekly schedule for this teacher
                    </p>
                  )}
                </div>
              )}

              {/* School day picker */}
              {printMode === 'school' && (
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Day Filter</label>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setPrintDay('all')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${printDay === 'all' ? 'bg-violet-600 text-white border-violet-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                      All Days (6 pages)
                    </button>
                    {DAYS.map(d => (
                      <button key={d} onClick={() => setPrintDay(d)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${printDay === d ? 'bg-violet-600 text-white border-violet-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                        {d.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    {printDay === 'all'
                      ? `Generates A3 landscape PDF — one page per day — ${classes.length} classes across`
                      : `Generates A3 landscape — ${classes.length} classes × periods for ${printDay}`}
                  </p>
                </div>
              )}

              {/* Preview summary */}
              <div className="flex items-start gap-3 bg-slate-50 rounded-xl p-4 border border-slate-200">
                <FileText className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-600">
                  {printMode === 'class' && (printClassId
                    ? (() => { const c = classes.find(x => x.id === printClassId); return c ? <span><strong>{c.name} {c.section}</strong> — 6-day timetable, {getClassRows(printClassId).filter(r => r.slot_type === 'period').length} periods</span> : null; })()
                    : <span className="text-slate-400 italic">Select a class above</span>
                  )}
                  {printMode === 'teacher' && (printTeacherId
                    ? (() => { const t = teachers.find(x => x.id === printTeacherId); const cnt = allSchoolSlots.filter(s => s.teacher_id === printTeacherId).length; return t ? <span><strong>{t.full_name}</strong> — {cnt} assigned periods across the week</span> : null; })()
                    : <span className="text-slate-400 italic">Select a teacher above</span>
                  )}
                  {printMode === 'school' && (
                    <span><strong>Whole School</strong> — {classes.length} classes, {printDay === 'all' ? '6 pages (one per day)' : printDay}</span>
                  )}
                </div>
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
