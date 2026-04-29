/**
 * Admission Pipeline — Full Front Desk Workflow
 * ─────────────────────────────────────────────
 * Stage 1 : New Inquiry       — basic details captured
 * Stage 2 : Follow Up 1       — first follow-up call / visit
 * Stage 3 : Follow Up 2       — second follow-up
 * Stage 4 : Test Scheduled    — admission test booked
 * Stage 5 : Admitted / Rejected — result of test
 *
 * "Register as Student" on Admitted card pre-fills RegisterStudent form.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  UserPlus, Plus, X, ChevronRight, Phone, Calendar,
  ClipboardCheck, CheckCircle2, XCircle, GraduationCap,
  Pencil, MessageSquare, FlaskConical, ArrowRight,
  Download, Search, Users, AlertTriangle, Loader2, BookOpen,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDate } from '../../lib/utils';

/* ─── Types ────────────────────────────────────────────────────────────── */
type Stage = 'new_inquiry' | 'follow_up_1' | 'follow_up_2' | 'test_scheduled' | 'admitted' | 'rejected';

interface Inquiry {
  id: string;
  school_id: string;
  // Student
  student_name: string;
  student_dob: string | null;
  student_gender: string | null;
  // Parent
  father_name: string;
  mother_name: string | null;
  contact_number: string;
  email: string | null;
  address: string | null;
  // Application
  applying_for_class: string;
  inquiry_date: string;
  source: string | null;
  status: Stage;
  notes: string | null;
  // Follow-ups
  follow_up_1_date: string | null;
  follow_up_1_notes: string | null;
  follow_up_2_date: string | null;
  follow_up_2_notes: string | null;
  // Test
  test_date: string | null;
  test_score: number | null;
  test_total: number | null;
  test_result: 'pass' | 'fail' | null;
  test_remarks: string | null;
  // Links
  visitor_id: string | null;
  student_id: string | null;
  created_at: string;
}

/* ─── Config ────────────────────────────────────────────────────────────── */
const STAGES: Stage[] = ['new_inquiry', 'follow_up_1', 'follow_up_2', 'test_scheduled', 'admitted', 'rejected'];

const STAGE_CONFIG: Record<Stage, {
  label: string; short: string; color: string; bg: string; border: string;
  headerBg: string; icon: React.ReactNode;
}> = {
  new_inquiry: {
    label: 'New Inquiry', short: 'New',
    color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200',
    headerBg: 'bg-blue-600',
    icon: <UserPlus className="w-4 h-4" />,
  },
  follow_up_1: {
    label: 'Follow Up 1', short: 'FU-1',
    color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200',
    headerBg: 'bg-amber-500',
    icon: <Phone className="w-4 h-4" />,
  },
  follow_up_2: {
    label: 'Follow Up 2', short: 'FU-2',
    color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200',
    headerBg: 'bg-orange-500',
    icon: <MessageSquare className="w-4 h-4" />,
  },
  test_scheduled: {
    label: 'Test Scheduled', short: 'Test',
    color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200',
    headerBg: 'bg-purple-600',
    icon: <FlaskConical className="w-4 h-4" />,
  },
  admitted: {
    label: 'Admitted', short: 'Done',
    color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200',
    headerBg: 'bg-emerald-600',
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
  rejected: {
    label: 'Rejected', short: 'Rej.',
    color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200',
    headerBg: 'bg-red-600',
    icon: <XCircle className="w-4 h-4" />,
  },
};

const SOURCES = ['Walk-in', 'Phone Call', 'Referral', 'Online', 'WhatsApp', 'Newspaper Ad', 'Other'];
const GENDERS = ['Male', 'Female'];

const EMPTY_FORM = {
  student_name: '', student_dob: '', student_gender: '',
  father_name: '', mother_name: '', contact_number: '',
  email: '', address: '', applying_for_class: '',
  inquiry_date: new Date().toISOString().split('T')[0],
  source: 'Walk-in', notes: '',
};

/* ═══════════════════════════════════════════════════════════════════════ */
export default function AdmissionPipeline() {
  const { userRole } = useAuth();
  const navigate = useNavigate();

  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  /* ── Modal state ── */
  const [showAddModal, setShowAddModal]   = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [activeInquiry, setActiveInquiry] = useState<Inquiry | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  /* ── Action sub-modals ── */
  const [actionModal, setActionModal] = useState<'follow_up_1' | 'follow_up_2' | 'test_result' | null>(null);
  const [fuDate, setFuDate]   = useState(new Date().toISOString().split('T')[0]);
  const [fuNotes, setFuNotes] = useState('');
  const [testDate,    setTestDate]    = useState(new Date().toISOString().split('T')[0]);
  const [testScore,   setTestScore]   = useState('');
  const [testTotal,   setTestTotal]   = useState('100');
  const [testResult,  setTestResult]  = useState<'pass' | 'fail'>('pass');
  const [testRemarks, setTestRemarks] = useState('');

  /* ── Refs for optimized picker ── */
  const dobInputRef = React.useRef<HTMLInputElement>(null);
  const inquiryInputRef = React.useRef<HTMLInputElement>(null);
  const fuInputRef = React.useRef<HTMLInputElement>(null);
  const testInputRef = React.useRef<HTMLInputElement>(null);

  /* ── Load ── */
  useEffect(() => {
    if (userRole?.school_id) { fetchAll(); fetchClasses(); }
  }, [userRole]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('admission_inquiries')
      .select('*')
      .eq('school_id', userRole!.school_id)
      .order('created_at', { ascending: false });
    setInquiries(data || []);
    setLoading(false);
  }, [userRole]);

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('id, name, section')
      .eq('school_id', userRole!.school_id).order('name');
    setClasses(data || []);
  };

  /* ── Save new / edit inquiry ── */
  const saveInquiry = async () => {
    if (!form.student_name.trim() || !form.contact_number.trim()) return;
    setSaving(true);
    try {
      const payload = {
        student_name: form.student_name,
        student_dob:  form.student_dob   || null,
        student_gender: form.student_gender || null,
        father_name:  form.father_name,
        mother_name:  form.mother_name   || null,
        contact_number: form.contact_number,
        email:        form.email         || null,
        address:      form.address       || null,
        applying_for_class: form.applying_for_class,
        inquiry_date: form.inquiry_date,
        source:       form.source        || null,
        notes:        form.notes         || null,
      };
      if (editId) {
        await supabase.from('admission_inquiries').update(payload).eq('id', editId);
      } else {
        await supabase.from('admission_inquiries').insert({ ...payload, school_id: userRole!.school_id, status: 'new_inquiry' });
      }
      setShowAddModal(false);
      setShowDetailModal(false);
      fetchAll();
    } finally {
      setSaving(false);
    }
  };

  /* ── Move to follow up 1 ── */
  const doFollowUp1 = async () => {
    if (!activeInquiry) return;
    setSaving(true);
    await supabase.from('admission_inquiries').update({
      status: 'follow_up_1',
      follow_up_1_date: fuDate,
      follow_up_1_notes: fuNotes || null,
    }).eq('id', activeInquiry.id);
    setActionModal(null); fetchAll(); setShowDetailModal(false);
    setSaving(false);
  };

  /* ── Move to follow up 2 ── */
  const doFollowUp2 = async () => {
    if (!activeInquiry) return;
    setSaving(true);
    await supabase.from('admission_inquiries').update({
      status: 'follow_up_2',
      follow_up_2_date: fuDate,
      follow_up_2_notes: fuNotes || null,
    }).eq('id', activeInquiry.id);
    setActionModal(null); fetchAll(); setShowDetailModal(false);
    setSaving(false);
  };

  /* ── Schedule test ── */
  const scheduleTest = async () => {
    if (!activeInquiry) return;
    setSaving(true);
    await supabase.from('admission_inquiries').update({
      status: 'test_scheduled',
      test_date: testDate,
    }).eq('id', activeInquiry.id);
    setActionModal(null); fetchAll(); setShowDetailModal(false);
    setSaving(false);
  };

  /* ── Record test result ── */
  const recordTestResult = async () => {
    if (!activeInquiry) return;
    setSaving(true);
    const sc = parseFloat(testScore) || 0;
    const tt = parseFloat(testTotal) || 100;
    const auto: 'pass' | 'fail' = sc >= tt / 2 ? 'pass' : 'fail';
    const result = testResult ?? auto;
    await supabase.from('admission_inquiries').update({
      status: result === 'pass' ? 'admitted' : 'rejected',
      test_score: sc,
      test_total: tt,
      test_result: result,
      test_remarks: testRemarks || null,
    }).eq('id', activeInquiry.id);
    setActionModal(null); fetchAll(); setShowDetailModal(false);
    setSaving(false);
  };

  /* ── Reject manually ── */
  const rejectInquiry = async (id: string) => {
    if (!window.confirm('Mark this inquiry as Rejected?')) return;
    await supabase.from('admission_inquiries').update({ status: 'rejected' }).eq('id', id);
    fetchAll(); setShowDetailModal(false);
  };

  /* ── Navigate to RegisterStudent with pre-filled data ── */
  const registerAsStudent = (inq: Inquiry) => {
    navigate('/students/register', {
      state: {
        prefill: {
          // Flat structure — matches RegisterStudent.tsx prefill reader
          student_name: inq.student_name,
          student_dob: inq.student_dob || '',
          student_gender: inq.student_gender || '',
          father_name: inq.father_name,
          mother_name: inq.mother_name || '',
          contact_number: inq.contact_number,
          email: inq.email || '',
          address: inq.address || '',
          applying_for_class: inq.applying_for_class || '',
          inquiry_id: inq.id,
        },
      },
    });
  };

  /* ── Filtered & grouped ── */
  const filtered = inquiries.filter(i => {
    if (!search) return true;
    const q = search.toLowerCase();
    return i.student_name.toLowerCase().includes(q) ||
           i.father_name.toLowerCase().includes(q) ||
           i.contact_number.includes(q);
  });
  const byStage = (s: Stage) => filtered.filter(i => i.status === s);

  const openAdd = (prefill?: Partial<typeof EMPTY_FORM>) => {
    setForm({ ...EMPTY_FORM, ...prefill });
    setEditId(null);
    setShowAddModal(true);
  };

  const openDetail = (inq: Inquiry) => {
    setActiveInquiry(inq);
    setShowDetailModal(true);
    // reset sub-modal state
    setFuDate(new Date().toISOString().split('T')[0]);
    setFuNotes('');
    setTestDate(inq.test_date || new Date().toISOString().split('T')[0]);
    setTestScore(inq.test_score?.toString() || '');
    setTestTotal(inq.test_total?.toString() || '100');
    setTestRemarks(inq.test_remarks || '');
    setTestResult(inq.test_result || 'pass');
  };

  const openEdit = (inq: Inquiry) => {
    setForm({
      student_name: inq.student_name, student_dob: inq.student_dob || '',
      student_gender: inq.student_gender || '', father_name: inq.father_name,
      mother_name: inq.mother_name || '', contact_number: inq.contact_number,
      email: inq.email || '', address: inq.address || '',
      applying_for_class: inq.applying_for_class, inquiry_date: inq.inquiry_date,
      source: inq.source || 'Walk-in', notes: inq.notes || '',
    });
    setEditId(inq.id);
    setShowDetailModal(false);
    setShowAddModal(true);
  };

  /* ══════════════════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-indigo-600" /> Admission Pipeline
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Track every prospective student from first visit to registration.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search name / phone…"
              className="pl-8 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-52"
            />
          </div>
          <button
            onClick={() => openAdd()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition"
          >
            <Plus className="w-4 h-4" /> New Inquiry
          </button>
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {STAGES.map(s => {
          const cfg = STAGE_CONFIG[s];
          const count = inquiries.filter(i => i.status === s).length;
          return (
            <div key={s} className={`rounded-xl border px-3 py-2.5 text-center ${cfg.bg} ${cfg.border}`}>
              <p className={`text-2xl font-black ${cfg.color}`}>{count}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider leading-tight mt-0.5">{cfg.label}</p>
            </div>
          );
        })}
      </div>

      {/* ── Kanban Board ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 items-start">
          {STAGES.map(stage => {
            const cfg = STAGE_CONFIG[stage];
            const cards = byStage(stage);
            return (
              <div key={stage} className="flex flex-col min-h-[200px]">
                {/* Column header */}
                <div className={`${cfg.headerBg} text-white rounded-t-xl px-3 py-2.5 flex items-center justify-between`}>
                  <div className="flex items-center gap-1.5 text-sm font-black">
                    {cfg.icon}{cfg.label}
                  </div>
                  <span className="bg-white/20 text-white text-xs font-black px-2 py-0.5 rounded-full">
                    {cards.length}
                  </span>
                </div>

                {/* Cards */}
                <div className={`flex-1 border-x border-b ${cfg.border} rounded-b-xl ${cfg.bg} p-2 space-y-2 min-h-[120px]`}>
                  {cards.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-6">No records</p>
                  )}
                  {cards.map(inq => (
                    <InquiryCard
                      key={inq.id}
                      inquiry={inq}
                      stage={stage}
                      onClick={() => openDetail(inq)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ADD / EDIT INQUIRY MODAL
      ═══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showAddModal && (
          <Modal title={editId ? 'Edit Inquiry' : 'New Admission Inquiry'} onClose={() => setShowAddModal(false)}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <FormSection title="Student Details" cols={2}>
                <Field label="Student Full Name *">
                  <input value={form.student_name} onChange={e => setForm({...form, student_name: e.target.value})}
                    className={INPUT} placeholder="Student's full name" />
                </Field>
                <Field label="Date of Birth">
                  <div 
                    className="relative cursor-pointer group"
                    onClick={() => {
                      if (dobInputRef.current && 'showPicker' in HTMLInputElement.prototype) {
                        try { dobInputRef.current.showPicker(); } catch(e) {}
                      }
                    }}
                  >
                    <input
                      type="text"
                      readOnly
                      value={formatDate(form.student_dob)}
                      placeholder="DD-MM-YYYY"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white group-hover:border-indigo-400 transition-colors"
                    />
                    <input
                      type="date"
                      ref={dobInputRef}
                      value={form.student_dob}
                      onChange={e => setForm({...form, student_dob: e.target.value})}
                      className="absolute inset-0 opacity-0 pointer-events-none"
                    />
                    <div className="absolute right-3 top-2.5 text-slate-400 pointer-events-none group-hover:text-indigo-500">
                      <Calendar className="w-4 h-4" />
                    </div>
                  </div>
                </Field>
                <Field label="Gender">
                  <select value={form.student_gender} onChange={e => setForm({...form, student_gender: e.target.value})}
                    className={INPUT}>
                    <option value="">Select</option>
                    {GENDERS.map(g => <option key={g}>{g}</option>)}
                  </select>
                </Field>
                <Field label="Applying for Class">
                  <select value={form.applying_for_class} onChange={e => setForm({...form, applying_for_class: e.target.value})}
                    className={INPUT}>
                    <option value="">Select class</option>
                    {classes.map(c => (
                      <option key={c.id} value={`${c.name}${c.section ? ' ' + c.section : ''}`}>
                        {c.name}{c.section ? ` (${c.section})` : ''}
                      </option>
                    ))}
                  </select>
                </Field>
              </FormSection>

              <FormSection title="Parent / Guardian" cols={2}>
                <Field label="Father's Name *">
                  <input value={form.father_name} onChange={e => setForm({...form, father_name: e.target.value})}
                    className={INPUT} placeholder="Father's full name" />
                </Field>
                <Field label="Mother's Name">
                  <input value={form.mother_name} onChange={e => setForm({...form, mother_name: e.target.value})}
                    className={INPUT} placeholder="Mother's full name" />
                </Field>
                <Field label="Contact / WhatsApp *">
                  <input value={form.contact_number} onChange={e => setForm({...form, contact_number: e.target.value})}
                    className={INPUT} placeholder="03xx-xxxxxxx" />
                </Field>
                <Field label="Email">
                  <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                    className={INPUT} placeholder="optional" />
                </Field>
                <Field label="Address" className="col-span-2">
                  <input value={form.address} onChange={e => setForm({...form, address: e.target.value})}
                    className={INPUT} placeholder="Home address" />
                </Field>
              </FormSection>

              <FormSection title="Inquiry Details" cols={2}>
                <Field label="Inquiry Date">
                  <div 
                    className="relative cursor-pointer group"
                    onClick={() => {
                      if (inquiryInputRef.current && 'showPicker' in HTMLInputElement.prototype) {
                        try { inquiryInputRef.current.showPicker(); } catch(e) {}
                      }
                    }}
                  >
                    <input
                      type="text"
                      readOnly
                      value={formatDate(form.inquiry_date)}
                      placeholder="DD-MM-YYYY"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white group-hover:border-indigo-400 transition-colors"
                    />
                    <input
                      type="date"
                      ref={inquiryInputRef}
                      value={form.inquiry_date}
                      onChange={e => setForm({...form, inquiry_date: e.target.value})}
                      className="absolute inset-0 opacity-0 pointer-events-none"
                    />
                    <div className="absolute right-3 top-2.5 text-slate-400 pointer-events-none group-hover:text-indigo-500">
                      <Calendar className="w-4 h-4" />
                    </div>
                  </div>
                </Field>
                <Field label="How did they find us?">
                  <select value={form.source} onChange={e => setForm({...form, source: e.target.value})}
                    className={INPUT}>
                    {SOURCES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Notes" className="col-span-2">
                  <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
                    rows={2} className={INPUT} placeholder="Initial notes, requirements, concerns…" />
                </Field>
              </FormSection>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
              <button onClick={() => setShowAddModal(false)} className="px-5 py-2 text-sm font-bold text-slate-600 hover:text-slate-800">Cancel</button>
              <button onClick={saveInquiry} disabled={saving || !form.student_name.trim() || !form.contact_number.trim()}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-black transition">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {editId ? 'Update' : 'Save Inquiry'}
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════
          DETAIL / ACTION MODAL
      ═══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showDetailModal && activeInquiry && (
          <Modal
            title={`${activeInquiry.student_name}`}
            subtitle={STAGE_CONFIG[activeInquiry.status].label}
            onClose={() => { setShowDetailModal(false); setActionModal(null); }}
            wide
          >
            {/* ── Main info grid ── */}
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 sm:gap-4 mb-5">
              <InfoBox label="Father" value={activeInquiry.father_name} />
              <InfoBox label="Contact" value={activeInquiry.contact_number} />
              {activeInquiry.mother_name && <InfoBox label="Mother" value={activeInquiry.mother_name} />}
              {activeInquiry.student_dob && <InfoBox label="Date of Birth" value={formatDate(activeInquiry.student_dob)} />}
              {activeInquiry.student_gender && <InfoBox label="Gender" value={activeInquiry.student_gender} />}
              <InfoBox label="Applying For" value={activeInquiry.applying_for_class || '—'} />
              {activeInquiry.email && <InfoBox label="Email" value={activeInquiry.email} />}
              {activeInquiry.address && <InfoBox label="Address" value={activeInquiry.address} className="col-span-2" />}
              {activeInquiry.source && <InfoBox label="Source" value={activeInquiry.source} />}
              <InfoBox label="Inquiry Date" value={formatDate(activeInquiry.inquiry_date)} />
              {activeInquiry.notes && <InfoBox label="Notes" value={activeInquiry.notes} className="col-span-2" />}
            </div>

            {/* ── Timeline ── */}
            <div className="border border-slate-100 rounded-2xl p-4 mb-5 space-y-3 bg-slate-50">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Progress Timeline</p>
              <Timeline inquiry={activeInquiry} />
            </div>

            {/* ── Action Sub-Modals ── */}
            {actionModal === 'follow_up_1' && (
              <SubForm title="Record Follow Up 1" onCancel={() => setActionModal(null)} onSave={doFollowUp1} saving={saving}>
                <Field label="Follow-Up Date">
                  <div 
                    className="relative cursor-pointer group"
                    onClick={() => {
                      if (fuInputRef.current && 'showPicker' in HTMLInputElement.prototype) {
                        try { fuInputRef.current.showPicker(); } catch(e) {}
                      }
                    }}
                  >
                    <input
                      type="text"
                      readOnly
                      value={formatDate(fuDate)}
                      placeholder="DD-MM-YYYY"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white group-hover:border-indigo-400 transition-colors"
                    />
                    <input
                      type="date"
                      ref={fuInputRef}
                      value={fuDate}
                      onChange={e => setFuDate(e.target.value)}
                      className="absolute inset-0 opacity-0 pointer-events-none"
                    />
                    <div className="absolute right-3 top-2.5 text-slate-400 pointer-events-none group-hover:text-indigo-500">
                      <Calendar className="w-4 h-4" />
                    </div>
                  </div>
                </Field>
                <Field label="Notes / Outcome">
                  <textarea value={fuNotes} onChange={e => setFuNotes(e.target.value)} rows={2} className={INPUT}
                    placeholder="What was discussed? Parent's response?" />
                </Field>
              </SubForm>
            )}

            {actionModal === 'follow_up_2' && (
              <SubForm title="Record Follow Up 2" onCancel={() => setActionModal(null)} onSave={doFollowUp2} saving={saving}>
                <Field label="Follow-Up Date">
                  <div 
                    className="relative cursor-pointer group"
                    onClick={() => {
                      if (fuInputRef.current && 'showPicker' in HTMLInputElement.prototype) {
                        try { fuInputRef.current.showPicker(); } catch(e) {}
                      }
                    }}
                  >
                    <input
                      type="text"
                      readOnly
                      value={formatDate(fuDate)}
                      placeholder="DD-MM-YYYY"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white group-hover:border-indigo-400 transition-colors"
                    />
                    <input
                      type="date"
                      ref={fuInputRef}
                      value={fuDate}
                      onChange={e => setFuDate(e.target.value)}
                      className="absolute inset-0 opacity-0 pointer-events-none"
                    />
                    <div className="absolute right-3 top-2.5 text-slate-400 pointer-events-none group-hover:text-indigo-500">
                      <Calendar className="w-4 h-4" />
                    </div>
                  </div>
                </Field>
                <Field label="Notes / Outcome">
                  <textarea value={fuNotes} onChange={e => setFuNotes(e.target.value)} rows={2} className={INPUT}
                    placeholder="Final discussion notes?" />
                </Field>
                <p className="text-[11px] text-slate-500 bg-purple-50 border border-purple-100 rounded-xl p-3">
                  After saving, you can schedule the admission test from the next stage.
                </p>
              </SubForm>
            )}

            {actionModal === 'test_result' && (
              <SubForm
                title="Record Admission Test Result"
                onCancel={() => setActionModal(null)}
                onSave={recordTestResult}
                saving={saving}
                saveLabel="Submit Result"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Test Date">
                    <div 
                      className="relative cursor-pointer group"
                      onClick={() => {
                        if (testInputRef.current && 'showPicker' in HTMLInputElement.prototype) {
                          try { testInputRef.current.showPicker(); } catch(e) {}
                        }
                      }}
                    >
                      <input
                        type="text"
                        readOnly
                        value={formatDate(testDate)}
                        placeholder="DD-MM-YYYY"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white group-hover:border-indigo-400 transition-colors"
                      />
                      <input
                        type="date"
                        ref={testInputRef}
                        value={testDate}
                        onChange={e => setTestDate(e.target.value)}
                        className="absolute inset-0 opacity-0 pointer-events-none"
                      />
                      <div className="absolute right-3 top-2.5 text-slate-400 pointer-events-none group-hover:text-indigo-500">
                        <Calendar className="w-4 h-4" />
                      </div>
                    </div>
                  </Field>
                  <Field label="Pass / Fail">
                    <select value={testResult} onChange={e => setTestResult(e.target.value as 'pass' | 'fail')} className={INPUT}>
                      <option value="pass">Pass ✓</option>
                      <option value="fail">Fail ✗</option>
                    </select>
                  </Field>
                  <Field label="Score Obtained">
                    <input type="number" min="0" value={testScore} onChange={e => setTestScore(e.target.value)}
                      className={INPUT} placeholder="e.g. 75" />
                  </Field>
                  <Field label="Total Marks">
                    <input type="number" min="1" value={testTotal} onChange={e => setTestTotal(e.target.value)}
                      className={INPUT} placeholder="e.g. 100" />
                  </Field>
                </div>
                <Field label="Remarks">
                  <textarea value={testRemarks} onChange={e => setTestRemarks(e.target.value)} rows={2} className={INPUT}
                    placeholder="Examiner comments, subject-wise notes…" />
                </Field>
                {testScore && testTotal && (
                  <div className={`rounded-xl px-4 py-3 text-sm font-bold border ${
                    parseFloat(testScore) >= parseFloat(testTotal) / 2
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-red-50 border-red-200 text-red-700'
                  }`}>
                    Score: {testScore}/{testTotal} ({Math.round((parseFloat(testScore) / parseFloat(testTotal)) * 100)}%)
                    — {parseFloat(testScore) >= parseFloat(testTotal) / 2 ? '✓ Eligible for Admission' : '✗ Below passing threshold'}
                  </div>
                )}
              </SubForm>
            )}

            {/* ── Schedule Test Sub-form (inside detail) ── */}
            {actionModal === 'follow_up_2' ? null : null /* handled above */}

            {/* ── Action Buttons (when no sub-modal open) ── */}
            {!actionModal && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
                <div className="flex gap-2">
                  <button onClick={() => openEdit(activeInquiry)}
                    className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-sm font-bold transition">
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  {activeInquiry.status !== 'rejected' && activeInquiry.status !== 'admitted' && (
                    <button onClick={() => rejectInquiry(activeInquiry.id)}
                      className="flex items-center gap-1.5 px-3 py-2 border border-red-200 hover:bg-red-50 text-red-600 rounded-xl text-sm font-bold transition">
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </button>
                  )}
                </div>

                <div className="flex gap-2 flex-wrap">
                  {/* Stage-specific action buttons */}
                  {activeInquiry.status === 'new_inquiry' && (
                    <ActionBtn icon={<Phone className="w-3.5 h-3.5" />} label="Record Follow Up 1"
                      color="amber" onClick={() => setActionModal('follow_up_1')} />
                  )}
                  {activeInquiry.status === 'follow_up_1' && (
                    <ActionBtn icon={<MessageSquare className="w-3.5 h-3.5" />} label="Record Follow Up 2"
                      color="orange" onClick={() => setActionModal('follow_up_2')} />
                  )}
                  {activeInquiry.status === 'follow_up_2' && (
                    <ActionBtn icon={<FlaskConical className="w-3.5 h-3.5" />} label="Schedule Admission Test"
                      color="purple" onClick={async () => {
                        setSaving(true);
                        await supabase.from('admission_inquiries').update({
                          status: 'test_scheduled', test_date: new Date().toISOString().split('T')[0],
                        }).eq('id', activeInquiry.id);
                        fetchAll();
                        setSaving(false);
                        setShowDetailModal(false);
                      }} />
                  )}
                  {activeInquiry.status === 'test_scheduled' && (
                    <ActionBtn icon={<ClipboardCheck className="w-3.5 h-3.5" />} label="Enter Test Result"
                      color="purple" onClick={() => setActionModal('test_result')} />
                  )}
                  {activeInquiry.status === 'admitted' && !activeInquiry.student_id && (
                    <button
                      onClick={() => registerAsStudent(activeInquiry)}
                      className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-black transition shadow-sm"
                    >
                      <GraduationCap className="w-4 h-4" /> Register as Student <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                  {activeInquiry.status === 'admitted' && activeInquiry.student_id && (
                    <button
                      onClick={() => navigate(`/students/detail/${activeInquiry.student_id}`)}
                      className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition"
                    >
                      <BookOpen className="w-4 h-4" /> View Student Portfolio
                    </button>
                  )}
                </div>
              </div>
            )}
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Small Components ───────────────────────────────────────────────────── */

function InquiryCard({ inquiry, stage, onClick }: { inquiry: Inquiry; stage: Stage; onClick: () => void; key?: React.Key }) {
  const cfg = STAGE_CONFIG[stage];
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white rounded-xl border ${cfg.border} p-3 cursor-pointer hover:shadow-md transition-shadow`}
      onClick={onClick}
    >
      <p className="text-xs font-black text-slate-800 truncate">{inquiry.student_name}</p>
      <p className="text-[10px] text-slate-500 truncate">{inquiry.father_name}</p>
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-slate-400 font-mono">{inquiry.contact_number}</span>
        {inquiry.applying_for_class && (
          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
            {inquiry.applying_for_class}
          </span>
        )}
      </div>
      {stage === 'admitted' && !inquiry.student_id && (
        <div className="mt-2 text-[9px] font-black text-emerald-600 bg-emerald-50 rounded-lg px-2 py-1 text-center">
          Click → Register as Student
        </div>
      )}
      {stage === 'rejected' && inquiry.test_result && (
        <div className="mt-1 text-[9px] text-red-600 font-bold">
          Test: {inquiry.test_score}/{inquiry.test_total}
        </div>
      )}
    </motion.div>
  );
}

function Timeline({ inquiry }: { inquiry: Inquiry }) {
  const steps: { label: string; date: string | null; note: string | null; done: boolean; active: boolean }[] = [
    { label: 'Inquiry Received', date: inquiry.inquiry_date, note: inquiry.notes, done: true, active: false },
    { label: 'Follow Up 1', date: inquiry.follow_up_1_date, note: inquiry.follow_up_1_notes,
      done: !!inquiry.follow_up_1_date, active: inquiry.status === 'new_inquiry' },
    { label: 'Follow Up 2', date: inquiry.follow_up_2_date, note: inquiry.follow_up_2_notes,
      done: !!inquiry.follow_up_2_date, active: inquiry.status === 'follow_up_1' },
    { label: 'Admission Test', date: inquiry.test_date,
      note: inquiry.test_score != null ? `Score: ${inquiry.test_score}/${inquiry.test_total} — ${inquiry.test_result?.toUpperCase()}` : inquiry.test_remarks,
      done: inquiry.status === 'admitted' || inquiry.status === 'rejected',
      active: inquiry.status === 'follow_up_2' || inquiry.status === 'test_scheduled' },
    { label: inquiry.status === 'rejected' ? 'Rejected' : 'Admitted',
      date: null, note: inquiry.test_remarks,
      done: inquiry.status === 'admitted' || inquiry.status === 'rejected',
      active: false },
  ];

  return (
    <div className="space-y-2">
      {steps.map((step, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 border-2
            ${step.done ? 'bg-emerald-500 border-emerald-500' :
              step.active ? 'border-indigo-400 bg-white' : 'border-slate-200 bg-white'}`}>
            {step.done && <CheckCircle2 className="w-3 h-3 text-white" />}
            {step.active && <div className="w-2 h-2 rounded-full bg-indigo-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold ${step.done ? 'text-slate-700' : step.active ? 'text-indigo-600' : 'text-slate-400'}`}>
                {step.label}
              </span>
              {step.date && <span className="text-[10px] text-slate-400">{formatDate(step.date)}</span>}
            </div>
            {step.note && <p className="text-[11px] text-slate-500 mt-0.5">{step.note}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function ActionBtn({ icon, label, color, onClick }: { icon: React.ReactNode; label: string; color: string; onClick: () => void }) {
  const colors: Record<string, string> = {
    amber: 'bg-amber-500 hover:bg-amber-600',
    orange: 'bg-orange-500 hover:bg-orange-600',
    purple: 'bg-purple-600 hover:bg-purple-700',
    emerald: 'bg-emerald-600 hover:bg-emerald-700',
  };
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2 ${colors[color] || 'bg-indigo-600'} text-white rounded-xl text-sm font-bold transition`}>
      {icon}{label}
    </button>
  );
}

/* ─── Generic wrappers ───────────────────────────────────────────────────── */

function Modal({ title, subtitle, children, onClose, wide }: {
  title: string; subtitle?: string; children: React.ReactNode; onClose: () => void; wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className={`bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-xl'} max-h-[92vh] flex flex-col overflow-hidden`}
      >
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-white font-black text-base leading-none">{title}</h2>
            {subtitle && <p className="text-indigo-200 text-xs mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
      </motion.div>
    </div>
  );
}

function SubForm({ title, children, onCancel, onSave, saving, saveLabel = 'Save & Move Forward' }: {
  title: string; children: React.ReactNode; onCancel: () => void;
  onSave: () => void; saving: boolean; saveLabel?: string;
}) {
  return (
    <div className="border border-indigo-200 bg-indigo-50 rounded-2xl p-4 space-y-4">
      <p className="text-xs font-black text-indigo-600 uppercase tracking-widest">{title}</p>
      {children}
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-800">Cancel</button>
        <button onClick={onSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-black transition">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
          {saveLabel}
        </button>
      </div>
    </div>
  );
}

function FormSection({ title, children, cols = 1 }: { title: string; children: React.ReactNode; cols?: number }) {
  const gridClass = cols === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1';
  return (
    <div className={`${cols === 2 ? 'col-span-1 sm:col-span-2' : 'col-span-1 sm:col-span-2'} space-y-3`}>
      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-1">{title}</p>
      <div className={`grid ${gridClass} gap-3`}>{children}</div>
    </div>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function InfoBox({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="text-sm font-bold text-slate-800 mt-0.5">{value || '—'}</p>
    </div>
  );
}

const INPUT = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white';
