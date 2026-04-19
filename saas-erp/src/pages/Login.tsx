import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { GraduationCap } from 'lucide-react';


export default function Login() {
  const { t } = useTranslation();
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
    <div className="min-h-screen flex">
      {/* ── Left Panel: Branding ── */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative overflow-hidden bg-[#0d1526] flex-col justify-between p-12">
        {/* Decorative grid */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        {/* Glow orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-violet-600/15 rounded-full blur-[80px] pointer-events-none" />

        {/* Logo + App name */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/50">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white font-black text-sm uppercase tracking-[0.2em]">School ERP</p>
              <p className="text-indigo-400/70 text-[10px] font-semibold uppercase tracking-[0.3em]">Management System</p>
            </div>
          </div>

          <h1 className="text-5xl font-black text-white leading-[1.1] mb-6">
            Manage your<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">school smarter.</span>
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed max-w-sm">
            All-in-one platform for students, staff, fees, attendance, and academic records.
          </p>
        </div>

        {/* Feature pills */}
        <div className="relative z-10 space-y-3">
          {[
            { icon: '📊', label: 'Real-time Analytics & Reports' },
            { icon: '💳', label: 'Automated Fee Management' },
            { icon: '📋', label: 'Attendance & Result Tracking' },
            { icon: '🔒', label: 'Secure Multi-tenant Architecture' },
          ].map(f => (
            <div key={f.label} className="flex items-center gap-3">
              <span className="text-xl">{f.icon}</span>
              <span className="text-slate-400 text-sm font-medium">{f.label}</span>
            </div>
          ))}
          <p className="text-slate-600 text-xs font-bold uppercase tracking-widest mt-6 pt-6 border-t border-white/[0.06]">
            Secured Intelligent Gateway · v2.0
          </p>
        </div>
      </div>

      {/* ── Right Panel: Login Form ── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-[#0a0f1c] lg:bg-gray-50 relative overflow-hidden">
        {/* Mobile-only Background Elements */}
        <div className="lg:hidden absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
        <div className="lg:hidden absolute -top-20 -right-20 w-80 h-80 bg-indigo-600/30 rounded-full blur-[100px] pointer-events-none" />
        <div className="lg:hidden absolute -bottom-20 -left-20 w-80 h-80 bg-violet-600/20 rounded-full blur-[100px] pointer-events-none" />

        <div className="w-full max-w-md relative z-10">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
            <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-lg border border-white/10">
              <GraduationCap className="w-7 h-7 text-indigo-400" />
            </div>
            <div>
              <span className="block font-black text-white text-xl uppercase tracking-widest leading-none">EdgeX Suite</span>
              <span className="block text-indigo-400/80 text-[10px] font-bold uppercase tracking-[0.3em] mt-1">Gateway</span>
            </div>
          </div>

          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-3xl font-black text-white lg:text-slate-900 tracking-tight">Welcome to EdgeX</h2>
            <p className="text-slate-400 lg:text-slate-500 mt-2 text-sm">Sign in to access your secure portal</p>
          </div>

          <div className="bg-white/5 lg:bg-white backdrop-blur-2xl lg:backdrop-blur-none rounded-3xl shadow-2xl lg:shadow-xl shadow-black/50 lg:shadow-slate-200/60 border border-white/10 lg:border-slate-100 p-8">
            <form className="space-y-6" onSubmit={handleLogin}>
              {error && (
                <div className="bg-red-500/10 lg:bg-red-50 border border-red-500/20 lg:border-red-200 text-red-400 lg:text-red-700 px-4 py-3 rounded-xl text-sm flex items-start gap-3">
                  <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span className="pt-0.5 leading-snug">{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-black text-slate-400 lg:text-slate-500 uppercase tracking-widest mb-2.5">
                  Email Address or Portal ID
                </label>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g., admin@email.com, STU-123, FAM-001"
                  className="w-full px-6 py-4 lg:px-5 lg:py-3.5 border border-white/10 lg:border-slate-200 rounded-xl text-base lg:text-sm font-medium text-white lg:text-slate-900 placeholder-slate-500 lg:placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-white/5 lg:bg-slate-50 focus:bg-white/10 lg:focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 lg:text-slate-500 uppercase tracking-widest mb-2.5">
                  {t('login.password')}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-6 py-4 lg:px-5 lg:py-3.5 pr-14 lg:pr-12 border border-white/10 lg:border-slate-200 rounded-xl text-base lg:text-sm font-medium text-white lg:text-slate-900 placeholder-slate-500 lg:placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-white/5 lg:bg-slate-50 focus:bg-white/10 lg:focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-5 lg:right-4 top-1/2 -translate-y-1/2 text-slate-500 lg:text-slate-400 hover:text-indigo-400 lg:hover:text-indigo-600 transition-colors"
                  >
                    {showPassword ? (
                      <svg className="h-6 w-6 lg:h-5 lg:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="h-6 w-6 lg:h-5 lg:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                className="w-full bg-indigo-500 hover:bg-indigo-400 lg:bg-indigo-600 lg:hover:bg-indigo-700 active:bg-indigo-600 lg:active:bg-indigo-800 text-white font-black lg:font-bold text-lg lg:text-base py-4 lg:py-4 rounded-xl transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6 lg:mt-4"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-5 h-5 lg:w-4 lg:h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Authenticating...
                  </>
                ) : 'Sign In →'}
              </button>
            </form>
          </div>

          {/* Role Routing Helper Panels */}
          <div className="mt-8 grid grid-cols-2 gap-3 lg:gap-4">
            <Link to="/parent-portal" className="group p-5 lg:p-4 bg-white/5 lg:bg-white border border-white/10 lg:border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-3 lg:gap-2 hover:bg-white/10 lg:hover:border-indigo-300 transition-all shadow-sm">
              <div className="w-12 h-12 lg:w-10 lg:h-10 rounded-full bg-emerald-500/10 lg:bg-emerald-50 text-emerald-400 lg:text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 lg:w-5 lg:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              </div>
              <div className="text-center">
                <span className="block text-sm lg:text-xs font-black text-white lg:text-slate-900 tracking-tight">Parent Portal</span>
                <span className="block text-xs lg:text-[10px] text-slate-400 lg:text-slate-500 font-medium mt-0.5">FAM-XXX</span>
              </div>
            </Link>

            <Link to="/student-portal" className="group p-5 lg:p-4 bg-white/5 lg:bg-white border border-white/10 lg:border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-3 lg:gap-2 hover:bg-white/10 lg:hover:border-indigo-300 transition-all shadow-sm">
              <div className="w-12 h-12 lg:w-10 lg:h-10 rounded-full bg-blue-500/10 lg:bg-blue-50 text-blue-400 lg:text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <GraduationCap className="w-6 h-6 lg:w-5 lg:h-5" />
              </div>
              <div className="text-center">
                <span className="block text-sm lg:text-xs font-black text-white lg:text-slate-900 tracking-tight">Student Portal</span>
                <span className="block text-xs lg:text-[10px] text-slate-400 lg:text-slate-500 font-medium mt-0.5">STU-XXX</span>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
