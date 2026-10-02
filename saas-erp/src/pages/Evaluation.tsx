import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Star, Search, TrendingUp, Award, Plus, Save, X,
  Calendar, UserCheck, ChevronDown, CheckCircle2,
  Users, Filter, Printer, LayoutGrid, List, AlertTriangle,
  Pencil, Trash2, Copy, Sparkles, Clock, Check, ArrowRight,
  BookOpen, ExternalLink, HelpCircle, Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatDate, cn } from '../lib/utils';
import { Link } from 'react-router-dom';

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

// ── Star rating widget (Memoized for high 60fps responsiveness) ───────────────
const StarRating = React.memo(function StarRating({ value, onChange, size = 'md' }: {
  key?: React.Key; value: number; onChange?: (v: number) => void; size?: 'sm' | 'md';
}) {
  const sz = size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5';
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
});

// ── Batch Student Row (Isolated local input state to eliminate keystroke lag) ──
interface BatchStudentRowProps {
  student: Student;
  ratings: Record<string, number>;
  feedback: string;
  hasExistingForThisExam: boolean;
  hasPreviousAny: boolean;
  onRatingChange: (studentId: string, ratingKey: string, val: number) => void;
  onFeedbackChange: (studentId: string, val: string) => void;
}

const BatchStudentRow = React.memo(function BatchStudentRow({
  student,
  ratings,
  feedback,
  hasExistingForThisExam,
  hasPreviousAny,
  onRatingChange,
  onFeedbackChange,
}: BatchStudentRowProps) {
  const [localFeedback, setLocalFeedback] = useState(feedback);
  const debounceRef = useRef<any>(null);

  useEffect(() => {
    setLocalFeedback(feedback);
  }, [feedback]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalFeedback(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onFeedbackChange(student.id, val);
    }, 350);
  };

  const handleBlur = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onFeedbackChange(student.id, localFeedback);
  };

  const complete = RATING_KEYS.every(k => ratings[k] && ratings[k] > 0);

  return (
    <div className={cn(
      'flex flex-col lg:grid lg:grid-cols-[180px_1fr_1fr_1fr_1fr_160px] gap-4 lg:gap-2 px-4 sm:px-6 py-4 lg:py-3 border-b border-gray-100 items-start lg:items-center hover:bg-gray-50 transition-colors bg-white lg:bg-transparent',
      complete ? 'bg-emerald-50/40' : ''
    )}>
      <div className="min-w-0 w-full lg:w-auto">
        <p className="text-xs font-bold text-gray-800 truncate">{student.full_name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[9px] text-gray-400 font-bold">Roll {student.roll_number}</span>
          {hasExistingForThisExam ? (
            <span className="text-[8px] font-black text-emerald-700 bg-emerald-100/70 border border-emerald-200 px-1.5 py-0.2 rounded-full uppercase">
              ✓ Existing eval
            </span>
          ) : hasPreviousAny ? (
            <span className="text-[8px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded-full">
              Past eval available
            </span>
          ) : null}
        </div>
      </div>
      
      {/* Ratings container for mobile & desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:contents gap-4 w-full">
        {RATING_KEYS.map(ratingKey => (
          <div key={ratingKey} className="flex flex-col gap-1 lg:block">
            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest lg:hidden">{ratingKey}</span>
            <StarRating
              value={Number(ratings[ratingKey] ?? 0)}
              onChange={v => onRatingChange(student.id, ratingKey, v)}
              size="sm"
            />
          </div>
        ))}
      </div>

      <div className="w-full lg:w-auto mt-2 lg:mt-0">
        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest lg:hidden block mb-1">Observations</span>
        <input
          type="text"
          placeholder="Optional remarks…"
          value={localFeedback}
          onChange={handleTextChange}
          onBlur={handleBlur}
          className="text-[10px] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-amber-300 bg-white w-full font-medium"
        />
      </div>
    </div>
  );
});

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
  const [examFilter,   setExamFilter]   = useState(''); // '' = all, 'none' = unlinked, or exam_type_id
  const [viewMode,     setViewMode]     = useState<'cards' | 'class'>('cards');

  // ── Single eval modal ─────────────────────────────────────────────────────
  const [modalOpen,   setModalOpen]   = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [editId,      setEditId]      = useState<string | null>(null); // null = new
  const [form, setForm] = useState({
    class_id:        '',
    student_id:      '',
    exam_type_id:    '',
    evaluation_date: new Date().toISOString().split('T')[0],
    feedback:        '',
    ratings:         {} as Record<string, number>,
  });

  // ── Batch modal (whole class at once) ─────────────────────────────────────
  const [batchOpen,      setBatchOpen]      = useState(false);
  const [batchClassId,   setBatchClassId]   = useState('');
  const [batchExamId,    setBatchExamId]    = useState('');
  const [batchDate,      setBatchDate]      = useState(new Date().toISOString().split('T')[0]);
  const [batchRatings,   setBatchRatings]   = useState<Record<string, Record<string, number>>>({});
  const [batchFeedback,  setBatchFeedback]  = useState<Record<string, string>>({});
  const [batchSaving,    setBatchSaving]    = useState(false);

  // ── Auto-Save & Draft Protection State ────────────────────────────────────
  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(() => {
    return localStorage.getItem('eval_autosave_active') !== 'false';
  });
  const toggleAutoSave = () => {
    setAutoSaveEnabled(prev => {
      const next = !prev;
      localStorage.setItem('eval_autosave_active', String(next));
      return next;
    });
  };

  const [singleAutoSaveStatus, setSingleAutoSaveStatus] = useState<'idle' | 'dirty' | 'saving' | 'saved'>('idle');
  const [singleLastSavedTime, setSingleLastSavedTime]   = useState<string | null>(null);
  const [singleDraftRestored, setSingleDraftRestored]   = useState(false);

  const [batchAutoSaveStatus, setBatchAutoSaveStatus]   = useState<'idle' | 'dirty' | 'saving' | 'saved'>('idle');
  const [batchLastSavedTime, setBatchLastSavedTime]     = useState<string | null>(null);
  const [batchDraftRestored, setBatchDraftRestored]     = useState(false);

  const lastSavedBatchRef       = useRef<Record<string, { ratings: Record<string, number>; feedback: string }>>({});
  const singleAutoSaveTimerRef  = useRef<any>(null);
  const batchAutoSaveTimerRef   = useRef<any>(null);
  const batchRatingsRef         = useRef<Record<string, Record<string, number>>>({});
  const batchFeedbackRef        = useRef<Record<string, string>>({});
  const batchDraftDebounceRef   = useRef<any>(null);
  const isBatchSavingRef        = useRef(false);
  const pendingBatchSaveRef     = useRef(false);

  batchRatingsRef.current = batchRatings;
  batchFeedbackRef.current = batchFeedback;

  const getSingleDraftKey = useCallback((stuId: string, examId: string) => {
    return `eval_draft_single_${sid || 'default'}_${stuId}_${examId || 'none'}`;
  }, [sid]);

  const getBatchDraftKey = useCallback((clsId: string, examId: string) => {
    return `eval_draft_batch_${sid || 'default'}_${clsId}_${examId || 'none'}`;
  }, [sid]);

  // ── Quick New Exam Modal ──────────────────────────────────────────────────
  const [newExamModalOpen, setNewExamModalOpen] = useState(false);
  const [newExamForm, setNewExamForm] = useState({ name: '', session: '2026-2027' });
  const [creatingExam, setCreatingExam] = useState(false);

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
      supabase.from('exam_types').select('id, name, session').eq('school_id', sid).order('created_at', { ascending: false }),
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

  // ── Silent Evaluation Refresh (No screen reload or freeze during auto-save) ─
  const refreshEvaluationsSilent = useCallback(async () => {
    if (!sid) return;
    try {
      const { data, error } = await supabase.from('evaluations')
        .select('id, student_id, evaluation_date, ratings, feedback, exam_type_id, student:students(full_name, roll_number), evaluator:staff!evaluator_id(full_name), exam_type:exam_types(name)')
        .eq('school_id', sid).eq('target_type', 'student')
        .order('evaluation_date', { ascending: false });
      if (!error && data) {
        setEvaluations(data as unknown as EvalRecord[]);
      }
    } catch (err) {
      console.error('Silent refresh failed:', err);
    }
  }, [sid]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Multi-dimensional Lookups ─────────────────────────────────────────────
  // 1. Specific lookup by student + exam: `${student_id}__${exam_type_id || 'none'}`
  const evalByStudentExam = useMemo(() => {
    const map = new Map<string, EvalRecord>();
    evaluations.forEach(e => {
      const key = `${e.student_id}__${e.exam_type_id || 'none'}`;
      if (!map.has(key)) map.set(key, e);
    });
    return map;
  }, [evaluations]);

  // 2. All evaluations for each student (grouped array)
  const evalsByStudentAll = useMemo(() => {
    const map = new Map<string, EvalRecord[]>();
    evaluations.forEach(e => {
      const arr = map.get(e.student_id) || [];
      arr.push(e);
      map.set(e.student_id, arr);
    });
    return map;
  }, [evaluations]);

  // 3. Latest evaluation for each student (across all exams)
  const latestEvalByStudent = useMemo(() => {
    const map = new Map<string, EvalRecord>();
    evaluations.forEach(e => {
      if (!map.has(e.student_id)) map.set(e.student_id, e);
    });
    return map;
  }, [evaluations]);

  // ── Filtered list ─────────────────────────────────────────────────────────
  const classStudentIds = useMemo(() => {
    return classFilter
      ? new Set(students.filter(s => s.class_id === classFilter).map(s => s.id))
      : null;
  }, [students, classFilter]);

  const filteredEvals = useMemo(() => {
    return evaluations.filter(e => {
      const nameMatch = e.student?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
                        e.student?.roll_number?.toLowerCase().includes(search.toLowerCase());
      const classMatch = !classStudentIds || classStudentIds.has(e.student_id);
      
      let examMatch = true;
      if (examFilter === 'none') {
        examMatch = !e.exam_type_id;
      } else if (examFilter) {
        examMatch = e.exam_type_id === examFilter;
      }

      return nameMatch && classMatch && examMatch;
    });
  }, [evaluations, search, classStudentIds, examFilter]);

  // ── Browser Navigation & Back Button Protection ──────────────────────────
  useEffect(() => {
    const handlePopState = () => {
      if (modalOpen) {
        if (singleAutoSaveStatus === 'dirty') {
          const ok = window.confirm('You have unsaved evaluation ratings. Do you want to close and keep your local draft?');
          if (!ok) {
            window.history.pushState({ modalOpen: true }, '');
            return;
          }
        }
        setModalOpen(false);
      }
      if (batchOpen) {
        if (batchAutoSaveStatus === 'dirty') {
          const ok = window.confirm('You have unsaved ratings in batch evaluation. Do you want to close and keep your local draft?');
          if (!ok) {
            window.history.pushState({ modalOpen: true }, '');
            return;
          }
        }
        setBatchOpen(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [modalOpen, batchOpen, singleAutoSaveStatus, batchAutoSaveStatus]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const isDirty = (modalOpen && singleAutoSaveStatus === 'dirty') || (batchOpen && batchAutoSaveStatus === 'dirty');
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [modalOpen, batchOpen, singleAutoSaveStatus, batchAutoSaveStatus]);

  // ── Single modal helpers & Auto-Save ──────────────────────────────────────
  const triggerSingleAutoSave = (newRatings: Record<string, number>, newFeedback: string, targetStudentId?: string, targetExamId?: string) => {
    const sId = targetStudentId || form.student_id;
    const eId = targetExamId !== undefined ? targetExamId : form.exam_type_id;
    if (!sId || !sid) return;

    // Immediately preserve local draft
    try {
      localStorage.setItem(getSingleDraftKey(sId, eId), JSON.stringify({
        ratings: newRatings,
        feedback: newFeedback,
        evaluation_date: form.evaluation_date,
        savedAt: new Date().toISOString()
      }));
    } catch (e) {}

    if (!autoSaveEnabled) {
      setSingleAutoSaveStatus('dirty');
      return;
    }

    const allRated = RATING_KEYS.every(k => newRatings[k] && newRatings[k] > 0);
    if (!allRated) {
      setSingleAutoSaveStatus('dirty');
      return;
    }

    setSingleAutoSaveStatus('dirty');
    if (singleAutoSaveTimerRef.current) clearTimeout(singleAutoSaveTimerRef.current);

    singleAutoSaveTimerRef.current = setTimeout(async () => {
      setSingleAutoSaveStatus('saving');
      try {
        const payload: any = {
          target_type:     'student',
          student_id:      sId,
          feedback:        newFeedback,
          evaluation_date: form.evaluation_date,
          ratings:         newRatings,
          school_id:       sid,
          exam_type_id:    eId || null,
        };
        if (userRole?.staff_id) payload.evaluator_id = userRole.staff_id;

        let recordId = editId;
        if (!recordId) {
          const ex = evalByStudentExam.get(`${sId}__${eId || 'none'}`);
          if (ex) recordId = ex.id;
        }

        if (recordId) {
          await supabase.from('evaluations').update(payload).eq('id', recordId);
        } else {
          const { data } = await supabase.from('evaluations').insert([payload]).select('id').single();
          if (data?.id) {
            recordId = data.id;
            setEditId(data.id);
          }
        }

        try {
          localStorage.removeItem(getSingleDraftKey(sId, eId));
        } catch (e) {}
        setSingleDraftRestored(false);
        setSingleAutoSaveStatus('saved');
        setSingleLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

        // Refresh list quietly without locking UI
        await refreshEvaluationsSilent();
      } catch (err) {
        console.error('Single auto-save error:', err);
        setSingleAutoSaveStatus('dirty');
      }
    }, 1200);
  };

  const handleDiscardSingleDraft = () => {
    if (!window.confirm('Discard unsaved draft ratings and reload original data?')) return;
    try {
      localStorage.removeItem(getSingleDraftKey(form.student_id, form.exam_type_id));
    } catch (e) {}
    setSingleDraftRestored(false);
    setSingleAutoSaveStatus('idle');
    const existing = evalByStudentExam.get(`${form.student_id}__${form.exam_type_id || 'none'}`);
    setForm(p => ({
      ...p,
      ratings: existing?.ratings ? { ...existing.ratings } : {},
      feedback: existing?.feedback || '',
    }));
  };

  const handleCloseSingle = () => {
    if (singleAutoSaveStatus === 'dirty') {
      const ok = window.confirm('You have unsaved evaluation ratings. Your draft is saved locally. Close modal?');
      if (!ok) return;
    }
    setModalOpen(false);
  };

  const openNew = (defaultExamId?: string, defaultClassId?: string, defaultStudentId?: string) => {
    try { window.history.pushState({ modalOpen: true }, ''); } catch (e) {}
    setEditId(null);
    const targetExam = defaultExamId !== undefined ? defaultExamId : (examFilter && examFilter !== 'none' ? examFilter : '');
    const targetClass = defaultClassId !== undefined ? defaultClassId : (classFilter || '');
    const targetStudent = defaultStudentId || '';

    // If student & exam selected, check if evaluation already exists in DB
    let existingRatings: Record<string, number> = {};
    let existingFeedback = '';
    let existingId: string | null = null;

    if (targetStudent && targetExam) {
      const ex = evalByStudentExam.get(`${targetStudent}__${targetExam || 'none'}`);
      if (ex) {
        existingId = ex.id;
        existingRatings = { ...(ex.ratings || {}) };
        existingFeedback = ex.feedback || '';
      }
    }

    // Check for localStorage draft
    let draftRestored = false;
    if (targetStudent) {
      try {
        const raw = localStorage.getItem(getSingleDraftKey(targetStudent, targetExam));
        if (raw) {
          const draft = JSON.parse(raw);
          if (draft && draft.ratings && Object.keys(draft.ratings).length > 0) {
            existingRatings = { ...existingRatings, ...draft.ratings };
            if (draft.feedback) existingFeedback = draft.feedback;
            draftRestored = true;
          }
        }
      } catch (e) {}
    }

    setEditId(existingId);
    setSingleDraftRestored(draftRestored);
    setSingleAutoSaveStatus('idle');
    setForm({
      class_id:        targetClass,
      student_id:      targetStudent,
      exam_type_id:    targetExam,
      evaluation_date: new Date().toISOString().split('T')[0],
      feedback:        existingFeedback,
      ratings:         existingRatings,
    });
    setModalOpen(true);
  };

  const openEdit = (ev: EvalRecord) => {
    try { window.history.pushState({ modalOpen: true }, ''); } catch (e) {}
    setEditId(ev.id);
    const stu = students.find(s => s.id === ev.student_id);

    let existingRatings = { ...(ev.ratings ?? {}) };
    let existingFeedback = ev.feedback ?? '';
    let draftRestored = false;

    // Check for localStorage draft
    try {
      const raw = localStorage.getItem(getSingleDraftKey(ev.student_id, ev.exam_type_id || ''));
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft && draft.ratings && Object.keys(draft.ratings).length > 0) {
          existingRatings = { ...existingRatings, ...draft.ratings };
          if (draft.feedback) existingFeedback = draft.feedback;
          draftRestored = true;
        }
      }
    } catch (e) {}

    setSingleDraftRestored(draftRestored);
    setSingleAutoSaveStatus('idle');
    setForm({
      class_id:        stu?.class_id ?? '',
      student_id:      ev.student_id,
      exam_type_id:    ev.exam_type_id ?? '',
      evaluation_date: ev.evaluation_date,
      feedback:        existingFeedback,
      ratings:         existingRatings,
    });
    setModalOpen(true);
  };

  // Switch student or exam inside single modal
  const handleSingleStudentOrExamChange = (stuId: string, examId: string) => {
    if (!stuId) {
      setForm(p => ({ ...p, student_id: '', exam_type_id: examId, ratings: {}, feedback: '' }));
      setEditId(null);
      setSingleDraftRestored(false);
      setSingleAutoSaveStatus('idle');
      return;
    }

    // Check if an evaluation already exists in DB
    const existing = evalByStudentExam.get(`${stuId}__${examId || 'none'}`);
    let ratings = existing ? { ...(existing.ratings || {}) } : {};
    let feedback = existing?.feedback || '';
    let date = existing?.evaluation_date || new Date().toISOString().split('T')[0];
    let draftRestored = false;

    // Check for draft
    try {
      const raw = localStorage.getItem(getSingleDraftKey(stuId, examId));
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft && draft.ratings && Object.keys(draft.ratings).length > 0) {
          ratings = { ...ratings, ...draft.ratings };
          if (draft.feedback) feedback = draft.feedback;
          draftRestored = true;
        }
      }
    } catch (e) {}

    setEditId(existing ? existing.id : null);
    setSingleDraftRestored(draftRestored);
    setSingleAutoSaveStatus('idle');
    setForm(p => ({
      ...p,
      student_id:      stuId,
      exam_type_id:    examId,
      evaluation_date: date,
      ratings,
      feedback,
    }));
  };

  // Copy ratings from a previous evaluation into the current form
  const handleCopyFromPrevious = (previousRecord: EvalRecord) => {
    const nextRatings = { ...(previousRecord.ratings || {}) };
    const nextFeedback = form.feedback || previousRecord.feedback || '';
    setForm(p => ({
      ...p,
      ratings:  nextRatings,
      feedback: nextFeedback,
    }));
    triggerSingleAutoSave(nextRatings, nextFeedback);
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
        exam_type_id:    form.exam_type_id || null,
      };
      if (userRole?.staff_id) payload.evaluator_id = userRole.staff_id;

      if (editId) {
        await supabase.from('evaluations').update(payload).eq('id', editId);
      } else {
        const existing = evalByStudentExam.get(`${form.student_id}__${form.exam_type_id || 'none'}`);
        if (existing) {
          await supabase.from('evaluations').update(payload).eq('id', existing.id);
        } else {
          await supabase.from('evaluations').insert([payload]);
        }
      }

      try {
        localStorage.removeItem(getSingleDraftKey(form.student_id, form.exam_type_id));
      } catch (e) {}
      setSingleDraftRestored(false);
      setSingleAutoSaveStatus('saved');
      setModalOpen(false);
      await fetchData();
    } catch (err: any) { alert(err.message); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this evaluation record?')) return;
    await supabase.from('evaluations').delete().eq('id', id);
    fetchData();
  };

  // ── Batch modal helpers & Auto-Save ───────────────────────────────────────
  const batchStudents = useMemo(() => {
    return students.filter(s => s.class_id === batchClassId);
  }, [students, batchClassId]);

  const flushBatchDraftToStorage = useCallback((clsId: string, examId: string, r: Record<string, Record<string, number>>, f: Record<string, string>, date: string) => {
    try {
      localStorage.setItem(getBatchDraftKey(clsId, examId), JSON.stringify({
        ratings: r,
        feedback: f,
        date,
        savedAt: new Date().toISOString()
      }));
    } catch (e) {}
  }, [getBatchDraftKey]);

  const triggerBatchAutoSave = useCallback((newRatings: Record<string, Record<string, number>>, newFeedback: Record<string, string>) => {
    if (!batchClassId || !sid) return;

    // 1. Debounce localStorage write (350ms) to eliminate disk I/O keystroke stutter
    if (batchDraftDebounceRef.current) clearTimeout(batchDraftDebounceRef.current);
    batchDraftDebounceRef.current = setTimeout(() => {
      flushBatchDraftToStorage(batchClassId, batchExamId, newRatings, newFeedback, batchDate);
    }, 350);

    if (!autoSaveEnabled) {
      setBatchAutoSaveStatus(s => s === 'dirty' ? s : 'dirty');
      return;
    }

    setBatchAutoSaveStatus(s => s === 'dirty' ? s : 'dirty');
    if (batchAutoSaveTimerRef.current) clearTimeout(batchAutoSaveTimerRef.current);

    batchAutoSaveTimerRef.current = setTimeout(async () => {
      // If a batch write is already in-flight, queue pending save
      if (isBatchSavingRef.current) {
        pendingBatchSaveRef.current = true;
        return;
      }

      const currentClassStudents = students.filter(s => s.class_id === batchClassId);

      // Find students whose all 4 ratings are completed
      const completeStudents = currentClassStudents.filter(s => {
        const r = newRatings[s.id] ?? {};
        return RATING_KEYS.every(k => r[k] && r[k] > 0);
      });

      // Filter to only those whose ratings or feedback differ from last saved
      const changedStudents = completeStudents.filter(s => {
        const lastSaved = lastSavedBatchRef.current[s.id];
        if (!lastSaved) return true;
        const currentR = newRatings[s.id] || {};
        const currentF = newFeedback[s.id] || '';
        const isRatingsMatch = RATING_KEYS.every(k => lastSaved.ratings?.[k] === currentR[k]);
        const isFeedbackMatch = (lastSaved.feedback || '') === currentF;
        return !isRatingsMatch || !isFeedbackMatch;
      });

      if (changedStudents.length === 0) {
        setBatchAutoSaveStatus('saved');
        return;
      }

      isBatchSavingRef.current = true;
      setBatchAutoSaveStatus('saving');
      try {
        const updates: any[] = [];
        const inserts: any[] = [];

        changedStudents.forEach(s => {
          const existing = evalByStudentExam.get(`${s.id}__${batchExamId || 'none'}`);
          const payload: any = {
            target_type:     'student',
            student_id:      s.id,
            feedback:        newFeedback[s.id] ?? '',
            evaluation_date: batchDate,
            ratings:         newRatings[s.id],
            school_id:       sid,
            exam_type_id:    batchExamId || null,
            evaluator_id:    userRole?.staff_id ?? null,
          };

          if (existing) {
            updates.push({ id: existing.id, ...payload });
          } else {
            inserts.push(payload);
          }
        });

        if (updates.length > 0) {
          await Promise.all(updates.map(u => supabase.from('evaluations').update(u).eq('id', u.id)));
        }
        if (inserts.length > 0) {
          await supabase.from('evaluations').insert(inserts);
        }

        // Update last saved snapshot
        changedStudents.forEach(s => {
          lastSavedBatchRef.current[s.id] = {
            ratings: { ...(newRatings[s.id] || {}) },
            feedback: newFeedback[s.id] || '',
          };
        });

        setBatchAutoSaveStatus('saved');
        setBatchLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

        // If all students in class are complete and saved, remove local draft
        const allCompleted = currentClassStudents.every(s => {
          const r = newRatings[s.id] ?? {};
          return RATING_KEYS.every(k => r[k] && r[k] > 0);
        });
        if (allCompleted) {
          try { localStorage.removeItem(getBatchDraftKey(batchClassId, batchExamId)); } catch (e) {}
          setBatchDraftRestored(false);
        }

        // Silent background refresh without reloading or locking UI
        await refreshEvaluationsSilent();
      } catch (err) {
        console.error('Batch auto-save error:', err);
        setBatchAutoSaveStatus('dirty');
      } finally {
        isBatchSavingRef.current = false;
        if (pendingBatchSaveRef.current) {
          pendingBatchSaveRef.current = false;
          triggerBatchAutoSave(batchRatingsRef.current, batchFeedbackRef.current);
        }
      }
    }, 2500); // 2.5s debounce for optimal server auto-save
  }, [batchClassId, sid, batchExamId, batchDate, autoSaveEnabled, students, evalByStudentExam, userRole, getBatchDraftKey, flushBatchDraftToStorage, refreshEvaluationsSilent]);

  const handleDiscardBatchDraft = () => {
    if (!window.confirm('Discard unsaved local draft and restore from the database?')) return;
    try {
      localStorage.removeItem(getBatchDraftKey(batchClassId, batchExamId));
    } catch (e) {}
    setBatchDraftRestored(false);
    setBatchAutoSaveStatus('idle');
    loadBatchDataForExam(batchClassId, batchExamId);
  };

  const handleCloseBatch = () => {
    if (batchDraftDebounceRef.current) {
      clearTimeout(batchDraftDebounceRef.current);
      flushBatchDraftToStorage(batchClassId, batchExamId, batchRatingsRef.current, batchFeedbackRef.current, batchDate);
    }
    if (batchAutoSaveStatus === 'dirty') {
      const ok = window.confirm('You have unsaved student ratings in batch evaluation. Your draft is saved locally. Close modal?');
      if (!ok) return;
    }
    setBatchOpen(false);
  };

  const openBatch = (defaultClassId?: string, defaultExamId?: string) => {
    try { window.history.pushState({ modalOpen: true }, ''); } catch (e) {}
    const cId = defaultClassId !== undefined ? defaultClassId : (classFilter || (classes[0]?.id ?? ''));
    const eId = defaultExamId !== undefined ? defaultExamId : (examFilter && examFilter !== 'none' ? examFilter : (examTypes[0]?.id ?? ''));

    setBatchClassId(cId);
    setBatchExamId(eId);
    setBatchDate(new Date().toISOString().split('T')[0]);
    loadBatchDataForExam(cId, eId);
    setBatchOpen(true);
  };

  const loadBatchDataForExam = (classId: string, examId: string) => {
    const classStus = students.filter(s => s.class_id === classId);
    const newRatings: Record<string, Record<string, number>> = {};
    const newFeedback: Record<string, string> = {};

    classStus.forEach(s => {
      // 1. Check if evaluation exists specifically for this exam in DB
      const examEval = evalByStudentExam.get(`${s.id}__${examId || 'none'}`);
      if (examEval) {
        newRatings[s.id] = { ...(examEval.ratings ?? {}) };
        newFeedback[s.id] = examEval.feedback ?? '';
      }
    });

    // Save snapshot of DB state
    const snapshot: Record<string, { ratings: Record<string, number>; feedback: string }> = {};
    classStus.forEach(s => {
      snapshot[s.id] = {
        ratings: { ...(newRatings[s.id] || {}) },
        feedback: newFeedback[s.id] || '',
      };
    });
    lastSavedBatchRef.current = snapshot;

    // Check for localStorage draft
    let draftRestored = false;
    try {
      const raw = localStorage.getItem(getBatchDraftKey(classId, examId));
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft && draft.ratings && Object.keys(draft.ratings).length > 0) {
          Object.keys(draft.ratings).forEach(sId => {
            newRatings[sId] = { ...(newRatings[sId] || {}), ...draft.ratings[sId] };
            if (draft.feedback && draft.feedback[sId] !== undefined) {
              newFeedback[sId] = draft.feedback[sId];
            }
          });
          draftRestored = true;
        }
      }
    } catch (e) {}

    batchRatingsRef.current = newRatings;
    batchFeedbackRef.current = newFeedback;
    setBatchRatings(newRatings);
    setBatchFeedback(newFeedback);
    setBatchDraftRestored(draftRestored);
    setBatchAutoSaveStatus('idle');
  };

  const setBatchStar = useCallback((studentId: string, key: string, val: number) => {
    setBatchRatings(p => {
      const studentRatings = p[studentId] ?? {};
      if (studentRatings[key] === val) return p;
      const next = { ...p, [studentId]: { ...studentRatings, [key]: val } };
      batchRatingsRef.current = next;
      triggerBatchAutoSave(next, batchFeedbackRef.current);
      return next;
    });
  }, [triggerBatchAutoSave]);

  const handleBatchFeedbackChange = useCallback((studentId: string, val: string) => {
    setBatchFeedback(p => {
      if (p[studentId] === val) return p;
      const next = { ...p, [studentId]: val };
      batchFeedbackRef.current = next;
      triggerBatchAutoSave(batchRatingsRef.current, next);
      return next;
    });
  }, [triggerBatchAutoSave]);

  // Helper: Copy all ratings from each student's latest previous evaluation
  const handleBatchCopyFromPrevious = () => {
    let copiedCount = 0;
    const nextRatings = { ...batchRatings };
    const nextFeedback = { ...batchFeedback };

    batchStudents.forEach(s => {
      // If student not already rated for current exam
      const isAlreadyRated = RATING_KEYS.every(k => nextRatings[s.id]?.[k]);
      if (!isAlreadyRated) {
        const prev = latestEvalByStudent.get(s.id);
        if (prev && prev.ratings) {
          nextRatings[s.id] = { ...(prev.ratings || {}) };
          if (!nextFeedback[s.id] && prev.feedback) {
            nextFeedback[s.id] = prev.feedback;
          }
          copiedCount++;
        }
      }
    });

    batchRatingsRef.current = nextRatings;
    batchFeedbackRef.current = nextFeedback;
    setBatchRatings(nextRatings);
    setBatchFeedback(nextFeedback);
    triggerBatchAutoSave(nextRatings, nextFeedback);
    alert(`Copied previous ratings for ${copiedCount} student${copiedCount === 1 ? '' : 's'}. You can now adjust them as needed.`);
  };

  const handleSaveBatch = async () => {
    const toSave = batchStudents.filter(s => {
      const r = batchRatings[s.id] ?? {};
      return RATING_KEYS.every(k => r[k]);
    });
    if (toSave.length === 0) { alert('Rate all categories for at least one student before saving.'); return; }

    setBatchSaving(true);
    try {
      const updates: any[] = [];
      const inserts: any[] = [];

      toSave.forEach(s => {
        const existing = evalByStudentExam.get(`${s.id}__${batchExamId || 'none'}`);
        const payload: any = {
          target_type:     'student',
          student_id:      s.id,
          feedback:        batchFeedback[s.id] ?? '',
          evaluation_date: batchDate,
          ratings:         batchRatings[s.id],
          school_id:       sid,
          exam_type_id:    batchExamId || null,
          evaluator_id:    userRole?.staff_id ?? null,
        };

        if (existing) {
          updates.push({ id: existing.id, ...payload });
        } else {
          inserts.push(payload);
        }
      });

      if (updates.length > 0) {
        await Promise.all(updates.map(u => supabase.from('evaluations').update(u).eq('id', u.id)));
      }
      if (inserts.length > 0) {
        await supabase.from('evaluations').insert(inserts);
      }

      try {
        localStorage.removeItem(getBatchDraftKey(batchClassId, batchExamId));
      } catch (e) {}
      setBatchDraftRestored(false);
      setBatchAutoSaveStatus('saved');
      setBatchOpen(false);
      await refreshEvaluationsSilent();
    } catch (err: any) { alert(err.message); }
    setBatchSaving(false);
  };

  // ── Quick Exam Creator ────────────────────────────────────────────────────
  const handleCreateNewExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExamForm.name.trim() || !sid) return;
    setCreatingExam(true);
    try {
      const { data, error } = await supabase.from('exam_types').insert([{
        school_id: sid,
        name: newExamForm.name.trim(),
        session: newExamForm.session.trim() || '2026-2027',
        show_pass_fail: false,
      }]).select();

      if (error) throw error;
      if (data && data[0]) {
        const created = data[0] as ExamType;
        setExamTypes(prev => [created, ...prev]);
        setExamFilter(created.id);
        if (modalOpen) setForm(p => ({ ...p, exam_type_id: created.id }));
        if (batchOpen) {
          setBatchExamId(created.id);
          loadBatchDataForExam(batchClassId, created.id);
        }
        setNewExamModalOpen(false);
        setNewExamForm({ name: '', session: '2026-2027' });
      }
    } catch (err: any) {
      alert(`Failed to create exam: ${err.message}`);
    } finally {
      setCreatingExam(false);
    }
  };

  // ── Export CSV ────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const rows = [
      ['Student', 'Roll No', 'Exam Name', 'Behavior', 'Punctuality', 'Participation', 'Academic Interest', 'Avg', 'Feedback', 'Date', 'Evaluator'],
      ...filteredEvals.map(ev => [
        ev.student?.full_name, ev.student?.roll_number,
        ev.exam_type?.name ?? 'Unlinked / General',
        ...RATING_KEYS.map(k => ev.ratings?.[k] ?? ''),
        avg(ev.ratings ?? {}), ev.feedback, ev.evaluation_date,
        ev.evaluator?.full_name ?? 'Admin',
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `evaluations_${examFilter ? 'exam' : 'all'}.csv`; a.click();
  };

  // ── Class-view calculations ───────────────────────────────────────────────
  const classView = useMemo(() => {
    return classes.map(cls => {
      const clsStudents = students.filter(s => s.class_id === cls.id);
      
      // If filtered by a specific exam, check status for THAT exam
      const evaled = clsStudents.filter(s => {
        if (examFilter === 'none') {
          return evalByStudentExam.has(`${s.id}__none`);
        } else if (examFilter) {
          return evalByStudentExam.has(`${s.id}__${examFilter}`);
        } else {
          return latestEvalByStudent.has(s.id);
        }
      });

      const pending = clsStudents.filter(s => {
        if (examFilter === 'none') {
          return !evalByStudentExam.has(`${s.id}__none`);
        } else if (examFilter) {
          return !evalByStudentExam.has(`${s.id}__${examFilter}`);
        } else {
          return !latestEvalByStudent.has(s.id);
        }
      });

      return { cls, clsStudents, evaled, pending };
    }).filter(g => g.clsStudents.length > 0);
  }, [classes, students, examFilter, evalByStudentExam, latestEvalByStudent]);

  // Selected student's evaluation history
  const activeStudentEvals = form.student_id ? (evalsByStudentAll.get(form.student_id) || []) : [];
  const selectedStudentObj = students.find(s => s.id === form.student_id);

  // ═════════════════════════════════════════════════════════════════════════════
  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              <Award className="w-7 h-7 text-amber-500" /> Student Evaluations & Character Reviews
            </h1>
            <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full">
              Exam-Linked
            </span>
          </div>
          <p className="text-gray-500 text-sm mt-0.5">
            Conduct character, behavior & participation reviews per exam. Displayed as star ratings on student report cards.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to="/result/reporting"
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
          >
            <ExternalLink className="w-3.5 h-3.5" /> View on Report Cards
          </Link>
          <button
            onClick={() => openBatch(classFilter, examFilter !== 'none' ? examFilter : undefined)}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-amber-100 hover:bg-amber-600 transition-all cursor-pointer"
          >
            <Users className="w-4 h-4" /> Batch Evaluate Class
          </button>
          <button
            onClick={() => openNew(examFilter !== 'none' ? examFilter : undefined, classFilter)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Single Review
          </button>
        </div>
      </div>

      {/* ── Active Exam Context Banner ────────────────────────────────────── */}
      {examFilter && examFilter !== 'none' ? (
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200/80 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-indigo-100">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Currently Focused Exam</p>
              <h2 className="text-base font-black text-indigo-950">
                {examTypes.find(e => e.id === examFilter)?.name || 'Selected Exam'}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => openBatch(classFilter, examFilter)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-sm"
            >
              <Users className="w-3.5 h-3.5" /> Evaluate Class for this Exam
            </button>
            <button
              onClick={() => setExamFilter('')}
              className="px-3 py-1.5 bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 text-xs font-bold rounded-xl transition-all"
            >
              Show All Exams
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Unlinked eval notice ──────────────────────────────────────────── */}
      {(() => {
        const unlinked = evaluations.filter(e => !e.exam_type_id).length;
        if (unlinked === 0) return null;
        return (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 font-medium">
              <span className="font-black">{unlinked} evaluation{unlinked > 1 ? 's' : ''}</span> {unlinked > 1 ? 'have' : 'has'} no exam type linked.
              {' '}They appear on report cards as general character ratings.
              <button
                onClick={() => setExamFilter('none')}
                className="ml-2 font-black text-amber-900 underline hover:text-amber-950"
              >
                Filter Unlinked →
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
        <div className="flex flex-wrap gap-3 flex-1 w-full md:w-auto">
          {/* Search */}
          <div className="relative flex-1 min-w-44">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text" placeholder="Search students by name / roll…"
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          {/* Exam Filter Dropdown */}
          <div className="flex items-center gap-1.5 min-w-48">
            <select
              value={examFilter} onChange={e => setExamFilter(e.target.value)}
              className="w-full border border-indigo-200 bg-indigo-50/40 text-indigo-950 font-bold rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <option value="">All Exams (Everything)</option>
              <option value="none">Unlinked / General Evaluations</option>
              <optgroup label="Specific Exam Terms">
                {examTypes.map(et => (
                  <option key={et.id} value={et.id}>
                    {et.name} ({et.session || 'Current'})
                  </option>
                ))}
              </optgroup>
            </select>
            <button
              onClick={() => setNewExamModalOpen(true)}
              title="Add New Exam Type"
              className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
            </button>
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
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <div className="flex bg-gray-100 rounded-xl p-0.5">
            <button
              onClick={() => setViewMode('cards')}
              className={cn('p-2 rounded-lg transition-all', viewMode === 'cards' ? 'bg-white shadow text-indigo-600' : 'text-gray-400 hover:text-gray-600')}
              title="Grid Cards View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('class')}
              className={cn('p-2 rounded-lg transition-all', viewMode === 'class' ? 'bg-white shadow text-indigo-600' : 'text-gray-400 hover:text-gray-600')}
              title="Class Roster View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-20 text-center text-gray-400 font-bold">
          Loading student evaluations…
        </div>
      ) : viewMode === 'cards' ? (

        /* Cards view */
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {filteredEvals.length === 0 ? (
            <div className="p-20 text-center flex flex-col items-center gap-3">
              <TrendingUp className="w-12 h-12 text-gray-200" />
              <p className="text-gray-500 font-medium">No evaluations found matching the current filters.</p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => openNew(examFilter !== 'none' ? examFilter : undefined, classFilter)}
                  className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl text-xs"
                >
                  + Add New Evaluation
                </button>
                {examFilter && (
                  <button
                    onClick={() => setExamFilter('')}
                    className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs"
                  >
                    Clear Exam Filter
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {filteredEvals.map(ev => {
                const stuAllEvals = evalsByStudentAll.get(ev.student_id) || [];
                const otherEvalsCount = stuAllEvals.length - 1;

                return (
                  <div key={ev.id} className="border border-gray-100 rounded-2xl p-4 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-50/50 transition-all group flex flex-col bg-white">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white font-black text-sm shadow-sm shadow-indigo-100">
                          {ev.student?.full_name?.[0] || 'S'}
                        </div>
                        <div>
                          <h3 className="font-black text-gray-900 text-sm leading-tight">{ev.student?.full_name}</h3>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-bold text-gray-400">Roll {ev.student?.roll_number}</span>
                            {otherEvalsCount > 0 && (
                              <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.2 rounded">
                                +{otherEvalsCount} other exam{otherEvalsCount > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-lg flex items-center gap-0.5 text-xs font-black">
                          <Star className="w-3.5 h-3.5 fill-current text-amber-400" />{avg(ev.ratings ?? {})}
                        </span>
                        <button
                          onClick={() => openEdit(ev)}
                          className="p-1.5 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-all"
                          title="Edit this evaluation"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(ev.id)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete this evaluation"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Ratings Grid */}
                    <div className="space-y-1.5 mb-3 bg-gray-50/70 p-3 rounded-xl border border-gray-100">
                      {RATING_KEYS.map(key => (
                        <div key={key} className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-gray-500 uppercase">{key}</span>
                          <StarRating value={ev.ratings?.[key] ?? 0} size="sm" />
                        </div>
                      ))}
                    </div>

                    {ev.feedback && (
                      <p className="text-xs text-gray-600 italic line-clamp-2 mb-3 bg-amber-50/30 p-2 rounded-lg border border-amber-100/50">
                        "{ev.feedback}"
                      </p>
                    )}

                    <div className="mt-auto pt-3 border-t border-gray-100 flex justify-between items-center text-[9px] font-bold text-gray-400">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-slate-400" />{formatDate(ev.evaluation_date)}</span>
                      <div className="flex flex-col items-end gap-1">
                        {ev.exam_type?.name ? (
                          <span className="bg-indigo-50 text-indigo-700 font-black px-2 py-0.5 rounded-full uppercase border border-indigo-100">
                            {ev.exam_type.name}
                          </span>
                        ) : (
                          <span className="bg-amber-50 text-amber-700 font-bold px-1.5 py-0.5 rounded uppercase flex items-center gap-0.5">
                            <AlertTriangle className="w-2.5 h-2.5" /> General Review
                          </span>
                        )}
                        <span className="text-slate-400 text-[8px]">By: {ev.evaluator?.full_name ?? 'Admin'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      ) : (

        /* Class view */
        <div className="space-y-4">
          {classView.map(({ cls, clsStudents, evaled, pending }) => (
            <div key={cls.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-black text-gray-900">{cls.name}{cls.section ? ` ${cls.section}` : ''}</h3>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full">
                    {evaled.length}/{clsStudents.length} evaluated {examFilter && examFilter !== 'none' ? `for this exam` : ''}
                  </span>
                  {pending.length > 0 && (
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
                      {pending.length} pending
                    </span>
                  )}
                </div>
                <button
                  onClick={() => openBatch(cls.id, examFilter !== 'none' ? examFilter : undefined)}
                  className="flex items-center gap-1.5 text-xs font-black text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" /> Batch Evaluate Class
                </button>
              </div>

              <div className="divide-y divide-gray-50">
                {clsStudents.map(stu => {
                  // Determine evaluation for the current active exam filter
                  const currentExamEval = examFilter === 'none'
                    ? evalByStudentExam.get(`${stu.id}__none`)
                    : examFilter
                    ? evalByStudentExam.get(`${stu.id}__${examFilter}`)
                    : latestEvalByStudent.get(stu.id);

                  const allStudentEvals = evalsByStudentAll.get(stu.id) || [];
                  const hasOtherExams = allStudentEvals.length > (currentExamEval ? 1 : 0);

                  return (
                    <div key={stu.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-black text-xs shrink-0">
                        {stu.full_name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-gray-800 truncate">{stu.full_name}</p>
                          {currentExamEval?.exam_type?.name && (
                            <span className="text-[9px] font-black uppercase text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded">
                              {currentExamEval.exam_type.name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-[10px] text-gray-400">Roll {stu.roll_number}</p>
                          {hasOtherExams && (
                            <span className="text-[9px] text-slate-400">
                              • Evaluated in {allStudentEvals.length} exam{allStudentEvals.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      {currentExamEval ? (
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <StarRating value={Math.round(Number(avg(currentExamEval.ratings ?? {})))} size="sm" />
                            <span className="text-xs font-black text-amber-600">{avg(currentExamEval.ratings ?? {})}</span>
                          </div>
                          <button
                            onClick={() => openEdit(currentExamEval)}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-bold bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => openNew(undefined, cls.id, stu.id)}
                            className="text-xs text-slate-500 hover:text-slate-800 font-bold bg-slate-50 px-2 py-1 rounded-lg border border-slate-200"
                            title="Add evaluation for another exam"
                          >
                            + Another Exam
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {allStudentEvals.length > 0 && (
                            <button
                              onClick={() => {
                                const latest = allStudentEvals[0];
                                openNew(examFilter && examFilter !== 'none' ? examFilter : undefined, cls.id, stu.id);
                              }}
                              className="text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                              title="Copy past evaluation to current exam"
                            >
                              <Copy className="w-3 h-3" /> Quick Copy
                            </button>
                          )}
                          <button
                            onClick={() => openNew(examFilter && examFilter !== 'none' ? examFilter : undefined, cls.id, stu.id)}
                            className="text-xs font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1 rounded-lg transition-colors flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" /> Evaluate {examFilter && examFilter !== 'none' ? 'for this Exam' : ''}
                          </button>
                        </div>
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
          Single Evaluation Modal (Exam-Aware)
      ════════════════════════════════════════════════════════════════════ */}
      {modalOpen && createPortal(
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-5 flex justify-between items-center text-white shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black">{editId ? 'Edit Student Evaluation' : 'New Exam Evaluation'}</h3>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
                    {editId ? 'Updating' : 'New Review'}
                  </span>
                </div>
                <p className="text-indigo-200 text-xs mt-0.5 font-medium">Character Assessment & Behavioral Star Ratings</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleAutoSave}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer border",
                    autoSaveEnabled
                      ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/40 hover:bg-emerald-500/30"
                      : "bg-white/10 text-white/70 border-white/20 hover:bg-white/20"
                  )}
                  title="Toggle automatic background saving"
                >
                  <Sparkles className="w-3 h-3 text-emerald-300" />
                  <span>Auto-Save: {autoSaveEnabled ? 'ON' : 'OFF'}</span>
                </button>
                <button onClick={handleCloseSingle} className="bg-white/10 hover:bg-white/20 p-2 rounded-full cursor-pointer transition-colors"><X className="w-4 h-4" /></button>
              </div>
            </div>

            {/* Live Auto-Save / Draft Status Banner */}
            <div className="px-6 py-2 bg-indigo-50/90 border-b border-indigo-100 flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center gap-1.5 font-bold">
                {singleAutoSaveStatus === 'saving' ? (
                  <span className="text-amber-700 flex items-center gap-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" /> Saving to cloud…
                  </span>
                ) : singleAutoSaveStatus === 'saved' ? (
                  <span className="text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Saved {singleLastSavedTime ? `at ${singleLastSavedTime}` : 'to cloud'}
                  </span>
                ) : singleDraftRestored ? (
                  <span className="text-indigo-700 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Unsaved draft restored
                  </span>
                ) : (
                  <span className="text-slate-500 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" /> Draft saved locally in browser
                  </span>
                )}
              </div>
              {singleDraftRestored && (
                <button
                  type="button"
                  onClick={handleDiscardSingleDraft}
                  className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                >
                  Discard Draft
                </button>
              )}
            </div>

            <form onSubmit={handleSaveSingle} className="p-6 space-y-4 overflow-y-auto bg-gray-50 flex-1 custom-scrollbar">
              
              {/* Class & Student Selector */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Class</label>
                  <select
                    value={form.class_id}
                    onChange={e => {
                      const newCls = e.target.value;
                      setForm(p => ({ ...p, class_id: newCls, student_id: '' }));
                      setEditId(null);
                    }}
                    className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    <option value="">All Classes</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.section ? ` ${c.section}` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Student *</label>
                  <select
                    required value={form.student_id}
                    onChange={e => handleSingleStudentOrExamChange(e.target.value, form.exam_type_id)}
                    className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    <option value="">Select Student…</option>
                    {(form.class_id ? students.filter(s => s.class_id === form.class_id) : students).map(s => (
                      <option key={s.id} value={s.id}>{s.roll_number} — {s.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Student Evaluation History Across Exams Pill Bar */}
              {selectedStudentObj && (
                <div className="bg-white p-3 rounded-2xl border border-gray-200/80 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Evaluations for {selectedStudentObj.full_name}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      {activeStudentEvals.length} Exam Record{activeStudentEvals.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {/* Unlinked / General option */}
                    {(() => {
                      const unlinked = evalByStudentExam.get(`${selectedStudentObj.id}__none`);
                      const isSelected = form.exam_type_id === '';
                      return (
                        <button
                          type="button"
                          onClick={() => handleSingleStudentOrExamChange(selectedStudentObj.id, '')}
                          className={cn(
                            "px-2.5 py-1 rounded-xl text-xs font-bold transition-all border text-left flex items-center gap-1",
                            isSelected
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                              : unlinked
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                              : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                          )}
                        >
                          {unlinked && <Check className="w-3 h-3 text-emerald-600 inline" />}
                          General Review
                        </button>
                      );
                    })()}

                    {/* All Exams */}
                    {examTypes.map(et => {
                      const ex = evalByStudentExam.get(`${selectedStudentObj.id}__${et.id}`);
                      const isSelected = form.exam_type_id === et.id;
                      return (
                        <button
                          key={et.id}
                          type="button"
                          onClick={() => handleSingleStudentOrExamChange(selectedStudentObj.id, et.id)}
                          className={cn(
                            "px-2.5 py-1 rounded-xl text-xs font-bold transition-all border text-left flex items-center gap-1.5",
                            isSelected
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                              : ex
                              ? "bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100"
                              : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                          )}
                        >
                          {ex ? (
                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />
                          )}
                          <span>{et.name}</span>
                          {ex && <span className="opacity-80 text-[10px]">★{avg(ex.ratings || {})}</span>}
                        </button>
                      );
                    })}
                  </div>

                  {/* Copy helper if evaluating for an exam without ratings yet */}
                  {!editId && activeStudentEvals.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-500">Not evaluated yet for this selected exam:</span>
                      <button
                        type="button"
                        onClick={() => handleCopyFromPrevious(activeStudentEvals[0])}
                        className="text-xs font-black text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-200 flex items-center gap-1 transition-colors"
                      >
                        <Copy className="w-3 h-3" /> Copy ratings from {activeStudentEvals[0].exam_type?.name || 'previous review'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Exam link + Date (side by side) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest">Target Exam</label>
                    <button
                      type="button"
                      onClick={() => setNewExamModalOpen(true)}
                      className="text-[10px] font-black text-indigo-600 hover:underline flex items-center gap-0.5"
                    >
                      <Plus className="w-2.5 h-2.5" /> New Exam
                    </button>
                  </div>
                  <select
                    value={form.exam_type_id}
                    onChange={e => handleSingleStudentOrExamChange(form.student_id, e.target.value)}
                    className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    <option value="">General Review (No Exam)</option>
                    {examTypes.map(et => (
                      <option key={et.id} value={et.id}>{et.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Evaluation Date</label>
                  <input
                    type="date" value={form.evaluation_date}
                    onChange={e => {
                      const nextDate = e.target.value;
                      setForm(p => ({ ...p, evaluation_date: nextDate }));
                      triggerSingleAutoSave(form.ratings, form.feedback);
                    }}
                    className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
              </div>

              {/* Status Indicator */}
              <div className={cn(
                "p-3 rounded-xl border text-xs font-bold flex items-center gap-2",
                editId ? "bg-amber-50 text-amber-900 border-amber-200" : "bg-blue-50 text-blue-900 border-blue-200"
              )}>
                {editId ? (
                  <>
                    <Pencil className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Editing existing evaluation for this student and exam.</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Creating new evaluation record for this exam.</span>
                  </>
                )}
              </div>

              {/* Ratings */}
              <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Character Criteria Ratings</p>
                  <button
                    type="button"
                    onClick={() => {
                      const all5: any = {};
                      RATING_KEYS.forEach(k => { all5[k] = 5; });
                      setForm(p => ({ ...p, ratings: all5 }));
                      triggerSingleAutoSave(all5, form.feedback);
                    }}
                    className="text-[10px] font-bold text-amber-600 hover:underline cursor-pointer"
                  >
                    Set all to 5★
                  </button>
                </div>
                {RATING_KEYS.map(key => (
                  <div key={key} className="flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-700 w-32">{key}</span>
                    <StarRating
                      value={form.ratings[key] ?? 0}
                      onChange={v => {
                        const nextRatings = { ...form.ratings, [key]: v };
                        setForm(p => ({ ...p, ratings: nextRatings }));
                        triggerSingleAutoSave(nextRatings, form.feedback);
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Feedback */}
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Observations / Teacher Remarks</label>
                <textarea
                  rows={3} value={form.feedback}
                  onChange={e => {
                    const newFeedback = e.target.value;
                    setForm(p => ({ ...p, feedback: newFeedback }));
                    triggerSingleAutoSave(form.ratings, newFeedback);
                  }}
                  placeholder="e.g. Excellent conduct, respectful, proactive in classroom discussions…"
                  className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300 resize-none font-medium"
                />
              </div>
            </form>

            <div className="p-4 bg-white border-t border-gray-100 flex gap-3 shrink-0">
              <button onClick={handleCloseSingle} className="flex-1 py-2.5 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all cursor-pointer">Cancel</button>
              <button
                onClick={handleSaveSingle} disabled={saving}
                className="flex-[2] py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />{saving ? 'Saving…' : editId ? 'Update Evaluation' : 'Save for this Exam'}
              </button>
            </div>
          </div>
        </div>, document.body
      )}

      {/* ════════════════════════════════════════════════════════════════════
          Batch Class Evaluation Modal (Exam-Specific)
      ════════════════════════════════════════════════════════════════════ */}
      {batchOpen && createPortal(
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh]">
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-5 flex justify-between items-center text-white shrink-0">
              <div>
                <h3 className="text-lg font-black">Batch Class Evaluation</h3>
                <p className="text-amber-100 text-xs mt-0.5">Evaluate all students in a class for a specific exam term at once</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleAutoSave}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer border",
                    autoSaveEnabled
                      ? "bg-emerald-500/20 text-emerald-100 border-emerald-400/40 hover:bg-emerald-500/30"
                      : "bg-white/10 text-white/70 border-white/20 hover:bg-white/20"
                  )}
                  title="Toggle automatic background saving"
                >
                  <Sparkles className="w-3 h-3 text-emerald-300" />
                  <span>Auto-Save: {autoSaveEnabled ? 'ON' : 'OFF'}</span>
                </button>
                <button onClick={handleCloseBatch} className="bg-white/10 hover:bg-white/20 p-2 rounded-full cursor-pointer transition-colors"><X className="w-4 h-4" /></button>
              </div>
            </div>

            {/* Batch settings bar */}
            <div className="px-4 py-3 sm:px-6 border-b border-gray-100 bg-gray-50/80 flex flex-wrap gap-4 items-center shrink-0">
              <div>
                <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Class</label>
                <select
                  value={batchClassId}
                  onChange={e => {
                    const newC = e.target.value;
                    setBatchClassId(newC);
                    loadBatchDataForExam(newC, batchExamId);
                  }}
                  className="border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-xs font-bold outline-none"
                >
                  <option value="">Select class…</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.section ? ` ${c.section}` : ''}</option>)}
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest">Exam</label>
                  <button
                    type="button"
                    onClick={() => setNewExamModalOpen(true)}
                    className="text-[9px] font-black text-indigo-600 hover:underline ml-2"
                  >
                    + New
                  </button>
                </div>
                <select
                  value={batchExamId}
                  onChange={e => {
                    const newE = e.target.value;
                    setBatchExamId(newE);
                    loadBatchDataForExam(batchClassId, newE);
                  }}
                  className="border border-indigo-200 bg-indigo-50/50 text-indigo-950 rounded-lg px-3 py-1.5 text-xs font-bold outline-none"
                >
                  <option value="">General Review (No Exam)</option>
                  {examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Date</label>
                <input
                  type="date" value={batchDate} onChange={e => setBatchDate(e.target.value)}
                  className="border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-xs font-bold outline-none"
                />
              </div>

              <div className="ml-auto flex items-center gap-2">
                {/* Live Auto-save status in batch */}
                {batchAutoSaveStatus === 'saving' ? (
                  <div className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" /> Saving to cloud…
                  </div>
                ) : batchAutoSaveStatus === 'saved' ? (
                  <div className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Auto-saved {batchLastSavedTime ? `at ${batchLastSavedTime}` : 'to cloud'}
                  </div>
                ) : batchDraftRestored ? (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-lg text-xs font-bold">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Draft restored
                    <button
                      type="button"
                      onClick={handleDiscardBatchDraft}
                      className="text-rose-600 hover:text-rose-800 text-[10px] ml-1 font-bold underline cursor-pointer"
                      title="Discard local draft and reload from database"
                    >
                      Discard
                    </button>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={handleBatchCopyFromPrevious}
                  className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  title="Copy unrated students' ratings from previous exams"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy Previous Ratings
                </button>
                <div className="text-[10px] font-black text-gray-500 bg-white border border-gray-200 px-2.5 py-1.5 rounded-lg hidden sm:block">
                  {batchStudents.filter(s => RATING_KEYS.every(k => batchRatings[s.id]?.[k])).length}/{batchStudents.length} Complete
                </div>
              </div>
            </div>

            {/* Category header row - Hidden on mobile */}
            {batchStudents.length > 0 && (
              <div className="hidden lg:grid grid-cols-[180px_1fr_1fr_1fr_1fr_160px] gap-2 px-6 py-2 border-b border-gray-100 bg-gray-50 shrink-0 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                <span>Student</span>
                {RATING_KEYS.map(k => <span key={k}>{k}</span>)}
                <span>Observations / Note</span>
              </div>
            )}

            {/* Student rows */}
            <div className="overflow-y-auto flex-1 bg-gray-50/30">
              {!batchClassId ? (
                <div className="p-12 text-center text-gray-300 font-bold">Select a class above.</div>
              ) : batchStudents.length === 0 ? (
                <div className="p-12 text-center text-gray-300 font-bold">No students found in this class.</div>
              ) : batchStudents.map(stu => {
                const r = batchRatings[stu.id] ?? {};
                const existingForThisExam = evalByStudentExam.has(`${stu.id}__${batchExamId || 'none'}`);
                const previousAny = !!latestEvalByStudent.get(stu.id);

                return (
                  <BatchStudentRow
                    key={stu.id}
                    student={stu}
                    ratings={r}
                    feedback={batchFeedback[stu.id] ?? ''}
                    hasExistingForThisExam={existingForThisExam}
                    hasPreviousAny={previousAny}
                    onRatingChange={setBatchStar}
                    onFeedbackChange={handleBatchFeedbackChange}
                  />
                );
              })}
            </div>

            <div className="p-4 bg-white border-t border-gray-100 flex gap-3 shrink-0">
              <button onClick={handleCloseBatch} className="flex-1 py-2.5 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all cursor-pointer">Cancel</button>
              <button
                onClick={handleSaveBatch} disabled={batchSaving || !batchClassId}
                className="flex-[2] py-2.5 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 shadow-lg shadow-amber-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span className="truncate">
                  {batchSaving ? 'Saving…' : `Save ${batchStudents.filter(s => RATING_KEYS.every(k => batchRatings[s.id]?.[k])).length} Evaluations for this Exam`}
                </span>
              </button>
            </div>
          </div>
        </div>, document.body
      )}

      {/* ════════════════════════════════════════════════════════════════════
          Quick Create New Exam Modal
      ════════════════════════════════════════════════════════════════════ */}
      {newExamModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/60 z-[10000] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="bg-indigo-600 px-5 py-4 flex justify-between items-center text-white">
              <div>
                <h3 className="text-base font-black">Add New Exam Type</h3>
                <p className="text-indigo-200 text-xs">Create an exam to evaluate students for</p>
              </div>
              <button onClick={() => setNewExamModalOpen(false)} className="bg-white/10 hover:bg-white/20 p-1.5 rounded-full"><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={handleCreateNewExam} className="p-5 space-y-4 bg-gray-50">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Exam Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1st Term 2026, Midterm, Final Term…"
                  value={newExamForm.name}
                  onChange={e => setNewExamForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Academic Session</label>
                <input
                  type="text"
                  placeholder="2026-2027"
                  value={newExamForm.session}
                  onChange={e => setNewExamForm(p => ({ ...p, session: e.target.value }))}
                  className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewExamModalOpen(false)}
                  className="flex-1 py-2 bg-gray-100 text-gray-600 font-bold rounded-xl text-xs hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingExam}
                  className="flex-1 py-2 bg-indigo-600 text-white font-bold rounded-xl text-xs hover:bg-indigo-700 shadow-md shadow-indigo-100 transition-all flex items-center justify-center gap-1"
                >
                  {creatingExam ? 'Creating…' : 'Create Exam'}
                </button>
              </div>
            </form>
          </div>
        </div>, document.body
      )}

    </div>
  );
}
