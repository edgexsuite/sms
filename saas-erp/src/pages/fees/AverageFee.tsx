import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { BarChart2, Download } from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ClassAvg {
  class_name: string;
  total_billed: number;
  total_collected: number;
  record_count: number;
  avg_collection: number;
  collection_rate: number;
}

export default function AverageFee() {
  const { userRole } = useAuth();
  const [classData, setClassData] = useState<ClassAvg[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'class' | 'monthly'>('class');

  useEffect(() => {
    if (userRole?.school_id) fetchData();
  }, [userRole]);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('fee_records')
      .select('total_amount, paid_amount, month_year, student:student_id(class:class_id(name, section))')
      .eq('school_id', userRole!.school_id)
      .order('month_year', { ascending: true });

    if (!data) { setLoading(false); return; }

    // Aggregate by class
    const byClass: Record<string, ClassAvg> = {};
    const byMonth: Record<string, { month: string; billed: number; collected: number; count: number }> = {};

    data.forEach((r: any) => {
      const className = r.student?.class ? `${r.student.class.name}-${r.student.class.section}` : 'Unknown';
      if (!byClass[className]) byClass[className] = { class_name: className, total_billed: 0, total_collected: 0, record_count: 0, avg_collection: 0, collection_rate: 0 };
      byClass[className].total_billed += Number(r.total_amount);
      byClass[className].total_collected += Number(r.paid_amount);
      byClass[className].record_count += 1;

      const month = r.month_year?.slice(0, 7) || '';
      if (!byMonth[month]) byMonth[month] = { month, billed: 0, collected: 0, count: 0 };
      byMonth[month].billed += Number(r.total_amount);
      byMonth[month].collected += Number(r.paid_amount);
      byMonth[month].count += 1;
    });

    const classArr = Object.values(byClass).map(c => ({
      ...c,
      avg_collection: c.record_count > 0 ? c.total_collected / c.record_count : 0,
      collection_rate: c.total_billed > 0 ? (c.total_collected / c.total_billed) * 100 : 0,
    })).sort((a, b) => b.total_collected - a.total_collected);

    const monthArr = Object.values(byMonth).map(m => ({
      month: m.month,
      Billed: Math.round(m.billed),
      Collected: Math.round(m.collected),
      'Avg per Student': m.count > 0 ? Math.round(m.collected / m.count) : 0,
    })).sort((a, b) => a.month.localeCompare(b.month));

    setClassData(classArr);
    setMonthlyData(monthArr);
    setLoading(false);
  };

  const overallAvg = classData.length > 0
    ? classData.reduce((s, c) => s + c.total_collected, 0) / classData.reduce((s, c) => s + c.record_count, 0)
    : 0;
  const overallRate = classData.reduce((s, c) => s + c.total_billed, 0) > 0
    ? (classData.reduce((s, c) => s + c.total_collected, 0) / classData.reduce((s, c) => s + c.total_billed, 0)) * 100
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-purple-600" /> Average Fee Report
          </h1>
          <p className="text-gray-500 text-sm mt-1">Collection averages and rates by class and month.</p>
        </div>
        <button onClick={() => exportToCSV('average-fee-report', classData, [
          { header: 'Class', key: 'class_name' },
          { header: 'Records', key: 'record_count' },
          { header: 'Total Billed', key: 'total_billed' },
          { header: 'Total Collected', key: 'total_collected' },
          { header: 'Avg Collection', key: (r: ClassAvg) => Math.round(r.avg_collection) },
          { header: 'Collection Rate %', key: (r: ClassAvg) => r.collection_rate.toFixed(1) },
        ])} className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-500">Overall Avg per Record</p>
          <p className="text-3xl font-black text-purple-600 mt-1">Rs. {Math.round(overallAvg).toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-500">Overall Collection Rate</p>
          <p className="text-3xl font-black text-green-600 mt-1">{overallRate.toFixed(1)}%</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-500">Classes Tracked</p>
          <p className="text-3xl font-black text-gray-800 mt-1">{classData.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-800">Fee Collection Analysis</h2>
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button onClick={() => setView('class')} className={`px-3 py-1 text-sm rounded-md font-medium ${view === 'class' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>By Class</button>
            <button onClick={() => setView('monthly')} className={`px-3 py-1 text-sm rounded-md font-medium ${view === 'monthly' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>Monthly</button>
          </div>
        </div>

        {loading ? <div className="p-12 text-center text-gray-400">Loading...</div> : (
          view === 'class' ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Class</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500">Records</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500">Total Billed</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500">Total Collected</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500">Avg / Record</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500">Collection Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {classData.map(c => (
                  <tr key={c.class_name} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{c.class_name}</td>
                    <td className="px-6 py-4 text-right text-gray-600">{c.record_count}</td>
                    <td className="px-6 py-4 text-right font-mono text-gray-700">Rs. {c.total_billed.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-mono text-green-700 font-medium">Rs. {c.total_collected.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-mono text-purple-700 font-medium">Rs. {Math.round(c.avg_collection).toLocaleString()}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.collection_rate >= 80 ? 'bg-green-100 text-green-800' : c.collection_rate >= 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                        {c.collection_rate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-6">
              <ResponsiveContainer width="100%" height={320} minWidth={0} minHeight={0}>
                <BarChart data={monthlyData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `Rs.${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => `Rs. ${v.toLocaleString()}`} />
                  <Bar dataKey="Billed" fill="#e0e7ff" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Collected" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )
        )}
      </div>
    </div>
  );
}
