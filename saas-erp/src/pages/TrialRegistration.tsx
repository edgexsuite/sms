import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

type DemoKey = 'attendance' | 'fees' | 'substitution' | 'gate' | 'exams' | 'lesson';

// Official WhatsApp Vector Icon Component
const WhatsAppIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
  </svg>
);

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

export default function TrialRegistration() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeDemo, setActiveDemo] = useState<DemoKey>('attendance');

  // Fee Demo Interactive Simulation State
  const [feeMonths, setFeeMonths] = useState([
    { name: 'JAN', paid: true },
    { name: 'FEB', paid: true },
    { name: 'MAR', paid: true },
    { name: 'APR', paid: true },
    { name: 'MAY', paid: false },
    { name: 'JUN', paid: true },
  ]);
  const [outstandingBalance, setOutstandingBalance] = useState('PKR 12,500');

  const simulatePayment = () => {
    setFeeMonths(prev => prev.map(m => ({ ...m, paid: true })));
    setOutstandingBalance('PKR 0 (Fully Cleared)');
  };

  // Form State for Supabase demo_applications
  const [form, setForm] = useState({
    school_name: '',
    city: '',
    contact_person_name: '',
    contact_person_role: 'Principal',
    contact_phone: '',
    contact_email: '',
    school_type: 'Primary & Secondary School',
    approx_students: 'Under 100 Students (Pre-School / Academy)',
    notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [whatsappLink, setWhatsappLink] = useState('');

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const switchDemo = (key: DemoKey) => {
    setActiveDemo(key);
    document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.school_name.trim() || !form.contact_phone.trim() || !form.contact_email.trim() || !form.contact_person_name.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    setError('');
    setLoading(true);

    const whatsappText = `Assalam-o-Alaikum / Hello EdgeX Digital Team,

I have submitted a request for the *1-Month Free Trial (30 Days Full Access)* of EdgeX School Management System (EdgeX SMS). Here are our institution details:

🏫 *School / Institution:* ${form.school_name.trim()}
📍 *City / Location:* ${form.city.trim()}
👤 *Contact Person:* ${form.contact_person_name.trim()} (${form.contact_person_role})
📱 *WhatsApp Mobile:* ${form.contact_phone.trim()}
✉️ *Admin Email:* ${form.contact_email.trim()}
🎓 *Institution Type:* ${form.school_type}
👥 *Approx. Students:* ${form.approx_students}
📝 *Special Notes:* ${form.notes.trim() || 'Please activate our 1-Month Free Access & assist with setup.'}

Please share our portal login credentials and onboarding guide. Thank you!`;

    const waUrl = `https://wa.me/923012616367?text=${encodeURIComponent(whatsappText)}`;
    setWhatsappLink(waUrl);

    try {
      // Check if registration already exists in demo_applications
      const { data: existing } = await supabase
        .from('demo_applications')
        .select('id')
        .eq('contact_email', form.contact_email.trim().toLowerCase())
        .maybeSingle();

      if (existing) {
        setError('A registration with this email already exists. Opening WhatsApp to connect directly.');
        window.open(waUrl, '_blank');
        setLoading(false);
        setSubmitted(true);
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
        approx_students: parseInt(form.approx_students.replace(/\D/g, '')) || 100,
        how_heard: 'Website 1-Month Free Trial Page',
        notes: form.notes.trim() || 'Requested 1-Month Free Trial (30 Days Full Access)',
        status: 'pending',
      }]);

      if (insertErr) throw insertErr;
      
      setSubmitted(true);
      // Automatically open WhatsApp with pre-filled lead details
      window.open(waUrl, '_blank');
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please reach out on WhatsApp at 0301-2616367.');
    } finally {
      setLoading(false);
    }
  };

  // Demo Metadata & Visual Components
  const demoData: Record<DemoKey, { title: string; heading: string; desc: string }> = {
    attendance: {
      title: 'QR Attendance Kiosk',
      heading: 'Live Camera QR Attendance for Students & Staff',
      desc: 'Turn any laptop, tablet, or phone camera into an ultra-fast check-in terminal. Sub-second scanning with instantaneous WhatsApp alerts to parents.',
    },
    fees: {
      title: 'Fee System',
      heading: 'Bank Challans & 12-Month Fee Matrix',
      desc: 'Replace scattered registers with one complete fee picture for every student, every month. Instant reconciliation, arrears tracking, and zero leakage.',
    },
    substitution: {
      title: 'Teacher Substitution',
      heading: 'Never Scramble for a Substitute Again.',
      desc: 'EdgeX instantly evaluates subject qualifications, daily availability, and workload before assigning the optimal substitute in under 10 seconds.',
    },
    gate: {
      title: 'Student Security',
      heading: 'Secure Student Gate Passes. Zero Paper Chits.',
      desc: 'Create, verify and authorize student exits digitally with a complete timestamped record of who collected the student, relationship, and CNIC.',
    },
    exams: {
      title: 'Examinations',
      heading: 'Exams, Gazettes & Report Cards. Automated.',
      desc: 'Turn raw marks into multi-board gazettes, class positions, GPA/grades, and print-ready single/multi-term consolidated report cards in one click.',
    },
    lesson: {
      title: 'Lesson Planner',
      heading: 'Plan Better. Teach Better.',
      desc: 'Give teachers and coordinators a structured workspace for weekly syllabus milestones, day-by-day topics, classwork, homework, and PDF schedules.',
    },
  };

  return (
    <div className="bg-white text-slate-900 font-sans antialiased selection:bg-[#087fe5] selection:text-white">
      
      {/* Custom Styles for Grid Background and Animations */}
      <style>{`
        html { scroll-behavior: smooth; }
        .gridbg {
          background-image: linear-gradient(rgba(8,127,229,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(8,127,229,.05) 1px, transparent 1px);
          background-size: 40px 40px;
        }
        .glass {
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
        }
        @keyframes floatAnim {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .animate-float {
          animation: floatAnim 5s ease-in-out infinite;
        }
        @keyframes scanAnim {
          0% { top: 12%; }
          50% { top: 82%; }
          100% { top: 12%; }
        }
        .animate-scan {
          animation: scanAnim 2.2s ease-in-out infinite;
        }
      `}</style>

      {/* ── Fixed Navigation Header ────────────────────────────────────────── */}
      <header className="fixed top-0 z-50 w-full transition-all duration-300">
        <div className="mx-auto max-w-7xl px-4">
          <nav
            className={`mt-3 flex h-16 items-center justify-between rounded-2xl border px-4 transition-all ${
              scrolled
                ? 'glass border-slate-200/80 shadow-lg'
                : 'border-slate-200/50 bg-white/85 backdrop-blur-md shadow-xs'
            }`}
          >
            <a href="#home" className="flex items-center gap-3 group">
              <EdgeXLogo />
              <div>
                <b className="text-lg tracking-tight text-slate-900 block leading-tight">
                  EdgeX <span className="text-[#087fe5]">Digital</span>
                </b>
                <small className="block text-[8px] font-black tracking-wider text-slate-400 uppercase">
                  ALL-IN-ONE DIGITAL CAMPUS OPERATING SYSTEM
                </small>
              </div>
            </a>

            <div className="hidden lg:flex gap-7 text-sm font-bold text-slate-600">
              <a href="#features" className="hover:text-[#087fe5] transition-colors">Features</a>
              <a href="#fees" className="hover:text-[#087fe5] transition-colors">Fee System</a>
              <a href="#substitution" className="hover:text-[#087fe5] transition-colors">Substitution</a>
              <a href="#gatepass" className="hover:text-[#087fe5] transition-colors">Gate Pass</a>
              <a href="#why" className="hover:text-[#087fe5] transition-colors">Why EdgeX?</a>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <a
                href="/login?demo=true"
                className="rounded-xl bg-slate-900 hover:bg-slate-800 px-4 py-2.5 text-white text-xs font-black shadow-sm transition-all flex items-center gap-1.5"
              >
                <span>⚡</span> Live Demo Login
              </a>
              <a href="tel:03012616367" className="font-bold text-slate-800 hover:text-[#087fe5] text-sm">
                0301-2616367
              </a>
              <a
                href="https://wa.me/923012616367?text=Hello%20EdgeX%20Digital%2C%20I%20want%20a%20demo%20of%20EdgeX%20SMS."
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Message EdgeX on WhatsApp"
                className="grid h-10 w-10 place-items-center rounded-xl bg-[#25D366] text-white hover:bg-[#20ba59] transition-all text-lg shadow-sm hover:scale-105"
                title="Chat on WhatsApp"
              >
                <WhatsAppIcon className="w-5 h-5 text-white" />
              </a>
              <a
                href="#trial"
                className="rounded-xl bg-[#087fe5] hover:bg-[#0770cb] px-5 py-2.5 text-white text-sm font-black shadow-md shadow-sky-200 transition-all hover:shadow-lg hover:-translate-y-0.5"
              >
                Start 1-Month Trial
              </a>
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden rounded-xl border border-slate-200 p-2 text-slate-700 hover:bg-slate-100"
              aria-label="Toggle Navigation Menu"
            >
              ☰
            </button>
          </nav>

          {/* Mobile Menu Dropdown */}
          {mobileMenuOpen && (
            <div className="glass mt-2 rounded-2xl border border-slate-200 p-4 shadow-xl lg:hidden">
              <div className="grid gap-2 text-sm font-bold text-slate-700">
                <a href="#features" onClick={() => setMobileMenuOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg">Features</a>
                <a href="#fees" onClick={() => setMobileMenuOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg">Fee System</a>
                <a href="#substitution" onClick={() => setMobileMenuOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg">Substitution</a>
                <a href="#gatepass" onClick={() => setMobileMenuOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg">Gate Pass</a>
                <a href="#why" onClick={() => setMobileMenuOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg">Why EdgeX?</a>
                <a
                  href="https://wa.me/923012616367?text=Hello%20EdgeX%20Digital%2C%20I%20want%20to%20know%20more%20about%20the%20EdgeX%20SMS%20School%20ERP."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl bg-[#25D366] text-white p-3 flex items-center justify-center gap-2 font-black shadow-sm"
                >
                  <WhatsAppIcon className="w-5 h-5" /> WhatsApp (0301-2616367)
                </a>
                <a
                  href="#trial"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-xl bg-[#087fe5] p-3 text-center font-black text-white shadow-md"
                >
                  Start Free Trial
                </a>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ── 1. Hero Section (Clean High-Contrast Typography) ────────────────── */}
      <section id="home" className="gridbg relative overflow-hidden pt-36 pb-24">
        {/* Subtle ambient blur placed safely outside the text flow */}
        <div className="absolute -left-60 -top-20 h-96 w-96 rounded-full bg-sky-100/30 blur-[130px] pointer-events-none z-0" />
        <div className="absolute -right-40 top-40 h-96 w-96 rounded-full bg-blue-100/25 blur-[130px] pointer-events-none z-0" />
        
        <div className="mx-auto max-w-7xl px-4 relative z-10">
          <div className="grid items-center gap-14 lg:grid-cols-[0.95fr_1.05fr]">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-white px-4 py-2 text-xs font-black text-[#087fe5] shadow-xs">
                🌟 1-Month Free Trial Available for Schools
              </span>
              
              <h1 className="mt-7 text-5xl font-black leading-[0.98] tracking-tight sm:text-6xl lg:text-7xl text-slate-900">
                The Fastest &amp; <span className="text-[#087fe5]">Smartest ERP</span>
                <br />
                for Modern Schools
              </h1>
              
              <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600 font-medium">
                Automate 100% of your institutional operations with sub-second speeds. Bank challans, 12-month fee matrix, live QR attendance, automated teacher substitution, exam gazettes, student gate passes, and instant WhatsApp parent updates.
              </p>
              
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="/login?demo=true"
                  className="rounded-xl bg-slate-950 hover:bg-slate-900 px-6 py-4 text-center font-extrabold text-white shadow-xl shadow-slate-900/10 transition-all hover:shadow-2xl hover:-translate-y-0.5 flex items-center justify-center gap-2"
                >
                  <span>⚡</span> Test Drive Demo Portal
                </a>
                <a
                  href="#trial"
                  className="rounded-xl bg-[#087fe5] hover:bg-[#0770cb] px-6 py-4 text-center font-extrabold text-white shadow-xl shadow-sky-200 transition-all hover:shadow-2xl hover:-translate-y-0.5"
                >
                  Register 1-Month Free Trial →
                </a>
                <a
                  href="https://wa.me/923012616367?text=Hello%20EdgeX%20Digital%2C%20I%20want%20a%20live%20demo%20of%20EdgeX%20SMS."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-6 py-4 text-center font-extrabold text-slate-800 transition-all shadow-xs flex items-center justify-center gap-2"
                >
                  <WhatsAppIcon className="w-5 h-5 text-[#25D366]" /> WhatsApp Demo
                </a>
              </div>
              
              <div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
                  <span className="text-xl">⚡</span>
                  <strong className="mt-2 block text-xs font-black text-slate-900">Sub-Second Speed</strong>
                  <small className="text-slate-400 font-bold">Zero lag</small>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
                  <WhatsAppIcon className="w-5 h-5 text-[#25D366]" />
                  <strong className="mt-2 block text-xs font-black text-slate-900">WhatsApp Engine</strong>
                  <small className="text-slate-400 font-bold">Direct alerts</small>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
                  <span className="text-xl">💳</span>
                  <strong className="mt-2 block text-xs font-black text-slate-900">12-Month Matrix</strong>
                  <small className="text-slate-400 font-bold">Zero leakage</small>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
                  <span className="text-xl">🔒</span>
                  <strong className="mt-2 block text-xs font-black text-slate-900">Bank Grade Data</strong>
                  <small className="text-slate-400 font-bold">Cloud backup</small>
                </div>
              </div>
            </div>

            {/* Live Interactive Floating Dashboard Preview */}
            <div className="relative">
              <div className="animate-float relative rounded-[28px] border border-slate-200 bg-white p-3 shadow-2xl">
                <div className="rounded-[22px] border border-slate-200/80 bg-slate-50 p-4">
                  
                  {/* Top Bar */}
                  <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                    <b className="text-sm font-black text-slate-900">
                      EdgeX SMS <span className="text-[#087fe5]">• Dashboard</span>
                    </b>
                    <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[10px] font-black text-emerald-700 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE
                    </span>
                  </div>

                  {/* 4 Stat Cards */}
                  <div className="grid gap-3 pt-4 sm:grid-cols-4">
                    <div className="rounded-xl bg-white p-3.5 border border-slate-100 shadow-xs">
                      <small className="text-[10px] font-bold text-slate-400 uppercase">Total Students</small>
                      <b className="block text-xl font-black text-slate-900">2,458</b>
                      <i className="text-[10px] not-italic font-black text-emerald-600">↑ 12.5%</i>
                    </div>
                    <div className="rounded-xl bg-white p-3.5 border border-slate-100 shadow-xs">
                      <small className="text-[10px] font-bold text-slate-400 uppercase">Attendance</small>
                      <b className="block text-xl font-black text-slate-900">92.4%</b>
                      <i className="text-[10px] not-italic font-black text-emerald-600">↑ 6.2%</i>
                    </div>
                    <div className="rounded-xl bg-white p-3.5 border border-slate-100 shadow-xs">
                      <small className="text-[10px] font-bold text-slate-400 uppercase">Fee Collection</small>
                      <b className="block text-xl font-black text-slate-900">18.7M</b>
                      <i className="text-[10px] not-italic font-black text-emerald-600">PKR</i>
                    </div>
                    <div className="rounded-xl bg-white p-3.5 border border-slate-100 shadow-xs">
                      <small className="text-[10px] font-bold text-slate-400 uppercase">Teachers</small>
                      <b className="block text-xl font-black text-slate-900">128</b>
                      <i className="text-[10px] not-italic font-black text-emerald-600">Active</i>
                    </div>
                  </div>

                  {/* Trends & Quick Actions */}
                  <div className="mt-3 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
                    <div className="rounded-xl bg-white p-4 border border-slate-100 shadow-xs">
                      <div className="flex justify-between items-center">
                        <small className="text-xs font-bold text-slate-500">Fee Collection Trend</small>
                        <b className="text-xs font-black text-emerald-600">PKR 18.7M</b>
                      </div>
                      <div className="mt-4 flex h-32 items-end gap-2">
                        <div className="flex-1 rounded-t bg-sky-200 transition-all hover:bg-sky-400" style={{ height: '35%' }} />
                        <div className="flex-1 rounded-t bg-sky-400 transition-all hover:bg-sky-500" style={{ height: '48%' }} />
                        <div className="flex-1 rounded-t bg-sky-200 transition-all hover:bg-sky-400" style={{ height: '43%' }} />
                        <div className="flex-1 rounded-t bg-sky-400 transition-all hover:bg-sky-500" style={{ height: '62%' }} />
                        <div className="flex-1 rounded-t bg-sky-200 transition-all hover:bg-sky-400" style={{ height: '57%' }} />
                        <div className="flex-1 rounded-t bg-sky-400 transition-all hover:bg-sky-500" style={{ height: '76%' }} />
                        <div className="flex-1 rounded-t bg-sky-200 transition-all hover:bg-sky-400" style={{ height: '68%' }} />
                        <div className="flex-1 rounded-t bg-sky-500 transition-all" style={{ height: '91%' }} />
                      </div>
                    </div>

                    <div className="rounded-xl bg-white p-4 border border-slate-100 shadow-xs">
                      <small className="text-xs font-bold text-slate-500">Quick Actions</small>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold">
                        <button className="rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 p-3 transition-colors text-left">
                          + Add Student
                        </button>
                        <button className="rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 p-3 transition-colors text-left">
                          ✓ Attendance
                        </button>
                        <button className="rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-800 p-3 transition-colors text-left">
                          💳 Collect Fee
                        </button>
                        <button className="rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 p-3 transition-colors text-left">
                          📢 Send Notice
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div className="mt-3 rounded-xl bg-white p-3 border border-slate-100 shadow-xs text-xs font-bold">
                    <b className="text-slate-800 text-[11px] block mb-2">Recent Campus Activity</b>
                    <div className="grid gap-2 sm:grid-cols-3 text-[11px] font-semibold text-slate-600">
                      <span className="rounded-lg bg-slate-50 p-2 border border-slate-100">💳 Fee received · just now</span>
                      <span className="rounded-lg bg-slate-50 p-2 border border-slate-100">📷 Attendance synced · 2m</span>
                      <span className="rounded-lg bg-slate-50 p-2 border border-slate-100">🎫 Gate pass verified · 5m</span>
                    </div>
                  </div>

                </div>
              </div>

              {/* Floating Alert Pill */}
              <div className="glass absolute -bottom-6 -left-5 rounded-2xl border border-slate-200/80 p-4 shadow-xl text-xs font-black text-slate-900 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-sm">
                  <WhatsAppIcon className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-emerald-700 font-black">WhatsApp Alert Sent</span>
                  <span className="block font-medium text-slate-500 text-[11px]">Parent notification delivered in 0.2s</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 2. Built for Real School Needs (Feature Cards Grid) ────────────── */}
      <section id="features" className="bg-slate-50 py-24 border-y border-slate-200/60">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <small className="font-black uppercase tracking-[0.2em] text-[#087fe5]">
              Built For Real School Needs
            </small>
            <h2 className="mt-3 text-4xl font-black sm:text-5xl text-slate-900">
              Everything You Need To Run a Digital Campus
            </h2>
            <p className="mt-4 text-slate-600 font-medium">
              Purpose-built modules designed to eliminate paperwork, improve visibility and strengthen school profitability.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            
            {/* Card 1 */}
            <button
              onClick={() => switchDemo('attendance')}
              className="rounded-3xl border border-slate-200/80 bg-white p-6 text-left shadow-sm transition-all hover:-translate-y-2 hover:border-sky-300 hover:shadow-xl group"
            >
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-50 text-2xl group-hover:scale-110 transition-transform">
                📷
              </div>
              <h3 className="mt-5 font-black text-lg text-slate-900">QR Attendance Kiosk</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500 font-medium">
                Live camera attendance for students &amp; staff with automatic WhatsApp departure/arrival slips.
              </p>
              <span className="mt-5 block text-sm font-black text-[#087fe5]">See live demo →</span>
            </button>

            {/* Card 2 */}
            <button
              onClick={() => switchDemo('fees')}
              className="rounded-3xl border border-slate-200/80 bg-white p-6 text-left shadow-sm transition-all hover:-translate-y-2 hover:border-sky-300 hover:shadow-xl group"
            >
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-50 text-2xl group-hover:scale-110 transition-transform">
                💳
              </div>
              <h3 className="mt-5 font-black text-lg text-slate-900">Bank Challans &amp; Matrix</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500 font-medium">
                3-part/4-part custom challans, 12-month cross-tab matrix, and zero fee leakages.
              </p>
              <span className="mt-5 block text-sm font-black text-[#087fe5]">See live demo →</span>
            </button>

            {/* Card 3 */}
            <button
              onClick={() => switchDemo('substitution')}
              className="rounded-3xl border border-slate-200/80 bg-white p-6 text-left shadow-sm transition-all hover:-translate-y-2 hover:border-sky-300 hover:shadow-xl group"
            >
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-50 text-2xl group-hover:scale-110 transition-transform">
                🔄
              </div>
              <h3 className="mt-5 font-black text-lg text-slate-900">Teacher Substitution</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500 font-medium">
                10-second automatic assignment of best available free substitute teachers with instant WhatsApp slips.
              </p>
              <span className="mt-5 block text-sm font-black text-[#087fe5]">See live demo →</span>
            </button>

            {/* Card 4 */}
            <button
              onClick={() => switchDemo('gate')}
              className="rounded-3xl border border-slate-200/80 bg-white p-6 text-left shadow-sm transition-all hover:-translate-y-2 hover:border-sky-300 hover:shadow-xl group"
            >
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-50 text-2xl group-hover:scale-110 transition-transform">
                🎫
              </div>
              <h3 className="mt-5 font-black text-lg text-slate-900">Student Gate Pass</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500 font-medium">
                Digital CNIC-verified student exits, QR authorization, and instant parent security alerts.
              </p>
              <span className="mt-5 block text-sm font-black text-[#087fe5]">See live demo →</span>
            </button>

            {/* Card 5 */}
            <button
              onClick={() => switchDemo('exams')}
              className="rounded-3xl border border-slate-200/80 bg-white p-6 text-left shadow-sm transition-all hover:-translate-y-2 hover:border-sky-300 hover:shadow-xl group"
            >
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-50 text-2xl group-hover:scale-110 transition-transform">
                📊
              </div>
              <h3 className="mt-5 font-black text-lg text-slate-900">Exam Gazettes &amp; Cards</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500 font-medium">
                Multi-board grading, class gazettes, auto-calculated positions, and single/multi-term report cards.
              </p>
              <span className="mt-5 block text-sm font-black text-[#087fe5]">See live demo →</span>
            </button>

            {/* Card 6 */}
            <button
              onClick={() => switchDemo('lesson')}
              className="rounded-3xl border border-slate-200/80 bg-white p-6 text-left shadow-sm transition-all hover:-translate-y-2 hover:border-sky-300 hover:shadow-xl group"
            >
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-50 text-2xl group-hover:scale-110 transition-transform">
                📖
              </div>
              <h3 className="mt-5 font-black text-lg text-slate-900">Lesson Planner</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500 font-medium">
                Structured teacher lesson workspace with weekly/monthly milestones, daily topics, and landscape PDF export.
              </p>
              <span className="mt-5 block text-sm font-black text-[#087fe5]">See live demo →</span>
            </button>

          </div>
        </div>
      </section>

      {/* ── 3. Interactive Live Simulation Sandbox ─────────────────────────── */}
      <section id="demo" className="py-24">
        <div className="mx-auto max-w-7xl px-4">
          <div className="text-center">
            <small className="font-black uppercase tracking-[0.2em] text-[#087fe5]">
              See EdgeX SMS In Action
            </small>
            <h2 className="mt-3 text-4xl font-black sm:text-5xl text-slate-900">
              Don't Just Read About It. Experience It.
            </h2>
          </div>

          <div className="mt-10 overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-2xl">
            
            {/* Demo Tabs Bar */}
            <div className="flex gap-2 overflow-x-auto border-b border-slate-200 p-3 bg-slate-50/70">
              <button
                onClick={() => setActiveDemo('attendance')}
                className={`shrink-0 rounded-xl px-5 py-3 text-sm font-black transition-all ${
                  activeDemo === 'attendance'
                    ? 'bg-[#087fe5] text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                📷 Attendance
              </button>
              <button
                onClick={() => setActiveDemo('fees')}
                className={`shrink-0 rounded-xl px-5 py-3 text-sm font-black transition-all ${
                  activeDemo === 'fees'
                    ? 'bg-[#087fe5] text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                💳 Fees
              </button>
              <button
                onClick={() => setActiveDemo('substitution')}
                className={`shrink-0 rounded-xl px-5 py-3 text-sm font-black transition-all ${
                  activeDemo === 'substitution'
                    ? 'bg-[#087fe5] text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                🔄 Substitution
              </button>
              <button
                onClick={() => setActiveDemo('gate')}
                className={`shrink-0 rounded-xl px-5 py-3 text-sm font-black transition-all ${
                  activeDemo === 'gate'
                    ? 'bg-[#087fe5] text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                🎫 Gate Pass
              </button>
              <button
                onClick={() => setActiveDemo('exams')}
                className={`shrink-0 rounded-xl px-5 py-3 text-sm font-black transition-all ${
                  activeDemo === 'exams'
                    ? 'bg-[#087fe5] text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                📊 Exams
              </button>
              <button
                onClick={() => setActiveDemo('lesson')}
                className={`shrink-0 rounded-xl px-5 py-3 text-sm font-black transition-all ${
                  activeDemo === 'lesson'
                    ? 'bg-[#087fe5] text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                📖 Lesson
              </button>
            </div>

            {/* Demo Body Grid */}
            <div className="grid gap-10 bg-slate-50 p-6 sm:p-10 lg:grid-cols-[0.85fr_1.15fr] lg:p-14 items-center">
              
              {/* Left Column: Description */}
              <div>
                <small className="font-black uppercase tracking-widest text-[#087fe5]">
                  {demoData[activeDemo].title}
                </small>
                <h3 className="mt-3 text-3xl font-black sm:text-4xl text-slate-900">
                  {demoData[activeDemo].heading}
                </h3>
                <p className="mt-4 leading-7 text-slate-600 font-medium">
                  {demoData[activeDemo].desc}
                </p>
                <a
                  href="#trial"
                  className="mt-6 inline-block rounded-xl bg-[#087fe5] hover:bg-[#0770cb] px-5 py-3 text-sm font-black text-white shadow-md transition-all hover:shadow-lg"
                >
                  Activate 1-Month Free Access →
                </a>
              </div>

              {/* Right Column: Live Interactive Sandbox Widget */}
              <div>
                
                {/* 1. Attendance Sandbox */}
                {activeDemo === 'attendance' && (
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl">
                    <div className="flex justify-between items-center text-xs">
                      <b className="font-black text-slate-900">LIVE SCANNER TERMINAL</b>
                      <span className="font-black text-emerald-600 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> ● ACTIVE
                      </span>
                    </div>
                    <div className="relative mx-auto mt-5 grid h-64 max-w-md place-items-center overflow-hidden rounded-2xl bg-slate-950">
                      <div className="animate-scan absolute left-10 right-10 h-px bg-sky-400 shadow-[0_0_20px_#38bdf8]" />
                      <span className="text-6xl text-white">▦</span>
                      <small className="absolute bottom-4 text-xs font-bold text-slate-400">Position Digital QR Code in front of camera</small>
                    </div>
                    <div className="mt-4 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-slate-900">
                      <b className="font-black text-emerald-800">✓ Attendance Marked (0.18s)</b>
                      <p className="text-xs text-slate-600 font-bold mt-0.5">Ali Raza · Class 7-A · 08:14 AM</p>
                      <div className="mt-2 rounded-lg bg-white p-2.5 text-xs font-black text-emerald-700 border border-emerald-100 flex items-center gap-2">
                        <WhatsAppIcon className="w-4 h-4 text-[#25D366]" /> WhatsApp Parent Alert · Delivered ✓
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Fees Sandbox */}
                {activeDemo === 'fees' && (
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl">
                    <div className="flex justify-between items-center">
                      <b className="font-black text-slate-900 text-sm">12-MONTH FEE MATRIX</b>
                      <button
                        onClick={simulatePayment}
                        className="rounded-lg bg-[#087fe5] hover:bg-[#0770cb] px-3.5 py-2 text-xs font-black text-white shadow-sm transition-all"
                      >
                        ⚡ Simulate Payment
                      </button>
                    </div>
                    <div className="mt-5 grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {feeMonths.map((m, idx) => (
                        <div
                          key={idx}
                          className={`rounded-xl p-3 text-center text-xs font-black transition-all ${
                            m.paid
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse'
                          }`}
                        >
                          {m.name}
                          <br />
                          {m.paid ? '✓ PAID' : '! DUE'}
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 rounded-2xl bg-slate-50 border border-slate-200 p-4">
                      <small className="text-xs font-bold text-slate-500 uppercase">Outstanding Balance</small>
                      <b className="block text-2xl font-black text-slate-900 mt-1">{outstandingBalance}</b>
                    </div>
                  </div>
                )}

                {/* 3. Substitution Sandbox */}
                {activeDemo === 'substitution' && (
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl">
                    <b className="font-black text-slate-900 text-sm">SMART TIMETABLE &amp; AUTO-ASSIGN</b>
                    <div className="mt-5 rounded-2xl bg-slate-50 border border-slate-200 p-5">
                      <div className="flex justify-between items-center">
                        <div>
                          <small className="text-[10px] font-bold text-slate-400 uppercase">08:00 AM · CLASS 7-A</small>
                          <b className="block text-sm font-black text-slate-900">Mathematics</b>
                        </div>
                        <span className="rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-1 text-xs font-black text-rose-600">
                          TEACHER ABSENT
                        </span>
                      </div>
                      <div className="my-5 text-center text-xs font-black text-[#087fe5] tracking-wider uppercase">
                        ⚡ AI ANALYZING 128 FACULTY SCHEDULES...
                      </div>
                      <div className="space-y-2">
                        <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs font-bold text-slate-400">
                          Mr. Ahmed · Busy in Class 9-B
                        </div>
                        <div className="rounded-xl border border-sky-300 bg-sky-50 p-3 text-xs font-black text-[#087fe5] shadow-xs">
                          ✓ Ms. Sara · Best Match (Free Period · Math Specialist)
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs font-bold text-slate-400">
                          Mr. Bilal · Time Conflict
                        </div>
                      </div>
                      <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-center text-xs font-black text-emerald-700 flex items-center justify-center gap-1.5">
                        <WhatsAppIcon className="w-4 h-4 text-[#25D366]" /> SUBSTITUTION ASSIGNED · 10 SECONDS · WHATSAPP DISPATCHED
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Gate Pass Sandbox */}
                {activeDemo === 'gate' && (
                  <div className="rounded-3xl bg-[#071b34] p-6 text-white shadow-xl">
                    <div className="flex justify-between items-center border-b border-white/10 pb-4">
                      <div>
                        <small className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">DIGITAL GATE PASS</small>
                        <h3 className="text-2xl font-black text-white">Ali Raza</h3>
                        <span className="text-xs text-sky-300 font-bold">Class 7-A · Roll #14</span>
                      </div>
                      <span className="rounded-xl bg-white p-3 text-2xl text-black">▦</span>
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-4 text-xs font-medium text-slate-300">
                      <div>Collector<br /><b className="text-white text-sm">Muhammad Farooq</b></div>
                      <div>Relation<br /><b className="text-white text-sm">Father</b></div>
                      <div>CNIC<br /><b className="text-white text-sm">31202-*******-1</b></div>
                      <div>Reason<br /><b className="text-white text-sm">Medical Appointment</b></div>
                    </div>
                    <div className="mt-6 rounded-xl bg-emerald-400/10 border border-emerald-400/30 p-4 text-center font-black text-emerald-300">
                      ✓ GATE PASS APPROVED &amp; STAMPED
                    </div>
                    <div className="mt-3 text-center text-xs font-bold text-slate-400 flex items-center justify-center gap-1.5">
                      <WhatsAppIcon className="w-4 h-4 text-[#25D366]" /> Parent Notification Sent via WhatsApp
                    </div>
                  </div>
                )}

                {/* 5. Exams Sandbox */}
                {activeDemo === 'exams' && (
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl">
                    <b className="font-black text-slate-900 text-sm">EXAM RESULT PROCESSOR</b>
                    <table className="mt-4 w-full text-xs font-semibold">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-slate-400 uppercase text-[10px]">
                          <th className="p-2.5">Subject</th>
                          <th className="p-2.5">Marks</th>
                          <th className="p-2.5">Grade</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-100">
                          <td className="p-2.5 font-black text-slate-800">English</td>
                          <td className="p-2.5">92/100</td>
                          <td className="p-2.5 font-black text-emerald-600">A+</td>
                        </tr>
                        <tr className="border-b border-slate-100">
                          <td className="p-2.5 font-black text-slate-800">Mathematics</td>
                          <td className="p-2.5">88/100</td>
                          <td className="p-2.5 font-black text-emerald-600">A</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-black text-slate-800">Science</td>
                          <td className="p-2.5">94/100</td>
                          <td className="p-2.5 font-black text-emerald-600">A+</td>
                        </tr>
                      </tbody>
                    </table>
                    <div className="mt-4 rounded-xl bg-sky-50 border border-sky-200 p-3 text-center font-black text-[#087fe5] text-xs">
                      ✓ 1-Click Printable Gazette &amp; Report Card Generated
                    </div>
                  </div>
                )}

                {/* 6. Lesson Planner Sandbox */}
                {activeDemo === 'lesson' && (
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl">
                    <b className="font-black text-slate-900 text-sm">TEACHER LESSON PLANNER</b>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      <div className="rounded-xl border border-slate-200 p-3 text-xs bg-slate-50">
                        <small className="text-[10px] font-bold text-slate-400">08:00 AM</small>
                        <b className="block font-black text-slate-800 mt-0.5">Mathematics</b>
                        <span className="text-[10px] text-slate-500">Class 7-A</span>
                      </div>
                      <div className="rounded-xl border border-sky-300 bg-sky-50 p-3 text-xs shadow-xs">
                        <small className="text-[10px] font-bold text-[#087fe5]">09:00 AM</small>
                        <b className="block font-black text-slate-800 mt-0.5">Science</b>
                        <span className="text-[10px] text-slate-500">Class 8-B</span>
                      </div>
                      <div className="rounded-xl border border-slate-200 p-3 text-xs bg-slate-50">
                        <small className="text-[10px] font-bold text-slate-400">10:00 AM</small>
                        <b className="block font-black text-slate-800 mt-0.5">English</b>
                        <span className="text-[10px] text-slate-500">Class 6-A</span>
                      </div>
                    </div>
                    <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-200 p-4">
                      <b className="text-xs font-black text-slate-900">Today's Lesson: Fractions &amp; Decimals</b>
                      <div className="mt-3 space-y-1.5 text-xs font-semibold text-slate-600">
                        <div className="rounded-lg bg-white p-2 border border-slate-100">✓ Learning objectives &amp; SLOs defined</div>
                        <div className="rounded-lg bg-white p-2 border border-slate-100">✓ Classwork &amp; board activity ready</div>
                        <div className="rounded-lg bg-white p-2 border border-slate-100">✓ Homework &amp; quiz assigned</div>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 4. Deep-Dive Section: QR Attendance ────────────────────────────── */}
      <section className="bg-[#071b34] py-24 text-white">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <small className="font-black uppercase tracking-[0.2em] text-sky-300">QR Attendance</small>
              <h2 className="mt-3 text-4xl font-black sm:text-5xl leading-tight">
                Attendance that moves at the speed of your school.
              </h2>
              <p className="mt-5 leading-8 text-slate-300 font-medium">
                Use any laptop, tablet or phone camera. Scan digital IDs in under a second and automatically dispatch attendance WhatsApp alerts to parents. Zero hardware cost.
              </p>
            </div>

            <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur-sm shadow-2xl">
              <div className="rounded-3xl bg-black p-8">
                <div className="flex justify-between items-center text-xs font-bold">
                  <b>LIVE SCANNER TERMINAL</b>
                  <span className="text-emerald-300">● ACTIVE CAMERA</span>
                </div>
                <div className="relative mx-auto mt-7 grid h-64 max-w-sm place-items-center overflow-hidden rounded-3xl border border-sky-400/30">
                  <div className="animate-scan absolute left-8 right-8 h-px bg-sky-400 shadow-[0_0_20px_#38bdf8]" />
                  <div className="text-center">
                    <div className="text-6xl">▦</div>
                    <b className="mt-2 block text-xs text-slate-300">Point QR ID Card to Camera</b>
                  </div>
                </div>
                <div className="mt-5 rounded-2xl bg-white p-4 text-slate-900">
                  <b>✓ Attendance Marked</b>
                  <span className="float-right text-xs font-black text-emerald-600">PRESENT</span>
                  <small className="mt-1 block text-slate-500 font-semibold">Ali Raza · Class 7-A · 08:14 AM</small>
                  <div className="mt-3 rounded-lg bg-slate-50 p-2.5 text-xs font-black text-emerald-700 flex items-center gap-2">
                    <WhatsAppIcon className="w-4 h-4 text-[#25D366]" /> WhatsApp Parent Alert · Delivered ✓
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 5. Deep-Dive Section: Bank Challans & 12-Month Matrix ───────────── */}
      <section id="fees" className="py-24">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            
            <div className="order-2 lg:order-1 rounded-[32px] border border-slate-200 bg-slate-50 p-5 shadow-xl">
              <div className="rounded-2xl bg-white p-6 border border-slate-200">
                <div className="flex justify-between items-center">
                  <b className="font-black text-slate-900">12-MONTH FEE MATRIX</b>
                  <span className="text-emerald-600 font-black text-xs">92.8% Collected</span>
                </div>
                <div className="mt-5 grid grid-cols-3 sm:grid-cols-6 gap-2">
                  <div className="rounded-xl p-3 text-center text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">JAN<br />✓</div>
                  <div className="rounded-xl p-3 text-center text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">FEB<br />✓</div>
                  <div className="rounded-xl p-3 text-center text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">MAR<br />✓</div>
                  <div className="rounded-xl p-3 text-center text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">APR<br />✓</div>
                  <div className="rounded-xl p-3 text-center text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">MAY<br />!</div>
                  <div className="rounded-xl p-3 text-center text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">JUN<br />✓</div>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                    <small className="text-[10px] font-bold text-slate-400 uppercase">Collection</small>
                    <b className="block font-black text-slate-900 mt-0.5">PKR 3.58M</b>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                    <small className="text-[10px] font-bold text-slate-400 uppercase">Outstanding</small>
                    <b className="block font-black text-slate-900 mt-0.5">PKR 0.42M</b>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                    <small className="text-[10px] font-bold text-slate-400 uppercase">Challans</small>
                    <b className="block font-black text-slate-900 mt-0.5">1,892</b>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <small className="font-black uppercase tracking-[0.2em] text-[#087fe5]">Fee System</small>
              <h2 className="mt-3 text-4xl font-black sm:text-5xl text-slate-900 leading-tight">
                Bank Challans. 12-Month Matrix. Zero Leakage.
              </h2>
              <p className="mt-5 leading-8 text-slate-600 font-medium">
                Replace scattered registers and manual reconciliation with one complete fee picture for every student, every month.
              </p>
              <div className="mt-7 space-y-2.5 text-sm font-bold text-slate-700">
                <div className="flex items-center gap-2 text-emerald-600">✓ <span className="text-slate-800">3-Part &amp; 4-Part Bank Challan Generation</span></div>
                <div className="flex items-center gap-2 text-emerald-600">✓ <span className="text-slate-800">12-Month Cross-Tab Fee Matrix</span></div>
                <div className="flex items-center gap-2 text-emerald-600">✓ <span className="text-slate-800">Arrears &amp; Defaulter Visibility</span></div>
                <div className="flex items-center gap-2 text-emerald-600">✓ <span className="text-slate-800">Real-Time Daily Collection Analytics</span></div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 6. Deep-Dive Section: Teacher Substitution ─────────────────────── */}
      <section id="substitution" className="bg-sky-50/50 py-24 border-y border-slate-200/60">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <div>
              <small className="font-black uppercase tracking-[0.2em] text-[#087fe5]">Teacher Substitution</small>
              <h2 className="mt-3 text-4xl font-black sm:text-5xl text-slate-900 leading-tight">
                Never Scramble for a Substitute Again.
              </h2>
              <p className="mt-5 leading-8 text-slate-600 font-medium">
                EdgeX evaluates teacher subject competence, availability, and daily workload before automatically assigning the best match in seconds.
              </p>
              <div className="mt-8 inline-flex items-center gap-2 rounded-2xl border border-sky-200 bg-white p-5 font-black text-slate-900 shadow-sm">
                <WhatsAppIcon className="w-5 h-5 text-[#25D366]" /> 10-Second Auto-Assign Engine with WhatsApp Slips
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-xl">
              <b className="font-black text-slate-900 text-sm">SMART TIMETABLE</b>
              <div className="mt-5 rounded-2xl bg-slate-50 border border-slate-200 p-5">
                <div className="flex justify-between items-center">
                  <div>
                    <small className="text-[10px] font-bold text-slate-400 uppercase">08:00 AM · CLASS 7-A</small>
                    <b className="block font-black text-slate-900">Mathematics</b>
                  </div>
                  <span className="rounded bg-rose-50 border border-rose-200 px-3 py-1 text-xs font-black text-rose-600">
                    ABSENT
                  </span>
                </div>
                <div className="my-5 text-center text-xs font-black text-[#087fe5]">
                  ANALYZING AVAILABILITY...
                </div>
                <div className="space-y-2">
                  <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs font-bold text-slate-400">
                    Mr. Ahmed · Busy
                  </div>
                  <div className="rounded-xl border border-sky-300 bg-sky-50 p-3 text-xs font-black text-[#087fe5]">
                    ✓ Ms. Sara · Best Match
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs font-bold text-slate-400">
                    Mr. Bilal · Conflict
                  </div>
                </div>
                <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-center text-xs font-black text-emerald-700 flex items-center justify-center gap-1.5">
                  <WhatsAppIcon className="w-4 h-4 text-[#25D366]" /> SUBSTITUTION ASSIGNED · 10 SECONDS
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 7. Deep-Dive Section: Student Gate Pass ────────────────────────── */}
      <section id="gatepass" className="py-24">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            
            <div className="order-2 lg:order-1 rounded-[32px] bg-[#071b34] p-6 text-white shadow-2xl">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="flex justify-between items-center border-b border-white/10 pb-4">
                  <div>
                    <small className="text-slate-400 text-xs font-bold uppercase tracking-widest">DIGITAL GATE PASS</small>
                    <b className="block text-2xl font-black text-white mt-1">Ali Raza</b>
                  </div>
                  <span className="rounded-xl bg-white p-3 text-3xl text-black">▦</span>
                </div>
                <div className="mt-7 grid grid-cols-2 gap-4 text-xs font-medium text-slate-300">
                  <div>Collector<br /><b className="text-white text-sm">Muhammad Farooq</b></div>
                  <div>Relation<br /><b className="text-white text-sm">Father</b></div>
                  <div>CNIC<br /><b className="text-white text-sm">31202-*******-1</b></div>
                  <div>Reason<br /><b className="text-white text-sm">Medical Appointment</b></div>
                </div>
                <div className="mt-7 rounded-xl bg-emerald-400/10 border border-emerald-400/30 p-4 text-center font-black text-emerald-300">
                  ✓ GATE PASS APPROVED
                </div>
                <div className="mt-3 text-center text-xs text-slate-300 font-bold flex items-center justify-center gap-1.5">
                  <WhatsAppIcon className="w-4 h-4 text-[#25D366]" /> Parent Notification Sent via WhatsApp
                </div>
              </div>
            </div>

            <div>
              <small className="font-black uppercase tracking-[0.2em] text-[#087fe5]">Student Security</small>
              <h2 className="mt-3 text-4xl font-black sm:text-5xl text-slate-900 leading-tight">
                Secure Student Gate Passes. Zero Paper Chits.
              </h2>
              <p className="mt-5 leading-8 text-slate-600 font-medium">
                Create, verify and authorize student exits digitally with a complete record of who collected the student, guardian CNIC verification, and immediate parent confirmation.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ── 8. Comparison Table: Why EdgeX SMS ─────────────────────────────── */}
      <section id="why" className="bg-slate-50 py-24 border-y border-slate-200/60">
        <div className="mx-auto max-w-7xl px-4">
          <div className="text-center">
            <small className="font-black uppercase tracking-[0.2em] text-[#087fe5]">
              Why Schools Upgrade
            </small>
            <h2 className="mt-3 text-4xl font-black sm:text-5xl text-slate-900">
              How EdgeX SMS Compares to Conventional Portals
            </h2>
          </div>

          <div className="mt-10 overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-xl">
            <table className="min-w-[780px] w-full text-sm">
              <thead className="bg-[#071b34] text-left text-white font-black">
                <tr>
                  <th className="p-5">Feature Capability</th>
                  <th className="p-5 text-slate-400">Old School Software</th>
                  <th className="p-5 text-sky-300">EdgeX SMS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="p-5 font-black text-slate-900">Page Load &amp; Search Speed</td>
                  <td className="p-5 text-slate-500 font-medium">Slow (3–6 seconds)</td>
                  <td className="p-5 font-black text-[#087fe5]">⚡ Instant (&lt; 0.3s)</td>
                </tr>
                <tr>
                  <td className="p-5 font-black text-slate-900">Parent Notifications</td>
                  <td className="p-5 text-slate-500 font-medium">Expensive SMS gateway packages</td>
                  <td className="p-5 font-black text-[#087fe5] flex items-center gap-1.5">
                    <WhatsAppIcon className="w-4 h-4 text-[#25D366]" /> Direct 1-Click WhatsApp
                  </td>
                </tr>
                <tr>
                  <td className="p-5 font-black text-slate-900">Fee Reconciliation</td>
                  <td className="p-5 text-slate-500 font-medium">Scattered registers &amp; manual errors</td>
                  <td className="p-5 font-black text-[#087fe5]">💳 12-Month Cross-Tab Matrix</td>
                </tr>
                <tr>
                  <td className="p-5 font-black text-slate-900">Morning Teacher Absence</td>
                  <td className="p-5 text-slate-500 font-medium">Manual scrambles &amp; shouting</td>
                  <td className="p-5 font-black text-[#087fe5]">🔄 10-Second Auto-Assign Engine</td>
                </tr>
                <tr>
                  <td className="p-5 font-black text-slate-900">Student Gate Security</td>
                  <td className="p-5 text-slate-500 font-medium">Paper chits &amp; security lapses</td>
                  <td className="p-5 font-black text-[#087fe5]">🎫 Digital CNIC Verified Gate Pass</td>
                </tr>
                <tr>
                  <td className="p-5 font-black text-slate-900">ID Card Production</td>
                  <td className="p-5 text-slate-500 font-medium">External graphic designers</td>
                  <td className="p-5 font-black text-[#087fe5]">🪪 Instant Auto-Generator</td>
                </tr>
                <tr>
                  <td className="p-5 font-black text-slate-900">Pricing &amp; Server Costs</td>
                  <td className="p-5 text-slate-500 font-medium">Heavy upfront &amp; monthly charges</td>
                  <td className="p-5 font-black text-[#087fe5]">🌟 1-Month Free Trial + Fair Pricing</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── 9. Registration Form: 1-Month Free Trial ──────────────────────── */}
      <section id="trial" className="bg-[#071b34] py-24">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] items-center">
            
            {/* Form Intro */}
            <div className="text-white">
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-sky-300">
                30 Days Full Access
              </span>
              <h2 className="mt-7 text-4xl font-black sm:text-6xl text-white leading-tight">
                Start Your 1-Month Free Trial
              </h2>
              <p className="mt-5 leading-8 text-slate-300 font-medium">
                No credit card required. Instant account setup with free onboarding support, WhatsApp setup, and Excel data import assistance.
              </p>
              <div className="mt-8 space-y-3 text-sm font-semibold text-slate-300">
                <div className="flex items-center gap-2">✓ Full ERP feature suite unlocked</div>
                <div className="flex items-center gap-2">✓ Free student &amp; staff data migration</div>
                <div className="flex items-center gap-2">✓ Dedicated WhatsApp technical support</div>
              </div>
            </div>

            {/* Form Card */}
            <div className="rounded-[32px] bg-white p-6 sm:p-8 shadow-2xl">
              {!submitted ? (
                <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
                  
                  {error && (
                    <div className="sm:col-span-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-black text-rose-700">
                      {error}
                    </div>
                  )}

                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    School / Institution Name *
                    <input
                      type="text"
                      placeholder="e.g. The Edge Public High School"
                      required
                      value={form.school_name}
                      onChange={e => setForm(f => ({ ...f, school_name: e.target.value }))}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-medium text-slate-900 outline-none focus:border-[#087fe5] focus:ring-2 focus:ring-sky-100"
                    />
                  </label>

                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    City / Campus Location *
                    <input
                      type="text"
                      placeholder="e.g. Bahawalpur / Lahore / Karachi"
                      required
                      value={form.city}
                      onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-medium text-slate-900 outline-none focus:border-[#087fe5] focus:ring-2 focus:ring-sky-100"
                    />
                  </label>

                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    Your Full Name *
                    <input
                      type="text"
                      placeholder="e.g. Muhammad Farooq"
                      required
                      value={form.contact_person_name}
                      onChange={e => setForm(f => ({ ...f, contact_person_name: e.target.value }))}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-medium text-slate-900 outline-none focus:border-[#087fe5] focus:ring-2 focus:ring-sky-100"
                    />
                  </label>

                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    Your Role / Designation
                    <select
                      value={form.contact_person_role}
                      onChange={e => setForm(f => ({ ...f, contact_person_role: e.target.value }))}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-medium text-slate-900 outline-none focus:border-[#087fe5] focus:ring-2 focus:ring-sky-100"
                    >
                      <option>Principal</option>
                      <option>Director</option>
                      <option>Administrator</option>
                      <option>Accountant</option>
                      <option>Coordinator</option>
                      <option>Other</option>
                    </select>
                  </label>

                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    WhatsApp Mobile Number *
                    <input
                      type="tel"
                      placeholder="0300-0000000"
                      required
                      value={form.contact_phone}
                      onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-medium text-slate-900 outline-none focus:border-[#087fe5] focus:ring-2 focus:ring-sky-100"
                    />
                  </label>

                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    Admin Email Address *
                    <input
                      type="email"
                      placeholder="admin@school.com"
                      required
                      value={form.contact_email}
                      onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-medium text-slate-900 outline-none focus:border-[#087fe5] focus:ring-2 focus:ring-sky-100"
                    />
                  </label>

                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    Institution Type
                    <select
                      value={form.school_type}
                      onChange={e => setForm(f => ({ ...f, school_type: e.target.value }))}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-medium text-slate-900 outline-none focus:border-[#087fe5] focus:ring-2 focus:ring-sky-100"
                    >
                      <option>Primary &amp; Secondary School</option>
                      <option>Primary School</option>
                      <option>Secondary School</option>
                      <option>College / Academy</option>
                    </select>
                  </label>

                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    Approximate Students
                    <select
                      value={form.approx_students}
                      onChange={e => setForm(f => ({ ...f, approx_students: e.target.value }))}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-medium text-slate-900 outline-none focus:border-[#087fe5] focus:ring-2 focus:ring-sky-100 font-bold"
                    >
                      <option>Under 100 Students (Pre-School / Academy)</option>
                      <option>100 to 300 Students</option>
                      <option>300 to 600 Students</option>
                      <option>600 to 1,000 Students</option>
                      <option>1,000+ Students (Multi-Branch / College)</option>
                    </select>
                  </label>

                  <label className="sm:col-span-2 text-xs font-black text-slate-700 uppercase tracking-wider">
                    Special Requirements / Note (Optional)
                    <textarea
                      rows={3}
                      placeholder="e.g. We need help importing students from Excel..."
                      value={form.notes}
                      onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-medium text-slate-900 outline-none focus:border-[#087fe5] focus:ring-2 focus:ring-sky-100"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={loading}
                    className="sm:col-span-2 rounded-xl bg-[#087fe5] hover:bg-[#0770cb] px-6 py-4 font-black text-white shadow-xl shadow-sky-200 transition-all hover:shadow-2xl hover:-translate-y-0.5 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <WhatsAppIcon className="w-5 h-5 text-white" />
                    {loading ? 'Activating 1-Month Free Trial...' : 'Activate 1-Month Free Trial Now →'}
                  </button>

                  <p className="sm:col-span-2 text-center text-xs text-slate-400 font-bold">
                    🔒 No payment details required. Instant WhatsApp credentials delivery.
                  </p>
                </form>
              ) : (
                <div className="py-14 text-center">
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-[#25D366] text-3xl shadow-xs">
                    <WhatsAppIcon className="w-8 h-8" />
                  </div>
                  <h3 className="mt-5 text-2xl font-black text-slate-900">
                    1-Month Free Trial Activated!
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 font-medium max-w-md mx-auto">
                    Thank you, <b>{form.contact_person_name}</b>. Your school <b>{form.school_name}</b> has been registered. We have sent the request details to WhatsApp.
                  </p>
                  <a
                    href={whatsappLink || `https://wa.me/923012616367?text=Hello%20EdgeX%20Digital%2C%20I%20just%20registered%20for%20a%201-Month%20Free%20Trial%20for%20${encodeURIComponent(form.school_name)}.`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#25D366] hover:bg-[#20ba59] px-6 py-3.5 font-black text-white shadow-lg shadow-emerald-200"
                  >
                    <WhatsAppIcon className="w-5 h-5" /> Open WhatsApp Chat (0301-2616367)
                  </a>
                </div>
              )}
            </div>

          </div>
        </div>
      </section>

      {/* ── 10. Call to Action Banner ──────────────────────────────────────── */}
      <section className="py-20 text-center">
        <div className="mx-auto max-w-3xl px-4">
          <small className="font-black uppercase tracking-[0.2em] text-[#087fe5]">
            Enterprise Digital Campus Suite
          </small>
          <h2 className="mt-4 text-4xl font-black sm:text-6xl text-slate-900">
            Ready to Run Your School Smarter?
          </h2>
          <p className="mt-5 text-slate-600 font-medium text-lg">
            Join modern schools using EdgeX SMS to automate operations, improve visibility and connect their entire campus.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a
              href="#trial"
              className="rounded-xl bg-[#087fe5] hover:bg-[#0770cb] px-7 py-4 font-black text-white shadow-xl shadow-sky-200 transition-all hover:shadow-2xl"
            >
              Start 1-Month Free Trial
            </a>
            <a
              href="https://wa.me/923012616367?text=Hello%20EdgeX%20Digital%2C%20I%20want%20to%20book%20a%20demo%20of%20EdgeX%20SMS."
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-7 py-4 font-black text-slate-800 transition-all shadow-xs flex items-center justify-center gap-2"
            >
              <WhatsAppIcon className="w-5 h-5 text-[#25D366]" /> Book WhatsApp Demo
            </a>
          </div>
          <b className="mt-7 block text-slate-800 text-base">Direct Helpline: 0301-2616367</b>
        </div>
      </section>

      {/* ── 11. Footer ─────────────────────────────────────────────────────── */}
      <footer className="bg-[#071b34] py-12 text-slate-400">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-2.5">
                <EdgeXLogo className="h-9 w-9" />
                <b className="text-xl text-white">EdgeX <span className="text-sky-400">Digital</span></b>
              </div>
              <p className="mt-3 text-slate-300 text-sm">EdgeX School ERP</p>
              <small className="text-slate-400 text-xs font-semibold">ALL-IN-ONE DIGITAL CAMPUS OPERATING SYSTEM</small>
            </div>
            <div>
              <b className="text-white text-sm uppercase tracking-wider">Product</b>
              <div className="mt-4 grid gap-2 text-sm font-semibold">
                <a href="#features" className="hover:text-white transition-colors">Features</a>
                <a href="#fees" className="hover:text-white transition-colors">Fee System</a>
                <a href="#substitution" className="hover:text-white transition-colors">Substitution</a>
              </div>
            </div>
            <div>
              <b className="text-white text-sm uppercase tracking-wider">Company</b>
              <div className="mt-4 grid gap-2 text-sm font-semibold">
                <a href="#why" className="hover:text-white transition-colors">Why EdgeX?</a>
                <a href="#trial" className="hover:text-white transition-colors">Start Trial</a>
                <a href="https://edgexsuite.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">edgexsuite.com</a>
              </div>
            </div>
            <div>
              <b className="text-white text-sm uppercase tracking-wider">Contact</b>
              <div className="mt-4 grid gap-2 text-sm font-semibold">
                <a href="tel:03012616367" className="hover:text-white transition-colors">Direct Call: 0301-2616367</a>
                <a href="https://wa.me/923012616367" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <WhatsAppIcon className="w-4 h-4 text-[#25D366]" /> WhatsApp Demo
                </a>
                <a href="/login" className="hover:text-white transition-colors">Staff / Admin Login</a>
              </div>
            </div>
          </div>
          <div className="mt-10 border-t border-white/10 pt-6 text-xs text-slate-400 text-center sm:text-left">
            © {new Date().getFullYear()} EdgeX Digital. All rights reserved. (Contact: 0301-2616367 | edgexsuite.com)
          </div>
        </div>
      </footer>

    </div>
  );
}
