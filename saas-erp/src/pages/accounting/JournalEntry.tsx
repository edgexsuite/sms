import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { FileText, Plus, Trash2, X, Download, BookOpen } from 'lucide-react';
import { exportToExcel } from '../../lib/exportUtils';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface JournalLine {
  id: string;
  account_id: string;
  account_name: string;
  description: string;
  debit: number;
  credit: number;
}

interface Entry {
  id: string;
  entry_date: string;
  reference_no: string;
  narration: string;
  status: string;
  lines?: JournalLine[];
  total_debit?: number;
}

export default function JournalEntry() {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ entry_date: new Date().toISOString().split('T')[0], reference_no: '', narration: '' });
  const [lines, setLines] = useState<{ id: string; account_id: string; description: string; debit: number; credit: number }[]>([
    { id: '1', account_id: '', description: '', debit: 0, credit: 0 },
    { id: '2', account_id: '', description: '', debit: 0, credit: 0 },
  ]);

  useEffect(() => {
    if (userRole?.school_id) { fetchEntries(); fetchAccounts(); }
  }, [userRole]);

  const fetchAccounts = async () => {
    const { data } = await supabase.from('accounts').select('id, code, name, account_type').eq('school_id', userRole!.school_id).eq('is_active', true).order('code');
    setAccounts(data || []);
  };

  const fetchEntries = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('journal_entries')
      .select('*, lines:journal_lines(*, account:account_id(name))')
      .eq('school_id', userRole!.school_id)
      .order('entry_date', { ascending: false })
      .limit(100);
    setEntries((data || []).map((e: any) => ({
      ...e,
      total_debit: (e.lines || []).reduce((s: number, l: any) => s + (l.debit || 0), 0),
    })));
    setLoading(false);
  };

  const addLine = () => setLines(prev => [...prev, { id: crypto.randomUUID(), account_id: '', description: '', debit: 0, credit: 0 }]);
  const removeLine = (id: string) => setLines(prev => prev.filter(l => l.id !== id));
  const updateLine = (id: string, field: string, value: any) => setLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));

  const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
  const isBalanced = totalDebit === totalCredit && totalDebit > 0;

  const save = async () => {
    if (!form.narration.trim() || !isBalanced) return;
    setSaving(true);
    const { data: entry } = await supabase.from('journal_entries').insert({
      school_id: userRole!.school_id, ...form, status: 'posted',
    }).select().single();

    if (entry) {
      const lineRecords = lines.filter(l => l.account_id && (l.debit > 0 || l.credit > 0)).map(l => ({
        entry_id: entry.id, account_id: l.account_id, description: l.description, debit: l.debit || 0, credit: l.credit || 0,
      }));
      await supabase.from('journal_lines').insert(lineRecords);

      // --- NEW: Mirror to Unified Ledger ---
      // Distinguish between actual Income/Expense movements for P&L visibility
      const expenseLines = lines.filter(l => {
        const acc = accounts.find(a => a.id === l.account_id);
        return acc?.account_type === 'expense' && (l.debit || 0) > 0;
      });
      const incomeLines = lines.filter(l => {
        const acc = accounts.find(a => a.id === l.account_id);
        return acc?.account_type === 'income' && (l.credit || 0) > 0;
      });

      if (expenseLines.length > 0) {
        const totalExp = expenseLines.reduce((s, l) => s + (l.debit || 0), 0);
        await supabase.from('financial_transactions').insert([{
           school_id: userRole?.school_id,
           type: 'expense',
           amount: totalExp,
           category: 'Adjustment (from Journal)',
           reference_id: entry.id,
           date: form.entry_date,
           remarks: `Journal Adj: ${form.narration}`
        }]);
      }
      if (incomeLines.length > 0) {
        const totalInc = incomeLines.reduce((s, l) => s + (l.credit || 0), 0);
        await supabase.from('financial_transactions').insert([{
           school_id: userRole?.school_id,
           type: 'income',
           amount: totalInc,
           category: 'Adjustment (from Journal)',
           reference_id: entry.id,
           date: form.entry_date,
           remarks: `Journal Adj: ${form.narration}`
        }]);
      }
    }

    setSaving(false); setShowModal(false); fetchEntries();
    setForm({ entry_date: new Date().toISOString().split('T')[0], reference_no: '', narration: '' });
    setLines([
      { id: '1', account_id: '', description: '', debit: 0, credit: 0 },
      { id: '2', account_id: '', description: '', debit: 0, credit: 0 },
    ]);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-violet-600" /> Journal Entries
          </h1>
          <p className="text-gray-500 text-sm mt-1">Record double-entry bookkeeping transactions.</p>
        </div>
        <div className="flex gap-2">
          {entries.length > 0 && (
            <button onClick={() => exportToExcel('journal-entries', entries, [
              { header: 'Date', key: 'entry_date' }, { header: 'Reference', key: 'reference_no' },
              { header: 'Narration', key: 'narration' }, { header: 'Amount', key: 'total_debit' },
            ])} className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
              <Download className="w-4 h-4" /> Export
            </button>
          )}
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700">
            <Plus className="w-4 h-4" /> New Entry
          </button>
        </div>
      </div>

      {/* Guidance Banner - Aura Style */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-violet-600 rounded-3xl p-6 flex items-center gap-6 shadow-2xl shadow-violet-100 border border-violet-500/20"
      >
        <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center shrink-0">
          <BookOpen className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-white font-black text-sm uppercase tracking-widest leading-none">Accounting Adjustment Engine</h3>
          <p className="text-violet-100 text-xs font-bold mt-1.5 opacity-80 leading-relaxed">
            Record non-cash adjustments, depreciation, and opening balances here. 
            All real cash outflows must be logged in <span className="underline cursor-pointer" onClick={() => navigate('/expenses')}>Expenses → Daily Expenses</span> for accurate liquidity and day-book tracking.
          </p>
        </div>
      </motion.div>

      {accounts.length === 0 && !loading && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
          <strong>Set up accounts first:</strong> Go to Chart of Accounts to define your accounting structure before posting entries.
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? <div className="p-12 text-center text-gray-400">Loading...</div>
          : entries.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-200" />
              <p>No journal entries yet. Click "New Entry" to post your first transaction.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">Date</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">Reference</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">Narration</th>
                  <th className="px-5 py-3 text-right font-medium text-gray-500">Amount (Dr)</th>
                  <th className="px-5 py-3 text-center font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {entries.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 text-gray-600 text-xs whitespace-nowrap">{e.entry_date}</td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-500">{e.reference_no || '—'}</td>
                    <td className="px-5 py-3 text-gray-900">{e.narration}</td>
                    <td className="px-5 py-3 text-right font-medium text-gray-900">{(e.total_debit || 0).toLocaleString()}</td>
                    <td className="px-5 py-3 text-center">
                      <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded-full">Posted</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="font-semibold text-gray-900">New Journal Entry</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                  <input type="date" value={form.entry_date} onChange={e => setForm({ ...form, entry_date: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Reference No.</label>
                  <input value={form.reference_no} onChange={e => setForm({ ...form, reference_no: e.target.value })} placeholder="JV-001"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Narration *</label>
                  <input value={form.narration} onChange={e => setForm({ ...form, narration: e.target.value })} placeholder="Transaction description"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500" />
                </div>
              </div>

              <table className="w-full text-sm border-collapse border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border border-gray-200 px-3 py-2 text-left font-medium text-gray-500">Account</th>
                    <th className="border border-gray-200 px-3 py-2 text-left font-medium text-gray-500">Description</th>
                    <th className="border border-gray-200 px-3 py-2 text-right font-medium text-green-700">Debit (Dr)</th>
                    <th className="border border-gray-200 px-3 py-2 text-right font-medium text-red-600">Credit (Cr)</th>
                    <th className="border border-gray-200 px-3 py-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map(l => (
                    <tr key={l.id}>
                      <td className="border border-gray-200 px-2 py-1.5">
                        <select value={l.account_id} onChange={e => updateLine(l.id, 'account_id', e.target.value)}
                          className="w-full border-0 text-sm focus:ring-0 bg-transparent">
                          <option value="">Select account...</option>
                          {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                        </select>
                      </td>
                      <td className="border border-gray-200 px-2 py-1.5">
                        <input value={l.description} onChange={e => updateLine(l.id, 'description', e.target.value)} placeholder="Optional"
                          className="w-full border-0 text-sm focus:ring-0 bg-transparent" />
                      </td>
                      <td className="border border-gray-200 px-2 py-1.5">
                        <input type="number" min="0" value={l.debit || ''} onChange={e => updateLine(l.id, 'debit', parseFloat(e.target.value) || 0)} placeholder="0"
                          className="w-full border-0 text-sm text-right focus:ring-0 bg-transparent" />
                      </td>
                      <td className="border border-gray-200 px-2 py-1.5">
                        <input type="number" min="0" value={l.credit || ''} onChange={e => updateLine(l.id, 'credit', parseFloat(e.target.value) || 0)} placeholder="0"
                          className="w-full border-0 text-sm text-right focus:ring-0 bg-transparent" />
                      </td>
                      <td className="border border-gray-200 px-2 py-1.5 text-center">
                        {lines.length > 2 && (
                          <button onClick={() => removeLine(l.id)}><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-bold text-sm">
                    <td className="border border-gray-200 px-3 py-2" colSpan={2}>Total</td>
                    <td className={`border border-gray-200 px-3 py-2 text-right ${isBalanced ? 'text-green-700' : 'text-red-600'}`}>{totalDebit.toLocaleString()}</td>
                    <td className={`border border-gray-200 px-3 py-2 text-right ${isBalanced ? 'text-green-700' : 'text-red-600'}`}>{totalCredit.toLocaleString()}</td>
                    <td className="border border-gray-200" />
                  </tr>
                </tbody>
              </table>

              <button onClick={addLine} className="flex items-center gap-1 text-sm text-violet-600 hover:text-violet-800">
                <Plus className="w-4 h-4" /> Add Line
              </button>

              {totalDebit > 0 && !isBalanced && (
                <p className="text-xs text-red-600">⚠ Entry is not balanced. Debit must equal Credit.</p>
              )}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-200">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={save} disabled={saving || !isBalanced || !form.narration.trim()}
                className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50">
                {saving ? 'Posting...' : 'Post Entry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
