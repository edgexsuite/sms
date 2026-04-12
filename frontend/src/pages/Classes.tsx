import { useEffect, useState } from 'react';
import { Plus, Search, Pencil, Trash2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ClassRow {
  id: string;
  name: string;
  subject: string;
  schedule: string;
  room: string;
  capacity: number;
  teachers: { profiles: { first_name: string; last_name: string } } | null;
}

interface Teacher {
  id: string;
  subject: string;
  profiles: { first_name: string; last_name: string };
}

const emptyForm = { name: '', subject: '', teacherId: '', schedule: '', room: '', capacity: '30' };

export default function Classes() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  async function load() {
    const [{ data: cls }, { data: tch }] = await Promise.all([
      supabase.from('classes').select('*, teachers(profiles(first_name, last_name))').order('name'),
      supabase.from('teachers').select('id, subject, profiles(first_name, last_name)'),
    ]);
    setClasses((cls as ClassRow[]) ?? []);
    setTeachers((tch as Teacher[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = classes.filter(c =>
    `${c.name} ${c.subject} ${c.room}`.toLowerCase().includes(search.toLowerCase())
  );

  function openAdd() { setForm(emptyForm); setEditId(null); setShowModal(true); }
  function openEdit(c: ClassRow) {
    setForm({ name: c.name, subject: c.subject, teacherId: '', schedule: c.schedule, room: c.room, capacity: String(c.capacity) });
    setEditId(c.id);
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = { name: form.name, subject: form.subject, teacher_id: form.teacherId || null, schedule: form.schedule, room: form.room, capacity: Number(form.capacity) };
    if (editId) {
      await supabase.from('classes').update(payload).eq('id', editId);
    } else {
      await supabase.from('classes').insert(payload);
    }
    setShowModal(false);
    load();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this class?')) return;
    await supabase.from('classes').delete().eq('id', id);
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Classes</h2>
        <button onClick={openAdd} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Add Class
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search classes..." className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                <tr>
                  {['Class Name', 'Subject', 'Teacher', 'Schedule', 'Room', 'Capacity', 'Actions'].map(h => (
                    <th key={h} className="px-6 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-400">No classes found</td></tr>
                ) : filtered.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-800">{c.name}</td>
                    <td className="px-6 py-4"><span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-medium">{c.subject}</span></td>
                    <td className="px-6 py-4 text-gray-600">{c.teachers ? `${c.teachers.profiles.first_name} ${c.teachers.profiles.last_name}` : '—'}</td>
                    <td className="px-6 py-4 text-gray-500">{c.schedule || '—'}</td>
                    <td className="px-6 py-4 text-gray-500">{c.room || '—'}</td>
                    <td className="px-6 py-4 text-gray-600">{c.capacity}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(c)} className="text-blue-600 hover:text-blue-800"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(c.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{editId ? 'Edit Class' : 'Add Class'}</h3>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Class Name</label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Math 10A" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Subject</label><input required value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="e.g. Mathematics" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Teacher</label>
                <select value={form.teacherId} onChange={e => setForm(f => ({ ...f, teacherId: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select teacher (optional)</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.profiles.first_name} {t.profiles.last_name} — {t.subject}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Schedule</label><input value={form.schedule} onChange={e => setForm(f => ({ ...f, schedule: e.target.value }))} placeholder="e.g. Mon/Wed 9am" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Room</label><input value={form.room} onChange={e => setForm(f => ({ ...f, room: e.target.value }))} placeholder="e.g. Room 101" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              </div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Capacity</label><input type="number" min="1" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-60">{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
