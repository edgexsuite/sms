/**
 * DiarySchedule.tsx
 * Admin page — build the weekly homework diary schedule per class.
 * Teachers see only the scheduled subjects on each day in TeacherDiary.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  CalendarDays, Save, Trash2, Plus, Copy, Printer,
  CheckCircle2, AlertTriangle, RefreshCw, BookOpen, ChevronRight,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MAX_SLOTS = 6;

// ─── Types ────────────────────────────────────────────────────────────────────
interface DaySlots {
  [day: string]: string[]; // subject_ids ordered by slot_order
}

export default function DiarySchedule() {
  const { userRole } = useAuth();
  const sid = userRole?.school_id;

  const [classes,    setClasses]    = useState<any[]>([]);
  const [subjects,   setSubjects]   = useState<any[]>([]);
  const [teachers,   setTeachers]   = useState<any[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);

  const [selectedClass,  setSelectedClass]  = useState('');
  const [schedule,       setSchedule]       = useState<DaySlots>({});
  const [loading,        setLoading]        = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [saved,          setSaved]          = useState(false);

  // Copy-to modal
  const [showCopy,     setShowCopy]     = useState(false);
  const [copyTargets,  setCopyTargets]  = useState<Set<string>>(new Set());
  const [copying,      setCopying]      = useState(false);

  // ─── Fetch master data ───────────────────────────────────────────────────
  useEffect(() => {
    if (!sid) return;
    Promise.all([
      supabase.from('classes').select('id,name,section').eq('school_id', sid).order('name').order('section'),
      supabase.from('schools').select('name,logo_url,address,contact_phone').eq('id', sid).maybeSingle(),
      supabase.from('staff').select('id,full_name').eq('school_id', sid).eq('is_active', true).order('full_name'),
    ]).then(([{ data: cls }, { data: sch }, { data: tchr }]) => {
      if (cls) setClasses(cls);
      if (sch) setSchoolInfo(sch);
      if (tchr) setTeachers(tchr);
    });
  }, [sid]);

  // ─── Fetch subjects for selected class ───────────────────────────────────
  useEffect(() => {
    if (!selectedClass || !sid) { setSubjects([]); setSchedule({}); return; }
    setLoading(true);
    Promise.all([
      supabase.from('subjects').select('id,subject_name').eq('class_id', selectedClass).order('subject_name'),
      supabase.from('diary_schedule').select('day_of_week,subject_id,slot_order')
        .eq('class_id', selectedClass).eq('school_id', sid).order('slot_order'),
    ]).then(([{ data: subs }, { data: existing }]) => {
      if (subs) setSubjects(subs);

      // Build local schedule map from DB rows
      const map: DaySlots = {};
      DAYS.forEach(d => { map[d] = []; });
      (existing || []).forEach((r: any) => {
        if (!map[r.day_of_week]) map[r.day_of_week] = [];
        map[r.day_of_week][r.slot_order - 1] = r.subject_id;
      });
      // Clean up undefined holes
      DAYS.forEach(d => { map[d] = (map[d] || []).filter(Boolean); });
      setSchedule(map);
      setLoading(false);
    });
  }, [selectedClass, sid]);

  // ─── Slot helpers ─────────────────────────────────────────────────────────
  const addSlot = (day: string) => {
    if ((schedule[day] || []).length >= MAX_SLOTS) return;
    setSchedule(prev => ({ ...prev, [day]: [...(prev[day] || []), ''] }));
    setSaved(false);
  };

  const removeSlot = (day: string, idx: number) => {
    setSchedule(prev => {
      const slots = [...(prev[day] || [])];
      slots.splice(idx, 1);
      return { ...prev, [day]: slots };
    });
    setSaved(false);
  };

  const setSlot = (day: string, idx: number, subjectId: string) => {
    setSchedule(prev => {
      const slots = [...(prev[day] || [])];
      slots[idx] = subjectId;
      return { ...prev, [day]: slots };
    });
    setSaved(false);
  };

  // ─── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async (targetClassId?: string) => {
    const classId = targetClassId || selectedClass;
    if (!classId || !sid) return;
    setSaving(true);
    try {
      // Delete existing rows for this class
      await supabase.from('diary_schedule').delete()
        .eq('class_id', classId).eq('school_id', sid);

      // Build insert rows
      const inserts: any[] = [];
      DAYS.forEach(day => {
        (schedule[day] || []).forEach((subId, idx) => {
          if (subId) inserts.push({
            school_id:  sid,
            class_id:   classId,
            day_of_week: day,
            subject_id: subId,
            slot_order: idx + 1,
          });
        });
      });

      if (inserts.length > 0) {
        const { error } = await supabase.from('diary_schedule').insert(inserts);
        if (error) throw error;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) { alert(err.message); }
    setSaving(false);
  };

  // ─── Copy to other classes ────────────────────────────────────────────────
  const handleCopy = async () => {
    if (copyTargets.size === 0) return;
    setCopying(true);
    for (const cid of copyTargets) {
      await handleSave(cid);
    }
    setCopying(false);
    setCopyTargets(new Set());
    setShowCopy(false);
  };

  // ─── Subject name helper ──────────────────────────────────────────────────
  const subjectName = (id: string) =>
    subjects.find(s => s.id === id)?.subject_name || '—';

  // ─── Subject coverage counts ──────────────────────────────────────────────
  const coverageCounts = useCallback(() => {
    const counts: Record<string, number> = {};
    DAYS.forEach(d => {
      (schedule[d] || []).forEach(id => {
        if (id) counts[id] = (counts[id] || 0) + 1;
      });
    });
    return counts;
  }, [schedule]);

  // ─── PDF Print ────────────────────────────────────────────────────────────
  const handlePrint = () => {
    if (!selectedClass) return;
    const cls = classes.find(c => c.id === selectedClass);
    const clsName = cls ? `${cls.name}${cls.section ? ' ' + cls.section : ''}` : 'Class';
    const counts = coverageCounts();

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();

    // ── Header ──
    let y = 14;
    if (schoolInfo?.logo_url) {
      try {
        doc.addImage(schoolInfo.logo_url, 'JPEG', 14, y, 22, 22);
      } catch (_) { /* skip if image fails */ }
    }
    doc.setFontSize(16).setFont('helvetica', 'bold').setTextColor(26, 54, 93);
    doc.text((schoolInfo?.name || 'School').toUpperCase(), pageW / 2, y + 6, { align: 'center' });
    doc.setFontSize(10).setFont('helvetica', 'italic').setTextColor(100, 100, 100);
    doc.text('Weekly Homework Diary Schedule', pageW / 2, y + 13, { align: 'center' });
    doc.setDrawColor(26, 54, 93);
    doc.setLineWidth(0.5);
    doc.line(14, y + 18, pageW - 14, y + 18);
    y += 26;

    // ── Class title ──
    doc.setFillColor(26, 54, 93);
    doc.roundedRect(14, y, pageW - 28, 10, 2, 2, 'F');
    doc.setFontSize(12).setFont('helvetica', 'bold').setTextColor(255, 255, 255);
    doc.text(`${clsName} — Weekly Diary Schedule`, pageW / 2, y + 7, { align: 'center' });
    y += 16;

    // ── Find max columns ──
    const maxCols = Math.max(...DAYS.map(d => (schedule[d] || []).filter(Boolean).length), 1);
    const hwHeaders = Array.from({ length: maxCols }, (_, i) => `HW ${i + 1}`);

    const tableBody = DAYS.map(day => {
      const slots = (schedule[day] || []).filter(Boolean);
      const row: any[] = [{ content: day, styles: { fontStyle: 'bold', fillColor: [240, 244, 255], textColor: [26, 54, 93] } }];
      for (let i = 0; i < maxCols; i++) {
        row.push(slots[i] ? subjectName(slots[i]) : '');
      }
      return row;
    });

    autoTable(doc, {
      startY: y,
      head: [['Day', ...hwHeaders]],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [26, 54, 93], textColor: 255, fontStyle: 'bold', fontSize: 10 },
      styles: { fontSize: 10, cellPadding: 3, valign: 'middle' },
      columnStyles: { 0: { cellWidth: 28, fontStyle: 'bold' } },
    });

    // ── Coverage summary ──
    const coverageY = (doc as any).lastAutoTable.finalY + 6;
    const entries = Object.entries(counts).filter(([id]) => id);
    if (entries.length > 0) {
      const summaryText = entries
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .map(([id, n]) => `${subjectName(id)} ×${n}`)
        .join(' · ');
      doc.setFontSize(8).setFont('helvetica', 'italic').setTextColor(120, 120, 120);
      doc.text(`Subject Coverage: ${summaryText}`, 14, coverageY);
    }

    // ── Footer motto ──
    const mottoY = doc.internal.pageSize.getHeight() - 12;
    doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(26, 54, 93);
    doc.text('LEARN. LEAD. ACHIEVE.', pageW / 2, mottoY, { align: 'center' });

    doc.save(`diary-schedule-${clsName.replace(/\s+/g, '-')}.pdf`);
  };

  // ─── Totals ───────────────────────────────────────────────────────────────
  const totalSlots = DAYS.reduce((acc, d) => acc + (schedule[d] || []).filter(Boolean).length, 0);
  const cls = classes.find(c => c.id === selectedClass);

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-indigo-600" />
            Diary Schedule
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Define which subjects are assigned for homework on each day of the week per class.
            Teachers will only see scheduled subjects when filling in the diary.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selectedClass && (
            <>
              <button
                onClick={() => { setShowCopy(true); setCopyTargets(new Set()); }}
                className="flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition"
              >
                <Copy className="w-4 h-4" /> Copy to Classes
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-bold hover:bg-indigo-100 transition"
              >
                <Printer className="w-4 h-4" /> Print PDF
              </button>
              <button
                onClick={() => handleSave()}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-black shadow transition disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Schedule'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Class Picker ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Select Class</label>
            <select
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="">Choose a class…</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.section ? ` — ${c.section}` : ''}</option>
              ))}
            </select>
          </div>
          {selectedClass && (
            <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 px-4 py-2.5 rounded-xl">
              <BookOpen className="w-5 h-5 text-indigo-500 shrink-0" />
              <div>
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Schedule Status</p>
                <p className="text-xs font-black text-indigo-900">
                  {totalSlots > 0 ? `${totalSlots} homework slots across the week` : 'No schedule yet — add subjects below'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Schedule Grid ───────────────────────────────────────────────── */}
      {selectedClass && !loading && (
        <div className="space-y-3">
          {subjects.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              <p className="text-sm text-amber-700 font-medium">
                No subjects found for this class. <a href="/classes" className="underline font-bold">Add subjects</a> in the Classes module first.
              </p>
            </div>
          ) : (
            DAYS.map(day => {
              const slots = schedule[day] || [];
              const canAdd = slots.length < MAX_SLOTS;
              return (
                <div key={day} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 bg-slate-900">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">{day}</h3>
                    <span className="text-[10px] font-bold text-slate-400">
                      {slots.filter(Boolean).length} homework slot{slots.filter(Boolean).length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="p-4">
                    {slots.length === 0 ? (
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-300 italic">No homework scheduled — click + to add</p>
                        <button
                          onClick={() => addSlot(day)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Slot
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-3">
                        {slots.map((subId, idx) => (
                          <div key={idx} className="flex items-center gap-1.5">
                            <span className="flex items-center justify-center w-6 h-6 bg-indigo-100 text-indigo-700 text-[10px] font-black rounded-full shrink-0">
                              {idx + 1}
                            </span>
                            <select
                              value={subId}
                              onChange={e => setSlot(day, idx, e.target.value)}
                              className={cn(
                                'px-3 py-2 text-sm font-bold border rounded-xl outline-none focus:ring-2 focus:ring-indigo-400 transition min-w-[140px]',
                                subId ? 'bg-white border-slate-200 text-slate-800' : 'bg-amber-50 border-amber-200 text-amber-700'
                              )}
                            >
                              <option value="">Choose subject…</option>
                              {subjects.map(s => (
                                <option key={s.id} value={s.id}>{s.subject_name}</option>
                              ))}
                            </select>
                            {idx > 0 && (
                              <button
                                onClick={() => removeSlot(day, idx)}
                                className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {idx === slots.length - 1 && canAdd && (
                              <button
                                onClick={() => addSlot(day)}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ))}
                        {slots.length > 0 && (
                          <button
                            onClick={() => removeSlot(day, slots.length - 1)}
                            className="ml-auto flex items-center gap-1 px-3 py-1.5 bg-rose-50 text-rose-500 rounded-lg text-xs font-bold hover:bg-rose-100 transition"
                          >
                            <Trash2 className="w-3 h-3" /> Remove Last
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* ── Subject Coverage Summary ──────────────────────────────── */}
          {totalSlots > 0 && (
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Subject Coverage This Week</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(coverageCounts())
                  .sort((a, b) => (b[1] as number) - (a[1] as number))
                  .map(([id, count]) => (
                    <span key={id} className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-full text-xs font-bold text-slate-700 shadow-sm">
                      <BookOpen className="w-3 h-3 text-indigo-400" />
                      {subjectName(id)}
                      <span className="bg-indigo-100 text-indigo-700 text-[9px] font-black px-1.5 py-0.5 rounded-full">×{count}</span>
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin" />
        </div>
      )}

      {!selectedClass && (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <CalendarDays className="w-16 h-16 text-slate-100 mb-4" />
          <p className="text-slate-300 font-bold">Select a class to manage its diary schedule</p>
        </div>
      )}

      {/* ── Copy-to Modal ────────────────────────────────────────────────── */}
      {showCopy && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-black text-slate-900 mb-1">Copy Schedule</h3>
            <p className="text-xs text-slate-500 mb-4">
              Apply <strong>{cls?.name} {cls?.section}</strong>'s schedule to:
            </p>
            <div className="space-y-1 max-h-64 overflow-y-auto mb-4">
              {classes.filter(c => c.id !== selectedClass).map(c => (
                <label key={c.id} className={cn(
                  'flex items-center gap-3 p-2.5 rounded-xl cursor-pointer border transition',
                  copyTargets.has(c.id)
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-800'
                    : 'bg-white border-transparent text-slate-700 hover:bg-slate-50'
                )}>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={copyTargets.has(c.id)}
                    onChange={() => {
                      const s = new Set(copyTargets);
                      s.has(c.id) ? s.delete(c.id) : s.add(c.id);
                      setCopyTargets(s);
                    }}
                  />
                  <div className={cn(
                    'w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0',
                    copyTargets.has(c.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'
                  )}>
                    {copyTargets.has(c.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-sm font-bold">{c.name} {c.section}</span>
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
                onClick={handleCopy}
                disabled={copying || copyTargets.size === 0}
                className="flex-[2] flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-black hover:bg-indigo-700 transition disabled:opacity-50 shadow-lg shadow-indigo-100"
              >
                {copying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                Copy to {copyTargets.size} class{copyTargets.size !== 1 ? 'es' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
