import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  ClipboardCheck, CheckCircle2, AlertCircle, XCircle,
  ChevronDown, Download, RefreshCw, ExternalLink,
  BarChart3, Users, BookOpen, Search, FileDown,
} from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getBase64Image } from '../../lib/utils';

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
  marksEntered: number;   // rows with actual marks (is_absent=false)
  absentMarked: number;   // rows with is_absent=true
  processed: number;      // marksEntered + absentMarked
  trulyMissing: number;   // students with NO row at all
  pct: number;            // processed / totalStudents %
  status: 'complete' | 'partial' | 'pending';
}

interface ClassSummary {
  classId: string;
  className: string;
  totalStudents: number;
  totalSubjects: number;
  completeSubjects: number;
  partialSubjects: number;
  pendingSubjects: number;
  overallPct: number;
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
  const [schoolInfo, setSchoolInfo]     = useState<any>(null);
  const [pdfLoading, setPdfLoading]     = useState(false);

  // ── Load exam types once
  useEffect(() => {
    if (!userRole?.school_id) return;
    (async () => {
      setLoadingExams(true);
      const [{ data }, { data: school }] = await Promise.all([
        supabase.from('exam_types').select('id, name, month_year')
          .eq('school_id', userRole.school_id).order('month_year', { ascending: false }),
        supabase.from('schools').select('name, address, contact_phone, logo_url')
          .eq('id', userRole.school_id).maybeSingle(),
      ]);
      setExamTypes(data || []);
      setSchoolInfo(school);
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
          .select('student_id, subject_id, is_absent')
          .eq('school_id', sid)
          .eq('exam_type_id', selectedExam),
      ]);

      const cls  = classes  || [];
      const subs = subjects || [];
      const stds = students || [];
      const res  = results  || [];

      // Separate sets: one for marks entries, one for absent-marked
      // Key = "subjectId|studentId"
      // is_absent is now a proper boolean column
      const marksSet  = new Set(res.filter((r: any) => !r.is_absent).map((r: any) => `${r.subject_id}|${r.student_id}`));
      const absentSet = new Set(res.filter((r: any) =>  r.is_absent).map((r: any) => `${r.subject_id}|${r.student_id}`));


      const built: RowData[] = [];

      cls.forEach(c => {
        const classSubs     = subs.filter(s => s.class_id === c.id);
        const classStudents = stds.filter(s => s.class_id === c.id);
        const totalStudents = classStudents.length;

        classSubs.forEach(sub => {
          const key = (st: any) => `${sub.id}|${st.id}`;
          const marksEntered = classStudents.filter(st => marksSet.has(key(st))).length;
          const absentMarked = classStudents.filter(st => absentSet.has(key(st))).length;
          const processed    = marksEntered + absentMarked;
          const trulyMissing = totalStudents - processed;
          const pct          = totalStudents > 0 ? Math.round((processed / totalStudents) * 100) : 0;
          const status: RowData['status'] =
            processed === 0           ? 'pending'
            : trulyMissing > 0        ? 'partial'
            : 'complete';

          built.push({
            classId: c.id,
            className: `${c.name}${c.section ? ' ' + c.section : ''}`,
            subjectId: sub.id,
            subjectName: sub.subject_name,
            totalStudents,
            marksEntered,
            absentMarked,
            processed,
            trulyMissing,
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

  // Class-level roll-up summary
  const classSummaries = useMemo((): ClassSummary[] => {
    const map = new Map<string, ClassSummary>();
    rows.forEach(r => {
      if (!map.has(r.classId)) {
        map.set(r.classId, {
          classId: r.classId,
          className: r.className,
          totalStudents: r.totalStudents,
          totalSubjects: 0,
          completeSubjects: 0,
          partialSubjects: 0,
          pendingSubjects: 0,
          overallPct: 0,
        });
      }
      const s = map.get(r.classId)!;
      s.totalSubjects++;
      if (r.status === 'complete') s.completeSubjects++;
      else if (r.status === 'partial') s.partialSubjects++;
      else s.pendingSubjects++;
    });
    map.forEach(s => {
      s.overallPct = s.totalSubjects > 0
        ? Math.round((s.completeSubjects / s.totalSubjects) * 100)
        : 0;
    });
    return [...map.values()].sort((a, b) => a.overallPct - b.overallPct); // pending classes first
  }, [rows]);

  const [showClassView, setShowClassView] = useState(false);

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
      { header: 'Absent Marked',  key: 'absentMarked' },
      { header: 'Not Entered',    key: 'trulyMissing' },
      { header: '% Done',         key: 'pct'          },
      { header: 'Status',         key: 'status'       },
    ]);
  };

  const handleDownloadPDF = async () => {
    if (!selectedExamObj) return;
    setPdfLoading(true);
    try {
      const doc  = new jsPDF('l', 'mm', 'a4'); // landscape
      const W    = doc.internal.pageSize.width;   // 297
      const examLabel = `${selectedExamObj.name}${monthYearLabel(selectedExamObj.month_year ?? null)}`;
      const today = new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });

      // ── Header ──────────────────────────────────────────────────
      const LOGO_SIZE = 18;
      const LOGO_X    = 8;
      const LOGO_Y    = 6;

      if (schoolInfo?.logo_url) {
        try {
          const b64 = await getBase64Image(schoolInfo.logo_url);
          // white background behind logo
          doc.setFillColor(255, 255, 255);
          doc.rect(LOGO_X, LOGO_Y, LOGO_SIZE, LOGO_SIZE, 'F');
          doc.addImage(b64, 'PNG', LOGO_X, LOGO_Y, LOGO_SIZE, LOGO_SIZE);
        } catch { /* skip if logo fails */ }
      }

      const textX = schoolInfo?.logo_url ? LOGO_X + LOGO_SIZE + 4 : LOGO_X;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(30, 30, 80);
      doc.text(schoolInfo?.name || 'School', textX, 12);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 120);
      if (schoolInfo?.address)       doc.text(schoolInfo.address,        textX, 17);
      if (schoolInfo?.contact_phone) doc.text(schoolInfo.contact_phone,  textX, 21);

      // right-side heading
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 30, 80);
      doc.text('RESULT ENTRY STATUS REPORT', W - 8, 12, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 120);
      doc.text(`Exam: ${examLabel}`, W - 8, 17, { align: 'right' });
      doc.text(`Generated: ${today}`, W - 8, 21, { align: 'right' });

      // separator line
      doc.setDrawColor(99, 102, 241);
      doc.setLineWidth(0.5);
      doc.line(8, 27, W - 8, 27);

      // ── Summary boxes ────────────────────────────────────────────
      const boxY   = 30;
      const boxH   = 14;
      const gap    = 3;
      const boxW   = (W - 16 - gap * 4) / 5;
      const stats  = [
        { label: 'Total',      value: total,        bg: [241,245,249] as [number,number,number], accent: [99,102,241]  as [number,number,number] },
        { label: 'Complete',   value: complete,      bg: [236,253,245] as [number,number,number], accent: [16,185,129]  as [number,number,number] },
        { label: 'Partial',    value: partial,       bg: [255,251,235] as [number,number,number], accent: [245,158,11]  as [number,number,number] },
        { label: 'Pending',    value: pending,       bg: [255,241,242] as [number,number,number], accent: [239,68,68]   as [number,number,number] },
        { label: 'Completion', value: `${overallPct}%`, bg: [238,242,255] as [number,number,number], accent: [79,70,229] as [number,number,number] },
      ];

      stats.forEach((s, i) => {
        const bx = 8 + i * (boxW + gap);
        doc.setFillColor(...s.bg);
        doc.roundedRect(bx, boxY, boxW, boxH, 2, 2, 'F');
        doc.setFillColor(...s.accent);
        doc.roundedRect(bx, boxY, 2.5, boxH, 1, 1, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 100, 120);
        doc.text(s.label.toUpperCase(), bx + 4.5, boxY + 4.5);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(...s.accent);
        doc.text(String(s.value), bx + 4.5, boxY + 11);
      });

      // ── Table ────────────────────────────────────────────────────
      const STATUS_COLORS: Record<string, [number,number,number]> = {
        complete: [16,185,129],
        partial:  [245,158,11],
        pending:  [239,68,68],
      };

      autoTable(doc, {
        startY: boxY + boxH + 4,
        tableWidth: W - 16,
        margin: { left: 8, right: 8 },
        head: [['#', 'Class', 'Subject', 'Total', 'Marks', 'Absent', 'Missing', '% Done', 'Status']],
        body: filtered.map((r, i) => [
          i + 1,
          r.className,
          r.subjectName,
          r.totalStudents,
          r.marksEntered > 0 ? r.marksEntered : '—',
          r.absentMarked > 0 ? r.absentMarked : '—',
          r.trulyMissing > 0 ? r.trulyMissing : '—',
          `${r.pct}%`,
          r.status.charAt(0).toUpperCase() + r.status.slice(1),
        ]),
        headStyles: {
          fillColor: [30, 30, 80],
          textColor: 255,
          fontSize: 8,
          fontStyle: 'bold',
          cellPadding: 2.5,
        },
        styles: { fontSize: 7.5, cellPadding: 2.2 },
        columnStyles: {
          0: { cellWidth: 8,  halign: 'center' },
          1: { cellWidth: 32, fontStyle: 'bold' },
          2: { cellWidth: 38 },
          3: { cellWidth: 16, halign: 'center' },
          4: { cellWidth: 16, halign: 'center' },
          5: { cellWidth: 16, halign: 'center' },
          6: { cellWidth: 16, halign: 'center' },
          7: { cellWidth: 16, halign: 'center' },
          8: { cellWidth: 26, halign: 'center' },
        },
        didDrawCell: (data) => {
          if (data.section === 'body' && data.column.index === 8) {
            const status = filtered[data.row.index]?.status;
            if (status && STATUS_COLORS[status]) {
              const [r2, g, b] = STATUS_COLORS[status];
              doc.setTextColor(r2, g, b);
              doc.setFont('helvetica', 'bold');
              doc.text(
                String(data.cell.text[0]),
                data.cell.x + data.cell.width / 2,
                data.cell.y + data.cell.height / 2 + 0.5,
                { align: 'center', baseline: 'middle' }
              );
              // return early so autotable doesn't re-draw (hack: reset color)
              doc.setTextColor(0, 0, 0);
            }
          }
        },
        alternateRowStyles: { fillColor: [250, 250, 252] },
      });

      doc.save(`Result-Status-${selectedExamObj.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`);
    } finally {
      setPdfLoading(false);
    }
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

          <button
            onClick={handleDownloadPDF}
            disabled={pdfLoading || !selectedExam}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-xs font-bold text-white shadow-sm shadow-indigo-200 transition-colors"
          >
            <FileDown className={`w-3.5 h-3.5 ${pdfLoading ? 'animate-bounce' : ''}`} />
            {pdfLoading ? 'Generating…' : 'PDF'}
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

      {/* ── View toggle ── */}
      <div className="flex items-center gap-2">
        <div className="flex bg-slate-100 p-0.5 rounded-xl">
          {[{ key: false, label: 'Subject View' }, { key: true, label: 'Class Overview' }].map(opt => (
            <button
              key={String(opt.key)}
              onClick={() => setShowClassView(opt.key)}
              className={`px-4 py-1.5 text-[11px] font-black rounded-lg transition-all ${
                showClassView === opt.key ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-slate-400 font-bold">
          {showClassView ? `${classSummaries.length} classes` : `${filtered.length} subject rows`}
        </span>
      </div>

      {/* ── Class Overview ── */}
      {showClassView && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">#</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Class</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Students</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Subjects</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">✅ Done</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">⚠ Partial</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">🔴 Pending</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {classSummaries.map((cs, i) => (
                <tr
                  key={cs.classId}
                  className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                    cs.pendingSubjects === cs.totalSubjects ? 'bg-rose-50/40' :
                    cs.overallPct === 100 ? 'bg-emerald-50/30' : ''
                  }`}
                  onClick={() => { setShowClassView(false); setClassFilter(cs.className); }}
                  title="Click to filter subject view by this class"
                >
                  <td className="px-4 py-3 text-[11px] font-bold text-slate-300">{i + 1}</td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-black text-slate-800">{cs.className}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs font-bold text-slate-500">{cs.totalStudents}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs font-bold text-slate-600">{cs.totalSubjects}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-black ${cs.completeSubjects > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                      {cs.completeSubjects}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-black ${cs.partialSubjects > 0 ? 'text-amber-600' : 'text-slate-300'}`}>
                      {cs.partialSubjects > 0 ? cs.partialSubjects : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-black ${cs.pendingSubjects > 0 ? 'text-rose-600' : 'text-slate-300'}`}>
                      {cs.pendingSubjects > 0 ? cs.pendingSubjects : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ProgressBar
                      pct={cs.overallPct}
                      status={cs.overallPct === 100 ? 'complete' : cs.completeSubjects > 0 || cs.partialSubjects > 0 ? 'partial' : 'pending'}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 text-[10px] font-bold text-slate-400">
            Click any class row to drill down into its subject breakdown.
          </div>
        </div>
      )}

      {/* ── Main Table ── */}
      {!showClassView && <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
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
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Marks</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Absent</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Not Entered</th>
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
                        {row.marksEntered > 0 ? row.marksEntered : '—'}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-black ${row.absentMarked > 0 ? 'text-orange-500' : 'text-slate-300'}`}>
                        {row.absentMarked > 0 ? row.absentMarked : '—'}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-black ${row.trulyMissing > 0 ? 'text-rose-500' : 'text-slate-300'}`}>
                        {row.trulyMissing > 0 ? row.trulyMissing : '—'}
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
      </div>}
    </div>
  );
}
