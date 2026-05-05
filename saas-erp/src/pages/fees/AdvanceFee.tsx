import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CreditCard, Plus, Search, Download, Trash2 } from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';
import { formatDate } from '../../lib/utils';
import { PageHeader, Card, Btn, Input, EmptyState, FieldLabel } from '../../components/ui';

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
  const [form, setForm] = useState({ student_id: '', months: 1, month_start: '', amount: '', payment_mode: 'Cash' });

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
    // Ensure month_start has -01 suffix for Date processing if it doesn't already
    const baseDate = form.month_start.includes('-') && form.month_start.split('-').length === 2 
      ? `${form.month_start}-01` 
      : form.month_start;
    const startDate = new Date(baseDate);
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
    const { data: insertedRows, error: insertError } = await supabase.from('fee_records').insert(rows).select();
    if (insertError) { alert(insertError.message); setSaving(false); return; }

    // Record financial transaction for the total amount
    const student = students.find(s => s.id === form.student_id);
    const totalAmount = parseFloat(form.amount) * form.months;
    const monthsRange = rows.map(r => formatDate(r.month_year)).join(', ');
    
    await supabase.from('financial_transactions').insert({
      school_id: userRole!.school_id,
      type: 'income',
      category: 'Fee Collection',
      amount: totalAmount,
      date: new Date().toISOString().split('T')[0],
      payment_mode: form.payment_mode,
      remarks: `Advance Fee: ${student?.full_name} — [${monthsRange}]`,
    });

    setSaving(false);
    setIsModalOpen(false);
    setForm({ student_id: '', months: 1, month_start: '', amount: '', payment_mode: 'Cash' });
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
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader 
        title="Advance Fee" 
        subtitle="Fees collected in advance for upcoming months."
        icon={CreditCard}
        actions={
          <>
            <Btn variant="secondary" onClick={() => exportToCSV('advance-fees', filtered, [
              { header: 'Student', key: (r: AdvanceRecord) => r.student?.full_name || '' },
              { header: 'Roll No', key: (r: AdvanceRecord) => r.student?.roll_number || '' },
              { header: 'Class', key: (r: AdvanceRecord) => r.student?.class ? `${r.student.class.name}-${r.student.class.section}` : '' },
              { header: 'Month', key: 'month_year' },
              { header: 'Amount', key: 'paid_amount' },
            ])} icon={Download}>
              Export
            </Btn>
            <Btn onClick={() => setIsModalOpen(true)} icon={Plus}>
              Record Advance
            </Btn>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-6">
          <p className="text-sm font-medium text-slate-500">Total Advance Collected</p>
          <p className="text-3xl font-black text-indigo-600 mt-1">Rs. {totalAdvance.toLocaleString()}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm font-medium text-slate-500">Advance Records</p>
          <p className="text-3xl font-black text-slate-900 mt-1">{filtered.length}</p>
        </Card>
      </div>

      <Card>
        <div className="p-4 border-b border-slate-100">
          <div className="max-w-md">
            <Input 
              icon={Search}
              value={search} 
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by student name or roll number..." 
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Student</th>
                <th className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Class</th>
                <th className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Month</th>
                <th className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Amount Paid</th>
                <th className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">Status</th>
                <th className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-0"><EmptyState icon="🔍" title="No advance fee records found." sub="Try adjusting your search." /></td></tr>
              ) : filtered.map(r => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-slate-900">{r.student?.full_name}</p>
                    <p className="text-xs text-slate-500">Roll #{r.student?.roll_number}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {r.student?.class ? `${r.student.class.name}-${r.student.class.section}` : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{formatDate(r.month_year)}</td>
                  <td className="px-6 py-4 text-sm text-right font-mono font-semibold text-slate-900">Rs. {Number(r.paid_amount).toLocaleString()}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="px-2 py-1 text-[11px] font-bold rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">Advance</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Btn variant="ghost" size="sm" onClick={() => handleDelete(r.id)} className="text-rose-500 hover:text-rose-600 hover:bg-rose-50">
                      <Trash2 className="w-4 h-4" />
                    </Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-[15px] font-semibold text-slate-900">Record Advance Payment</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <FieldLabel required>Student</FieldLabel>
                <select required value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[13px] text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none">
                  <option value="">Select student...</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.full_name} (Roll #{s.roll_number})</option>)}
                </select>
              </div>
              <div>
                <FieldLabel required>Starting Month</FieldLabel>
                <input required type="month" value={form.month_start.slice(0, 7)} onChange={e => setForm({ ...form, month_start: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[13px] text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none" />
              </div>
              <div>
                <FieldLabel>Number of Months</FieldLabel>
                <input type="number" min="1" max="12" value={form.months} onChange={e => setForm({ ...form, months: parseInt(e.target.value) || 1 })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[13px] text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none" />
              </div>
              <div>
                <FieldLabel required>Amount per Month (Rs.)</FieldLabel>
                <input required type="number" min="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[13px] text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none" placeholder="0" />
              </div>
              <div>
                <FieldLabel required>Payment Mode</FieldLabel>
                <select required value={form.payment_mode} onChange={e => setForm({ ...form, payment_mode: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[13px] text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none">
                  {['Cash', 'Bank Transfer', 'Cheque', 'Online'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              {form.months > 1 && form.amount && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                  <p className="text-[13px] text-indigo-700">
                    Total: <span className="font-bold">Rs. {(form.months * parseFloat(form.amount || '0')).toLocaleString()}</span> for {form.months} months
                  </p>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Btn variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>Cancel</Btn>
                <Btn type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Record Payment'}
                </Btn>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
