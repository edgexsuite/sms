import React, { useState, useEffect } from 'react';
import { 
  Star, Search, Filter, TrendingUp, Award, Users, BookOpen, 
  Plus, Save, X, Calendar, ChevronRight, UserCheck, MessageSquare
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatDate } from '../lib/utils';

export default function Evaluation() {
  const { userRole } = useAuth();
  const [activeTab, setActiveTab] = useState<'students' | 'teachers'>('students');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [examTypes, setExamTypes] = useState<any[]>([]);

  // Modal / Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [evalForm, setEvalForm] = useState({
    target_type: 'student' as 'student' | 'staff',
    student_id: '',
    staff_id: '',
    exam_type_id: '',
    class_id: '',
    feedback: '',
    evaluation_date: new Date().toISOString().split('T')[0],
    ratings: {} as any
  });

  const studentRatingKeys = ['Behavior', 'Punctuality', 'Participation', 'Academic Interest'];
  const staffRatingKeys = ['Teaching Quality', 'Discipline', 'Student Engagement', 'Admin Compliance'];

  useEffect(() => {
    if (userRole?.school_id) {
      fetchInitialData();
    }
  }, [userRole, activeTab]);

  const fetchInitialData = async () => {
    setLoading(true);
    const sid = userRole?.school_id;

    // Fetch Evaluations
    const { data: evals } = await supabase
      .from('evaluations')
      .select('*, student:students(full_name, roll_number), staff:staff(full_name, role), evaluator:staff!evaluator_id(full_name), exam_type:exam_types(name)')
      .eq('school_id', sid)
      .eq('target_type', activeTab === 'students' ? 'student' : 'staff')
      .order('evaluation_date', { ascending: false });

    if (evals) setEvaluations(evals);

    // Fetch Targets for Modal
    if (activeTab === 'students') {
      const [{ data: stus }, { data: cls }, { data: exams }] = await Promise.all([
        supabase.from('students').select('id, full_name, roll_number, class_id').eq('school_id', sid).eq('status', 'active'),
        supabase.from('classes').select('id, name, section').eq('school_id', sid).order('name'),
        supabase.from('exam_types').select('id, name, session').eq('school_id', sid).order('created_at'),
      ]);
      if (stus) setStudents(stus);
      if (cls) setClasses(cls);
      if (exams) setExamTypes(exams);
    } else {
      const { data: tchrs } = await supabase.from('staff').select('id, full_name, role').eq('school_id', sid).eq('is_active', true);
      if (tchrs) setStaff(tchrs);
    }

    setLoading(false);
  };

  const handleSaveEval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userRole?.school_id) return;
    
    setSaving(true);
    try {
      const payload: any = {
        target_type: evalForm.target_type,
        feedback: evalForm.feedback,
        evaluation_date: evalForm.evaluation_date,
        ratings: evalForm.ratings,
        school_id: userRole.school_id,
      };
      if (evalForm.target_type === 'student') {
        payload.student_id = evalForm.student_id || null;
        if (evalForm.exam_type_id) payload.exam_type_id = evalForm.exam_type_id;
      } else {
        payload.staff_id = evalForm.staff_id || null;
      }
      const { error } = await supabase.from('evaluations').insert([payload]);

      if (error) throw error;
      setIsModalOpen(false);
      setEvalForm({
        target_type: activeTab === 'students' ? 'student' : 'staff',
        student_id: '',
        staff_id: '',
        exam_type_id: '',
        class_id: '',
        feedback: '',
        evaluation_date: new Date().toISOString().split('T')[0],
        ratings: {}
      });
      fetchInitialData();
    } catch (error: any) {
      alert(error.message);
    }
    setSaving(false);
  };

  const filteredEvals = evaluations.filter(e => {
    const name = activeTab === 'students' ? e.student?.full_name : e.staff?.full_name;
    return name?.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Award className="w-7 h-7 text-amber-500" /> Evaluation & Performance
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Formal qualitative reviews for students and staff performance tracking.</p>
        </div>
        
        <button 
          onClick={() => { 
            setEvalForm({...evalForm, target_type: activeTab === 'students' ? 'student' : 'staff'}); 
            setIsModalOpen(true); 
          }}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
        >
          <Plus className="w-4 h-4" /> New {activeTab === 'students' ? 'Student' : 'Staff'} Review
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('students')}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'students' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Users className="w-4 h-4" /> Student Evaluations
        </button>
        <button
          onClick={() => setActiveTab('teachers')}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'teachers' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <BookOpen className="w-4 h-4" /> Teacher / Staff Reviews
        </button>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-50 bg-gray-50/50 flex flex-col md:flex-row justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder={`Search ${activeTab}...`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50">
            <Filter className="w-4 h-4" /> Export CSV
          </button>
        </div>

        {loading ? (
          <div className="p-20 text-center text-gray-400 font-bold">Loading Evaluations...</div>
        ) : filteredEvals.length === 0 ? (
          <div className="p-20 text-center flex flex-col items-center gap-3">
             <TrendingUp className="w-12 h-12 text-gray-200" />
             <p className="text-gray-500 font-medium">No evaluations found for this period.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
            {filteredEvals.map(ev => {
              const rValues = Object.values(ev.ratings || {}) as number[];
              const avg = rValues.length ? (rValues.reduce((a,b) => a+b, 0) / rValues.length).toFixed(1) : 'N/A';
              
              return (
                <div key={ev.id} className="bg-white border-2 border-gray-50 rounded-2xl p-5 hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-50/50 transition-all group flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-sm">
                        {(activeTab === 'students' ? ev.student?.full_name : ev.staff?.full_name)?.[0]}
                      </div>
                      <div>
                        <h3 className="font-black text-gray-900 text-sm leading-tight">
                          {activeTab === 'students' ? ev.student?.full_name : ev.staff?.full_name}
                        </h3>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                          {activeTab === 'students' ? `Roll: ${ev.student?.roll_number}` : ev.staff?.role}
                        </p>
                      </div>
                    </div>
                    <div className="bg-amber-50 text-amber-600 px-2 py-1 rounded-lg flex items-center gap-1">
                       <Star className="w-3 h-3 fill-current" />
                       <span className="text-xs font-black">{avg}</span>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4 bg-gray-50/50 p-3 rounded-xl">
                    {Object.entries(ev.ratings || {}).map(([key, val]) => (
                      <div key={key} className="flex justify-between items-center text-[10px]">
                        <span className="font-bold text-gray-500 uppercase">{key}</span>
                        <div className="flex gap-0.5 text-amber-400">
                          {[1,2,3,4,5].map(s => <Star key={s} className={`w-2.5 h-2.5 ${s <= (val as number) ? 'fill-current' : 'text-gray-200'}`} />)}
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-gray-600 italic line-clamp-2 mb-4">"{ev.feedback}"</p>
                  
                  <div className="mt-auto pt-4 border-t border-gray-50 flex justify-between items-center text-[9px] font-bold text-gray-400">
                     <span className="flex items-center gap-1 uppercase tracking-tighter"><Calendar className="w-3 h-3" /> {formatDate(ev.evaluation_date)}</span>
                     <div className="flex flex-col items-end gap-0.5">
                       {ev.exam_type?.name && <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded uppercase">{ev.exam_type.name}</span>}
                       <span className="bg-gray-100 px-2 py-0.5 rounded uppercase">By: {ev.evaluator?.full_name || 'Admin'}</span>
                     </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Evaluation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
             <div className="bg-indigo-600 px-8 py-6 flex justify-between items-center text-white">
               <div>
                 <h3 className="text-xl font-black tracking-tight">Submit Performance Review</h3>
                 <p className="text-indigo-100 text-[10px] mt-1 uppercase font-bold tracking-widest leading-none">New {activeTab} Evaluation</p>
               </div>
               <button onClick={() => setIsModalOpen(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"><X className="w-5 h-5" /></button>
             </div>
             
             <form onSubmit={handleSaveEval} className="p-8 space-y-6 bg-gray-50 overflow-y-auto max-h-[70vh]">
                
                {/* Exam + Class (students only) */}
                {activeTab === 'students' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest pl-1">Exam (for Report Card)</label>
                      <select
                        value={evalForm.exam_type_id}
                        onChange={e => setEvalForm({...evalForm, exam_type_id: e.target.value})}
                        className="w-full bg-white border border-gray-200 px-3 py-2.5 rounded-xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none"
                      >
                        <option value="">-- No Exam Link --</option>
                        {examTypes.map(et => (
                          <option key={et.id} value={et.id}>{et.name} {et.session ? `(${et.session})` : ''}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest pl-1">Filter by Class</label>
                      <select
                        value={evalForm.class_id}
                        onChange={e => setEvalForm({...evalForm, class_id: e.target.value, student_id: ''})}
                        className="w-full bg-white border border-gray-200 px-3 py-2.5 rounded-xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none"
                      >
                        <option value="">-- All Classes --</option>
                        {classes.map(cls => (
                          <option key={cls.id} value={cls.id}>{cls.name} {cls.section}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Target Selection */}
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest pl-1">Select {activeTab} to Review</label>
                  <select
                    required
                    value={activeTab === 'students' ? evalForm.student_id : evalForm.staff_id}
                    onChange={e => setEvalForm({...evalForm, [activeTab === 'students' ? 'student_id' : 'staff_id']: e.target.value})}
                    className="w-full bg-white border border-gray-200 px-4 py-3 rounded-xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none"
                  >
                    <option value="">-- Choose {activeTab} --</option>
                    {(activeTab === 'students'
                      ? (evalForm.class_id ? students.filter(s => s.class_id === evalForm.class_id) : students)
                      : staff
                    ).map(item => (
                      <option key={item.id} value={item.id}>
                        {activeTab === 'students' ? `${item.roll_number} - ${item.full_name}` : `${item.full_name} (${item.role})`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Rating Matrix */}
                <div className="bg-white p-5 rounded-2xl border border-gray-200 space-y-4">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50 pb-2">Rating Matrix (1-5 Stars)</p>
                  {(activeTab === 'students' ? studentRatingKeys : staffRatingKeys).map(key => (
                    <div key={key} className="flex justify-between items-center">
                       <span className="text-xs font-bold text-gray-700">{key}</span>
                       <div className="flex gap-1">
                         {[1,2,3,4,5].map(star => (
                           <button
                             key={star} type="button"
                             onClick={() => setEvalForm({...evalForm, ratings: {...evalForm.ratings, [key]: star}})}
                             className={`p-1 transition-all ${star <= (evalForm.ratings[key] || 0) ? 'text-amber-400' : 'text-gray-200 hover:text-amber-200'}`}
                           >
                             <Star className={`w-5 h-5 ${star <= (evalForm.ratings[key] || 0) ? 'fill-current' : ''}`} />
                           </button>
                         ))}
                       </div>
                    </div>
                  ))}
                </div>

                <div>
                   <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest pl-1">Review Feedback / Observations</label>
                   <textarea 
                     required rows={3}
                     value={evalForm.feedback} onChange={e => setEvalForm({...evalForm, feedback: e.target.value})}
                     className="w-full bg-white border border-gray-200 p-4 rounded-xl text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none resize-none"
                     placeholder={`Share your feedback on this ${activeTab}...`}
                   />
                </div>

                <div>
                   <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest pl-1">Review Date</label>
                   <input 
                     type="date" value={evalForm.evaluation_date}
                     onChange={e => setEvalForm({...evalForm, evaluation_date: e.target.value})}
                     className="w-full bg-white border border-gray-200 px-4 py-3 rounded-xl text-sm font-bold"
                   />
                </div>
             </form>

             <div className="p-8 bg-white border-t border-gray-100 flex gap-3">
               <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition-all">Cancel</button>
               <button onClick={handleSaveEval} disabled={saving} className="flex-[2] py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2">
                 <Save className="w-5 h-5" /> {saving ? 'Submitting...' : 'Post Evaluation'}
               </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
