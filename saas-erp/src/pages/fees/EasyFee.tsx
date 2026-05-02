import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Zap, Search, CheckCircle, Wallet,
  ArrowRight, Printer, History, Users,
  Receipt, Landmark, Clock, X as XIcon, Trash2, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { downloadChallanPDF, DEFAULT_CHALLAN_CONFIG, type ChallanRecord, type SchoolInfo } from '../../lib/challanUtils';
import HelpBanner from '../../components/HelpBanner';
import { formatDate } from '../../lib/utils';
import { PageHeader, Card, Btn, Badge, Select, Input } from '../../components/ui';

// ── Types ────────────────────────────────────────────────────────────────────

interface Student {
  id: string;
  full_name: string;
  roll_number: number;
  class_name: string;
  monthly_fee: number;
}

interface FeeRecord {
  id: string;
  invoice_number?: string;
  month_year: string;
  total_amount: number;
  paid_amount: number;
  status: string;
}

interface RecentTransaction {
  id: string;
  student_name: string;
  amount: number;
  date: string;
  mode: string;
  remarks: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function EasyFee() {
  const { userRole } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // States
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [selectedRecentTx, setSelectedRecentTx] = useState<RecentTransaction | null>(null);

  // Selection
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [feeHistory, setFeeHistory] = useState<FeeRecord[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Payment Form
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('Cash');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payRemarks, setPayRemarks] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [lastPayment, setLastPayment] = useState<any>(null);

  // Filters
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [school, setSchool] = useState<any>(null);

  // ── Fetch Metadata ─────────────────────────────────────────────────────────

  const fetchMetadata = useCallback(async () => {
    if (!userRole?.school_id) return;

    // Fetch School Info
    const { data: sch } = await supabase.from('schools').select('*').eq('id', userRole.school_id).maybeSingle();
    if (sch) setSchool(sch);

    // Fetch Classes
    const { data: cls } = await supabase.from('classes').select('id, name, section').eq('school_id', userRole.school_id).order('name');
    if (cls) setClasses(cls);
  }, [userRole?.school_id]);

  useEffect(() => { fetchMetadata(); }, [fetchMetadata]);

  // ── Fetch Recent Activity ──────────────────────────────────────────────────

  const fetchRecentActivity = useCallback(async () => {
    if (!userRole?.school_id) return;
    const { data } = await supabase
      .from('financial_transactions')
      .select('id, remarks, amount, date, payment_mode')
      .eq('school_id', userRole.school_id)
      .eq('category', 'Fee Collection')
      .order('created_at', { ascending: false })
      .limit(8);

    if (data) {
      setRecentTransactions(data.map(t => ({
        id: t.id,
        student_name: t.remarks?.split('[')[0]?.replace('Fee — ', '')?.trim() || 'Student',
        amount: t.amount,
        date: t.date,
        mode: t.payment_mode,
        remarks: t.remarks || ''
      })));
    }
  }, [userRole?.school_id]);

  useEffect(() => { fetchRecentActivity(); }, [fetchRecentActivity]);

  // ── Live Search ────────────────────────────────────────────────────────────

  useEffect(() => {
    const search = async () => {
      if (!query.trim() || query.length < 2) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      let queryBuilder = supabase
        .from('students')
        .select('id, full_name, roll_number, class:class_id(name, section)')
        .eq('school_id', userRole!.school_id)
        .eq('status', 'active');

      if (selectedClassId) {
        queryBuilder = queryBuilder.eq('class_id', selectedClassId);
      }

      if (query.trim()) {
        queryBuilder = queryBuilder.or(`full_name.ilike.%${query}%,roll_number.eq.${parseInt(query) || 0}`);
      }

      const { data: results } = await queryBuilder.limit(6);

      setSearchResults(results || []);
      setIsSearching(false);
    };

    const timer = setTimeout(search, 300);
    return () => clearTimeout(timer);
  }, [query, userRole?.school_id]);

  // ── Auto-select student from URL param (?student=id) ───────────────────────

  useEffect(() => {
    const studentIdParam = searchParams.get('student');
    if (!studentIdParam || !userRole?.school_id) return;
    supabase
      .from('students')
      .select('id, full_name, roll_number, class:class_id(name, section), fee_waiver_percentage')
      .eq('id', studentIdParam)
      .eq('school_id', userRole.school_id)
      .maybeSingle()
      .then(({ data }) => { if (data) handleSelect(data); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, userRole?.school_id]);

  // ── Select Student & Load Ledger ───────────────────────────────────────────

  const handleSelect = async (student: any) => {
    setSelectedStudent(student);
    setLoadingDetails(true);
    setSuccessMsg(null);
    setSearchResults([]);
    setQuery('');

    // Fetch pending and recent fees (include breakdown for transaction logging)
    const { data: fees } = await supabase
      .from('fee_records')
      .select('id, invoice_number, month_year, total_amount, paid_amount, status, breakdown')
      .eq('student_id', student.id)
      .is('deleted_at', null)
      .order('month_year', { ascending: false })
      .limit(12);

    setFeeHistory(fees || []);

    // Auto-calculate suggested amount (total pending)
    const unpaid = (fees || [])
      .filter(f => f.status !== 'paid')
      .reduce((sum, f) => sum + (Number(f.total_amount) - Number(f.paid_amount)), 0);

    setPayAmount(unpaid > 0 ? String(unpaid) : '');
    setLoadingDetails(false);
  };

  const handleDelete = async (inv: any) => {
    if (inv.status === 'paid') {
      alert('Paid invoices cannot be deleted — they have payment records in the ledger.');
      return;
    }
    const hasPartialPayment = Number(inv.paid_amount) > 0;
    const msg = hasPartialPayment
      ? `Invoice has a partial payment of Rs. ${Number(inv.paid_amount).toLocaleString()}. Soft-delete it (recoverable from Trash Bin)?`
      : 'Soft-delete this invoice? It can be recovered from Settings → Trash Bin.';
    if (!confirm(msg)) return;
    try {
      const { error } = await supabase.from('fee_records')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', inv.id);
      if (error) throw error;
      if (selectedStudent) handleSelect(selectedStudent);
    } catch (err: any) { alert(err.message); }
  };

  // ── Process Payment ────────────────────────────────────────────────────────

  const processPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !payAmount || isProcessing) return;

    const amount = parseFloat(payAmount);

    // Guard: do not allow collection beyond total outstanding (would inflate income ledger)
    const totalOutstanding = feeHistory
      .filter(f => f.status !== 'paid')
      .reduce((sum, f) => sum + (Number(f.total_amount) - Number(f.paid_amount)), 0);

    if (amount > totalOutstanding + 0.01 && totalOutstanding > 0) {
      alert(`Amount exceeds total outstanding (Rs. ${totalOutstanding.toLocaleString()}). Please enter a valid amount.`);
      return;
    }

    setIsProcessing(true);
    let remaining = amount;

    // Track which fee_records we updated so we can roll back if ledger insert fails
    const updatedRecords: { id: string; originalPaid: number; originalStatus: string }[] = [];

    try {
      // 1. Distribute across pending months (Oldest First)
      const pendingOldest = [...feeHistory]
        .filter(f => f.status !== 'paid')
        .sort((a, b) => a.month_year.localeCompare(b.month_year));

      const paidRecords: FeeRecord[] = [];
      const paymentBreakdown: { item: string; amount: number }[] = [];

      for (const fee of pendingOldest) {
        if (remaining <= 0) break;
        const due = Number(fee.total_amount) - Number(fee.paid_amount);
        const paying = Math.min(remaining, due);

        paidRecords.push(fee);
        paymentBreakdown.push({
          item: formatDate(fee.month_year),
          amount: paying,
        });

        // Remember original values for rollback
        updatedRecords.push({ id: fee.id, originalPaid: Number(fee.paid_amount), originalStatus: fee.status });

        const { error: updateErr } = await supabase.from('fee_records').update({
          paid_amount: Number(fee.paid_amount) + paying,
          status: (Number(fee.paid_amount) + paying) >= Number(fee.total_amount) ? 'paid' : 'partial',
          paid_at: payDate + 'T12:00:00Z',
          payment_mode: payMode
        }).eq('id', fee.id);

        if (updateErr) throw updateErr;
        remaining -= paying;
      }

      const coveredMonths = paidRecords
        .map(r => formatDate(r.month_year))
        .join(', ');

      // 2. Log one P&L transaction per invoice covered (fee_record_id links to invoice for reporting)
      const txInserts = paidRecords.map((fee, idx) => {
        const paidAmt = paymentBreakdown[idx]?.amount ?? 0;
        const rawBreakdown: { item: string; amount: number }[] = (fee as any).breakdown || [];
        const grossTotal = rawBreakdown.reduce((s, b) => s + Number(b.amount || 0), 0);

        // Scale breakdown items proportionally to the actual net amount paid.
        // This ensures P&L fee-type breakdown (e.g. "Tuition Fee: Rs. X") always
        // sums to the real collected amount, even when discounts or partial payments apply.
        const scaledItems = grossTotal > 0 && rawBreakdown.length > 0
          ? rawBreakdown.map(b => ({
              item: b.item,
              amount: Math.round((Number(b.amount) / grossTotal) * paidAmt),
            }))
          : [{ item: 'Fee Collection', amount: paidAmt }];

        return {
          school_id: userRole!.school_id,
          type: 'income',
          category: 'Fee Collection',
          amount: paidAmt,
          date: payDate,
          payment_mode: payMode,
          remarks: `${selectedStudent.full_name} — ${formatDate(fee.month_year)}${payRemarks ? ` (${payRemarks})` : ''}`,
          fee_record_id: fee.id,
          fee_items: scaledItems,  // proportional net amounts — sum equals paidAmt
        };
      });

      if (txInserts.length > 0) {
        const { error: txErr } = await supabase.from('financial_transactions').insert(txInserts);
        if (txErr) {
          // Ledger insert failed — roll back fee_records to their original state
          for (const rec of updatedRecords) {
            await supabase.from('fee_records').update({
              paid_amount: rec.originalPaid,
              status: rec.originalStatus,
            }).eq('id', rec.id);
          }
          throw new Error(`Ledger entry failed (fee records rolled back): ${txErr.message}`);
        }
      }

      if (amount > 0) {
        setLastPayment({
          student_name: selectedStudent.full_name,
          student_id: selectedStudent.id,
          roll_number: selectedStudent.roll_number,
          class_name: `${selectedStudent.class?.name || ''}-${selectedStudent.class?.section || ''}`,
          amount,
          date: formatDate(payDate),
          mode: payMode,
          invoice_number: paidRecords[0]?.invoice_number || '',
          months: coveredMonths,
          breakdown: paymentBreakdown,
        });
      }

      setSuccessMsg(`Rs. ${amount.toLocaleString()} collected for ${selectedStudent.full_name}`);
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

  // ── Print Receipt via challanUtils ────────────────────────────────────────

  const handlePrintReceipt = (payment: any) => {
    if (!payment) return;
    const record: ChallanRecord = {
      id: payment.student_id || 'receipt',
      invoice_number: payment.invoice_number || undefined,
      month_year: new Date().toISOString().split('T')[0],
      total_amount: payment.amount,
      paid_amount: payment.amount,
      status: 'paid',
      breakdown: payment.breakdown || [{ item: `Fee Payment (${payment.months || formatDate(new Date())})`, amount: payment.amount }],
      student_name: payment.student_name,
      roll_number: payment.roll_number,
      class_name: payment.class_name,
      issue_date: new Date().toISOString().split('T')[0],
    };
    const schoolInfo: SchoolInfo = {
      name: school?.name || 'School',
      address: school?.address || undefined,
      contact_phone: school?.contact_phone || undefined,
      logo_url: school?.logo_url || undefined,
    };
    downloadChallanPDF([record], schoolInfo, { ...DEFAULT_CHALLAN_CONFIG, copies: 1 });
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const totalToday = recentTransactions
    .filter(t => t.date === todayStr || (t as any).created_at?.slice(0, 10) === todayStr)
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <PageHeader
        title="Quick Fee Collection"
        subtitle="Walk-in fee payment counter for fast processing."
        icon={Zap}
        actions={
          <div className="flex items-center gap-8 bg-white/50 backdrop-blur-sm rounded-2xl px-6 py-2 border border-slate-100 shadow-sm">
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Today's Total</p>
              <p className="text-lg font-black text-indigo-600 tabular-nums">Rs. {totalToday.toLocaleString()}</p>
            </div>
            <div className="h-10 w-px bg-slate-200" />
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Transactions</p>
              <p className="text-lg font-black text-slate-900 tabular-nums">{recentTransactions.length}</p>
            </div>
          </div>
        }
      />

      <div className="shrink-0">
        <HelpBanner
          storageKey="help_quick_collection"
          title="How to use Quick Collection"
          color="emerald"
          steps={[
            'Type a student name, roll number, or ID in the search box on the left.',
            'Select the student — their pending invoices appear automatically.',
            'Enter the amount to collect and choose a payment method.',
            'Click Collect — the payment is recorded and a challan receipt is printed.',
          ]}
          tip='For bulk invoice generation for a whole class, use Fee Management → Generate Invoices instead.'
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* ── Left Sidebar ─────────────────────────────────────────── */}
        <div className="lg:col-span-3 flex flex-col gap-6">

          {/* Search Card */}
          <Card className="p-4 flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Name or roll #..."
                icon={Search}
                className="!py-2"
                autoFocus
              />
              <Select
                value={selectedClassId}
                onChange={e => setSelectedClassId(e.target.value)}
                className="!py-2"
              >
                <option value="">All Classes</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>

            <div className="space-y-1">
              {searchResults.map(s => (
                <button
                  key={s.id}
                  onClick={() => handleSelect(s)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-transparent hover:border-indigo-100 hover:bg-indigo-50 transition-all group"
                >
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
                    {s.full_name[0]}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-black text-slate-800 group-hover:text-indigo-700 truncate">{s.full_name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{s.class?.name} · #{s.roll_number}</p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-400 -translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all" />
                </button>
              ))}
              {query && searchResults.length === 0 && !isSearching && (
                <div className="py-8 text-center">
                  <Users className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No student found</p>
                </div>
              )}
            </div>
          </Card>

          {/* Recent Collections */}
          <Card className="p-4 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Recent Activity</p>
              <History className="w-4 h-4 text-slate-300" />
            </div>
            <div className="space-y-2">
              {recentTransactions.map(t => (
                <button 
                  key={t.id} 
                  onClick={() => setSelectedRecentTx(t)}
                  className="w-full text-left p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all group"
                >
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-xs font-black text-slate-700 truncate max-w-[120px] group-hover:text-indigo-700">{t.student_name}</p>
                    <p className="text-xs font-black text-indigo-600">Rs {t.amount.toLocaleString()}</p>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.mode}</p>
                    <ArrowRight className="w-2.5 h-2.5 text-slate-300 group-hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-all" />
                  </div>
                </button>
              ))}
              {recentTransactions.length === 0 && (
                <div className="py-6 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">No activity</div>
              )}
            </div>
          </Card>
        </div>

        {/* ── Main Panel ───────────────────────────────────────────── */}
        <div className="lg:col-span-9 space-y-6 min-h-0 flex flex-col">
          <AnimatePresence mode="wait">
            {selectedStudent ? (
              <motion.div
                key={selectedStudent.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Student Header */}
                <Card className="p-4 bg-gradient-to-r from-indigo-600 to-violet-700 text-white border-none shadow-indigo-200/50">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl font-black border border-white/30 shrink-0">
                      {selectedStudent.full_name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h2 className="text-xl font-black tracking-tight truncate">{selectedStudent.full_name}</h2>
                        <button
                          onClick={() => setSelectedStudent(null)}
                          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                        >
                          <XIcon className="w-4 h-4 text-white" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 opacity-90">
                        <p className="text-xs font-bold uppercase tracking-widest">{selectedStudent.class?.name} · Roll #{selectedStudent.roll_number}</p>
                        <p className="text-xs font-bold uppercase tracking-widest">Father: {selectedStudent.father_name}</p>
                      </div>
                    </div>
                    <div className="hidden md:block text-right">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-0.5">Total Pending</p>
                      <p className="text-2xl font-black tabular-nums">Rs {feeHistory.filter(f => f.status !== 'paid').reduce((s, i) => s + (Number(i.total_amount) - Number(i.paid_amount)), 0).toLocaleString()}</p>
                    </div>
                  </div>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  {/* Pending Invoices */}
                  <Card className="p-0 flex flex-col overflow-hidden h-[500px]">
                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-2">
                        <History className="w-4 h-4 text-slate-400" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fee Ledger</p>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">{feeHistory.length} Records</Badge>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                      {loadingDetails ? (
                        <div className="flex flex-col items-center justify-center h-full opacity-30">
                          <Clock className="w-10 h-10 animate-spin mb-4" />
                          <p className="text-[10px] font-black uppercase tracking-widest">Syncing ledger...</p>
                        </div>
                      ) : feeHistory.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full opacity-30">
                          <Receipt className="w-10 h-10 mb-4" />
                          <p className="text-[10px] font-black uppercase tracking-widest">No fee history</p>
                        </div>
                      ) : (
                        feeHistory.map(invoice => {
                          const balance = Number(invoice.total_amount) - Number(invoice.paid_amount);
                          const isPaid = invoice.status === 'paid';
                          return (
                            <div key={invoice.id} className="p-3 rounded-xl border border-slate-100 bg-white shadow-sm group hover:border-indigo-100 transition-all">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <p className="text-xs font-black text-slate-800">{formatDate(invoice.month_year)}</p>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{invoice.invoice_number || 'INV-REF'}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {!isPaid && (
                                    <button
                                      onClick={() => handleDelete(invoice)}
                                      className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <Badge variant={isPaid ? 'success' : (Number(invoice.paid_amount) > 0 ? 'warning' : 'danger')} className="text-[9px]">
                                    {invoice.status.toUpperCase()}
                                  </Badge>
                                </div>
                              </div>
                              <div className="flex justify-between items-end">
                                <div className="text-[10px] font-medium text-slate-500">
                                  Total: Rs {Number(invoice.total_amount).toLocaleString()}
                                </div>
                                <div className={cn("text-sm font-black", isPaid ? "text-emerald-600" : "text-slate-900")}>
                                  {isPaid ? <div className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Paid</div> : `Rs ${balance.toLocaleString()}`}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </Card>

                  {/* Payment Form */}
                  <Card className="p-6">
                    <div className="flex items-center gap-2 mb-6">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Collect Payment</p>
                    </div>

                    <form onSubmit={processPayment} className="space-y-6">
                      <Input
                        label="Amount to Collect"
                        type="number"
                        value={payAmount}
                        onChange={e => setPayAmount(e.target.value)}
                        placeholder="Enter amount..."
                        icon={DollarSign}
                        className="!text-lg font-black"
                        required
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <Select
                          label="Payment Mode"
                          value={payMode}
                          onChange={e => setPayMode(e.target.value)}
                        >
                          <option value="Cash">Cash</option>
                          <option value="Bank Transfer">Bank Transfer</option>
                          <option value="Cheque">Cheque</option>
                          <option value="Online">Online</option>
                        </Select>
                        <Input
                          label="Payment Date"
                          type="date"
                          value={payDate}
                          onChange={e => setPayDate(e.target.value)}
                        />
                      </div>

                      <Input
                        label="Reference / Remarks"
                        value={payRemarks}
                        onChange={e => setPayRemarks(e.target.value)}
                        placeholder="Optional"
                      />

                      <div className="pt-4">
                        <Btn
                          type="submit"
                          variant="primary"
                          className="w-full !py-4 text-base shadow-xl shadow-indigo-200"
                          icon={Zap}
                          loading={isProcessing}
                          disabled={!payAmount || Number(payAmount) <= 0}
                        >
                          Collect & Print Receipt
                        </Btn>
                        <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest mt-4">
                          Payments are applied to oldest invoices first
                        </p>
                      </div>
                    </form>
                  </Card>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex-1"
              >
                {successMsg ? (
                  <Card className="h-full flex flex-col items-center justify-center py-20 bg-slate-50/50 border-dashed">
                    <div className="max-w-sm w-full text-center">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-100"
                      >
                        <CheckCircle className="w-10 h-10 text-emerald-600" />
                      </motion.div>
                      <h2 className="text-2xl font-black text-slate-800 mb-2">Payment Collected</h2>
                      <p className="text-sm font-medium text-slate-400 mb-8">{successMsg}</p>

                      <div className="flex flex-col gap-3">
                        <Btn
                          variant="primary"
                          onClick={() => handlePrintReceipt(lastPayment)}
                          className="w-full !py-4"
                          icon={Printer}
                        >
                          Print Receipt
                        </Btn>
                        <Btn
                          variant="secondary"
                          onClick={() => navigate(`/fees/student-detail?student=${lastPayment?.student_id}`)}
                          className="w-full"
                          icon={ExternalLink}
                        >
                          View Full Ledger
                        </Btn>
                        <button
                          onClick={() => setSuccessMsg(null)}
                          className="mt-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors"
                        >
                          Back to Counter
                        </button>
                      </div>
                    </div>
                  </Card>
                ) : (
                  <Card className="h-full flex flex-col items-center justify-center py-20 border-dashed bg-slate-50/50">
                    <div className="w-20 h-20 rounded-3xl bg-white shadow-xl flex items-center justify-center mb-6">
                      <Zap className="w-10 h-10 text-indigo-200" />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 mb-2">Ready to Collect?</h3>
                    <p className="text-sm text-slate-400 max-w-xs text-center font-medium">
                      Search for a student using the sidebar to begin fast fee processing.
                    </p>
                  </Card>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Transaction Detail Modal ────────────────────────────────────── */}
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

              <div className="p-6 space-y-6">
                <div className="flex flex-col items-center text-center">
                  <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 text-xl font-bold mb-3">
                    {selectedRecentTx.student_name[0]}
                  </div>
                  <h4 className="text-lg font-bold text-gray-900">{selectedRecentTx.student_name}</h4>
                  <p className="text-2xl font-black text-indigo-600 mt-1">Rs. {selectedRecentTx.amount.toLocaleString()}</p>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-50">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</span>
                    <span className="text-sm font-bold text-gray-800">{formatDate(selectedRecentTx.date)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-50">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Method</span>
                    <span className="text-sm font-bold text-gray-800">{selectedRecentTx.mode}</span>
                  </div>
                  <div className="flex flex-col gap-1 py-2">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Remarks / Coverage</span>
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 mt-1">
                      <p className="text-xs text-gray-600 leading-relaxed italic">{selectedRecentTx.remarks}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    onClick={() => {
                        handlePrintReceipt({
                            student_name: selectedRecentTx.student_name,
                            amount: selectedRecentTx.amount,
                            months: selectedRecentTx.remarks.match(/\[(.*?)\]/)?.[1] || 'Balance Payment'
                        });
                    }}
                    className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all"
                  >
                    <Printer className="w-4 h-4" /> Reprint Official Receipt
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
