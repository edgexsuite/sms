import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  BookOpen, Download, Printer, Search, CreditCard,
  CheckCircle, AlertCircle, User, ChevronRight
} from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';
import { formatDate, formatDateTime, cn, getBase64Image } from '../../lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Card, Btn } from '../../components/ui';

interface StudentOption {
  id: string;
  full_name: string;
  student_unique_id: string;
  roll_number: string;
  class_id: string;
  photograph_url: string | null;
  fee_waiver_percentage: number;
  classes: { name: string; section: string } | null;
  parents: { father_name: string; whatsapp_number: string } | null;
}

interface FeeEntry {
  id: string;
  invoice_number: string;
  month_year: string;
  total_amount: number;
  paid_amount: number;
  discount_amount: number;
  status: string;
  due_date: string;
  paid_at: string | null;
  payment_mode: string | null;
}

export default function StudentFeeLedgerReport() {
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [classFilter, setClassFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);
  const [feeRecords, setFeeRecords] = useState<FeeEntry[]>([]);
  const [feeLoading, setFeeLoading] = useState(false);

  const fetchMeta = useCallback(async () => {
    if (!userRole?.school_id) return;
    const [{ data: cls }, { data: sch }, { data: stu }] = await Promise.all([
      supabase.from('classes').select('id, name, section').eq('school_id', userRole.school_id).order('name'),
      supabase.from('schools').select('name, address, logo_url').eq('id', userRole.school_id).single(),
      supabase.from('students')
        .select('id, full_name, student_unique_id, roll_number, class_id, photograph_url, fee_waiver_percentage, classes(name, section), parents(father_name, whatsapp_number)')
        .eq('school_id', userRole.school_id)
        .eq('is_deleted', false)
        .eq('status', 'active')
        .order('full_name'),
    ]);
    if (cls) setClasses(cls);
    if (sch) setSchoolInfo(sch);
    if (stu) setStudents(stu as any);
  }, [userRole?.school_id]);

  useEffect(() => { fetchMeta(); }, [fetchMeta]);

  const fetchFees = useCallback(async (studentId: string) => {
    setFeeLoading(true);
    const { data } = await supabase
      .from('fee_records')
      .select('id, invoice_number, month_year, total_amount, paid_amount, discount_amount, status, due_date, paid_at, payment_mode')
      .eq('student_id', studentId)
      .is('deleted_at', null)
      .order('month_year', { ascending: true });
    setFeeRecords((data || []) as FeeEntry[]);
    setFeeLoading(false);
  }, []);

  const handleSelectStudent = (s: StudentOption) => {
    setSelectedStudent(s);
    fetchFees(s.id);
  };

  // Filter students list
  const filteredStudents = useMemo(() => {
    let list = students;
    if (classFilter) list = list.filter(s => s.class_id === classFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.full_name?.toLowerCase().includes(q) ||
        s.student_unique_id?.toLowerCase().includes(q) ||
        String(s.roll_number).includes(q)
      );
    }
    return list;
  }, [students, classFilter, search]);

  // Ledger stats
  const ledger = useMemo(() => {
    const total = feeRecords.reduce((s, r) => s + Number(r.total_amount || 0), 0);
    const paid = feeRecords.reduce((s, r) => s + Number(r.paid_amount || 0), 0);
    const discount = feeRecords.reduce((s, r) => s + Number(r.discount_amount || 0), 0);
    return { total, paid, balance: Math.max(0, total - paid), discount, count: feeRecords.length };
  }, [feeRecords]);

  // Running balance
  const rowsWithRunning = useMemo(() => {
    let running = 0;
    return feeRecords.map(r => {
      const bal = Math.max(0, Number(r.total_amount) - Number(r.paid_amount));
      running += bal;
      return { ...r, runningBalance: running };
    });
  }, [feeRecords]);

  const clsLabel = (s: StudentOption) =>
    s.classes ? `${s.classes.name}${s.classes.section ? `-${s.classes.section}` : ''}` : '—';

  const statusBadge = (s: string) => {
    if (s === 'paid') return 'bg-emerald-100 text-emerald-700';
    if (s === 'partial' || s === 'partially paid') return 'bg-amber-100 text-amber-700';
    return 'bg-rose-100 text-rose-700';
  };

  // PDF for single student
  const handlePDF = async () => {
    if (!selectedStudent) return;
    const doc = new jsPDF('p', 'mm', 'a4');
    const pw = doc.internal.pageSize.width;
    const s = selectedStudent;

    if (schoolInfo?.logo_url) {
      try { doc.addImage(await getBase64Image(schoolInfo.logo_url), 'PNG', pw / 2 - 10, 8, 20, 20); } catch {}
    }
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text(schoolInfo?.name || '', pw / 2, 32, { align: 'center' });
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text('Student Fee Ledger Report', pw / 2, 39, { align: 'center' });
    doc.setDrawColor(200); doc.setLineWidth(0.3); doc.line(10, 42, pw - 10, 42);

    // Student info
    let y = 50;
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    const info = [
      ['Student Name', s.full_name],
      ['Admission No', s.student_unique_id || '—'],
      ['Roll No', String(s.roll_number || '—')],
      ['Class', clsLabel(s)],
      ['Father Name', s.parents?.father_name || '—'],
      ['Contact', s.parents?.whatsapp_number || '—'],
      ['Fee Waiver', `${s.fee_waiver_percentage || 0}%`],
    ];
    info.forEach(([label, val]) => {
      doc.setFont('helvetica', 'bold'); doc.text(`${label}:`, 14, y);
      doc.setFont('helvetica', 'normal'); doc.text(val, 55, y);
      y += 5.5;
    });
    y += 3;

    // Summary
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.text(`Total Invoiced: Rs. ${ledger.total.toLocaleString()}   |   Paid: Rs. ${ledger.paid.toLocaleString()}   |   Balance: Rs. ${ledger.balance.toLocaleString()}`, pw / 2, y, { align: 'center' });
    y += 7;

    autoTable(doc, {
      startY: y,
      head: [['#', 'Month', 'Invoice', 'Total', 'Discount', 'Paid', 'Balance', 'Running Bal.', 'Status', 'Paid Date']],
      body: rowsWithRunning.map((r, i) => [
        i + 1,
        formatDate(r.month_year),
        r.invoice_number || '—',
        Number(r.total_amount).toLocaleString(),
        Number(r.discount_amount || 0).toLocaleString(),
        Number(r.paid_amount).toLocaleString(),
        Math.max(0, Number(r.total_amount) - Number(r.paid_amount)).toLocaleString(),
        r.runningBalance.toLocaleString(),
        r.status?.toUpperCase(),
        r.paid_at ? formatDate(r.paid_at) : '—',
      ]),
      theme: 'grid',
      headStyles: { fillColor: [13, 21, 38], textColor: 255, fontStyle: 'bold', fontSize: 7 },
      styles: { fontSize: 7, cellPadding: 2 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i); doc.setFontSize(6); doc.setTextColor(160);
      doc.text(`${schoolInfo?.name || ''} — Confidential`, 10, 290);
      doc.text(`Page ${i} of ${pages}`, pw - 10, 290, { align: 'right' });
      doc.setTextColor(0);
    }
    doc.save(`Fee_Ledger_${s.full_name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleCSV = () => {
    if (!selectedStudent) return;
    exportToCSV(`fee-ledger-${selectedStudent.full_name}`, rowsWithRunning, [
      { header: 'Month', key: (r: any) => formatDate(r.month_year) },
      { header: 'Invoice', key: 'invoice_number' },
      { header: 'Total', key: 'total_amount' },
      { header: 'Discount', key: 'discount_amount' },
      { header: 'Paid', key: 'paid_amount' },
      { header: 'Balance', key: (r: any) => Math.max(0, r.total_amount - r.paid_amount) },
      { header: 'Running Balance', key: 'runningBalance' },
      { header: 'Status', key: 'status' },
      { header: 'Paid Date', key: (r: any) => r.paid_at ? formatDate(r.paid_at) : '' },
      { header: 'Mode', key: 'payment_mode' },
    ]);
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm no-print">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-sky-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-sky-100">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900 uppercase tracking-tight">Student Fee Ledger</h1>
            <p className="text-[10px] text-slate-400 font-bold">Full fee history per student — invoices, payments, running balance</p>
          </div>
        </div>
        {selectedStudent && (
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
            <Btn variant="outline" size="sm" onClick={handleCSV} className="text-[10px] h-9 px-3">CSV</Btn>
            <Btn variant="outline" size="sm" onClick={() => window.print()} className="text-[10px] h-9 px-3"><Printer className="w-3 h-3" /></Btn>
            <Btn variant="primary" size="sm" onClick={handlePDF} className="text-[10px] h-9 px-3 font-black">PDF REPORT</Btn>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Student Picker — Left sidebar */}
        <div className="lg:col-span-1 space-y-3 no-print">
          <Card className="p-3 shadow-sm border-slate-100 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student name, adm no..."
                className="w-full pl-9 pr-3 py-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <select value={classFilter} onChange={e => setClassFilter(e.target.value)}
              className="w-full px-3 py-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">All Classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
            </select>
          </Card>

          <Card className="shadow-sm border-slate-100 overflow-hidden max-h-[500px] overflow-y-auto">
            {filteredStudents.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-8">No students found.</p>
            ) : filteredStudents.map(s => (
              <button key={s.id} onClick={() => handleSelectStudent(s)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-left transition-all border-b border-slate-100 last:border-b-0',
                  selectedStudent?.id === s.id ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : 'hover:bg-slate-50'
                )}>
                {s.photograph_url ? (
                  <img src={s.photograph_url} className="w-8 h-8 rounded-full object-cover" alt="" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                    <User className="w-4 h-4 text-slate-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 uppercase truncate">{s.full_name}</p>
                  <p className="text-[10px] text-slate-400">{clsLabel(s)} · {s.student_unique_id || '—'}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
              </button>
            ))}
          </Card>
        </div>

        {/* Ledger — Right content */}
        <div className="lg:col-span-2">
          {!selectedStudent ? (
            <Card className="py-20 text-center shadow-sm border-slate-100">
              <BookOpen className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <h2 className="text-sm font-black text-slate-400 uppercase tracking-tight">Select a Student</h2>
              <p className="text-xs text-slate-400 mt-1">Choose from the list to view their complete fee ledger.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Student Header Card */}
              <Card className="p-4 shadow-sm border-slate-100">
                <div className="flex items-center gap-4">
                  {selectedStudent.photograph_url ? (
                    <img src={selectedStudent.photograph_url} className="w-14 h-14 rounded-xl object-cover shadow-sm" alt="" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-indigo-100 flex items-center justify-center">
                      <User className="w-7 h-7 text-indigo-400" />
                    </div>
                  )}
                  <div className="flex-1">
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">{selectedStudent.full_name}</h2>
                    <p className="text-[10px] text-slate-400 font-bold">
                      {clsLabel(selectedStudent)} · {selectedStudent.student_unique_id} · Roll {selectedStudent.roll_number}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Father: {selectedStudent.parents?.father_name || '—'} · {selectedStudent.parents?.whatsapp_number || '—'}
                      {selectedStudent.fee_waiver_percentage > 0 && (
                        <span className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-black">
                          {selectedStudent.fee_waiver_percentage >= 100 ? 'FREE' : `${selectedStudent.fee_waiver_percentage}% waiver`}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                  {[
                    { label: 'Invoices', val: ledger.count, color: 'text-slate-700' },
                    { label: 'Total Invoiced', val: `Rs. ${ledger.total.toLocaleString()}`, color: 'text-indigo-600' },
                    { label: 'Total Paid', val: `Rs. ${ledger.paid.toLocaleString()}`, color: 'text-emerald-600' },
                    { label: 'Balance Due', val: `Rs. ${ledger.balance.toLocaleString()}`, color: 'text-rose-600' },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
                      <p className={cn('text-sm font-black mt-1', s.color)}>{s.val}</p>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Fee Table */}
              <Card className="shadow-sm border-slate-100 overflow-hidden">
                {feeLoading ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-8 h-8 border-4 border-sky-100 border-t-sky-600 rounded-full animate-spin" />
                    <p className="text-xs font-black text-slate-400 uppercase mt-3">Loading Ledger…</p>
                  </div>
                ) : feeRecords.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <BookOpen className="w-8 h-8 text-slate-200 mb-2" />
                    <p className="text-xs font-bold text-slate-400">No fee records found for this student.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-[#0d1526] sticky top-0 z-10">
                        <tr>
                          {['#', 'Month', 'Invoice', 'Total', 'Discount', 'Paid', 'Balance', 'Running Bal.', 'Status', 'Paid Date'].map(h => (
                            <th key={h} className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest text-[10px] whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rowsWithRunning.map((r, i) => {
                          const bal = Math.max(0, Number(r.total_amount) - Number(r.paid_amount));
                          return (
                            <tr key={r.id} className="hover:bg-slate-50/50">
                              <td className="px-4 py-3 font-bold text-slate-300">{i + 1}</td>
                              <td className="px-4 py-3 font-bold text-slate-700">{formatDate(r.month_year)}</td>
                              <td className="px-4 py-3 font-mono text-[10px] text-slate-400">{r.invoice_number || '—'}</td>
                              <td className="px-4 py-3 font-bold text-slate-700">{Number(r.total_amount).toLocaleString()}</td>
                              <td className="px-4 py-3 font-bold text-orange-500">{Number(r.discount_amount || 0) > 0 ? Number(r.discount_amount).toLocaleString() : '—'}</td>
                              <td className="px-4 py-3 font-bold text-emerald-600">{Number(r.paid_amount).toLocaleString()}</td>
                              <td className="px-4 py-3 font-bold text-rose-600">{bal > 0 ? bal.toLocaleString() : '0'}</td>
                              <td className="px-4 py-3 font-black text-slate-900">{r.runningBalance.toLocaleString()}</td>
                              <td className="px-4 py-3">
                                <span className={cn('px-2 py-0.5 rounded text-[9px] font-black uppercase', statusBadge(r.status))}>
                                  {r.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-bold text-slate-500 text-[10px]">{r.paid_at ? formatDate(r.paid_at) : '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {!feeLoading && feeRecords.length > 0 && (
                  <div className="bg-slate-50 px-6 py-4 flex justify-between items-center border-t border-slate-200">
                    <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                      {feeRecords.length} invoices
                    </span>
                    <div className="flex gap-6">
                      <div className="text-right">
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Cumulative Balance</p>
                        <p className="text-sm font-black text-rose-600">Rs. {ledger.balance.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
