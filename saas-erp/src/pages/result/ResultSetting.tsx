import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Settings, Save, Plus, Trash2 } from 'lucide-react';

interface ResultConfig {
  show_gpa: boolean;
  show_position: boolean;
  show_remarks: boolean;
  result_title: string;
}

const DEFAULTS: ResultConfig = {
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
          <h2 className="font-semibold text-gray-800">General Information</h2>
          <p className="text-sm text-gray-500 mb-4 pb-4 border-b border-gray-100">For configuring pass/fail ranges and grading scales, please use the new <a href="/result/grading-policy" className="text-indigo-600 font-medium hover:underline">Grading Policy</a> module.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Result Card Title</label>
              <input value={config.result_title} onChange={e => setConfig({ ...config, result_title: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                placeholder="Result Card" />
            </div>
          </div>
          <div className="space-y-3 pt-4 border-t border-gray-100">
            <Toggle label="Show Position / Rank" field="show_position" desc="Display class position on result card" />
            <Toggle label="Show Remarks" field="show_remarks" desc="Display grade remarks (e.g., Excellent, Good)" />
            <Toggle label="Show GPA" field="show_gpa" desc="Calculate and display GPA on result card" />
          </div>
        </div>
      </form>
    </div>
  );
}
