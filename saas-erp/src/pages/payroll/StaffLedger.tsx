import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { BookOpen, Download, TrendingDown, TrendingUp, Wallet, ChevronLeft, ChevronRight } from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';
import { formatDate } from '../../lib/utils';

interface LedgerRow {
  id: string;
  date: string;
  type: 'debit' | 'credit';   // debit = school paid out; credit = school recovered
  category: string;
  description: string;
  amount: number;
  balance: number;  // running balance (positive = staff owes school)
}

export default function StaffLedger() {
  const { userRole } = useAuth();
  const [staffList, setStaffList]         = useState<any[]>([]);
  const [selectedStaff, setSelectedStaff] = useState('');
  const [transactions, setTransactions]   = useState<any[]>([]);
  const [loading, setLoading]             = useState(false);
  const [year, setYear]                   = useState(new Date().getFullYear());

  useEffect(() => {
    if (userRole?.school_id) fetchStaff();
  }, [userRole]);

  useEffect(() => {
    if (selectedStaff) fetchLedger();
  }, [selectedStaff, year]);

  const fetchStaff = async () => {
    const { data } = await supabase.from('staff')
      .select('id, full_name, role, department')
      .eq('school_id', userRole!.school_id)
      .order('full_name');
    setStaffList(data || []);
  };

  const fetchLedger = async () => {
    setLoading(true);
    const sid  = userRole!.school_id;
    const from = `${year}-01-01`;
    const to   = `${year}-12-31`;

    // All financial_transactions linked to this staff member
    const { data: txns } = await supabase
      .from('financial_transactions')
      .select('*')
      .eq('school_id', sid)
      .eq('staff_id', selectedStaff)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true });

    setTransactions(txns || []);
    setLoading(false);
  };

  // Compute ledger rows with running balance
  const ledgerRows = useMemo((): LedgerRow[] => {
    let balance = 0;
    return transactions.map(t => {
      const isAdvance  = t.category === 'Staff Advance';
      const isRecovery = t.category === 'Advance Recovery';
      const isSalary   = t.category === 'Payroll' || t.category === 'Salary';

      // Debit = advance given (staff owes more)
      // Credit = recovery or salary (reduces liability / records payment)
      const type: 'debit' | 'credit' = isAdvance ? 'debit' : 'credit';

      if (isAdvance)  balance += Number(t.amount);
      if (isRecovery) balance -= Number(t.amount);
      // Salary payments do not affect the advance balance — they are informational

      return {
        id: t.id,
        date: t.date,
        type,
        category: t.category,
        description: t.remarks || t.category,
        amount: Number(t.amount),
        balance,
      };
    });
  }, [transactions]);

  const staffInfo   = staffList.find(s => s.id === selectedStaff);
  const totalAdv    = transactions.filter(t => t.category === 'Staff Advance').reduce((s, t) => s + Number(t.amount), 0);
  const totalRec    = transactions.filter(t => t.category === 'Advance Recovery').reduce((s, t) => s + Number(t.amount), 0);
  const outstanding = totalAdv - totalRec;
  const totalPaid   = transactions.filter(t => t.category === 'Payroll' || t.category === 'Salary').reduce((s, t) => s + Number(t.amount), 0);

  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-600" /> Staff Ledger
          </h1>
          <p className="text-gray-500 text-sm mt-1">Complete financial history per staff member: advances, recoveries, and salary payments.</p>
        </div>
        {ledgerRows.length > 0 && (
          <button onClick={() => exportToCSV(`staff-ledger-${staffInfo?.full_name}-${year}`, ledgerRows, [
            { header: 'Date', key: 'date' }, { header: 'Category', key: 'category' },
            { header: 'Description', key: 'description' }, { header: 'Type', key: 'type' },
            { header: 'Amount', key: 'amount' }, { header: 'Running Balance', key: 'balance' },
          ])}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Staff Member</label>
          <select value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
            <option value="">— Select a staff member —</option>
            {staffList.map(s => (
              <option key={s.id} value={s.id}>{s.full_name} — {s.role}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Year</label>
          <div className="flex items-center gap-2">
            <button onClick={() => setYear(y => y - 1)} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
              <ChevronLeft className="w-4 h-4 text-gray-500" />
            </button>
            <select value={year} onChange={e => setYear(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
              {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button onClick={() => setYear(y => y + 1)} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>
      </div>

      {!selectedStaff && (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center text-gray-400">
          <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p>Select a staff member above to view their ledger.</p>
        </div>
      )}

      {selectedStaff && (
        <>
          {/* Staff + Summary cards */}
          {staffInfo && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex flex-wrap gap-4 items-center justify-between">
              <div>
                <p className="text-base font-bold text-indigo-900">{staffInfo.full_name}</p>
                <p className="text-sm text-indigo-600">{staffInfo.role}{staffInfo.department ? ` · ${staffInfo.department}` : ''}</p>
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="text-center">
                  <p className="text-xs text-gray-500">Advances Given</p>
                  <p className="text-lg font-black text-red-600">Rs. {totalAdv.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Recovered</p>
                  <p className="text-lg font-black text-green-600">Rs. {totalRec.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Outstanding Balance</p>
                  <p className={`text-lg font-black ${outstanding > 0 ? 'text-orange-600' : 'text-green-600'}`}>Rs. {outstanding.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Salary Disbursed</p>
                  <p className="text-lg font-black text-indigo-600">Rs. {totalPaid.toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}

          {/* Ledger Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-gray-400">Loading…</div>
            ) : ledgerRows.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                <p>No transactions found for {year}.</p>
                <p className="text-xs mt-1">Advances and salary payments will appear here once recorded.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Category</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Description</th>
                      <th className="px-4 py-3 text-right font-medium text-red-500">Debit (Given)</th>
                      <th className="px-4 py-3 text-right font-medium text-green-600">Credit (Recovered)</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {ledgerRows.map(row => (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-500">{formatDate(row.date)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            row.category === 'Staff Advance'   ? 'bg-red-50 text-red-700' :
                            row.category === 'Advance Recovery' ? 'bg-green-50 text-green-700' :
                            'bg-indigo-50 text-indigo-700'
                          }`}>
                            {row.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-[220px] truncate">{row.description}</td>
                        <td className="px-4 py-3 text-right font-mono">
                          {row.type === 'debit'
                            ? <span className="text-red-600 flex items-center justify-end gap-1"><TrendingDown className="w-3 h-3" /> Rs. {row.amount.toLocaleString()}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {row.type === 'credit'
                            ? <span className="text-green-600 flex items-center justify-end gap-1"><TrendingUp className="w-3 h-3" /> Rs. {row.amount.toLocaleString()}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold">
                          {row.category === 'Payroll' || row.category === 'Salary' ? (
                            <span className="text-indigo-600">—</span>
                          ) : (
                            <span className={row.balance > 0 ? 'text-orange-600' : 'text-green-600'}>
                              Rs. {row.balance.toLocaleString()}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {ledgerRows.length > 0 && (
                    <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                      <tr>
                        <td colSpan={3} className="px-4 py-3 font-bold text-gray-700">Net Outstanding Balance</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-red-600">Rs. {totalAdv.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-green-600">Rs. {totalRec.toLocaleString()}</td>
                        <td className={`px-4 py-3 text-right font-mono font-black ${outstanding > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                          Rs. {outstanding.toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
