import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  GraduationCap, LogOut, Calendar, CheckCircle, XCircle,
  Eye, EyeOff, Bell, User, BookOpen, Trophy, LayoutDashboard,
  CreditCard, ClipboardList, Clock, ChevronLeft,
  ChevronRight, AlertCircle, Languages, BarChart3,
  School
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface StudentData {
  id: string;
  full_name: string;
  roll_number: string | number;
  student_unique_id: string;
  school_id: string;
  class_id: string;
  photograph_url?: string;
  classes?: { name: string; section?: string } | null;
}

type Tab = 'overview' | 'timetable' | 'attendance' | 'results' | 'fees' | 'homework';

const SESSION_KEY = 'student_portal_session';
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ─── Main Component ──────────────────────────────────────────────────────────
export default function StudentPortal() {
  const [studentData, setStudentData] = useState<StudentData | null>(() => {
    try {
      const s = sessionStorage.getItem(SESSION_KEY);
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  });

  const [studentIdInput, setStudentIdInput] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [urduMode, setUrduMode] = useState(false);

  // Data
  const [schoolInfo, setSchoolInfo] = useState<{ name: string; logo_url: string | null } | null>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);
  const [timetable, setTimetable] = useState<any[]>([]);
  const [feeRecords, setFeeRecords] = useState<any[]>([]);
  const [homework, setHomework] = useState<any[]>([]);
  const [attMonth, setAttMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    if (studentData) fetchAll();
  }, [studentData]);

  // ─── Fetch all data ────────────────────────────────────────────────────────
  const fetchAll = async () => {
    if (!studentData) return;
    setLoadingData(true);
    await Promise.all([
      fetchSchoolInfo(),
      fetchAttendance(),
      fetchResults(),
      fetchNotices(),
      fetchTimetable(),
      fetchFees(),
      fetchHomework(),
    ]);
    setLoadingData(false);
  };

  const fetchSchoolInfo = async () => {
    const { data } = await supabase
      .from('schools').select('name, logo_url')
      .eq('id', studentData!.school_id).maybeSingle();
    if (data) setSchoolInfo(data);
  };

  const fetchAttendance = async () => {
    const { data } = await supabase
      .from('attendance').select('date, status')
      .eq('student_id', studentData!.id)
      .order('date', { ascending: false })
      .limit(120);
    setAttendance(data || []);
  };

  const fetchResults = async () => {
    const { data } = await supabase
      .from('exam_results')
      .select('obtained_marks, total_marks, grade, exam_types(name), subjects(subject_name)')
      .eq('student_id', studentData!.id)
      .order('created_at', { ascending: false });
    setResults(data || []);
  };

  const fetchNotices = async () => {
    const { data } = await supabase
      .from('notifications').select('*')
      .eq('school_id', studentData!.school_id)
      .or(`target_audience.eq.all,and(target_audience.eq.class,class_id.eq.${studentData!.class_id})`)
      .order('created_at', { ascending: false }).limit(10);
    setNotices(data || []);
  };

  const fetchTimetable = async () => {
    const { data } = await supabase
      .from('timetable_slots')
      .select('day_of_week, period_number, start_time, end_time, subjects(subject_name), staff(full_name)')
      .eq('class_id', studentData!.class_id)
      .eq('school_id', studentData!.school_id)
      .order('day_of_week').order('period_number');
    setTimetable(data || []);
  };

  const fetchFees = async () => {
    const { data } = await supabase
      .from('fee_records').select('*')
      .eq('student_id', studentData!.id)
      .order('month_year', { ascending: false });
    setFeeRecords(data || []);
  };

  const fetchHomework = async () => {
    const { data } = await supabase
      .from('teacher_diary')
      .select('diary_date, topic_covered, homework, next_plan, subjects(subject_name)')
      .eq('class_id', studentData!.class_id)
      .not('homework', 'is', null)
      .order('diary_date', { ascending: false })
      .limit(20);
    setHomework(data || []);
  };

  // ─── Login ────────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentIdInput.trim() || !password.trim()) {
      setLoginError('Enter your Student ID and Password.');
      return;
    }
    setLoggingIn(true);
    setLoginError('');
    try {
      const { data, error } = await supabase
        .from('students')
        .select('id, full_name, student_unique_id, school_id, class_id, photograph_url, roll_number, classes(name, section)')
        .eq('student_unique_id', studentIdInput.trim())
        .eq('auth_password', password.trim())
        .maybeSingle();
      if (error) throw error;
      if (!data) { setLoginError('Invalid Student ID or Password.'); return; }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
      setStudentData(data as any);
    } catch (err: any) {
      setLoginError(err.message || 'Login failed.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setStudentData(null);
    setStudentIdInput('');
    setPassword('');
  };

  // ─── Computed ─────────────────────────────────────────────────────────────
  const presentCount = attendance.filter(a => a.status === 'present' || a.status === 'P').length;
  const attendanceRate = attendance.length > 0 ? Math.round((presentCount / attendance.length) * 100) : 0;
  const pendingFees = feeRecords.reduce((s, r) => s + Math.max(0, (r.total_amount || 0) - (r.paid_amount || 0)), 0);
  const todayDayIndex = new Date().getDay(); // 0=Sun,1=Mon,...6=Sat
  const todayDayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][todayDayIndex];
  const todaySlots = timetable.filter(s => s.day_of_week === todayDayName || s.day_of_week === String(todayDayIndex));

  // ─── Login screen ─────────────────────────────────────────────────────────
  if (!studentData) {
    return (
      <div className="min-h-screen flex">
        {/* Left Panel */}
        <div className="hidden lg:flex lg:w-[45%] bg-[#0d1526] flex-col justify-between p-12 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          <div className="absolute top-1/3 left-1/2 w-80 h-80 bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-1/4 left-1/4 w-60 h-60 bg-violet-600/15 rounded-full blur-[80px] pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-12">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/60">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <span className="text-white font-black text-sm uppercase tracking-[0.2em]">Student Portal</span>
            </div>
            <h1 className="text-4xl font-black text-white leading-[1.15] mb-4">
              Your academic<br />journey,<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">all in one place.</span>
            </h1>
            <p className="text-slate-400 text-base leading-relaxed">
              Check your classes, results, homework, attendance and fee records anytime.
            </p>
          </div>

          <div className="relative z-10 grid grid-cols-2 gap-3">
            {[
              { icon: '📊', label: 'Attendance' },
              { icon: '🏆', label: 'Results' },
              { icon: '📚', label: 'Homework' },
              { icon: '🕐', label: 'Timetable' },
              { icon: '💳', label: 'Fee Records' },
              { icon: '🔔', label: 'Notices' },
            ].map(f => (
              <div key={f.label} className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2.5">
                <span className="text-lg">{f.icon}</span>
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wide">{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel */}
        <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
          <div className="w-full max-w-md">
            {/* Mobile header */}
            <div className="lg:hidden text-center mb-10">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-600/30 mb-4">
                <GraduationCap className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-2xl font-black text-slate-900">Student Portal</h1>
              <p className="text-slate-500 text-sm mt-1">Your academic dashboard</p>
            </div>

            <div className="mb-8 hidden lg:block">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Welcome back</h2>
              <p className="text-slate-500 mt-1.5">Sign in with your student credentials</p>
            </div>

            <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8">
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Student ID</label>
                  <input
                    type="text"
                    value={studentIdInput}
                    onChange={e => setStudentIdInput(e.target.value)}
                    placeholder="e.g. STU-2026-001"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-slate-50 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 pr-12 border border-slate-200 rounded-xl text-sm font-medium placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-slate-50 focus:bg-white"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {loginError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex items-start gap-2">
                    <XCircle className="w-4 h-4 shrink-0 mt-0.5" /> {loginError}
                  </div>
                )}

                <button type="submit" disabled={loggingIn}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-600/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2">
                  {loggingIn ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Signing in...
                    </>
                  ) : 'Sign In →'}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-slate-100">
                <p className="text-center text-xs text-slate-400">
                  Your login credentials are provided by your school.<br />
                  Contact administration if you need help.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const className = `${studentData.classes?.name || ''} ${studentData.classes?.section || ''}`.trim();
  const fmt = (n: number) => `Rs. ${n.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;

  // ─── Dashboard ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {schoolInfo?.logo_url ? (
              <img src={schoolInfo.logo_url} alt="" className="w-9 h-9 rounded-xl object-cover" />
            ) : (
              <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
                <School className="w-5 h-5 text-white" />
              </div>
            )}
            <div>
              <p className="text-sm font-black text-slate-900 leading-tight">{schoolInfo?.name || 'Student Portal'}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Student Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              {studentData.photograph_url ? (
                <img src={studentData.photograph_url} className="w-8 h-8 rounded-lg object-cover" alt="" />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-sm">
                  {studentData.full_name.charAt(0)}
                </div>
              )}
              <div className="text-right">
                <p className="text-xs font-black text-slate-900 leading-tight">{studentData.full_name}</p>
                <p className="text-[10px] text-slate-400 font-bold">{className} · Roll #{studentData.roll_number}</p>
              </div>
            </div>
            <button onClick={handleLogout}
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-400 flex items-center justify-center transition">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Tab bar */}
      <div className="bg-white border-b border-slate-200 sticky top-16 z-30">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto no-scrollbar py-2">
            {([
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'timetable', label: 'Timetable', icon: Calendar },
              { id: 'attendance', label: 'Attendance', icon: CheckCircle },
              { id: 'results', label: 'Results', icon: Trophy },
              { id: 'fees', label: 'Fees', icon: CreditCard },
              { id: 'homework', label: 'Homework', icon: ClipboardList },
            ] as { id: Tab; label: string; icon: any }[]).map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  activeTab === id
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}>
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {loadingData ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="portal-content-padding">
            {activeTab !== 'overview' && (
              <button 
                onClick={() => setActiveTab('overview')}
                className="mb-4 flex items-center gap-2 text-xs font-black text-blue-600 hover:text-blue-800 transition uppercase tracking-widest"
              >
                <ChevronLeft className="w-4 h-4" /> Back to Dashboard
              </button>
            )}
            {activeTab === 'overview' && (
              <OverviewTab
                studentData={studentData}
                className={className}
                attendanceRate={attendanceRate}
                pendingFees={pendingFees}
                results={results}
                homework={homework}
                todaySlots={todaySlots}
                notices={notices}
                setActiveTab={setActiveTab}
              />
            )}
            {activeTab === 'timetable' && <TimetableTab timetable={timetable} todayDayName={todayDayName} />}
            {activeTab === 'attendance' && (
              <AttendanceTab
                attendance={attendance}
                attMonth={attMonth}
                setAttMonth={setAttMonth}
                onMonthChange={() => {}}
              />
            )}
            {activeTab === 'results' && <ResultsTab results={results} />}
            {activeTab === 'fees' && <FeesTab fees={feeRecords} pendingFees={pendingFees} fmt={fmt} />}
            {activeTab === 'homework' && <HomeworkTab homework={homework} />}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ studentData, className, attendanceRate, pendingFees, results, homework, todaySlots, notices, setActiveTab }: any) {
  const fmt = (n: number) => `Rs. ${n.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-6">
      {/* Student Profile Banner */}
      <div className="aura-navy-card rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-white/20 transition-all duration-700" />
        <div className="flex items-center gap-5 relative z-10">
          {studentData.photograph_url ? (
            <img src={studentData.photograph_url} className="w-20 h-20 rounded-2xl object-cover ring-4 ring-white/20 shadow-xl" alt="" />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-3xl font-black shadow-lg">
              {studentData.full_name.charAt(0)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-blue-200 text-[10px] font-black uppercase tracking-widest mb-1">Welcome back</p>
            <h1 className="text-2xl font-black tracking-tight leading-tight">{studentData.full_name}</h1>
            <p className="text-blue-100/80 text-sm font-medium mt-1">
              {className} <span className="mx-1.5 opacity-30">|</span> Roll #{studentData.roll_number}
            </p>
          </div>
        </div>
      </div>

      {/* Portal Content Area */}
      <div className="portal-content-padding">
        <div className="space-y-6">
          {/* Primary Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => setActiveTab('attendance')}
              className="bg-white rounded-3xl p-5 text-left border border-gray-100 shadow-sm hover:shadow-md transition group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                <CheckCircle className="w-12 h-12" />
              </div>
              <p className="text-3xl font-black text-gray-900 leading-none">{attendanceRate}%</p>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">Attendance</p>
              <div className="mt-4 flex gap-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 transition-all duration-1000" style={{ width: `${attendanceRate}%` }} />
              </div>
            </button>

            <button onClick={() => setActiveTab('fees')}
              className="bg-white rounded-3xl p-5 text-left border border-gray-100 shadow-sm hover:shadow-md transition group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                <CreditCard className="w-12 h-12" />
              </div>
              <p className={`text-2xl font-black leading-none ${pendingFees > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {pendingFees > 0 ? `Rs. ${(pendingFees/1000).toFixed(1)}k` : 'Cleared'}
              </p>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">Dues Status</p>
              <div className="mt-4 flex items-center gap-1">
                 <span className={`w-1.5 h-1.5 rounded-full ${pendingFees > 0 ? 'bg-red-500' : 'bg-emerald-500'}`} />
                 <span className="text-[10px] font-bold text-gray-400">{pendingFees > 0 ? 'Invoice Pending' : 'No Overdue'}</span>
              </div>
            </button>
          </div>

          {/* Academic Hub Cards */}
          <div>
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 ml-1">Learning Center</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: 'homework', label: 'My Homework', sub: 'Teacher diary entries', icon: BookOpen, color: 'text-amber-600', bg: 'bg-amber-50' },
                { id: 'results', label: 'Exam Results', sub: 'Performance tracking', icon: Trophy, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                { id: 'timetable', label: 'Class Timetable', sub: 'Weekly schedule', icon: Clock, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                  className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-4 hover:border-blue-300 transition-all group shadow-sm">
                  <div className={`w-12 h-12 rounded-xl ${tab.bg} ${tab.color} flex items-center justify-center shrink-0 shadow-sm transition group-hover:scale-105`}>
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

          {/* Schedule & Notices Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-black text-gray-900 text-[11px] flex items-center gap-2 uppercase tracking-wide">
                  <Clock className="w-4 h-4 text-blue-600" /> Today's schedule
                </h3>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{new Date().toLocaleDateString('en-US', { weekday: 'short' })}</span>
              </div>
              {todaySlots.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-xs italic">No classes scheduled today.</div>
              ) : (
                <div className="space-y-4">
                  {todaySlots.slice(0, 4).map((s: any, i: number) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-8 h-8 bg-gray-50 text-gray-500 text-[10px] font-black rounded-xl flex items-center justify-center shrink-0">P{s.period_number}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate tracking-tight">{s.subjects?.subject_name}</p>
                        <p className="text-[10px] font-semibold text-gray-400 mt-0.5">{s.staff?.full_name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-black text-gray-900 text-[11px] flex items-center gap-2 uppercase tracking-wide">
                  <Bell className="w-4 h-4 text-amber-500" /> Notifications
                </h3>
                <button onClick={() => document.getElementById('notices-section')?.scrollIntoView({ behavior: 'smooth' })} className="text-[10px] font-black text-blue-600 hover:underline">View All</button>
              </div>
              {notices.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-xs italic">No new announcements.</div>
              ) : (
                <div className="space-y-5">
                  {notices.slice(0, 2).map((n: any) => (
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
      </div>
    </div>
  );
}

// ─── Timetable Tab ────────────────────────────────────────────────────────────
function TimetableTab({ timetable, todayDayName }: { timetable: any[]; todayDayName: string }) {
  const byDay: Record<string, any[]> = {};
  DAYS.forEach(d => { byDay[d] = []; });
  timetable.forEach(s => {
    const day = s.day_of_week;
    if (byDay[day]) byDay[day].push(s);
    else {
      // try matching by index
      const idx = Number(s.day_of_week);
      if (!isNaN(idx) && DAYS[idx - 1]) byDay[DAYS[idx - 1]].push(s);
    }
  });

  if (timetable.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-3" />
        <p className="text-gray-500">No timetable assigned for your class yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {DAYS.map(day => {
        const slots = byDay[day] || [];
        if (slots.length === 0) return null;
        const isToday = day === todayDayName;
        return (
          <div key={day} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${isToday ? 'border-indigo-300 ring-1 ring-indigo-300' : 'border-gray-200'}`}>
            <div className={`px-5 py-3 flex items-center gap-2 ${isToday ? 'bg-indigo-600' : 'bg-slate-50'}`}>
              <h3 className={`font-black text-sm ${isToday ? 'text-white' : 'text-slate-700'}`}>{day}</h3>
              {isToday && <span className="text-[10px] bg-white/20 text-white font-black px-2 py-0.5 rounded-full">TODAY</span>}
              <span className={`text-[10px] ml-auto font-bold ${isToday ? 'text-indigo-200' : 'text-slate-400'}`}>{slots.length} periods</span>
            </div>
            <div className="divide-y divide-gray-100">
              {slots.sort((a: any, b: any) => a.period_number - b.period_number).map((s: any, i: number) => (
                <div key={i} className="px-5 py-3 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-black shrink-0">
                    {s.period_number}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-900">{s.subjects?.subject_name || 'Subject'}</p>
                    <p className="text-xs text-gray-400">{s.staff?.full_name || 'Teacher TBA'}</p>
                  </div>
                  {(s.start_time || s.end_time) && (
                    <span className="text-xs text-gray-400 font-medium">
                      {s.start_time}{s.end_time ? ` – ${s.end_time}` : ''}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Attendance Tab ───────────────────────────────────────────────────────────
function AttendanceTab({ attendance, attMonth, setAttMonth }: { attendance: any[]; attMonth: string; setAttMonth: (m: string) => void; onMonthChange: () => void }) {
  const shiftMonth = (delta: number) => {
    const [y, m] = attMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setAttMonth(d.toISOString().slice(0, 7));
  };

  const monthAtt = attendance.filter(a => a.date?.startsWith(attMonth));
  const present = monthAtt.filter(a => a.status === 'present' || a.status === 'P').length;
  const absent = monthAtt.filter(a => a.status === 'absent' || a.status === 'A').length;
  const leave = monthAtt.filter(a => a.status === 'leave' || a.status === 'L').length;
  const rate = monthAtt.length > 0 ? Math.round((present / monthAtt.length) * 100) : 0;

  const attMap = new Map<string, string>();
  monthAtt.forEach(a => attMap.set(a.date, a.status));

  const [year, month] = attMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const cells: (number | null)[] = [];
  for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const dayColor = (day: number | null) => {
    if (!day) return '';
    const dateStr = `${attMonth}-${String(day).padStart(2, '0')}`;
    const s = attMap.get(dateStr);
    if (!s) return 'bg-gray-100 text-gray-400';
    if (s === 'present' || s === 'P') return 'bg-emerald-100 text-emerald-700 font-bold';
    if (s === 'absent' || s === 'A') return 'bg-red-100 text-red-700 font-bold';
    return 'bg-amber-100 text-amber-700 font-bold';
  };

  return (
    <div className="space-y-5">
      {/* Month nav */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => shiftMonth(-1)} className="p-2 rounded-lg hover:bg-gray-100 transition">
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </button>
          <h2 className="font-black text-gray-900">
            {new Date(attMonth + '-01').toLocaleDateString('en-PK', { month: 'long', year: 'numeric' })}
          </h2>
          <button onClick={() => shiftMonth(1)} className="p-2 rounded-lg hover:bg-gray-100 transition">
            <ChevronRight className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Present', value: present, color: 'emerald' },
            { label: 'Absent', value: absent, color: 'red' },
            { label: 'Leave', value: leave, color: 'amber' },
            { label: 'Rate', value: `${rate}%`, color: rate >= 75 ? 'emerald' : 'red' },
          ].map(({ label, value, color }) => (
            <div key={label} className={`bg-${color}-50 rounded-xl p-3 text-center`}>
              <p className={`text-xl font-black text-${color}-700`}>{value}</p>
              <p className={`text-[10px] font-bold text-${color}-500 uppercase`}>{label}</p>
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
            <div key={d} className="text-[10px] font-black text-gray-400 uppercase py-1">{d}</div>
          ))}
          {cells.map((day, i) => (
            <div key={i} className={`aspect-square flex items-center justify-center rounded-lg text-xs transition ${day ? dayColor(day) : ''}`}>
              {day || ''}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 justify-center text-[10px] font-bold text-gray-500">
          {[
            { color: 'bg-emerald-400', label: 'Present' },
            { color: 'bg-red-400', label: 'Absent' },
            { color: 'bg-amber-400', label: 'Leave' },
            { color: 'bg-gray-200', label: 'No Record' },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1">
              <span className={`w-2.5 h-2.5 rounded-sm ${color} inline-block`} /> {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Results Tab ──────────────────────────────────────────────────────────────
function ResultsTab({ results }: { results: any[] }) {
  if (results.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-gray-100 p-16 text-center shadow-sm">
        <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <Trophy className="w-10 h-10 text-indigo-200" />
        </div>
        <p className="text-gray-900 font-black text-lg">Results pending</p>
        <p className="text-gray-400 text-sm mt-1 max-w-xs mx-auto">No exam results has been recorded for your account yet.</p>
      </div>
    );
  }

  // Group by exam type
  const examGroups = new Map<string, any[]>();
  results.forEach(r => {
    const exam = r.exam_types?.name || 'General';
    if (!examGroups.has(exam)) examGroups.set(exam, []);
    examGroups.get(exam)!.push(r);
  });

  return (
    <div className="space-y-6">
      {Array.from(examGroups.entries()).map(([examName, items]) => {
        const totalObtained = items.reduce((s, r) => s + (Number(r.obtained_marks) || 0), 0);
        const totalMax = items.reduce((s, r) => s + (Number(r.total_marks) || 0), 0);
        const overall = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;

        return (
          <div key={examName} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-black text-gray-900">{examName}</h3>
              <div className={`px-3 py-1 rounded-lg text-[10px] font-black ${
                overall >= 60 ? 'bg-emerald-100 text-emerald-700' : overall >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
              }`}>
                {overall}% OVERALL
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50">
                    <th className="text-left px-6 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Subject</th>
                    <th className="text-center px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Marks</th>
                    <th className="text-center px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Grade</th>
                    <th className="text-center px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map((r, i) => {
                    const pct = r.total_marks > 0 ? Math.round((r.obtained_marks / r.total_marks) * 100) : 0;
                    const pass = pct >= 40;
                    return (
                      <tr key={i} className="hover:bg-gray-50/50 transition">
                        <td className="px-6 py-4 font-bold text-gray-900 leading-tight">{(r.subjects as any)?.subject_name || '—'}</td>
                        <td className="px-4 py-4 text-center font-black text-gray-900">
                          {r.obtained_marks}<span className="text-gray-300 font-medium text-xs">/{r.total_marks}</span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="w-9 h-9 rounded-xl bg-gray-900 text-white text-xs font-black inline-flex items-center justify-center shadow-sm">
                            {r.grade || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg tracking-wider ${
                            pass ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                          }`}>
                            {pass ? 'PASS' : 'FAIL'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Fees Tab ─────────────────────────────────────────────────────────────────
function FeesTab({ fees, pendingFees, fmt }: { fees: any[]; pendingFees: number; fmt: (n: number) => string }) {
  return (
    <div className="space-y-6">
      {/* Summary card */}
      <div className={`rounded-3xl p-6 relative overflow-hidden shadow-sm border ${pendingFees > 0 ? 'bg-red-50 border-red-100' : 'bg-white border-gray-100'}`}>
        <div className="flex items-center gap-4 relative z-10">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${pendingFees > 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <p className={`text-[10px] font-black uppercase tracking-widest ${pendingFees > 0 ? 'text-red-700' : 'text-emerald-700'}`}>Current Balance</p>
            <p className={`text-2xl font-black mt-0.5 ${pendingFees > 0 ? 'text-red-900' : 'text-slate-900'}`}>{fmt(pendingFees)}</p>
          </div>
        </div>
      </div>

      {fees.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 p-16 text-center shadow-sm">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <CreditCard className="w-10 h-10 text-gray-200" />
          </div>
          <p className="text-gray-900 font-black text-lg">No billing yet</p>
          <p className="text-gray-400 text-sm mt-1">Fee records will appear here as they are generated.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="text-left px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Month</th>
                  <th className="text-right px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Total</th>
                  <th className="text-right px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Paid</th>
                  <th className="text-right px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Balance</th>
                  <th className="text-center px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {fees.map((r, i) => {
                  const balance = Math.max(0, (r.total_amount || 0) - (r.paid_amount || 0));
                  const status = balance === 0 ? 'paid' : (r.paid_amount || 0) > 0 ? 'partial' : 'pending';
                  return (
                    <tr key={i} className="hover:bg-gray-50/50 transition">
                      <td className="px-6 py-4 font-bold text-gray-900">
                        {r.month_year ? new Date(r.month_year).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-4 py-4 text-right font-bold text-gray-900">{fmt(r.total_amount)}</td>
                      <td className="px-4 py-4 text-right font-bold text-emerald-600">{fmt(r.paid_amount)}</td>
                      <td className="px-4 py-4 text-right font-black text-red-600">{fmt(balance)}</td>
                      <td className="px-4 py-4 text-center">
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg tracking-wider ${
                          status === 'paid' ? 'bg-emerald-50 text-emerald-600'
                          : status === 'partial' ? 'bg-amber-50 text-amber-600'
                          : 'bg-red-50 text-red-600'
                        }`}>
                          {status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Homework Tab ─────────────────────────────────────────────────────────────
function HomeworkTab({ homework }: { homework: any[] }) {
  if (homework.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-gray-100 p-16 text-center shadow-sm">
        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-emerald-200" />
        </div>
        <p className="text-gray-900 font-black text-lg">Perfect, you're done!</p>
        <p className="text-gray-400 text-sm mt-1 max-w-xs mx-auto">None of your subjects have homework assignments listed today. Enjoy your break!</p>
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
            <h2 className="font-black text-gray-900 text-lg tracking-tight">Study Diary</h2>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active Lessons & Tasks</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Subject</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Topic & Task</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Next Plan</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-right">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {homework.map((h, i) => (
              <tr key={i} className="hover:bg-slate-50 transition group">
                <td className="px-6 py-5 align-top">
                  <span className="text-sm font-black text-blue-600">{h.subjects?.subject_name || 'General'}</span>
                </td>
                <td className="px-6 py-5 align-top">
                  <div className="flex flex-col gap-2">
                    {h.topic_covered && (
                      <span className="text-[11px] font-bold py-0.5 px-2 bg-slate-100 text-slate-600 rounded-md w-fit">
                        {h.topic_covered}
                      </span>
                    )}
                    <p className="text-sm text-gray-800 font-medium leading-relaxed max-w-sm">{h.homework}</p>
                  </div>
                </td>
                <td className="px-6 py-5 align-top">
                  {h.next_plan ? (
                    <div className="flex items-start gap-2 bg-emerald-50 rounded-xl p-3 border border-emerald-100/50">
                      <BookOpen className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                      <p className="text-xs text-emerald-800 font-medium leading-tight">{h.next_plan}</p>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300 italic">No plan listed</span>
                  )}
                </td>
                <td className="px-6 py-5 align-top text-right whitespace-nowrap">
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
