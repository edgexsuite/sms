import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  GraduationCap, 
  LogOut, 
  BarChart3, 
  Calendar, 
  CheckCircle, 
  XCircle, 
  ChevronRight, 
  Eye, 
  EyeOff, 
  Bell,
  User,
  BookOpen,
  Trophy
} from 'lucide-react';

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

const SESSION_KEY = 'student_portal_session';

export default function StudentPortal() {
  const [studentData, setStudentData] = useState<StudentData | null>(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  const [studentIdInput, setStudentIdInput] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const [attendance, setAttendance] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    if (studentData) {
      fetchStudentDashboard();
    }
  }, [studentData]);

  const fetchStudentDashboard = async () => {
    if (!studentData) return;
    setLoadingData(true);
    try {
      const [
        { data: attn },
        { data: res },
        { data: notif }
      ] = await Promise.all([
        // Fetch Attendance (Last 30 days)
        supabase.from('attendance')
          .select('date, status')
          .eq('student_id', studentData.id)
          .order('date', { ascending: false })
          .limit(30),
        
        // Fetch Exam Results
        supabase.from('exam_results')
          .select(`
            obtained_marks,
            total_marks,
            grade,
            exam_types (name),
            subjects (subject_name)
          `)
          .eq('student_id', studentData.id)
          .order('created_at', { ascending: false }),

        // Fetch Notifications
        supabase.from('notifications')
          .select('*')
          .eq('school_id', studentData.school_id)
          .or(`target_audience.eq.all,and(target_audience.eq.class,class_id.eq.${studentData.class_id})`)
          .order('created_at', { ascending: false })
          .limit(5)
      ]);

      setAttendance(attn || []);
      setResults(res || []);
      setNotices(notif || []);
    } catch (err) {
      console.error('Error fetching student dashboard:', err);
    } finally {
      setLoadingData(false);
    }
  };

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
        .select(`
          id, 
          full_name, 
          student_unique_id, 
          school_id, 
          class_id, 
          photograph_url,
          roll_number,
          classes (name, section)
        `)
        .eq('student_unique_id', studentIdInput.trim())
        .eq('auth_password', password.trim())
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setLoginError('Invalid Student ID or Password.');
        return;
      }

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

  // Stats Calculations
  const presentCount = attendance.filter(a => a.status === 'present').length;
  const attendanceRate = attendance.length > 0 ? (presentCount / attendance.length) * 100 : 0;

  if (!studentData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 selection:bg-indigo-100">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-600 rounded-3xl shadow-2xl shadow-indigo-200 mb-6 rotate-3">
              <GraduationCap className="w-10 h-10 text-white -rotate-3" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">STUDENT PORTAL</h1>
            <p className="text-slate-500 font-medium mt-2">Access your learning dashboard</p>
          </div>

          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8">
            <h2 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-2">
              <div className="w-2 h-6 bg-indigo-600 rounded-full" />
              Welcome Back
            </h2>
            
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Student ID</label>
                <input
                  type="text"
                  value={studentIdInput}
                  onChange={e => setStudentIdInput(e.target.value)}
                  placeholder="e.g. STU-001"
                  className="w-full bg-slate-50 border-none rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-600 transition outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Secret Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-3.5 pr-12 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-600 transition outline-none"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {loginError && (
                <div className="bg-rose-50 border border-rose-100 text-rose-600 text-xs font-black px-4 py-3 rounded-2xl flex items-center gap-2">
                  <XCircle className="w-4 h-4 shrink-0" /> {loginError}
                </div>
              )}

              <button 
                type="submit" 
                disabled={loggingIn}
                className="w-full bg-indigo-600 hover:bg-slate-900 text-white font-black py-4 rounded-2xl shadow-lg shadow-indigo-100 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
              >
                {loggingIn ? 'Authenticating...' : <>Login to Portal <ChevronRight className="w-5 h-5" /></>}
              </button>
            </form>

            <div className="mt-10 pt-8 border-t border-slate-50 flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Portal Version 2.0</span>
              <div className="flex gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-600" />
                <div className="w-2 h-2 rounded-full bg-slate-200" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-indigo-100">
      {/* Dynamic Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 rotate-6">
              <GraduationCap className="w-6 h-6 text-white -rotate-6" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none uppercase">Student Hub</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Academic Performance</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
             <div className="text-right hidden sm:block">
               <p className="text-sm font-black text-slate-900">{studentData.full_name}</p>
               <p className="text-[10px] font-bold text-slate-400 uppercase">Roll #{studentData.roll_number}</p>
             </div>
             <button onClick={handleLogout} className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all group">
               <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
             </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT: Profile & Attendance */}
          <div className="lg:col-span-1 space-y-8">
            {/* Student ID Card */}
            <div className="bg-indigo-600 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-200">
               <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
               <div className="absolute -right-4 -top-4 opacity-10"><User size={120} /></div>
               
               <div className="relative z-10 flex flex-col items-center text-center">
                 {studentData.photograph_url ? (
                   <img src={studentData.photograph_url} className="w-24 h-24 rounded-3xl object-cover ring-4 ring-white/20 mb-4" alt="" />
                 ) : (
                   <div className="w-24 h-24 rounded-3xl bg-white/20 flex items-center justify-center text-3xl font-black mb-4">
                     {studentData.full_name.charAt(0)}
                   </div>
                 )}
                 <h2 className="text-xl font-black tracking-tight mb-1">{studentData.full_name}</h2>
                 <span className="text-xs font-bold text-indigo-100 uppercase tracking-widest px-3 py-1 bg-white/10 rounded-full">
                   Class: {studentData.classes?.name} {studentData.classes?.section}
                 </span>
                 
                 <div className="grid grid-cols-2 gap-4 w-full mt-10 p-4 bg-white/10 rounded-2xl border border-white/10">
                    <div>
                      <p className="text-[9px] font-black uppercase text-indigo-200 tracking-tighter">Student ID</p>
                      <p className="font-black text-xs font-mono">{studentData.student_unique_id}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase text-indigo-200 tracking-tighter">Roll No</p>
                      <p className="font-black text-xs font-mono">#{studentData.roll_number}</p>
                    </div>
                 </div>
               </div>
            </div>

            {/* Attendance Stat Card */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
               <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <h3 className="font-black text-slate-800 tracking-tight">Attendance</h3>
                  </div>
                  <span className="text-xl font-black text-emerald-600">{Math.round(attendanceRate)}%</span>
               </div>
               
               <div className="flex gap-1.5 justify-between">
                  {attendance.slice(0, 15).reverse().map((a, i) => (
                    <div key={i} title={`${a.date}: ${a.status}`} className={`flex-1 h-3 rounded-full ${a.status === 'present' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                  ))}
               </div>
               <p className="text-[10px] font-bold text-slate-400 uppercase mt-4 text-center tracking-widest">Efficiency Last 15 Days</p>
            </div>
          </div>

          {/* RIGHT: Exam Results & Notices */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Notices Section */}
            <div className="bg-rose-50/50 rounded-3xl border border-rose-100 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center">
                  <Bell className="w-5 h-5" />
                </div>
                <h3 className="font-black text-slate-800 tracking-tight">Teacher Diary & Notices</h3>
              </div>
              
              <div className="space-y-4">
                {notices.length === 0 ? (
                  <p className="text-slate-400 text-sm italic py-4">No recent announcements found.</p>
                ) : (
                  notices.map((n, i) => (
                    <div key={i} className="bg-white p-4 rounded-2xl border border-rose-100 shadow-sm">
                      <h4 className="font-black text-slate-900 text-sm mb-1">{n.title}</h4>
                      <p className="text-slate-600 text-xs leading-relaxed">{n.message}</p>
                      <span className="text-[10px] font-bold text-slate-400 mt-2 block uppercase">{new Date(n.created_at).toLocaleDateString()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Results Section */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
               <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                      <Trophy className="w-5 h-5" />
                    </div>
                    <h3 className="font-black text-slate-800 tracking-tight">Recent Exam Performance</h3>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <div className="w-2 h-2 rounded-full bg-indigo-400" />
                  </div>
               </div>
               
               <div className="p-6">
                 {results.length === 0 ? (
                   <div className="py-20 text-center">
                      <div className="bg-slate-50 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4">
                        <BookOpen className="w-8 h-8 text-slate-300" />
                      </div>
                      <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">No exam results reported yet</p>
                   </div>
                 ) : (
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {results.map((r, i) => (
                       <div key={i} className="group p-5 bg-slate-50 hover:bg-white rounded-2xl border border-transparent hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-50/50 transition-all">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-1">{r.exam_types?.name}</p>
                              <h4 className="text-sm font-black text-slate-900">{r.subjects?.subject_name}</h4>
                            </div>
                            <div className="text-right">
                               <span className="inline-block text-xl font-black text-slate-900">{r.obtained_marks}/<span className="text-slate-400 text-xs">{r.total_marks}</span></span>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between pt-3 border-t border-slate-200/50">
                             <div className="flex items-center gap-2">
                               {Number(r.obtained_marks) / Number(r.total_marks) >= 0.4 ? (
                                 <CheckCircle className="w-4 h-4 text-emerald-500" />
                               ) : (
                                 <XCircle className="w-4 h-4 text-rose-500" />
                               )}
                               <span className="text-[10px] font-black text-slate-400 uppercase">Proficiency</span>
                             </div>
                             <span className="w-8 h-8 rounded-xl bg-slate-900 text-white text-[10px] font-black flex items-center justify-center uppercase">{r.grade}</span>
                          </div>
                       </div>
                     ))}
                   </div>
                 )}
               </div>
            </div>

          </div>
        </div>
      </main>

      <footer className="text-center py-10">
         <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">SCHOOL ERP STUDENT ECOSYSTEM · 2026</p>
      </footer>
    </div>
  );
}
