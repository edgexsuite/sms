import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Wallet, Plus, X, Check, AlertCircle, Search } from 'lucide-react';
import { formatDate } from '../../lib/utils';

interface Advance {
  id: string;
  staff_id: string;
  amount: number;
  remaining_balance: number;
  monthly_deduction: number;
  given_date: string;
  reason: string;
  status: 'active' | 'cleared';
  staff?: { full_name: string; role: string; department: string };
}

const EMPTY_FORM = {
  staff_id: '',
  amount: '',
  monthly_deduction: '',
  given_date: new Date().toISOString().split('T')[0],
  reason: '',
};

export default function StaffAdvance() {
  const { userRole } = useAuth();
  const [advances, setAdvances]     = useState<Advance[]>([]);
  const [staffList, setStaffList]   = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState(false);
  const [saving, setSaving]         = useState(false);
  const [form, setForm]             = useState({ ...EMPTY_FORM });
  const [filterStaff, setFilterStaff] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'cleared'>('active');
  const [search, setSearch]         = useState('');
  const [error, setError]           = useState('');

  useEffect(() => {
    if (userRole?.school_id) { fetchStaff(); fetchAdvances(); }
  }, [userRole]);

  const fetchStaff = async () => {
    const { data } = await supabase.from('staff').select('id, full_name, role, department')
      .eq('school_id', userRole!.school_id).eq('is_active', true).order('full_name');
    setStaffList(data || []);
  };

  const fetchAdvances = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('staff_advances')
      .select('*, staff(full_name, role, department)')
      .eq('school_id', userRole!.school_id)
      .order('given_date', { ascending: false });
    setAdvances((data || []) as Advance[]);
    setLoading(false);
  };

  const handleSave = async () => {
    setError('');
    if (!form.staff_id) { setError('Please select a staff member.'); return; }
    if (!form.amount || Number(form.amount) <= 0) { setError('Enter a valid amount.'); return; }
    if (!form.given_date) { setError('Please enter the advance date.'); return; }

    setSaving(true);
    const sid = userRole!.school_id;
    const amount = Number(form.amount);
    const monthly = Number(form.monthly_deduction) || 0;

    // Insert advance record
    const { data: adv, error: advErr } = await supabase.from('staff_advances').insert({
      school_id: sid,
      staff_id: form.staff_id,
      amount,
      remaining_balance: amount,
      monthly_deduction: monthly,
      given_date: form.given_date,
      reason: form.reason,
      status: 'active',
    }).select().single();

    if (advErr) { setError(advErr.message); setSaving(false); return; }

    // Post to financial_transactions: expense — Staff Advance
    const staffMember = staffList.find(s => s.id === form.staff_id);
    await supabase.from('financial_transactions').insert({
      school_id: sid,
      type: 'expense',
      category: 'Staff Advance',
      amount,
      date: form.given_date,
      payment_mode: 'Cash',
      remarks: `Advance — ${staffMember?.full_name || ''} | Reason: ${form.reason || 'N/A'}`,
      staff_id: form.staff_id,
      reference_id: adv.id,
    });

    setModal(false);
    setForm({ ...EMPTY_FORM });
    fetchAdvances();
    setSaving(false);
  };

  const handleClear = async (adv: Advance) => {
    if (!window.confirm(`Mark advance for ${adv.staff?.full_name} as fully cleared?`)) return;
    await supabase.from('staff_advances').update({ status: 'cleared', remaining_balance: 0 }).eq('id', adv.id);
    fetchAdvances();
  };

  // Filter
  const filtered = advances.filter(a => {
    const name = a.staff?.full_name?.toLowerCase() || '';
    if (filterStatus !== 'all' && a.status !== filterStatus) return false;
    if (filterStaff && a.staff_id !== filterStaff) return false;
    if (search && !name.includes(search.toLowerCase())) return false;
    return true;
  });

  const totalGiven      = filtered.reduce((s, a) => s + a.amount, 0);
  const totalRemaining  = filtered.filter(a => a.status === 'active').reduce((s, a) => s + a.remaining_balance, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Wallet className="w-6 h-6 text-amber-500" /> Staff Advances
          </h1>
          <p className="text-gray-500 text-sm mt-1">Record salary advances and track repayment through payroll deductions.</p>
        </div>
        <button onClick={() => { setForm({ ...EMPTY_FORM }); setError(''); setModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600">
          <Plus className="w-4 h-4" /> Give Advance
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Active Advances</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{advances.filter(a => a.status === 'active').length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Disbursed (filtered)</p>
          <p className="text-2xl font-black text-red-600 mt-1">Rs. {totalGiven.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Outstanding</p>
          <p className="text-2xl font-black text-orange-600 mt-1">Rs. {totalRemaining.toLocaleString()}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search staff..." className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500" />
        </div>
        <select value={filterStaff} onChange={e => setFilterStaff(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500">
          <option value="">All Staff</option>
          {staffList.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>
        <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
          {(['all', 'active', 'cleared'] as const).map(v => (
            <button key={v} onClick={() => setFilterStatus(v)}
              className={`px-3 py-1 text-xs rounded-md font-medium capitalize ${filterStatus === v ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Wallet className="w-12 h-12 mx-auto mb-3 text-gray-200" />
            <p>No advances found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Staff Member</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Amount Given</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Remaining</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Monthly Deduct</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Reason</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{a.staff?.full_name}</p>
                      <p className="text-xs text-gray-400">{a.staff?.role}{a.staff?.department ? ` · ${a.staff.department}` : ''}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(a.given_date)}</td>
                    <td className="px-4 py-3 text-right font-mono text-red-600">Rs. {a.amount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold">
                      <span className={a.remaining_balance > 0 ? 'text-orange-600' : 'text-green-600'}>
                        Rs. {a.remaining_balance.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{a.monthly_deduction > 0 ? `Rs. ${a.monthly_deduction.toLocaleString()}` : '—'}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate">{a.reason || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${a.status === 'active' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {a.status === 'active' && (
                        <button onClick={() => handleClear(a)}
                          title="Mark as Cleared"
                          className="p-1.5 rounded hover:bg-green-50 text-green-600" >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex justify-between items-center p-5 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Give Staff Advance</h2>
              <button onClick={() => setModal(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Staff Member *</label>
                <select value={form.staff_id} onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500">
                  <option value="">Select staff…</option>
                  {staffList.map(s => <option key={s.id} value={s.id}>{s.full_name} — {s.role}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Advance Amount (Rs.) *</label>
                  <input type="number" min="1" value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500"
                    placeholder="e.g. 5000" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Monthly Deduction (Rs.)</label>
                  <input type="number" min="0" value={form.monthly_deduction}
                    onChange={e => setForm(f => ({ ...f, monthly_deduction: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500"
                    placeholder="e.g. 1000" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Date Given *</label>
                <input type="date" value={form.given_date}
                  onChange={e => setForm(f => ({ ...f, given_date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Reason</label>
                <input type="text" value={form.reason}
                  onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500"
                  placeholder="Medical, personal, etc." />
              </div>
              <div className="bg-amber-50 rounded-lg p-3 text-xs text-amber-800">
                <strong>Note:</strong> The advance amount will be posted as an <em>expense (Staff Advance)</em> in the ledger. Monthly deductions will be applied automatically during payroll processing.
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-gray-200">
              <button onClick={() => setModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50">
                {saving ? 'Saving…' : 'Give Advance'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
