import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Save, Plus, Edit2, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface GradingBracket {
  id: string;
  min_pct: number | '';
  max_pct: number | '';
  grade_title: string;
  result_status: 'pass' | 'fail';
  color_level: string;
  custom_hex?: string;
  custom_label?: string;
  remarks: string;
}

const COLOR_LEVELS = [
  { value: 'emerald', label: 'Green (Level Excellent)', hex: '#10b981', bg: '#d1fae5' },
  { value: 'blue', label: 'Blue (Level Good)', hex: '#3b82f6', bg: '#dbeafe' },
  { value: 'orange', label: 'Orange (Level Above Average)', hex: '#f97316', bg: '#ffedd5' },
  { value: 'yellow', label: 'Yellow (Level Average)', hex: '#eab308', bg: '#fef08a' },
  { value: 'red', label: 'Red (Level Poor)', hex: '#ef4444', bg: '#fee2e2' },
];

export default function GradingPolicy() {
  const { userRole } = useAuth();
  
  const [brackets, setBrackets] = useState<GradingBracket[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<GradingBracket>({
    id: '',
    min_pct: '',
    max_pct: '',
    grade_title: '',
    result_status: 'pass',
    color_level: 'emerald',
    custom_hex: '#000000',
    custom_label: '',
    remarks: ''
  });

  useEffect(() => {
    if (userRole?.school_id) fetchPolicy();
  }, [userRole]);

  const fetchPolicy = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('form_settings')
      .select('sections_config')
      .eq('school_id', userRole!.school_id)
      .eq('form_name', 'grading_policy')
      .maybeSingle();

    if (data?.sections_config && Array.isArray(data.sections_config)) {
      setBrackets(data.sections_config);
    }
    setLoading(false);
  };

  const syncToDatabase = async (newBrackets: GradingBracket[]) => {
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const { error } = await supabase.from('form_settings').upsert(
        { 
          school_id: userRole!.school_id, 
          form_name: 'grading_policy', 
          sections_config: newBrackets 
        },
        { onConflict: 'school_id,form_name' }
      );
      if (error) throw error;
      setSuccessMsg('Grading policy successfully updated.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save policy');
    }
    setSaving(false);
  };

  const validateOverlap = (min: number, max: number, ignoreId?: string): string | null => {
    if (min >= max) return 'Min % must be less than Max %.';
    if (min < 0 || max > 100) return 'Percentage must be between 0 and 100.';
    
    for (const b of brackets) {
      if (b.id === ignoreId) continue;
      const bMin = Number(b.min_pct);
      const bMax = Number(b.max_pct);
      // Overlap condition: max > bMin AND min < bMax
      if (max > bMin && min < bMax) {
        return `Overlap detected with grade "${b.grade_title}" (${bMin}% - ${bMax}%).`;
      }
    }
    return null;
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.min_pct === '' || formData.max_pct === '') {
      setErrorMsg('Min % and Max % are required.');
      return;
    }
    
    const overlapErr = validateOverlap(Number(formData.min_pct), Number(formData.max_pct), editingId || undefined);
    if (overlapErr) {
      setErrorMsg(overlapErr);
      return;
    }

    let updatedList;
    if (editingId) {
      updatedList = brackets.map(b => b.id === editingId ? { ...formData } : b);
    } else {
      updatedList = [...brackets, { ...formData, id: Date.now().toString() }];
    }

    // Auto sort descending
    updatedList.sort((a, b) => Number(b.max_pct) - Number(a.max_pct));
    
    setBrackets(updatedList);
    setEditingId(null);
    setFormData({ id: '', min_pct: '', max_pct: '', grade_title: '', result_status: 'pass', color_level: 'emerald', custom_hex: '#000000', custom_label: '', remarks: '' });
    
    await syncToDatabase(updatedList);
  };

  const handleEdit = (b: GradingBracket) => {
    setEditingId(b.id);
    setFormData({ ...b });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this grade bracket?')) return;
    const updatedList = brackets.filter(b => b.id !== id);
    setBrackets(updatedList);
    await syncToDatabase(updatedList);
  };

  if (loading) return <div className="p-12 text-center text-gray-400">Loading Configuration...</div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="mb-4">
        <h1 className="text-2xl font-black text-gray-900">Grading Policy Configuration</h1>
        <p className="text-gray-500 text-sm mt-1">Define your institutional grading scale, ranges, and pass/fail criteria.</p>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg flex gap-3 items-center font-medium border border-red-100">
          <AlertCircle className="w-5 h-5 shrink-0" /> {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-50 text-emerald-700 rounded-lg flex gap-3 items-center font-medium border border-emerald-100">
          <CheckCircle2 className="w-5 h-5 shrink-0" /> {successMsg}
        </div>
      )}

      {/* Action Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-5 pb-2 border-b border-gray-100">
          {editingId ? 'Edit Grading Policy Detail' : 'Add/Update Grading Policy Detail'}
        </h2>
        
        <form onSubmit={handleSaveForm} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            
            {/* Row 1: Range */}
            <div className="md:col-span-2 flex flex-col md:flex-row gap-4 items-start md:items-center bg-gray-50 p-4 rounded-lg border border-gray-100">
              <span className="font-bold text-sm text-gray-700 min-w-32">Marks(%) Range</span>
              <div className="flex items-center gap-3">
                <input 
                  type="number" 
                  min="0" max="100" 
                  required
                  placeholder="Min (%)"
                  value={formData.min_pct} 
                  onChange={e => setFormData({ ...formData, min_pct: e.target.value ? Number(e.target.value) : '' })}
                  className="w-32 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 font-bold"
                />
                <span className="text-gray-400 font-medium">to</span>
                <input 
                  type="number" 
                  min="0" max="100" 
                  required
                  placeholder="Max (%)"
                  value={formData.max_pct} 
                  onChange={e => setFormData({ ...formData, max_pct: e.target.value ? Number(e.target.value) : '' })}
                  className="w-32 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 font-bold"
                />
              </div>
            </div>

            {/* Row 2: Title & Enum */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Grade Title</label>
              <input 
                type="text" 
                required
                placeholder="e.g. A+"
                value={formData.grade_title} 
                onChange={e => setFormData({ ...formData, grade_title: e.target.value.toUpperCase() })}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Result (Status)</label>
              <select 
                value={formData.result_status} 
                onChange={e => setFormData({ ...formData, result_status: e.target.value as 'pass'|'fail' })}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 font-bold"
              >
                <option value="pass">Pass</option>
                <option value="fail">Fail</option>
              </select>
            </div>

            {/* Row 3: Visual & Remarks */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Graph Color & Level</label>
              <select 
                value={formData.color_level} 
                onChange={e => setFormData({ ...formData, color_level: e.target.value })}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 font-medium"
              >
                {COLOR_LEVELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                <option value="custom">Custom Color & Level...</option>
              </select>
            </div>

            {formData.color_level === 'custom' && (
              <>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Custom Graph Color</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="color" 
                      value={formData.custom_hex || '#000000'} 
                      onChange={e => setFormData({ ...formData, custom_hex: e.target.value })}
                      className="w-10 h-10 border-gray-300 rounded-md shadow-sm cursor-pointer"
                    />
                    <input 
                      type="text" 
                      placeholder="#000000"
                      value={formData.custom_hex || ''} 
                      onChange={e => setFormData({ ...formData, custom_hex: e.target.value })}
                      className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Custom Level Label</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Needs Improvement"
                    value={formData.custom_label || ''} 
                    onChange={e => setFormData({ ...formData, custom_label: e.target.value })}
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </>
            )}

            <div className={formData.color_level === 'custom' ? "md:col-span-2" : ""}>
              <label className="block text-sm font-bold text-gray-700 mb-1">Remarks</label>
              <input 
                type="text" 
                placeholder="e.g. Excellent work"
                value={formData.remarks} 
                onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="pt-4 flex items-center gap-3 border-t border-gray-100">
            <button 
              type="submit" 
              disabled={saving}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-bold text-sm shadow-sm flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {editingId ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {saving ? 'Processing...' : (editingId ? 'Update Grade' : 'Add Grade')}
            </button>
            {editingId && (
              <button 
                type="button" 
                onClick={() => {
                  setEditingId(null);
                  setFormData({ id: '', min_pct: '', max_pct: '', grade_title: '', result_status: 'pass', color_level: 'emerald', custom_hex: '#000000', custom_label: '', remarks: '' });
                }}
                className="px-4 py-2 text-gray-500 hover:text-gray-800 font-medium text-sm transition-colors"
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </div>

      {/* List / Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left font-bold text-gray-700 whitespace-nowrap">Marks Range</th>
                <th className="px-6 py-4 text-left font-bold text-gray-700">Grade</th>
                <th className="px-6 py-4 text-left font-bold text-gray-700">Result</th>
                <th className="px-6 py-4 text-left font-bold text-gray-700">Remarks</th>
                <th className="px-6 py-4 text-left font-bold text-gray-700">Graph Color & Level</th>
                <th className="px-6 py-4 text-left font-bold text-gray-700 w-24">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {brackets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400 font-medium">
                    No grading policy defined yet. Add ranges above.
                  </td>
                </tr>
              ) : (
                brackets.map((b) => {
                  const isCustom = b.color_level === 'custom';
                  const clrNode = COLOR_LEVELS.find(c => c.value === b.color_level) || COLOR_LEVELS[0];
                  const hexCode = isCustom ? (b.custom_hex || '#000000') : clrNode.hex;
                  const labelText = isCustom ? (b.custom_label || 'Custom Level') : clrNode.label;
                  
                  return (
                    <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-mono text-gray-600 whitespace-nowrap">
                        {b.min_pct}% <span className="text-gray-300 px-1">-- to --</span> {b.max_pct}%
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-900">{b.grade_title}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${b.result_status === 'pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {b.result_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500 italic max-w-xs truncate">{b.remarks || '-'}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full shadow-inner" style={{ backgroundColor: hexCode }} />
                          <span className="text-gray-600 font-medium">{labelText}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 opacity-50 hover:opacity-100 transition-opacity">
                          <button onClick={() => handleEdit(b)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md" title="Edit">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(b.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-md" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
