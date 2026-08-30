import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { 
  Lock, Mail, User, Eye, EyeOff, ShieldCheck, 
  ArrowRight, Sparkles, Phone, HelpCircle, CheckCircle2,
  Building2, Users, GraduationCap, Globe
} from 'lucide-react';

type LoginTab = 'staff' | 'parent' | 'student' | 'demo';

// Official EdgeX Digital Vector Logo
const EdgeXLogo = ({ className = 'h-10 w-10' }: { className?: string }) => (
  <div className={`relative ${className} rounded-xl bg-gradient-to-br from-[#071b34] via-[#0b284e] to-[#087fe5] flex items-center justify-center shadow-md shadow-sky-950/20 overflow-hidden border border-sky-400/30 shrink-0`}>
    <svg className="w-6 h-6" viewBox="0 0 32 32" fill="none">
      <path d="M6 9L16 4L26 9V23L16 28L6 23V9Z" stroke="#38bdf8" strokeWidth="1.5" strokeOpacity="0.7"/>
      <path d="M10 11H22M10 16H18M10 21H22" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="21.5" cy="16" r="2.5" fill="#38bdf8" />
    </svg>
  </div>
);

// Official WhatsApp Vector Icon Component
const WhatsAppIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
  </svg>
);

export default function Login() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<LoginTab>('staff');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === 'true' || params.get('tab') === 'demo') {
      setActiveTab('demo');
      setIdentifier('demo@edgexsuite.com');
      setPassword('Demo@1234');
    }
  }, []);

  const handleTabChange = (tab: LoginTab) => {
    setActiveTab(tab);
    setError(null);
    if (tab === 'demo') {
      setIdentifier('demo@edgexsuite.com');
      setPassword('Demo@1234');
    } else {
      setIdentifier('');
      setPassword('');
    }
  };

  const handleDemoLogin = async () => {
    setIdentifier('demo@edgexsuite.com');
    setPassword('Demo@1234');
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: 'demo@edgexsuite.com',
        password: 'Demo@1234',
      });
      if (error) throw error;
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Error logging into demo account.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      setError('Please enter both ID/Email and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const input = identifier.trim();

      // 1. Staff / Admin Login (Email or Demo)
      if (activeTab === 'staff' || activeTab === 'demo' || input.includes('@')) {
        const { error } = await supabase.auth.signInWithPassword({
          email: input,
          password,
        });
        if (error) throw error;
        navigate('/dashboard');
        return;
      }

      // 2. Parent Portal Login
      if (activeTab === 'parent') {
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
        throw new Error('Invalid Family ID or password. Please verify your details.');
      }

      // 3. Student Portal Login
      if (activeTab === 'student') {
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
        throw new Error('Invalid Student ID or password. Please verify your details.');
      }

      // Fallback: Automatic Universal Matching
      const { data: parentAuto } = await supabase
        .from('parents')
        .select('id, full_name, family_number, auth_password, custom_data, school_id')
        .ilike('family_number', input)
        .eq('auth_password', password)
        .maybeSingle();

      if (parentAuto) {
        sessionStorage.setItem('parent_portal_session', JSON.stringify(parentAuto));
        navigate('/parent-portal');
        return;
      }

      const { data: studentAuto } = await supabase
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

      if (studentAuto) {
        sessionStorage.setItem('student_portal_session', JSON.stringify(studentAuto));
        navigate('/student-portal');
        return;
      }

      throw new Error('Invalid credentials. Please check your Email/ID and password.');
    } catch (err: any) {
      setError(err.message || t('login.error') || 'Failed to authenticate.');
    } finally {
      setLoading(false);
    }
  };

  const getIdentifierLabel = () => {
    switch (activeTab) {
      case 'staff':
        return 'Official Staff Email';
      case 'parent':
        return 'Family Number / Parent ID';
      case 'student':
        return 'Student Registration / Roll ID';
      case 'demo':
        return 'Demo Account Email';
    }
  };

  const getIdentifierPlaceholder = () => {
    switch (activeTab) {
      case 'staff':
        return 'e.g. principal@school.com or admin@school.com';
      case 'parent':
        return 'e.g. FAM-104 or 31202-*******-1';
      case 'student':
        return 'e.g. STU-2026 or Roll Number';
      case 'demo':
        return 'demo@edgexsuite.com';
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-900 font-sans antialiased selection:bg-[#087fe5] selection:text-white">
      
      {/* ── Left Panel: Institutional Brand & Metric Showcase ───────────────── */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[52%] relative overflow-hidden bg-gradient-to-br from-[#071b34] via-[#0b2447] to-[#041021] flex-col justify-between p-12 select-none border-r border-white/10">
        
        {/* Background Image Texture & Glow Effects */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-[0.08] blur-lg scale-110 pointer-events-none"
          style={{ backgroundImage: `url('/assets/dashboard_preview.png')` }}
        />
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{ 
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)', 
            backgroundSize: '40px 40px' 
          }} 
        />
        <div className="absolute -left-20 -top-20 w-[500px] h-[500px] bg-sky-500/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute -right-20 bottom-10 w-[450px] h-[450px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />

        {/* Top Header: Logo & Branding */}
        <div className="relative z-10">
          <div className="flex items-center gap-3.5 mb-8">
            <EdgeXLogo className="h-11 w-11" />
            <div>
              <b className="text-white font-black text-xl tracking-tight block leading-tight">
                EdgeX <span className="text-[#38bdf8]">Digital</span>
              </b>
              <small className="block text-[9px] font-black tracking-widest text-slate-400 uppercase">
                ALL-IN-ONE DIGITAL CAMPUS OPERATING SYSTEM
              </small>
            </div>
          </div>

          <h1 className="text-3xl xl:text-4xl font-black text-white leading-[1.1] tracking-tight mb-4">
            The Fastest &amp; <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-sky-200 to-white">Smartest ERP</span>
            <br />
            for Modern Schools.
          </h1>
          <p className="text-slate-300 text-xs leading-relaxed max-w-md font-medium">
            Centralize your entire campus operations. Live QR attendance, automated teacher substitution, 12-month fee ledger matrix, exam gazettes, and instant parent WhatsApp updates in one unified workspace.
          </p>
        </div>

        {/* Live Actual Dashboard Preview Window */}
        <div className="relative z-10 w-full max-w-lg my-4 rounded-3xl border border-white/15 bg-slate-950/70 p-2.5 backdrop-blur-2xl shadow-2xl overflow-hidden group">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 text-[11px] font-bold text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
              <span className="ml-2 text-slate-300 font-mono text-[10px]">school.edgexsuite.com</span>
            </div>
            <span className="text-[10px] font-black text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE CAMPUS DEMO
            </span>
          </div>
          
          <div className="relative overflow-hidden rounded-2xl border border-white/5 mt-1">
            <img 
              src="/assets/dashboard_preview.png" 
              alt="EdgeX SMS Live Dashboard Preview" 
              className="w-full h-auto object-cover rounded-2xl transition-transform duration-500 group-hover:scale-[1.02]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex items-end justify-between p-3">
              <span className="text-white text-xs font-black drop-shadow-md">
                EdgeX Model School &amp; College
              </span>
              <span className="bg-emerald-500/90 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs">
                Active Session
              </span>
            </div>
          </div>
        </div>

        {/* Footer: Version & Support */}
        <div className="relative z-10 flex items-center justify-between text-slate-400 text-xs font-bold pt-6 border-t border-white/10">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-sky-400" />
            <span>Secured Multi-Tenant Infrastructure</span>
          </div>
          <a 
            href="tel:03012616367" 
            className="hover:text-sky-300 transition-colors flex items-center gap-1 text-slate-300 font-semibold"
          >
            <Phone className="w-3.5 h-3.5 text-sky-400" /> Helpline: 0301-2616367
          </a>
        </div>
      </div>

      {/* ── Right Panel: Modern Role-Based Authentication Card ────────────── */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 bg-slate-50 relative overflow-y-auto">
        
        {/* Top-Right Language Switcher */}
        <div className="absolute top-6 right-6 z-20">
          <button
            type="button"
            onClick={() => i18n.changeLanguage(i18n.language === 'en' ? 'ur' : 'en')}
            className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition shadow-xs cursor-pointer"
          >
            <Globe className="w-4 h-4 text-[#087fe5]" />
            <span>{i18n.language === 'en' ? 'اردو زبان' : 'English'}</span>
          </button>
        </div>

        <div className="w-full max-w-md relative z-10 my-8">
          
          {/* Mobile Top Brand Header */}
          <div className="lg:hidden flex items-center gap-3 mb-6 justify-center">
            <EdgeXLogo className="h-10 w-10" />
            <div>
              <b className="text-slate-900 font-black text-lg block leading-tight">
                EdgeX <span className="text-[#087fe5]">Digital</span>
              </b>
              <small className="block text-[8px] font-black tracking-wider text-slate-400 uppercase">
                ALL-IN-ONE DIGITAL CAMPUS OPERATING SYSTEM
              </small>
            </div>
          </div>

          {/* Main Login Card */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-200/50 p-6 sm:p-8">
            
            {/* Header */}
            <div className="mb-6">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-[11px] font-black text-[#087fe5] mb-2">
                🔒 Official Institutional Gateway
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Sign In to Portal
              </h2>
              <p className="text-slate-500 mt-1 text-xs font-medium">
                Choose your role to access your personalized campus dashboard.
              </p>
            </div>

            {/* Smart Role Tabs */}
            <div className="grid grid-cols-4 gap-1.5 bg-slate-100/90 p-1.5 rounded-2xl mb-6 border border-slate-200/60">
              <button
                type="button"
                onClick={() => handleTabChange('staff')}
                className={`py-2 px-1 rounded-xl text-xs font-black transition-all flex flex-col items-center gap-1 ${
                  activeTab === 'staff'
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-4 h-4 text-[#087fe5]" />
                <span className="text-[10px]">Staff</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange('parent')}
                className={`py-2 px-1 rounded-xl text-xs font-black transition-all flex flex-col items-center gap-1 ${
                  activeTab === 'parent'
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Users className="w-4 h-4 text-emerald-600" />
                <span className="text-[10px]">Parent</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange('student')}
                className={`py-2 px-1 rounded-xl text-xs font-black transition-all flex flex-col items-center gap-1 ${
                  activeTab === 'student'
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <GraduationCap className="w-4 h-4 text-indigo-600" />
                <span className="text-[10px]">Student</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange('demo')}
                className={`py-2 px-1 rounded-xl text-xs font-black transition-all flex flex-col items-center gap-1 ${
                  activeTab === 'demo'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-sm'
                    : 'text-amber-700 hover:text-amber-800'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span className="text-[10px]">Demo</span>
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-5 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl text-xs font-bold flex items-start gap-2.5">
                <span className="text-base leading-none">⚠️</span>
                <span className="leading-snug">{error}</span>
              </div>
            )}

            {/* Demo Mode Notice */}
            {activeTab === 'demo' && (
              <div className="mb-5 bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-2xl text-xs font-medium">
                <b className="font-black text-amber-950 block">⚡ Instant Sandbox Demo Mode</b>
                Pre-filled with <b>demo@edgexsuite.com</b>. Tests all ERP features without needing private school credentials.
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              
              {/* Identifier Input */}
              <div>
                <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1.5">
                  {getIdentifierLabel()} *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    {activeTab === 'staff' || activeTab === 'demo' ? (
                      <Mail className="w-4 h-4" />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={getIdentifierPlaceholder()}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#087fe5] focus:ring-2 focus:ring-sky-100 transition-all"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider">
                    Password *
                  </label>
                  {activeTab === 'staff' && (
                    <Link
                      to="/reset-password"
                      className="text-xs font-bold text-[#087fe5] hover:text-[#066ac0] hover:underline"
                    >
                      Forgot password?
                    </Link>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#087fe5] focus:ring-2 focus:ring-sky-100 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#071b34] hover:bg-[#0c294d] active:bg-[#041021] text-white font-black text-sm py-3.5 rounded-xl transition-all shadow-md shadow-slate-900/10 disabled:opacity-50 flex items-center justify-center gap-2 mt-2 cursor-pointer group"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Authenticating...
                  </>
                ) : (
                  <>
                    <span>Sign In to {activeTab === 'demo' ? 'Demo Campus' : 'Portal'}</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>

              {/* 1-Click Demo Shortcut if not on Demo tab */}
              {activeTab !== 'demo' && (
                <div className="pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleDemoLogin}
                    disabled={loading}
                    className="w-full py-2.5 px-3 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-900 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#087fe5]" />
                    <span>Prospective School? 1-Click Instant Demo Login</span>
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* 1-Month Free Trial Banner */}
          <div className="mt-5">
            <Link
              to="/trial"
              className="w-full py-3.5 px-4 bg-gradient-to-r from-sky-500 to-[#087fe5] hover:from-sky-600 hover:to-[#0770cb] text-white rounded-2xl flex items-center justify-between text-xs font-black shadow-md shadow-sky-200 transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base">🌟</span>
                <div>
                  <p className="font-black text-white">New School? Start 1-Month Free Trial</p>
                  <p className="text-[10px] text-sky-100 font-medium">30 Days Full Access · Zero Setup Fee</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-white text-[#087fe5] rounded-xl text-[11px] font-black uppercase tracking-wider group-hover:scale-105 transition-transform">
                Register Free →
              </span>
            </Link>
          </div>

          {/* Technical Help & WhatsApp Support */}
          <div className="mt-6 text-center">
            <p className="text-xs text-slate-500 font-medium">
              Need assistance or login credentials?
            </p>
            <div className="mt-2 flex items-center justify-center gap-4 text-xs font-black">
              <a
                href="https://wa.me/923012616367?text=Assalam-o-Alaikum%2C%20I%20need%20help%20with%20EdgeX%20SMS%20Portal%20Login."
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#25D366] hover:underline flex items-center gap-1.5"
              >
                <WhatsAppIcon className="w-4 h-4 text-[#25D366]" /> WhatsApp Support (0301-2616367)
              </a>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
