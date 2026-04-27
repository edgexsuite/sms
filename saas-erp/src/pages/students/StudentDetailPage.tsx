import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';
import {
  ArrowLeft, Printer, User, BookOpen, Calendar, CreditCard, BarChart3,
  Phone, MapPin, Heart, Shield, CheckCircle, XCircle, Clock, Award,
  TrendingUp, AlertCircle, Download, Plus, ChevronRight, MoreVertical, Users,
  Wallet, X as XIcon, Loader2,
} from 'lucide-react';
import StudentFeeModal from '../../components/StudentFeeModal';
import StudentFeeOverrideModal from '../../components/StudentFeeOverrideModal';
import { downloadChallanPDF, DEFAULT_CHALLAN_CONFIG, type ChallanRecord, type SchoolInfo } from '../../lib/challanUtils';

const PAY_MODES = ['Cash', 'Cheque', 'Bank Transfer', 'JazzCash', 'EasyPaisa', 'Online'];

type DetailTab = 'overview' | 'attendance' | 'fees' | 'results';

const STATUS_COLOR: Record<string, string> = {
  present: 'bg-emerald-500',
  absent: 'bg-rose-500',
  late: 'bg-amber-400',
  leave: 'bg-blue-400',
};

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);

  // Roles with full write access — teachers/staff are read-only
  const ADMIN_ROLES = ['admin', 'principal', 'director', 'accountant', 'staff'];
  const isReadOnly = !ADMIN_ROLES.includes((userRole?.role || '').toLowerCase());

  const [student, setStudent] = useState<any | null>(null);
  const [parent, setParent] = useState<any | null>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [fees, setFees] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [tab, setTab] = useState<DetailTab>('overview');
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [showFeeOverrideModal, setShowFeeOverrideModal] = useState(false);
  const [siblings, setSiblings] = useState<any[]>([]);
  const [ledgerSummary, setLedgerSummary] = useState({ total: 0, paid: 0, balance: 0 });
  const fetchedTabs = useRef<Set<string>>(new Set());

  // Inline fee collection
  const [collectingFee, setCollectingFee] = useState<any | null>(null); // the fee_record being collected
  const [collectAmount, setCollectAmount] = useState('');
  const [collectMode, setCollectMode] = useState('Cash');
  const [collectDate, setCollectDate] = useState(new Date().toISOString().split('T')[0]);
  const [collectSaving, setCollectSaving] = useState(false);
  const [school, setSchool] = useState<any>(null);

  // Edit Fee Record State
  const [editingFee, setEditingFee] = useState<any | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({ total_amount: '', paid_amount: '', paid_at: '', month_year: '' });

  useEffect(() => {
    if (userRole?.school_id) {
      supabase.from('schools').select('name,logo_url,address,contact_phone').eq('id', userRole.school_id).maybeSingle().then(({ data }) => setSchool(data));
    }
  }, [userRole?.school_id]);

  // Fetch student on mount
  useEffect(() => {
    if (id) fetchStudent();
  }, [id]);

  // Fetch tab data on tab switch
  useEffect(() => {
    if (student && !fetchedTabs.current.has(tab)) {
      fetchedTabs.current.add(tab);
      fetchTab(tab);
    }
  }, [tab, student]);

  const fetchStudent = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('students')
      .select('*, classes(id, name, section)')
      .eq('id', id)
      .single();
    if (error || !data) { setLoading(false); return; }
    setStudent(data);
    setLoading(false);
    // Pre-fetch overview tab
    if (!fetchedTabs.current.has('overview')) {
      fetchedTabs.current.add('overview');
      fetchTab('overview', data);
    }
  };

  const fetchTab = async (t: DetailTab, s?: any) => {
    const stud = s || student;
    if (!stud) return;
    setTabLoading(true);
    try {
      if (t === 'overview' && stud.parent_id) {
        const { data: pData } = await supabase.from('parents').select('*').eq('id', stud.parent_id).maybeSingle();
        setParent(pData || null);
        
        // Fetch Siblings
        const { data: sData } = await supabase.from('students')
          .select('id, full_name, photograph_url, class_id, classes(name, section)')
          .eq('parent_id', stud.parent_id)
          .neq('id', stud.id);
        setSiblings(sData || []);
      }
      if (t === 'fees') {
        const { data } = await supabase.from('fee_records').select('*')
          .eq('student_id', stud.id).order('month_year', { ascending: false });
        setFees(data || []);
        
        const total = data?.reduce((acc, f) => acc + (f.total_amount || 0), 0) || 0;
        const paid = data?.reduce((acc, f) => acc + (f.paid_amount || 0), 0) || 0;
        setLedgerSummary({ total, paid, balance: Math.max(0, total - paid) });
      }
      if (t === 'results') {
        const { data } = await supabase.from('exam_results')
          .select('*, exam_types(name), subjects(subject_name)')
          .eq('student_id', stud.id).order('created_at', { ascending: false });
        setResults(data || []);
      }
    } finally {
      setTabLoading(false);
    }
  };

  const handlePrint = () => window.print();

  // Derived stats
  const attSummary = attendance.reduce((a, r) => {
    if (r.status === 'present') a.present++;
    else if (r.status === 'absent') a.absent++;
    else if (r.status === 'late') a.late++;
    else if (r.status === 'leave') a.leave++;
    return a;
  }, { present: 0, absent: 0, late: 0, leave: 0 });
  const attTotal = attSummary.present + attSummary.absent + attSummary.late + attSummary.leave;
  const attPct = attTotal > 0 ? Math.round((attSummary.present / attTotal) * 100) : 0;

  const totalDue = fees.reduce((s, f) => s + Math.max(0, (f.total_amount || 0) - (f.paid_amount || 0)), 0);
  const totalPaid = fees.reduce((s, f) => s + (f.paid_amount || 0), 0);

  const groupedResults: Record<string, any[]> = {};
  results.forEach(r => {
    const k = r.exam_types?.name || 'Exam';
    if (!groupedResults[k]) groupedResults[k] = [];
    groupedResults[k].push(r);
  });

  const gradeLabel = (pct: number) => {
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B';
    if (pct >= 60) return 'C';
    if (pct >= 50) return 'D';
    return 'F';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 text-sm">Loading student profile...</p>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-slate-700 font-bold">Student not found</p>
          <button onClick={() => navigate(-1)} className="mt-4 text-indigo-600 text-sm font-bold">← Go Back</button>
        </div>
      </div>
    );
  }

  const cls = student.classes as any;

  // Refresh fees tab after modal save
  const handleFeeModalSave = () => {
    fetchedTabs.current.delete('fees');
    fetchTab('fees');
  };

  // Collect payment against an existing invoice
  const handleCollectSave = async () => {
    if (!collectingFee || !student) return;
    const amt = parseFloat(collectAmount);
    const balance = Math.max(0, (collectingFee.total_amount || 0) - (collectingFee.paid_amount || 0));
    if (!amt || amt <= 0) return alert('Enter a valid amount.');
    if (amt > balance + 0.01) return alert(`Amount cannot exceed balance (Rs. ${balance.toLocaleString()}).`);

    setCollectSaving(true);
    try {
      const newPaid = (collectingFee.paid_amount || 0) + amt;
      const newStatus: string = newPaid >= (collectingFee.total_amount || 0) ? 'paid' : 'partial';

      const { error: recErr } = await supabase.from('fee_records').update({
        paid_amount: newPaid,
        status: newStatus,
        payment_mode: collectMode,
        paid_at: collectDate + 'T12:00:00Z',
      }).eq('id', collectingFee.id);
      if (recErr) throw recErr;

      await supabase.from('financial_transactions').insert({
        school_id: userRole!.school_id,
        type: 'income',
        category: 'Fee Collection',
        amount: amt,
        date: collectDate,
        payment_mode: collectMode,
        remarks: `Fee — ${student.full_name} (${collectingFee.invoice_number || collectingFee.id.slice(0,8)})`,
      });

      // Print challan receipt
      const cls = student.classes as any;
      const record: ChallanRecord = {
        id: collectingFee.id,
        invoice_number: collectingFee.invoice_number,
        month_year: collectingFee.month_year,
        due_date: collectingFee.due_date,
        total_amount: collectingFee.total_amount,
        paid_amount: newPaid,
        status: newStatus,
        breakdown: (collectingFee.breakdown || []).map((b: any) => ({ item: b.item, amount: Number(b.amount) })),
        student_name: student.full_name,
        roll_number: student.roll_number,
        class_name: cls ? `${cls.name}${cls.section ? ' - ' + cls.section : ''}` : '',
        issue_date: collectDate,
      };
      const schoolInfo: SchoolInfo = {
        name: school?.name || 'School',
        address: school?.address,
        contact_phone: school?.contact_phone,
        logo_url: school?.logo_url,
      };
      downloadChallanPDF([record], schoolInfo, { ...DEFAULT_CHALLAN_CONFIG, copies: 1 });

      setCollectingFee(null);
      setCollectAmount('');
      setCollectMode('Cash');
      setCollectDate(new Date().toISOString().split('T')[0]); // Reset
      handleFeeModalSave();
    } catch (err: any) {
      alert(err.message || 'Payment failed.');
    } finally {
      setCollectSaving(false);
    }
  };

  const openEditFee = (f: any) => {
    setEditingFee(f);
    setEditForm({
      total_amount: String(f.total_amount),
      paid_amount: String(f.paid_amount),
      paid_at: f.paid_at ? f.paid_at.split('T')[0] : '',
      month_year: f.month_year.slice(0, 7)
    });
  };

  const handleUpdateFeeRecord = async () => {
    if (!editingFee) return;
    setEditSaving(true);
    try {
      const { error } = await supabase.from('fee_records').update({
        total_amount: parseFloat(editForm.total_amount),
        paid_amount: parseFloat(editForm.paid_amount),
        paid_at: editForm.paid_at ? editForm.paid_at + 'T12:00:00Z' : null,
        month_year: editForm.month_year + '-01',
        status: parseFloat(editForm.paid_amount) >= parseFloat(editForm.total_amount) ? 'paid' : (parseFloat(editForm.paid_amount) > 0 ? 'partial' : 'pending')
      }).eq('id', editingFee.id);

      if (error) throw error;
      setEditingFee(null);
      handleFeeModalSave();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <>
      {/* Fee Invoice Modal */}
      {showFeeModal && student && (
        <StudentFeeModal
          student={{
            id: student.id,
            full_name: student.full_name,
            class_id: student.class_id,
            roll_number: student.roll_number,
            fee_waiver_percentage: student.fee_waiver_percentage,
            fee_override: student.fee_override,
            classes: student.classes,
          }}
          onSave={handleFeeModalSave}
          onClose={() => setShowFeeModal(false)}
        />
      )}

      {/* ── Inline Collect Payment Modal ── */}
      {collectingFee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-white font-black text-sm leading-none">Collect Payment</h2>
                <p className="text-emerald-200 text-xs mt-1">{student?.full_name} · {collectingFee.invoice_number || 'Invoice'}</p>
              </div>
              <button onClick={() => setCollectingFee(null)} className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition">
                <XIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              {/* Invoice summary */}
              <div className="bg-slate-50 rounded-2xl p-4 space-y-2 text-sm">
                <div className="flex justify-between text-slate-500">
                  <span>Month</span>
                  <span className="font-semibold text-slate-800">
                    {collectingFee.month_year ? new Date(collectingFee.month_year).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Invoice Total</span>
                  <span className="font-semibold">Rs. {(collectingFee.total_amount || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Already Paid</span>
                  <span className="font-semibold text-emerald-600">Rs. {(collectingFee.paid_amount || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 font-black text-rose-600">
                  <span>Balance Due</span>
                  <span>Rs. {Math.max(0, (collectingFee.total_amount || 0) - (collectingFee.paid_amount || 0)).toLocaleString()}</span>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Amount Collecting (Rs.)</label>
                <input
                  type="number" min="1" step="1"
                  value={collectAmount}
                  onChange={e => setCollectAmount(e.target.value)}
                  placeholder={String(Math.max(0, (collectingFee.total_amount || 0) - (collectingFee.paid_amount || 0)))}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-lg font-bold font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Payment Date</label>
                <input
                  type="date"
                  value={collectDate}
                  onChange={e => setCollectDate(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Payment mode */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Payment Mode</label>
                <div className="flex flex-wrap gap-2">
                  {PAY_MODES.map(m => (
                    <button key={m} type="button" onClick={() => setCollectMode(m)}
                      className={cn('px-3 py-1.5 rounded-lg text-xs font-bold border transition',
                        collectMode === m ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setCollectingFee(null)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition">
                Cancel
              </button>
              <button onClick={handleCollectSave} disabled={collectSaving || !collectAmount}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-black transition flex items-center justify-center gap-2">
                {collectSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                Collect & Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fee Override Modal */}
      {showFeeOverrideModal && student && (
        <StudentFeeOverrideModal
          student={{
            id: student.id,
            full_name: student.full_name,
            class_id: student.class_id,
            fee_waiver_percentage: student.fee_waiver_percentage,
            classes: student.classes,
          }}
          onSave={() => fetchStudent()}
          onClose={() => setShowFeeOverrideModal(false)}
        />
      )}

      {/* Print Styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .hero-banner { 
            background: white !important; 
            color: black !important; 
            border: 2px solid #0f172a !important;
            border-radius: 24px !important;
            padding: 40px !important;
            margin-bottom: 40px !important;
            overflow: visible !important;
          }
          .hero-banner * { color: black !important; background: transparent !important; }
          .hero-gradient-text { color: black !important; -webkit-text-fill-color: black !important; }
          .tab-content { display: block !important; overflow: visible !important; }
          body, #root, main, .theme-shell { background: white !important; overflow: visible !important; height: auto !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; overflow: visible !important; }
          table { width: 100% !important; border-collapse: collapse !important; }
          th, td { border-bottom: 1px solid #e2e8f0 !important; }
          .print-card { 
            border: 1px solid #e2e8f0 !important; 
            border-radius: 12px !important;
            break-inside: avoid;
            background: white !important;
            padding: 24px !important;
            margin-bottom: 24px !important;
            overflow: visible !important;
            height: auto !important;
          }
        }
        @media screen {
          .print-only { display: none !important; }
        }
      `}</style>

      <div ref={printRef} className="min-h-screen bg-slate-50">

        {/* ── Sticky Back + Print Topbar ── */}
        <div className="no-print sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100 px-4 py-2.5 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-xs font-black text-slate-500 hover:text-indigo-600 uppercase tracking-widest transition-all">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex items-center gap-3">
            {isReadOnly && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-black uppercase tracking-widest">
                <Shield className="w-3 h-3" /> View Only
              </span>
            )}
            <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:border-indigo-300 hover:text-indigo-600 transition shadow-sm">
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
          </div>
        </div>

        {/* ── Ledger Summary Bar (SkoolZoom Style) ── */}
        <div className="no-print bg-white border-b border-slate-200 px-6 py-3 py-print-0 flex gap-4 overflow-x-auto custom-scrollbar shadow-inner">
           {[
             { label: 'Total Fees', val: ledgerSummary.total, color: 'text-slate-900', icon: CreditCard },
             { label: 'Received', val: ledgerSummary.paid, color: 'text-emerald-600', icon: CheckCircle },
             { label: 'Total Balance', val: ledgerSummary.balance, color: 'text-rose-600', icon: AlertCircle },
           ].map(item => (
             <div key={item.label} className="min-w-[150px] flex items-center gap-3 px-4 py-1.5 rounded-xl border border-slate-100 bg-slate-50/50">
               <div className={cn("p-1.5 rounded-lg bg-white shadow-sm", item.color)}>
                 <item.icon className="w-3.5 h-3.5" />
               </div>
               <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none text-print-xs">{item.label}</p>
                  <p className={cn("text-[13px] font-black mt-0.5", item.color)}>PKR {item.val.toLocaleString()}</p>
               </div>
             </div>
           ))}
        </div>

        {/* ── Official Print Header ── */}
        <div className="print-only mb-10 pb-8 border-b-2 border-slate-900 flex justify-between items-center text-slate-900">
          <div className="flex items-center gap-6">
            {userRole?.schools?.logo_url && (
              <img src={userRole.schools.logo_url} alt="School Logo" className="w-16 h-16 object-contain rounded-xl border border-slate-200 p-2" />
            )}
            <div>
              <h2 className="text-3xl font-black uppercase tracking-tighter">{userRole?.schools?.name || 'Academic Institution'}</h2>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-2">Official Student Identification Record</p>
              {userRole?.schools?.address && <p className="text-[10px] text-slate-400 mt-1">{userRole.schools.address}</p>}
            </div>
          </div>
          <div className="text-right">
            <div className="bg-slate-100 px-4 py-2 rounded-xl inline-block mb-3 border border-slate-200">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-900">Registration Number</p>
              <p className="text-xs font-mono font-bold mt-1 uppercase">{student.student_unique_id || id?.substring(0, 12)}</p>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Printed: {new Date().toLocaleDateString()}</p>
          </div>
        </div>

        {/* ── Hero Banner ── */}
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-6 py-10 hero-banner">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {student.photograph_url ? (
              <img src={student.photograph_url} alt={student.full_name}
                className="w-28 h-28 rounded-3xl object-cover border-4 border-white/20 shadow-2xl shrink-0" />
            ) : (
              <div className="w-28 h-28 rounded-3xl bg-indigo-600/40 border-4 border-indigo-400/30 flex items-center justify-center text-5xl font-black text-white shadow-2xl shrink-0">
                {student.full_name?.charAt(0)?.toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className={cn('px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-lg text-white',
                  student.status === 'active' ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-slate-500 shadow-slate-500/20'
                )}>
                  {student.status === 'active' ? 'active' : student.status}
                </span>
                {student.fee_waiver_percentage >= 100 && (
                  <span className="px-3 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 animate-pulse">
                    <CheckCircle className="w-3 h-3" /> Free Student
                  </span>
                )}
                {student.fee_waiver_percentage > 0 && student.fee_waiver_percentage < 100 && (
                  <span className="px-3 py-1 rounded-full bg-amber-500 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-amber-500/20">
                    {student.fee_waiver_percentage}% Scholarship
                  </span>
                )}
                {cls && <span className="px-3 py-1 rounded-full bg-indigo-500/30 text-indigo-200 text-xs font-bold">{cls.name} – {cls.section}</span>}
                {student.roll_number && <span className="text-indigo-300 text-sm font-bold">Roll #{student.roll_number}</span>}
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">{student.full_name}</h1>
              <div className="flex flex-wrap gap-4 mt-3 text-slate-400 text-sm">
                {student.gender && <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{student.gender}</span>}
                {student.dob && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />DOB: {student.dob}</span>}
                {student.admission_date && <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" />Admitted: {student.admission_date}</span>}
                {student.blood_group && <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-red-400" />{student.blood_group}</span>}
              </div>
              {/* Credentials */}
              {student.student_unique_id && (
                <div className="mt-4 inline-flex items-center gap-4 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5">
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest">Login ID</p>
                    <p className="text-xs font-black text-white font-mono">{student.student_unique_id}</p>
                  </div>
                  <div className="border-l border-white/10 pl-4">
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest">Password</p>
                    <p className="text-xs font-black text-white font-mono">{student.auth_password || '—'}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Quick stats */}
            <div className="hidden sm:grid grid-cols-3 gap-3 shrink-0">
              {[
                { label: 'Attendance', value: attPct + '%', color: attPct >= 75 ? 'text-emerald-400' : 'text-rose-400' },
                { label: 'Outstanding', value: 'PKR ' + totalDue.toLocaleString(), color: totalDue > 0 ? 'text-rose-400' : 'text-emerald-400' },
                { label: 'Results', value: results.length + ' marks', color: 'text-indigo-400' },
              ].map(stat => (
                <div key={stat.label} className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">{stat.label}</p>
                  <p className={`text-sm font-black ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Tab Navigation ── */}
        <div className="no-print bg-white border-b border-slate-200">
          <div className="max-w-6xl mx-auto flex overflow-x-auto custom-scrollbar">
            {([
              { key: 'overview', label: 'Overview', icon: User },
              { key: 'attendance', label: 'Attendance', icon: Calendar },
              { key: 'fees', label: 'Fees & Payments', icon: CreditCard },
              { key: 'results', label: 'Exam Results', icon: BarChart3 },
            ] as { key: DetailTab; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setTab(key)}
                className={cn('flex items-center gap-2 px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm whitespace-nowrap font-bold border-b-2 transition-all',
                  tab === key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700')}>
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab Content ── */}
        <div className="max-w-6xl mx-auto px-6 py-8">
          {tabLoading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!tabLoading && tab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Personal Info */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <h2 className="text-xs font-black text-indigo-600 uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
                  <User className="w-3.5 h-3.5" /> Personal Information
                </h2>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                  {[
                    { label: 'Full Name', val: student.full_name },
                    { label: 'Roll No', val: student.roll_number ? `#${student.roll_number}` : '—' },
                    { label: 'Date of Birth', val: student.dob || '—' },
                    { label: 'Gender', val: student.gender || '—' },
                    { label: 'Religion', val: student.religion || '—' },
                    { label: 'Nationality', val: student.nationality || '—' },
                    { label: 'Blood Group', val: student.blood_group || '—' },
                    { label: 'B-Form/CNIC', val: student.b_form_cnic || '—' },
                  ].map(({ label, val }) => (
                    <div key={label}>
                      <dt className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</dt>
                      <dd className="font-bold text-slate-800 mt-0.5">{val}</dd>
                    </div>
                  ))}
                  <div className="col-span-2">
                    <dt className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Address</dt>
                    <dd className="font-medium text-slate-700 mt-0.5">{student.address || '—'}</dd>
                  </div>
                </dl>
              </div>

              {/* Parent / Family */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <h2 className="text-xs font-black text-slate-600 uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5" /> Parent & Family
                </h2>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                  {[
                    { label: "Father's Name", val: parent?.father_name || student.father_name || '—' },
                    { label: "Mother's Name", val: parent?.mother_name || student.mother_name || '—' },
                    { label: 'WhatsApp', val: parent?.whatsapp_number || '—' },
                    { label: 'Primary Contact', val: parent?.father_contact || student.father_contact || '—' },
                    { label: 'Secondary Contact', val: parent?.mother_contact || student.mother_contact || '—' },
                    { label: 'Email', val: parent?.email || '—' },
                  ].map(({ label, val }) => (
                    <div key={label}>
                      <dt className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</dt>
                      <dd className="font-bold text-slate-800 mt-0.5">{val}</dd>
                    </div>
                  ))}
                  {parent && (
                    <>
                      <div className="col-span-2 mt-2 pt-4 border-t border-slate-100">
                        <h3 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-3">Parent Login</h3>
                        <div className="flex items-center gap-4 bg-slate-50 rounded-xl px-4 py-3">
                          <div>
                            <p className="text-[9px] text-slate-400 uppercase tracking-widest">Family ID</p>
                            <p className="text-sm font-black text-slate-800 font-mono">{parent.family_number || '—'}</p>
                          </div>
                          <div className="border-l border-slate-200 pl-4">
                            <p className="text-[9px] text-slate-400 uppercase tracking-widest">Password</p>
                            <p className="text-sm font-black text-slate-800 font-mono">{parent.auth_password || '—'}</p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </dl>
              </div>

              {/* Sibling Listing Card */}
              {siblings.length > 0 && (
                <div className="bg-[#0f172a] rounded-2xl p-6 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-3 opacity-10">
                    <Users className="w-12 h-12 text-white" />
                  </div>
                  <h2 className="text-xs font-black text-indigo-300 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <Users className="w-3.5 h-3.5" /> Siblings Cross-Reference
                  </h2>
                  <div className="space-y-3">
                    {siblings.map(s => (
                      <div key={s.id} onClick={() => navigate(`/students/detail/${s.id}`)} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer group">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center font-black text-indigo-300 border border-indigo-500/30">
                            {s.full_name?.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-black text-white uppercase tracking-tight">{s.full_name}</p>
                            <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest">{s.classes?.name} {s.classes?.section}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white transition-all transform group-hover:translate-x-1" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Medical */}
              {(student.medical_caution || student.emergency_doctor_name) && (
                <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6">
                  <h2 className="text-xs font-black text-rose-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <Heart className="w-3.5 h-3.5" /> Medical & Emergency
                  </h2>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                    {[
                      { label: 'Medical Caution', val: student.medical_caution || '—' },
                      { label: 'Emergency Doctor', val: student.emergency_doctor_name || '—' },
                      { label: 'Doctor Phone', val: student.emergency_doctor_phone || '—' },
                    ].map(({ label, val }) => (
                      <div key={label}>
                        <dt className="text-[10px] font-black text-rose-400 uppercase tracking-widest">{label}</dt>
                        <dd className="font-bold text-slate-800 mt-0.5">{val}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}



              {/* Financial & Scholarship Status */}
              {userRole?.role === 'admin' && (
                <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-6 relative overflow-hidden group hover:border-indigo-300 transition-colors">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <CreditCard className="w-12 h-12 text-indigo-600" />
                  </div>
                  <h2 className="text-xs font-black text-indigo-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                    <CreditCard className="w-3.5 h-3.5" /> Financial & Scholarship Status
                  </h2>
                  
                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                          student.fee_waiver_percentage >= 100 ? "bg-emerald-100 text-emerald-600" : "bg-slate-200 text-slate-500"
                        )}>
                          <CheckCircle className="w-5 h-5 text-current" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-800 uppercase tracking-tight">Full Fee Waiver</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">Make Student Free</p>
                        </div>
                      </div>
                      <button 
                        onClick={async () => {
                          const newVal = student.fee_waiver_percentage >= 100 ? 0 : 100;
                          const { error } = await supabase.from('students').update({ fee_waiver_percentage: newVal }).eq('id', student.id);
                          if (!error) setStudent({ ...student, fee_waiver_percentage: newVal });
                        }}
                        className={cn(
                          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                          student.fee_waiver_percentage >= 100 ? "bg-emerald-500" : "bg-slate-200"
                        )}
                      >
                        <span className={cn(
                          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                          student.fee_waiver_percentage >= 100 ? "translate-x-5" : "translate-x-0"
                        )} />
                      </button>
                    </div>

                    <div className="pt-2">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Custom Scholarship Percentage</label>
                      <div className="flex items-center gap-4">
                        <input 
                          type="range" min="0" max="100" step="1"
                          value={student.fee_waiver_percentage || 0}
                          onChange={async (e) => {
                            const val = parseInt(e.target.value);
                            setStudent({ ...student, fee_waiver_percentage: val });
                          }}
                          onMouseUp={async (e: any) => {
                            const val = parseInt(e.target.value);
                            await supabase.from('students').update({ fee_waiver_percentage: val }).eq('id', student.id);
                          }}
                          className="flex-1 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                        <div className="w-16 h-10 flex items-center justify-center bg-indigo-50 border border-indigo-100 rounded-xl font-black text-indigo-600 tracking-tighter">
                          {student.fee_waiver_percentage || 0}%
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-3 italic leading-relaxed">Adjusting this percentage will automatically recalibrate all future fee invoices for this student.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {!tabLoading && tab === 'attendance' && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                {[
                  { label: 'Present', val: attSummary.present, bg: 'bg-emerald-50 border-emerald-200', color: 'text-emerald-700' },
                  { label: 'Absent', val: attSummary.absent, bg: 'bg-rose-50 border-rose-200', color: 'text-rose-700' },
                  { label: 'Late', val: attSummary.late, bg: 'bg-amber-50 border-amber-200', color: 'text-amber-700' },
                  { label: 'Leave', val: attSummary.leave, bg: 'bg-blue-50 border-blue-200', color: 'text-blue-700' },
                  { label: 'Attendance %', val: attPct + '%', bg: attPct >= 75 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200', color: attPct >= 75 ? 'text-emerald-700' : 'text-rose-700' },
                ].map(s => (
                  <div key={s.label} className={`rounded-2xl border p-5 text-center ${s.bg}`}>
                    <p className="text-3xl font-black mb-1 ${s.color} ">
                      <span className={s.color}>{s.val}</span>
                    </p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Calendar heat map — last 90 days */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <h3 className="text-sm font-black text-slate-700 mb-4">Last 90 Days</h3>
                <div className="flex flex-wrap gap-1.5">
                  {[...Array(90)].map((_, idx) => {
                    const d = new Date(); d.setDate(d.getDate() - (89 - idx));
                    const dateStr = d.toISOString().slice(0, 10);
                    const rec = attendance.find(r => r.date === dateStr);
                    return (
                      <div key={dateStr} title={`${dateStr}: ${rec ? rec.status : 'no record'}`}
                        className={cn('w-5 h-5 rounded-sm cursor-default transition-transform hover:scale-125',
                          rec ? (STATUS_COLOR[rec.status] || 'bg-slate-300') : 'bg-slate-100')} />
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 mt-4">
                  {[
                    { color: 'bg-emerald-500', label: 'Present' },
                    { color: 'bg-rose-500', label: 'Absent' },
                    { color: 'bg-amber-400', label: 'Late' },
                    { color: 'bg-blue-400', label: 'Leave' },
                    { color: 'bg-slate-100', label: 'No Record' },
                  ].map(l => (
                    <div key={l.label} className="flex items-center gap-1.5">
                      <div className={cn('w-3 h-3 rounded-sm', l.color)} />
                      <span className="text-[10px] text-slate-500 font-medium">{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Detail table */}
              {attendance.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        {['Date', 'Day', 'Status', 'Arrival', 'Departure'].map(h => (
                          <th key={h} className="text-left px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {attendance.map(r => (
                        <tr key={r.id} className="hover:bg-slate-50/50">
                          <td className="px-5 py-3 font-medium text-slate-700">{r.date}</td>
                          <td className="px-5 py-3 text-slate-400 text-xs">{new Date(r.date).toLocaleDateString('en-US', { weekday: 'short' })}</td>
                          <td className="px-5 py-3">
                            <span className={cn('px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest',
                              r.status === 'present' ? 'bg-emerald-100 text-emerald-700' :
                              r.status === 'absent' ? 'bg-rose-100 text-rose-700' :
                              r.status === 'late' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700')}>
                              {r.status}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-slate-500 font-mono text-xs">{r.arrival_time || '—'}</td>
                          <td className="px-5 py-3 text-slate-500 font-mono text-xs">{r.departure_time || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {attendance.length === 0 && <p className="text-center text-slate-400 py-10 italic">No attendance records found.</p>}
            </div>
          )}

          {!tabLoading && tab === 'fees' && (
            <div className="space-y-6">

              {/* Action bar */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm font-black text-slate-700">Fee Records</h3>
                {!isReadOnly && (
                  <div className="flex items-center gap-2">
                    {/* Custom fee override indicator */}
                    {student.fee_override && (
                      <span className="text-[10px] font-black text-violet-700 bg-violet-100 px-2 py-1 rounded-full uppercase tracking-widest">
                        Custom Fees Active
                      </span>
                    )}
                    <button
                      onClick={() => setShowFeeOverrideModal(true)}
                      className="flex items-center gap-1.5 px-3 py-2 border border-violet-300 text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-xl text-sm font-bold transition"
                      title="Set custom fee items for this student only"
                    >
                      <CreditCard className="w-4 h-4" />
                      {student.fee_override ? 'Edit Custom Fees' : 'Customize Fees'}
                    </button>
                    <button
                      onClick={() => setShowFeeModal(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition shadow-sm"
                    >
                      <Plus className="w-4 h-4" /> Add Invoice
                    </button>
                  </div>
                )}
              </div>

              {/* Summary banner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Total Paid', val: 'PKR ' + totalPaid.toLocaleString(), color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
                  { label: 'Outstanding', val: 'PKR ' + totalDue.toLocaleString(), color: totalDue > 0 ? 'text-rose-600' : 'text-slate-400', bg: totalDue > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200' },
                  { label: 'Total Records', val: fees.length.toString(), color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200' },
                ].map(s => (
                  <div key={s.label} className={`rounded-2xl border p-5 text-center ${s.bg}`}>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
                    <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
                  </div>
                ))}
              </div>
              {fees.length > 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        {['Month', 'Invoice #', 'Total', 'Paid', 'Balance', 'Status', ''].map(h => (
                          <th key={h} className="text-left px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {fees.map(f => {
                        const bal = Math.max(0, (f.total_amount || 0) - (f.paid_amount || 0));
                        return (
                          <tr key={f.id} className="hover:bg-slate-50/50">
                            <td className="px-5 py-3 font-bold text-slate-800">
                              {f.month_year ? new Date(f.month_year).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'}
                            </td>
                            <td className="px-5 py-3 font-mono text-xs text-slate-400">{f.invoice_number || '—'}</td>
                            <td className="px-5 py-3 font-medium">Rs. {(f.total_amount || 0).toLocaleString()}</td>
                            <td className="px-5 py-3 font-medium text-emerald-600">Rs. {(f.paid_amount || 0).toLocaleString()}</td>
                            <td className="px-5 py-3 font-bold text-rose-600">{bal > 0 ? `Rs. ${bal.toLocaleString()}` : '—'}</td>
                            <td className="px-5 py-3">
                              <span className={cn('px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest',
                                f.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                                f.status === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700')}>
                                {f.status}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                {!isReadOnly && f.status !== 'paid' && bal > 0 && (
                                  <button
                                    onClick={() => {
                                      setCollectingFee(f);
                                      setCollectAmount(String(bal));
                                      setCollectMode('Cash');
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-100 transition"
                                  >
                                    <Wallet className="w-3.5 h-3.5" /> Collect
                                  </button>
                                )}
                                {!isReadOnly && (
                                  <button
                                    onClick={() => openEditFee(f)}
                                    className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-400 hover:text-indigo-600 transition"
                                  >
                                    Edit
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : <p className="text-center text-slate-400 py-10 italic">No fee records found.</p>}
            </div>
          )}

          {!tabLoading && tab === 'results' && (
            <div className="space-y-8">
              {Object.keys(groupedResults).length === 0 ? (
                <p className="text-center text-slate-400 py-10 italic">No exam results found.</p>
              ) : Object.entries(groupedResults).map(([examName, rows]) => {
                const totalObt = rows.reduce((s, r) => s + (r.obtained_marks || 0), 0);
                const totalMax = rows.reduce((s, r) => s + (r.total_marks || 0), 0);
                const pct = totalMax > 0 ? Math.round((totalObt / totalMax) * 100) : 0;
                return (
                  <div key={examName} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="font-black text-slate-800">{examName}</h3>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-slate-500">{totalObt}/{totalMax} ({pct}%)</span>
                        <span className={cn('px-3 py-1 rounded-full text-xs font-black uppercase',
                          pct >= 50 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}>
                          {gradeLabel(pct)} · {pct >= 50 ? 'PASS' : 'FAIL'}
                        </span>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1 bg-slate-100">
                      <div className={cn('h-full transition-all', pct >= 50 ? 'bg-emerald-500' : 'bg-rose-500')} style={{ width: pct + '%' }} />
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-50">
                          {['Subject', 'Obtained', 'Total', '%', 'Grade'].map(h => (
                            <th key={h} className="text-left px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {rows.map(r => {
                          const sp = r.total_marks > 0 ? Math.round((r.obtained_marks / r.total_marks) * 100) : 0;
                          return (
                            <tr key={r.id} className="hover:bg-slate-50/50">
                              <td className="px-5 py-3 font-bold text-slate-800">{r.subjects?.subject_name || '—'}</td>
                              <td className="px-5 py-3 font-medium">{r.obtained_marks ?? '—'}</td>
                              <td className="px-5 py-3 text-slate-400">{r.total_marks ?? '—'}</td>
                              <td className="px-5 py-3 font-bold">{sp}%</td>
                              <td className="px-5 py-3">
                                <span className={cn('px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest',
                                  sp >= 50 ? 'bg-indigo-100 text-indigo-700' : 'bg-rose-100 text-rose-700')}>
                                  {gradeLabel(sp)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Edit Fee Record Modal ── */}
      {editingFee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
              <h2 className="text-white font-black text-sm uppercase tracking-widest">Edit Fee Record</h2>
              <button onClick={() => setEditingFee(null)} className="text-white/60 hover:text-white">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Fee Month</label>
                  <input type="month" value={editForm.month_year} onChange={e => setEditForm({...editForm, month_year: e.target.value})}
                    className="w-full px-3 py-2 border rounded-xl text-sm font-bold" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Payment Date</label>
                  <input type="date" value={editForm.paid_at} onChange={e => setEditForm({...editForm, paid_at: e.target.value})}
                    className="w-full px-3 py-2 border rounded-xl text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Total Fee (Rs)</label>
                  <input type="number" value={editForm.total_amount} onChange={e => setEditForm({...editForm, total_amount: e.target.value})}
                    className="w-full px-3 py-2 border rounded-xl font-mono text-sm font-bold text-slate-800" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Amount Paid (Rs)</label>
                  <input type="number" value={editForm.paid_amount} onChange={e => setEditForm({...editForm, paid_amount: e.target.value})}
                    className="w-full px-3 py-2 border rounded-xl font-mono text-sm font-bold text-emerald-600" />
                </div>
              </div>
              <button onClick={handleUpdateFeeRecord} disabled={editSaving}
                className="w-full py-3 bg-indigo-600 text-white font-black rounded-xl text-sm hover:bg-indigo-700 transition disabled:opacity-50">
                {editSaving ? 'Saving Changes...' : 'Update Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
