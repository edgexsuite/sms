import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { BarChart2, Printer, Download } from 'lucide-react';
import { exportToPDF } from '../../lib/exportUtils';

interface Section {
  type: string;
  label: string;
  accounts: { name: string; balance: number }[];
  total: number;
}

export default function BalanceSheet() {
  const { userRole } = useAuth();
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [asOf, setAsOf] = useState(new Date().toISOString().split('T')[0]);
  const [schoolName, setSchoolName] = useState('School');

  useEffect(() => {
    if (userRole?.school_id) { fetchSchool(); fetchBalanceSheet(); }
  }, [userRole, asOf]);

  const fetchSchool = async () => {
    const { data } = await supabase.from('schools').select('name').eq('id', userRole!.school_id).maybeSingle();
    setSchoolName(data?.name || 'School');
  };

  const fetchBalanceSheet = async () => {
    setLoading(true);
    const sid = userRole!.school_id;

    const [{ data: accounts }, { data: lines }] = await Promise.all([
      supabase.from('accounts').select('id, name, account_type').eq('school_id', sid).eq('is_active', true),
      supabase.from('journal_lines').select('account_id, debit, credit, entry:entry_id(entry_date, school_id)'),
    ]);

    const balanceMap: Record<string, number> = {};
    (lines || []).forEach((l: any) => {
      if (!l.entry?.school_id || l.entry.school_id !== sid) return;
      if (l.entry.entry_date > asOf) return;
      balanceMap[l.account_id] = (balanceMap[l.account_id] || 0) + (l.debit || 0) - (l.credit || 0);
    });

    const buildSection = (type: string, label: string, invertSign = false): Section => {
      const accts = (accounts || []).filter((a: any) => a.account_type === type).map((a: any) => ({
        name: a.name,
        balance: Math.abs(invertSign ? -(balanceMap[a.id] || 0) : (balanceMap[a.id] || 0)),
      })).filter(a => a.balance !== 0);
      return { type, label, accounts: accts, total: accts.reduce((s, a) => s + a.balance, 0) };
    };

    setSections([
      buildSection('asset', 'Assets'),
      buildSection('liability', 'Liabilities', true),
      buildSection('equity', 'Equity', true),
      buildSection('income', 'Income (Net Profit/Loss component)', true),
      buildSection('expense', 'Expenses', false),
    ]);
    setLoading(false);
  };

  const assets = sections.find(s => s.type === 'asset');
  const liabilities = sections.find(s => s.type === 'liability');
  const equity = sections.find(s => s.type === 'equity');
  const totalAssets = assets?.total || 0;
  const totalLiabEquity = (liabilities?.total || 0) + (equity?.total || 0);

  if (loading) return <div className="p-12 text-center text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <style>{`@media print { .no-print { display:none!important; } }`}</style>
      <div className="no-print flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-violet-600" /> Balance Sheet
          </h1>
          <p className="text-gray-500 text-sm mt-1">Assets, liabilities, and equity position.</p>
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

      {totalAssets === 0 && totalLiabEquity === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center text-gray-400">
          <BarChart2 className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p>No data available. Post journal entries to see the balance sheet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-center py-4">
            <h2 className="text-xl font-bold text-gray-900">{schoolName}</h2>
            <p className="text-sm text-gray-500 mt-0.5">Balance Sheet as of {new Date(asOf).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>

          <div className={`rounded-xl p-4 text-center ${Math.abs(totalAssets - totalLiabEquity) < 1 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <p className={`text-sm font-medium ${Math.abs(totalAssets - totalLiabEquity) < 1 ? 'text-green-800' : 'text-red-800'}`}>
              {Math.abs(totalAssets - totalLiabEquity) < 1 ? 'Balance Sheet is balanced' : `Difference: ${Math.abs(totalAssets - totalLiabEquity).toLocaleString()}`}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Assets */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-blue-600 px-5 py-3">
                <h3 className="font-bold text-white">ASSETS</h3>
              </div>
              <div className="p-4">
                {(assets?.accounts || []).map((a, i) => (
                  <div key={i} className="flex justify-between py-1.5 border-b border-gray-100 text-sm">
                    <span className="text-gray-700">{a.name}</span>
                    <span className="font-medium text-gray-900">{a.balance.toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-3 font-bold text-base">
                  <span className="text-gray-800">Total Assets</span>
                  <span className="text-blue-700">{totalAssets.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Liabilities + Equity */}
            <div className="space-y-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-red-600 px-5 py-3">
                  <h3 className="font-bold text-white">LIABILITIES</h3>
                </div>
                <div className="p-4">
                  {(liabilities?.accounts || []).map((a, i) => (
                    <div key={i} className="flex justify-between py-1.5 border-b border-gray-100 text-sm">
                      <span className="text-gray-700">{a.name}</span>
                      <span className="font-medium text-gray-900">{a.balance.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-3 font-bold">
                    <span className="text-gray-800">Total Liabilities</span>
                    <span className="text-red-700">{(liabilities?.total || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-purple-600 px-5 py-3">
                  <h3 className="font-bold text-white">EQUITY</h3>
                </div>
                <div className="p-4">
                  {(equity?.accounts || []).map((a, i) => (
                    <div key={i} className="flex justify-between py-1.5 border-b border-gray-100 text-sm">
                      <span className="text-gray-700">{a.name}</span>
                      <span className="font-medium text-gray-900">{a.balance.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-3 font-bold">
                    <span className="text-gray-800">Total Equity</span>
                    <span className="text-purple-700">{(equity?.total || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-100 rounded-xl p-4 flex justify-between font-bold text-base">
                <span className="text-gray-800">Total Liabilities + Equity</span>
                <span className="text-gray-900">{totalLiabEquity.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
