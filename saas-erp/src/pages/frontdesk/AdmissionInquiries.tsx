import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { UserPlus, Plus, X, Download } from 'lucide-react';
import { exportToExcel } from '../../lib/exportUtils';

const STATUSES = ['new', 'contacted', 'test_scheduled', 'enrolled', 'rejected'] as const;
type Status = typeof STATUSES[number];

const STATUS_STYLE: Record<Status, string> = {
  new: 'bg-blue-100 text-blue-800', contacted: 'bg-yellow-100 text-yellow-800',
  test_scheduled: 'bg-purple-100 text-purple-800', enrolled: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

const STATUS_LABEL: Record<Status, string> = {
  new: 'New', contacted: 'Contacted', test_scheduled: 'Test Scheduled', enrolled: 'Enrolled', rejected: 'Rejected',
};

interface Inquiry {
  id: string;
  student_name: string;
  father_name: string;
  contact_number: string;
  applying_for_class: string;
  inquiry_date: string;
  status: Status;
  notes: string;
}

const EMPTY = { student_name: '', father_name: '', contact_number: '', applying_for_class: '', inquiry_date: new Date().toISOString().split('T')[0], status: 'new' as Status, notes: '' };

export default function AdmissionInquiries() {
  const { userRole } = useAuth();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Status | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (userRole?.school_id) fetchInquiries();
  }, [userRole]);

  const fetchInquiries = async () => {
    setLoading(true);
    const { data } = await supabase.from('admission_inquiries').select('*').eq('school_id', userRole!.school_id).order('created_at', { ascending: false });
    setInquiries(data || []);
    setLoading(false);
  };

  const save = async () => {
    if (!form.student_name.trim()) return;
    setSaving(true);
    if (editId) {
      await supabase.from('admission_inquiries').update(form).eq('id', editId);
    } else {
      await supabase.from('admission_inquiries').insert({ ...form, school_id: userRole!.school_id });
    }
    setSaving(false); setShowModal(false); fetchInquiries();
  };

  const updateStatus = async (id: string, status: Status) => {
    await supabase.from('admission_inquiries').update({ status }).eq('id', id);
    setInquiries(prev => prev.map(i => i.id === id ? { ...i, status } : i));
  };

  const openEdit = (i: Inquiry) => {
    setForm({ student_name: i.student_name, father_name: i.father_name, contact_number: i.contact_number, applying_for_class: i.applying_for_class, inquiry_date: i.inquiry_date, status: i.status, notes: i.notes });
    setEditId(i.id); setShowModal(true);
  };

  const filtered = filter === 'all' ? inquiries : inquiries.filter(i => i.status === filter);
  const counts = STATUSES.reduce((acc, s) => { acc[s] = inquiries.filter(i => i.status === s).length; return acc; }, {} as Record<Status, number>);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-cyan-600" /> Admission Inquiries
          </h1>
          <p className="text-gray-500 text-sm mt-1">Track prospective student inquiries through the enrollment pipeline.</p>
        </div>
        <div className="flex gap-2">
          {inquiries.length > 0 && (
            <button onClick={() => exportToExcel('inquiries', inquiries, [
              { header: 'Student', key: 'student_name' }, { header: 'Father', key: 'father_name' },
              { header: 'Phone', key: 'contact_number' }, { header: 'Class', key: 'applying_for_class' },
              { header: 'Date', key: 'inquiry_date' }, { header: 'Status', key: 'status' },
            ])} className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
              <Download className="w-4 h-4" /> Export
            </button>
          )}
          <button onClick={() => { setForm(EMPTY); setEditId(null); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-700">
            <Plus className="w-4 h-4" /> Add Inquiry
          </button>
        </div>
      </div>

      {/* Pipeline summary */}
      <div className="grid grid-cols-5 gap-3">
        {STATUSES.map(s => (
          <button key={s} onClick={() => setFilter(filter === s ? 'all' : s)}
            className={`p-3 rounded-xl border text-center transition-all ${filter === s ? 'ring-2 ring-cyan-500 border-cyan-300 bg-cyan-50' : 'bg-white border-gray-200 hover:border-cyan-200'}`}>
            <p className="text-xl font-black text-gray-800">{counts[s]}</p>
            <p className="text-xs text-gray-500 mt-0.5">{STATUS_LABEL[s]}</p>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? <div className="p-12 text-center text-gray-400">Loading...</div>
          : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <UserPlus className="w-12 h-12 mx-auto mb-3 text-gray-200" />
              <p>No inquiries found. Add your first inquiry.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">Student / Father</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">Phone</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">Class</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">Date</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">Status</th>
                  <th className="px-5 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map(i => (
                  <tr key={i.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openEdit(i)}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{i.student_name}</p>
                      <p className="text-xs text-gray-400">{i.father_name}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{i.contact_number || '—'}</td>
                    <td className="px-5 py-3 text-gray-600">{i.applying_for_class || '—'}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{i.inquiry_date}</td>
                    <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                      <select value={i.status} onChange={e => updateStatus(i.id, e.target.value as Status)}
                        className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${STATUS_STYLE[i.status]}`}>
                        {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                      </select>
                    </td>
                    <td className="px-5 py-3" />
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">{editId ? 'Edit Inquiry' : 'New Inquiry'}</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-3">
              {[['student_name', 'Student Name *'], ['father_name', "Father's Name"], ['contact_number', 'Contact Number'], ['applying_for_class', 'Applying For Class']].map(([k, l]) => (
                <div key={k}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{l}</label>
                  <input value={(form as any)[k]} onChange={e => setForm({ ...form, [k]: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500" />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Inquiry Date</label>
                  <input type="date" value={form.inquiry_date} onChange={e => setForm({ ...form, inquiry_date: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Status })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500">
                    {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500" />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-200">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={save} disabled={saving || !form.student_name.trim()}
                className="px-4 py-2 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
