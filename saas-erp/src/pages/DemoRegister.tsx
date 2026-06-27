import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, Phone, Mail, MapPin, Users, User, ChevronRight, CheckCircle, Sparkles, GraduationCap, BookOpen, Award, Check, Briefcase } from 'lucide-react';

const SCHOOL_TYPES = ['Primary School', 'Secondary School', 'Higher Secondary', 'College', 'Academy / Tuition Centre', 'Other'];
const CONTACT_ROLES = ['Principal', 'Admin / Manager', 'Owner / Director', 'IT Coordinator', 'Other'];
const HOW_HEARD = ['Google Search', 'Social Media', 'Friend / Colleague', 'Sales Team', 'Other'];

const STUDENT_RANGES = [
  { label: 'Under 100', value: '50' },
  { label: '100–300', value: '200' },
  { label: '300–600', value: '450' },
  { label: '600–1000', value: '800' },
  { label: '1000+', value: '1200' },
];

function Dot({ className = '' }) {
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${className}`} />;
}

export default function DemoRegister() {
  const [form, setForm] = useState({
    school_name: '',
    city: '',
    contact_phone: '',
    contact_email: '',
    school_type: '',
    approx_students: '',
    contact_person_name: '',
    contact_person_role: '',
    how_heard: '',
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.school_name.trim() || !form.contact_email.trim() || !form.contact_phone.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      // Check for duplicate email
      const { data: existing } = await supabase
        .from('demo_applications')
        .select('id')
        .eq('contact_email', form.contact_email.trim().toLowerCase())
        .maybeSingle();

      if (existing) {
        setError('An application with this email already exists. Our team will reach out to you soon.');
        setLoading(false);
        return;
      }

      const { error: insertErr } = await supabase.from('demo_applications').insert([{
        school_name: form.school_name.trim(),
        city: form.city.trim(),
        contact_phone: form.contact_phone.trim(),
        contact_email: form.contact_email.trim().toLowerCase(),
        school_type: form.school_type || null,
        approx_students: form.approx_students ? parseInt(form.approx_students) : null,
        contact_person_name: form.contact_person_name.trim(),
        contact_person_role: form.contact_person_role || null,
        how_heard: form.how_heard || null,
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

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex items-center justify-center p-6 select-none">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200/80 shadow-[0_8px_30px_rgba(0,0,0,0.03)] p-8 text-center animate-aura-in">
          <div className="w-16 h-16 bg-emerald-50 border border-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-9 h-9 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Application Submitted!</h1>
          <p className="text-slate-600 text-sm mb-4">
            Thank you, <span className="text-slate-900 font-semibold">{form.contact_person_name || 'there'}</span>!
          </p>
          <p className="text-slate-500 text-sm mb-6 leading-relaxed">
            We have received your demo request for <span className="text-slate-900 font-semibold">{form.school_name}</span>. 
            Our team will review your application and send your login credentials via WhatsApp within 24 hours.
          </p>
          <div className="bg-slate-50 rounded-xl p-5 text-start space-y-3.5 border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">What happens next?</p>
            {[
              { step: '1', text: 'Our team reviews your details' },
              { step: '2', text: 'Credentials sent to your WhatsApp number' },
              { step: '3', text: '60 days of full-access demo starts' },
            ].map(({ step, text }) => (
              <div key={step} className="flex items-center gap-3">
                <div className="w-5.5 h-5.5 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 text-[10px] font-black shrink-0">{step}</div>
                <span className="text-slate-600 text-xs font-medium">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50/30">
      {/* Left Column: Value Proposition & Branding (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[45%] relative bg-[#0a0f1d] overflow-hidden flex-col justify-between p-12 select-none border-r border-white/5">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.02]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        
        {/* Soft, top-left illumination */}
        <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />

        {/* Branding header */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/40">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm uppercase tracking-widest leading-none">EdgeX Suite</p>
              <p className="text-indigo-400/80 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">Management Portal</p>
            </div>
          </div>

          <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-tight mb-5 tracking-tight">
            Start your <br />
            <span className="text-indigo-400">free 60-day demo.</span>
          </h1>
          <p className="text-slate-400 text-base leading-relaxed max-w-md font-medium">
            Join other leading institutions using EdgeX to automate student management, class diaries, fees, examinations, and communication.
          </p>
        </div>

        {/* Features Checklist */}
        <div className="relative z-10 space-y-6 my-8 max-w-sm">
          {[
            { title: 'Full Feature Access', desc: 'No locked modules or restricted actions. Test the complete ERP.' },
            { title: 'No Credit Card Needed', desc: 'Start completely free. No payment details required during trial.' },
            { title: 'Multi-Portal Environment', desc: 'Separate customized views for parents, students, staff, and admins.' },
            { title: 'Activation within 24h', desc: 'We verify and configure your database setup in under one business day.' }
          ].map(f => (
            <div key={f.title} className="flex gap-4">
              <div className="w-5 h-5 rounded-full bg-indigo-500/15 border border-indigo-400/20 flex items-center justify-center text-indigo-300 shrink-0 mt-0.5">
                <Check className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-slate-200 text-sm font-bold tracking-tight">{f.title}</p>
                <p className="text-slate-400 text-xs mt-0.5 leading-relaxed font-medium">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer info */}
        <div className="relative z-10 flex items-center justify-between text-slate-500 text-[10px] font-bold uppercase tracking-widest pt-6 border-t border-white/[0.05]">
          <span>Request Workspace</span>
          <span>v2.4.0</span>
        </div>
      </div>

      {/* Right Column: Registration Card */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 lg:p-12 overflow-y-auto">
        <div className="w-full max-w-xl flex flex-col items-center">
          
          {/* Mobile branding header */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/20">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="block font-black text-slate-900 text-lg uppercase tracking-wider leading-none">EdgeX Suite</span>
              <span className="block text-indigo-600 text-[9px] font-bold uppercase tracking-[0.2em] mt-1">Management Portal</span>
            </div>
          </div>

          {/* Form Header */}
          <div className="mb-6 text-center lg:text-start w-full">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Request School Demo</h2>
            <p className="text-slate-500 mt-1.5 text-sm">Please fill in details about your institution to start your trial.</p>
          </div>

          <form onSubmit={handleSubmit} className="w-full space-y-6">
            {error && (
              <div className="bg-rose-50 border border-rose-100 text-rose-700 px-4 py-3 rounded-xl text-sm flex items-start gap-2.5 animate-fadeIn">
                <span className="shrink-0 mt-0.5">⚠️</span>
                <span className="leading-snug">{error}</span>
              </div>
            )}

            {/* Card 1: School Information */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-[0_4px_25px_rgba(0,0,0,0.015)] space-y-5 animate-aura-in">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <Building2 className="w-5 h-5 text-indigo-500" />
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">School Details</h3>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Tell us about your educational institution</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    School / Institution Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative group">
                    <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors duration-200" />
                    <input
                      required
                      type="text"
                      placeholder="e.g., The Bright Future Academy"
                      value={form.school_name}
                      onChange={e => set('school_name', e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all duration-200"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    City <span className="text-red-500">*</span>
                  </label>
                  <div className="relative group">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors duration-200" />
                    <input
                      required
                      type="text"
                      placeholder="e.g., Lahore"
                      value={form.city}
                      onChange={e => set('city', e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all duration-200"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    School Type
                  </label>
                  <div className="relative group">
                    <GraduationCap className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors duration-200" />
                    <select
                      value={form.school_type}
                      onChange={e => set('school_type', e.target.value)}
                      className="w-full pl-10 pr-10 py-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all duration-200 appearance-none cursor-pointer"
                    >
                      <option value="">-- Select type --</option>
                      {SCHOOL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors duration-200">
                      <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Number of Students */}
              <div className="space-y-3 pt-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Approx. Number of Students <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {STUDENT_RANGES.map(({ label, value }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => set('approx_students', value)}
                      className={`py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99] duration-150 ${
                        form.approx_students === value
                          ? 'bg-indigo-50/70 border-indigo-500 text-indigo-700 font-bold shadow-sm shadow-indigo-500/5'
                          : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Card 2: Contact Details */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-[0_4px_25px_rgba(0,0,0,0.015)] space-y-5 animate-aura-in">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <User className="w-5 h-5 text-indigo-500" />
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Primary Contact</h3>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Information for portal setup and communication</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative group">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors duration-200" />
                    <input
                      required
                      type="text"
                      placeholder="Your name"
                      value={form.contact_person_name}
                      onChange={e => set('contact_person_name', e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all duration-200"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Your Role
                  </label>
                  <div className="relative group">
                    <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors duration-200" />
                    <select
                      value={form.contact_person_role}
                      onChange={e => set('contact_person_role', e.target.value)}
                      className="w-full pl-10 pr-10 py-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all duration-200 appearance-none cursor-pointer"
                    >
                      <option value="">-- Your role --</option>
                      {CONTACT_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors duration-200">
                      <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    WhatsApp / Phone <span className="text-red-500">*</span>
                  </label>
                  <div className="relative group">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors duration-200" />
                    <input
                      required
                      type="tel"
                      placeholder="03XX-XXXXXXX"
                      value={form.contact_phone}
                      onChange={e => set('contact_phone', e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all duration-200"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative group">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors duration-200" />
                    <input
                      required
                      type="email"
                      placeholder="you@school.com"
                      value={form.contact_email}
                      onChange={e => set('contact_email', e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all duration-200"
                    />
                  </div>
                </div>
              </div>

              {/* How did you hear */}
              <div className="space-y-2 pt-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">How did you hear about us?</label>
                <div className="flex flex-wrap gap-2">
                  {HOW_HEARD.map(h => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => set('how_heard', h)}
                      className={`px-4 py-2.5 rounded-xl border text-xs font-semibold tracking-tight transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99] duration-150 ${
                        form.how_heard === h
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm'
                          : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="space-y-3.5 pt-2">
              <button
                type="submit"
                disabled={loading || !form.approx_students}
                className="group w-full flex items-center justify-center gap-2 py-4 bg-[#0d1526] hover:bg-[#16213a] active:bg-[#070b13] hover:shadow-[0_8px_25px_rgba(13,21,38,0.12)] active:scale-[0.99] text-white font-bold text-sm rounded-xl transition-all duration-200 cursor-pointer uppercase tracking-wider"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Submitting...
                  </>
                ) : (
                  <>
                    <span>Start My Free Demo</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
                  </>
                )}
              </button>
              <p className="text-center text-[11px] text-slate-400 font-semibold">No credit card required · 60-day full access · Activate via WhatsApp</p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
