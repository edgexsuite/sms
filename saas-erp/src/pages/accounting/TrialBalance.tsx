import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Scale, Download, Printer } from 'lucide-react';
import { exportToExcel } from '../../lib/exportUtils';

interface TBRow {
  account: string;
  type: 'income' | 'expense';
  debit: number;
  credit: number;
}

export default function TrialBalance() {
  const { userRole } = useAuth();
  const [rows, setRows] = useState<TBRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [asOf, setAsOf] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (userRole?.school_id) fetchData();
  }, [userRole, asOf]);

  const fetchData = async () => {
    setLoading(true);
    const sid = userRole!.school_id;

    const { data: txns } = await supabase
      .from('financial_transactions')
      .select('type, category, amount, date')
      .eq('school_id', sid)
      .lte('date', asOf);

    // Group by category + type
    const map: Record<string, TBRow> = {};
    (txns || []).forEach((t: any) => {
      const key = `${t.type}__${t.category || 'General'}`;
      if (!map[key]) map[key] = { account: t.category || 'General', type: t.type, debit: 0, credit: 0 };
      if (t.type === 'income') map[key].credit += t.amount || 0;
      else map[key].debit += t.amount || 0;
    });

    setRows(
      Object.values(map).sort((a, b) =>
        a.type !== b.type ? (a.type === 'income' ? -1 : 1) : a.account.localeCompare(b.account)
      )
    );
    setLoading(false);
  };

  const totalDr = rows.reduce((s, r) => s + r.debit, 0);
  const totalCr = rows.reduce((s, r) => s + r.credit, 0);
  const net = totalCr - totalDr;

  const cols = [
    { header: 'Account', key: 'account' },
    { header: 'Type', key: 'type' },
    { header: 'Debit (Expenses)', key: 'debit' },
    { header: 'Credit (Income)', key: 'credit' },
  ];

  if (loading) return <div className="p-12 text-center text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6">
      <style>{`@media print { .no-print { display:none!important; } }`}</style>

      {/* Header */}
      <div className="no-print flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Scale className="w-6 h-6 text-violet-600" /> Trial Balance
          </h1>
          <p className="text-gray-500 text-sm mt-1">Income and expense account balances as of a given date.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">As of Date</label>
            <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500" />
          </div>
          {rows.length > 0 && (
            <>
              <button onClick={() => exportToExcel(`trial-balance-${asOf}`, rows, cols)}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 mt-4">
                <Download className="w-4 h-4" /> Excel
              </button>
              <button onClick={() => window.print()}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 mt-4">
                <Printer className="w-4 h-4" /> Print
              </button>
            </>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center text-gray-400">
          <Scale className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p>No transactions found up to this date.</p>
          <p className="text-sm mt-1">Record income and expenses to see the trial balance.</p>
        </div>
      ) : (
        <>
          {/* Summary banner */}
          <div className={`rounded-xl p-4 flex items-start gap-3 ${net >= 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <Scale className={`w-5 h-5 mt-0.5 shrink-0 ${net >= 0 ? 'text-green-600' : 'text-red-600'}`} />
            <div>
              <p className={`font-semibold text-sm ${net >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                Net {net >= 0 ? 'Surplus' : 'Deficit'}: Rs. {Math.abs(net).toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Total Income: Rs. {totalCr.toLocaleString()} &nbsp;|&nbsp; Total Expenses: Rs. {totalDr.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">Account / Category</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500 w-28">Type</th>
                  <th className="px-5 py-3 text-right font-medium text-red-600 w-40">Debit (Expenses)</th>
                  <th className="px-5 py-3 text-right font-medium text-green-700 w-40">Credit (Income)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {/* Income section */}
                {rows.some(r => r.type === 'income') && (
                  <tr>
                    <td colSpan={4} className="px-5 py-2 bg-green-50 text-xs font-black text-green-700 uppercase tracking-wider">
                      Income
                    </td>
                  </tr>
                )}
                {rows.filter(r => r.type === 'income').map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-5 py-3 text-gray-900">{r.account}</td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">Income</span>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-300">—</td>
                    <td className="px-5 py-3 text-right font-semibold text-green-700">Rs. {r.credit.toLocaleString()}</td>
                  </tr>
                ))}

                {/* Expense section */}
                {rows.some(r => r.type === 'expense') && (
                  <tr>
                    <td colSpan={4} className="px-5 py-2 bg-red-50 text-xs font-black text-red-700 uppercase tracking-wider">
                      Expenses
                    </td>
                  </tr>
                )}
                {rows.filter(r => r.type === 'expense').map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-5 py-3 text-gray-900">{r.account}</td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">Expense</span>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-red-700">Rs. {r.debit.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right text-gray-300">—</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                <tr>
                  <td className="px-5 py-3 font-bold text-gray-800" colSpan={2}>Totals</td>
                  <td className="px-5 py-3 text-right font-bold text-red-700 text-base">Rs. {totalDr.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right font-bold text-green-700 text-base">Rs. {totalCr.toLocaleString()}</td>
                </tr>
                <tr className={net >= 0 ? 'bg-green-50' : 'bg-red-50'}>
                  <td className={`px-5 py-3 font-black text-base ${net >= 0 ? 'text-green-800' : 'text-red-800'}`} colSpan={2}>
                    Net {net >= 0 ? 'Surplus' : 'Deficit'}
                  </td>
                  <td className={`px-5 py-3 text-right font-black text-base ${net >= 0 ? 'text-green-800' : 'text-red-800'}`} colSpan={2}>
                    Rs. {Math.abs(net).toLocaleString()}
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
