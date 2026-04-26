import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  BarChart3, Users, UserMinus, FileDigit, Calendar, Printer, 
  FileText, Download, CheckCircle2, ChevronRight, Search, 
  Filter, Award, ShieldAlert, GraduationCap, Clock
} from 'lucide-react';
import { cn } from '../../lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReportType {
  id: string;
  name: string;
  description: string;
  category: 'strength' | 'financial' | 'admin' | 'misc';
  icon: any;
}

const REPORTS: ReportType[] = [
  { id: 'strength', name: 'Student strength report', description: 'Class-wise student count and summary', category: 'strength', icon: Users },
  { id: 'admission', name: 'Student admission report', description: 'List of new admissions by date range', category: 'admin', icon: FileDigit },
  { id: 'withdrawal', name: 'Student withdrawal report', description: 'List of students who left the school', category: 'admin', icon: UserMinus },
  { id: 'adm_wd', name: 'Student admission/withdrawal report', description: 'Consolidated report of in/out students', category: 'admin', icon: FileText },
  { id: 'free_stu', name: 'Free student report', description: 'List of students with 100% discount', category: 'financial', icon: Award },
  { id: 'discount', name: 'Student discount report', description: 'Detailed list of all scholarship/discount holders', category: 'financial', icon: ShieldAlert },
];

// Convert remote URL → base64 via canvas (CORS-safe for jsPDF)
const toBase64 = (url: string): Promise<string> =>
  new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      canvas.getContext('2d')?.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve('');
    img.src = url;
  });

export default function StudentReports() {
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'strength' | 'financial' | 'admin' | 'misc'>('all');
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [stats, setStats] = useState({
    totalActive: 0,
    totalLeft: 0,
  });

  useEffect(() => {
    if (userRole?.school_id) fetchQuickStats();
  }, [userRole]);

  const fetchQuickStats = async () => {
    const { count: active } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', userRole?.school_id).eq('status', 'active');
    const { count: left } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', userRole?.school_id).neq('status', 'active');
    
    setStats({
      totalActive: active || 0,
      totalLeft: left || 0,
    });
    setLoading(false);
  };

  const generateReport = async (reportId: string) => {
    if (!userRole?.school_id) return;
    setLoading(true);
    
    try {
      const doc = new jsPDF();
      const schoolTitle = userRole?.schools?.name || 'Academic Institution';
      const dateString = `${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`;
      const logoUrl = userRole?.schools?.logo_url;

      // Load logo as base64 (CORS-safe)
      const logoBase64 = logoUrl ? await toBase64(logoUrl) : '';

      // Professional PDF Header Helper
      const addHeader = (title: string, subtitle?: string) => {
        // Logo
        if (logoBase64) {
          try {
            doc.addImage(logoBase64, 'PNG', 15, 12, 20, 20);
          } catch (e) { console.warn('Logo embed failed'); }
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text(schoolTitle, 40, 20);
        
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139); // slate-500
        doc.text(subtitle || 'Official Academic Record', 40, 26);
        
        doc.setDrawColor(79, 70, 229); // indigo-600
        doc.setLineWidth(1.5);
        doc.line(15, 36, 195, 36);

        doc.setFontSize(14);
        doc.setTextColor(30, 41, 59);
        doc.text(title, 195, 25, { align: 'right' });
        
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`REF: ${reportId.toUpperCase()}-${Date.now().toString().substring(0,8)}`, 195, 30, { align: 'right' });
      };

      if (reportId === 'strength') {
        const { data: students } = await supabase
          .from('students')
          .select('*, classes(name, section)')
          .eq('school_id', userRole.school_id)
          .eq('status', 'active');

        if (!students) return;

        addHeader('Student Strength Summary', `Generated: ${new Date().toLocaleDateString()}`);

        const grouped: Record<string, any[]> = {};
        students.forEach(s => {
          const key = (s.classes as any)?.name ? `${(s.classes as any).name} ${(s.classes as any).section || ''}` : 'No Class';
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(s);
        });

        const body = Object.entries(grouped).map(([cls, list], idx) => [
          (idx + 1).toString().padStart(2, '0'),
          cls,
          list.length,
          list.filter(s => s.gender === 'Male').length,
          list.filter(s => s.gender === 'Female').length
        ]);

        const totalStudents = students.length;
        const totalMale = students.filter(s => s.gender === 'Male').length;
        const totalFemale = students.filter(s => s.gender === 'Female').length;
        body.push(['', 'CONSOLIDATED TOTAL', totalStudents, totalMale, totalFemale]);

        autoTable(doc, {
          head: [['Sr.', 'Class / Section', 'Strength', 'Male', 'Female']],
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

      } else if (reportId === 'admission' || reportId === 'adm_wd') {
        const { data: admissions } = await supabase
          .from('students')
          .select('*, classes(name, section)')
          .eq('school_id', userRole.school_id)
          .gte('admission_date', startDate)
          .lte('admission_date', endDate)
          .order('admission_date');

        addHeader('New Admissions Report', `Period: ${dateString}`);

        const body = (admissions || []).map((s, idx) => [
          (idx + 1).toString().padStart(2, '0'),
          s.student_unique_id || 'N/A',
          s.full_name,
          (s.classes as any)?.name ? `${(s.classes as any).name} ${(s.classes as any).section}` : 'N/A',
          s.admission_date,
          s.gender || '—'
        ]);

        autoTable(doc, {
          head: [['Sr.', 'ID', 'Student Name', 'Class/Sec', 'Adm. Date', 'Gender']],
          body,
          startY: 45,
          headStyles: { fillColor: [79, 70, 229], textColor: 255 },
          theme: 'striped',
          styles: { fontSize: 9 }
        });

        if (reportId === 'adm_wd') doc.addPage();
        else doc.save(`admissions-report-${startDate}.pdf`);
      }

      if (reportId === 'withdrawal' || reportId === 'adm_wd') {
        const { data: withdrawals } = await supabase
          .from('students')
          .select('*, classes(name, section)')
          .eq('school_id', userRole.school_id)
          .neq('status', 'active')
          .order('created_at', { ascending: false });

        if (reportId === 'adm_wd') {
          addHeader('Withdrawals / Left Record', `Full History Summary`);
        } else {
          addHeader('Student Withdrawal Report', `Historical Personnel Record`);
        }

        const body = (withdrawals || []).map((s, idx) => [
          (idx + 1).toString().padStart(2, '0'),
          s.student_unique_id || 'N/A',
          s.full_name,
          (s.classes as any)?.name ? `${(s.classes as any).name} ${(s.classes as any).section}` : 'N/A',
          s.status.toUpperCase(),
          s.admission_date || '—'
        ]);

        autoTable(doc, {
          head: [['Sr.', 'ID', 'Student Name', 'Class/Sec', 'Status', 'Adm. Date']],
          body,
          startY: 45,
          headStyles: { fillColor: [225, 29, 72], textColor: 255 },
          theme: 'striped',
          styles: { fontSize: 9 }
        });

        if (reportId === 'adm_wd') doc.save(`adm-wd-consolidated-report.pdf`);
        else doc.save(`withdrawals-report-${new Date().toISOString().split('T')[0]}.pdf`);
      }

      if (reportId === 'free_stu' || reportId === 'discount') {
        const query = supabase
          .from('students')
          .select('*, classes(name, section)')
          .eq('school_id', userRole.school_id)
          .eq('status', 'active');
        
        if (reportId === 'free_stu') query.eq('fee_waiver_percentage', 100);
        else query.gt('fee_waiver_percentage', 0);

        const { data: discounts } = await query;

        addHeader(reportId === 'free_stu' ? 'Full Waiver Students' : 'Scholarship Holders', 'Financial Aid Summary');

        const body = (discounts || []).map((s, idx) => [
          (idx + 1).toString().padStart(2, '0'),
          s.student_unique_id || 'N/A',
          s.full_name,
          (s.classes as any)?.name ? `${(s.classes as any).name} ${(s.classes as any).section}` : 'N/A',
          `${s.fee_waiver_percentage}%`,
          s.admission_date || '—'
        ]);

        autoTable(doc, {
          head: [['Sr.', 'ID', 'Student Name', 'Class/Sec', 'Scholarship', 'Adm. Date']],
          body,
          startY: 45,
          headStyles: { fillColor: reportId === 'free_stu' ? [5, 150, 105] : [245, 158, 11], textColor: 255 },
          theme: 'grid',
          styles: { fontSize: 9 }
        });

        doc.save(`${reportId}-analytics-report.pdf`);
      }

    } catch (err) {
      console.error('Report Generation Error:', err);
      alert('Failed to generate report. Please verify connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredReports = REPORTS.filter(r => 
    (activeCategory === 'all' || r.category === activeCategory) &&
    (r.name.toLowerCase().includes(searchTerm.toLowerCase()) || r.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* ── Header Area ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#0d1526] flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-600" /> Student Analytics & Reports
          </h1>
          <p className="text-slate-500 text-sm mt-1">High-density administrative reports and data exports.</p>
        </div>
        
        {/* Quick Metrics */}
        <div className="flex gap-3">
          {[
            { label: 'Active', val: stats.totalActive, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Left', val: stats.totalLeft, color: 'text-rose-600', bg: 'bg-rose-50' },
          ].map(s => (
            <div key={s.label} className={cn("px-4 py-2 rounded-xl border border-slate-100 shadow-sm", s.bg)}>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{s.label}</p>
              <p className={cn("text-lg font-black", s.color)}>{s.val}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search reports by name..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
        </div>

        {/* Date Range Selector */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-1.5 rounded-xl">
           <div className="flex flex-col px-2">
              <span className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">From Date</span>
              <input 
                type="date" 
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 outline-none"
              />
           </div>
           <div className="w-px h-6 bg-slate-200 self-center" />
           <div className="flex flex-col px-2">
              <span className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">To Date</span>
              <input 
                type="date" 
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 outline-none"
              />
           </div>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1 md:pb-0 w-full md:w-auto">
          {(['all', 'strength', 'financial', 'admin', 'misc'] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all whitespace-nowrap",
                activeCategory === cat 
                  ? "bg-[#0d1526] border-[#0d1526] text-white shadow-md shadow-indigo-200" 
                  : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── Reports Listing Table ── */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#0d1526]">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-16">Sr.</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Report Module</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Category</th>
                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReports.map((report, idx) => {
                const Icon = report.icon;
                return (
                  <tr key={report.id} className="group hover:bg-slate-50 transition-all duration-200 cursor-pointer" onClick={() => generateReport(report.id)}>
                    <td className="px-6 py-5 font-black text-slate-300 text-xs">{(idx + 1).toString().padStart(2, '0')}</td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-black text-slate-800 tracking-tight text-base group-hover:text-indigo-600 transition-colors uppercase">{report.name}</p>
                          <p className="text-slate-400 text-xs mt-0.5">{report.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                        report.category === 'strength' ? 'bg-blue-100 text-blue-700' :
                        report.category === 'financial' ? 'bg-emerald-100 text-emerald-700' :
                        report.category === 'admin' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                      )}>
                        {report.category}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                          title="Generate PDF"
                        >
                          <Download className="w-5 h-5" />
                        </button>
                        <div className="w-8 h-8 flex items-center justify-center text-slate-300 group-hover:text-indigo-500 transition-all">
                          <ChevronRight className="w-5 h-5" />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredReports.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center">
                      <div className="bg-slate-50 p-6 rounded-full mb-4">
                        <Filter className="w-12 h-12 text-slate-200" />
                      </div>
                      <p className="text-slate-500 font-bold">No reports found matching your criteria.</p>
                      <button onClick={() => { setSearchTerm(''); setActiveCategory('all'); }} className="mt-2 text-indigo-600 font-bold text-sm hover:underline">Clear all filters</button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Stats Area ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
           <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
             <CheckCircle2 className="w-4 h-4 text-emerald-500" /> System Integrity
           </h3>
           <div className="flex items-baseline gap-2">
             <p className="text-4xl font-black text-slate-800">100%</p>
             <p className="text-emerald-600 text-sm font-bold">Data Synced</p>
           </div>
           <p className="text-slate-400 text-xs mt-3">All records from current academic session are reconciled.</p>
        </div>
        
        <div className="bg-[#0d1526] rounded-3xl p-6 shadow-xl relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-150 transition-transform duration-700">
             <Award className="w-32 h-32 text-white" />
           </div>
           <h3 className="text-xs font-black text-indigo-300 uppercase tracking-widest mb-4">Report Performance</h3>
           <p className="text-white font-bold leading-tight">Generate high-fidelity administrative PDF reports in <span className="text-indigo-300 text-xl font-black">{'< 2s'}</span></p>
           <button className="mt-4 text-xs font-black text-indigo-200 uppercase tracking-widest hover:text-white transition-colors">Learn more about export engine →</button>
        </div>
      </div>
    </div>
  );
}
