import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Download, TrendingUp, TrendingDown, Scale, Printer, Pencil, X, Save } from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';
import { formatDate } from '../../lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316','#06b6d4','#84cc16'];

type Tab      = 'overview' | 'category' | 'monthly' | 'daily' | 'transactions';
type DateType = 'today' | 'month' | 'year' | 'custom';
type TxFilter = 'all' | 'income' | 'expense';

function fmt(n: number) { return `Rs. ${n.toLocaleString()}`; }
function monthLabel(ym: string) {
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('default', { month: 'short', year: '2-digit' });
}

const BLANK_FORM = { date: '', category: '', amount: '', payment_mode: 'Cash', remarks: '' };

export default function ExpenseReports() {
  const { userRole } = useAuth();
  const startRef   = useRef<HTMLInputElement>(null);
  const endRef     = useRef<HTMLInputElement>(null);
  const editDateRef = useRef<HTMLInputElement>(null);

  // ── Data ──
  const [transactions, setTransactions] = useState<any[]>([]);
  const [expenseHeads, setExpenseHeads] = useState<string[]>([]);
  const [schoolName,   setSchoolName]   = useState('School');
  const [loading,      setLoading]      = useState(true);

  // ── Filters ──
  const [dateType,     setDateType]     = useState<DateType>('month');
  const [customStart,  setCustomStart]  = useState('');
  const [customEnd,    setCustomEnd]    = useState('');
  const [txFilter,     setTxFilter]     = useState<TxFilter>('all');
  const [tab,          setTab]          = useState<Tab>('overview');

  // ── Edit modal ──
  const [editModal,   setEditModal]   = useState<{ isOpen: boolean; tx: any | null }>({ isOpen: false, tx: null });
  const [editForm,    setEditForm]    = useState(BLANK_FORM);
  const [editLoading, setEditLoading] = useState(false);
  const [editError,   setEditError]   = useState('');

  // ── Fetch ──
  useEffect(() => {
    if (!userRole?.school_id) return;
    fetchData();
    supabase.from('schools').select('name').eq('id', userRole.school_id).maybeSingle()
      .then(({ data }) => { if (data) setSchoolName(data.name); });
    supabase.from('expense_heads').select('name').eq('school_id', userRole.school_id).order('name')
      .then(({ data }) => { if (data) setExpenseHeads(data.map(h => h.name)); });
  }, [userRole, dateType, customStart, customEnd]);

  const fetchData = async () => {
    setLoading(true);
    const today    = new Date();
    const todayStr = today.toISOString().split('T')[0];
    let start = '', end = todayStr;

    if      (dateType === 'today')                          { start = todayStr; }
    else if (dateType === 'month')                          { start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]; }
    else if (dateType === 'year')                           { start = `${today.getFullYear()}-01-01`; }
    else if (dateType === 'custom' && customStart && customEnd) { start = customStart; end = customEnd; }

    let query = supabase.from('financial_transactions').select('*')
      .eq('school_id', userRole!.school_id).eq('is_deleted', false)
      .order('date', { ascending: true });
    if (start && end) query = query.gte('date', start).lte('date', end);

    const { data } = await query;
    setTransactions(data || []);
    setLoading(false);
  };

  // ── Display slice (respects global type filter) ──
  const displayTransactions = useMemo(() => {
    if (txFilter === 'all') return transactions;
    return transactions.filter(t => t.type === txFilter);
  }, [transactions, txFilter]);

  const income   = useMemo(() => displayTransactions.filter(t => t.type === 'income'),  [displayTransactions]);
  const expenses = useMemo(() => displayTransactions.filter(t => t.type === 'expense'), [displayTransactions]);

  const totalIncome  = useMemo(() => income.reduce((s, t)   => s + Number(t.amount), 0), [income]);
  const totalExpense = useMemo(() => expenses.reduce((s, t) => s + Number(t.amount), 0), [expenses]);
  const netBalance   = totalIncome - totalExpense;

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(t => { map[t.category] = (map[t.category] || 0) + Number(t.amount); });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [expenses]);

  const monthlyData = useMemo(() => {
    const map: Record<string, { month: string; Income: number; Expense: number }> = {};
    displayTransactions.forEach(t => {
      const m = t.date.substring(0, 7);
      if (!map[m]) map[m] = { month: m, Income: 0, Expense: 0 };
      if (t.type === 'income') map[m].Income += Number(t.amount);
      else                     map[m].Expense += Number(t.amount);
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month))
      .map(r => ({ ...r, month: monthLabel(r.month) }));
  }, [displayTransactions]);

  const dailyData = useMemo(() => {
    const map: Record<string, { date: string; Income: number; Expense: number }> = {};
    displayTransactions.forEach(t => {
      if (!map[t.date]) map[t.date] = { date: t.date, Income: 0, Expense: 0 };
      if (t.type === 'income') map[t.date].Income += Number(t.amount);
      else                     map[t.date].Expense += Number(t.amount);
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [displayTransactions]);

  const filteredTx = useMemo(() => [...displayTransactions].reverse(), [displayTransactions]);

  const topExpCat = categoryData[0];

  // ── Edit handlers ──
  const openEdit = (tx: any) => {
    setEditForm({ date: tx.date, category: tx.category || '', amount: String(tx.amount), payment_mode: tx.payment_mode || 'Cash', remarks: tx.remarks || '' });
    setEditError('');
    setEditModal({ isOpen: true, tx });
  };
  const closeEdit = () => { setEditModal({ isOpen: false, tx: null }); setEditForm(BLANK_FORM); setEditError(''); };

  const handleEditSave = async () => {
    if (!editForm.amount || !editForm.category) return setEditError('Amount and Category are required.');
    setEditLoading(true); setEditError('');
    const { error } = await supabase.from('financial_transactions')
      .update({ date: editForm.date, category: editForm.category, amount: parseFloat(editForm.amount), payment_mode: editForm.payment_mode, remarks: editForm.remarks })
      .eq('id', editModal.tx.id);
    setEditLoading(false);
    if (error) return setEditError(error.message);
    closeEdit();
    fetchData();
  };

  // ── Period label (for PDF / UI) ──
  const periodLabel = () => {
    if (dateType === 'today') return `Today — ${formatDate(new Date().toISOString().split('T')[0])}`;
    if (dateType === 'month') return new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    if (dateType === 'year')  return String(new Date().getFullYear());
    if (customStart && customEnd) return `${formatDate(customStart)} to ${formatDate(customEnd)}`;
    return 'All Dates';
  };

  // ── PDF ──
  const downloadPDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    let y = 15;

    doc.setFillColor(30, 30, 46);
    doc.rect(0, 0, W, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text('Financial Report', 14, 12);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(schoolName, 14, 19);
    doc.text(`Period: ${periodLabel()}  ·  Filter: ${txFilter.toUpperCase()}`, 14, 25);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, W - 14, 25, { align: 'right' });
    y = 38;

    doc.setTextColor(0, 0, 0);
    const boxes = [
      { label: 'Total Income',  value: `Rs. ${totalIncome.toLocaleString()}`,  color: [16, 185, 129] as [number,number,number] },
      { label: 'Total Expense', value: `Rs. ${totalExpense.toLocaleString()}`, color: [239, 68, 68]  as [number,number,number] },
      { label: 'Net Balance',   value: `Rs. ${Math.abs(netBalance).toLocaleString()}${netBalance < 0 ? ' (Deficit)' : ''}`, color: (netBalance >= 0 ? [99, 102, 241] : [249, 115, 22]) as [number,number,number] },
    ];
    const bw = (W - 28) / 3;
    boxes.forEach((b, i) => {
      const bx = 14 + i * (bw + 4);
      doc.setFillColor(248, 250, 252); doc.roundedRect(bx, y, bw, 18, 3, 3, 'F');
      doc.setFillColor(...b.color);    doc.roundedRect(bx, y, 3, 18, 1.5, 1.5, 'F');
      doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139);
      doc.text(b.label.toUpperCase(), bx + 7, y + 6);
      doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...b.color);
      doc.text(b.value, bx + 7, y + 13);
    });
    y += 26;

    if (categoryData.length > 0) {
      if (y > 220) { doc.addPage(); y = 15; }
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 46);
      doc.text('Expense Breakdown by Category', 14, y); y += 4;
      autoTable(doc, {
        startY: y,
        head: [['#', 'Category', 'Amount (Rs.)', '% of Expense']],
        body: categoryData.map((c, i) => [i + 1, c.name, c.value.toLocaleString(), `${((c.value / totalExpense) * 100).toFixed(1)}%`]),
        foot: [['', 'Total', totalExpense.toLocaleString(), '100%']],
        headStyles: { fillColor: [30, 30, 46], fontStyle: 'bold', fontSize: 8 },
        footStyles: { fillColor: [254, 242, 242], textColor: [185, 28, 28], fontStyle: 'bold' },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' } },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    if (monthlyData.length > 0) {
      if (y > 220) { doc.addPage(); y = 15; }
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 46);
      doc.text('Monthly Summary', 14, y); y += 4;
      autoTable(doc, {
        startY: y,
        head: [['Month', 'Income (Rs.)', 'Expense (Rs.)', 'Net (Rs.)']],
        body: monthlyData.map(m => { const net = m.Income - m.Expense; return [m.month, m.Income.toLocaleString(), m.Expense.toLocaleString(), (net < 0 ? '− ' : '') + Math.abs(net).toLocaleString()]; }),
        foot: [['Total', totalIncome.toLocaleString(), totalExpense.toLocaleString(), (netBalance < 0 ? '− ' : '') + Math.abs(netBalance).toLocaleString()]],
        headStyles: { fillColor: [30, 30, 46], fontStyle: 'bold', fontSize: 8 },
        footStyles: { fillColor: [240, 253, 244], textColor: [4, 120, 87], fontStyle: 'bold' },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 1: { halign: 'right', textColor: [4, 120, 87] }, 2: { halign: 'right', textColor: [185, 28, 28] }, 3: { halign: 'right' } },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    if (dailyData.length > 0 && dailyData.length <= 60) {
      if (y > 220) { doc.addPage(); y = 15; }
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 46);
      doc.text('Date-wise Summary', 14, y); y += 4;
      autoTable(doc, {
        startY: y,
        head: [['Date', 'Income (Rs.)', 'Expense (Rs.)', 'Net (Rs.)']],
        body: [...dailyData].reverse().map(d => { const net = d.Income - d.Expense; return [formatDate(d.date), d.Income > 0 ? d.Income.toLocaleString() : '—', d.Expense > 0 ? d.Expense.toLocaleString() : '—', (net < 0 ? '− ' : '') + Math.abs(net).toLocaleString()]; }),
        headStyles: { fillColor: [30, 30, 46], fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 1: { halign: 'right', textColor: [4, 120, 87] }, 2: { halign: 'right', textColor: [185, 28, 28] }, 3: { halign: 'right' } },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    if (filteredTx.length > 0) {
      if (y > 220) { doc.addPage(); y = 15; }
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 46);
      doc.text('Transaction Details', 14, y); y += 4;
      const txReversed = [...filteredTx];
      autoTable(doc, {
        startY: y,
        head: [['Date', 'Type', 'Category', 'Remarks', 'Mode', 'Amount (Rs.)']],
        body: txReversed.map(t => [formatDate(t.date), t.type.toUpperCase(), t.category, t.remarks || '—', t.payment_mode || '—', Number(t.amount).toLocaleString()]),
        headStyles: { fillColor: [30, 30, 46], fontStyle: 'bold', fontSize: 7 },
        bodyStyles: { fontSize: 7 },
        columnStyles: { 1: { cellWidth: 18, fontStyle: 'bold' }, 5: { halign: 'right' } },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 1) data.cell.styles.textColor = data.cell.raw === 'INCOME' ? [4, 120, 87] : [185, 28, 28];
          if (data.section === 'body' && data.column.index === 5) data.cell.styles.textColor = txReversed[data.row.index]?.type === 'income' ? [4, 120, 87] : [185, 28, 28];
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14, right: 14 },
      });
    }

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7); doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'normal');
      doc.text(`${schoolName} · Financial Report · ${periodLabel()}`, 14, doc.internal.pageSize.getHeight() - 8);
      doc.text(`Page ${i} of ${pageCount}`, W - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
    }
    doc.save(`financial-report-${dateType === 'custom' ? `${customStart}-${customEnd}` : dateType}-${Date.now()}.pdf`);
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview',     label: 'Overview' },
    { key: 'category',     label: 'By Category' },
    { key: 'monthly',      label: 'By Month' },
    { key: 'daily',        label: 'By Date' },
    { key: 'transactions', label: 'All Transactions' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-aura-in">

      {/* Header */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight font-display uppercase">Financial Reports</h1>
          <p className="text-slate-500 text-sm font-bold mt-1 opacity-70 uppercase tracking-[0.15em]">Income · Expense · Net Balance Analytics</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={downloadPDF} disabled={loading || displayTransactions.length === 0}
            className="px-6 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-[10px] font-black text-white uppercase tracking-[0.2em] hover:bg-black transition-all shadow-sm flex items-center gap-2 disabled:opacity-40">
            <Printer className="w-4 h-4" /> Download PDF
          </button>
          <button onClick={() => exportToCSV('financial-report', filteredTx, [
            { header: 'Date', key: 'date' }, { header: 'Type', key: 'type' },
            { header: 'Category', key: 'category' }, { header: 'Remarks', key: 'remarks' },
            { header: 'Mode', key: 'payment_mode' }, { header: 'Amount', key: 'amount' },
          ])} className="px-6 py-3 bg-white border border-slate-200 rounded-2xl text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm flex items-center gap-2">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </motion.div>

      {/* Filter Bar — Period + Type */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="aura-card p-5 border-none shadow-xl shadow-slate-200/50 flex flex-wrap items-center gap-3">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Period</span>
        {(['today','month','year','custom'] as DateType[]).map(k => (
          <button key={k} onClick={() => setDateType(k)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${dateType === k ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
            {k === 'today' ? 'Today' : k === 'month' ? 'This Month' : k === 'year' ? 'This Year' : 'Custom'}
          </button>
        ))}
        {dateType === 'custom' && (
          <div className="flex items-center gap-3">
            <div className="relative cursor-pointer" onClick={() => startRef.current?.showPicker()}>
              <input type="text" readOnly value={customStart ? formatDate(customStart) : ''} placeholder="Start Date"
                className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer w-36" />
              <input type="date" ref={startRef} value={customStart} onChange={e => setCustomStart(e.target.value)} className="absolute inset-0 opacity-0 pointer-events-none" />
            </div>
            <span className="text-slate-300 font-black">→</span>
            <div className="relative cursor-pointer" onClick={() => endRef.current?.showPicker()}>
              <input type="text" readOnly value={customEnd ? formatDate(customEnd) : ''} placeholder="End Date"
                className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer w-36" />
              <input type="date" ref={endRef} value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="absolute inset-0 opacity-0 pointer-events-none" />
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="w-px h-6 bg-slate-200 mx-1" />

        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Show</span>
        {(['all','income','expense'] as TxFilter[]).map(f => (
          <button key={f} onClick={() => setTxFilter(f)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              txFilter === f
                ? f === 'income'  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200'
                : f === 'expense' ? 'bg-rose-600 text-white shadow-lg shadow-rose-200'
                :                   'bg-slate-900 text-white shadow-lg'
                : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
            }`}>
            {f}
          </button>
        ))}
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {[
          { label: 'Total Income',  value: totalIncome,  Icon: TrendingUp,  bg: 'bg-emerald-500', shadow: 'shadow-emerald-200', text: 'text-emerald-600' },
          { label: 'Total Expense', value: totalExpense, Icon: TrendingDown, bg: 'bg-rose-500',    shadow: 'shadow-rose-200',    text: 'text-rose-600' },
          { label: 'Net Balance',   value: netBalance,   Icon: Scale,        bg: netBalance >= 0 ? 'bg-indigo-500' : 'bg-orange-500', shadow: netBalance >= 0 ? 'shadow-indigo-200' : 'shadow-orange-200', text: netBalance >= 0 ? 'text-indigo-600' : 'text-orange-600' },
        ].map(({ label, value, Icon, bg, shadow, text }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}
            className="aura-card p-6 border-none shadow-xl shadow-slate-200/50 flex items-center gap-5">
            <div className={`w-12 h-12 ${bg} rounded-2xl flex items-center justify-center shadow-lg ${shadow}`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
              <p className={`text-2xl font-black ${text} tracking-tight mt-0.5`}>Rs. {Math.abs(value).toLocaleString()}</p>
              {label === 'Net Balance' && value < 0 && <p className="text-[9px] font-black text-orange-400 uppercase tracking-widest">Deficit</p>}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tab === t.key ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="aura-card p-20 text-center border-none shadow-xl shadow-slate-200/50">
          <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest animate-pulse">Loading data...</p>
        </div>
      ) : displayTransactions.length === 0 ? (
        <div className="aura-card p-20 text-center border-none shadow-xl shadow-slate-200/50">
          <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">No data for this period / filter.</p>
        </div>
      ) : (
        <>
          {/* ── OVERVIEW ── */}
          {tab === 'overview' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="aura-card p-8 border-none shadow-xl shadow-slate-200/50">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">
                  {txFilter === 'all' ? 'Income vs Expense' : txFilter === 'income' ? 'Income' : 'Expense'} — Monthly
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fontWeight: 700 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }} />
                    <Legend />
                    {txFilter !== 'expense' && <Bar dataKey="Income"  fill="#10b981" radius={[6,6,0,0]} />}
                    {txFilter !== 'income'  && <Bar dataKey="Expense" fill="#ef4444" radius={[6,6,0,0]} />}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="aura-card p-5 border-none shadow-lg shadow-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Transactions</p>
                  <p className="text-2xl font-black text-slate-800 mt-1">{displayTransactions.length}</p>
                </div>
                <div className="aura-card p-5 border-none shadow-lg shadow-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Expense Entries</p>
                  <p className="text-2xl font-black text-rose-600 mt-1">{expenses.length}</p>
                </div>
                <div className="aura-card p-5 border-none shadow-lg shadow-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Income Entries</p>
                  <p className="text-2xl font-black text-emerald-600 mt-1">{income.length}</p>
                </div>
                <div className="aura-card p-5 border-none shadow-lg shadow-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Top Expense Head</p>
                  <p className="text-sm font-black text-slate-800 mt-1 truncate">{topExpCat?.name || '—'}</p>
                  {topExpCat && <p className="text-xs text-rose-500 font-black">Rs. {topExpCat.value.toLocaleString()}</p>}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── BY CATEGORY ── */}
          {tab === 'category' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="aura-card p-8 border-none shadow-xl shadow-slate-200/50">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Expense Breakdown by Category</h3>
              {categoryData.length === 0
                ? <p className="text-center text-slate-300 text-xs py-12">No expense data for current filter.</p>
                : <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={categoryData} cx="50%" cy="50%" innerRadius={65} outerRadius={110} dataKey="value" nameKey="name" paddingAngle={2}>
                          {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-3">
                      {categoryData.map((c, i) => (
                        <div key={c.name} className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-black text-slate-700 truncate">{c.name}</span>
                              <span className="font-black text-slate-900 ml-2 shrink-0">Rs. {c.value.toLocaleString()}</span>
                            </div>
                            <div className="bg-slate-100 rounded-full h-2">
                              <div className="h-2 rounded-full" style={{ width: `${(c.value / totalExpense) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                            </div>
                          </div>
                          <span className="text-[10px] font-black text-slate-400 w-9 text-right shrink-0">{((c.value / totalExpense) * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
              }
              {categoryData.length > 0 && (
                <div className="mt-8 overflow-hidden rounded-2xl border border-slate-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-6 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">#</th>
                        <th className="px-6 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                        <th className="px-6 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</th>
                        <th className="px-6 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">% of Expense</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {categoryData.map((c, i) => (
                        <tr key={c.name} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-6 py-3 text-xs font-black text-slate-300">{i + 1}</td>
                          <td className="px-6 py-3 inline-flex items-center gap-2 mt-3">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <span className="font-bold text-slate-700">{c.name}</span>
                          </td>
                          <td className="px-6 py-3 text-right font-black text-rose-600">Rs. {c.value.toLocaleString()}</td>
                          <td className="px-6 py-3 text-right font-bold text-slate-400">{((c.value / totalExpense) * 100).toFixed(1)}%</td>
                        </tr>
                      ))}
                      <tr className="bg-rose-50 border-t-2 border-rose-100">
                        <td colSpan={2} className="px-6 py-3 text-xs font-black text-slate-600 uppercase tracking-widest">Total Expenses</td>
                        <td className="px-6 py-3 text-right font-black text-rose-700">Rs. {totalExpense.toLocaleString()}</td>
                        <td className="px-6 py-3 text-right font-black text-slate-400">100%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {/* ── BY MONTH ── */}
          {tab === 'monthly' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="aura-card p-8 border-none shadow-xl shadow-slate-200/50">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Monthly Breakdown</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fontWeight: 700 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }} />
                    <Legend />
                    {txFilter !== 'expense' && <Bar dataKey="Income"  fill="#10b981" radius={[6,6,0,0]} />}
                    {txFilter !== 'income'  && <Bar dataKey="Expense" fill="#ef4444" radius={[6,6,0,0]} />}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="aura-card overflow-hidden border-none shadow-xl shadow-slate-200/50">
                <div className="bg-slate-50/50 border-b border-slate-100 px-8 py-5">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em]">Month-wise Summary</h3>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-50">
                      <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Month</th>
                      {txFilter !== 'expense' && <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Income</th>}
                      {txFilter !== 'income'  && <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Expense</th>}
                      {txFilter === 'all'     && <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Net</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {monthlyData.map(m => {
                      const net = m.Income - m.Expense;
                      return (
                        <tr key={m.month} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-6 py-4 font-black text-slate-700 text-xs uppercase tracking-wide">{m.month}</td>
                          {txFilter !== 'expense' && <td className="px-6 py-4 text-right font-black text-emerald-600">Rs. {m.Income.toLocaleString()}</td>}
                          {txFilter !== 'income'  && <td className="px-6 py-4 text-right font-black text-rose-600">Rs. {m.Expense.toLocaleString()}</td>}
                          {txFilter === 'all'     && <td className={`px-6 py-4 text-right font-black ${net >= 0 ? 'text-indigo-600' : 'text-orange-600'}`}>{net < 0 ? '− ' : ''}Rs. {Math.abs(net).toLocaleString()}</td>}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-200">
                      <td className="px-6 py-4 text-xs font-black text-slate-600 uppercase tracking-widest">Total</td>
                      {txFilter !== 'expense' && <td className="px-6 py-4 text-right font-black text-emerald-700">Rs. {totalIncome.toLocaleString()}</td>}
                      {txFilter !== 'income'  && <td className="px-6 py-4 text-right font-black text-rose-700">Rs. {totalExpense.toLocaleString()}</td>}
                      {txFilter === 'all'     && <td className={`px-6 py-4 text-right font-black ${netBalance >= 0 ? 'text-indigo-700' : 'text-orange-700'}`}>{netBalance < 0 ? '− ' : ''}Rs. {Math.abs(netBalance).toLocaleString()}</td>}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </motion.div>
          )}

          {/* ── BY DATE ── */}
          {tab === 'daily' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="aura-card p-8 border-none shadow-xl shadow-slate-200/50">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Daily Cash Flow</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dailyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fontWeight: 700 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => fmt(v)} labelFormatter={l => formatDate(l)} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }} />
                    <Legend />
                    {txFilter !== 'expense' && <Bar dataKey="Income"  fill="#10b981" radius={[4,4,0,0]} />}
                    {txFilter !== 'income'  && <Bar dataKey="Expense" fill="#ef4444" radius={[4,4,0,0]} />}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="aura-card overflow-hidden border-none shadow-xl shadow-slate-200/50">
                <div className="bg-slate-50/50 border-b border-slate-100 px-8 py-5">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em]">Date-wise Summary</h3>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-50">
                      <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                      {txFilter !== 'expense' && <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Income</th>}
                      {txFilter !== 'income'  && <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Expense</th>}
                      {txFilter === 'all'     && <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Net</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {[...dailyData].reverse().map(d => {
                      const net = d.Income - d.Expense;
                      return (
                        <tr key={d.date} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-6 py-3 font-black text-slate-700 text-xs">{formatDate(d.date)}</td>
                          {txFilter !== 'expense' && <td className="px-6 py-3 text-right font-bold text-emerald-600">{d.Income > 0 ? `Rs. ${d.Income.toLocaleString()}` : '—'}</td>}
                          {txFilter !== 'income'  && <td className="px-6 py-3 text-right font-bold text-rose-600">{d.Expense > 0 ? `Rs. ${d.Expense.toLocaleString()}` : '—'}</td>}
                          {txFilter === 'all'     && <td className={`px-6 py-3 text-right font-black text-xs ${net >= 0 ? 'text-indigo-600' : 'text-orange-600'}`}>{net < 0 ? '− ' : ''}Rs. {Math.abs(net).toLocaleString()}</td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* ── ALL TRANSACTIONS ── */}
          {tab === 'transactions' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="aura-card overflow-hidden border-none shadow-xl shadow-slate-200/50">
              <div className="bg-slate-50/50 border-b border-slate-100 px-8 py-5">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em]">Transactions ({filteredTx.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-50">
                      <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Remarks</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Mode</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                      <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Edit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredTx.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50/60 transition-colors group">
                        <td className="px-6 py-3 text-slate-700 font-bold text-xs whitespace-nowrap">{formatDate(t.date)}</td>
                        <td className="px-6 py-3">
                          <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${t.type === 'income' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                            {t.type}
                          </span>
                        </td>
                        <td className="px-6 py-3"><span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-[9px] font-black uppercase tracking-widest">{t.category}</span></td>
                        <td className="px-6 py-3 text-slate-500 text-xs max-w-[200px] truncate" title={t.remarks}>{t.remarks || '—'}</td>
                        <td className="px-6 py-3 text-slate-400 text-xs font-medium">{t.payment_mode || '—'}</td>
                        <td className={`px-6 py-3 text-right font-black text-sm ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          Rs. {Number(t.amount).toLocaleString()}
                        </td>
                        <td className="px-6 py-3 text-center">
                          <button onClick={() => openEdit(t)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all active:scale-90"
                            title="Edit this transaction">
                            <Pencil className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </>
      )}

      {/* ── EDIT MODAL ── */}
      <AnimatePresence>
        {editModal.isOpen && editModal.tx && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) closeEdit(); }}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">

              {/* Modal header */}
              <div className={`px-8 py-6 flex items-center justify-between ${editModal.tx.type === 'income' ? 'bg-emerald-50 border-b border-emerald-100' : 'bg-rose-50 border-b border-rose-100'}`}>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Editing Transaction</p>
                  <h3 className="text-lg font-black text-slate-900 mt-0.5">
                    {editModal.tx.type === 'income' ? 'Income' : 'Expense'} · {editModal.tx.category}
                  </h3>
                </div>
                <button onClick={closeEdit} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal body */}
              <div className="px-8 py-6 space-y-5">
                {editError && <div className="text-[10px] font-black uppercase tracking-widest text-red-600 bg-red-50 p-3 rounded-xl border border-red-100">{editError}</div>}

                {/* Date */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-[0.2em]">Date</label>
                  <div className="relative cursor-pointer" onClick={() => editDateRef.current?.showPicker()}>
                    <input type="text" readOnly value={editForm.date ? formatDate(editForm.date) : ''}
                      className="w-full bg-slate-50 border border-transparent hover:border-slate-200 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 outline-none cursor-pointer" />
                    <input type="date" ref={editDateRef} value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                      className="absolute inset-0 opacity-0 pointer-events-none" />
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-[0.2em]">Category / Head</label>
                  {editModal.tx.type === 'expense'
                    ? <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                        className="w-full bg-slate-50 border border-transparent focus:bg-white focus:border-slate-200 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all">
                        {expenseHeads.map(h => <option key={h} value={h}>{h}</option>)}
                        {!expenseHeads.includes(editForm.category) && editForm.category && <option value={editForm.category}>{editForm.category}</option>}
                      </select>
                    : <input type="text" value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                        className="w-full bg-slate-50 border border-transparent focus:bg-white focus:border-slate-200 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all"
                        placeholder="Income category" />
                  }
                </div>

                {/* Amount + Mode */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-[0.2em]">Amount</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xs">PKR</span>
                      <input type="number" value={editForm.amount} onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                        className="w-full bg-slate-50 border border-transparent focus:bg-white focus:border-slate-200 pl-14 pr-4 py-3 rounded-2xl text-sm font-black text-slate-900 outline-none transition-all" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-[0.2em]">Mode</label>
                    <select value={editForm.payment_mode} onChange={e => setEditForm(f => ({ ...f, payment_mode: e.target.value }))}
                      className="w-full bg-slate-50 border border-transparent focus:bg-white focus:border-slate-200 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all">
                      <option value="Cash">Cash</option>
                      <option value="Bank">Bank Transfer</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>
                </div>

                {/* Remarks */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-[0.2em]">Remarks</label>
                  <textarea rows={2} value={editForm.remarks} onChange={e => setEditForm(f => ({ ...f, remarks: e.target.value }))}
                    className="w-full bg-slate-50 border border-transparent focus:bg-white focus:border-slate-200 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all resize-none" />
                </div>
              </div>

              {/* Modal footer */}
              <div className="px-8 pb-6 flex gap-3">
                <button onClick={closeEdit} className="flex-1 py-3 rounded-2xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all">
                  Cancel
                </button>
                <button onClick={handleEditSave} disabled={editLoading}
                  className="flex-1 py-3 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-black transition-all disabled:opacity-50">
                  {editLoading ? 'Saving...' : <><Save className="w-4 h-4" /> Save Changes</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
