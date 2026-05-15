import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { TrendingUp, Download } from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';
import { PageHeader, Card, Btn, Input } from '../../components/ui';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';

interface MonthRow {
  month: string;
  income: number;
  expense: number;
  net: number;
}

function toYYYYMM(dateStr: string) {
  return dateStr.slice(0, 7);
}

export default function IncomeExpenseTrendReport() {
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState<MonthRow[]>([]);
  const [fromMonth, setFromMonth] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 11);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [toMonth, setToMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const fetchData = useCallback(async () => {
    if (!userRole?.school_id) return;
    setLoading(true);

    const fromDate = `${fromMonth}-01`;
    const [toYear, toMo] = toMonth.split('-');
    const toDate = new Date(Number(toYear), Number(toMo), 0).toISOString().split('T')[0];

    const { data } = await supabase
      .from('financial_transactions')
      .select('type, amount, date')
      .eq('school_id', userRole.school_id)
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('date');

    const map: Record<string, { income: number; expense: number }> = {};
    (data || []).forEach((t: any) => {
      const mo = toYYYYMM(t.date);
      if (!map[mo]) map[mo] = { income: 0, expense: 0 };
      if (t.type === 'income') map[mo].income += Number(t.amount);
      else map[mo].expense += Number(t.amount);
    });

    const sorted = Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        month,
        income: Math.round(v.income),
        expense: Math.round(v.expense),
        net: Math.round(v.income - v.expense),
      }));

    setChartData(sorted);
    setLoading(false);
  }, [userRole, fromMonth, toMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalIncome  = chartData.reduce((s, r) => s + r.income, 0);
  const totalExpense = chartData.reduce((s, r) => s + r.expense, 0);
  const totalNet     = totalIncome - totalExpense;

  const handleExportCSV = () => {
    exportToCSV('Income_Expense_Trend', chartData, [
      { header: 'Month', key: 'month' },
      { header: 'Income (Rs.)', key: 'income' },
      { header: 'Expense (Rs.)', key: 'expense' },
      { header: 'Net (Rs.)', key: 'net' },
    ]);
  };

  const fmtK = (v: number) =>
    v >= 100000 ? `${(v / 1000).toFixed(0)}K` : v.toLocaleString();

  return (
    <div className="space-y-5">
      <PageHeader title="Income vs Expense Trend" subtitle="Monthly financial performance overview" icon={TrendingUp} />

      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">From Month</label>
            <Input type="month" value={fromMonth} onChange={e => setFromMonth(e.target.value)} />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">To Month</label>
            <Input type="month" value={toMonth} onChange={e => setToMonth(e.target.value)} />
          </div>
          <Btn variant="secondary" icon={Download} onClick={handleExportCSV}>CSV</Btn>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Income', value: `Rs. ${totalIncome.toLocaleString()}`, color: 'text-emerald-600' },
          { label: 'Total Expense', value: `Rs. ${totalExpense.toLocaleString()}`, color: 'text-rose-600' },
          { label: 'Net Balance', value: `Rs. ${totalNet.toLocaleString()}`, color: totalNet >= 0 ? 'text-indigo-600' : 'text-rose-700' },
        ].map(s => (
          <Card key={s.label} className="p-4 text-center">
            <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">{s.label}</p>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-400">Loading...</div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-slate-400">No transactions in this period.</div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v: number) => `Rs. ${Number(v).toLocaleString()}`}
                labelStyle={{ fontWeight: 700 }}
              />
              <Legend />
              <Bar dataKey="income"  name="Income"  fill="#10b981" radius={[4,4,0,0]} />
              <Bar dataKey="expense" name="Expense" fill="#f43f5e" radius={[4,4,0,0]} />
              <Line dataKey="net" name="Net" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} type="monotone" />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </Card>

      {chartData.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Month', 'Income', 'Expense', 'Net'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {chartData.map(r => (
                  <tr key={r.month} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-700">{r.month}</td>
                    <td className="px-4 py-3 text-emerald-600 font-semibold">Rs. {r.income.toLocaleString()}</td>
                    <td className="px-4 py-3 text-rose-600 font-semibold">Rs. {r.expense.toLocaleString()}</td>
                    <td className={`px-4 py-3 font-bold ${r.net >= 0 ? 'text-indigo-600' : 'text-rose-700'}`}>
                      Rs. {r.net.toLocaleString()}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td className="px-4 py-3 font-black text-slate-700">Total</td>
                  <td className="px-4 py-3 font-black text-emerald-700">Rs. {totalIncome.toLocaleString()}</td>
                  <td className="px-4 py-3 font-black text-rose-700">Rs. {totalExpense.toLocaleString()}</td>
                  <td className={`px-4 py-3 font-black ${totalNet >= 0 ? 'text-indigo-700' : 'text-rose-800'}`}>
                    Rs. {totalNet.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
