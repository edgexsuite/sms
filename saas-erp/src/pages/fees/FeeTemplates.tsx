import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Layout, Plus, Trash2, Save, ChevronDown, ChevronUp, Tag, X, MoreVertical, CreditCard, Calendar, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
    setStructures(
      (data || [])
        .map((s: any) => ({
          ...s,
          class_name: s.class ? `${s.class.name}-${s.class.section}` : 'Unknown',
          fee_matrix: s.fee_matrix || {
            recurrent: [{ item: 'Tuition Fee', amount: 0 }],
            first_time: [{ item: 'Admission Fee', amount: 0 }],
          },
        }))
        .sort((a, b) => 
          a.class_name.localeCompare(b.class_name, undefined, { numeric: true, sensitivity: 'base' })
        )
    );
    setLoading(false);
  };

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('id, name, section')
      .eq('school_id', userRole!.school_id);
    setClasses((data || []).sort((a, b) => 
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    ));
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

  const deleteStructure = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this class template?')) return;
    const { error } = await supabase.from('fee_structures').delete().eq('id', id);
    if (!error) fetchStructures();
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
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200">
            <Layout className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Fee Templates</h1>
            <p className="text-gray-500 text-sm font-medium">Design professional fee structures per class</p>
          </div>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button onClick={() => setShowItemsPanel(!showItemsPanel)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 border border-indigo-200 text-indigo-700 bg-indigo-50 text-sm font-bold rounded-xl hover:bg-indigo-100 transition-all active:scale-95">
            <Tag className="w-4 h-4" /> Library
          </button>
          <button onClick={() => setIsModalOpen(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95">
            <Plus className="w-4 h-4" /> Add Template
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

      {/* ── Fee Structures Grid ── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-white rounded-2xl border border-gray-100 animate-pulse" />
          ))}
        </div>
      ) : structures.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-dashed border-gray-300 p-16 text-center">
          <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Layout className="w-8 h-8 text-indigo-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">No Templates Found</h3>
          <p className="text-gray-500 max-w-xs mx-auto mt-2">Get started by creating your first fee structure template for a class.</p>
          <button onClick={() => setIsModalOpen(true)} className="mt-6 text-indigo-600 font-bold hover:underline">
            + Add First Template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {structures.map((s, idx) => {
              const recurrentTotal = s.fee_matrix.recurrent.reduce((t, i) => t + i.amount, 0);
              const firstTimeTotal = s.fee_matrix.first_time.reduce((t, i) => t + i.amount, 0);
              const isOpen = expanded === s.id;
              
              return (
                <motion.div
                  key={s.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`group bg-white rounded-2xl shadow-sm border transition-all hover:shadow-md ${
                    isOpen ? 'border-indigo-500 ring-4 ring-indigo-50' : 'border-gray-100'
                  }`}
                >
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-indigo-50 transition-colors">
                        <Tag className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteStructure(s.id); }}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete Template"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <h3 className="text-lg font-bold text-gray-900">{s.class_name}</h3>
                    
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between p-2.5 bg-indigo-50/50 rounded-xl border border-indigo-100/50">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-indigo-500" />
                          <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">Monthly</span>
                        </div>
                        <span className="text-sm font-black text-indigo-900">Rs. {recurrentTotal.toLocaleString()}</span>
                      </div>
                      
                      <div className="flex items-center justify-between p-2.5 bg-amber-50/50 rounded-xl border border-amber-100/50">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-amber-500" />
                          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">One-Time</span>
                        </div>
                        <span className="text-sm font-black text-amber-900">Rs. {firstTimeTotal.toLocaleString()}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => setExpanded(isOpen ? null : s.id)}
                      className="w-full mt-5 flex items-center justify-center gap-2 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-black transition-all active:scale-95"
                    >
                      {isOpen ? 'Close Editor' : 'Edit Structure'}
                      <ArrowRight className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                    </button>
                  </div>

                  {/* Expanded Editor */}
                  {isOpen && (
                    <div className="border-t border-gray-100 bg-slate-50/50 p-5 rounded-b-2xl space-y-6">
                      {(['recurrent', 'first_time'] as const).map(section => {
                        const suggestions = section === 'recurrent' ? allRecurring : allOnetime;
                        return (
                          <div key={section}>
                            <div className="flex justify-between items-center mb-3">
                              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">
                                {section === 'recurrent' ? '🔁 Recurring Items' : '1️⃣ One-Time Items'}
                              </h3>
                              <button onClick={() => addItem(s.id, section)}
                                className="text-indigo-600 text-[10px] font-bold uppercase flex items-center gap-1 hover:text-indigo-800 bg-indigo-50 px-2 py-1 rounded-md">
                                <Plus className="w-3 h-3" /> Add item
                              </button>
                            </div>
                            <div className="space-y-2">
                              {s.fee_matrix[section].map((item, idx) => (
                                <div key={idx} className="flex gap-2 items-center">
                                  <FeeItemCombobox
                                    value={item.item}
                                    onChange={v => updateItem(s.id, section, idx, 'item', v)}
                                    items={suggestions}
                                  />
                                  <div className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">Rs.</span>
                                    <input type="text" inputMode="numeric" value={item.amount}
                                      onFocus={e => e.target.select()}
                                      onChange={e => updateItem(s.id, section, idx, 'amount', e.target.value.replace(/[^0-9]/g, ''))}
                                      className="w-24 border border-gray-200 rounded-lg pl-7 pr-2 py-1.5 text-xs font-bold focus:ring-2 focus:ring-indigo-500 bg-white" />
                                  </div>
                                  <button onClick={() => removeItem(s.id, section, idx)} className="text-gray-300 hover:text-red-500 p-1 transition-colors">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 text-right text-[10px] font-black text-gray-500 uppercase tracking-tight">
                              {section === 'recurrent' ? 'Monthly Subtotal' : 'One-Time Subtotal'}: Rs.&nbsp;{s.fee_matrix[section].reduce((t, i) => t + i.amount, 0).toLocaleString()}
                            </div>
                          </div>
                        );
                      })}
                      <div className="pt-2">
                        <button onClick={() => handleSave(s)} disabled={saving === s.id}
                          className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 shadow-md shadow-indigo-100">
                          <Save className="w-3.5 h-3.5" /> {saving === s.id ? 'Saving Changes…' : 'Save Template'}
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Add Class Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
          >
            <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-slate-50">
              <h2 className="text-lg font-bold text-gray-900">New Class Template</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddClass} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Select Class</label>
                <select required value={newClassId} onChange={e => setNewClassId(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500 bg-slate-50">
                  <option value="">Choose a class…</option>
                  {classes.filter(c => !structures.find(s => s.class_id === c.id)).map(c => (
                    <option key={c.id} value={c.id}>{c.name}-{c.section}</option>
                  ))}
                </select>
                <p className="mt-2 text-[10px] text-gray-400">Only classes without an existing template are shown.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 text-sm font-bold border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-all">Cancel</button>
                <button type="submit"
                  className="flex-1 px-4 py-3 text-sm font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all">Create</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
