import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { FileText, Download, ChevronLeft, ChevronRight, Printer, MessageCircle } from 'lucide-react';
import { formatDate } from '../../lib/utils';
import { downloadSalarySlips, generateSalarySlipsPDF, SlipData } from '../../lib/salarySlipUtils';
import { openWhatsApp, staffPayslipTemplate } from '../../lib/whatsappTemplates';

export default function SalarySlips() {
  const { userRole } = useAuth();
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  );
  const [slips, setSlips]             = useState<any[]>([]);
  const [schoolName, setSchoolName]   = useState('School');
  const [loading, setLoading]         = useState(false);
  const [generating, setGenerating]   = useState<string | null>(null); // slip id being generated

  useEffect(() => {
    if (userRole?.school_id) fetchSchool();
  }, [userRole]);

  useEffect(() => {
    if (userRole?.school_id) fetchSlips();
  }, [selectedMonth, userRole]);

  const fetchSchool = async () => {
    const { data } = await supabase.from('schools').select('name')
      .eq('id', userRole!.school_id).maybeSingle();
    setSchoolName(data?.name || 'School');
  };

  const fetchSlips = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('payroll_records')
      .select('*, staff(full_name, role, department, cnic, whatsapp_number)')
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

  /** Convert a payroll_record row into a SlipData object for jsPDF */
  const toSlipData = (slip: any): SlipData => ({
    id: slip.id,
    staff_name:       slip.staff?.full_name || '—',
    staff_role:       slip.staff?.role || '—',
    department:       slip.staff?.department || '',
    cnic:             slip.staff?.cnic || '',
    month_year:       slip.month_year,
    base_salary:      slip.base_salary || 0,
    allowances:       slip.allowances  || [],
    deductions:       slip.deductions  || [],
    absent_days:      slip.absent_days || 0,
    absent_deduction: slip.absent_deduction || 0,
    advance_deduction: slip.advance_deduction || 0,
    gross_salary:     slip.gross_salary || 0,
    net_salary:       slip.net_salary  || 0,
    status:           slip.status || 'pending',
  });

  const handleDownloadOne = async (slip: any) => {
    setGenerating(slip.id);
    try {
      downloadSalarySlips([toSlipData(slip)], schoolName,
        `salary-slip-${slip.staff?.full_name?.replace(/\s+/g, '-')}-${selectedMonth}.pdf`);
    } finally {
      setGenerating(null);
    }
  };

  const handleDownloadAll = async () => {
    setGenerating('all');
    try {
      downloadSalarySlips(slips.map(toSlipData), schoolName, `salary-slips-${selectedMonth}.pdf`);
    } finally {
      setGenerating(null);
    }
  };

  const monthLabel = formatDate(selectedMonth + '-01');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-emerald-600" /> Salary Slips
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Download 2-copy salary slips (Staff Copy + School Copy) as PDF.
          </p>
        </div>
        {slips.length > 0 && (
          <button onClick={handleDownloadAll} disabled={!!generating}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            <Download className="w-4 h-4" />
            {generating === 'all' ? 'Generating…' : `Download All (${slips.length})`}
          </button>
        )}
      </div>

      {/* Month selector */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <button onClick={() => shiftMonth(-1)} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </button>
          <input type="month" value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500" />
          <button onClick={() => shiftMonth(1)} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        {slips.length > 0 && (
          <p className="text-sm font-semibold text-emerald-600">{slips.length} salary slips for {monthLabel}</p>
        )}
      </div>

      {loading && <div className="p-12 text-center text-gray-400">Loading…</div>}

      {!loading && slips.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p>No payroll processed for {monthLabel} yet.</p>
          <p className="text-xs mt-1">Go to Payroll Processing to process salaries first.</p>
        </div>
      )}

      {/* Slip cards */}
      {!loading && slips.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {slips.map(slip => {
            const allowTotal = (slip.allowances || []).reduce((s: number, a: any) => s + (a.amount || 0), 0);
            const dedTotal   = (slip.deductions  || []).reduce((s: number, d: any) => s + (d.amount || 0), 0);
            const advDed     = slip.advance_deduction || 0;

            return (
              <div key={slip.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Card header */}
                <div className="bg-emerald-600 px-4 py-3 flex justify-between items-center">
                  <div>
                    <p className="text-white font-bold text-sm">{slip.staff?.full_name}</p>
                    <p className="text-emerald-100 text-xs">{slip.staff?.role}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    slip.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {slip.status}
                  </span>
                </div>

                {/* Card body */}
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-gray-50 rounded p-2">
                      <p className="text-gray-400">Base Salary</p>
                      <p className="font-bold text-gray-800">Rs. {(slip.base_salary || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-green-50 rounded p-2">
                      <p className="text-green-600">Allowances</p>
                      <p className="font-bold text-green-700">+ Rs. {allowTotal.toLocaleString()}</p>
                    </div>
                    <div className="bg-red-50 rounded p-2">
                      <p className="text-red-500">Deductions</p>
                      <p className="font-bold text-red-600">− Rs. {(dedTotal + (slip.absent_deduction || 0)).toLocaleString()}</p>
                    </div>
                    {advDed > 0 && (
                      <div className="bg-amber-50 rounded p-2">
                        <p className="text-amber-600">Adv. Recovery</p>
                        <p className="font-bold text-amber-700">− Rs. {advDed.toLocaleString()}</p>
                      </div>
                    )}
                    {slip.absent_days > 0 && (
                      <div className="col-span-2 bg-orange-50 rounded p-2">
                        <p className="text-orange-500 text-xs">Absent {slip.absent_days} day(s) → deducted Rs. {(slip.absent_deduction || 0).toLocaleString()}</p>
                      </div>
                    )}
                  </div>

                  {/* Net payable */}
                  <div className="bg-emerald-50 rounded-lg p-3 flex justify-between items-center">
                    <span className="text-xs font-bold text-emerald-800 uppercase">Net Payable</span>
                    <span className="text-lg font-black text-emerald-700">Rs. {(slip.net_salary || 0).toLocaleString()}</span>
                  </div>

                  {/* Download button */}
                  <button
                    onClick={() => handleDownloadOne(slip)}
                    disabled={!!generating}
                    className="w-full flex items-center justify-center gap-2 py-2 border border-emerald-200 text-emerald-700 text-sm font-medium rounded-lg hover:bg-emerald-50 disabled:opacity-50 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    {generating === slip.id ? 'Generating…' : 'Download PDF (2 copies)'}
                  </button>
                  {slip.staff?.whatsapp_number && (
                    <button
                      onClick={() => openWhatsApp(
                        slip.staff.whatsapp_number,
                        staffPayslipTemplate({
                          staffName: slip.staff.full_name,
                          month: selectedMonth,
                          amount: slip.net_salary || 0,
                          schoolName,
                        })
                      )}
                      className="w-full flex items-center justify-center gap-2 py-2 border border-green-200 text-green-700 text-sm font-medium rounded-lg hover:bg-green-50 transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Send via WhatsApp
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
