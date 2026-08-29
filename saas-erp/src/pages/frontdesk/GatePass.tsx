import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  ShieldCheck, UserCheck, Search, Printer, Download,
  Clock, Calendar, UserX, AlertCircle, CheckCircle2,
  FileText, Send, Phone, User, Users, Plus, X,
  BadgeAlert, ArrowRight, Check, Sparkles, Filter, Shield
} from 'lucide-react';
import { formatDate, formatDateTime, cn, getBase64Image } from '../../lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PageHeader, Card, Btn, Badge } from '../../components/ui';

interface Student {
  id: string;
  student_unique_id: string;
  roll_number: string;
  full_name: string;
  father_name: string;
  whatsapp_number: string;
  class_id: string;
  class_name: string;
  photo_url?: string;
}

interface GatePassRecord {
  id: string;
  pass_number: string;
  type: 'student_exit' | 'visitor';
  student_id?: string;
  student_name?: string;
  student_unique_id?: string;
  roll_number?: string;
  class_name?: string;
  father_name?: string;
  whatsapp_number?: string;
  collector_name: string;
  collector_relation: string;
  collector_cnic: string;
  collector_phone: string;
  reason: string;
  authorized_by: string;
  exit_datetime: string;
  status: 'issued' | 'departed' | 'cancelled';
  created_at: string;
}

const REASONS = [
  'Sudden Sickness / Fever',
  'Severe Headache / Stomach Ache',
  'Doctor / Hospital Appointment',
  'Urgent Family Matter',
  'Pre-arranged Family Function',
  'Emergency Pickup by Parents',
  'Official Sports / Competition Outing',
  'Other Urgent Reason',
];

export default function GatePass() {
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);

  // Tabs & Forms
  const [activeTab, setActiveTab] = useState<'issue' | 'register'>('issue');
  const [passType, setPassType] = useState<'student_exit' | 'visitor'>('student_exit');

  // Student Search & Selection
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Form Fields
  const [collectorName, setCollectorName] = useState('');
  const [collectorRelation, setCollectorRelation] = useState('Father');
  const [collectorCnic, setCollectorCnic] = useState('');
  const [collectorPhone, setCollectorPhone] = useState('');
  const [reason, setReason] = useState(REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [authorizedBy, setAuthorizedBy] = useState('Principal Office');
  const [exitDateTime, setExitDateTime] = useState(() => new Date().toISOString().slice(0, 16));

  // Gate Pass Register & Active Pass for Printing
  const [gatePassList, setGatePassList] = useState<GatePassRecord[]>([]);
  const [activePrintPass, setActivePrintPass] = useState<GatePassRecord | null>(null);
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().slice(0, 10));

  // ─── 1. Load Initial Data ──────────────────────────────────────────────────
  const loadInitialData = useCallback(async () => {
    if (!userRole?.school_id) return;
    setLoading(true);

    try {
      const [
        { data: stuData, error: stuErr },
        { data: schData },
        { data: formRes }
      ] = await Promise.all([
        supabase.from('students').select(`
          *,
          classes (name, section),
          parents (father_name, whatsapp_number)
        `).eq('school_id', userRole.school_id).eq('is_deleted', false).order('roll_number'),
        supabase.from('schools').select('*').eq('id', userRole.school_id).single(),
        supabase.from('form_settings').select('sections_config').eq('school_id', userRole.school_id).eq('form_name', 'gate_pass_register').maybeSingle()
      ]);

      if (stuErr) throw stuErr;

      if (stuData) {
        const formatted: Student[] = stuData.map((s: any) => ({
          id: s.id,
          student_unique_id: s.admission_number || s.student_unique_id || String(s.roll_number || '—'),
          roll_number: String(s.roll_number || '—'),
          full_name: s.full_name || '—',
          father_name: s.parents?.father_name || s.father_name || '—',
          whatsapp_number: s.parents?.whatsapp_number || s.father_contact || s.emergency_contact || '',
          class_id: s.class_id,
          class_name: s.classes ? `${s.classes.name} ${s.classes.section || ''}`.trim() : '—',
          photo_url: s.photograph_url || s.photo_url,
        }));
        setStudents(formatted);
      }

      if (schData) setSchoolInfo(schData);

      if (formRes?.sections_config?.passes) {
        setGatePassList(formRes.sections_config.passes);
      }

    } catch (err) {
      console.error('Error loading gate pass data:', err);
    } finally {
      setLoading(false);
    }
  }, [userRole?.school_id]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // ─── 2. Auto-fill father details on student select ──────────────────────────
  const handleSelectStudent = (stu: Student) => {
    setSelectedStudent(stu);
    setStudentSearch('');
    if (!collectorName) setCollectorName(stu.father_name);
    if (!collectorPhone) setCollectorPhone(stu.whatsapp_number);
  };

  // ─── 3. Issue Gate Pass ───────────────────────────────────────────────────
  const handleIssuePass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userRole?.school_id) return;
    if (passType === 'student_exit' && !selectedStudent) {
      alert('Please search and select a student first.');
      return;
    }

    setSubmitting(true);
    try {
      const now = new Date();
      const passNumber = `GP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(gatePassList.length + 1).padStart(4, '0')}`;

      const finalReason = reason === 'Other Urgent Reason' ? customReason : reason;

      const newPass: GatePassRecord = {
        id: `gp_${Date.now()}`,
        pass_number: passNumber,
        type: passType,
        student_id: selectedStudent?.id,
        student_name: selectedStudent?.full_name,
        student_unique_id: selectedStudent?.student_unique_id,
        roll_number: selectedStudent?.roll_number,
        class_name: selectedStudent?.class_name,
        father_name: selectedStudent?.father_name,
        whatsapp_number: selectedStudent?.whatsapp_number,
        collector_name: collectorName,
        collector_relation: collectorRelation,
        collector_cnic: collectorCnic,
        collector_phone: collectorPhone,
        reason: finalReason,
        authorized_by: authorizedBy,
        exit_datetime: exitDateTime,
        status: 'issued',
        created_at: new Date().toISOString(),
      };

      const updatedList = [newPass, ...gatePassList];

      // Save to form_settings
      const { error } = await supabase.from('form_settings').upsert({
        school_id: userRole.school_id,
        form_name: 'gate_pass_register',
        sections_config: {
          passes: updatedList,
          updated_at: new Date().toISOString(),
        }
      }, { onConflict: 'school_id,form_name' });

      if (error) throw error;

      setGatePassList(updatedList);
      setActivePrintPass(newPass);

      // Reset form
      setSelectedStudent(null);
      setCollectorName('');
      setCollectorCnic('');
      setCollectorPhone('');
      setCustomReason('');

    } catch (err: any) {
      alert('Error issuing gate pass: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── 4. WhatsApp Parent Notification ──────────────────────────────────────
  const sendParentWhatsApp = (pass: GatePassRecord) => {
    if (!pass.whatsapp_number) {
      alert('Parent WhatsApp number is missing.');
      return;
    }
    const cleanPhone = pass.whatsapp_number.replace(/\D/g, '');
    const msg = encodeURIComponent(
      `Assalam-o-Alaikum Respected Parents,\n\n` +
      `Official *Student Early Exit Gate Pass* has been issued:\n\n` +
      `🎫 *Pass No:* ${pass.pass_number}\n` +
      `🎒 *Student:* ${pass.student_name} (${pass.class_name}, Roll #${pass.roll_number})\n` +
      `👤 *Collected By:* ${pass.collector_name} (${pass.collector_relation})\n` +
      `🪪 *Collector CNIC:* ${pass.collector_cnic || 'Verified'}\n` +
      `⏰ *Exit Time:* ${formatDateTime(pass.exit_datetime)}\n` +
      `📌 *Reason:* ${pass.reason}\n` +
      `✍️ *Authorized By:* ${pass.authorized_by}\n\n` +
      `_For queries, contact school office. Thank you._\n_${schoolInfo?.name || 'School Security Desk'}_`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
  };

  // ─── 5. PDF Gate Pass Slip (Standard A5) ──────────────────────────────────
  const handlePrintSlip = async (pass: GatePassRecord) => {
    const doc = new jsPDF('p', 'mm', 'a5');
    const pw = doc.internal.pageSize.width;

    if (schoolInfo?.logo_url) {
      try {
        const b64 = await getBase64Image(schoolInfo.logo_url);
        doc.addImage(b64, 'PNG', 12, 8, 16, 16);
      } catch (err) {}
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(schoolInfo?.name || 'School Gate Pass', pw / 2, 14, { align: 'center' });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(schoolInfo?.address || '', pw / 2, 19, { align: 'center' });

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('STUDENT EARLY EXIT GATE PASS', pw / 2, 26, { align: 'center' });

    doc.setDrawColor(200);
    doc.line(10, 29, pw - 10, 29);

    const head = [['Field', 'Details']];
    const body = [
      ['Pass Number', pass.pass_number],
      ['Student Name', pass.student_name || '—'],
      ['Class & Section', pass.class_name || '—'],
      ['Roll Number / Adm', `${pass.roll_number || '—'} (Adm #${pass.student_unique_id || '—'})`],
      ['Father Name', pass.father_name || '—'],
      ['Person Collecting', `${pass.collector_name} (${pass.collector_relation})`],
      ['Collector CNIC', pass.collector_cnic || 'Verified at Gate'],
      ['Collector Contact', pass.collector_phone || '—'],
      ['Reason for Departure', pass.reason],
      ['Departure Timestamp', formatDateTime(pass.exit_datetime)],
      ['Authorized By', pass.authorized_by],
    ];

    autoTable(doc, {
      startY: 32,
      head: head,
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [13, 21, 38], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2.5 },
      columnStyles: {
        0: { cellWidth: 42, fontStyle: 'bold', fillColor: [248, 250, 252] },
        1: { fontStyle: 'bold' },
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 12;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('_______________________', 15, finalY);
    doc.text('Parent / Collector Sign', 15, finalY + 4);

    doc.text('_______________________', pw / 2 - 15, finalY);
    doc.text('Authorized Incharge', pw / 2 - 15, finalY + 4);

    doc.text('_______________________', pw - 45, finalY);
    doc.text('Security Gate Stamp', pw - 45, finalY + 4);

    doc.save(`Gate_Pass_${pass.pass_number}.pdf`);
  };

  // Filtered Register
  const filteredRegister = useMemo(() => {
    return gatePassList.filter(p => p.exit_datetime.slice(0, 10) === filterDate);
  }, [gatePassList, filterDate]);

  return (
    <div className="max-w-[1600px] mx-auto space-y-4">
      {/* ── Control Header ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm no-print">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              Student Early Exit & Visitor Gate Pass
              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-black uppercase">
                Front Desk & Security
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-bold">
              Secure institutional gate pass generation with CNIC verification, thermal slips, and parent WhatsApp alerts
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-2">
          <div className="bg-slate-100 p-1 rounded-xl flex gap-1 border border-slate-200">
            <button
              onClick={() => setActiveTab('issue')}
              className={cn(
                'px-4 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5',
                activeTab === 'issue' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <Plus className="w-3.5 h-3.5" /> Issue New Pass
            </button>
            <button
              onClick={() => setActiveTab('register')}
              className={cn(
                'px-4 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5',
                activeTab === 'register' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <FileText className="w-3.5 h-3.5" /> Daily Gate Register ({filteredRegister.length})
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'issue' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* ── Left Column: Form ── */}
          <div className="lg:col-span-8 space-y-4">
            <Card className="p-5 shadow-sm border-slate-200/80 space-y-4">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2 border-b pb-2">
                <UserCheck className="w-4 h-4 text-indigo-600" />
                1. Select Student for Early Departure
              </h2>

              {/* Student Search Bar */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  placeholder="Type student name, roll number, or admission number..."
                  className="w-full pl-10 pr-4 py-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                />

                {/* Search Results Dropdown */}
                {studentSearch.trim().length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-xl border border-slate-200 max-h-64 overflow-y-auto z-30 divide-y divide-slate-100">
                    {(() => {
                      const q = studentSearch.trim().toLowerCase();
                      const results = students.filter(s =>
                        s.full_name.toLowerCase().includes(q) ||
                        s.roll_number.toLowerCase().includes(q) ||
                        s.student_unique_id.toLowerCase().includes(q) ||
                        s.father_name.toLowerCase().includes(q) ||
                        s.class_name.toLowerCase().includes(q)
                      );

                      if (results.length === 0) {
                        return (
                          <div className="p-4 text-center text-xs font-bold text-slate-400">
                            No student found matching "{studentSearch}". Try Roll #, Name, or Class.
                          </div>
                        );
                      }

                      return results.slice(0, 10).map(stu => (
                        <button
                          key={stu.id}
                          type="button"
                          onClick={() => handleSelectStudent(stu)}
                          className="w-full px-4 py-2.5 text-left hover:bg-indigo-50/60 flex items-center justify-between transition-colors cursor-pointer"
                        >
                          <div>
                            <p className="text-xs font-black text-slate-900 uppercase">{stu.full_name}</p>
                            <p className="text-[10px] font-bold text-slate-500">Class: <span className="text-indigo-600 font-black">{stu.class_name}</span> · Roll #{stu.roll_number} · S/O {stu.father_name}</p>
                          </div>
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[10px] font-mono font-black border border-indigo-100">
                            Adm #{stu.student_unique_id}
                          </span>
                        </button>
                      ));
                    })()}
                  </div>
                )}
              </div>

              {/* Selected Student Profile Banner */}
              {selectedStudent ? (
                <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-100 flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm uppercase shadow-sm">
                      {selectedStudent.full_name.slice(0, 2)}
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 uppercase">{selectedStudent.full_name}</h3>
                      <p className="text-xs font-bold text-slate-600">
                        Class: <span className="text-indigo-700">{selectedStudent.class_name}</span> | Roll #{selectedStudent.roll_number}
                      </p>
                      <p className="text-[11px] font-bold text-slate-400">
                        Father: {selectedStudent.father_name} · WhatsApp: {selectedStudent.whatsapp_number || 'None'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedStudent(null)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-2xl">
                  <Users className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                  <p className="text-xs font-bold text-slate-400">Search and select a student above to proceed</p>
                </div>
              )}

              {/* Form Details */}
              <form onSubmit={handleIssuePass} className="space-y-4 pt-2 border-t">
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-600" />
                  2. Collector & Authorization Details
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Person Collecting */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      Person Collecting
                    </label>
                    <select
                      value={collectorRelation}
                      onChange={e => setCollectorRelation(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="Father">Father</option>
                      <option value="Mother">Mother</option>
                      <option value="Brother / Sister">Brother / Sister</option>
                      <option value="Family Driver / Guardian">Family Driver / Guardian</option>
                      <option value="Relative / Uncle / Aunt">Relative / Uncle / Aunt</option>
                      <option value="Self (Senior Student)">Self (Senior Student)</option>
                    </select>
                  </div>

                  {/* Collector Name */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      Collector Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={collectorName}
                      onChange={e => setCollectorName(e.target.value)}
                      placeholder="e.g. Muhammad Imran"
                      className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Collector CNIC */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      Collector CNIC (Optional / Security)
                    </label>
                    <input
                      type="text"
                      value={collectorCnic}
                      onChange={e => setCollectorCnic(e.target.value)}
                      placeholder="35202-XXXXXXX-X"
                      className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Collector Contact Phone */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      Contact Phone *
                    </label>
                    <input
                      type="text"
                      required
                      value={collectorPhone}
                      onChange={e => setCollectorPhone(e.target.value)}
                      placeholder="0300-1234567"
                      className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Reason for Early Departure */}
                  <div className="space-y-1 sm:col-span-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      Reason for Early Departure *
                    </label>
                    <select
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {REASONS.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  {reason === 'Other Urgent Reason' && (
                    <div className="space-y-1 sm:col-span-2">
                      <label className="block text-[10px] font-black text-rose-600 uppercase tracking-wider">
                        Specify Reason
                      </label>
                      <input
                        type="text"
                        required
                        value={customReason}
                        onChange={e => setCustomReason(e.target.value)}
                        placeholder="State reason clearly..."
                        className="w-full px-3 py-2 text-xs font-bold bg-rose-50/40 border border-rose-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500"
                      />
                    </div>
                  )}

                  {/* Departure Timestamp */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      Exit Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={exitDateTime}
                      onChange={e => setExitDateTime(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Authorized By */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      Authorized By
                    </label>
                    <input
                      type="text"
                      value={authorizedBy}
                      onChange={e => setAuthorizedBy(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={submitting || !selectedStudent}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    {submitting ? 'Issuing Pass...' : 'Issue & Print Gate Pass'}
                  </button>
                </div>
              </form>
            </Card>
          </div>

          {/* ── Right Column: Live Printable Slip Preview ── */}
          <div className="lg:col-span-4 space-y-4">
            <Card className="p-5 shadow-sm border-slate-200/80 space-y-3 bg-slate-50/50">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center justify-between">
                <span>🎫 Gate Slip Preview</span>
                {activePrintPass && (
                  <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-black">
                    {activePrintPass.pass_number}
                  </span>
                )}
              </h3>

              {activePrintPass ? (
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3 text-xs">
                  <div className="text-center border-b pb-2">
                    <h4 className="font-black text-slate-900 uppercase">{schoolInfo?.name || 'School'}</h4>
                    <p className="text-[10px] font-bold text-slate-400">STUDENT EARLY EXIT GATE PASS</p>
                  </div>

                  <div className="space-y-1 text-[11px]">
                    <p><strong>Student:</strong> {activePrintPass.student_name}</p>
                    <p><strong>Class:</strong> {activePrintPass.class_name} | <strong>Roll:</strong> {activePrintPass.roll_number}</p>
                    <p><strong>Collector:</strong> {activePrintPass.collector_name} ({activePrintPass.collector_relation})</p>
                    <p><strong>CNIC:</strong> {activePrintPass.collector_cnic || '—'}</p>
                    <p><strong>Reason:</strong> {activePrintPass.reason}</p>
                    <p><strong>Time:</strong> {formatDateTime(activePrintPass.exit_datetime)}</p>
                  </div>

                  <div className="pt-2 border-t flex items-center gap-2">
                    <Btn variant="primary" size="sm" onClick={() => handlePrintSlip(activePrintPass)} className="flex-1 text-xs">
                      <Printer className="w-3.5 h-3.5 mr-1" /> Print Slip
                    </Btn>
                    <button
                      onClick={() => sendParentWhatsApp(activePrintPass)}
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-bold text-xs flex items-center gap-1 shadow-xs"
                      title="Send WhatsApp Confirmation"
                    >
                      <Send className="w-3.5 h-3.5" /> WhatsApp
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-16 text-center text-slate-400 text-xs font-bold">
                  Fill the form and click Issue to preview and print the official gate pass.
                </div>
              )}
            </Card>
          </div>

        </div>
      ) : (
        /* ── Gate Pass Register Tab ── */
        <Card className="p-4 shadow-sm border-slate-200/80 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <label className="text-xs font-black text-slate-800 uppercase">Register Date:</label>
              <input
                type="date"
                value={filterDate}
                onChange={e => setFilterDate(e.target.value)}
                className="px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none"
              />
            </div>

            <span className="text-xs font-bold text-slate-500">
              Total {filteredRegister.length} Departures Logged for {formatDate(filterDate)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-[#0d1526] text-white">
                <tr>
                  <th className="px-3 py-3 font-black text-slate-400 text-[10px] uppercase">Pass #</th>
                  <th className="px-3 py-3 font-black text-slate-300 text-[10px] uppercase">Student Name</th>
                  <th className="px-3 py-3 font-black text-slate-300 text-[10px] uppercase">Class & Roll</th>
                  <th className="px-3 py-3 font-black text-slate-300 text-[10px] uppercase">Collected By</th>
                  <th className="px-3 py-3 font-black text-slate-300 text-[10px] uppercase">Reason</th>
                  <th className="px-3 py-3 font-black text-slate-300 text-[10px] uppercase">Exit Time</th>
                  <th className="px-3 py-3 font-black text-slate-400 text-[10px] uppercase text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRegister.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400 font-bold">
                      No gate passes issued on {formatDate(filterDate)}.
                    </td>
                  </tr>
                ) : (
                  filteredRegister.map(pass => (
                    <tr key={pass.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 font-mono font-black text-indigo-700">{pass.pass_number}</td>
                      <td className="px-3 py-2.5 font-black text-slate-900 uppercase">{pass.student_name}</td>
                      <td className="px-3 py-2.5 font-bold text-slate-600">{pass.class_name} (Roll #{pass.roll_number})</td>
                      <td className="px-3 py-2.5 font-bold text-slate-800">
                        {pass.collector_name} ({pass.collector_relation})
                        <span className="block text-[9px] text-slate-400 font-mono">{pass.collector_cnic || pass.collector_phone}</span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">{pass.reason}</td>
                      <td className="px-3 py-2.5 font-mono text-slate-700">{formatDateTime(pass.exit_datetime)}</td>
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handlePrintSlip(pass)}
                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Print Slip"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => sendParentWhatsApp(pass)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Send WhatsApp"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
