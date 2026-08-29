import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Users, UserX, Calendar, Clock, CheckCircle2, AlertTriangle,
  Printer, Download, Save, RefreshCw, Sparkles, Send,
  BookOpen, ChevronRight, UserCheck, AlertCircle, Shield,
  Layers, Check, MessageSquare
} from 'lucide-react';
import { formatDate, formatDateTime, cn, getBase64Image } from '../../lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PageHeader, Card, Btn, Badge } from '../../components/ui';

interface StaffMember {
  id: string;
  full_name: string;
  whatsapp_number?: string;
  mobile_number?: string;
  role: string;
  is_absent?: boolean;
}

interface VacantSlot {
  id: string; // unique slot identifier
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_name: string;
  absent_teacher_id: string;
  absent_teacher_name: string;
  sort_order: number;
  period_label: string;
  start_time: string;
  end_time: string;
  assigned_substitute_id?: string;
  assigned_substitute_name?: string;
  remarks?: string;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function TeacherSubstitution() {
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [allStaff, setAllStaff] = useState<StaffMember[]>([]);
  const [absentStaffIds, setAbsentStaffIds] = useState<Set<string>>(new Set());
  const [schoolInfo, setSchoolInfo] = useState<any>(null);

  const [allSlotsToday, setAllSlotsToday] = useState<any[]>([]);
  const [vacantSlots, setVacantSlots] = useState<VacantSlot[]>([]);

  const dayOfWeek = useMemo(() => {
    const d = new Date(date);
    return DAYS[d.getDay()];
  }, [date]);

  // ─── 1. Load Initial Data ──────────────────────────────────────────────────
  const loadInitialData = useCallback(async () => {
    if (!userRole?.school_id) return;
    setLoading(true);

    try {
      const [
        { data: staffData },
        { data: schData },
        { data: attData }
      ] = await Promise.all([
        supabase.from('staff').select('id, full_name, mobile_number, whatsapp_number, role').eq('school_id', userRole.school_id).eq('is_deleted', false).order('full_name'),
        supabase.from('schools').select('*').eq('id', userRole.school_id).single(),
        supabase.from('staff_attendance').select('staff_id, status').eq('school_id', userRole.school_id).eq('date', date)
      ]);

      if (staffData) setAllStaff(staffData);
      if (schData) setSchoolInfo(schData);

      // Populate initial absent list from staff_attendance
      const absSet = new Set<string>();
      (attData || []).forEach((a: any) => {
        if (a.status === 'absent' || a.status === 'leave') {
          absSet.add(a.staff_id);
        }
      });
      setAbsentStaffIds(absSet);

      // Load all timetable slots for this day
      const { data: slots } = await supabase
        .from('timetable_slots')
        .select(`
          id,
          class_id,
          classes (name, section),
          subject_id,
          subjects (subject_name),
          teacher_id,
          staff (full_name, whatsapp_number, mobile_number),
          day_of_week,
          period_number,
          start_time,
          end_time
        `)
        .eq('school_id', userRole.school_id)
        .eq('day_of_week', dayOfWeek);

      setAllSlotsToday(slots || []);

    } catch (err) {
      console.error('Error loading substitution data:', err);
    } finally {
      setLoading(false);
    }
  }, [userRole?.school_id, date, dayOfWeek]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // ─── 2. Calculate Vacant Slots & Load Saved Arrangements ────────────────────
  useEffect(() => {
    if (!allSlotsToday || allSlotsToday.length === 0) {
      setVacantSlots([]);
      return;
    }

    const calculateVacancies = async () => {
      // 1. Filter timetable slots belonging to absent teachers
      const vacancies: VacantSlot[] = [];
      allSlotsToday.forEach((slot: any) => {
        if (slot.teacher_id && absentStaffIds.has(slot.teacher_id)) {
          const pNum = slot.period_number || 1;
          const pLabel = slot.start_time && slot.end_time 
            ? `Period ${pNum} (${slot.start_time.slice(0, 5)} - ${slot.end_time.slice(0, 5)})` 
            : `Period ${pNum}`;

          vacancies.push({
            id: `vac_${slot.class_id}_${pNum}_${slot.id}`,
            class_id: slot.class_id,
            class_name: slot.classes ? `${slot.classes.name} ${slot.classes.section || ''}`.trim() : 'Class',
            subject_id: slot.subject_id,
            subject_name: slot.subjects?.subject_name || 'General',
            absent_teacher_id: slot.teacher_id,
            absent_teacher_name: slot.staff?.full_name || 'Teacher',
            sort_order: pNum,
            period_label: pLabel,
            start_time: slot.start_time || '',
            end_time: slot.end_time || '',
            assigned_substitute_id: '',
            assigned_substitute_name: '',
            remarks: '',
          });
        }
      });

      // Sort by period order then class
      vacancies.sort((a, b) => a.sort_order - b.sort_order || a.class_name.localeCompare(b.class_name));

      // 2. Fetch any saved arrangement from form_settings for this date
      try {
        const { data: formRes } = await supabase
          .from('form_settings')
          .select('sections_config')
          .eq('school_id', userRole?.school_id)
          .eq('form_name', `substitution_${date}`)
          .maybeSingle();

        const savedAssignments: Record<string, any> = formRes?.sections_config?.assignments || {};

        vacancies.forEach(v => {
          if (savedAssignments[v.id]) {
            v.assigned_substitute_id = savedAssignments[v.id].substitute_id || '';
            v.assigned_substitute_name = savedAssignments[v.id].substitute_name || '';
            v.remarks = savedAssignments[v.id].remarks || '';
          }
        });
      } catch (e) {}

      setVacantSlots(vacancies);
    };

    calculateVacancies();
  }, [allSlotsToday, absentStaffIds, userRole?.school_id, date]);

  // ─── 3. Find Free Teachers for a Specific Period ───────────────────────────
  const getFreeTeachersForPeriod = useCallback((sortOrder: number) => {
    // A teacher is BUSY if they have a class at this period and are NOT absent
    const busyTeacherIds = new Set<string>();
    allSlotsToday.forEach((s: any) => {
      if (s.sort_order === sortOrder && s.teacher_id) {
        busyTeacherIds.add(s.teacher_id);
      }
    });

    // Free teachers are active staff who are NOT absent and NOT busy in this period
    return allStaff.filter(st => !absentStaffIds.has(st.id) && !busyTeacherIds.has(st.id));
  }, [allSlotsToday, allStaff, absentStaffIds]);

  // ─── 4. Toggle Absent Teacher Manually ─────────────────────────────────────
  const toggleTeacherAbsent = (teacherId: string) => {
    setAbsentStaffIds(prev => {
      const next = new Set(prev);
      if (next.has(teacherId)) next.delete(teacherId);
      else next.add(teacherId);
      return next;
    });
  };

  // ─── 5. Assign Substitute to Slot ──────────────────────────────────────────
  const assignSubstitute = (slotId: string, substituteId: string) => {
    const sub = allStaff.find(s => s.id === substituteId);
    setVacantSlots(prev => prev.map(v => {
      if (v.id === slotId) {
        return {
          ...v,
          assigned_substitute_id: substituteId,
          assigned_substitute_name: sub?.full_name || '',
        };
      }
      return v;
    }));
  };

  // ─── 6. Auto-Assign All Substitutions ──────────────────────────────────────
  const handleAutoAssign = () => {
    const teacherWorkload: Record<string, number> = {};
    allStaff.forEach(s => { teacherWorkload[s.id] = 0; });

    const updated = vacantSlots.map(slot => {
      if (slot.assigned_substitute_id) {
        teacherWorkload[slot.assigned_substitute_id] = (teacherWorkload[slot.assigned_substitute_id] || 0) + 1;
        return slot;
      }

      const freeTeachers = getFreeTeachersForPeriod(slot.sort_order);
      if (freeTeachers.length === 0) return slot;

      // Pick free teacher with lowest assigned substitutions today
      freeTeachers.sort((a, b) => (teacherWorkload[a.id] || 0) - (teacherWorkload[b.id] || 0));
      const chosen = freeTeachers[0];

      teacherWorkload[chosen.id] = (teacherWorkload[chosen.id] || 0) + 1;
      return {
        ...slot,
        assigned_substitute_id: chosen.id,
        assigned_substitute_name: chosen.full_name,
      };
    });

    setVacantSlots(updated);
  };

  // ─── 7. Save Arrangements to Database ─────────────────────────────────────
  const handleSaveArrangements = async () => {
    if (!userRole?.school_id) return;
    setSaving(true);

    try {
      const assignmentsMap: Record<string, any> = {};
      vacantSlots.forEach(v => {
        assignmentsMap[v.id] = {
          class_id: v.class_id,
          class_name: v.class_name,
          subject_name: v.subject_name,
          absent_teacher_id: v.absent_teacher_id,
          absent_teacher_name: v.absent_teacher_name,
          period_label: v.period_label,
          sort_order: v.sort_order,
          substitute_id: v.assigned_substitute_id,
          substitute_name: v.assigned_substitute_name,
          remarks: v.remarks,
        };
      });

      const { error } = await supabase.from('form_settings').upsert({
        school_id: userRole.school_id,
        form_name: `substitution_${date}`,
        sections_config: {
          date,
          day_of_week: dayOfWeek,
          absent_teacher_ids: Array.from(absentStaffIds),
          assignments: assignmentsMap,
          updated_at: new Date().toISOString(),
        }
      }, { onConflict: 'school_id,form_name' });

      if (error) throw error;

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert('Error saving substitution arrangement: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ─── 8. Print Daily Noticeboard Sheet ──────────────────────────────────────
  const handlePDFNoticeboard = async () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pw = doc.internal.pageSize.width;

    if (schoolInfo?.logo_url) {
      try {
        const b64 = await getBase64Image(schoolInfo.logo_url);
        doc.addImage(b64, 'PNG', 14, 8, 18, 18);
      } catch (err) {}
    }

    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text(schoolInfo?.name || 'School Arrangement Sheet', pw / 2, 14, { align: 'center' });

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(schoolInfo?.address || '', pw / 2, 19, { align: 'center' });

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('DAILY TEACHER SUBSTITUTION & ARRANGEMENT SHEET', pw / 2, 26, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${formatDate(date)} (${dayOfWeek}) | Total Vacant Periods: ${vacantSlots.length}`, pw / 2, 31, { align: 'center' });

    doc.setDrawColor(200);
    doc.line(14, 34, pw - 14, 34);

    // Table
    const head = [['#', 'Period / Time', 'Class', 'Subject', 'Absent Teacher', 'Assigned Substitute', 'Teacher Signature']];
    const body = vacantSlots.map((v, i) => [
      i + 1,
      v.period_label,
      v.class_name,
      v.subject_name,
      v.absent_teacher_name,
      v.assigned_substitute_name || 'UNASSIGNED',
      '',
    ]);

    autoTable(doc, {
      startY: 37,
      head: head,
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [13, 21, 38], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 26, fontStyle: 'bold' },
        2: { cellWidth: 24, fontStyle: 'bold' },
        3: { cellWidth: 28 },
        4: { cellWidth: 32, textColor: [220, 38, 38] },
        5: { cellWidth: 38, fontStyle: 'bold', textColor: [16, 185, 129] },
        6: { cellWidth: 26 },
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 14;
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text('_____________________________', 20, finalY);
    doc.text('Academic Coordinator Signature', 20, finalY + 5);

    doc.text('_____________________________', pw - 70, finalY);
    doc.text('Principal / Vice Principal Approval', pw - 70, finalY + 5);

    doc.save(`Substitution_Arrangement_${date}.pdf`);
  };

  // ─── 9. WhatsApp Dispatch Helper ──────────────────────────────────────────
  const sendWhatsAppNotification = (slot: VacantSlot) => {
    const sub = allStaff.find(s => s.id === slot.assigned_substitute_id);
    const phone = sub?.whatsapp_number || sub?.mobile_number;
    if (!sub || !phone) {
      alert('Substitute teacher contact / WhatsApp number is missing in staff profile.');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const msg = encodeURIComponent(
      `Assalam-o-Alaikum Respected ${sub.full_name},\n\nYou have been assigned a *Substitution Period* today (${formatDate(date)}, ${dayOfWeek}):\n\n` +
      `📌 *Class:* ${slot.class_name}\n` +
      `⏰ *Period / Slot:* ${slot.period_label}\n` +
      `📖 *Subject:* ${slot.subject_name}\n` +
      `👤 *Absent Teacher:* ${slot.absent_teacher_name}\n\n` +
      `Please report to the classroom promptly. Thank you.\n_${schoolInfo?.name || 'School Administration'}_`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
  };

  const isAuthorized = userRole?.role && [
    'admin', 'principal', 'director', 'vice_principal', 'campus_coordinator', 'academic_coordinator'
  ].includes(userRole.role);

  if (!isAuthorized) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-3xl border border-slate-200 text-center shadow-lg space-y-4">
        <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
          <Shield className="w-7 h-7" />
        </div>
        <h2 className="text-base font-black text-slate-900 uppercase">Access Restricted</h2>
        <p className="text-xs text-slate-500 font-bold leading-relaxed">
          Teacher Substitution & Period Arrangement is restricted to Academic Coordinators, Campus Coordinators, and School Administration.
        </p>
      </div>
    );
  }

  const assignedCount = vacantSlots.filter(v => v.assigned_substitute_id).length;

  return (
    <div className="max-w-[1600px] mx-auto space-y-4">
      {/* ── Control Header ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm no-print">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              Teacher Substitution & Period Arrangement
              <span className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded-full text-[10px] font-black uppercase">
                {vacantSlots.length} Vacant Periods
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-bold">
              Automatic free-teacher matching and arrangement slips for absent staff
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Btn variant="outline" size="sm" onClick={() => window.print()} className="text-xs h-9 px-3">
            <Printer className="w-4 h-4 mr-1.5" /> Print Sheet
          </Btn>
          <Btn variant="outline" size="sm" onClick={handlePDFNoticeboard} className="text-xs h-9 px-3">
            <Download className="w-4 h-4 mr-1.5" /> Noticeboard PDF
          </Btn>
          <Btn variant="outline" size="sm" onClick={handleAutoAssign} className="text-xs h-9 px-3 font-bold text-indigo-600 bg-indigo-50 border-indigo-200">
            <Sparkles className="w-4 h-4 mr-1.5" /> Auto-Assign All
          </Btn>
          <Btn variant="primary" size="sm" onClick={handleSaveArrangements} disabled={saving} className="text-xs h-9 px-4 font-black shadow-md shadow-indigo-100">
            <Save className="w-4 h-4 mr-1.5" /> {saving ? 'Saving...' : 'Save Arrangement'}
          </Btn>
        </div>
      </div>

      {/* ── Date & Absent Staff Selection Strip ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm no-print items-start">
        
        {/* Date Selector */}
        <div className="lg:col-span-3 space-y-1">
          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
            Arrangement Date
          </label>
          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="bg-transparent text-xs font-black text-slate-900 outline-none w-full"
            />
            <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
              {dayOfWeek}
            </span>
          </div>
        </div>

        {/* Absent Teachers Quick Toggles */}
        <div className="lg:col-span-9 space-y-1">
          <div className="flex items-center justify-between">
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
              Absent Teachers Today ({absentStaffIds.size} Selected):
            </label>
            <span className="text-[9px] font-bold text-slate-400">Click any teacher to mark Absent/Present</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 max-h-24 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-200">
            {allStaff.map(st => {
              const isAbsent = absentStaffIds.has(st.id);
              return (
                <button
                  key={st.id}
                  onClick={() => toggleTeacherAbsent(st.id)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border',
                    isAbsent
                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                  )}
                >
                  {isAbsent ? <UserX className="w-3 h-3" /> : <UserCheck className="w-3 h-3 text-slate-400" />}
                  <span>{st.full_name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Printable Noticeboard Header (Only on Paper Print) ── */}
      <div className="hidden print:flex flex-col items-center justify-center p-6 border-b-2 border-slate-200 mb-6 text-center">
        {schoolInfo?.logo_url && (
          <img src={schoolInfo.logo_url} className="w-16 h-16 object-contain mb-2" alt="Logo" />
        )}
        <h2 className="text-2xl font-black uppercase tracking-widest text-[#0d1526]">{schoolInfo?.name || 'School Arrangement'}</h2>
        <p className="text-xs text-slate-500 font-bold">{schoolInfo?.address || ''}</p>
        <div className="mt-3 px-4 py-1 bg-slate-100 rounded-full border border-slate-300 inline-block">
          <span className="text-xs font-black uppercase text-slate-800">
            Daily Teacher Substitution Sheet · {formatDate(date)} ({dayOfWeek})
          </span>
        </div>
      </div>

      {/* ── Vacant Periods & Substitution Allocation Table ── */}
      <Card className="shadow-sm border-slate-200/80 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-4">Calculating Daily Timetable & Free Teachers...</p>
          </div>
        ) : vacantSlots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3" />
            <h3 className="text-sm font-black text-slate-700 uppercase">All Teachers Present & Classes Covered!</h3>
            <p className="text-xs text-slate-400 mt-1">No absent teachers or vacant slots found for {formatDate(date)} ({dayOfWeek}).</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse min-w-[900px]">
              <thead className="bg-[#0d1526] sticky top-0 z-20 text-white">
                <tr>
                  <th className="px-3 py-3 font-black text-slate-400 uppercase tracking-wider text-[10px] w-10 text-center">#</th>
                  <th className="px-3 py-3 font-black text-slate-300 uppercase tracking-wider text-[10px] w-28">Period / Slot</th>
                  <th className="px-3 py-3 font-black text-slate-300 uppercase tracking-wider text-[10px] w-24">Class</th>
                  <th className="px-3 py-3 font-black text-slate-300 uppercase tracking-wider text-[10px] min-w-[120px]">Subject</th>
                  <th className="px-3 py-3 font-black text-rose-400 uppercase tracking-wider text-[10px] min-w-[140px]">Absent Teacher</th>
                  <th className="px-3 py-3 font-black text-emerald-400 uppercase tracking-wider text-[10px] min-w-[240px]">Assigned Substitute</th>
                  <th className="px-3 py-3 font-black text-slate-400 uppercase tracking-wider text-[10px] w-28 text-center no-print">WhatsApp</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {vacantSlots.map((v, i) => {
                  const freeTeachers = getFreeTeachersForPeriod(v.sort_order);
                  return (
                    <tr key={v.id} className="hover:bg-indigo-50/40 transition-colors even:bg-slate-50/50">
                      <td className="px-3 py-2.5 text-center font-bold text-slate-400 text-[10px]">{i + 1}</td>
                      <td className="px-3 py-2.5 font-bold text-slate-900">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded text-[11px] font-mono font-black">
                          {v.period_label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-black text-indigo-700 uppercase">
                        {v.class_name}
                      </td>
                      <td className="px-3 py-2.5 font-bold text-slate-800">
                        {v.subject_name}
                      </td>
                      <td className="px-3 py-2.5 font-bold text-rose-600 flex items-center gap-1.5">
                        <UserX className="w-3.5 h-3.5 shrink-0" />
                        {v.absent_teacher_name}
                      </td>

                      {/* Free Teacher Dropdown */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <select
                            value={v.assigned_substitute_id || ''}
                            onChange={e => assignSubstitute(v.id, e.target.value)}
                            className={cn(
                              'w-full px-3 py-1.5 text-xs font-bold rounded-xl border outline-none transition-all',
                              v.assigned_substitute_id
                                ? 'bg-emerald-50 text-emerald-900 border-emerald-300 font-black'
                                : 'bg-amber-50 text-amber-900 border-amber-300 font-bold'
                            )}
                          >
                            <option value="">⚠️ Select Free Teacher ({freeTeachers.length} Available)...</option>
                            <optgroup label="Available Free Teachers (No Class at this Period)">
                              {freeTeachers.map(t => (
                                <option key={t.id} value={t.id}>
                                  ✓ {t.full_name} ({t.role})
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="All Other Staff">
                              {allStaff.filter(st => !absentStaffIds.has(st.id) && !freeTeachers.some(f => f.id === st.id)).map(t => (
                                <option key={t.id} value={t.id}>
                                  ⚠️ {t.full_name} (Busy in another class)
                                </option>
                              ))}
                            </optgroup>
                          </select>
                        </div>
                      </td>

                      {/* WhatsApp Notify Button */}
                      <td className="px-3 py-2.5 text-center no-print">
                        {v.assigned_substitute_id ? (
                          <button
                            onClick={() => sendWhatsAppNotification(v)}
                            title="Send WhatsApp Arrangement Alert to Teacher"
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-bold text-[10px] shadow-xs transition-colors"
                          >
                            <Send className="w-3 h-3" /> WhatsApp
                          </button>
                        ) : (
                          <span className="text-slate-300 text-[10px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Printable Teacher Slips Footer (Cut & Distribute to Staff) ── */}
      <div className="hidden print:grid grid-cols-2 gap-4 pt-6">
        {vacantSlots.filter(v => v.assigned_substitute_id).map((v, i) => (
          <div key={v.id} className="p-4 border-2 border-dashed border-slate-400 rounded-xl space-y-2 text-xs">
            <div className="flex justify-between items-center border-b pb-1">
              <span className="font-black uppercase">{schoolInfo?.name || 'School'}</span>
              <span className="font-mono text-[10px]">{formatDate(date)}</span>
            </div>
            <p className="font-black text-sm text-indigo-700">TEACHER SUBSTITUTION SLIP</p>
            <p><strong>Substitute:</strong> {v.assigned_substitute_name}</p>
            <p><strong>Class:</strong> {v.class_name} | <strong>Period:</strong> {v.period_label}</p>
            <p><strong>Subject:</strong> {v.subject_name} (for {v.absent_teacher_name})</p>
            <div className="pt-2 flex justify-between text-[10px] text-slate-500">
              <span>Academic Incharge</span>
              <span>Teacher Sign: ________</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
