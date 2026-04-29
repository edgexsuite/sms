/**
 * StudentFeeModal — Professional Fee Invoice & Collection
 * ─────────────────────────────────────────────────────────
 * • Fee heads loaded from class fee matrix (dropdown, not free text)
 * • Per-item discount: % or fixed amount
 * • One-time fees (admission/registration/security) shown separately;
 *   greyed if already charged to this student
 * • Monthly fees with student-level waiver applied
 * • Collect Now → marks fee_records paid/partial + posts to
 *   financial_transactions (Ledger / P&L)
 * • Print Invoice (unpaid) and Print Receipt with PAID stamp
 */
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  X, CheckCircle, Receipt, Loader2, AlertTriangle,
  ChevronDown, Printer, BadgeCheck, Info,
} from 'lucide-react';
import { cn } from '../lib/utils';
import {
  downloadChallanPDF,
  DEFAULT_CHALLAN_CONFIG,
  type ChallanRecord,
  type SchoolInfo,
} from '../lib/challanUtils';

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface FeeRow {
  id: string;
  label: string;
  baseAmount: number;
  isOneTime: boolean;
  isArrears: boolean;       // previous unpaid balance row — locked, non-removable
  include: boolean;
  discountType: 'pct' | 'fixed';
  discountVal: number;
  alreadyCharged: boolean;
}

interface Props {
  student: {
    id: string;
    full_name: string;
    class_id?: string | null;
    roll_number?: number | null;
    fee_waiver_percentage?: number | null;
    fee_override?: any | null;           // per-student fee matrix override
    classes?: { name: string; section?: string } | null;
  };
  onSave: () => void;
  onClose: () => void;
  includeAdmissionFees?: boolean;
}

const PAY_MODES = ['Cash', 'Cheque', 'Bank Transfer', 'JazzCash', 'EasyPaisa', 'Online'];

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function currentMonthYear() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function genInvoiceNo(monthYear?: string, roll?: number | null) {
  const d = monthYear ? new Date(monthYear + '-01') : new Date();
  const ym = `${d.getFullYear().toString().slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}`;
  const seq = String(roll ?? Math.floor(Math.random() * 999)).padStart(3, '0');
  return `INV-${ym}-${seq}`;
}
function rowNet(row: FeeRow): number {
  if (!row.include || row.alreadyCharged) return 0;
  if (row.isArrears) return row.baseAmount; // arrears are fixed — no discount applied
  const disc = row.discountType === 'pct'
    ? row.baseAmount * Math.min(100, row.discountVal) / 100
    : Math.min(row.baseAmount, row.discountVal);
  return Math.max(0, row.baseAmount - disc);
}
function rowDiscountAmt(row: FeeRow): number {
  if (!row.include || row.alreadyCharged || row.isArrears) return 0;
  return row.discountType === 'pct'
    ? row.baseAmount * Math.min(100, row.discountVal) / 100
    : Math.min(row.baseAmount, row.discountVal);
}

/* ─── Challan helper ─────────────────────────────────────────────────────── */
function buildChallanRecord(params: {
  invoiceNo: string;
  student: Props['student'];
  monthYearDate: string;
  dueDate: string;
  activeRows: FeeRow[];
  total: number;
  paid: number;
  status: 'paid' | 'partial' | 'pending';
  totalDiscount: number;
  today: string;
}): ChallanRecord {
  const { invoiceNo, student, monthYearDate, dueDate, activeRows, total, paid, status, totalDiscount, today } = params;
  const className = student.classes
    ? `${student.classes.name}${student.classes.section ? ' - ' + student.classes.section : ''}`
    : '';
  return {
    id: student.id,
    invoice_number: invoiceNo,
    month_year: monthYearDate,
    due_date: dueDate,
    total_amount: total,
    paid_amount: paid,
    status,
    breakdown: activeRows
      .filter(r => !r.isArrears)
      .map(r => ({ item: r.label, amount: rowNet(r) })),
    student_name: student.full_name,
    roll_number: student.roll_number ?? undefined,
    class_name: className,
    discount_amount: totalDiscount > 0 ? totalDiscount : undefined,
    issue_date: today,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main Component
═══════════════════════════════════════════════════════════════════════════ */
export default function StudentFeeModal({ student, onSave, onClose, includeAdmissionFees = false }: Props) {
  const { userRole } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [schoolName, setSchoolName] = useState('School');
  const [schoolLogo, setSchoolLogo] = useState('');
  const [schoolAddress, setSchoolAddress] = useState('');
  const [noFeeStructure, setNoFeeStructure] = useState(false);
  const [hasZeroAmounts, setHasZeroAmounts] = useState(false);

  /* ── Invoice fields ── */
  const [monthYear, setMonthYear] = useState(currentMonthYear());
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 10);
    return d.toISOString().split('T')[0];
  });
  const [rows, setRows] = useState<FeeRow[]>([]);
  const [remarks, setRemarks] = useState('');
  const [feeItemSuggestions, setFeeItemSuggestions] = useState<string[]>([]);

  /* ── Payment ── */
  const [collectNow, setCollectNow] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('Cash');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);

  /* ── Post-save state for receipt printing ── */
  const [savedInvoiceNo, setSavedInvoiceNo] = useState('');
  const [saved, setSaved] = useState(false);

  /* ── Load fee matrix + already-charged one-time fees ── */
  useEffect(() => {
    fetchFeeItems();
  }, [userRole?.school_id]);

  const fetchFeeItems = async () => {
    const { data } = await supabase
      .from('form_settings')
      .select('sections_config')
      .eq('school_id', userRole?.school_id)
      .eq('form_name', 'fee_item_names')
      .maybeSingle();
    if (data?.sections_config) {
      const { recurring = [], onetime = [] } = data.sections_config;
      setFeeItemSuggestions([...new Set([...recurring, ...onetime])]);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // Fetch school info
        const { data: school } = await supabase
          .from('schools').select('name, logo_url, address').eq('id', userRole?.school_id).maybeSingle();
        if (school?.name) setSchoolName(school.name);
        if (school?.logo_url) setSchoolLogo(school.logo_url);
        if (school?.address) setSchoolAddress(school.address);

        // Fetch fee structure for this class
        const { data: fs } = await supabase
          .from('fee_structures')
          .select('fee_matrix, amount')
          .eq('school_id', userRole?.school_id)
          .eq('class_id', student.class_id || '')
          .maybeSingle();

        // Student override takes priority over class fee_matrix
        const studentOverride = student.fee_override as any;
        const matrix = studentOverride || (fs?.fee_matrix as any);
        const waiver = (student.fee_waiver_percentage || 0) / 100;
        const feeStructureMissing = !studentOverride && !fs;
        setNoFeeStructure(feeStructureMissing);

        // Fetch all fee_records for this student:
        //  - detect already-charged one-time fees
        //  - calculate previous pending/partial/overdue balance (arrears)
        const { data: existingRecords } = await supabase
          .from('fee_records')
          .select('breakdown, total_amount, paid_amount, status, month_year')
          .eq('student_id', student.id)
          .eq('school_id', userRole?.school_id)
          .is('deleted_at', null);   // exclude soft-deleted records (e.g. cleared MIG- arrears)

        const chargedLabels = new Set<string>();
        let arrearsTotal = 0;

        (existingRecords || []).forEach((rec: any) => {
          // one-time charge detection
          (rec.breakdown || []).forEach((b: any) => {
            if (b.item && !b.is_arrears) chargedLabels.add(b.item.toLowerCase().trim());
          });
          // accumulate unpaid balance from previous months only
          if (['pending', 'partial', 'overdue'].includes(rec.status)) {
            const balance = Math.max(0, (rec.total_amount || 0) - (rec.paid_amount || 0));
            arrearsTotal += balance;
          }
        });

        const built: FeeRow[] = [];
        let idx = 0;

        // Recurrent (monthly) fees
        const recurrent: any[] = matrix?.recurrent?.length
          ? matrix.recurrent
          : [{ item: 'Monthly Tuition Fee', amount: fs?.amount || 0 }];

        recurrent.forEach((r: any) => {
          built.push({
            id: `rec-${idx++}`,
            label: r.item,
            baseAmount: Number(r.amount) || 0, // Keep Gross
            isOneTime: false,
            isArrears: false,
            include: true,
            discountType: 'pct',               // Default to percentage waiver
            discountVal: Math.round(waiver * 100), // The student's waiver
            alreadyCharged: false,
          });
        });

        // One-time (admission) fees
        if (matrix?.first_time?.length) {
          matrix.first_time.forEach((f: any) => {
            const already = chargedLabels.has(f.item.toLowerCase().trim());
            built.push({
              id: `ot-${idx++}`,
              label: f.item,
              baseAmount: +f.amount,
              isOneTime: true,
              isArrears: false,
              include: includeAdmissionFees && !already,
              discountType: 'fixed',
              discountVal: 0,
              alreadyCharged: already,
            });
          });
        }

        // Previous unpaid balance (arrears) — shown UNCHECKED by default.
        // Including it in the new invoice would create a NEW billing entry for
        // the same debt that already exists in older fee_records → double-counts
        // the outstanding balance. Admins can manually check it only when they
        // intend to consolidate old dues into this invoice AND manually void/close
        // the originating records in Student Ledger.
        if (arrearsTotal > 0) {
          built.push({
            id: 'arrears',
            label: 'Previous Balance (Arrears)',
            baseAmount: arrearsTotal,
            isOneTime: false,
            isArrears: true,
            include: false,   // ← OFF by default to prevent double-counting
            discountType: 'fixed',
            discountVal: 0,
            alreadyCharged: false,
          });
        }

        const finalRows = built.length ? built : [{
          id: 'default',
          label: 'Monthly Tuition Fee',
          baseAmount: 0,
          isOneTime: false,
          isArrears: false,
          include: true,
          discountType: 'fixed' as const,
          discountVal: 0,
          alreadyCharged: false,
        }];
        setHasZeroAmounts(finalRows.some(r => !r.alreadyCharged && !r.isArrears && r.baseAmount === 0));
        setRows(finalRows);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [student.id, student.class_id, student.fee_waiver_percentage, userRole?.school_id, includeAdmissionFees]);

  /* ── Derived totals ── */
  const activeRows = rows.filter(r => r.include && !r.alreadyCharged);
  const subtotal = activeRows.reduce((s, r) => s + r.baseAmount, 0);
  const totalDiscount = activeRows.reduce((s, r) => s + rowDiscountAmt(r), 0);
  const total = activeRows.reduce((s, r) => s + rowNet(r), 0);
  const payNum = Math.min(Number(payAmount) || 0, total);
  const remaining = total - payNum;
  const payStatus: 'paid' | 'partial' | 'pending' =
    payNum <= 0 ? 'pending' : payNum >= total ? 'paid' : 'partial';

  /* ── Row update helpers ── */
  const toggleRow = (id: string) =>
    setRows(p => p.map(r => r.id === id ? { ...r, include: !r.include } : r));
  const updateRow = <K extends keyof FeeRow>(id: string, field: K, val: FeeRow[K]) => {
    setRows(p => {
      const next = p.map(r => r.id === id ? { ...r, [field]: val } : r);
      setHasZeroAmounts(next.some(r => r.include && !r.alreadyCharged && !r.isArrears && r.baseAmount === 0));
      return next;
    });
  };
  const addCustomRow = () => {
    const id = `custom-${Date.now()}`;
    setRows(p => [...p, {
      id, label: 'Custom Fee', baseAmount: 0, isOneTime: false, isArrears: false,
      include: true, discountType: 'fixed', discountVal: 0, alreadyCharged: false,
    }]);
    setHasZeroAmounts(true);
  };
  const removeRow = (id: string) =>
    setRows(p => {
      const next = p.filter(r => r.id !== id);
      setHasZeroAmounts(next.some(r => r.include && !r.alreadyCharged && r.baseAmount === 0));
      return next;
    });

  /* ── Sync hasZeroAmounts when rows change externally ── */

  /* ── Build school info for challan ── */
  const getSchoolInfo = useCallback((): SchoolInfo => ({
    name: schoolName,
    address: schoolAddress || undefined,
    logo_url: schoolLogo || undefined,
  }), [schoolName, schoolAddress, schoolLogo]);

  /* ── Save ── */
  const handleSave = async (andPrint = false) => {
    if (!rows.some(r => r.include && !r.alreadyCharged)) {
      setError('Select at least one fee item.'); return;
    }
    if (total <= 0) {
      setError('All fee amounts are Rs. 0. Please enter amounts in the fee table above.'); return;
    }
    if (collectNow && payNum <= 0) {
      setError('Enter a valid payment amount.'); return;
    }
    setSaving(true);
    setError('');
    try {
      const sid = userRole!.school_id;
      const today = new Date().toISOString().split('T')[0];
      const invoiceNo = genInvoiceNo(monthYear, student.roll_number);

      // Store GROSS amounts in breakdown (consistent with MonthlyFeeInvoices bulk-generate).
      // Discount is stored separately in discount_amount so the challan can display:
      //   Gross Fee → − Discount → Net Payable
      // Arrears rows store their net amount directly (no discount applies to them).
      const breakdown = activeRows.map(r => ({
        item: r.label,
        amount: r.isArrears ? r.baseAmount : r.baseAmount, // GROSS (same for arrears since no discount)
        ...(rowDiscountAmt(r) > 0 ? { discount: rowDiscountAmt(r), discount_type: r.discountType, discount_val: r.discountVal } : {}),
        is_one_time: r.isOneTime,
        ...(r.isArrears ? { is_arrears: true } : {}),
      }));
      const discountAmount = Math.round(totalDiscount); // explicit — prevents challan from re-computing

      // month_year DB column is DATE — input gives "YYYY-MM", DB needs "YYYY-MM-DD"
      const monthYearDate = monthYear.length === 7 ? `${monthYear}-01` : monthYear;

      const { data: recData, error: recErr } = await supabase.from('fee_records').insert([{
        school_id: sid,
        student_id: student.id,
        student_name: student.full_name,  // denormalized for quick display / challan
        month_year: monthYearDate,
        total_amount: total,            // net payable
        discount_amount: discountAmount, // explicit — 0 if no discount
        paid_amount: collectNow ? payNum : 0,
        status: collectNow ? payStatus : 'pending',
        due_date: dueDate,
        payment_mode: collectNow ? payMode : 'Pending',
        paid_at: collectNow ? payDate + 'T12:00:00Z' : null,
        breakdown,
        invoice_number: invoiceNo,
        remarks: remarks || null,
      }]).select('id').maybeSingle();
      if (recErr) throw recErr;

      if (collectNow && payNum > 0) {
        // Scale breakdown items proportionally to actual net collected amount
        // so P&L fee-type breakdown sums to real revenue (not inflated gross).
        const grossTotal = breakdown.reduce((s: number, b: any) => s + Number(b.amount || 0), 0);
        const scaledItems = grossTotal > 0 && breakdown.length > 0
          ? breakdown.map((b: any) => ({
              item: b.item,
              amount: Math.round((Number(b.amount) / grossTotal) * payNum),
            }))
          : [{ item: 'Fee Collection', amount: payNum }];

        const { error: txErr } = await supabase.from('financial_transactions').insert([{
          school_id: sid,
          type: 'income',
          category: 'Fee Collection',
          amount: payNum,
          date: payDate,
          payment_mode: payMode,
          remarks: `Fee — ${student.full_name} (${monthYear}) · ${invoiceNo}`,
          fee_record_id: recData?.id ?? null,
          fee_items: scaledItems,  // proportional net amounts — sum equals payNum
        }]);
        if (txErr) throw txErr;
      }

      setSavedInvoiceNo(invoiceNo);
      setSaved(true);

      if (andPrint) {
        const monthYearDate = monthYear.length === 7 ? `${monthYear}-01` : monthYear;
        const record = buildChallanRecord({
          invoiceNo,
          student,
          monthYearDate,
          dueDate,
          activeRows,
          total,
          paid: collectNow ? payNum : 0,
          status: collectNow ? payStatus : 'pending',
          totalDiscount,
          today,
        });
        downloadChallanPDF([record], getSchoolInfo(), DEFAULT_CHALLAN_CONFIG);
      }

      onSave();
    } catch (err: any) {
      setError(err.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handlePrintPreview = () => {
    const invoiceNo = savedInvoiceNo || genInvoiceNo(monthYear, student.roll_number);
    const today = new Date().toISOString().split('T')[0];
    const monthYearDate = monthYear.length === 7 ? `${monthYear}-01` : monthYear;
    const record = buildChallanRecord({
      invoiceNo,
      student,
      monthYearDate,
      dueDate,
      activeRows,
      total,
      paid: collectNow && payNum > 0 ? payNum : 0,
      status: collectNow && payNum > 0 ? payStatus : 'pending',
      totalDiscount,
      today,
    });
    downloadChallanPDF([record], getSchoolInfo(), DEFAULT_CHALLAN_CONFIG);
  };

  /* ════════════════════════════════════════════════════════════════════════
     Render
  ════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[96vh] flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
              <Receipt className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-black text-base leading-none">Add Fee Invoice</h2>
              <p className="text-indigo-200 text-xs mt-0.5">{student.full_name}
                {(student as any).classes && ` · ${(student as any).classes.name} ${(student as any).classes.section || ''}`.trim()}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-56">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
          ) : (
            <div className="p-6 space-y-6">

              {/* Month + Due Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Fee Month</label>
                  <input type="month" value={monthYear} onChange={e => setMonthYear(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Due Date</label>
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              {/* ── No fee structure warning ── */}
              {noFeeStructure && (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-amber-800">No fee structure configured for this class</p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      Go to <strong>Settings → Fee Structures</strong> to set up class-wise fees.
                      You can still enter amounts manually below.
                    </p>
                  </div>
                </div>
              )}

              {/* ── Zero amounts warning ── */}
              {!noFeeStructure && hasZeroAmounts && (
                <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3">
                  <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-700">
                    Some fee amounts are <strong>Rs. 0</strong> — edit them directly in the table below or update the fee structure.
                  </p>
                </div>
              )}

              {/* ── Monthly Fee Heads ── */}
              <FeeSection
                title="Monthly Fees"
                subtitle="Applied every month"
                rows={rows.filter(r => !r.isOneTime && !r.isArrears)}
                onToggle={toggleRow}
                onUpdate={updateRow}
                onRemove={removeRow}
                suggestions={feeItemSuggestions}
              />

              {/* ── One-time Fee Heads ── */}
              {rows.some(r => r.isOneTime) && (
                <FeeSection
                  title="One-time Fees"
                  subtitle="Admission · Registration · Security (charged once)"
                  rows={rows.filter(r => r.isOneTime)}
                  onToggle={toggleRow}
                  onUpdate={updateRow}
                  onRemove={removeRow}
                  suggestions={feeItemSuggestions}
                />
              )}

              {/* ── Previous Arrears ── */}
              {rows.some(r => r.isArrears) && (
                <div>
                  <div className="mb-3">
                    <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Previous Balance (Arrears)</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Rs. {rows.find(r => r.isArrears)!.baseAmount.toLocaleString()} outstanding from prior invoices ·
                      use <strong>Student Ledgers</strong> to collect against individual months
                    </p>
                  </div>
                  <div className="border border-orange-200 rounded-2xl overflow-hidden bg-orange-50/50">
                    {rows.filter(r => r.isArrears).map(row => (
                      <div key={row.id} className="px-4 py-3 space-y-2">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => toggleRow(row.id)}
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition shrink-0
                                ${row.include ? 'bg-orange-500 border-orange-500' : 'border-slate-300 bg-white'}`}>
                              {row.include && <CheckCircle className="w-3 h-3 text-white" />}
                            </button>
                            <span className="text-sm font-semibold text-orange-800">{row.label}</span>
                          </div>
                          <span className="text-sm font-black text-orange-700 shrink-0">
                            Rs. {row.baseAmount.toLocaleString()}
                          </span>
                        </div>
                        {row.include && (
                          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 ml-7">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-[10px] text-amber-700 leading-relaxed">
                              <strong>Consolidation warning:</strong> This will add the arrears to the new invoice total.
                              The original pending invoices still exist — manually mark them paid in <strong>Student Ledgers</strong> after collection to avoid double-counting in outstanding balance.
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Add custom fee row ── */}
              <button type="button" onClick={addCustomRow}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition">
                <span className="text-base leading-none">+</span> Add custom fee item
              </button>

              {/* Remarks */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Remarks (optional)</label>
                <input value={remarks} onChange={e => setRemarks(e.target.value)}
                  placeholder="e.g. Admission month fee"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>

              {/* ── Totals ── */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-bold">Rs. {subtotal.toLocaleString()}</span>
                </div>
                {totalDiscount > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600">
                    <span>Total Discount</span>
                    <span className="font-bold">– Rs. {totalDiscount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-black text-indigo-700 border-t border-indigo-200 pt-2 mt-1">
                  <span>Total Due</span>
                  <span>Rs. {total.toLocaleString()}</span>
                </div>
              </div>

              {/* ── Collect Now ── */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <button type="button" onClick={() => setCollectNow(p => !p)}
                  className={`w-full flex items-center justify-between px-5 py-4 transition ${collectNow ? 'bg-emerald-50' : 'bg-white hover:bg-slate-50'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition
                      ${collectNow ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300'}`}>
                      {collectNow && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-slate-800">Collect Payment Now</p>
                      <p className="text-xs text-slate-500">Posts to Ledger, Day Book & P&L immediately</p>
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${collectNow ? 'rotate-180' : ''}`} />
                </button>

                {collectNow && (
                  <div className="px-5 pb-5 pt-4 bg-emerald-50 border-t border-emerald-100 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Amount Paid (Rs.)</label>
                        <input type="number" min="1" step="0.01" max={total}
                          value={payAmount} onChange={e => setPayAmount(e.target.value)}
                          placeholder={String(total)}
                          className="w-full px-4 py-2.5 border border-emerald-200 bg-white rounded-xl text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Payment Mode</label>
                        <select value={payMode} onChange={e => setPayMode(e.target.value)}
                          className="w-full px-4 py-2.5 border border-emerald-200 bg-white rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500">
                          {PAY_MODES.map(m => <option key={m}>{m}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Payment Date</label>
                        <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
                          className="w-full px-4 py-2.5 border border-emerald-200 bg-white rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      </div>
                    </div>

                    {payNum > 0 && (
                      <div className={`rounded-xl px-4 py-3 flex items-center justify-between border
                        ${payStatus === 'paid' ? 'bg-emerald-100 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                        <span className="text-xs font-bold text-slate-600">
                          Status: <span className={`uppercase font-black ${payStatus === 'paid' ? 'text-emerald-700' : 'text-amber-700'}`}>{payStatus}</span>
                        </span>
                        {remaining > 0 && <span className="text-xs font-bold text-amber-700">Balance: Rs. {remaining.toLocaleString()}</span>}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button type="button" onClick={handlePrintPreview}
              className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl text-sm font-bold transition">
              <Printer className="w-4 h-4" />
              Preview
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-800 transition">
              Cancel
            </button>
            {(student.fee_waiver_percentage ?? 0) >= 100 ? (
              <div className="bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                  <BadgeCheck className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest leading-none">Free Student Account</p>
                  <p className="text-[9px] text-emerald-600 font-bold opacity-70 mt-0.5">100% Waiver Applied · No Billable heads</p>
                </div>
              </div>
            ) : (
              <>
                {collectNow && (
                  <button type="button" onClick={() => handleSave(true)}
                    disabled={saving || loading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-black transition">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <BadgeCheck className="w-4 h-4" />}
                    Collect & Print Receipt
                  </button>
                )}
                <button type="button" onClick={() => handleSave(false)}
                  disabled={saving || loading}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-black transition">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}
                  {collectNow ? 'Collect' : 'Generate Invoice'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── FeeSection sub-component ─────────────────────────────────────────── */
function FeeSection({
  title, subtitle, rows, onToggle, onUpdate, onRemove, suggestions,
}: {
  title: string;
  subtitle: string;
  rows: FeeRow[];
  onToggle: (id: string) => void;
  onUpdate: <K extends keyof FeeRow>(id: string, f: K, v: FeeRow[K]) => void;
  onRemove: (id: string) => void;
  suggestions: string[];
}) {
  if (!rows.length) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{title}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>
        </div>
      </div>

      <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
        {/* Header */}
        <div className="grid grid-cols-12 gap-1 px-3 py-2 bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest">
          <div className="col-span-1"></div>
          <div className="col-span-3">Fee Head</div>
          <div className="col-span-2">Amount (Rs.)</div>
          <div className="col-span-2">Disc. Type</div>
          <div className="col-span-2">Discount</div>
          <div className="col-span-1 text-right">Net</div>
          <div className="col-span-1"></div>
        </div>

        {rows.map(row => {
          const net = rowNet(row);
          const disabled = row.alreadyCharged;
          const isCustom = row.id.startsWith('custom-');

          return (
            <div key={row.id} className={`grid grid-cols-12 gap-1 px-3 py-2.5 items-center
              ${disabled ? 'opacity-50 bg-slate-50' : row.include ? 'bg-white' : 'bg-slate-50/50'}`}>

              {/* Checkbox */}
              <div className="col-span-1">
                <button type="button" onClick={() => !disabled && onToggle(row.id)}
                  disabled={disabled}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition
                    ${row.include && !disabled ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                  {row.include && !disabled && <CheckCircle className="w-3 h-3 text-white" />}
                </button>
              </div>

              {/* Label — editable for custom rows */}
              <div className="col-span-3 flex items-center gap-1.5 min-w-0">
                <div className="w-full relative">
                  <input
                    value={row.label}
                    onChange={e => onUpdate(row.id, 'label', e.target.value)}
                    disabled={disabled}
                    list={`fee-suggestions-${row.id}`}
                    placeholder="Fee head name"
                    className={cn(
                      "w-full px-2 py-1 border rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500",
                      isCustom ? "border-indigo-200 bg-indigo-50" : "border-transparent bg-transparent"
                    )}
                  />
                  <datalist id={`fee-suggestions-${row.id}`}>
                    {suggestions.map(s => <option key={s} value={s} />)}
                  </datalist>
                </div>
                {disabled && (
                  <span className="shrink-0 inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
                    <Info className="w-2.5 h-2.5" /> Charged
                  </span>
                )}
              </div>

              {/* Base amount — editable */}
              <div className="col-span-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={row.baseAmount || 0}
                  onFocus={e => e.target.select()}
                  onChange={e => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    onUpdate(row.id, 'baseAmount', Number(val) || 0);
                  }}
                  disabled={disabled}
                  placeholder="0"
                  className={cn(
                    "w-full px-2 py-1 border rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-40 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                    row.baseAmount === 0 && row.include && !disabled 
                      ? "border-amber-300 bg-amber-50 text-amber-700 placeholder-amber-400" 
                      : "border-slate-200 bg-white"
                  )}
                />
              </div>

              {/* Discount type */}
              <div className="col-span-2">
                <select
                  value={row.discountType}
                  onChange={e => onUpdate(row.id, 'discountType', e.target.value as 'pct' | 'fixed')}
                  disabled={!row.include || disabled}
                  className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-40"
                >
                  <option value="fixed">Rs. Fixed</option>
                  <option value="pct">% Percent</option>
                </select>
              </div>

              <div className="col-span-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={row.discountVal || 0}
                  onFocus={e => e.target.select()}
                  onChange={e => {
                    const val = e.target.value.replace(/[^0-9.]/g, '');
                    onUpdate(row.id, 'discountVal', Number(val) || 0);
                  }}
                  disabled={!row.include || disabled}
                  placeholder="0"
                  className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-40 bg-white"
                />
              </div>

              {/* Net */}
              <div className={`col-span-1 text-right text-sm font-black ${net > 0 ? 'text-indigo-700' : 'text-slate-300'}`}>
                {row.include && !disabled ? net.toLocaleString() : '—'}
              </div>

              {/* Remove button (custom rows only) */}
              <div className="col-span-1 flex justify-end">
                {isCustom && (
                  <button type="button" onClick={() => onRemove(row.id)}
                    className="w-5 h-5 rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
