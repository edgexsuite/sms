/**
 * AutoTimetable.tsx
 * Wizard for auto-generating a conflict-free weekly timetable.
 *
 * Step 1 — Config: pick classes, assign teacher + periods/week per subject
 * Step 2 — Preview: generated grid per class, unplaced list, Regenerate / Apply
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Wand2, ChevronRight, ChevronLeft, RefreshCw, CheckCircle2,
  Save, AlertTriangle, Info, Users, BookOpen, Calendar,
  ArrowLeft, Zap,
} from 'lucide-react';
import { cn } from '../lib/utils';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
type Day = typeof DAYS[number];

interface SubjectConfig {
  subject_id: string;
  subject_name: string;
  teacher_id: string;
  teacher_name: string;
  periods_per_week: number;
}

interface ClassConfig {
  class_id: string;
  class_name: string;
  included: boolean;
  subjects: SubjectConfig[];
}

interface GeneratedSlot {
  class_id: string;
  subject_id: string;
  teacher_id: string;
  teacher_name: string;
  subject_name: string;
  day_of_week: string;
  period_number: number;
}

// ─── Greedy conflict-free generation algorithm ───────────────────────────────
function runGenerate(
  configs: ClassConfig[],
  days: Day[],
  periodsPerDay: number
): { slots: GeneratedSlot[]; unplaced: string[] } {
  // teacherBusy[day][period] = Set of teacher_ids
  const teacherBusy: Record<string, Record<number, Set<string>>> = {};
  // classBusy[day][period] = Set of class_ids already assigned
  const classBusy: Record<string, Record<number, Set<string>>> = {};

  days.forEach(d => {
    teacherBusy[d] = {};
    classBusy[d] = {};
    for (let p = 1; p <= periodsPerDay; p++) {
      teacherBusy[d][p] = new Set();
      classBusy[d][p] = new Set();
    }
  });

  // Build flat list of assignments to place
  type Task = { class_id: string; subject_id: string; teacher_id: string; teacher_name: string; subject_name: string; class_name: string };
  const tasks: Task[] = [];
  configs.filter(c => c.included).forEach(c => {
    c.subjects.forEach(s => {
      if (!s.teacher_id) return;
      for (let i = 0; i < s.periods_per_week; i++) {
        tasks.push({ class_id: c.class_id, subject_id: s.subject_id, teacher_id: s.teacher_id, teacher_name: s.teacher_name, subject_name: s.subject_name, class_name: c.class_name });
      }
    });
  });

  // Shuffle tasks for variety
  for (let i = tasks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tasks[i], tasks[j]] = [tasks[j], tasks[i]];
  }

  // Build all (day, period) combos sorted by day load (prefer less-loaded days for spread)
  const allSlots: Array<{ day: Day; period: number }> = [];
  days.forEach(d => {
    for (let p = 1; p <= periodsPerDay; p++) allSlots.push({ day: d, period: p });
  });

  const slots: GeneratedSlot[] = [];
  const unplaced: string[] = [];

  // Track per-class same-subject-per-day to avoid doubling up
  // sameSubjectDay[classId][day] = Set of subject_ids already placed
  const sameSubjectDay: Record<string, Record<string, Set<string>>> = {};
  configs.forEach(c => {
    sameSubjectDay[c.class_id] = {};
    days.forEach(d => { sameSubjectDay[c.class_id][d] = new Set(); });
  });

  tasks.forEach(task => {
    // Sort slots: prefer days where this class has fewer periods (even spread)
    const classLoadByDay: Record<string, number> = {};
    days.forEach(d => {
      classLoadByDay[d] = slots.filter(s => s.class_id === task.class_id && s.day_of_week === d).length;
    });

    const sortedSlots = [...allSlots].sort((a, b) => {
      // Primary: prefer days with lighter load for this class
      const loadDiff = (classLoadByDay[a.day] || 0) - (classLoadByDay[b.day] || 0);
      if (loadDiff !== 0) return loadDiff;
      // Secondary: prefer days where this subject hasn't appeared yet
      const aHas = sameSubjectDay[task.class_id]?.[a.day]?.has(task.subject_id) ? 1 : 0;
      const bHas = sameSubjectDay[task.class_id]?.[b.day]?.has(task.subject_id) ? 1 : 0;
      if (aHas !== bHas) return aHas - bHas;
      // Tertiary: shuffle within same priority
      return Math.random() - 0.5;
    });

    let placed = false;
    for (const { day, period } of sortedSlots) {
      const classAlreadyHasPeriod = classBusy[day][period].has(task.class_id);
      const teacherBusyHere = teacherBusy[day][period].has(task.teacher_id);
      if (!classAlreadyHasPeriod && !teacherBusyHere) {
        slots.push({
          class_id: task.class_id,
          subject_id: task.subject_id,
          teacher_id: task.teacher_id,
          teacher_name: task.teacher_name,
          subject_name: task.subject_name,
          day_of_week: day,
          period_number: period,
        });
        classBusy[day][period].add(task.class_id);
        teacherBusy[day][period].add(task.teacher_id);
        sameSubjectDay[task.class_id][day].add(task.subject_id);
        placed = true;
        break;
      }
    }
    if (!placed) {
      unplaced.push(`${task.class_name} / ${task.subject_name}`);
    }
  });

  return { slots, unplaced };
}

// ─── Colour palette for subject cells ────────────────────────────────────────
const CELL_COLOURS = [
  'bg-indigo-100 text-indigo-800',
  'bg-emerald-100 text-emerald-800',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-800',
  'bg-sky-100 text-sky-800',
  'bg-violet-100 text-violet-800',
  'bg-orange-100 text-orange-800',
  'bg-teal-100 text-teal-800',
  'bg-pink-100 text-pink-800',
  'bg-lime-100 text-lime-800',
];
const subjectColour = (subjectId: string, subjectMap: string[]) => {
  const idx = subjectMap.indexOf(subjectId);
  return CELL_COLOURS[(idx >= 0 ? idx : 0) % CELL_COLOURS.length];
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AutoTimetable() {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const sid = userRole?.school_id;

  const [step,           setStep]           = useState<'config' | 'preview'>('config');
  const [loading,        setLoading]        = useState(true);
  const [staff,          setStaff]          = useState<any[]>([]);
  const [classConfigs,   setClassConfigs]   = useState<ClassConfig[]>([]);
  const [periodsPerDay,  setPeriodsPerDay]  = useState(6);
  const [selectedDays,   setSelectedDays]   = useState<Set<Day>>(new Set(['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']));
  const [generated,      setGenerated]      = useState<GeneratedSlot[]>([]);
  const [unplaced,       setUnplaced]       = useState<string[]>([]);
  const [saving,         setSaving]         = useState(false);
  const [saved,          setSaved]          = useState(false);
  const [expandedClass,  setExpandedClass]  = useState<string | null>(null);

  // ─── Load classes, subjects, staff ──────────────────────────────────────
  useEffect(() => {
    if (!sid) return;
    (async () => {
      setLoading(true);
      const [
        { data: cls },
        { data: stf },
        { data: existingSlots },
      ] = await Promise.all([
        supabase.from('classes').select('id,name,section').eq('school_id', sid).order('name').order('section'),
        supabase.from('staff').select('id,full_name').eq('school_id', sid).eq('is_active', true).order('full_name'),
        supabase.from('timetable_slots').select('class_id,subject_id,teacher_id,subjects(subject_name)').eq('school_id', sid),
      ]);

      const classList = cls || [];
      const staffList = stf || [];
      setStaff(staffList);

      if (classList.length === 0) { setLoading(false); return; }
      const classIds = classList.map((c: any) => c.id);
      const { data: subs } = await supabase.from('subjects').select('id,subject_name,class_id').in('class_id', classIds).order('subject_name');

      // Group subjects by class
      const subMap: Record<string, any[]> = {};
      (subs || []).forEach((s: any) => {
        if (!subMap[s.class_id]) subMap[s.class_id] = [];
        subMap[s.class_id].push(s);
      });

      // Build teacher lookup from existing slots (teacher → subject)
      const existingTeachers: Record<string, string> = {};
      (existingSlots || []).forEach((slot: any) => {
        if (slot.teacher_id && slot.subject_id) existingTeachers[`${slot.class_id}__${slot.subject_id}`] = slot.teacher_id;
      });

      const configs: ClassConfig[] = classList.map((c: any) => ({
        class_id: c.id,
        class_name: `${c.name}${c.section ? ' ' + c.section : ''}`,
        included: true,
        subjects: (subMap[c.id] || []).map((s: any) => {
          const existingTeacherId = existingTeachers[`${c.id}__${s.id}`] || '';
          const teacherRow = staffList.find((t: any) => t.id === existingTeacherId);
          return {
            subject_id: s.id,
            subject_name: s.subject_name,
            teacher_id: existingTeacherId,
            teacher_name: teacherRow?.full_name || '',
            periods_per_week: 4,
          };
        }),
      }));

      setClassConfigs(configs);
      if (configs.length > 0) setExpandedClass(configs[0].class_id);
      setLoading(false);
    })();
  }, [sid]);

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const toggleDay = (day: Day) => {
    setSelectedDays(prev => {
      const s = new Set(prev);
      if (s.size === 1 && s.has(day)) return s; // keep at least one
      s.has(day) ? s.delete(day) : s.add(day);
      return s;
    });
  };

  const updateSubject = (classId: string, subjectId: string, field: 'teacher_id' | 'periods_per_week', value: string | number) => {
    setClassConfigs(prev => prev.map(c => {
      if (c.class_id !== classId) return c;
      const teacherName = field === 'teacher_id' ? (staff.find(t => t.id === value)?.full_name || '') : undefined;
      return {
        ...c,
        subjects: c.subjects.map(s => {
          if (s.subject_id !== subjectId) return s;
          return { ...s, [field]: value, ...(teacherName !== undefined ? { teacher_name: teacherName } : {}) };
        }),
      };
    }));
  };

  const toggleClass = (classId: string) => {
    setClassConfigs(prev => prev.map(c => c.class_id === classId ? { ...c, included: !c.included } : c));
  };

  // ─── Validation ───────────────────────────────────────────────────────────
  const totalPeriods = periodsPerDay * selectedDays.size;
  const includedConfigs = classConfigs.filter(c => c.included);
  const unassigned = includedConfigs.flatMap(c =>
    c.subjects.filter(s => !s.teacher_id).map(s => `${c.class_name} / ${s.subject_name}`)
  );
  const canGenerate = includedConfigs.length > 0 && unassigned.length === 0;

  // ─── Generate ─────────────────────────────────────────────────────────────
  const handleGenerate = () => {
    const days = DAYS.filter(d => selectedDays.has(d));
    const { slots, unplaced: up } = runGenerate(classConfigs, days, periodsPerDay);
    setGenerated(slots);
    setUnplaced(up);
    setStep('preview');
    setSaved(false);
  };

  // ─── Apply to timetable ───────────────────────────────────────────────────
  const handleApply = async () => {
    if (!sid) return;
    const targetClassIds = [...new Set(generated.map(s => s.class_id))];
    if (!window.confirm(
      `This will overwrite the existing timetable for ${targetClassIds.length} class${targetClassIds.length !== 1 ? 'es' : ''}.\n\nContinue?`
    )) return;

    setSaving(true);
    try {
      // Delete existing slots for these classes
      for (const cid of targetClassIds) {
        await supabase.from('timetable_slots').delete().eq('class_id', cid).eq('school_id', sid);
      }
      // Insert generated slots in batches of 100
      const inserts = generated.map(s => ({
        school_id:    sid,
        class_id:     s.class_id,
        subject_id:   s.subject_id,
        teacher_id:   s.teacher_id,
        day_of_week:  s.day_of_week,
        period_number: s.period_number,
        slot_label:   `Period ${s.period_number}`,
      }));
      for (let i = 0; i < inserts.length; i += 100) {
        const { error } = await supabase.from('timetable_slots').insert(inserts.slice(i, i + 100));
        if (error) throw error;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) { alert(err.message); }
    setSaving(false);
  };

  // ─── Preview grid helpers ─────────────────────────────────────────────────
  const days = DAYS.filter(d => selectedDays.has(d));
  const periods = Array.from({ length: periodsPerDay }, (_, i) => i + 1);

  // Build a per-class subject colour map
  const buildSubjectMap = (classId: string) =>
    classConfigs.find(c => c.class_id === classId)?.subjects.map(s => s.subject_id) || [];

  // ─── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => step === 'preview' ? setStep('config') : navigate('/timetable')}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
          >
            {step === 'preview' ? <ChevronLeft className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <Wand2 className="w-6 h-6 text-indigo-600" />
              Auto Timetable Generator
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {step === 'config'
                ? 'Assign teachers to subjects, set periods per week, then generate.'
                : 'Review the generated timetable. Regenerate for a different arrangement or apply to save.'}
            </p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-2 shadow-sm">
          <div className={cn('flex items-center gap-2 text-xs font-black', step === 'config' ? 'text-indigo-600' : 'text-slate-400')}>
            <span className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[10px]', step === 'config' ? 'bg-indigo-600 text-white' : 'bg-emerald-500 text-white')}>
              {step === 'preview' ? '✓' : '1'}
            </span>
            Configure
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300" />
          <div className={cn('flex items-center gap-2 text-xs font-black', step === 'preview' ? 'text-indigo-600' : 'text-slate-300')}>
            <span className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[10px]', step === 'preview' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-400')}>
              2
            </span>
            Preview & Apply
          </div>
        </div>
      </div>

      {/* ══════════════════════════════ STEP 1: CONFIG ════════════════════ */}
      {step === 'config' && (
        <div className="space-y-4">

          {/* Days & periods row */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex flex-wrap gap-6 items-start">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Teaching Days</p>
              <div className="flex gap-1.5 flex-wrap">
                {DAYS.map(day => (
                  <button
                    key={day}
                    onClick={() => toggleDay(day)}
                    className={cn(
                      'px-3 py-1.5 rounded-xl text-xs font-black transition-all',
                      selectedDays.has(day)
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                    )}
                  >
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Periods per Day</p>
              <div className="flex gap-1.5">
                {[4, 5, 6, 7, 8].map(n => (
                  <button
                    key={n}
                    onClick={() => setPeriodsPerDay(n)}
                    className={cn(
                      'w-9 h-9 rounded-xl text-sm font-black transition-all',
                      periodsPerDay === n
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="ml-auto text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Capacity</p>
              <p className="text-2xl font-black text-slate-900">{totalPeriods}</p>
              <p className="text-[10px] text-slate-400">{selectedDays.size} days × {periodsPerDay} periods</p>
            </div>
          </div>

          {/* Class list */}
          <div className="space-y-3">
            {classConfigs.map(cls => {
              const isExpanded = expandedClass === cls.class_id;
              const missingTeachers = cls.subjects.filter(s => !s.teacher_id).length;
              const totalWeeklyPeriods = cls.subjects.reduce((a, s) => a + (s.teacher_id ? s.periods_per_week : 0), 0);

              return (
                <div key={cls.class_id} className={cn(
                  'bg-white rounded-2xl border shadow-sm overflow-hidden transition-all',
                  cls.included ? 'border-slate-200' : 'border-slate-100 opacity-60'
                )}>
                  {/* Class header */}
                  <div
                    className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-slate-50 transition"
                    onClick={() => setExpandedClass(isExpanded ? null : cls.class_id)}
                  >
                    {/* Include toggle */}
                    <div
                      onClick={e => { e.stopPropagation(); toggleClass(cls.class_id); }}
                      className={cn(
                        'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer',
                        cls.included ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'
                      )}
                    >
                      {cls.included && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-slate-900">{cls.class_name}</p>
                      <p className="text-[10px] text-slate-400">
                        {cls.subjects.length} subjects · {totalWeeklyPeriods} periods/week
                        {missingTeachers > 0 && (
                          <span className="ml-2 text-amber-500 font-bold">⚠ {missingTeachers} unassigned</span>
                        )}
                      </p>
                    </div>

                    <ChevronRight className={cn('w-4 h-4 text-slate-300 transition-transform', isExpanded && 'rotate-90')} />
                  </div>

                  {/* Subject rows */}
                  {isExpanded && cls.included && (
                    <div className="border-t border-slate-100">
                      {cls.subjects.length === 0 ? (
                        <p className="px-5 py-4 text-xs text-slate-400 italic">No subjects added for this class yet.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                              <th className="px-5 py-2 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Subject</th>
                              <th className="px-5 py-2 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Teacher</th>
                              <th className="px-5 py-2 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Periods / Week</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {cls.subjects.map(sub => (
                              <tr key={sub.subject_id} className="hover:bg-slate-50">
                                <td className="px-5 py-3">
                                  <div className="flex items-center gap-2">
                                    <BookOpen className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                                    <span className="font-bold text-slate-800">{sub.subject_name}</span>
                                  </div>
                                </td>
                                <td className="px-5 py-2">
                                  <select
                                    value={sub.teacher_id}
                                    onChange={e => updateSubject(cls.class_id, sub.subject_id, 'teacher_id', e.target.value)}
                                    className={cn(
                                      'px-3 py-1.5 text-xs font-bold border rounded-xl outline-none focus:ring-2 focus:ring-indigo-400 min-w-[180px]',
                                      sub.teacher_id ? 'bg-white border-slate-200 text-slate-800' : 'bg-amber-50 border-amber-200 text-amber-700'
                                    )}
                                  >
                                    <option value="">— Assign teacher —</option>
                                    {staff.map(t => (
                                      <option key={t.id} value={t.id}>{t.full_name}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-5 py-2">
                                  <div className="flex gap-1">
                                    {[1, 2, 3, 4, 5, 6].map(n => (
                                      <button
                                        key={n}
                                        onClick={() => updateSubject(cls.class_id, sub.subject_id, 'periods_per_week', n)}
                                        className={cn(
                                          'w-7 h-7 rounded-lg text-xs font-black transition',
                                          sub.periods_per_week === n
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                        )}
                                      >
                                        {n}
                                      </button>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Validation warnings */}
          {unassigned.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-black text-amber-800">Teachers not assigned for {unassigned.length} subject{unassigned.length !== 1 ? 's' : ''}</p>
                <p className="text-xs text-amber-600 mt-1">{unassigned.slice(0, 5).join(' · ')}{unassigned.length > 5 ? ` · +${unassigned.length - 5} more` : ''}</p>
              </div>
            </div>
          )}

          {/* Generate button */}
          <div className="flex justify-end">
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className={cn(
                'flex items-center gap-2.5 px-7 py-3 rounded-2xl text-sm font-black shadow-lg transition-all',
                canGenerate
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              )}
            >
              <Zap className="w-4 h-4" />
              Generate Timetable
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════ STEP 2: PREVIEW ═══════════════════ */}
      {step === 'preview' && (
        <div className="space-y-4">

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Slots Generated', value: generated.length, color: 'indigo' },
              { label: 'Classes Covered', value: new Set(generated.map(s => s.class_id)).size, color: 'emerald' },
              { label: 'Unplaced', value: unplaced.length, color: unplaced.length > 0 ? 'amber' : 'slate' },
              { label: 'Conflict-Free', value: unplaced.length === 0 ? '✓' : '✗', color: unplaced.length === 0 ? 'emerald' : 'rose' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                <p className={cn(
                  'text-2xl font-black mt-1',
                  color === 'indigo' ? 'text-indigo-600' :
                  color === 'emerald' ? 'text-emerald-600' :
                  color === 'amber' ? 'text-amber-600' :
                  color === 'rose' ? 'text-rose-600' : 'text-slate-500'
                )}>
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* Unplaced warning */}
          {unplaced.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <p className="text-sm font-black text-amber-800">{unplaced.length} assignment{unplaced.length !== 1 ? 's' : ''} could not be placed</p>
              </div>
              <p className="text-xs text-amber-600">{unplaced.join(' · ')}</p>
              <p className="text-xs text-amber-500 mt-2 italic">
                Reduce periods per week, add more days, or increase periods per day — then regenerate.
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 justify-between items-center bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <button
              onClick={() => setStep('config')}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition"
            >
              <ChevronLeft className="w-4 h-4" /> Back to Config
            </button>
            <div className="flex gap-3">
              <button
                onClick={handleGenerate}
                className="flex items-center gap-2 px-4 py-2 border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-bold hover:bg-indigo-100 transition"
              >
                <RefreshCw className="w-4 h-4" /> Regenerate
              </button>
              <button
                onClick={handleApply}
                disabled={saving || generated.length === 0}
                className={cn(
                  'flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-black shadow transition disabled:opacity-50',
                  saved ? 'bg-emerald-500 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100'
                )}
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving…' : saved ? 'Applied!' : 'Apply to Timetable'}
              </button>
            </div>
          </div>

          {/* Per-class grids */}
          {includedConfigs.map(cls => {
            const clsSlots = generated.filter(s => s.class_id === cls.class_id);
            if (clsSlots.length === 0) return null;
            const subjectIds = buildSubjectMap(cls.class_id);

            // slot lookup: day+period → slot
            const slotMap: Record<string, GeneratedSlot> = {};
            clsSlots.forEach(s => { slotMap[`${s.day_of_week}__${s.period_number}`] = s; });

            return (
              <div key={cls.class_id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-slate-800 flex items-center justify-between">
                  <p className="text-sm font-black text-white">{cls.class_name}</p>
                  <p className="text-[10px] text-slate-400">{clsSlots.length} periods/week</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse min-w-[500px]">
                    <thead>
                      <tr>
                        <th className="w-16 px-3 py-2 bg-slate-50 text-[10px] font-black text-slate-400 uppercase text-left border-b border-r border-slate-100">Period</th>
                        {days.map(day => (
                          <th key={day} className="px-3 py-2 bg-slate-50 text-[10px] font-black text-slate-500 uppercase border-b border-r border-slate-100 last:border-r-0">
                            {day.slice(0, 3)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {periods.map(p => (
                        <tr key={p} className="border-b border-slate-50 last:border-b-0">
                          <td className="px-3 py-2 font-black text-slate-400 border-r border-slate-100 text-center">{p}</td>
                          {days.map(day => {
                            const slot = slotMap[`${day}__${p}`];
                            return (
                              <td key={day} className="px-2 py-1.5 border-r border-slate-50 last:border-r-0">
                                {slot ? (
                                  <div className={cn('px-2 py-1 rounded-lg text-[10px] font-black', subjectColour(slot.subject_id, subjectIds))}>
                                    <div>{slot.subject_name}</div>
                                    <div className="font-medium opacity-70 truncate max-w-[80px]">{slot.teacher_name}</div>
                                  </div>
                                ) : (
                                  <div className="h-8 rounded-lg bg-slate-50 border border-dashed border-slate-100" />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
