import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Download, ArrowLeft, Loader2, Search } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toBase64, addPdfHeader } from '../../../lib/pdfUtils';
import { formatDate } from '../../../lib/utils';

interface FinancialAidReportProps {
  onBack: () => void;
  reportType: 'discount' | 'free_stu';
}

export default function FinancialAidReport({ onBack, reportType }: FinancialAidReportProps) {
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [feeStatus, setFeeStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [reportData, setReportData] = useState<any[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);

  const isFree = reportType === 'free_stu';
  const title = isFree ? 'Full Waiver Students' : 'Scholarship Holders';
  const subtitle = 'Financial Aid Summary';

  useEffect(() => {
    if (userRole?.school_id) {
      fetchSchoolInfo();
      fetchClasses();
      fetchData();
    }
  }, [userRole, selectedClassId]);

  const fetchSchoolInfo = async () => {
    const { data } = await supabase.from('schools').select('*').eq('id', userRole?.school_id).single();
    if (data) setSchoolInfo(data);
  };

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('*').eq('school_id', userRole?.school_id).order('name');
    if (data) setClasses(data);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const query = supabase
        .from('students')
        .select('*, classes(name, section)')
        .eq('school_id', userRole?.school_id)
        .eq('status', 'active')
        .eq('is_deleted', false);
      
      if (selectedClassId !== 'all') query.eq('class_id', selectedClassId);
      if (isFree) query.eq('fee_waiver_percentage', 100);
      else query.gt('fee_waiver_percentage', 0);

      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

      const [{ data: discounts }, { data: feeStructures }, { data: currentFees }] = await Promise.all([
        query,
        supabase.from('fee_structures').select('*').eq('school_id', userRole?.school_id),
        supabase.from('fee_records')
          .select('student_id, status')
          .eq('school_id', userRole?.school_id)
          .gte('month_year', startOfMonth)
      ]);

      const formattedData = (discounts || []).map((s) => {
        const feeStruct = feeStructures?.find(f => f.class_id === s.class_id);
        const monthlyFee = feeStruct?.amount || 0;
        const discountAmt = (monthlyFee * (s.fee_waiver_percentage || 0)) / 100;
        const netFee = monthlyFee - discountAmt;
        const studentFeeRecord = currentFees?.find(f => f.student_id === s.id);
        const status = studentFeeRecord ? studentFeeRecord.status : 'No Record';

        return {
          id: s.student_unique_id || 'N/A',
          name: s.full_name,
          class: (s.classes as any)?.name ? `${(s.classes as any).name} ${(s.classes as any).section}` : 'N/A',
          scholarship: `${s.fee_waiver_percentage}%`,
          monthlyFee,
          discountAmt,
          netFee,
          status
        };
      });

      setReportData(formattedData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const logoUrl = schoolInfo?.logo_url;
    const logoBase64 = logoUrl ? await toBase64(logoUrl) : '';

    addPdfHeader({
      doc,
      schoolInfo,
      title,
      subtitle,
      reportId: reportType,
      logoBase64,
      isLandscape: true
    });

    const head = [['Sr.', 'ID', 'Student Name', 'Class/Sec', 'Scholarship %', 'Net Fee', 'Fee Status']];
    const body = filteredData.map((row, idx) => [
      (idx + 1).toString().padStart(2, '0'),
      row.id,
      row.name,
      row.class,
      row.scholarship,
      row.netFee.toLocaleString(),
      row.status.toUpperCase()
    ]);

    autoTable(doc, {
      head,
      body,
      startY: 45,
      headStyles: { fillColor: isFree ? [5, 150, 105] : [245, 158, 11], textColor: 255 },
      theme: 'grid',
      styles: { fontSize: 9 }
    });

    doc.save(`${reportType}-report.pdf`);
  };

  const filteredData = reportData.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) || r.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = feeStatus === 'all' || 
                          (feeStatus === 'no_record' ? r.status === 'No Record' : r.status.toLowerCase() === feeStatus);
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-[#0d1526] uppercase">{title}</h1>
            <p className="text-slate-500 text-sm font-medium">{subtitle}</p>
          </div>
        </div>
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Download className="w-4 h-4" />
          Download PDF
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search students..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        <div className="w-full sm:w-auto flex gap-2">
          <select
            value={feeStatus}
            onChange={e => setFeeStatus(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Fee Status</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="overdue">Overdue</option>
            <option value="no_record">No Record</option>
          </select>

          <select
            value={selectedClassId}
            onChange={e => setSelectedClassId(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Classes</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-6 py-4">Sr.</th>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Student Name</th>
                <th className="px-6 py-4">Class/Sec</th>
                <th className="px-6 py-4">Scholarship %</th>
                <th className="px-6 py-4 text-right">Net Fee</th>
                <th className="px-6 py-4 text-center">Fee Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">Loading report data...</p>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                    No records found for the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredData.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-slate-400 font-medium">{(idx + 1).toString().padStart(2, '0')}</td>
                    <td className="px-6 py-4 font-mono text-slate-600">{row.id}</td>
                    <td className="px-6 py-4 font-bold text-[#0d1526]">{row.name}</td>
                    <td className="px-6 py-4 text-slate-600">{row.class}</td>
                    <td className="px-6 py-4 font-bold text-indigo-600">{row.scholarship}</td>
                    <td className="px-6 py-4 text-right font-bold text-[#0d1526]">{row.netFee.toLocaleString()}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                        row.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                        row.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        row.status === 'overdue' ? 'bg-rose-100 text-rose-700' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
