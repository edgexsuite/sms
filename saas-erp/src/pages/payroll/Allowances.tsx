import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Settings, Plus, Trash2, Save } from 'lucide-react';

interface Component {
  id: string;
  name: string;
  component_type: 'allowance' | 'deduction';
  calculation_type: 'fixed' | 'percentage';
  amount: number;
  percentage: number;
  is_active: boolean;
}

export default function Allowances() {
  const { userRole } = useAuth();
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (userRole?.school_id) fetch();
  }, [userRole]);

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase.from('salary_components').select('*').eq('school_id', userRole!.school_id).order('component_type').order('name');
    setComponents(data || []);
    setLoading(false);
  };

  const addNew = (type: 'allowance' | 'deduction') => {
    const newComp: Component = {
      id: crypto.randomUUID(),
      name: '', component_type: type, calculation_type: 'fixed',
      amount: 0, percentage: 0, is_active: true,
    };
    setComponents(prev => [...prev, newComp]);
  };

  const update = (id: string, field: keyof Component, value: any) => {
    setComponents(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const save = async (comp: Component) => {
    if (!comp.name.trim()) return;
    setSaving(comp.id);
    await supabase.from('salary_components').upsert(
      { ...comp, school_id: userRole!.school_id },
      { onConflict: 'id' }
    );
    setSaving(null);
    await fetch();
  };

  const remove = async (id: string) => {
    await supabase.from('salary_components').delete().eq('id', id);
    setComponents(prev => prev.filter(c => c.id !== id));
  };

  const allowances = components.filter(c => c.component_type === 'allowance');
  const deductions = components.filter(c => c.component_type === 'deduction');

  const ComponentTable = ({ items, type }: { items: Component[]; type: 'allowance' | 'deduction' }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b border-gray-200">
        <h2 className={`font-semibold ${type === 'allowance' ? 'text-green-700' : 'text-red-700'}`}>
          {type === 'allowance' ? '+ Allowances' : '− Deductions'}
        </h2>
        <button onClick={() => addNew(type)}
          className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800">
          <Plus className="w-4 h-4" /> Add {type === 'allowance' ? 'Allowance' : 'Deduction'}
        </button>
      </div>
      {items.length === 0 ? (
        <p className="p-6 text-center text-gray-400 text-sm">No {type}s configured yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Calculation</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Value</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500">Active</th>
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <input value={c.name} onChange={e => update(c.id, 'name', e.target.value)}
                    placeholder="e.g. House Rent Allowance"
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500" />
                </td>
                <td className="px-4 py-3">
                  <select value={c.calculation_type} onChange={e => update(c.id, 'calculation_type', e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500">
                    <option value="fixed">Fixed Amount</option>
                    <option value="percentage">% of Basic</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  {c.calculation_type === 'fixed' ? (
                    <input type="number" min="0" value={c.amount} onChange={e => update(c.id, 'amount', parseFloat(e.target.value) || 0)}
                      className="w-28 border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500" />
                  ) : (
                    <div className="flex items-center gap-1">
                      <input type="number" min="0" max="100" value={c.percentage} onChange={e => update(c.id, 'percentage', parseFloat(e.target.value) || 0)}
                        className="w-20 border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500" />
                      <span className="text-gray-500">%</span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <input type="checkbox" checked={c.is_active} onChange={e => update(c.id, 'is_active', e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded" />
                </td>
                <td className="px-4 py-3 flex items-center gap-1">
                  <button onClick={() => save(c)} disabled={saving === c.id}
                    className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded disabled:opacity-50">
                    <Save className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(c.id)}
                    className="p-1.5 text-red-400 hover:bg-red-50 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  if (loading) return <div className="p-12 text-center text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="w-6 h-6 text-emerald-600" /> Salary Components
        </h1>
        <p className="text-gray-500 text-sm mt-1">Configure allowances and deductions applied to all staff salaries.</p>
      </div>
      <ComponentTable items={allowances} type="allowance" />
      <ComponentTable items={deductions} type="deduction" />
    </div>
  );
}
