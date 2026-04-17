import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { BarChart2, Printer } from 'lucide-react';

export default function BalanceSheet() {
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [asOf, setAsOf] = useState(new Date().toISOString().split('T')[0]);
  const [schoolName, setSchoolName] = useState('School');

  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [feeReceivables, setFeeReceivables] = useState(0);
  const [incomeByCategory, setIncomeByCategory] = useState<{ name: string; amount: number }[]>([]);
  const [expenseByCategory, setExpenseByCategory] = useState<{ name: string; amount: number }[]>([]);

  useEffect(() => {
    if (userRole?.school_id) {
      fetchSchool();
      fetchData();
    }
  }, [userRole, asOf]);

  const fetchSchool = async () => {
    const { data } = await supabase.from('schools').select('name').eq('id', userRole!.school_id).maybeSingle();
    setSchoolName(data?.name || 'School');
  };

  const fetchData = async () => {
    setLoading(true);
    const sid = userRole!.school_id;

    const [{ data: txns }, { data: pending }] = await Promise.all([
      supabase
        .from('financial_transactions')
        .select('type, category, amount, date')
        .eq('school_id', sid)
        .lte('date', asOf),
      supabase
        .from('fee_records')
        .select('total_amount, paid_amount, status')
        .eq('school_id', sid)
        .in('status', ['pending', 'overdue', 'partial']),
    ]);

    const incMap: Record<string, number> = {};
    const expMap: Record<string, number> = {};
    let totInc = 0, totExp = 0;

    (txns || []).forEach((t: any) => {
      const cat = t.category || 'General';
      if (t.type === 'income') { incMap[cat] = (incMap[cat] || 0) + (t.amount || 0); totInc += t.amount || 0; }
      else { expMap[cat] = (expMap[cat] || 0) + (t.amount || 0); totExp += t.amount || 0; }
    });

    const receivables = (pending || []).reduce(
      (s: number, r: any) => s + Math.max(0, (r.total_amount || 0) - (r.paid_amount || 0)),
      0
    );

    setTotalIncome(totInc);
    setTotalExpense(totExp);
    setFeeReceivables(receivables);
    setIncomeByCategory(Object.entries(incMap).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount));
    setExpenseByCategory(Object.entries(expMap).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount));
    setLoading(false);
  };

  const cashBalance = totalIncome - totalExpense;
  const totalAssets = cashBalance + feeReceivables;
  const retainedEarnings = cashBalance;
  const isEmpty = totalIncome === 0 && totalExpense === 0;

  if (loading) return <div className="p-12 text-center text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <style>{`@media print { .no-print { display:none!important; } }`}</style>

      {/* Header */}
      <div className="no-print flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-violet-600" /> Balance Sheet
          </h1>
          <p className="text-gray-500 text-sm mt-1">Financial position as of a given date.</p>
        </div>
        <div className="flex items-center gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">As of Date</label>
            <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500" />
          </div>
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 mt-4">
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>

      {isEmpty ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center text-gray-400">
          <BarChart2 className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p>No financial data found up to this date.</p>
          <p className="text-sm mt-1">Record fee collections and expenses to see the balance sheet.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* School + date heading */}
          <div className="text-center py-2">
            <h2 className="text-xl font-bold text-gray-900">{schoolName}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Balance Sheet as of {new Date(asOf + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>

          {/* Top stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Income', value: totalIncome, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
              { label: 'Total Expenses', value: totalExpense, color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
              { label: 'Net Surplus / Deficit', value: cashBalance, color: cashBalance >= 0 ? 'text-emerald-700' : 'text-red-600', bg: cashBalance >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200' },
              { label: 'Fee Receivables', value: feeReceivables, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`rounded-xl border px-4 py-3 ${bg}`}>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
                <p className={`text-xl font-black mt-1 ${color}`}>Rs. {Math.abs(value).toLocaleString()}</p>
                {label === 'Net Surplus / Deficit' && value < 0 && (
                  <p className="text-[10px] text-red-500 font-bold mt-0.5">Deficit</p>
                )}
              </div>
            ))}
          </div>

          {/* Assets + Equity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Assets */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-blue-600 px-5 py-3">
                <h3 className="font-bold text-white text-sm uppercase tracking-wide">Assets</h3>
              </div>
              <div className="p-4 space-y-1">
                <div className="flex justify-between py-2 border-b border-gray-100 text-sm">
                  <span className="text-gray-700">Cash / Bank Balance</span>
                  <span className={`font-semibold ${cashBalance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                    {cashBalance < 0 ? '(' : ''}Rs. {Math.abs(cashBalance).toLocaleString()}{cashBalance < 0 ? ')' : ''}
                  </span>
                </div>
                {feeReceivables > 0 && (
                  <div className="flex justify-between py-2 border-b border-gray-100 text-sm">
                    <span className="text-gray-700">Fee Receivables (Unpaid)</span>
                    <span className="font-semibold text-amber-700">Rs. {feeReceivables.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between pt-3 font-bold text-base">
                  <span className="text-gray-800">Total Assets</span>
                  <span className="text-blue-700">Rs. {totalAssets.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Equity */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-purple-600 px-5 py-3">
                <h3 className="font-bold text-white text-sm uppercase tracking-wide">Equity</h3>
              </div>
              <div className="p-4 space-y-1">
                <div className="flex justify-between py-2 border-b border-gray-100 text-sm">
                  <span className="text-gray-700">Total Income Collected</span>
                  <span className="font-semibold text-green-700">Rs. {totalIncome.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100 text-sm">
                  <span className="text-gray-700">Less: Total Expenses</span>
                  <span className="font-semibold text-red-600">(Rs. {totalExpense.toLocaleString()})</span>
                </div>
                <div className="flex justify-between pt-3 font-bold text-base">
                  <span className="text-gray-800">Retained Earnings</span>
                  <span className={retainedEarnings >= 0 ? 'text-purple-700' : 'text-red-600'}>
                    Rs. {retainedEarnings.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Breakdown panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Income breakdown */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-green-600 px-5 py-3 flex justify-between items-center">
                <h3 className="font-bold text-white text-sm uppercase tracking-wide">Income Breakdown</h3>
                <span className="text-green-100 text-xs font-bold">Rs. {totalIncome.toLocaleString()}</span>
              </div>
              <div className="p-4 space-y-1 max-h-60 overflow-y-auto">
                {incomeByCategory.length === 0 ? (
                  <p className="text-gray-400 text-sm py-4 text-center">No income recorded</p>
                ) : incomeByCategory.map((item, i) => (
                  <div key={i} className="flex justify-between py-1.5 border-b border-gray-50 text-sm">
                    <span className="text-gray-700">{item.name}</span>
                    <span className="font-medium text-green-700">Rs. {item.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Expense breakdown */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-red-600 px-5 py-3 flex justify-between items-center">
                <h3 className="font-bold text-white text-sm uppercase tracking-wide">Expense Breakdown</h3>
                <span className="text-red-100 text-xs font-bold">Rs. {totalExpense.toLocaleString()}</span>
              </div>
              <div className="p-4 space-y-1 max-h-60 overflow-y-auto">
                {expenseByCategory.length === 0 ? (
                  <p className="text-gray-400 text-sm py-4 text-center">No expenses recorded</p>
                ) : expenseByCategory.map((item, i) => (
                  <div key={i} className="flex justify-between py-1.5 border-b border-gray-50 text-sm">
                    <span className="text-gray-700">{item.name}</span>
                    <span className="font-medium text-red-700">Rs. {item.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
