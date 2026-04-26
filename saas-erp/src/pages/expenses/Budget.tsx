import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PiggyBank, Plus, Pencil, Save, X } from 'lucide-react';

interface BudgetEntry {
  head_id: string;
  head_name: string;
  budget_amount: number;
  actual_amount: number;
  variance: number;
  utilization: number;
}

interface ExpenseHead {
  id: string;
  name: string;
}

export default function Budget() {
  const { userRole } = useAuth();
  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [editing, setEditing] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (userRole?.school_id) fetchData();
  }, [userRole, period]);

  const fetchData = async () => {
    setLoading(true);
    const sid = userRole!.school_id;

    // Get expense heads
    const { data: heads } = await supabase.from('expense_heads').select('id, name').eq('school_id', sid).order('name');
    if (!heads) { setLoading(false); return; }

    // Get actuals for selected month
    const startDate = period + '-01';
    const endDate = new Date(parseInt(period.slice(0, 4)), parseInt(period.slice(5, 7)), 0).toISOString().split('T')[0];
    const { data: txns } = await supabase
      .from('financial_transactions')
      .select('category, amount')
      .eq('school_id', sid)
      .eq('type', 'expense')
      .gte('date', startDate)
      .lte('date', endDate);

    // Get budget settings
    const { data: budgetSetting } = await supabase
      .from('form_settings')
      .select('sections_config')
      .eq('school_id', sid)
      .eq('form_name', `budget_${period}`)
      .maybeSingle();

    const budgets: Record<string, number> = budgetSetting?.sections_config?.budgets || {};
    const actuals: Record<string, number> = {};
    txns?.forEach(t => { actuals[t.category] = (actuals[t.category] || 0) + Number(t.amount); });

    const result: BudgetEntry[] = heads.map(h => {
      const budget = budgets[h.id] || 0;
      const actual = actuals[h.name] || 0;
      return {
        head_id: h.id,
        head_name: h.name,
        budget_amount: budget,
        actual_amount: actual,
        variance: budget - actual,
        utilization: budget > 0 ? (actual / budget) * 100 : 0,
      };
    });

    setEntries(result);
    setLoading(false);
  };

  const handleSaveBudget = async (headId: string) => {
    setSaving(true);
    const { data: existing } = await supabase.from('form_settings').select('sections_config').eq('school_id', userRole!.school_id).eq('form_name', `budget_${period}`).maybeSingle();
    const budgets = { ...(existing?.sections_config?.budgets || {}), [headId]: parseFloat(editAmount) || 0 };
    await supabase.from('form_settings').upsert({ school_id: userRole!.school_id, form_name: `budget_${period}`, sections_config: { budgets } }, { onConflict: 'school_id,form_name' });
    setSaving(false);
    setEditing(null);
    fetchData();
  };

  const totalBudget = entries.reduce((s, e) => s + e.budget_amount, 0);
  const totalActual = entries.reduce((s, e) => s + e.actual_amount, 0);
  const totalVariance = totalBudget - totalActual;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <PiggyBank className="w-6 h-6 text-blue-600" /> Budget Planner
          </h1>
          <p className="text-gray-500 text-sm mt-1">Set monthly budgets per expense head and track actuals.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">Month:</label>
          <input type="month" value={period} onChange={e => setPeriod(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Budget</p>
          <p className="text-2xl font-black text-blue-600 mt-1">Rs. {totalBudget.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Actual Spend</p>
          <p className="text-2xl font-black text-gray-800 mt-1">Rs. {totalActual.toLocaleString()}</p>
        </div>
        <div className={`rounded-xl shadow-sm border p-5 ${totalVariance >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Variance</p>
          <p className={`text-2xl font-black mt-1 ${totalVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {totalVariance >= 0 ? '+' : ''}Rs. {totalVariance.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto">
        <div className="p-4 border-b border-gray-200">
          <p className="text-sm text-gray-500">Click the pencil icon on any row to set a budget for that expense head.</p>
        </div>
        {loading ? <div className="p-12 text-center text-gray-400">Loading...</div> :
          entries.length === 0 ? <div className="p-12 text-center text-gray-400">No expense heads found. Add them in Expense Heads first.</div> : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Expense Head</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500">Budget (Rs.)</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500">Actual (Rs.)</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500">Variance</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500 w-48">Utilization</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500">Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {entries.map(e => (
                  <tr key={e.head_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{e.head_name}</td>
                    <td className="px-6 py-4 text-right font-mono text-gray-700">
                      {editing === e.head_id ? (
                        <div className="flex items-center justify-end gap-2">
                          <input autoFocus type="number" min="0" value={editAmount} onChange={ev => setEditAmount(ev.target.value)}
                            className="w-28 border border-blue-400 rounded px-2 py-1 text-sm text-right font-mono focus:ring-2 focus:ring-blue-500" />
                          <button onClick={() => handleSaveBudget(e.head_id)} disabled={saving} className="text-green-600 hover:text-green-800">
                            <Save className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        e.budget_amount > 0 ? `Rs. ${e.budget_amount.toLocaleString()}` : <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-gray-700">
                      {e.actual_amount > 0 ? `Rs. ${e.actual_amount.toLocaleString()}` : <span className="text-gray-300">—</span>}
                    </td>
                    <td className={`px-6 py-4 text-right font-mono font-medium ${e.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {e.budget_amount > 0 ? (e.variance >= 0 ? `+Rs. ${e.variance.toLocaleString()}` : `-Rs. ${Math.abs(e.variance).toLocaleString()}`) : '—'}
                    </td>
                    <td className="px-6 py-4">
                      {e.budget_amount > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div className={`h-2 rounded-full transition-all ${e.utilization > 100 ? 'bg-red-500' : e.utilization > 75 ? 'bg-yellow-500' : 'bg-green-500'}`}
                              style={{ width: `${Math.min(e.utilization, 100)}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 w-10 text-right">{e.utilization.toFixed(0)}%</span>
                        </div>
                      ) : <span className="text-gray-300 text-xs">no budget set</span>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => { setEditing(e.head_id); setEditAmount(String(e.budget_amount || '')); }}
                        className="text-gray-400 hover:text-blue-600 p-1"><Pencil className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </div>
  );
}
