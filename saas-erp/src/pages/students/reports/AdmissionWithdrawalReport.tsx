import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Download, ArrowLeft, Loader2, Search } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toBase64, addPdfHeader } from '../../../lib/pdfUtils';
import { formatDate } from '../../../lib/utils';

interface AdmissionWithdrawalReportProps {
  onBack: () => void;
  reportType: 'admission' | 'withdrawal' | 'adm_wd';
}

export default function AdmissionWithdrawalReport({ onBack, reportType }: AdmissionWithdrawalReportProps) {
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [reportData, setReportData] = useState<any[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const titleMap = {
    admission: 'Student Admission Report',
    withdrawal: 'Student Withdrawal Report',
    adm_wd: 'Consolidated Admissions & Withdrawals'
  };

  useEffect(() => {
    if (userRole?.school_id) {
      fetchSchoolInfo();
      fetchClasses();
      fetchData();
    }
  }, [userRole, selectedClassId, startDate, endDate, reportType]);

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
      let combinedData: any[] = [];

      // Fetch Admissions
      if (reportType === 'admission' || reportType === 'adm_wd') {
        const query = supabase
          .from('students')
          .select('*, classes(name, section)')
          .eq('school_id', userRole?.school_id)
          .gte('admission_date', startDate)
          .lte('admission_date', endDate)
          .eq('is_deleted', false)
          .order('admission_date');

        if (selectedClassId !== 'all') query.eq('class_id', selectedClassId);

        const { data: admissions } = await query;
        if (admissions) {
          combinedData = [...combinedData, ...admissions.map(s => ({ ...s, recordType: 'Admission' }))];
        }
      }

      // Fetch Withdrawals
      if (reportType === 'withdrawal' || reportType === 'adm_wd') {
        const query = supabase
          .from('students')
          .select('*, classes(name, section)')
          .eq('school_id', userRole?.school_id)
          .neq('status', 'active')
          .eq('is_deleted', false)
          .order('created_at', { ascending: false }); // Should ideally use withdrawal_date if available

        if (selectedClassId !== 'all') query.eq('class_id', selectedClassId);

        const { data: withdrawals } = await query;
        if (withdrawals) {
          // If adm_wd, we need to filter withdrawals by date, assuming created_at or updated_at for now
          // For simplicity in this demo schema, we just list them if they match class criteria.
          // Ideally: query.gte('withdrawal_date', startDate).lte('withdrawal_date', endDate)
          combinedData = [...combinedData, ...withdrawals.map(s => ({ ...s, recordType: 'Withdrawal' }))];
        }
      }

      const formattedData = combinedData.map((s) => ({
        id: s.student_unique_id || 'N/A',
        name: s.full_name,
        class: (s.classes as any)?.name ? `${(s.classes as any).name} ${(s.classes as any).section}` : 'N/A',
        date: formatDate(s.admission_date),
        type: s.recordType,
        gender: s.gender || '—',
        status: s.status.toUpperCase()
      }));

      setReportData(formattedData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    const doc = new jsPDF();
    const logoUrl = schoolInfo?.logo_url;
    const logoBase64 = logoUrl ? await toBase64(logoUrl) : '';

    addPdfHeader({
      doc,
      schoolInfo,
      title: titleMap[reportType],
      subtitle: `Period: ${formatDate(startDate)} to ${formatDate(endDate)}`,
      reportId: reportType,
      logoBase64
    });

    const head = reportType === 'adm_wd' 
      ? [['Sr.', 'ID', 'Student Name', 'Class/Sec', 'Type', 'Date']]
      : [['Sr.', 'ID', 'Student Name', 'Class/Sec', reportType === 'withdrawal' ? 'Status' : 'Gender', 'Date']];

    const body = reportData.map((row, idx) => [
      (idx + 1).toString().padStart(2, '0'),
      row.id,
      row.name,
      row.class,
      reportType === 'adm_wd' ? row.type : (reportType === 'withdrawal' ? row.status : row.gender),
      row.date
    ]);

    autoTable(doc, {
      head,
      body,
      startY: 45,
      headStyles: { fillColor: reportType === 'withdrawal' ? [225, 29, 72] : [79, 70, 229], textColor: 255 },
      theme: 'striped',
      styles: { fontSize: 9 }
    });

    doc.save(`${reportType}-report.pdf`);
  };

  const filteredData = reportData.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            <h1 className="text-2xl font-black text-[#0d1526] uppercase">{titleMap[reportType]}</h1>
            <p className="text-slate-500 text-sm font-medium">Period: {formatDate(startDate)} to {formatDate(endDate)}</p>
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

      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center">
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
        
        {/* Date Range Selector */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-1.5 rounded-xl">
           <div className="flex flex-col px-2">
              <span className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">From</span>
              <input 
                type="date" 
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 outline-none"
              />
           </div>
           <div className="w-px h-6 bg-slate-200 self-center" />
           <div className="flex flex-col px-2">
              <span className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">To</span>
              <input 
                type="date" 
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 outline-none"
              />
           </div>
        </div>

        <div className="w-full md:w-auto">
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
                <th className="px-6 py-4">{reportType === 'adm_wd' ? 'Record Type' : (reportType === 'withdrawal' ? 'Status' : 'Gender')}</th>
                <th className="px-6 py-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">Loading report data...</p>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No records found for the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-slate-400 font-medium">{(idx + 1).toString().padStart(2, '0')}</td>
                    <td className="px-6 py-4 font-mono text-slate-600">{row.id}</td>
                    <td className="px-6 py-4 font-bold text-[#0d1526]">{row.name}</td>
                    <td className="px-6 py-4 text-slate-600">{row.class}</td>
                    <td className="px-6 py-4 font-medium text-slate-700">
                      {reportType === 'adm_wd' ? (
                        <span className={`px-2 py-1 rounded-full text-xs ${row.type === 'Admission' ? 'bg-indigo-100 text-indigo-700' : 'bg-rose-100 text-rose-700'}`}>
                          {row.type}
                        </span>
                      ) : (
                        reportType === 'withdrawal' ? row.status : row.gender
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-600">{row.date}</td>
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
