import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Clock, Printer, Save, X, PlusCircle, Trash2, BookOpen, AlertTriangle } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

  const [selectedClass, setSelectedClass] = useState('');
  const [loading, setLoading] = useState(false);

  // Slot editor modal
  const [editSlot, setEditSlot] = useState<{ day: string; period: number; start: string; end: string } | null>(null);
  const [slotForm, setSlotForm] = useState({ subject_id: '', teacher_id: '' });
  const [saving, setSaving] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  useEffect(() => { if (userRole?.school_id) fetchInit(); }, [userRole]);
  useEffect(() => { if (selectedClass) { fetchSubjects(); fetchSlots(); } else setSlots([]); }, [selectedClass]);

  const fetchInit = async () => {
    const [{ data: cls }, { data: tchr }] = await Promise.all([
      supabase.from('classes').select('id, name, section').eq('school_id', userRole?.school_id).order('name').order('section'),
      supabase.from('staff').select('id, full_name, role, department').eq('school_id', userRole?.school_id).eq('is_active', true).order('full_name'),
    ]);
    if (cls) setClasses(cls);
    if (tchr) setTeachers(tchr);
  };

  const fetchSubjects = async () => {
    const { data } = await supabase.from('subjects').select('*').eq('class_id', selectedClass).order('subject_name');
    if (data) setSubjects(data);
  };

  const fetchSlots = async () => {
    setLoading(true);
    const { data } = await supabase.from('timetable_slots')
      .select('*, subjects(subject_name), staff(full_name)')
      .eq('class_id', selectedClass)
      .order('period_number');
    if (data) setSlots(data);
    setLoading(false);
  };

  const openSlotEditor = (day: string, periodObj: typeof DEFAULT_PERIODS[0]) => {
    setEditSlot({ day, period: periodObj.period, start: periodObj.start, end: periodObj.end });
    setConflictWarning(null);
    const existing = slots.find(s => s.day_of_week === day && s.period_number === periodObj.period);
    setSlotForm({
      subject_id: existing?.subject_id || '',
      teacher_id: existing?.teacher_id || '',
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
      const existing = slots.find(s => s.day_of_week === editSlot.day && s.period_number === editSlot.period);

      const payload = {
        school_id: userRole?.school_id,
        class_id: selectedClass,
        day_of_week: editSlot.day,
        period_number: editSlot.period,
        start_time: editSlot.start,
        end_time: editSlot.end,
        subject_id: slotForm.subject_id || null,
        teacher_id: slotForm.teacher_id || null,
      };

      if (existing) {
        const { error } = await supabase.from('timetable_slots').update(payload).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('timetable_slots').insert([payload]);
        if (error) throw error;
      }

      setEditSlot(null);
      fetchSlots();
    } catch (err: any) { alert(err.message); }
    setSaving(false);
  };

  const handleClearSlot = async (day: string, period: number) => {
    const existing = slots.find(s => s.day_of_week === day && s.period_number === period);
    if (!existing) return;
    if (!window.confirm('Clear this period slot?')) return;
    await supabase.from('timetable_slots').delete().eq('id', existing.id);
    fetchSlots();
  };

  // Check for teacher conflicts (same teacher, same day, same period across any class)
  const getSlot = (day: string, period: number) =>
    slots.find(s => s.day_of_week === day && s.period_number === period);

  const currentClass = classes.find(c => c.id === selectedClass);

  return (
    <div className="space-y-6 max-w-full">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          table { width: 100%; border-collapse: collapse; font-size: 9px; }
          th, td { border: 1px solid #000; padding: 4px; text-align: center; }
          @page { size: landscape; margin: 8mm; }
        }
      `}</style>

      {/* Header */}
      <div className="no-print flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Clock className="w-6 h-6 text-cyan-600" /> Class Timetable Manager
          </h1>
          <p className="text-gray-500 text-sm mt-1">Assign subjects and teachers to each period. Click any cell to configure it.</p>
        </div>
        <button onClick={() => window.print()} disabled={!selectedClass} className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2.5 rounded-lg font-bold shadow disabled:opacity-50 transition">
          <Printer className="w-4 h-4" /> Print Timetable
        </button>
      </div>

      {/* Class Selector */}
      <div className="no-print bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Select Class to Configure / View</label>
        <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
          className="w-full md:w-80 px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg font-medium text-gray-800 focus:ring-cyan-500">
          <option value="">-- Choose a Class --</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name} — Section {c.section}</option>)}
        </select>
      </div>

      {/* Print Header */}
      {selectedClass && (
        <div className="hidden print:block text-center mb-4">
          <h1 className="text-2xl font-black uppercase tracking-wider">WEEKLY TIMETABLE</h1>
          <p className="font-bold text-sm mt-1">Class: {currentClass?.name} — Section {currentClass?.section}</p>
        </div>
      )}

      {/* The Grid */}
      {selectedClass && (
        loading ? (
          <div className="bg-white rounded-xl p-12 text-center text-gray-500 border border-gray-200 shadow-sm">
            Building timetable grid...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse bg-white shadow-sm rounded-xl overflow-hidden border border-gray-200 min-w-[900px]">
              <thead>
                <tr className="bg-gray-800 text-white">
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase w-28">Period / Day</th>
                  {DAYS.map(d => (
                    <th key={d} className="px-3 py-3 text-center text-xs font-bold uppercase">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DEFAULT_PERIODS.map((periodObj, pIdx) => (
                  <tr key={periodObj.period} className="border-b border-gray-100 hover:bg-gray-50/50">
                    {/* Period Info Column */}
                    <td className="px-4 py-3 border-r border-gray-200 bg-gray-50 print:bg-gray-100">
                      <p className="font-black text-gray-700 text-sm">Period {periodObj.period}</p>
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">{periodObj.start} – {periodObj.end}</p>
                    </td>

                    {/* Day Cells */}
                    {DAYS.map(day => {
                      const slot = getSlot(day, periodObj.period);
                      return (
                        <td key={day} className="px-2 py-2 text-center align-top">
                          {slot ? (
                            <div className={`rounded-lg border p-2 cursor-pointer group relative ${PERIOD_COLORS[pIdx % PERIOD_COLORS.length]}`}
                              onClick={() => openSlotEditor(day, periodObj)}>
                              <p className="font-black text-xs leading-tight">{slot.subjects?.subject_name}</p>
                              {slot.staff && <p className="text-[10px] font-medium opacity-70 mt-0.5 truncate">{slot.staff?.full_name}</p>}
                              <button
                                onClick={e => { e.stopPropagation(); handleClearSlot(day, periodObj.period); }}
                                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full text-[9px] items-center justify-center hidden group-hover:flex no-print"
                              >✕</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => openSlotEditor(day, periodObj)}
                              className="w-full h-14 border-2 border-dashed border-gray-200 hover:border-cyan-400 hover:bg-cyan-50 rounded-lg text-gray-300 hover:text-cyan-500 transition flex items-center justify-center no-print"
                            >
                              <PlusCircle className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Empty state */}
      {!selectedClass && (
        <div className="bg-white rounded-xl p-12 text-center border border-gray-200 shadow-sm">
          <BookOpen className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 font-medium text-lg">Select a class above to view or build its weekly timetable.</p>
        </div>
      )}

      {/* Slot Editor Modal */}
      {editSlot && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-cyan-700 px-6 py-4 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg text-white">Configure Period Slot</h3>
                <p className="text-cyan-200 text-xs font-medium mt-0.5">{editSlot.day} — Period {editSlot.period} | {editSlot.start} – {editSlot.end}</p>
              </div>
              <button onClick={() => setEditSlot(null)} className="text-cyan-200 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 space-y-5 bg-gray-50">
              {/* Time adjustment */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Start Time</label>
                  <input type="time" value={editSlot.start} onChange={e => setEditSlot({ ...editSlot, start: e.target.value })}
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm font-bold focus:ring-cyan-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">End Time</label>
                  <input type="time" value={editSlot.end} onChange={e => setEditSlot({ ...editSlot, end: e.target.value })}
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm font-bold focus:ring-cyan-500" />
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Subject *</label>
                <select value={slotForm.subject_id} onChange={e => setSlotForm({ ...slotForm, subject_id: e.target.value })}
                  className="w-full border border-gray-300 px-3 py-2 rounded-lg bg-white text-sm font-medium focus:ring-cyan-500">
                  <option value="">-- Select Subject --</option>
                  {subjects.length === 0 && <option disabled>No subjects configured for this class</option>}
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
                </select>
                {subjects.length === 0 && (
                  <p className="text-xs text-orange-500 mt-1 italic">Go to Classes → Subject Curriculum to add subjects first.</p>
                )}
              </div>

              {/* Teacher */}
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Assigned Teacher</label>
                <select value={slotForm.teacher_id} onChange={e => {
                  const tid = e.target.value;
                  setSlotForm({ ...slotForm, teacher_id: tid });
                  if (editSlot) checkTeacherConflict(tid, editSlot.day, editSlot.period);
                }} className="w-full border border-gray-300 px-3 py-2 rounded-lg bg-white text-sm font-medium focus:ring-cyan-500">
                  <option value="">-- No Teacher Assigned --</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name} ({t.role})</option>)}
                </select>
                {conflictWarning && (
                  <div className="flex items-start gap-2 mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700">{conflictWarning} You can still save but this will create a scheduling conflict.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 bg-white border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setEditSlot(null)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition">Cancel</button>
              <button onClick={handleSaveSlot} disabled={saving}
                className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg shadow flex items-center gap-2 disabled:opacity-50">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Slot'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
