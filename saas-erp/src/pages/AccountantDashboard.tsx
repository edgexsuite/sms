import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import {
  CreditCard, Wallet, TrendingUp, BarChart2,
  DollarSign, ChevronRight, Scale, PiggyBank,
  CalendarDays, AlertCircle, CheckCircle2, ArrowUpRight
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';

export default function AccountantDashboard() {
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [feeSummary, setFeeSummary] = useState({ collected: 0, pending: 0, todayCollected: 0, totalInvoices: 0 });
  const [expenseSummary, setExpenseSummary] = useState({ thisMonth: 0, topCategories: [] as { category: string; amount: number }[] });
  const [monthlyChart, setMonthlyChart] = useState<{ month: string; income: number; expense: number }[]>([]);

  const today = new Date().toISOString().split('T')[0];
  const thisMonth = today.slice(0, 7);

  useEffect(() => {
    if (userRole?.school_id) loadData();
  }, [userRole]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchFeeSummary(), fetchExpenseSummary(), fetchMonthlyChart()]);
    setLoading(false);
  };

  const fetchFeeSummary = async () => {
    const { data } = await supabase
      .from('fee_records')
      .select('total_amount, paid_amount, status, created_at')
      .eq('school_id', userRole?.school_id);

    if (!data) return;
    const collected = data.reduce((s, r) => s + (r.paid_amount || 0), 0);
    const pending = data.reduce((s, r) => s + ((r.total_amount || 0) - (r.paid_amount || 0)), 0);
    const todayCollected = data
      .filter(r => r.created_at?.startsWith(today))
      .reduce((s, r) => s + (r.paid_amount || 0), 0);
    setFeeSummary({ collected, pending: Math.max(0, pending), todayCollected, totalInvoices: data.length });
  };

  const fetchExpenseSummary = async () => {
    const { data } = await supabase
      .from('financial_transactions')
      .select('amount, category, type')
      .eq('school_id', userRole?.school_id)
      .eq('type', 'expense')
      .gte('date', `${thisMonth}-01`);

    if (!data) return;
    const thisMonth_ = data.reduce((s, r) => s + (r.amount || 0), 0);
    const catMap = new Map<string, number>();
    data.forEach(r => {
      const cat = r.category || 'General';
      catMap.set(cat, (catMap.get(cat) || 0) + (r.amount || 0));
    });
    const topCategories = Array.from(catMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, amount]) => ({ category, amount }));
    setExpenseSummary({ thisMonth: thisMonth_, topCategories });
  };

  const fetchMonthlyChart = async () => {
    // Last 6 months
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push(d.toISOString().slice(0, 7));
    }
    const startDate = `${months[0]}-01`;

    const [{ data: fees }, { data: expenses }] = await Promise.all([
      supabase.from('fee_records').select('paid_amount, created_at').eq('school_id', userRole?.school_id).gte('created_at', startDate),
      supabase.from('financial_transactions').select('amount, date, type').eq('school_id', userRole?.school_id).eq('type', 'expense').gte('date', startDate),
    ]);

    const incomeMap = new Map<string, number>();
    const expenseMap = new Map<string, number>();
    months.forEach(m => { incomeMap.set(m, 0); expenseMap.set(m, 0); });

    (fees || []).forEach((r: any) => {
      const m = r.created_at?.slice(0, 7);
      if (m && incomeMap.has(m)) incomeMap.set(m, incomeMap.get(m)! + (r.paid_amount || 0));
    });
    (expenses || []).forEach((r: any) => {
      const m = r.date?.slice(0, 7);
      if (m && expenseMap.has(m)) expenseMap.set(m, expenseMap.get(m)! + (r.amount || 0));
    });

    setMonthlyChart(months.map(m => ({
      month: new Date(m + '-01').toLocaleDateString('en-PK', { month: 'short' }),
      income: Math.round(incomeMap.get(m) || 0),
      expense: Math.round(expenseMap.get(m) || 0),
    })));
  };

  const fmt = (n: number) => `Rs. ${n.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;

  if (loading) return (
    <div className="flex items-center justify-center p-20">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-500 font-medium">Loading financial data...</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-6 text-white shadow-xl shadow-emerald-200">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <p className="text-emerald-200 text-sm font-medium">Accountant Dashboard</p>
            <h1 className="text-2xl font-black mt-1 flex items-center gap-2">
              <Scale className="w-7 h-7" /> Financial Overview
            </h1>
            <p className="text-emerald-200 text-xs mt-2">
              {new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Link to="/fees/invoices" className="flex items-center gap-2 bg-white text-emerald-700 font-bold px-4 py-2 rounded-xl text-sm hover:bg-emerald-50 transition shadow">
              <CreditCard className="w-4 h-4" /> Fee Invoices
            </Link>
            <Link to="/expenses/add-daily" className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-4 py-2 rounded-xl text-sm transition">
              <Wallet className="w-4 h-4" /> Add Expense
            </Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Collected', value: fmt(feeSummary.collected), icon: CheckCircle2, color: 'emerald', sub: `${feeSummary.totalInvoices} invoices` },
          { label: 'Pending Amount', value: fmt(feeSummary.pending), icon: AlertCircle, color: 'amber', sub: 'outstanding fees' },
          { label: "Today's Collection", value: fmt(feeSummary.todayCollected), icon: TrendingUp, color: 'blue', sub: today },
          { label: 'This Month Expenses', value: fmt(expenseSummary.thisMonth), icon: Wallet, color: 'red', sub: thisMonth },
        ].map(({ label, value, icon: Icon, color, sub }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className={`w-9 h-9 rounded-lg bg-${color}-100 flex items-center justify-center mb-3`}>
              <Icon className={`w-5 h-5 text-${color}-600`} />
            </div>
            <p className="text-xl font-black text-gray-900 leading-tight">{value}</p>
            <p className="text-xs text-gray-500 font-medium mt-0.5">{label}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Monthly chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="font-black text-gray-900 mb-4 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-emerald-600" /> 6-Month Income vs Expenses
          </h2>
          <ResponsiveContainer width="100%" height={220} minWidth={0}>
            <BarChart data={monthlyChart} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [`Rs. ${v.toLocaleString()}`, '']} />
              <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 justify-center">
            <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-3 h-3 bg-emerald-500 rounded-sm inline-block" /> Income</span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-3 h-3 bg-red-400 rounded-sm inline-block" /> Expenses</span>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">

          {/* Top expense categories */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="font-black text-gray-900 text-sm mb-3 flex items-center gap-2">
              <PiggyBank className="w-4 h-4 text-amber-500" /> Top Expense Categories
            </h3>
            {expenseSummary.topCategories.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">No expenses this month.</p>
            ) : (
              <div className="space-y-2">
                {expenseSummary.topCategories.map(({ category, amount }) => (
                  <div key={category} className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700 truncate max-w-[120px]">{category}</span>
                    <span className="text-xs font-black text-gray-900">{fmt(amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-5 text-white space-y-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 mb-3">Quick Actions</h3>
            {[
              { to: '/fees/invoices', icon: CreditCard, label: 'Fee Invoices' },
              { to: '/fees/student-detail', icon: DollarSign, label: 'Student Ledgers' },
              { to: '/payroll', icon: Scale, label: 'Process Payroll' },
              { to: '/expenses/ledger', icon: TrendingUp, label: 'Day Book / Ledger' },
              { to: '/reports/master-summary', icon: BarChart2, label: 'Financial Reports' },
              { to: '/accounting/trial-balance', icon: Scale, label: 'Trial Balance' },
            ].map(({ to, icon: Icon, label }) => (
              <Link key={to} to={to} className="flex items-center justify-between px-3 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition">
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 text-slate-300" />
                  <span className="text-sm font-bold">{label}</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
