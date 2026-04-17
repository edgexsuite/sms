import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { BarChart2, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { exportToExcel, exportToPDF } from '../../lib/exportUtils';

export default function PayrollReports() {
  const { userRole } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (userRole?.school_id) fetchRecords();
  }, [userRole, year]);

  const fetchRecords = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('payroll_records')
      .select('*, staff:staff_id(full_name, role, department)')
      .eq('school_id', userRole!.school_id)
      .gte('month_year', `${year}-01-01`)
      .lte('month_year', `${year}-12-31`)
      .order('month_year');
    setRecords(data || []);
    setLoading(false);
  };

  // Monthly totals chart data
  const monthlyTotals = Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, '0');
    const key = `${year}-${m}`;
    const monthRecords = records.filter(r => r.month_year?.startsWith(key));
    return {
      month: new Date(year, i, 1).toLocaleString('default', { month: 'short' }),
      net: monthRecords.reduce((s, r) => s + (r.net_salary || 0), 0),
      count: monthRecords.length,
    };
  }).filter(m => m.count > 0);

  // Staff-wise annual summary
  const staffSummary = Object.values(
    records.reduce((acc: any, r) => {
      const id = r.staff_id;
      if (!acc[id]) acc[id] = { name: r.staff?.full_name, designation: r.staff?.role || r.designation || '', months: 0, total: 0 };
      acc[id].months++;
      acc[id].total += r.net_salary || 0;
      return acc;
    }, {})
  ) as { name: string; designation: string; months: number; total: number }[];

  const cols = [
    { header: 'Staff', key: 'name' }, { header: 'Designation', key: 'designation' },
    { header: 'Months Paid', key: 'months' }, { header: 'Annual Total', key: 'total' },
  ];

  if (loading) return <div className="p-12 text-center text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-emerald-600" /> Payroll Reports
          </h1>
          <p className="text-gray-500 text-sm mt-1">Annual payroll summary and staff-wise breakdown.</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={year} onChange={e => setYear(parseInt(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500">
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {staffSummary.length > 0 && (
            <>
              <button onClick={() => exportToExcel(`payroll-report-${year}`, staffSummary, cols)}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
                <Download className="w-4 h-4" /> Excel
              </button>
              <button onClick={() => exportToPDF(`payroll-report-${year}`, staffSummary, cols, `Payroll Report ${year}`)}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
                <Download className="w-4 h-4" /> PDF
              </button>
            </>
          )}
        </div>
      </div>

      {records.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center text-gray-400">
          <BarChart2 className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p>No payroll data for {year}.</p>
        </div>
      ) : (
        <>
          {/* Monthly Chart */}
          {monthlyTotals.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 min-w-0">
              <h2 className="font-semibold text-gray-800 mb-4">Monthly Net Payroll — {year}</h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={monthlyTotals}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={v => v.toLocaleString()} />
                    <Tooltip formatter={(v: any) => v.toLocaleString()} />
                    <Bar dataKey="net" fill="#10b981" radius={[4, 4, 0, 0]} name="Net Payroll" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Annual total cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Annual Payroll</p>
              <p className="text-2xl font-black text-emerald-600 mt-1">
                {records.reduce((s, r) => s + (r.net_salary || 0), 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Months Processed</p>
              <p className="text-2xl font-black text-gray-800 mt-1">{monthlyTotals.length}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Staff Paid</p>
              <p className="text-2xl font-black text-gray-800 mt-1">{new Set(records.map(r => r.staff_id)).size}</p>
            </div>
          </div>

          {/* Staff-wise Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-800">Staff-wise Annual Summary</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Staff Name</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Designation</th>
                  <th className="px-6 py-3 text-center font-medium text-gray-500">Months Paid</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500">Annual Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {staffSummary.map((s, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{s.name}</td>
                    <td className="px-6 py-4 text-gray-500">{s.designation}</td>
                    <td className="px-6 py-4 text-center text-gray-600">{s.months}</td>
                    <td className="px-6 py-4 text-right font-semibold text-gray-900">{s.total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                <tr>
                  <td className="px-6 py-3 font-bold text-gray-800" colSpan={3}>Grand Total</td>
                  <td className="px-6 py-3 text-right font-bold text-gray-900">
                    {staffSummary.reduce((s, r) => s + r.total, 0).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
