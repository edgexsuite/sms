import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Trophy, Star, CheckCircle2, ChevronDown, ChevronUp, Save, BarChart3, 
  Calendar, User, AlertCircle, TrendingUp, Award, Users, ClipboardList, Trash2, Printer
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { fetchGradingPolicy, getGradeFromPolicy, GradingBracket } from '../../lib/gradingUtils';

const CHECKPOINTS = [
  { id: 'punctuality', label: 'Punctuality' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'class_management', label: 'Class Management' },
  { id: 'subject_command', label: 'Subject Command' },
  { id: 'school_activities', label: 'Participation towards school activities' },
  { id: 'admissions_contribution', label: 'Contribution towards school admissions' },
  { id: 'results', label: 'Results' },
  { id: 'dress_code', label: 'Dress Code' },
  { id: 'feedback', label: 'Parents/students feedback' },
  { id: 'innovation', label: 'Innovation in school progress' },
];

const GRADES = [
  { label: 'Excellent', points: 10, color: 'text-emerald-600 bg-emerald-50' },
  { label: 'Good', points: 7, color: 'text-indigo-600 bg-indigo-50' },
  { label: 'Average', points: 4, color: 'text-amber-600 bg-amber-50' }
];

export default function TeacherOfMonth() {
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  
  const [teachers, setTeachers] = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [teacherResults, setTeacherResults] = useState<Record<string, any>>({});
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [expandedTeacher, setExpandedTeacher] = useState<string | null>(null);
  const [examTypes, setExamTypes] = useState<any[]>([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [gradingBrackets, setGradingBrackets] = useState<GradingBracket[]>([]);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    const sid = userRole?.school_id;
    if (sid) {
      fetchInitialData(sid);
      fetchGradingPolicy(sid).then(setGradingBrackets);
    }
  }, [userRole?.school_id]);

  useEffect(() => {
    if (selectedMonth && userRole?.school_id) {
      fetchEvaluations();
    }
  }, [selectedMonth, userRole?.school_id]);

  useEffect(() => {
    if (selectedExam && teachers.length > 0 && userRole?.school_id) {
      fetchTeacherResults();
    }
  }, [selectedExam, teachers.length, userRole?.school_id]);

  const fetchInitialData = async (sid: string) => {
    setLoading(true);
    try {
      const { data: staffData } = await supabase.from('staff').select('*').eq('school_id', sid).eq('is_active', true).eq('is_deleted', false).order('full_name');
      setTeachers(staffData || []);
      const { data: exams } = await supabase.from('exam_types').select('*').eq('school_id', sid).order('created_at', { ascending: false });
      setExamTypes(exams || []);
      if (exams && exams.length > 0) setSelectedExam(exams[0].id);
    } finally {
      setLoading(false);
    }
  };

  const fetchEvaluations = async () => {
    if (!userRole?.school_id) return;
    const { data } = await supabase.from('staff_evaluations').select('*').eq('school_id', userRole?.school_id).eq('evaluation_month', `${selectedMonth}-01`);
    setEvaluations(data || []);
  };

  const fetchTeacherResults = async () => {
    if (!selectedExam || teachers.length === 0 || !userRole?.school_id) return;
    const [{ data: slots }, { data: students }, { data: results }, { data: configs }] = await Promise.all([
      supabase.from('timetable_slots').select('*, class:classes(*), subject:subjects(*)').eq('school_id', userRole?.school_id),
      supabase.from('students').select('id, class_id').eq('school_id', userRole?.school_id).eq('status', 'active'),
      supabase.from('exam_results').select('*').eq('exam_type_id', selectedExam),
      supabase.from('exam_subject_config').select('*').eq('exam_type_id', selectedExam)
    ]);

    const resultsByTeacher: Record<string, any> = {};
    teachers.forEach(teacher => {
      const teacherSlots = slots?.filter(s => s.teacher_id === teacher.id) || [];
      const teacherSheets: any[] = [];
      const uniqueAssignments = new Map<string, any>();
      teacherSlots.forEach(slot => {
        const key = `${slot.class_id}::${slot.subject_id}`;
        if (!uniqueAssignments.has(key)) uniqueAssignments.set(key, slot);
      });

      Array.from(uniqueAssignments.values()).forEach(slot => {
        const classStudents = students?.filter(s => s.class_id === slot.class_id) || [];
        if (classStudents.length === 0) return;
        const cfg = configs?.find(c => c.subject_id === slot.subject_id);
        const totalMarks = cfg?.total_marks ?? slot.subject?.total_marks ?? 100;
        const studentData = classStudents.map(stu => {
          const res = results?.find(r => r.student_id === stu.id && r.subject_id === slot.subject_id);
          return { obtained: res?.is_absent ? 0 : (res?.obtained_marks ?? null), is_absent: res?.is_absent || false, hasData: !!res };
        });
        const present = studentData.filter(sd => sd.hasData && !sd.is_absent);
        if (present.length > 0) {
          const totalObtained = present.reduce((sum, sd) => sum + (sd.obtained || 0), 0);
          const avgPerc = Math.round(((totalObtained / present.length) / totalMarks) * 100);
          teacherSheets.push({ subject: slot.subject?.subject_name, class: slot.class?.name, avgScore: (totalObtained / present.length).toFixed(1), avgPerc });
        }
      });

      if (teacherSheets.length > 0) {
        const overallAvg = Math.round(teacherSheets.reduce((sum, s) => sum + s.avgPerc, 0) / teacherSheets.length);
        const grade = getGradeFromPolicy(overallAvg, 100, gradingBrackets);
        resultsByTeacher[teacher.id] = { sheets: teacherSheets, overallAvg, grade: grade?.grade || '—' };
      }
    });
    setTeacherResults(resultsByTeacher);
  };

  const handleEvaluate = async (teacherId: string, scores: Record<string, number>) => {
    setSaving(teacherId);
    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
    const evaluationData = {
      school_id: userRole?.school_id,
      staff_id: teacherId,
      evaluator_id: userRole?.id,
      evaluation_month: `${selectedMonth}-01`,
      punctuality: scores.punctuality || 0,
      attendance: scores.attendance || 0,
      class_management: scores.class_management || 0,
      subject_command: scores.subject_command || 0,
      school_activities: scores.school_activities || 0,
      admissions_contribution: scores.admissions_contribution || 0,
      results: scores.results || 0,
      dress_code: scores.dress_code || 0,
      feedback: scores.feedback || 0,
      innovation: scores.innovation || 0,
      total_score: totalScore
    };

    const { error } = await supabase.from('staff_evaluations').upsert(evaluationData, { onConflict: 'staff_id,evaluation_month' });
    
    if (error) {
      await supabase.from('staff_evaluations').delete().eq('staff_id', teacherId).eq('evaluation_month', `${selectedMonth}-01`);
      await supabase.from('staff_evaluations').insert(evaluationData);
    }

    fetchEvaluations(); 
    setExpandedTeacher(null);
    setSaving(null);
  };

  const handleReset = async (teacherId: string) => {
    if (!confirm('Are you sure you want to completely clear this evaluation?')) return;
    setSaving(teacherId);
    await supabase.from('staff_evaluations').delete().eq('staff_id', teacherId).eq('evaluation_month', `${selectedMonth}-01`);
    fetchEvaluations(); 
    setExpandedTeacher(null); 
    setSaving(null);
  };

  const winner = evaluations.length > 0 ? [...evaluations].sort((a, b) => b.total_score - a.total_score)[0] : null;
  const winnerTeacher = winner ? teachers.find(t => t.id === winner.staff_id) : null;

  return (
    <>
      <div className="max-w-6xl mx-auto space-y-8 pb-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight font-display flex items-center gap-4 uppercase italic">
            <Trophy className="w-10 h-10 text-amber-500" />
            Teacher of the Month
          </h1>
          <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px] mt-2">Strategic Performance Evaluation & Recognition System</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPrinting(true)}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm active:scale-95"
          >
            <Printer className="w-4 h-4" /> Print Monthly Report
          </button>
          <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
            <Calendar className="w-5 h-5 text-indigo-500 ml-2" />
            <input 
              type="month" 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent border-none focus:ring-0 font-black uppercase text-xs tracking-widest text-slate-700 outline-none"
            />
          </div>
          <select
            value={selectedExam}
            onChange={e => setSelectedExam(e.target.value)}
            className="bg-white px-4 py-3 rounded-2xl border border-slate-100 shadow-sm font-black uppercase text-[10px] text-slate-500 outline-none"
          >
            {examTypes.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      </div>

      {winner && winnerTeacher && (
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[3rem] p-8 text-white shadow-2xl shadow-indigo-200 no-print">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
            <div className="w-32 h-32 rounded-full bg-white/20 p-2 border-4 border-amber-400 shadow-2xl flex-shrink-0">
              {winnerTeacher.photograph_url ? (
                <img src={winnerTeacher.photograph_url} alt={winnerTeacher.full_name} className="w-full h-full rounded-full object-cover" />
              ) : (
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-indigo-700 text-4xl font-black">
                  {winnerTeacher.full_name.charAt(0)}
                </div>
              )}
            </div>
            <div className="text-center md:text-left flex-grow">
              <div className="inline-flex items-center gap-2 bg-amber-400 text-amber-950 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">
                <Star className="w-3 h-3 fill-current" /> Winner of the Month
              </div>
              <h2 className="text-4xl font-black uppercase tracking-tighter italic leading-none">{winnerTeacher.full_name}</h2>
              <p className="text-indigo-100 text-xs font-bold uppercase tracking-[0.2em] mt-2 opacity-80">{winnerTeacher.role || 'Expert Faculty'}</p>
              
              <div className="flex flex-wrap gap-4 mt-8">
                <div className="bg-white/10 backdrop-blur-md rounded-2xl px-6 py-3 border border-white/10">
                  <p className="text-[10px] uppercase text-indigo-200 font-bold tracking-widest mb-1">Total Points</p>
                  <p className="text-2xl font-black">{winner.total_score} <span className="text-xs text-indigo-300">/ 100</span></p>
                </div>
                <div className="bg-white/10 backdrop-blur-md rounded-2xl px-6 py-3 border border-white/10">
                  <p className="text-[10px] uppercase text-indigo-200 font-bold tracking-widest mb-1">Academic Result</p>
                  <p className="text-2xl font-black">{teacherResults[winner.staff_id]?.overallAvg || 0}%</p>
                </div>
                <div className="bg-white/10 backdrop-blur-md rounded-2xl px-6 py-3 border border-white/10">
                  <p className="text-[10px] uppercase text-indigo-200 font-bold tracking-widest mb-1">Grade</p>
                  <p className="text-2xl font-black italic">{teacherResults[winner.staff_id]?.grade || 'A'}</p>
                </div>
              </div>
            </div>
            <div className="hidden lg:block text-right">
              <Award className="w-32 h-32 text-amber-400 opacity-20" />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 no-print">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : teachers.map((teacher) => {
          const evalData = evaluations.find(e => e.staff_id === teacher.id);
          const results = teacherResults[teacher.id];
          const isExpanded = expandedTeacher === teacher.id;

          return (
            <div key={teacher.id} className={cn(
              "group bg-white rounded-[2.5rem] border transition-all duration-500 overflow-hidden",
              isExpanded ? "border-indigo-200 ring-4 ring-indigo-50 shadow-2xl" : "border-slate-100 hover:border-indigo-100 shadow-sm"
            )}>
              <div className="p-6 flex flex-col md:flex-row md:items-center gap-6">
                <div className="flex items-center gap-4 flex-grow">
                  {teacher.photograph_url ? (
                    <img src={teacher.photograph_url} alt={teacher.full_name} className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-inner" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 font-black text-xl border-2 border-white shadow-inner group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                      {teacher.full_name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">{teacher.full_name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{teacher.role || 'Teacher'}</span>
                      {evalData && (
                        <span className="flex items-center gap-1 text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase">
                          <CheckCircle2 className="w-3 h-3" /> Evaluated
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-8 px-6 border-x border-slate-50">
                  <div className="text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Class Avg</p>
                    <p className="text-lg font-black text-indigo-600">{results?.overallAvg || 0}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Grade</p>
                    <p className="text-lg font-black text-slate-700 italic">{results?.grade || '—'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {evalData && (
                    <div className="text-right px-4">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Score</p>
                      <p className="text-xl font-black text-slate-900">{evalData.total_score}</p>
                    </div>
                  )}
                  <button
                    onClick={() => setExpandedTeacher(isExpanded ? null : teacher.id)}
                    className={cn(
                      "flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all",
                      isExpanded ? "bg-slate-900 text-white" : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                    )}
                  >
                    {isExpanded ? (
                      <><ChevronUp className="w-4 h-4" /> Close</>
                    ) : (
                      <><Star className="w-4 h-4" /> Evaluate</>
                    )}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-slate-50 bg-slate-50/50 p-8 space-y-8 animate-in slide-in-from-top duration-500">
                  <div className="bg-white rounded-[2rem] p-6 border border-indigo-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-6">
                      <TrendingUp className="w-5 h-5 text-indigo-600" />
                      <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest italic">Academic Performance Reference</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {results?.sheets.map((s: any, sIdx: number) => (
                        <div key={sIdx} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-500 uppercase truncate">{s.subject}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">{s.class}</p>
                          <div className="flex items-end justify-between mt-3">
                            <span className="text-xl font-black text-slate-900">{s.avgPerc}%</span>
                            <span className="text-[10px] font-bold text-indigo-600 mb-1">Avg: {s.avgScore}</span>
                          </div>
                        </div>
                      ))}
                      {(!results || results.sheets.length === 0) && (
                        <div className="col-span-full py-4 text-center">
                          <p className="text-xs font-bold text-slate-400 italic">No recent exam data available for this teacher.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-xl shadow-slate-100">
                    <div className="flex items-center gap-2 mb-8 border-b border-slate-100 pb-4">
                      <ClipboardList className="w-6 h-6 text-indigo-600" />
                      <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest italic">Evaluation Performa</h4>
                    </div>

                    <EvaluationForm 
                      initialScores={evalData} 
                      onSave={(scores) => handleEvaluate(teacher.id, scores)}
                      onReset={() => handleReset(teacher.id)}
                      isSaving={saving === teacher.id}
                      hasExisting={!!evalData}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>

    {isPrinting && (
      <PrintReport 
        month={selectedMonth}
        teachers={teachers}
        evaluations={evaluations}
        results={teacherResults}
        onClose={() => setIsPrinting(false)}
      />
    )}
    </>
  );
}

function EvaluationForm({ initialScores, onSave, onReset, isSaving, hasExisting }: { 
  initialScores?: any, 
  onSave: (scores: any) => void,
  onReset: () => void,
  isSaving: boolean,
  hasExisting: boolean
}) {
  const [scores, setScores] = useState<Record<string, number>>({});

  useEffect(() => {
    if (initialScores) {
      const newScores: Record<string, number> = {};
      CHECKPOINTS.forEach(cp => {
        newScores[cp.id] = initialScores[cp.id] || 0;
      });
      setScores(newScores);
    } else {
      setScores({});
    }
  }, [initialScores]);

  const handleChange = (id: string, points: number) => {
    setScores(prev => ({ ...prev, [id]: points }));
  };

  const isComplete = CHECKPOINTS.every(cp => (scores[cp.id] || 0) > 0);
  const totalScore: number = (Object.values(scores) as any[]).reduce((a: number, b: any) => a + (Number(b) || 0), 0);

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-slate-100">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="py-4 px-6 font-black uppercase text-[10px] tracking-widest">Checkpoint</th>
              {GRADES.map(g => (
                <th key={g.label} className="py-4 px-6 text-center font-black uppercase text-[10px] tracking-widest whitespace-nowrap">
                  {g.label} ({g.points} pts)
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {CHECKPOINTS.map(cp => (
              <tr key={cp.id} className="hover:bg-slate-50 transition-colors">
                <td className="py-4 px-6">
                  <p className="text-xs font-black text-slate-700 uppercase tracking-tight">{cp.label}</p>
                </td>
                {GRADES.map(g => (
                  <td 
                    key={g.label} 
                    className="py-4 px-6 text-center cursor-pointer"
                    onClick={() => handleChange(cp.id, g.points)}
                  >
                    <div className="flex justify-center">
                      <div className={cn(
                        "w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center",
                        scores[cp.id] === g.points 
                          ? "bg-indigo-600 border-indigo-600 text-white scale-110 shadow-lg shadow-indigo-100" 
                          : "border-slate-200 hover:border-indigo-300"
                      )}>
                        {scores[cp.id] === g.points && <CheckCircle2 className="w-4 h-4" />}
                      </div>
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between bg-indigo-900 p-6 rounded-[1.5rem] text-white">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-[10px] uppercase font-black text-indigo-300 tracking-widest mb-1">Total Evaluation Score</p>
            <div className="text-4xl font-black italic">
              {totalScore} <span className="text-sm not-italic opacity-40">/ 100</span>
            </div>
          </div>
          <div className="h-10 w-px bg-white/10 hidden md:block" />
          <div className="hidden md:block">
            <p className="text-[10px] uppercase font-black text-indigo-300 tracking-widest mb-1">Performance Level</p>
            <p className="text-sm font-black uppercase tracking-tight italic">
              {(totalScore as number) >= 90 ? 'Outstanding' : (totalScore as number) >= 70 ? 'Excellent' : (totalScore as number) >= 50 ? 'Good' : 'Average'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {(Object.keys(scores).length > 0 || hasExisting) && (
            <button
              onClick={() => {
                if (confirm('Are you sure you want to clear this evaluation?')) {
                  setScores({});
                  if (hasExisting) onReset();
                }
              }}
              disabled={isSaving}
              className="px-6 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-white/20 text-white/60 hover:text-rose-400 hover:border-rose-400/50 transition-all flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" /> Clear Evaluation
            </button>
          )}
          <button
            onClick={() => onSave(scores)}
            disabled={!isComplete || isSaving}
            className="bg-white text-indigo-900 px-10 py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:bg-indigo-50 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-indigo-900 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Finalize Evaluation
          </button>
        </div>
      </div>
    </div>
  );
}

function PrintReport({ month, teachers, evaluations, results, onClose }: { 
  month: string, 
  teachers: any[], 
  evaluations: any[], 
  results: Record<string, any>,
  onClose: () => void 
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      window.print();
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const sortedEvals = [...evaluations].sort((a, b) => b.total_score - a.total_score);
  const formattedMonth = new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const reportContent = (
    <div className="fixed inset-0 bg-white z-[9999] overflow-auto text-slate-900 print-report-portal">
      <style>{`
        @media screen {
          .print-report-portal { padding: 50px; }
          .close-print-btn { position: fixed; top: 30px; right: 30px; z-index: 10001; }
        }
        @media print {
          #root { display: none !important; }
          body { 
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-report-portal { 
            position: relative !important; 
            display: block !important;
            width: 100% !important;
            padding: 20mm 0 !important;
            margin: 0 !important;
            visibility: visible !important;
          }
          .no-print, .close-print-btn { display: none !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          @page { size: A4; margin: 0; }
        }
      `}</style>
      
      <button 
        onClick={onClose}
        className="close-print-btn no-print bg-slate-900 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-2xl hover:bg-slate-800 transition-all flex items-center gap-2"
      >
        Close Report Preview
      </button>

      <div className="max-w-4xl mx-auto space-y-12 bg-white px-4 py-12">
        <div className="flex justify-between items-end border-b-[12px] border-slate-900 pb-10">
          <div className="flex items-center gap-6">
             <div className="w-20 h-20 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg">
                <Trophy className="w-12 h-12" />
             </div>
             <div>
              <h1 className="text-5xl font-black uppercase tracking-tighter leading-none italic text-slate-900">Teacher <span className="text-amber-500">of the</span> Month</h1>
              <p className="text-xl font-bold text-slate-400 uppercase tracking-[0.3em] mt-3">{formattedMonth}</p>
             </div>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">Staff Evaluation Report</h2>
            <p className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-widest italic">Institutional Record Document</p>
          </div>
        </div>

        {sortedEvals.length > 0 && (
          <div className="bg-white rounded-[3rem] p-10 flex items-center gap-12 relative overflow-hidden border-[6px] border-amber-400/20 shadow-sm">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-full -mr-16 -mt-16" />
            <div className="w-44 h-44 rounded-full border-8 border-amber-400 flex-shrink-0 overflow-hidden bg-slate-50 shadow-inner">
              {teachers.find(t => t.id === sortedEvals[0].staff_id)?.photograph_url ? (
                <img 
                  src={teachers.find(t => t.id === sortedEvals[0].staff_id).photograph_url} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-6xl font-black text-amber-500">
                  {teachers.find(t => t.id === sortedEvals[0].staff_id)?.full_name?.charAt(0)}
                </div>
              )}
            </div>
            <div className="flex-grow">
              <div className="inline-flex items-center gap-2 bg-amber-400 text-amber-950 px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest mb-4 shadow-sm">
                <Star className="w-4 h-4 fill-current" /> Monthly Top Performer
              </div>
              <h3 className="text-5xl font-black uppercase tracking-tight italic text-slate-900 leading-none">
                {teachers.find(t => t.id === sortedEvals[0].staff_id)?.full_name}
              </h3>
              <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] mt-2 mb-8">Recognized for Excellence in Teaching & Innovation</p>
              
              <div className="flex items-center gap-10">
                <div className="bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">KPI Score</p>
                  <p className="text-3xl font-black text-indigo-600">{sortedEvals[0].total_score}<span className="text-sm text-slate-300 font-bold"> / 100</span></p>
                </div>
                <div className="bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Merit Grade</p>
                  <p className="text-3xl font-black text-amber-500 italic">{results[sortedEvals[0].staff_id]?.grade || 'A+'}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <h4 className="text-xs font-black uppercase tracking-[0.4em] text-slate-400 pl-2">Comparative Staff Rankings</h4>
          <table className="w-full text-left border-collapse border-2 border-slate-100 rounded-3xl overflow-hidden">
            <thead>
              <tr className="bg-slate-50 border-b-2 border-slate-900">
                <th className="py-5 px-6 font-black uppercase text-[10px] tracking-widest text-slate-500">Rank</th>
                <th className="py-5 px-6 font-black uppercase text-[10px] tracking-widest text-slate-500">Staff Member</th>
                <th className="py-5 px-6 font-black uppercase text-[10px] tracking-widest text-slate-500 text-center">Class Result</th>
                <th className="py-5 px-6 font-black uppercase text-[10px] tracking-widest text-slate-500 text-center">KPI Score</th>
                <th className="py-5 px-6 font-black uppercase text-[10px] tracking-widest text-slate-500 text-center">Merit Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {teachers.map((t, idx) => {
                const evalData = evaluations.find(e => e.staff_id === t.id);
                return (
                  <tr key={t.id} className="bg-white">
                    <td className="py-5 px-6 text-xs font-black text-slate-300 tracking-tighter italic">{(idx + 1).toString().padStart(2, '0')}</td>
                    <td className="py-5 px-6">
                      <p className="font-black uppercase text-sm leading-none text-slate-900 tracking-tight">{t.full_name}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 tracking-widest">{t.role || 'Faculty Member'}</p>
                    </td>
                    <td className="py-5 px-6 text-center font-black text-slate-600 italic text-sm">{results[t.id]?.overallAvg || 0}%</td>
                    <td className="py-5 px-6 text-center">
                      <span className="text-lg font-black text-indigo-600">{evalData?.total_score || '00'}</span>
                    </td>
                    <td className="py-5 px-6 text-center">
                      <span className="px-4 py-1.5 bg-slate-900 text-white rounded-xl text-[10px] font-black italic tracking-widest">
                        {results[t.id]?.grade || '—'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-2 gap-20 pt-16 mt-20 border-t-2 border-slate-100">
          <div className="space-y-4">
            <div className="h-px bg-slate-200 w-full" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900">Principal Signature</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Authorized Approval Authority</p>
            </div>
          </div>
          <div className="space-y-4 text-right">
             <div className="h-px bg-slate-200 w-48 ml-auto" />
            <div className="flex flex-col items-end">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900">Director Certification</p>
              <div className="w-24 h-24 border-4 border-slate-100 rounded-full border-dashed mt-4 flex items-center justify-center">
                <p className="text-[8px] font-black text-slate-200 uppercase rotate-45">Institutional Seal</p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center pt-10">
          <p className="text-[8px] font-black text-slate-200 uppercase tracking-[1em]">
            Generated via Edge ERP Academic Recognition System
          </p>
        </div>
      </div>
    </div>
  );

  return createPortal(reportContent, document.body);
}
