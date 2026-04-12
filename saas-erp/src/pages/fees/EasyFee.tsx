import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Zap, Search, CheckCircle } from 'lucide-react';

interface Student {
  id: string;
  full_name: string;
  roll_number: number;
  class_name: string;
  monthly_fee: number;
  pending_months: PendingFee[];
}

interface PendingFee {
  id: string;
  month_year: string;
  total_amount: number;
  paid_amount: number;
}

export default function EasyFee() {
  const { userRole } = useAuth();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [selected, setSelected] = useState<Student | null>(null);
  const [searching, setSearching] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('Cash');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim() || !userRole?.school_id) return;
    setSearching(true);
    setSelected(null);
    setSuccess(null);
    const { data } = await supabase
      .from('students')
      .select('id, full_name, roll_number, class:class_id(name, section)')
      .eq('school_id', userRole.school_id)
      .eq('status', 'active')
      .or(`full_name.ilike.%${search.trim()}%,roll_number.eq.${parseInt(search) || 0}`)
      .limit(10);
    setResults(data || []);
    setSearching(false);
  };

  const handleSelect = async (student: any) => {
    setResults([]);
    setSearch(student.full_name);
    const className = student.class ? `${student.class.name}-${student.class.section}` : '-';

    // Fetch pending fee records
    const { data: fees } = await supabase
      .from('fee_records')
      .select('id, month_year, total_amount, paid_amount')
      .eq('school_id', userRole!.school_id)
      .eq('student_id', student.id)
      .in('status', ['pending', 'partial'])
      .order('month_year', { ascending: true });

    // Fetch fee structure
    const { data: cls } = await supabase
      .from('fee_structures')
      .select('amount')
      .eq('school_id', userRole!.school_id)
      .limit(1)
      .maybeSingle();

    const pendingFees = fees || [];
    const totalDue = pendingFees.reduce((s: number, f: any) => s + (Number(f.total_amount) - Number(f.paid_amount)), 0);

    setSelected({
      id: student.id,
      full_name: student.full_name,
      roll_number: student.roll_number,
      class_name: className,
      monthly_fee: cls?.amount || 0,
      pending_months: pendingFees,
    });
    setPayAmount(String(totalDue || cls?.amount || ''));
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !payAmount) return;
    setSaving(true);

    const amount = parseFloat(payAmount);
    let remaining = amount;

    // Distribute payment across pending months oldest-first
    for (const fee of selected.pending_months) {
      if (remaining <= 0) break;
      const due = Number(fee.total_amount) - Number(fee.paid_amount);
      const paying = Math.min(remaining, due);
      const newPaid = Number(fee.paid_amount) + paying;
      const newStatus = newPaid >= Number(fee.total_amount) ? 'paid' : 'partial';
      await supabase.from('fee_records').update({
        paid_amount: newPaid,
        status: newStatus,
        payment_mode: payMode,
        paid_at: new Date().toISOString(),
      }).eq('id', fee.id);
      remaining -= paying;
    }

    // If no pending records existed, generate a new record for current month
    if (selected.pending_months.length === 0 && remaining > 0) {
      const today = new Date().toISOString().split('T')[0].slice(0, 7) + '-01';
      await supabase.from('fee_records').insert({
        school_id: userRole!.school_id,
        student_id: selected.id,
        month_year: today,
        total_amount: amount,
        paid_amount: amount,
        status: 'paid',
        payment_mode: payMode,
        paid_at: new Date().toISOString(),
      });
    }

    setSaving(false);
    setSuccess(`Rs. ${amount.toLocaleString()} collected for ${selected.full_name}`);
    setSelected(null);
    setSearch('');
    setPayAmount('');
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Zap className="w-6 h-6 text-yellow-500" /> Easy Fee Collection
        </h1>
        <p className="text-gray-500 text-sm mt-1">Quick one-click fee collection for walk-in payments.</p>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3 text-green-800">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div>
            <p className="font-medium">Payment recorded!</p>
            <p className="text-sm">{success}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Step 1 — Find Student</h2>
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => { setSearch(e.target.value); setSelected(null); setSuccess(null); }}
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              placeholder="Enter student name or roll number..." />
          </div>
          <button type="submit" disabled={searching} className="px-4 py-2 bg-yellow-500 text-white text-sm font-medium rounded-lg hover:bg-yellow-600 disabled:opacity-50">
            {searching ? 'Searching...' : 'Search'}
          </button>
        </form>

        {results.length > 0 && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            {results.map(s => (
              <button key={s.id} onClick={() => handleSelect(s)}
                className="w-full text-left px-4 py-3 hover:bg-yellow-50 border-b border-gray-100 last:border-0 flex justify-between items-center">
                <span className="font-medium text-gray-900">{s.full_name}</span>
                <span className="text-sm text-gray-500">Roll #{s.roll_number} · {s.class ? `${s.class.name}-${s.class.section}` : '-'}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="font-semibold text-gray-800">Step 2 — Collect Payment</h2>
              <div className="mt-2 space-y-0.5">
                <p className="text-lg font-bold text-gray-900">{selected.full_name}</p>
                <p className="text-sm text-gray-500">Roll #{selected.roll_number} · {selected.class_name}</p>
              </div>
            </div>
            <span className={`px-3 py-1 text-sm font-medium rounded-full ${selected.pending_months.length > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
              {selected.pending_months.length > 0 ? `${selected.pending_months.length} month(s) due` : 'No pending fees'}
            </span>
          </div>

          {selected.pending_months.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pending Months</p>
              {selected.pending_months.map(f => {
                const due = Number(f.total_amount) - Number(f.paid_amount);
                return (
                  <div key={f.id} className="flex justify-between text-sm">
                    <span className="text-gray-700">{new Date(f.month_year).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                    <span className="font-mono font-medium text-red-700">Rs. {due.toLocaleString()} due</span>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-gray-200 flex justify-between font-bold text-sm">
                <span>Total Due</span>
                <span className="font-mono text-red-700">
                  Rs. {selected.pending_months.reduce((s, f) => s + Number(f.total_amount) - Number(f.paid_amount), 0).toLocaleString()}
                </span>
              </div>
            </div>
          )}

          <form onSubmit={handlePay} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount Collecting (Rs.)</label>
                <input required type="number" min="1" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-mono font-bold focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label>
                <select value={payMode} onChange={e => setPayMode(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500">
                  <option>Cash</option><option>Cheque</option><option>Bank Transfer</option><option>JazzCash</option><option>EasyPaisa</option>
                </select>
              </div>
            </div>
            <button type="submit" disabled={saving}
              className="w-full py-3 bg-yellow-500 text-white font-bold text-sm rounded-lg hover:bg-yellow-600 disabled:opacity-50 flex items-center justify-center gap-2">
              <Zap className="w-4 h-4" /> {saving ? 'Processing...' : `Collect Rs. ${parseFloat(payAmount || '0').toLocaleString()}`}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
