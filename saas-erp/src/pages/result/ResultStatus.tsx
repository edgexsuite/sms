import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  ClipboardCheck, CheckCircle2, AlertCircle, XCircle,
  ChevronDown, Download, RefreshCw, ExternalLink,
  BarChart3, Users, BookOpen, Search,
} from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';

// ── Types ────────────────────────────────────────────────────────────────────

interface ExamType {
  id: string;
  name: string;
  month_year: string | null;
}

interface RowData {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  totalStudents: number;
  marksEntered: number;
  missing: number;
  pct: number;
  status: 'complete' | 'partial' | 'pending';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function monthYearLabel(my: string | null) {
  if (!my) return '';
  const [y, m] = my.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return ` — ${months[parseInt(m, 10) - 1]} ${y}`;
}

function StatusBadge({ status }: { status: RowData['status'] }) {
  if (status === 'complete')
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700"><CheckCircle2 className="w-3 h-3" />Complete</span>;
  if (status === 'partial')
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-700"><AlertCircle className="w-3 h-3" />Partial</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700"><XCircle className="w-3 h-3" />Pending</span>;
}

function ProgressBar({ pct, status }: { pct: number; status: RowData['status'] }) {
  const color = status === 'complete' ? 'bg-emerald-500' : status === 'partial' ? 'bg-amber-400' : 'bg-rose-400';
  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-[10px] font-black text-slate-400 w-8 text-right">{pct}%</span>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ResultStatus() {
  const { userRole } = useAuth();
  const navigate = useNavigate();

  // ── State
  const [examTypes, setExamTypes]       = useState<ExamType[]>([]);
  const [selectedExam, setSelectedExam] = useState<string>('');
  const [rows, setRows]                 = useState<RowData[]>([]);
  const [loading, setLoading]           = useState(false);
  const [loadingExams, setLoadingExams] = useState(true);
  const [classFilter, setClassFilter]   = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all'|'pending'|'partial'|'complete'>('all');
  const [search, setSearch]             = useState('');
  const [refreshKey, setRefreshKey]     = useState(0);

  // ── Load exam types once
  useEffect(() => {
    if (!userRole?.school_id) return;
    (async () => {
      setLoadingExams(true);
      const { data } = await supabase
        .from('exam_types')
        .select('id, name, month_year')
        .eq('school_id', userRole.school_id)
        .order('month_year', { ascending: false });
      setExamTypes(data || []);
      if (data && data.length > 0) setSelectedExam(data[0].id);
      setLoadingExams(false);
    })();
  }, [userRole?.school_id]);

  // ── Load status data whenever exam changes
  const fetchStatus = useCallback(async () => {
    if (!userRole?.school_id || !selectedExam) return;
    setLoading(true);
    const sid = userRole.school_id;

    try {
      const [
        { data: classes },
        { data: subjects },
        { data: students },
        { data: results },
      ] = await Promise.all([
        supabase.from('classes').select('id, name, section').eq('school_id', sid).order('name'),
        supabase.from('subjects').select('id, subject_name, class_id').eq('school_id', sid),
        supabase.from('students').select('id, class_id').eq('school_id', sid).eq('status', 'active'),
        supabase.from('exam_results')
          .select('student_id, subject_id')
          .eq('school_id', sid)
          .eq('exam_type_id', selectedExam),
      ]);

      const cls  = classes  || [];
      const subs = subjects || [];
      const stds = students || [];
      const res  = results  || [];

      // Key = "subjectId|studentId" — deliberately excludes class_id because
      // older records have class_id = NULL (column was added later via migration).
      // Student-class membership is already enforced via the students table.
      const enteredSet = new Set(res.map((r: any) => `${r.subject_id}|${r.student_id}`));

      const built: RowData[] = [];

      cls.forEach(c => {
        const classSubs     = subs.filter(s => s.class_id === c.id);
        const classStudents = stds.filter(s => s.class_id === c.id);
        const totalStudents = classStudents.length;

        classSubs.forEach(sub => {
          const marksEntered = classStudents.filter(st =>
            enteredSet.has(`${sub.id}|${st.id}`)
          ).length;
          const missing = totalStudents - marksEntered;
          const pct     = totalStudents > 0 ? Math.round((marksEntered / totalStudents) * 100) : 0;
          const status: RowData['status'] =
            marksEntered === 0           ? 'pending'
            : marksEntered < totalStudents ? 'partial'
            : 'complete';

          built.push({
            classId: c.id,
            className: `${c.name}${c.section ? ' ' + c.section : ''}`,
            subjectId: sub.id,
            subjectName: sub.subject_name,
            totalStudents,
            marksEntered,
            missing,
            pct,
            status,
          });
        });
      });

      // Sort: pending first, then partial, then complete
      const order = { pending: 0, partial: 1, complete: 2 };
      built.sort((a, b) => order[a.status] - order[b.status] || a.className.localeCompare(b.className));

      setRows(built);
    } finally {
      setLoading(false);
    }
  }, [userRole?.school_id, selectedExam, refreshKey]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // ── Derived values
  const allClasses = useMemo(() => [...new Set(rows.map(r => r.className))].sort(), [rows]);

  const filtered = useMemo(() => rows.filter(r => {
    if (classFilter !== 'all' && r.className !== classFilter) return false;
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!r.className.toLowerCase().includes(q) && !r.subjectName.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [rows, classFilter, statusFilter, search]);

  const total    = rows.length;
  const complete = rows.filter(r => r.status === 'complete').length;
  const partial  = rows.filter(r => r.status === 'partial').length;
  const pending  = rows.filter(r => r.status === 'pending').length;
  const overallPct = total > 0 ? Math.round((complete / total) * 100) : 0;

  const selectedExamObj = examTypes.find(e => e.id === selectedExam);

  const handleExport = () => {
    exportToCSV('result-status', filtered, [
      { header: 'Class',          key: 'className'    },
      { header: 'Subject',        key: 'subjectName'  },
      { header: 'Total Students', key: 'totalStudents'},
      { header: 'Marks Entered',  key: 'marksEntered' },
      { header: 'Missing',        key: 'missing'      },
      { header: '% Done',         key: 'pct'          },
      { header: 'Status',         key: 'status'       },
    ]);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
            <ClipboardCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900 uppercase tracking-tight">Result Entry Status</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-0.5">
              Monitor mark entry progress per class &amp; subject
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Exam selector */}
          <div className="relative">
            <select
              value={selectedExam}
              onChange={e => setSelectedExam(e.target.value)}
              disabled={loadingExams}
              className="appearance-none pl-3 pr-8 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 min-w-[200px]"
            >
              {loadingExams
                ? <option>Loading…</option>
                : examTypes.length === 0
                  ? <option value="">No exam types found</option>
                  : examTypes.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.name}{monthYearLabel(e.month_year)}
                    </option>
                  ))
              }
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>

          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-500"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-600"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
      </div>

      {/* ── Summary KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total',    value: total,    color: 'indigo', icon: BookOpen },
          { label: 'Complete', value: complete,  color: 'emerald', icon: CheckCircle2 },
          { label: 'Partial',  value: partial,   color: 'amber',   icon: AlertCircle },
          { label: 'Pending',  value: pending,   color: 'rose',    icon: XCircle },
        ].map(({ label, value, color, icon: Icon }) => (
          <div
            key={label}
            onClick={() => setStatusFilter(label.toLowerCase() as any)}
            className={`
              bg-white rounded-2xl border p-4 cursor-pointer transition-all hover:shadow-md
              ${statusFilter === label.toLowerCase()
                ? `border-${color}-400 shadow-md shadow-${color}-50 ring-1 ring-${color}-300`
                : 'border-slate-100 shadow-sm'
              }
            `}
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-2
              ${color === 'indigo'  ? 'bg-indigo-50  text-indigo-600'  : ''}
              ${color === 'emerald' ? 'bg-emerald-50 text-emerald-600' : ''}
              ${color === 'amber'   ? 'bg-amber-50   text-amber-600'   : ''}
              ${color === 'rose'    ? 'bg-rose-50    text-rose-600'    : ''}
            `}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
            <p className={`text-2xl font-black
              ${color === 'indigo'  ? 'text-slate-800'   : ''}
              ${color === 'emerald' ? 'text-emerald-600' : ''}
              ${color === 'amber'   ? 'text-amber-600'   : ''}
              ${color === 'rose'    ? 'text-rose-600'    : ''}
            `}>{value}</p>
          </div>
        ))}

        {/* Overall % card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Completion</p>
          </div>
          <p className="text-2xl font-black text-indigo-600">{overallPct}%</p>
          <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all duration-700"
              style={{ width: `${overallPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Filters bar ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search class or subject…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* Class filter */}
        <div className="relative">
          <select
            value={classFilter}
            onChange={e => setClassFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Classes</option>
            {allClasses.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>

        {/* Status filter pills */}
        <div className="flex bg-slate-100 p-0.5 rounded-xl">
          {(['all', 'pending', 'partial', 'complete'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-[10px] font-black rounded-lg capitalize transition-all ${
                statusFilter === s ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Clear filters */}
        {(classFilter !== 'all' || statusFilter !== 'all' || search) && (
          <button
            onClick={() => { setClassFilter('all'); setStatusFilter('all'); setSearch(''); }}
            className="text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-wide"
          >
            Clear
          </button>
        )}

        <p className="ml-auto text-[10px] font-bold text-slate-400">
          Showing {filtered.length} of {total} rows
        </p>
      </div>

      {/* ── Main Table ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Loading status…</p>
          </div>
        ) : !selectedExam ? (
          <div className="py-20 text-center text-slate-400">
            <ClipboardCheck className="w-12 h-12 mx-auto mb-3 text-slate-200" />
            <p className="font-bold">Select an exam type above to see mark entry status.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <Users className="w-12 h-12 mx-auto mb-3 text-slate-200" />
            <p className="font-bold">No rows match the current filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">#</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Class</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Subject</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Students</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Entered</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Missing</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Progress</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((row, i) => (
                  <tr
                    key={`${row.classId}-${row.subjectId}`}
                    className={`group transition-colors hover:bg-slate-50 ${
                      row.status === 'pending' ? 'bg-rose-50/40' :
                      row.status === 'partial' ? 'bg-amber-50/30' : ''
                    }`}
                  >
                    <td className="px-4 py-3 text-[11px] font-bold text-slate-300">{i + 1}</td>

                    <td className="px-4 py-3">
                      <span className="text-xs font-black text-slate-800">{row.className}</span>
                    </td>

                    <td className="px-4 py-3">
                      <span className="text-xs font-bold text-slate-600">{row.subjectName}</span>
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500">
                        <Users className="w-3 h-3" /> {row.totalStudents}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-black ${row.marksEntered > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                        {row.marksEntered}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-black ${row.missing > 0 ? 'text-rose-500' : 'text-slate-300'}`}>
                        {row.missing > 0 ? row.missing : '—'}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <ProgressBar pct={row.pct} status={row.status} />
                    </td>

                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>

                    <td className="px-4 py-3">
                      {row.status !== 'complete' && (
                        <button
                          onClick={() =>
                            navigate(
                              `/result/teacher-marks?classId=${row.classId}&subjectId=${row.subjectId}&examTypeId=${selectedExam}`
                            )
                          }
                          className="inline-flex items-center gap-1 text-[10px] font-black text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {row.status === 'pending' ? 'Enter Marks' : 'Complete'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Footer summary */}
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <p className="text-[10px] font-bold text-slate-400">
                {selectedExamObj?.name}{monthYearLabel(selectedExamObj?.month_year ?? null)}
              </p>
              <div className="flex items-center gap-4 text-[10px] font-bold">
                <span className="text-emerald-600">✅ {complete} complete</span>
                <span className="text-amber-600">⚠ {partial} partial</span>
                <span className="text-rose-600">🔴 {pending} pending</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
