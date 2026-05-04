import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Zap, Search, CheckCircle, Wallet,
  ArrowRight, Printer, History, Users,
  Receipt, Landmark, Clock, X as XIcon, Trash2, ExternalLink,
  DollarSign, Banknote, Smartphone, FileText,
  AlertCircle, ChevronRight, UserCheck, User,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDate } from '../../lib/utils';
import { downloadChallanPDF, DEFAULT_CHALLAN_CONFIG, type ChallanRecord, type SchoolInfo } from '../../lib/challanUtils';
import HelpBanner from '../../components/HelpBanner';
import { PageHeader, Card, Btn, Badge, Select, Input } from '../../components/ui';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeeRecord {
  id: string;
  invoice_number?: string;
  month_year: string;
  total_amount: number;
  paid_amount: number;
  status: string;
  breakdown?: { item: string; amount: number }[];
}

interface RecentTransaction {
  id: string;
  student_name: string;
  amount: number;
  date: string;
  mode: string;
  remarks: string;
}

const PAYMENT_MODES = [
  { id: 'Cash',          label: 'Cash',   icon: Banknote   },
  { id: 'Bank Transfer', label: 'Bank',   icon: Landmark   },
  { id: 'Cheque',        label: 'Cheque', icon: FileText   },
  { id: 'Online',        label: 'Online', icon: Smartphone },
];

function avatarColor(name: string) {
  const cols = ['bg-indigo-500','bg-violet-500','bg-sky-500','bg-emerald-500','bg-amber-500','bg-rose-500','bg-teal-500','bg-fuchsia-500'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return cols[Math.abs(h) % cols.length];
}

function modeDateLabel(d: string) {
  const today     = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (d === today)     return 'Today';
  if (d === yesterday) return 'Yesterday';
  return formatDate(d);
}

function outstanding(fees: FeeRecord[]) {
  return fees.filter(f => f.status !== 'paid').reduce((s, f) => s + Number(f.total_amount) - Number(f.paid_amount), 0);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EasyFee() {
  const { userRole } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // ── Mode: student | parent
  const [mode, setMode] = useState<'student' | 'parent'>('student');

  // ── Student mode state
  const [query, setQuery]                   = useState('');
  const [searchResults, setSearchResults]   = useState<any[]>([]);
  const [isSearching, setIsSearching]       = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [feeHistory, setFeeHistory]           = useState<FeeRecord[]>([]);
  const [loadingDetails, setLoadingDetails]   = useState(false);
  const [selectedClassId, setSelectedClassId] = useState('');

  // ── Parent mode state
  const [parentQuery, setParentQuery]     = useState('');
  const [parentResults, setParentResults] = useState<any[]>([]);
  const [isSearchingParent, setIsSearchingParent] = useState(false);
  const [selectedParent, setSelectedParent]   = useState<any | null>(null);
  const [parentChildren, setParentChildren]   = useState<any[]>([]);
  const [childFees, setChildFees]             = useState<Record<string, FeeRecord[]>>({});
  const [loadingParent, setLoadingParent]     = useState(false);
  const [payingChildId, setPayingChildId]     = useState<string | null>(null); // which child is open for payment
  const [collectingAll, setCollectingAll]     = useState(false);
  const [parentSuccessData, setParentSuccessData] = useState<any | null>(null);

  // ── Shared payment form
  const [payAmount, setPayAmount]   = useState('');
  const [payMode, setPayMode]       = useState('Cash');
  const [payDate, setPayDate]       = useState(new Date().toISOString().split('T')[0]);
  const [payRemarks, setPayRemarks] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successData, setSuccessData]   = useState<any | null>(null);
  const [lastPayment, setLastPayment]   = useState<any>(null);

  // ── Meta
  const [classes, setClasses] = useState<any[]>([]);
  const [school, setSchool]   = useState<any>(null);
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [selectedRecentTx, setSelectedRecentTx]     = useState<RecentTransaction | null>(null);

  // ── Derived (student mode) ────────────────────────────────────────────────

  const pendingInvoices = useMemo(() => feeHistory.filter(f => f.status !== 'paid'), [feeHistory]);
  const totalOutstanding = useMemo(() => outstanding(feeHistory), [feeHistory]);

  const thisMonthBalance = useMemo(() => {
    const m = new Date().toISOString().slice(0, 7);
    const inv = pendingInvoices.find(f => f.month_year.startsWith(m));
    return inv ? Number(inv.total_amount) - Number(inv.paid_amount) : 0;
  }, [pendingInvoices]);

  const allocationPreview = useMemo(() => {
    const amt = parseFloat(payAmount) || 0;
    if (!amt || pendingInvoices.length === 0) return [];
    const sorted = [...pendingInvoices].sort((a, b) => a.month_year.localeCompare(b.month_year));
    let rem = amt;
    const out: { month: string; paying: number; full: boolean }[] = [];
    for (const f of sorted) {
      if (rem <= 0) break;
      const due = Number(f.total_amount) - Number(f.paid_amount);
      const paying = Math.min(rem, due);
      out.push({ month: formatDate(f.month_year), paying, full: paying >= due - 0.01 });
      rem -= paying;
    }
    return out;
  }, [payAmount, pendingInvoices]);

  const todayStr   = new Date().toISOString().slice(0, 10);
  const totalToday = recentTransactions.filter(t => t.date === todayStr).reduce((s, t) => s + Number(t.amount), 0);

  // ── Fetch metadata ────────────────────────────────────────────────────────

  const fetchMetadata = useCallback(async () => {
    if (!userRole?.school_id) return;
    const [{ data: sch }, { data: cls }] = await Promise.all([
      supabase.from('schools').select('*').eq('id', userRole.school_id).maybeSingle(),
      supabase.from('classes').select('id, name, section').eq('school_id', userRole.school_id).order('name'),
    ]);
    if (sch) setSchool(sch);
    if (cls) setClasses(cls);
  }, [userRole?.school_id]);

  const fetchRecentActivity = useCallback(async () => {
    if (!userRole?.school_id) return;
    const { data } = await supabase
      .from('financial_transactions')
      .select('id, remarks, amount, date, payment_mode')
      .eq('school_id', userRole.school_id)
      .eq('category', 'Fee Collection')
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) {
      setRecentTransactions(data.map(t => ({
        id: t.id,
        student_name: t.remarks?.split('[')[0]?.replace('Fee — ', '')?.trim() || 'Student',
        amount: t.amount,
        date: t.date,
        mode: t.payment_mode,
        remarks: t.remarks || '',
      })));
    }
  }, [userRole?.school_id]);

  useEffect(() => { fetchMetadata(); }, [fetchMetadata]);
  useEffect(() => { fetchRecentActivity(); }, [fetchRecentActivity]);

  // ── Student search ────────────────────────────────────────────────────────

  useEffect(() => {
    if (mode !== 'student') return;
    const search = async () => {
      if (!query.trim() || query.length < 2) { setSearchResults([]); return; }
      setIsSearching(true);
      let q = supabase
        .from('students')
        .select('id, full_name, roll_number, class:class_id(name, section), parent:parent_id(full_name, father_name)')
        .eq('school_id', userRole!.school_id)
        .eq('status', 'active');
      if (selectedClassId) q = q.eq('class_id', selectedClassId);
      const num = parseInt(query);
      if (!isNaN(num)) {
        q = q.or(`full_name.ilike.%${query}%,roll_number.eq.${num}`);
      } else {
        q = q.ilike('full_name', `%${query}%`);
      }
      const { data } = await q.limit(7);
      setSearchResults(data || []);
      setIsSearching(false);
    };
    const t = setTimeout(search, 300);
    return () => clearTimeout(t);
  }, [query, selectedClassId, userRole?.school_id, mode]);

  // ── Auto-select from URL (?student=id) ───────────────────────────────────

  useEffect(() => {
    const id = searchParams.get('student');
    if (!id || !userRole?.school_id) return;
    supabase
      .from('students')
      .select('id, full_name, roll_number, class:class_id(name, section), parent:parent_id(full_name, father_name), fee_waiver_percentage')
      .eq('id', id).eq('school_id', userRole.school_id).maybeSingle()
      .then(({ data }) => { if (data) handleSelectStudent(data); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, userRole?.school_id]);

  // ── Select student & load fees ────────────────────────────────────────────

  const handleSelectStudent = async (student: any) => {
    setSelectedStudent(student);
    setLoadingDetails(true);
    setSuccessData(null);
    setSearchResults([]);
    setQuery('');
    const { data: fees } = await supabase
      .from('fee_records')
      .select('id, invoice_number, month_year, total_amount, paid_amount, status, breakdown')
      .eq('student_id', student.id)
      .is('deleted_at', null)
      .order('month_year', { ascending: false })
      .limit(12);
    setFeeHistory(fees || []);
    const unpaid = outstanding(fees || []);
    setPayAmount(unpaid > 0 ? String(unpaid) : '');
    setLoadingDetails(false);
  };

  const handleDelete = async (inv: FeeRecord) => {
    if (inv.status === 'paid') { alert('Paid invoices cannot be deleted.'); return; }
    const msg = Number(inv.paid_amount) > 0
      ? `Invoice has a partial payment of Rs. ${Number(inv.paid_amount).toLocaleString()}. Soft-delete it?`
      : 'Soft-delete this invoice? Recoverable from Settings → Trash Bin.';
    if (!confirm(msg)) return;
    const { error } = await supabase.from('fee_records').update({ deleted_at: new Date().toISOString() }).eq('id', inv.id);
    if (error) { alert(error.message); return; }
    if (selectedStudent) handleSelectStudent(selectedStudent);
  };

  // ── Parent search ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (mode !== 'parent') return;
    const search = async () => {
      if (!parentQuery.trim() || parentQuery.length < 2) { setParentResults([]); return; }
      setIsSearchingParent(true);
      const { data } = await supabase
        .from('parents')
        .select('id, full_name, father_name, family_number, whatsapp_number')
        .eq('school_id', userRole!.school_id)
        .ilike('full_name', `%${parentQuery}%`)
        .limit(7);
      setParentResults(data || []);
      setIsSearchingParent(false);
    };
    const t = setTimeout(search, 300);
    return () => clearTimeout(t);
  }, [parentQuery, userRole?.school_id, mode]);

  const handleSelectParent = async (parent: any) => {
    setSelectedParent(parent);
    setParentResults([]);
    setParentQuery('');
    setPayingChildId(null);
    setParentSuccessData(null);
    setLoadingParent(true);
    // Load all active children linked to this parent
    const { data: children } = await supabase
      .from('students')
      .select('id, full_name, roll_number, class:class_id(name, section)')
      .eq('parent_id', parent.id)
      .eq('school_id', userRole!.school_id)
      .eq('status', 'active')
      .order('full_name');
    const kids = children || [];
    setParentChildren(kids);
    // Load fee records for each child
    const feeMap: Record<string, FeeRecord[]> = {};
    await Promise.all(kids.map(async (kid: any) => {
      const { data: fees } = await supabase
        .from('fee_records')
        .select('id, invoice_number, month_year, total_amount, paid_amount, status, breakdown')
        .eq('student_id', kid.id)
        .is('deleted_at', null)
        .order('month_year', { ascending: true })
        .limit(12);
      feeMap[kid.id] = fees || [];
    }));
    setChildFees(feeMap);
    setLoadingParent(false);
  };

  // When a child row is clicked in parent mode, open their payment form
  const handleOpenChildPayment = (childId: string) => {
    setPayingChildId(childId === payingChildId ? null : childId);
    const fees = childFees[childId] || [];
    const unpaid = outstanding(fees);
    setPayAmount(unpaid > 0 ? String(unpaid) : '');
    setPayRemarks('');
  };

  // ── Core payment processor (shared) ──────────────────────────────────────

  const processPaymentForStudent = async (
    student: any,
    fees: FeeRecord[],
    amount: number,
    mode_: string,
    date: string,
    remarks: string,
  ): Promise<{ success: boolean; payment?: any; error?: string }> => {
    let remaining = amount;
    const updatedRecords: { id: string; originalPaid: number; originalStatus: string }[] = [];
    try {
      const pendingOldest = [...fees].filter(f => f.status !== 'paid').sort((a, b) => a.month_year.localeCompare(b.month_year));
      const paidRecords: FeeRecord[] = [];
      const paymentBreakdown: { item: string; amount: number }[] = [];
      for (const fee of pendingOldest) {
        if (remaining <= 0) break;
        const due = Number(fee.total_amount) - Number(fee.paid_amount);
        const paying = Math.min(remaining, due);
        paidRecords.push(fee);
        paymentBreakdown.push({ item: formatDate(fee.month_year), amount: paying });
        updatedRecords.push({ id: fee.id, originalPaid: Number(fee.paid_amount), originalStatus: fee.status });
        const { error } = await supabase.from('fee_records').update({
          paid_amount:  Number(fee.paid_amount) + paying,
          status:       (Number(fee.paid_amount) + paying) >= Number(fee.total_amount) ? 'paid' : 'partial',
          paid_at:      date + 'T12:00:00Z',
          payment_mode: mode_,
        }).eq('id', fee.id);
        if (error) throw error;
        remaining -= paying;
      }
      const txInserts = paidRecords.map((fee, idx) => {
        const paidAmt = paymentBreakdown[idx]?.amount ?? 0;
        const rawBd   = (fee.breakdown as { item: string; amount: number }[]) || [];
        const gross   = rawBd.reduce((s, b) => s + Number(b.amount), 0);
        const scaled  = gross > 0 ? rawBd.map(b => ({ item: b.item, amount: Math.round((Number(b.amount) / gross) * paidAmt) })) : [{ item: 'Fee Collection', amount: paidAmt }];
        return {
          school_id: userRole!.school_id, type: 'income', category: 'Fee Collection',
          amount: paidAmt, date, payment_mode: mode_,
          remarks: `${student.full_name} — ${formatDate(fee.month_year)}${remarks ? ` (${remarks})` : ''}`,
          fee_record_id: fee.id, fee_items: scaled,
        };
      });
      if (txInserts.length > 0) {
        const { error: txErr } = await supabase.from('financial_transactions').insert(txInserts);
        if (txErr) {
          for (const r of updatedRecords) await supabase.from('fee_records').update({ paid_amount: r.originalPaid, status: r.originalStatus }).eq('id', r.id);
          throw new Error(txErr.message);
        }
      }
      return {
        success: true,
        payment: {
          student_name: student.full_name, student_id: student.id,
          roll_number: student.roll_number,
          class_name: `${student.class?.name || ''}-${student.class?.section || ''}`,
          amount, date, mode: mode_,
          invoice_number: paidRecords[0]?.invoice_number || '',
          months: paidRecords.map(r => formatDate(r.month_year)).join(', '),
          breakdown: paymentBreakdown,
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // ── Student mode: submit ──────────────────────────────────────────────────

  const processPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !payAmount || isProcessing) return;
    const amount = parseFloat(payAmount);
    if (amount > totalOutstanding + 0.01 && totalOutstanding > 0) {
      alert(`Amount exceeds total outstanding (Rs. ${totalOutstanding.toLocaleString()}).`);
      return;
    }
    setIsProcessing(true);
    const result = await processPaymentForStudent(selectedStudent, feeHistory, amount, payMode, payDate, payRemarks);
    setIsProcessing(false);
    if (!result.success) { alert(`Payment failed: ${result.error}`); return; }
    setLastPayment(result.payment);
    setSuccessData(result.payment);
    setSelectedStudent(null);
    setPayAmount(''); setPayRemarks('');
    setPayDate(new Date().toISOString().split('T')[0]);
    await fetchRecentActivity();
  };

  // ── Parent mode: pay single child ────────────────────────────────────────

  const processChildPayment = async (child: any) => {
    const fees = childFees[child.id] || [];
    const amount = parseFloat(payAmount);
    const childOutstanding = outstanding(fees);
    if (!amount || amount <= 0) { alert('Please enter an amount.'); return; }
    if (amount > childOutstanding + 0.01 && childOutstanding > 0) {
      alert(`Amount exceeds outstanding (Rs. ${childOutstanding.toLocaleString()}).`);
      return;
    }
    setIsProcessing(true);
    const result = await processPaymentForStudent(child, fees, amount, payMode, payDate, payRemarks);
    setIsProcessing(false);
    if (!result.success) { alert(`Payment failed: ${result.error}`); return; }
    // Refresh child's fees
    const { data: updated } = await supabase
      .from('fee_records').select('id, invoice_number, month_year, total_amount, paid_amount, status, breakdown')
      .eq('student_id', child.id).is('deleted_at', null).order('month_year', { ascending: true }).limit(12);
    setChildFees(prev => ({ ...prev, [child.id]: updated || [] }));
    setPayingChildId(null);
    setLastPayment(result.payment);
    await fetchRecentActivity();
  };

  // ── Parent mode: pay ALL children ────────────────────────────────────────

  const handleCollectAll = async () => {
    const owing = parentChildren.filter(c => outstanding(childFees[c.id] || []) > 0);
    if (owing.length === 0) { alert('All children have no outstanding dues.'); return; }
    const total = owing.reduce((s, c) => s + outstanding(childFees[c.id] || []), 0);
    if (!confirm(`Collect full outstanding (Rs. ${total.toLocaleString()}) for ${owing.length} child${owing.length > 1 ? 'ren' : ''} via ${payMode}?`)) return;
    setCollectingAll(true);
    const results: { name: string; amount: number; success: boolean; error?: string }[] = [];
    for (const child of owing) {
      const fees  = childFees[child.id] || [];
      const amt   = outstanding(fees);
      const result = await processPaymentForStudent(child, fees, amt, payMode, payDate, '');
      results.push({ name: child.full_name, amount: amt, success: result.success, error: result.error });
      if (result.success) {
        const { data: updated } = await supabase
          .from('fee_records').select('id, invoice_number, month_year, total_amount, paid_amount, status, breakdown')
          .eq('student_id', child.id).is('deleted_at', null).order('month_year', { ascending: true }).limit(12);
        setChildFees(prev => ({ ...prev, [child.id]: updated || [] }));
      }
    }
    setCollectingAll(false);
    setParentSuccessData({ results, total, parent: selectedParent });
    await fetchRecentActivity();
  };

  // ── Print receipt ─────────────────────────────────────────────────────────

  const handlePrintReceipt = (payment: any) => {
    if (!payment) return;
    const record: ChallanRecord = {
      id: payment.student_id || 'receipt',
      invoice_number: payment.invoice_number || undefined,
      month_year: new Date().toISOString().split('T')[0],
      total_amount: payment.amount, paid_amount: payment.amount, status: 'paid',
      breakdown: payment.breakdown || [{ item: `Fee Payment (${payment.months})`, amount: payment.amount }],
      student_name: payment.student_name, roll_number: payment.roll_number,
      class_name: payment.class_name, issue_date: new Date().toISOString().split('T')[0],
    };
    const schoolInfo: SchoolInfo = { name: school?.name || 'School', address: school?.address, contact_phone: school?.contact_phone, logo_url: school?.logo_url };
    downloadChallanPDF([record], schoolInfo, { ...DEFAULT_CHALLAN_CONFIG, copies: 1 });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

      {/* Header */}
      <PageHeader
        title="Quick Fee Collection"
        subtitle="Walk-in fee payment counter — search by student or parent."
        icon={Zap}
        actions={
          <div className="flex items-center gap-6 bg-white/60 backdrop-blur-sm rounded-2xl px-6 py-3 border border-slate-100 shadow-sm">
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Today's Collections</p>
              <p className="text-xl font-black text-indigo-600 tabular-nums">Rs. {totalToday.toLocaleString()}</p>
            </div>
            <div className="h-10 w-px bg-slate-200" />
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Transactions Today</p>
              <p className="text-xl font-black text-slate-900 tabular-nums">{recentTransactions.filter(t => t.date === todayStr).length}</p>
            </div>
          </div>
        }
      />

      <HelpBanner
        storageKey="help_quick_collection"
        title="How to use Quick Collection"
        color="emerald"
        steps={[
          'Student mode: search by name or roll number, select student, enter amount and mode.',
          'Parent mode: search by parent name, view all children and their balances.',
          'Pay per child individually, or use Pay All Children to collect all dues at once.',
          'Click Collect — payment is recorded and receipt is ready to print.',
        ]}
        tip="For bulk invoice generation for a whole class, use Fee Management → Generate Invoices."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* ═══════════════ LEFT SIDEBAR (4 cols) ═══════════════ */}
        <div className="lg:col-span-4 flex flex-col gap-4">

          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-slate-100 rounded-xl">
            {([
              { key: 'student', label: 'By Student', icon: User },
              { key: 'parent',  label: 'By Parent',  icon: UserCheck },
            ] as const).map(m => (
              <button
                key={m.key}
                onClick={() => {
                  setMode(m.key);
                  setSearchResults([]); setParentResults([]);
                  setQuery(''); setParentQuery('');
                  setSelectedStudent(null); setSelectedParent(null);
                  setSuccessData(null); setParentSuccessData(null);
                }}
                className={cn(
                  'flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-black transition-all',
                  mode === m.key
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700',
                )}
              >
                <m.icon className="w-3.5 h-3.5" />
                {m.label}
              </button>
            ))}
          </div>

          {/* ── STUDENT SEARCH ── */}
          {mode === 'student' && (
            <Card className="p-4 space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Find Student</p>
              <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Name or roll number..." icon={Search} autoFocus />
              <Select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}>
                <option value="">All Classes</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.section ? ` — ${c.section}` : ''}</option>)}
              </Select>
              <AnimatePresence>
                {searchResults.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-1">
                    {searchResults.map(s => (
                      <button key={s.id} onClick={() => handleSelectStudent(s)}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-transparent hover:border-indigo-100 hover:bg-indigo-50 transition-all group"
                      >
                        <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-sm font-black text-white shrink-0', avatarColor(s.full_name))}>
                          {s.full_name[0]}
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className="text-sm font-black text-slate-800 group-hover:text-indigo-700 truncate">{s.full_name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">
                            {s.class?.name} · #{s.roll_number}
                            {s.parent?.full_name ? ` · S/O ${s.parent.full_name}` : ''}
                          </p>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-500 shrink-0" />
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
              {query.length >= 2 && !isSearching && searchResults.length === 0 && (
                <div className="py-6 text-center">
                  <Users className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No student found</p>
                </div>
              )}
            </Card>
          )}

          {/* ── PARENT SEARCH ── */}
          {mode === 'parent' && (
            <Card className="p-4 space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Find Parent / Guardian</p>
              <Input value={parentQuery} onChange={e => setParentQuery(e.target.value)} placeholder="Parent name..." icon={Search} autoFocus />
              <AnimatePresence>
                {parentResults.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-1">
                    {parentResults.map(p => (
                      <button key={p.id} onClick={() => handleSelectParent(p)}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-transparent hover:border-violet-100 hover:bg-violet-50 transition-all group"
                      >
                        <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-sm font-black text-white shrink-0', avatarColor(p.full_name))}>
                          {p.full_name[0]}
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className="text-sm font-black text-slate-800 group-hover:text-violet-700 truncate">{p.full_name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                            {p.family_number || 'No family #'}
                            {p.whatsapp_number ? ` · ${p.whatsapp_number}` : ''}
                          </p>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-violet-500 shrink-0" />
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
              {parentQuery.length >= 2 && !isSearchingParent && parentResults.length === 0 && (
                <div className="py-6 text-center">
                  <Users className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No parent found</p>
                </div>
              )}
            </Card>
          )}

          {/* Recent Activity */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Recent Activity</p>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-black text-emerald-600">{recentTransactions.filter(t => t.date === todayStr).length} today</span>
              </div>
            </div>
            <div className="space-y-1.5">
              {recentTransactions.map(t => {
                const ModeIcon = PAYMENT_MODES.find(m => m.id === t.mode)?.icon ?? Wallet;
                return (
                  <button key={t.id} onClick={() => setSelectedRecentTx(t)}
                    className="w-full text-left p-2.5 rounded-xl bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/40 transition-all group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center shrink-0">
                          <span className="text-xs font-black text-slate-600">{t.student_name[0]}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-700 truncate group-hover:text-indigo-700">{t.student_name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <ModeIcon className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                            <p className="text-[10px] font-bold text-slate-400 uppercase">{modeDateLabel(t.date)}</p>
                          </div>
                        </div>
                      </div>
                      <p className="text-xs font-black text-indigo-600 tabular-nums shrink-0">Rs {t.amount.toLocaleString()}</p>
                    </div>
                  </button>
                );
              })}
              {recentTransactions.length === 0 && (
                <div className="py-8 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">No activity yet</div>
              )}
            </div>
          </Card>
        </div>

        {/* ═══════════════ MAIN PANEL (8 cols) ═══════════════ */}
        <div className="lg:col-span-8 space-y-5 flex flex-col">
          <AnimatePresence mode="wait">

            {/* ════════════════════════════════════════════════════
                STUDENT MODE — student selected
            ════════════════════════════════════════════════════ */}
            {mode === 'student' && selectedStudent && (
              <motion.div key={`stu-${selectedStudent.id}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">

                {/* Student header */}
                <Card className={cn('p-5 border-none shadow-lg', totalOutstanding > 0 ? 'bg-gradient-to-r from-indigo-600 to-violet-700 shadow-indigo-200/60' : 'bg-gradient-to-r from-emerald-600 to-teal-700 shadow-emerald-200/60')}>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black text-white bg-white/20 backdrop-blur-md border-2 border-white/30 shrink-0">
                      {selectedStudent.full_name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h2 className="text-lg font-black text-white tracking-tight truncate">{selectedStudent.full_name}</h2>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                            <span className="text-xs font-bold text-white/80 uppercase tracking-widest">{selectedStudent.class?.name}{selectedStudent.class?.section ? ` · ${selectedStudent.class.section}` : ''}</span>
                            <span className="text-xs font-bold text-white/60">Roll #{selectedStudent.roll_number}</span>
                            {selectedStudent.parent?.full_name && (
                              <span className="text-xs font-bold text-white/70 bg-white/10 px-2 py-0.5 rounded-full">
                                S/O {selectedStudent.parent.full_name}
                              </span>
                            )}
                          </div>
                        </div>
                        <button onClick={() => { setSelectedStudent(null); setFeeHistory([]); setPayAmount(''); }} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/25 transition-colors shrink-0">
                          <XIcon className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    </div>
                    <div className="hidden sm:block text-right shrink-0 border-l border-white/20 pl-4 ml-2">
                      {totalOutstanding > 0 ? (
                        <>
                          <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-0.5">Total Pending</p>
                          <p className="text-2xl font-black text-white tabular-nums">Rs {totalOutstanding.toLocaleString()}</p>
                          <p className="text-[10px] font-bold text-white/60 mt-0.5">{pendingInvoices.length} invoice{pendingInvoices.length !== 1 ? 's' : ''} due</p>
                        </>
                      ) : (
                        <>
                          <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-0.5">Balance</p>
                          <p className="text-xl font-black text-white">All Clear</p>
                        </>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Invoice table + payment form */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-5 items-start">

                  {/* Invoice ledger */}
                  <Card className="md:col-span-3 p-0 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                      <div className="flex items-center gap-2"><Receipt className="w-4 h-4 text-slate-400" /><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Fee Ledger</p></div>
                      <Badge variant="secondary" className="text-[10px]">{feeHistory.length} records</Badge>
                    </div>
                    {loadingDetails ? (
                      <div className="flex items-center justify-center py-16 opacity-30"><Clock className="w-8 h-8 animate-spin" /></div>
                    ) : feeHistory.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 opacity-30"><Receipt className="w-8 h-8 mb-2" /><p className="text-[10px] font-black uppercase tracking-widest">No fee records</p></div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead><tr className="border-b border-slate-100">
                            <th className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Month</th>
                            <th className="px-3 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                            <th className="px-3 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Balance</th>
                            <th className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                            <th className="w-8" />
                          </tr></thead>
                          <tbody className="divide-y divide-slate-50">
                            {feeHistory.map(inv => {
                              const bal = Number(inv.total_amount) - Number(inv.paid_amount);
                              const isPaid = inv.status === 'paid';
                              const isPartial = inv.status === 'partial';
                              return (
                                <tr key={inv.id} className={cn('group transition-colors', isPaid ? 'bg-white hover:bg-slate-50/50' : isPartial ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'bg-red-50/30 hover:bg-red-50/60')}>
                                  <td className="px-4 py-2.5">
                                    <p className="text-xs font-black text-slate-800">{formatDate(inv.month_year)}</p>
                                    {inv.invoice_number && <p className="text-[10px] font-bold text-slate-400">{inv.invoice_number}</p>}
                                  </td>
                                  <td className="px-3 py-2.5 text-right text-xs font-bold text-slate-600 tabular-nums">Rs {Number(inv.total_amount).toLocaleString()}</td>
                                  <td className="px-3 py-2.5 text-right tabular-nums">
                                    {isPaid ? <span className="flex items-center justify-end gap-1 text-emerald-600 text-xs font-black"><CheckCircle className="w-3.5 h-3.5" />Paid</span>
                                      : <span className={cn('text-xs font-black', isPartial ? 'text-amber-700' : 'text-red-700')}>Rs {bal.toLocaleString()}</span>}
                                  </td>
                                  <td className="px-4 py-2.5 text-center"><Badge variant={isPaid ? 'success' : isPartial ? 'warning' : 'danger'} className="text-[9px] uppercase">{inv.status}</Badge></td>
                                  <td className="pr-2 py-2.5 w-8">
                                    {!isPaid && <button onClick={() => handleDelete(inv)} className="p-1 rounded text-slate-200 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3 h-3" /></button>}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          {totalOutstanding > 0 && (
                            <tfoot><tr className="border-t-2 border-slate-200 bg-slate-50">
                              <td colSpan={2} className="px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Outstanding</td>
                              <td className="px-3 py-2.5 text-right text-sm font-black text-red-700 tabular-nums">Rs {totalOutstanding.toLocaleString()}</td>
                              <td colSpan={2} />
                            </tr></tfoot>
                          )}
                        </table>
                      </div>
                    )}
                  </Card>

                  {/* Payment form */}
                  <Card className="md:col-span-2 p-5 space-y-4">
                    {totalOutstanding > 0 && (
                      <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-0.5">Outstanding</p>
                          <p className="text-xl font-black text-red-700 tabular-nums">Rs {totalOutstanding.toLocaleString()}</p>
                        </div>
                        <AlertCircle className="w-6 h-6 text-red-300" />
                      </div>
                    )}
                    <form onSubmit={processPayment} className="space-y-4">
                      {totalOutstanding > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quick Fill</p>
                          <div className="grid grid-cols-3 gap-2">
                            {[{ label: 'Full\nBalance', val: totalOutstanding }, ...(thisMonthBalance > 0 && thisMonthBalance !== totalOutstanding ? [{ label: 'This\nMonth', val: thisMonthBalance }] : [])].map(opt => (
                              <button key={opt.label} type="button" onClick={() => setPayAmount(String(opt.val))}
                                className={cn('py-2 px-2 rounded-lg border text-[11px] font-black transition-all whitespace-pre-line leading-tight', parseFloat(payAmount) === opt.val ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50')}>
                                {opt.label}
                              </button>
                            ))}
                            <button type="button" onClick={() => setPayAmount('')}
                              className={cn('py-2 px-2 rounded-lg border text-[11px] font-black transition-all', payAmount && parseFloat(payAmount) !== totalOutstanding && parseFloat(payAmount) !== thisMonthBalance ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50')}>
                              Custom
                            </button>
                          </div>
                        </div>
                      )}
                      <Input label="Amount to Collect" type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="Enter amount..." icon={DollarSign} className="!text-lg !font-black" required />
                      <AnimatePresence>
                        {allocationPreview.length > 0 && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                            <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3 space-y-1.5">
                              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Will Cover</p>
                              {allocationPreview.map((p, i) => (
                                <div key={i} className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <div className={cn('w-2 h-2 rounded-full', p.full ? 'bg-emerald-500' : 'bg-amber-400')} />
                                    <span className="text-xs font-bold text-indigo-800">{p.month}{!p.full && <span className="text-[10px] text-indigo-400 ml-1">(partial)</span>}</span>
                                  </div>
                                  <span className="text-xs font-black text-indigo-700 tabular-nums">Rs {p.paying.toLocaleString()}</span>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment Mode</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {PAYMENT_MODES.map(m => (
                            <button key={m.id} type="button" onClick={() => setPayMode(m.id)}
                              className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-black transition-all', payMode === m.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'border-slate-200 text-slate-600 hover:border-indigo-200 hover:bg-indigo-50')}>
                              <m.icon className="w-3.5 h-3.5 shrink-0" />{m.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Input label="Date" type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
                        <Input label="Remarks" value={payRemarks} onChange={e => setPayRemarks(e.target.value)} placeholder="Optional" />
                      </div>
                      <button type="submit" disabled={!payAmount || Number(payAmount) <= 0 || isProcessing}
                        className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl font-black text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all">
                        {isProcessing ? <><Clock className="w-4 h-4 animate-spin" />Processing...</> : <><Zap className="w-4 h-4" />Collect {payAmount ? `Rs. ${Number(payAmount).toLocaleString()}` : ''} & Print Receipt</>}
                      </button>
                      <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest">Oldest invoices are paid first</p>
                    </form>
                  </Card>
                </div>
              </motion.div>
            )}

            {/* ════════════════════════════════════════════════════
                PARENT MODE — parent selected
            ════════════════════════════════════════════════════ */}
            {mode === 'parent' && selectedParent && (
              <motion.div key={`par-${selectedParent.id}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">

                {/* Parent header */}
                <Card className="p-5 bg-gradient-to-r from-violet-600 to-purple-700 border-none shadow-lg shadow-violet-200/50">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black text-white bg-white/20 backdrop-blur-md border-2 border-white/30 shrink-0">
                      {selectedParent.full_name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h2 className="text-lg font-black text-white">{selectedParent.full_name}</h2>
                          <div className="flex flex-wrap gap-x-3 mt-1">
                            {selectedParent.family_number && <span className="text-xs font-bold text-white/70">{selectedParent.family_number}</span>}
                            {selectedParent.whatsapp_number && <span className="text-xs font-bold text-white/70">{selectedParent.whatsapp_number}</span>}
                            {selectedParent.father_name && <span className="text-xs font-bold text-white/60">S/O {selectedParent.father_name}</span>}
                          </div>
                        </div>
                        <button onClick={() => { setSelectedParent(null); setParentChildren([]); setChildFees({}); setPayingChildId(null); setParentSuccessData(null); }} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/25 transition-colors shrink-0">
                          <XIcon className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    </div>
                    <div className="hidden sm:block text-right shrink-0 border-l border-white/20 pl-4 ml-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-0.5">Children</p>
                      <p className="text-2xl font-black text-white tabular-nums">{parentChildren.length}</p>
                      <p className="text-[10px] font-bold text-white/60 mt-0.5">
                        Total: Rs {parentChildren.reduce((s, c) => s + outstanding(childFees[c.id] || []), 0).toLocaleString()} due
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Pay All bar */}
                {!parentSuccessData && parentChildren.filter(c => outstanding(childFees[c.id] || []) > 0).length > 0 && (
                  <div className="flex items-center justify-between gap-4 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3">
                    <div>
                      <p className="text-xs font-black text-amber-800">
                        Total outstanding across all children: <span className="text-base font-black text-amber-900 tabular-nums ml-1">
                          Rs {parentChildren.reduce((s, c) => s + outstanding(childFees[c.id] || []), 0).toLocaleString()}
                        </span>
                      </p>
                      <p className="text-[10px] font-bold text-amber-600 mt-0.5">Payment mode: {payMode}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Mode pills */}
                      <div className="hidden lg:flex gap-1">
                        {PAYMENT_MODES.map(m => (
                          <button key={m.id} type="button" onClick={() => setPayMode(m.id)}
                            className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-black transition-all', payMode === m.id ? 'bg-amber-600 text-white border-amber-600' : 'border-amber-200 text-amber-700 hover:bg-amber-100')}>
                            <m.icon className="w-3 h-3" />{m.label}
                          </button>
                        ))}
                      </div>
                      <button onClick={handleCollectAll} disabled={collectingAll}
                        className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl shadow-md shadow-amber-200 disabled:opacity-50 transition-all active:scale-[0.98]">
                        {collectingAll ? <><Clock className="w-3.5 h-3.5 animate-spin" />Processing...</> : <><Zap className="w-3.5 h-3.5" />Pay All Children</>}
                      </button>
                    </div>
                  </div>
                )}

                {/* Parent success */}
                {parentSuccessData && (
                  <Card className="p-6 bg-emerald-50 border-emerald-200">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-emerald-900">Collection Complete</h3>
                        <p className="text-xs text-emerald-600 font-bold">
                          Rs {parentSuccessData.results.filter((r: any) => r.success).reduce((s: number, r: any) => s + r.amount, 0).toLocaleString()} collected for {selectedParent.full_name}
                        </p>
                      </div>
                      <button onClick={() => setParentSuccessData(null)} className="ml-auto p-1.5 rounded-lg hover:bg-emerald-200 transition-colors">
                        <XIcon className="w-4 h-4 text-emerald-600" />
                      </button>
                    </div>
                    <div className="space-y-2">
                      {parentSuccessData.results.map((r: any, i: number) => (
                        <div key={i} className={cn('flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold', r.success ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800')}>
                          <span>{r.name}</span>
                          <span>{r.success ? `Rs ${r.amount.toLocaleString()} ✓` : `Failed: ${r.error}`}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Children list */}
                {loadingParent ? (
                  <Card className="py-16 flex flex-col items-center opacity-30">
                    <Clock className="w-8 h-8 animate-spin mb-3" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Loading children...</p>
                  </Card>
                ) : parentChildren.length === 0 ? (
                  <Card className="py-16 flex flex-col items-center opacity-40">
                    <Users className="w-10 h-10 mb-3" />
                    <p className="text-sm font-black text-slate-500">No children linked to this parent</p>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {parentChildren.map(child => {
                      const fees   = childFees[child.id] || [];
                      const due    = outstanding(fees);
                      const isOpen = payingChildId === child.id;
                      const childPendingInvoices = fees.filter(f => f.status !== 'paid');
                      const childAllocationPreview = (() => {
                        const amt = isOpen ? (parseFloat(payAmount) || 0) : 0;
                        if (!amt || childPendingInvoices.length === 0) return [];
                        const sorted = [...childPendingInvoices].sort((a, b) => a.month_year.localeCompare(b.month_year));
                        let rem = amt;
                        const out: { month: string; paying: number; full: boolean }[] = [];
                        for (const f of sorted) {
                          if (rem <= 0) break;
                          const d2 = Number(f.total_amount) - Number(f.paid_amount);
                          const paying = Math.min(rem, d2);
                          out.push({ month: formatDate(f.month_year), paying, full: paying >= d2 - 0.01 });
                          rem -= paying;
                        }
                        return out;
                      })();

                      return (
                        <Card key={child.id} className={cn('overflow-hidden transition-all', isOpen ? 'ring-2 ring-indigo-400' : '')}>
                          {/* Child row */}
                          <div className={cn('p-4 flex items-center gap-4', due > 0 ? 'bg-white' : 'bg-emerald-50/50')}>
                            <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center text-base font-black text-white shrink-0', avatarColor(child.full_name))}>
                              {child.full_name[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-black text-slate-800 truncate">{child.full_name}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                {child.class?.name}{child.class?.section ? ` · ${child.class.section}` : ''} · Roll #{child.roll_number}
                              </p>
                            </div>
                            <div className="text-right shrink-0 mr-2">
                              {due > 0 ? (
                                <>
                                  <p className="text-sm font-black text-red-700 tabular-nums">Rs {due.toLocaleString()}</p>
                                  <p className="text-[10px] font-bold text-red-400">{childPendingInvoices.length} invoice{childPendingInvoices.length !== 1 ? 's' : ''} due</p>
                                </>
                              ) : (
                                <span className="flex items-center gap-1 text-emerald-600 text-xs font-black"><CheckCircle className="w-3.5 h-3.5" />Cleared</span>
                              )}
                            </div>
                            {due > 0 && (
                              <button onClick={() => handleOpenChildPayment(child.id)}
                                className={cn('px-4 py-2 rounded-xl text-xs font-black transition-all', isOpen ? 'bg-slate-200 text-slate-700' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm')}>
                                {isOpen ? 'Close' : 'Collect'}
                              </button>
                            )}
                          </div>

                          {/* Inline payment form */}
                          <AnimatePresence>
                            {isOpen && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                <div className="border-t border-slate-100 p-4 bg-slate-50/50 space-y-4">
                                  {/* Fee mini-table */}
                                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                                    <table className="w-full text-left text-xs">
                                      <thead><tr className="bg-slate-100">
                                        <th className="px-3 py-2 font-black text-slate-500 uppercase tracking-widest">Month</th>
                                        <th className="px-3 py-2 font-black text-slate-500 uppercase tracking-widest text-right">Amount</th>
                                        <th className="px-3 py-2 font-black text-slate-500 uppercase tracking-widest text-right">Balance</th>
                                        <th className="px-3 py-2 font-black text-slate-500 uppercase tracking-widest text-center">Status</th>
                                      </tr></thead>
                                      <tbody className="divide-y divide-slate-100 bg-white">
                                        {fees.map(inv => {
                                          const bal = Number(inv.total_amount) - Number(inv.paid_amount);
                                          const isPaid = inv.status === 'paid';
                                          return (
                                            <tr key={inv.id} className={cn(isPaid ? '' : inv.status === 'partial' ? 'bg-amber-50/40' : 'bg-red-50/30')}>
                                              <td className="px-3 py-2 font-bold text-slate-700">{formatDate(inv.month_year)}</td>
                                              <td className="px-3 py-2 text-right font-bold text-slate-600 tabular-nums">Rs {Number(inv.total_amount).toLocaleString()}</td>
                                              <td className="px-3 py-2 text-right font-black tabular-nums">
                                                {isPaid ? <span className="text-emerald-600">Paid</span> : <span className={inv.status === 'partial' ? 'text-amber-700' : 'text-red-700'}>Rs {bal.toLocaleString()}</span>}
                                              </td>
                                              <td className="px-3 py-2 text-center"><Badge variant={isPaid ? 'success' : inv.status === 'partial' ? 'warning' : 'danger'} className="text-[9px]">{inv.status}</Badge></td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>

                                  {/* Payment controls */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                      <div className="flex gap-2">
                                        <button type="button" onClick={() => setPayAmount(String(due))}
                                          className={cn('flex-1 py-2 rounded-lg border text-xs font-black transition-all', parseFloat(payAmount) === due ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:bg-indigo-50')}>
                                          Full Balance (Rs {due.toLocaleString()})
                                        </button>
                                        <button type="button" onClick={() => setPayAmount('')}
                                          className={cn('px-3 py-2 rounded-lg border text-xs font-black transition-all', payAmount && parseFloat(payAmount) !== due ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:bg-indigo-50')}>
                                          Custom
                                        </button>
                                      </div>
                                      <Input label="Amount" type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="Rs..." icon={DollarSign} />
                                      <div className="grid grid-cols-2 gap-2">
                                        <Input label="Date" type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
                                        <Input label="Remarks" value={payRemarks} onChange={e => setPayRemarks(e.target.value)} placeholder="Optional" />
                                      </div>
                                    </div>
                                    <div className="space-y-3">
                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment Mode</p>
                                      <div className="grid grid-cols-2 gap-1.5">
                                        {PAYMENT_MODES.map(m => (
                                          <button key={m.id} type="button" onClick={() => setPayMode(m.id)}
                                            className={cn('flex items-center gap-1.5 px-2 py-2 rounded-lg border text-[11px] font-black transition-all', payMode === m.id ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:bg-indigo-50')}>
                                            <m.icon className="w-3 h-3 shrink-0" />{m.label}
                                          </button>
                                        ))}
                                      </div>
                                      {/* Allocation preview */}
                                      {childAllocationPreview.length > 0 && (
                                        <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-2.5 space-y-1">
                                          <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Will Cover</p>
                                          {childAllocationPreview.map((p, i) => (
                                            <div key={i} className="flex justify-between text-xs font-bold text-indigo-700">
                                              <span className="flex items-center gap-1"><div className={cn('w-1.5 h-1.5 rounded-full', p.full ? 'bg-emerald-500' : 'bg-amber-400')} />{p.month}</span>
                                              <span className="tabular-nums">Rs {p.paying.toLocaleString()}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      <button
                                        onClick={() => processChildPayment(child)}
                                        disabled={!payAmount || Number(payAmount) <= 0 || isProcessing}
                                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]">
                                        {isProcessing ? <><Clock className="w-4 h-4 animate-spin" />Processing...</> : <><Zap className="w-4 h-4" />Collect for {child.full_name.split(' ')[0]}</>}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* ════════════════════════════════════════════════════
                IDLE / SUCCESS states
            ════════════════════════════════════════════════════ */}
            {((mode === 'student' && !selectedStudent) || (mode === 'parent' && !selectedParent)) && (
              <motion.div key="idle" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="flex-1">
                {successData ? (
                  <Card className="py-12 flex flex-col items-center border-dashed bg-slate-50/50">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-100">
                      <CheckCircle className="w-10 h-10 text-emerald-600" />
                    </motion.div>
                    <h2 className="text-2xl font-black text-slate-800 mb-1">Payment Collected</h2>
                    <p className="text-3xl font-black text-emerald-600 tabular-nums mb-6">Rs. {successData.amount.toLocaleString()}</p>
                    <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 mb-6 text-left overflow-hidden shadow-sm">
                      {[
                        { label: 'Student',        val: successData.student_name },
                        { label: 'Class',          val: successData.class_name },
                        { label: 'Covered Months', val: successData.months },
                        { label: 'Mode',           val: successData.mode },
                        { label: 'Date',           val: formatDate(successData.date) },
                      ].map(row => (
                        <div key={row.label} className="flex justify-between items-center px-5 py-3">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{row.label}</span>
                          <span className="text-sm font-bold text-slate-700 text-right max-w-[200px]">{row.val}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-col gap-3 w-full max-w-sm">
                      <Btn variant="primary" onClick={() => handlePrintReceipt(lastPayment)} className="w-full !py-3.5" icon={Printer}>Print Receipt</Btn>
                      <Btn variant="secondary" onClick={() => navigate(`/fees/student-detail?student=${successData.student_id}`)} className="w-full" icon={ExternalLink}>View Full Ledger</Btn>
                      <button onClick={() => setSuccessData(null)} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black text-indigo-600 hover:bg-indigo-50 transition-colors">
                        <Zap className="w-4 h-4" />New Collection
                      </button>
                    </div>
                  </Card>
                ) : (
                  <Card className="h-full min-h-80 flex flex-col items-center justify-center py-20 border-dashed bg-slate-50/50">
                    <div className="w-20 h-20 rounded-3xl bg-white shadow-xl flex items-center justify-center mb-6">
                      <Zap className="w-10 h-10 text-indigo-200" />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 mb-2">Ready to Collect?</h3>
                    <p className="text-sm text-slate-400 max-w-xs text-center font-medium">
                      {mode === 'student' ? 'Search for a student on the left to begin fast fee processing.' : 'Search for a parent to view and collect fees for all their children.'}
                    </p>
                  </Card>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>

      {/* ── Transaction detail modal ─────────────────────────────────── */}
      <AnimatePresence>
        {selectedRecentTx && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-sm overflow-hidden">
              <div className="px-6 py-4 flex items-center justify-between border-b border-gray-50 bg-gray-50/50">
                <div className="flex items-center gap-2"><History className="w-4 h-4 text-indigo-600" /><h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Transaction Details</h3></div>
                <button onClick={() => setSelectedRecentTx(null)} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 transition-colors"><XIcon className="w-4 h-4" /></button>
              </div>
              <div className="p-6 space-y-5">
                <div className="flex flex-col items-center text-center">
                  <div className={cn('w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold mb-3', avatarColor(selectedRecentTx.student_name))}>
                    {selectedRecentTx.student_name[0]}
                  </div>
                  <h4 className="text-lg font-bold text-gray-900">{selectedRecentTx.student_name}</h4>
                  <p className="text-2xl font-black text-indigo-600 mt-1">Rs. {selectedRecentTx.amount.toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-slate-100 divide-y divide-slate-50 overflow-hidden">
                  {[{ l: 'Date', v: formatDate(selectedRecentTx.date) }, { l: 'Method', v: selectedRecentTx.mode }].map(r => (
                    <div key={r.l} className="flex justify-between items-center px-4 py-3">
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{r.l}</span>
                      <span className="text-sm font-bold text-gray-800">{r.v}</span>
                    </div>
                  ))}
                  <div className="flex flex-col gap-1 px-4 py-3">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Remarks</span>
                    <p className="text-xs text-gray-600 leading-relaxed italic bg-gray-50 rounded-lg p-2.5 border border-gray-100">{selectedRecentTx.remarks}</p>
                  </div>
                </div>
                <button
                  onClick={() => handlePrintReceipt({ student_name: selectedRecentTx.student_name, amount: selectedRecentTx.amount, months: selectedRecentTx.remarks.match(/\[(.*?)\]/)?.[1] || 'Balance Payment', student_id: '', roll_number: '', class_name: '', date: selectedRecentTx.date, mode: selectedRecentTx.mode, invoice_number: '', breakdown: [{ item: 'Fee Payment', amount: selectedRecentTx.amount }] })}
                  className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all">
                  <Printer className="w-4 h-4" />Reprint Receipt
                </button>
                <p className="text-[10px] text-center text-gray-400 font-medium">Ref: {selectedRecentTx.id}</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
