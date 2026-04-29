import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CreditCard, Plus, Search, Download, Trash2 } from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';
import { formatDate } from '../../lib/utils';

interface AdvanceRecord {
  id: string;
  student_id: string;
  month_year: string;
  total_amount: number;
  paid_amount: number;
  status: string;
  student: { full_name: string; roll_number: number; class: { name: string; section: string } | null } | null;
}

export default function AdvanceFee() {
  const { userRole } = useAuth();
  const [records, setRecords] = useState<AdvanceRecord[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ student_id: '', months: 1, month_start: '', amount: '' });

  useEffect(() => {
    if (userRole?.school_id) { fetchRecords(); fetchStudents(); }
  }, [userRole]);

  const fetchRecords = async () => {
    setLoading(true);
    // Advance fees: paid_amount >= total_amount for a future month
    const today = new Date().toISOString().split('T')[0].slice(0, 7); // YYYY-MM
    const { data } = await supabase
      .from('fee_records')
      .select('id, student_id, month_year, total_amount, paid_amount, status, student:student_id(full_name, roll_number, class:class_id(name, section))')
      .eq('school_id', userRole!.school_id)
      .eq('status', 'paid')
      .is('deleted_at', null)
      .gt('month_year', today + '-01')
      .order('month_year', { ascending: true });
    setRecords((data as any) || []);
    setLoading(false);
  };

  const fetchStudents = async () => {
    const { data } = await supabase
      .from('students')
      .select('id, full_name, roll_number, class:class_id(name, section, fee_structures(amount))')
      .eq('school_id', userRole!.school_id)
      .eq('status', 'active')
      .order('full_name');
    setStudents(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.student_id || !form.month_start || !form.amount) return;
    setSaving(true);
    const startDate = new Date(form.month_start);
    const rows = Array.from({ length: form.months }, (_, i) => {
      const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
      return {
        school_id: userRole!.school_id,
        student_id: form.student_id,
        month_year: d.toISOString().split('T')[0],
        total_amount: parseFloat(form.amount),
        paid_amount: parseFloat(form.amount),
        status: 'paid',
      };
    });
    await supabase.from('fee_records').insert(rows);
    setSaving(false);
    setIsModalOpen(false);
    setForm({ student_id: '', months: 1, month_start: '', amount: '' });
    fetchRecords();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this advance fee record?')) return;
    try {
      const { error } = await supabase.from('fee_records').update({ deleted_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      fetchRecords();
    } catch (err: any) { alert(err.message); }
  };

  const filtered = records.filter(r =>
    r.student?.full_name.toLowerCase().includes(search.toLowerCase()) ||
    String(r.student?.roll_number).includes(search)
  );

  const totalAdvance = filtered.reduce((s, r) => s + r.paid_amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-blue-600" /> Advance Fee
          </h1>
          <p className="text-gray-500 text-sm mt-1">Fees collected in advance for upcoming months.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportToCSV('advance-fees', filtered, [
            { header: 'Student', key: (r: AdvanceRecord) => r.student?.full_name || '' },
            { header: 'Roll No', key: (r: AdvanceRecord) => r.student?.roll_number || '' },
            { header: 'Class', key: (r: AdvanceRecord) => r.student?.class ? `${r.student.class.name}-${r.student.class.section}` : '' },
            { header: 'Month', key: 'month_year' },
            { header: 'Amount', key: 'paid_amount' },
          ])} className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Record Advance
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-500">Total Advance Collected</p>
          <p className="text-3xl font-black text-blue-600 mt-1">Rs. {totalAdvance.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-500">Advance Records</p>
          <p className="text-3xl font-black text-gray-800 mt-1">{filtered.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Search by student name or roll number..." />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Student</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Class</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Month</th>
                <th className="px-6 py-3 text-right font-medium text-gray-500">Amount Paid</th>
                <th className="px-6 py-3 text-center font-medium text-gray-500">Status</th>
                <th className="px-6 py-3 text-right font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-12 text-center text-gray-400">No advance fee records found.</td></tr>
              ) : filtered.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{r.student?.full_name}</p>
                    <p className="text-xs text-gray-400">Roll #{r.student?.roll_number}</p>
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {r.student?.class ? `${r.student.class.name}-${r.student.class.section}` : '-'}
                  </td>
                  <td className="px-6 py-4 text-gray-600">{formatDate(r.month_year)}</td>
                  <td className="px-6 py-4 text-right font-mono font-medium text-gray-900">Rs. {Number(r.paid_amount).toLocaleString()}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">Advance</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleDelete(r.id)} className="p-1.5 text-gray-400 hover:text-red-600 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Record Advance Payment</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Student</label>
                <select required value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="">Select student...</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.full_name} (Roll #{s.roll_number})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Starting Month</label>
                <input required type="month" value={form.month_start} onChange={e => setForm({ ...form, month_start: e.target.value + '-01' })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Number of Months</label>
                <input type="number" min="1" max="12" value={form.months} onChange={e => setForm({ ...form, months: parseInt(e.target.value) || 1 })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount per Month (Rs.)</label>
                <input required type="number" min="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="0" />
              </div>
              {form.months > 1 && form.amount && (
                <p className="text-sm text-gray-500 bg-blue-50 p-3 rounded-lg">
                  Total: <strong>Rs. {(form.months * parseFloat(form.amount || '0')).toLocaleString()}</strong> for {form.months} months
                </p>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Saving...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
