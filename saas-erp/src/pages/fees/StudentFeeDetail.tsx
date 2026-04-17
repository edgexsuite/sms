import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Search, Wallet, AlertCircle, Save, CheckCircle,
  ShieldOff, AlertTriangle, FileText, ArrowRight,
  Filter, Plus, Printer, X, CreditCard, Clock,
  TrendingDown, ChevronDown, ChevronUp
} from 'lucide-react';
import { calculateLateFine, getFineRules, FineRule } from '../../lib/fineUtils';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  downloadChallanPDF,
  DEFAULT_CHALLAN_CONFIG,
  type ChallanRecord,
  type SchoolInfo,
} from '../../lib/challanUtils';

// ── Types ────────────────────────────────────────────────────────────────────

interface Invoice {
  id: string;
  invoice_number: string;
  month_year: string;
  total_amount: number;
  paid_amount: number;
  status: string;
  breakdown: any[];
}

// ── Component ────────────────────────────────────────────────────────────────

export default function StudentFeeDetail() {
  const { userRole } = useAuth();

  // Data State
  const [students, setStudents] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [fineRules, setFineRules] = useState<FineRule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLederLoading, setIsLedgerLoading] = useState(false);

  // Form State
  const [waiver, setWaiver] = useState<number>(0);
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [waiveFine, setWaiveFine] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [school, setSchool] = useState<any>(null);

  // ── Fetch Metadata ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (userRole?.school_id) {
      supabase.from('schools').select('*').eq('id', userRole.school_id).maybeSingle().then(({ data }) => setSchool(data));
    }
  }, [userRole?.school_id]);

  // ── Fetch Initial ──────────────────────────────────────────────────────────

  const fetchStudents = useCallback(async (query: string = '') => {
    if (!userRole?.school_id) return;
    setIsLoading(true);
    const { data } = await supabase
      .from('students')
      .select('id, full_name, roll_number, fee_waiver_percentage, classes(name, section)')
      .eq('school_id', userRole!.school_id)
      .eq('status', 'active')
      .or(`full_name.ilike.%${query}%,roll_number.eq.${parseInt(query) || 0}`)
      .limit(20);

    if (data) setStudents(data);
    setIsLoading(false);
  }, [userRole?.school_id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStudents(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search, fetchStudents]);

  useEffect(() => {
    if (userRole?.school_id) {
      getFineRules(userRole.school_id).then(setFineRules);
    }
  }, [userRole?.school_id]);

  // ── Select Student ─────────────────────────────────────────────────────────

  const selectStudent = async (stu: any) => {
    setSelectedStudent(stu);
    setWaiver(stu.fee_waiver_percentage || 0);
    setIsLedgerLoading(true);

    const { data } = await supabase
      .from('fee_records')
      .select('id, invoice_number, month_year, total_amount, paid_amount, status, breakdown')
      .eq('student_id', stu.id)
      .order('month_year', { ascending: false });

    if (data) setInvoices(data as Invoice[]);
    setIsLedgerLoading(false);
  };

  // ── Update Waiver ──────────────────────────────────────────────────────────

  const handleUpdateWaiver = async () => {
    if (!selectedStudent) return;
    try {
      const { error } = await supabase
        .from('students')
        .update({ fee_waiver_percentage: waiver })
        .eq('id', selectedStudent.id);

      if (error) throw error;
      alert('Waiver updated.');
      fetchStudents();
    } catch (err: any) { alert(err.message); }
  };

  // ── Process Individual Invoice Payment ─────────────────────────────────────

  const handleProcessPayment = async () => {
    if (!payingInvoice || paymentAmount <= 0) return;
    setIsProcessing(true);

    const balanceBefore = payingInvoice.total_amount - (payingInvoice.paid_amount || 0);
    if (paymentAmount > balanceBefore + 10) { // small buffer for rounding
      alert(`Amount cannot exceed the balance.`);
      setIsProcessing(false);
      return;
    }

    try {
      let finalTotal = payingInvoice.total_amount;
      let finalBreakdown = [...(payingInvoice.breakdown || [])];

      // Handle Fine Application
      if (!waiveFine) {
        const { totalFine, appliedRules } = calculateLateFine(payingInvoice, fineRules);
        if (totalFine > 0) {
          finalBreakdown.push({ item: `Late Fine (${appliedRules})`, amount: totalFine });
          finalTotal += totalFine;

          await supabase.from('fee_records').update({
            total_amount: finalTotal,
            breakdown: finalBreakdown
          }).eq('id', payingInvoice.id);
        }
      }

      const newPaidTotal = (payingInvoice.paid_amount || 0) + paymentAmount;
      const newStatus = newPaidTotal >= finalTotal ? 'paid' : (newPaidTotal > 0 ? 'partial' : 'pending');

      // Update Invoice
      const { error: invErr } = await supabase.from('fee_records').update({
        paid_amount: newPaidTotal,
        status: newStatus,
        payment_mode: paymentMode,
        paid_at: new Date().toISOString()
      }).eq('id', payingInvoice.id);

      if (invErr) throw invErr;

      // Log Transaction
      await supabase.from('financial_transactions').insert([{
        school_id: userRole?.school_id,
        type: 'income',
        amount: paymentAmount,
        payment_mode: paymentMode,
        category: 'Fee Collection',
        date: new Date().toISOString().split('T')[0],
        remarks: `Fee — ${selectedStudent.full_name} (${payingInvoice.invoice_number})`
      }]);

      setPayingInvoice(null);
      selectStudent(selectedStudent);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  const filteredStudents = students; // Switched to server-side search

  const handlePrintReceipt = (inv: Invoice) => {
    if (!inv || !selectedStudent) return;
    const className = selectedStudent.classes
      ? `${selectedStudent.classes.name}${selectedStudent.classes.section ? ' - ' + selectedStudent.classes.section : ''}`
      : '';
    const record: ChallanRecord = {
      id: inv.id,
      invoice_number: inv.invoice_number,
      month_year: inv.month_year,
      total_amount: inv.total_amount,
      paid_amount: inv.paid_amount || 0,
      status: inv.status,
      breakdown: (inv.breakdown || []).map((b: any) => ({ item: b.item, amount: Number(b.amount) })),
      student_name: selectedStudent.full_name,
      roll_number: selectedStudent.roll_number,
      class_name: className,
      issue_date: new Date().toISOString().split('T')[0],
    };
    const schoolInfo: SchoolInfo = {
      name: school?.name || 'School',
      address: school?.address || undefined,
      contact_phone: school?.contact_phone || school?.phone || undefined,
      logo_url: school?.logo_url || undefined,
    };
    downloadChallanPDF([record], schoolInfo, DEFAULT_CHALLAN_CONFIG);
  };

  const calculateTotalDue = () => {
    return invoices.reduce((s, inv) => s + (inv.total_amount - (inv.paid_amount || 0)), 0);
  };

  // ── Derived stat values ────────────────────────────────────────────────────

  const totalBilled = invoices.reduce((s, inv) => s + inv.total_amount, 0);
  const totalPaid = invoices.reduce((s, inv) => s + (inv.paid_amount || 0), 0);
  const totalOutstanding = calculateTotalDue();

  return (
    <div className="h-[calc(100vh-140px)] flex gap-4 overflow-hidden">

      {/* ── Left Sidebar ─────────────────────────────────────────────── */}
      <div className="w-72 flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden shrink-0">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-800">Student Ledgers</h2>
            <Search className="w-4 h-4 text-gray-400" />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name or roll #..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-10 text-center">
              <Clock className="w-5 h-5 animate-spin mx-auto text-gray-300" />
            </div>
          ) : filteredStudents.map(stu => {
            const stuBalance = 0; // balance shown only once loaded
            const isSelected = selectedStudent?.id === stu.id;
            return (
              <button
                key={stu.id}
                onClick={() => selectStudent(stu)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 transition-all text-left",
                  isSelected
                    ? "bg-indigo-50 border-l-4 border-l-indigo-600"
                    : "hover:bg-gray-50 border-l-4 border-l-transparent"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                  isSelected ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-500"
                )}>
                  {stu.full_name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm font-semibold truncate",
                    isSelected ? "text-indigo-900" : "text-gray-800"
                  )}>{stu.full_name}</p>
                  <p className="text-xs text-gray-400">
                    {stu.classes?.name}-{stu.classes?.section} · #{stu.roll_number}
                  </p>
                </div>
                {stu.fee_waiver_percentage > 0 && (
                  <span className="bg-amber-100 text-amber-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0">
                    {stu.fee_waiver_percentage}%
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main Panel ───────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col gap-4">
        {!selectedStudent ? (
          <div className="flex-1 bg-white rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
            <div className="opacity-40">
              <FileText className="w-16 h-16 text-indigo-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">Select a Student</h2>
              <p className="text-sm text-gray-500">Choose a student from the list to view their fee invoices and payment history.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Student Header Card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white text-xl font-bold shadow-md shadow-indigo-100">
                  {selectedStudent.full_name[0]}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{selectedStudent.full_name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                      {selectedStudent.classes?.name}-{selectedStudent.classes?.section}
                    </span>
                    <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium">
                      Roll #{selectedStudent.roll_number}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                {/* Waiver Control */}
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-[10px] text-gray-400 font-medium mb-0.5">Fee Waiver %</p>
                    <input
                      type="number"
                      value={waiver}
                      onChange={e => setWaiver(parseFloat(e.target.value) || 0)}
                      className="w-16 bg-transparent border-none p-0 text-sm font-bold text-indigo-600 focus:ring-0 outline-none"
                    />
                  </div>
                  <button
                    onClick={handleUpdateWaiver}
                    className="p-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="text-right border-l border-gray-100 pl-6">
                  <p className="text-xs text-gray-400 mb-1">Outstanding Balance</p>
                  <p className={cn(
                    "text-2xl font-bold leading-none",
                    totalOutstanding > 0 ? "text-red-600" : "text-emerald-600"
                  )}>
                    Rs. {totalOutstanding.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* 3 Stat Cards */}
            <div className="grid grid-cols-3 gap-4 shrink-0">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <p className="text-xs text-gray-400 font-medium mb-1">Total Billed</p>
                <p className="text-xl font-bold text-gray-900">Rs. {totalBilled.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <p className="text-xs text-emerald-600 font-medium mb-1">Total Paid</p>
                <p className="text-xl font-bold text-emerald-600">Rs. {totalPaid.toLocaleString()}</p>
              </div>
              <div className={cn(
                "rounded-xl border shadow-sm p-4",
                totalOutstanding > 0 ? "bg-red-50 border-red-100" : "bg-emerald-50 border-emerald-100"
              )}>
                <p className={cn("text-xs font-medium mb-1", totalOutstanding > 0 ? "text-red-500" : "text-emerald-600")}>Outstanding</p>
                <p className={cn("text-xl font-bold", totalOutstanding > 0 ? "text-red-600" : "text-emerald-600")}>
                  Rs. {totalOutstanding.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Invoice Table */}
            <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col min-h-0">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
                <h3 className="text-sm font-bold text-gray-800">Fee Invoices</h3>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Statement
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {isLederLoading ? (
                  <div className="p-20 text-center">
                    <Clock className="w-8 h-8 animate-spin mx-auto text-gray-200" />
                  </div>
                ) : invoices.length === 0 ? (
                  <div className="p-20 text-center">
                    <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">No invoices found</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Month</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice #</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Paid</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Balance</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {invoices.map((inv) => (
                        <React.Fragment key={inv.id}>
                          <tr className="hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-3">
                              <p className="font-medium text-gray-800">
                                {new Date(inv.month_year).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-xs font-mono text-gray-400">{inv.invoice_number}</p>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <p className="font-medium text-gray-900">Rs. {inv.total_amount.toLocaleString()}</p>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <p className="font-medium text-emerald-600">Rs. {(inv.paid_amount || 0).toLocaleString()}</p>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <p className="font-bold text-gray-900">Rs. {(inv.total_amount - (inv.paid_amount || 0)).toLocaleString()}</p>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={cn(
                                "inline-block text-xs font-semibold px-2.5 py-1 rounded-full",
                                inv.status === 'paid'
                                  ? "bg-emerald-100 text-emerald-700"
                                  : inv.status === 'partial'
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-red-100 text-red-700"
                              )}>
                                {inv.status === 'paid' ? 'Paid' : inv.status === 'partial' ? 'Partial' : inv.status === 'overdue' ? 'Overdue' : 'Pending'}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-right">
                              {inv.status === 'paid' ? (
                                <button
                                  onClick={() => handlePrintReceipt(inv)}
                                  className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                                  title="Print Receipt"
                                >
                                  <Printer className="w-4 h-4" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setPayingInvoice(inv);
                                    setPaymentAmount(inv.total_amount - (inv.paid_amount || 0));
                                  }}
                                  className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors"
                                >
                                  Collect
                                </button>
                              )}
                            </td>
                          </tr>
                          {/* Breakdown Row */}
                          {inv.breakdown?.length > 0 && (
                            <tr className="bg-gray-50">
                              <td colSpan={7} className="px-5 py-2.5 border-l-2 border-indigo-200">
                                <div className="flex flex-wrap gap-x-5 gap-y-1">
                                  {inv.breakdown.map((b: any, bIdx: number) => (
                                    <span key={bIdx} className="text-xs text-gray-500">
                                      <span className="font-medium text-gray-600">{b.item}</span>
                                      {' · '}
                                      <span className="font-semibold text-gray-700">Rs. {b.amount.toLocaleString()}</span>
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Payment Modal ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {payingInvoice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-5 py-4 flex items-center justify-between text-white">
                <div>
                  <p className="text-sm font-bold">Collect Payment</p>
                  <p className="text-xs text-indigo-200 mt-0.5">
                    {new Date(payingInvoice.month_year).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <button
                  onClick={() => setPayingInvoice(null)}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-5">
                {/* Outstanding Balance */}
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">Outstanding Balance</p>
                  <p className="text-3xl font-bold text-gray-900">
                    Rs. {(payingInvoice.total_amount - (payingInvoice.paid_amount || 0)).toLocaleString()}
                  </p>
                </div>

                {/* Amount Input */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Amount to Collect</label>
                  <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent">
                    <span className="px-3 py-3 text-sm font-medium text-gray-500 bg-gray-50 border-r border-gray-200">Rs.</span>
                    <input
                      type="number"
                      value={paymentAmount}
                      onChange={e => setPaymentAmount(parseFloat(e.target.value) || 0)}
                      className="flex-1 px-3 py-3 text-lg font-bold text-indigo-600 outline-none bg-white"
                    />
                  </div>
                </div>

                {/* Payment Mode Pills */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">Payment Method</label>
                  <div className="grid grid-cols-4 gap-2">
                    {['Cash', 'Bank Transfer', 'JazzCash', 'EasyPaisa'].map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPaymentMode(m)}
                        className={cn(
                          "py-2 px-1 rounded-lg text-[10px] font-semibold border transition-all",
                          paymentMode === m
                            ? "bg-indigo-600 border-indigo-500 text-white shadow-sm"
                            : "bg-white border-gray-200 text-gray-500 hover:border-indigo-200 hover:text-indigo-600"
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fine Logic */}
                {(() => {
                  const { totalFine, appliedRules } = calculateLateFine(payingInvoice, fineRules);
                  if (totalFine <= 0) return null;
                  return (
                    <div className={cn(
                      "p-3 rounded-xl border flex flex-col gap-2 transition-all",
                      waiveFine ? "bg-gray-50 border-gray-200" : "bg-amber-50 border-amber-200"
                    )}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className={cn("w-4 h-4", waiveFine ? "text-gray-400" : "text-amber-500")} />
                          <p className={cn("text-xs font-semibold", waiveFine ? "text-gray-500" : "text-amber-800")}>
                            Late Fine: Rs. {totalFine}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setWaiveFine(!waiveFine);
                            setPaymentAmount(prev => !waiveFine ? Math.max(0, prev - totalFine) : prev + totalFine);
                          }}
                          className={cn(
                            "text-xs font-semibold px-2.5 py-1 rounded-lg transition-all",
                            waiveFine
                              ? "bg-indigo-600 text-white"
                              : "bg-white text-amber-600 border border-amber-200 hover:bg-amber-100"
                          )}
                        >
                          {waiveFine ? "Waiver Applied" : "Waive Fine"}
                        </button>
                      </div>
                      {!waiveFine && <p className="text-xs text-amber-600 opacity-70">Rule: {appliedRules}</p>}
                    </div>
                  );
                })()}

                {/* Confirm Button */}
                <button
                  onClick={handleProcessPayment}
                  disabled={isProcessing || paymentAmount <= 0}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-indigo-100"
                >
                  {isProcessing ? <Clock className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  Confirm Payment
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const Banknote = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);
