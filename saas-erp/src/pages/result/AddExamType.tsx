import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  ClipboardList, PlusCircle, Pencil, Trash2, Save, X,
  Zap, Calendar, ChevronDown,
} from 'lucide-react';

// ── helpers ──────────────────────────────────────────────────────────────────
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function monthYearLabel(my: string | null | undefined) {
  if (!my) return null;
  const [y, m] = my.split('-');
  const mIdx = parseInt(m, 10) - 1;
  if (isNaN(mIdx) || mIdx < 0 || mIdx > 11) return my;
  return `${MONTH_NAMES[mIdx]} ${y}`;
}

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1; // 1-12

const SESSION_OPTIONS = [
  `${currentYear}-${currentYear + 1}`,
  `${currentYear - 1}-${currentYear}`,
  `${currentYear + 1}-${currentYear + 2}`,
];

const EXAM_TEMPLATES = [
  { name: 'Monthly Test',    weightage: 10,  monthly: true  },
  { name: 'Weekly Test',     weightage: 5,   monthly: false },
  { name: 'First Term Exam', weightage: 25,  monthly: false },
  { name: 'Mid-Term Exam',   weightage: 25,  monthly: false },
  { name: 'Pre-Annual Exam', weightage: 25,  monthly: false },
  { name: 'Annual Exam',     weightage: 25,  monthly: false },
];

// Months for the month picker dropdown
const MONTH_OPTIONS = MONTH_NAMES.map((label, i) => ({
  label,
  value: `${currentYear}-${String(i + 1).padStart(2, '0')}`,
}));
// Add next year months too
for (let m = 1; m <= 12; m++) {
  MONTH_OPTIONS.push({
    label: `${MONTH_NAMES[m - 1]} ${currentYear + 1}`,
    value: `${currentYear + 1}-${String(m).padStart(2, '0')}`,
  });
}

// ── component ─────────────────────────────────────────────────────────────────
export default function AddExamType() {
  const { userRole } = useAuth();
  const [examTypes, setExamTypes] = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [editId,    setEditId]    = useState<string | null>(null);
  const [saving,    setSaving]    = useState(false);

  const [formData, setFormData] = useState({
    name:       '',
    session:    SESSION_OPTIONS[0],
    weightage:  100,
    month_year: '',          // e.g. '2025-04'
    useMonth:   false,       // whether month picker is active
  });

  useEffect(() => { if (userRole?.school_id) fetchAll(); }, [userRole]);

  const fetchAll = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('exam_types')
      .select('*')
      .eq('school_id', userRole?.school_id)
      .order('created_at');
    setExamTypes(data || []);
    setLoading(false);
  };

  // ── open form ─────────────────────────────────────────────────────────────
  const openCreate = (template?: typeof EXAM_TEMPLATES[0]) => {
    setEditId(null);
    const pad = (n: number) => String(n).padStart(2, '0');
    setFormData({
      name:       template?.name || '',
      session:    SESSION_OPTIONS[0],
      weightage:  template?.weightage ?? 100,
      month_year: template?.monthly
        ? `${currentYear}-${pad(currentMonth)}`
        : '',
      useMonth: !!(template?.monthly),
    });
    setShowForm(true);
  };

  const openEdit = (et: any) => {
    setEditId(et.id);
    setFormData({
      name:       et.name,
      session:    et.session || SESSION_OPTIONS[0],
      weightage:  et.weightage ?? 100,
      month_year: et.month_year || '',
      useMonth:   !!et.month_year,
    });
    setShowForm(true);
  };

  // ── quick create current month's monthly test ─────────────────────────────
  const quickCreateMonthly = () => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const my = `${currentYear}-${pad(currentMonth)}`;
    const alreadyExists = examTypes.some(
      e => e.name === 'Monthly Test' && e.month_year === my,
    );
    if (alreadyExists) {
      alert(`Monthly Test for ${MONTH_NAMES[currentMonth - 1]} ${currentYear} already exists.`);
      return;
    }
    setEditId(null);
    setFormData({
      name:       'Monthly Test',
      session:    SESSION_OPTIONS[0],
      weightage:  10,
      month_year: my,
      useMonth:   true,
    });
    setShowForm(true);
  };

  // ── save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!formData.name.trim()) return alert('Exam name is required.');
    setSaving(true);
    try {
      const payload = {
        school_id:  userRole?.school_id,
        name:       formData.name.trim(),
        session:    formData.session,
        weightage:  formData.weightage,
        month_year: formData.useMonth ? formData.month_year : null,
      };
      if (editId) {
        const { error } = await supabase.from('exam_types').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        // Duplicate guard
        if (formData.useMonth && formData.month_year) {
          const dup = examTypes.find(
            e => e.name.toLowerCase() === payload.name.toLowerCase()
              && e.month_year === payload.month_year,
          );
          if (dup) {
            alert(`"${payload.name}" for ${monthYearLabel(payload.month_year)} already exists.`);
            setSaving(false);
            return;
          }
        }
        const { error } = await supabase.from('exam_types').insert([payload]);
        if (error) throw error;
      }
      setShowForm(false);
      fetchAll();
    } catch (err: any) {
      alert(err.message);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? All results tied to this exam will also be deleted.`)) return;
    const { error } = await supabase.from('exam_types').delete().eq('id', id);
    if (error) return alert(error.message);
    fetchAll();
  };

  // ── group exams by name for display ──────────────────────────────────────
  const grouped = examTypes.reduce<Record<string, any[]>>((acc, et) => {
    const key = et.name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(et);
    return acc;
  }, {});

  const GRADE_COLORS: Record<string, string> = {
    'A+': 'bg-emerald-100 text-emerald-800', 'A': 'bg-green-100 text-green-800',
    'B':  'bg-blue-100 text-blue-800',        'C': 'bg-yellow-100 text-yellow-800',
    'D':  'bg-orange-100 text-orange-800',    'F': 'bg-red-100 text-red-800',
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-rose-600" /> Exam Types & Instances
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Each exam event is a separate entry. Create a new one for every monthly test.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={quickCreateMonthly}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-lg font-bold shadow transition text-sm"
          >
            <Zap className="w-4 h-4" /> Quick: This Month's Test
          </button>
          <button
            onClick={() => openCreate()}
            className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-lg font-bold shadow transition text-sm"
          >
            <PlusCircle className="w-4 h-4" /> New Exam
          </button>
        </div>
      </div>

      {/* ── Info box ── */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-bold mb-1">📌 How exam instances work</p>
        <ul className="list-disc ml-5 space-y-1 text-xs text-blue-700">
          <li>
            <strong>Monthly / Weekly tests</strong> — create a new entry each time with the month selected.
            "Monthly Test April 2025" and "Monthly Test May 2025" will be completely separate result sets.
          </li>
          <li>
            <strong>Term / Annual exams</strong> — usually one entry per session (e.g. "Mid-Term 2025-26").
          </li>
          <li>
            Use <strong>"Quick: This Month's Test"</strong> to instantly create this month's monthly test.
          </li>
        </ul>
      </div>

      {/* ── Templates ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <p className="text-xs font-bold text-gray-500 uppercase mb-3">Quick Templates — Click to Pre-Fill</p>
        <div className="flex flex-wrap gap-2">
          {EXAM_TEMPLATES.map(t => (
            <button
              key={t.name}
              onClick={() => openCreate(t)}
              className="text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-full hover:bg-rose-100 transition"
            >
              + {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── Exam list ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading exam types...</div>
        ) : examTypes.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No exams configured yet.</p>
            <p className="text-gray-400 text-sm mt-1">
              Use the templates above or click "New Exam".
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {(Object.entries(grouped) as [string, any[]][]).map(([groupName, items]) => (
              <div key={groupName}>
                {/* Group header (only shown if >1 instance or has month) */}
                {(items.length > 1 || items.some(i => i.month_year)) && (
                  <div className="px-6 py-2 bg-gray-50 flex items-center gap-2">
                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest">{groupName}</span>
                    <span className="text-xs text-gray-300">{items.length} instance{items.length !== 1 ? 's' : ''}</span>
                  </div>
                )}
                {items.map((et, idx) => (
                  <div
                    key={et.id}
                    className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 font-black text-sm flex items-center justify-center">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-gray-900">{et.name}</p>
                          {et.month_year && (
                            <span className="text-xs font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {monthYearLabel(et.month_year)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Session: {et.session || '—'} &bull; Weightage:{' '}
                          <strong>{et.weightage}%</strong>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full font-bold hidden sm:block">
                        {et.weightage}% weight
                      </span>
                      <button
                        onClick={() => openEdit(et)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(et.id, et.name)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Grading legend ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <p className="text-xs font-bold text-gray-500 uppercase mb-3">
          Grading Scale (Auto-Applied to All Results)
        </p>
        <div className="flex flex-wrap gap-2">
          {[['A+','90-100%'],['A','80-89%'],['B','70-79%'],['C','60-69%'],['D','50-59%'],['F','Below 33%']].map(([g, r]) => (
            <div key={g} className={`px-3 py-1.5 rounded-full text-xs font-bold ${GRADE_COLORS[g]}`}>
              {g} — {r}
            </div>
          ))}
        </div>
      </div>

      {/* ── Modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Modal header */}
            <div className="bg-rose-600 px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-lg text-white">
                {editId ? 'Edit Exam' : 'New Exam / Test'}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-rose-200 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 bg-gray-50">

              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Exam Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Monthly Test"
                  className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-rose-400"
                  autoFocus
                />
              </div>

              {/* Month toggle */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFormData(p => ({ ...p, useMonth: !p.useMonth }))}
                  className={`w-10 h-5 rounded-full transition-colors relative ${
                    formData.useMonth ? 'bg-indigo-600' : 'bg-gray-300'
                  }`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    formData.useMonth ? 'left-5' : 'left-0.5'
                  }`} />
                </button>
                <span className="text-sm font-bold text-gray-700">
                  This is a monthly / periodic test
                </span>
              </div>

              {/* Month picker (shown when toggle is on) */}
              {formData.useMonth && (
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Month / Period *
                  </label>
                  <div className="relative">
                    <select
                      value={formData.month_year}
                      onChange={e => setFormData({ ...formData, month_year: e.target.value })}
                      className="w-full border border-gray-300 px-3 py-2 rounded-lg bg-white text-sm font-bold appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      <option value="">— Select Month —</option>
                      {MONTH_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                  <p className="text-[11px] text-indigo-600 font-bold mt-1">
                    {formData.month_year
                      ? `This exam will be stored as "${formData.name} — ${monthYearLabel(formData.month_year)}" and kept separate from other months.`
                      : 'Select a month to keep each test separate.'}
                  </p>
                </div>
              )}

              {/* Session */}
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Academic Session
                </label>
                <select
                  value={formData.session}
                  onChange={e => setFormData({ ...formData, session: e.target.value })}
                  className="w-full border border-gray-300 px-3 py-2 rounded-lg bg-white text-sm font-medium"
                >
                  {SESSION_OPTIONS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>

              {/* Weightage */}
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Weightage (%) in Combined Result
                </label>
                <input
                  type="number"
                  value={formData.weightage}
                  onChange={e => setFormData({ ...formData, weightage: parseFloat(e.target.value) || 0 })}
                  className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-rose-400"
                />
                <p className="text-xs text-gray-400 mt-1 italic">
                  E.g. set 25% each for 4 terms = 100% total combined.
                </p>
              </div>

            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 bg-white border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow flex items-center gap-2 disabled:opacity-50 transition"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : editId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
