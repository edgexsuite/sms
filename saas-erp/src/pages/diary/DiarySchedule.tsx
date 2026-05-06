/**
 * DiarySchedule.tsx
 * Admin page — build the weekly homework diary schedule for ALL classes at once.
 * Day tabs across the top; under each day every class shows its subjects as checkboxes.
 * Teachers only see the checked subjects on that day when filling in the diary.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  CalendarDays, Save, CheckCircle2, RefreshCw, BookOpen,
  AlertTriangle, Copy, ChevronRight, Printer, Info,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
type Day = typeof DAYS[number];

// Key format: `classId__day__subjectId`
const makeKey = (classId: string, day: string, subjectId: string) =>
  `${classId}__${day}__${subjectId}`;

export default function DiarySchedule() {
  const { userRole } = useAuth();
  const sid = userRole?.school_id;

  const [classes,       setClasses]       = useState<any[]>([]);
  const [subsByClass,   setSubsByClass]   = useState<Record<string, any[]>>({});
  const [enabled,       setEnabled]       = useState<Record<string, boolean>>({});
  const [original,      setOriginal]      = useState<Record<string, boolean>>({});
  const [schoolInfo,    setSchoolInfo]    = useState<any>(null);
  const [activeDay,     setActiveDay]     = useState<Day>('Monday');
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);

  // Copy-day modal
  const [showCopy,     setShowCopy]     = useState(false);
  const [copyTargets,  setCopyTargets]  = useState<Set<Day>>(new Set());
  const [copying,      setCopying]      = useState(false);

  // ─── Load everything once ─────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (!sid) return;
    setLoading(true);
    try {
      const [
        { data: cls },
        { data: school },
      ] = await Promise.all([
        supabase.from('classes').select('id,name,section').eq('school_id', sid).order('name').order('section'),
        supabase.from('schools').select('name,logo_url,address,contact_phone').eq('id', sid).maybeSingle(),
      ]);

      const classList = cls || [];
      setClasses(classList);
      if (school) setSchoolInfo(school);

      if (classList.length === 0) { setLoading(false); return; }

      const classIds = classList.map((c: any) => c.id);

      const [{ data: subs }, { data: existing }] = await Promise.all([
        supabase.from('subjects').select('id,subject_name,class_id').in('class_id', classIds).order('subject_name'),
        supabase.from('diary_schedule').select('class_id,day_of_week,subject_id').eq('school_id', sid),
      ]);

      // Group subjects by class
      const grouped: Record<string, any[]> = {};
      (subs || []).forEach((s: any) => {
        if (!grouped[s.class_id]) grouped[s.class_id] = [];
        grouped[s.class_id].push(s);
      });
      setSubsByClass(grouped);

      // Build enabled map
      const map: Record<string, boolean> = {};
      (existing || []).forEach((r: any) => {
        map[makeKey(r.class_id, r.day_of_week, r.subject_id)] = true;
      });
      setEnabled(map);
      setOriginal(map);
    } finally {
      setLoading(false);
    }
  }, [sid]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ─── Toggle a single subject checkbox ────────────────────────────────────
  const toggle = (classId: string, day: string, subjectId: string) => {
    const key = makeKey(classId, day, subjectId);
    setEnabled(prev => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  };

  // ─── Select all / Clear all for a class on a day ─────────────────────────
  const setClassDay = (classId: string, day: string, value: boolean) => {
    const subs = subsByClass[classId] || [];
    setEnabled(prev => {
      const next = { ...prev };
      subs.forEach((s: any) => { next[makeKey(classId, day, s.id)] = value; });
      return next;
    });
    setSaved(false);
  };

  // ─── Copy current day's selections to other days ─────────────────────────
  const handleCopyDay = () => {
    if (copyTargets.size === 0) return;
    setCopying(true);
    setEnabled(prev => {
      const next = { ...prev };
      classes.forEach(cls => {
        const subs = subsByClass[cls.id] || [];
        subs.forEach((s: any) => {
          const srcKey = makeKey(cls.id, activeDay, s.id);
          copyTargets.forEach(targetDay => {
            next[makeKey(cls.id, targetDay, s.id)] = !!next[srcKey];
          });
        });
      });
      return next;
    });
    setSaved(false);
    setCopying(false);
    setShowCopy(false);
    setCopyTargets(new Set());
  };

  // ─── Save all to DB ────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!sid) return;
    setSaving(true);
    try {
      // Delete all existing schedule for this school
      await supabase.from('diary_schedule').delete().eq('school_id', sid);

      // Build insert rows from enabled keys
      const inserts: any[] = [];
      Object.entries(enabled).forEach(([key, val]) => {
        if (!val) return;
        const [classId, day, subjectId] = key.split('__');
        // slot_order: index of subject in class subject list
        const subs = subsByClass[classId] || [];
        const slotOrder = subs.findIndex((s: any) => s.id === subjectId) + 1;
        inserts.push({ school_id: sid, class_id: classId, day_of_week: day, subject_id: subjectId, slot_order: slotOrder || 1 });
      });

      if (inserts.length > 0) {
        const { error } = await supabase.from('diary_schedule').insert(inserts);
        if (error) throw error;
      }

      setOriginal({ ...enabled });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) { alert(err.message); }
    setSaving(false);
  };

  // ─── Count helpers ────────────────────────────────────────────────────────
  const countForDay = (day: string) =>
    Object.entries(enabled).filter(([k, v]) => v && k.split('__')[1] === day).length;

  const countForClassDay = (classId: string, day: string) =>
    (subsByClass[classId] || []).filter((s: any) => enabled[makeKey(classId, day, s.id)]).length;

  const hasChanges = Object.keys({ ...enabled, ...original }).some(
    k => !!enabled[k] !== !!original[k]
  );

  // ─── PDF print (all days, all classes) ────────────────────────────────────
  const handlePrint = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 14;

    // Header
    doc.setFontSize(16).setFont('helvetica', 'bold').setTextColor(26, 54, 93);
    doc.text((schoolInfo?.name || 'School').toUpperCase(), pageW / 2, y, { align: 'center' });
    doc.setFontSize(10).setFont('helvetica', 'italic').setTextColor(100, 100, 100);
    doc.text('Weekly Homework Diary Schedule — All Classes', pageW / 2, y + 7, { align: 'center' });
    doc.setDrawColor(26, 54, 93).setLineWidth(0.4).line(14, y + 11, pageW - 14, y + 11);
    y += 16;

    // Table: rows = classes, columns = days, cells = checked subjects
    const classesWithSubs = classes.filter(c => (subsByClass[c.id] || []).length > 0);

    const head = [['Class', ...DAYS]];
    const body = classesWithSubs.map(cls => {
      const clsName = `${cls.name}${cls.section ? ' ' + cls.section : ''}`;
      const subs = subsByClass[cls.id] || [];
      const dayCells = DAYS.map(day => {
        const checked = subs.filter((s: any) => enabled[makeKey(cls.id, day, s.id)]);
        return checked.length > 0 ? checked.map((s: any) => s.subject_name).join('\n') : '—';
      });
      return [clsName, ...dayCells];
    });

    autoTable(doc, {
      startY: y,
      head,
      body,
      theme: 'grid',
      headStyles: { fillColor: [26, 54, 93], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      styles: { fontSize: 8, cellPadding: 2, valign: 'top' },
      columnStyles: { 0: { cellWidth: 28, fontStyle: 'bold', fillColor: [240, 244, 255], textColor: [26, 54, 93] } },
    });

    const mottoY = doc.internal.pageSize.getHeight() - 8;
    doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(26, 54, 93);
    doc.text('LEARN. LEAD. ACHIEVE.', pageW / 2, mottoY, { align: 'center' });

    doc.save(`diary-schedule-all-classes.pdf`);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin" />
      </div>
    );
  }

  const classesWithSubs = classes.filter(c => (subsByClass[c.id] || []).length > 0);
  const classesWithoutSubs = classes.filter(c => !(subsByClass[c.id] || []).length);

  return (
    <div className="max-w-7xl mx-auto space-y-5">

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-indigo-600" />
            Diary Schedule
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Tick which subjects get homework each day. Teachers only see ticked subjects when filling the diary.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { setShowCopy(true); setCopyTargets(new Set()); }}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition"
          >
            <Copy className="w-4 h-4" /> Copy {activeDay} →
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-bold hover:bg-indigo-100 transition"
          >
            <Printer className="w-4 h-4" /> Print PDF
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className={cn(
              "flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-black shadow transition disabled:opacity-50",
              hasChanges ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "bg-slate-100 text-slate-400"
            )}
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save All'}
          </button>
        </div>
      </div>

      {/* ── No classes warning ───────────────────────────────────────────── */}
      {classes.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700 font-medium">No classes found. Add classes in the Classes module first.</p>
        </div>
      )}

      {classesWithoutSubs.length > 0 && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl px-4 py-2.5 flex items-center gap-2 text-xs text-sky-700 font-medium">
          <Info className="w-4 h-4 shrink-0 text-sky-400" />
          {classesWithoutSubs.map(c => `${c.name}${c.section ? ' ' + c.section : ''}`).join(', ')} — no subjects added yet (hidden below)
        </div>
      )}

      {/* ── Day Tabs ─────────────────────────────────────────────────────── */}
      {classesWithSubs.length > 0 && (
        <>
          <div className="flex gap-1.5 flex-wrap bg-white border border-slate-200 rounded-2xl p-2 shadow-sm">
            {DAYS.map(day => {
              const count = countForDay(day);
              return (
                <button
                  key={day}
                  onClick={() => setActiveDay(day)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black transition-all',
                    activeDay === day
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                      : 'text-slate-500 hover:bg-slate-100'
                  )}
                >
                  {day.slice(0, 3)}
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full font-black',
                    activeDay === day
                      ? 'bg-indigo-400 text-white'
                      : count > 0 ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Class Cards Grid ───────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {classesWithSubs.map(cls => {
              const subs = subsByClass[cls.id] || [];
              const checkedCount = countForClassDay(cls.id, activeDay);
              const allChecked = checkedCount === subs.length;
              const someChecked = checkedCount > 0 && !allChecked;

              return (
                <div key={cls.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  {/* Card Header */}
                  <div className={cn(
                    'px-4 py-3 flex items-center justify-between',
                    checkedCount > 0 ? 'bg-indigo-600' : 'bg-slate-700'
                  )}>
                    <div>
                      <p className="text-sm font-black text-white">
                        {cls.name}{cls.section ? ` — ${cls.section}` : ''}
                      </p>
                      <p className="text-[10px] text-white/60">
                        {checkedCount}/{subs.length} subjects on {activeDay.slice(0, 3)}
                      </p>
                    </div>
                    {/* Select All toggle */}
                    <button
                      onClick={() => setClassDay(cls.id, activeDay, !allChecked)}
                      className={cn(
                        'text-[10px] font-black px-2.5 py-1 rounded-lg transition',
                        allChecked
                          ? 'bg-white/20 text-white hover:bg-white/30'
                          : 'bg-white/10 text-white/70 hover:bg-white/20'
                      )}
                      title={allChecked ? 'Clear all' : 'Select all'}
                    >
                      {allChecked ? '✓ All' : someChecked ? '− Some' : '+ All'}
                    </button>
                  </div>

                  {/* Subject Checkboxes */}
                  <div className="p-3 space-y-1">
                    {subs.map((sub: any) => {
                      const key = makeKey(cls.id, activeDay, sub.id);
                      const checked = !!enabled[key];
                      return (
                        <label
                          key={sub.id}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition select-none',
                            checked
                              ? 'bg-indigo-50 border border-indigo-100'
                              : 'hover:bg-slate-50 border border-transparent'
                          )}
                        >
                          {/* Custom checkbox */}
                          <span
                            className={cn(
                              'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                              checked
                                ? 'bg-indigo-600 border-indigo-600'
                                : 'border-slate-300 bg-white'
                            )}
                            onClick={() => toggle(cls.id, activeDay, sub.id)}
                          >
                            {checked && (
                              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </span>
                          <span
                            className={cn(
                              'text-sm font-bold flex-1',
                              checked ? 'text-indigo-800' : 'text-slate-600'
                            )}
                            onClick={() => toggle(cls.id, activeDay, sub.id)}
                          >
                            {sub.subject_name}
                          </span>
                          {checked && (
                            <BookOpen className="w-3 h-3 text-indigo-400 shrink-0" />
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Weekly summary strip ──────────────────────────────────────── */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Weekly Overview — total homework subjects per day</p>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 divide-x divide-slate-100">
              {DAYS.map(day => (
                <button
                  key={day}
                  onClick={() => setActiveDay(day)}
                  className={cn(
                    'py-3 text-center transition',
                    activeDay === day ? 'bg-indigo-50' : 'hover:bg-slate-50'
                  )}
                >
                  <p className={cn('text-[10px] font-black uppercase tracking-widest', activeDay === day ? 'text-indigo-600' : 'text-slate-400')}>{day.slice(0, 3)}</p>
                  <p className={cn('text-xl font-black mt-0.5', activeDay === day ? 'text-indigo-700' : countForDay(day) > 0 ? 'text-slate-700' : 'text-slate-200')}>
                    {countForDay(day)}
                  </p>
                  <p className="text-[9px] text-slate-300 font-medium">subjects</p>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Copy Day Modal ───────────────────────────────────────────────── */}
      {showCopy && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-black text-slate-900 mb-1">Copy {activeDay}'s Schedule</h3>
            <p className="text-xs text-slate-500 mb-4">
              Copy all class selections from <strong>{activeDay}</strong> to:
            </p>
            <div className="space-y-1 mb-4">
              {DAYS.filter(d => d !== activeDay).map(day => (
                <label key={day} className={cn(
                  'flex items-center gap-3 p-2.5 rounded-xl cursor-pointer border transition',
                  copyTargets.has(day)
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-800'
                    : 'bg-white border-transparent text-slate-700 hover:bg-slate-50'
                )}>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={copyTargets.has(day)}
                    onChange={() => {
                      const s = new Set(copyTargets);
                      s.has(day) ? s.delete(day) : s.add(day);
                      setCopyTargets(s);
                    }}
                  />
                  <div className={cn(
                    'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0',
                    copyTargets.has(day) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'
                  )}>
                    {copyTargets.has(day) && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm font-bold">{day}</span>
                  <span className="ml-auto text-[10px] text-slate-400 font-medium">{countForDay(day)} subjects</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowCopy(false); setCopyTargets(new Set()); }}
                className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCopyDay}
                disabled={copyTargets.size === 0 || copying}
                className="flex-[2] flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-black hover:bg-indigo-700 transition disabled:opacity-50 shadow-lg shadow-indigo-100"
              >
                <ChevronRight className="w-4 h-4" />
                Copy to {copyTargets.size} day{copyTargets.size !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
