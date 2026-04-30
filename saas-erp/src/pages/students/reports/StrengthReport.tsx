import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Download, ArrowLeft, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toBase64, addPdfHeader } from '../../../lib/pdfUtils';
import { formatDate } from '../../../lib/utils';

interface StrengthReportProps {
  onBack: () => void;
}

export default function StrengthReport({ onBack }: StrengthReportProps) {
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<any[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('all');

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

      const { data: students } = await query;

      if (!students) {
        setReportData([]);
        return;
      }

      const grouped: Record<string, any[]> = {};
      students.forEach(s => {
        const key = (s.classes as any)?.name ? `${(s.classes as any).name} ${(s.classes as any).section || ''}` : 'No Class';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(s);
      });

      const body = Object.entries(grouped).map(([cls, list]) => ({
        class: cls,
        strength: list.length,
        male: list.filter(s => s.gender === 'Male').length,
        female: list.filter(s => s.gender === 'Female').length
      }));

      setReportData(body);
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
      title: 'Student Strength Summary',
      subtitle: 'Class-wise Enrollment Analytics',
      reportId: 'strength',
      logoBase64
    });

    const head = [['Sr.', 'Class / Section', 'Strength', 'Male', 'Female']];
    const body = reportData.map((row, idx) => [
      (idx + 1).toString().padStart(2, '0'),
      row.class,
      row.strength.toString(),
      row.male.toString(),
      row.female.toString()
    ]);

    const totalStudents = reportData.reduce((acc, curr) => acc + curr.strength, 0);
    const totalMale = reportData.reduce((acc, curr) => acc + curr.male, 0);
    const totalFemale = reportData.reduce((acc, curr) => acc + curr.female, 0);
    
    body.push(['', 'CONSOLIDATED TOTAL', totalStudents.toString(), totalMale.toString(), totalFemale.toString()]);

    autoTable(doc, {
      head,
      body,
      startY: 45,
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 5 },
      didParseCell: (data) => {
        if (data.row.index === body.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [248, 250, 252];
          data.cell.styles.textColor = [79, 70, 229];
        }
      }
    });

    doc.save('student-strength-report.pdf');
  };

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
            <h1 className="text-2xl font-black text-[#0d1526] uppercase">Student Strength</h1>
            <p className="text-slate-500 text-sm font-medium">Class-wise Enrollment Analytics</p>
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

      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
        <div className="w-full max-w-sm">
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
                <th className="px-6 py-4">Class/Sec</th>
                <th className="px-6 py-4 text-center">Strength</th>
                <th className="px-6 py-4 text-center">Male</th>
                <th className="px-6 py-4 text-center">Female</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">Loading report data...</p>
                  </td>
                </tr>
              ) : reportData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    No records found for the selected criteria.
                  </td>
                </tr>
              ) : (
                <>
                  {reportData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-slate-400 font-medium">{(idx + 1).toString().padStart(2, '0')}</td>
                      <td className="px-6 py-4 font-bold text-[#0d1526]">{row.class}</td>
                      <td className="px-6 py-4 text-center font-medium text-slate-600">{row.strength}</td>
                      <td className="px-6 py-4 text-center text-slate-600">{row.male}</td>
                      <td className="px-6 py-4 text-center text-slate-600">{row.female}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-bold">
                    <td className="px-6 py-4" colSpan={2}>CONSOLIDATED TOTAL</td>
                    <td className="px-6 py-4 text-center text-indigo-600">{reportData.reduce((acc, curr) => acc + curr.strength, 0)}</td>
                    <td className="px-6 py-4 text-center text-indigo-600">{reportData.reduce((acc, curr) => acc + curr.male, 0)}</td>
                    <td className="px-6 py-4 text-center text-indigo-600">{reportData.reduce((acc, curr) => acc + curr.female, 0)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
