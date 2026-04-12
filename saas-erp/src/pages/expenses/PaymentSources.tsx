import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Wallet, Plus, Trash2, Pencil, Save, X } from 'lucide-react';

interface PaymentSource {
  id: string;
  name: string;
  type: string;
  account_number: string;
  bank_name: string;
  balance: number;
  is_active: boolean;
}

const SOURCE_TYPES = ['Cash', 'Bank Account', 'Mobile Wallet', 'Cheque', 'Other'];

const DEFAULTS: Omit<PaymentSource, 'id'>[] = [
  { name: 'Main Cash', type: 'Cash', account_number: '', bank_name: '', balance: 0, is_active: true },
  { name: 'School Bank Account', type: 'Bank Account', account_number: '', bank_name: '', balance: 0, is_active: true },
];

export default function PaymentSources() {
  const { userRole } = useAuth();
  const [sources, setSources] = useState<PaymentSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'Cash', account_number: '', bank_name: '', balance: '' });

  useEffect(() => {
    if (userRole?.school_id) fetchSources();
  }, [userRole]);

  const fetchSources = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('form_settings')
      .select('sections_config')
      .eq('school_id', userRole!.school_id)
      .eq('form_name', 'payment_sources')
      .maybeSingle();
    setSources(data?.sections_config?.sources ?? []);
    setLoading(false);
  };

  const persist = async (updated: PaymentSource[]) => {
    await supabase.from('form_settings').upsert(
      { school_id: userRole!.school_id, form_name: 'payment_sources', sections_config: { sources: updated } },
      { onConflict: 'school_id,form_name' }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    let updated: PaymentSource[];
    if (editingId) {
      updated = sources.map(s => s.id === editingId ? { ...s, ...form, balance: parseFloat(form.balance) || 0 } : s);
    } else {
      updated = [...sources, { id: crypto.randomUUID(), ...form, balance: parseFloat(form.balance) || 0, is_active: true }];
    }
    setSources(updated);
    await persist(updated);
    setSaving(false);
    setIsModalOpen(false);
    setEditingId(null);
    setForm({ name: '', type: 'Cash', account_number: '', bank_name: '', balance: '' });
  };

  const handleEdit = (source: PaymentSource) => {
    setForm({ name: source.name, type: source.type, account_number: source.account_number, bank_name: source.bank_name, balance: String(source.balance) });
    setEditingId(source.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const updated = sources.filter(s => s.id !== id);
    setSources(updated);
    await persist(updated);
  };

  const handleToggleActive = async (id: string) => {
    const updated = sources.map(s => s.id === id ? { ...s, is_active: !s.is_active } : s);
    setSources(updated);
    await persist(updated);
  };

  const handleLoadDefaults = async () => {
    const defaults = DEFAULTS.map(d => ({ ...d, id: crypto.randomUUID() }));
    const updated = [...sources, ...defaults];
    setSources(updated);
    await persist(updated);
  };

  const typeIcon: Record<string, string> = { 'Cash': '💵', 'Bank Account': '🏦', 'Mobile Wallet': '📱', 'Cheque': '📄', 'Other': '💳' };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Wallet className="w-6 h-6 text-indigo-600" /> Payment Sources
          </h1>
          <p className="text-gray-500 text-sm mt-1">Manage payment accounts: cash, bank, mobile wallets.</p>
        </div>
        <div className="flex gap-2">
          {sources.length === 0 && (
            <button onClick={handleLoadDefaults} className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
              Load Defaults
            </button>
          )}
          <button onClick={() => { setEditingId(null); setForm({ name: '', type: 'Cash', account_number: '', bank_name: '', balance: '' }); setIsModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> Add Source
          </button>
        </div>
      </div>

      {loading ? <div className="p-12 text-center text-gray-400">Loading...</div> :
        sources.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-400">
            <Wallet className="w-10 h-10 mx-auto mb-3 text-gray-200" />
            <p>No payment sources configured yet.</p>
            <button onClick={handleLoadDefaults} className="mt-3 text-indigo-600 text-sm font-medium hover:underline">Load defaults (Cash + Bank)</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sources.map(source => (
              <div key={source.id} className={`bg-white rounded-xl shadow-sm border p-5 space-y-3 ${source.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{typeIcon[source.type] || '💳'}</span>
                    <div>
                      <p className="font-semibold text-gray-900">{source.name}</p>
                      <p className="text-xs text-gray-400">{source.type}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => handleEdit(source)} className="p-1.5 text-gray-400 hover:text-indigo-600"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(source.id)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                {source.bank_name && <p className="text-sm text-gray-500">{source.bank_name}</p>}
                {source.account_number && <p className="text-xs font-mono text-gray-400">{source.account_number}</p>}
                <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                  <button onClick={() => handleToggleActive(source.id)}
                    className={`text-xs px-2 py-1 rounded-full font-medium ${source.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {source.is_active ? 'Active' : 'Inactive'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold">{editingId ? 'Edit' : 'Add'} Payment Source</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source Name</label>
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Main Cash Drawer" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
                  {SOURCE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              {form.type === 'Bank Account' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                    <input value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="e.g. HBL, UBL, Meezan" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                    <input value={form.account_number} onChange={e => setForm({ ...form, account_number: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Source'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
