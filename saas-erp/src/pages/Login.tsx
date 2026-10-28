import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { 
  Lock, Mail, User, Eye, EyeOff, ShieldCheck, 
  ArrowRight, Sparkles, Phone, CheckCircle2,
  Building2, Users, GraduationCap, Globe, Shield,
  Check, ChevronRight
} from 'lucide-react';

type LoginTab = 'staff' | 'parent' | 'student' | 'demo';

// Apple-inspired Minimalist EdgeX Vector Logo
const EdgeXLogo = ({ className = 'h-10 w-10' }: { className?: string }) => (
  <div className={`relative ${className} rounded-2xl bg-white border border-black/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] flex items-center justify-center shrink-0 overflow-hidden`}>
    <div className="absolute inset-0 bg-gradient-to-tr from-[#0071e3]/10 via-transparent to-sky-400/10 pointer-events-none" />
    <svg className="w-5 h-5 relative z-10" viewBox="0 0 32 32" fill="none">
      <path d="M6 9L16 4L26 9V23L16 28L6 23V9Z" stroke="#0071e3" strokeWidth="1.75" strokeOpacity="0.85"/>
      <path d="M10 11H22M10 16H18M10 21H22" stroke="#1d1d1f" strokeWidth="2.2" strokeLinecap="round"/>
      <circle cx="21.5" cy="16" r="2.2" fill="#0071e3" />
    </svg>
  </div>
);

// WhatsApp Vector Icon Component
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
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === 'true' || params.get('tab') === 'demo') {
      setActiveTab('demo');
      setIdentifier('demo@edgexsuite.com');
      setPassword('Demo@1234');
      return;
    }

    // Load remembered account
    const savedIdentifier = localStorage.getItem('edgex_remembered_identifier');
    const savedTab = localStorage.getItem('edgex_remembered_tab') as LoginTab | null;
    if (savedIdentifier) {
      setIdentifier(savedIdentifier);
      if (savedTab && ['staff', 'parent', 'student'].includes(savedTab)) {
        setActiveTab(savedTab);
      }
      setRememberMe(true);
    }
  }, []);

  const handleTabChange = (tab: LoginTab) => {
    setActiveTab(tab);
    setError(null);
    if (tab === 'demo') {
      setIdentifier('demo@edgexsuite.com');
      setPassword('Demo@1234');
    } else {
      const savedIdentifier = localStorage.getItem('edgex_remembered_identifier');
      const savedTab = localStorage.getItem('edgex_remembered_tab');
      if (savedIdentifier && savedTab === tab) {
        setIdentifier(savedIdentifier);
      } else {
        setIdentifier('');
      }
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

  const saveRememberedAccount = (idVal: string, tabVal: LoginTab) => {
    if (rememberMe && tabVal !== 'demo') {
      localStorage.setItem('edgex_remembered_identifier', idVal);
      localStorage.setItem('edgex_remembered_tab', tabVal);
    } else {
      localStorage.removeItem('edgex_remembered_identifier');
      localStorage.removeItem('edgex_remembered_tab');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      setError('Please enter both your identifier and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const input = identifier.trim();

      // 1. Admin & Staff Portal Login (Email or Phone / Username)
      if (activeTab === 'staff' || activeTab === 'demo' || (input.includes('@') && activeTab !== 'parent' && activeTab !== 'student')) {
        let authEmail = input;

        // If user typed a phone number or username (no @)
        if (!input.includes('@') && activeTab !== 'demo') {
          const cleanedPhone = input.replace(/[\s-]/g, '');

          // Check user_roles by username or login_email
          const { data: roleMatch } = await supabase
            .from('user_roles')
            .select('login_email, email')
            .or(`username.eq.${input},login_email.eq.${input}`)
            .limit(1)
            .maybeSingle();

          if (roleMatch?.login_email || roleMatch?.email) {
            authEmail = roleMatch.login_email || roleMatch.email;
          } else {
            // Check staff by mobile_number or whatsapp_number
            const { data: staffMatch } = await supabase
              .from('staff')
              .select('email, mobile_number, whatsapp_number')
              .or(`mobile_number.ilike.%${cleanedPhone}%,whatsapp_number.ilike.%${cleanedPhone}%`)
              .not('email', 'is', null)
              .limit(1)
              .maybeSingle();

            if (staffMatch?.email) {
              authEmail = staffMatch.email;
            }
          }
        }

        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password,
        });

        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            throw new Error('Incorrect Email, Mobile, or Password. Please check your credentials.');
          }
          throw error;
        }

        saveRememberedAccount(input, activeTab);
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
          saveRememberedAccount(input, 'parent');
          sessionStorage.setItem('parent_portal_session', JSON.stringify(parent));
          navigate('/parent-portal');
          return;
        }
        throw new Error('Invalid Family Number or password. Please verify your details.');
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
          saveRememberedAccount(input, 'student');
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
        saveRememberedAccount(input, 'parent');
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
        saveRememberedAccount(input, 'student');
        sessionStorage.setItem('student_portal_session', JSON.stringify(studentAuto));
        navigate('/student-portal');
        return;
      }

      throw new Error('Invalid credentials. Please verify your ID and password.');
    } catch (err: any) {
      const rawMsg = err?.message || '';
      if (rawMsg.toLowerCase().includes('failed to fetch') || rawMsg.toLowerCase().includes('network') || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        setError('Network connection lost. Please check your internet connection.');
      } else {
        setError(err.message || t('login.error') || 'Failed to authenticate.');
      }
    } finally {
      setLoading(false);
    }
  };

  const getIdentifierLabel = () => {
    switch (activeTab) {
      case 'staff':
        return 'Email, Username or Mobile';
      case 'parent':
        return 'Family Number or Parent ID';
      case 'student':
        return 'Student ID or Roll Number';
      case 'demo':
        return 'Demo Account Email';
    }
  };

  const getIdentifierPlaceholder = () => {
    switch (activeTab) {
      case 'staff':
        return 'admin@school.com or 0300-1234567';
      case 'parent':
        return 'e.g. FAM-104 or 31202-*******-1';
      case 'student':
        return 'e.g. STU-2026 or Roll Number';
      case 'demo':
        return 'demo@edgexsuite.com';
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#fbfbfd] text-[#1d1d1f] font-sans antialiased selection:bg-[#0071e3] selection:text-white relative overflow-x-hidden">
      
      {/* ── Apple-style Ambient Diffused Lighting ───────────────────────────── */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-gradient-to-br from-sky-200/30 via-indigo-100/20 to-transparent rounded-full blur-[140px] pointer-events-none -translate-y-1/2" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[400px] bg-gradient-to-tr from-blue-100/30 via-sky-100/20 to-transparent rounded-full blur-[140px] pointer-events-none translate-y-1/3" />

      {/* ── Minimalist Apple Navigation Bar ───────────────────────────────── */}
      <header className="relative z-30 w-full px-6 lg:px-12 py-4 flex items-center justify-between border-b border-black/[0.04] bg-white/70 backdrop-blur-xl">
        <Link to="/" className="flex items-center gap-3 group">
          <EdgeXLogo className="h-9 w-9 group-hover:scale-105 transition-transform duration-200" />
          <div className="flex flex-col">
            <span className="text-[#1d1d1f] font-semibold text-[17px] tracking-[-0.02em] leading-tight">
              EdgeX <span className="text-[#0071e3] font-normal">Digital</span>
            </span>
            <span className="text-[10px] text-[#86868b] tracking-wider uppercase font-medium">
              Campus Operating System
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          {/* Direct Portal Quick Links in Header for Desktop */}
          <div className="hidden sm:flex items-center gap-1 bg-black/[0.03] p-1 rounded-full border border-black/[0.04] text-[12px]">
            <Link
              to="/parent-portal"
              className="px-3 py-1 rounded-full text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-white/70 transition-all font-medium"
            >
              Parent Portal
            </Link>
            <Link
              to="/student-portal"
              className="px-3 py-1 rounded-full text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-white/70 transition-all font-medium"
            >
              Student Portal
            </Link>
          </div>

          {/* Language Switcher Button */}
          <button
            type="button"
            onClick={() => i18n.changeLanguage(i18n.language === 'en' ? 'ur' : 'en')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/80 hover:bg-white border border-black/[0.08] hover:border-black/[0.15] rounded-full text-[12px] font-medium text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-[#0071e3]" />
            <span>{i18n.language === 'en' ? 'اردو' : 'English'}</span>
          </button>
        </div>
      </header>

      {/* ── Main Content Area ─────────────────────────────────────────────────── */}
      <main className="relative z-20 flex-1 flex items-center justify-center p-4 sm:p-8 lg:p-12">
        <div className="w-full max-w-5xl mx-auto flex flex-col lg:flex-row items-center gap-10 lg:gap-14">
          
          {/* Left Column: Apple-style Product Showcase (Desktop) */}
          <div className="hidden lg:flex flex-col flex-1 max-w-lg select-none">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0071e3]/[0.07] border border-[#0071e3]/15 text-[#0071e3] text-[11px] font-semibold tracking-wide uppercase mb-4 self-start">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0071e3] animate-pulse" />
              Unified Campus Intelligence
            </div>

            <h1 className="text-4xl xl:text-[44px] font-semibold text-[#1d1d1f] tracking-[-0.035em] leading-[1.12] mb-4">
              The intelligence <br />
              behind exceptional <br />
              institutions.
            </h1>

            <p className="text-[#86868b] text-[15px] leading-relaxed tracking-[-0.01em] font-normal mb-8">
              Every student record, fee installment, biometric scan, and parent alert—connected in real time with the precision and grace of modern software.
            </p>

            {/* Apple Studio Display Mockup */}
            <div className="relative rounded-2xl p-2 bg-gradient-to-b from-white/90 via-white/80 to-[#f5f5f7]/90 border border-black/[0.07] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.03)] backdrop-blur-xl group">
              <div className="flex items-center justify-between px-3 py-2 border-b border-black/[0.04] mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]/85 border border-[#e0443e]/40" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]/85 border border-[#dea123]/40" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]/85 border border-[#1aab29]/40" />
                  <span className="ml-2 text-[11px] font-medium text-[#86868b] flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5 text-[#0071e3]" /> school.edgexsuite.com
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-[#0071e3] bg-[#0071e3]/[0.08] px-2 py-0.5 rounded-full">
                  Live Campus
                </span>
              </div>

              <div className="relative overflow-hidden rounded-xl border border-black/[0.04]">
                <img 
                  src="/assets/dashboard_preview.png" 
                  alt="EdgeX Digital Campus Suite Preview" 
                  className="w-full h-auto object-cover transition-transform duration-700 ease-out group-hover:scale-[1.015]"
                />
              </div>

              <div className="flex items-center justify-between px-3 pt-2 text-[11px] text-[#86868b] font-medium">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#34c759]" /> Multi-Tenant Encrypted
                </span>
                <span>Version 2.4 · 2026</span>
              </div>
            </div>

            {/* Apple-style Metric Tags */}
            <div className="grid grid-cols-3 gap-3 mt-6">
              {[
                { title: 'Zero Setup', desc: 'Runs in any modern browser' },
                { title: 'Instant Live', desc: 'Biometric & QR Sync' },
                { title: '99.98%', desc: 'Guaranteed cloud uptime' },
              ].map((m, i) => (
                <div key={i} className="p-3 rounded-xl bg-white/60 border border-black/[0.04] text-center">
                  <p className="text-[13px] font-semibold text-[#1d1d1f] tracking-tight">{m.title}</p>
                  <p className="text-[10px] text-[#86868b] mt-0.5 leading-tight">{m.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Apple-style Sign In Card */}
          <div className="w-full max-w-[420px]">
            <div className="bg-white/85 backdrop-blur-2xl rounded-[28px] sm:rounded-[32px] border border-black/[0.06] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)] p-7 sm:p-9 relative">
              
              {/* Header */}
              <div className="text-center mb-6">
                <h2 className="text-2xl sm:text-[26px] font-semibold text-[#1d1d1f] tracking-[-0.03em] leading-tight">
                  Sign In
                </h2>
                <p className="text-[#86868b] text-[13px] font-normal mt-1 tracking-[-0.01em]">
                  Use your credentials to access your campus portal.
                </p>
              </div>

              {/* Apple Segmented Control */}
              <div className="bg-[#000000]/[0.04] p-1 rounded-full flex items-center border border-black/[0.03] mb-4">
                {[
                  { key: 'staff', label: 'Staff', icon: Building2 },
                  { key: 'parent', label: 'Parent', icon: Users },
                  { key: 'student', label: 'Student', icon: GraduationCap },
                  { key: 'demo', label: 'Demo', icon: Sparkles },
                ].map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleTabChange(key as LoginTab)}
                    className={`flex-1 py-1.5 px-2 rounded-full text-[11px] font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      activeTab === key
                        ? 'bg-white text-[#1d1d1f] shadow-[0_2px_8px_rgba(0,0,0,0.08),0_0.5px_1px_rgba(0,0,0,0.04)] font-semibold'
                        : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${activeTab === key ? (key === 'demo' ? 'text-amber-500' : 'text-[#0071e3]') : 'opacity-70'}`} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              {/* Dynamic Role Hint */}
              <div className="mb-5 px-3.5 py-2 rounded-xl bg-black/[0.02] border border-black/[0.04] text-[11px] flex items-center gap-2">
                <span className="font-semibold text-[#0071e3] shrink-0">
                  {activeTab === 'staff' && 'Admin & Staff:'}
                  {activeTab === 'parent' && 'Parent Portal:'}
                  {activeTab === 'student' && 'Student Portal:'}
                  {activeTab === 'demo' && 'Sandbox Demo:'}
                </span>
                <span className="text-[#86868b] truncate leading-tight">
                  {activeTab === 'staff' && 'Owners, Principals, Accountants & Faculty.'}
                  {activeTab === 'parent' && 'Challans, Attendance & Grade Gazettes.'}
                  {activeTab === 'student' && 'Daily Diary, Timetable & Results.'}
                  {activeTab === 'demo' && 'Instant test drive of the complete ERP.'}
                </span>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 bg-[#ff3b30]/[0.08] border border-[#ff3b30]/20 text-[#d70015] px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-start gap-2">
                  <span className="text-sm leading-none shrink-0">⚠️</span>
                  <span className="leading-snug">{error}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleLogin} className="space-y-3.5">
                
                {/* Identifier Input */}
                <div>
                  <label className="block text-[11px] font-medium text-[#6e6e73] uppercase tracking-wider mb-1.5">
                    {getIdentifierLabel()}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#a1a1a6]">
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
                      className="w-full pl-10 pr-3.5 py-2.5 bg-[#fbfbfd] border border-[#d2d2d7]/80 rounded-xl text-[13px] font-normal text-[#1d1d1f] placeholder:text-[#a1a1a6] focus:bg-white focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/12 transition-all outline-none"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-medium text-[#6e6e73] uppercase tracking-wider">
                      Password
                    </label>
                    {activeTab === 'staff' && (
                      <Link
                        to="/reset-password"
                        className="text-[11px] font-medium text-[#0071e3] hover:underline"
                      >
                        Forgot?
                      </Link>
                    )}
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#a1a1a6]">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2.5 bg-[#fbfbfd] border border-[#d2d2d7]/80 rounded-xl text-[13px] font-normal text-[#1d1d1f] placeholder:text-[#a1a1a6] focus:bg-white focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/12 transition-all outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#a1a1a6] hover:text-[#6e6e73] transition-colors cursor-pointer"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me Toggle */}
                <div className="flex items-center justify-between text-xs pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer text-[#6e6e73] font-normal select-none hover:text-[#1d1d1f]">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-[#0071e3] border-[#d2d2d7] focus:ring-[#0071e3]"
                    />
                    <span>Remember account</span>
                  </label>
                  {activeTab === 'demo' && (
                    <span className="text-[11px] text-amber-600 font-medium">Demo Mode Active</span>
                  )}
                </div>

                {/* Apple Primary Action Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#0071e3] hover:bg-[#0077ed] active:bg-[#0062c4] text-white font-medium text-[13px] py-3 rounded-xl transition-all shadow-[0_2px_8px_rgba(0,113,227,0.25)] hover:shadow-[0_4px_16px_rgba(0,113,227,0.35)] disabled:opacity-50 flex items-center justify-center gap-2 mt-2 cursor-pointer active:scale-[0.99]"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In to {activeTab === 'demo' ? 'Demo Campus' : activeTab === 'staff' ? 'Admin / Staff' : activeTab === 'parent' ? 'Parent Portal' : 'Student Portal'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>

                {/* 1-Click Instant Demo Button (if not on demo tab) */}
                {activeTab !== 'demo' && (
                  <button
                    type="button"
                    onClick={handleDemoLogin}
                    disabled={loading}
                    className="w-full py-2 px-3 bg-black/[0.03] hover:bg-black/[0.06] text-[#1d1d1f] rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-black/[0.04]"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#0071e3]" />
                    <span>Explore as Guest (1-Click Demo)</span>
                  </button>
                )}
              </form>

              {/* Free Trial Banner */}
              <div className="mt-5 pt-4 border-t border-black/[0.04]">
                <Link
                  to="/trial"
                  className="w-full py-2.5 px-3.5 bg-gradient-to-r from-sky-50 to-indigo-50/70 hover:from-sky-100/70 hover:to-indigo-100/70 border border-sky-100 text-[#1d1d1f] rounded-xl flex items-center justify-between text-xs transition-all group"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[#0071e3] font-bold">🌟</span>
                    <div className="text-left">
                      <p className="font-semibold text-[#1d1d1f] leading-tight">New School? Free 30-Day Trial</p>
                      <p className="text-[10px] text-[#86868b]">Zero setup fee · Instant activation</p>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-[#0071e3] group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>

              {/* WhatsApp Technical Assistance */}
              <div className="mt-4 text-center">
                <a
                  href="https://wa.me/923012616367?text=Assalam-o-Alaikum%2C%20I%20need%20help%20with%20EdgeX%20SMS%20Portal%20Login."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#25D366] hover:underline"
                >
                  <WhatsAppIcon className="w-3.5 h-3.5 text-[#25D366]" />
                  <span>WhatsApp Support (0301-2616367)</span>
                </a>
              </div>

            </div>
          </div>

        </div>
      </main>

      {/* ── Apple-style Minimal Footer ────────────────────────────────────────── */}
      <footer className="relative z-20 w-full px-6 lg:px-12 py-3 border-t border-black/[0.04] bg-white/50 backdrop-blur-md text-[#86868b] text-[11px] flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span>© {new Date().getFullYear()} EdgeX Suite. All rights reserved.</span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">Crafted for modern institutions</span>
        </div>
        
        <div className="flex items-center gap-4 text-[#6e6e73]">
          <Link to="/parent-portal" className="hover:text-[#1d1d1f] transition-colors">Parents</Link>
          <Link to="/student-portal" className="hover:text-[#1d1d1f] transition-colors">Students</Link>
          <a href="tel:03012616367" className="hover:text-[#1d1d1f] transition-colors">Help: 0301-2616367</a>
        </div>
      </footer>

    </div>
  );
}
