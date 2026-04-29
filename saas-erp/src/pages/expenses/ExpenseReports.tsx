import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { FileBarChart, Download, Calendar } from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];

export default function ExpenseReports() {
  const { userRole } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateType, setDateType] = useState('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [chartView, setChartView] = useState<'category' | 'trend'>('category');

  useEffect(() => {
    if (userRole?.school_id) fetchData();
  }, [userRole, dateType, customStart, customEnd]);

  const fetchData = async () => {
    setLoading(true);
    const sid = userRole!.school_id;
    let query = supabase.from('financial_transactions').select('*').eq('school_id', sid).eq('type', 'expense').order('date', { ascending: true });

    const today = new Date();
    if (dateType === 'today') {
      const d = today.toISOString().split('T')[0];
      query = query.gte('date', d).lte('date', d);
    } else if (dateType === 'month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      query = query.gte('date', start).lte('date', today.toISOString().split('T')[0]);
    } else if (dateType === 'year') {
      const start = `${today.getFullYear()}-01-01`;
      query = query.gte('date', start).lte('date', today.toISOString().split('T')[0]);
    } else if (dateType === 'custom' && customStart && customEnd) {
      query = query.gte('date', customStart).lte('date', customEnd);
    }

    const { data } = await query;
    setTransactions(data || []);
    setLoading(false);
  };

  // Aggregate by category
  const byCategory: Record<string, number> = {};
  transactions.forEach(t => { byCategory[t.category] = (byCategory[t.category] || 0) + Number(t.amount); });
  const categoryData = Object.entries(byCategory).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  // Aggregate by date (daily trend)
  const byDate: Record<string, number> = {};
  transactions.forEach(t => { byDate[t.date] = (byDate[t.date] || 0) + Number(t.amount); });
  const trendData = Object.entries(byDate).map(([date, Amount]) => ({ date, Amount }));

  const total = transactions.reduce((s, t) => s + Number(t.amount), 0);
  const topCategory = categoryData[0];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileBarChart className="w-6 h-6 text-red-600" /> Expense Reports
          </h1>
          <p className="text-gray-500 text-sm mt-1">Analyze expenses by category and time period.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white border border-gray-300 rounded-lg p-1 shadow-sm">
            {[['today', 'Today'], ['month', 'This Month'], ['year', 'This Year'], ['custom', 'Custom']].map(([val, label]) => (
              <button key={val} onClick={() => setDateType(val)}
                className={`px-3 py-1.5 text-xs font-medium rounded ${dateType === val ? 'bg-red-50 text-red-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                {label}
              </button>
            ))}
          </div>
          <button onClick={() => exportToCSV('expense-report', transactions, [
            { header: 'Date', key: 'date' }, { header: 'Category', key: 'category' },
            { header: 'Amount', key: 'amount' }, { header: 'Mode', key: 'payment_mode' }, { header: 'Remarks', key: 'remarks' },
          ])} className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {dateType === 'custom' && (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex gap-4 items-center">
          <Calendar className="w-4 h-4 text-gray-400" />
          <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="border border-gray-300 px-3 py-1.5 rounded text-sm focus:ring-red-500" />
          <span className="text-gray-400">to</span>
          <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="border border-gray-300 px-3 py-1.5 rounded text-sm focus:ring-red-500" />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Expenses</p>
          <p className="text-2xl font-black text-red-600 mt-1">Rs. {total.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Transactions</p>
          <p className="text-2xl font-black text-gray-800 mt-1">{transactions.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Top Category</p>
          <p className="text-lg font-bold text-gray-800 mt-1">{topCategory?.name || '—'}</p>
          {topCategory && <p className="text-sm text-red-600 font-mono">Rs. {topCategory.value.toLocaleString()}</p>}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-w-0">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-800">Expense Analysis</h2>
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button onClick={() => setChartView('category')} className={`px-3 py-1 text-xs rounded-md font-medium ${chartView === 'category' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>By Category</button>
            <button onClick={() => setChartView('trend')} className={`px-3 py-1 text-xs rounded-md font-medium ${chartView === 'trend' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>Daily Trend</button>
          </div>
        </div>

        {loading ? <div className="p-12 text-center text-gray-400">Loading...</div> :
          transactions.length === 0 ? <div className="p-12 text-center text-gray-400">No expense data for this period.</div> : (
            <div className="p-6">
              {chartView === 'category' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="h-72 min-w-0">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <PieChart>
                      <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={110} dataKey="value" nameKey="name" paddingAngle={2}>
                        {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => `Rs. ${v.toLocaleString()}`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                  </div>
                  <div className="space-y-2">
                    {categoryData.map((c, i) => (
                      <div key={c.name} className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium text-gray-800 truncate">{c.name}</span>
                            <span className="font-mono text-gray-700 ml-2 flex-shrink-0">Rs. {c.value.toLocaleString()}</span>
                          </div>
                          <div className="mt-1 bg-gray-100 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full" style={{ width: `${(c.value / total) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                          </div>
                        </div>
                        <span className="text-xs text-gray-400 w-10 text-right">{((c.value / total) * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-72 min-w-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={trendData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `Rs.${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => `Rs. ${v.toLocaleString()}`} />
                    <Bar dataKey="Amount" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
      </div>

      {/* Detail Table */}
      {transactions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200"><h2 className="font-semibold text-gray-800">Transaction Details</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Date</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Category</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Remarks</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Mode</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {[...transactions].reverse().map(t => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-gray-500">{t.date}</td>
                    <td className="px-6 py-3"><span className="px-2 py-1 text-xs rounded-full bg-red-50 text-red-700 font-medium">{t.category}</span></td>
                    <td className="px-6 py-3 text-gray-600">{t.remarks || '—'}</td>
                    <td className="px-6 py-3 text-gray-500">{t.payment_mode}</td>
                    <td className="px-6 py-3 text-right font-mono font-medium text-gray-900">Rs. {Number(t.amount).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
