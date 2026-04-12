import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';

interface FineRule {
  id: string;
  name: string;
  type: 'flat' | 'per_day' | 'percentage';
  amount: number;
  grace_days: number;
}

export default function FinePolicy() {
  const { userRole } = useAuth();
  const [rules, setRules] = useState<FineRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'flat' as FineRule['type'], amount: '', grace_days: '0' });

  useEffect(() => {
    if (userRole?.school_id) fetchRules();
  }, [userRole]);

  const fetchRules = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('form_settings')
      .select('sections_config')
      .eq('school_id', userRole!.school_id)
      .eq('form_name', 'fine_policy')
      .maybeSingle();
    setRules(data?.sections_config?.rules ?? []);
    setLoading(false);
  };

  const persist = async (updated: FineRule[]) => {
    setSaving(true);
    await supabase.from('form_settings').upsert(
      { school_id: userRole!.school_id, form_name: 'fine_policy', sections_config: { rules: updated } },
      { onConflict: 'school_id,form_name' }
    );
    setSaving(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated = [...rules, { id: crypto.randomUUID(), name: form.name.trim(), type: form.type, amount: parseFloat(form.amount) || 0, grace_days: parseInt(form.grace_days) || 0 }];
    setRules(updated);
    await persist(updated);
    setIsModalOpen(false);
    setForm({ name: '', type: 'flat', amount: '', grace_days: '0' });
  };

  const handleDelete = async (id: string) => {
    const updated = rules.filter(r => r.id !== id);
    setRules(updated);
    await persist(updated);
  };

  const typeLabel = (t: FineRule['type']) => t === 'flat' ? 'Flat Amount' : t === 'per_day' ? 'Per Day' : 'Percentage';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-orange-500" /> Fine Policy
          </h1>
          <p className="text-gray-500 text-sm mt-1">Configure late payment fines applied during fee collection.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700">
          <Plus className="w-4 h-4" /> Add Rule
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        <strong>How it works:</strong> Fine rules are applied in the payment modal when collecting fees.
        Grace days allow a buffer before fines start. Per-day fines are multiplied by days overdue.
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading...</div>
        ) : rules.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p>No fine rules configured yet. Add your first rule above.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Rule Name</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Type</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Amount</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Grace Days</th>
                <th className="px-6 py-3 text-right font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rules.map(rule => (
                <tr key={rule.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{rule.name}</td>
                  <td className="px-6 py-4 text-gray-600">{typeLabel(rule.type)}</td>
                  <td className="px-6 py-4 font-mono text-gray-900">
                    {rule.type === 'percentage' ? `${rule.amount}%` : `Rs. ${rule.amount}`}
                  </td>
                  <td className="px-6 py-4 text-gray-600">{rule.grace_days} days</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleDelete(rule.id)} className="text-red-500 hover:text-red-700 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {saving && <div className="p-3 text-center text-xs text-indigo-600 border-t border-gray-100">Saving...</div>}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Add Fine Rule</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleAdd} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name</label>
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="e.g. Late Payment Fine" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fine Type</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as FineRule['type'] })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500">
                  <option value="flat">Flat Amount (one-time)</option>
                  <option value="per_day">Per Day (× days late)</option>
                  <option value="percentage">Percentage of fee</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount {form.type === 'percentage' ? '(%)' : '(Rs.)'}</label>
                <input required type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500" placeholder="0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Grace Days (fine-free buffer)</label>
                <input type="number" min="0" value={form.grace_days} onChange={e => setForm({ ...form, grace_days: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium bg-orange-600 text-white rounded-lg hover:bg-orange-700">Add Rule</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
