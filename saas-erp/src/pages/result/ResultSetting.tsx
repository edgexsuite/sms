import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Settings, Save, Plus, Trash2 } from 'lucide-react';

interface GradeThreshold {
  grade: string;
  min_pct: number;
  max_pct: number;
  remarks: string;
  color: string;
}

interface ResultConfig {
  grading_scale: GradeThreshold[];
  passing_percentage: number;
  show_gpa: boolean;
  show_position: boolean;
  show_remarks: boolean;
  result_title: string;
}

const DEFAULT_GRADES: GradeThreshold[] = [
  { grade: 'A+', min_pct: 90, max_pct: 100, remarks: 'Outstanding', color: '#10b981' },
  { grade: 'A',  min_pct: 80, max_pct: 89,  remarks: 'Excellent',   color: '#3b82f6' },
  { grade: 'B',  min_pct: 70, max_pct: 79,  remarks: 'Very Good',   color: '#6366f1' },
  { grade: 'C',  min_pct: 60, max_pct: 69,  remarks: 'Good',        color: '#f59e0b' },
  { grade: 'D',  min_pct: 50, max_pct: 59,  remarks: 'Satisfactory',color: '#f97316' },
  { grade: 'F',  min_pct: 0,  max_pct: 49,  remarks: 'Fail',        color: '#ef4444' },
];

const DEFAULTS: ResultConfig = {
  grading_scale: DEFAULT_GRADES,
  passing_percentage: 50,
  show_gpa: false,
  show_position: true,
  show_remarks: true,
  result_title: 'Result Card',
};

export default function ResultSetting() {
  const { userRole } = useAuth();
  const [config, setConfig] = useState<ResultConfig>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (userRole?.school_id) fetchConfig();
  }, [userRole]);

  const fetchConfig = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('form_settings')
      .select('sections_config')
      .eq('school_id', userRole!.school_id)
      .eq('form_name', 'result_settings')
      .maybeSingle();
    if (data?.sections_config) setConfig({ ...DEFAULTS, ...data.sections_config });
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await supabase.from('form_settings').upsert(
      { school_id: userRole!.school_id, form_name: 'result_settings', sections_config: config },
      { onConflict: 'school_id,form_name' }
    );
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const updateGrade = (idx: number, field: keyof GradeThreshold, value: string | number) => {
    setConfig(prev => ({
      ...prev,
      grading_scale: prev.grading_scale.map((g, i) => i === idx ? { ...g, [field]: value } : g),
    }));
  };

  const removeGrade = (idx: number) => {
    setConfig(prev => ({ ...prev, grading_scale: prev.grading_scale.filter((_, i) => i !== idx) }));
  };

  const addGrade = () => {
    setConfig(prev => ({
      ...prev,
      grading_scale: [...prev.grading_scale, { grade: '', min_pct: 0, max_pct: 0, remarks: '', color: '#6b7280' }],
    }));
  };

  const Toggle = ({ label, field, desc }: { label: string; field: keyof ResultConfig; desc?: string }) => (
    <label className="flex items-start gap-3 cursor-pointer">
      <div className="relative mt-0.5">
        <input type="checkbox" className="sr-only" checked={!!config[field]} onChange={e => setConfig(prev => ({ ...prev, [field]: e.target.checked }))} />
        <div className={`w-10 h-6 rounded-full transition-colors ${config[field] ? 'bg-indigo-600' : 'bg-gray-200'}`} />
        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${config[field] ? 'translate-x-4' : ''}`} />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {desc && <p className="text-xs text-gray-400">{desc}</p>}
      </div>
    </label>
  );

  if (loading) return <div className="p-12 text-center text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="w-6 h-6 text-indigo-600" /> Result Settings
          </h1>
          <p className="text-gray-500 text-sm mt-1">Configure grading scale and result card display options.</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white ${saved ? 'bg-green-600' : 'bg-indigo-600 hover:bg-indigo-700'} disabled:opacity-50`}>
          <Save className="w-4 h-4" /> {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {/* General */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">General</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Result Card Title</label>
              <input value={config.result_title} onChange={e => setConfig({ ...config, result_title: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                placeholder="Result Card" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Passing Percentage (%)</label>
              <input type="number" min="0" max="100" value={config.passing_percentage}
                onChange={e => setConfig({ ...config, passing_percentage: parseInt(e.target.value) || 0 })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div className="space-y-3 pt-2">
            <Toggle label="Show Position / Rank" field="show_position" desc="Display class position on result card" />
            <Toggle label="Show Remarks" field="show_remarks" desc="Display grade remarks (e.g., Excellent, Good)" />
            <Toggle label="Show GPA" field="show_gpa" desc="Calculate and display GPA on result card" />
          </div>
        </div>

        {/* Grading Scale */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b border-gray-200">
            <div>
              <h2 className="font-semibold text-gray-800">Grading Scale</h2>
              <p className="text-xs text-gray-400 mt-0.5">Define grade thresholds (percentages). Ranges must not overlap.</p>
            </div>
            <button type="button" onClick={addGrade} className="flex items-center gap-1 text-indigo-600 text-sm font-medium hover:text-indigo-800">
              <Plus className="w-4 h-4" /> Add Grade
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 w-20">Grade</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 w-28">Min %</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 w-28">Max %</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Remarks</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 w-20">Color</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 w-16">Preview</th>
                  <th className="px-4 py-3 w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {config.grading_scale.map((g, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input value={g.grade} onChange={e => updateGrade(i, 'grade', e.target.value)}
                        className="w-16 border border-gray-300 rounded px-2 py-1 text-sm font-bold text-center focus:ring-2 focus:ring-indigo-500"
                        placeholder="A+" />
                    </td>
                    <td className="px-4 py-3">
                      <input type="number" min="0" max="100" value={g.min_pct} onChange={e => updateGrade(i, 'min_pct', parseFloat(e.target.value))}
                        className="w-20 border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500" />
                    </td>
                    <td className="px-4 py-3">
                      <input type="number" min="0" max="100" value={g.max_pct} onChange={e => updateGrade(i, 'max_pct', parseFloat(e.target.value))}
                        className="w-20 border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500" />
                    </td>
                    <td className="px-4 py-3">
                      <input value={g.remarks} onChange={e => updateGrade(i, 'remarks', e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500"
                        placeholder="e.g. Excellent" />
                    </td>
                    <td className="px-4 py-3">
                      <input type="color" value={g.color} onChange={e => updateGrade(i, 'color', e.target.value)}
                        className="w-10 h-8 rounded border border-gray-300 cursor-pointer" />
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: g.color + '20', color: g.color }}>
                        {g.grade || '?'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => removeGrade(i)} className="text-red-400 hover:text-red-600 p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-gray-100 flex justify-end">
            <button type="button" onClick={() => setConfig({ ...config, grading_scale: DEFAULT_GRADES })}
              className="text-sm text-gray-500 hover:text-indigo-600">Reset to defaults</button>
          </div>
        </div>
      </form>
    </div>
  );
}
