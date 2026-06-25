import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, Phone, Mail, MapPin, Users, User, ChevronRight, CheckCircle, Sparkles, GraduationCap, BookOpen, Award } from 'lucide-react';

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
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-violet-950 flex items-center justify-center p-4">
        <div className="max-w-lg w-full text-center">
          <div className="w-20 h-20 bg-emerald-400/20 border-2 border-emerald-400/40 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_60px_rgba(52,211,153,0.3)]">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-black text-white mb-3">Application Submitted!</h1>
          <p className="text-slate-300 text-lg mb-2">
            Thank you, <span className="text-white font-bold">{form.contact_person_name || 'there'}</span>!
          </p>
          <p className="text-slate-400 mb-8 leading-relaxed">
            We've received your demo request for <span className="text-white font-semibold">{form.school_name}</span>. 
            Our team will review your application and send your login credentials via WhatsApp within 24 hours.
          </p>
          <div className="bg-white/[0.05] border border-white/10 rounded-2xl p-5 text-left space-y-3">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">What happens next?</p>
            {[
              { step: '1', text: 'Our team reviews your application' },
              { step: '2', text: 'You receive login credentials on WhatsApp' },
              { step: '3', text: '60 days of full-access demo — completely free' },
            ].map(({ step, text }) => (
              <div key={step} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-indigo-500/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300 text-xs font-black shrink-0">{step}</div>
                <span className="text-slate-300 text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-violet-950">
      {/* Hero header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.15),transparent_70%)]" />
        <div className="max-w-2xl mx-auto px-4 pt-14 pb-10 text-center relative z-10">
          {/* Logo mark */}
          <div className="inline-flex items-center gap-2 bg-white/[0.06] border border-white/10 rounded-full px-4 py-1.5 mb-8">
            <Dot className="bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <span className="text-xs font-black text-slate-300 uppercase tracking-widest">Free 2-Month Demo</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-black text-white mb-4 leading-tight">
            Start Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">Free Demo</span>
          </h1>
          <p className="text-slate-400 text-lg mb-8 leading-relaxed">
            Try our complete School ERP — students, fees, attendance, staff, results and more. 
            No credit card required.
          </p>

          {/* Trust badges */}
          <div className="flex items-center justify-center gap-6 flex-wrap text-slate-500 text-xs font-semibold">
            {[
              { icon: GraduationCap, label: 'Trusted by Schools' },
              { icon: BookOpen, label: 'Full Feature Access' },
              { icon: Award, label: '60 Days Free' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5 text-indigo-400" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form card */}
      <div className="max-w-2xl mx-auto px-4 pb-16">
        <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden">
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-8">

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-300 flex items-start gap-2">
                <span className="shrink-0 mt-0.5">⚠️</span>
                {error}
              </div>
            )}

            {/* School Information */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-400/20 flex items-center justify-center">
                  <Building2 className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <h2 className="text-sm font-black text-white uppercase tracking-widest">School Information</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    School / Institution Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. The Bright Future Academy"
                    value={form.school_name}
                    onChange={e => set('school_name', e.target.value)}
                    className="w-full bg-white/[0.06] border border-white/[0.10] rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 text-sm transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">City <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-600" />
                    <input
                      required
                      type="text"
                      placeholder="e.g. Lahore"
                      value={form.city}
                      onChange={e => set('city', e.target.value)}
                      className="w-full bg-white/[0.06] border border-white/[0.10] rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm transition"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">School Type</label>
                  <select
                    value={form.school_type}
                    onChange={e => set('school_type', e.target.value)}
                    className="w-full bg-white/[0.06] border border-white/[0.10] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition appearance-none cursor-pointer"
                    style={{ background: 'rgba(255,255,255,0.06)' }}
                  >
                    <option value="" className="bg-slate-800">-- Select type --</option>
                    {SCHOOL_TYPES.map(t => <option key={t} value={t} className="bg-slate-800">{t}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Number of Students */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/20 flex items-center justify-center">
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <h2 className="text-sm font-black text-white uppercase tracking-widest">Approx. Number of Students <span className="text-red-400">*</span></h2>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {STUDENT_RANGES.map(({ label, value }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => set('approx_students', value)}
                    className={`py-2.5 rounded-xl border text-sm font-bold transition-all ${
                      form.approx_students === value
                        ? 'bg-indigo-500/30 border-indigo-400/60 text-indigo-300 shadow-[0_0_20px_rgba(99,102,241,0.2)]'
                        : 'bg-white/[0.04] border-white/[0.08] text-slate-400 hover:border-white/20 hover:text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Contact Information */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-violet-500/20 border border-violet-400/20 flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-violet-400" />
                </div>
                <h2 className="text-sm font-black text-white uppercase tracking-widest">Contact Person</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Full Name <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-600" />
                    <input
                      required
                      type="text"
                      placeholder="Your name"
                      value={form.contact_person_name}
                      onChange={e => set('contact_person_name', e.target.value)}
                      className="w-full bg-white/[0.06] border border-white/[0.10] rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm transition"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Your Role</label>
                  <select
                    value={form.contact_person_role}
                    onChange={e => set('contact_person_role', e.target.value)}
                    className="w-full bg-white/[0.06] border border-white/[0.10] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition appearance-none cursor-pointer"
                    style={{ background: 'rgba(255,255,255,0.06)' }}
                  >
                    <option value="" className="bg-slate-800">-- Your role --</option>
                    {CONTACT_ROLES.map(r => <option key={r} value={r} className="bg-slate-800">{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">WhatsApp / Phone <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-600" />
                    <input
                      required
                      type="tel"
                      placeholder="03XX-XXXXXXX"
                      value={form.contact_phone}
                      onChange={e => set('contact_phone', e.target.value)}
                      className="w-full bg-white/[0.06] border border-white/[0.10] rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm transition"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Email Address <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-600" />
                    <input
                      required
                      type="email"
                      placeholder="you@school.com"
                      value={form.contact_email}
                      onChange={e => set('contact_email', e.target.value)}
                      className="w-full bg-white/[0.06] border border-white/[0.10] rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm transition"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* How did you hear */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">How did you hear about us?</label>
              <div className="flex flex-wrap gap-2">
                {HOW_HEARD.map(h => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => set('how_heard', h)}
                    className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all ${
                      form.how_heard === h
                        ? 'bg-violet-500/20 border-violet-400/50 text-violet-300'
                        : 'bg-white/[0.04] border-white/[0.08] text-slate-500 hover:border-white/20 hover:text-slate-300'
                    }`}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !form.approx_students}
              className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-black text-sm rounded-2xl shadow-xl shadow-indigo-900/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] uppercase tracking-widest"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Submitting...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Start My Free Demo
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
            <p className="text-center text-xs text-slate-600">No credit card required · 60-day full access · Cancel anytime</p>
          </form>
        </div>
      </div>
    </div>
  );
}
