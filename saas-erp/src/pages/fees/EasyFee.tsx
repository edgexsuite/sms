import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Zap, Search, CheckCircle, Wallet,
  ArrowRight, Printer, History, Users,
  Receipt, Landmark, Clock, X as XIcon, Trash2, ExternalLink,
  CreditCard, DollarSign, Banknote, Smartphone, FileText,
  CalendarDays, AlertCircle, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDate } from '../../lib/utils';
import { downloadChallanPDF, DEFAULT_CHALLAN_CONFIG, type ChallanRecord, type SchoolInfo } from '../../lib/challanUtils';
import HelpBanner from '../../components/HelpBanner';
import { PageHeader, Card, Btn, Badge, Select, Input } from '../../components/ui';

// ── Types ────────────────────────────────────────────────────────────────────

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

// Payment mode config
const PAYMENT_MODES = [
  { id: 'Cash',          label: 'Cash',   icon: Banknote   },
  { id: 'Bank Transfer', label: 'Bank',   icon: Landmark   },
  { id: 'Cheque',        label: 'Cheque', icon: FileText   },
  { id: 'Online',        label: 'Online', icon: Smartphone },
];

// Colour helpers
function avatarColor(name: string) {
  const colours = [
    'bg-indigo-500','bg-violet-500','bg-sky-500','bg-emerald-500',
    'bg-amber-500','bg-rose-500','bg-teal-500','bg-fuchsia-500',
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colours[Math.abs(h) % colours.length];
}

function modeDateLabel(dateStr: string) {
  const today    = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dateStr === today)     return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  return formatDate(dateStr);
}

// ── Component ────────────────────────────────────────────────────────────────

export default function EasyFee() {
  const { userRole } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // States
  const [query, setQuery]                   = useState('');
  const [searchResults, setSearchResults]   = useState<any[]>([]);
  const [isSearching, setIsSearching]       = useState(false);
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [selectedRecentTx, setSelectedRecentTx]     = useState<RecentTransaction | null>(null);

  // Selection
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [feeHistory, setFeeHistory]           = useState<FeeRecord[]>([]);
  const [loadingDetails, setLoadingDetails]   = useState(false);

  // Payment Form
  const [payAmount, setPayAmount]   = useState('');
  const [payMode, setPayMode]       = useState('Cash');
  const [payDate, setPayDate]       = useState(new Date().toISOString().split('T')[0]);
  const [payRemarks, setPayRemarks] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successData, setSuccessData]   = useState<any | null>(null);
  const [lastPayment, setLastPayment]   = useState<any>(null);

  // Filters
  const [classes, setClasses]               = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [school, setSchool]                 = useState<any>(null);

  // ── Derived ───────────────────────────────────────────────────────────────

  const pendingInvoices = useMemo(
    () => feeHistory.filter(f => f.status !== 'paid'),
    [feeHistory],
  );

  const totalOutstanding = useMemo(
    () => pendingInvoices.reduce((s, f) => s + (Number(f.total_amount) - Number(f.paid_amount)), 0),
    [pendingInvoices],
  );

  const thisMonthBalance = useMemo(() => {
    const thisMonth = new Date().toISOString().slice(0, 7);
    const inv = pendingInvoices.find(f => f.month_year.startsWith(thisMonth));
    return inv ? Number(inv.total_amount) - Number(inv.paid_amount) : 0;
  }, [pendingInvoices]);

  // Live allocation preview — which months does the entered amount cover?
  const allocationPreview = useMemo(() => {
    const amt = parseFloat(payAmount) || 0;
    if (!amt || pendingInvoices.length === 0) return [];
    const sorted = [...pendingInvoices].sort((a, b) => a.month_year.localeCompare(b.month_year));
    let rem = amt;
    const preview: { month: string; paying: number; full: boolean }[] = [];
    for (const fee of sorted) {
      if (rem <= 0) break;
      const due   = Number(fee.total_amount) - Number(fee.paid_amount);
      const paying = Math.min(rem, due);
      preview.push({ month: formatDate(fee.month_year), paying, full: paying >= due - 0.01 });
      rem -= paying;
    }
    return preview;
  }, [payAmount, pendingInvoices]);

  const todayStr   = new Date().toISOString().slice(0, 10);
  const totalToday = recentTransactions
    .filter(t => t.date === todayStr)
    .reduce((s, t) => s + Number(t.amount || 0), 0);

  // ── Fetch Metadata ─────────────────────────────────────────────────────────

  const fetchMetadata = useCallback(async () => {
    if (!userRole?.school_id) return;
    const [{ data: sch }, { data: cls }] = await Promise.all([
      supabase.from('schools').select('*').eq('id', userRole.school_id).maybeSingle(),
      supabase.from('classes').select('id, name, section').eq('school_id', userRole.school_id).order('name'),
    ]);
    if (sch)  setSchool(sch);
    if (cls)  setClasses(cls);
  }, [userRole?.school_id]);

  useEffect(() => { fetchMetadata(); }, [fetchMetadata]);

  // ── Recent Activity ────────────────────────────────────────────────────────

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
        id:           t.id,
        student_name: t.remarks?.split('[')[0]?.replace('Fee — ', '')?.trim() || 'Student',
        amount:       t.amount,
        date:         t.date,
        mode:         t.payment_mode,
        remarks:      t.remarks || '',
      })));
    }
  }, [userRole?.school_id]);

  useEffect(() => { fetchRecentActivity(); }, [fetchRecentActivity]);

  // ── Live Search ────────────────────────────────────────────────────────────

  useEffect(() => {
    const search = async () => {
      if (!query.trim() || query.length < 2) { setSearchResults([]); return; }
      setIsSearching(true);
      let q = supabase
        .from('students')
        .select('id, full_name, roll_number, father_name, class:class_id(name, section)')
        .eq('school_id', userRole!.school_id)
        .eq('status', 'active');
      if (selectedClassId) q = q.eq('class_id', selectedClassId);
      const numericQuery = parseInt(query);
      if (!isNaN(numericQuery)) {
        // numeric input → search by roll number OR name
        q = q.or(`full_name.ilike.%${query}%,roll_number.eq.${numericQuery}`);
      } else {
        // text input → plain ilike, avoids or() with single condition which PostgREST rejects
        q = q.ilike('full_name', `%${query}%`);
      }
      const { data } = await q.limit(7);
      setSearchResults(data || []);
      setIsSearching(false);
    };
    const t = setTimeout(search, 300);
    return () => clearTimeout(t);
  }, [query, selectedClassId, userRole?.school_id]);

  // ── Auto-select from URL (?student=id) ────────────────────────────────────

  useEffect(() => {
    const id = searchParams.get('student');
    if (!id || !userRole?.school_id) return;
    supabase
      .from('students')
      .select('id, full_name, roll_number, father_name, class:class_id(name, section), fee_waiver_percentage')
      .eq('id', id)
      .eq('school_id', userRole.school_id)
      .maybeSingle()
      .then(({ data }) => { if (data) handleSelect(data); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, userRole?.school_id]);

  // ── Select Student & Load Ledger ───────────────────────────────────────────

  const handleSelect = async (student: any) => {
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

    const unpaid = (fees || [])
      .filter(f => f.status !== 'paid')
      .reduce((s, f) => s + (Number(f.total_amount) - Number(f.paid_amount)), 0);
    setPayAmount(unpaid > 0 ? String(unpaid) : '');
    setLoadingDetails(false);
  };

  const handleDelete = async (inv: FeeRecord) => {
    if (inv.status === 'paid') {
      alert('Paid invoices cannot be deleted — they have payment records in the ledger.');
      return;
    }
    const hasPartial = Number(inv.paid_amount) > 0;
    const msg = hasPartial
      ? `Invoice has a partial payment of Rs. ${Number(inv.paid_amount).toLocaleString()}. Soft-delete it (recoverable from Trash Bin)?`
      : 'Soft-delete this invoice? It can be recovered from Settings → Trash Bin.';
    if (!confirm(msg)) return;
    const { error } = await supabase.from('fee_records').update({ deleted_at: new Date().toISOString() }).eq('id', inv.id);
    if (error) { alert(error.message); return; }
    if (selectedStudent) handleSelect(selectedStudent);
  };

  // ── Process Payment ────────────────────────────────────────────────────────

  const processPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !payAmount || isProcessing) return;

    const amount = parseFloat(payAmount);

    if (amount > totalOutstanding + 0.01 && totalOutstanding > 0) {
      alert(`Amount exceeds total outstanding (Rs. ${totalOutstanding.toLocaleString()}). Please enter a valid amount.`);
      return;
    }

    setIsProcessing(true);
    let remaining = amount;
    const updatedRecords: { id: string; originalPaid: number; originalStatus: string }[] = [];

    try {
      const pendingOldest = [...feeHistory]
        .filter(f => f.status !== 'paid')
        .sort((a, b) => a.month_year.localeCompare(b.month_year));

      const paidRecords: FeeRecord[]                    = [];
      const paymentBreakdown: { item: string; amount: number }[] = [];

      for (const fee of pendingOldest) {
        if (remaining <= 0) break;
        const due    = Number(fee.total_amount) - Number(fee.paid_amount);
        const paying = Math.min(remaining, due);

        paidRecords.push(fee);
        paymentBreakdown.push({ item: formatDate(fee.month_year), amount: paying });
        updatedRecords.push({ id: fee.id, originalPaid: Number(fee.paid_amount), originalStatus: fee.status });

        const { error: updateErr } = await supabase.from('fee_records').update({
          paid_amount:  Number(fee.paid_amount) + paying,
          status:       (Number(fee.paid_amount) + paying) >= Number(fee.total_amount) ? 'paid' : 'partial',
          paid_at:      payDate + 'T12:00:00Z',
          payment_mode: payMode,
        }).eq('id', fee.id);

        if (updateErr) throw updateErr;
        remaining -= paying;
      }

      const coveredMonths = paidRecords.map(r => formatDate(r.month_year)).join(', ');

      // Log one P&L transaction per invoice covered
      const txInserts = paidRecords.map((fee, idx) => {
        const paidAmt      = paymentBreakdown[idx]?.amount ?? 0;
        const rawBreakdown = (fee.breakdown as { item: string; amount: number }[]) || [];
        const grossTotal   = rawBreakdown.reduce((s, b) => s + Number(b.amount || 0), 0);
        const scaledItems  = grossTotal > 0 && rawBreakdown.length > 0
          ? rawBreakdown.map(b => ({ item: b.item, amount: Math.round((Number(b.amount) / grossTotal) * paidAmt) }))
          : [{ item: 'Fee Collection', amount: paidAmt }];

        return {
          school_id:    userRole!.school_id,
          type:         'income',
          category:     'Fee Collection',
          amount:       paidAmt,
          date:         payDate,
          payment_mode: payMode,
          remarks:      `${selectedStudent.full_name} — ${formatDate(fee.month_year)}${payRemarks ? ` (${payRemarks})` : ''}`,
          fee_record_id: fee.id,
          fee_items:    scaledItems,
        };
      });

      if (txInserts.length > 0) {
        const { error: txErr } = await supabase.from('financial_transactions').insert(txInserts);
        if (txErr) {
          for (const rec of updatedRecords) {
            await supabase.from('fee_records').update({ paid_amount: rec.originalPaid, status: rec.originalStatus }).eq('id', rec.id);
          }
          throw new Error(`Ledger entry failed (fee records rolled back): ${txErr.message}`);
        }
      }

      const payment = {
        student_name: selectedStudent.full_name,
        student_id:   selectedStudent.id,
        roll_number:  selectedStudent.roll_number,
        class_name:   `${selectedStudent.class?.name || ''}-${selectedStudent.class?.section || ''}`,
        father_name:  selectedStudent.father_name || '',
        amount,
        date:         payDate,
        mode:         payMode,
        invoice_number: paidRecords[0]?.invoice_number || '',
        months:       coveredMonths,
        breakdown:    paymentBreakdown,
      };
      setLastPayment(payment);
      setSuccessData(payment);
      setSelectedStudent(null);
      setPayAmount('');
      setPayRemarks('');
      setPayDate(new Date().toISOString().split('T')[0]);
      await fetchRecentActivity();
    } catch (error: any) {
      console.error('Payment Error:', error);
      alert(`Payment failed: ${error?.message || 'Please check your connection and try again.'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Print Receipt ─────────────────────────────────────────────────────────

  const handlePrintReceipt = (payment: any) => {
    if (!payment) return;
    const record: ChallanRecord = {
      id:             payment.student_id || 'receipt',
      invoice_number: payment.invoice_number || undefined,
      month_year:     new Date().toISOString().split('T')[0],
      total_amount:   payment.amount,
      paid_amount:    payment.amount,
      status:         'paid',
      breakdown:      payment.breakdown || [{ item: `Fee Payment (${payment.months || formatDate(new Date())})`, amount: payment.amount }],
      student_name:   payment.student_name,
      roll_number:    payment.roll_number,
      class_name:     payment.class_name,
      issue_date:     new Date().toISOString().split('T')[0],
    };
    const schoolInfo: SchoolInfo = {
      name:          school?.name || 'School',
      address:       school?.address || undefined,
      contact_phone: school?.contact_phone || undefined,
      logo_url:      school?.logo_url || undefined,
    };
    downloadChallanPDF([record], schoolInfo, { ...DEFAULT_CHALLAN_CONFIG, copies: 1 });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

      {/* ── Page Header ─────────────────────────────────────────────── */}
      <PageHeader
        title="Quick Fee Collection"
        subtitle="Walk-in fee payment counter for fast processing."
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
              <p className="text-xl font-black text-slate-900 tabular-nums">
                {recentTransactions.filter(t => t.date === todayStr).length}
              </p>
            </div>
          </div>
        }
      />

      {/* ── Help Banner ─────────────────────────────────────────────── */}
      <div className="shrink-0">
        <HelpBanner
          storageKey="help_quick_collection"
          title="How to use Quick Collection"
          color="emerald"
          steps={[
            'Type a student name or roll number in the search box.',
            'Select the student — their pending invoices load automatically.',
            'Choose quick-fill or enter a custom amount, then select payment mode.',
            'Click Collect — payment is recorded and receipt is ready to print.',
          ]}
          tip="For bulk invoice generation for a whole class, use Fee Management → Generate Invoices."
        />
      </div>

      {/* ── Main Grid ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* ═══════════════════════════════════════════════════════════
            LEFT SIDEBAR  (4 cols)
        ════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-4 flex flex-col gap-4">

          {/* Search */}
          <Card className="p-4 space-y-3">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Find Student</p>

            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Name or roll number..."
              icon={Search}
              autoFocus
            />

            <Select
              value={selectedClassId}
              onChange={e => setSelectedClassId(e.target.value)}
            >
              <option value="">All Classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.section ? ` — ${c.section}` : ''}</option>
              ))}
            </Select>

            {/* Results */}
            <AnimatePresence>
              {searchResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-1"
                >
                  {searchResults.map(s => (
                    <button
                      key={s.id}
                      onClick={() => handleSelect(s)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-transparent hover:border-indigo-100 hover:bg-indigo-50 transition-all group"
                    >
                      <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-sm font-black text-white shrink-0', avatarColor(s.full_name))}>
                        {s.full_name[0]}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-sm font-black text-slate-800 group-hover:text-indigo-700 truncate">{s.full_name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{s.class?.name} · #{s.roll_number}</p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-500 transition-colors shrink-0" />
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {query.length >= 2 && searchResults.length === 0 && !isSearching && (
              <div className="py-6 text-center">
                <Users className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No student found</p>
              </div>
            )}
          </Card>

          {/* Recent Collections */}
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
                  <button
                    key={t.id}
                    onClick={() => setSelectedRecentTx(t)}
                    className="w-full text-left p-2.5 rounded-xl bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/40 transition-all group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', avatarColor(t.student_name) + '/10')}>
                          <span className={cn('text-xs font-black', avatarColor(t.student_name).replace('bg-', 'text-'))}>
                            {t.student_name[0]}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-700 truncate group-hover:text-indigo-700 leading-tight">{t.student_name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <ModeIcon className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{modeDateLabel(t.date)}</p>
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

        {/* ═══════════════════════════════════════════════════════════
            MAIN PANEL  (8 cols)
        ════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-8 space-y-5 min-h-0 flex flex-col">
          <AnimatePresence mode="wait">

            {/* ── Student selected ─────────────────────────────── */}
            {selectedStudent ? (
              <motion.div
                key={selectedStudent.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-5"
              >
                {/* Student Header */}
                <Card className={cn(
                  'p-5 border-none shadow-lg',
                  totalOutstanding > 0
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-700 shadow-indigo-200/60'
                    : 'bg-gradient-to-r from-emerald-600 to-teal-700 shadow-emerald-200/60',
                )}>
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      'w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black text-white border-2 border-white/30 shrink-0',
                      'bg-white/20 backdrop-blur-md',
                    )}>
                      {selectedStudent.full_name[0]}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h2 className="text-lg font-black text-white tracking-tight truncate">{selectedStudent.full_name}</h2>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                            <span className="text-xs font-bold text-white/80 uppercase tracking-widest">{selectedStudent.class?.name}{selectedStudent.class?.section ? ` · ${selectedStudent.class.section}` : ''}</span>
                            <span className="text-xs font-bold text-white/60">Roll #{selectedStudent.roll_number}</span>
                            {selectedStudent.father_name && (
                              <span className="text-xs font-bold text-white/60">S/O {selectedStudent.father_name}</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => { setSelectedStudent(null); setFeeHistory([]); setPayAmount(''); }}
                          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/25 transition-colors shrink-0"
                        >
                          <XIcon className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    </div>

                    {/* Outstanding summary */}
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
                          <p className="text-[10px] font-bold text-white/60 mt-0.5">No dues</p>
                        </>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Invoice table + Payment form */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-5 items-start">

                  {/* ── Invoice Ledger (3 / 5 cols) ──────────────── */}
                  <Card className="md:col-span-3 p-0 overflow-hidden flex flex-col">
                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-slate-400" />
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Fee Ledger</p>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">{feeHistory.length} records</Badge>
                    </div>

                    {loadingDetails ? (
                      <div className="flex flex-col items-center justify-center py-16 opacity-30">
                        <Clock className="w-8 h-8 animate-spin mb-3" />
                        <p className="text-[10px] font-black uppercase tracking-widest">Loading...</p>
                      </div>
                    ) : feeHistory.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 opacity-30">
                        <Receipt className="w-8 h-8 mb-3" />
                        <p className="text-[10px] font-black uppercase tracking-widest">No fee records</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-slate-100">
                              <th className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Month</th>
                              <th className="px-3 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                              <th className="px-3 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Balance</th>
                              <th className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                              <th className="w-8" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {feeHistory.map(inv => {
                              const balance = Number(inv.total_amount) - Number(inv.paid_amount);
                              const isPaid  = inv.status === 'paid';
                              const isPartial = inv.status === 'partial';
                              return (
                                <tr
                                  key={inv.id}
                                  className={cn(
                                    'group transition-colors',
                                    isPaid    ? 'bg-white hover:bg-slate-50/50'
                                    : isPartial ? 'bg-amber-50/40 hover:bg-amber-50/70'
                                              : 'bg-red-50/30 hover:bg-red-50/60',
                                  )}
                                >
                                  <td className="px-4 py-2.5">
                                    <p className="text-xs font-black text-slate-800">{formatDate(inv.month_year)}</p>
                                    {inv.invoice_number && (
                                      <p className="text-[10px] font-bold text-slate-400">{inv.invoice_number}</p>
                                    )}
                                  </td>
                                  <td className="px-3 py-2.5 text-right text-xs font-bold text-slate-600 tabular-nums">
                                    Rs {Number(inv.total_amount).toLocaleString()}
                                  </td>
                                  <td className="px-3 py-2.5 text-right tabular-nums">
                                    {isPaid ? (
                                      <span className="flex items-center justify-end gap-1 text-emerald-600 text-xs font-black">
                                        <CheckCircle className="w-3.5 h-3.5" /> Paid
                                      </span>
                                    ) : (
                                      <span className={cn('text-xs font-black', isPartial ? 'text-amber-700' : 'text-red-700')}>
                                        Rs {balance.toLocaleString()}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-2.5 text-center">
                                    <Badge
                                      variant={isPaid ? 'success' : isPartial ? 'warning' : 'danger'}
                                      className="text-[9px] uppercase"
                                    >
                                      {inv.status}
                                    </Badge>
                                  </td>
                                  <td className="pr-2 py-2.5 text-center w-8">
                                    {!isPaid && (
                                      <button
                                        onClick={() => handleDelete(inv)}
                                        className="p-1 rounded text-slate-200 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                                        title="Soft-delete invoice"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          {/* Total footer */}
                          {totalOutstanding > 0 && (
                            <tfoot>
                              <tr className="border-t-2 border-slate-200 bg-slate-50">
                                <td colSpan={2} className="px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Outstanding</td>
                                <td className="px-3 py-2.5 text-right text-sm font-black text-red-700 tabular-nums">
                                  Rs {totalOutstanding.toLocaleString()}
                                </td>
                                <td colSpan={2} />
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                    )}
                  </Card>

                  {/* ── Payment Form (2 / 5 cols) ─────────────────── */}
                  <Card className="md:col-span-2 p-5 space-y-4">

                    {/* Outstanding callout */}
                    {totalOutstanding > 0 && (
                      <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-0.5">Outstanding</p>
                          <p className="text-xl font-black text-red-700 tabular-nums">Rs {totalOutstanding.toLocaleString()}</p>
                        </div>
                        <AlertCircle className="w-6 h-6 text-red-300 shrink-0" />
                      </div>
                    )}

                    <form onSubmit={processPayment} className="space-y-4">

                      {/* Quick-fill buttons */}
                      {totalOutstanding > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quick Fill</p>
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              type="button"
                              onClick={() => setPayAmount(String(totalOutstanding))}
                              className={cn(
                                'py-2 px-2 rounded-lg border text-[11px] font-black transition-all',
                                parseFloat(payAmount) === totalOutstanding
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : 'border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50',
                              )}
                            >
                              Full<br/>Balance
                            </button>
                            {thisMonthBalance > 0 && thisMonthBalance !== totalOutstanding && (
                              <button
                                type="button"
                                onClick={() => setPayAmount(String(thisMonthBalance))}
                                className={cn(
                                  'py-2 px-2 rounded-lg border text-[11px] font-black transition-all',
                                  parseFloat(payAmount) === thisMonthBalance
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50',
                                )}
                              >
                                This<br/>Month
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setPayAmount('')}
                              className={cn(
                                'py-2 px-2 rounded-lg border text-[11px] font-black transition-all',
                                payAmount && parseFloat(payAmount) !== totalOutstanding && parseFloat(payAmount) !== thisMonthBalance
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : 'border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50',
                              )}
                            >
                              Custom
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Amount input */}
                      <Input
                        label="Amount to Collect"
                        type="number"
                        value={payAmount}
                        onChange={e => setPayAmount(e.target.value)}
                        placeholder="Enter amount..."
                        icon={DollarSign}
                        className="!text-lg !font-black"
                        required
                      />

                      {/* Allocation preview */}
                      <AnimatePresence>
                        {allocationPreview.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3 space-y-1.5">
                              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Will Cover</p>
                              {allocationPreview.map((p, i) => (
                                <div key={i} className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <div className={cn('w-2 h-2 rounded-full shrink-0', p.full ? 'bg-emerald-500' : 'bg-amber-400')} />
                                    <span className="text-xs font-bold text-indigo-800">{p.month}</span>
                                    {!p.full && <span className="text-[10px] text-indigo-400 font-bold">(partial)</span>}
                                  </div>
                                  <span className="text-xs font-black text-indigo-700 tabular-nums">Rs {p.paying.toLocaleString()}</span>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Payment mode — pill toggle */}
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment Mode</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {PAYMENT_MODES.map(m => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => setPayMode(m.id)}
                              className={cn(
                                'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-black transition-all',
                                payMode === m.id
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-200'
                                  : 'border-slate-200 text-slate-600 hover:border-indigo-200 hover:bg-indigo-50',
                              )}
                            >
                              <m.icon className="w-3.5 h-3.5 shrink-0" />
                              {m.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Date + Remarks */}
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          label="Date"
                          type="date"
                          value={payDate}
                          onChange={e => setPayDate(e.target.value)}
                        />
                        <Input
                          label="Remarks"
                          value={payRemarks}
                          onChange={e => setPayRemarks(e.target.value)}
                          placeholder="Optional"
                        />
                      </div>

                      {/* Submit */}
                      <button
                        type="submit"
                        disabled={!payAmount || Number(payAmount) <= 0 || isProcessing}
                        className={cn(
                          'w-full flex items-center justify-center gap-2.5 py-4 rounded-xl font-black text-sm tracking-wide transition-all',
                          'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200',
                          'disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none',
                          'active:scale-[0.98]',
                        )}
                      >
                        {isProcessing ? (
                          <>
                            <Clock className="w-4 h-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4" />
                            Collect {payAmount ? `Rs. ${Number(payAmount).toLocaleString()}` : ''} & Print Receipt
                          </>
                        )}
                      </button>

                      <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest">
                        Oldest invoices are paid first
                      </p>
                    </form>
                  </Card>
                </div>
              </motion.div>

            ) : (
              /* ── Empty / Success state ──────────────────────────── */
              <motion.div
                key="idle"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex-1"
              >
                {successData ? (
                  /* ── Success receipt card ──────────────────── */
                  <Card className="py-12 flex flex-col items-center border-dashed bg-slate-50/50">
                    <motion.div
                      initial={{ scale: 0, rotate: -10 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-100"
                    >
                      <CheckCircle className="w-10 h-10 text-emerald-600" />
                    </motion.div>

                    <h2 className="text-2xl font-black text-slate-800 mb-1">Payment Collected</h2>
                    <p className="text-3xl font-black text-emerald-600 tabular-nums mb-6">
                      Rs. {successData.amount.toLocaleString()}
                    </p>

                    {/* Receipt summary */}
                    <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 mb-6 text-left overflow-hidden shadow-sm">
                      <div className="flex justify-between items-center px-5 py-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Student</span>
                        <span className="text-sm font-black text-slate-800">{successData.student_name}</span>
                      </div>
                      <div className="flex justify-between items-center px-5 py-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Class</span>
                        <span className="text-sm font-bold text-slate-700">{successData.class_name}</span>
                      </div>
                      <div className="flex justify-between items-center px-5 py-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Covered Months</span>
                        <span className="text-sm font-bold text-slate-700 text-right max-w-[200px]">{successData.months}</span>
                      </div>
                      <div className="flex justify-between items-center px-5 py-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mode</span>
                        <span className="text-sm font-bold text-slate-700">{successData.mode}</span>
                      </div>
                      <div className="flex justify-between items-center px-5 py-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</span>
                        <span className="text-sm font-bold text-slate-700">{formatDate(successData.date)}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 w-full max-w-sm">
                      <Btn
                        variant="primary"
                        onClick={() => handlePrintReceipt(lastPayment)}
                        className="w-full !py-3.5"
                        icon={Printer}
                      >
                        Print Receipt
                      </Btn>
                      <Btn
                        variant="secondary"
                        onClick={() => navigate(`/fees/student-detail?student=${successData.student_id}`)}
                        className="w-full"
                        icon={ExternalLink}
                      >
                        View Full Ledger
                      </Btn>
                      <button
                        onClick={() => setSuccessData(null)}
                        className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black text-indigo-600 hover:bg-indigo-50 transition-colors"
                      >
                        <Zap className="w-4 h-4" />
                        New Collection
                      </button>
                    </div>
                  </Card>
                ) : (
                  /* ── Idle prompt ────────────────────────────── */
                  <Card className="h-full min-h-80 flex flex-col items-center justify-center py-20 border-dashed bg-slate-50/50">
                    <div className="w-20 h-20 rounded-3xl bg-white shadow-xl flex items-center justify-center mb-6">
                      <Zap className="w-10 h-10 text-indigo-200" />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 mb-2">Ready to Collect?</h3>
                    <p className="text-sm text-slate-400 max-w-xs text-center font-medium">
                      Search for a student on the left to begin fast fee processing.
                    </p>
                  </Card>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Transaction Detail Modal ─────────────────────────────────── */}
      <AnimatePresence>
        {selectedRecentTx && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-sm overflow-hidden"
            >
              <div className="px-6 py-4 flex items-center justify-between border-b border-gray-50 bg-gray-50/50">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Transaction Details</h3>
                </div>
                <button
                  onClick={() => setSelectedRecentTx(null)}
                  className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 transition-colors"
                >
                  <XIcon className="w-4 h-4" />
                </button>
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
                  <div className="flex justify-between items-center px-4 py-3">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</span>
                    <span className="text-sm font-bold text-gray-800">{formatDate(selectedRecentTx.date)}</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-3">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Method</span>
                    <span className="text-sm font-bold text-gray-800">{selectedRecentTx.mode}</span>
                  </div>
                  <div className="flex flex-col gap-1 px-4 py-3">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Remarks</span>
                    <p className="text-xs text-gray-600 leading-relaxed italic bg-gray-50 rounded-lg p-2.5 border border-gray-100">{selectedRecentTx.remarks}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  <button
                    onClick={() => {
                      handlePrintReceipt({
                        student_name:   selectedRecentTx.student_name,
                        amount:         selectedRecentTx.amount,
                        months:         selectedRecentTx.remarks.match(/\[(.*?)\]/)?.[1] || 'Balance Payment',
                        student_id:     '',
                        roll_number:    '',
                        class_name:     '',
                        date:           selectedRecentTx.date,
                        mode:           selectedRecentTx.mode,
                        invoice_number: '',
                        breakdown:      [{ item: 'Fee Payment', amount: selectedRecentTx.amount }],
                      });
                    }}
                    className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all"
                  >
                    <Printer className="w-4 h-4" /> Reprint Receipt
                  </button>
                  <p className="text-[10px] text-center text-gray-400 font-medium">Ref: {selectedRecentTx.id}</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
