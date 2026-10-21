import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { BarChart2, Printer, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import { formatDate } from '../../lib/utils';

interface BalanceItem {
  code: string;
  name: string;
  amount: number;
}

export default function BalanceSheet() {
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [asOf, setAsOf] = useState(new Date().toISOString().split('T')[0]);
  const [schoolName, setSchoolName] = useState('School');

  // Classified account balances
  const [currentAssets, setCurrentAssets] = useState<BalanceItem[]>([]);
  const [fixedAssets, setFixedAssets] = useState<BalanceItem[]>([]);
  const [liabilities, setLiabilities] = useState<BalanceItem[]>([]);
  const [equityItems, setEquityItems] = useState<BalanceItem[]>([]);

  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [feeReceivables, setFeeReceivables] = useState(0);

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

    // 1. Fetch Chart of Accounts
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, code, name, account_type')
      .eq('school_id', sid)
      .order('code');

    // 2. Fetch journal entries with lines up to asOf
    const { data: entries } = await supabase
      .from('journal_entries')
      .select('id, entry_date, journal_lines(account_id, debit, credit)')
      .eq('school_id', sid)
      .lte('entry_date', asOf);

    // 3. Fetch outstanding fee receivables for active students
    const { data: pendingFees } = await supabase
      .from('fee_records')
      .select('total_amount, paid_amount, status, students!inner(is_deleted, status)')
      .eq('school_id', sid)
      .eq('students.is_deleted', false)
      .eq('students.status', 'active')
      .is('deleted_at', null)
      .in('status', ['pending', 'overdue', 'partial']);

    // Sum journal lines per account
    const accMap: Record<string, { code: string; name: string; type: string; debit: number; credit: number }> = {};
    (accounts || []).forEach(a => {
      accMap[a.id] = { code: a.code, name: a.name, type: a.account_type, debit: 0, credit: 0 };
    });

    (entries || []).forEach((e: any) => {
      (e.journal_lines || []).forEach((l: any) => {
        if (accMap[l.account_id]) {
          accMap[l.account_id].debit += Number(l.debit || 0);
          accMap[l.account_id].credit += Number(l.credit || 0);
        }
      });
    });

    let incSum = 0;
    let expSum = 0;
    const curAssList: BalanceItem[] = [];
    const fixAssList: BalanceItem[] = [];
    const liabList: BalanceItem[] = [];
    const eqList: BalanceItem[] = [];

    for (const acc of Object.values(accMap)) {
      if (acc.type === 'income') {
        const net = acc.credit - acc.debit;
        incSum += net;
      } else if (acc.type === 'expense') {
        const net = acc.debit - acc.credit;
        expSum += net;
      } else if (acc.type === 'asset') {
        const net = acc.debit - acc.credit;
        const isCashOrBank = acc.code.startsWith('100') || acc.name.toLowerCase().includes('cash') || acc.name.toLowerCase().includes('bank');
        if (isCashOrBank) {
          curAssList.push({ code: acc.code, name: acc.name, amount: net });
        } else {
          fixAssList.push({ code: acc.code, name: acc.name, amount: net });
        }
      } else if (acc.type === 'liability') {
        const net = acc.credit - acc.debit;
        liabList.push({ code: acc.code, name: acc.name, amount: net });
      } else if (acc.type === 'equity') {
        const net = acc.credit - acc.debit;
        eqList.push({ code: acc.code, name: acc.name, amount: net });
      }
    }

    const calculatedReceivables = (pendingFees || []).reduce(
      (s: number, r: any) => s + Math.max(0, (r.total_amount || 0) - (r.paid_amount || 0)),
      0
    );

    setTotalIncome(incSum);
    setTotalExpense(expSum);
    setFeeReceivables(calculatedReceivables);
    setCurrentAssets(curAssList);
    setFixedAssets(fixAssList);
    setLiabilities(liabList);
    setEquityItems(eqList);
    setLoading(false);
  };

  // Calculations
  const totalCurrentAssets = currentAssets.reduce((s, a) => s + a.amount, 0);
  const totalFixedAssets = fixedAssets.reduce((s, a) => s + a.amount, 0);
  const totalAssets = totalCurrentAssets + totalFixedAssets;

  const totalLiabilities = liabilities.reduce((s, l) => s + l.amount, 0);
  const capitalEquity = equityItems.reduce((s, e) => s + e.amount, 0);
  const netEarnings = totalIncome - totalExpense; // Retained Earnings
  const totalEquity = capitalEquity + netEarnings;

  const totalLiabAndEquity = totalLiabilities + totalEquity;
  const isBalanced = Math.abs(totalAssets - totalLiabAndEquity) < 1;

  const isEmpty = totalAssets === 0 && totalLiabAndEquity === 0;

  if (loading) return <div className="p-12 text-center text-gray-400">Loading Balance Sheet...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <style>{`@media print { .no-print { display:none!important; } }`}</style>

      {/* Header */}
      <div className="no-print flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-violet-600" /> Balance Sheet
          </h1>
          <p className="text-gray-500 text-sm mt-1">Statement of Financial Position as of a given date (Double-Entry).</p>
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
              Balance Sheet as of {formatDate(asOf)}
            </p>
          </div>

          {/* Balance Check Banner */}
          <div className={`rounded-xl p-4 flex items-center justify-between border ${isBalanced ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-center gap-3">
              {isBalanced ? (
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600" />
              )}
              <div>
                <p className={`text-sm font-bold ${isBalanced ? 'text-emerald-900' : 'text-amber-900'}`}>
                  {isBalanced ? 'Accounting Equation Balanced: Assets = Liabilities + Equity' : 'Out of Balance'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Total Assets: Rs. {totalAssets.toLocaleString()} &nbsp;·&nbsp; Total Liabilities + Equity: Rs. {totalLiabAndEquity.toLocaleString()}
                </p>
              </div>
            </div>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${isBalanced ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              {isBalanced ? 'Balanced' : `Diff: Rs. ${Math.abs(totalAssets - totalLiabAndEquity).toLocaleString()}`}
            </span>
          </div>

          {/* Top stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Assets', value: totalAssets, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
              { label: 'Total Liabilities', value: totalLiabilities, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
              { label: 'Retained Earnings', value: netEarnings, color: netEarnings >= 0 ? 'text-emerald-700' : 'text-rose-700', bg: netEarnings >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200' },
              { label: 'Fee Receivables', value: feeReceivables, color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`rounded-xl border px-4 py-3 ${bg}`}>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
                <p className={`text-xl font-black mt-1 ${color}`}>Rs. {Math.abs(value).toLocaleString()}</p>
              </div>
            ))}
          </div>

          {/* Main 2-Column Section: Assets vs Liabilities & Equity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Column: Assets */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-blue-600 px-5 py-3">
                <h3 className="font-bold text-white text-sm uppercase tracking-wide">Assets</h3>
              </div>
              <div className="p-4 space-y-4">
                {/* Current Assets */}
                <div>
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Current Assets</h4>
                  <div className="space-y-1.5">
                    {currentAssets.map((a, i) => (
                      <div key={i} className="flex justify-between py-1 border-b border-gray-50 text-sm">
                        <span className="text-gray-700">{a.code} - {a.name}</span>
                        <span className="font-semibold text-gray-900">Rs. {a.amount.toLocaleString()}</span>
                      </div>
                    ))}
                    {feeReceivables > 0 && (
                      <div className="flex justify-between py-1 border-b border-gray-50 text-sm">
                        <span className="text-gray-700">Fee Receivables (Active Students)</span>
                        <span className="font-semibold text-purple-700">Rs. {feeReceivables.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Non-Current / Fixed Assets */}
                {fixedAssets.length > 0 && (
                  <div>
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Fixed / Non-Current Assets</h4>
                    <div className="space-y-1.5">
                      {fixedAssets.map((a, i) => (
                        <div key={i} className="flex justify-between py-1 border-b border-gray-50 text-sm">
                          <span className="text-gray-700">{a.code} - {a.name}</span>
                          <span className="font-semibold text-gray-900">Rs. {a.amount.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-between pt-3 border-t-2 border-gray-200 font-bold text-base">
                  <span className="text-gray-800">Total Assets</span>
                  <span className="text-blue-700">Rs. {totalAssets.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Right Column: Liabilities & Equity */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-purple-600 px-5 py-3">
                <h3 className="font-bold text-white text-sm uppercase tracking-wide">Liabilities & Equity</h3>
              </div>
              <div className="p-4 space-y-4">
                {/* Liabilities */}
                <div>
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Liabilities</h4>
                  <div className="space-y-1.5">
                    {liabilities.length === 0 ? (
                      <p className="text-xs text-gray-400 py-1">No liabilities recorded</p>
                    ) : (
                      liabilities.map((l, i) => (
                        <div key={i} className="flex justify-between py-1 border-b border-gray-50 text-sm">
                          <span className="text-gray-700">{l.code} - {l.name}</span>
                          <span className="font-semibold text-amber-700">Rs. {l.amount.toLocaleString()}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Equity */}
                <div>
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Equity</h4>
                  <div className="space-y-1.5">
                    {equityItems.map((e, i) => (
                      <div key={i} className="flex justify-between py-1 border-b border-gray-50 text-sm">
                        <span className="text-gray-700">{e.code} - {e.name}</span>
                        <span className="font-semibold text-gray-900">Rs. {e.amount.toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-1 border-b border-gray-50 text-sm">
                      <span className="text-gray-700">Retained Earnings (Net Income)</span>
                      <span className={`font-semibold ${netEarnings >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        Rs. {netEarnings.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between pt-3 border-t-2 border-gray-200 font-bold text-base">
                  <span className="text-gray-800">Total Liabilities & Equity</span>
                  <span className="text-purple-700">Rs. {totalLiabAndEquity.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
