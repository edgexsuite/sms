import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import * as XLSX from 'xlsx';
import {
  Upload, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle,
  ArrowRight, Save, ChevronLeft, Download, SkipForward, Users
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

// ── Types ────────────────────────────────────────────────────────────────────

interface ParsedRow {
  _idx: number;
  studentName: string;
  fatherName: string;
  classNum: string;
  feePaid: number;
  pendingArrears: number;
  status: string;
  actualFee: number;
  paymentMode: string;
  remarks: string;
}

interface MatchedRow extends ParsedRow {
  matchStatus: 'matched' | 'unmatched' | 'multiple';
  matchedStudentId: string | null;
  matchedStudentName: string;
  candidates: { id: string; full_name: string; father_name: string; className: string }[];
  skip: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const normalize = (s: string) =>
  (s ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

const parseClassNum = (c: any) =>
  String(c ?? '').trim().toLowerCase()
    .replace(/^class\s*/i, '').replace(/^grade\s*/i, '').replace(/^std\s*/i, '');

const toMoney = (v: any) => {
  const n = parseFloat(String(v ?? '0').replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : Math.round(n);
};

const feeStatus = (paid: number, total: number): string => {
  if (!total || total === 0) return 'pending';
  if (paid >= total) return 'paid';
  if (paid > 0) return 'partial';
  return 'pending';
};

const invoiceNum = (monthYear: string, studentId: string) =>
  `INV-${monthYear.replace('-', '')}-${studentId.slice(0, 6).toUpperCase()}`;

// ── Component ────────────────────────────────────────────────────────────────

export default function BulkFeeHistoryImport() {
  const { userRole, user } = useAuth();
  const navigate = useNavigate();

  const [step,      setStep]      = useState<1 | 2 | 3 | 4>(1);
  const [month,     setMonth]     = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [file,      setFile]      = useState<File | null>(null);
  const [rows,      setRows]      = useState<MatchedRow[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [result,    setResult]    = useState({ imported: 0, skipped: 0, errors: [] as string[] });

  // ── Load all active students once ──────────────────────────────────────────

  useEffect(() => {
    if (!userRole?.school_id) return;
    supabase.from('students')
      .select('id, full_name, roll_number, class_id, is_deleted, class:class_id(name, section), parents(father_name)')
      .eq('school_id', userRole.school_id)
      .eq('status', 'active')
      .eq('is_deleted', false)
      .then(({ data, error }) => {
        if (error) console.error('Student fetch error:', error.message, error.details);
        if (data) {
          // Flatten father_name from parents relation
          setAllStudents(data.map((s: any) => ({
            ...s,
            father_name: s.parents?.father_name ?? '',
          })));
        }
      });
  }, [userRole]);

  // ── Student matching ───────────────────────────────────────────────────────

  const matchStudent = useCallback((name: string, classNum: string, fatherName: string = '') => {
    const normName   = normalize(name);
    const normClass  = parseClassNum(classNum);
    const normFather = normalize(fatherName);

    // Filter by class first
    const inClass = allStudents.filter(s => parseClassNum(s.class?.name) === normClass);
    const pool    = inClass.length > 0 ? inClass : allStudents;

    // Exact name match
    const exact = pool.filter(s => normalize(s.full_name) === normName);

    if (exact.length === 1) return { status: 'matched' as const, matched: exact[0], candidates: [] };

    // Multiple exact name matches — break tie with father name
    if (exact.length > 1 && normFather) {
      const byFather = exact.filter(s => normalize(s.father_name ?? '') === normFather);
      if (byFather.length === 1) return { status: 'matched' as const, matched: byFather[0], candidates: [] };
      // Father name narrows but still ambiguous
      const narrowed = byFather.length > 1 ? byFather : exact;
      return { status: 'multiple' as const, matched: narrowed[0], candidates: narrowed };
    }
    if (exact.length > 1) return { status: 'multiple' as const, matched: exact[0], candidates: exact };

    // Fuzzy name match
    const fuzzy = pool.filter(s => {
      const sn = normalize(s.full_name);
      return sn.includes(normName) || normName.includes(sn);
    });

    if (fuzzy.length === 1) return { status: 'matched' as const, matched: fuzzy[0], candidates: [] };

    // Multiple fuzzy — try father name tiebreaker
    if (fuzzy.length > 1 && normFather) {
      const byFather = fuzzy.filter(s => normalize(s.father_name ?? '') === normFather);
      if (byFather.length === 1) return { status: 'matched' as const, matched: byFather[0], candidates: [] };
      const narrowed = byFather.length > 1 ? byFather : fuzzy;
      return { status: 'multiple' as const, matched: narrowed[0], candidates: narrowed };
    }
    if (fuzzy.length > 1) return { status: 'multiple' as const, matched: fuzzy[0], candidates: fuzzy };

    return { status: 'unmatched' as const, matched: null, candidates: [] };
  }, [allStudents]);

  // ── File parsing ───────────────────────────────────────────────────────────

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb   = XLSX.read(evt.target?.result, { type: 'binary', cellFormula: false, cellNF: false });
        // Prefer 'Fee Record' sheet if it exists, else first sheet
        const sheetName = wb.SheetNames.includes('Fee Record') ? 'Fee Record' : wb.SheetNames[0];
        const ws   = wb.Sheets[sheetName];
        const raw  = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];

        // Find header row (search first 8 rows for "Student Name" / "Name")
        let headerIdx = -1;
        for (let i = 0; i < Math.min(8, raw.length); i++) {
          const cells = raw[i].map((c: any) => String(c ?? '').toLowerCase());
          if (cells.some(c => c.includes('student') || c === 'name' || c === 'sr.' || c === 'sr')) {
            headerIdx = i; break;
          }
        }
        if (headerIdx === -1) {
          setError('Could not find the header row. Make sure your file has a row with "Student Name", "Class", etc.');
          return;
        }

        const headers = raw[headerIdx].map((h: any) => String(h ?? '').toLowerCase().trim());

        const col = (kws: string[]) =>
          headers.findIndex(h => kws.some(k => h.includes(k)));

        const iName    = col(['student name', 'student', 'name']);
        const iFather  = col(['father']);
        const iClass   = col(['class']);
        const iPaid    = col(['fee/adm', 'fee paid', 'paid', 'march paid', 'april paid', 'may paid']);
        const iPending = col(['pending', 'arrear']);
        const iStatus  = col(['status']);
        const iActual  = col(['actual fee', 'actual']);
        const iMode    = col(['payment mode', 'mode', 'payment']);
        const iRemark  = col(['remark', 'note', 'comment']);

        if (iName === -1) {
          setError('Could not find a "Student Name" column. Please check your headers match the template.');
          return;
        }

        const dataRows = raw
          .slice(headerIdx + 1)
          .filter(r => r[iName] && String(r[iName]).trim() !== '');

        if (dataRows.length === 0) {
          setError('No student data rows found after the header row.');
          return;
        }

        const cleanStr = (v: any) => String(v ?? '').replace(/[\t\r\n]+/g, ' ').trim();

        const parsed: ParsedRow[] = dataRows.map((r, idx) => {
          const feePaid       = iPaid    >= 0 ? toMoney(r[iPaid])    : 0;
          const pendingArrears= iPending >= 0 ? toMoney(r[iPending]) : 0;
          // Actual fee may be a formula cell (reads as 0/NaN) — fall back to feePaid + arrears
          const rawActual     = iActual  >= 0 ? toMoney(r[iActual])  : 0;
          const actualFee     = rawActual > 0 ? rawActual : feePaid + pendingArrears;
          return {
            _idx:          idx,
            studentName:   cleanStr(r[iName]),
            fatherName:    iFather  >= 0 ? cleanStr(r[iFather])  : '',
            classNum:      iClass   >= 0 ? cleanStr(r[iClass])   : '',
            feePaid,
            pendingArrears,
            status:        iStatus  >= 0 ? cleanStr(r[iStatus])  : '',
            actualFee,
            paymentMode:   iMode    >= 0 ? (cleanStr(r[iMode]) || 'Cash') : 'Cash',
            remarks:       iRemark  >= 0 ? cleanStr(r[iRemark])  : '',
          };
        });

        // Match each row
        const matched: MatchedRow[] = parsed.map(p => {
          const m = matchStudent(p.studentName, p.classNum, p.fatherName);
          return {
            ...p,
            matchStatus:       m.status,
            matchedStudentId:  m.matched?.id ?? null,
            matchedStudentName:m.matched?.full_name ?? '',
            candidates:        m.candidates.map(c => ({
              id: c.id, full_name: c.full_name,
              father_name: c.father_name ?? '',
              className: c.class?.name ?? '',
            })),
            skip: m.status === 'unmatched',
          };
        });

        setRows(matched);
        setStep(2);
      } catch (err: any) {
        setError('Failed to parse file: ' + err.message);
      }
    };
    reader.readAsBinaryString(f);
  };

  // ── Row updaters ──────────────────────────────────────────────────────────

  const setRowStudent = (idx: number, studentId: string) => {
    const student = allStudents.find(s => s.id === studentId);
    setRows(prev => prev.map((r, i) => i !== idx ? r : {
      ...r,
      matchedStudentId:   studentId,
      matchedStudentName: student?.full_name ?? '',
      matchStatus:        'matched',
      skip:               false,
    }));
  };

  const toggleSkip = (idx: number) =>
    setRows(prev => prev.map((r, i) => i !== idx ? r : { ...r, skip: !r.skip }));

  const updateField = (idx: number, field: keyof ParsedRow, value: any) =>
    setRows(prev => prev.map((r, i) => i !== idx ? r : { ...r, [field]: value }));

  // ── Import ────────────────────────────────────────────────────────────────

  const runImport = async () => {
    if (!userRole?.school_id) return;
    setLoading(true);
    setError('');
    const monthYear = `${month}-01`;
    const importDate = monthYear;
    let imported = 0, skipped = 0;
    const errors: string[] = [];

    for (const row of rows) {
      if (row.skip || !row.matchedStudentId) { skipped++; continue; }

      try {
        const breakdown = [{ item: 'Monthly Tuition Fee', amount: row.actualFee }];
        if (row.pendingArrears > 0) breakdown.push({ item: 'Previous Arrears', amount: row.pendingArrears });

        const totalAmount = row.actualFee || (row.feePaid + row.pendingArrears);
        const paidAmount  = row.feePaid;
        const computedStatus = feeStatus(paidAmount, totalAmount);

        // Check if fee record already exists
        const { data: existing } = await supabase.from('fee_records')
          .select('id')
          .eq('school_id', userRole.school_id)
          .eq('student_id', row.matchedStudentId)
          .eq('month_year', monthYear)
          .is('deleted_at', null)
          .maybeSingle();

        let feeRecordId: string;

        if (existing) {
          // Update existing
          await supabase.from('fee_records').update({
            total_amount:    totalAmount,
            paid_amount:     paidAmount,
            status:          computedStatus,
            payment_mode:    paidAmount > 0 ? (row.paymentMode || 'Cash') : 'Pending',
            breakdown,
            remarks:         [row.status !== 'NILL' ? row.status : '', row.remarks].filter(Boolean).join(' · ') || null,
          }).eq('id', existing.id);
          feeRecordId = existing.id;
        } else {
          // Insert new
          const inv = invoiceNum(month, row.matchedStudentId);
          const { data: ins } = await supabase.from('fee_records').insert({
            school_id:       userRole.school_id,
            student_id:      row.matchedStudentId,
            month_year:      monthYear,
            invoice_number:  inv,
            total_amount:    totalAmount,
            paid_amount:     paidAmount,
            discount_amount: 0,
            status:          computedStatus,
            payment_mode:    paidAmount > 0 ? (row.paymentMode || 'Cash') : 'Pending',
            due_date:        monthYear,
            breakdown,
            remarks:         [row.status !== 'NILL' ? row.status : '', row.remarks].filter(Boolean).join(' · ') || null,
            created_by:      user?.id,
          }).select('id').single();
          feeRecordId = ins?.id;
        }

        // Insert financial transaction if payment was made
        if (paidAmount > 0 && feeRecordId) {
          // Avoid duplicate transactions
          const { data: txExists } = await supabase.from('financial_transactions')
            .select('id')
            .eq('school_id', userRole.school_id)
            .eq('fee_record_id', feeRecordId)
            .maybeSingle();

          if (!txExists) {
            await supabase.from('financial_transactions').insert({
              school_id:     userRole.school_id,
              type:          'income',
              category:      'Fee Collection',
              amount:        paidAmount,
              date:          importDate,
              payment_mode:  row.paymentMode || 'Cash',
              remarks:       `${row.studentName} — ${month}`,
              fee_record_id: feeRecordId,
              fee_items:     breakdown,
              is_deleted:    false,
            });
          }
        }

        imported++;
      } catch (err: any) {
        errors.push(`${row.studentName}: ${err.message}`);
      }
    }

    setResult({ imported, skipped, errors });
    setStep(4);
    setLoading(false);
  };

  // ── Stats ─────────────────────────────────────────────────────────────────

  const matched   = rows.filter(r => r.matchStatus === 'matched' && !r.skip).length;
  const multiple  = rows.filter(r => r.matchStatus === 'multiple').length;
  const unmatched = rows.filter(r => r.matchStatus === 'unmatched').length;
  const skippedCount = rows.filter(r => r.skip).length;

  const monthLabel = () => {
    const [y, m] = month.split('-');
    return new Date(Number(y), Number(m) - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-aura-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => navigate('/fees/invoices')}
            className="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 hover:text-slate-900 transition-colors">
            <ChevronLeft className="w-3 h-3" /> Back to Invoices
          </button>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3 tracking-tighter">
            <FileSpreadsheet className="w-8 h-8 text-indigo-600" /> Bulk Fee History Import
          </h1>
          <p className="text-slate-500 text-sm font-bold mt-1 opacity-70 uppercase tracking-widest">
            Migrate monthly fee records from Excel — month by month
          </p>
        </div>
        <a
          href="https://docs.google.com/spreadsheets"
          onClick={e => e.preventDefault()}
          className="hidden"
        />
      </div>

      {/* Progress steps */}
      <div className="flex border-b border-slate-100">
        {[['1','Upload & Month','upload'],['2','Match Students','match'],['3','Review & Import','import'],['4','Done','done']].map(([n, label, key], i) => (
          <div key={key} className={`px-6 py-4 font-black text-[10px] uppercase tracking-[0.2em] border-b-2 transition-all ${step === i + 1 ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>
            {n}. {label}
          </div>
        ))}
      </div>

      <div className="aura-card border-none shadow-2xl shadow-slate-200/50 p-8">

        {error && (
          <div className="mb-6 bg-red-50 border border-red-100 p-4 rounded-2xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <p className="text-xs font-bold text-red-700">{error}</p>
          </div>
        )}

        {/* ── STEP 1: Upload ── */}
        {step === 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">

            {/* Month selector */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-[0.2em]">
                Fee Month *
              </label>
              <input type="month" value={month} onChange={e => setMonth(e.target.value)}
                className="bg-slate-50 border border-slate-200 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-200 transition-all" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">
                All records in the file will be imported for: <span className="text-indigo-600">{monthLabel()}</span>
              </p>
            </div>

            {/* File drop zone */}
            <div className="flex flex-col items-center justify-center p-16 border-4 border-dashed border-slate-100 rounded-[2rem] bg-slate-50/30">
              <div className="w-20 h-20 bg-white rounded-3xl shadow-xl shadow-slate-200/50 flex items-center justify-center mb-6">
                <FileSpreadsheet className="w-10 h-10 text-indigo-500" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">Select Excel File</h3>
              <p className="text-xs text-slate-400 font-bold text-center max-w-md mb-2 uppercase tracking-widest leading-relaxed">
                Upload your monthly fee record Excel (.xlsx) or CSV file.
              </p>
              <p className="text-[10px] text-slate-400 font-bold mb-8 text-center">
                Required columns: <span className="text-indigo-600">Student Name, Class, Fee Paid, Actual Fee</span>
              </p>
              <label className="cursor-pointer bg-slate-900 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.25em] hover:bg-black transition-all flex items-center gap-3 shadow-xl active:scale-95">
                <Upload className="w-5 h-5" /> Browse File (.xlsx / .csv)
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
              </label>
            </div>

            {/* Template download hint */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 flex items-start gap-4">
              <Download className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black text-indigo-800 uppercase tracking-widest">Using the sample template?</p>
                <p className="text-xs text-indigo-700 font-medium mt-1 opacity-80">
                  The sample template (<code>fee_import_template.xlsx</code>) in your Downloads folder already has the right column headers. Fill it in and upload here. One file per month.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── STEP 2: Match Students ── */}
        {step === 2 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

            {/* Stats bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Total Rows',  value: rows.length,   cls: 'text-slate-700 bg-slate-50  border-slate-100' },
                { label: 'Matched',     value: matched,        cls: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
                { label: 'Ambiguous',   value: multiple,       cls: 'text-amber-700   bg-amber-50   border-amber-100' },
                { label: 'Not Found',   value: unmatched,      cls: 'text-rose-700    bg-rose-50    border-rose-100' },
              ].map(s => (
                <div key={s.label} className={`rounded-xl border px-4 py-3 text-center ${s.cls}`}>
                  <p className="text-2xl font-black leading-none">{s.value}</p>
                  <p className="text-[9px] font-black uppercase tracking-widest mt-1 opacity-70">{s.label}</p>
                </div>
              ))}
            </div>

            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Month: <span className="text-indigo-600">{monthLabel()}</span> · File: <span className="text-slate-600">{file?.name}</span>
            </p>

            {/* Match table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-4 py-3 text-left font-black text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="px-4 py-3 text-left font-black text-slate-400 uppercase tracking-widest">Name in File</th>
                    <th className="px-4 py-3 text-left font-black text-slate-400 uppercase tracking-widest">Class</th>
                    <th className="px-4 py-3 text-left font-black text-slate-400 uppercase tracking-widest">Matched Student</th>
                    <th className="px-4 py-3 text-right font-black text-slate-400 uppercase tracking-widest">Fee Paid</th>
                    <th className="px-4 py-3 text-right font-black text-slate-400 uppercase tracking-widest">Actual Fee</th>
                    <th className="px-4 py-3 text-center font-black text-slate-400 uppercase tracking-widest">Skip</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map((row, idx) => (
                    <tr key={row._idx} className={`transition-colors ${row.skip ? 'opacity-40 bg-slate-50' : row.matchStatus === 'unmatched' ? 'bg-rose-50/30' : row.matchStatus === 'multiple' ? 'bg-amber-50/30' : 'hover:bg-slate-50/60'}`}>

                      {/* Status icon */}
                      <td className="px-4 py-2.5">
                        {row.skip
                          ? <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Skipped</span>
                          : row.matchStatus === 'matched'
                          ? <span className="flex items-center gap-1 text-emerald-700"><CheckCircle className="w-3.5 h-3.5" /> <span className="text-[9px] font-black uppercase">Matched</span></span>
                          : row.matchStatus === 'multiple'
                          ? <span className="flex items-center gap-1 text-amber-700"><AlertTriangle className="w-3.5 h-3.5" /> <span className="text-[9px] font-black uppercase">Ambiguous</span></span>
                          : <span className="flex items-center gap-1 text-rose-700"><XCircle className="w-3.5 h-3.5" /> <span className="text-[9px] font-black uppercase">Not Found</span></span>}
                      </td>

                      <td className="px-4 py-2.5 font-bold text-slate-700">{row.studentName}</td>
                      <td className="px-4 py-2.5 text-slate-500">{row.classNum || '—'}</td>

                      {/* Student selector */}
                      <td className="px-4 py-2.5">
                        {row.matchStatus === 'matched' && !row.skip
                          ? <span className="text-emerald-700 font-bold">{row.matchedStudentName}</span>
                          : <select
                              value={row.matchedStudentId ?? ''}
                              onChange={e => setRowStudent(idx, e.target.value)}
                              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-200"
                            >
                              <option value="">— Select Student —</option>
                              {/* Show candidates first if ambiguous */}
                              {row.candidates.length > 0 && (
                                <optgroup label="Possible Matches">
                                  {row.candidates.map(c => (
                                    <option key={c.id} value={c.id}>{c.full_name}{c.father_name ? ` s/o ${c.father_name}` : ''} — Class {c.className}</option>
                                  ))}
                                </optgroup>
                              )}
                              <optgroup label="All Students">
                                {allStudents.map(s => (
                                  <option key={s.id} value={s.id}>{s.full_name} — Class {s.class?.name ?? '?'}</option>
                                ))}
                              </optgroup>
                            </select>
                        }
                      </td>

                      {/* Fee Paid (editable) */}
                      <td className="px-4 py-2.5 text-right">
                        <input type="number" value={row.feePaid}
                          onChange={e => updateField(idx, 'feePaid', toMoney(e.target.value))}
                          className="w-24 px-2 py-1 text-right bg-white border border-slate-200 rounded-lg text-xs font-black text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-200" />
                      </td>

                      {/* Actual Fee (editable) */}
                      <td className="px-4 py-2.5 text-right">
                        <input type="number" value={row.actualFee}
                          onChange={e => updateField(idx, 'actualFee', toMoney(e.target.value))}
                          className="w-24 px-2 py-1 text-right bg-white border border-slate-200 rounded-lg text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-indigo-200" />
                      </td>

                      {/* Skip toggle */}
                      <td className="px-4 py-2.5 text-center">
                        <button onClick={() => toggleSkip(idx)}
                          className={`p-1.5 rounded-lg transition-all ${row.skip ? 'bg-slate-200 text-slate-500' : 'bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500'}`}
                          title={row.skip ? 'Include this row' : 'Skip this row'}>
                          <SkipForward className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4">
              <button onClick={() => setStep(1)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors flex items-center gap-1">
                <ChevronLeft className="w-3 h-3" /> Back
              </button>
              <div className="flex items-center gap-4">
                {unmatched > 0 && (
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">
                    {unmatched} rows unmatched — they will be skipped unless you assign a student above.
                  </p>
                )}
                <button onClick={() => setStep(3)}
                  className="px-8 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-indigo-700 flex items-center gap-2 shadow-lg shadow-indigo-200 active:scale-95 transition-all">
                  Review Import <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── STEP 3: Confirm ── */}
        {step === 3 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6">
              <h3 className="text-sm font-black text-indigo-900 uppercase tracking-widest mb-3">Import Summary</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-3xl font-black text-indigo-700">{rows.filter(r => !r.skip && r.matchedStudentId).length}</p>
                  <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mt-1">Will Import</p>
                </div>
                <div>
                  <p className="text-3xl font-black text-slate-400">{skippedCount}</p>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Will Skip</p>
                </div>
                <div>
                  <p className="text-3xl font-black text-emerald-700">
                    Rs. {rows.filter(r => !r.skip && r.matchedStudentId).reduce((s, r) => s + r.feePaid, 0).toLocaleString()}
                  </p>
                  <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mt-1">Total Collected</p>
                </div>
              </div>
            </div>

            <p className="text-xs font-bold text-slate-500">
              Month: <strong className="text-slate-900">{monthLabel()}</strong> · Each matched student will get a fee record and (if paid &gt; 0) a financial transaction entry.
            </p>

            {/* Preview of what will be created */}
            <div className="overflow-x-auto rounded-2xl border border-slate-100 max-h-80">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-black text-slate-400 uppercase tracking-widest">Student</th>
                    <th className="px-4 py-3 text-right font-black text-slate-400 uppercase tracking-widest">Actual Fee</th>
                    <th className="px-4 py-3 text-right font-black text-slate-400 uppercase tracking-widest">Paid</th>
                    <th className="px-4 py-3 text-right font-black text-slate-400 uppercase tracking-widest">Arrears</th>
                    <th className="px-4 py-3 text-center font-black text-slate-400 uppercase tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.filter(r => !r.skip && r.matchedStudentId).map(r => (
                    <tr key={r._idx} className="hover:bg-slate-50/60">
                      <td className="px-4 py-2 font-bold text-slate-700">{r.matchedStudentName}</td>
                      <td className="px-4 py-2 text-right text-slate-600">Rs. {r.actualFee.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right font-black text-emerald-600">Rs. {r.feePaid.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-amber-600">{r.pendingArrears > 0 ? `Rs. ${r.pendingArrears.toLocaleString()}` : '—'}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                          feeStatus(r.feePaid, r.actualFee) === 'paid'    ? 'bg-emerald-100 text-emerald-700' :
                          feeStatus(r.feePaid, r.actualFee) === 'partial' ? 'bg-amber-100   text-amber-700'   :
                                                                             'bg-rose-100    text-rose-700'}`}>
                          {feeStatus(r.feePaid, r.actualFee)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button onClick={() => setStep(2)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors flex items-center gap-1">
                <ChevronLeft className="w-3 h-3" /> Back
              </button>
              <button onClick={runImport} disabled={loading}
                className="px-10 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-black flex items-center gap-3 shadow-xl active:scale-95 disabled:opacity-50 transition-all">
                {loading ? 'Importing…' : <><Save className="w-4 h-4" /> Confirm Import</>}
              </button>
            </div>
          </motion.div>
        )}

        {/* ── STEP 4: Done ── */}
        {step === 4 && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-12 space-y-6">
            <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-lg shadow-emerald-50">
              <CheckCircle className="w-12 h-12" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Import Complete</h2>
              <p className="text-slate-500 text-sm font-bold mt-2">{monthLabel()} fee records have been committed to the system.</p>
            </div>

            <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
                <p className="text-3xl font-black text-emerald-700">{result.imported}</p>
                <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mt-1">Imported</p>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                <p className="text-3xl font-black text-slate-400">{result.skipped}</p>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Skipped</p>
              </div>
              <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4">
                <p className="text-3xl font-black text-rose-600">{result.errors.length}</p>
                <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest mt-1">Errors</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-left max-w-lg mx-auto">
                <p className="text-[10px] font-black text-red-700 uppercase tracking-widest mb-2">Errors:</p>
                {result.errors.map((e, i) => <p key={i} className="text-xs text-red-600 font-medium">{e}</p>)}
              </div>
            )}

            <div className="flex justify-center gap-4 pt-2">
              <button onClick={() => { setStep(1); setFile(null); setRows([]); setError(''); }}
                className="px-8 py-4 bg-slate-100 text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95">
                Import Another Month
              </button>
              <button onClick={() => navigate('/fees/invoices')}
                className="px-8 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all active:scale-95">
                View Fee Records
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
