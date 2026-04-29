import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Search, Wallet, AlertCircle, Save, CheckCircle,
  ShieldOff, AlertTriangle, FileText, ArrowRight,
  Filter, Plus, Printer, X, CreditCard, Clock,
  TrendingDown, ChevronDown, ChevronUp, Trash2, Tag, Percent, BadgeDollarSign
} from 'lucide-react';
import { calculateLateFine, getFineRules, FineRule } from '../../lib/fineUtils';
import { cn, formatDate } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  downloadChallanPDF,
  DEFAULT_CHALLAN_CONFIG,
  type ChallanRecord,
  type SchoolInfo,
} from '../../lib/challanUtils';
import FeeBreakdownEditor, { type BreakdownRow } from '../../components/FeeBreakdownEditor';
import HelpBanner from '../../components/HelpBanner';
import StudentFeeModal from '../../components/StudentFeeModal';

// ── Types ────────────────────────────────────────────────────────────────────

interface Invoice {
  id: string;
  invoice_number: string;
  month_year: string;
  total_amount: number;
  paid_amount: number;
  status: string;
  breakdown: any[];
  discount_amount?: number;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function StudentFeeDetail() {
  const { userRole } = useAuth();
  const [searchParams] = useSearchParams();

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

  // Edit State
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({ total_amount: '', paid_amount: '', month_year: '', paid_at: '' });
  const [editBreakdown, setEditBreakdown] = useState<BreakdownRow[]>([]);
  const [school, setSchool] = useState<any>(null);

  // Discount State
  const [discountRules, setDiscountRules] = useState<any[]>([]);
  const [showDiscountAdd, setShowDiscountAdd] = useState(false);
  const discountDropdownRef = useRef<HTMLDivElement>(null);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);

  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const paidAtInputRef = useRef<HTMLInputElement>(null);

  // ── Fetch Metadata ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (userRole?.school_id) {
      supabase.from('schools').select('*').eq('id', userRole.school_id).maybeSingle().then(({ data }) => setSchool(data));
      supabase.from('form_settings').select('sections_config').eq('school_id', userRole.school_id).eq('form_name', 'discount_rules').maybeSingle()
        .then(({ data }) => setDiscountRules(data?.sections_config?.rules ?? []));
    }
  }, [userRole?.school_id]);

  // Close discount dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (discountDropdownRef.current && !discountDropdownRef.current.contains(e.target as Node)) {
        setShowDiscountAdd(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Fetch Initial ──────────────────────────────────────────────────────────

  const fetchStudents = useCallback(async (query: string = '') => {
    if (!userRole?.school_id) return;
    setIsLoading(true);
    const { data } = await supabase
      .from('students')
      .select('id, full_name, roll_number, class_id, fee_waiver_percentage, custom_data, classes(name, section)')
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

  // ── Auto-select student from URL param (?student=id) ───────────────────────

  useEffect(() => {
    const studentIdParam = searchParams.get('student');
    if (!studentIdParam || !userRole?.school_id) return;
    supabase
      .from('students')
      .select('id, full_name, roll_number, class_id, fee_waiver_percentage, custom_data, classes(name, section)')
      .eq('id', studentIdParam)
      .eq('school_id', userRole.school_id)
      .maybeSingle()
      .then(({ data }) => { if (data) fetchLedger(data.id); setSelectedStudent(data); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, userRole?.school_id]);

  // ── Select Student ─────────────────────────────────────────────────────────

  const selectStudent = (stu: any) => {
    setSelectedStudent(stu);
    setWaiver(stu.fee_waiver_percentage || 0);
    fetchLedger(stu.id);
  };

  const fetchLedger = async (studentId: string) => {
    setIsLedgerLoading(true);
    const { data } = await supabase
      .from('fee_records')
      .select('id, invoice_number, month_year, total_amount, paid_amount, status, breakdown, due_date, paid_at, discount_amount')
      .eq('student_id', studentId)
      .is('deleted_at', null)
      .order('month_year', { ascending: false });

    if (data) setInvoices(data as Invoice[]);
    setIsLedgerLoading(false);
  };

  const handleOpenNewInvoice = () => {
    if (!selectedStudent) return;
    setShowNewInvoice(true);
  };

  // ── Discount helpers ───────────────────────────────────────────────────────
  const computeWaiverPct = (ruleIds: string[], rules: any[]): number => {
    let total = 0;
    ruleIds.forEach(rid => {
      const rule = rules.find(r => r.id === rid);
      if (rule?.type === 'percentage') total += rule.value;
    });
    return Math.min(Math.round(total), 100);
  };

  const handleAssignDiscountLedger = async (ruleId: string) => {
    if (!selectedStudent) return;
    const existingIds: string[] = selectedStudent.custom_data?.discount_rule_ids || [];
    if (existingIds.includes(ruleId)) { setShowDiscountAdd(false); return; }
    const updatedIds = [...existingIds, ruleId];
    const newPct = computeWaiverPct(updatedIds, discountRules);
    const { error } = await supabase.from('students').update({
      custom_data: { ...selectedStudent.custom_data, discount_rule_ids: updatedIds },
      fee_waiver_percentage: newPct,
    }).eq('id', selectedStudent.id);
    if (!error) {
      const updated = { ...selectedStudent, custom_data: { ...selectedStudent.custom_data, discount_rule_ids: updatedIds }, fee_waiver_percentage: newPct };
      setSelectedStudent(updated);
      setWaiver(newPct);
      setStudents(prev => prev.map(s => s.id === updated.id ? { ...s, fee_waiver_percentage: newPct } : s));
    }
    setShowDiscountAdd(false);
  };

  const handleRemoveDiscountLedger = async (ruleId: string) => {
    if (!selectedStudent) return;
    const updatedIds = (selectedStudent.custom_data?.discount_rule_ids || []).filter((id: string) => id !== ruleId);
    const newPct = computeWaiverPct(updatedIds, discountRules);
    const { error } = await supabase.from('students').update({
      custom_data: { ...selectedStudent.custom_data, discount_rule_ids: updatedIds },
      fee_waiver_percentage: newPct,
    }).eq('id', selectedStudent.id);
    if (!error) {
      const updated = { ...selectedStudent, custom_data: { ...selectedStudent.custom_data, discount_rule_ids: updatedIds }, fee_waiver_percentage: newPct };
      setSelectedStudent(updated);
      setWaiver(newPct);
      setStudents(prev => prev.map(s => s.id === updated.id ? { ...s, fee_waiver_percentage: newPct } : s));
    }
  };

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

      // Log Transaction — linked to this specific invoice
      await supabase.from('financial_transactions').insert([{
        school_id: userRole?.school_id,
        type: 'income',
        amount: paymentAmount,
        payment_mode: paymentMode,
        category: 'Fee Collection',
        date: new Date().toISOString().split('T')[0],
        remarks: `${selectedStudent.full_name} — ${payingInvoice.invoice_number || formatDate(payingInvoice.month_year)}`,
        fee_record_id: payingInvoice.id,
        fee_items: finalBreakdown,
      }]);

      setPayingInvoice(null);
      fetchLedger(selectedStudent.id);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateInvoice = async () => {
    if (!editingInvoice) return;
    setEditSaving(true);
    try {
      const newPaid = parseFloat(editForm.paid_amount) || 0;
      // total_amount is derived from breakdown; fallback to editForm if breakdown is empty
      const newTotal = editBreakdown.length > 0
        ? editBreakdown.reduce((s, r) => s + (Number(r.amount) || 0), 0)
        : parseFloat(editForm.total_amount) || 0;
      const { error } = await supabase.from('fee_records').update({
        total_amount: newTotal,
        paid_amount: newPaid,
        breakdown: editBreakdown.length > 0 ? editBreakdown : editingInvoice.breakdown,
        month_year: editForm.month_year + '-01',
        paid_at: newPaid > 0 ? editForm.paid_at + 'T12:00:00Z' : null,
        status: newPaid >= newTotal ? 'paid' : (newPaid > 0 ? 'partial' : 'pending')
      }).eq('id', editingInvoice.id);

      if (error) throw error;
      setEditingInvoice(null);
      fetchLedger(selectedStudent.id);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteInvoice = async (inv: Invoice) => {
    if (!window.confirm(`PERMANENT DELETE: Are you sure you want to completely eliminate invoice ${inv.invoice_number}? This action cannot be undone and will also remove all associated financial records and payments.`)) return;
    try {
      // PERMANENT (HARD) DELETE
      const { error } = await supabase
        .from('fee_records')
        .delete()
        .eq('id', inv.id);
      
      if (error) throw error;

      // Clean up transactions precisely by remark containing the invoice number
      await supabase
        .from('financial_transactions')
        .delete()
        .ilike('remarks', `%${inv.invoice_number}%`);

      setEditingInvoice(null);
      fetchLedger(selectedStudent.id);
    } catch (err: any) { alert(err.message); }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  const filteredStudents = students; // Switched to server-side search

  const handlePrintReceipt = (inv: Invoice) => {
    if (!inv || !selectedStudent) return;
    const className = selectedStudent.classes
      ? `${selectedStudent.classes.name}${selectedStudent.classes.section ? ' - ' + selectedStudent.classes.section : ''}`
      : '';
    // Rebuild the gross total from breakdown so the challan shows:
    // Original Fee (breakdown sum) → Discount → Net Due
    const breakdownItems = (inv.breakdown || []).map((b: any) => ({ item: b.item, amount: Number(b.amount) }));
    const grossTotal = breakdownItems.reduce((s, b) => s + b.amount, 0);
    const discountAmt = (inv as any).discount_amount ?? 0;
    const record: ChallanRecord = {
      id: inv.id,
      invoice_number: inv.invoice_number,
      month_year: inv.month_year,
      // Use gross total so challanUtils can correctly subtract discountAmt
      total_amount: grossTotal || inv.total_amount,
      paid_amount: inv.paid_amount || 0,
      status: inv.status,
      breakdown: breakdownItems,
      discount_amount: discountAmt,
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

  // ── Discount dropdown JSX (shared between both views) ─────────────────────
  const discountDropdownJSX = showDiscountAdd && dropdownRect && createPortal(
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      style={{
        position: 'fixed',
        left: Math.max(10, Math.min(window.innerWidth - 250, dropdownRect.right - 240)),
        top: dropdownRect.bottom + 10 + 320 > window.innerHeight
          ? dropdownRect.top - 10
          : dropdownRect.bottom + 10,
        transform: dropdownRect.bottom + 10 + 320 > window.innerHeight ? 'translateY(-100%)' : 'none',
        zIndex: 9999,
        minWidth: '240px',
      }}
      className="bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden ring-4 ring-black/5"
    >
      <div className="px-4 py-3 bg-slate-50 border-b border-gray-100 flex items-center justify-between">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Assign Discount Rule</p>
        <button onClick={() => setShowDiscountAdd(false)} className="text-slate-400 hover:text-slate-600"><X className="w-3 h-3" /></button>
      </div>
      <div className="max-h-[300px] overflow-y-auto">
        {discountRules.length === 0 ? (
          <p className="px-4 py-6 text-xs text-slate-400 italic text-center">No rules yet — create one in Discounts & Scholarships.</p>
        ) : discountRules.map(rule => {
          const already = (selectedStudent?.custom_data?.discount_rule_ids || []).includes(rule.id);
          const isFlat = rule.type === 'flat';
          return (
            <button key={rule.id} disabled={already}
              onClick={() => { handleAssignDiscountLedger(rule.id); setShowDiscountAdd(false); }}
              className={cn("w-full flex items-center gap-3 px-4 py-3 text-left transition-all border-b border-gray-50 last:border-0",
                already ? "opacity-40 cursor-not-allowed bg-slate-50" : "hover:bg-indigo-50")}
            >
              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                isFlat ? "bg-amber-100" : "bg-emerald-100")}>
                {isFlat ? <BadgeDollarSign className="w-4 h-4 text-amber-600" /> : <Percent className="w-4 h-4 text-emerald-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{rule.name}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-tight">{isFlat ? 'Flat deduction' : 'Percentage waiver'}</p>
              </div>
              <span className={cn("text-xs font-bold px-2 py-0.5 rounded-lg",
                isFlat ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700")}>
                {isFlat ? `Rs.${Number(rule.value).toLocaleString()}` : `${rule.value}%`}
              </span>
            </button>
          );
        })}
      </div>
    </motion.div>,
    document.body
  );

  return (
    <div className="space-y-4 print:block">
      <style>{`@media print { .no-print { display: none !important; } body { background: white; } }`}</style>
      {showDiscountAdd && <div className="fixed inset-0 z-20" onClick={() => setShowDiscountAdd(false)} />}
      {discountDropdownJSX}

      {/* ── STATE 1: No student selected — full-width search ─────────── */}
      {!selectedStudent ? (
        <>
          {/* Search bar */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
            <h1 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-indigo-600" /> Student Fee Ledger
            </h1>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by student name or roll number…"
                autoFocus
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Student results */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="py-16 flex items-center justify-center">
                <Clock className="w-6 h-6 animate-spin text-gray-300" />
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="py-20 text-center text-gray-400">
                <Search className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">{search ? 'No students found' : 'Start typing to search students'}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {filteredStudents.map(stu => (
                  <button
                    key={stu.id}
                    onClick={() => selectStudent(stu)}
                    className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-indigo-50 transition-colors text-left group"
                  >
                    <div className="w-9 h-9 rounded-full bg-indigo-100 group-hover:bg-indigo-200 flex items-center justify-center text-sm font-bold text-indigo-700 shrink-0 transition-colors">
                      {stu.full_name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 group-hover:text-indigo-900 truncate">{stu.full_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {stu.classes?.name}{stu.classes?.section ? ` (${stu.classes.section})` : ''} · Roll #{stu.roll_number}
                      </p>
                    </div>
                    {stu.fee_waiver_percentage > 0 && (
                      <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                        {stu.fee_waiver_percentage}% off
                      </span>
                    )}
                    <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 shrink-0 transition-colors" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        /* ── STATE 2: Student selected — full-page ledger ──────────── */
        <>
          {/* ── Student header ── */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-visible no-print">

            {/* Top bar: back + identity + actions */}
            <div className="flex items-center gap-3 px-4 py-3 flex-wrap">
              {/* Back */}
              <button
                onClick={() => { setSelectedStudent(null); setInvoices([]); }}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
                title="Back to search"
              >
                <ArrowRight className="w-4 h-4 text-gray-400 rotate-180" />
              </button>

              {/* Avatar + name */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white text-base font-bold shadow-sm shrink-0">
                  {selectedStudent.full_name[0]}
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-gray-900 leading-tight truncate">{selectedStudent.full_name}</h2>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-semibold">
                      {selectedStudent.classes?.name}{selectedStudent.classes?.section ? ` · ${selectedStudent.classes.section}` : ''}
                    </span>
                    <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-semibold">
                      Roll #{selectedStudent.roll_number}
                    </span>
                  </div>
                </div>
              </div>

              {/* Outstanding amount */}
              <div className="text-right shrink-0">
                <p className="text-[10px] text-gray-400 leading-none mb-0.5">Outstanding</p>
                <p className={cn("text-lg font-bold leading-none",
                  totalOutstanding > 0 ? "text-red-600" : "text-emerald-600")}>
                  Rs. {totalOutstanding.toLocaleString()}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <button
                  onClick={handleOpenNewInvoice}
                  className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" /> New Invoice
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
              </div>
            </div>

            {/* Stat bar */}
            <div className="grid grid-cols-3 border-t border-gray-100">
              <div className="px-4 py-2.5 text-center border-r border-gray-100">
                <p className="text-[10px] text-gray-400 font-medium">Total Billed</p>
                <p className="text-sm font-bold text-gray-900">Rs. {totalBilled.toLocaleString()}</p>
              </div>
              <div className="px-4 py-2.5 text-center border-r border-gray-100">
                <p className="text-[10px] text-emerald-600 font-medium">Total Paid</p>
                <p className="text-sm font-bold text-emerald-600">Rs. {totalPaid.toLocaleString()}</p>
              </div>
              <div className="px-4 py-2.5 text-center">
                <p className={cn("text-[10px] font-medium", totalOutstanding > 0 ? "text-red-500" : "text-emerald-600")}>Balance Due</p>
                <p className={cn("text-sm font-bold", totalOutstanding > 0 ? "text-red-600" : "text-emerald-600")}>
                  Rs. {totalOutstanding.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Discount + waiver strip */}
            <div className="border-t border-gray-100 px-4 py-2.5 flex items-center flex-wrap gap-2 bg-gray-50/60 rounded-b-xl">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest shrink-0 flex items-center gap-1">
                <Tag className="w-3 h-3" /> Discounts
              </span>

              {(() => {
                const activeIds: string[] = selectedStudent.custom_data?.discount_rule_ids || [];
                const activeRules = discountRules.filter(r => activeIds.includes(r.id));
                return activeRules.length === 0
                  ? <span className="text-[10px] text-gray-400 italic">None assigned</span>
                  : activeRules.map(rule => (
                    <span key={rule.id} className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold px-2.5 py-1 rounded-full">
                      {rule.type === 'flat' ? <BadgeDollarSign className="w-3 h-3 text-emerald-500" /> : <Percent className="w-3 h-3 text-emerald-500" />}
                      {rule.name}
                      <span className="bg-emerald-600 text-white text-[9px] font-black rounded-full px-1.5 py-0.5">
                        {rule.type === 'percentage' ? `${rule.value}%` : `Rs.${Number(rule.value).toLocaleString()}`}
                      </span>
                      <button onClick={() => handleRemoveDiscountLedger(rule.id)} className="text-emerald-300 hover:text-rose-500 transition-colors">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ));
              })()}

              {/* Add discount button */}
              <div ref={discountDropdownRef}>
                <button ref={addBtnRef}
                  onClick={() => {
                    if (showDiscountAdd) { setShowDiscountAdd(false); return; }
                    const r = addBtnRef.current?.getBoundingClientRect();
                    if (r) setDropdownRect(r);
                    setShowDiscountAdd(true);
                  }}
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 border border-indigo-200 bg-white rounded-full px-2.5 py-1 hover:bg-indigo-50 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>

              {/* Waiver editor */}
              <div className="ml-auto flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
                <Percent className="w-3 h-3 text-gray-400" />
                <span className="text-[10px] text-gray-400 font-medium">Waiver:</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={waiver}
                  onFocus={e => e.target.select()}
                  onChange={e => setWaiver(parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 0)}
                  className="w-10 bg-transparent border-none p-0 text-sm font-bold text-indigo-600 focus:ring-0 outline-none text-center"
                />
                <span className="text-[10px] text-gray-400">%</span>
                <button onClick={handleUpdateWaiver}
                  className="p-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors" title="Save waiver">
                  <Save className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          </div>

          {/* ── Invoice Table ── */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              {isLederLoading ? (
                <div className="py-20 flex items-center justify-center">
                  <Clock className="w-8 h-8 animate-spin text-gray-200" />
                </div>
              ) : invoices.length === 0 ? (
                <div className="py-20 text-center">
                  <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-400 mb-4">No invoices yet</p>
                  <button onClick={handleOpenNewInvoice}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors">
                    <Plus className="w-4 h-4" /> Create First Invoice
                  </button>
                </div>
              ) : (
                <table className="w-full text-sm min-w-[600px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Month</th>
                      <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 hidden sm:table-cell">Invoice #</th>
                      <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500">Total</th>
                      <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500">Paid</th>
                      <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500">Balance</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500">Status</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {invoices.map((inv) => (
                      <React.Fragment key={inv.id}>
                        <tr className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-800 text-sm">
                              {formatDate(inv.month_year)}
                            </p>
                          </td>
                          <td className="px-3 py-3 hidden sm:table-cell">
                            <p className="text-xs font-mono text-gray-400">{inv.invoice_number || '—'}</p>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <p className="font-medium text-gray-900">Rs. {inv.total_amount.toLocaleString()}</p>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <p className="font-medium text-emerald-600">Rs. {(inv.paid_amount || 0).toLocaleString()}</p>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <p className="font-bold text-gray-900">
                              Rs. {(inv.total_amount - (inv.paid_amount || 0)).toLocaleString()}
                            </p>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={cn(
                              "inline-block text-xs font-semibold px-2.5 py-1 rounded-full",
                              inv.status === 'paid' ? "bg-emerald-100 text-emerald-700"
                                : inv.status === 'partial' ? "bg-amber-100 text-amber-700"
                                : "bg-red-100 text-red-700"
                            )}>
                              {inv.status === 'paid' ? 'Paid' : inv.status === 'partial' ? 'Partial' : inv.status === 'overdue' ? 'Overdue' : 'Pending'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              {inv.status === 'paid' ? (
                                <button onClick={() => handlePrintReceipt(inv)}
                                  className="p-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors" title="Print Receipt">
                                  <Printer className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => { setPayingInvoice(inv); setPaymentAmount(inv.total_amount - (inv.paid_amount || 0)); }}
                                  className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors whitespace-nowrap"
                                >
                                  Collect
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setEditingInvoice(inv);
                                  setEditBreakdown(inv.breakdown?.length ? inv.breakdown.map((b: any) => ({ item: b.item, amount: Number(b.amount) })) : []);
                                  setEditForm({
                                    total_amount: String(inv.total_amount),
                                    paid_amount: String(inv.paid_amount || 0),
                                    month_year: inv.month_year.slice(0, 7),
                                    paid_at: (inv as any).paid_at ? (inv as any).paid_at.split('T')[0] : new Date().toISOString().split('T')[0]
                                  });
                                }}
                                className="text-xs font-semibold text-gray-400 hover:text-indigo-600 px-2 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                              >
                                Edit
                              </button>
                            </div>
                          </td>
                        </tr>
                        {/* Breakdown sub-row */}
                        {inv.breakdown?.length > 0 && (
                          <tr className="bg-gray-50/80">
                            <td colSpan={7} className="px-4 py-2 border-l-2 border-indigo-200">
                              <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                                {inv.breakdown.map((b: any, bIdx: number) => (
                                  <span key={bIdx} className="text-xs text-gray-500">
                                    <span className="font-medium text-gray-600">{b.item}</span>
                                    {' · '}
                                    <span className="font-semibold text-gray-700">Rs. {Number(b.amount).toLocaleString()}</span>
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
                    {formatDate(payingInvoice.month_year)}
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
                      type="text"
                      inputMode="decimal"
                      value={paymentAmount}
                      onFocus={e => e.target.select()}
                      onChange={e => setPaymentAmount(parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 0)}
                      className="flex-1 px-3 py-3 text-lg font-bold text-indigo-600 outline-none bg-white"
                    />
                  </div>
                </div>

                {/* Payment Mode Pills */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">Payment Method</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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

      {/* Edit Modal */}
      <AnimatePresence>
        {editingInvoice && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-left"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
                <div>
                  <h2 className="text-sm font-black uppercase tracking-widest leading-none">Edit Invoice</h2>
                  <p className="text-xs text-slate-400 mt-0.5">{editingInvoice.invoice_number}</p>
                </div>
                <button onClick={() => setEditingInvoice(null)} className="text-white/60 hover:text-white">✕</button>
              </div>
              <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
                {/* Month + Paid At */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Fee Month</label>
                    <input type="month" value={editForm.month_year} onChange={e => setEditForm({...editForm, month_year: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Paid At</label>
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
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white group-hover:border-indigo-400 transition-colors"
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

                {/* Breakdown Editor */}
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">Fee Breakdown</label>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                    <FeeBreakdownEditor
                      breakdown={editBreakdown}
                      onChange={setEditBreakdown}
                      schoolId={userRole?.school_id}
                    />
                  </div>
                </div>

                {/* Paid Amount */}
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Amount Already Paid (Rs)</label>
                  <input type="text" inputMode="decimal" value={editForm.paid_amount} onFocus={e => e.target.select()} onChange={e => setEditForm({...editForm, paid_amount: e.target.value.replace(/[^0-9.]/g, '')})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-black text-emerald-600 font-mono" />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Total billed (from breakdown): Rs. {editBreakdown.reduce((s, r) => s + (Number(r.amount) || 0), 0).toLocaleString()}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleDeleteInvoice(editingInvoice)}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                  <button onClick={handleUpdateInvoice} disabled={editSaving}
                    className="flex-1 py-2.5 bg-indigo-600 text-white font-black rounded-xl text-sm hover:bg-indigo-700 transition disabled:opacity-50">
                    {editSaving ? 'Updating...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Invoice Modal */}
      {/* Unified New Invoice Modal Component */}
      <AnimatePresence>
        {showNewInvoice && selectedStudent && (
          <StudentFeeModal
            student={selectedStudent}
            onClose={() => setShowNewInvoice(false)}
            onSave={() => {
              setShowNewInvoice(false);
              selectStudent(selectedStudent);
            }}
          />
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
