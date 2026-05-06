import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  FileText,
  Users,
  ArrowDownCircle,
  ArrowUpCircle,
  Wallet,
  Calendar,
  Download,
  Search,
  ChevronRight,
  Printer,
  FileDown,
  BarChart3,
  PieChart,
  LayoutGrid,
  List,
  TrendingUp,
  Activity,
  CreditCard,
  Trash2,
} from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';
import { formatDate, formatDateTime, cn, getBase64Image } from '../../lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Card, Btn, Select, Input } from '../../components/ui';

interface ReportData {
  admissions: any[];
  income: any[];
  expenses: any[];
}

export default function MasterSummaryReport() {
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dateType, setDateType] = useState('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [data, setData] = useState<ReportData>({ admissions: [], income: [], expenses: [] });
  const [mtdIncome, setMtdIncome]   = useState(0);
  const [mtdExpenses, setMtdExpenses] = useState(0);
  const [mtdLabel, setMtdLabel]     = useState('');
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'admissions' | 'income' | 'expenses'>('admissions');
  const [viewType, setViewType] = useState<'table' | 'grid'>('table');

  const fetchData = useCallback(async () => {
    if (!userRole?.school_id) return;
    setLoading(true);
    const sid = userRole.school_id;

    let startDate: string;
    let endDate: string = new Date().toISOString().split('T')[0];
    const today = new Date();

    if (dateType === 'today') {
      startDate = endDate;
    } else if (dateType === 'week') {
      const lastWeek = new Date();
      lastWeek.setDate(today.getDate() - 7);
      startDate = lastWeek.toISOString().split('T')[0];
    } else if (dateType === 'month') {
      startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    } else if (dateType === 'custom') {
      // Allow partial range: if only start is set, end defaults to today
      startDate = customStart || endDate;
      if (customEnd) endDate = customEnd;
    } else {
      startDate = endDate;
    }

    // Month-to-date range (always 1st of current month → today)
    const todayStr = new Date().toISOString().split('T')[0];
    const mtdStart = `${todayStr.slice(0, 7)}-01`;

    try {
      const [
        { data: admissions },
        { data: transactions },
        { data: school },
        { data: mtdTxns },
      ] = await Promise.all([
        supabase.from('students')
          .select('*, classes(name)')
          .eq('school_id', sid)
          .gte('admission_date', startDate)
          .lte('admission_date', endDate)
          .order('admission_date', { ascending: false }),
        supabase.from('financial_transactions')
          .select('*')
          .eq('school_id', sid)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: false }),
        supabase.from('schools').select('*').eq('id', sid).single(),
        supabase.from('financial_transactions')
          .select('amount, type')
          .eq('school_id', sid)
          .gte('date', mtdStart)
          .lte('date', todayStr),
      ]);

      const income = (transactions || []).filter(t => t.type === 'income');
      const expenses = (transactions || []).filter(t => t.type === 'expense');

      setData({
        admissions: admissions || [],
        income: income || [],
        expenses: expenses || []
      });
      setSchoolInfo(school);

      // MTD totals
      const mtdInc = (mtdTxns || []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
      const mtdExp = (mtdTxns || []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
      setMtdIncome(mtdInc);
      setMtdExpenses(mtdExp);
      setMtdLabel(`${mtdStart} → ${todayStr}`);
    } catch (err) {
      console.error('Error fetching report data:', err);
    } finally {
      setLoading(false);
    }
  }, [userRole?.school_id, dateType, customStart, customEnd]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDeleteTx = async (row: any) => {
    const label = row.category || row.description || 'transaction';
    if (!window.confirm(`Delete this ${row.type} entry?\n"${label}" — Rs. ${Number(row.amount).toLocaleString()}\n\nThis cannot be undone.`)) return;
    const { error } = await supabase.from('financial_transactions').delete().eq('id', row.id);
    if (error) { alert(error.message); return; }
    fetchData();
  };

  const totalIncome = data.income.reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpenses = data.expenses.reduce((sum, t) => sum + Number(t.amount), 0);
  const netCashflow = totalIncome - totalExpenses;

  // Cash vs Online/Bank split
  const isCash = (mode: string | null) => !mode || mode.toLowerCase() === 'cash';
  const cashIncome   = data.income.filter(t => isCash(t.payment_mode)).reduce((s, t) => s + Number(t.amount), 0);
  const onlineIncome = data.income.filter(t => !isCash(t.payment_mode)).reduce((s, t) => s + Number(t.amount), 0);

  // Breakdown fee income by category/line-item
  const feeItemTotals = data.income
    .filter(t => t.category === 'Fee Collection' && t.remarks?.includes('—'))
    .reduce((acc: any[], t) => {
      const parts = t.remarks.split('—');
      const itemsPart = parts[parts.length - 1];
      const items = itemsPart.split(',').map((s: string) => s.trim());
      
      items.forEach((itemStr: string) => {
        const [name, amtStr] = itemStr.split(':').map(s => s.trim());
        if (!name || !amtStr) return;
        const amt = parseFloat(amtStr.replace(/[^\d.]/g, ''));
        if (isNaN(amt)) return;
        
        const existing = acc.find(x => x.item === name);
        if (existing) existing.amount += amt;
        else acc.push({ item: name, amount: amt });
      });
      return acc;
    }, [])
    .sort((a, b) => b.amount - a.amount);

  const handleExportPDF = async () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;
    const margin = 14;

    // Logo
    if (schoolInfo?.logo_url) {
      try {
        const logoBase64 = await getBase64Image(schoolInfo.logo_url);
        doc.addImage(logoBase64, 'PNG', margin, 10, 22, 22);
      } catch (err) { console.warn(err); }
    }

    // School name & address
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(schoolInfo?.name || 'Executive Summary', pageWidth / 2, 18, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(schoolInfo?.address || '', pageWidth / 2, 24, { align: 'center' });

    // Report title
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Master Executive Summary Report', pageWidth / 2, 34, { align: 'center' });

    // Period line
    const periodLabel = dateType === 'custom'
      ? `${customStart}${customEnd ? ` to ${customEnd}` : ''}`
      : dateType.toUpperCase();
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Period: ${periodLabel}`, margin, 41);
    doc.text(`Generated: ${formatDateTime(new Date())}`, pageWidth - margin, 41, { align: 'right' });

    // KPI summary box — two rows to avoid overlap
    const boxY = 44;
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, boxY, pageWidth - margin * 2, 22, 'F');
    doc.setDrawColor(220, 220, 230);
    doc.rect(margin, boxY, pageWidth - margin * 2, 22);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('KEY PERFORMANCE INDICATORS', margin + 3, boxY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const col = (pageWidth - margin * 2) / 4;
    const kpiY = boxY + 15;
    [
      { label: 'New Admissions', val: String(data.admissions.length) },
      { label: 'Total Income', val: `Rs. ${totalIncome.toLocaleString()}` },
      { label: 'Total Expenses', val: `Rs. ${totalExpenses.toLocaleString()}` },
      { label: 'Net Cashflow', val: `Rs. ${netCashflow.toLocaleString()}` },
    ].forEach(({ label, val }, i) => {
      const x = margin + 3 + i * col;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(label, x, kpiY - 5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(i === 3 ? 37 : i === 1 ? 16 : i === 2 ? 220 : 30, i === 1 ? 163 : 30, i === 1 ? 70 : 30);
      doc.text(val, x, kpiY);
    });
    doc.setTextColor(0, 0, 0);

    let currentY = boxY + 28;

    // ── Helper: render one section ──────────────────────────────────────
    const renderSection = (title: string, rows: any[], isTransaction: boolean) => {
      if (rows.length === 0) return;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setFillColor(13, 21, 38);
      doc.setTextColor(255, 255, 255);
      doc.rect(margin, currentY, pageWidth - margin * 2, 7, 'F');
      doc.text(`  ${title} (${rows.length} records)`, margin + 2, currentY + 5);
      doc.setTextColor(0, 0, 0);
      currentY += 9;

      if (isTransaction) {
        autoTable(doc, {
          startY: currentY,
          head: [['#', 'Date', 'Category', 'Description / Remarks', 'Mode', 'Amount']],
          body: rows.map((r, i) => [
            i + 1,
            formatDate(r.date),
            r.category || '—',
            r.remarks || '—',
            r.payment_mode || '—',
            `Rs. ${Number(r.amount).toLocaleString()}`,
          ]),
          theme: 'grid',
          headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 7, fontStyle: 'bold' },
          styles: { fontSize: 7.5, cellPadding: 2 },
          columnStyles: {
            0: { cellWidth: 8, halign: 'center' },
            1: { cellWidth: 22 },
            2: { cellWidth: 35 },
            3: { cellWidth: 'auto' },
            4: { cellWidth: 22 },
            5: { cellWidth: 28, halign: 'right' },
          },
          margin: { left: margin, right: margin },
        });
      } else {
        autoTable(doc, {
          startY: currentY,
          head: [['#', 'Student Name', 'Roll #', 'Class', 'Admission Date']],
          body: rows.map((r, i) => [i + 1, r.full_name, r.roll_number, r.classes?.name || '—', formatDate(r.admission_date)]),
          theme: 'grid',
          headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 7, fontStyle: 'bold' },
          styles: { fontSize: 7.5, cellPadding: 2 },
          margin: { left: margin, right: margin },
        });
      }

      currentY = (doc as any).lastAutoTable.finalY + 8;
    };

    // Income summary footer row
    const renderTotal = (label: string, amount: number, color: [number, number, number]) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...color);
      doc.text(`${label}: Rs. ${amount.toLocaleString()}`, pageWidth - margin, currentY, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      currentY += 5;
    };

    renderSection('Income Transactions', data.income, true);
    renderTotal('Total Income', totalIncome, [16, 163, 70]);

    renderSection('Expense Transactions', data.expenses, true);
    renderTotal('Total Expenses', totalExpenses, [220, 38, 38]);
    renderTotal('Net Cashflow', netCashflow, netCashflow >= 0 ? [16, 163, 70] : [220, 38, 38]);

    if (data.admissions.length > 0) {
      currentY += 3;
      renderSection('New Enrollments', data.admissions, false);
    }

    // ── Period Closing Calculation ────────────────────────────────────────
    // Ensure we have room; add new page if needed
    if (currentY > doc.internal.pageSize.height - 80) {
      doc.addPage();
      currentY = 14;
    } else {
      currentY += 6;
    }

    // Section header bar
    doc.setFillColor(15, 23, 42); // slate-900
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.rect(margin, currentY, pageWidth - margin * 2, 8, 'F');
    doc.text('  PERIOD CLOSING CALCULATION', margin + 2, currentY + 5.5);
    doc.setTextColor(0, 0, 0);
    currentY += 11;

    const halfW = (pageWidth - margin * 2) / 2 - 3;
    const leftX  = margin;
    const rightX = margin + halfW + 6;

    // Draw left panel background
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(leftX, currentY, halfW, 72, 2, 2, 'FD');

    // Draw right panel background
    doc.roundedRect(rightX, currentY, halfW, 72, 2, 2, 'FD');

    // ── Left: Financial Summary ───────────────────────────────────────────
    let ly = currentY + 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text('FINANCIAL SUMMARY — SELECTED PERIOD', leftX + 4, ly);
    ly += 6;

    // Row helper
    const drawRow = (label: string, value: string, color: [number,number,number], bold = false) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(label, leftX + 4, ly);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...color);
      doc.text(value, leftX + halfW - 4, ly, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      ly += 6;
    };

    drawRow('Total Income', `Rs. ${totalIncome.toLocaleString()}`, [16, 163, 70]);
    drawRow('Total Expenses', `Rs. ${totalExpenses.toLocaleString()}`, [220, 38, 38]);

    // Net cashflow highlight
    doc.setFillColor(netCashflow >= 0 ? 240 : 255, netCashflow >= 0 ? 253 : 241, netCashflow >= 0 ? 244 : 242);
    doc.rect(leftX + 3, ly - 4, halfW - 6, 8, 'F');
    drawRow('Net Cashflow', `Rs. ${netCashflow.toLocaleString()}`, netCashflow >= 0 ? [16,163,70] : [220,38,38], true);
    ly += 2;

    // Dashed divider
    doc.setDrawColor(148, 163, 184);
    (doc as any).setLineDash([1.5, 1.5]);
    doc.line(leftX + 4, ly, leftX + halfW - 4, ly);
    (doc as any).setLineDash([]);
    ly += 5;

    // MTD subsection
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(14, 165, 233); // sky-500
    doc.text(`MONTH-TO-DATE  ${mtdLabel}`, leftX + 4, ly);
    ly += 5;

    const drawMtdRow = (label: string, value: string, color: [number,number,number]) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(label, leftX + 4, ly);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...color);
      doc.text(value, leftX + halfW - 4, ly, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      ly += 5.5;
    };

    const mtdNet = mtdIncome - mtdExpenses;
    drawMtdRow('Income (MTD)',   `Rs. ${mtdIncome.toLocaleString()}`,    [16, 163, 70]);
    drawMtdRow('Expenses (MTD)', `Rs. ${mtdExpenses.toLocaleString()}`,  [220, 38, 38]);
    doc.setFillColor(239, 246, 255);
    doc.rect(leftX + 3, ly - 4, halfW - 6, 7, 'F');
    drawMtdRow('Net (MTD)',      `Rs. ${mtdNet.toLocaleString()}`,        mtdNet >= 0 ? [16,163,70] : [220,38,38]);

    // ── Right: Payment Mode ───────────────────────────────────────────────
    let ry = currentY + 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('INCOME BY PAYMENT MODE', rightX + 4, ry);
    ry += 8;

    // Cash card
    const cashPct = totalIncome > 0 ? Math.round((cashIncome / totalIncome) * 100) : 0;
    doc.setFillColor(236, 253, 245); // emerald-50
    doc.setDrawColor(167, 243, 208); // emerald-200
    doc.roundedRect(rightX + 3, ry, halfW - 6, 24, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(4, 120, 87); // emerald-700
    doc.text('CASH IN HAND', rightX + 7, ry + 6);
    doc.setFontSize(7);
    doc.setTextColor(16, 185, 129); // emerald-500
    doc.text('→ Accountant', rightX + 7, ry + 11);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(4, 120, 87);
    doc.text(`Rs. ${cashIncome.toLocaleString()}`, rightX + halfW - 7, ry + 9, { align: 'right' });
    // Progress bar track
    doc.setFillColor(167, 243, 208);
    doc.roundedRect(rightX + 7, ry + 15, halfW - 18, 2.5, 1, 1, 'F');
    // Progress fill
    if (cashPct > 0) {
      doc.setFillColor(16, 185, 129);
      doc.roundedRect(rightX + 7, ry + 15, Math.max((halfW - 18) * cashPct / 100, 1), 2.5, 1, 1, 'F');
    }
    doc.setFontSize(6.5);
    doc.setTextColor(16, 185, 129);
    doc.text(`${cashPct}% of total income`, rightX + halfW - 7, ry + 21.5, { align: 'right' });
    ry += 28;

    // Online / Bank card
    const onlinePct = totalIncome > 0 ? Math.round((onlineIncome / totalIncome) * 100) : 0;
    doc.setFillColor(238, 242, 255); // indigo-50
    doc.setDrawColor(199, 210, 254); // indigo-200
    doc.roundedRect(rightX + 3, ry, halfW - 6, 24, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(67, 56, 202); // indigo-700
    doc.text('ONLINE / BANK', rightX + 7, ry + 6);
    doc.setFontSize(7);
    doc.setTextColor(99, 102, 241); // indigo-500
    doc.text('→ Director', rightX + 7, ry + 11);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(67, 56, 202);
    doc.text(`Rs. ${onlineIncome.toLocaleString()}`, rightX + halfW - 7, ry + 9, { align: 'right' });
    // Progress bar track
    doc.setFillColor(199, 210, 254);
    doc.roundedRect(rightX + 7, ry + 15, halfW - 18, 2.5, 1, 1, 'F');
    // Progress fill
    if (onlinePct > 0) {
      doc.setFillColor(99, 102, 241);
      doc.roundedRect(rightX + 7, ry + 15, Math.max((halfW - 18) * onlinePct / 100, 1), 2.5, 1, 1, 'F');
    }
    doc.setFontSize(6.5);
    doc.setTextColor(99, 102, 241);
    doc.text(`${onlinePct}% of total income`, rightX + halfW - 7, ry + 21.5, { align: 'right' });

    doc.setTextColor(0, 0, 0);
    doc.save(`Executive_Summary_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleExportCSV = () => {
    const exportData = activeTab === 'admissions' ? data.admissions : activeTab === 'income' ? data.income : data.expenses;
    const title = `master-${activeTab}-report`;
    const headers = activeTab === 'admissions' 
      ? [ { header: 'Name', key: 'full_name' }, { header: 'Roll', key: 'roll_number' }, { header: 'Class', key: (row: any) => row.classes?.name || '—' }, { header: 'Date', key: 'admission_date' } ]
      : [ { header: 'Date', key: 'date' }, { header: 'Category', key: 'category' }, { header: 'Amount', key: (row: any) => row.amount }, { header: 'Mode', key: 'payment_mode' }, { header: 'Remarks', key: 'remarks' } ];
    exportToCSV(title, exportData, headers);
  };

  const kpis = [
    { label: 'New Admissions', value: data.admissions.length, icon: Users, color: 'indigo', sub: 'Total students enrolled' },
    { label: 'Total Income', value: `Rs. ${totalIncome.toLocaleString()}`, icon: ArrowDownCircle, color: 'emerald', sub: 'Revenue from all sources' },
    { label: 'Total Expenses', value: `Rs. ${totalExpenses.toLocaleString()}`, icon: ArrowUpCircle, color: 'rose', sub: 'Operational & fixed costs' },
    { label: 'Net Cashflow', value: `Rs. ${netCashflow.toLocaleString()}`, icon: Wallet, color: 'blue', sub: 'Available liquidity', highlight: true },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 space-y-3">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #master-summary-print, #master-summary-print * { visibility: visible !important; }
          #master-summary-print { position: absolute; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
          @page { size: A4 portrait; margin: 10mm; }
        }
      `}</style>
      {/* Control Bar */}
      <div className="no-print flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900 uppercase tracking-tight">Executive Summary</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-0.5">Cross-Domain Analytics</p>
          </div>
        </div>

        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
          <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            {[
              { id: 'today', label: 'Today' },
              { id: 'week', label: '7D' },
              { id: 'month', label: '1M' },
              { id: 'custom', label: 'Custom' }
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => setDateType(opt.id)}
                className={cn(
                  "px-3 py-1.5 text-[10px] font-black rounded-lg transition-all uppercase tracking-tighter",
                  dateType === opt.id ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          
          <div className="h-8 w-px bg-slate-200 mx-1 shrink-0" />
          
          <div className="flex items-center gap-2 shrink-0">
            <Btn variant="outline" size="sm" onClick={() => window.print()} className="text-[10px] h-9 px-3">
               <Printer className="w-3.5 h-3.5 mr-1" /> PRINT
            </Btn>
            <Btn variant="primary" size="sm" onClick={handleExportPDF} className="bg-indigo-600 hover:bg-indigo-700 text-[10px] h-9 px-3 font-black uppercase tracking-tighter">
               <FileDown className="w-3.5 h-3.5 mr-1" /> PDF SUMMARY
            </Btn>
          </div>
        </div>
      </div>

      {/* Custom Date Range (Conditional) */}
      {dateType === 'custom' && (
        <Card className="no-print p-2 border-slate-100 animate-in fade-in slide-in-from-top-2">
           <div className="flex flex-wrap items-center gap-3 px-2">
              <Calendar className="w-4 h-4 text-indigo-500 shrink-0" />
              <div className="flex items-center gap-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">From</label>
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                  className="text-xs font-bold border border-slate-200 bg-slate-50 rounded-lg px-3 py-1.5 outline-none focus:border-indigo-400" />
              </div>
              <span className="text-[10px] font-black text-slate-300 uppercase">→</span>
              <div className="flex items-center gap-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">To</label>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                  className="text-xs font-bold border border-slate-200 bg-slate-50 rounded-lg px-3 py-1.5 outline-none focus:border-indigo-400" />
              </div>
              {customStart && !customEnd && (
                <span className="text-[9px] font-bold text-amber-500 bg-amber-50 px-2 py-1 rounded-lg">
                  End date not set — showing up to today
                </span>
              )}
              <Btn variant="ghost" size="xs" onClick={() => { setCustomStart(''); setCustomEnd(''); }}
                className="text-[9px] font-black text-slate-400 hover:text-rose-500">CLEAR</Btn>
           </div>
        </Card>
      )}

      {/* ── Printable content starts here ── */}
      <div id="master-summary-print" className="space-y-3">

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((kpi, i) => (
          <div 
            key={i} 
            className={cn(
              "bg-white rounded-2xl p-4 border transition-all relative overflow-hidden",
              kpi.highlight ? "border-indigo-600 shadow-md shadow-indigo-50" : "border-slate-100 shadow-sm"
            )}
          >
            <div className="flex justify-between items-start mb-2">
               <div className={cn("p-2 rounded-lg", 
                 kpi.color === 'indigo' ? "bg-indigo-50 text-indigo-600" :
                 kpi.color === 'emerald' ? "bg-emerald-50 text-emerald-600" :
                 kpi.color === 'rose' ? "bg-rose-50 text-rose-600" : "bg-blue-50 text-blue-600"
               )}>
                 <kpi.icon className="w-4 h-4" />
               </div>
               <Activity className="w-3 h-3 text-slate-200" />
            </div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{kpi.label}</p>
            <h3 className={cn("text-xl font-black tracking-tight", 
               kpi.color === 'emerald' ? "text-emerald-600" : 
               kpi.color === 'rose' ? "text-rose-600" : "text-slate-900"
            )}>{kpi.value}</h3>
            <p className="text-[9px] font-bold text-slate-400 mt-0.5 italic">{kpi.sub}</p>
            {kpi.highlight && <div className="absolute top-0 right-0 w-8 h-8 bg-indigo-600 transform rotate-45 translate-x-4 -translate-y-4 shadow-sm" />}
          </div>
        ))}
      </div>

      {/* Fee Income Breakdown */}
      {feeItemTotals.length > 0 && (
        <Card className="p-4 border-slate-100 shadow-sm">
           <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Revenue Breakdown</h3>
                <p className="text-[10px] text-slate-400 font-medium">Line-item analytics from collected fees</p>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full">
                 <TrendingUp className="w-3 h-3" />
                 <span className="text-[10px] font-black">{feeItemTotals.length} Categories</span>
              </div>
           </div>
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {feeItemTotals.slice(0, 8).map(({ item, amount }) => {
                const pct = totalIncome > 0 ? Math.round((amount / totalIncome) * 100) : 0;
                return (
                  <div key={item} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold text-slate-600 truncate mr-2">{item}</span>
                      <span className="text-[10px] font-black text-indigo-600 whitespace-nowrap">Rs. {amount.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1">
                      <div className="bg-indigo-500 h-1 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>
                );
              })}
           </div>
        </Card>
      )}

      {/* Main Content Area */}
      <Card className="overflow-hidden border-slate-100 shadow-sm">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
           <div className="flex bg-slate-200/50 p-0.5 rounded-xl">
             {[
               { id: 'admissions', label: 'Enrollments', count: data.admissions.length, icon: Users },
               { id: 'income', label: 'Income', count: data.income.length, icon: ArrowDownCircle },
               { id: 'expenses', label: 'Expenses', count: data.expenses.length, icon: ArrowUpCircle }
             ].map(tab => (
               <button
                 key={tab.id}
                 onClick={() => setActiveTab(tab.id as any)}
                 className={cn(
                   "px-4 py-1.5 text-[10px] font-black rounded-lg transition-all flex items-center gap-2 uppercase tracking-tighter",
                   activeTab === tab.id ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                 )}
               >
                 <tab.icon className="w-3 h-3" />
                 {tab.label}
                 <span className={cn(
                   "px-1.5 py-0.5 rounded-md text-[8px] font-black",
                   activeTab === tab.id ? "bg-indigo-100 text-indigo-600" : "bg-slate-300/50 text-slate-500"
                 )}>
                   {tab.count}
                 </span>
               </button>
             ))}
           </div>

           <div className="flex items-center gap-2">
             <div className="flex bg-slate-100 p-0.5 rounded-lg mr-2">
                <button onClick={() => setViewType('table')} className={cn("p-1.5 rounded-md", viewType === 'table' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400")}>
                  <List className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setViewType('grid')} className={cn("p-1.5 rounded-md", viewType === 'grid' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400")}>
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
             </div>
             <Btn variant="outline" size="xs" onClick={handleExportCSV} className="text-[9px] h-7 px-2 font-black uppercase">CSV</Btn>
             <Btn variant="outline" size="xs" onClick={handleExportPDF} className="text-[9px] h-7 px-2 font-black uppercase border-indigo-200 text-indigo-600">PDF</Btn>
           </div>
        </div>

        <div className="min-h-[400px]">
           {loading ? (
             <div className="py-20 text-center">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Compiling Analytics...</p>
             </div>
           ) : (
             <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                   <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                         {activeTab === 'admissions' ? (
                           <>
                             <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Student</th>
                             <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Roll #</th>
                             <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Class</th>
                             <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Admission Date</th>
                           </>
                         ) : (
                           <>
                             <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                             <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                             <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Remarks</th>
                             <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Mode</th>
                             <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                             <th className="px-4 py-3 w-10" />
                           </>
                         )}
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {(activeTab === 'admissions' ? data.admissions : activeTab === 'income' ? data.income : data.expenses).map((row: any) => (
                        <tr key={row.id} className="hover:bg-slate-50 transition-colors group">
                           {activeTab === 'admissions' ? (
                             <>
                               <td className="px-4 py-3 text-xs font-bold text-slate-900 uppercase">{row.full_name}</td>
                               <td className="px-4 py-3 text-xs font-bold text-slate-400">#{row.roll_number}</td>
                               <td className="px-4 py-3"><span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">{row.classes?.name || 'Unassigned'}</span></td>
                               <td className="px-4 py-3 text-xs text-slate-500 font-bold">{formatDate(row.admission_date)}</td>
                             </>
                           ) : (
                             <>
                               <td className="px-4 py-3 text-xs font-bold text-slate-500">{formatDate(row.date)}</td>
                               <td className="px-4 py-3">
                                 <span className={cn(
                                   "px-2 py-0.5 rounded text-[10px] font-black uppercase",
                                   activeTab === 'income' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                                 )}>
                                   {row.category}
                                 </span>
                               </td>
                               <td className="px-4 py-3 text-xs text-slate-400 italic max-w-xs truncate">{row.remarks || '—'}</td>
                               <td className="px-4 py-3 text-[10px] font-black text-slate-300 uppercase">{row.payment_mode}</td>
                               <td className={cn(
                                 "px-4 py-3 text-right text-xs font-black",
                                 activeTab === 'income' ? "text-emerald-600" : "text-rose-600"
                               )}>
                                 Rs. {Number(row.amount).toLocaleString()}
                               </td>
                               <td className="px-2 py-3">
                                 <button
                                   onClick={() => handleDeleteTx(row)}
                                   className="p-1.5 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition opacity-0 group-hover:opacity-100"
                                   title="Delete entry"
                                 >
                                   <Trash2 className="w-3.5 h-3.5" />
                                 </button>
                               </td>
                             </>
                           )}
                        </tr>
                      ))}
                      {(activeTab === 'admissions' ? data.admissions : activeTab === 'income' ? data.income : data.expenses).length === 0 && (
                        <tr><td colSpan={10} className="px-4 py-20 text-center text-slate-300 font-bold text-sm uppercase">No records found for this period.</td></tr>
                      )}
                   </tbody>
                </table>
             </div>
           )}
        </div>
      </Card>

      {/* ── Closing Calculation Summary ────────────────────────────────── */}
      {!loading && (
        <Card className="border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-slate-900 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-slate-400" />
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Period Closing Calculation
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">

            {/* Left: Income & Expense totals */}
            <div className="p-5 space-y-3">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Financial Summary — Selected Period</p>

              <div className="flex justify-between items-center py-2 border-b border-slate-50">
                <span className="text-sm font-bold text-slate-600">Total Income</span>
                <span className="text-sm font-black text-emerald-600">Rs. {totalIncome.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-50">
                <span className="text-sm font-bold text-slate-600">Total Expenses</span>
                <span className="text-sm font-black text-rose-500">Rs. {totalExpenses.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-2.5 rounded-xl px-3 bg-slate-50 mb-2">
                <span className="text-sm font-black text-slate-800">Net Cashflow</span>
                <span className={cn("text-base font-black", netCashflow >= 0 ? "text-emerald-600" : "text-rose-600")}>
                  Rs. {netCashflow.toLocaleString()}
                </span>
              </div>

              {/* Month-to-date divider */}
              <div className="pt-2 border-t border-dashed border-slate-200">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block" />
                  Month-to-Date &nbsp;
                  <span className="font-medium normal-case text-slate-300">{mtdLabel}</span>
                </p>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
                  <span className="text-xs font-bold text-slate-500">Income (MTD)</span>
                  <span className="text-xs font-black text-emerald-600">Rs. {mtdIncome.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
                  <span className="text-xs font-bold text-slate-500">Expenses (MTD)</span>
                  <span className="text-xs font-black text-rose-500">Rs. {mtdExpenses.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-2 rounded-xl px-3 bg-sky-50 mt-1">
                  <span className="text-xs font-black text-sky-800">Net (MTD)</span>
                  <span className={cn("text-sm font-black", (mtdIncome - mtdExpenses) >= 0 ? "text-emerald-600" : "text-rose-600")}>
                    Rs. {(mtdIncome - mtdExpenses).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Cash vs Online split */}
            <div className="p-5 space-y-3">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Income by Payment Mode</p>

              {/* Cash in Hand */}
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-emerald-500 flex items-center justify-center">
                      <Wallet className="w-3 h-3 text-white" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Cash in Hand</p>
                      <p className="text-[9px] text-emerald-500">→ Accountant</p>
                    </div>
                  </div>
                  <span className="text-lg font-black text-emerald-700">Rs. {cashIncome.toLocaleString()}</span>
                </div>
                <div className="w-full bg-emerald-200 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full bg-emerald-500 transition-all"
                    style={{ width: totalIncome > 0 ? `${Math.round((cashIncome / totalIncome) * 100)}%` : '0%' }} />
                </div>
                <p className="text-[9px] text-emerald-500 mt-1 text-right font-bold">
                  {totalIncome > 0 ? `${Math.round((cashIncome / totalIncome) * 100)}%` : '—'} of total income
                </p>
              </div>

              {/* Online / Bank */}
              <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-indigo-500 flex items-center justify-center">
                      <CreditCard className="w-3 h-3 text-white" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">Online / Bank</p>
                      <p className="text-[9px] text-indigo-400">→ Director</p>
                    </div>
                  </div>
                  <span className="text-lg font-black text-indigo-700">Rs. {onlineIncome.toLocaleString()}</span>
                </div>
                <div className="w-full bg-indigo-200 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full bg-indigo-500 transition-all"
                    style={{ width: totalIncome > 0 ? `${Math.round((onlineIncome / totalIncome) * 100)}%` : '0%' }} />
                </div>
                <p className="text-[9px] text-indigo-400 mt-1 text-right font-bold">
                  {totalIncome > 0 ? `${Math.round((onlineIncome / totalIncome) * 100)}%` : '—'} of total income
                </p>
              </div>
            </div>

          </div>
        </Card>
      )}

      </div>{/* end #master-summary-print */}
    </div>
  );
}
