import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  GraduationCap, LogOut, Download, MessageCircle, ChevronRight, Eye, EyeOff,
  BookOpen, LayoutDashboard, CreditCard, CalendarCheck, BarChart2, Clock, Bell,
  ChevronLeft, CheckCircle2, XCircle, AlertCircle, TrendingUp, Users, ClipboardList
} from 'lucide-react';
import { downloadChallanPDF, DEFAULT_CHALLAN_CONFIG, ChallanRecord, SchoolInfo } from '../lib/challanUtils';

interface ParentData {
  id: string;
  full_name: string;
  family_number: string;
  school_id: string;
}

interface ChildData {
  id: string;
  full_name: string;
  roll_number: number | string;
  photograph_url?: string;
  class_id?: string;
  classes?: { name: string; section?: string } | null;
}

type Tab = 'overview' | 'fees' | 'attendance' | 'results' | 'timetable' | 'homework' | 'notices';

const SESSION_KEY = 'parent_portal_session';

const STATUS_STYLES: Record<string, string> = {
  paid: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  overdue: 'bg-red-100 text-red-800',
  partial: 'bg-blue-100 text-blue-800',
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const GRADE_COLORS: Record<string, string> = {
  'A+': 'bg-green-100 text-green-700',
  'A': 'bg-green-100 text-green-700',
  'B+': 'bg-blue-100 text-blue-700',
  'B': 'bg-blue-100 text-blue-700',
  'C+': 'bg-yellow-100 text-yellow-700',
  'C': 'bg-yellow-100 text-yellow-700',
  'D': 'bg-orange-100 text-orange-700',
  'F': 'bg-red-100 text-red-700',
};

export default function ParentPortal() {
  const [parentData, setParentData] = useState<ParentData | null>(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  const [familyNumber, setFamilyNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const [school, setSchool] = useState<SchoolInfo>({ name: '' });
  const [children, setChildren] = useState<ChildData[]>([]);
  const [activeChildId, setActiveChildId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loadingData, setLoadingData] = useState(false);

  // Fee data
  const [feeRecords, setFeeRecords] = useState<any[]>([]);
  // Attendance data
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [attMonth, setAttMonth] = useState(new Date().toISOString().slice(0, 7));
  // Results data
  const [examResults, setExamResults] = useState<any[]>([]);
  // Timetable data
  const [timetableSlots, setTimetableSlots] = useState<any[]>([]);
  // Notices
  const [notices, setNotices] = useState<any[]>([]);
  // Homework
  const [homework, setHomework] = useState<any[]>([]);
  const [urduMode, setUrduMode] = useState(false);

  useEffect(() => {
    if (parentData) fetchDashboardData();
  }, [parentData]);

  const fetchDashboardData = async () => {
    if (!parentData) return;
    setLoadingData(true);
    try {
      const { data: schoolData } = await supabase
        .from('schools')
        .select('name, address, contact_phone, logo_url')
        .eq('id', parentData.school_id)
        .maybeSingle();
      if (schoolData) setSchool(schoolData);

      const { data: childData } = await supabase
        .from('students')
        .select('id, full_name, roll_number, photograph_url, class_id, classes(name, section)')
        .eq('school_id', parentData.school_id)
        .eq('parent_id', parentData.id)
        .eq('status', 'active');

      const childList: ChildData[] = (childData || []).map((c: any) => ({
        id: c.id,
        full_name: c.full_name,
        roll_number: c.roll_number,
        photograph_url: c.photograph_url,
        class_id: c.class_id,
        classes: c.classes,
      }));
      setChildren(childList);
      if (childList.length > 0) {
        setActiveChildId(childList[0].id);
        await fetchChildData(childList[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingData(false);
    }
  };

  const fetchChildData = async (child: ChildData) => {
    const [fees, attendance, results, timetable, notifs, hw] = await Promise.all([
      // Fees
      supabase.from('fee_records').select('*')
        .eq('school_id', parentData!.school_id)
        .eq('student_id', child.id)
        .order('month_year', { ascending: false }),
      // Attendance (last 90 days)
      supabase.from('attendance').select('date, status')
        .eq('school_id', parentData!.school_id)
        .eq('student_id', child.id)
        .gte('date', new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10))
        .order('date', { ascending: false }),
      // Results
      supabase.from('exam_results')
        .select('obtained_marks, total_marks, grade, exam_types(name), subjects(subject_name)')
        .eq('school_id', parentData!.school_id)
        .eq('student_id', child.id)
        .order('created_at', { ascending: false }),
      // Timetable
      child.class_id
        ? supabase.from('timetable_slots')
            .select('day_of_week, period_number, start_time, end_time, subjects(subject_name), staff(full_name)')
            .eq('school_id', parentData!.school_id)
            .eq('class_id', child.class_id)
            .order('day_of_week').order('period_number')
        : Promise.resolve({ data: [] }),
      // Notices
      supabase.from('notifications')
        .select('id, title, message, created_at, type')
        .eq('school_id', parentData!.school_id)
        .order('created_at', { ascending: false })
        .limit(20),
      // Homework from teacher diary
      child.class_id
        ? supabase.from('teacher_diary')
            .select('diary_date, topic_covered, homework, next_plan, subjects(subject_name)')
            .eq('school_id', parentData!.school_id)
            .eq('class_id', child.class_id)
            .not('homework', 'is', null)
            .order('diary_date', { ascending: false })
            .limit(30)
        : Promise.resolve({ data: [] }),
    ]);

    setFeeRecords(fees.data || []);
    setAttendanceRecords(attendance.data || []);
    setExamResults(results.data || []);
    setTimetableSlots(timetable.data || []);
    setNotices(notifs.data || []);
    setHomework(hw.data || []);
  };

  const handleChildSwitch = async (childId: string) => {
    setActiveChildId(childId);
    setActiveTab('overview');
    const child = children.find(c => c.id === childId);
    if (child) await fetchChildData(child);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!familyNumber.trim() || !password.trim()) {
      setLoginError('Please enter your Family Number and Password.');
      return;
    }
    setLoggingIn(true);
    setLoginError('');
    try {
      const { data, error } = await supabase
        .from('parents')
        .select('id, full_name, family_number, school_id')
        .eq('family_number', familyNumber.trim())
        .eq('auth_password', password.trim())
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setLoginError('Invalid Family Number or Password. Please try again.');
        return;
      }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
      setParentData(data);
    } catch (err: any) {
      setLoginError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setParentData(null);
    setChildren([]);
    setFeeRecords([]);
    setAttendanceRecords([]);
    setExamResults([]);
    setTimetableSlots([]);
    setNotices([]);
    setFamilyNumber('');
    setPassword('');
    setActiveTab('overview');
  };

  const handleDownloadChallan = async (fee: any) => {
    const child = children.find(c => c.id === fee.student_id);
    if (!child) return;

    const { data: prevFees } = await supabase
      .from('fee_records')
      .select('total_amount, paid_amount')
      .eq('school_id', parentData!.school_id)
      .eq('student_id', fee.student_id)
      .in('status', ['pending', 'overdue'])
      .neq('id', fee.id)
      .lt('month_year', fee.month_year);

    const previousFee = (prevFees || []).reduce(
      (sum: number, r: any) => sum + Math.max(0, (r.total_amount || 0) - (r.paid_amount || 0)), 0
    );

    const record: ChallanRecord = {
      id: fee.id,
      invoice_number: fee.invoice_number,
      month_year: fee.month_year,
      due_date: fee.due_date,
      total_amount: fee.total_amount,
      paid_amount: fee.paid_amount || 0,
      status: fee.status,
      breakdown: fee.breakdown,
      student_name: child.full_name,
      roll_number: child.roll_number,
      class_name: child.classes
        ? `${child.classes.name}${child.classes.section ? ' - ' + child.classes.section : ''}`
        : '',
      family_number: parentData!.family_number,
      previous_fee: previousFee,
      discount_amount: fee.discount_amount || 0,
      fine_amount: 0,
    };

    await downloadChallanPDF([record], school, { ...DEFAULT_CHALLAN_CONFIG, copies: 1, show_depositor_info: false });
  };

  const handleShareWhatsApp = (fee: any) => {
    const child = children.find(c => c.id === fee.student_id);
    const balance = (fee.total_amount || 0) - (fee.paid_amount || 0);
    const dueDate = fee.due_date ? new Date(fee.due_date).toLocaleDateString() : 'N/A';
    const monthLabel = new Date(fee.month_year).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const msg = `Fee Challan — ${child?.full_name || ''}\nMonth: ${monthLabel}\nAmount Due: Rs. ${balance.toLocaleString()}\nDue Date: ${dueDate}\nInvoice: ${fee.invoice_number || fee.id.substring(0, 10)}\n\n— ${school.name}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const activeChild = children.find(c => c.id === activeChildId);
  const activeChildFees = feeRecords.filter(f => f.student_id === activeChildId);
  const totalDue = activeChildFees.reduce((sum, f) => sum + Math.max(0, (f.total_amount || 0) - (f.paid_amount || 0)), 0);
  const totalPaid = activeChildFees.reduce((sum, f) => sum + (f.paid_amount || 0), 0);

  // Attendance stats for current child
  const childAttendance = attendanceRecords;
  const attPresent = childAttendance.filter(r => r.status === 'present').length;
  const attAbsent = childAttendance.filter(r => r.status === 'absent').length;
  const attLeave = childAttendance.filter(r => r.status === 'leave').length;
  const attTotal = childAttendance.length;
  const attPct = attTotal > 0 ? Math.round((attPresent / attTotal) * 100) : 0;

  // Monthly attendance calendar
  const attMap = new Map<string, string>();
  childAttendance.forEach(r => attMap.set(r.date, r.status));

  const calendarMonthStart = new Date(attMonth + '-01');
  const calendarDays: (string | null)[] = [];
  const firstWeekday = calendarMonthStart.getDay();
  for (let i = 0; i < (firstWeekday === 0 ? 6 : firstWeekday - 1); i++) calendarDays.push(null);
  const daysInMonth = new Date(calendarMonthStart.getFullYear(), calendarMonthStart.getMonth() + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push(`${attMonth}-${String(d).padStart(2, '0')}`);
  }

  const prevMonth = () => {
    const d = new Date(attMonth + '-01');
    d.setMonth(d.getMonth() - 1);
    setAttMonth(d.toISOString().slice(0, 7));
  };
  const nextMonth = () => {
    const d = new Date(attMonth + '-01');
    d.setMonth(d.getMonth() + 1);
    setAttMonth(d.toISOString().slice(0, 7));
  };

  // Exam results grouped by exam type
  const examGroups = examResults.reduce<Record<string, any[]>>((acc, r) => {
    const key = (r.exam_types as any)?.name || 'Unknown Exam';
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  // Today's timetable
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const todaySlots = timetableSlots.filter(s => s.day_of_week === todayName).sort((a, b) => a.period_number - b.period_number);

  // Pending fees count
  const pendingCount = activeChildFees.filter(f => f.status === 'pending' || f.status === 'overdue').length;

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'fees', label: 'Fees', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'attendance', label: 'Attendance', icon: <CalendarCheck className="w-4 h-4" /> },
    { id: 'results', label: 'Results', icon: <BarChart2 className="w-4 h-4" /> },
    { id: 'timetable', label: 'Timetable', icon: <Clock className="w-4 h-4" /> },
    { id: 'homework', label: 'Homework', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'notices', label: 'Notices', icon: <Bell className="w-4 h-4" /> },
  ];

  // ─── LOGIN SCREEN ──────────────────────────────────────────────────────────
  if (!parentData) {
    return (
      <div className="min-h-screen flex">
        {/* Left Panel */}
        <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-emerald-600 to-teal-700 flex-col justify-between p-12 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute top-20 right-0 w-60 h-60 bg-teal-400/20 rounded-full blur-3xl" />

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-12">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <span className="text-white font-black text-sm uppercase tracking-[0.2em]">Parent Portal</span>
            </div>
            <h1 className="text-4xl font-black text-white leading-[1.15] mb-4">
              Stay connected<br />with your child's<br />
              <span className="text-emerald-200">education.</span>
            </h1>
            <p className="text-emerald-100/80 text-base leading-relaxed">
              Monitor attendance, fees, results, timetable and homework — all in one place.
            </p>
          </div>

          <div className="relative z-10 space-y-4">
            {[
              { icon: '📅', text: 'Live attendance tracking' },
              { icon: '💰', text: 'Fee invoices & payment history' },
              { icon: '🏆', text: 'Exam results & grade reports' },
              { icon: '📚', text: 'Homework & class timetable' },
            ].map(f => (
              <div key={f.text} className="flex items-center gap-3">
                <span className="text-xl">{f.icon}</span>
                <span className="text-emerald-100 text-sm font-medium">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel: Form */}
        <div className="flex-1 flex items-center justify-center p-6 bg-[#041a15] lg:bg-gray-50 relative overflow-hidden">
          {/* Mobile-only Background Elements */}
          <div className="lg:hidden absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
          <div className="lg:hidden absolute -top-20 -right-20 w-80 h-80 bg-emerald-600/20 rounded-full blur-[100px] pointer-events-none" />
          <div className="lg:hidden absolute -bottom-20 -left-20 w-80 h-80 bg-teal-600/20 rounded-full blur-[100px] pointer-events-none" />

          <div className="w-full max-w-md relative z-10">
            {/* Mobile header */}
            <div className="lg:hidden text-center mb-10">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl shadow-lg border border-white/10 mb-4">
                <Users className="w-7 h-7 text-emerald-400" />
              </div>
              <h1 className="text-2xl font-black text-white">Parent Portal</h1>
              <p className="text-emerald-400/80 text-sm mt-1 font-medium">Stay connected with your child's school life</p>
            </div>

            <div className="mb-8 hidden lg:block">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Welcome back</h2>
              <p className="text-slate-500 mt-1.5">Sign in with your family credentials</p>
            </div>

            <div className="bg-white/5 lg:bg-white backdrop-blur-2xl lg:backdrop-blur-none rounded-3xl shadow-2xl lg:shadow-xl shadow-black/50 lg:shadow-slate-200/60 border border-white/10 lg:border-slate-100 p-8">
              <form onSubmit={handleLogin} className="space-y-6">
                <div>
                  <label className="block text-xs font-black text-slate-400 lg:text-slate-500 uppercase tracking-widest mb-2.5">
                    Family Number
                  </label>
                  <input
                    type="text"
                    value={familyNumber}
                    onChange={e => setFamilyNumber(e.target.value)}
                    placeholder="e.g. FAM-2024-001"
                    className="w-full px-5 py-3.5 border border-white/10 lg:border-slate-200 rounded-xl text-sm font-medium text-white lg:text-slate-900 placeholder-slate-500 lg:placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition bg-white/5 lg:bg-slate-50 focus:bg-white/10 lg:focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 lg:text-slate-500 uppercase tracking-widest mb-2.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-5 py-3.5 pr-12 border border-white/10 lg:border-slate-200 rounded-xl text-sm font-medium text-white lg:text-slate-900 placeholder-slate-500 lg:placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition bg-white/5 lg:bg-slate-50 focus:bg-white/10 lg:focus:bg-white"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 lg:text-slate-400 hover:text-emerald-400 lg:hover:text-emerald-600 transition-colors">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {loginError && (
                  <div className="bg-red-500/10 lg:bg-red-50 border border-red-500/20 lg:border-red-200 text-red-400 lg:text-red-700 px-4 py-3 rounded-xl text-sm flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span className="pt-0.5 leading-snug">{loginError}</span>
                  </div>
                )}

                <button type="submit" disabled={loggingIn}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 lg:bg-emerald-600 lg:hover:bg-emerald-700 active:bg-emerald-600 lg:active:bg-emerald-800 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4">
                  {loggingIn ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Authenticating...
                    </>
                  ) : 'Sign In →'}
                </button>
              </form>

              <div className="mt-8 pt-6 border-t border-white/5 lg:border-slate-100">
                <p className="text-center text-xs text-slate-400 lg:text-slate-400">
                  Credentials provided by school administration.<br />
                  <span className="font-bold text-white lg:text-slate-500">Contact your school</span> if you need access.
                </p>
              </div>
            </div>
            
            <div className="mt-8 lg:hidden flex justify-center">
               <Link to="/login" className="flex items-center gap-2 text-xs font-black text-emerald-400 uppercase tracking-widest hover:text-emerald-300 transition">
                  <ChevronLeft className="w-4 h-4" /> Go back to Main Portal
               </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── DASHBOARD ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {school.logo_url ? (
              <img src={school.logo_url} className="w-9 h-9 rounded-xl object-contain border border-gray-100" alt="" />
            ) : (
              <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
            )}
            <div>
              <p className="font-bold text-gray-900 text-sm leading-tight">{school.name || 'School'}</p>
              <p className="text-xs text-gray-500">Parent Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-800">{parentData.full_name}</p>
              <p className="text-xs text-gray-500">Family #{parentData.family_number}</p>
            </div>
            <button onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-red-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:border-red-200 transition">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {loadingData ? (
          <div className="text-center py-20">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Loading your data...</p>
          </div>
        ) : children.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No children linked to this account.</p>
            <p className="text-sm text-gray-400 mt-1">Please contact the school administration.</p>
          </div>
        ) : (
          <>
            {/* Children Tabs */}
            {children.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {children.map(child => (
                  <button key={child.id}
                    onClick={() => handleChildSwitch(child.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition border ${
                      activeChildId === child.id
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                    }`}>
                    {child.photograph_url ? (
                      <img src={child.photograph_url} className="w-6 h-6 rounded-full object-cover" alt="" />
                    ) : (
                      <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold">
                        {child.full_name.charAt(0)}
                      </span>
                    )}
                    {child.full_name}
                  </button>
                ))}
              </div>
            )}

            {/* Profile Banner */}
            {activeChild && (
              <div className="aura-navy-card rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-white/20 transition-all duration-700" />
                <div className="flex items-center gap-5 relative z-10">
                  {activeChild.photograph_url ? (
                    <img src={activeChild.photograph_url} className="w-20 h-20 rounded-2xl object-cover ring-4 ring-white/20 shadow-xl" alt={activeChild.full_name} />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white font-black text-3xl shadow-lg">
                      {activeChild.full_name.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-blue-200 text-[10px] font-black uppercase tracking-widest mb-1">Student Profile</p>
                    <h2 className="text-2xl font-black tracking-tight">{activeChild.full_name}</h2>
                    <p className="text-blue-100/80 text-sm font-medium mt-1 flex items-center gap-2">
                       Roll #{activeChild.roll_number}
                       <span className="w-1 h-1 rounded-full bg-blue-300/50" />
                       {activeChild.classes && `${activeChild.classes.name}${activeChild.classes.section ? ' ' + activeChild.classes.section : ''}`}
                    </p>
                  </div>
                </div>
                
                {/* Desktop-only quick stats in banner */}
                <div className="hidden sm:grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-white/10">
                  <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 transition hover:bg-white/10">
                    <p className="text-blue-200 text-[10px] font-black uppercase tracking-wider mb-1">Fee Balance</p>
                    <p className="text-xl font-black">Rs. {totalDue.toLocaleString()}</p>
                  </div>
                  <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 transition hover:bg-white/10">
                    <p className="text-blue-200 text-[10px] font-black uppercase tracking-wider mb-1">Attendance Rate</p>
                    <p className="text-xl font-black">{attPct}%</p>
                  </div>
                </div>
              </div>
            )}

            {/* Tab Content Rendering */}
            <div className="portal-content-padding px-4">
              {activeTab !== 'overview' && (
                <button 
                  onClick={() => setActiveTab('overview')}
                  className="mb-4 flex items-center gap-2 text-xs font-black text-blue-600 hover:text-blue-800 transition uppercase tracking-widest"
                >
                  <ChevronLeft className="w-4 h-4" /> Back to Dashboard
                </button>
              )}
              {activeTab === 'overview' && (
                <DashboardHub
                  child={activeChild!}
                  attPct={attPct}
                  attPresent={attPresent}
                  attAbsent={attAbsent}
                  totalDue={totalDue}
                  pendingCount={pendingCount}
                  examGroups={examGroups}
                  todaySlots={todaySlots}
                  notices={notices.slice(0, 3)}
                  setActiveTab={setActiveTab}
                />
              )}

              {activeTab === 'fees' && (
                <FeesTab
                  fees={activeChildFees}
                  totalPaid={totalPaid}
                  totalDue={totalDue}
                  onDownload={handleDownloadChallan}
                  onWhatsApp={handleShareWhatsApp}
                />
              )}

              {activeTab === 'attendance' && (
                <AttendanceTab
                  attPct={attPct}
                  attPresent={attPresent}
                  attAbsent={attAbsent}
                  attLeave={attLeave}
                  attTotal={attTotal}
                  attMonth={attMonth}
                  calendarDays={calendarDays}
                  attMap={attMap}
                  onPrevMonth={prevMonth}
                  onNextMonth={nextMonth}
                />
              )}

              {activeTab === 'results' && <ResultsTab examGroups={examGroups} />}
              {activeTab === 'timetable' && <TimetableTab slots={timetableSlots} todayName={todayName} />}
              {activeTab === 'notices' && <NoticesTab notices={notices} />}
              {activeTab === 'homework' && <HomeworkTab homework={homework} />}
            </div>
          </>
        )}
      </div>

      {/* Bottom Navigation for Mobile */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 aura-glass border-t border-gray-200 px-6 py-3 flex items-center justify-between pb-safe">
        {[
          { id: 'overview', icon: LayoutDashboard, label: 'Home' },
          { id: 'fees', icon: CreditCard, label: 'Fees', badge: pendingCount > 0 },
          { id: 'attendance', icon: CalendarCheck, label: 'Attendance' },
          { id: 'notices', icon: Bell, label: 'Notices' },
          { id: 'more', icon: GraduationCap, label: 'Hub' }
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => item.id === 'more' ? setActiveTab('overview') : setActiveTab(item.id as Tab)}
            className={`flex flex-col items-center gap-1 transition ${activeTab === (item.id === 'more' ? 'overview' : item.id) ? 'text-blue-600' : 'text-gray-400'}`}
          >
            <div className="relative">
              <item.icon className={`w-5 h-5 ${activeTab === (item.id === 'more' ? 'overview' : item.id) ? 'stroke-[2.5px]' : 'stroke-[2px]'}`} />
              {item.badge && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
              )}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Footer (Desktop Only) */}
      <footer className="hidden sm:block text-center py-10 text-xs font-bold text-gray-400 uppercase tracking-widest">
        {school.name} <span className="mx-2">·</span> Parent Portal <span className="mx-2">·</span> Powered by School ERP
      </footer>
    </div>
  );
}

// ─── DASHBOARD HUB (NEW OVERVIEW) ────────────────────────────────────────────────
function DashboardHub({ child, attPct, attPresent, attAbsent, totalDue, pendingCount, examGroups, todaySlots, notices, setActiveTab }: {
  child: ChildData;
  attPct: number;
  attPresent: number;
  attAbsent: number;
  totalDue: number;
  pendingCount: number;
  examGroups: Record<string, any[]>;
  todaySlots: any[];
  notices: any[];
  setActiveTab: (tab: Tab) => void;
}) {
  const secondaryTABS = [
    { id: 'results', label: 'Exam Results', icon: BarChart2, color: 'text-indigo-600', bg: 'bg-indigo-50', sub: 'Performance' },
    { id: 'homework', label: 'Homework', icon: BookOpen, color: 'text-amber-600', bg: 'bg-amber-50', sub: 'Teacher Diary' },
    { id: 'timetable', label: 'Timetable', icon: Clock, color: 'text-emerald-600', bg: 'bg-emerald-50', sub: 'Weekly Schedule' },
  ];

  return (
    <div className="space-y-6">
      {/* Primary Status Grid */}
      <div className="grid grid-cols-2 gap-4">
        <button onClick={() => setActiveTab('attendance')}
          className="bg-white rounded-3xl p-5 text-left border border-gray-100 shadow-sm hover:shadow-md transition group overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
            <CalendarCheck className="w-12 h-12" />
          </div>
          <p className="text-3xl font-black text-gray-900 leading-none">{attPct}%</p>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">Attendance</p>
          <div className="mt-4 flex gap-1 h-1 bg-gray-100 rounded-full overflow-hidden">
             <div className="h-full bg-blue-600 transition-all duration-1000" style={{ width: `${attPct}%` }} />
          </div>
        </button>

        <button onClick={() => setActiveTab('fees')}
          className="bg-white rounded-3xl p-5 text-left border border-gray-100 shadow-sm hover:shadow-md transition group overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
            <CreditCard className="w-12 h-12" />
          </div>
          <p className={`text-2xl font-black leading-none ${totalDue > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            Rs. {(totalDue/1000).toFixed(1)}k
          </p>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">Fees Due</p>
          <div className="mt-4 flex items-center gap-1">
             <span className={`w-1.5 h-1.5 rounded-full ${totalDue > 0 ? 'bg-red-500' : 'bg-emerald-500'}`} />
             <span className="text-[10px] font-bold text-gray-400">{pendingCount > 0 ? 'Pay Now' : 'Fee Cleared'}</span>
          </div>
        </button>
      </div>

      {/* Secondary Modules Grid */}
      <div>
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 ml-1">Academic Modules</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {secondaryTABS.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as Tab)}
              className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-4 hover:border-blue-300 transition-all group">
              <div className={`w-12 h-12 rounded-xl ${tab.bg} ${tab.color} flex items-center justify-center shrink-0 shadow-sm`}>
                <tab.icon className="w-6 h-6" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-black text-gray-900 leading-tight">{tab.label}</p>
                <p className="text-[10px] font-bold text-gray-400 mt-0.5">{tab.sub}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-600 transition" />
            </button>
          ))}
        </div>
      </div>

      {/* Alerts & Schedule */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Today's Schedule Mini */}
        <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
           <div className="flex items-center justify-between mb-5">
              <h3 className="font-black text-gray-900 text-[11px] flex items-center gap-2 uppercase tracking-wide">
                <Clock className="w-4 h-4 text-blue-600" /> Today's schedule
              </h3>
              <button onClick={() => setActiveTab('timetable')} className="text-[10px] font-black text-blue-600 hover:underline">Full View</button>
           </div>
           {todaySlots.length === 0 ? (
             <div className="py-8 text-center text-gray-400 text-xs italic">No classes scheduled today.</div>
           ) : (
             <div className="space-y-4">
                {todaySlots.slice(0, 4).map((slot, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-8 h-8 bg-gray-50 text-gray-500 text-[10px] font-black rounded-xl flex items-center justify-center shrink-0">P{slot.period_number}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate tracking-tight">{slot.subjects?.subject_name || '—'}</p>
                      <p className="text-[10px] font-semibold text-gray-400 mt-0.5">{slot.staff?.full_name}</p>
                    </div>
                  </div>
                ))}
             </div>
           )}
        </div>

        {/* Notices Mini */}
        <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
           <div className="flex items-center justify-between mb-5">
              <h3 className="font-black text-gray-900 text-[11px] flex items-center gap-2 uppercase tracking-wide">
                <Bell className="w-4 h-4 text-amber-500" /> Notifications
              </h3>
              <button onClick={() => setActiveTab('notices')} className="text-[10px] font-black text-blue-600 hover:underline">All Notices</button>
           </div>
           {notices.length === 0 ? (
             <div className="py-8 text-center text-gray-400 text-xs italic">No new announcements.</div>
           ) : (
             <div className="space-y-5">
                {notices.slice(0, 2).map(n => (
                  <div key={n.id} className="border-l-4 border-indigo-100 pl-4 py-1">
                    <p className="text-sm font-bold text-gray-900 leading-tight">{n.title}</p>
                    <p className="text-[10px] font-medium text-gray-400 mt-1 line-clamp-1">{n.message}</p>
                  </div>
                ))}
             </div>
           )}
        </div>
      </div>
    </div>
  );
}



// ─── FEES TAB ──────────────────────────────────────────────────────────────
function FeesTab({ fees, totalPaid, totalDue, onDownload, onWhatsApp }: {
  fees: any[];
  totalPaid: number;
  totalDue: number;
  onDownload: (fee: any) => void;
  onWhatsApp: (fee: any) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm text-center">
          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Total Paid</p>
          <p className="text-2xl font-black text-gray-900 mt-1">Rs. {totalPaid.toLocaleString()}</p>
        </div>
        <div className={`rounded-3xl p-5 text-center border shadow-sm ${totalDue > 0 ? 'bg-red-50 border-red-100' : 'bg-white border-gray-100'}`}>
          <p className={`text-[10px] font-black uppercase tracking-widest ${totalDue > 0 ? 'text-red-700' : 'text-emerald-600'}`}>Balance Due</p>
          <p className={`text-2xl font-black mt-1 ${totalDue > 0 ? 'text-red-700' : 'text-gray-900'}`}>Rs. {totalDue.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Fee Records</h3>
          <p className="text-sm text-gray-500 mt-0.5">{fees.length} record{fees.length !== 1 ? 's' : ''}</p>
        </div>
        {fees.length === 0 ? (
          <div className="py-12 text-center text-gray-400">No fee records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-5 py-3 font-medium text-gray-600">Month</th>
                  <th className="px-5 py-3 font-medium text-gray-600">Invoice #</th>
                  <th className="px-5 py-3 font-medium text-gray-600">Due Date</th>
                  <th className="px-5 py-3 font-medium text-gray-600 text-right">Amount</th>
                  <th className="px-5 py-3 font-medium text-gray-600 text-right">Paid</th>
                  <th className="px-5 py-3 font-medium text-gray-600 text-right">Balance</th>
                  <th className="px-5 py-3 font-medium text-gray-600">Status</th>
                  <th className="px-5 py-3 font-medium text-gray-600 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {fees.map(fee => {
                  const balance = Math.max(0, (fee.total_amount || 0) - (fee.paid_amount || 0));
                  const monthLabel = new Date(fee.month_year).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                  return (
                    <tr key={fee.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 font-medium text-gray-900">{monthLabel}</td>
                      <td className="px-5 py-3 font-mono text-xs text-gray-500">{fee.invoice_number || fee.id.substring(0, 10)}</td>
                      <td className="px-5 py-3 text-gray-600">
                        {fee.due_date ? new Date(fee.due_date).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-gray-900">
                        Rs. {Number(fee.total_amount).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right text-green-600 font-medium">
                        Rs. {Number(fee.paid_amount || 0).toLocaleString()}
                      </td>
                      <td className={`px-5 py-3 text-right font-black ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        Rs. {balance.toLocaleString()}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${STATUS_STYLES[fee.status] || 'bg-gray-100 text-gray-700'}`}>
                          {fee.status}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => onDownload(fee)}
                            title="Download Challan PDF"
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition font-medium">
                            <Download className="w-3.5 h-3.5" /> Challan
                          </button>
                          <button onClick={() => onWhatsApp(fee)}
                            title="Share via WhatsApp"
                            className="p-1.5 text-green-600 hover:text-green-800 bg-green-50 hover:bg-green-100 rounded-lg transition">
                            <MessageCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ATTENDANCE TAB ────────────────────────────────────────────────────────
function AttendanceTab({ attPct, attPresent, attAbsent, attLeave, attTotal, attMonth, calendarDays, attMap, onPrevMonth, onNextMonth }: {
  attPct: number;
  attPresent: number;
  attAbsent: number;
  attLeave: number;
  attTotal: number;
  attMonth: string;
  calendarDays: (string | null)[];
  attMap: Map<string, string>;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  const pctColor = attPct >= 75 ? 'text-green-600' : attPct >= 60 ? 'text-amber-500' : 'text-red-600';
  const barColor = attPct >= 75 ? 'bg-green-500' : attPct >= 60 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Attendance Rate', value: `${attPct}%`, color: pctColor, bg: 'bg-white' },
          { label: 'Present', value: attPresent, color: 'text-emerald-600', bg: 'bg-white' },
          { label: 'Absent', value: attAbsent, color: 'text-red-500', bg: 'bg-white' },
          { label: 'Leave', value: attLeave, color: 'text-amber-500', bg: 'bg-white' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-2xl border border-gray-100 shadow-sm p-4 text-center`}>
            <p className={`text-2xl font-black ${color}`}>{value}</p>
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700">Overall Attendance</span>
          <span className={`text-sm font-black ${pctColor}`}>{attPct}%</span>
        </div>
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-3 ${barColor} rounded-full transition-all`} style={{ width: `${attPct}%` }} />
        </div>
        <p className="text-xs text-gray-400 mt-2">{attPresent} present out of {attTotal} recorded days</p>
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onPrevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </button>
          <h3 className="font-bold text-gray-900">
            {new Date(attMonth + '-01').toLocaleDateString('en-PK', { month: 'long', year: 'numeric' })}
          </h3>
          <button onClick={onNextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
            <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, i) => {
            if (!day) return <div key={`blank-${i}`} />;
            const status = attMap.get(day);
            const dayNum = parseInt(day.split('-')[2]);
            const today = new Date().toISOString().slice(0, 10);
            const isToday = day === today;
            let cellClass = 'bg-gray-50 text-gray-400';
            if (status === 'present') cellClass = 'bg-green-100 text-green-700';
            else if (status === 'absent') cellClass = 'bg-red-100 text-red-700';
            else if (status === 'leave') cellClass = 'bg-amber-100 text-amber-700';
            return (
              <div key={day}
                className={`aspect-square flex items-center justify-center text-xs font-semibold rounded-lg ${cellClass} ${isToday ? 'ring-2 ring-blue-400' : ''}`}
                title={status || 'No record'}>
                {dayNum}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex gap-4 mt-4 flex-wrap">
          {[
            { color: 'bg-green-100 text-green-700', label: 'Present' },
            { color: 'bg-red-100 text-red-700', label: 'Absent' },
            { color: 'bg-amber-100 text-amber-700', label: 'Leave' },
            { color: 'bg-gray-50 text-gray-400', label: 'No record' },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className={`w-4 h-4 rounded ${color} flex-shrink-0`} /> {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── RESULTS TAB ───────────────────────────────────────────────────────────
function ResultsTab({ examGroups }: { examGroups: Record<string, any[]> }) {
  const examNames = Object.keys(examGroups);

  if (examNames.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm py-16 text-center">
        <BarChart2 className="w-12 h-12 text-gray-200 mx-auto mb-3" />
        <p className="text-gray-400">No results available yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {examNames.map(examName => {
        const results = examGroups[examName];
        const totalObtained = results.reduce((s, r) => s + (r.obtained_marks || 0), 0);
        const totalMax = results.reduce((s, r) => s + (r.total_marks || 0), 0);
        const overallPct = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;
        const passed = results.filter(r => r.grade && r.grade !== 'F').length;

        return (
          <div key={examName} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">{examName}</h3>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="font-semibold text-blue-600">{overallPct}% overall</span>
                <span>{passed}/{results.length} passed</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium text-gray-600">Subject</th>
                    <th className="px-5 py-3 text-center font-medium text-gray-600">Marks</th>
                    <th className="px-5 py-3 text-center font-medium text-gray-600">Total</th>
                    <th className="px-5 py-3 text-center font-medium text-gray-600">%</th>
                    <th className="px-5 py-3 text-center font-medium text-gray-600">Grade</th>
                    <th className="px-5 py-3 text-center font-medium text-gray-600">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {results.map((r, i) => {
                    const pct = r.total_marks > 0 ? Math.round((r.obtained_marks / r.total_marks) * 100) : 0;
                    const isPassed = r.grade && r.grade !== 'F';
                    return (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-900">
                          {(r.subjects as any)?.subject_name || '—'}
                        </td>
                        <td className="px-5 py-3 text-center font-bold text-gray-900">{r.obtained_marks ?? '—'}</td>
                        <td className="px-5 py-3 text-center text-gray-500">{r.total_marks ?? '—'}</td>
                        <td className="px-5 py-3 text-center text-gray-700">{pct}%</td>
                        <td className="px-5 py-3 text-center">
                          {r.grade && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${GRADE_COLORS[r.grade] || 'bg-gray-100 text-gray-700'}`}>
                              {r.grade}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className={`flex items-center justify-center gap-1 text-xs font-semibold ${isPassed ? 'text-green-600' : 'text-red-500'}`}>
                            {isPassed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            {isPassed ? 'Pass' : 'Fail'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t border-gray-200 bg-gray-50">
                  <tr>
                    <td className="px-5 py-3 font-bold text-gray-800">Total</td>
                    <td className="px-5 py-3 text-center font-black text-gray-900">{totalObtained}</td>
                    <td className="px-5 py-3 text-center font-medium text-gray-600">{totalMax}</td>
                    <td className="px-5 py-3 text-center font-black text-blue-600">{overallPct}%</td>
                    <td className="px-5 py-3" />
                    <td className="px-5 py-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── TIMETABLE TAB ─────────────────────────────────────────────────────────
function TimetableTab({ slots, todayName }: { slots: any[]; todayName: string }) {
  const grouped = DAYS.reduce<Record<string, any[]>>((acc, day) => {
    acc[day] = slots.filter(s => s.day_of_week === day).sort((a, b) => a.period_number - b.period_number);
    return acc;
  }, {});
  const activeDays = DAYS.filter(d => grouped[d].length > 0);

  if (activeDays.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm py-16 text-center">
        <Clock className="w-12 h-12 text-gray-200 mx-auto mb-3" />
        <p className="text-gray-400">No timetable configured for this class.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activeDays.map(day => {
        const isToday = day === todayName;
        return (
          <div key={day} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${isToday ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200'}`}>
            <div className={`px-5 py-3 border-b flex items-center justify-between ${isToday ? 'bg-blue-600 border-blue-500' : 'bg-gray-50 border-gray-100'}`}>
              <h3 className={`font-bold text-sm ${isToday ? 'text-white' : 'text-gray-900'}`}>{day}</h3>
              {isToday && <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-semibold">Today</span>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium text-gray-500 w-16">Period</th>
                    <th className="px-4 py-2.5 text-left font-medium text-gray-500">Subject</th>
                    <th className="px-4 py-2.5 text-left font-medium text-gray-500">Teacher</th>
                    <th className="px-4 py-2.5 text-left font-medium text-gray-500">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {grouped[day].map((slot, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 text-xs font-bold flex items-center justify-center">
                          {slot.period_number}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-medium text-gray-900">
                        {(slot.subjects as any)?.subject_name || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500">
                        {(slot.staff as any)?.full_name || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs">
                        {slot.start_time && slot.end_time
                          ? `${slot.start_time.slice(0, 5)} – ${slot.end_time.slice(0, 5)}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── HOMEWORK TAB (DIARY) ──────────────────────────────────────────────────
function HomeworkTab({ homework }: { homework: any[] }) {
  if (homework.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-gray-100 p-16 text-center shadow-sm">
        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-emerald-200" />
        </div>
        <p className="text-gray-900 font-black text-lg">All caught up!</p>
        <p className="text-gray-400 text-sm mt-1 max-w-xs mx-auto">No homework tasks have been assigned to your child today. Have a productive evening!</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden ring-1 ring-gray-200">
      <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
            <ClipboardList className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-black text-gray-900 text-lg tracking-tight">Daily Study Diary</h2>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Academic Tasks & Planning</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Subject & Topic</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Homework Task</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Next Class Plan</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-right">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {homework.map((h, i) => (
              <tr key={i} className="hover:bg-slate-50 transition group">
                <td className="px-6 py-5 align-top">
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-blue-600">{(h.subjects as any)?.subject_name || 'General'}</span>
                    <span className="text-[11px] font-bold text-gray-400 mt-0.5">{h.topic_covered || 'N/A'}</span>
                  </div>
                </td>
                <td className="px-6 py-5 align-top">
                  <p className="text-sm text-gray-800 font-medium leading-relaxed max-w-sm">{h.homework}</p>
                </td>
                <td className="px-6 py-5 align-top">
                  {h.next_plan ? (
                    <div className="flex items-start gap-2 bg-emerald-50 rounded-xl p-3 border border-emerald-100/50">
                      <BookOpen className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                      <p className="text-xs text-emerald-800 font-medium">{h.next_plan}</p>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300 italic">No specific plan listed</span>
                  )}
                </td>
                <td className="px-6 py-5 align-top text-right">
                  <span className="inline-block px-3 py-1 bg-gray-100 rounded-full text-[10px] font-black text-gray-500 uppercase">
                    {new Date(h.diary_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── NOTICES TAB ───────────────────────────────────────────────────────────
function NoticesTab({ notices }: { notices: any[] }) {
  if (notices.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm py-16 text-center">
        <Bell className="w-12 h-12 text-gray-200 mx-auto mb-3" />
        <p className="text-gray-400">No notices at this time.</p>
      </div>
    );
  }

  const TYPE_COLORS: Record<string, string> = {
    info: 'border-blue-300 bg-blue-50',
    warning: 'border-amber-300 bg-amber-50',
    urgent: 'border-red-300 bg-red-50',
    success: 'border-green-300 bg-green-50',
  };

  return (
    <div className="space-y-3">
      {notices.map(n => (
        <div key={n.id} className={`rounded-xl border-l-4 p-5 ${TYPE_COLORS[n.type] || 'border-gray-300 bg-white border border-gray-200'}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-gray-900">{n.title}</h4>
              <p className="text-sm text-gray-600 mt-1">{n.message}</p>
            </div>
            <p className="text-xs text-gray-400 whitespace-nowrap shrink-0">
              {new Date(n.created_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}
            </p>
          </div>
          {n.type && (
            <span className={`inline-block mt-2 text-xs font-semibold uppercase px-2 py-0.5 rounded-full
              ${n.type === 'urgent' ? 'bg-red-100 text-red-700' : n.type === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
              {n.type}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
