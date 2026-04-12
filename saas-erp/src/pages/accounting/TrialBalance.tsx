import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Scale, Download, Printer } from 'lucide-react';
import { exportToExcel, exportToPDF } from '../../lib/exportUtils';

interface AccountBalance {
  code: string;
  name: string;
  account_type: string;
  total_debit: number;
  total_credit: number;
  balance: number;
  normal_side: 'debit' | 'credit';
}

export default function TrialBalance() {
  const { userRole } = useAuth();
  const [balances, setBalances] = useState<AccountBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [asOf, setAsOf] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (userRole?.school_id) fetchTrialBalance();
  }, [userRole, asOf]);

  const fetchTrialBalance = async () => {
    setLoading(true);
    const sid = userRole!.school_id;

    const [{ data: accounts }, { data: lines }] = await Promise.all([
      supabase.from('accounts').select('id, code, name, account_type').eq('school_id', sid).eq('is_active', true).order('code'),
      supabase.from('journal_lines')
        .select('account_id, debit, credit, entry:entry_id(entry_date, school_id)')
        .eq('entry.school_id', sid)
        .lte('entry.entry_date', asOf),
    ]);

    const linesByAccount: Record<string, { debit: number; credit: number }> = {};
    (lines || []).forEach((l: any) => {
      if (!l.entry?.school_id) return;
      if (!linesByAccount[l.account_id]) linesByAccount[l.account_id] = { debit: 0, credit: 0 };
      linesByAccount[l.account_id].debit += l.debit || 0;
      linesByAccount[l.account_id].credit += l.credit || 0;
    });

    const DEBIT_NORMAL = new Set(['asset', 'expense']);

    const result: AccountBalance[] = (accounts || []).map((a: any) => {
      const lb = linesByAccount[a.id] || { debit: 0, credit: 0 };
      const isDebitNormal = DEBIT_NORMAL.has(a.account_type);
      const balance = isDebitNormal ? lb.debit - lb.credit : lb.credit - lb.debit;
      return {
        code: a.code, name: a.name, account_type: a.account_type,
        total_debit: lb.debit, total_credit: lb.credit,
        balance, normal_side: (isDebitNormal ? 'debit' : 'credit') as 'debit' | 'credit',
      };
    }).filter(a => a.total_debit > 0 || a.total_credit > 0);

    setBalances(result);
    setLoading(false);
  };

  const totalDr = balances.reduce((s, b) => s + (b.normal_side === 'debit' ? b.balance : 0), 0);
  const totalCr = balances.reduce((s, b) => s + (b.normal_side === 'credit' ? b.balance : 0), 0);
  const isBalanced = Math.abs(totalDr - totalCr) < 0.01;

  const cols = [
    { header: 'Code', key: 'code' }, { header: 'Account', key: 'name' },
    { header: 'Total Debit', key: 'total_debit' }, { header: 'Total Credit', key: 'total_credit' },
    { header: 'Balance', key: 'balance' },
  ];

  if (loading) return <div className="p-12 text-center text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6">
      <style>{`@media print { .no-print { display:none!important; } }`}</style>
      <div className="no-print flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Scale className="w-6 h-6 text-violet-600" /> Trial Balance
          </h1>
          <p className="text-gray-500 text-sm mt-1">All account balances as of a given date.</p>
        </div>
        <div className="flex items-center gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">As of Date</label>
            <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500" />
          </div>
          {balances.length > 0 && (
            <>
              <button onClick={() => exportToExcel(`trial-balance-${asOf}`, balances, cols)}
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

      {balances.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center text-gray-400">
          <Scale className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p>No journal entries found. Post entries in Journal Entry to see the trial balance.</p>
        </div>
      ) : (
        <>
          <div className={`rounded-xl p-4 flex items-center gap-3 ${isBalanced ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <Scale className={`w-5 h-5 ${isBalanced ? 'text-green-600' : 'text-red-600'}`} />
            <p className={`font-medium text-sm ${isBalanced ? 'text-green-800' : 'text-red-800'}`}>
              {isBalanced ? 'Trial balance is balanced — debits equal credits.' : `Out of balance by ${Math.abs(totalDr - totalCr).toLocaleString()}`}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left font-medium text-gray-500 w-24">Code</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">Account Name</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500 w-28">Type</th>
                  <th className="px-5 py-3 text-right font-medium text-green-700">Debit</th>
                  <th className="px-5 py-3 text-right font-medium text-red-600">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {balances.map(b => (
                  <tr key={b.code} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-mono text-xs text-gray-500">{b.code}</td>
                    <td className="px-5 py-3 font-medium text-gray-900">{b.name}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize
                        ${b.account_type === 'asset' ? 'bg-blue-100 text-blue-700' :
                          b.account_type === 'liability' ? 'bg-red-100 text-red-700' :
                          b.account_type === 'equity' ? 'bg-purple-100 text-purple-700' :
                          b.account_type === 'income' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                        {b.account_type}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-900">
                      {b.normal_side === 'debit' ? b.balance.toLocaleString() : ''}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-900">
                      {b.normal_side === 'credit' ? b.balance.toLocaleString() : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                <tr>
                  <td className="px-5 py-3 font-bold text-gray-800" colSpan={3}>Total</td>
                  <td className={`px-5 py-3 text-right font-bold text-lg ${isBalanced ? 'text-gray-900' : 'text-red-600'}`}>{totalDr.toLocaleString()}</td>
                  <td className={`px-5 py-3 text-right font-bold text-lg ${isBalanced ? 'text-gray-900' : 'text-red-600'}`}>{totalCr.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
