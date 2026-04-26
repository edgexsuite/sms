import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Clock, Printer, Save, X, PlusCircle, Trash2, BookOpen,
  AlertTriangle, ChevronUp, ChevronDown, Edit2, Coffee,
  Layers, Link2, Users, Plus, Copy, Calendar, Settings,
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

  // ─── Clone day ────────────────────────────────────────────────────────────

  const handleCloneDay = async (from: string, to: string) => {
    if (!confirm(`Overwrite ${to}'s schedule with ${from}'s data?`)) return;
    setLoading(true);
    try {
      const baseQ = supabase.from('timetable_slots');
      const filter = (q: any) => selectedClass ? q.eq('class_id', selectedClass) : q.eq('school_id', sid!);
      const { data: src } = await filter(baseQ.select('*').eq('day_of_week', from));
      await filter(baseQ.delete().eq('day_of_week', to));
      if (src && src.length > 0) {
        const clones = src.map(({ id, created_at, day_of_week, ...rest }: any) => ({ ...rest, day_of_week: to }));
        await supabase.from('timetable_slots').insert(clones);
      }
      fetchSlots(); fetchAll();
    } catch (err: any) { alert(err.message); }
    setLoading(false);
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
        <button onClick={() => window.print()} className="no-print flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow hover:bg-slate-800 transition">
          <Printer className="w-4 h-4" /> Print
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

            {/* Clone day dropdown */}
            <div className="relative group ml-auto no-print">
              <button className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50">
                <Copy className="w-3.5 h-3.5" /> Clone {selectedDay}…
              </button>
              <div className="absolute top-full right-0 mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-100 p-1.5 hidden group-hover:block z-50">
                {DAYS.filter(d => d !== selectedDay).map(d => (
                  <button key={d} onClick={() => handleCloneDay(selectedDay, d)}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg">
                    Clone to {d}
                  </button>
                ))}
              </div>
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
