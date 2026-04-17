import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { FileText, Printer, ChevronLeft, ChevronRight } from 'lucide-react';

export default function SalarySlips() {
  const { userRole } = useAuth();
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  );
  const [slips, setSlips] = useState<any[]>([]);
  const [schoolName, setSchoolName] = useState('School');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (userRole?.school_id) fetchSchool();
  }, [userRole]);

  useEffect(() => {
    if (userRole?.school_id) fetchSlips();
  }, [selectedMonth, userRole]);

  const fetchSchool = async () => {
    const { data } = await supabase.from('schools').select('name').eq('id', userRole!.school_id).maybeSingle();
    setSchoolName(data?.name || 'School');
  };

  const fetchSlips = async () => {
    setLoading(true);
    // FIXED: staff table uses 'role' not 'designation'
    const { data, error } = await supabase
      .from('payroll_records')
      .select('*, staff(full_name, role, department, cnic)')
      .eq('school_id', userRole!.school_id)
      .eq('month_year', selectedMonth + '-01')
      .order('created_at');
    if (error) console.error('SalarySlips fetch error:', error);
    setSlips(data || []);
    setLoading(false);
  };

  const shiftMonth = (offset: number) => {
    const d = new Date(selectedMonth + '-01');
    d.setMonth(d.getMonth() + offset);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const monthLabel = new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; margin: 0; font-family: sans-serif; }
          .slip-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
          .slip-card { break-inside: avoid; border: 1px solid #000; padding: 14px; }
        }
        @media screen { .slip-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 16px; } }
      `}</style>

      <div className="no-print flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-emerald-600" /> Salary Slips
          </h1>
          <p className="text-gray-500 text-sm mt-1">View and print salary slips for processed payroll.</p>
        </div>
        {slips.length > 0 && (
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">
            <Printer className="w-4 h-4" /> Print All Slips
          </button>
        )}
      </div>

      <div className="no-print bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <button onClick={() => shiftMonth(-1)} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </button>
          <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500" />
          <button onClick={() => shiftMonth(1)} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        {slips.length > 0 && (
          <p className="text-sm font-semibold text-emerald-600">{slips.length} salary slips found for {monthLabel}</p>
        )}
      </div>

      {loading && <div className="p-12 text-center text-gray-400">Loading...</div>}

      {!loading && slips.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p>No payroll processed for {monthLabel} yet.</p>
          <p className="text-xs mt-1">Go to Payroll Processing to process salaries first.</p>
        </div>
      )}

      {slips.length > 0 && (
        <div className="slip-grid">
          {slips.map(slip => {
            const allowTotal = (slip.allowances || []).reduce((s: number, a: any) => s + (a.amount || 0), 0);
            const dedTotal = (slip.deductions || []).reduce((s: number, d: any) => s + (d.amount || 0), 0);
            return (
              <div key={slip.id} className="slip-card bg-white rounded-xl border border-gray-300 p-5 shadow-sm">
                <div className="text-center border-b pb-3 mb-3">
                  <h2 className="font-bold text-gray-900 text-base">{schoolName}</h2>
                  <p className="text-sm font-semibold text-emerald-700">Salary Slip — {monthLabel}</p>
                  <p className="text-xs text-gray-400 mt-0.5 uppercase tracking-wide">Confidential</p>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-3">
                  <div><span className="text-gray-400">Name:</span> <strong>{slip.staff?.full_name}</strong></div>
                  <div><span className="text-gray-400">Status:</span>
                    <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-medium ${slip.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {slip.status}
                    </span>
                  </div>
                  <div><span className="text-gray-400">Role:</span> <span>{slip.staff?.role}</span></div>
                  <div><span className="text-gray-400">Absent Days:</span> <span className={slip.absent_days > 0 ? 'text-red-600 font-medium' : ''}>{slip.absent_days}</span></div>
                </div>

                <table className="w-full text-xs border-collapse mb-3">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-200 px-2 py-1 text-left text-green-700">Earnings</th>
                      <th className="border border-gray-200 px-2 py-1 text-right text-green-700">Amount</th>
                      <th className="border border-gray-200 px-2 py-1 text-left text-red-600">Deductions</th>
                      <th className="border border-gray-200 px-2 py-1 text-right text-red-600">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-200 px-2 py-1">Basic Salary</td>
                      <td className="border border-gray-200 px-2 py-1 text-right">{(slip.base_salary || 0).toLocaleString()}</td>
                      {(slip.deductions || [])[0] ? (
                        <>
                          <td className="border border-gray-200 px-2 py-1">{slip.deductions[0].name}</td>
                          <td className="border border-gray-200 px-2 py-1 text-right text-red-600">{slip.deductions[0].amount?.toLocaleString()}</td>
                        </>
                      ) : (
                        <><td className="border border-gray-200 px-2 py-1" /><td className="border border-gray-200 px-2 py-1" /></>
                      )}
                    </tr>
                    {(slip.allowances || []).map((a: any, i: number) => (
                      <tr key={i}>
                        <td className="border border-gray-200 px-2 py-1">{a.name}</td>
                        <td className="border border-gray-200 px-2 py-1 text-right text-green-600">{a.amount?.toLocaleString()}</td>
                        {(slip.deductions || [])[i + 1] ? (
                          <>
                            <td className="border border-gray-200 px-2 py-1">{slip.deductions[i + 1].name}</td>
                            <td className="border border-gray-200 px-2 py-1 text-right text-red-600">{slip.deductions[i + 1].amount?.toLocaleString()}</td>
                          </>
                        ) : (
                          <><td className="border border-gray-200 px-2 py-1" /><td className="border border-gray-200 px-2 py-1" /></>
                        )}
                      </tr>
                    ))}
                    {slip.absent_deduction > 0 && (
                      <tr>
                        <td className="border border-gray-200 px-2 py-1" /><td className="border border-gray-200 px-2 py-1" />
                        <td className="border border-gray-200 px-2 py-1">Absent Deduction</td>
                        <td className="border border-gray-200 px-2 py-1 text-right text-red-600">{slip.absent_deduction?.toLocaleString()}</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-bold">
                      <td className="border border-gray-300 px-2 py-1">Gross</td>
                      <td className="border border-gray-300 px-2 py-1 text-right">{(slip.gross_salary || 0).toLocaleString()}</td>
                      <td className="border border-gray-300 px-2 py-1">Total Deductions</td>
                      <td className="border border-gray-300 px-2 py-1 text-right text-red-600">{(dedTotal + (slip.absent_deduction || 0)).toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>

                <div className="bg-emerald-50 rounded p-2 flex justify-between items-center">
                  <span className="text-xs font-bold text-emerald-800 uppercase">Net Payable</span>
                  <span className="text-base font-black text-emerald-700">{(slip.net_salary || 0).toLocaleString()}</span>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between">
                  <p className="text-xs text-gray-300">Generated: {new Date().toLocaleDateString()}</p>
                  <div className="text-right">
                    <div className="border-b border-gray-400 w-20 mb-0.5" />
                    <p className="text-xs text-gray-400">Signature</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
