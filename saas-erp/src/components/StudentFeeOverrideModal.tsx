/**
 * StudentFeeOverrideModal
 * ────────────────────────
 * Lets admin set a per-student custom fee matrix that overrides the
 * class-level fee structure for this student only.
 *
 * Stored in: students.fee_override JSONB  (same shape as fee_matrix)
 *   { recurrent: [{item, amount}], first_time: [{item, amount}] }
 *
 * Usage: <StudentFeeOverrideModal student={...} onClose={() => {}} onSave={() => {}} />
 */
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { X, Plus, Trash2, Loader2, RotateCcw, CheckCircle, AlertTriangle, Info } from 'lucide-react';

interface FeeItem { item: string; amount: number; }
interface Props {
  student: { id: string; full_name: string; class_id?: string | null; fee_waiver_percentage?: number | null; classes?: { name: string; section?: string } | null; };
  onClose: () => void;
  onSave: () => void;
}

export default function StudentFeeOverrideModal({ student, onClose, onSave }: Props) {
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [classDefault, setClassDefault] = useState<FeeItem[]>([]);    // from fee_structures
  const [recurrent, setRecurrent] = useState<FeeItem[]>([]);          // current override (recurrent)
  const [hasOverride, setHasOverride] = useState(false);              // true if student already has override

  useEffect(() => {
    load();
  }, [student.id]);

  const load = async () => {
    setLoading(true);
    try {
      const sid = userRole!.school_id;

      // Fetch class fee structure (default)
      const { data: fs } = await supabase
        .from('fee_structures')
        .select('fee_matrix, amount')
        .eq('school_id', sid)
        .eq('class_id', student.class_id || '')
        .maybeSingle();

      const defaultItems: FeeItem[] = fs?.fee_matrix?.recurrent?.length
        ? fs.fee_matrix.recurrent
        : fs?.amount
          ? [{ item: 'Monthly Tuition Fee', amount: fs.amount }]
          : [{ item: 'Monthly Tuition Fee', amount: 0 }];

      setClassDefault(defaultItems);

      // Fetch student's current override
      const { data: stu } = await supabase
        .from('students')
        .select('fee_override')
        .eq('id', student.id)
        .maybeSingle();

      const override = stu?.fee_override;
      if (override?.recurrent?.length) {
        setRecurrent(override.recurrent.map((r: any) => ({ item: r.item, amount: r.amount })));
        setHasOverride(true);
      } else {
        // start with class defaults as a template
        setRecurrent(defaultItems.map(r => ({ ...r })));
        setHasOverride(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const addRow = () => setRecurrent(p => [...p, { item: '', amount: 0 }]);
  const removeRow = (i: number) => setRecurrent(p => p.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: 'item' | 'amount', val: string | number) =>
    setRecurrent(p => p.map((r, idx) => idx === i ? { ...r, [field]: val } : r));

  const resetToClassDefault = async () => {
    if (!confirm('Reset to class default? This will remove the custom override for this student.')) return;
    setSaving(true);
    setError('');
    try {
      const { error: err } = await supabase
        .from('students')
        .update({ fee_override: null })
        .eq('id', student.id);
      if (err) throw err;
      setHasOverride(false);
      setRecurrent(classDefault.map(r => ({ ...r })));
      onSave();
    } catch (e: any) {
      setError(e.message || 'Failed to reset.');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const valid = recurrent.filter(r => r.item.trim());
    if (!valid.length) { setError('Add at least one fee item.'); return; }
    if (valid.some(r => r.amount < 0)) { setError('Amounts cannot be negative.'); return; }

    setSaving(true);
    setError('');
    try {
      const override = { recurrent: valid };
      const { error: err } = await supabase
        .from('students')
        .update({ fee_override: override })
        .eq('id', student.id);
      if (err) throw err;
      setHasOverride(true);
      onSave();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const total = recurrent.reduce((s, r) => s + (r.amount || 0), 0);
  const waiver = (student.fee_waiver_percentage || 0) / 100;
  const netTotal = +(total * (1 - waiver)).toFixed(2);
  const className = student.classes
    ? `${student.classes.name}${student.classes.section ? ` (${student.classes.section})` : ''}`
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-white font-black text-base leading-none">Custom Fee Override</h2>
            <p className="text-indigo-200 text-xs mt-1">
              {student.full_name}{className ? ` · ${className}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-7 h-7 text-indigo-500 animate-spin" />
            </div>
          ) : (
            <>
              {/* Info banner */}
              <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3">
                <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                <p className="text-xs text-indigo-700">
                  This override applies <strong>only to {student.full_name}</strong> and
                  replaces the class fee structure for all future invoices.
                  {waiver > 0 && <> The student's <strong>{student.fee_waiver_percentage}% waiver</strong> will still be applied on top.</>}
                </p>
              </div>

              {/* Active override badge */}
              {hasOverride && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-emerald-700">Custom override is active for this student</span>
                </div>
              )}

              {/* Class default reference */}
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Class Default (Reference)</p>
                <div className="bg-slate-50 rounded-xl border border-slate-200 divide-y divide-slate-100">
                  {classDefault.length === 0
                    ? <p className="text-xs text-slate-400 text-center py-4">No class fee structure configured</p>
                    : classDefault.map((r, i) => (
                      <div key={i} className="flex justify-between items-center px-4 py-2 text-xs">
                        <span className="text-slate-600 font-medium">{r.item}</span>
                        <span className="text-slate-500 font-mono">Rs. {r.amount.toLocaleString()}</span>
                      </div>
                    ))
                  }
                </div>
              </div>

              {/* Override editor */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-black text-violet-600 uppercase tracking-widest">Custom Fee Items</p>
                  <button onClick={addRow} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition">
                    <Plus className="w-3.5 h-3.5" /> Add item
                  </button>
                </div>

                <div className="border border-violet-200 rounded-2xl overflow-hidden divide-y divide-violet-100">
                  {/* Header */}
                  <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-violet-50 text-[9px] font-black text-violet-400 uppercase tracking-widest">
                    <div className="col-span-7">Fee Item</div>
                    <div className="col-span-4 text-right">Amount (Rs.)</div>
                    <div className="col-span-1"></div>
                  </div>

                  {recurrent.map((row, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 px-3 py-2 items-center bg-white">
                      <div className="col-span-7">
                        <input
                          value={row.item}
                          onChange={e => updateRow(i, 'item', e.target.value)}
                          placeholder="e.g. Monthly Tuition Fee"
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                      </div>
                      <div className="col-span-4">
                        <input
                          type="number" min="0" step="50"
                          value={row.amount || ''}
                          onChange={e => updateRow(i, 'amount', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm font-mono text-right focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button onClick={() => removeRow(i)} disabled={recurrent.length === 1}
                          className="p-1 text-slate-300 hover:text-red-500 disabled:opacity-20 transition">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Total row */}
                  <div className="grid grid-cols-12 gap-2 px-3 py-2.5 bg-violet-50 border-t-2 border-violet-200">
                    <div className="col-span-7 font-black text-sm text-violet-800">Monthly Total</div>
                    <div className="col-span-4 text-right font-black text-violet-700 font-mono">
                      Rs. {total.toLocaleString()}
                    </div>
                    <div className="col-span-1" />
                  </div>

                  {/* After waiver */}
                  {waiver > 0 && (
                    <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-emerald-50">
                      <div className="col-span-7 text-xs text-emerald-700 font-semibold">
                        After {student.fee_waiver_percentage}% waiver
                      </div>
                      <div className="col-span-4 text-right font-black text-emerald-700 font-mono text-sm">
                        Rs. {netTotal.toLocaleString()}
                      </div>
                      <div className="col-span-1" />
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
          <div>
            {hasOverride && (
              <button onClick={resetToClassDefault} disabled={saving}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-red-600 transition">
                <RotateCcw className="w-3.5 h-3.5" />
                Reset to class default
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose}
              className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving || loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-sm font-black transition">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Save Override
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
