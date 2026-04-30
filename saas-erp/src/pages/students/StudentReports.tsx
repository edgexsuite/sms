import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  BarChart3, Users, UserMinus, FileDigit, 
  FileText, Search, Award, ShieldAlert
} from 'lucide-react';
import { cn } from '../../lib/utils';

// Import Report Modules
import StrengthReport from './reports/StrengthReport';
import AdmissionWithdrawalReport from './reports/AdmissionWithdrawalReport';
import FinancialAidReport from './reports/FinancialAidReport';

interface ReportType {
  id: string;
  name: string;
  description: string;
  category: 'strength' | 'financial' | 'admin' | 'misc';
  icon: any;
  type: 'strength' | 'admission' | 'withdrawal' | 'adm_wd' | 'free_stu' | 'discount';
}

const REPORTS: ReportType[] = [
  { id: 'strength', name: 'Student strength report', description: 'Class-wise student count and summary', category: 'strength', icon: Users, type: 'strength' },
  { id: 'admission', name: 'Student admission report', description: 'List of new admissions by date range', category: 'admin', icon: FileDigit, type: 'admission' },
  { id: 'withdrawal', name: 'Student withdrawal report', description: 'List of students who left the school', category: 'admin', icon: UserMinus, type: 'withdrawal' },
  { id: 'adm_wd', name: 'Student admission/withdrawal report', description: 'Consolidated report of in/out students', category: 'admin', icon: FileText, type: 'adm_wd' },
  { id: 'free_stu', name: 'Free student report', description: 'List of students with 100% discount', category: 'financial', icon: Award, type: 'free_stu' },
  { id: 'discount', name: 'Student discount report', description: 'Detailed list of all scholarship/discount holders', category: 'financial', icon: ShieldAlert, type: 'discount' },
];

export default function StudentReports() {
  const { userRole } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'strength' | 'financial' | 'admin' | 'misc'>('all');
  const [stats, setStats] = useState({
    totalActive: 0,
    totalLeft: 0,
  });
  
  const [activeReport, setActiveReport] = useState<ReportType | null>(null);

  useEffect(() => {
    if (userRole?.school_id) {
      fetchQuickStats();
    }
  }, [userRole]);

  const fetchQuickStats = async () => {
    const { count: active } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', userRole?.school_id).eq('status', 'active').eq('is_deleted', false);
    const { count: left } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', userRole?.school_id).neq('status', 'active').eq('is_deleted', false);
    
    setStats({
      totalActive: active || 0,
      totalLeft: left || 0,
    });
  };

  const filteredReports = REPORTS.filter(r => 
    (activeCategory === 'all' || r.category === activeCategory) &&
    (r.name.toLowerCase().includes(searchTerm.toLowerCase()) || r.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Render active report module
  if (activeReport) {
    const handleBack = () => setActiveReport(null);
    
    switch(activeReport.type) {
      case 'strength':
        return <StrengthReport onBack={handleBack} />;
      case 'admission':
      case 'withdrawal':
      case 'adm_wd':
        return <AdmissionWithdrawalReport onBack={handleBack} reportType={activeReport.type} />;
      case 'free_stu':
      case 'discount':
        return <FinancialAidReport onBack={handleBack} reportType={activeReport.type} />;
      default:
        return <div>Report module not found.</div>;
    }
  }

  // Render Main Dashboard
  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* ── Header Area ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#0d1526] flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-600" /> Student Analytics & Reports
          </h1>
          <p className="text-slate-500 text-sm mt-1">Select a report module to view dynamic data and generate PDFs.</p>
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
                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReports.map((report, idx) => {
                const Icon = report.icon;
                return (
                  <tr key={report.id} className="group hover:bg-slate-50 transition-all duration-200 cursor-pointer" 
                      onClick={() => setActiveReport(report)}>
                    <td className="px-6 py-5 font-black text-slate-300 text-xs">{(idx + 1).toString().padStart(2, '0')}</td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                          <Icon className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                          <p className="font-bold text-[#0d1526]">{report.name}</p>
                          <p className="text-slate-500 text-xs mt-0.5 max-w-md truncate">{report.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={cn(
                        "px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider",
                        report.category === 'financial' ? "bg-amber-100 text-amber-700" :
                        report.category === 'strength' ? "bg-emerald-100 text-emerald-700" :
                        report.category === 'admin' ? "bg-rose-100 text-rose-700" :
                        "bg-slate-100 text-slate-700"
                      )}>
                        {report.category}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          className="px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white font-bold rounded-xl transition-all"
                        >
                          Open Report
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredReports.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                    No reports match your current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
