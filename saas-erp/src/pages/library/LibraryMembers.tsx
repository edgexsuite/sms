import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Users, Plus, X, Trash2, Download } from 'lucide-react';
import { exportToExcel } from '../../lib/exportUtils';
import { formatDate } from '../../lib/utils';

interface Member {
  id: string;
  member_name: string;
  member_type: string;
  card_number: string;
  status: string;
  created_at: string;
}

export default function LibraryMembers() {
  const { userRole } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ member_type: 'student', member_id: '', custom_name: '', card_number: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (userRole?.school_id) { fetchMembers(); fetchStudents(); fetchStaff(); }
  }, [userRole]);

  const fetchMembers = async () => {
    setLoading(true);
    const { data } = await supabase.from('library_members').select('*').eq('school_id', userRole!.school_id).order('member_name');
    setMembers(data || []);
    setLoading(false);
  };

  const fetchStudents = async () => {
    const { data } = await supabase.from('students').select('id, full_name').eq('school_id', userRole!.school_id).eq('status', 'active').order('full_name');
    setStudents(data || []);
  };

  const fetchStaff = async () => {
    const { data } = await supabase.from('staff').select('id, full_name').eq('school_id', userRole!.school_id).eq('is_active', true).order('full_name');
    setStaff(data || []);
  };

  const save = async () => {
    const list = form.member_type === 'student' ? students : staff;
    const person = list.find(p => p.id === form.member_id);
    const name = person?.full_name || form.custom_name;
    if (!name) return;
    setSaving(true);
    const cardNum = form.card_number || `LIB-${Date.now().toString().slice(-6)}`;
    await supabase.from('library_members').insert({
      school_id: userRole!.school_id, member_type: form.member_type,
      member_id: form.member_id || null, member_name: name, card_number: cardNum, status: 'active',
    });
    setSaving(false); setShowModal(false); fetchMembers();
    setForm({ member_type: 'student', member_id: '', custom_name: '', card_number: '' });
  };

  const toggleStatus = async (id: string, current: string) => {
    const newStatus = current === 'active' ? 'inactive' : 'active';
    await supabase.from('library_members').update({ status: newStatus }).eq('id', id);
    setMembers(prev => prev.map(m => m.id === id ? { ...m, status: newStatus } : m));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-amber-600" /> Library Members
          </h1>
          <p className="text-gray-500 text-sm mt-1">Register students and staff as library borrowing members.</p>
        </div>
        <div className="flex gap-2">
          {members.length > 0 && (
            <button onClick={() => exportToExcel('library-members', members, [
              { header: 'Name', key: 'member_name' }, { header: 'Type', key: 'member_type' },
              { header: 'Card #', key: 'card_number' }, { header: 'Status', key: 'status' },
            ])} className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
              <Download className="w-4 h-4" /> Export
            </button>
          )}
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700">
            <Plus className="w-4 h-4" /> Add Member
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? <div className="p-12 text-center text-gray-400">Loading...</div>
          : members.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-200" />
              <p>No library members yet. Add students or staff as members.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">Name</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">Type</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">Card No.</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">Joined</th>
                  <th className="px-5 py-3 text-center font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {members.map(m => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{m.member_name}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${m.member_type === 'student' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                        {m.member_type}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-600">{m.card_number}</td>
                    <td className="px-5 py-3 text-xs text-gray-500">{formatDate(m.created_at)}</td>
                    <td className="px-5 py-3 text-center">
                      <button onClick={() => toggleStatus(m.id, m.status)}
                        className={`px-2 py-0.5 text-xs font-medium rounded-full cursor-pointer ${m.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {m.status}
                      </button>
                    </td>
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
              <h2 className="font-semibold text-gray-900">Add Library Member</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Member Type</label>
                <select value={form.member_type} onChange={e => setForm({ ...form, member_type: e.target.value, member_id: '' })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500">
                  <option value="student">Student</option>
                  <option value="staff">Staff</option>
                  <option value="other">Other</option>
                </select>
              </div>
              {form.member_type !== 'other' ? (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Select {form.member_type === 'student' ? 'Student' : 'Staff'}</label>
                  <select value={form.member_id} onChange={e => setForm({ ...form, member_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500">
                    <option value="">Select...</option>
                    {(form.member_type === 'student' ? students : staff).map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                  <input value={form.custom_name} onChange={e => setForm({ ...form, custom_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500" />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Card Number (auto-generated if blank)</label>
                <input value={form.card_number} onChange={e => setForm({ ...form, card_number: e.target.value })} placeholder="e.g. LIB-001"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500" />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-200">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={save} disabled={saving || (!form.member_id && !form.custom_name)}
                className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50">
                {saving ? 'Adding...' : 'Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
