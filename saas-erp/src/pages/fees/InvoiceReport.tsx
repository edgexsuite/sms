import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  BarChart3, Download, Printer, Search, Filter, ChevronDown,
  ChevronRight, TrendingUp, AlertCircle, FileText, CheckCircle2,
  Users, Calendar, ExternalLink
} from 'lucide-react';
import { cn, formatDate } from '../../lib/utils';

type Invoice = {
  id: string; student_id: string; total_amount: number; paid_amount: number;
  discount_amount: number; status: string; month_year: string; due_date: string;
  invoice_number: string; breakdown: any[];
  students: { full_name: string; roll_number: string; class_id: string; classes: { name: string; section: string } | null } | null;
};

function fmt(n: number) { return 'Rs. ' + Math.round(n).toLocaleString(); }

function pct(collected: number, total: number) {
  return total > 0 ? ((collected / total) * 100).toFixed(1) + '%' : '—';
}

function rateColor(rate: number) {
  if (rate >= 90) return 'bg-emerald-100 text-emerald-700';
  if (rate >= 70) return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-700';
}

export default function InvoiceReport() {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [studentView, setStudentView] = useState<'all' | 'current' | 'arrears'>('all');
  const [showBreakdown, setShowBreakdown] = useState(false);

  useEffect(() => {
    if (userRole?.school_id) { load(); loadClasses(); }
  }, [userRole]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('fee_records')
      .select('id, student_id, total_amount, paid_amount, discount_amount, status, month_year, due_date, invoice_number, breakdown, students(full_name, roll_number, class_id, classes(name, section))')
      .eq('school_id', userRole!.school_id)
      .is('deleted_at', null)
      .order('month_year', { ascending: false });
    if (data) setInvoices(data as any);
    setLoading(false);
  };

  const loadClasses = async () => {
    const { data } = await supabase.from('classes').select('id, name, section').eq('school_id', userRole!.school_id).order('name');
    if (data) setClasses(data);
  };

  const filtered = useMemo(() => invoices.filter(inv => {
    if (classFilter && inv.students?.class_id !== classFilter) return false;
    if (monthFilter && !inv.month_year?.startsWith(monthFilter)) return false;
    if (statusFilter && inv.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!inv.students?.full_name?.toLowerCase().includes(q) && !inv.invoice_number?.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [invoices, classFilter, monthFilter, statusFilter, search]);

  // KPIs
  const totalBilled = filtered.reduce((s, i) => s + (i.total_amount || 0), 0);
  const totalCollected = filtered.reduce((s, i) => s + (i.paid_amount || 0), 0);
  const totalOutstanding = filtered.reduce((s, i) => s + Math.max(0, (i.total_amount || 0) - (i.paid_amount || 0)), 0);
  const collectionRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;

  // Per-student aggregation helper
  const buildStudentMap = (invList: Invoice[]) => {
    const m = new Map<string, any>();
    invList.forEach(inv => {
      const sid = inv.student_id;
      if (!m.has(sid)) {
        m.set(sid, {
          id: sid, name: inv.students?.full_name || '—', roll: inv.students?.roll_number || '—',
          className: inv.students?.classes ? `${inv.students.classes.name} ${inv.students.classes.section}` : '—',
          class_id: inv.students?.class_id,
          billed: 0, paid: 0, count: 0, worstStatus: 'paid',
          breakdownTotals: new Map<string, number>(),
        });
      }
      const s = m.get(sid);
      s.billed += inv.total_amount || 0;
      s.paid   += inv.paid_amount  || 0;
      s.count++;
      
      if (inv.breakdown) {
        inv.breakdown.forEach((b: any) => {
          if (b.item && b.amount) {
            const cur = s.breakdownTotals.get(b.item) || 0;
            s.breakdownTotals.set(b.item, cur + Number(b.amount));
          }
        });
      }

      const rank: any = { overdue: 3, pending: 2, partial: 1, paid: 0 };
      if ((rank[inv.status] || 0) > (rank[s.worstStatus] || 0)) s.worstStatus = inv.status;
    });
    return Array.from(m.values())
      .map(s => ({ ...s, balance: Math.max(0, s.billed - s.paid) }))
      .sort((a, b) => b.balance - a.balance);
  };

  // Latest month across ALL filtered invoices
  const latestMonth = useMemo(() => {
    const months = filtered.map(i => i.month_year?.slice(0, 7)).filter(Boolean) as string[];
    return months.length ? months.reduce((a, b) => (a > b ? a : b)) : null;
  }, [filtered]);

  // Split invoices into current-month vs older-with-balance (arrears)
  const currentInvoices = useMemo(() =>
    latestMonth ? filtered.filter(i => i.month_year?.startsWith(latestMonth)) : []
  , [filtered, latestMonth]);

  const arrearsInvoices = useMemo(() =>
    latestMonth
      ? filtered.filter(i => !i.month_year?.startsWith(latestMonth) && Math.max(0, (i.total_amount || 0) - (i.paid_amount || 0)) > 0)
      : filtered.filter(i => Math.max(0, (i.total_amount || 0) - (i.paid_amount || 0)) > 0)
  , [filtered, latestMonth]);

  // Three student maps
  const studentMap         = useMemo(() => buildStudentMap(filtered),         [filtered]);
  const studentMapCurrent  = useMemo(() => buildStudentMap(currentInvoices),  [currentInvoices]);
  const studentMapArrears  = useMemo(() => buildStudentMap(arrearsInvoices),  [arrearsInvoices]);

  const activeStudentMap = studentView === 'current' ? studentMapCurrent
                         : studentView === 'arrears' ? studentMapArrears
                         : studentMap;

  // Lookup maps for split columns in 'all' view
  const arrearsLookup  = useMemo(() => new Map(studentMapArrears.map(s => [s.id, s.balance])),  [studentMapArrears]);
  const currentLookup  = useMemo(() => new Map(studentMapCurrent.map(s => [s.id, s.balance])),  [studentMapCurrent]);

  const breakdownKeys = useMemo(() => {
    const keys = new Set<string>();
    activeStudentMap.forEach(s => {
      if (s.breakdownTotals) {
        for (const k of s.breakdownTotals.keys()) keys.add(k);
      }
    });
    return Array.from(keys).sort();
  }, [activeStudentMap]);

  // Monthly breakdown
  const monthMap = useMemo(() => {
    const m = new Map<string, any>();
    filtered.forEach(inv => {
      const mo = inv.month_year?.slice(0, 7) || '—';
      if (!m.has(mo)) m.set(mo, { month: mo, count: 0, billed: 0, paid: 0, byClass: new Map<string, any>() });
      const s = m.get(mo);
      s.count++; s.billed += inv.total_amount || 0; s.paid += inv.paid_amount || 0;
      const cls = inv.students?.classes ? `${inv.students.classes.name} ${inv.students.classes.section}` : 'Unknown';
      if (!s.byClass.has(cls)) s.byClass.set(cls, { cls, count: 0, billed: 0, paid: 0 });
      const c = s.byClass.get(cls); c.count++; c.billed += inv.total_amount || 0; c.paid += inv.paid_amount || 0;
    });
    return Array.from(m.values()).sort((a, b) => b.month.localeCompare(a.month));
  }, [filtered]);

  // Class breakdown
  const classMap = useMemo(() => {
    const m = new Map<string, any>();
    filtered.forEach(inv => {
      const cls = inv.students?.classes ? `${inv.students.classes.name} ${inv.students.classes.section}` : 'Unknown';
      if (!m.has(cls)) m.set(cls, { cls, count: 0, billed: 0, paid: 0 });
      const s = m.get(cls); s.count++; s.billed += inv.total_amount || 0; s.paid += inv.paid_amount || 0;
    });
    return Array.from(m.values()).sort((a, b) => (b.billed - b.paid) - (a.billed - a.paid));
  }, [filtered]);

  // Print a single section by hiding all others via body data-attribute
  const printSection = (sectionId: string, title: string) => {
    document.body.dataset.printSection = sectionId;
    const originalTitle = document.title;
    document.title = `${title} - Invoice Report`;
    
    window.print();
    
    // Clean up after browser closes print dialog
    const cleanup = () => { 
      delete document.body.dataset.printSection; 
      document.title = originalTitle;
    };
    window.addEventListener('afterprint', cleanup, { once: true });
    // Fallback cleanup after 3s in case afterprint doesn't fire
    setTimeout(cleanup, 3000);
  };

  const exportCSV = () => {
    const rows = [
      ['Student', 'Roll', 'Class', 'Invoices', 'Total Billed', 'Total Paid', 'Balance Due', 'Status'],
      ...studentMap.map(s => [s.name, s.roll, s.className, s.count, s.billed, s.paid, s.balance, s.worstStatus])
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `invoice-report-${monthFilter || 'all'}.csv`; a.click();
  };

  const kpis = [
    { label: 'Total Invoices', value: filtered.length, icon: FileText, color: 'text-slate-600', bg: 'bg-white border-slate-100' },
    { label: 'Total Billed', value: fmt(totalBilled), icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-100' },
    { label: 'Collected', value: fmt(totalCollected), icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
    { label: 'Outstanding', value: fmt(totalOutstanding), icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50 border-rose-100' },
    { label: 'Collection Rate', value: pct(totalCollected, totalBilled), icon: BarChart3, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-20">
      {/* Print Header */}
      <div className="hidden print:block border-b-2 border-slate-400 pb-4 mb-4 text-center">
        <h1 className="text-2xl font-black uppercase tracking-widest">Invoice Summary Report</h1>
        <p className="text-sm text-slate-500 mt-1">
          {monthFilter ? `Period: ${monthFilter}` : 'All Periods'} {classFilter ? `| Class: ${classes.find(c => c.id === classFilter)?.name}` : ''} | Generated: {formatDate(new Date())}
        </p>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 no-print">
        <div>
          <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" /> Invoice Report
          </h1>
          <p className="text-slate-500 text-xs font-medium mt-0.5">All-time fee collection analytics, outstanding balances &amp; class-wise breakdown</p>
        </div>
        <div className="flex gap-2 no-print">
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase text-slate-600 hover:bg-slate-50 transition">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase hover:bg-black transition">
            <Printer className="w-3.5 h-3.5" /> Print Report
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {kpis.map(k => (
          <div key={k.label} className={cn('rounded-2xl border p-4 flex items-center gap-3', k.bg)}>
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-white shadow-sm border border-current/10', k.color)}>
              <k.icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none">{k.label}</p>
              <p className={cn('text-base font-black leading-tight mt-0.5', k.color)}>{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow p-3 flex flex-wrap gap-3 items-center no-print">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student or invoice #"
            className="w-full pl-9 pr-3 py-2 bg-slate-50 rounded-xl text-sm font-medium border border-transparent focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 outline-none" />
        </div>
        <select value={classFilter} onChange={e => setClassFilter(e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none">
          <option value="">All Classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
        </select>
        <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none">
          <option value="">All Statuses</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="partial">Partial</option>
          <option value="overdue">Overdue</option>
        </select>
        {(classFilter || monthFilter || statusFilter || search) && (
          <button onClick={() => { setClassFilter(''); setMonthFilter(''); setStatusFilter(''); setSearch(''); }}
            className="px-3 py-2 bg-slate-100 rounded-xl text-xs font-black text-slate-500 hover:bg-slate-200 transition">
            <Filter className="w-3.5 h-3.5 inline mr-1" />Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400 font-bold">Loading Report...</div>
      ) : (
        <>
          {/* Per-Student Outstanding */}
          <div data-section="students" className="bg-white rounded-2xl border border-slate-100 shadow overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="font-black text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2"><Users className="w-4 h-4 text-indigo-500" />Per-Student Outstanding</h2>
                <span className="text-xs text-slate-400 font-bold">{activeStudentMap.length} students</span>
              </div>
              <div className="flex items-center gap-2 no-print">
                <label className="flex items-center gap-1.5 px-2 py-1.5 cursor-pointer text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700">
                  <input type="checkbox" checked={showBreakdown} onChange={e => setShowBreakdown(e.target.checked)} className="rounded text-indigo-500 focus:ring-indigo-500 w-3 h-3 border-slate-300" />
                  Details
                </label>
                <div className="flex bg-slate-100 rounded-xl p-0.5 text-[10px] font-black uppercase tracking-widest">
                  {([['all','All'],['current','Current'],['arrears','Arrears']] as [string,string][]).map(([v, label]) => (
                    <button key={v} onClick={() => setStudentView(v as 'all'|'current'|'arrears')}
                      className={cn('px-3 py-1.5 rounded-[10px] transition-all',
                        studentView === v ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                      {label}{v === 'current' && latestMonth ? ` (${latestMonth})` : ''}
                    </button>
                  ))}
                </div>
                <button onClick={() => printSection('students', 'Per-Student Outstanding')} title="Print this section"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-widest transition">
                  <Printer className="w-3 h-3" /> Print
                </button>
              </div>
            </div>
            {studentView !== 'all' && (
              <div className={cn('px-5 py-2 text-[11px] font-bold border-b flex items-center gap-2',
                studentView === 'current' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-amber-50 text-amber-700 border-amber-100')}>
                {studentView === 'current'
                  ? `📅 Latest month: ${latestMonth || '—'} — ${currentInvoices.length} invoice(s)`
                  : `⚠️ Previous months with unpaid balance (arrears) — ${arrearsInvoices.length} invoice(s)`}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <th className="px-4 py-3">Sr#</th>
                    <th className="px-4 py-3">Roll #</th>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Class</th>
                    <th className="px-4 py-3 text-right">Inv.</th>
                    {showBreakdown && breakdownKeys.map(k => (
                      <th key={k} className="px-4 py-3 text-right whitespace-nowrap text-indigo-500 font-black">{k}</th>
                    ))}
                    <th className="px-4 py-3 text-right">Billed</th>
                    <th className="px-4 py-3 text-right">Paid</th>
                    {studentView === 'all' && <th className="px-4 py-3 text-right text-indigo-500">Current</th>}
                    {studentView === 'all' && <th className="px-4 py-3 text-right text-amber-600">Arrears</th>}
                    <th className="px-4 py-3 text-right">Total Balance</th>
                    <th className="px-4 py-3 text-center no-print">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {activeStudentMap.length === 0 ? (
                    <tr><td colSpan={15} className="py-12 text-center text-slate-400 font-bold text-sm">
                      {studentView === 'arrears' ? '✅ No arrears — all previous invoices are settled!' : 'No data for selected filters'}
                    </td></tr>
                  ) : activeStudentMap.map((s, idx) => {
                    const currBal    = currentLookup.get(s.id) ?? 0;
                    const arrBal     = arrearsLookup.get(s.id) ?? 0;
                    const totalBal   = s.balance;
                    return (
                    <tr key={s.id} className="hover:bg-slate-50/50 transition group">
                      <td className="px-4 py-3 text-xs font-bold text-slate-400">{idx + 1}</td>
                      <td className="px-4 py-3 text-xs font-bold text-slate-400">{s.roll}</td>
                      <td className="px-4 py-3 text-sm font-black text-slate-800">{s.name}</td>
                      <td className="px-4 py-3 text-xs font-bold text-slate-500">{s.className}</td>
                      <td className="px-4 py-3 text-xs font-bold text-slate-500 text-right">{s.count}</td>
                      {showBreakdown && breakdownKeys.map(k => (
                        <td key={k} className="px-4 py-3 text-xs font-bold text-slate-500 text-right">
                          {s.breakdownTotals?.has(k) ? fmt(s.breakdownTotals.get(k)) : '—'}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-xs font-bold text-slate-700 text-right">{fmt(s.billed)}</td>
                      <td className="px-4 py-3 text-xs font-bold text-emerald-600 text-right">{fmt(s.paid)}</td>
                      {studentView === 'all' && (
                        <td className="px-4 py-3 text-right">
                          <span className={cn('text-xs font-black px-2 py-0.5 rounded-lg',
                            currBal === 0 ? 'bg-slate-50 text-slate-400' : 'bg-indigo-50 text-indigo-600')}>
                            {fmt(currBal)}
                          </span>
                        </td>
                      )}
                      {studentView === 'all' && (
                        <td className="px-4 py-3 text-right">
                          <span className={cn('text-xs font-black px-2 py-0.5 rounded-lg',
                            arrBal === 0 ? 'bg-slate-50 text-slate-400' : 'bg-amber-50 text-amber-700')}>
                            {fmt(arrBal)}
                          </span>
                        </td>
                      )}
                      <td className="px-4 py-3 text-right">
                        <span className={cn('text-xs font-black px-2 py-0.5 rounded-lg',
                          totalBal === 0 ? 'bg-emerald-50 text-emerald-600' :
                          totalBal < s.billed / 2 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-600')}>
                          {fmt(totalBal)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center no-print">
                        <button onClick={() => navigate(`/fees/student-detail?student=${s.id}`)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg transition text-xs font-bold flex items-center gap-1 mx-auto">
                          <ExternalLink className="w-3.5 h-3.5" /> Ledger
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                  {activeStudentMap.length > 0 && (
                    <tr className="bg-slate-50 border-t-2 border-slate-200 text-xs font-black text-slate-700">
                      <td colSpan={5} className="px-4 py-3">
                        TOTAL ({activeStudentMap.length} students){studentView === 'current' && <span className="ml-2 text-indigo-500 font-bold normal-case">— Current Month</span>}{studentView === 'arrears' && <span className="ml-2 text-amber-600 font-bold normal-case">— Arrears</span>}
                      </td>
                      {showBreakdown && breakdownKeys.map(k => (
                        <td key={k} className="px-4 py-3 text-right text-indigo-600">
                          {fmt(activeStudentMap.reduce((sum, s) => sum + (s.breakdownTotals?.get(k) || 0), 0))}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right">{fmt(activeStudentMap.reduce((s,r)=>s+r.billed,0))}</td>
                      <td className="px-4 py-3 text-right text-emerald-600">{fmt(activeStudentMap.reduce((s,r)=>s+r.paid,0))}</td>
                      {studentView === 'all' && <td className="px-4 py-3 text-right text-indigo-600">{fmt(studentMapCurrent.reduce((s,r)=>s+r.balance,0))}</td>}
                      {studentView === 'all' && <td className="px-4 py-3 text-right text-amber-600">{fmt(studentMapArrears.reduce((s,r)=>s+r.balance,0))}</td>}
                      <td className="px-4 py-3 text-right text-rose-600">{fmt(activeStudentMap.reduce((s,r)=>s+r.balance,0))}</td>
                      <td className="no-print" />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Monthly Breakdown */}
          <div data-section="monthly" className="bg-white rounded-2xl border border-slate-100 shadow overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-50 flex items-center justify-between">
              <h2 className="font-black text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2"><Calendar className="w-4 h-4 text-indigo-500" />Monthly Breakdown</h2>
              <button onClick={() => printSection('monthly', 'Monthly Breakdown')} title="Print this section"
                className="no-print flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-widest transition">
                <Printer className="w-3 h-3" /> Print
              </button>
            </div>
            <div className="divide-y divide-slate-50">
              {monthMap.map(m => {
                const rate = m.billed > 0 ? (m.paid / m.billed) * 100 : 0;
                const isOpen = expandedMonths.has(m.month);
                return (
                  <div key={m.month}>
                    <button onClick={() => setExpandedMonths(prev => { const n = new Set(prev); isOpen ? n.delete(m.month) : n.add(m.month); return n; })}
                      className="w-full flex items-center px-5 py-3 hover:bg-slate-50 transition text-left">
                      <div className="flex items-center gap-2 w-36">
                        {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                        <span className="text-sm font-black text-slate-700">{m.month}</span>
                      </div>
                      <span className="text-xs text-slate-400 font-bold w-24">{m.count} invoices</span>
                      <span className="text-xs font-bold text-slate-600 w-32">{fmt(m.billed)}</span>
                      <span className="text-xs font-bold text-emerald-600 w-32">{fmt(m.paid)}</span>
                      <span className="text-xs font-bold text-rose-500 w-32">{fmt(Math.max(0, m.billed - m.paid))}</span>
                      <span className={cn('text-xs font-black px-2.5 py-0.5 rounded-full', rateColor(rate))}>{rate.toFixed(1)}%</span>
                      <div className="flex-1 ml-4 bg-slate-100 rounded-full h-1.5 hidden md:block">
                        <div className="h-1.5 rounded-full bg-emerald-400 transition-all" style={{ width: `${Math.min(100, rate)}%` }} />
                      </div>
                    </button>
                    {isOpen && (
                      <div className="bg-slate-50/50 px-12 pb-3">
                        <table className="w-full text-xs">
                          <thead><tr className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-100">
                            <th className="py-2 text-left">Class</th>
                            <th className="py-2 text-right">Invoices</th>
                            <th className="py-2 text-right">Billed</th>
                            <th className="py-2 text-right">Collected</th>
                            <th className="py-2 text-right">Outstanding</th>
                            <th className="py-2 text-right">Rate</th>
                          </tr></thead>
                          <tbody className="divide-y divide-slate-100">
                            {Array.from(m.byClass.values()).map((c: any) => {
                              const cr = c.billed > 0 ? (c.paid / c.billed) * 100 : 0;
                              return (
                                <tr key={c.cls}>
                                  <td className="py-1.5 font-bold text-slate-700">{c.cls}</td>
                                  <td className="py-1.5 text-right text-slate-500">{c.count}</td>
                                  <td className="py-1.5 text-right text-slate-600">{fmt(c.billed)}</td>
                                  <td className="py-1.5 text-right text-emerald-600">{fmt(c.paid)}</td>
                                  <td className="py-1.5 text-right text-rose-500">{fmt(Math.max(0, c.billed - c.paid))}</td>
                                  <td className="py-1.5 text-right"><span className={cn('px-2 py-0.5 rounded-full font-black', rateColor(cr))}>{cr.toFixed(1)}%</span></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Class-wise Analysis */}
          <div data-section="classes" className="bg-white rounded-2xl border border-slate-100 shadow overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-50 flex items-center justify-between">
              <h2 className="font-black text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2"><BarChart3 className="w-4 h-4 text-indigo-500" />Class-Wise Analysis</h2>
              <button onClick={() => printSection('classes', 'Class-Wise Analysis')} title="Print this section"
                className="no-print flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-widest transition">
                <Printer className="w-3 h-3" /> Print
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <th className="px-5 py-3">Class</th>
                    <th className="px-5 py-3 text-right">Students</th>
                    <th className="px-5 py-3 text-right">Billed</th>
                    <th className="px-5 py-3 text-right">Collected</th>
                    <th className="px-5 py-3 text-right">Outstanding</th>
                    <th className="px-5 py-3 text-right">Rate</th>
                    <th className="px-5 py-3">Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {classMap.map(c => {
                    const rate = c.billed > 0 ? (c.paid / c.billed) * 100 : 0;
                    return (
                      <tr key={c.cls} className="hover:bg-slate-50/40">
                        <td className="px-5 py-3 text-sm font-black text-slate-800">{c.cls}</td>
                        <td className="px-5 py-3 text-xs font-bold text-slate-500 text-right">{c.count}</td>
                        <td className="px-5 py-3 text-xs font-bold text-slate-700 text-right">{fmt(c.billed)}</td>
                        <td className="px-5 py-3 text-xs font-bold text-emerald-600 text-right">{fmt(c.paid)}</td>
                        <td className="px-5 py-3 text-xs font-bold text-rose-500 text-right">{fmt(Math.max(0, c.billed - c.paid))}</td>
                        <td className="px-5 py-3 text-right">
                          <span className={cn('text-xs font-black px-2.5 py-0.5 rounded-full', rateColor(rate))}>{rate.toFixed(1)}%</span>
                        </td>
                        <td className="px-5 py-3 w-32">
                          <div className="bg-slate-100 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full bg-emerald-400 transition-all" style={{ width: `${Math.min(100, rate)}%` }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <style>{`
        @media print {
          @page { size: landscape; margin: 5mm; }
          .no-print { display: none !important; }
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .rounded-2xl { border-radius: 0 !important; }
          .shadow { box-shadow: none !important; }
          
          /* Auto-fit columns */
          table { width: 100% !important; table-layout: auto !important; }
          th, td { padding: 2px 4px !important; font-size: 8px !important; line-height: 1.1 !important; }
          /* Allow text to wrap if it needs to, preventing horizontal overflow */
          th { white-space: normal !important; word-break: break-word !important; }

          /* Section-isolated printing:
             When body has data-print-section set, hide every
             [data-section] that doesn't match the chosen one. */
          body[data-print-section] [data-section] { display: none !important; }
          body[data-print-section='students'] [data-section='students'],
          body[data-print-section='monthly']  [data-section='monthly'],
          body[data-print-section='classes']  [data-section='classes'] {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
}
