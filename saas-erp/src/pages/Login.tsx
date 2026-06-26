import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { GraduationCap } from 'lucide-react';


export default function Login() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState(''); // Unified ID or Email
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Determine if it's an email (Administrative/Staff login)
      if (identifier.includes('@')) {
        const { error } = await supabase.auth.signInWithPassword({
          email: identifier,
          password,
        });
        if (error) throw error;
        navigate('/dashboard');
        return;
      }

      // 2. Otherwise, treat as ID (Family ID or Student ID)
      const input = identifier.trim();

      // Check Parent Table
      const { data: parent } = await supabase
        .from('parents')
        .select('id, full_name, family_number, auth_password, custom_data, school_id')
        .ilike('family_number', input)
        .eq('auth_password', password)
        .maybeSingle();

      if (parent) {
        sessionStorage.setItem('parent_portal_session', JSON.stringify(parent));
        navigate('/parent-portal');
        return;
      }

      // Check Student Table
      const { data: student } = await supabase
        .from('students')
        .select(`
          id, 
          full_name, 
          student_unique_id, 
          auth_password,
          school_id, 
          class_id, 
          custom_data,
          classes (name, section)
        `)
        .ilike('student_unique_id', input)
        .eq('auth_password', password)
        .maybeSingle();

      if (student) {
        sessionStorage.setItem('student_portal_session', JSON.stringify(student));
        navigate('/student-portal');
        return;
      }

      throw new Error('Invalid Email or School ID. Please check your credentials.');

    } catch (err: any) {
      setError(err.message || t('login.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50/30">
      {/* ── Left Panel: Branding & Enterprise Preview ── */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[52%] relative overflow-hidden bg-[#0a0f1d] flex-col justify-between p-12 select-none">
        {/* Subtle high-end grid pattern */}
        <div className="absolute inset-0 opacity-[0.02]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        
        {/* Soft, professional gradient light from top-left */}
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

        {/* Logo + App name */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/40">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm uppercase tracking-widest leading-none">EdgeX Suite</p>
              <p className="text-indigo-400/80 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">Management Portal</p>
            </div>
          </div>

          <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-tight mb-5 tracking-tight">
            Manage your school <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-indigo-200">smarter, faster.</span>
          </h1>
          <p className="text-slate-400 text-base leading-relaxed max-w-md font-medium">
            An integrated cloud workspace for administrators, teachers, students, and parents. Track academics, attendance, and finances in one unified dashboard.
          </p>
        </div>

        {/* CSS Mockup of Dashboard Preview */}
        <div className="relative z-10 w-full max-w-md my-6 border border-white/10 rounded-2xl bg-white/[0.02] backdrop-blur-md p-5 shadow-2xl">
          {/* Mock Window Controls */}
          <div className="flex items-center justify-between mb-5 border-b border-white/[0.06] pb-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono tracking-wider">portal.theedgeschool.com</span>
            <div className="w-10"></div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            {/* Stat Box 1 */}
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3.5">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Attendance Rate</span>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="text-xl font-bold text-white tracking-tight">96.8%</span>
                <span className="text-emerald-400 text-[10px] font-semibold">+1.4%</span>
              </div>
            </div>
            {/* Stat Box 2 */}
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3.5">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Fees Collected</span>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="text-xl font-bold text-white tracking-tight">PKR 1.2M</span>
                <span className="text-slate-500 text-[9px] font-medium">this month</span>
              </div>
            </div>

            {/* Weekly chart preview */}
            <div className="col-span-2 bg-white/[0.03] border border-white/5 rounded-xl p-3.5">
              <div className="flex items-center justify-between mb-3.5">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Daily Attendance</span>
                <span className="text-[9px] text-indigo-400 font-semibold">Live Mon - Fri</span>
              </div>
              <div className="flex items-end justify-between h-16 pt-1 gap-2.5">
                {[75, 82, 68, 92, 88].map((height, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <div 
                      className="w-full bg-gradient-to-t from-indigo-600/30 to-indigo-500 rounded-t-sm"
                      style={{ height: `${height}%` }}
                    ></div>
                    <span className="text-[8px] text-slate-500 font-semibold">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][idx]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Left Panel Footer */}
        <div className="relative z-10 flex items-center justify-between text-slate-500 text-[10px] font-bold uppercase tracking-widest pt-6 border-t border-white/[0.05]">
          <span>Secured Portal Gateway</span>
          <span>v2.4.0</span>
        </div>
      </div>

      {/* ── Right Panel: Login Form ── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50 relative overflow-hidden">
        {/* Premium Language Toggler */}
        <div className="absolute top-6 right-6 z-20">
          <button
            type="button"
            onClick={() => i18n.changeLanguage(i18n.language === 'en' ? 'ur' : 'en')}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm hover:border-slate-300 cursor-pointer"
          >
            <span className="text-slate-400 text-xs">🌐</span>
            <span>{i18n.language === 'en' ? 'اردو' : 'English'}</span>
          </button>
        </div>

        <div className="w-full max-w-md relative z-10 flex flex-col items-center">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/20">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="block font-black text-slate-900 text-lg uppercase tracking-wider leading-none">EdgeX Suite</span>
              <span className="block text-indigo-600 text-[9px] font-bold uppercase tracking-[0.2em] mt-1">Management Portal</span>
            </div>
          </div>

          <div className="w-full bg-white rounded-2xl border border-slate-200/80 shadow-[0_8px_30px_rgba(0,0,0,0.03)] p-8">
            <div className="mb-6 text-center lg:text-start">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{t('login.title')}</h2>
              <p className="text-slate-500 mt-1.5 text-sm">{t('login.subtitle')}</p>
            </div>

            <form className="space-y-5" onSubmit={handleLogin}>
              {error && (
                <div className="bg-rose-50 border border-rose-100 text-rose-700 px-4 py-3 rounded-xl text-sm flex items-start gap-2.5 animate-fadeIn">
                  <svg className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="leading-snug">{error}</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  {t('login.email')} / Portal ID
                </label>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g., admin@school.com, STU-1024, FAM-204"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  {t('login.password')}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 pr-12 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 rtl:right-auto rtl:left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    {showPassword ? (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0d1526] hover:bg-[#16213a] active:bg-[#070b13] text-white font-bold text-sm py-3.5 rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4 cursor-pointer"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {t('login.loading')}
                  </>
                ) : t('login.submit')}
              </button>
            </form>
          </div>

          {/* Role Routing Helper Panels */}
          <div className="mt-6 grid grid-cols-2 gap-4 w-full">
            <Link to="/parent-portal" className="group p-4 bg-white border border-slate-200 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-indigo-500 hover:shadow-[0_4px_20px_rgba(99,102,241,0.06)] transition-all">
              <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="text-center">
                <span className="block text-xs font-bold text-slate-800 tracking-tight">Parent Portal</span>
                <span className="block text-[10px] text-slate-400 font-semibold mt-0.5">Family ID Login</span>
              </div>
            </Link>

            <Link to="/student-portal" className="group p-4 bg-white border border-slate-200 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-indigo-500 hover:shadow-[0_4px_20px_rgba(99,102,241,0.06)] transition-all">
              <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div className="text-center">
                <span className="block text-xs font-bold text-slate-800 tracking-tight">Student Portal</span>
                <span className="block text-[10px] text-slate-400 font-semibold mt-0.5">Student ID Login</span>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
