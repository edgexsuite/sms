import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  ClipboardList, Save, Calendar, Users, Printer,
  Image as ImageIcon, ChevronLeft, ChevronRight, Languages,
  BookOpen, CheckCircle2, AlertCircle, LayoutGrid,
  Calculator, FlaskConical, PenTool, Book, Globe, Cpu, 
  Palette, Atom, Activity, Rocket, Microscope, Music
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import html2canvas from 'html2canvas';

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
  const { userRole } = useAuth();
  const isTeacher = userRole?.role === 'teacher';
  const isAdmin = !isTeacher;

  const [myStaffId, setMyStaffId] = useState<string | null>(null);
  const [allTeachers, setAllTeachers] = useState<any[]>([]);
  const [allClasses, setAllClasses] = useState<any[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedTeacherName, setSelectedTeacherName] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedClassName, setSelectedClassName] = useState('');
  const [viewMode, setViewMode] = useState<'teacher' | 'class'>('teacher');
  const [assignedSlots, setAssignedSlots] = useState<Slot[]>([]);
  const [viewDate, setViewDate] = useState(new Date().toISOString().split('T')[0]);
  const [rows, setRows] = useState<DiaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [schoolInfo, setSchoolInfo] = useState<{ name: string; address: string; logo_url?: string } | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

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
      .select('name, address, logo_url')
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
      .order('full_name');
    if (data) setAllTeachers(data);
  };

  const fetchAllClasses = async () => {
    const { data } = await supabase
      .from('classes')
      .select('id, name, section')
      .eq('school_id', userRole?.school_id)
      .order('name');
    if (data) setAllClasses(data);
  };

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

    if (data) {
      const seen = new Set<string>();
      const unique: Slot[] = [];
      const cls = allClasses.find(c => c.id === selectedClassId);
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
      unique.sort((a, b) => a.subject_name.localeCompare(b.subject_name));
      setAssignedSlots(unique);
    }
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

    const newRows: DiaryRow[] = assignedSlots.map(slot => {
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
    if (!row.topic_covered.trim()) {
      alert('Topic / Lesson Covered is required before saving.');
      return;
    }
    setRows(prev => prev.map((r, i) => i === index ? { ...r, saving: true } : r));
    try {
      const payload = {
        school_id: userRole?.school_id,
        teacher_id: viewMode === 'teacher' ? selectedTeacherId : row.slot.teacher_id,
        class_id: row.slot.class_id,
        subject_id: row.slot.subject_id,
        diary_date: viewDate,
        topic_covered: row.topic_covered,
        homework: row.homework || null,
        activity_notes: row.activity_notes || null,
        next_plan: row.next_plan || null,
      };
      if (!payload.teacher_id) throw new Error("No teacher assigned to this subject.");
      const { error } = await supabase
        .from('teacher_diary')
        .upsert([payload], { onConflict: 'teacher_id,class_id,subject_id,diary_date' });
      if (error) throw error;
      setRows(prev => prev.map((r, i) => i === index ? { ...r, saving: false, saved: true } : r));
      setTimeout(() => {
        setRows(prev => prev.map((r, i) => i === index ? { ...r, saved: false } : r));
      }, 3000);
    } catch (err: any) {
      alert(err.message);
      setRows(prev => prev.map((r, i) => i === index ? { ...r, saving: false } : r));
    }
  };

  const saveAll = async () => {
    const toSave = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.topic_covered.trim());
    for (const { i } of toSave) {
      await saveRow(i);
    }
  };

  const shiftDate = (days: number) => {
    const d = new Date(viewDate);
    d.setDate(d.getDate() + days);
    setViewDate(d.toISOString().split('T')[0]);
  };

  const handlePrint = () => {
    window.print();
  };


  const formattedDate = new Date(viewDate + 'T00:00:00').toLocaleDateString('en-PK', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  const filledCount = rows.filter(r => r.topic_covered.trim()).length;

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <style>{`
        @media print {
          body { background: white !important; margin: 0 !important; padding: 0 !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; position: static !important; width: 100% !important; left: auto !important; top: auto !important; }
          @page { size: landscape; margin: 10mm; }
          .diary-print-layout { 
            width: 100%; 
            border: 2px solid #1e1b4b; 
            background: #fffdfa !important; 
            min-height: 98vh; 
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .urdu-text { font-family: 'Noto Nastaliq Urdu', serif; direction: rtl; }
        }
        .print-only { display: none; }
      `}</style>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
            {viewMode === 'class' ? 'Class Diary' : 'Teacher Diary'}
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">
            {viewMode === 'class'
              ? `Unified report for Grade ${selectedClassName || 'Selected Class'}.`
              : isTeacher ? 'Fill in your daily lesson plan.' : 'View diary entries by individual teacher.'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto no-print">
          {isAdmin && (
            <div className="bg-slate-100 p-1 rounded-xl flex items-center">
              <button onClick={() => setViewMode('teacher')} className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'teacher' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Teacher</button>
              <button onClick={() => setViewMode('class')} className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'class' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Class</button>
            </div>
          )}
          <button onClick={handlePrint} disabled={(viewMode === 'teacher' ? !selectedTeacherId : !selectedClassId) || rows.length === 0}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-200 transition-all disabled:opacity-40">
            <Printer className="w-4 h-4" /> Print Report
          </button>
        </div>
      </div>

      {/* ── Controls ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 no-print">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {isAdmin && viewMode === 'teacher' && (
            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}>
              <label className="block text-xs font-black text-gray-500 uppercase mb-1.5 flex items-center gap-1"><Users className="w-3 h-3" /> Teacher</label>
              <select value={selectedTeacherId} onChange={e => { const t = allTeachers.find(x => x.id === e.target.value); setSelectedTeacherId(e.target.value); setSelectedTeacherName(t?.full_name || ''); }}
                className="w-full border border-gray-300 px-3 py-2.5 rounded-lg bg-gray-50 text-sm font-medium focus:ring-2 focus:ring-indigo-100 outline-none">
                <option value="">— Select Teacher —</option>
                {allTeachers.map(t => (<option key={t.id} value={t.id}>{t.full_name}</option>))}
              </select>
            </motion.div>
          )}
          {viewMode === 'class' && (
            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}>
              <label className="block text-xs font-black text-gray-500 uppercase mb-1.5 flex items-center gap-1"><BookOpen className="w-3 h-3" /> Class</label>
              <select value={selectedClassId} onChange={e => { const c = allClasses.find(x => x.id === e.target.value); setSelectedClassId(e.target.value); setSelectedClassName(c ? `${c.name} ${c.section}` : ''); }}
                className="w-full border border-gray-300 px-3 py-2.5 rounded-lg bg-gray-50 text-sm font-medium focus:ring-2 focus:ring-indigo-100 outline-none">
                <option value="">— Select Class —</option>
                {allClasses.map(c => (<option key={c.id} value={c.id}>{c.name} {c.section}</option>))}
              </select>
            </motion.div>
          )}
          <div>
            <label className="block text-xs font-black text-gray-500 uppercase mb-1.5 flex items-center gap-1"><Calendar className="w-3 h-3" /> Date</label>
            <div className="flex items-center gap-1">
              <button onClick={() => shiftDate(-1)} className="p-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 shrink-0"><ChevronLeft className="w-4 h-4" /></button>
              <input type="date" value={viewDate} onChange={e => setViewDate(e.target.value)} className="flex-1 border border-gray-300 px-2 py-2 rounded-lg text-sm text-center font-medium min-w-0" />
              <button onClick={() => shiftDate(1)} className="p-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 shrink-0"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="sm:col-span-2 md:col-span-1 flex items-end">
            <button onClick={saveAll} disabled={(viewMode === 'teacher' ? !selectedTeacherId : !selectedClassId) || filledCount === 0}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-lg shadow disabled:opacity-40 transition text-sm">
              <Save className="w-4 h-4" /> Save All ({filledCount} filled)
            </button>
          </div>
        </div>
      </div>

      {/* ── Main diary ─────────────────────────────────────────────────────── */}
      {(viewMode === 'teacher' ? selectedTeacherId : selectedClassId) && (loading ? (
        <div className="bg-white rounded-xl p-10 text-center text-gray-400 border border-gray-200">Loading diary...</div>
      ) : rows.length > 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">

          {/* Mobile: card per subject */}
          <div className="md:hidden space-y-3">
            {rows.map((row, idx) => (
              <DiaryCard key={`card_${row.slot.class_id}_${row.slot.subject_id}`} row={row} index={idx} viewMode={viewMode} onUpdate={updateRow} onSave={saveRow} />
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b-2 border-slate-200">
                    <th className="text-left px-4 py-3 text-xs font-black text-slate-600 uppercase tracking-wide w-[100px]">{viewMode === 'class' ? 'Subject' : 'Class'}</th>
                    <th className="text-left px-4 py-3 text-xs font-black text-slate-600 uppercase tracking-wide w-[110px]">{viewMode === 'class' ? 'Teacher' : 'Subject'}</th>
                    <th className="text-left px-4 py-3 text-xs font-black text-slate-600 uppercase tracking-wide">Topic Covered <span className="text-red-500">*</span></th>
                    <th className="text-left px-4 py-3 text-xs font-black text-slate-600 uppercase tracking-wide">Homework</th>
                    <th className="text-left px-4 py-3 text-xs font-black text-slate-600 uppercase tracking-wide">Activity Notes</th>
                    <th className="text-left px-4 py-3 text-xs font-black text-slate-600 uppercase tracking-wide">Next Plan</th>
                    <th className="px-3 py-3 w-[80px] no-print"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row, idx) => (<DiaryTableRow key={`${row.slot.class_id}_${row.slot.subject_id}`} row={row} index={idx} viewMode={viewMode} onUpdate={updateRow} onSave={saveRow} />))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm flex-wrap">
            <span className="flex items-center gap-1 text-emerald-700 font-bold"><CheckCircle2 className="w-4 h-4" />{filledCount} of {rows.length} entries filled</span>
            {filledCount < rows.length && (<span className="flex items-center gap-1 text-amber-600 font-medium"><AlertCircle className="w-3.5 h-3.5" />{rows.length - filledCount} remaining</span>)}
          </div>

          {/* ── Hidden Static Report View ─────────────────────────────────── */}
          <div className="print-only">
            <div ref={reportRef} id="hidden-report-container" className="diary-print-layout" style={{ padding: '0 0 40px 0' }}>
              <div className="top-banner" style={{ height: '12px', background: 'linear-gradient(90deg, #1e1b4b, #4f46e5)', marginBottom: '20px' }}></div>
              <div style={{ display: 'flex', alignItems: 'center', margin: '0 35px 25px 35px', paddingBottom: '12px', borderBottom: '3px solid #1e1b4b' }}>
                {schoolInfo?.logo_url && (
                  <img src={schoolInfo.logo_url} crossOrigin="anonymous" style={{ width: '85px', height: '85px', objectFit: 'contain', marginRight: '30px' }} alt="logo" />
                )}
                <div style={{ flexGrow: 1, textAlign: 'center' }}>
                  <h1 style={{ fontSize: '34px', fontWeight: '900', color: '#1e1b4b', margin: '0', letterSpacing: '-1px', textTransform: 'uppercase' }}>{schoolInfo?.name || 'School Diary'}</h1>
                  <p style={{ fontSize: '14px', color: '#475569', fontWeight: '700', marginTop: '4px' }}>{schoolInfo?.address}</p>
                  <div style={{ marginTop: '12px' }}>
                     <span style={{ background: '#1e1b4b', color: 'white', padding: '6px 35px', borderRadius: '4px', fontWight: '900', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                       {viewMode === 'class' ? 'Class Academic Diary' : 'Professional Staff Record'}
                     </span>
                  </div>
                </div>
                <div style={{ width: '85px' }}></div> 
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '0 35px 20px 35px', fontWeight: '900', fontSize: '14px', border: '2.5px solid #1e1b4b', padding: '12px 25px', background: '#f8fafc', color: '#1e1b4b' }}>
                <span>DATED: {formattedDate}</span>
                <span>{viewMode === 'class' ? `CLASS: GRADE ${selectedClassName}` : `STAFF: ${selectedTeacherName}`}</span>
              </div>

              <table style={{ width: 'calc(100% - 70px)', margin: '0 35px', borderCollapse: 'collapse', border: '2.5px solid #1e1b4b', background: 'white' }}>
                <thead>
                  <tr>
                    <th style={{ border: '1.5px solid #1e1b4b', padding: '12px 6px', background: '#1e1b4b', width: '12%', textAlign: 'center', color: '#fff', fontWeight: '900', fontSize: '10px' }}>{viewMode === 'class' ? 'Subject' : 'Class'}</th>
                    <th style={{ border: '1.5px solid #1e1b4b', padding: '12px 6px', background: '#1e1b4b', width: '12%', textAlign: 'center', color: '#fff', fontWeight: '900', fontSize: '10px' }}>{viewMode === 'class' ? 'Teacher' : 'Subject'}</th>
                    <th style={{ border: '1.5px solid #1e1b4b', padding: '12px 6px', background: '#1e1b4b', width: '25%', textAlign: 'center', color: '#fff', fontWeight: '900', fontSize: '10px' }}>Lesson / Work Covered</th>
                    <th style={{ border: '1.5px solid #1e1b4b', padding: '12px 6px', background: '#1e1b4b', width: '17%', textAlign: 'center', color: '#fff', fontWeight: '900', fontSize: '10px' }}>Home Assignments</th>
                    <th style={{ border: '1.5px solid #1e1b4b', padding: '12px 6px', background: '#1e1b4b', width: '17%', textAlign: 'center', color: '#fff', fontWeight: '900', fontSize: '10px' }}>Activity Notes</th>
                    <th style={{ border: '1.5px solid #1e1b4b', padding: '12px 6px', background: '#1e1b4b', width: '17%', textAlign: 'center', color: '#fff', fontWeight: '900', fontSize: '10px' }}>Next Plan</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const meta = getSubjectMeta(viewMode === 'class' ? row.slot.subject_name : row.slot.class_name);
                    const ReportIcon = meta.icon;
                    return (
                      <tr key={idx} style={{ background: idx % 2 === 0 ? 'white' : 'rgba(241, 245, 249, 0.4)' }}>
                        <td style={{ border: '1px solid #cbd5e1', padding: '14px 10px', borderLeft: `8px solid ${meta.color}`, verticalAlign: 'middle', textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                             <div style={{ color: meta.color, background: `${meta.color}15`, padding: '5px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <ReportIcon style={{ width: '18px', height: '18px' }} />
                             </div>
                             <span style={{ fontWeight: '900', color: '#1e1b4b', fontSize: '11px' }}>{viewMode === 'class' ? row.slot.subject_name : row.slot.class_name}</span>
                          </div>
                        </td>
                        <td style={{ border: '1px solid #cbd5e1', padding: '14px 10px', fontSize: '10px', fontWeight: '800', color: '#444', textAlign: 'center' }}>{viewMode === 'class' ? row.slot.teacher_name : row.slot.subject_name}</td>
                        <td className="urdu-text" style={{ border: '1px solid #cbd5e1', padding: '16px 12px', background: `${meta.color}05`, textAlign: 'center' }}>{row.topic_covered}</td>
                        <td className="urdu-text" style={{ border: '1px solid #cbd5e1', padding: '16px 12px', textAlign: 'center' }}>{row.homework}</td>
                        <td className="urdu-text" style={{ border: '1px solid #cbd5e1', padding: '16px 12px', background: `${meta.color}05`, textAlign: 'center' }}>{row.activity_notes}</td>
                        <td className="urdu-text" style={{ border: '1px solid #cbd5e1', padding: '16px 12px', textAlign: 'center' }}>{row.next_plan}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="sign-area" style={{ display: 'flex', justifyContent: 'center', margin: '50px 35px 0 35px' }}>
                <div style={{ textAlign: 'center', width: '350px' }}>
                  <div style={{ padding: '15px', borderRadius: '8px 8px 0 0', height: '40px' }}></div>
                  <div style={{ borderTop: '2.5px solid #1e1b4b', paddingTop: '10px', fontWeight: '900', color: '#1e1b4b', fontSize: '13px', letterSpacing: '1px' }}>CLASS TEACHER SIGNATURE</div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      ) : null)}
    </div>
  );
}

// ─── Mobile Card Component ────────────────────────────────────────────────────
function DiaryCard({
  row, index, onUpdate, onSave, viewMode,
}: {
  key?: React.Key;
  row: DiaryRow;
  index: number;
  onUpdate: (i: number, field: keyof DiaryRow, value: string) => void;
  onSave: (i: number) => void | Promise<void>;
  viewMode: 'teacher' | 'class';
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
        value={row[field] as string}
        onChange={e => onUpdate(index, field, e.target.value)}
        placeholder={placeholder}
        className="w-full border rounded-xl px-3 py-2 text-sm resize-none outline-none transition focus:ring-2"
        style={{
          borderColor: row[field] ? meta.color : '#e2e8f0',
          // @ts-ignore
          '--tw-ring-color': meta.color,
          backgroundColor: row[field] ? `${meta.color}08` : 'transparent',
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
            disabled={row.saving || !row.topic_covered.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-bold rounded-lg shadow disabled:opacity-40 transition"
            style={{ backgroundColor: meta.color }}
          >
            <Save className="w-3 h-3" />{row.saving ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>

      {/* Card fields */}
      <div className="p-4 space-y-3">
        {cardField('topic_covered', 'Topic Covered', 'What was taught today?', true)}
        {cardField('homework', 'Homework', 'Tasks for home…')}
        {cardField('activity_notes', 'Activity Notes', 'Class observations…')}
        {cardField('next_plan', 'Next Plan', "Tomorrow's agenda…")}
      </div>
    </div>
  );
}

// ─── Desktop Table Row ────────────────────────────────────────────────────────
function DiaryTableRow({
  row, index, onUpdate, onSave, viewMode,
}: {
  key?: React.Key;
  row: DiaryRow;
  index: number;
  onUpdate: (i: number, field: keyof DiaryRow, value: string) => void;
  onSave: (i: number) => void | Promise<void>;
  viewMode: 'teacher' | 'class';
}) {
  const meta = getSubjectMeta(viewMode === 'class' ? row.slot.subject_name : row.slot.class_name);
  const Icon = meta.icon;

  const cellInput = (field: 'topic_covered' | 'homework' | 'activity_notes' | 'next_plan', placeholder: string) => (
    <textarea 
      rows={3} 
      value={row[field] as string} 
      onChange={e => onUpdate(index, field, e.target.value)} 
      placeholder={placeholder} 
      className={cn(
        "w-full border-2 border-transparent hover:border-indigo-100 focus:ring-1 transition outline-none leading-relaxed font-['Inter',_'Noto_Nastaliq_Urdu',_sans-serif] rounded-xl px-3 py-2 text-sm resize-none bg-transparent focus:bg-white",
        "focus:ring-offset-2"
      )}
      style={{ 
        // @ts-ignore
        '--tw-ring-color': meta.color,
        borderBottomColor: row[field] ? meta.color : 'transparent'
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
        <div className="flex flex-col gap-1">
          <span 
            className="inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight"
            style={{ backgroundColor: meta.bg, color: meta.color }}
          >
            {viewMode === 'class' ? row.slot.teacher_name : row.slot.subject_name}
          </span>
          {viewMode === 'class' && (
            <span className="text-[9px] text-slate-400 font-bold ml-1">ASSIGNED STAFF</span>
          )}
        </div>
      </td>
      <td className="px-2 py-2 align-top min-w-[220px]">{cellInput('topic_covered', 'What was taught today?')}</td>
      <td className="px-2 py-2 align-top min-w-[180px]">{cellInput('homework', 'Tasks for home...')}</td>
      <td className="px-2 py-2 align-top min-w-[180px]">{cellInput('activity_notes', 'Class observations...')}</td>
      <td className="px-2 py-2 align-top min-w-[180px]">{cellInput('next_plan', 'Tomorrow\'s agenda...')}</td>
      <td className="px-3 py-4 align-top no-print">
        {row.saved ? (
          <span className="flex items-center gap-1 text-emerald-600 font-bold text-[10px]"><CheckCircle2 className="w-3.5 h-3.5" /> Saved</span>
        ) : (
          <button onClick={() => onSave(index)} disabled={row.saving || !row.topic_covered.trim()} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow disabled:opacity-40 transition whitespace-nowrap"><Save className="w-3 h-3" />{row.saving ? '...' : 'Save'}</button>
        )}
      </td>
    </tr>
  );
}
