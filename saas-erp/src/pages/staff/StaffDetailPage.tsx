import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { cn, formatDate } from '../../lib/utils';
import {
  ArrowLeft, Printer, User, Calendar, CreditCard,
  Mail, MapPin, Shield, AlertCircle, MessageSquare, Award, Clock,
  Briefcase, BookOpen, Layout, FileCheck, Wallet, CheckCircle, Hash, Building2, Phone, Fingerprint, GraduationCap, FileText, ShieldCheck
} from 'lucide-react';
import JoiningLetter from '../../components/JoiningLetter';
import ExperienceCertificate from '../../components/ExperienceCertificate';
import { motion, AnimatePresence } from 'motion/react';
import * as templatesLib from '../../lib/whatsappTemplates';

export default function StaffDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const [staff, setStaff] = useState<any | null>(null);
  const [schoolInfo, setSchoolInfo] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [printDoc, setPrintDoc] = useState<'joining' | 'experience' | null>(null);

  // New Tabbed State
  const [activeTab, setActiveTab] = useState('overview');
  const [attendanceStats, setAttendanceStats] = useState({ present: 0, absent: 0, late: 0, percentage: 0 });
  const [payrollHistory, setPayrollHistory] = useState<any[]>([]);
  const [timetable, setTimetable] = useState<any[]>([]);
  const [diary, setDiary] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [fetchingTab, setFetchingTab] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      const init = async () => {
        setLoading(true);
        await Promise.all([fetchStaff(), fetchSchoolInfo()]);
        fetchTab('overview'); // Load initial tab
        setLoading(false);
      };
      init();
    }
  }, [id, userRole]);

  const fetchTab = async (tab: string) => {
    if (!id || !userRole?.school_id) return;
    setFetchingTab(tab);

    try {
      if (tab === 'overview') {
        const { data: att } = await supabase.from('attendance').select('status').eq('staff_id', id).like('date', `${new Date().toISOString().slice(0, 7)}%`);
        if (att) {
          const present = att.filter(a => a.status === 'present' || a.status === 'late').length;
          const total = att.length;
          setAttendanceStats({
            present,
            absent: att.filter(a => a.status === 'absent').length,
            late: att.filter(a => a.status === 'late').length,
            percentage: total > 0 ? Math.round((present / total) * 100) : 0
          });
        }
      } else if (tab === 'ledger') {
        const { data } = await supabase.from('payroll_records').select('*').eq('staff_id', id).order('month_year', { ascending: false });
        if (data) setPayrollHistory(data);
      } else if (tab === 'timetable') {
        const { data } = await supabase.from('timetable_slots').select('*, subjects(subject_name), classes(name, section)').eq('teacher_id', id).order('period_number');
        if (data) setTimetable(data);
      } else if (tab === 'work') {
        const [{ data: dEntries }, { data: lApps }] = await Promise.all([
          supabase.from('teacher_diary').select('*').eq('teacher_id', id).order('date', { ascending: false }).limit(10),
          supabase.from('leave_applications').select('*').eq('staff_id', id).order('start_date', { ascending: false })
        ]);
        if (dEntries) setDiary(dEntries);
        if (lApps) setLeaves(lApps);
      }
    } catch (err) {
      console.error(`Error fetching ${tab}:`, err);
    } finally {
      setFetchingTab(null);
    }
  };

  const fetchStaff = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) {
      setLoading(false);
      return;
    }
    setStaff(data);
    setLoading(false);
  };

  const fetchSchoolInfo = async () => {
    if (!userRole?.school_id) return;
    const { data } = await supabase.from('schools').select('*').eq('id', userRole.school_id).single();
    if (data) setSchoolInfo(data);
  };

  const handlePrintProfile = () => {
    window.print();
  };

  const handlePrint = (type: 'joining' | 'experience') => {
    setPrintDoc(type);
    document.body.classList.add('is-printing');
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setPrintDoc(null);
        document.body.classList.remove('is-printing');
      }, 1000);
    }, 500);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Loading Personnel File...</p>
        </div>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center p-6">
        <div>
          <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-slate-900 uppercase">Personnel Record Not Found</h2>
          <p className="text-slate-500 mt-2">The requested staff member could not be located in our secure database.</p>
          <button onClick={() => navigate('/staff')} className="mt-8 px-6 py-2 bg-slate-900 text-white rounded-xl font-bold uppercase text-xs tracking-widest">Return to Directory</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .standard-ui { display: block !important; padding: 0 !important; margin: 0 !important; }
          .print-card { 
            border: 1px solid #e2e8f0 !important; 
            border-radius: 12px !important;
            break-inside: avoid;
            background: white !important;
            padding: 24px !important;
            margin-bottom: 24px !important;
            overflow: visible !important;
            height: auto !important;
          }
          .hero-banner { 
            background: white !important; 
            color: black !important; 
            border: 2px solid #0f172a !important;
            border-radius: 24px !important;
            padding: 40px !important;
            margin-bottom: 40px !important;
            overflow: visible !important;
          }
          .hero-banner * { color: black !important; background: transparent !important; }
          .hero-gradient-text { color: black !important; -webkit-text-fill-color: black !important; }
          .tab-content { display: block !important; overflow: visible !important; }
          body, #root, main, .theme-shell { background: white !important; overflow: visible !important; height: auto !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; overflow: visible !important; }
          .no-print { display: none !important; }
          table { width: 100% !important; border-collapse: collapse !important; }
          th, td { border-bottom: 1px solid #e2e8f0 !important; }
        }
        @media screen {
          .print-only { display: none !important; }
          .standard-ui.hidden { display: none !important; }
          .print-container { 
            position: fixed; 
            inset: 0; 
            background: rgba(0,0,0,0.8); 
            z-index: 9999; 
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 40px;
          }
        }
      `}</style>

      <AnimatePresence>
        {printDoc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="print-container overflow-auto"
          >
            {printDoc === 'joining' ? (
              <JoiningLetter staff={staff} schoolInfo={schoolInfo} />
            ) : (
              <ExperienceCertificate staff={staff} schoolInfo={schoolInfo} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className={cn("min-h-screen bg-slate-50 font-sans pb-20 standard-ui", printDoc ? "hidden" : "block")}>
        {/* ── Top Bar: Navigation & Action ── */}
        <div className="no-print sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <button onClick={() => navigate('/staff')} className="flex items-center gap-2.5 text-slate-500 hover:text-indigo-600 transition-all font-black text-[10px] uppercase tracking-widest whitespace-nowrap">
              <ArrowLeft className="w-4 h-4" /> Personnel Directory
            </button>
            <div className="flex flex-wrap justify-center gap-3">
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 overflow-x-auto max-w-full">
                {[
                  { id: 'overview', label: 'Overview', icon: User },
                  { id: 'ledger', label: 'Ledger', icon: Wallet },
                  { id: 'timetable', label: 'Timetable', icon: Clock },
                  { id: 'attendance', label: 'Attendance', icon: Fingerprint },
                  { id: 'work', label: 'Work Log', icon: BookOpen },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id); fetchTab(tab.id); }}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                      activeTab === tab.id ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    <tab.icon className="w-3 h-3" /> {tab.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => handlePrint('joining')} className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 hover:text-indigo-600 transition shadow-sm" title="Joining Letter">
                  <Award className="w-4 h-4" />
                </button>
                <button onClick={() => handlePrint('experience')} className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 hover:text-indigo-600 transition shadow-sm" title="Experience Cert">
                  <FileText className="w-4 h-4" />
                </button>
                <button onClick={handlePrintProfile} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest text-white hover:bg-indigo-700 transition shadow-lg shadow-indigo-100">
                  <Printer className="w-4 h-4" /> Print
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Highlights Bar (Summary Matrix) ── */}
        <div className="no-print bg-slate-50/50 border-b border-slate-200 px-4 sm:px-8 py-3 sm:py-6">
          <div className="max-w-7xl mx-auto flex gap-3 overflow-x-auto custom-scrollbar pb-1">
            {[
              { label: 'Attendance (MTD)', val: `${attendanceStats.percentage}%`, color: 'text-slate-900', icon: CheckCircle, sub: `${attendanceStats.present} Present` },
              { label: 'Current Pay Basis', val: `PKR ${staff.salary?.toLocaleString() || '0'}`, color: 'text-emerald-600', icon: Wallet, sub: staff.payment_basis || 'Monthly' },
              { label: 'Leaves Taken', val: leaves.filter(l => l.status === 'approved').length, color: 'text-rose-600', icon: AlertCircle, sub: 'This Session' },
              { label: 'System Access', val: staff.has_login ? 'Authorized' : 'Legacy', color: 'text-indigo-600', icon: Shield, sub: staff.role },
            ].map(item => (
              <div key={item.label} className="min-w-[160px] shrink-0 flex items-center gap-3 px-4 py-2.5 rounded-2xl border border-white bg-white shadow-sm hover:shadow-md transition-all">
                <div className={cn("p-2.5 rounded-xl bg-slate-50 shadow-inner", item.color)}>
                  <item.icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{item.label}</p>
                  <p className={cn("text-sm font-black mt-0.5", item.color)}>{item.val}</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5 opacity-60">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Hero Banner ── */}
        <div className="relative overflow-hidden hero-banner bg-[#0d1526] text-white py-8 sm:py-16 px-4 sm:px-8 print:bg-white print:text-slate-900 print:border-b-2 print:border-slate-900">
          {/* Decorative Elements - Hidden in Print */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -mr-48 -mt-48 no-print" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -ml-32 -mb-32 no-print" />

          {/* Print-Only Header */}
          <div className="print-only mb-10 pb-8 border-b-2 border-slate-900 flex justify-between items-center text-slate-900">
            <div className="flex items-center gap-6">
              {schoolInfo?.logo_url && (
                <img src={schoolInfo.logo_url} alt="School Logo" className="w-16 h-16 object-contain rounded-xl border border-slate-200 p-2" />
              )}
              <div>
                <h2 className="text-3xl font-black uppercase tracking-tighter">{schoolInfo?.name || 'Academic Institution'}</h2>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-2">Official Personnel Identification Record</p>
                {schoolInfo?.address && <p className="text-[10px] text-slate-400 mt-1">{schoolInfo.address}</p>}
              </div>
            </div>
            <div className="text-right">
              <div className="bg-slate-100 px-4 py-2 rounded-xl inline-block mb-3 border border-slate-200">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-900">Document Reference</p>
                <p className="text-xs font-mono font-bold mt-1 uppercase">{id?.substring(0, 12)}</p>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Generated: {formatDate(new Date())}</p>
            </div>
          </div>

          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center gap-6 relative z-10">
            {/* Photograph */}
            <div className="relative shrink-0">
              {staff.photograph_url ? (
                <img src={staff.photograph_url} alt={staff.full_name} className="w-28 h-28 sm:w-44 sm:h-44 rounded-3xl sm:rounded-[2.5rem] object-cover border-4 border-white/10 shadow-2xl ring-4 ring-indigo-500/20" />
              ) : (
                <div className="w-28 h-28 sm:w-44 sm:h-44 rounded-3xl sm:rounded-[2.5rem] bg-indigo-600/30 border-4 border-white/10 flex items-center justify-center text-5xl sm:text-7xl font-black text-white shadow-2xl ring-4 ring-indigo-500/20">
                  {staff.full_name.charAt(0).toUpperCase()}
                </div>
              )}
              {staff.is_active && (
                <div className="absolute -bottom-2 -right-2 bg-emerald-500 p-2 rounded-xl shadow-lg border-2 border-[#0d1526] no-print">
                   <ShieldCheck className="w-5 h-5 text-white" />
                </div>
              )}
            </div>

            <div className="flex-1 text-center md:text-left min-w-0">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-4 no-print">
                <span className={cn(
                  "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-lg",
                  staff.is_active ? "bg-emerald-500 text-white" : "bg-slate-500 text-white"
                )}>
                  {staff.is_active ? 'Authorized Personnel' : 'Deactivated'}
                </span>
                <span className="bg-white/10 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">Verified Node</span>
              </div>
              <h1 className="text-2xl sm:text-4xl md:text-6xl font-black tracking-tight mb-3 uppercase font-display hero-gradient-text text-white print:text-slate-900">{staff.full_name}</h1>
              
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-8 mt-8">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Current Role</span>
                  <p className="text-xl font-bold text-indigo-400 leading-none truncate uppercase tracking-tight">{staff.role}</p>
                </div>
                <div className="w-px h-10 bg-white/10 hidden md:block" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Administrative Dept</span>
                  <p className="text-xl font-bold text-slate-200 leading-none truncate uppercase tracking-tight">{staff.department || 'General'}</p>
                </div>
                <div className="w-px h-10 bg-white/10 hidden md:block" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Personnel ID</span>
                  <p className="text-xl font-mono font-bold text-slate-400 leading-none uppercase">{staff.id.substring(0, 8)}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 shrink-0 no-print">
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 text-center backdrop-blur-sm">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 text-center opacity-60">Base Remuneration</p>
                <p className="text-xl font-black text-emerald-400">Rs. {staff.salary?.toLocaleString() || '0'}</p>
                <p className="text-[9px] font-bold text-slate-600 uppercase mt-1">Settled {staff.payment_basis || 'Monthly'}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 text-center backdrop-blur-sm">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 text-center opacity-60">Session Tenure</p>
                <p className="text-xl font-black text-indigo-400">
                  {staff.joining_date ? Math.floor((new Date().getTime() - new Date(staff.joining_date).getTime()) / (1000 * 60 * 60 * 24 * 365)) : '0'} YRS
                </p>
                <p className="text-[9px] font-bold text-slate-600 uppercase mt-1">Active Record</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="max-w-6xl mx-auto px-8 mt-12 mb-20">
          {fetchingTab && (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
          )}

          {!fetchingTab && (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Column 1: Core Records */}
                  <div className="lg:col-span-2 space-y-8">
                    <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm print-card">
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] mb-8 pb-4 border-b border-slate-100 flex items-center gap-3">
                        <Shield className="w-4 h-4 text-indigo-600" /> Personnel Credentials & Info
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-y-8 gap-x-12">
                        {[
                          { label: 'Full Legal Name', value: staff.full_name, icon: User },
                          { label: 'Identity Number (CNIC)', value: staff.cnic || 'Not Disclosed', icon: Shield },
                          { label: 'Date of Birth', value: staff.dob || '—', icon: Calendar },
                          { label: 'Gender Identification', value: staff.gender || '—', icon: User },
                          { label: 'Highest Qualification', value: staff.qualification || '—', icon: GraduationCap },
                          { label: 'Date of Appointment', value: staff.joining_date || '—', icon: Clock },
                        ].map((item, i) => (
                          <div key={i} className="flex gap-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
                              <item.icon className="w-4 h-4 text-slate-400" />
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
                              <p className="text-sm font-bold text-slate-800">{item.value}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-10 pt-8 border-t border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Residential Address</p>
                        <div className="flex gap-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
                            <MapPin className="w-4 h-4 text-slate-400" />
                          </div>
                          <p className="text-sm font-bold text-slate-700 leading-relaxed italic">{staff.address || 'No address record on file.'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm print-card">
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] mb-8 pb-4 border-b border-slate-100 flex items-center gap-3">
                        <Building2 className="w-4 h-4 text-indigo-600" /> Professional Placement
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                          { label: 'Department', value: staff.department || 'General', icon: Layout },
                          { label: 'Designation', value: staff.role, icon: Briefcase },
                          { label: 'Employment', value: staff.employment_type || 'Full-Time', icon: FileCheck },
                        ].map((item, i) => (
                          <div key={i} className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{item.label}</p>
                            <div className="flex items-center gap-2">
                              <item.icon className="w-3.5 h-3.5 text-indigo-500" />
                              <p className="text-sm font-black text-slate-800">{item.value}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm print-card">
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] mb-6">Secure Contact Hub</h3>
                      <div className="space-y-6">
                        <div className="flex items-center gap-5 group cursor-pointer" onClick={() => window.open(`mailto:${staff.email}`)}>
                          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                            <Mail className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email Access</p>
                            <p className="text-sm font-black text-slate-800 truncate">{staff.email || 'Not configured'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-5 group cursor-pointer" onClick={() => templatesLib.openWhatsApp(staff.whatsapp_number || '', '')}>
                          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-sm">
                            <MessageSquare className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">WhatsApp Direct</p>
                            <p className="text-sm font-black text-slate-800 truncate">{staff.whatsapp_number || 'No contact logic'}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-950 rounded-[2rem] p-8 text-center border border-white/5 shadow-2xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/10 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-indigo-600/20 transition-all" />
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6 relative z-10">Security Digital Node</p>
                      <div className="bg-white p-6 rounded-3xl inline-block shadow-2xl relative z-10 transition-transform hover:scale-105">
                        <div className="w-28 h-28 bg-slate-50 rounded-xl flex items-center justify-center border-2 border-dashed border-slate-200">
                          <Fingerprint className="w-12 h-12 text-slate-300" />
                        </div>
                      </div>
                      <p className="mt-6 text-sm font-black text-white/90 font-mono tracking-widest uppercase">{staff.id.substring(0, 12)}</p>
                      <p className="mt-2 text-[8px] font-bold text-slate-600 uppercase tracking-[0.1em]">Encrypted Personnel Identity</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'ledger' && (
                <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm overflow-hidden print-card">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] mb-8 pb-4 border-b border-slate-100 flex items-center gap-3">
                    <Wallet className="w-4 h-4 text-emerald-500" /> Financial Execution Ledger
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <th className="px-6 py-4 rounded-l-xl">Payout Period</th>
                          <th className="px-6 py-4 text-right">Base Remuneration</th>
                          <th className="px-6 py-4 text-right">Allowances</th>
                          <th className="px-6 py-4 text-right">Deductions</th>
                          <th className="px-6 py-4 text-right">Net Disbursement</th>
                          <th className="px-6 py-4 rounded-r-xl text-center">Reference / Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {payrollHistory.length === 0 ? (
                          <tr><td colSpan={6} className="py-20 text-center text-slate-400 font-bold uppercase text-[10px]">No payroll records finalized yet</td></tr>
                        ) : payrollHistory.map((p, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-5 font-black text-slate-800">{formatDate(p.month_year)}</td>
                            <td className="px-6 py-5 text-right font-mono text-slate-600">{p.base_salary?.toLocaleString()}</td>
                            <td className="px-6 py-5 text-right font-mono text-emerald-600">+{p.gross_salary - p.base_salary > 0 ? (p.gross_salary - p.base_salary).toLocaleString() : '0'}</td>
                            <td className="px-6 py-5 text-right font-mono text-rose-600">−{p.absent_deduction?.toLocaleString() || '0'}</td>
                            <td className="px-6 py-5 text-right font-black text-slate-900 border-x border-slate-100 bg-slate-50/30">PKR {p.net_salary?.toLocaleString()}</td>
                            <td className="px-6 py-5 text-center">
                              <span className={cn(
                                "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ring-1 ring-inset",
                                p.status === 'paid' ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-amber-200"
                              )}>
                                {p.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'timetable' && (
                <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] mb-8 pb-4 border-b border-slate-100 flex items-center gap-3">
                    <Clock className="w-4 h-4 text-indigo-600" /> Weekly Academic Grid
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
                      const daySlots = timetable.filter(s => s.day_of_week === day);
                      return (
                        <div key={day} className="space-y-3">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center py-2 bg-slate-50 rounded-xl">{day}</p>
                          <div className="space-y-2">
                            {daySlots.length === 0 ? (
                              <p className="text-[8px] text-slate-300 font-bold uppercase text-center py-4">Free</p>
                            ) : daySlots.map((slot, i) => (
                              <div key={i} className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm group hover:border-indigo-400 transition-all">
                                <p className="text-[8px] font-black text-indigo-500 uppercase tracking-tighter">Period {slot.period_number}</p>
                                <p className="text-[10px] font-black text-slate-800 leading-tight mt-1">{slot.subjects?.subject_name}</p>
                                <p className="text-[9px] font-bold text-slate-400 mt-0.5">{slot.classes?.name}-{slot.classes?.section}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeTab === 'attendance' && (
                <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] mb-8 pb-4 border-b border-slate-100 flex items-center gap-3">
                    <Fingerprint className="w-4 h-4 text-indigo-600" /> Daily Pulse Tracker
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                    {[
                      { label: 'Present Days', val: attendanceStats.present, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                      { label: 'Late Commits', val: attendanceStats.late, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
                      { label: 'Total Absences', val: attendanceStats.absent, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
                      { label: 'Monthly Score', val: `${attendanceStats.percentage}%`, icon: Award, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                    ].map((stat, i) => (
                      <div key={i} className={cn("p-6 rounded-3xl border border-slate-100", stat.bg)}>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{stat.label}</p>
                        <div className="flex items-center justify-between">
                          <span className={cn("text-3xl font-black", stat.color)}>{stat.val}</span>
                          <stat.icon className={cn("w-8 h-8 opacity-20", stat.color)} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest italic italic">Live attendance logs can be verified via the Attendance Management Terminal.</p>
                </div>
              )}

              {activeTab === 'work' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] mb-8 pb-4 border-b border-slate-100 flex items-center gap-3">
                      <BookOpen className="w-4 h-4 text-indigo-600" /> Recent Instructional Diary
                    </h3>
                    <div className="space-y-4">
                      {diary.length === 0 ? (
                        <p className="py-10 text-center text-slate-300 font-bold uppercase text-[10px]">No diary entries recorded</p>
                      ) : diary.map((entry, idx) => (
                        <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                          <div className="flex justify-between mb-2">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{formatDate(entry.date)}</p>
                            <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">{entry.class_id}</p>
                          </div>
                          <p className="text-sm font-bold text-slate-800 leading-relaxed">{entry.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] mb-8 pb-4 border-b border-slate-100 flex items-center gap-3">
                      <FileText className="w-4 h-4 text-amber-500" /> Leave Application History
                    </h3>
                    <div className="space-y-4">
                      {leaves.length === 0 ? (
                        <p className="py-10 text-center text-slate-300 font-bold uppercase text-[10px]">No leave applications on file</p>
                      ) : leaves.map((lh, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
                          <div>
                            <p className="text-sm font-black text-slate-800">{lh.leave_type}</p>
                            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">{lh.start_date} to {lh.end_date}</p>
                          </div>
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ring-1 ring-inset",
                            lh.status === 'approved' ? "bg-emerald-50 text-emerald-700 ring-emerald-200" :
                              lh.status === 'rejected' ? "bg-rose-50 text-rose-700 ring-rose-200" :
                                "bg-slate-50 text-slate-700 ring-slate-200"
                          )}>
                            {lh.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </>
  );
}
