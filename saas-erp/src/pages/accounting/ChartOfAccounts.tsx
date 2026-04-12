import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { BookOpen, Plus, Trash2, Save } from 'lucide-react';

const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'income', 'expense'] as const;
type AccountType = typeof ACCOUNT_TYPES[number];

const TYPE_COLORS: Record<AccountType, string> = {
  asset: 'bg-blue-100 text-blue-800', liability: 'bg-red-100 text-red-800',
  equity: 'bg-purple-100 text-purple-800', income: 'bg-green-100 text-green-800',
  expense: 'bg-orange-100 text-orange-800',
};

interface Account {
  id: string;
  code: string;
  name: string;
  account_type: AccountType;
  is_active: boolean;
  balance?: number;
}

const DEFAULT_ACCOUNTS: Omit<Account, 'id'>[] = [
  { code: '1001', name: 'Cash in Hand', account_type: 'asset', is_active: true },
  { code: '1002', name: 'Bank Account', account_type: 'asset', is_active: true },
  { code: '1003', name: 'Fee Receivable', account_type: 'asset', is_active: true },
  { code: '2001', name: 'Accounts Payable', account_type: 'liability', is_active: true },
  { code: '3001', name: 'School Fund', account_type: 'equity', is_active: true },
  { code: '4001', name: 'Tuition Fee Income', account_type: 'income', is_active: true },
  { code: '4002', name: 'Admission Fee Income', account_type: 'income', is_active: true },
  { code: '5001', name: 'Staff Salaries', account_type: 'expense', is_active: true },
  { code: '5002', name: 'Utilities Expense', account_type: 'expense', is_active: true },
  { code: '5003', name: 'Stationery Expense', account_type: 'expense', is_active: true },
];

export default function ChartOfAccounts() {
  const { userRole } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', account_type: 'asset' as AccountType });
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (userRole?.school_id) fetchAccounts();
  }, [userRole]);

  const fetchAccounts = async () => {
    setLoading(true);
    const { data } = await supabase.from('accounts').select('*').eq('school_id', userRole!.school_id).order('code');
    setAccounts(data || []);
    setLoading(false);
  };

  const save = async () => {
    if (!form.code.trim() || !form.name.trim()) return;
    setSaving(true);
    await supabase.from('accounts').insert({ ...form, school_id: userRole!.school_id, is_active: true });
    setForm({ code: '', name: '', account_type: 'asset' });
    setShowForm(false);
    setSaving(false);
    fetchAccounts();
  };

  const remove = async (id: string) => {
    await supabase.from('accounts').delete().eq('id', id);
    setAccounts(prev => prev.filter(a => a.id !== id));
  };

  const seedDefaults = async () => {
    setSeeding(true);
    const records = DEFAULT_ACCOUNTS.map(a => ({ ...a, school_id: userRole!.school_id }));
    await supabase.from('accounts').upsert(records, { onConflict: 'school_id,code' });
    await fetchAccounts();
    setSeeding(false);
  };

  const grouped = ACCOUNT_TYPES.reduce((acc, type) => {
    acc[type] = accounts.filter(a => a.account_type === type);
    return acc;
  }, {} as Record<AccountType, Account[]>);

  if (loading) return <div className="p-12 text-center text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-violet-600" /> Chart of Accounts
          </h1>
          <p className="text-gray-500 text-sm mt-1">Define your school's accounting structure.</p>
        </div>
        <div className="flex gap-2">
          {accounts.length === 0 && (
            <button onClick={seedDefaults} disabled={seeding}
              className="px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50">
              {seeding ? 'Loading...' : 'Load Default Accounts'}
            </button>
          )}
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700">
            <Plus className="w-4 h-4" /> Add Account
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">New Account</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Account Code</label>
              <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })}
                placeholder="e.g. 1001" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Account Name</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Cash in Hand" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
              <select value={form.account_type} onChange={e => setForm({ ...form, account_type: e.target.value as AccountType })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500">
                {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={save} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50">
              <Save className="w-4 h-4" /> Save
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}

      {ACCOUNT_TYPES.map(type => {
        const items = grouped[type];
        if (items.length === 0) return null;
        return (
          <div key={type} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800 capitalize">{type}s</h2>
              <span className="text-xs text-gray-400">{items.length} accounts</span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-2 text-left font-medium text-gray-500 w-28">Code</th>
                  <th className="px-5 py-2 text-left font-medium text-gray-500">Account Name</th>
                  <th className="px-5 py-2 text-center font-medium text-gray-500 w-24">Type</th>
                  <th className="px-5 py-2 w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-mono text-xs text-gray-600">{a.code}</td>
                    <td className="px-5 py-3 font-medium text-gray-900">{a.name}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${TYPE_COLORS[a.account_type]}`}>{a.account_type}</span>
                    </td>
                    <td className="px-5 py-3">
                      <button onClick={() => remove(a.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      {accounts.length === 0 && !showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center text-gray-400">
          <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p>No accounts set up yet.</p>
          <p className="text-xs mt-1">Click "Load Default Accounts" to start with a standard chart of accounts.</p>
        </div>
      )}
    </div>
  );
}
