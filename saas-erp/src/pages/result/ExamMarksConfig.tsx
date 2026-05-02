import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Settings, Save, RefreshCw, ChevronDown, 
  BookOpen, GraduationCap, AlertCircle, CheckCircle2,
  Layers, CheckSquare, Square, X
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface ExamType { id: string; name: string }
interface ClassRow { id: string; name: string; section: string }
interface SubjectRow { id: string; subject_name: string; total_marks: number; passing_marks: number }
interface ConfigRow { 
  subject_id: string; 
  total_marks: string; 
  passing_marks: string;
  is_dirty?: boolean;
}

export default function ExamMarksConfig() {
  const { userRole } = useAuth();
  const sid = userRole?.school_id;

  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  
  const [configs, setConfigs] = useState<Record<string, ConfigRow>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  
  // -- Bulk Apply states --
  const [showBulkPanel, setShowBulkPanel] = useState(false);
  const [bulkTotal, setBulkTotal] = useState('100');
  const [bulkPassing, setBulkPassing] = useState('33');
  const [bulkClasses, setBulkClasses] = useState<Set<string>>(new Set());
  const [applyingBulk, setApplyingBulk] = useState(false);

  useEffect(() => {
    if (sid) init();
  }, [sid]);

  useEffect(() => {
    if (selectedClass) fetchSubjects();
  }, [selectedClass]);

  useEffect(() => {
    if (selectedExam && selectedClass && subjects.length > 0) fetchExistingConfigs();
  }, [selectedExam, selectedClass, subjects]);

  const init = async () => {
    setLoading(true);
    const [
      { data: exams },
      { data: cls }
    ] = await Promise.all([
      supabase.from('exam_types').select('id, name').eq('school_id', sid).order('name'),
      supabase.from('classes').select('id, name, section').eq('school_id', sid).order('name')
    ]);
    if (exams) setExamTypes(exams);
    if (cls) setClasses(cls);
    setLoading(false);
  };

  const fetchSubjects = async () => {
    const { data } = await supabase
      .from('subjects')
      .select('id, subject_name, total_marks, passing_marks')
      .eq('class_id', selectedClass)
      .order('subject_name');
    setSubjects(data || []);
  };

  const fetchExistingConfigs = async () => {
    const { data } = await supabase
      .from('exam_subject_config')
      .select('*')
      .eq('exam_type_id', selectedExam)
      .in('subject_id', subjects.map(s => s.id));

    const mapping: Record<string, ConfigRow> = {};
    subjects.forEach(sub => {
      const existing = data?.find(d => d.subject_id === sub.id);
      mapping[sub.id] = {
        subject_id: sub.id,
        total_marks: existing ? String(existing.total_marks) : '',
        passing_marks: existing ? String(existing.passing_marks) : '',
      };
    });
    setConfigs(mapping);
  };

  const handleUpdate = (subId: string, field: 'total_marks' | 'passing_marks', value: string) => {
    setConfigs(prev => ({
      ...prev,
      [subId]: { ...prev[subId], [field]: value, is_dirty: true }
    }));
  };

  const syncWithDefaults = () => {
    const next = { ...configs };
    subjects.forEach(sub => {
      next[sub.id] = {
        ...next[sub.id],
        total_marks: String(sub.total_marks),
        passing_marks: String(sub.passing_marks),
        is_dirty: true
      };
    });
    setConfigs(next);
  };

  const handleSave = async () => {
    if (!selectedExam || !sid) return;
    setSaving(true);
    setStatus(null);

    const dirtyRows = (Object.values(configs) as ConfigRow[]).filter(c => c.is_dirty);
    if (dirtyRows.length === 0) {
      setSaving(false);
      return;
    }

    const upserts = dirtyRows.map(c => ({
      school_id: sid,
      exam_type_id: selectedExam,
      subject_id: c.subject_id,
      total_marks: Number(c.total_marks),
      passing_marks: Number(c.passing_marks)
    }));

    const { error } = await supabase
      .from('exam_subject_config')
      .upsert(upserts, { onConflict: 'exam_type_id,subject_id' });

    if (error) {
      setStatus({ type: 'error', msg: error.message });
    } else {
      setStatus({ type: 'success', msg: 'Configurations saved successfully!' });
      fetchExistingConfigs();
    }
    setSaving(false);
  };
  
  const handleBulkApply = async () => {
    if (!selectedExam || !sid) return;
    if (bulkClasses.size === 0) {
      setStatus({ type: 'error', msg: 'Please select at least one class.' });
      return;
    }
    
    setApplyingBulk(true);
    setStatus(null);
    
    try {
      // 1. Fetch ALL subjects for the selected classes
      const { data: allSubs, error: fetchErr } = await supabase
        .from('subjects')
        .select('id, class_id')
        .in('class_id', Array.from(bulkClasses));
        
      if (fetchErr) throw fetchErr;
      if (!allSubs || allSubs.length === 0) {
        throw new Error('No subjects found in the selected classes.');
      }
      
      // 2. Prepare upserts
      const upserts = allSubs.map(s => ({
        school_id: sid,
        exam_type_id: selectedExam,
        subject_id: s.id,
        total_marks: Number(bulkTotal),
        passing_marks: Number(bulkPassing)
      }));
      
      // 3. Upsert
      const { error: upsertErr } = await supabase
        .from('exam_subject_config')
        .upsert(upserts, { onConflict: 'exam_type_id,subject_id' });
        
      if (upsertErr) throw upsertErr;
      
      setStatus({ type: 'success', msg: `Bulk marks applied to ${allSubs.length} subjects!` });
      setShowBulkPanel(false);
      
      // If the currently selected class was among the bulk targets, refresh the grid
      if (bulkClasses.has(selectedClass)) {
        fetchExistingConfigs();
      }
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setApplyingBulk(false);
    }
  };

  if (loading) return <div className="p-12 text-center text-slate-400">Loading Configuration...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight">
            <Settings className="w-7 h-7 text-indigo-600" /> Exam Marks Config
          </h1>
          <p className="text-slate-500 text-sm mt-1">Set custom total and passing marks for each subject per exam type.</p>
        </div>
        <button 
          onClick={handleSave} 
          disabled={saving || !selectedExam || !selectedClass}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition shadow-lg shadow-indigo-100 disabled:opacity-50"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

      {/* Bulk Options Toggle */}
      <div className="flex gap-2 no-print">
        <button
          onClick={() => setShowBulkPanel(!showBulkPanel)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition border",
            showBulkPanel 
              ? "bg-amber-100 border-amber-200 text-amber-700"
              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
          )}
        >
          <Layers className="w-4 h-4" />
          {showBulkPanel ? 'Hide Bulk Options' : 'Bulk Apply Marks'}
        </button>
      </div>

      {/* Bulk Panel */}
      {showBulkPanel && (
        <div className="bg-amber-50 border border-amber-100 rounded-3xl p-6 space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-200 rounded-2xl flex items-center justify-center">
                <Layers className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <h3 className="font-black text-amber-900 text-sm uppercase tracking-tight">Bulk Marks Entry</h3>
                <p className="text-amber-600 text-[10px] font-bold uppercase tracking-widest">Apply single entry to multiple classes/subjects</p>
              </div>
            </div>
            <button onClick={() => setShowBulkPanel(false)} className="text-amber-400 hover:text-amber-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Values */}
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest block mb-1.5">Bulk Total Marks</label>
                <input 
                  type="number"
                  value={bulkTotal}
                  onChange={e => setBulkTotal(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-amber-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest block mb-1.5">Bulk Passing Marks</label>
                <input 
                  type="number"
                  value={bulkPassing}
                  onChange={e => setBulkPassing(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-amber-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
            </div>

            {/* Class Selection */}
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Select Target Classes</label>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setBulkClasses(new Set(classes.map(c => c.id)))}
                    className="text-[9px] font-black text-amber-700 uppercase hover:underline"
                  >
                    Select All
                  </button>
                  <button 
                    onClick={() => setBulkClasses(new Set())}
                    className="text-[9px] font-black text-amber-700 uppercase hover:underline"
                  >
                    Clear All
                  </button>
                </div>
              </div>
              <div className="bg-white/50 border border-amber-100 rounded-2xl p-4 max-h-48 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2 custom-scrollbar">
                {classes.map(c => (
                  <label key={c.id} className={cn(
                    "flex items-center gap-2 p-2 rounded-xl cursor-pointer transition border text-[11px] font-bold",
                    bulkClasses.has(c.id) ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-white border-transparent text-slate-500"
                  )}>
                    <input 
                      type="checkbox"
                      className="sr-only"
                      checked={bulkClasses.has(c.id)}
                      onChange={() => {
                        const next = new Set(bulkClasses);
                        if (next.has(c.id)) next.delete(c.id);
                        else next.add(c.id);
                        setBulkClasses(next);
                      }}
                    />
                    {bulkClasses.has(c.id) ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                    {c.name} {c.section}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-amber-100">
            <button
              onClick={handleBulkApply}
              disabled={applyingBulk || !selectedExam || bulkClasses.size === 0}
              className="w-full flex items-center justify-center gap-2 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition disabled:opacity-50 shadow-lg shadow-amber-200"
            >
              {applyingBulk ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {applyingBulk ? 'Processing Bulk Upsert...' : `Apply to ${bulkClasses.size} Classes`}
            </button>
            {!selectedExam && (
              <p className="text-center text-[10px] font-bold text-rose-500 mt-2 uppercase tracking-wider italic">Please select an Exam Type first</p>
            )}
          </div>
        </div>
      )}

      {/* Selectors */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Select Exam Type</label>
          <div className="relative">
            <select 
              value={selectedExam} 
              onChange={e => setSelectedExam(e.target.value)}
              className="w-full appearance-none px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none pr-10"
            >
              <option value="">— Choose Exam —</option>
              {examTypes.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Select Class</label>
          <div className="relative">
            <select 
              value={selectedClass} 
              onChange={e => setSelectedClass(e.target.value)}
              className="w-full appearance-none px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none pr-10"
            >
              <option value="">— Choose Class —</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {status && (
        <div className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold animate-in fade-in slide-in-from-top-2",
          status.type === 'success' ? "bg-emerald-50 border border-emerald-100 text-emerald-700" : "bg-rose-50 border border-rose-100 text-rose-700"
        )}>
          {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {status.msg}
        </div>
      )}

      {/* Grid */}
      {selectedExam && selectedClass ? (
        subjects.length > 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-black text-slate-900 text-sm uppercase tracking-wide flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-500" /> Subject-Wise Marks Configuration
              </h2>
              <button 
                onClick={syncWithDefaults}
                className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-1 uppercase tracking-widest"
              >
                <RefreshCw className="w-3 h-3" /> Sync with defaults
              </button>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Subject</th>
                  <th className="text-center px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-40">Total Marks</th>
                  <th className="text-center px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-40">Passing Marks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {subjects.map(sub => {
                  const cfg = configs[sub.id] || { subject_id: sub.id, total_marks: '', passing_marks: '' };
                  return (
                    <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-800 text-sm">{sub.subject_name}</span>
                        <div className="text-[10px] text-slate-400 font-bold mt-0.5">
                          Default: {sub.total_marks} Total · {sub.passing_marks} Passing
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <input 
                          type="number"
                          value={cfg.total_marks}
                          onChange={e => handleUpdate(sub.id, 'total_marks', e.target.value)}
                          placeholder={String(sub.total_marks)}
                          className={cn(
                            "w-full text-center font-black text-sm px-3 py-2 rounded-xl border transition focus:outline-none focus:ring-2 focus:ring-indigo-500",
                            cfg.is_dirty ? "border-indigo-300 bg-indigo-50/30" : "border-slate-200 bg-white"
                          )}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input 
                          type="number"
                          value={cfg.passing_marks}
                          onChange={e => handleUpdate(sub.id, 'passing_marks', e.target.value)}
                          placeholder={String(sub.passing_marks)}
                          className={cn(
                            "w-full text-center font-black text-sm px-3 py-2 rounded-xl border transition focus:outline-none focus:ring-2 focus:ring-indigo-500",
                            cfg.is_dirty ? "border-indigo-300 bg-indigo-50/30" : "border-slate-200 bg-white"
                          )}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
            <GraduationCap className="w-12 h-12 text-slate-100 mx-auto mb-4" />
            <p className="text-slate-400 font-bold">No subjects assigned to this class yet.</p>
          </div>
        )
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center opacity-60">
          <BookOpen className="w-12 h-12 text-slate-100 mx-auto mb-4" />
          <p className="text-slate-400 font-bold italic">Please select an Exam Type and Class to start configuration.</p>
        </div>
      )}
    </div>
  );
}
