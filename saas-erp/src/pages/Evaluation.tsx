import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Star, Search, TrendingUp, Award, Plus, Save, X,
  Calendar, UserCheck, ChevronDown, CheckCircle2,
  Users, Filter, Printer, LayoutGrid, List,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatDate, cn } from '../lib/utils';

// ── Rating categories ──────────────────────────────────────────────────────────
const RATING_KEYS = ['Behavior', 'Punctuality', 'Participation', 'Academic Interest'] as const;
type RatingKey = typeof RATING_KEYS[number];

// ── Types ──────────────────────────────────────────────────────────────────────
interface EvalRecord {
  id: string;
  student_id: string;
  evaluation_date: string;
  ratings: Record<RatingKey, number>;
  feedback: string;
  exam_type_id: string | null;
  student: { full_name: string; roll_number: string } | null;
  evaluator: { full_name: string } | null;
  exam_type: { name: string } | null;
}

interface Student {
  id: string;
  full_name: string;
  roll_number: string;
  class_id: string;
}

interface ClassRow { id: string; name: string; section: string }
interface ExamType  { id: string; name: string; session: string }

// ── Star rating widget ─────────────────────────────────────────────────────────
function StarRating({ value, onChange, size = 'md' }: {
  key?: React.Key; value: number; onChange?: (v: number) => void; size?: 'sm' | 'md';
}) {
  const sz = size === 'sm' ? 'w-3 h-3' : 'w-5 h-5';
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <button
          key={s} type="button"
          onClick={() => onChange?.(s)}
          disabled={!onChange}
          className={cn('transition-all', s <= value ? 'text-amber-400' : 'text-slate-200', onChange && 'hover:text-amber-300')}
        >
          <Star className={cn(sz, s <= value ? 'fill-current' : '')} />
        </button>
      ))}
    </div>
  );
}

// ── Average helper ────────────────────────────────────────────────────────────
const avg = (r: Record<string, number>) => {
  const v = Object.values(r).filter(Boolean);
  return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : '—';
};

// ═════════════════════════════════════════════════════════════════════════════
export default function Evaluation() {
  const { userRole } = useAuth();
  const sid = userRole?.school_id;

  // ── Data ──────────────────────────────────────────────────────────────────
  const [loading,     setLoading]     = useState(true);
  const [evaluations, setEvaluations] = useState<EvalRecord[]>([]);
  const [students,    setStudents]    = useState<Student[]>([]);
  const [classes,     setClasses]     = useState<ClassRow[]>([]);
  const [examTypes,   setExamTypes]   = useState<ExamType[]>([]);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [search,       setSearch]       = useState('');
  const [classFilter,  setClassFilter]  = useState('');
  const [viewMode,     setViewMode]     = useState<'cards' | 'class'>('cards');

  // ── Single eval modal ─────────────────────────────────────────────────────
  const [modalOpen,   setModalOpen]   = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [editId,      setEditId]      = useState<string | null>(null); // null = new
  const [form, setForm] = useState({
    class_id:     '',
    student_id:   '',
    exam_type_id: '',
    evaluation_date: new Date().toISOString().split('T')[0],
    feedback:     '',
    ratings:      {} as Record<string, number>,
  });

  // ── Batch modal (whole class at once) ─────────────────────────────────────
  const [batchOpen,      setBatchOpen]      = useState(false);
  const [batchClassId,   setBatchClassId]   = useState('');
  const [batchExamId,    setBatchExamId]    = useState('');
  const [batchDate,      setBatchDate]      = useState(new Date().toISOString().split('T')[0]);
  const [batchRatings,   setBatchRatings]   = useState<Record<string, Record<string, number>>>({});
  const [batchFeedback,  setBatchFeedback]  = useState<Record<string, string>>({});
  const [batchSaving,    setBatchSaving]    = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!sid) return;
    setLoading(true);

    const [evRes, stuRes, clsRes, exRes] = await Promise.all([
      supabase.from('evaluations')
        .select('id, student_id, evaluation_date, ratings, feedback, exam_type_id, student:students(full_name, roll_number), evaluator:staff!evaluator_id(full_name), exam_type:exam_types(name)')
        .eq('school_id', sid).eq('target_type', 'student')
        .order('evaluation_date', { ascending: false }),
      supabase.from('students').select('id, full_name, roll_number, class_id').eq('school_id', sid).eq('status', 'active').order('roll_number'),
      supabase.from('classes').select('id, name, section, class_teacher_id').eq('school_id', sid).order('name'),
      supabase.from('exam_types').select('id, name, session').eq('school_id', sid).order('created_at'),
    ]);

    setEvaluations((evRes.data ?? []) as unknown as EvalRecord[]);
    setStudents((stuRes.data ?? []) as Student[]);

    const cls = (clsRes.data ?? []) as ClassRow[];
    setClasses(cls);
    setExamTypes((exRes.data ?? []) as ExamType[]);

    // Auto-assign class for teacher
    if (userRole?.role === 'teacher' && userRole.staff_id) {
      const mine = (clsRes.data ?? []).find((c: any) => c.class_teacher_id === userRole.staff_id);
      if (mine) {
        setForm(p => ({ ...p, class_id: mine.id }));
        setBatchClassId(mine.id);
      }
    }

    setLoading(false);
  }, [sid, userRole]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Build existing-eval lookup: student_id → EvalRecord (latest) ──────────
  const evalByStudent = new Map<string, EvalRecord>();
  evaluations.forEach(e => {
    if (!evalByStudent.has(e.student_id)) evalByStudent.set(e.student_id, e);
  });

  // ── Filtered list ─────────────────────────────────────────────────────────
  const classStudentIds = classFilter
    ? new Set(students.filter(s => s.class_id === classFilter).map(s => s.id))
    : null;

  const filteredEvals = evaluations.filter(e => {
    const nameMatch = e.student?.full_name?.toLowerCase().includes(search.toLowerCase());
    const classMatch = !classStudentIds || classStudentIds.has(e.student_id);
    return nameMatch && classMatch;
  });

  // ── Single modal helpers ──────────────────────────────────────────────────
  const openNew = () => {
    setEditId(null);
    setForm({ class_id: '', student_id: '', exam_type_id: '', evaluation_date: new Date().toISOString().split('T')[0], feedback: '', ratings: {} });
    setModalOpen(true);
  };

  const openEdit = (ev: EvalRecord) => {
    setEditId(ev.id);
    const stu = students.find(s => s.id === ev.student_id);
    setForm({
      class_id:        stu?.class_id ?? '',
      student_id:      ev.student_id,
      exam_type_id:    ev.exam_type_id ?? '',
      evaluation_date: ev.evaluation_date,
      feedback:        ev.feedback ?? '',
      ratings:         { ...(ev.ratings ?? {}) },
    });
    setModalOpen(true);
  };

  const handleSaveSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    const unrated = RATING_KEYS.filter(k => !form.ratings[k]);
    if (unrated.length) { alert(`Rate all categories. Missing: ${unrated.join(', ')}`); return; }
    if (!form.student_id) { alert('Select a student.'); return; }
    setSaving(true);
    try {
      const payload: any = {
        target_type:     'student',
        student_id:      form.student_id,
        feedback:        form.feedback,
        evaluation_date: form.evaluation_date,
        ratings:         form.ratings,
        school_id:       sid,
      };
      if (form.exam_type_id) payload.exam_type_id = form.exam_type_id;
      if (userRole?.staff_id) payload.evaluator_id = userRole.staff_id;

      if (editId) {
        await supabase.from('evaluations').update(payload).eq('id', editId);
      } else {
        await supabase.from('evaluations').insert([payload]);
      }
      setModalOpen(false);
      fetchData();
    } catch (err: any) { alert(err.message); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this evaluation?')) return;
    await supabase.from('evaluations').delete().eq('id', id);
    fetchData();
  };

  // ── Batch modal helpers ───────────────────────────────────────────────────
  const batchStudents = students.filter(s => s.class_id === batchClassId);

  const openBatch = () => {
    setBatchRatings({});
    setBatchFeedback({});
    setBatchDate(new Date().toISOString().split('T')[0]);
    // Pre-fill existing evaluations for this class
    batchStudents.forEach(s => {
      const ex = evalByStudent.get(s.id);
      if (ex) {
        setBatchRatings(p => ({ ...p, [s.id]: { ...(ex.ratings ?? {}) } }));
        setBatchFeedback(p => ({ ...p, [s.id]: ex.feedback ?? '' }));
      }
    });
    setBatchOpen(true);
  };

  const setBatchStar = (studentId: string, key: string, val: number) =>
    setBatchRatings(p => ({ ...p, [studentId]: { ...(p[studentId] ?? {}), [key]: val } }));

  const handleSaveBatch = async () => {
    const toSave = batchStudents.filter(s => {
      const r = batchRatings[s.id] ?? {};
      return RATING_KEYS.every(k => r[k]);
    });
    if (toSave.length === 0) { alert('Rate all categories for at least one student before saving.'); return; }

    setBatchSaving(true);
    try {
      const records = toSave.map(s => ({
        target_type:     'student',
        student_id:      s.id,
        feedback:        batchFeedback[s.id] ?? '',
        evaluation_date: batchDate,
        ratings:         batchRatings[s.id],
        school_id:       sid,
        exam_type_id:    batchExamId || null,
        evaluator_id:    userRole?.staff_id ?? null,
      }));
      await supabase.from('evaluations').insert(records);
      setBatchOpen(false);
      fetchData();
    } catch (err: any) { alert(err.message); }
    setBatchSaving(false);
  };

  // ── Export CSV ────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const rows = [
      ['Student', 'Roll No', 'Behavior', 'Punctuality', 'Participation', 'Academic Interest', 'Avg', 'Feedback', 'Date', 'Evaluator'],
      ...filteredEvals.map(ev => [
        ev.student?.full_name, ev.student?.roll_number,
        ...RATING_KEYS.map(k => ev.ratings?.[k] ?? ''),
        avg(ev.ratings ?? {}), ev.feedback, ev.evaluation_date,
        ev.evaluator?.full_name ?? 'Admin',
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'evaluations.csv'; a.click();
  };

  // ── Class-view: group evaluations by class ────────────────────────────────
  const classView = classes.map(cls => {
    const clsStudents = students.filter(s => s.class_id === cls.id);
    const evaled  = clsStudents.filter(s => evalByStudent.has(s.id));
    const pending = clsStudents.filter(s => !evalByStudent.has(s.id));
    return { cls, clsStudents, evaled, pending };
  }).filter(g => g.clsStudents.length > 0);

  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Award className="w-7 h-7 text-amber-500" /> Student Evaluations
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Character & behaviour reviews displayed as ★ ratings on report cards.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { setBatchClassId(classFilter || (classes[0]?.id ?? '')); openBatch(); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-amber-100 hover:bg-amber-600 transition-all"
          >
            <Users className="w-4 h-4" /> Batch Evaluate Class
          </button>
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
          >
            <Plus className="w-4 h-4" /> Single Review
          </button>
        </div>
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
        <div className="flex flex-wrap gap-3 flex-1">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text" placeholder="Search students…"
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          {/* Class filter */}
          <select
            value={classFilter} onChange={e => setClassFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
          >
            <option value="">All Classes</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.section ? ` ${c.section}` : ''}</option>
            ))}
          </select>
        </div>
        {/* View toggle + export */}
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-xl p-0.5">
            <button onClick={() => setViewMode('cards')} className={cn('p-2 rounded-lg transition-all', viewMode === 'cards' ? 'bg-white shadow text-indigo-600' : 'text-gray-400 hover:text-gray-600')}>
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('class')} className={cn('p-2 rounded-lg transition-all', viewMode === 'class' ? 'bg-white shadow text-indigo-600' : 'text-gray-400 hover:text-gray-600')}>
              <List className="w-4 h-4" />
            </button>
          </div>
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all">
            <Printer className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-20 text-center text-gray-400 font-bold">Loading…</div>
      ) : viewMode === 'cards' ? (

        /* Cards view */
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {filteredEvals.length === 0 ? (
            <div className="p-20 text-center flex flex-col items-center gap-3">
              <TrendingUp className="w-12 h-12 text-gray-200" />
              <p className="text-gray-500 font-medium">No evaluations found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {filteredEvals.map(ev => (
                <div key={ev.id} className="border border-gray-100 rounded-2xl p-4 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-50/50 transition-all group flex flex-col">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-sm">
                        {ev.student?.full_name?.[0]}
                      </div>
                      <div>
                        <h3 className="font-black text-gray-900 text-sm leading-tight">{ev.student?.full_name}</h3>
                        <p className="text-[10px] font-bold text-gray-400">Roll {ev.student?.roll_number}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="bg-amber-50 text-amber-600 px-2 py-0.5 rounded-lg flex items-center gap-0.5 text-xs font-black">
                        <Star className="w-3 h-3 fill-current" />{avg(ev.ratings ?? {})}
                      </span>
                      <button
                        onClick={() => openEdit(ev)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        title="Edit"
                      >✏️</button>
                      <button
                        onClick={() => handleDelete(ev.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Delete"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 mb-3 bg-gray-50/50 p-3 rounded-xl">
                    {RATING_KEYS.map(key => (
                      <div key={key} className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-gray-500 uppercase">{key}</span>
                        <StarRating value={ev.ratings?.[key] ?? 0} size="sm" />
                      </div>
                    ))}
                  </div>

                  {ev.feedback && <p className="text-xs text-gray-600 italic line-clamp-2 mb-3">"{ev.feedback}"</p>}

                  <div className="mt-auto pt-3 border-t border-gray-50 flex justify-between items-center text-[9px] font-bold text-gray-400">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(ev.evaluation_date)}</span>
                    <div className="flex flex-col items-end gap-0.5">
                      {ev.exam_type?.name && <span className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded uppercase">{ev.exam_type.name}</span>}
                      <span className="bg-gray-100 px-1.5 py-0.5 rounded uppercase">By: {ev.evaluator?.full_name ?? 'Admin'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      ) : (

        /* Class view */
        <div className="space-y-4">
          {classView.map(({ cls, clsStudents, evaled, pending }) => (
            <div key={cls.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-black text-gray-900">{cls.name}{cls.section ? ` ${cls.section}` : ''}</h3>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    {evaled.length}/{clsStudents.length} evaluated
                  </span>
                  {pending.length > 0 && (
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                      {pending.length} pending
                    </span>
                  )}
                </div>
                <button
                  onClick={() => { setBatchClassId(cls.id); openBatch(); }}
                  className="flex items-center gap-1 text-[10px] font-black text-amber-600 bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <Users className="w-3 h-3" /> Batch Evaluate
                </button>
              </div>
              <div className="divide-y divide-gray-50">
                {clsStudents.map(stu => {
                  const ev = evalByStudent.get(stu.id);
                  return (
                    <div key={stu.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors">
                      <div className="w-7 h-7 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-xs shrink-0">
                        {stu.full_name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-800 truncate">{stu.full_name}</p>
                        <p className="text-[10px] text-gray-400">Roll {stu.roll_number}</p>
                      </div>
                      {ev ? (
                        <div className="flex items-center gap-2">
                          <StarRating value={Math.round(Number(avg(ev.ratings ?? {})))} size="sm" />
                          <span className="text-[10px] font-black text-amber-600">{avg(ev.ratings ?? {})}</span>
                          <button onClick={() => openEdit(ev)} className="text-[10px] text-indigo-500 hover:underline font-bold">Edit</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setForm(p => ({ ...p, class_id: cls.id, student_id: stu.id, ratings: {} }));
                            setEditId(null); setModalOpen(true);
                          }}
                          className="text-[10px] font-black text-indigo-500 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Evaluate
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          Single Evaluation Modal
      ════════════════════════════════════════════════════════════════════ */}
      {modalOpen && createPortal(
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="bg-indigo-600 px-6 py-5 flex justify-between items-center text-white shrink-0">
              <div>
                <h3 className="text-lg font-black">{editId ? 'Edit Evaluation' : 'New Student Review'}</h3>
                <p className="text-indigo-200 text-[10px] mt-0.5 uppercase tracking-widest">Character Assessment</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full"><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={handleSaveSingle} className="p-6 space-y-4 overflow-y-auto max-h-[75vh] bg-gray-50">
              {/* Class + Student (side by side) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Class</label>
                  <select
                    value={form.class_id}
                    onChange={e => setForm(p => ({ ...p, class_id: e.target.value, student_id: '' }))}
                    className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    <option value="">All</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.section ? ` ${c.section}` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Student *</label>
                  <select
                    required value={form.student_id}
                    onChange={e => setForm(p => ({ ...p, student_id: e.target.value }))}
                    className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    <option value="">Select…</option>
                    {(form.class_id ? students.filter(s => s.class_id === form.class_id) : students).map(s => (
                      <option key={s.id} value={s.id}>{s.roll_number} — {s.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Exam link + Date (side by side) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Exam (optional)</label>
                  <select
                    value={form.exam_type_id}
                    onChange={e => setForm(p => ({ ...p, exam_type_id: e.target.value }))}
                    className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    <option value="">None</option>
                    {examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Date</label>
                  <input
                    type="date" value={form.evaluation_date}
                    onChange={e => setForm(p => ({ ...p, evaluation_date: e.target.value }))}
                    className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
              </div>

              {/* Ratings */}
              <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ratings (tap stars)</p>
                {RATING_KEYS.map(key => (
                  <div key={key} className="flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-700 w-32">{key}</span>
                    <StarRating
                      value={form.ratings[key] ?? 0}
                      onChange={v => setForm(p => ({ ...p, ratings: { ...p.ratings, [key]: v } }))}
                    />
                  </div>
                ))}
              </div>

              {/* Feedback */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Observations / Feedback</label>
                <textarea
                  rows={3} value={form.feedback}
                  onChange={e => setForm(p => ({ ...p, feedback: e.target.value }))}
                  placeholder="Share your observations…"
                  className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                />
              </div>
            </form>

            <div className="p-4 bg-white border-t border-gray-100 flex gap-3 shrink-0">
              <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all">Cancel</button>
              <button onClick={handleSaveSingle} disabled={saving} className="flex-[2] py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2">
                <Save className="w-4 h-4" />{saving ? 'Saving…' : editId ? 'Save Changes' : 'Post Evaluation'}
              </button>
            </div>
          </div>
        </div>, document.body
      )}

      {/* ════════════════════════════════════════════════════════════════════
          Batch Class Evaluation Modal
      ════════════════════════════════════════════════════════════════════ */}
      {batchOpen && createPortal(
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh]">
            <div className="bg-amber-500 px-6 py-5 flex justify-between items-center text-white shrink-0">
              <div>
                <h3 className="text-lg font-black">Batch Class Evaluation</h3>
                <p className="text-amber-100 text-[10px] mt-0.5 uppercase tracking-widest">Rate all students at once</p>
              </div>
              <button onClick={() => setBatchOpen(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full"><X className="w-4 h-4" /></button>
            </div>

            {/* Batch settings bar */}
            <div className="px-4 py-3 sm:px-6 border-b border-gray-100 bg-gray-50/50 flex flex-wrap gap-3 items-center shrink-0">
              <div>
                <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Class</label>
                <select
                  value={batchClassId}
                  onChange={e => { setBatchClassId(e.target.value); setBatchRatings({}); setBatchFeedback({}); }}
                  className="border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-xs font-bold outline-none"
                >
                  <option value="">Select class…</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.section ? ` ${c.section}` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Exam (optional)</label>
                <select
                  value={batchExamId} onChange={e => setBatchExamId(e.target.value)}
                  className="border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-xs font-bold outline-none"
                >
                  <option value="">None</option>
                  {examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Date</label>
                <input
                  type="date" value={batchDate} onChange={e => setBatchDate(e.target.value)}
                  className="border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-xs font-bold outline-none"
                />
              </div>
              <div className="ml-auto text-[10px] font-bold text-gray-400 hidden sm:block">
                {batchStudents.filter(s => RATING_KEYS.every(k => batchRatings[s.id]?.[k])).length}/{batchStudents.length} ready
              </div>
            </div>

            {/* Category header row - Hidden on mobile */}
            {batchStudents.length > 0 && (
              <div className="hidden lg:grid grid-cols-[180px_1fr_1fr_1fr_1fr_160px] gap-2 px-6 py-2 border-b border-gray-100 bg-gray-50 shrink-0 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                <span>Student</span>
                {RATING_KEYS.map(k => <span key={k}>{k}</span>)}
                <span>Feedback</span>
              </div>
            )}

            {/* Student rows */}
            <div className="overflow-y-auto flex-1 bg-gray-50/30">
              {!batchClassId ? (
                <div className="p-12 text-center text-gray-300 font-bold">Select a class above.</div>
              ) : batchStudents.length === 0 ? (
                <div className="p-12 text-center text-gray-300 font-bold">No students in this class.</div>
              ) : batchStudents.map(stu => {
                const r = batchRatings[stu.id] ?? {};
                const complete = RATING_KEYS.every(k => r[k]);
                const existing = evalByStudent.has(stu.id);
                return (
                  <div key={stu.id} className={cn(
                    'flex flex-col lg:grid lg:grid-cols-[180px_1fr_1fr_1fr_1fr_160px] gap-4 lg:gap-2 px-4 sm:px-6 py-4 lg:py-3 border-b border-gray-100 items-start lg:items-center hover:bg-gray-50 transition-colors bg-white lg:bg-transparent',
                    complete ? 'bg-emerald-50/50' : ''
                  )}>
                    <div className="min-w-0 w-full lg:w-auto">
                      <p className="text-xs font-bold text-gray-800 truncate">{stu.full_name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[9px] text-gray-400 font-bold">Roll {stu.roll_number}</span>
                        {existing && <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full uppercase">Previous eval found</span>}
                      </div>
                    </div>
                    
                    {/* Ratings container for mobile */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:contents gap-4 w-full">
                      {RATING_KEYS.map(ratingKey => (
                        <div key={ratingKey} className="flex flex-col gap-1 lg:block">
                          <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest lg:hidden">{ratingKey}</span>
                          <StarRating
                            value={Number(r[ratingKey] ?? 0)}
                            onChange={v => setBatchStar(stu.id, ratingKey, v)}
                            size="sm"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="w-full lg:w-auto mt-2 lg:mt-0">
                      <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest lg:hidden block mb-1">Observations</span>
                      <input
                        type="text"
                        placeholder="Optional note…"
                        value={batchFeedback[stu.id] ?? ''}
                        onChange={e => setBatchFeedback(p => ({ ...p, [stu.id]: e.target.value }))}
                        className="text-[10px] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-amber-300 bg-white w-full font-medium"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 bg-white border-t border-gray-100 flex gap-3 shrink-0">
              <button onClick={() => setBatchOpen(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all">Cancel</button>
              <button
                onClick={handleSaveBatch} disabled={batchSaving || !batchClassId}
                className="flex-[2] py-2.5 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 shadow-lg shadow-amber-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span className="truncate">
                  {batchSaving ? 'Saving…' : `Save ${batchStudents.filter(s => RATING_KEYS.every(k => batchRatings[s.id]?.[k])).length} Evaluations`}
                </span>
              </button>
            </div>
          </div>
        </div>, document.body
      )}
    </div>
  );
}
