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

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return;
    try {
      const { error } = await supabase.from('fee_records').update({ deleted_at: new Date().toISOString() }).eq('id', id);
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
          item: new Date(fee.month_year).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          amount: paying,
        });

        await supabase.from('fee_records').update({
          paid_amount: Number(fee.paid_amount) + paying,
          status: (Number(fee.paid_amount) + paying) >= Number(fee.total_amount) ? 'paid' : 'partial',
          paid_at: payDate + 'T12:00:00Z', // Use the selected date
          payment_mode: payMode
        }).eq('id', fee.id);

        remaining -= paying;
      }

      const coveredMonths = paidRecords
        .map(r => new Date(r.month_year).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }))
        .join(', ');

      // 2. Log one transaction per invoice covered (with fee_record_id for reliable reporting)
      const txInserts = paidRecords.map((fee, idx) => ({
        school_id: userRole!.school_id,
        type: 'income',
        category: 'Fee Collection',
        amount: paymentBreakdown[idx]?.amount ?? 0,
        date: payDate,
        payment_mode: payMode,
        remarks: `${selectedStudent.full_name} — ${new Date(fee.month_year).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}${payRemarks ? ` (${payRemarks})` : ''}`,
        fee_record_id: fee.id,
        fee_items: (fee as any).breakdown || [],
      }));
      if (txInserts.length > 0) {
        await supabase.from('financial_transactions').insert(txInserts);
      }

      if (amount > 0) {
        setLastPayment({
          student_name: selectedStudent.full_name,
          student_id: selectedStudent.id,
          roll_number: selectedStudent.roll_number,
          class_name: `${selectedStudent.class?.name || ''}-${selectedStudent.class?.section || ''}`,
          amount,
          date: new Date(payDate).toLocaleDateString(),
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
      setPayDate(new Date().toISOString().split('T')[0]); // Reset to today
      await fetchRecentActivity();
    } catch (error) {
      console.error('Payment Error:', error);
      alert('Failed to process payment. Please check your connection.');
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
      breakdown: payment.breakdown || [{ item: `Fee Payment (${payment.months || new Date().toLocaleDateString()})`, amount: payment.amount }],
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
    <div className="h-[calc(100vh-80px)] flex flex-col gap-3">

      {/* Onboarding Help — shrinks when visible, disappears when dismissed */}
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

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-6 py-3 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-100">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900">Quick Collection</h1>
            <p className="text-xs text-gray-400">Walk-in fee payment counter</p>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className="text-right">
            <p className="text-xs text-gray-400 mb-0.5">Today's Total</p>
            <p className="text-sm font-bold text-indigo-600">Rs. {totalToday.toLocaleString()}</p>
          </div>
          <div className="h-8 w-px bg-gray-100" />
          <div className="text-right">
            <p className="text-xs text-gray-400 mb-0.5">Transactions</p>
            <p className="text-sm font-bold text-gray-900">{recentTransactions.length}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex gap-4">

        {/* ── Left Sidebar ─────────────────────────────────────────── */}
        <div className="w-72 flex flex-col gap-4 shrink-0">

          {/* Search Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Student name or roll #..."
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  autoFocus
                />
                {isSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Clock className="w-4 h-4 text-indigo-400 animate-spin" />
                  </div>
                )}
              </div>
              <select
                value={selectedClassId}
                onChange={e => setSelectedClassId(e.target.value)}
                className="w-20 text-xs border border-gray-200 rounded-lg bg-white text-gray-600 px-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="">All</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              {searchResults.map(s => (
                <button
                  key={s.id}
                  onClick={() => handleSelect(s)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-transparent hover:border-indigo-100 hover:bg-indigo-50 transition-all group"
                >
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
                    {s.full_name[0]}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-semibold text-gray-800 group-hover:text-indigo-700 truncate">{s.full_name}</p>
                    <p className="text-xs text-gray-400">{s.class?.name}-{s.class?.section} · #{s.roll_number}</p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-indigo-400 -translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all" />
                </button>
              ))}
              {query && searchResults.length === 0 && !isSearching && (
                <div className="py-8 text-center">
                  <Users className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-xs text-gray-400">No student found</p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Collections */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Recent Collections</p>
              <History className="w-3.5 h-3.5 text-gray-300" />
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {recentTransactions.map(t => (
                <button 
                  key={t.id} 
                  onClick={() => setSelectedRecentTx(t)}
                  className="w-full text-left p-2.5 rounded-lg bg-gray-50 border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all group"
                >
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-xs font-semibold text-gray-700 truncate max-w-[120px] group-hover:text-indigo-700">{t.student_name}</p>
                    <p className="text-xs font-bold text-indigo-600">Rs {t.amount.toLocaleString()}</p>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] text-gray-400">{t.mode}</p>
                    <div className="flex items-center gap-1.5">
                      <p className="text-[10px] text-gray-400">{new Date(t.date).toLocaleDateString()}</p>
                      <ArrowRight className="w-2.5 h-2.5 text-gray-300 group-hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-all" />
                    </div>
                  </div>
                </button>
              ))}
              {recentTransactions.length === 0 && (
                <div className="py-6 text-center text-xs text-gray-400">No recent activity</div>
              )}
            </div>
          </div>
        </div>

        {/* ── Main Panel ───────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          <AnimatePresence mode="wait">
            {selectedStudent ? (
              <motion.div
                key={selectedStudent.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full flex flex-col gap-4"
              >
                {/* Student Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl px-6 py-4 flex items-center gap-4 text-white shadow-md shadow-indigo-100">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white text-xl font-bold shrink-0">
                    {selectedStudent.full_name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-bold text-white leading-tight">{selectedStudent.full_name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">Roll #{selectedStudent.roll_number}</span>
                      <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">{selectedStudent.class?.name}-{selectedStudent.class?.section}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedStudent(null)}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    <XIcon className="w-4 h-4 text-white" />
                  </button>
                </div>

                <div className="flex-1 flex gap-4 min-h-0">
                  {/* Pending Dues Table */}
                  <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col min-h-0">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 shrink-0">Pending Dues</p>
                    <div className="flex-1 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider rounded-tl-lg">Month</th>
                            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider rounded-tr-lg">Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {loadingDetails ? (
                            <tr>
                              <td colSpan={2} className="py-10 text-center text-gray-300 text-sm">Loading...</td>
                            </tr>
                          ) : feeHistory.filter(f => f.status !== 'paid').length === 0 ? (
                            <tr>
                              <td colSpan={2} className="py-10 text-center text-gray-300 text-sm">No pending dues</td>
                            </tr>
                          ) : feeHistory.filter(f => f.status !== 'paid').map(f => {
                            const balance = Number(f.total_amount) - Number(f.paid_amount);
                            return (
                              <tr key={f.id} className="hover:bg-gray-50 transition-colors group/row">
                                <td className="px-3 py-3">
                                  <p className="font-medium text-gray-800 text-sm">{new Date(f.month_year).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
                                  <span className={cn(
                                    "inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1",
                                    f.status === 'partial' ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                                  )}>
                                    {f.status === 'partial' ? 'Partially Paid' : 'Pending'}
                                  </span>
                                </td>
                                <td className="px-3 py-3 text-right">
                                  <div className="flex flex-col items-end">
                                    <p className="font-bold text-gray-900 text-sm">Rs {balance.toLocaleString()}</p>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleDelete(f.id); }}
                                      className="opacity-0 group-hover/row:opacity-100 p-1 text-red-400 hover:text-red-600 transition-all mt-1"
                                      title="Delete Invoice"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="pt-3 mt-3 border-t border-gray-100 flex justify-between items-center shrink-0">
                      <p className="text-sm font-semibold text-gray-600">Total Outstanding</p>
                      <p className="text-xl font-bold text-red-600">
                        Rs {feeHistory.reduce((s, f) => s + (Number(f.total_amount) - Number(f.paid_amount)), 0).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Payment Form */}
                  <div className="w-80 bg-slate-900 rounded-xl border border-slate-800 shadow-xl p-5 flex flex-col gap-4">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Collect Payment</p>

                    <form onSubmit={processPayment} className="flex flex-col gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">Amount (PKR)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium">Rs.</span>
                          <input
                            required
                            type="number"
                            value={payAmount}
                            onChange={e => setPayAmount(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-xl font-bold text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 placeholder-slate-600"
                            placeholder="0"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">Payment Method</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {['Cash', 'JazzCash', 'EasyPaisa', 'Bank'].map(m => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setPayMode(m)}
                              className={cn(
                                "py-2 px-3 rounded-lg text-xs font-semibold border transition-all",
                                payMode === m
                                  ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/40"
                                  : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-300"
                              )}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">Remarks (optional)</label>
                        <textarea
                          value={payRemarks}
                          onChange={e => setPayRemarks(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 h-16 resize-none placeholder-slate-600"
                          placeholder="e.g. Discount approved by principal..."
                        />
                      </div>

                      <div className="flex flex-col gap-2 pt-2">
                        <button
                          type="submit"
                          disabled={isProcessing || !payAmount}
                          className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-900 font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-emerald-900/20"
                        >
                          {isProcessing ? <Clock className="w-5 h-5 animate-spin" /> : <Landmark className="w-5 h-5" />}
                          Collect Payment
                        </button>
                        <button type="button" onClick={() => handlePrintReceipt(lastPayment || { student_name: selectedStudent?.full_name, amount: parseFloat(payAmount) || 0, months: 'Preview', breakdown: [] })} className="w-full py-2 text-xs font-medium text-slate-500 hover:text-slate-300 transition-colors flex items-center justify-center gap-1.5">
                          <Printer className="w-3.5 h-3.5" /> Print Trial Receipt
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex-1 bg-white rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center"
              >
                {successMsg ? (
                  <div className="max-w-sm">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-50"
                    >
                      <CheckCircle className="w-10 h-10 text-emerald-600" />
                    </motion.div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Received</h2>
                    <p className="text-sm text-gray-500 mb-8">{successMsg}</p>

                    <div className="flex flex-col gap-3">
                      <button
                        onClick={() => handlePrintReceipt(lastPayment)}
                        className="w-full py-3.5 bg-slate-900 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
                      >
                        <Printer className="w-5 h-5" /> Print Receipt
                      </button>
                      <button
                        onClick={() => navigate(`/fees/student-detail?student=${lastPayment?.student_id}`)}
                        className="w-full py-2.5 text-sm font-medium text-teal-600 hover:text-teal-700 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" /> View Full Ledger
                      </button>
                      <button
                        onClick={() => setSuccessMsg(null)}
                        className="w-full py-2.5 text-sm font-medium text-gray-400 hover:text-indigo-600 transition-colors"
                      >
                        New Collection
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-sm opacity-40">
                    <Receipt className="w-16 h-16 text-indigo-400 mx-auto mb-4" />
                    <h2 className="text-lg font-bold text-gray-900 mb-2">Fee Collection</h2>
                    <p className="text-sm text-gray-500">Search for a student above to begin fee collection.</p>
                  </div>
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
                    <span className="text-sm font-bold text-gray-800">{new Date(selectedRecentTx.date).toLocaleDateString(undefined, { dateStyle: 'long' })}</span>
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
