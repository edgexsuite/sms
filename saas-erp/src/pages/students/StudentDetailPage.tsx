import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { cn, formatDate } from '../../lib/utils';
import {
  ArrowLeft, Printer, User, BookOpen, Calendar, CreditCard, BarChart3,
  Phone, MapPin, Heart, Shield, CheckCircle, XCircle, Clock, Award,
  TrendingUp, AlertCircle, Download, Plus, ChevronRight, MoreVertical, Users,
  Wallet, X as XIcon, Loader2, Tag, ExternalLink,
} from 'lucide-react';
import { PageHeader, Card, Btn, Badge, Input, Select, EmptyState } from '../../components/ui';
import StudentFeeModal from '../../components/StudentFeeModal';
import StudentFeeOverrideModal from '../../components/StudentFeeOverrideModal';
import { downloadChallanPDF, DEFAULT_CHALLAN_CONFIG, type ChallanRecord, type SchoolInfo } from '../../lib/challanUtils';
import FeeBreakdownEditor, { type BreakdownRow } from '../../components/FeeBreakdownEditor';

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

  // Roles that can see financial and sensitive credential info
  const showFinance = ['admin', 'principal', 'director', 'accountant', 'staff'].includes((userRole?.role || '').toLowerCase());

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
  const [editBreakdown, setEditBreakdown] = useState<BreakdownRow[]>([]);

  // Discount / Scholarship State
  const [discountRules, setDiscountRules] = useState<any[]>([]);
  const [showDiscountPicker, setShowDiscountPicker] = useState(false);
  const [addingDiscount, setAddingDiscount] = useState(false);

  // New Custom Entry State
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [newEntryType, setNewEntryType] = useState<'monthly' | 'onetime'>('monthly');
  const [newEntryMonth, setNewEntryMonth] = useState(new Date().toISOString().slice(0, 7));
  const [newEntryDueDate, setNewEntryDueDate] = useState('');
  const [newEntryBreakdown, setNewEntryBreakdown] = useState<BreakdownRow[]>([]);
  const [newEntryPaid, setNewEntryPaid] = useState('');
  const [newEntryPayMode, setNewEntryPayMode] = useState('Cash');
  const [creatingEntry, setCreatingEntry] = useState(false);
  const dueDateInputRef = useRef<HTMLInputElement>(null);
  const paidAtInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (userRole?.school_id) {
      supabase.from('schools').select('name,logo_url,address,contact_phone').eq('id', userRole.school_id).maybeSingle().then(({ data }) => setSchool(data));
      // Fetch discount rules for inline assignment
      supabase.from('form_settings').select('sections_config').eq('school_id', userRole.school_id).eq('form_name', 'discount_rules').maybeSingle()
        .then(({ data }) => setDiscountRules(data?.sections_config?.rules ?? []));
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
      .eq('is_deleted', false)
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
          .eq('student_id', stud.id).is('deleted_at', null).order('month_year', { ascending: false });
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

  // ── Discount helpers ──────────────────────────────────────────────────────
  const computeWaiverPct = (ruleIds: string[], rules: any[]): number => {
    let total = 0;
    ruleIds.forEach(rid => {
      const rule = rules.find(r => r.id === rid);
      if (rule?.type === 'percentage') total += rule.value;
    });
    return Math.min(Math.round(total), 100);
  };

  const handleAssignDiscount = async (ruleId: string) => {
    if (!student) return;
    const existingIds: string[] = student.custom_data?.discount_rule_ids || [];
    if (existingIds.includes(ruleId)) { setShowDiscountPicker(false); return; }
    setAddingDiscount(true);
    const updatedIds = [...existingIds, ruleId];
    const newPct = computeWaiverPct(updatedIds, discountRules);
    const { error } = await supabase.from('students').update({
      custom_data: { ...student.custom_data, discount_rule_ids: updatedIds },
      fee_waiver_percentage: newPct,
    }).eq('id', student.id);
    if (!error) setStudent({ ...student, custom_data: { ...student.custom_data, discount_rule_ids: updatedIds }, fee_waiver_percentage: newPct });
    setAddingDiscount(false);
    setShowDiscountPicker(false);
  };

  const handleRemoveDiscount = async (ruleId: string) => {
    if (!student) return;
    const updatedIds = (student.custom_data?.discount_rule_ids || []).filter((id: string) => id !== ruleId);
    const newPct = computeWaiverPct(updatedIds, discountRules);
    const { error } = await supabase.from('students').update({
      custom_data: { ...student.custom_data, discount_rule_ids: updatedIds },
      fee_waiver_percentage: newPct,
    }).eq('id', student.id);
    if (!error) setStudent({ ...student, custom_data: { ...student.custom_data, discount_rule_ids: updatedIds }, fee_waiver_percentage: newPct });
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

      // Scale fee_items proportionally to actual amount paid (net, not gross)
      const rawBreakdown: { item: string; amount: number }[] = collectingFee.breakdown || [];
      const grossTotal = rawBreakdown.reduce((s: number, b: any) => s + Number(b.amount || 0), 0);
      const scaledItems = grossTotal > 0 && rawBreakdown.length > 0
        ? rawBreakdown.map((b: any) => ({
            item: b.item,
            amount: Math.round((Number(b.amount) / grossTotal) * amt),
          }))
        : [{ item: 'Fee Collection', amount: amt }];

      await supabase.from('financial_transactions').insert({
        school_id: userRole!.school_id,
        type: 'income',
        category: 'Fee Collection',
        amount: amt,
        date: collectDate,
        payment_mode: collectMode,
        remarks: `Fee — ${student.full_name} (${collectingFee.invoice_number || collectingFee.id.slice(0,8)})`,
        fee_record_id: collectingFee.id,
        fee_items: scaledItems,
      });

      // Query previous unpaid months for challan previous-fee display
      const { data: prevFees } = await supabase
        .from('fee_records')
        .select('total_amount, paid_amount')
        .eq('school_id', userRole!.school_id)
        .eq('student_id', student.id)
        .in('status', ['pending', 'partial', 'overdue'])
        .is('deleted_at', null)
        .neq('id', collectingFee.id)
        .lt('month_year', collectingFee.month_year);
      const previousFee = (prevFees || []).reduce(
        (sum: number, r: any) => sum + Math.max(0, (r.total_amount || 0) - (r.paid_amount || 0)), 0
      );

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
        breakdown: rawBreakdown.map((b: any) => ({ item: b.item, amount: Number(b.amount) })),
        student_name: student.full_name,
        roll_number: student.roll_number,
        class_name: cls ? `${cls.name}${cls.section ? ' - ' + cls.section : ''}` : '',
        issue_date: collectDate,
        previous_fee: previousFee,
        discount_amount: collectingFee.discount_amount ?? 0,
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

  // Open the new-entry modal, pre-loading fee template for monthly type
  const openNewEntry = async (type: 'monthly' | 'onetime') => {
    setNewEntryType(type);
    setNewEntryMonth(new Date().toISOString().slice(0, 7));
    setNewEntryDueDate('');
    setNewEntryPaid('');
    setNewEntryPayMode('Cash');

    if (type === 'monthly' && student?.class_id) {
      // Try to preload from fee_structures for this student's class
      const { data: fs } = await supabase
        .from('fee_structures')
        .select('fee_matrix, amount')
        .eq('school_id', userRole!.school_id)
        .eq('class_id', student.class_id)
        .maybeSingle();

      if (fs?.fee_matrix?.recurrent?.length) {
        setNewEntryBreakdown(
          fs.fee_matrix.recurrent.map((r: any) => ({ item: r.item, amount: Number(r.amount) || 0 }))
        );
      } else {
        // No template → start with one empty row
        setNewEntryBreakdown([{ item: 'Tuition Fee', amount: 0 }]);
      }
    } else {
      // One-time: start with one empty row, user picks from onetime suggestions
      setNewEntryBreakdown([{ item: '', amount: 0 }]);
    }

    setShowNewEntry(true);
  };

  // Save a custom fee entry (historical import or new one-time charge)
  const handleCreateEntry = async () => {
    if (!student || newEntryBreakdown.length === 0) return;
    const totalAmt = newEntryBreakdown.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    if (totalAmt <= 0) return alert('Add at least one fee item with an amount.');
    const paidAmt = parseFloat(newEntryPaid) || 0;
    const newStatus = paidAmt >= totalAmt ? 'paid' : paidAmt > 0 ? 'partial' : 'pending';

    setCreatingEntry(true);
    try {
      const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
      const { data: rec, error: recErr } = await supabase.from('fee_records').insert({
        school_id: userRole!.school_id,
        student_id: student.id,
        month_year: newEntryMonth + '-01',
        due_date: newEntryDueDate || null,
        total_amount: totalAmt,
        paid_amount: paidAmt,
        status: newStatus,
        payment_mode: paidAmt > 0 ? newEntryPayMode : null,
        paid_at: paidAmt > 0 ? new Date().toISOString() : null,
        breakdown: newEntryBreakdown,
        invoice_number: invoiceNumber,
      }).select().single();
      if (recErr) throw recErr;

      // Log to ledger if any amount was paid
      if (paidAmt > 0 && rec) {
        await supabase.from('financial_transactions').insert({
          school_id: userRole!.school_id,
          type: 'income',
          category: 'Fee Collection',
          amount: paidAmt,
          date: new Date().toISOString().split('T')[0],
          payment_mode: newEntryPayMode,
          remarks: `${student.full_name} — ${invoiceNumber}`,
          fee_record_id: rec.id,
          fee_items: newEntryBreakdown,
        });
      }

      setShowNewEntry(false);
      handleFeeModalSave();
    } catch (err: any) {
      alert(err.message || 'Failed to create entry.');
    } finally {
      setCreatingEntry(false);
    }
  };

  const openEditFee = (f: any) => {
    setEditingFee(f);
    const bd: BreakdownRow[] = Array.isArray(f.breakdown) && f.breakdown.length > 0
      ? f.breakdown.map((b: any) => ({ item: b.item || '', amount: Number(b.amount) || 0 }))
      : [{ item: 'Tuition Fee', amount: Number(f.total_amount) || 0 }];
    setEditBreakdown(bd);
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
      const derivedTotal = editBreakdown.reduce((s, r) => s + (Number(r.amount) || 0), 0);
      const paidAmt = parseFloat(editForm.paid_amount) || 0;
      const { error } = await supabase.from('fee_records').update({
        total_amount: derivedTotal,
        breakdown: editBreakdown,
        paid_amount: paidAmt,
        paid_at: editForm.paid_at ? editForm.paid_at + 'T12:00:00Z' : null,
        month_year: editForm.month_year + '-01',
        status: paidAmt >= derivedTotal ? 'paid' : (paidAmt > 0 ? 'partial' : 'pending')
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
                    {collectingFee.month_year ? formatDate(collectingFee.month_year) : '—'}
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

      {/* Click-away backdrop for discount picker */}
      {showDiscountPicker && (
        <div className="fixed inset-0 z-10" onClick={() => setShowDiscountPicker(false)} />
      )}

      <div ref={printRef} className="min-h-screen bg-slate-50 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          {/* ── Page Header ── */}
          <PageHeader
            className="no-print"
            title="Student Profile"
            subtitle={`Detailed records for ${student.full_name}`}
            actions={
              <>
                <Btn variant="ghost" size="sm" onClick={() => navigate(-1)} icon={ArrowLeft}>
                  Back
                </Btn>
                {isReadOnly && (
                  <Badge variant="warning" className="uppercase tracking-widest px-3 py-1">
                    <Shield className="w-3 h-3 mr-1" /> View Only
                  </Badge>
                )}
                <Btn variant="outline" size="sm" onClick={handlePrint} icon={Printer}>
                  Print Profile
                </Btn>
              </>
            }
          />

          {/* ── Ledger Summary Bar (SkoolZoom Style) ── */}
          {showFinance && (
            <div className="no-print grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {[
                { label: 'Total Fees', val: ledgerSummary.total, color: 'text-slate-900', icon: CreditCard, border: 'border-slate-200' },
                { label: 'Received', val: ledgerSummary.paid, color: 'text-emerald-600', icon: CheckCircle, border: 'border-emerald-100' },
                { label: 'Total Balance', val: ledgerSummary.balance, color: 'text-rose-600', icon: AlertCircle, border: 'border-rose-100' },
              ].map(item => (
                <Card key={item.label} className={cn("p-4 border-l-4 shadow-sm", item.border === 'border-slate-200' ? 'border-l-slate-400' : item.border === 'border-emerald-100' ? 'border-l-emerald-500' : 'border-l-rose-500')}>
                  <div className="flex items-center gap-4">
                    <div className={cn("p-2 rounded-xl bg-slate-50", item.color)}>
                      <item.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{item.label}</p>
                      <p className={cn("text-lg font-black mt-1", item.color)}>PKR {item.val.toLocaleString()}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

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
            {showFinance && (
              <div className="bg-slate-100 px-4 py-2 rounded-xl inline-block mb-3 border border-slate-200">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-900">Registration Number</p>
                <p className="text-xs font-mono font-bold mt-1 uppercase">{student.student_unique_id || id?.substring(0, 12)}</p>
              </div>
            )}
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Printed: {formatDate(new Date())}</p>
          </div>
        </div>

          {/* ── Hero Banner ── */}
          <Card className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border-none shadow-2xl p-0 overflow-hidden mb-6">
            <div className="px-6 py-10">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-8">
                {student.photograph_url ? (
                  <img src={student.photograph_url} alt={student.full_name}
                    className="w-32 h-32 rounded-3xl object-cover border-4 border-white/20 shadow-2xl shrink-0" />
                ) : (
                  <div className="w-32 h-32 rounded-3xl bg-indigo-600/40 border-4 border-indigo-400/30 flex items-center justify-center text-5xl font-black text-white shadow-2xl shrink-0">
                    {student.full_name?.charAt(0)?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <Badge variant={student.status === 'active' ? 'success' : 'secondary'} className="uppercase tracking-[0.2em] px-4 py-1.5 shadow-lg shadow-black/20 border-none">
                      {student.status === 'active' ? 'Active' : student.status}
                    </Badge>
                    {student.fee_waiver_percentage >= 100 && (
                      <Badge variant="success" className="uppercase tracking-[0.2em] px-4 py-1.5 shadow-lg shadow-emerald-500/20 animate-pulse border-none">
                        <CheckCircle className="w-3 h-3 mr-2" /> Free Student
                      </Badge>
                    )}
                    {student.fee_waiver_percentage > 0 && student.fee_waiver_percentage < 100 && (
                      <Badge variant="warning" className="uppercase tracking-[0.2em] px-4 py-1.5 shadow-lg shadow-amber-500/20 border-none">
                        {student.fee_waiver_percentage}% Scholarship
                      </Badge>
                    )}
                    {cls && <Badge variant="secondary" className="text-indigo-200 border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5">{cls.name} – {cls.section}</Badge>}
                    {student.roll_number && <span className="text-indigo-300 text-sm font-bold bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">Roll #{student.roll_number}</span>}
                  </div>
                  <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-4">{student.full_name}</h1>
                  <div className="flex flex-wrap gap-6 text-slate-300 text-[13px] font-medium">
                    {student.gender && <span className="flex items-center gap-2"><User className="w-4 h-4 text-indigo-400" />{student.gender}</span>}
                    {student.dob && <span className="flex items-center gap-2"><Calendar className="w-4 h-4 text-indigo-400" />DOB: {formatDate(student.dob)}</span>}
                    {student.admission_date && <span className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-indigo-400" />Admitted: {formatDate(student.admission_date)}</span>}
                    {student.blood_group && <span className="flex items-center gap-2"><Heart className="w-4 h-4 text-rose-400" />{student.blood_group}</span>}
                  </div>
                  
                  {/* Credentials */}
                  {showFinance && student.student_unique_id && (
                    <div className="mt-6 inline-flex items-center gap-6 bg-white/5 border border-white/10 rounded-2xl px-5 py-3 backdrop-blur-sm">
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Login ID</p>
                        <p className="text-sm font-black text-white font-mono mt-0.5">{student.student_unique_id}</p>
                      </div>
                      <div className="w-px h-8 bg-white/10" />
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Password</p>
                        <p className="text-sm font-black text-white font-mono mt-0.5">{student.auth_password || '—'}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick stats */}
                <div className="hidden lg:grid grid-cols-1 gap-3 shrink-0">
                  {[
                    { id: 'attendance', label: 'Attendance', value: attPct + '%', color: attPct >= 75 ? 'text-emerald-400' : 'text-rose-400' },
                    { id: 'fees', label: 'Outstanding', value: 'PKR ' + totalDue.toLocaleString(), color: totalDue > 0 ? 'text-rose-400' : 'text-emerald-400' },
                    { id: 'results', label: 'Last Result', value: results.length ? 'Recorded' : 'N/A', color: 'text-indigo-400' },
                  ].filter(s => showFinance || s.id !== 'fees').map(stat => (
                    <div key={stat.label} className="bg-white/5 border border-white/10 rounded-2xl px-6 py-3 min-w-[160px]">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-1">{stat.label}</p>
                      <p className={`text-lg font-black ${stat.color}`}>{stat.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* ── Tab Navigation ── */}
          <div className="no-print bg-white rounded-2xl border border-slate-200 shadow-sm mb-8 p-1.5 flex gap-1 overflow-x-auto scrollbar-hide">
            {([
              { key: 'overview', label: 'Overview', icon: User },
              { key: 'attendance', label: 'Attendance', icon: Calendar },
              { key: 'fees', label: 'Fees & Payments', icon: CreditCard },
              { key: 'results', label: 'Exam Results', icon: BarChart3 },
            ] as { key: DetailTab; label: string; icon: any }[])
              .filter(t => showFinance || t.key !== 'fees')
              .map(({ key, label, icon: Icon }) => (
              <button 
                key={key} 
                onClick={() => setTab(key)}
                className={cn(
                  'flex items-center gap-2 px-6 py-3 text-xs sm:text-[13px] whitespace-nowrap font-black uppercase tracking-tight rounded-xl transition-all',
                  tab === key 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

        {/* ── Tab Content ── */}
        <div className="max-w-6xl mx-auto px-6 py-8">
          {tabLoading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!tabLoading && tab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Personal Info */}
              <Card className="p-8 shadow-sm">
                <h2 className="text-sm font-black text-indigo-600 uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                  Personal Information
                </h2>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-6 text-[13px]">
                  {[
                    { label: 'Full Name', val: student.full_name },
                    { label: 'Roll No', val: student.roll_number ? `#${student.roll_number}` : '—' },
                    { label: 'Date of Birth', val: formatDate(student.dob) },
                    { label: 'Gender', val: student.gender || '—' },
                    { label: 'Religion', val: student.religion || '—' },
                    { label: 'Nationality', val: student.nationality || '—' },
                    { label: 'Blood Group', val: student.blood_group || '—' },
                    { label: 'Admission Date', val: formatDate(student.admission_date) },
                    { label: 'B-Form/CNIC', val: student.b_form_cnic || '—' },
                  ].map(({ label, val }) => (
                    <div key={label}>
                      <dt className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</dt>
                      <dd className="font-bold text-slate-800">{val}</dd>
                    </div>
                  ))}
                  <div className="col-span-2 pt-4 border-t border-slate-50 mt-2">
                    <dt className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Residential Address</dt>
                    <dd className="font-medium text-slate-700 leading-relaxed italic">"{student.address || 'No address provided'}"</dd>
                  </div>
                </dl>
              </Card>

              {/* Parent / Family */}
              <Card className="p-8 shadow-sm">
                <h2 className="text-sm font-black text-slate-600 uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
                    <Phone className="w-4 h-4" />
                  </div>
                  Parent & Family
                </h2>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-6 text-[13px]">
                  {[
                    { label: "Father's Name", val: parent?.father_name || student.father_name || '—' },
                    { label: "Mother's Name", val: parent?.mother_name || student.mother_name || '—' },
                    { label: 'WhatsApp', val: parent?.whatsapp_number || '—' },
                    { label: 'Primary Contact', val: parent?.father_contact || student.father_contact || '—' },
                    { label: 'Secondary Contact', val: parent?.mother_contact || student.mother_contact || '—' },
                    { label: 'Email', val: parent?.email || '—' },
                  ].map(({ label, val }) => (
                    <div key={label}>
                      <dt className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</dt>
                      <dd className="font-bold text-slate-800">{val}</dd>
                    </div>
                  ))}
                </dl>
              </Card>

              {/* Sibling Listing Card */}
              {siblings.length > 0 && (
                <Card className="bg-[#0f172a] border-none p-8 shadow-2xl relative overflow-hidden group">
                  <div className="absolute -top-10 -right-10 opacity-5 group-hover:opacity-10 transition-opacity transform rotate-12">
                    <Users className="w-48 h-48 text-white" />
                  </div>
                  <h2 className="text-xs font-black text-indigo-300 uppercase tracking-[0.2em] mb-6 flex items-center gap-3 relative z-10">
                    <Users className="w-4 h-4" /> Siblings Cross-Reference
                  </h2>
                  <div className="space-y-4 relative z-10">
                    {siblings.map(s => (
                      <div 
                        key={s.id} 
                        onClick={() => navigate(`/students/detail/${s.id}`)} 
                        className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer group/item"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center font-black text-indigo-300 border border-indigo-500/30 shadow-inner group-hover/item:scale-110 transition-transform">
                            {s.full_name?.charAt(0)}
                          </div>
                          <div>
                            <p className="text-[15px] font-black text-white uppercase tracking-tight">{s.full_name}</p>
                            <p className="text-[10px] text-indigo-300 font-black uppercase tracking-[0.15em] mt-0.5">{s.classes?.name} {s.classes?.section}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-white/20 group-hover/item:text-white transition-all transform group-hover/item:translate-x-1" />
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Medical */}
              {(student.medical_caution || student.emergency_doctor_name) && (
                <Card className="bg-rose-50 border-rose-100 p-8 shadow-sm">
                  <h2 className="text-sm font-black text-rose-600 uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
                      <Heart className="w-4 h-4" />
                    </div>
                    Medical & Emergency
                  </h2>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-6 text-[13px]">
                    {[
                      { label: 'Medical Caution', val: student.medical_caution || '—' },
                      { label: 'Emergency Doctor', val: student.emergency_doctor_name || '—' },
                      { label: 'Doctor Phone', val: student.emergency_doctor_phone || '—' },
                    ].map(({ label, val }) => (
                      <div key={label}>
                        <dt className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">{label}</dt>
                        <dd className="font-bold text-slate-800">{val}</dd>
                      </div>
                    ))}
                  </dl>
                </Card>
              )}



              {/* Financial & Scholarship Status */}
              {showFinance && (
                <Card className="p-8 shadow-sm group hover:border-indigo-300 transition-colors">
                  <h2 className="text-sm font-black text-indigo-600 uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    Financial & Scholarship Status
                  </h2>

                  <div className="space-y-8">
                    {/* ── Active Discount Rules ── */}
                    <div className="p-6 bg-emerald-50/50 border border-emerald-100 rounded-[2rem]">
                      <div className="flex items-center justify-between mb-5">
                        <p className="text-[11px] font-black text-emerald-700 uppercase tracking-widest flex items-center gap-2">
                          <Tag className="w-4 h-4" /> Active Discount Rules
                        </p>
                        <div className="relative">
                          <Btn 
                            variant="success" 
                            size="sm" 
                            onClick={() => setShowDiscountPicker(v => !v)}
                            icon={addingDiscount ? Loader2 : Plus}
                            className={addingDiscount ? "animate-spin" : ""}
                          >
                            Assign Rule
                          </Btn>
                          {showDiscountPicker && (
                            <div className="absolute right-0 top-full mt-2 z-20 bg-white border border-slate-200 rounded-2xl shadow-2xl min-w-[280px] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Available Rules</p>
                              </div>
                              {discountRules.length === 0 ? (
                                <p className="px-4 py-6 text-xs text-slate-400 italic text-center">No discount rules configured yet.</p>
                              ) : (
                                <div className="max-h-[300px] overflow-y-auto">
                                  {discountRules.map(rule => {
                                    const alreadyAssigned = (student.custom_data?.discount_rule_ids || []).includes(rule.id);
                                    return (
                                      <button
                                        key={rule.id}
                                        disabled={alreadyAssigned}
                                        onClick={() => handleAssignDiscount(rule.id)}
                                        className={cn(
                                          "w-full flex items-center justify-between px-4 py-3 text-left text-sm hover:bg-emerald-50 transition-colors border-b border-slate-50 last:border-0",
                                          alreadyAssigned ? "opacity-40 cursor-not-allowed bg-slate-50" : ""
                                        )}
                                      >
                                        <span className="font-bold text-slate-800">{rule.name}</span>
                                        <Badge variant={rule.type === 'percentage' ? 'success' : 'warning'} className="font-black">
                                          {rule.type === 'percentage' ? `${rule.value}%` : `Rs. ${rule.value}`}
                                        </Badge>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Active rule badges */}
                      {(() => {
                        const activeIds: string[] = student.custom_data?.discount_rule_ids || [];
                        const activeRules = discountRules.filter(r => activeIds.includes(r.id));
                        if (activeRules.length === 0) return (
                          <div className="flex flex-col items-center justify-center py-6 text-center">
                            <Tag className="w-8 h-8 text-emerald-200 mb-2" />
                            <p className="text-xs text-emerald-600 font-medium max-w-[200px]">No discount rules assigned. Standard fees apply.</p>
                          </div>
                        );
                        return (
                          <div className="flex flex-wrap gap-3">
                            {activeRules.map(rule => (
                              <div key={rule.id} className="flex items-center gap-3 bg-white border border-emerald-100 rounded-2xl px-4 py-2 text-sm font-bold text-emerald-800 shadow-sm hover:border-emerald-300 transition-colors group/rule">
                                <Tag className="w-4 h-4 text-emerald-500" />
                                <span>{rule.name}</span>
                                <Badge variant="success" className="bg-emerald-100 text-emerald-700 px-2.5">
                                  {rule.type === 'percentage' ? `${rule.value}%` : `Rs. ${rule.value}`}
                                </Badge>
                                <button
                                  onClick={() => handleRemoveDiscount(rule.id)}
                                  className="ml-1 p-1 rounded-lg text-emerald-300 hover:text-rose-500 hover:bg-rose-50 transition-all"
                                  title="Remove rule"
                                >
                                  <XIcon className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Quick Toggles */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
                            student.fee_waiver_percentage >= 100 ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "bg-slate-200 text-slate-500"
                          )}>
                            <Award className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-800 uppercase tracking-tight">Full Scholarship</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">100% Fee Waiver</p>
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            const newVal = student.fee_waiver_percentage >= 100 ? 0 : 100;
                            const { error } = await supabase.from('students').update({ fee_waiver_percentage: newVal }).eq('id', student.id);
                            if (!error) setStudent({ ...student, fee_waiver_percentage: newVal });
                          }}
                          className={cn(
                            "relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none shadow-inner",
                            student.fee_waiver_percentage >= 100 ? "bg-emerald-500" : "bg-slate-300"
                          )}
                        >
                          <span className={cn(
                            "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                            student.fee_waiver_percentage >= 100 ? "translate-x-5" : "translate-x-0"
                          )} />
                        </button>
                      </div>

                      <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Manual Waiver Override</p>
                          <span className="text-sm font-black text-indigo-600 bg-white px-3 py-1 rounded-xl shadow-sm border border-slate-100">
                            {student.fee_waiver_percentage || 0}%
                          </span>
                        </div>
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
                            className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-4 italic leading-relaxed">
                          Drag to override assigned rules manually.
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}

          {!tabLoading && tab === 'attendance' && (
            <div className="space-y-8">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
                {[
                  { label: 'Present', val: attSummary.present, variant: 'success', icon: CheckCircle },
                  { label: 'Absent', val: attSummary.absent, variant: 'danger', icon: XCircle },
                  { label: 'Late', val: attSummary.late, variant: 'warning', icon: Clock },
                  { label: 'Leave', val: attSummary.leave, variant: 'indigo', icon: Calendar },
                  { label: 'Attendance %', val: attPct + '%', variant: attPct >= 75 ? 'success' : 'danger', icon: TrendingUp },
                ].map(s => (
                  <Card key={s.label} className="p-6 text-center border-none shadow-sm relative overflow-hidden group">
                    <div className={cn(
                      "absolute -bottom-4 -right-4 w-16 h-16 opacity-5 group-hover:scale-110 transition-transform",
                      s.variant === 'success' ? 'text-emerald-500' : s.variant === 'danger' ? 'text-rose-500' : s.variant === 'warning' ? 'text-amber-500' : 'text-indigo-500'
                    )}>
                      <s.icon className="w-full h-full" />
                    </div>
                    <p className={cn(
                      "text-3xl font-black mb-1",
                      s.variant === 'success' ? 'text-emerald-600' : s.variant === 'danger' ? 'text-rose-600' : s.variant === 'warning' ? 'text-amber-600' : 'text-indigo-600'
                    )}>{s.val}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{s.label}</p>
                  </Card>
                ))}
              </div>

              {/* Calendar heat map — last 90 days */}
              <Card className="p-8 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                      <Calendar className="w-4 h-4" />
                    </div>
                    Visual Attendance History (Last 90 Days)
                  </h3>
                  <div className="flex items-center gap-4 no-print">
                    {[
                      { color: 'bg-emerald-500', label: 'Present' },
                      { color: 'bg-rose-500', label: 'Absent' },
                      { color: 'bg-amber-400', label: 'Late' },
                      { color: 'bg-blue-400', label: 'Leave' },
                      { color: 'bg-slate-100', label: 'None' },
                    ].map(l => (
                      <div key={l.label} className="flex items-center gap-2">
                        <div className={cn('w-2.5 h-2.5 rounded-full', l.color)} />
                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">{l.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[...Array(90)].map((_, idx) => {
                    const d = new Date(); d.setDate(d.getDate() - (89 - idx));
                    const dateStr = d.toISOString().slice(0, 10);
                    const rec = attendance.find(r => r.date === dateStr);
                    return (
                      <div key={dateStr} title={`${dateStr}: ${rec ? rec.status : 'no record'}`}
                        className={cn('w-6 h-6 rounded-md cursor-default transition-all hover:scale-125 hover:shadow-md hover:z-10',
                          rec ? (STATUS_COLOR[rec.status] || 'bg-slate-300') : 'bg-slate-100')} />
                    );
                  })}
                </div>
              </Card>

              {/* Detail table */}
              {attendance.length > 0 ? (
                <Card className="p-0 shadow-sm overflow-hidden border-none">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          {['Date', 'Day', 'Status', 'Arrival', 'Departure'].map(h => (
                            <th key={h} className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {attendance.map(r => (
                          <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 font-bold text-slate-800">{formatDate(r.date)}</td>
                            <td className="px-6 py-4 text-slate-500 text-xs font-medium uppercase tracking-tight">
                              {new Date(r.date).toLocaleDateString('en-US', { weekday: 'long' })}
                            </td>
                            <td className="px-6 py-4">
                              <Badge variant={
                                r.status === 'present' ? 'success' :
                                r.status === 'absent' ? 'danger' :
                                r.status === 'late' ? 'warning' : 'indigo'
                              } className="uppercase tracking-widest text-[10px] px-3">
                                {r.status}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 text-slate-600 font-mono text-xs">{r.arrival_time || '—'}</td>
                            <td className="px-6 py-4 text-slate-600 font-mono text-xs">{r.departure_time || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ) : (
                <EmptyState
                  icon={Calendar}
                  title="No Attendance Data"
                  description="We couldn't find any attendance records for the selected period."
                />
              )}
            </div>
          )}

          {!tabLoading && tab === 'fees' && showFinance && (
            <div className="space-y-8">
              {/* Action bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    Financial Ledger
                  </h3>
                </div>
                {!isReadOnly && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Btn 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => navigate(`/fees/student-detail?student=${student?.id}`)} 
                      icon={ExternalLink}
                    >
                      Full Ledger
                    </Btn>
                    <div className="w-px h-8 bg-slate-200 mx-2" />
                    <Btn 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setShowFeeOverrideModal(true)} 
                      icon={CreditCard}
                    >
                      {student.fee_override ? 'Edit Custom Fees' : 'Customize Fees'}
                    </Btn>
                    <Btn 
                      variant="outline" 
                      size="sm" 
                      onClick={() => openNewEntry('onetime')} 
                      icon={Plus}
                    >
                      One-Time Entry
                    </Btn>
                    <Btn 
                      variant="primary" 
                      size="sm" 
                      onClick={() => openNewEntry('monthly')} 
                      icon={Plus}
                    >
                      Monthly Entry
                    </Btn>
                  </div>
                )}
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {[
                  { label: 'Total Paid', val: 'PKR ' + totalPaid.toLocaleString(), variant: 'success', icon: CheckCircle },
                  { label: 'Outstanding', val: 'PKR ' + totalDue.toLocaleString(), variant: totalDue > 0 ? 'danger' : 'success', icon: AlertCircle },
                  { label: 'Invoices Issued', val: fees.length.toString(), variant: 'indigo', icon: CreditCard },
                ].map(s => (
                  <Card key={s.label} className="p-6 text-center border-none shadow-sm relative overflow-hidden group">
                    <div className={cn(
                      "absolute -bottom-4 -right-4 w-16 h-16 opacity-5 group-hover:scale-110 transition-transform",
                      s.variant === 'success' ? 'text-emerald-500' : s.variant === 'danger' ? 'text-rose-500' : 'text-indigo-500'
                    )}>
                      <s.icon className="w-full h-full" />
                    </div>
                    <p className={cn(
                      "text-2xl font-black mb-1",
                      s.variant === 'success' ? 'text-emerald-600' : s.variant === 'danger' ? 'text-rose-600' : 'text-indigo-600'
                    )}>{s.val}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{s.label}</p>
                  </Card>
                ))}
              </div>
              {fees.length > 0 ? (
                <Card className="p-0 shadow-sm overflow-hidden border-none">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          {['Month', 'Invoice #', 'Total', 'Paid', 'Balance', 'Status', 'Actions'].map(h => (
                            <th key={h} className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {fees.map(f => {
                          const bal = Math.max(0, (f.total_amount || 0) - (f.paid_amount || 0));
                          return (
                            <tr key={f.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-4 font-black text-slate-800">
                                {f.month_year ? formatDate(f.month_year) : '—'}
                              </td>
                              <td className="px-6 py-4 font-mono text-xs text-slate-400 uppercase">{f.invoice_number || '—'}</td>
                              <td className="px-6 py-4 font-bold text-slate-900">{(f.total_amount || 0).toLocaleString()}</td>
                              <td className="px-6 py-4 font-bold text-emerald-600">{(f.paid_amount || 0).toLocaleString()}</td>
                              <td className="px-6 py-4 font-black text-rose-600">{bal > 0 ? bal.toLocaleString() : '—'}</td>
                              <td className="px-6 py-4">
                                <Badge variant={
                                  f.status === 'paid' ? 'success' :
                                  f.status === 'partial' ? 'warning' : 'danger'
                                } className="uppercase tracking-widest text-[10px] px-3">
                                  {f.status}
                                </Badge>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  {!isReadOnly && f.status !== 'paid' && bal > 0 && (
                                    <Btn 
                                      variant="success" 
                                      size="xs" 
                                      onClick={() => {
                                        setCollectingFee(f);
                                        setCollectAmount(String(bal));
                                        setCollectMode('Cash');
                                      }}
                                      icon={Wallet}
                                    >
                                      Collect
                                    </Btn>
                                  )}
                                  {!isReadOnly && (
                                    <Btn 
                                      variant="ghost" 
                                      size="xs" 
                                      onClick={() => openEditFee(f)}
                                    >
                                      Edit
                                    </Btn>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ) : (
                <EmptyState
                  icon={CreditCard}
                  title="No Fee Records"
                  description="This student has no fee invoices or payment history recorded yet."
                  action={!isReadOnly ? <Btn size="sm" onClick={() => openNewEntry('monthly')} icon={Plus}>Create First Invoice</Btn> : undefined}
                />
              )}
            </div>
          )}

          {!tabLoading && tab === 'results' && (
            <div className="space-y-10">
              {Object.keys(groupedResults).length === 0 ? (
                <EmptyState
                  icon={BarChart3}
                  title="No Results Recorded"
                  description="Examination results for this student have not been entered into the system yet."
                />
              ) : Object.entries(groupedResults).map(([examName, rows]) => {
                const totalObt = rows.reduce((s, r) => s + (r.obtained_marks || 0), 0);
                const totalMax = rows.reduce((s, r) => s + (r.total_marks || 0), 0);
                const pct = totalMax > 0 ? Math.round((totalObt / totalMax) * 100) : 0;
                const isPass = pct >= 50;
                return (
                  <Card key={examName} className="p-0 shadow-sm overflow-hidden border-none">
                    <div className="px-8 py-6 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100">
                      <div>
                        <h3 className="font-black text-slate-900 uppercase tracking-tight text-lg">{examName}</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Official Examination Summary</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Aggregate</p>
                          <p className="text-xl font-black text-slate-900 mt-1">{totalObt}<span className="text-slate-300">/{totalMax}</span></p>
                        </div>
                        <div className="w-px h-10 bg-slate-200" />
                        <Badge variant={isPass ? 'success' : 'danger'} className="px-4 py-2 rounded-2xl shadow-sm text-xs font-black uppercase tracking-widest">
                          {gradeLabel(pct)} · {isPass ? 'PASS' : 'FAIL'}
                        </Badge>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 bg-slate-100">
                      <div className={cn('h-full transition-all duration-1000 ease-out', isPass ? 'bg-emerald-500' : 'bg-rose-500')} style={{ width: pct + '%' }} />
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-white/50">
                            {['Subject', 'Obtained', 'Total', 'Percentage', 'Grade'].map(h => (
                              <th key={h} className="text-left px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {rows.map(r => {
                            const sp = r.total_marks > 0 ? Math.round((r.obtained_marks / r.total_marks) * 100) : 0;
                            return (
                              <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-8 py-4 font-black text-slate-800">{r.subjects?.subject_name || '—'}</td>
                                <td className="px-8 py-4 font-bold text-slate-900">{r.obtained_marks ?? '—'}</td>
                                <td className="px-8 py-4 text-slate-400 font-medium">{r.total_marks ?? '—'}</td>
                                <td className="px-8 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                                      <div className={cn('h-full', sp >= 50 ? 'bg-indigo-500' : 'bg-rose-500')} style={{ width: sp + '%' }} />
                                    </div>
                                    <span className="font-black text-slate-700">{sp}%</span>
                                  </div>
                                </td>
                                <td className="px-8 py-4">
                                   <Badge variant={sp >= 50 ? 'indigo' : 'danger'} className="font-black px-3">
                                    {gradeLabel(sp)}
                                  </Badge>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>

      {/* ── New Custom Fee Entry Modal ── */}
      {showNewEntry && student && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className={`px-6 py-4 flex items-center justify-between flex-shrink-0 ${newEntryType === 'onetime' ? 'bg-gradient-to-r from-amber-600 to-orange-600' : 'bg-gradient-to-r from-indigo-600 to-violet-600'}`}>
              <div>
                <h2 className="text-white font-black text-sm leading-none">
                  {newEntryType === 'onetime' ? 'One-Time / Admission Fee Entry' : 'Monthly Fee Entry'}
                </h2>
                <p className="text-white/70 text-xs mt-1">{student.full_name}</p>
              </div>
              <button onClick={() => setShowNewEntry(false)} className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition">
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Type toggle */}
              <div className="flex rounded-xl overflow-hidden border border-gray-200 text-sm font-bold">
                <button
                  onClick={() => openNewEntry('monthly')}
                  className={`flex-1 py-2 transition ${newEntryType === 'monthly' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                >Monthly Fee</button>
                <button
                  onClick={() => openNewEntry('onetime')}
                  className={`flex-1 py-2 transition ${newEntryType === 'onetime' ? 'bg-amber-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                >One-Time / Historical</button>
              </div>

              {/* Helpful hint */}
              <p className="text-[11px] text-gray-400 bg-gray-50 rounded-xl px-3 py-2">
                {newEntryType === 'monthly'
                  ? '📅 Monthly fee auto-loaded from class template. Adjust amounts if needed.'
                  : '🏫 Use this for admission fee, registration, security deposit, or any historical entry.'}
              </p>

              {/* Date fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">
                    {newEntryType === 'monthly' ? 'Fee Month' : 'Period / Date'}
                  </label>
                  <input
                    type="month"
                    value={newEntryMonth}
                    onChange={e => setNewEntryMonth(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Due Date (optional)</label>
                  <div 
                    className="relative cursor-pointer group"
                    onClick={() => {
                      if (dueDateInputRef.current && 'showPicker' in HTMLInputElement.prototype) {
                        try { dueDateInputRef.current.showPicker(); } catch(e) {}
                      }
                    }}
                  >
                    <input
                      type="text"
                      readOnly
                      value={formatDate(newEntryDueDate)}
                      placeholder="DD-MM-YYYY"
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm bg-white group-hover:border-indigo-400 transition-colors"
                    />
                    <input
                      type="date"
                      ref={dueDateInputRef}
                      value={newEntryDueDate}
                      onChange={e => setNewEntryDueDate(e.target.value)}
                      className="absolute inset-0 opacity-0 pointer-events-none"
                    />
                    <div className="absolute right-3 top-2.5 text-gray-400 pointer-events-none group-hover:text-indigo-500">
                      <Calendar className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Fee breakdown */}
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Fee Items</label>
                <FeeBreakdownEditor
                  breakdown={newEntryBreakdown}
                  onChange={setNewEntryBreakdown}
                  schoolId={userRole?.school_id}
                  itemType={newEntryType === 'monthly' ? 'recurring' : 'onetime'}
                />
              </div>

              {/* Already-paid amount (for historical imports) */}
              <div className="border-t border-gray-100 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Amount Already Paid (Rs)</label>
                  <input
                    type="number"
                    min="0"
                    value={newEntryPaid}
                    onChange={e => setNewEntryPaid(e.target.value)}
                    placeholder="0 if unpaid"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-mono font-bold text-emerald-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Payment Mode</label>
                  <select
                    value={newEntryPayMode}
                    onChange={e => setNewEntryPayMode(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
                  >
                    {PAY_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 -mt-2">
                Leave "Amount Already Paid" as 0 to save as pending. For historical records, enter the amount paid.
              </p>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
              <button
                onClick={() => setShowNewEntry(false)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-50 transition"
              >Cancel</button>
              <button
                onClick={handleCreateEntry}
                disabled={creatingEntry || newEntryBreakdown.length === 0}
                className={`flex-1 py-2.5 text-white font-black rounded-xl text-sm transition disabled:opacity-50 flex items-center justify-center gap-2 ${newEntryType === 'onetime' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}
              >
                {creatingEntry ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {creatingEntry ? 'Saving...' : 'Save Entry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Fee Record Modal ── */}
      {editingFee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
              <h2 className="text-white font-black text-sm uppercase tracking-widest">Edit Fee Invoice</h2>
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
                  <div 
                    className="relative cursor-pointer group"
                    onClick={() => {
                      if (paidAtInputRef.current && 'showPicker' in HTMLInputElement.prototype) {
                        try { paidAtInputRef.current.showPicker(); } catch(e) {}
                      }
                    }}
                  >
                    <input
                      type="text"
                      readOnly
                      value={formatDate(editForm.paid_at)}
                      placeholder="DD-MM-YYYY"
                      className="w-full px-3 py-2 border rounded-xl text-sm bg-white group-hover:border-indigo-400 transition-colors"
                    />
                    <input
                      type="date"
                      ref={paidAtInputRef}
                      value={editForm.paid_at}
                      onChange={e => setEditForm({...editForm, paid_at: e.target.value})}
                      className="absolute inset-0 opacity-0 pointer-events-none"
                    />
                    <div className="absolute right-3 top-2.5 text-slate-400 pointer-events-none group-hover:text-indigo-500">
                      <Calendar className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">Fee Breakdown</label>
                <FeeBreakdownEditor
                  breakdown={editBreakdown}
                  onChange={setEditBreakdown}
                  schoolId={userRole?.school_id}
                  itemType="all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Amount Paid (Rs)</label>
                <input type="number" value={editForm.paid_amount} onChange={e => setEditForm({...editForm, paid_amount: e.target.value})}
                  className="w-full px-3 py-2 border rounded-xl font-mono text-sm font-bold text-emerald-600" />
              </div>
              <button onClick={handleUpdateFeeRecord} disabled={editSaving}
                className="w-full py-3 bg-indigo-600 text-white font-black rounded-xl text-sm hover:bg-indigo-700 transition disabled:opacity-50">
                {editSaving ? 'Saving Changes...' : 'Update Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
