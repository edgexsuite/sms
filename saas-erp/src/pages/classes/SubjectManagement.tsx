import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { FileText, PlusCircle, Trash2, Save, X, BookOpen, Target, Settings as SettingsIcon, Edit2 } from 'lucide-react';

const DEFAULT_PRESETS: Record<string, string[]> = {
  'Pre-School': ['English', 'Mathematics', 'General Knowledge', 'Art & Craft', 'Rhymes'],
  'Primary (1-5)': ['Urdu', 'English', 'Mathematics', 'General Science', 'Social Studies', 'Islamiyat'],
  'Elementary (6-8)': ['Urdu', 'English', 'Mathematics', 'General Science', 'Social Studies', 'Islamiyat', 'Computer Science'],
  'Secondary (9-10)': ['Urdu', 'English', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer', 'Islamiyat', 'Pak Studies'],
  'Higher Secondary (11-12)': ['Urdu', 'English', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science'],
  'Higher Education': ['English', 'Research Methodology', 'Major Contexts', 'Elective 1', 'Elective 2']
};

const normalizePresetConfig = (raw: unknown): Record<string, string[]> => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return DEFAULT_PRESETS;

  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.map(item => String(item).trim()).filter(Boolean) : [],
    ])
  );
};

export default function SubjectManagement() {
  const { userRole } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // New subject form
  const [showForm, setShowForm] = useState(false);
  const [newSubject, setNewSubject] = useState({
    subject_name: '',
    subject_code: '',
    total_marks: 100,
    passing_marks: 33
  });
  const [saving, setSaving] = useState(false);

  // Bulk template presets
  const [presets, setPresets] = useState<Record<string, string[]>>(DEFAULT_PRESETS);
  const [showPresetManager, setShowPresetManager] = useState(false);
  const [editingPresetName, setEditingPresetName] = useState('');
  const [editingPresetSubjects, setEditingPresetSubjects] = useState('');

  useEffect(() => {
    if (userRole?.school_id) {
      fetchClasses();
      fetchPresets();
    }
  }, [userRole]);

  useEffect(() => {
    if (selectedClass) fetchSubjects();
    else setSubjects([]);
  }, [selectedClass]);

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('id, name, section').eq('school_id', userRole?.school_id).order('name').order('section');
    if (data) setClasses(data);
  };

  const fetchSubjects = async () => {
    setLoading(true);
    const { data } = await supabase.from('subjects').select('*').eq('class_id', selectedClass).order('subject_name');
    if (data) setSubjects(data);
    setLoading(false);
  };

  const fetchPresets = async () => {
    const { data } = await supabase.from('form_settings')
      .select('sections_config')
      .eq('school_id', userRole!.school_id)
      .eq('form_name', 'curriculum_presets')
      .maybeSingle();

    if (data?.sections_config) {
      setPresets(normalizePresetConfig(data.sections_config));
    }
  };

  const savePresetsToDb = async (newPresets: Record<string, string[]>) => {
    await supabase.from('form_settings').upsert(
      { school_id: userRole!.school_id, form_name: 'curriculum_presets', sections_config: newPresets },
      { onConflict: 'school_id,form_name' }
    );
    setPresets(newPresets);
  };

  const handleSavePreset = async () => {
    if (!editingPresetName.trim() || !editingPresetSubjects.trim()) return alert("Preset Name and Subjects are required.");
    
    const subjectList = editingPresetSubjects.split(',').map(s => s.trim()).filter(s => s);
    const newPresets = { ...presets, [editingPresetName.trim()]: subjectList };
    
    await savePresetsToDb(newPresets);
    setEditingPresetName('');
    setEditingPresetSubjects('');
  };

  const handleDeletePreset = async (presetName: string) => {
    if (!window.confirm(`Delete the preset "${presetName}"?`)) return;
    const newPresets = { ...presets };
    delete newPresets[presetName];
    await savePresetsToDb(newPresets);
  };

  const handleAddSubject = async () => {
    if (!newSubject.subject_name.trim()) return alert('Subject name is required.');
    setSaving(true);
    try {
      const { error } = await supabase.from('subjects').insert([{
        school_id: userRole?.school_id,
        class_id: selectedClass,
        subject_name: newSubject.subject_name.trim(),
        subject_code: newSubject.subject_code.trim() || null,
        total_marks: newSubject.total_marks,
        passing_marks: newSubject.passing_marks
      }]);
      if (error) throw error;
      setNewSubject({ subject_name: '', subject_code: '', total_marks: 100, passing_marks: 33 });
      setShowForm(false);
      fetchSubjects();
    } catch (err: any) { alert(err.message); }
    setSaving(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Remove "${name}" from this class? This will affect any existing exam results.`)) return;
    const { error } = await supabase.from('subjects').delete().eq('id', id);
    if (error) return alert(error.message);
    fetchSubjects();
  };

  const applyPreset = async (presetName: string) => {
    if (!window.confirm(`Apply the "${presetName}" preset? This will insert all standard subjects for this class level.`)) return;

    const subjectNames = presets[presetName];
    const existingNames = subjects.map(s => s.subject_name);
    const toInsert = subjectNames
      .filter(n => !existingNames.includes(n))
      .map(n => ({
        school_id: userRole?.school_id,
        class_id: selectedClass,
        subject_name: n,
        total_marks: 100,
        passing_marks: 33
      }));

    if (toInsert.length === 0) return alert('All subjects from this preset are already added!');

    try {
      const { error } = await supabase.from('subjects').insert(toInsert);
      if (error) throw error;
      fetchSubjects();
      alert(`Successfully added ${toInsert.length} subjects!`);
    } catch (err: any) { alert(err.message); }
  };

  const updateMarks = async (id: string, field: string, value: number) => {
    await supabase.from('subjects').update({ [field]: value }).eq('id', id);
    setSubjects(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const currentClass = classes.find(c => c.id === selectedClass);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-purple-600" /> Subject Curriculum Mapper
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Define subjects per class. Set total and passing marks to power the Exams engine.
          </p>
        </div>
      </div>

      {/* Class Selector */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Select Class & Section</label>
        <div className="flex flex-col md:flex-row gap-4">
          <select
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
            className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-purple-500 font-medium text-gray-800"
          >
            <option value="">-- Choose a Class to Configure --</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name} — Section {c.section}</option>)}
          </select>

          {selectedClass && (
            <>
              <button
                onClick={() => { setNewSubject({ subject_name: '', subject_code: '', total_marks: 100, passing_marks: 33 }); setShowForm(true); }}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-lg font-bold shadow transition"
              >
                <PlusCircle className="w-4 h-4" /> Add Subject
              </button>
            </>
          )}
        </div>

        {/* Quick Presets */}
        {selectedClass && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">Quick Apply Curriculum Presets</p>
              <div className="flex flex-wrap gap-2">
                {Object.keys(presets).map(preset => (
                  <button
                    key={preset}
                    onClick={() => applyPreset(preset)}
                    className="text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-full hover:bg-purple-100 shadow-sm transition"
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>
            
            <button 
              onClick={() => setShowPresetManager(true)}
              className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-purple-600 border border-gray-200 hover:border-purple-200 bg-white px-3 py-1.5 rounded-lg transition"
            >
              <SettingsIcon className="w-3.5 h-3.5" /> Manage Presets
            </button>
          </div>
        )}
      </div>

      {/* Subject Table */}
      {selectedClass && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-purple-50 px-6 py-4 border-b border-purple-100 flex justify-between items-center">
            <div>
              <h2 className="font-black text-purple-900">{currentClass?.name} — Section {currentClass?.section}</h2>
              <p className="text-xs text-purple-600 font-medium mt-0.5">{subjects.length} subjects configured</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-purple-600">
              <Target className="w-4 h-4" /> Marks define exam grading automatically
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-500 font-medium">Loading subjects...</div>
          ) : subjects.length === 0 ? (
            <div className="p-12 text-center">
              <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No subjects configured for this class yet.</p>
              <p className="text-gray-400 text-sm mt-1">Use a preset above or click "Add Subject" to get started.</p>
            </div>
          ) : (
            <div>
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-2 px-6 py-2 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                <div className="col-span-4">Subject Name</div>
                <div className="col-span-2">Code</div>
                <div className="col-span-2 text-center">Total Marks</div>
                <div className="col-span-2 text-center">Pass Marks</div>
                <div className="col-span-2 text-center">Pass %</div>
              </div>

              <div className="divide-y divide-gray-100">
                {subjects.map((subj, idx) => {
                  const passPct = subj.total_marks > 0 ? Math.round((subj.passing_marks / subj.total_marks) * 100) : 0;
                  return (
                    <div key={subj.id} className="grid grid-cols-12 gap-2 px-6 py-3 items-center hover:bg-gray-50 transition group">
                      <div className="col-span-4 flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-[10px] font-black flex items-center justify-center shrink-0">{idx + 1}</span>
                        <span className="font-bold text-gray-900">{subj.subject_name}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-xs text-gray-500 font-mono">{subj.subject_code || '—'}</span>
                      </div>
                      <div className="col-span-2 flex justify-center">
                        <input
                          type="number"
                          value={subj.total_marks}
                          onChange={e => updateMarks(subj.id, 'total_marks', parseInt(e.target.value) || 0)}
                          className="w-20 text-center border border-gray-200 rounded px-2 py-1 text-sm font-bold focus:ring-purple-400"
                        />
                      </div>
                      <div className="col-span-2 flex justify-center">
                        <input
                          type="number"
                          value={subj.passing_marks}
                          onChange={e => updateMarks(subj.id, 'passing_marks', parseInt(e.target.value) || 0)}
                          className="w-20 text-center border border-gray-200 rounded px-2 py-1 text-sm font-bold text-orange-600 focus:ring-orange-400"
                        />
                      </div>
                      <div className="col-span-2 flex justify-center items-center gap-2">
                        <span className={`text-sm font-black ${passPct <= 40 ? 'text-green-600' : passPct <= 60 ? 'text-orange-500' : 'text-red-600'}`}>
                          {passPct}%
                        </span>
                        <button
                          onClick={() => handleDelete(subj.id, subj.subject_name)}
                          className="ml-2 p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary Footer */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-6 text-sm text-gray-600">
                <span>Total Subjects: <strong>{subjects.length}</strong></span>
                <span>Total Max Marks: <strong>{subjects.reduce((acc, s) => acc + (s.total_marks || 0), 0)}</strong></span>
                <span>Total Pass Marks: <strong>{subjects.reduce((acc, s) => acc + (s.passing_marks || 0), 0)}</strong></span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Subject Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-purple-600 px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <FileText className="w-5 h-5" /> New Subject
              </h3>
              <button onClick={() => setShowForm(false)} className="text-purple-200 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 bg-gray-50">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Subject Name *</label>
                <input
                  type="text"
                  value={newSubject.subject_name}
                  onChange={e => setNewSubject({ ...newSubject, subject_name: e.target.value })}
                  placeholder="e.g. Mathematics"
                  className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-purple-500 text-sm font-medium"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Subject Code (Optional)</label>
                <input
                  type="text"
                  value={newSubject.subject_code}
                  onChange={e => setNewSubject({ ...newSubject, subject_code: e.target.value })}
                  placeholder="e.g. MATH-1"
                  className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-purple-500 text-sm font-medium"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Total Marks</label>
                  <input
                    type="number"
                    value={newSubject.total_marks}
                    onChange={e => setNewSubject({ ...newSubject, total_marks: parseInt(e.target.value) || 0 })}
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-purple-500 text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Passing Marks</label>
                  <input
                    type="number"
                    value={newSubject.passing_marks}
                    onChange={e => setNewSubject({ ...newSubject, passing_marks: parseInt(e.target.value) || 0 })}
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-orange-500 text-sm font-bold text-orange-600"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400 italic">
                Pass Rate: {newSubject.total_marks > 0 ? Math.round((newSubject.passing_marks / newSubject.total_marks) * 100) : 0}% — This is auto-applied when generating result cards.
              </p>
            </div>

            <div className="px-6 py-4 bg-white border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition">
                Cancel
              </button>
              <button
                onClick={handleAddSubject}
                disabled={saving}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow flex items-center gap-2 disabled:opacity-50 transition"
              >
                <Save className="w-4 h-4" /> {saving ? 'Adding...' : 'Add Subject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preset Manager Modal */}
      {showPresetManager && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-gray-900 px-6 py-4 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <SettingsIcon className="w-5 h-5 text-purple-400" /> Manage Curriculum Presets
              </h3>
              <button onClick={() => setShowPresetManager(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-6 bg-gray-50 flex-1">
              <div className="space-y-4 mb-8">
                {(Object.entries(presets) as Array<[string, string[]]>).map(([name, subjects]) => (
                  <div key={name} className="bg-white p-4 rounded-xl border border-gray-200 flex flex-col md:flex-row justify-between gap-4">
                     <div>
                       <h4 className="font-bold text-gray-900">{name}</h4>
                       <div className="flex flex-wrap gap-1 mt-2">
                         {subjects.map((sub, i) => (
                            <span key={i} className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{sub}</span>
                         ))}
                       </div>
                     </div>
                     <div className="flex gap-2 shrink-0 md:items-start items-center">
                        <button onClick={() => { setEditingPresetName(name); setEditingPresetSubjects(subjects.join(', ')); }} className="text-blue-600 hover:bg-blue-50 p-2 rounded transition" title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeletePreset(name)} className="text-red-600 hover:bg-red-50 p-2 rounded transition" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                     </div>
                  </div>
                ))}
              </div>

              {/* Add/Edit Form */}
              <div className="bg-white p-5 rounded-xl border border-purple-200 shadow-sm">
                 <h4 className="font-black text-purple-900 mb-4">{editingPresetName && presets[editingPresetName] ? 'Edit Preset' : 'Create New Preset'}</h4>
                 
                 <div className="space-y-4">
                   <div>
                     <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Preset Name</label>
                     <input
                        type="text"
                        value={editingPresetName}
                        onChange={e => setEditingPresetName(e.target.value)}
                        placeholder="e.g. O-Levels (Science)"
                        className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-purple-500 font-medium"
                     />
                   </div>
                   <div>
                     <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Subjects (Comma separated)</label>
                     <textarea
                        value={editingPresetSubjects}
                        onChange={e => setEditingPresetSubjects(e.target.value)}
                        placeholder="e.g. Physics, Chemistry, Biology, Mathematics"
                        className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-purple-500 font-medium min-h-[80px]"
                     />
                   </div>
                   <div className="flex justify-end gap-2 pt-2">
                     {(editingPresetName || editingPresetSubjects) && (
                       <button onClick={() => { setEditingPresetName(''); setEditingPresetSubjects(''); }} className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg">Clear</button>
                     )}
                     <button onClick={handleSavePreset} className="flex items-center gap-2 px-5 py-2 bg-gray-900 hover:bg-black text-white text-sm font-bold rounded-lg shadow">
                       <Save className="w-4 h-4" /> Save Preset
                     </button>
                   </div>
                 </div>
              </div>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
}
