import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  ClipboardList, PlusCircle, Save, X, Pencil, Trash2,
  ChevronLeft, ChevronRight, Calendar, BookOpen, Users
} from 'lucide-react';

export default function TeacherDiary() {
  const { userRole } = useAuth();
  const isTeacher = userRole?.role === 'teacher';
  const isAdmin = ['admin', 'principal', 'director', 'staff'].includes(userRole?.role || '');

  const [myStaffId, setMyStaffId] = useState<string | null>(null);

  // Admin selects teacher; teacher sees themselves
  const [allTeachers, setAllTeachers] = useState<any[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');

  // Slots: classes & subjects assigned to the selected/current teacher
  const [assignedSlots, setAssignedSlots] = useState<{ class_id: string; class_name: string; section: string; subject_id: string; subject_name: string }[]>([]);

  // Selected class+subject for diary
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');

  // Date
  const [viewDate, setViewDate] = useState(new Date().toISOString().split('T')[0]);

  // Entries
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    topic_covered: '', homework: '', activity_notes: '', next_plan: ''
  });

  // ─── Init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userRole?.school_id) return;
    if (isTeacher) {
      // Find staff record linked to this user
      fetchMyStaffRecord();
    } else {
      fetchAllTeachers();
    }
  }, [userRole]);

  const fetchMyStaffRecord = async () => {
    // Try to match by email or user_id on staff table
    const { data } = await supabase
      .from('staff')
      .select('id, full_name')
      .eq('school_id', userRole?.school_id)
      .eq('is_active', true)
      .limit(1); // fallback: first active staff if no user_id link

    // Better: match via email if staff has email column
    const { data: byEmail } = await supabase
      .from('staff')
      .select('id, full_name')
      .eq('school_id', userRole?.school_id)
      .eq('email', userRole?.email || '')
      .maybeSingle();

    const staffRecord = byEmail || (data && data[0]);
    if (staffRecord) {
      setMyStaffId(staffRecord.id);
      setSelectedTeacherId(staffRecord.id);
    }
  };

  const fetchAllTeachers = async () => {
    const { data } = await supabase
      .from('staff')
      .select('id, full_name, role, department')
      .eq('school_id', userRole?.school_id)
      .eq('is_active', true)
      .order('full_name');
    if (data) setAllTeachers(data);
  };

  // ─── Slots for selected teacher ──────────────────────────────────────────
  useEffect(() => {
    if (selectedTeacherId) fetchAssignedSlots();
    else setAssignedSlots([]);
  }, [selectedTeacherId]);

  const fetchAssignedSlots = async () => {
    const { data } = await supabase
      .from('timetable_slots')
      .select(`
        class_id,
        classes(name, section),
        subject_id,
        subjects(subject_name)
      `)
      .eq('teacher_id', selectedTeacherId)
      .eq('school_id', userRole?.school_id);

    if (data) {
      // Deduplicate by class_id + subject_id
      const seen = new Set<string>();
      const unique = data.reduce((acc: any[], s: any) => {
        const key = `${s.class_id}__${s.subject_id}`;
        if (!seen.has(key)) {
          seen.add(key);
          acc.push({
            class_id: s.class_id,
            class_name: s.classes?.name || '?',
            section: s.classes?.section || '',
            subject_id: s.subject_id,
            subject_name: s.subjects?.subject_name || 'General',
          });
        }
        return acc;
      }, []);
      setAssignedSlots(unique);

      // Auto-select first slot if nothing selected
      if (unique.length > 0 && !selectedClassId) {
        setSelectedClassId(unique[0].class_id);
        setSelectedSubjectId(unique[0].subject_id);
      }
    }
  };

  // ─── Fetch diary entries ─────────────────────────────────────────────────
  useEffect(() => {
    if (selectedTeacherId) fetchEntries();
    else setEntries([]);
  }, [selectedTeacherId, selectedClassId, selectedSubjectId, viewDate]);

  const fetchEntries = async () => {
    setLoading(true);
    let query = supabase
      .from('teacher_diary')
      .select(`*, staff(full_name), classes(name, section), subjects(subject_name)`)
      .eq('school_id', userRole?.school_id)
      .eq('teacher_id', selectedTeacherId)
      .order('diary_date', { ascending: false });

    if (selectedClassId) query = query.eq('class_id', selectedClassId);
    if (selectedSubjectId) query = query.eq('subject_id', selectedSubjectId);

    const { data } = await query;
    if (data) setEntries(data);
    setLoading(false);
  };

  // ─── Open form ───────────────────────────────────────────────────────────
  const openCreate = () => {
    if (!selectedTeacherId || !selectedClassId) {
      return alert('Please select a teacher and class/subject first.');
    }
    setEditId(null);
    setForm({ topic_covered: '', homework: '', activity_notes: '', next_plan: '' });
    setShowForm(true);
  };

  const openEdit = (e: any) => {
    setEditId(e.id);
    setForm({
      topic_covered: e.topic_covered,
      homework: e.homework || '',
      activity_notes: e.activity_notes || '',
      next_plan: e.next_plan || '',
    });
    setShowForm(true);
  };

  // ─── Save ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.topic_covered.trim()) return alert('Topic / Lesson covered is required.');
    setSaving(true);
    try {
      const payload = {
        school_id: userRole?.school_id,
        teacher_id: selectedTeacherId,
        class_id: selectedClassId,
        subject_id: selectedSubjectId || null,
        diary_date: viewDate,
        topic_covered: form.topic_covered,
        homework: form.homework || null,
        activity_notes: form.activity_notes || null,
        next_plan: form.next_plan || null,
      };
      if (editId) {
        const { error } = await supabase.from('teacher_diary').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        // upsert so duplicate date+class+subject just updates
        const { error } = await supabase.from('teacher_diary')
          .upsert([payload], { onConflict: 'teacher_id,class_id,subject_id,diary_date' });
        if (error) throw error;
      }
      setShowForm(false);
      fetchEntries();
    } catch (err: any) { alert(err.message); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this diary entry?')) return;
    await supabase.from('teacher_diary').delete().eq('id', id);
    fetchEntries();
  };

  const shiftDate = (days: number) => {
    const d = new Date(viewDate);
    d.setDate(d.getDate() + days);
    setViewDate(d.toISOString().split('T')[0]);
  };

  const currentSlot = assignedSlots.find(s => s.class_id === selectedClassId && s.subject_id === selectedSubjectId);
  const todayEntries = entries.filter(e => e.diary_date === viewDate);
  const prevEntries = entries.filter(e => e.diary_date !== viewDate);

  // ─── Classes + Subjects deduplicated for selectors ───────────────────────
  const uniqueClasses = assignedSlots.reduce((acc: any[], slot) => {
    if (!acc.find(a => a.class_id === slot.class_id)) acc.push(slot);
    return acc;
  }, []);
  const subjectsForClass = assignedSlots.filter(s => s.class_id === selectedClassId);

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-indigo-600" /> Teacher Diary
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {isTeacher ? 'Add daily lessons, homework, and activity notes for your assigned classes.' : 'View and manage diary entries across all teachers.'}
          </p>
        </div>
        <button onClick={openCreate} disabled={!selectedTeacherId || !selectedClassId}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg font-bold shadow disabled:opacity-40 transition">
          <PlusCircle className="w-4 h-4" /> Add Diary Entry
        </button>
      </div>

      {/* ── Step 1: Admin selects teacher / Teacher sees self ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">

          {/* Teacher Selector — only for admin/principal */}
          {!isTeacher && (
            <div>
              <label className="block text-xs font-black text-gray-500 uppercase mb-2 flex items-center gap-1">
                <Users className="w-3 h-3" /> Select Teacher
              </label>
              <select value={selectedTeacherId} onChange={e => { setSelectedTeacherId(e.target.value); setSelectedClassId(''); setSelectedSubjectId(''); }}
                className="w-full border border-gray-300 px-3 py-2.5 rounded-lg bg-gray-50 text-sm font-medium focus:ring-indigo-500">
                <option value="">-- Select Teacher --</option>
                {allTeachers.map(t => <option key={t.id} value={t.id}>{t.full_name} ({t.role})</option>)}
              </select>
            </div>
          )}

          {/* Class Selector */}
          <div>
            <label className="block text-xs font-black text-gray-500 uppercase mb-2 flex items-center gap-1">
              <BookOpen className="w-3 h-3" /> Class
            </label>
            {assignedSlots.length === 0 && selectedTeacherId ? (
              <div className="px-3 py-2.5 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-700 font-bold">
                No classes assigned in Timetable
              </div>
            ) : (
              <select value={selectedClassId} onChange={e => { setSelectedClassId(e.target.value); setSelectedSubjectId(''); }}
                className="w-full border border-gray-300 px-3 py-2.5 rounded-lg bg-gray-50 text-sm font-medium focus:ring-indigo-500">
                <option value="">-- All Classes --</option>
                {uniqueClasses.map(s => (
                  <option key={s.class_id} value={s.class_id}>{s.class_name} — {s.section}</option>
                ))}
              </select>
            )}
          </div>

          {/* Subject Selector */}
          <div>
            <label className="block text-xs font-black text-gray-500 uppercase mb-2">Subject</label>
            <select value={selectedSubjectId} onChange={e => setSelectedSubjectId(e.target.value)}
              className="w-full border border-gray-300 px-3 py-2.5 rounded-lg bg-gray-50 text-sm font-medium focus:ring-indigo-500"
              disabled={!selectedClassId}>
              <option value="">-- All Subjects --</option>
              {subjectsForClass.map(s => (
                <option key={s.subject_id} value={s.subject_id}>{s.subject_name}</option>
              ))}
            </select>
          </div>

          {/* Date Navigator */}
          <div>
            <label className="block text-xs font-black text-gray-500 uppercase mb-2 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Date
            </label>
            <div className="flex items-center gap-1">
              <button onClick={() => shiftDate(-1)} className="p-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <input type="date" value={viewDate} onChange={e => setViewDate(e.target.value)}
                className="flex-1 border border-gray-300 px-2 py-2 rounded-lg text-sm text-center font-medium" />
              <button onClick={() => shiftDate(1)} className="p-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Assigned Class Chips — quick jump */}
        {assignedSlots.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
            <span className="text-xs font-bold text-gray-400 uppercase mr-1 self-center">Quick Jump:</span>
            {assignedSlots.map(slot => (
              <button
                key={`${slot.class_id}_${slot.subject_id}`}
                onClick={() => { setSelectedClassId(slot.class_id); setSelectedSubjectId(slot.subject_id); }}
                className={`px-3 py-1 rounded-full text-xs font-bold border transition ${
                  selectedClassId === slot.class_id && selectedSubjectId === slot.subject_id
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400 hover:text-indigo-600'
                }`}>
                {slot.class_name} {slot.section} · {slot.subject_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Today's Entries ── */}
      {selectedTeacherId && (
        <>
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <h2 className="font-bold text-gray-800">
              {new Date(viewDate + 'T00:00:00').toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </h2>
            <span className="text-xs bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-bold">
              {todayEntries.length} {todayEntries.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>

          {loading ? (
            <div className="bg-white rounded-xl p-10 text-center text-gray-400 border border-gray-200">Loading diary...</div>
          ) : todayEntries.length === 0 ? (
            <div className="bg-white rounded-xl p-10 text-center border-2 border-dashed border-gray-200">
              <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 font-medium">No diary entries for this date.</p>
              {selectedClassId && (
                <button onClick={openCreate} className="mt-3 text-indigo-600 font-bold text-sm hover:underline">
                  + Add today's diary entry
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {todayEntries.map(entry => (
                <DiaryCard key={entry.id} entry={entry} onEdit={openEdit} onDelete={handleDelete} />
              ))}
            </div>
          )}

          {/* Previous Entries */}
          {prevEntries.length > 0 && (
            <div>
              <h2 className="font-bold text-gray-500 mb-3 text-xs uppercase tracking-widest border-b border-gray-200 pb-2">Previous Entries</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {prevEntries.slice(0, 8).map(entry => (
                  <DiaryCard key={entry.id} entry={entry} onEdit={openEdit} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!selectedTeacherId && !isTeacher && (
        <div className="bg-white rounded-xl p-12 text-center border border-gray-200 shadow-sm">
          <Users className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Select a teacher above to view or manage their diary.</p>
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="bg-indigo-700 px-6 py-4 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-lg text-white">{editId ? 'Edit Diary Entry' : 'New Diary Entry'}</h3>
                {currentSlot && (
                  <p className="text-indigo-200 text-xs mt-0.5">
                    {currentSlot.class_name} {currentSlot.section} · {currentSlot.subject_name} ·{' '}
                    {new Date(viewDate + 'T00:00:00').toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                )}
              </div>
              <button onClick={() => setShowForm(false)} className="text-indigo-200 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 bg-gray-50 space-y-5">
              <div>
                <label className="block text-xs font-black text-gray-600 uppercase mb-1.5">📖 Topic / Lesson Covered <span className="text-red-500">*</span></label>
                <textarea rows={3} value={form.topic_covered} onChange={e => setForm({ ...form, topic_covered: e.target.value })}
                  placeholder="e.g. Chapter 3: Photosynthesis — explained light reactions with diagram on board, Q&A session"
                  className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm resize-none focus:ring-indigo-500 focus:border-indigo-500" />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-600 uppercase mb-1.5">📝 Homework Assigned</label>
                <textarea rows={2} value={form.homework} onChange={e => setForm({ ...form, homework: e.target.value })}
                  placeholder="e.g. Exercise 3.1 Q1–Q5 on page 47, read pages 45–52"
                  className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm resize-none focus:ring-indigo-500" />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-600 uppercase mb-1.5">🎯 Classroom Activity / Notes</label>
                <textarea rows={2} value={form.activity_notes} onChange={e => setForm({ ...form, activity_notes: e.target.value })}
                  placeholder="e.g. Group activity completed, oral quiz: 85% answered correctly, 3 students struggling"
                  className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm resize-none focus:ring-indigo-500" />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-600 uppercase mb-1.5">🗓 Next Class Plan</label>
                <textarea rows={2} value={form.next_plan} onChange={e => setForm({ ...form, next_plan: e.target.value })}
                  placeholder="e.g. Begin dark reactions, worksheet practice, short quiz on completed topics"
                  className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm resize-none focus:ring-indigo-500" />
              </div>
            </div>

            <div className="px-6 py-4 bg-white border-t border-gray-200 flex justify-end gap-3 shrink-0">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow flex items-center gap-2 disabled:opacity-50">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : editId ? 'Update Entry' : 'Save Entry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DiaryCard({ entry, onEdit, onDelete }: { entry: any; onEdit: (e: any) => void; onDelete: (id: string) => any; key?: any }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition group">
      <div className="bg-indigo-50 border-b border-indigo-100 px-4 py-3 flex items-start justify-between">
        <div>
          <p className="font-black text-indigo-900 text-sm">{entry.subjects?.subject_name || 'General'}</p>
          <p className="text-xs text-indigo-600 font-medium mt-0.5">
            {entry.classes?.name} {entry.classes?.section} ·{' '}
            {new Date(entry.diary_date + 'T00:00:00').toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short' })}
          </p>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
          <button onClick={() => onEdit(entry)} className="p-1.5 text-indigo-400 hover:text-indigo-700 rounded-lg hover:bg-indigo-100 transition">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(entry.id)} className="p-1.5 text-indigo-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-wide">Topic Covered</p>
          <p className="text-sm font-bold text-gray-900 mt-0.5 leading-snug">{entry.topic_covered}</p>
        </div>
        {entry.homework && (
          <div className="bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
            <p className="text-[10px] font-black text-amber-600 uppercase">📝 Homework</p>
            <p className="text-xs text-amber-900 font-medium mt-0.5">{entry.homework}</p>
          </div>
        )}
        {entry.activity_notes && (
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase">🎯 Activity Notes</p>
            <p className="text-xs text-gray-600 mt-0.5">{entry.activity_notes}</p>
          </div>
        )}
        {entry.next_plan && (
          <div className="bg-green-50 rounded-lg px-3 py-2 border border-green-100">
            <p className="text-[10px] font-black text-green-600 uppercase">🗓 Next Class Plan</p>
            <p className="text-xs text-green-900 font-medium mt-0.5">{entry.next_plan}</p>
          </div>
        )}
      </div>
    </div>
  );
}
