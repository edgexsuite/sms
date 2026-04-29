import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { TrendingUp, Download, Printer } from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';
import { formatDate } from '../../lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';

interface MonthRow {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

const PIE_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16'];

export default function ProfitLoss() {
  const { userRole } = useAuth();
  const [rows, setRows] = useState<MonthRow[]>([]);
  const [incomeTxns, setIncomeTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (userRole?.school_id) fetchData();
  }, [userRole, year]);

  const fetchData = async () => {
    setLoading(true);
    const sid = userRole!.school_id;
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const [{ data: expData }, { data: incData }] = await Promise.all([
      supabase.from('financial_transactions').select('date, amount').eq('school_id', sid).eq('type', 'expense').gte('date', startDate).lte('date', endDate),
      supabase.from('financial_transactions').select('date, amount, fee_items').eq('school_id', sid).eq('type', 'income').gte('date', startDate).lte('date', endDate),
    ]);

    setIncomeTxns(incData || []);

    const monthlyData: Record<number, MonthRow> = {};
    for (let m = 1; m <= 12; m++) {
      const label = formatDate(new Date(year, m - 1, 1));
      monthlyData[m] = { month: label, income: 0, expenses: 0, net: 0 };
    }

    expData?.forEach(e => {
      const m = new Date(e.date).getMonth() + 1;
      if (monthlyData[m]) monthlyData[m].expenses += Number(e.amount);
    });

    incData?.forEach(i => {
      const m = new Date(i.date).getMonth() + 1;
      if (monthlyData[m]) monthlyData[m].income += Number(i.amount);
    });

    const result = Object.values(monthlyData).map(r => ({ ...r, net: r.income - r.expenses }));
    setRows(result);
    setLoading(false);
  };

  // Aggregate fee_items JSONB for income breakdown by type
  const feeItemTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    incomeTxns.forEach(tx => {
      if (Array.isArray(tx.fee_items) && tx.fee_items.length > 0) {
        tx.fee_items.forEach((fi: { item: string; amount: number }) => {
          totals[fi.item] = (totals[fi.item] || 0) + (Number(fi.amount) || 0);
        });
      } else {
        // Transactions without breakdown → bucket as "Other Income"
        totals['Other Income'] = (totals['Other Income'] || 0) + Number(tx.amount);
      }
    });
    return Object.entries(totals)
      .map(([item, amount]) => ({ item, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [incomeTxns]);

  const totalIncome = rows.reduce((s, r) => s + r.income, 0);
  const totalExpenses = rows.reduce((s, r) => s + r.expenses, 0);
  const netProfit = totalIncome - totalExpenses;
  const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-6">
      <style>{`@media print { .no-print { display: none !important; } body { background: white; } }`}</style>

      <div className="flex justify-between items-start no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-emerald-600" /> Profit & Loss Statement
          </h1>
          <p className="text-gray-500 text-sm mt-1">Annual income vs expenses breakdown by month.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">Year:</label>
            <select value={year} onChange={e => setYear(parseInt(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500">
              {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button onClick={() => exportToCSV(`p-and-l-${year}`, rows, [
            { header: 'Month', key: 'month' }, { header: 'Income (Rs.)', key: 'income' },
            { header: 'Expenses (Rs.)', key: 'expenses' }, { header: 'Net (Rs.)', key: 'net' },
          ])} className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Income</p>
          <p className="text-2xl font-black text-green-600 mt-1">Rs. {totalIncome.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Expenses</p>
          <p className="text-2xl font-black text-red-600 mt-1">Rs. {totalExpenses.toLocaleString()}</p>
        </div>
        <div className={`rounded-xl shadow-sm border p-5 ${netProfit >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Net {netProfit >= 0 ? 'Surplus' : 'Deficit'}</p>
          <p className={`text-2xl font-black mt-1 ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            Rs. {Math.abs(netProfit).toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Margin</p>
          <p className={`text-2xl font-black mt-1 ${profitMargin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {profitMargin.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 no-print">
        {loading ? <div className="h-64 flex items-center justify-center text-gray-400">Loading...</div> : (
          <ResponsiveContainer width="100%" height={280} minWidth={0}>
            <BarChart data={rows} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `Rs.${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => `Rs. ${v.toLocaleString()}`} />
              <Legend />
              <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Fee Income Breakdown by Type */}
      {feeItemTotals.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Income Breakdown by Fee Type — {year}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pie chart */}
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={220} minWidth={0}>
                <PieChart>
                  <Pie data={feeItemTotals} dataKey="amount" nameKey="item" cx="50%" cy="50%" outerRadius={90} label={({ item, percent }) => `${item} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {feeItemTotals.map((_, idx) => <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `Rs. ${v.toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Item list */}
            <div className="space-y-2">
              {feeItemTotals.map((fi, idx) => {
                const pct = totalIncome > 0 ? (fi.amount / totalIncome) * 100 : 0;
                return (
                  <div key={fi.item} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-gray-700 truncate">{fi.item}</span>
                        <span className="text-gray-500 ml-2">Rs. {fi.amount.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full">
                        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 w-10 text-right">{pct.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* P&L Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="font-semibold text-gray-800">Monthly Breakdown — {year}</h2>
        </div>
        {loading ? <div className="p-12 text-center text-gray-400">Loading...</div> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Month</th>
                <th className="px-6 py-3 text-right font-medium text-gray-500">Income (Rs.)</th>
                <th className="px-6 py-3 text-right font-medium text-gray-500">Expenses (Rs.)</th>
                <th className="px-6 py-3 text-right font-medium text-gray-500">Net (Rs.)</th>
                <th className="px-6 py-3 text-right font-medium text-gray-500">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.map(r => {
                const margin = r.income > 0 ? (r.net / r.income) * 100 : 0;
                const hasData = r.income > 0 || r.expenses > 0;
                return (
                  <tr key={r.month} className={`hover:bg-gray-50 ${!hasData ? 'opacity-40' : ''}`}>
                    <td className="px-6 py-3 font-medium text-gray-900">{r.month} {year}</td>
                    <td className="px-6 py-3 text-right font-mono text-green-700">{hasData ? `Rs. ${r.income.toLocaleString()}` : '—'}</td>
                    <td className="px-6 py-3 text-right font-mono text-red-700">{hasData ? `Rs. ${r.expenses.toLocaleString()}` : '—'}</td>
                    <td className={`px-6 py-3 text-right font-mono font-bold ${r.net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {hasData ? (r.net >= 0 ? `+Rs. ${r.net.toLocaleString()}` : `-Rs. ${Math.abs(r.net).toLocaleString()}`) : '—'}
                    </td>
                    <td className="px-6 py-3 text-right">
                      {hasData ? (
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${margin >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                          {margin.toFixed(1)}%
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
              {/* Totals row */}
              <tr className="bg-gray-50 font-bold border-t-2 border-gray-300">
                <td className="px-6 py-4 text-gray-900">TOTAL {year}</td>
                <td className="px-6 py-4 text-right font-mono text-green-700">Rs. {totalIncome.toLocaleString()}</td>
                <td className="px-6 py-4 text-right font-mono text-red-700">Rs. {totalExpenses.toLocaleString()}</td>
                <td className={`px-6 py-4 text-right font-mono ${netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {netProfit >= 0 ? `+Rs. ${netProfit.toLocaleString()}` : `-Rs. ${Math.abs(netProfit).toLocaleString()}`}
                </td>
                <td className="px-6 py-4 text-right">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${profitMargin >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                    {profitMargin.toFixed(1)}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
