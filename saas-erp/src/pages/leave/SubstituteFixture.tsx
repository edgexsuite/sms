/**
 * SubstituteFixture.tsx
 * Daily fixture sheet: assign substitute teachers for absent staff.
 * - Auto-detects approved leave for selected date
 * - Shows absent teacher's periods, suggests free teachers per period
 * - Saves to substitute_assignments table
 * - Generates printable PDF fixture sheet + WhatsApp share
 */
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  UserX, UserCheck, Calendar, Save, Printer, RefreshCw,
  Plus, X, ChevronDown, AlertTriangle, CheckCircle2,
  MessageSquare, Clock, BookOpen, Users,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface Period {
  period_number: number;
  slot_label: string;
  start_time: string;
  end_time: string;
  class_id: string;
  class_name: string;
  class_section: string;
  subject_id: string;
  subject_name: string;
  substitute_teacher_id: string; // '' = unassigned
  existingId: string | null;
}

interface AbsentEntry {
  teacher_id: string;
  teacher_name: string;
  leave_type: string;
  from_leave: boolean; // true = from leave_applications, false = manually added
  periods: Period[];
  expanded: boolean;
}

export default function SubstituteFixture() {
  const { userRole, user } = useAuth();
  const sid = userRole?.school_id;

  const [date, setDate]           = useState(new Date().toISOString().split('T')[0]);
  const [allStaff, setAllStaff]   = useState<any[]>([]);
  const [allSlots, setAllSlots]   = useState<any[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);

  const [absentList,    setAbsentList]    = useState<AbsentEntry[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);

  // Add manual absent teacher
  const [showAddManual, setShowAddManual] = useState(false);
  const [manualTeacher, setManualTeacher] = useState('');

  // ─── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sid) return;
    Promise.all([
      supabase.from('staff').select('id,full_name,role,department').eq('school_id', sid).eq('is_active', true).eq('is_deleted', false).order('full_name'),
      supabase.from('timetable_slots').select('*, subjects(subject_name), staff(full_name), classes(name,section)').eq('school_id', sid),
      supabase.from('schools').select('name,logo_url,address,contact_phone').eq('id', sid).maybeSingle(),
    ]).then(([{ data: st }, { data: slots }, { data: sch }]) => {
      if (st)    setAllStaff(st);
      if (slots) setAllSlots(slots);
      if (sch)   setSchoolInfo(sch);
    });
  }, [sid]);

  // ─── Load fixture for selected date ───────────────────────────────────────
  const loadFixture = useCallback(async () => {
    if (!sid || !date) return;
    setLoading(true);

    const dayOfWeek = DAYS_EN[new Date(date).getDay()];

    // 1. Fetch approved leaves for this date
    const { data: leaves } = await supabase
      .from('leave_applications')
      .select('staff_id, leave_type, staff(full_name)')
      .eq('school_id', sid)
      .eq('status', 'approved')
      .lte('from_date', date)
      .gte('to_date', date);

    // 2. Fetch existing substitute assignments for this date
    const { data: existing } = await supabase
      .from('substitute_assignments')
      .select('*')
      .eq('school_id', sid)
      .eq('date', date);

    const existingMap = new Map<string, any>();
    (existing || []).forEach(e => {
      existingMap.set(`${e.absent_teacher_id}::${e.period_number}::${e.class_id}`, e);
    });

    // 3. Build absent entries from leaves
    const entries: AbsentEntry[] = [];
    const seenTeachers = new Set<string>();

    for (const lv of (leaves || [])) {
      if (!lv.staff_id || seenTeachers.has(lv.staff_id)) continue;
      seenTeachers.add(lv.staff_id);

      const periods = buildPeriods(lv.staff_id, dayOfWeek, existingMap);
      if (periods.length === 0) continue; // no periods today

      entries.push({
        teacher_id:   lv.staff_id,
        teacher_name: (lv.staff as any)?.full_name || 'Unknown',
        leave_type:   lv.leave_type || 'Leave',
        from_leave:   true,
        periods,
        expanded:     true,
      });
    }

    // 4. Also load manually-added absences already saved
    const manualTeacherIds = (existing || [])
      .map(e => e.absent_teacher_id)
      .filter(id => !seenTeachers.has(id));
    const uniqueManual = [...new Set(manualTeacherIds)];

    for (const tid of uniqueManual) {
      seenTeachers.add(tid);
      const teacher = allStaff.find(s => s.id === tid);
      if (!teacher) continue;
      const periods = buildPeriods(tid, dayOfWeek, existingMap);
      entries.push({
        teacher_id:   tid,
        teacher_name: teacher.full_name,
        leave_type:   'Manual',
        from_leave:   false,
        periods,
        expanded:     true,
      });
    }

    setAbsentList(entries);
    setLoading(false);
  }, [sid, date, allStaff, allSlots]);

  useEffect(() => {
    if (allStaff.length > 0 && allSlots.length > 0) loadFixture();
  }, [loadFixture]);

  // ─── Build periods for a teacher on a given day ────────────────────────────
  const buildPeriods = (
    teacherId: string,
    dayOfWeek: string,
    existingMap: Map<string, any>
  ): Period[] => {
    const teacherSlots = allSlots.filter(
      s => s.teacher_id === teacherId && s.day_of_week === dayOfWeek
    );
    return teacherSlots
      .sort((a, b) => a.period_number - b.period_number)
      .map(s => {
        const key = `${teacherId}::${s.period_number}::${s.class_id}`;
        const saved = existingMap.get(key);
        return {
          period_number:          s.period_number,
          slot_label:             s.slot_label || `Period ${s.period_number}`,
          start_time:             s.start_time || '',
          end_time:               s.end_time   || '',
          class_id:               s.class_id,
          class_name:             s.classes?.name || '',
          class_section:          s.classes?.section || '',
          subject_id:             s.subject_id,
          subject_name:           s.subjects?.subject_name || '',
          substitute_teacher_id:  saved?.substitute_teacher_id || '',
          existingId:             saved?.id || null,
        };
      });
  };

  // ─── Available teachers for a period ──────────────────────────────────────
  const getAvailableTeachers = (absentTeacherId: string, periodNumber: number, dayOfWeek: string) => {
    const busy = new Set(
      allSlots
        .filter(s => s.day_of_week === dayOfWeek && s.period_number === periodNumber && s.teacher_id)
        .map(s => s.teacher_id)
    );
    // Also exclude teachers already assigned as substitutes in other periods this date
    absentList.forEach(a => {
      a.periods.forEach(p => {
        if (p.period_number === periodNumber && p.substitute_teacher_id) {
          busy.add(p.substitute_teacher_id);
        }
      });
    });
    return allStaff.filter(t => t.id !== absentTeacherId && !busy.has(t.id));
  };

  // ─── Update substitute selection ──────────────────────────────────────────
  const setSubstitute = (teacherIdx: number, periodIdx: number, subId: string) => {
    setAbsentList(prev => {
      const next = [...prev];
      next[teacherIdx] = {
        ...next[teacherIdx],
        periods: next[teacherIdx].periods.map((p, i) =>
          i === periodIdx ? { ...p, substitute_teacher_id: subId } : p
        ),
      };
      return next;
    });
    setSaved(false);
  };

  // ─── Toggle expand ────────────────────────────────────────────────────────
  const toggleExpand = (idx: number) => {
    setAbsentList(prev => prev.map((a, i) => i === idx ? { ...a, expanded: !a.expanded } : a));
  };

  // ─── Add manual absent teacher ─────────────────────────────────────────────
  const addManualAbsent = () => {
    if (!manualTeacher) return;
    if (absentList.some(a => a.teacher_id === manualTeacher)) {
      alert('Teacher already in the fixture list.');
      return;
    }
    const teacher = allStaff.find(s => s.id === manualTeacher);
    if (!teacher) return;
    const dayOfWeek = DAYS_EN[new Date(date).getDay()];
    const periods = buildPeriods(manualTeacher, dayOfWeek, new Map());
    setAbsentList(prev => [...prev, {
      teacher_id:   manualTeacher,
      teacher_name: teacher.full_name,
      leave_type:   'Manual',
      from_leave:   false,
      periods,
      expanded:     true,
    }]);
    setManualTeacher('');
    setShowAddManual(false);
    setSaved(false);
  };

  // ─── Remove absent entry ──────────────────────────────────────────────────
  const removeAbsent = (idx: number) => {
    setAbsentList(prev => prev.filter((_, i) => i !== idx));
    setSaved(false);
  };

  // ─── Save all assignments ──────────────────────────────────────────────────
  const handleSave = async () => {
    if (!sid) return;
    setSaving(true);
    try {
      for (const entry of absentList) {
        for (const p of entry.periods) {
          if (!p.substitute_teacher_id) continue;
          const payload = {
            school_id:             sid,
            date,
            absent_teacher_id:     entry.teacher_id,
            substitute_teacher_id: p.substitute_teacher_id,
            class_id:              p.class_id,
            subject_id:            p.subject_id,
            period_number:         p.period_number,
            day_of_week:           DAYS_EN[new Date(date).getDay()],
            slot_label:            p.slot_label,
            start_time:            p.start_time,
            end_time:              p.end_time,
            created_by:            user?.id,
          };
          const { error } = await supabase
            .from('substitute_assignments')
            .upsert([payload], {
              onConflict: 'school_id,date,absent_teacher_id,period_number,class_id',
            });
          if (error) throw error;
        }
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) { alert(err.message); }
    setSaving(false);
  };

  // ─── PDF generation ───────────────────────────────────────────────────────
  const handlePrintPDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 14;

    // Header
    if (schoolInfo?.logo_url) {
      try { doc.addImage(schoolInfo.logo_url, 'JPEG', 14, y, 20, 20); } catch (_) {}
    }
    doc.setFontSize(15).setFont('helvetica', 'bold').setTextColor(26, 54, 93);
    doc.text((schoolInfo?.name || 'School').toUpperCase(), pageW / 2, y + 5, { align: 'center' });
    doc.setFontSize(11).setFont('helvetica', 'bold').setTextColor(60, 60, 60);
    doc.text('DAILY FIXTURE SHEET', pageW / 2, y + 12, { align: 'center' });
    doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(120, 120, 120);
    const dateLabel = new Date(date).toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    doc.text(dateLabel, pageW / 2, y + 18, { align: 'center' });
    doc.setDrawColor(26, 54, 93);
    doc.setLineWidth(0.5);
    doc.line(14, y + 22, pageW - 14, y + 22);
    y += 28;

    if (absentList.length === 0) {
      doc.setFontSize(10).setTextColor(150, 150, 150);
      doc.text('No absences recorded for this date.', pageW / 2, y + 10, { align: 'center' });
    }

    // Build all rows across all absent teachers
    const allRows: any[] = [];
    absentList.forEach(entry => {
      entry.periods.forEach(p => {
        const subTeacher = allStaff.find(s => s.id === p.substitute_teacher_id);
        allRows.push([
          `${p.slot_label}\n${p.start_time}–${p.end_time}`,
          `${p.class_name} ${p.class_section}`,
          p.subject_name,
          entry.teacher_name,
          subTeacher ? subTeacher.full_name : '—',
        ]);
      });
    });

    // Sort by period number (already in order per teacher, but mix across teachers)
    autoTable(doc, {
      startY: y,
      head: [['Period / Time', 'Class', 'Subject', 'Absent Teacher', 'Substitute Teacher']],
      body: allRows,
      theme: 'grid',
      headStyles: { fillColor: [26, 54, 93], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 28 },
        4: { fontStyle: 'bold', textColor: [0, 100, 0] },
      },
    });

    // Signatures
    const sigY = (doc as any).lastAutoTable.finalY + 12;
    doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(80, 80, 80);
    const sigSpacing = (pageW - 28) / 3;
    ['Class Incharge', 'Coordinator', 'Principal'].forEach((label, i) => {
      const x = 14 + i * sigSpacing + sigSpacing / 2;
      doc.line(x - 20, sigY, x + 20, sigY);
      doc.text(label, x, sigY + 5, { align: 'center' });
    });

    doc.save(`fixture-${date}.pdf`);
  };

  // ─── WhatsApp share ───────────────────────────────────────────────────────
  const handleWhatsApp = () => {
    const dateLabel = new Date(date).toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long' });
    let msg = `📋 *DAILY FIXTURE — ${dateLabel}*\n`;
    msg += `_${schoolInfo?.name || 'School'}_\n\n`;

    if (absentList.length === 0) {
      msg += 'No teacher absences today.';
    } else {
      absentList.forEach(entry => {
        msg += `❌ *${entry.teacher_name}* (${entry.leave_type})\n`;
        entry.periods.forEach(p => {
          const sub = allStaff.find(s => s.id === p.substitute_teacher_id);
          msg += `  • ${p.slot_label} | ${p.class_name} ${p.class_section} | ${p.subject_name} → *${sub ? sub.full_name : 'TBD'}*\n`;
        });
        msg += '\n';
      });
    }

    msg += `\n_Please arrange accordingly._`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // ─── Stats ────────────────────────────────────────────────────────────────
  const totalPeriods = absentList.reduce((s, a) => s + a.periods.length, 0);
  const assignedCount = absentList.reduce((s, a) => s + a.periods.filter(p => p.substitute_teacher_id).length, 0);
  const dayLabel = date ? DAYS_EN[new Date(date).getDay()] : '';

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <UserX className="w-6 h-6 text-rose-500" /> Daily Fixture Sheet
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Assign substitute teachers for absent staff. Auto-detects approved leaves.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleWhatsApp}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-bold shadow transition">
            <MessageSquare className="w-4 h-4" /> WhatsApp
          </button>
          <button onClick={handlePrintPDF}
            className="flex items-center gap-2 px-4 py-2 border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-bold hover:bg-indigo-100 transition">
            <Printer className="w-4 h-4" /> Print PDF
          </button>
          <button
            onClick={handleSave}
            disabled={saving || absentList.length === 0}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-black shadow transition disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Fixture'}
          </button>
        </div>
      </div>

      {/* ── Date picker + stats ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-wrap items-center gap-5">
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        {date && (
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl">
            <Calendar className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-black text-slate-700">{dayLabel}</span>
          </div>
        )}
        <div className="flex items-center gap-4 ml-auto flex-wrap">
          <div className="text-center">
            <p className="text-2xl font-black text-rose-600">{absentList.length}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Absent</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-amber-600">{totalPeriods}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Periods</p>
          </div>
          <div className="text-center">
            <p className={`text-2xl font-black ${assignedCount === totalPeriods && totalPeriods > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
              {assignedCount}/{totalPeriods}
            </p>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Assigned</p>
          </div>
        </div>
      </div>

      {/* ── Loading ──────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin" />
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {!loading && absentList.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <CheckCircle2 className="w-14 h-14 text-emerald-200 mb-3" />
          <p className="font-black text-slate-300 text-lg">No approved leaves for this date</p>
          <p className="text-sm text-slate-400 mt-1">Use "Add Absent Teacher" to manually add staff</p>
        </div>
      )}

      {/* ── Absent teacher cards ─────────────────────────────────────────── */}
      {!loading && absentList.map((entry, tIdx) => {
        const dayOfWeek = DAYS_EN[new Date(date).getDay()];
        return (
          <div key={entry.teacher_id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Card header */}
            <div
              className="flex items-center gap-3 px-5 py-4 bg-rose-50 border-b border-rose-100 cursor-pointer"
              onClick={() => toggleExpand(tIdx)}
            >
              <div className="w-9 h-9 bg-rose-500 rounded-full flex items-center justify-center text-white font-black text-sm shrink-0">
                {entry.teacher_name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-slate-900 text-sm">{entry.teacher_name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide ${
                    entry.from_leave ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {entry.leave_type}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">
                    {entry.periods.length} period{entry.periods.length !== 1 ? 's' : ''} today
                  </span>
                  <span className="text-[10px] font-bold text-emerald-600">
                    {entry.periods.filter(p => p.substitute_teacher_id).length} assigned
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={e => { e.stopPropagation(); removeAbsent(tIdx); }}
                  className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-100 rounded-lg transition"
                  title="Remove from fixture"
                >
                  <X className="w-4 h-4" />
                </button>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${entry.expanded ? 'rotate-180' : ''}`} />
              </div>
            </div>

            {/* Periods table */}
            {entry.expanded && (
              <div className="overflow-x-auto">
                {entry.periods.length === 0 ? (
                  <div className="p-8 text-center text-slate-300 font-bold text-sm">
                    No timetable periods found for this teacher on {dayOfWeek}.
                  </div>
                ) : (
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest w-32">Period</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">Class</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">Subject</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">Substitute</th>
                        <th className="px-4 py-2.5 text-center text-[10px] font-black uppercase text-slate-400 tracking-widest w-20">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {entry.periods.map((p, pIdx) => {
                        const available = getAvailableTeachers(entry.teacher_id, p.period_number, dayOfWeek);
                        const sub = allStaff.find(s => s.id === p.substitute_teacher_id);
                        return (
                          <tr key={pIdx} className={cn(
                            'hover:bg-slate-50/50 transition-colors',
                            p.substitute_teacher_id ? 'bg-emerald-50/30' : ''
                          )}>
                            <td className="px-4 py-3">
                              <p className="text-xs font-black text-slate-900">{p.slot_label}</p>
                              {p.start_time && (
                                <p className="text-[10px] text-slate-400 font-bold tabular-nums mt-0.5 flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> {p.start_time}–{p.end_time}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-xs font-bold text-slate-700">{p.class_name} {p.class_section}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-xs font-bold text-slate-700 flex items-center gap-1">
                                <BookOpen className="w-3 h-3 text-indigo-400 shrink-0" />
                                {p.subject_name}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={p.substitute_teacher_id}
                                onChange={e => setSubstitute(tIdx, pIdx, e.target.value)}
                                className={cn(
                                  'w-full text-xs font-bold border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400 transition',
                                  p.substitute_teacher_id
                                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                                    : 'border-amber-200 bg-amber-50 text-amber-700'
                                )}
                              >
                                <option value="">— Assign substitute —</option>
                                {available.length === 0 && (
                                  <option disabled>No free teachers this period</option>
                                )}
                                {available.map(t => (
                                  <option key={t.id} value={t.id}>{t.full_name}</option>
                                ))}
                                {/* If current substitute is already assigned, still show them */}
                                {p.substitute_teacher_id && !available.find(t => t.id === p.substitute_teacher_id) && (
                                  <option value={p.substitute_teacher_id}>
                                    {sub?.full_name || 'Selected'} (busy elsewhere)
                                  </option>
                                )}
                              </select>
                              {available.length === 0 && !p.substitute_teacher_id && (
                                <p className="text-[9px] text-amber-600 font-bold mt-1 flex items-center gap-1">
                                  <AlertTriangle className="w-2.5 h-2.5" /> All teachers busy this period
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {p.substitute_teacher_id ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                              ) : (
                                <AlertTriangle className="w-4 h-4 text-amber-400 mx-auto" />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Add Manual Absent ────────────────────────────────────────────── */}
      {!loading && (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 shadow-sm p-5">
          {!showAddManual ? (
            <button
              onClick={() => setShowAddManual(true)}
              className="w-full flex items-center justify-center gap-2 py-2 text-sm font-bold text-slate-400 hover:text-indigo-600 transition"
            >
              <Plus className="w-4 h-4" /> Add Absent Teacher Manually
            </button>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  Select Absent Teacher
                </label>
                <select
                  value={manualTeacher}
                  onChange={e => setManualTeacher(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Choose teacher…</option>
                  {allStaff
                    .filter(s => !absentList.some(a => a.teacher_id === s.id))
                    .map(s => (
                      <option key={s.id} value={s.id}>{s.full_name}</option>
                    ))}
                </select>
              </div>
              <button
                onClick={addManualAbsent}
                disabled={!manualTeacher}
                className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-black transition disabled:opacity-50 shadow"
              >
                <UserX className="w-4 h-4" /> Add
              </button>
              <button
                onClick={() => { setShowAddManual(false); setManualTeacher(''); }}
                className="px-4 py-2.5 bg-slate-100 text-slate-500 rounded-xl text-sm font-bold hover:bg-slate-200 transition"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
