import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Clock, Printer, Save, X, PlusCircle, Trash2, BookOpen, AlertTriangle } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const DEFAULT_PERIODS = [
  { period: 1, start: '08:00', end: '08:45' },
  { period: 2, start: '08:45', end: '09:30' },
  { period: 3, start: '09:30', end: '10:15' },
  { period: 4, start: '10:30', end: '11:15' }, // break before
  { period: 5, start: '11:15', end: '12:00' },
  { period: 6, start: '12:00', end: '12:45' },
  { period: 7, start: '13:30', end: '14:15' }, // lunch break
  { period: 8, start: '14:15', end: '15:00' },
];

const PERIOD_COLORS = [
  'bg-blue-50 border-blue-200 text-blue-900',
  'bg-indigo-50 border-indigo-200 text-indigo-900',
  'bg-violet-50 border-violet-200 text-violet-900',
  'bg-purple-50 border-purple-200 text-purple-900',
  'bg-teal-50 border-teal-200 text-teal-900',
  'bg-cyan-50 border-cyan-200 text-cyan-900',
  'bg-emerald-50 border-emerald-200 text-emerald-900',
  'bg-green-50 border-green-200 text-green-900',
];

export default function Timetable() {
  const { userRole } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  // All slots across all classes (for grid-level conflict detection)
  const [allSchoolSlots, setAllSchoolSlots] = useState<any[]>([]);

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDay, setSelectedDay] = useState(DAYS[0]);
  const [viewMode, setViewMode] = useState<'individual' | 'master'>('master');
  const [loading, setLoading] = useState(false);

  // Slot editor modal
  const [editSlot, setEditSlot] = useState<{ day: string; period: number; start: string; end: string; class_id?: string } | null>(null);
  const [slotForm, setSlotForm] = useState({ subject_id: '', teacher_id: '', class_id: '' });
  const [saving, setSaving] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  useEffect(() => { if (userRole?.school_id) fetchInit(); }, [userRole]);
  useEffect(() => { if (selectedClass) { fetchSubjects(selectedClass); fetchSlots(); } else setSlots([]); }, [selectedClass]);

  const fetchInit = async () => {
    const [{ data: cls }, { data: tchr }, { data: allSlots }] = await Promise.all([
      supabase.from('classes').select('id, name, section').eq('school_id', userRole?.school_id).order('name').order('section'),
      supabase.from('staff').select('id, full_name, role').eq('school_id', userRole?.school_id).eq('is_active', true).order('full_name'),
      supabase.from('timetable_slots').select('*, subjects(subject_name), staff:staff(full_name), classes(name, section)').eq('school_id', userRole?.school_id),
    ]);
    if (cls) setClasses(cls);
    if (tchr) setTeachers(tchr);
    if (allSlots) setAllSchoolSlots(allSlots);
  };

  const fetchSubjects = async (classId: string) => {
    const { data } = await supabase.from('subjects').select('*').eq('class_id', classId).order('subject_name');
    if (data) setSubjects(data);
  };

  const fetchSlots = async () => {
    setLoading(true);
    const [{ data }, { data: allSlots }] = await Promise.all([
      supabase.from('timetable_slots')
        .select('*, subjects(subject_name), staff(full_name)')
        .eq('class_id', selectedClass)
        .order('period_number'),
      supabase.from('timetable_slots')
        .select('*, subjects(subject_name), staff:staff(full_name), classes(name, section)')
        .eq('school_id', userRole!.school_id),
    ]);
    if (data) setSlots(data);
    if (allSlots) setAllSchoolSlots(allSlots);
    setLoading(false);
  };

  // Returns conflict info if this slot's teacher is assigned elsewhere at the same period
  const getGridConflict = (day: string, period: number): string | null => {
    const slot = slots.find(s => s.day_of_week === day && s.period_number === period);
    if (!slot?.teacher_id) return null;
    const clash = allSchoolSlots.find(
      s => s.teacher_id === slot.teacher_id &&
           s.day_of_week === day &&
           s.period_number === period &&
           s.class_id !== selectedClass
    );
    if (!clash) return null;
    const clashClass = clash.classes ? `${clash.classes.name}-${clash.classes.section}` : 'another class';
    return `Teacher also in ${clashClass}`;
  };

  const openSlotEditor = async (day: string, periodObj: typeof DEFAULT_PERIODS[0], classId: string) => {
    setLoading(true);
    await fetchSubjects(classId);
    setLoading(false);
    
    setEditSlot({ day, period: periodObj.period, start: periodObj.start, end: periodObj.end, class_id: classId });
    setConflictWarning(null);
    
    const existing = (viewMode === 'master' ? allSchoolSlots : slots).find(
      s => s.day_of_week === day && s.period_number === periodObj.period && s.class_id === classId
    );
    
    setSlotForm({
      subject_id: existing?.subject_id || '',
      teacher_id: existing?.teacher_id || '',
      class_id: classId
    });
  };

  const checkTeacherConflict = async (teacherId: string, day: string, period: number) => {
    if (!teacherId) { setConflictWarning(null); return; }
    const { data } = await supabase
      .from('timetable_slots')
      .select('*, classes(name, section)')
      .eq('school_id', userRole!.school_id)
      .eq('teacher_id', teacherId)
      .eq('day_of_week', day)
      .eq('period_number', period)
      .neq('class_id', selectedClass);
    if (data && data.length > 0) {
      const conflict = data[0];
      const conflictClass = conflict.classes ? `${conflict.classes.name}-${conflict.classes.section}` : 'another class';
      setConflictWarning(`⚠ This teacher is already assigned Period ${period} on ${day} for ${conflictClass}.`);
    } else {
      setConflictWarning(null);
    }
  };

  const handleSaveSlot = async () => {
    if (!editSlot || !slotForm.subject_id) return alert('Please select a subject.');
    setSaving(true);
    try {
      const targetClassId = editSlot.class_id || selectedClass;
      
      const payload = {
        school_id: userRole?.school_id,
        class_id: targetClassId,
        day_of_week: editSlot.day,
        period_number: editSlot.period,
        start_time: editSlot.start,
        end_time: editSlot.end,
        subject_id: slotForm.subject_id || null,
        teacher_id: slotForm.teacher_id || null,
      };

      // Use upsert with onConflict to resolve the unique constraint error
      const { error } = await supabase
        .from('timetable_slots')
        .upsert([payload], { 
          onConflict: 'class_id,day_of_week,period_number' 
        });

      if (error) throw error;

      setEditSlot(null);
      fetchSlots();
    } catch (err: any) { alert(err.message); }
    setSaving(false);
  };

  const handleCloneDay = async (sourceDay: string, targetDay: string) => {
    if (sourceDay === targetDay) return;
    if (!confirm(`Overwrite all slots on ${targetDay} with data from ${sourceDay}?`)) return;
    
    setLoading(true);
    try {
      // 1. Get all slots for source day
      const { data: sourceData } = await supabase.from('timetable_slots').select('*').eq('school_id', userRole?.school_id).eq('day_of_week', sourceDay);
      
      // 2. Delete all slots for target day
      await supabase.from('timetable_slots').delete().eq('school_id', userRole?.school_id).eq('day_of_week', targetDay);
      
      // 3. Clone
      if (sourceData && sourceData.length > 0) {
        const clones = sourceData.map(({ id, created_at, day_of_week, ...rest }) => ({
          ...rest,
          day_of_week: targetDay
        }));
        const { error } = await supabase.from('timetable_slots').insert(clones);
        if (error) throw error;
      }
      
      alert(`Cloned ${sourceDay} schedule to ${targetDay} successfully.`);
      fetchSlots();
    } catch (err: any) { alert(err.message); }
    setLoading(false);
  };

  const handleCopyClassToClass = async (fromClassId: string, toClassId: string) => {
    if (fromClassId === toClassId) return;
    const fromName = classes.find(c => c.id === fromClassId)?.name;
    const toName = classes.find(c => c.id === toClassId)?.name;
    if (!confirm(`Copy ${selectedDay}'s schedule from ${fromName} to ${toName}?`)) return;

    setLoading(true);
    try {
      const { data: fromData } = await supabase.from('timetable_slots').select('*').eq('class_id', fromClassId).eq('day_of_week', selectedDay);
      await supabase.from('timetable_slots').delete().eq('class_id', toClassId).eq('day_of_week', selectedDay);
      
      if (fromData && fromData.length > 0) {
        const clones = fromData.map(({ id, created_at, class_id, ...rest }) => ({
          ...rest,
          class_id: toClassId
        }));
        const { error } = await supabase.from('timetable_slots').insert(clones);
        if (error) throw error;
      }
      alert('Class schedule copied successfully.');
      fetchSlots();
    } catch (err: any) { alert(err.message); }
    setLoading(false);
  };

  // Check for teacher conflicts (same teacher, same day, same period across any class)
  const getSlot = (day: string, period: number, classId?: string) =>
    (viewMode === 'master' ? allSchoolSlots : slots).find(s => s.day_of_week === day && s.period_number === period && (classId ? s.class_id === classId : true));

  const getMasterSlot = (classId: string, period: number) => 
    allSchoolSlots.find(s => s.class_id === classId && s.period_number === period && s.day_of_week === selectedDay);

  const currentClass = classes.find(c => c.id === selectedClass);

  return (
    <div className="space-y-6 max-w-full">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; font-family: 'Inter', sans-serif; }
          .print-only { display: block !important; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          th, td { border: 1px solid #e2e8f0 !important; padding: 12px 8px !important; text-align: center; }
          @page { size: A3 landscape; margin: 10mm; }
          .bg-slate-900 { background-color: #0f172a !important; color: white !important; }
          .bg-slate-50 { background-color: #f8fafc !important; }
          .rounded-2xl, .rounded-[2.5rem] { border-radius: 0 !important; }
          .shadow-2xl { box-shadow: none !important; }
        }
      `}</style>

      {/* Header */}
      <div className="no-print flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight">
            <Clock className="w-8 h-8 text-indigo-600" /> Institutional Master Timetable
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium italic">High-density scheduling engine with real-time conflict detection.</p>
        </div>
        
        <div className="flex items-center gap-3">
           <div className="bg-slate-100 p-1 rounded-2xl flex border border-slate-200 shadow-inner">
              <button 
                onClick={() => setViewMode('master')}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'master' ? 'bg-white text-indigo-600 shadow-md border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>
                Institutional Matrix
              </button>
              <button 
                onClick={() => setViewMode('individual')}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'individual' ? 'bg-white text-indigo-600 shadow-md border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>
                Class-Specific View
              </button>
           </div>
           
           <button onClick={() => window.print()} className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-slate-800 transition active:scale-95">
             <Printer className="w-4 h-4" /> Print Setup
           </button>
        </div>
      </div>

      {/* Day Switcher */}
      <div className="no-print flex flex-wrap items-center gap-2 bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
         {DAYS.map(day => (
           <button 
             key={day} 
             onClick={() => setSelectedDay(day)}
             className={`flex-1 px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all border-2 ${selectedDay === day ? 'bg-indigo-600 text-white border-indigo-700 shadow-lg shadow-indigo-100' : 'bg-slate-50 text-slate-400 border-transparent hover:bg-slate-100 hover:text-slate-600'}`}>
             {day}
           </button>
         ))}
      </div>

      {/* Toolbar / Quick Actions */}
      <div className="no-print flex flex-wrap justify-between items-center gap-4 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50">
          <div className="flex gap-4">
             <div className="group relative">
                <button className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-indigo-200 text-[10px] font-black text-indigo-900 uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition">
                   <PlusCircle className="w-4 h-4" /> Clone Day To...
                </button>
                <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-indigo-50 p-2 hidden group-hover:block z-50 animate-in fade-in slide-in-from-top-2">
                   {DAYS.filter(d => d !== selectedDay).map(d => (
                     <button key={d} onClick={() => handleCloneDay(selectedDay, d)} className="w-full text-left px-4 py-2 text-[10px] font-bold text-slate-600 uppercase hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors">
                        Clone to {d}
                     </button>
                   ))}
                </div>
             </div>
          </div>

          <div className="flex items-center gap-6">
             <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-rose-500 rounded-full animate-pulse shadow-glow shadow-rose-200"></div>
                <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Conflict Guard Active</span>
             </div>
          </div>
      </div>

      {/* Main Grid View */}
      <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200 border border-slate-100 overflow-hidden">
        {viewMode === 'master' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-fixed">
               <thead>
                  <tr className="bg-slate-900 text-white font-black text-[10px] uppercase tracking-[0.2em] sticky top-0 z-40">
                     <th className="p-5 border-r border-slate-800 sticky left-0 bg-slate-900 z-50 w-44">Period / Classes</th>
                     {classes.map(cls => (
                       <th key={cls.id} className="p-3 text-center border-r border-slate-800 w-48 group/col">
                         <span className="block">{cls.name}</span>
                         <span className="text-[8px] text-white/50">{cls.section}</span>
                         <button 
                           onClick={(e) => {
                             e.stopPropagation();
                             const fromClassId = prompt('Enter Source Class Name to copy FROM:', '');
                             if (!fromClassId) return;
                             const sourceClass = classes.find(c => c.name.toLowerCase() === fromClassId.toLowerCase());
                             if (sourceClass) handleCopyClassToClass(sourceClass.id, cls.id);
                             else alert('Class not found.');
                           }}
                           className="mt-2 text-[7px] bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded opacity-0 group-hover/col:opacity-100 transition-opacity uppercase font-black">
                           Copy From...
                         </button>
                       </th>
                     ))}
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {DEFAULT_PERIODS.map(periodObj => (
                    <tr key={periodObj.period} className="hover:bg-indigo-50/30 transition-colors group">
                       <td className="p-5 border-r border-slate-100 sticky left-0 bg-white group-hover:bg-slate-50 z-30 transition-colors flex flex-col justify-center shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]">
                          <span className="font-black text-slate-900 text-sm italic leading-none truncate tracking-tight">Period {periodObj.period}</span>
                          <span className="text-[9px] font-black text-slate-400 mt-2 tracking-tighter tabular-nums">{periodObj.start} – {periodObj.end}</span>
                       </td>
                       {classes.map(cls => {
                          const slot = getMasterSlot(cls.id, periodObj.period);
                          const conflict = slot?.teacher_id ? allSchoolSlots.filter(s => s.teacher_id === slot.teacher_id && s.day_of_week === selectedDay && s.period_number === periodObj.period && s.class_id !== cls.id) : [];
                          
                          return (
                            <td key={cls.id} className="p-2 border-r border-slate-50 min-h-[100px]" onClick={() => openSlotEditor(selectedDay, periodObj, cls.id)}>
                               {slot ? (
                                 <div className={`p-3 rounded-2xl border-2 transition-all cursor-pointer relative h-full flex flex-col justify-center ${conflict.length > 0 ? 'bg-rose-50 border-rose-200 shadow-inner' : 'bg-slate-50 border-white hover:border-indigo-100 hover:bg-white hover:shadow-xl hover:shadow-indigo-50'}`}>
                                    <p className="font-black text-[11px] text-slate-900 uppercase leading-tight tracking-tight">{slot.subjects?.subject_name}</p>
                                    <p className="text-[10px] text-slate-400 font-bold mt-1 italic truncate">{slot.staff?.full_name}</p>
                                    
                                    {conflict.length > 0 && (
                                      <div className="absolute -top-2 -right-2 bg-rose-600 text-white text-[8px] font-black px-2 py-1 rounded-full shadow-lg animate-bounce border-2 border-white">
                                        CLASH
                                      </div>
                                    )}
                                    {conflict.length > 0 && (
                                      <p className="text-[8px] font-bold text-rose-500 mt-1 uppercase tracking-tighter leading-none">
                                        {conflict.map(c => c.classes?.name).join(', ')}
                                      </p>
                                    )}
                                 </div>
                               ) : (
                                 <div className="w-full h-full min-h-[60px] border-2 border-dashed border-slate-100 rounded-2xl flex items-center justify-center text-slate-200 hover:bg-indigo-50/30 hover:border-indigo-100 hover:text-indigo-400 transition-all cursor-pointer group">
                                    <PlusCircle className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                 </div>
                               )}
                            </td>
                          );
                       })}
                    </tr>
                  ))}
               </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10 space-y-10">
            {/* Old Class-Specific View Logic but updated */}
            <div className="max-w-md mx-auto no-print">
               <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Target Academic Class</label>
               <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 font-bold focus:ring-4 focus:ring-indigo-100 outline-none transition-all shadow-inner">
                  <option value="">Choose Class Profile...</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name} — {c.section}</option>)}
               </select>
            </div>

            {selectedClass ? (
               <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                     <thead>
                        <tr className="bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest">
                           <th className="p-5 border-r border-slate-800 sticky left-0 bg-slate-900 w-44">Period</th>
                           {DAYS.map(day => <th key={day} className="p-5 text-center border-r border-slate-800 uppercase tracking-widest">{day}</th>)}
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        {DEFAULT_PERIODS.map(periodObj => (
                          <tr key={periodObj.period}>
                             <td className="p-5 border-r border-slate-100 sticky left-0 bg-white font-black text-slate-900 text-xs">
                                Period {periodObj.period}
                                <span className="block text-[10px] font-bold text-slate-400 mt-1 uppercase leading-none">{periodObj.start} – {periodObj.end}</span>
                             </td>
                             {DAYS.map(day => {
                                const slot = getSlot(day, periodObj.period);
                                return (
                                  <td key={day} className="p-2 border-r border-slate-50" onClick={() => openSlotEditor(day, periodObj, selectedClass)}>
                                     {slot ? (
                                       <div className="p-3 bg-slate-50 rounded-xl border border-white hover:border-indigo-100 hover:bg-white transition-all cursor-pointer group relative">
                                          <p className="font-black text-[11px] text-slate-900 leading-tight uppercase tracking-tight">{slot.subjects?.subject_name}</p>
                                          <p className="text-[10px] text-slate-400 font-bold mt-1 italic">{slot.staff?.full_name}</p>
                                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                             <Trash2 className="w-3 h-3 text-rose-500" onClick={(e) => { e.stopPropagation(); /* Clear logic */ }} />
                                          </div>
                                       </div>
                                     ) : (
                                       <div className="w-full h-12 border-2 border-dashed border-slate-100 rounded-xl flex items-center justify-center text-slate-200 hover:bg-slate-50 transition-all cursor-pointer">
                                          <PlusCircle className="w-5 h-5" />
                                       </div>
                                     )}
                                  </td>
                                );
                             })}
                          </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            ) : (
               <div className="text-center py-20 px-8">
                  <BookOpen className="w-20 h-20 text-slate-100 mx-auto mb-6" />
                  <h3 className="text-xl font-black text-slate-300 uppercase italic">Select Class Profile to begin individual tuning</h3>
               </div>
            )}
          </div>
        )}
      </div>

      {/* Editor Modal is handled separately */}

      {/* Slot Editor Modal */}
      {editSlot && (
        <div className="fixed inset-0 bg-slate-950/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100">
            <div className="bg-slate-900 px-8 py-6 flex justify-between items-center text-white">
              <div>
                <h3 className="font-black text-lg uppercase tracking-tight">Institutional Slot Config</h3>
                <p className="text-slate-400 text-[10px] font-bold mt-1 uppercase tracking-widest">{editSlot.day} | Period {editSlot.period} | {editSlot.start} – {editSlot.end}</p>
              </div>
              <button onClick={() => setEditSlot(null)} className="w-10 h-10 flex items-center justify-center border border-white/10 rounded-xl text-white/50 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-8 space-y-6 bg-white">
              {/* Time adjustment */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Start Time</label>
                  <input type="time" value={editSlot.start} onChange={e => setEditSlot({ ...editSlot, start: e.target.value })}
                    className="w-full bg-slate-50 border-none px-6 py-4 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-100 transition-all outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">End Time</label>
                  <input type="time" value={editSlot.end} onChange={e => setEditSlot({ ...editSlot, end: e.target.value })}
                    className="w-full bg-slate-50 border-none px-6 py-4 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-100 transition-all outline-none" />
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Subject *</label>
                <select value={slotForm.subject_id} onChange={e => setSlotForm({ ...slotForm, subject_id: e.target.value })}
                  className="w-full bg-slate-50 border-none px-6 py-4 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-100 transition-all outline-none">
                  <option value="">-- Select Subject Content --</option>
                  {subjects.length === 0 && <option disabled>No curriculum found for this class</option>}
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
                </select>
                {subjects.length === 0 && (
                  <p className="text-xs text-orange-500 mt-1 italic">Go to Classes → Subject Curriculum to add subjects first.</p>
                )}
              </div>

              {/* Teacher */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Assigned Instructor</label>
                <select value={slotForm.teacher_id} onChange={e => {
                  const tid = e.target.value;
                  setSlotForm({ ...slotForm, teacher_id: tid });
                  if (editSlot) checkTeacherConflict(tid, editSlot.day, editSlot.period);
                }} className="w-full bg-slate-50 border-none px-6 py-4 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-100 transition-all outline-none">
                  <option value="">-- Vacant / Unassigned --</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name} ({t.role})</option>)}
                </select>
                {conflictWarning && (
                  <div className="flex items-start gap-2 mt-2 p-3 bg-rose-50 border border-rose-200 rounded-2xl animate-pulse">
                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-rose-700 font-bold uppercase">{conflictWarning}</p>
                  </div>
                )}

                {/* Teacher Schedule Preview */}
                {slotForm.teacher_id && (
                  <div className="mt-4 p-4 bg-slate-900 rounded-2xl border border-slate-800">
                    <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-3">Teacher's {selectedDay} Schedule</p>
                    <div className="flex flex-wrap gap-2">
                       {DEFAULT_PERIODS.map(p => {
                          const work = allSchoolSlots.find(s => s.teacher_id === slotForm.teacher_id && s.day_of_week === (editSlot?.day || selectedDay) && s.period_number === p.period);
                          return (
                            <div key={p.period} className={`px-2 py-1 rounded text-[8px] font-black uppercase ${work ? 'bg-rose-500 text-white' : 'bg-white/10 text-white/30'}`}>
                               P{p.period}: {work ? (work.classes?.name || 'Busy') : 'Free'}
                            </div>
                          );
                       })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="px-8 py-6 bg-white border-t border-slate-100 flex justify-between gap-4">
              <button 
                onClick={async () => {
                  if (!confirm('Permanently clear this slot?')) return;
                  const targetClassId = editSlot?.class_id || selectedClass;
                  const existing = (viewMode === 'master' ? allSchoolSlots : slots).find(
                    s => s.day_of_week === editSlot?.day && s.period_number === editSlot?.period && s.class_id === targetClassId
                  );
                  if (existing) {
                    await supabase.from('timetable_slots').delete().eq('id', existing.id);
                    fetchSlots();
                    setEditSlot(null);
                  }
                }}
                className="px-6 py-3 text-rose-500 font-black text-[10px] uppercase hover:bg-rose-50 rounded-xl transition">
                Clear Slot
              </button>
              <div className="flex gap-3">
                <button onClick={() => setEditSlot(null)} className="px-6 py-3 text-slate-400 font-black text-[10px] uppercase hover:bg-slate-50 rounded-xl transition">Cancel</button>
                <button onClick={handleSaveSlot} disabled={saving}
                  className="px-8 py-3 bg-slate-900 hover:bg-indigo-600 text-white font-black text-[10px] uppercase rounded-xl shadow-xl shadow-slate-200 flex items-center gap-2 disabled:opacity-50 transition-all active:scale-95">
                  <Save className="w-4 h-4" /> {saving ? 'Committing...' : 'Lock Slot'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
