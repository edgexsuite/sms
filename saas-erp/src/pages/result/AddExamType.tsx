import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ClipboardList, PlusCircle, Pencil, Trash2, Save, X } from 'lucide-react';

export default function AddExamType() {
  const { userRole } = useAuth();
  const [examTypes, setExamTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', session: '', weightage: 100 });
  const [saving, setSaving] = useState(false);

  const currentYear = new Date().getFullYear();
  const SESSION_OPTIONS = [
    `${currentYear}-${currentYear + 1}`,
    `${currentYear - 1}-${currentYear}`,
    `${currentYear + 1}-${currentYear + 2}`,
  ];

  const EXAM_TEMPLATES = [
    { name: 'First Term Exam', weightage: 25 },
    { name: 'Mid-Term Exam', weightage: 25 },
    { name: 'Pre-Annual Exam', weightage: 25 },
    { name: 'Annual Exam', weightage: 25 },
    { name: 'Monthly Test', weightage: 10 },
    { name: 'Weekly Test', weightage: 5 },
  ];

  useEffect(() => { if (userRole?.school_id) fetch(); }, [userRole]);

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase.from('exam_types').select('*').eq('school_id', userRole?.school_id).order('created_at');
    if (data) setExamTypes(data);
    setLoading(false);
  };

  const openCreate = (template?: any) => {
    setEditId(null);
    setFormData({ name: template?.name || '', session: SESSION_OPTIONS[0], weightage: template?.weightage || 100 });
    setShowForm(true);
  };

  const openEdit = (et: any) => {
    setEditId(et.id);
    setFormData({ name: et.name, session: et.session || '', weightage: et.weightage });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return alert('Exam name is required.');
    setSaving(true);
    try {
      const payload = { school_id: userRole?.school_id, name: formData.name.trim(), session: formData.session, weightage: formData.weightage };
      if (editId) {
        const { error } = await supabase.from('exam_types').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('exam_types').insert([payload]);
        if (error) throw error;
      }
      setShowForm(false);
      fetch();
    } catch (err: any) { alert(err.message); }
    setSaving(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? All schedules and results tied to this exam will also be deleted.`)) return;
    const { error } = await supabase.from('exam_types').delete().eq('id', id);
    if (error) return alert(error.message);
    fetch();
  };

  const GRADE_COLORS: Record<string, string> = {
    'A+': 'bg-emerald-100 text-emerald-800', 'A': 'bg-green-100 text-green-800',
    'B': 'bg-blue-100 text-blue-800', 'C': 'bg-yellow-100 text-yellow-800',
    'D': 'bg-orange-100 text-orange-800', 'F': 'bg-red-100 text-red-800',
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-rose-600" /> Step 1: Exam Types
          </h1>
          <p className="text-gray-500 text-sm mt-1">Define your exam categories and sessions first. These power all schedules and result cards.</p>
        </div>
        <button onClick={() => openCreate()} className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-lg font-bold shadow transition">
          <PlusCircle className="w-4 h-4" /> New Exam Type
        </button>
      </div>

      {/* Quick Templates */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <p className="text-xs font-bold text-gray-500 uppercase mb-3">Quick Templates — Click to Pre-Fill</p>
        <div className="flex flex-wrap gap-2">
          {EXAM_TEMPLATES.map(t => (
            <button key={t.name} onClick={() => openCreate(t)} className="text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-full hover:bg-rose-100 transition">
              + {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* Exam Types List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading exam types...</div>
        ) : examTypes.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No exam types configured yet.</p>
            <p className="text-gray-400 text-sm mt-1">Use a template above or create a custom one.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {examTypes.map((et, idx) => (
              <div key={et.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 font-black text-sm flex items-center justify-center">{idx + 1}</div>
                  <div>
                    <p className="font-bold text-gray-900">{et.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Session: {et.session || '—'} &bull; Weightage: <strong>{et.weightage}%</strong></p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full font-bold">{et.weightage}% weight</span>
                  <button onClick={() => openEdit(et)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(et.id, et.name)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Grading Legend */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <p className="text-xs font-bold text-gray-500 uppercase mb-3">Grading Scale (Auto-Applied to All Results)</p>
        <div className="flex flex-wrap gap-2">
          {[['A+', '90-100%'], ['A', '80-89%'], ['B', '70-79%'], ['C', '60-69%'], ['D', '50-59%'], ['F', 'Below 33%']].map(([g, r]) => (
            <div key={g} className={`px-3 py-1.5 rounded-full text-xs font-bold ${GRADE_COLORS[g]}`}>{g} — {r}</div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-rose-600 px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-lg text-white">{editId ? 'Edit Exam Type' : 'New Exam Type'}</h3>
              <button onClick={() => setShowForm(false)} className="text-rose-200 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4 bg-gray-50">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Exam Name *</label>
                <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. First Term Exam" className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-rose-500 text-sm font-medium" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Academic Session</label>
                <select value={formData.session} onChange={e => setFormData({ ...formData, session: e.target.value })} className="w-full border border-gray-300 px-3 py-2 rounded-lg bg-white text-sm font-medium">
                  {SESSION_OPTIONS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Weightage (%) in Combined Result</label>
                <input type="number" value={formData.weightage} onChange={e => setFormData({ ...formData, weightage: parseFloat(e.target.value) || 0 })} className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-rose-500 text-sm font-bold" />
                <p className="text-xs text-gray-400 mt-1 italic">E.g. set 25% each for 4 terms = 100% total combined.</p>
              </div>
            </div>
            <div className="px-6 py-4 bg-white border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow flex items-center gap-2 disabled:opacity-50">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : editId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
