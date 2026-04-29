import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Calendar, PlusCircle, Trash2, Save, X, Clock } from 'lucide-react';
import { formatDate } from '../../lib/utils';

export default function AddExamSchedule() {
  const { userRole } = useAuth();
  const [examTypes, setExamTypes] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);

  const [selectedExamType, setSelectedExamType] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    subject_id: '',
    exam_date: '',
    start_time: '09:00',
    end_time: '12:00',
    total_marks: 100,
    passing_marks: 33,
  });

  useEffect(() => { if (userRole?.school_id) fetchInit(); }, [userRole]);
  useEffect(() => { if (selectedClass) fetchSubjects(); else setSubjects([]); }, [selectedClass]);
  useEffect(() => { if (selectedExamType && selectedClass) fetchSchedules(); }, [selectedExamType, selectedClass]);

  const fetchInit = async () => {
    const [{ data: et }, { data: cls }] = await Promise.all([
      supabase.from('exam_types').select('*').eq('school_id', userRole?.school_id).order('created_at'),
      supabase.from('classes').select('id, name, section').eq('school_id', userRole?.school_id).order('name')
    ]);
    if (et) setExamTypes(et);
    if (cls) setClasses(cls);
  };

  const fetchSubjects = async () => {
    const { data } = await supabase.from('subjects').select('*').eq('class_id', selectedClass).order('subject_name');
    if (data) setSubjects(data);
  };

  const fetchSchedules = async () => {
    const { data } = await supabase.from('exam_schedules')
      .select('*, subjects(subject_name), classes(name, section)')
      .eq('exam_type_id', selectedExamType)
      .eq('class_id', selectedClass)
      .order('exam_date');
    if (data) setSchedules(data);
  };

  const openForm = () => {
    if (!selectedExamType || !selectedClass) return alert('Select an exam type and class first.');
    setFormData({ subject_id: subjects[0]?.id || '', exam_date: '', start_time: '09:00', end_time: '12:00', total_marks: 100, passing_marks: 33 });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.subject_id || !formData.exam_date) return alert('Subject and date are required.');
    setSaving(true);
    try {
      const { error } = await supabase.from('exam_schedules').insert([{
        school_id: userRole?.school_id,
        exam_type_id: selectedExamType,
        class_id: selectedClass,
        subject_id: formData.subject_id,
        exam_date: formData.exam_date,
        start_time: formData.start_time || null,
        end_time: formData.end_time || null,
        total_marks: formData.total_marks,
        passing_marks: formData.passing_marks,
      }]);
      if (error) throw error;
      setShowForm(false);
      fetchSchedules();
    } catch (err: any) { alert(err.message); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Remove this paper from the schedule?')) return;
    await supabase.from('exam_schedules').delete().eq('id', id);
    fetchSchedules();
  };

  const bulkSchedule = async () => {
    if (!selectedExamType || !selectedClass || subjects.length === 0) return alert('Select exam type, class, and ensure subjects are configured.');
    // Find the next weekday for scheduling
    const today = new Date();
    const inserts = subjects.map((s, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      return {
        school_id: userRole?.school_id,
        exam_type_id: selectedExamType,
        class_id: selectedClass,
        subject_id: s.id,
        exam_date: d.toISOString().split('T')[0],
        total_marks: s.total_marks,
        passing_marks: s.passing_marks,
      };
    });

    try {
      const { error } = await supabase.from('exam_schedules').upsert(inserts, { onConflict: 'exam_type_id,class_id,subject_id' });
      if (error) throw error;
      fetchSchedules();
      alert(`Draft schedule created for ${inserts.length} subjects. Edit dates as needed.`);
    } catch (err: any) { alert(err.message); }
  };

  const currentExam = examTypes.find(e => e.id === selectedExamType);
  const currentClass = classes.find(c => c.id === selectedClass);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-600" /> Step 2: Exam Schedule
          </h1>
          <p className="text-gray-500 text-sm mt-1">Map each subject to a date and time for any exam type.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={bulkSchedule} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-lg font-bold border border-gray-300 transition text-sm">
            ⚡ Auto Draft All Subjects
          </button>
          <button onClick={openForm} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-bold shadow transition">
            <PlusCircle className="w-4 h-4" /> Add Paper
          </button>
        </div>
      </div>

      {/* Selectors */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Exam Type</label>
          <select value={selectedExamType} onChange={e => setSelectedExamType(e.target.value)} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg font-medium text-sm">
            <option value="">-- Select Exam --</option>
            {examTypes.map(e => <option key={e.id} value={e.id}>{e.name} ({e.session})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Target Class</label>
          <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg font-medium text-sm">
            <option value="">-- Select Class --</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name} — {c.section}</option>)}
          </select>
        </div>
      </div>

      {/* Schedule Table */}
      {selectedExamType && selectedClass && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-blue-50 px-6 py-4 border-b border-blue-100">
            <h2 className="font-black text-blue-900">{currentExam?.name} — {currentClass?.name} {currentClass?.section}</h2>
            <p className="text-xs text-blue-600 font-medium mt-0.5">{schedules.length} papers scheduled</p>
          </div>

          {schedules.length === 0 ? (
            <div className="p-10 text-center text-gray-400">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No papers scheduled yet. Click "Auto Draft" or add one manually.</p>
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-11 px-6 py-2 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                <div className="col-span-3">Subject</div>
                <div className="col-span-2">Date</div>
                <div className="col-span-2">Time</div>
                <div className="col-span-2 text-center">Marks (Total / Pass)</div>
                <div className="col-span-2 text-center">Action</div>
              </div>
              <div className="divide-y divide-gray-100">
                {schedules.map(s => (
                  <div key={s.id} className="grid grid-cols-11 px-6 py-3 items-center hover:bg-gray-50 transition">
                    <div className="col-span-3 font-bold text-gray-900 text-sm">{s.subjects?.subject_name}</div>
                    <div className="col-span-2 text-sm text-gray-600 font-medium">{s.exam_date ? formatDate(s.exam_date) : '—'}</div>
                    <div className="col-span-2 text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {s.start_time || '—'} – {s.end_time || '—'}
                    </div>
                    <div className="col-span-2 text-center text-sm font-bold text-gray-800">{s.total_marks} / <span className="text-orange-500">{s.passing_marks}</span></div>
                    <div className="col-span-2 flex justify-center">
                      <button onClick={() => handleDelete(s.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-blue-600 px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-lg text-white">Add Exam Paper</h3>
              <button onClick={() => setShowForm(false)} className="text-blue-200 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4 bg-gray-50">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Subject *</label>
                <select value={formData.subject_id} onChange={e => {
                  const s = subjects.find(s => s.id === e.target.value);
                  setFormData({ ...formData, subject_id: e.target.value, total_marks: s?.total_marks || 100, passing_marks: s?.passing_marks || 33 });
                }} className="w-full border border-gray-300 px-3 py-2 rounded-lg bg-white text-sm font-medium">
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Exam Date *</label>
                <input type="date" value={formData.exam_date} onChange={e => setFormData({ ...formData, exam_date: e.target.value })} className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm font-medium" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Start Time</label>
                  <input type="time" value={formData.start_time} onChange={e => setFormData({ ...formData, start_time: e.target.value })} className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">End Time</label>
                  <input type="time" value={formData.end_time} onChange={e => setFormData({ ...formData, end_time: e.target.value })} className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Total Marks</label>
                  <input type="number" value={formData.total_marks} onChange={e => setFormData({ ...formData, total_marks: parseInt(e.target.value) })} className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm font-bold" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Passing Marks</label>
                  <input type="number" value={formData.passing_marks} onChange={e => setFormData({ ...formData, passing_marks: parseInt(e.target.value) })} className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm font-bold text-orange-600" />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-white border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow flex items-center gap-2">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Add Paper'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
