import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Scale, Download, Printer, CheckCircle2, AlertCircle } from 'lucide-react';
import { exportToExcel } from '../../lib/exportUtils';

interface TBRow {
  accountId: string;
  code: string;
  account: string;
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
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

    // 1. Fetch Chart of Accounts
    const { data: accounts, error: accErr } = await supabase
      .from('accounts')
      .select('id, code, name, account_type')
      .eq('school_id', sid)
      .order('code');

    if (accErr) {
      console.error('Error fetching accounts for trial balance:', accErr);
      setLoading(false);
      return;
    }

    // 2. Fetch journal entries with their lines up to asOf
    const { data: entries, error: entryErr } = await supabase
      .from('journal_entries')
      .select('id, entry_date, journal_lines(account_id, debit, credit)')
      .eq('school_id', sid)
      .lte('entry_date', asOf);

    if (entryErr) {
      console.error('Error fetching journal entries for trial balance:', entryErr);
      setLoading(false);
      return;
    }

    const accMap: Record<string, { code: string; name: string; type: any; debit: number; credit: number }> = {};
    (accounts || []).forEach(a => {
      accMap[a.id] = {
        code: a.code,
        name: a.name,
        type: a.account_type as any,
        debit: 0,
        credit: 0,
      };
    });

    (entries || []).forEach((e: any) => {
      (e.journal_lines || []).forEach((l: any) => {
        if (accMap[l.account_id]) {
          accMap[l.account_id].debit += Number(l.debit || 0);
          accMap[l.account_id].credit += Number(l.credit || 0);
        }
      });
    });

    // 3. Compute net debit / credit balances per account following standard double-entry rules
    const result: TBRow[] = [];
    for (const [id, acc] of Object.entries(accMap)) {
      if (acc.debit === 0 && acc.credit === 0) continue;

      let netDr = 0;
      let netCr = 0;

      // Asset & Expense normal balance = Debit
      if (acc.type === 'asset' || acc.type === 'expense') {
        const net = acc.debit - acc.credit;
        if (net >= 0) netDr = net;
        else netCr = -net;
      } else {
        // Liability, Equity & Income normal balance = Credit
        const net = acc.credit - acc.debit;
        if (net >= 0) netCr = net;
        else netDr = -net;
      }

      result.push({
        accountId: id,
        code: acc.code,
        account: acc.name,
        type: acc.type,
        debit: netDr,
        credit: netCr,
      });
    }

    // Sort order: Assets (1xxx) -> Liabilities (2xxx) -> Equity (3xxx) -> Income (4xxx) -> Expenses (5xxx)
    result.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

    setRows(result);
    setLoading(false);
  };

  const totalDr = rows.reduce((s, r) => s + r.debit, 0);
  const totalCr = rows.reduce((s, r) => s + r.credit, 0);
  const diff = Math.abs(totalDr - totalCr);
  const isBalanced = diff < 1; // within 1 rupee rounding

  // Calculate Net Profit/Loss (Income minus Expense accounts)
  const totalIncome = rows.filter(r => r.type === 'income').reduce((s, r) => s + r.credit, 0);
  const totalExpense = rows.filter(r => r.type === 'expense').reduce((s, r) => s + r.debit, 0);
  const netEarnings = totalIncome - totalExpense;

  const cols = [
    { header: 'Code', key: 'code' },
    { header: 'Account Name', key: 'account' },
    { header: 'Classification', key: 'type' },
    { header: 'Debit (Dr)', key: 'debit' },
    { header: 'Credit (Cr)', key: 'credit' },
  ];

  const typeLabels: Record<string, { label: string; color: string }> = {
    asset:     { label: 'Asset', color: 'bg-blue-100 text-blue-700' },
    liability: { label: 'Liability', color: 'bg-amber-100 text-amber-700' },
    equity:    { label: 'Equity', color: 'bg-purple-100 text-purple-700' },
    income:    { label: 'Income', color: 'bg-emerald-100 text-emerald-700' },
    expense:   { label: 'Expense', color: 'bg-rose-100 text-rose-700' },
  };

  if (loading) return <div className="p-12 text-center text-gray-400">Loading Trial Balance...</div>;

  return (
    <div className="space-y-6">
      <style>{`@media print { .no-print { display:none!important; } }`}</style>

      {/* Header */}
      <div className="no-print flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Scale className="w-6 h-6 text-violet-600" /> Trial Balance
          </h1>
          <p className="text-gray-500 text-sm mt-1">General Ledger account balances as of a given date (Double-Entry).</p>
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
          <p className="text-sm mt-1">Record fee collections, expenses, or manual journal entries to see the trial balance.</p>
        </div>
      ) : (
        <>
          {/* Balancing status banner */}
          <div className={`rounded-xl p-4 flex items-center justify-between gap-4 border ${isBalanced ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-center gap-3">
              {isBalanced ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              )}
              <div>
                <p className={`font-bold text-sm ${isBalanced ? 'text-emerald-800' : 'text-amber-800'}`}>
                  {isBalanced ? 'Trial Balance is Balanced (Debits = Credits)' : `Out of Balance by Rs. ${diff.toLocaleString()}`}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Total Debits: Rs. {totalDr.toLocaleString()} &nbsp;|&nbsp; Total Credits: Rs. {totalCr.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-gray-500 block">Period Net {netEarnings >= 0 ? 'Surplus' : 'Deficit'}</span>
              <span className={`text-sm font-black ${netEarnings >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                Rs. {Math.abs(netEarnings).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left font-medium text-gray-500 w-24">Code</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">Account Name</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500 w-28">Classification</th>
                  <th className="px-5 py-3 text-right font-medium text-blue-700 w-44">Debit (Dr)</th>
                  <th className="px-5 py-3 text-right font-medium text-emerald-700 w-44">Credit (Cr)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-gray-500">{r.code}</td>
                    <td className="px-5 py-3 font-medium text-gray-900">{r.account}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-md ${typeLabels[r.type]?.color || 'bg-gray-100 text-gray-700'}`}>
                        {typeLabels[r.type]?.label || r.type}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-blue-900">
                      {r.debit > 0 ? `Rs. ${r.debit.toLocaleString()}` : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-emerald-900">
                      {r.credit > 0 ? `Rs. ${r.credit.toLocaleString()}` : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                <tr>
                  <td className="px-5 py-3 font-bold text-gray-800" colSpan={3}>Grand Total</td>
                  <td className="px-5 py-3 text-right font-black text-blue-800 text-base">
                    Rs. {totalDr.toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right font-black text-emerald-800 text-base">
                    Rs. {totalCr.toLocaleString()}
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
