import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Table2, Download, Printer, Search, CreditCard,
  CheckCircle, AlertCircle, Clock, Calendar, Users,
  Filter, ChevronDown, Check, Sparkles, Layers, ArrowUpDown,
  GraduationCap
} from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';
import { formatDate, formatDateTime, cn, getBase64Image } from '../../lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PageHeader, Card, Btn, Badge } from '../../components/ui';

interface StudentInfo {
  id: string;
  student_unique_id: string;
  roll_number: string;
  full_name: string;
  father_name: string;
  whatsapp_number: string;
  class_id: string;
  class_name: string;
}

interface MonthCell {
  invoice_id?: string;
  invoice_number?: string;
  total_amount: number;
  paid_amount: number;
  balance: number;
  status: 'paid' | 'partial' | 'pending' | 'none';
  paid_at?: string | null;
}

interface StudentMatrixRow {
  student: StudentInfo;
  months: Record<string, MonthCell>; // keyed by "YYYY-MM"
  totalInvoiced: number;
  totalPaid: number;
  totalBalance: number;
  collectionRate: number;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function ClassFeeMatrixReport() {
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<any[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);

  // Filters
  const [selectedClassId, setSelectedClassId] = useState<string>('all'); // 'all' or specific class_id
  
  // Custom Month Range
  const currentYear = new Date().getFullYear();
  const [startMonth, setStartMonth] = useState<string>(`${currentYear}-01`);
  const [endMonth, setEndMonth] = useState<string>(`${currentYear}-12`);

  const [displayMode, setDisplayMode] = useState<'amount' | 'status' | 'balance'>('amount');
  const [search, setSearch] = useState('');

  // Data
  const [matrixRows, setMatrixRows] = useState<StudentMatrixRow[]>([]);
  const [allAvailableMonths, setAllAvailableMonths] = useState<string[]>([]);

  // Generate All Months between startMonth and endMonth
  const monthsList = useMemo(() => {
    const list: { key: string; label: string; shortLabel: string }[] = [];
    if (!startMonth || !endMonth) return list;

    let [startYr, startMo] = startMonth.split('-').map(Number);
    let [endYr, endMo] = endMonth.split('-').map(Number);

    if (startYr > endYr || (startYr === endYr && startMo > endMo)) {
      // Swap if user selected in reverse
      [startYr, endYr] = [endYr, startYr];
      [startMo, endMo] = [endMo, startMo];
    }

    let curYr = startYr;
    let curMo = startMo;

    while (curYr < endYr || (curYr === endYr && curMo <= endMo)) {
      const mm = String(curMo).padStart(2, '0');
      const key = `${curYr}-${mm}`;
      list.push({
        key,
        label: `${MONTH_NAMES[curMo - 1]} ${curYr}`,
        shortLabel: `${MONTH_NAMES[curMo - 1]} '${String(curYr).slice(2)}`,
      });

      curMo++;
      if (curMo > 12) {
        curMo = 1;
        curYr++;
      }
    }
    return list;
  }, [startMonth, endMonth]);

  // Fetch Meta & Database Month range
  const fetchMeta = useCallback(async () => {
    if (!userRole?.school_id) return;
    const [{ data: cls }, { data: sch }, { data: feeRecords }] = await Promise.all([
      supabase.from('classes').select('id, name, section').eq('school_id', userRole.school_id).order('name'),
      supabase.from('schools').select('*').eq('id', userRole.school_id).single(),
      supabase.from('fee_records').select('month_year').eq('school_id', userRole.school_id).is('deleted_at', null).order('month_year', { ascending: false }).limit(2000)
    ]);

    if (cls) setClasses(cls);
    if (sch) setSchoolInfo(sch);

    if (feeRecords) {
      const mSet = new Set<string>();
      feeRecords.forEach((r: any) => {
        if (r.month_year) {
          mSet.add(r.month_year.slice(0, 7));
        }
      });
      // Also add current year months
      for (let m = 1; m <= 12; m++) {
        mSet.add(`${currentYear}-${String(m).padStart(2, '0')}`);
      }
      const sortedMonths = Array.from(mSet).sort().reverse();
      setAllAvailableMonths(sortedMonths);
    }
  }, [userRole?.school_id, currentYear]);

  useEffect(() => {
    fetchMeta();
  }, [fetchMeta]);

  // Fetch Matrix Data
  const fetchMatrixData = useCallback(async () => {
    if (!userRole?.school_id || monthsList.length === 0) return;
    setLoading(true);

    try {
      // 1. Fetch active students (All classes or single class)
      let stuQuery = supabase
        .from('students')
        .select(`
          id,
          student_unique_id,
          roll_number,
          full_name,
          class_id,
          classes (name, section),
          parents (father_name, whatsapp_number)
        `)
        .eq('school_id', userRole.school_id)
        .eq('is_deleted', false)
        .order('roll_number', { ascending: true });

      if (selectedClassId !== 'all') {
        stuQuery = stuQuery.eq('class_id', selectedClassId);
      }

      const { data: stuData, error: stuErr } = await stuQuery;
      if (stuErr) throw stuErr;

      // 2. Fetch fee records for this period
      const minMonth = `${monthsList[0].key}-01`;
      const [lastYear, lastMonth] = monthsList[monthsList.length - 1].key.split('-').map(Number);
      const lastDay = new Date(lastYear, lastMonth, 0).getDate(); // Returns exact days in month (28, 29, 30, 31)
      const maxMonth = `${monthsList[monthsList.length - 1].key}-${String(lastDay).padStart(2, '0')}`;

      let feeQuery = supabase
        .from('fee_records')
        .select(`
          id,
          student_id,
          invoice_number,
          month_year,
          total_amount,
          paid_amount,
          status,
          paid_at
        `)
        .eq('school_id', userRole.school_id)
        .is('deleted_at', null)
        .gte('month_year', minMonth)
        .lte('month_year', maxMonth);

      const { data: feeData, error: feeErr } = await feeQuery;
      if (feeErr) throw feeErr;

      // Index fee records by student_id and "YYYY-MM"
      const feeIndex: Record<string, Record<string, any>> = {};
      (feeData || []).forEach((r: any) => {
        const mKey = r.month_year?.slice(0, 7);
        if (!feeIndex[r.student_id]) feeIndex[r.student_id] = {};
        feeIndex[r.student_id][mKey] = r;
      });

      // 3. Construct Matrix Rows
      const rows: StudentMatrixRow[] = (stuData || []).map((s: any) => {
        const studentInfo: StudentInfo = {
          id: s.id,
          student_unique_id: s.student_unique_id || '—',
          roll_number: String(s.roll_number || '—'),
          full_name: s.full_name || '—',
          father_name: s.parents?.father_name || '—',
          whatsapp_number: s.parents?.whatsapp_number || '—',
          class_id: s.class_id,
          class_name: s.classes ? `${s.classes.name} ${s.classes.section || ''}`.trim() : '—',
        };

        const monthsRecord: Record<string, MonthCell> = {};
        let totalInv = 0;
        let totalPaid = 0;

        monthsList.forEach(m => {
          const inv = feeIndex[s.id]?.[m.key];
          if (inv) {
            const tot = Number(inv.total_amount || 0);
            const pd = Number(inv.paid_amount || 0);
            const bal = Math.max(0, tot - pd);
            totalInv += tot;
            totalPaid += pd;

            let st: 'paid' | 'partial' | 'pending' = 'pending';
            if (inv.status === 'paid' || bal === 0) st = 'paid';
            else if (pd > 0 && bal > 0) st = 'partial';

            monthsRecord[m.key] = {
              invoice_id: inv.id,
              invoice_number: inv.invoice_number,
              total_amount: tot,
              paid_amount: pd,
              balance: bal,
              status: st,
              paid_at: inv.paid_at,
            };
          } else {
            monthsRecord[m.key] = {
              total_amount: 0,
              paid_amount: 0,
              balance: 0,
              status: 'none',
            };
          }
        });

        const totalBal = Math.max(0, totalInv - totalPaid);
        const rate = totalInv > 0 ? Math.round((totalPaid / totalInv) * 100) : 0;

        return {
          student: studentInfo,
          months: monthsRecord,
          totalInvoiced: totalInv,
          totalPaid: totalPaid,
          totalBalance: totalBal,
          collectionRate: rate,
        };
      });

      // Sort by class name then roll number
      rows.sort((a, b) => {
        if (a.student.class_name !== b.student.class_name) {
          return a.student.class_name.localeCompare(b.student.class_name, undefined, { numeric: true });
        }
        return a.student.roll_number.localeCompare(b.student.roll_number, undefined, { numeric: true });
      });

      setMatrixRows(rows);
    } catch (err) {
      console.error('Error fetching fee matrix:', err);
    } finally {
      setLoading(false);
    }
  }, [userRole?.school_id, selectedClassId, monthsList]);

  useEffect(() => {
    fetchMatrixData();
  }, [fetchMatrixData]);

  // Quick Preset Handlers
  const applyPreset = (preset: 'this_year' | 'last_year' | 'q1' | 'q2' | 'apr_mar') => {
    const yr = new Date().getFullYear();
    if (preset === 'this_year') {
      setStartMonth(`${yr}-01`);
      setEndMonth(`${yr}-12`);
    } else if (preset === 'last_year') {
      setStartMonth(`${yr - 1}-01`);
      setEndMonth(`${yr - 1}-12`);
    } else if (preset === 'apr_mar') {
      setStartMonth(`${yr}-04`);
      setEndMonth(`${yr + 1}-03`);
    } else if (preset === 'q1') {
      setStartMonth(`${yr}-01`);
      setEndMonth(`${yr}-03`);
    } else if (preset === 'q2') {
      setStartMonth(`${yr}-04`);
      setEndMonth(`${yr}-06`);
    }
  };

  // Filtered rows by search
  const filteredRows = useMemo(() => {
    if (!search.trim()) return matrixRows;
    const q = search.toLowerCase();
    return matrixRows.filter(r =>
      r.student.full_name.toLowerCase().includes(q) ||
      r.student.roll_number.includes(q) ||
      r.student.student_unique_id.toLowerCase().includes(q) ||
      r.student.father_name.toLowerCase().includes(q) ||
      r.student.class_name.toLowerCase().includes(q)
    );
  }, [matrixRows, search]);

  // Summary Totals
  const summaryTotals = useMemo(() => {
    const totalInvoiced = filteredRows.reduce((s, r) => s + r.totalInvoiced, 0);
    const totalCollected = filteredRows.reduce((s, r) => s + r.totalPaid, 0);
    const totalBalance = Math.max(0, totalInvoiced - totalCollected);
    const overallRate = totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 100) : 0;

    // Monthly totals
    const monthTotals: Record<string, { invoiced: number; collected: number; balance: number }> = {};
    monthsList.forEach(m => {
      let inv = 0;
      let col = 0;
      filteredRows.forEach(r => {
        const cell = r.months[m.key];
        if (cell && cell.status !== 'none') {
          inv += cell.total_amount;
          col += cell.paid_amount;
        }
      });
      monthTotals[m.key] = {
        invoiced: inv,
        collected: col,
        balance: Math.max(0, inv - col),
      };
    });

    return {
      totalInvoiced,
      totalCollected,
      totalBalance,
      overallRate,
      monthTotals,
      studentCount: filteredRows.length,
    };
  }, [filteredRows, monthsList]);

  const selectedClassObj = classes.find(c => c.id === selectedClassId);
  const scopeTitle = selectedClassId === 'all'
    ? 'ALL CLASSES (SCHOOL-WIDE)'
    : `${selectedClassObj?.name || ''} ${selectedClassObj?.section || ''}`.trim();

  // PDF Export
  const handlePDFExport = async () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const pw = doc.internal.pageSize.width;

    if (schoolInfo?.logo_url) {
      try {
        const b64 = await getBase64Image(schoolInfo.logo_url);
        doc.addImage(b64, 'PNG', 14, 8, 20, 20);
      } catch (err) {}
    }

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(schoolInfo?.name || 'School Fee Register', pw / 2, 16, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(schoolInfo?.address || '', pw / 2, 22, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`CONSOLIDATED FEE REGISTER (MATRIX) — ${scopeTitle}`.toUpperCase(), pw / 2, 30, { align: 'center' });

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`Range: ${startMonth} to ${endMonth} (${monthsList.length} Months) | Mode: ${displayMode.toUpperCase()} | Generated: ${formatDate(new Date())}`, pw / 2, 36, { align: 'center' });

    doc.setDrawColor(200);
    doc.setLineWidth(0.3);
    doc.line(14, 39, pw - 14, 39);

    // Headers
    const headRow = [
      '#',
      'Adm',
      'Roll',
      ...(selectedClassId === 'all' ? ['Class'] : []),
      'Student Name',
      ...monthsList.map(m => m.shortLabel),
      'Invoiced',
      'Paid',
      'Balance',
    ];

    const bodyRows = filteredRows.map((r, i) => {
      const monthVals = monthsList.map(m => {
        const cell = r.months[m.key];
        if (!cell || cell.status === 'none') return '—';
        if (displayMode === 'amount') return cell.paid_amount.toLocaleString();
        if (displayMode === 'status') return cell.status.toUpperCase();
        return cell.balance.toLocaleString();
      });

      return [
        i + 1,
        r.student.student_unique_id,
        r.student.roll_number,
        ...(selectedClassId === 'all' ? [r.student.class_name] : []),
        r.student.full_name,
        ...monthVals,
        r.totalInvoiced.toLocaleString(),
        r.totalPaid.toLocaleString(),
        r.totalBalance.toLocaleString(),
      ];
    });

    // Foot row
    const footRow = [
      '',
      '',
      '',
      ...(selectedClassId === 'all' ? [''] : []),
      'GRAND TOTAL',
      ...monthsList.map(m => {
        const col = summaryTotals.monthTotals[m.key]?.collected || 0;
        return col > 0 ? col.toLocaleString() : '0';
      }),
      summaryTotals.totalInvoiced.toLocaleString(),
      summaryTotals.totalCollected.toLocaleString(),
      summaryTotals.totalBalance.toLocaleString(),
    ];

    autoTable(doc, {
      startY: 42,
      head: [headRow],
      body: bodyRows,
      foot: [footRow],
      theme: 'grid',
      headStyles: { fillColor: [13, 21, 38], textColor: 255, fontStyle: 'bold', fontSize: 6.5, halign: 'center' },
      footStyles: { fillColor: [240, 244, 248], textColor: [13, 21, 38], fontStyle: 'bold', fontSize: 6.5, halign: 'center' },
      styles: { fontSize: 6, cellPadding: 1.5, halign: 'center' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 7 },
        1: { cellWidth: 14 },
        2: { cellWidth: 10 },
      },
    });

    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(6);
      doc.setTextColor(150);
      doc.text(`${schoolInfo?.name || ''} — Confidential Fee Register`, 14, 205);
      doc.text(`Page ${i} of ${pages}`, pw - 14, 205, { align: 'right' });
    }

    doc.save(`Fee_Matrix_${selectedClassId}_${startMonth}_to_${endMonth}.pdf`);
  };

  // CSV Export
  const handleCSVExport = () => {
    const headers = [
      { header: 'Adm No', key: (r: StudentMatrixRow) => r.student.student_unique_id },
      { header: 'Roll No', key: (r: StudentMatrixRow) => r.student.roll_number },
      { header: 'Class', key: (r: StudentMatrixRow) => r.student.class_name },
      { header: 'Student Name', key: (r: StudentMatrixRow) => r.student.full_name },
      { header: 'Father Name', key: (r: StudentMatrixRow) => r.student.father_name },
      { header: 'WhatsApp', key: (r: StudentMatrixRow) => r.student.whatsapp_number },
      ...monthsList.map(m => ({
        header: m.label,
        key: (r: StudentMatrixRow) => {
          const cell = r.months[m.key];
          if (!cell || cell.status === 'none') return '—';
          if (displayMode === 'amount') return cell.paid_amount;
          if (displayMode === 'status') return cell.status.toUpperCase();
          return cell.balance;
        }
      })),
      { header: 'Total Invoiced', key: 'totalInvoiced' },
      { header: 'Total Paid', key: 'totalPaid' },
      { header: 'Outstanding Balance', key: 'totalBalance' },
      { header: 'Collection Rate %', key: 'collectionRate' },
    ];

    exportToCSV(`Fee_Matrix_${selectedClassId}_${startMonth}_to_${endMonth}`, filteredRows, headers as any);
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-4">
      {/* ── Header Control Bar ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm no-print">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
            <Table2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              Fee Matrix & Consolidated Register
              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[10px] font-black uppercase">
                {scopeTitle}
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-bold">
              Multi-month cross-tab matrix showing fee paid by each student in each month
            </p>
          </div>
        </div>

        {/* Action Controls & KPI Chips */}
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
          {[
            { label: 'Total Invoiced', val: summaryTotals.totalInvoiced, color: 'text-indigo-600', icon: CreditCard },
            { label: 'Total Collected', val: summaryTotals.totalCollected, color: 'text-emerald-600', icon: CheckCircle },
            { label: 'Outstanding', val: summaryTotals.totalBalance, color: 'text-rose-600', icon: AlertCircle },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2.5 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200/70 whitespace-nowrap">
              <div className={cn("p-1 rounded-lg bg-white shadow-xs", s.color)}>
                <s.icon className="w-3.5 h-3.5" />
              </div>
              <div className="leading-tight">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
                <p className={cn("text-xs font-black", s.color)}>Rs. {s.val.toLocaleString()}</p>
              </div>
            </div>
          ))}
          <div className="h-8 w-px bg-slate-200 mx-1 shrink-0" />
          <Btn variant="outline" size="sm" onClick={handleCSVExport} className="text-xs h-9 px-3">
            <Download className="w-3.5 h-3.5 mr-1" /> CSV
          </Btn>
          <Btn variant="outline" size="sm" onClick={() => window.print()} className="text-xs h-9 px-3">
            <Printer className="w-3.5 h-3.5 mr-1" /> Print
          </Btn>
          <Btn variant="primary" size="sm" onClick={handlePDFExport} className="text-xs h-9 px-3 font-black shadow-sm">
            PDF Register
          </Btn>
        </div>
      </div>

      {/* ── Filters & Display Mode Selector Bar ── */}
      <Card className="p-3 shadow-sm border-slate-200/80 no-print space-y-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-center">
          
          {/* Class Dropdown (With "All Classes" option) */}
          <div className="lg:col-span-3">
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Select Class / Scope
            </label>
            <select
              value={selectedClassId}
              onChange={e => setSelectedClassId(e.target.value)}
              className="w-full px-3 py-2 text-xs font-black bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">🌟 All Classes (School-Wide Matrix)</option>
              <optgroup label="Individual Classes">
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.section}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Start Month */}
          <div className="lg:col-span-2">
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
              From Month
            </label>
            <input
              type="month"
              value={startMonth}
              onChange={e => setStartMonth(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* End Month */}
          <div className="lg:col-span-2">
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
              To Month
            </label>
            <input
              type="month"
              value={endMonth}
              onChange={e => setEndMonth(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Search Student */}
          <div className="lg:col-span-3">
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Search Student
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Name, roll, adm, class..."
                className="w-full pl-8 pr-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="lg:col-span-2">
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Cell Values
            </label>
            <div className="bg-slate-100 p-0.5 rounded-xl flex gap-0.5 border border-slate-200">
              <button
                onClick={() => setDisplayMode('amount')}
                className={cn(
                  'flex-1 py-1 rounded-lg text-[10px] font-black uppercase transition-all',
                  displayMode === 'amount' ? 'bg-white shadow-xs text-indigo-700' : 'text-slate-500'
                )}
                title="Show amount paid"
              >
                Paid (Rs.)
              </button>
              <button
                onClick={() => setDisplayMode('status')}
                className={cn(
                  'flex-1 py-1 rounded-lg text-[10px] font-black uppercase transition-all',
                  displayMode === 'status' ? 'bg-white shadow-xs text-indigo-700' : 'text-slate-500'
                )}
                title="Show payment status"
              >
                Status
              </button>
              <button
                onClick={() => setDisplayMode('balance')}
                className={cn(
                  'flex-1 py-1 rounded-lg text-[10px] font-black uppercase transition-all',
                  displayMode === 'balance' ? 'bg-white shadow-xs text-indigo-700' : 'text-slate-500'
                )}
                title="Show unpaid balance"
              >
                Balance
              </button>
            </div>
          </div>

        </div>

        {/* Quick Month Presets Bar */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-xs">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
            <Clock className="w-3 h-3 text-indigo-500" /> Quick Presets:
          </span>
          <button
            onClick={() => applyPreset('this_year')}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[10px]"
          >
            Full Year {currentYear} (Jan–Dec)
          </button>
          <button
            onClick={() => applyPreset('apr_mar')}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[10px]"
          >
            Academic Year (Apr–Mar)
          </button>
          <button
            onClick={() => applyPreset('q1')}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[10px]"
          >
            Q1 (Jan–Mar)
          </button>
          <button
            onClick={() => applyPreset('q2')}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[10px]"
          >
            Q2 (Apr–Jun)
          </button>
          <button
            onClick={() => applyPreset('last_year')}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[10px]"
          >
            Previous Year ({currentYear - 1})
          </button>

          <span className="ml-auto text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
            Showing {monthsList.length} Months ({startMonth} → {endMonth})
          </span>
        </div>
      </Card>

      {/* ── Printable Header (Only on Paper Print) ── */}
      <div className="hidden print:flex flex-col items-center justify-center p-6 border-b-2 border-slate-200 mb-6 text-center">
        {schoolInfo?.logo_url && (
          <img src={schoolInfo.logo_url} className="w-16 h-16 object-contain mb-2" alt="Logo" />
        )}
        <h2 className="text-2xl font-black uppercase tracking-widest text-[#0d1526]">{schoolInfo?.name || 'School Fee Register'}</h2>
        <p className="text-xs text-slate-500 font-bold">{schoolInfo?.address || ''}</p>
        <div className="mt-3 px-4 py-1 bg-slate-100 rounded-full border border-slate-300 inline-block">
          <span className="text-xs font-black uppercase text-slate-800">
            Scope: {scopeTitle} · Fee Matrix Register ({startMonth} to {endMonth})
          </span>
        </div>
      </div>

      {/* ── High-Density Multi-Month Matrix Table ── */}
      <Card className="shadow-sm border-slate-200/80 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-4">Generating Fee Matrix…</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Table2 className="w-12 h-12 text-slate-200 mb-3" />
            <h3 className="text-sm font-black text-slate-500 uppercase">No Students Found</h3>
            <p className="text-xs text-slate-400 mt-1">Please select another class or adjust your search query.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse min-w-[1200px]">
              <thead className="bg-[#0d1526] sticky top-0 z-20 text-white">
                <tr>
                  <th className="px-3 py-3 font-black text-slate-400 uppercase tracking-wider text-[10px] w-10 text-center">#</th>
                  <th className="px-3 py-3 font-black text-slate-400 uppercase tracking-wider text-[10px] w-14">Adm</th>
                  <th className="px-3 py-3 font-black text-slate-400 uppercase tracking-wider text-[10px] w-12 text-center">Roll</th>
                  {selectedClassId === 'all' && (
                    <th className="px-3 py-3 font-black text-slate-300 uppercase tracking-wider text-[10px] min-w-[90px]">Class</th>
                  )}
                  <th className="px-3 py-3 font-black text-slate-400 uppercase tracking-wider text-[10px] min-w-[150px]">Student Name</th>
                  
                  {/* Monthly Column Headers */}
                  {monthsList.map(m => (
                    <th key={m.key} className="px-2 py-3 font-black text-slate-300 uppercase tracking-wider text-[10px] text-center border-l border-slate-800 whitespace-nowrap">
                      {m.shortLabel}
                    </th>
                  ))}

                  {/* Summary Columns */}
                  <th className="px-3 py-3 font-black text-slate-400 uppercase tracking-wider text-[10px] text-right border-l border-slate-700 bg-[#0a101f]">Invoiced</th>
                  <th className="px-3 py-3 font-black text-emerald-400 uppercase tracking-wider text-[10px] text-right bg-[#0a101f]">Paid</th>
                  <th className="px-3 py-3 font-black text-rose-400 uppercase tracking-wider text-[10px] text-right bg-[#0a101f]">Balance</th>
                  <th className="px-3 py-3 font-black text-indigo-400 uppercase tracking-wider text-[10px] text-center bg-[#0a101f]">Rate</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((r, i) => (
                  <tr key={r.student.id} className="hover:bg-indigo-50/40 transition-colors even:bg-slate-50/50">
                    <td className="px-3 py-2 text-center font-bold text-slate-400 text-[10px]">{i + 1}</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-slate-500 font-bold">{r.student.student_unique_id}</td>
                    <td className="px-3 py-2 text-center font-bold text-slate-700">{r.student.roll_number}</td>
                    {selectedClassId === 'all' && (
                      <td className="px-3 py-2 font-black text-indigo-600 uppercase text-[10px] whitespace-nowrap">
                        {r.student.class_name}
                      </td>
                    )}
                    <td className="px-3 py-2 font-black text-slate-900 uppercase truncate max-w-[180px]" title={r.student.full_name}>
                      {r.student.full_name}
                      <span className="block text-[9px] font-normal text-slate-400 truncate">
                        S/D/O {r.student.father_name}
                      </span>
                    </td>

                    {/* Dynamic Month Cells */}
                    {monthsList.map(m => {
                      const cell = r.months[m.key];
                      if (!cell || cell.status === 'none') {
                        return (
                          <td key={m.key} className="px-2 py-2 text-center text-slate-300 font-bold border-l border-slate-100">
                            —
                          </td>
                        );
                      }

                      if (displayMode === 'amount') {
                        return (
                          <td key={m.key} className="px-2 py-2 text-center font-mono text-[11px] font-bold border-l border-slate-100">
                            {cell.status === 'paid' ? (
                              <span className="text-emerald-600 bg-emerald-50/80 px-1.5 py-0.5 rounded">
                                {cell.paid_amount.toLocaleString()}
                              </span>
                            ) : cell.status === 'partial' ? (
                              <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded" title={`Paid: ${cell.paid_amount} / Due: ${cell.total_amount}`}>
                                {cell.paid_amount.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-rose-600 bg-rose-50/80 px-1.5 py-0.5 rounded">
                                0
                              </span>
                            )}
                          </td>
                        );
                      }

                      if (displayMode === 'status') {
                        return (
                          <td key={m.key} className="px-2 py-2 text-center border-l border-slate-100">
                            {cell.status === 'paid' ? (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700">
                                Paid
                              </span>
                            ) : cell.status === 'partial' ? (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-amber-100 text-amber-700">
                                Partial
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-rose-100 text-rose-700">
                                Due
                              </span>
                            )}
                          </td>
                        );
                      }

                      // Balance Mode
                      return (
                        <td key={m.key} className="px-2 py-2 text-center font-mono text-[11px] font-bold border-l border-slate-100">
                          {cell.balance > 0 ? (
                            <span className="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                              {cell.balance.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-emerald-600">0</span>
                          )}
                        </td>
                      );
                    })}

                    {/* Summary Totals */}
                    <td className="px-3 py-2 text-right font-mono font-bold text-slate-700 border-l border-slate-200 bg-slate-50/40">
                      {r.totalInvoiced.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-black text-emerald-600 bg-slate-50/40">
                      {r.totalPaid.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-black text-rose-600 bg-slate-50/40">
                      {r.totalBalance > 0 ? r.totalBalance.toLocaleString() : '0'}
                    </td>
                    <td className="px-3 py-2 text-center font-black text-[10px] bg-slate-50/40">
                      <span className={cn(
                        'px-1.5 py-0.5 rounded font-black',
                        r.collectionRate >= 90 ? 'text-emerald-700 bg-emerald-100' :
                        r.collectionRate >= 60 ? 'text-amber-700 bg-amber-100' : 'text-rose-700 bg-rose-100'
                      )}>
                        {r.collectionRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* ── Footer Summary: Monthly Collections ── */}
              <tfoot className="bg-[#0d1526] text-white font-black text-[11px]">
                <tr>
                  <td colSpan={selectedClassId === 'all' ? 5 : 4} className="px-4 py-3 uppercase tracking-widest text-slate-400">
                    TOTAL ({filteredRows.length} Students)
                  </td>

                  {/* Monthly Collections */}
                  {monthsList.map(m => {
                    const col = summaryTotals.monthTotals[m.key]?.collected || 0;
                    return (
                      <td key={m.key} className="px-2 py-3 text-center font-mono font-black text-emerald-400 border-l border-slate-800 text-[10px]">
                        {col > 0 ? col.toLocaleString() : '0'}
                      </td>
                    );
                  })}

                  <td className="px-3 py-3 text-right font-mono border-l border-slate-700 bg-[#0a101f]">
                    Rs. {summaryTotals.totalInvoiced.toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-emerald-400 bg-[#0a101f]">
                    Rs. {summaryTotals.totalCollected.toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-rose-400 bg-[#0a101f]">
                    Rs. {summaryTotals.totalBalance.toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-center font-mono text-indigo-300 bg-[#0a101f]">
                    {summaryTotals.overallRate}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
