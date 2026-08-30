import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  GraduationCap, QrCode, CreditCard, Users, ShieldCheck,
  FileSpreadsheet, Award, BookOpen, Clock, CheckCircle2,
  Phone, Mail, MapPin, Sparkles, ChevronRight, ArrowRight,
  Zap, Building2, User, Check, Star, Shield, Smartphone,
  Layers, BarChart3, Receipt, HeartHandshake, Eye, MessageCircle
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function TrialRegistration() {
  const [form, setForm] = useState({
    school_name: '',
    city: '',
    contact_person_name: '',
    contact_person_role: 'Principal',
    contact_phone: '',
    contact_email: '',
    school_type: 'Primary & Secondary School',
    approx_students: '300-600',
    notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'attendance' | 'fees' | 'substitution' | 'results' | 'gatepass' | 'planner'>('attendance');

  const setField = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.school_name.trim() || !form.contact_phone.trim() || !form.contact_email.trim() || !form.contact_person_name.trim()) {
      setError('Please fill in all required fields (School Name, Name, WhatsApp Phone, Email).');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Check existing email in demo_applications
      const { data: existing } = await supabase
        .from('demo_applications')
        .select('id')
        .eq('contact_email', form.contact_email.trim().toLowerCase())
        .maybeSingle();

      if (existing) {
        setError('A registration with this email already exists. Our team will contact you on WhatsApp shortly.');
        setLoading(false);
        return;
      }

      const { error: insertErr } = await supabase.from('demo_applications').insert([{
        school_name: form.school_name.trim(),
        city: form.city.trim(),
        contact_person_name: form.contact_person_name.trim(),
        contact_person_role: form.contact_person_role,
        contact_phone: form.contact_phone.trim(),
        contact_email: form.contact_email.trim().toLowerCase(),
        school_type: form.school_type,
        approx_students: parseInt(form.approx_students.replace(/\D/g, '')) || 300,
        how_heard: 'Website Free Trial Page',
        notes: form.notes.trim() || 'Requested 1-Month Free Trial',
        status: 'pending',
      }]);

      if (insertErr) throw insertErr;
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const scrollToForm = () => {
    document.getElementById('register-form-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* ── 1. Top Navigation Bar ────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-100">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-base font-black text-slate-900 uppercase tracking-tight font-display">EdgeX SMS</span>
              <span className="hidden sm:inline-block ml-2 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-black tracking-widest uppercase">
                Enterprise School ERP
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-8 text-xs font-bold text-slate-600">
            <a href="#features" className="hover:text-indigo-600 transition-colors">Features</a>
            <a href="#matrix" className="hover:text-indigo-600 transition-colors">Fee System</a>
            <a href="#substitution" className="hover:text-indigo-600 transition-colors">Substitution</a>
            <a href="#gatepass" className="hover:text-indigo-600 transition-colors">Gate Pass</a>
            <a href="#why-edgex" className="hover:text-indigo-600 transition-colors">Why EdgeX?</a>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://wa.me/923012616367?text=Assalam-o-Alaikum%2C%20I%20want%20to%20know%20more%20about%20EdgeX%20School%20Management%20System"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-600" />
              <span>0301-2616367</span>
            </a>
            <Link
              to="/login"
              className="px-3.5 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
            >
              Sign In
            </Link>
            <button
              onClick={scrollToForm}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-200 hover:shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              Start 1-Month Trial
            </button>
          </div>
        </div>
      </header>

      {/* ── 2. Hero Section ────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28">
        {/* Soft background ambient glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-indigo-200/40 via-violet-100/40 to-emerald-100/30 rounded-full blur-[90px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            
            {/* Top Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-indigo-50/80 border border-indigo-200/80 rounded-full shadow-xs">
              <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
              <span className="text-xs font-black text-indigo-900 uppercase tracking-widest">
                🌟 1-Month Free Trial Available for Schools
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.12]">
              The <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">Fastest & Smartest</span> ERP for Modern Schools
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-slate-600 font-medium leading-relaxed max-w-2xl mx-auto">
              Automate 100% of your institutional operations with sub-second speeds. Bank challans, 12-month fee matrix, live QR attendance, automated teacher substitution, exam gazettes, student gate passes, and instant WhatsApp parent updates.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={scrollToForm}
                className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm uppercase tracking-wider shadow-xl shadow-indigo-200 hover:shadow-indigo-300 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
              >
                Register for 1-Month Free Trial <ArrowRight className="w-4 h-4" />
              </button>
              <a
                href="https://wa.me/923012616367?text=Assalam-o-Alaikum%20EdgeX%20Team%2C%20I%20want%20to%20request%20a%20live%20walkthrough%20demo%20for%20my%20school."
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-6 py-3.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200/90 rounded-2xl font-bold text-sm shadow-xs transition-all flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4 text-emerald-600" /> Book WhatsApp Demo
              </a>
            </div>

            {/* Trust Highlights */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 max-w-3xl mx-auto text-left">
              {[
                { title: '⚡ Sub-Second Speed', desc: 'Zero lag or spinning wheels' },
                { title: '📱 WhatsApp Engine', desc: 'Direct parent alerts & slips' },
                { title: '💳 12-Month Matrix', desc: 'Zero fee defaults & leakage' },
                { title: '🔒 Bank Grade Data', desc: 'Secure cloud multi-backup' },
              ].map((item, i) => (
                <div key={i} className="bg-white/80 backdrop-blur-xs p-3 rounded-xl border border-slate-200/70 shadow-xs">
                  <p className="text-xs font-black text-slate-900">{item.title}</p>
                  <p className="text-[11px] text-slate-500 font-medium">{item.desc}</p>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ── 3. Interactive Feature Tabs Showcase ────────────────────────── */}
      <section id="features" className="py-16 bg-white border-y border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-10 space-y-2">
            <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">Built For Real School Needs</span>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Everything You Need To Run a Digital Campus</h2>
            <p className="text-sm text-slate-500 font-medium">Explore key modules purpose-built to eliminate paperwork and improve school profitability.</p>
          </div>

          {/* Feature Navigation Pills */}
          <div className="flex items-center justify-start sm:justify-center gap-2 overflow-x-auto pb-4 no-scrollbar">
            {[
              { id: 'attendance', label: '📷 QR Attendance Kiosk', icon: QrCode },
              { id: 'fees', label: '💳 Bank Challans & Matrix', icon: CreditCard },
              { id: 'substitution', label: '🔄 Teacher Substitution', icon: Users },
              { id: 'gatepass', label: '🎫 Student Gate Pass', icon: ShieldCheck },
              { id: 'results', label: '📊 Exam Gazettes & Cards', icon: Award },
              { id: 'planner', label: '📖 Lesson Planner', icon: BookOpen },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    'px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer',
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content Box */}
          <div className="mt-8 bg-slate-50/70 rounded-3xl border border-slate-200/80 p-6 sm:p-10 shadow-xs">
            {activeTab === 'attendance' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center">
                    <QrCode className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900">Live Camera QR Attendance for Students & Staff</h3>
                  <p className="text-sm text-slate-600 leading-relaxed font-medium">
                    Turn any laptop, tablet, or phone camera into an ultra-fast check-in terminal. Students and staff tap their digital ID card, hearing an instant confirmation beep with automatic SMS and WhatsApp alerts dispatched to parents.
                  </p>
                  <ul className="space-y-2.5 text-xs font-bold text-slate-700">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Automatic student & staff digital ID card auto-generation</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> 1-Click WhatsApp absent alert dispatch to parents</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> 31-Day Official Inspection Attendance Register (حاضری رجسٹر)</li>
                  </ul>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <span className="text-xs font-black uppercase text-slate-500">Live Scanner Terminal</span>
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-black rounded-full">ACTIVE CAMERA</span>
                  </div>
                  <div className="h-40 bg-slate-900 rounded-xl flex flex-col items-center justify-center text-white space-y-2 relative overflow-hidden">
                    <div className="w-24 h-24 border-2 border-dashed border-emerald-400 rounded-xl flex items-center justify-center animate-pulse">
                      <QrCode className="w-12 h-12 text-emerald-400" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-300">Point QR ID Card to Camera</span>
                  </div>
                  <p className="text-center text-[11px] font-bold text-slate-400">Scans 40+ students per minute without biometric machine jams.</p>
                </div>
              </div>
            )}

            {activeTab === 'fees' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-2xl flex items-center justify-center">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900">Multi-Copy Bank Challans & 12-Month Fee Matrix</h3>
                  <p className="text-sm text-slate-600 leading-relaxed font-medium">
                    Stop fee defaults completely. Generate 3-part bank deposit challans, Rapid EasyFee counters, full 12-month consolidated class registers, and aging arrears reports (1, 2-3, 3-6, 6+ months).
                  </p>
                  <ul className="space-y-2.5 text-xs font-bold text-slate-700">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-600" /> Bank Copy, School Copy, and Parent Copy custom vouchers</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-600" /> School-Wide 12-Month Matrix showing fee paid month-by-month</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-600" /> 1-Click WhatsApp fee reminders with balance breakdown</li>
                  </ul>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3 font-mono">
                  <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs text-indigo-900 space-y-1">
                    <p className="font-bold">BANK CHALLAN # CH-2026-0891</p>
                    <p className="text-[11px] font-normal text-indigo-700">Student: Muhammad Ali (Class 9-A, Roll #12)</p>
                    <p className="text-[11px] font-normal text-indigo-700">Tuition: Rs. 3,500 | Exam Fund: Rs. 500</p>
                    <p className="font-black text-sm text-indigo-950 pt-1">Total Payable: Rs. 4,000</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-sans font-bold">
                    <span className="p-2 bg-slate-100 rounded-lg">🏦 Bank Copy</span>
                    <span className="p-2 bg-slate-100 rounded-lg">🏫 School Copy</span>
                    <span className="p-2 bg-slate-100 rounded-lg">👪 Parent Copy</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'substitution' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="w-12 h-12 bg-purple-100 text-purple-700 rounded-2xl flex items-center justify-center">
                    <Users className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900">10-Second Morning Teacher Substitution Engine</h3>
                  <p className="text-sm text-slate-600 leading-relaxed font-medium">
                    Eliminate morning arrangement chaos. When teachers are absent, EdgeX automatically finds free teachers with zero classes at each vacant slot, auto-assigns substitutions, and generates printable noticeboard sheets and 4-up slips.
                  </p>
                  <ul className="space-y-2.5 text-xs font-bold text-slate-700">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-purple-600" /> Automatic vacant period detection from morning attendance</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-purple-600" /> 1-Click Auto-Assign free teacher matching algorithm</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-purple-600" /> 1-Click WhatsApp arrangement slips sent directly to teachers</li>
                  </ul>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2.5 text-xs">
                  <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-800 font-bold flex justify-between">
                    <span>Absent: Sir Tariq (Math)</span>
                    <span className="text-[10px] font-black uppercase">3 Vacant Periods</span>
                  </div>
                  <div className="p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 font-bold flex justify-between">
                    <span>Period 2 (Class 10-B): Assigned to Miss Ayesha</span>
                    <span className="text-[10px] font-black">FREE PERIOD MATCH</span>
                  </div>
                  <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-800 font-bold flex justify-between">
                    <span>Period 4 (Class 8-A): Assigned to Sir Bilal</span>
                    <span className="text-[10px] font-black">FREE PERIOD MATCH</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'gatepass' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900">Student Early Exit & Visitor Gate Pass System</h3>
                  <p className="text-sm text-slate-600 leading-relaxed font-medium">
                    Keep your campus completely secure. Issue authorized student departure slips with collector CNIC, phone number, relationship verification, and instant WhatsApp departure notifications to parents.
                  </p>
                  <ul className="space-y-2.5 text-xs font-bold text-slate-700">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-amber-600" /> Search student by Roll #, Name, or Class in real-time</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-amber-600" /> A5 Paper and 80mm/58mm Thermal Gate Receipt Printer support</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-amber-600" /> Searchable daily gate exit register with audit trail</li>
                  </ul>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2 text-xs font-mono">
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-1">
                    <p className="font-bold text-slate-900 text-center uppercase">OFFICIAL GATE PASS # GP-8291</p>
                    <div className="h-px bg-slate-200 my-1" />
                    <p className="text-[11px]">Student: Fatima Zahra (Class 6-Green)</p>
                    <p className="text-[11px]">Collector: Imran Khan (Father · 35202-xxxxxxx-1)</p>
                    <p className="text-[11px]">Reason: Medical Appointment</p>
                    <p className="text-[11px] font-bold text-emerald-700 pt-1">Authorized by: Principal Office</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'results' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="w-12 h-12 bg-rose-100 text-rose-700 rounded-2xl flex items-center justify-center">
                    <Award className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900">Multi-Board Result Gazettes & Report Cards</h3>
                  <p className="text-sm text-slate-600 leading-relaxed font-medium">
                    Compile terminal examinations with 1 click. Master tabulation gazettes, position rankings (1st, 2nd, 3rd), teacher award lists, roll number slips, and customizable report cards with grading keys.
                  </p>
                  <ul className="space-y-2.5 text-xs font-bold text-slate-700">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-rose-600" /> Board-compliant Master Tabulation Sheets (نتیجہ گزٹ)</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-rose-600" /> Multi-Template Report Card Designer with School Branding</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-rose-600" /> Formal School Leaving & Character Certificates</li>
                  </ul>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 font-bold">
                    <div className="flex justify-between text-indigo-900">
                      <span>🥇 1st: Zainab Bibi (96.4%)</span>
                      <span className="text-[10px] bg-indigo-100 px-2 py-0.5 rounded">GRADE A+</span>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>🥈 2nd: Abdullah Tariq (94.8%)</span>
                      <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded">GRADE A+</span>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>🥉 3rd: Usman Ghani (91.2%)</span>
                      <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded">GRADE A</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'planner' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-2xl flex items-center justify-center">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900">Curriculum, Diary & Lesson Planner</h3>
                  <p className="text-sm text-slate-600 leading-relaxed font-medium">
                    Empower teachers to plan weekly, 15-day, and monthly lessons with chapter targets, SLOs, classwork, homework, and quiz schedules. Incharges and Coordinators can review and print landscape master sheets.
                  </p>
                  <ul className="space-y-2.5 text-xs font-bold text-slate-700">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-600" /> Daily Digital Teacher Diary with direct parent broadcasting</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-600" /> Weekly / 15-Day / Monthly Lesson Plans with exact calendar dates</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-600" /> Landscape A4 PDF & Noticeboard printouts for coordinators</li>
                  </ul>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <p className="font-black text-indigo-900">UNIT 3: PHOTOSYNTHESIS & CELLULAR RESPIRATION</p>
                    <p className="text-[11px] text-slate-500 font-bold">Mon: Theory & Diagrams | Tue: Lab Activity | Wed: Chapter Quiz</p>
                    <p className="text-[10px] text-emerald-700 font-black pt-1">✓ Incharge Approved</p>
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>
      </section>

      {/* ── 4. Comparison Section ──────────────────────────────────────── */}
      <section id="why-edgex" className="py-16 bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
            <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">Why Schools Upgrade</span>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">How EdgeX SMS Compares to Conventional Portals</h2>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
            <div className="grid grid-cols-3 p-4 bg-slate-100/70 text-xs font-black uppercase text-slate-600 tracking-wider">
              <div>Feature Capability</div>
              <div className="text-center text-slate-400">Old School Software</div>
              <div className="text-center text-indigo-600">EdgeX SMS</div>
            </div>

            {[
              { feat: 'Page Load & Search Speed', old: 'Slow (3–6 seconds)', edgex: '⚡ Instant (< 0.3s)' },
              { feat: 'Parent Notifications', old: 'Expensive SMS gateway packages', edgex: '📱 Direct 1-Click WhatsApp' },
              { feat: 'Fee Reconciliation', old: 'Scattered registers & manual errors', edgex: '💳 12-Month Cross-Tab Matrix' },
              { feat: 'Morning Teacher Absence', old: 'Manual scrambles & shouting', edgex: '🔄 10-Second Auto-Assign Engine' },
              { feat: 'Student Gate Security', old: 'Paper chits & security lapses', edgex: '🎫 Digital CNIC Verified Gate Pass' },
              { feat: 'ID Card Production', old: 'Expensive external graphic designers', edgex: '🪪 Instant Auto-Generator (QR/Photo)' },
              { feat: 'Pricing & Server Costs', old: 'Heavy upfront & monthly charges', edgex: '🌟 1-Month Free Trial + Fair Pricing' },
            ].map((row, i) => (
              <div key={i} className="grid grid-cols-3 p-4 items-center text-xs font-bold">
                <div className="text-slate-800">{row.feat}</div>
                <div className="text-center text-slate-400 font-medium">{row.old}</div>
                <div className="text-center text-indigo-600 font-black">{row.edgex}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. Free Trial Registration Form ────────────────────────────── */}
      <section id="register-form-section" className="py-20 bg-white border-t border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="bg-gradient-to-br from-indigo-50 via-violet-50/40 to-white rounded-3xl border border-indigo-100 p-8 sm:p-12 shadow-xl shadow-indigo-50/50">
            
            {submitted ? (
              <div className="text-center py-10 space-y-4 animate-fade-in">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-md shadow-emerald-50">
                  <Check className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black text-slate-900">Application Received!</h3>
                <p className="text-sm text-slate-600 max-w-md mx-auto font-medium leading-relaxed">
                  Thank you, <span className="font-bold text-slate-900">{form.contact_person_name}</span>. Your 1-Month Free Trial request for <span className="font-bold text-slate-900">{form.school_name}</span> has been received.
                </p>
                <div className="bg-white p-5 rounded-2xl border border-indigo-100 max-w-md mx-auto text-left text-xs space-y-2">
                  <p className="font-black text-indigo-900 uppercase tracking-wide">What Happens Next?</p>
                  <p className="text-slate-600">1. Our technical support team reviews your campus details.</p>
                  <p className="text-slate-600">2. We provision your master login and send credentials to <strong className="text-slate-900">{form.contact_phone}</strong> via WhatsApp.</p>
                  <p className="text-slate-600">3. We assist with free initial student data import.</p>
                </div>
                <div className="pt-4">
                  <a
                    href={`https://wa.me/923012616367?text=Assalam-o-Alaikum%2C%20I%20just%20submitted%20a%201-Month%20Free%20Trial%20request%20for%20${encodeURIComponent(form.school_name)}.`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all"
                  >
                    <MessageCircle className="w-4 h-4" /> Message Us on WhatsApp for Instant Setup
                  </a>
                </div>
              </div>
            ) : (
              <div>
                <div className="text-center max-w-xl mx-auto mb-8 space-y-2">
                  <div className="inline-block px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-[10px] font-black tracking-widest uppercase">
                    30 Days Full Access
                  </div>
                  <h3 className="text-3xl font-black text-slate-900 tracking-tight">
                    Start Your 1-Month Free Trial
                  </h3>
                  <p className="text-xs text-slate-500 font-bold">
                    No credit card required. Instant account setup with free onboarding support.
                  </p>
                </div>

                {error && (
                  <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-bold">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-black uppercase text-slate-600 mb-1">
                        School / Institution Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={form.school_name}
                        onChange={e => setField('school_name', e.target.value)}
                        placeholder="e.g. The Edge Public High School"
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-black uppercase text-slate-600 mb-1">
                        City / Campus Location *
                      </label>
                      <input
                        type="text"
                        required
                        value={form.city}
                        onChange={e => setField('city', e.target.value)}
                        placeholder="e.g. Bahawalpur / Lahore / Karachi"
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-black uppercase text-slate-600 mb-1">
                        Your Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={form.contact_person_name}
                        onChange={e => setField('contact_person_name', e.target.value)}
                        placeholder="e.g. Muhammad Farooq"
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-black uppercase text-slate-600 mb-1">
                        Your Role / Designation
                      </label>
                      <select
                        value={form.contact_person_role}
                        onChange={e => setField('contact_person_role', e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
                      >
                        <option value="Principal">Principal</option>
                        <option value="School Owner / Director">School Owner / Director</option>
                        <option value="Vice Principal / Coordinator">Vice Principal / Coordinator</option>
                        <option value="Administrator">Administrator / Manager</option>
                        <option value="IT Incharge">IT Incharge</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-black uppercase text-slate-600 mb-1">
                        WhatsApp Mobile Number *
                      </label>
                      <input
                        type="text"
                        required
                        value={form.contact_phone}
                        onChange={e => setField('contact_phone', e.target.value)}
                        placeholder="0300-0000000 (For Login WhatsApp)"
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-black uppercase text-slate-600 mb-1">
                        Admin Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        value={form.contact_email}
                        onChange={e => setField('contact_email', e.target.value)}
                        placeholder="admin@school.com"
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-black uppercase text-slate-600 mb-1">
                        Institution Type
                      </label>
                      <select
                        value={form.school_type}
                        onChange={e => setField('school_type', e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
                      >
                        <option value="Primary & Secondary School">Primary & Secondary School</option>
                        <option value="Higher Secondary / Inter College">Higher Secondary / Inter College</option>
                        <option value="O/A-Levels Cambridge System">O/A-Levels Cambridge System</option>
                        <option value="Cadet / Boarding School">Cadet / Boarding School</option>
                        <option value="Academy / Tuition Network">Academy / Tuition Network</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-black uppercase text-slate-600 mb-1">
                        Approximate Students
                      </label>
                      <select
                        value={form.approx_students}
                        onChange={e => setField('approx_students', e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
                      >
                        <option value="Under 150">Under 150 Students</option>
                        <option value="150-300">150 to 300 Students</option>
                        <option value="300-600">300 to 600 Students</option>
                        <option value="600-1200">600 to 1,200 Students</option>
                        <option value="1200+">1,200+ Students</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-black uppercase text-slate-600 mb-1">
                      Special Requirements / Note (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={form.notes}
                      onChange={e => setField('notes', e.target.value)}
                      placeholder="e.g. We need help importing 400 students from Excel..."
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs resize-none"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer disabled:opacity-75"
                    >
                      {loading ? 'Activating 1-Month Trial...' : 'Activate 1-Month Free Trial Now'}
                    </button>
                    <p className="text-center text-[10px] font-bold text-slate-400 mt-2">
                      🔒 No payment details required. Immediate WhatsApp access.
                    </p>
                  </div>
                </form>
              </div>
            )}

          </div>

        </div>
      </section>

      {/* ── 6. Footer ──────────────────────────────────────────────────── */}
      <footer className="bg-slate-900 text-white py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-black text-sm uppercase tracking-wider">EdgeX School ERP</p>
                <p className="text-[11px] text-slate-400">Enterprise Digital Campus Suite</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs text-slate-400 font-bold">
              <a href="https://edgexsuite.com" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
                edgexsuite.com
              </a>
              <span>·</span>
              <a href="tel:03012616367" className="hover:text-white transition-colors">
                Direct Call: 0301-2616367
              </a>
              <span>·</span>
              <Link to="/login" className="hover:text-indigo-400 transition-colors">
                Staff Login
              </Link>
            </div>

            <p className="text-[11px] text-slate-500 font-medium">
              © {new Date().getFullYear()} EdgeX Suite. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
}
