import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Layout, Plus, Trash2, Save, ChevronDown, ChevronUp, Tag, X } from 'lucide-react';
import HelpBanner from '../../components/HelpBanner';

interface FeeItem { item: string; amount: number; }
interface FeeMatrix { recurrent: FeeItem[]; first_time: FeeItem[]; }
interface FeeStructure {
  id: string; class_id: string; amount: number;
  fee_matrix: FeeMatrix; class_name: string;
}

const DEFAULT_RECURRING_ITEMS = [
  'Tuition Fee', 'Computer Lab Fee', 'Sports Fee',
  'Library Fee', 'Transport Fee', 'Utility / Misc Fee',
];
const DEFAULT_ONETIME_ITEMS = [
  'Admission Fee', 'Registration Fee', 'Security Deposit',
  'Prospectus Fee', 'Laboratory Fee', 'Identity Card Fee', 'Examination Fee',
];

// ── Combobox: text input backed by a datalist ─────────────────────────────────
function FeeItemCombobox({
  value, onChange, items, placeholder,
}: { value: string; onChange: (v: string) => void; items: string[]; placeholder?: string }) {
  const id = React.useId();
  return (
    <>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        list={id}
        placeholder={placeholder ?? 'Select or type fee name'}
        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      />
      <datalist id={id}>
        {items.map(it => <option key={it} value={it} />)}
      </datalist>
    </>
  );
}

export default function FeeTemplates() {
  const { userRole } = useAuth();
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newClassId, setNewClassId] = useState('');

  // Master fee items library
  const [recurringItems, setRecurringItems] = useState<string[]>(DEFAULT_RECURRING_ITEMS);
  const [onetimeItems, setOnetimeItems] = useState<string[]>(DEFAULT_ONETIME_ITEMS);
  const [newRecurring, setNewRecurring] = useState('');
  const [newOnetime, setNewOnetime] = useState('');
  const [savingItems, setSavingItems] = useState(false);
  const [showItemsPanel, setShowItemsPanel] = useState(false);

  useEffect(() => {
    if (userRole?.school_id) { fetchStructures(); fetchClasses(); fetchFeeItems(); }
  }, [userRole]);

  // ── Fee Items Master List ────────────────────────────────────────────────
  const fetchFeeItems = async () => {
    const { data } = await supabase
      .from('form_settings')
      .select('sections_config')
      .eq('school_id', userRole!.school_id)
      .eq('form_name', 'fee_item_names')
      .maybeSingle();
    if (data?.sections_config) {
      if (data.sections_config.recurring?.length) setRecurringItems(data.sections_config.recurring);
      if (data.sections_config.onetime?.length)   setOnetimeItems(data.sections_config.onetime);
    }
  };

  const saveFeeItems = async (recurring: string[], onetime: string[]) => {
    setSavingItems(true);
    await supabase.from('form_settings').upsert(
      { school_id: userRole!.school_id, form_name: 'fee_item_names', sections_config: { recurring, onetime } },
      { onConflict: 'school_id,form_name' }
    );
    setSavingItems(false);
  };

  const addRecurring = () => {
    const v = newRecurring.trim();
    if (!v || recurringItems.includes(v)) return;
    const updated = [...recurringItems, v];
    setRecurringItems(updated); setNewRecurring('');
    saveFeeItems(updated, onetimeItems);
  };

  const addOnetime = () => {
    const v = newOnetime.trim();
    if (!v || onetimeItems.includes(v)) return;
    const updated = [...onetimeItems, v];
    setOnetimeItems(updated); setNewOnetime('');
    saveFeeItems(recurringItems, updated);
  };

  const removeRecurring = (it: string) => {
    const updated = recurringItems.filter(x => x !== it);
    setRecurringItems(updated); saveFeeItems(updated, onetimeItems);
  };

  const removeOnetime = (it: string) => {
    const updated = onetimeItems.filter(x => x !== it);
    setOnetimeItems(updated); saveFeeItems(recurringItems, updated);
  };

  // ── Fee Structures ───────────────────────────────────────────────────────
  const fetchStructures = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('fee_structures')
      .select('id, class_id, amount, fee_matrix, class:class_id(name, section)')
      .eq('school_id', userRole!.school_id);
    setStructures((data || []).map((s: any) => ({
      ...s,
      class_name: s.class ? `${s.class.name}-${s.class.section}` : 'Unknown',
      fee_matrix: s.fee_matrix || {
        recurrent: [{ item: 'Tuition Fee', amount: 0 }],
        first_time: [{ item: 'Admission Fee', amount: 0 }],
      },
    })));
    setLoading(false);
  };

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('id, name, section')
      .eq('school_id', userRole!.school_id).order('name');
    setClasses(data || []);
  };

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassId) return;
    const { error } = await supabase.from('fee_structures').insert({
      school_id: userRole!.school_id, class_id: newClassId, amount: 0,
      fee_matrix: { recurrent: [{ item: 'Tuition Fee', amount: 0 }], first_time: [{ item: 'Admission Fee', amount: 0 }] },
    });
    if (!error) { fetchStructures(); setIsModalOpen(false); setNewClassId(''); }
  };

  const addItem = (id: string, section: 'recurrent' | 'first_time') =>
    setStructures(prev => prev.map(s => s.id === id ? {
      ...s, fee_matrix: { ...s.fee_matrix, [section]: [...s.fee_matrix[section], { item: '', amount: 0 }] }
    } : s));

  const removeItem = (id: string, section: 'recurrent' | 'first_time', idx: number) =>
    setStructures(prev => prev.map(s => s.id === id ? {
      ...s, fee_matrix: { ...s.fee_matrix, [section]: s.fee_matrix[section].filter((_, i) => i !== idx) }
    } : s));

  const updateItem = (id: string, section: 'recurrent' | 'first_time', idx: number, field: 'item' | 'amount', value: string) =>
    setStructures(prev => prev.map(s => s.id === id ? {
      ...s, fee_matrix: {
        ...s.fee_matrix,
        [section]: s.fee_matrix[section].map((it, i) =>
          i === idx ? { ...it, [field]: field === 'amount' ? parseFloat(value) || 0 : value } : it
        )
      }
    } : s));

  const handleSave = async (structure: FeeStructure) => {
    setSaving(structure.id);
    const totalRecurrent = structure.fee_matrix.recurrent.reduce((s, i) => s + i.amount, 0);
    await supabase.from('fee_structures')
      .update({ fee_matrix: structure.fee_matrix, amount: totalRecurrent })
      .eq('id', structure.id);
    setSaving(null);
    fetchStructures();
  };

  // All items for combobox (recurring + one-time merged as suggestions per section)
  const allRecurring = recurringItems;
  const allOnetime   = onetimeItems;

  return (
    <div className="space-y-6">
      {/* Onboarding Help */}
      <HelpBanner
        storageKey="help_fee_templates"
        title="How to set up Fee Templates"
        color="indigo"
        steps={[
          'Click "Add Class Template" to create a fee structure for a class (e.g. Class 5 - A).',
          'Under Recurring Fees add monthly items: Tuition Fee, Sports Fee, Computer Lab Fee — with their amounts.',
          'Under One-Time Fees add admission-only charges: Admission Fee, Registration Fee, Security Deposit.',
          'Click Save. These amounts will auto-load when you create Monthly or One-Time invoices for students in that class.',
        ]}
        tip='Tip: Click "Fee Items Library" to add custom item names that appear in the dropdown across all fee modules.'
      />

      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Layout className="w-6 h-6 text-indigo-600" /> Fee Templates
          </h1>
          <p className="text-gray-500 text-sm mt-1">Define itemized fee structures (recurring & one-time) per class.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowItemsPanel(!showItemsPanel)}
            className="flex items-center gap-2 px-4 py-2 border border-indigo-300 text-indigo-700 bg-indigo-50 text-sm font-medium rounded-lg hover:bg-indigo-100">
            <Tag className="w-4 h-4" /> Fee Items Library
          </button>
          <button onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> Add Class Template
          </button>
        </div>
      </div>

      {/* ── Fee Items Library Panel ── */}
      {showItemsPanel && (
        <div className="bg-white rounded-xl border border-indigo-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <Tag className="w-4 h-4 text-indigo-500" /> Fee Items Library
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">These names appear as dropdown suggestions when building fee templates. Add any custom fee heads your school uses.</p>
            </div>
            {savingItems && <span className="text-xs text-indigo-500 font-medium">Saving…</span>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Recurring Items */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Monthly / Recurring Fee Names</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {recurringItems.map(it => (
                  <span key={it} className="flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full px-3 py-1 text-xs font-medium">
                    {it}
                    <button onClick={() => removeRecurring(it)} className="hover:text-red-500 transition-colors"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={newRecurring} onChange={e => setNewRecurring(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addRecurring()}
                  placeholder="e.g. Computer Lab Fee"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                <button onClick={addRecurring} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            {/* One-time Items */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">One-Time Fee Names</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {onetimeItems.map(it => (
                  <span key={it} className="flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-full px-3 py-1 text-xs font-medium">
                    {it}
                    <button onClick={() => removeOnetime(it)} className="hover:text-red-500 transition-colors"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={newOnetime} onChange={e => setNewOnetime(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addOnetime()}
                  placeholder="e.g. Security Deposit"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                <button onClick={addOnetime} className="px-3 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Fee Structures List ── */}
      {loading ? <div className="p-12 text-center text-gray-400">Loading…</div>
        : structures.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-400">
            No fee templates yet. Add a class template to get started.
          </div>
        ) : (
          <div className="space-y-4">
            {structures.map(s => {
              const recurrentTotal = s.fee_matrix.recurrent.reduce((t, i) => t + i.amount, 0);
              const firstTimeTotal = s.fee_matrix.first_time.reduce((t, i) => t + i.amount, 0);
              const isOpen = expanded === s.id;
              return (
                <div key={s.id} className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <button onClick={() => setExpanded(isOpen ? null : s.id)}
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 rounded-xl">
                    <div>
                      <p className="font-semibold text-gray-900">{s.class_name}</p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        Monthly: Rs.&nbsp;{recurrentTotal.toLocaleString()} &nbsp;·&nbsp; One-time: Rs.&nbsp;{firstTimeTotal.toLocaleString()}
                      </p>
                    </div>
                    {isOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                  </button>

                  {isOpen && (
                    <div className="border-t border-gray-100 p-5 space-y-6">
                      {(['recurrent', 'first_time'] as const).map(section => {
                        const suggestions = section === 'recurrent' ? allRecurring : allOnetime;
                        return (
                          <div key={section}>
                            <div className="flex justify-between items-center mb-3">
                              <h3 className="font-medium text-gray-700">
                                {section === 'recurrent' ? '🔁 Monthly / Recurring Fees' : '1️⃣ One-Time Fees (Admission, etc.)'}
                              </h3>
                              <button onClick={() => addItem(s.id, section)}
                                className="text-indigo-600 text-sm flex items-center gap-1 hover:text-indigo-800">
                                <Plus className="w-3.5 h-3.5" /> Add item
                              </button>
                            </div>
                            <div className="space-y-2">
                              {s.fee_matrix[section].map((item, idx) => (
                                <div key={idx} className="flex gap-3 items-center">
                                  <FeeItemCombobox
                                    value={item.item}
                                    onChange={v => updateItem(s.id, section, idx, 'item', v)}
                                    items={suggestions}
                                  />
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">Rs.</span>
                                    <input type="number" min="0" value={item.amount}
                                      onChange={e => updateItem(s.id, section, idx, 'amount', e.target.value)}
                                      className="w-32 border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500" />
                                  </div>
                                  <button onClick={() => removeItem(s.id, section, idx)} className="text-red-400 hover:text-red-600 p-1">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 text-right text-sm font-mono font-bold text-gray-700">
                              Subtotal: Rs.&nbsp;{s.fee_matrix[section].reduce((t, i) => t + i.amount, 0).toLocaleString()}
                            </div>
                          </div>
                        );
                      })}
                      <div className="flex justify-end">
                        <button onClick={() => handleSave(s)} disabled={saving === s.id}
                          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                          <Save className="w-4 h-4" /> {saving === s.id ? 'Saving…' : 'Save Template'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      {/* Add Class Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Add Class Template</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleAddClass} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                <select required value={newClassId} onChange={e => setNewClassId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
                  <option value="">Select class…</option>
                  {classes.filter(c => !structures.find(s => s.class_id === c.id)).map(c => (
                    <option key={c.id} value={c.id}>{c.name}-{c.section}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit"
                  className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Create Template</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
