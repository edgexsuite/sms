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
  invoice_number: string;
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

  useEffect(() => {
    if (userRole?.school_id) { load(); loadClasses(); }
  }, [userRole]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('fee_records')
      .select('id, student_id, total_amount, paid_amount, discount_amount, status, month_year, due_date, invoice_number, students(full_name, roll_number, class_id, classes(name, section))')
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

  // Per-student aggregation
  const studentMap = useMemo(() => {
    const m = new Map<string, any>();
    filtered.forEach(inv => {
      const sid = inv.student_id;
      if (!m.has(sid)) {
        m.set(sid, {
          id: sid, name: inv.students?.full_name || '—', roll: inv.students?.roll_number || '—',
          className: inv.students?.classes ? `${inv.students.classes.name} ${inv.students.classes.section}` : '—',
          class_id: inv.students?.class_id,
          billed: 0, paid: 0, count: 0, worstStatus: 'paid',
        });
      }
      const s = m.get(sid);
      s.billed += inv.total_amount || 0;
      s.paid += inv.paid_amount || 0;
      s.count++;
      const rank: any = { overdue: 3, pending: 2, partial: 1, paid: 0 };
      if ((rank[inv.status] || 0) > (rank[s.worstStatus] || 0)) s.worstStatus = inv.status;
    });
    return Array.from(m.values()).map(s => ({ ...s, balance: Math.max(0, s.billed - s.paid) }))
      .sort((a, b) => b.balance - a.balance);
  }, [filtered]);

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
          <div className="bg-white rounded-2xl border border-slate-100 shadow overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-50 flex items-center justify-between">
              <h2 className="font-black text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2"><Users className="w-4 h-4 text-indigo-500" />Per-Student Outstanding</h2>
              <span className="text-xs text-slate-400 font-bold">{studentMap.length} students</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <th className="px-4 py-3">Roll #</th>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Class</th>
                    <th className="px-4 py-3 text-right">Invoices</th>
                    <th className="px-4 py-3 text-right">Billed</th>
                    <th className="px-4 py-3 text-right">Paid</th>
                    <th className="px-4 py-3 text-right">Balance Due</th>
                    <th className="px-4 py-3 text-center no-print">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {studentMap.length === 0 ? (
                    <tr><td colSpan={8} className="py-12 text-center text-slate-400 font-bold text-sm">No data for selected filters</td></tr>
                  ) : studentMap.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50/50 transition group">
                      <td className="px-4 py-3 text-xs font-bold text-slate-400">{s.roll}</td>
                      <td className="px-4 py-3 text-sm font-black text-slate-800">{s.name}</td>
                      <td className="px-4 py-3 text-xs font-bold text-slate-500">{s.className}</td>
                      <td className="px-4 py-3 text-xs font-bold text-slate-500 text-right">{s.count}</td>
                      <td className="px-4 py-3 text-xs font-bold text-slate-700 text-right">{fmt(s.billed)}</td>
                      <td className="px-4 py-3 text-xs font-bold text-emerald-600 text-right">{fmt(s.paid)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn('text-xs font-black px-2 py-0.5 rounded-lg',
                          s.balance === 0 ? 'bg-emerald-50 text-emerald-600' :
                          s.balance < s.billed / 2 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-600')}>
                          {fmt(s.balance)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center no-print">
                        <button onClick={() => navigate(`/fees/student-detail?student_id=${s.id}`)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg transition text-xs font-bold flex items-center gap-1 mx-auto">
                          <ExternalLink className="w-3.5 h-3.5" /> Ledger
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {studentMap.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-200 text-xs font-black text-slate-700">
                      <td colSpan={4} className="px-4 py-3">TOTAL ({studentMap.length} students)</td>
                      <td className="px-4 py-3 text-right">{fmt(totalBilled)}</td>
                      <td className="px-4 py-3 text-right text-emerald-600">{fmt(totalCollected)}</td>
                      <td className="px-4 py-3 text-right text-rose-600">{fmt(totalOutstanding)}</td>
                      <td className="no-print" />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Monthly Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-50">
              <h2 className="font-black text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2"><Calendar className="w-4 h-4 text-indigo-500" />Monthly Breakdown</h2>
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
          <div className="bg-white rounded-2xl border border-slate-100 shadow overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-50">
              <h2 className="font-black text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2"><BarChart3 className="w-4 h-4 text-indigo-500" />Class-Wise Analysis</h2>
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
          .no-print { display: none !important; }
          body { background: white !important; }
          .rounded-2xl { border-radius: 0 !important; }
          .shadow { box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}
