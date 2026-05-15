import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { FileBarChart, Download, TrendingUp, TrendingDown, Scale, Calendar } from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';
import { formatDate } from '../../lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { motion } from 'motion/react';

const COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316','#06b6d4','#84cc16'];

type Tab = 'overview' | 'category' | 'monthly' | 'daily' | 'transactions';
type DateType = 'today' | 'month' | 'year' | 'custom';
type TxFilter = 'all' | 'income' | 'expense';

function fmt(n: number) { return `Rs. ${n.toLocaleString()}`; }

function monthLabel(ym: string) {
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('default', { month: 'short', year: '2-digit' });
}

export default function ExpenseReports() {
  const { userRole } = useAuth();
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);

  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateType, setDateType] = useState<DateType>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [tab, setTab] = useState<Tab>('overview');
  const [txFilter, setTxFilter] = useState<TxFilter>('all');

  useEffect(() => {
    if (userRole?.school_id) fetchData();
  }, [userRole, dateType, customStart, customEnd]);

  const fetchData = async () => {
    setLoading(true);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    let start = '', end = todayStr;
    if (dateType === 'today') {
      start = todayStr;
    } else if (dateType === 'month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    } else if (dateType === 'year') {
      start = `${today.getFullYear()}-01-01`;
    } else if (dateType === 'custom' && customStart && customEnd) {
      start = customStart; end = customEnd;
    }

    let query = supabase
      .from('financial_transactions')
      .select('*')
      .eq('school_id', userRole!.school_id)
      .eq('is_deleted', false)
      .order('date', { ascending: true });

    if (start && end) query = query.gte('date', start).lte('date', end);

    const { data } = await query;
    setTransactions(data || []);
    setLoading(false);
  };

  const income   = useMemo(() => transactions.filter(t => t.type === 'income'),  [transactions]);
  const expenses = useMemo(() => transactions.filter(t => t.type === 'expense'), [transactions]);

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
    transactions.forEach(t => {
      const m = t.date.substring(0, 7);
      if (!map[m]) map[m] = { month: m, Income: 0, Expense: 0 };
      if (t.type === 'income') map[m].Income += Number(t.amount);
      else map[m].Expense += Number(t.amount);
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month))
      .map(r => ({ ...r, month: monthLabel(r.month) }));
  }, [transactions]);

  const dailyData = useMemo(() => {
    const map: Record<string, { date: string; Income: number; Expense: number }> = {};
    transactions.forEach(t => {
      if (!map[t.date]) map[t.date] = { date: t.date, Income: 0, Expense: 0 };
      if (t.type === 'income') map[t.date].Income += Number(t.amount);
      else map[t.date].Expense += Number(t.amount);
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [transactions]);

  const filteredTx = useMemo(() => {
    const list = txFilter === 'all' ? transactions : transactions.filter(t => t.type === txFilter);
    return [...list].reverse();
  }, [transactions, txFilter]);

  const topExpCat = categoryData[0];

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview',      label: 'Overview' },
    { key: 'category',      label: 'By Category' },
    { key: 'monthly',       label: 'By Month' },
    { key: 'daily',         label: 'By Date' },
    { key: 'transactions',  label: 'All Transactions' },
  ];

  const DATE_BTNS: { key: DateType; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'month', label: 'This Month' },
    { key: 'year',  label: 'This Year' },
    { key: 'custom',label: 'Custom' },
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
        <button
          onClick={() => exportToCSV('financial-report', filteredTx, [
            { header: 'Date', key: 'date' }, { header: 'Type', key: 'type' },
            { header: 'Category', key: 'category' }, { header: 'Remarks', key: 'remarks' },
            { header: 'Mode', key: 'payment_mode' }, { header: 'Amount', key: 'amount' },
          ])}
          className="px-6 py-3 bg-white border border-slate-200 rounded-2xl text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm flex items-center gap-2"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </motion.div>

      {/* Date Filter */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="aura-card p-5 border-none shadow-xl shadow-slate-200/50 flex flex-wrap items-center gap-3">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Period</span>
        {DATE_BTNS.map(b => (
          <button key={b.key} onClick={() => setDateType(b.key)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${dateType === b.key ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
            {b.label}
          </button>
        ))}
        {dateType === 'custom' && (
          <div className="flex items-center gap-3 ml-2">
            <div className="relative cursor-pointer" onClick={() => startRef.current?.showPicker()}>
              <input type="text" readOnly value={customStart ? formatDate(customStart) : ''} placeholder="Start Date"
                className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer w-36" />
              <input type="date" ref={startRef} value={customStart} onChange={e => setCustomStart(e.target.value)}
                className="absolute inset-0 opacity-0 pointer-events-none" />
            </div>
            <span className="text-slate-300 font-black">→</span>
            <div className="relative cursor-pointer" onClick={() => endRef.current?.showPicker()}>
              <input type="text" readOnly value={customEnd ? formatDate(customEnd) : ''} placeholder="End Date"
                className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer w-36" />
              <input type="date" ref={endRef} value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                className="absolute inset-0 opacity-0 pointer-events-none" />
            </div>
          </div>
        )}
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {[
          { label: 'Total Income',  value: totalIncome,  Icon: TrendingUp,   bg: 'bg-emerald-500', shadow: 'shadow-emerald-200', text: 'text-emerald-600' },
          { label: 'Total Expense', value: totalExpense, Icon: TrendingDown,  bg: 'bg-rose-500',    shadow: 'shadow-rose-200',    text: 'text-rose-600' },
          { label: 'Net Balance',   value: netBalance,   Icon: Scale,         bg: netBalance >= 0 ? 'bg-indigo-500' : 'bg-orange-500', shadow: netBalance >= 0 ? 'shadow-indigo-200' : 'shadow-orange-200', text: netBalance >= 0 ? 'text-indigo-600' : 'text-orange-600' },
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
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
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
      ) : transactions.length === 0 ? (
        <div className="aura-card p-20 text-center border-none shadow-xl shadow-slate-200/50">
          <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">No data for this period.</p>
        </div>
      ) : (
        <>
          {/* ── OVERVIEW ── */}
          {tab === 'overview' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="aura-card p-8 border-none shadow-xl shadow-slate-200/50">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Income vs Expense — Monthly</h3>
                {monthlyData.length === 0
                  ? <p className="text-center text-slate-300 text-xs py-12">Not enough data for monthly view.</p>
                  : <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={monthlyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }} barCategoryGap="30%">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fontWeight: 700 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }} />
                        <Legend />
                        <Bar dataKey="Income"  fill="#10b981" radius={[6,6,0,0]} />
                        <Bar dataKey="Expense" fill="#ef4444" radius={[6,6,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                }
              </div>

              {/* Quick stats row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="aura-card p-5 border-none shadow-lg shadow-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Transactions</p>
                  <p className="text-2xl font-black text-slate-800 mt-1">{transactions.length}</p>
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
                ? <p className="text-center text-slate-300 text-xs py-12">No expense data.</p>
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
                              <div className="h-2 rounded-full transition-all" style={{ width: `${(c.value / totalExpense) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                            </div>
                          </div>
                          <span className="text-[10px] font-black text-slate-400 w-9 text-right shrink-0">{((c.value / totalExpense) * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
              }

              {/* Category table */}
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
                          <td className="px-6 py-3">
                            <span className="inline-flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                              <span className="font-bold text-slate-700">{c.name}</span>
                            </span>
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
                    <Bar dataKey="Income"  fill="#10b981" radius={[6,6,0,0]} />
                    <Bar dataKey="Expense" fill="#ef4444" radius={[6,6,0,0]} />
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
                      <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Income</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Expense</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {monthlyData.map(m => {
                      const net = m.Income - m.Expense;
                      return (
                        <tr key={m.month} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-6 py-4 font-black text-slate-700 text-xs uppercase tracking-wide">{m.month}</td>
                          <td className="px-6 py-4 text-right font-black text-emerald-600">Rs. {m.Income.toLocaleString()}</td>
                          <td className="px-6 py-4 text-right font-black text-rose-600">Rs. {m.Expense.toLocaleString()}</td>
                          <td className={`px-6 py-4 text-right font-black ${net >= 0 ? 'text-indigo-600' : 'text-orange-600'}`}>
                            {net < 0 ? '− ' : ''}Rs. {Math.abs(net).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-200">
                      <td className="px-6 py-4 text-xs font-black text-slate-600 uppercase tracking-widest">Total</td>
                      <td className="px-6 py-4 text-right font-black text-emerald-700">Rs. {totalIncome.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-black text-rose-700">Rs. {totalExpense.toLocaleString()}</td>
                      <td className={`px-6 py-4 text-right font-black ${netBalance >= 0 ? 'text-indigo-700' : 'text-orange-700'}`}>
                        {netBalance < 0 ? '− ' : ''}Rs. {Math.abs(netBalance).toLocaleString()}
                      </td>
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
                    <Bar dataKey="Income"  fill="#10b981" radius={[4,4,0,0]} />
                    <Bar dataKey="Expense" fill="#ef4444" radius={[4,4,0,0]} />
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
                      <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Income</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Expense</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {[...dailyData].reverse().map(d => {
                      const net = d.Income - d.Expense;
                      return (
                        <tr key={d.date} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-6 py-3 font-black text-slate-700 text-xs">{formatDate(d.date)}</td>
                          <td className="px-6 py-3 text-right font-bold text-emerald-600">{d.Income > 0 ? `Rs. ${d.Income.toLocaleString()}` : '—'}</td>
                          <td className="px-6 py-3 text-right font-bold text-rose-600">{d.Expense > 0 ? `Rs. ${d.Expense.toLocaleString()}` : '—'}</td>
                          <td className={`px-6 py-3 text-right font-black text-xs ${net >= 0 ? 'text-indigo-600' : 'text-orange-600'}`}>
                            {net < 0 ? '− ' : ''}Rs. {Math.abs(net).toLocaleString()}
                          </td>
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
              <div className="bg-slate-50/50 border-b border-slate-100 px-8 py-5 flex items-center justify-between">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em]">All Transactions ({filteredTx.length})</h3>
                <div className="flex gap-1 bg-white border border-slate-100 rounded-xl p-1">
                  {(['all','income','expense'] as TxFilter[]).map(f => (
                    <button key={f} onClick={() => setTxFilter(f)}
                      className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${txFilter === f ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'}`}>
                      {f}
                    </button>
                  ))}
                </div>
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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredTx.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-3 text-slate-700 font-bold text-xs whitespace-nowrap">{formatDate(t.date)}</td>
                        <td className="px-6 py-3">
                          <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${t.type === 'income' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                            {t.type}
                          </span>
                        </td>
                        <td className="px-6 py-3"><span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-[9px] font-black uppercase tracking-widest">{t.category}</span></td>
                        <td className="px-6 py-3 text-slate-500 text-xs max-w-[220px] truncate" title={t.remarks}>{t.remarks || '—'}</td>
                        <td className="px-6 py-3 text-slate-400 text-xs font-medium">{t.payment_mode || '—'}</td>
                        <td className={`px-6 py-3 text-right font-black text-sm ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          Rs. {Number(t.amount).toLocaleString()}
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
    </div>
  );
}
