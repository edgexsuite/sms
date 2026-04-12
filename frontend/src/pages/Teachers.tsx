import { useEffect, useState } from 'react';
import { Plus, Search, Pencil, Trash2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Teacher {
  id: string;
  subject: string;
  qualification: string;
  employee_number: string;
  profiles: { first_name: string; last_name: string; email: string };
}

const emptyForm = { firstName: '', lastName: '', email: '', subject: '', qualification: '' };

export default function Teachers() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from('teachers')
      .select('*, profiles(first_name, last_name, email)')
      .order('created_at', { ascending: false });
    setTeachers((data as Teacher[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = teachers.filter(t =>
    `${t.profiles?.first_name} ${t.profiles?.last_name} ${t.subject} ${t.profiles?.email}`
      .toLowerCase().includes(search.toLowerCase())
  );

  function openAdd() { setForm(emptyForm); setEditId(null); setShowModal(true); }
  function openEdit(t: Teacher) {
    setForm({ firstName: t.profiles.first_name, lastName: t.profiles.last_name, email: t.profiles.email, subject: t.subject, qualification: t.qualification });
    setEditId(t.id);
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    if (editId) {
      await supabase.from('teachers').update({ subject: form.subject, qualification: form.qualification }).eq('id', editId);
    } else {
      const profileId = crypto.randomUUID();
      await supabase.from('profiles').insert({ id: profileId, first_name: form.firstName, last_name: form.lastName, email: form.email, role: 'teacher' });
      await supabase.from('teachers').insert({ profile_id: profileId, subject: form.subject, qualification: form.qualification || null });
    }
    setShowModal(false);
    load();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this teacher?')) return;
    await supabase.from('teachers').delete().eq('id', id);
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Teachers</h2>
        <button onClick={openAdd} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Add Teacher
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search teachers..." className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                <tr>
                  {['Name', 'Email', 'Subject', 'Qualification', 'Employee No.', 'Actions'].map(h => (
                    <th key={h} className="px-6 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">No teachers found</td></tr>
                ) : filtered.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-800">{t.profiles?.first_name} {t.profiles?.last_name}</td>
                    <td className="px-6 py-4 text-gray-600">{t.profiles?.email}</td>
                    <td className="px-6 py-4"><span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-medium">{t.subject}</span></td>
                    <td className="px-6 py-4 text-gray-600">{t.qualification || '—'}</td>
                    <td className="px-6 py-4 text-gray-500">{t.employee_number || '—'}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(t)} className="text-blue-600 hover:text-blue-800"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(t.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
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
              <h3 className="text-lg font-semibold">{editId ? 'Edit Teacher' : 'Add Teacher'}</h3>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              {!editId && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-xs font-medium text-gray-700 mb-1">First Name</label><input required value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                    <div><label className="block text-xs font-medium text-gray-700 mb-1">Last Name</label><input required value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                  </div>
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Email</label><input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                </>
              )}
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Subject</label><input required value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="e.g. Mathematics" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Qualification</label><input value={form.qualification} onChange={e => setForm(f => ({ ...f, qualification: e.target.value }))} placeholder="e.g. B.Ed Mathematics" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
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
