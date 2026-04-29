import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  BookOpen, PlusCircle, Save, X, Search, Pencil, Trash2,
  ChevronLeft, ChevronRight, Calendar, ClipboardList
} from 'lucide-react';
import { formatDate } from '../../lib/utils';

export default function TeacherDiary() {
  const { userRole } = useAuth();
  const [teachers, setTeachers] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [viewDate, setViewDate] = useState(new Date().toISOString().split('T')[0]);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    teacher_id: '', class_id: '', subject_id: '', diary_date: new Date().toISOString().split('T')[0],
    topic_covered: '', homework: '', activity_notes: '', next_plan: ''
  });

  useEffect(() => { if (userRole?.school_id) fetchInit(); }, [userRole]);
  useEffect(() => { if (selectedClass) fetchSubjects(); }, [selectedClass]);
  useEffect(() => { fetchEntries(); }, [selectedTeacher, selectedClass, selectedSubject, viewDate, userRole]);

  const fetchInit = async () => {
    const [{ data: tchr }, { data: cls }] = await Promise.all([
      supabase.from('staff').select('id, full_name, role').eq('school_id', userRole?.school_id).eq('is_active', true).order('full_name'),
      supabase.from('classes').select('id, name, section').eq('school_id', userRole?.school_id).order('name'),
    ]);
    if (tchr) setTeachers(tchr);
    if (cls) setClasses(cls);
  };

  const fetchSubjects = async () => {
    const { data } = await supabase.from('subjects').select('*').eq('class_id', selectedClass).order('subject_name');
    if (data) setSubjects(data);
  };

  const fetchEntries = async () => {
    if (!userRole?.school_id) return;
    setLoading(true);
    let query = supabase.from('teacher_diary')
      .select(`*, staff(full_name), classes(name, section), subjects(subject_name)`)
      .eq('school_id', userRole.school_id)
      .order('diary_date', { ascending: false });

    if (selectedTeacher) query = query.eq('teacher_id', selectedTeacher);
    if (selectedClass) query = query.eq('class_id', selectedClass);
    if (selectedSubject) query = query.eq('subject_id', selectedSubject);

    const { data } = await query;
    if (data) setEntries(data);
    setLoading(false);
  };

  const openCreate = () => {
    setEditId(null);
    setForm({
      teacher_id: selectedTeacher || '',
      class_id: selectedClass || '',
      subject_id: selectedSubject || '',
      diary_date: viewDate,
      topic_covered: '', homework: '', activity_notes: '', next_plan: ''
    });
    setShowForm(true);
  };

  const openEdit = (e: any) => {
    setEditId(e.id);
    setSelectedClass(e.class_id);
    setForm({
      teacher_id: e.teacher_id, class_id: e.class_id, subject_id: e.subject_id || '',
      diary_date: e.diary_date, topic_covered: e.topic_covered,
      homework: e.homework || '', activity_notes: e.activity_notes || '', next_plan: e.next_plan || ''
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.teacher_id || !form.class_id || !form.topic_covered.trim()) return alert('Teacher, class, and topic are required.');
    setSaving(true);
    try {
      const payload = { ...form, school_id: userRole?.school_id };
      if (editId) {
        const { error } = await supabase.from('teacher_diary').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('teacher_diary').insert([payload]);
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

  const todayEntries = entries.filter(e => e.diary_date === viewDate);
  const otherEntries = entries.filter(e => e.diary_date !== viewDate);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-indigo-600" /> Teacher Diary
          </h1>
          <p className="text-gray-500 text-sm mt-1">Daily lesson plans, homework assignments, and activity logs by teacher/class.</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg font-bold shadow">
          <PlusCircle className="w-4 h-4" /> Add Diary Entry
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Teacher</label>
          <select value={selectedTeacher} onChange={e => setSelectedTeacher(e.target.value)} className="w-full border border-gray-300 px-3 py-2 rounded-lg bg-white text-sm">
            <option value="">All Teachers</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Class</label>
          <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="w-full border border-gray-300 px-3 py-2 rounded-lg bg-white text-sm">
            <option value="">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Subject</label>
          <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} className="w-full border border-gray-300 px-3 py-2 rounded-lg bg-white text-sm">
            <option value="">All Subjects</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
          </select>
        </div>

        {/* Date Navigator */}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date</label>
          <div className="flex items-center gap-1">
            <button onClick={() => shiftDate(-1)} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input type="date" value={viewDate} onChange={e => setViewDate(e.target.value)}
              className="flex-1 border border-gray-300 px-2 py-2 rounded-lg text-sm text-center" />
            <button onClick={() => shiftDate(1)} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Today's section */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <Calendar className="w-4 h-4 text-indigo-600" />
          <h2 className="font-bold text-gray-800">
            {formatDate(viewDate)}
          </h2>
          <span className="text-xs bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-bold">
            {todayEntries.length} {todayEntries.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl p-10 text-center text-gray-500 border border-gray-200 shadow-sm">Loading diary...</div>
        ) : todayEntries.length === 0 ? (
          <div className="bg-white rounded-xl p-10 text-center border-2 border-dashed border-gray-200">
            <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 font-medium">No diary entries for this date.</p>
            <button onClick={openCreate} className="mt-3 text-indigo-600 font-bold text-sm hover:underline">+ Add an entry for this day</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {todayEntries.map(entry => (
              <DiaryCard key={entry.id} entry={entry} onEdit={openEdit} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>

      {/* Older entries */}
      {otherEntries.length > 0 && (
        <div>
          <h2 className="font-bold text-gray-700 mb-3 text-sm uppercase tracking-wide border-b border-gray-200 pb-2">Previous Entries</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {otherEntries.slice(0, 10).map(entry => (
              <DiaryCard key={entry.id} entry={entry} onEdit={openEdit} onDelete={handleDelete} />
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">
            <div className="bg-indigo-700 px-6 py-4 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-lg text-white">{editId ? 'Edit Diary Entry' : 'New Diary Entry'}</h3>
              <button onClick={() => setShowForm(false)} className="text-indigo-200 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 bg-gray-50 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Teacher *</label>
                  <select value={form.teacher_id} onChange={e => setForm({ ...form, teacher_id: e.target.value })}
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg bg-white text-sm">
                    <option value="">-- Select Teacher --</option>
                    {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Class *</label>
                  <select value={form.class_id} onChange={e => { setForm({ ...form, class_id: e.target.value }); setSelectedClass(e.target.value); }}
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg bg-white text-sm">
                    <option value="">-- Select Class --</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Subject</label>
                  <select value={form.subject_id} onChange={e => setForm({ ...form, subject_id: e.target.value })}
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg bg-white text-sm">
                    <option value="">-- Select Subject --</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Date *</label>
                  <input type="date" value={form.diary_date} onChange={e => setForm({ ...form, diary_date: e.target.value })}
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Topic / Lesson Covered *</label>
                <textarea rows={2} value={form.topic_covered} onChange={e => setForm({ ...form, topic_covered: e.target.value })}
                  placeholder="e.g. Chapter 3: Photosynthesis — explained light reactions with diagram"
                  className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm resize-none" />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Homework Assigned</label>
                <textarea rows={2} value={form.homework} onChange={e => setForm({ ...form, homework: e.target.value })}
                  placeholder="e.g. Exercise 3.1 Q1-Q5, read pages 45-52"
                  className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm resize-none" />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Activity / Classroom Notes</label>
                <textarea rows={2} value={form.activity_notes} onChange={e => setForm({ ...form, activity_notes: e.target.value })}
                  placeholder="e.g. Group activity, quiz result: 85% scored above passing"
                  className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm resize-none" />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Next Class Plan</label>
                <textarea rows={2} value={form.next_plan} onChange={e => setForm({ ...form, next_plan: e.target.value })}
                  placeholder="e.g. Continue with dark reactions, begin worksheet practice"
                  className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm resize-none" />
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
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition">
      {/* Card Header */}
      <div className="bg-indigo-50 border-b border-indigo-100 px-4 py-3 flex items-start justify-between">
        <div>
          <p className="font-black text-indigo-900 text-sm">{entry.subjects?.subject_name || 'General'}</p>
          <p className="text-xs text-indigo-700 font-medium mt-0.5">
            {entry.staff?.full_name} · {entry.classes?.name} {entry.classes?.section}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onEdit(entry)} className="p-1 text-indigo-400 hover:text-indigo-700 rounded transition">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(entry.id)} className="p-1 text-indigo-400 hover:text-red-600 rounded transition">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4 space-y-3">
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-wide">Topic Covered</p>
          <p className="text-sm font-bold text-gray-900 mt-0.5">{entry.topic_covered}</p>
        </div>
        {entry.homework && (
          <div className="bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
            <p className="text-[10px] font-black text-amber-600 uppercase">📝 Homework</p>
            <p className="text-xs text-amber-900 font-medium mt-0.5">{entry.homework}</p>
          </div>
        )}
        {entry.activity_notes && (
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase">Activity Notes</p>
            <p className="text-xs text-gray-600 mt-0.5">{entry.activity_notes}</p>
          </div>
        )}
        {entry.next_plan && (
          <div className="bg-green-50 rounded-lg px-3 py-2 border border-green-100">
            <p className="text-[10px] font-black text-green-600 uppercase">🗓 Next Class</p>
            <p className="text-xs text-green-900 font-medium mt-0.5">{entry.next_plan}</p>
          </div>
        )}
        <p className="text-[10px] text-gray-400 text-right font-mono">
          {formatDate(entry.diary_date)}
        </p>
      </div>
    </div>
  );
}
