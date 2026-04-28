import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Receipt, Search, PlusCircle, MessageCircle, Edit,
  Calendar, CheckSquare, Square, Save, X, Printer, Users,
  Layout, TrendingUp, AlertCircle, FileText, CheckCircle2,
  Clock, Filter, Download, Trash2, Send, Bell
} from 'lucide-react';
import FeeBreakdownEditor, { type BreakdownRow } from '../../components/FeeBreakdownEditor';
import HelpBanner from '../../components/HelpBanner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { downloadChallanPDF, DEFAULT_CHALLAN_CONFIG, ChallanConfig, ChallanRecord, SchoolInfo } from '../../lib/challanUtils';
import * as templatesLib from '../../lib/whatsappTemplates';

export default function MonthlyFeeInvoices() {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classes, setClasses] = useState<any[]>([]);
  const [classFilter, setClassFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [school, setSchool] = useState<SchoolInfo>({ name: '' });
  const [challanConfig, setChallanConfig] = useState<ChallanConfig>(DEFAULT_CHALLAN_CONFIG);
  const [feeItemSuggestions, setFeeItemSuggestions] = useState<string[]>([]);
  const [groupByFamily, setGroupByFamily] = useState(false);

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateMonth, setGenerateMonth] = useState('');
  const [generateDueDate, setGenerateDueDate] = useState('');
  const [includeAdmissionFee, setIncludeAdmissionFee] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genMode, setGenMode] = useState<'all' | 'class' | 'student'>('all');
  const [targetClass, setTargetClass] = useState('');
  const [targetStudent, setTargetStudent] = useState<any>(null);
  const [stuQuery, setStuQuery] = useState('');
  const [stuResults, setStuResults] = useState<any[]>([]);

  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [bulkDueDate, setBulkDueDate] = useState('');
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [batchPrinting, setBatchPrinting] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);

  useEffect(() => {
    if (userRole?.school_id) {
      fetchInvoices();
      fetchClasses();
      fetchSchool();
      fetchChallanConfig();
      fetchFeeItems();
    }
  }, [userRole]);

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
    } else {
      // Default suggestions if library not yet configured
      setFeeItemSuggestions([
        'Tuition Fee', 'Computer Lab Fee', 'Sports Fee', 'Library Fee',
        'Transport Fee', 'Utility Fee', 'Admission Fee', 'Registration Fee',
        'Security Deposit', 'Examination Fee',
      ]);
    }
  };

  const fetchSchool = async () => {
    const { data } = await supabase
      .from('schools')
      .select('name, address, contact_phone, logo_url')
      .eq('id', userRole?.school_id)
      .maybeSingle();
    
    if (data) {
      if (data.logo_url && !data.logo_url.startsWith('http')) {
        const { data: publicURL } = supabase.storage.from('logos').getPublicUrl(data.logo_url);
        data.logo_url = publicURL.publicUrl;
      }
      setSchool(data);
    }
  };

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('id, name, section').eq('school_id', userRole?.school_id).order('name');
    if (data) setClasses(data);
  };

  const fetchChallanConfig = async () => {
    const { data } = await supabase.from('form_settings').select('sections_config').eq('school_id', userRole?.school_id).eq('form_name', 'challan_settings').maybeSingle();
    if (data?.sections_config) setChallanConfig({ ...DEFAULT_CHALLAN_CONFIG, ...data.sections_config });
  };

  const fetchInvoices = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('fee_records')
      .select('*, students(id, full_name, roll_number, class_id, family_group_id, fee_waiver_percentage, classes(name, section), parents(whatsapp_number, father_name, family_number))')
      .eq('school_id', userRole?.school_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (data) setInvoices(data);
    setLoading(false);
  };

  const handleMassGenerate = async () => {
    if (!generateMonth || !generateDueDate) return alert('Please select Month and Due Date');
    setGenerating(true);
    try {
      const { data: structures } = await supabase.from('fee_structures').select('*').eq('school_id', userRole?.school_id);
      
      let studentsQuery = supabase.from('students')
        .select('*')
        .eq('school_id', userRole?.school_id)
        .eq('status', 'active')
        .lt('fee_waiver_percentage', 100);

      if (genMode === 'class' && targetClass) {
        studentsQuery = studentsQuery.eq('class_id', targetClass);
      } else if (genMode === 'student' && targetStudent) {
        studentsQuery = studentsQuery.eq('id', targetStudent.id);
      }

      const { data: students } = await studentsQuery;

      if (!students || students.length === 0) throw new Error('No billable students found for current selection.');

      // Duplicate Check: Fetch existing records for this month
      const monthYear = generateMonth + '-01';
      const { data: existing } = await supabase.from('fee_records').select('student_id').eq('school_id', userRole?.school_id).eq('month_year', monthYear).is('deleted_at', null);
      const existingIds = new Set(existing?.map(e => e.student_id) || []);

      const billableStudents = students.filter(s => !existingIds.has(s.id));

      if (billableStudents.length === 0) {
        throw new Error('All students in this selection already have invoices generated for this month.');
      }

      const allInserts = billableStudents.map(student => {
        const structure = structures?.find(s => s.class_id === student.class_id);
        const matrix = structure?.fee_matrix;
        // Store ORIGINAL (gross) amounts in breakdown — discount is stored separately
        // so the challan prints: Original Fee → Discount → Net Payable
        let breakdown: any[] = [];
        let grossTotal = 0;
        const waiverDec = (student.fee_waiver_percentage || 0) / 100;

        if (matrix?.recurrent?.length) {
          matrix.recurrent.forEach((r: any) => {
            breakdown.push({ item: r.item, amount: Number(r.amount) }); // gross
            grossTotal += Number(r.amount);
          });
        } else if (structure?.amount) {
          breakdown.push({ item: 'Monthly Tuition Fee', amount: Number(structure.amount) }); // gross
          grossTotal = Number(structure.amount);
        }

        if (includeAdmissionFee && matrix?.first_time?.length) {
          matrix.first_time.forEach((f: any) => {
            breakdown.push({ item: f.item, amount: f.amount });
            grossTotal += f.amount;
          });
        }

        // discount_amount is the waiver applied to recurring fees only (not one-time admission fees)
        const recurringGross = matrix?.recurrent?.length
          ? matrix.recurrent.reduce((s: number, r: any) => s + Number(r.amount), 0)
          : (structure?.amount ? Number(structure.amount) : 0);
        const discountAmount = Math.round(recurringGross * waiverDec);
        const netTotal = grossTotal - discountAmount; // what student actually owes

        return {
          school_id: userRole?.school_id,
          student_id: student.id,
          student_name: student.full_name,
          month_year: generateMonth + '-01',
          total_amount: netTotal,       // net payable — used for payment tracking
          discount_amount: discountAmount, // explicit discount — used by challan for display
          paid_amount: 0,
          status: 'pending',
          due_date: generateDueDate,
          payment_mode: 'Pending',
          breakdown,                    // gross amounts — challan header shows these
          invoice_number: `INV-${generateMonth.replace('-', '').slice(2)}-${String(student.roll_number || 0).padStart(3, '0')}`,
          no_structure: !structure,
        };
      });

      // Separate zero-total students (no fee structure configured)
      const inserts = allInserts.filter(i => i.total_amount > 0).map(({ no_structure, student_name, ...rest }) => rest);
      const skippedCount = allInserts.filter(i => i.total_amount === 0).length;

      if (inserts.length === 0) {
        throw new Error('No invoices could be generated — fee structures are missing for all selected students. Configure fee structures in Settings first.');
      }

      const { error } = await supabase.from('fee_records').insert(inserts);
      if (error) throw error;

      const skippedMsg = skippedCount > 0
        ? `\n⚠️ ${skippedCount} student(s) skipped — no fee structure configured for their class.`
        : '';
      alert(`✅ Successfully generated ${inserts.length} invoice(s)!${skippedMsg}`);
      setShowGenerateModal(false);
      fetchInvoices();
    } catch (err: any) { alert(err.message || 'Error generating invoices'); } 
    finally { setGenerating(false); }
  };

  const executeBulkDateChange = async () => {
    if (!bulkDueDate || selectedInvoices.size === 0) return;
    try {
      const { error } = await supabase.from('fee_records').update({ due_date: bulkDueDate }).in('id', Array.from(selectedInvoices));
      if (error) throw error;
      alert(`Due Date changed for ${selectedInvoices.size} invoices!`);
      setShowBulkEdit(false);
      setSelectedInvoices(new Set());
      fetchInvoices();
    } catch (err: any) { alert(err.message); }
  };

  const handleDeleteInvoice = async (id: string) => {
    if (!confirm('Are you sure you want to delete this invoice? This will remove it from the records.')) return;
    try {
      const { error } = await supabase.from('fee_records').update({ deleted_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      fetchInvoices();
    } catch (err: any) { alert(err.message); }
  };

  const handleBulkDelete = async () => {
    if (selectedInvoices.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedInvoices.size} selected invoices?`)) return;
    try {
      const { error } = await supabase.from('fee_records')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', Array.from(selectedInvoices));
      if (error) throw error;
      alert(`Successfully deleted ${selectedInvoices.size} invoices.`);
      setSelectedInvoices(new Set());
      fetchInvoices();
    } catch (err: any) { alert(err.message); }
  };

  const handleSendWhatsApp = async (invoice: any) => {
    const parentPhone = invoice.students?.parents?.whatsapp_number;
    if (!parentPhone) return alert('No WhatsApp number found for this student\'s parent.');
    const balance = (invoice.total_amount || 0) - (invoice.paid_amount || 0);
    const dueDate = invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'N/A';
    
    const isOverdue = invoice.due_date && new Date(invoice.due_date) < new Date();
    const templateFn = isOverdue ? templatesLib.overdueFeeTemplate : templatesLib.feeDueTemplate;
    
    const msg = templateFn({
      studentName: invoice.students?.full_name,
      className: invoice.students?.classes ? `${invoice.students.classes.name} ${invoice.students.classes.section}` : '',
      invoiceNumber: invoice.invoice_number || invoice.id.substring(0, 10),
      balance: balance,
      dueDate: dueDate,
      month: invoice.month_year ? new Date(invoice.month_year).toLocaleString('default', { month: 'long' }) : '',
      schoolName: school.name
    });
    await supabase.from('communication_logs').insert([{ school_id: userRole?.school_id, recipient_number: parentPhone, message_content: msg, channel: 'whatsapp', status: 'sent' }]);
    templatesLib.openWhatsApp(parentPhone, msg);
  };

  const handleBulkOverdueReminders = async () => {
    const overdueInvoices = invoices.filter(inv => selectedInvoices.has(inv.id) && inv.status !== 'paid' && inv.due_date && new Date(inv.due_date) < new Date());
    
    if (overdueInvoices.length === 0) {
      return alert('No overdue invoices found in your selection. Reminders are specifically for accounts past their deadline.');
    }

    if (!confirm(`Initialize mass communication for ${overdueInvoices.length} overdue artifacts? (Browser may require popup permission for multiple tabs)`)) return;

    for (const inv of overdueInvoices) {
      await handleSendWhatsApp(inv);
      // Small delay to prevent browser blocking/spam filters
      await new Promise(r => setTimeout(r, 600));
    }
    setSelectedInvoices(new Set());
  };

  const buildRecord = async (inv: any): Promise<ChallanRecord> => {
    // 1. Previous pending balance
    const { data: prevFees } = await supabase
      .from('fee_records')
      .select('total_amount, paid_amount')
      .eq('school_id', userRole?.school_id)
      .eq('student_id', inv.student_id)
      .in('status', ['pending', 'overdue'])
      .is('deleted_at', null)
      .neq('id', inv.id)
      .lt('month_year', inv.month_year);
    const previousFee = (prevFees || []).reduce(
      (sum: number, r: any) => sum + Math.max(0, (r.total_amount || 0) - (r.paid_amount || 0)), 0
    );

    // 2. Class fee matrix — used for challan display and legacy-invoice fallback
    const classId = inv.students?.class_id;
    // New invoices: discount_amount is stored explicitly on the record.
    // Old invoices (created before this fix): discount_amount is null — reverse-engineer
    // from the fee structure by comparing original template total vs stored breakdown total.
    let discountAmount = inv.discount_amount ?? 0;
    let challanBreakdown: { item: string; amount: number }[] | null = null; // override for old invoices

    if (classId) {
      const { data: structure } = await supabase
        .from('fee_structures')
        .select('fee_matrix')
        .eq('school_id', userRole?.school_id)
        .eq('class_id', classId)
        .maybeSingle();
      if (structure?.fee_matrix) {
        const feeMatrix = structure.fee_matrix;

        // Fallback for old invoices: discount was baked into the breakdown amounts
        // (discount_amount stored as 0 or null). Detect by comparing fee structure
        // total vs invoice breakdown total — if there's a gap, that gap IS the discount.
        // Safe: computed > 0 guard ensures no-discount students (equal totals) are skipped.
        if (!inv.discount_amount) {
          const originalTotal = (feeMatrix!.recurrent || []).reduce(
            (s: number, i: any) => s + Number(i.amount || 0), 0
          );
          const invoiceTotal = (inv.breakdown || []).reduce(
            (s: number, b: any) => s + Number(b.amount || 0), 0
          );
          const computed = Math.round(originalTotal - invoiceTotal);
          if (computed > 0) {
            discountAmount = computed;
            challanBreakdown = (feeMatrix!.recurrent || []).map(
              (r: any) => ({ item: r.item, amount: Number(r.amount) })
            );
          }
        }
      }
    }

    // Gross total for challan display — either overridden (old invoice) or from stored breakdown
    const effectiveBreakdown = challanBreakdown ?? (inv.breakdown || []);
    const grossTotal = effectiveBreakdown.reduce((s: number, b: any) => s + Number(b.amount || 0), 0)
      || inv.total_amount;

    // 3. Fine rules — calculate actual fine based on today vs due date
    const { data: fineSetting } = await supabase
      .from('form_settings')
      .select('sections_config')
      .eq('school_id', userRole?.school_id)
      .eq('form_name', 'fine_policy')
      .maybeSingle();
    const fineRules: any[] = fineSetting?.sections_config?.rules ?? [];

    let fineAmount = 0;
    if (inv.due_date && inv.status !== 'paid' && fineRules.length > 0) {
      const dueDate = new Date(inv.due_date); dueDate.setHours(0, 0, 0, 0);
      const today   = new Date();             today.setHours(0, 0, 0, 0);

      // If already overdue → use actual days late
      // If still within due → project fine for 1 day after due date (so challan shows what will be charged)
      const daysLate = today > dueDate
        ? Math.ceil((today.getTime() - dueDate.getTime()) / 86400000)
        : 1; // projected: 1 day after due

      fineRules.forEach((rule: any) => {
        const graceDays = rule.grace_days || 0;
        if (daysLate <= graceDays) return;            // still within grace
        const eff = daysLate - graceDays;
        if      (rule.type === 'flat')       fineAmount += rule.amount;
        else if (rule.type === 'per_day')    fineAmount += rule.amount * eff;
        else if (rule.type === 'percentage') fineAmount += (inv.total_amount * rule.amount) / 100;
      });
      fineAmount = Math.round(fineAmount);
    }

    return {
      ...inv,
      breakdown: effectiveBreakdown,  // gross amounts (original or overridden for old invoices)
      total_amount: grossTotal,       // gross — challanUtils subtracts discountAmount from this
      student_name: inv.students?.full_name,
      roll_number: inv.students?.roll_number,
      class_name: inv.students?.classes
        ? `${inv.students.classes.name || ''}${inv.students.classes.section ? ' - ' + inv.students.classes.section : ''}`
        : '',
      father_name: inv.students?.parents?.father_name || '',
      family_number: inv.students?.parents?.family_number || '',
      issue_date: inv.created_at,
      previous_fee: previousFee,
      fine_amount: fineAmount,
      discount_amount: discountAmount,
      fine_rules: fineRules,
      fee_waiver_percentage: inv.students?.fee_waiver_percentage ?? 0,
    };
  };

  const handlePrintChallan = async (invoice: any) => {
    const record = await buildRecord(invoice);
    await downloadChallanPDF([record], school, challanConfig, { autoPrint: true, download: true });
  };

  const handlePrintFamilyChallan = async (famGroup: any) => {
    // Collect all sub-invoices and build their records
    const records = await Promise.all(famGroup.invoices.map(buildRecord));
    await downloadChallanPDF(records, school, challanConfig, { 
      filenameOverride: `family-challan-${famGroup.name.replace(/\s+/g, '-')}.pdf`,
      autoPrint: true,
      download: true 
    });
  };

  const handleBatchClassPrint = async () => {
    if (!classFilter || !monthFilter) return alert('Please select both a Class and a Month to print class challans.');
    setBatchPrinting(true);
    try {
      // Use already-filtered list (client-side filtered by classFilter + monthFilter)
      const filtered = filteredInvoices;
      if (!filtered.length) { alert('No invoices found for the selected class and month.'); return; }
      const records: ChallanRecord[] = await Promise.all(filtered.map(buildRecord));
      const selectedClass = classes.find(c => c.id === classFilter);
      const label = `class-${selectedClass?.name || 'all'}-${monthFilter}`;
      await downloadChallanPDF(records, school, challanConfig, `challans-${label}.pdf`);
    } catch (err: any) { alert(err.message || 'Failed to generate batch challans.'); }
    finally { setBatchPrinting(false); }
  };

  const handleSaveInvoiceEdit = async () => {
    try {
      // Re-derive total_amount from breakdown so it stays in sync
      const breakdown = editingInvoice.breakdown || [];
      const derivedTotal = breakdown.length > 0
        ? breakdown.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0)
        : editingInvoice.total_amount;

      const { error } = await supabase.from('fee_records').update({
        total_amount: derivedTotal,
        due_date: editingInvoice.due_date,
        breakdown,
      }).eq('id', editingInvoice.id);
      if (error) throw error;
      setEditingInvoice(null);
      fetchInvoices();
    } catch (err: any) { alert(err.message); }
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchSearch = !search || inv.students?.full_name?.toLowerCase().includes(search.toLowerCase()) || inv.invoice_number?.toLowerCase().includes(search.toLowerCase());
    const matchClass = !classFilter || inv.students?.class_id === classFilter;
    const matchMonth = !monthFilter || inv.month_year?.startsWith(monthFilter);
    return matchSearch && matchClass && matchMonth;
  });

  // Grouping logic for Family view
  const familyGroupedInvoices = React.useMemo(() => {
    if (!groupByFamily) return null;
    const groups = new Map<string, any>();
    filteredInvoices.forEach(inv => {
      const familyId = inv.students?.family_group_id || 'unlinked';
      const familyName = inv.students?.parents?.father_name ? `${inv.students.parents.father_name}'s Family` : 'Individual Records';
      
      if (!groups.has(familyId)) {
        groups.set(familyId, {
          id: familyId,
          type: 'family',
          name: familyName,
          count: 0,
          total_amount: 0,
          paid_amount: 0,
          invoices: [],
          month_year: inv.month_year,
          status: 'pending'
        });
      }
      const g = groups.get(familyId);
      g.count++;
      g.total_amount += Number(inv.total_amount);
      g.paid_amount += Number(inv.paid_amount || 0);
      g.balance = g.total_amount - g.paid_amount;
      g.invoices.push(inv);
      if (inv.status === 'paid' && g.status !== 'overdue') g.status = 'paid';
      if (inv.status === 'overdue') g.status = 'overdue';
    });
    return Array.from(groups.values());
  }, [filteredInvoices, groupByFamily]);

  const FEE_ITEMS_PER_PAGE = 30;
  const [feeCurrentPage, setFeeCurrentPage] = useState(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => { setFeeCurrentPage(1); }, [search, classFilter, monthFilter, groupByFamily]);

  const displayList = groupByFamily ? (familyGroupedInvoices || []) : filteredInvoices;
  const feeTotalPages = Math.ceil(displayList.length / FEE_ITEMS_PER_PAGE);
  const paginatedDisplayList = displayList.slice((feeCurrentPage - 1) * FEE_ITEMS_PER_PAGE, feeCurrentPage * FEE_ITEMS_PER_PAGE);

  const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.paid_amount || 0), 0);
  const totalPending = invoices.filter(i => i.status !== 'paid').reduce((sum, i) => sum + (i.total_amount - i.paid_amount), 0);
  const collectionRate = invoices.length > 0 ? (invoices.filter(i => i.status === 'paid').length / invoices.length) * 100 : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-4 pb-20">

      {/* Onboarding Help */}
      <HelpBanner
        storageKey="help_generate_invoices"
        title="How to Generate Invoices"
        color="indigo"
        steps={[
          'Select a Class and Month from the filters at the top.',
          'Click "Generate" to auto-create invoices for all students in that class using their fee template.',
          'Review the invoice list — each row shows total, paid, balance, and status.',
          'Print Challan for a single student, or use bulk actions to print the whole class.',
          'Click "Collect" on any invoice to record a payment directly from this screen.',
        ]}
        tip='Tip: Set up fee amounts first under Fee Management → Fee Templates before generating invoices.'
      />

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">Generate Invoices</h1>
          <p className="text-slate-500 text-xs font-medium mt-0.5">Bulk invoice creation & management by class and month</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setGroupByFamily(!groupByFamily)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition shadow-sm active:scale-95",
              groupByFamily ? "bg-indigo-600 text-white" : "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200"
            )}
          >
            <Users className="w-3.5 h-3.5" /> {groupByFamily ? 'By Family' : 'By Family'}
          </button>
          <button onClick={() => navigate('/fees/challan-settings')} className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition shadow-sm active:scale-95">
            <Layout className="w-3.5 h-3.5" /> Config
          </button>
          <button onClick={() => setShowGenerateModal(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-200 transition active:scale-95">
            <PlusCircle className="w-3.5 h-3.5" /> Generate
          </button>
        </div>
      </div>

      {/* Stats Row — compact inline cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Collected', value: `Rs. ${totalRevenue.toLocaleString()}`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
          { label: 'Outstanding', value: `Rs. ${totalPending.toLocaleString()}`, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50 border-rose-100' },
          { label: 'Collection Rate', value: `${collectionRate.toFixed(1)}%`, icon: CheckCircle2, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-100' },
          { label: 'Total Invoices', value: invoices.length, icon: FileText, color: 'text-slate-600', bg: 'bg-white border-slate-100' },
        ].map((stat) => (
          <div key={stat.label} className={cn('rounded-2xl border p-4 flex items-center gap-3', stat.bg)}>
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', stat.color, 'bg-white shadow-sm border border-current/10')}>
              <stat.icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none">{stat.label}</p>
              <p className={cn('text-lg font-black leading-tight mt-0.5', stat.color)}>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Command Bar */}
      <div className="aura-card p-3 flex flex-col sm:flex-row gap-3 items-center border-none shadow-xl shadow-slate-200/40">
        <div className="relative flex-1 group w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
          <input 
            type="text" 
            placeholder="Search by invoice # or student name..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-transparent rounded-2xl text-sm font-bold focus:bg-white focus:border-slate-100 focus:ring-4 focus:ring-indigo-100/50 transition-all outline-none" 
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="flex gap-0 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
            <select value={classFilter} onChange={e => setClassFilter(e.target.value)} className="bg-transparent border-none text-xs font-black uppercase tracking-widest text-slate-500 px-3 py-2 outline-none cursor-pointer">
              <option value="">All Classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
            </select>
            <div className="w-px bg-slate-200 my-1.5" />
            <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="bg-transparent border-none text-xs font-black uppercase tracking-widest text-slate-500 px-3 py-2 outline-none cursor-pointer" />
          </div>

          <button
            onClick={handleBatchClassPrint}
            disabled={batchPrinting || !classFilter || !monthFilter}
            title={!classFilter || !monthFilter ? 'Select a class and month first' : `Batch print ${filteredInvoices.length} challans`}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed",
              classFilter && monthFilter ? "bg-slate-900 hover:bg-black text-white shadow-lg" : "bg-slate-100 text-slate-400"
            )}
          >
            <Printer className="w-3.5 h-3.5" />
            {batchPrinting ? 'Printing…' : classFilter && monthFilter ? `Batch Print (${filteredInvoices.length})` : 'Batch Print'}
          </button>
        </div>
      </div>

      {/* Bulk Action Bar - Aura Style */}
      <AnimatePresence>
        {selectedInvoices.size > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="bg-indigo-600 rounded-2xl px-5 py-3 flex flex-col md:flex-row items-center justify-between shadow-xl shadow-indigo-200 text-white"
          >
            <div className="flex items-center gap-4 text-sm font-black uppercase tracking-widest">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <CheckSquare className="w-5 h-5 text-white" />
              </div>
              {selectedInvoices.size} Invoices Flagged for Modification
            </div>
            <div className="flex items-center gap-3 mt-4 md:mt-0">
               {!showBulkEdit ? (
                 <>
                   <button onClick={() => setShowBulkEdit(true)} className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-white/10 transition-all flex items-center gap-2">
                     <Calendar className="w-4 h-4" /> Reschedule Due Date
                   </button>
                   <button onClick={handleBulkOverdueReminders} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-emerald-100/50 border border-emerald-500/20">
                     <Bell className="w-4 h-4" /> Push Overdue Reminders
                   </button>
                   <button onClick={handleBulkDelete} className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-rose-100/50 border border-rose-500/20">
                     <Trash2 className="w-4 h-4" /> Wipe Selection
                   </button>
                 </>
               ) : (
                 <div className="flex items-center gap-2 bg-white/10 p-2 rounded-2xl border border-white/5">
                   <input type="date" value={bulkDueDate} onChange={e => setBulkDueDate(e.target.value)} className="bg-transparent border-none text-white text-xs font-black px-4 py-1 outline-none appearance-none" style={{ colorScheme: 'dark' }} />
                   <button onClick={executeBulkDateChange} className="bg-white text-indigo-600 px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-50 transition-all">Apply Change</button>
                   <button onClick={() => setShowBulkEdit(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all"><X className="w-5 h-5" /></button>
                 </div>
               )}
            </div>
           </motion.div>
        )}
      </AnimatePresence>

      {/* Invoices Table */}
      <div className="aura-card overflow-hidden border-none shadow-2xl shadow-slate-200/50">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                <th className="px-4 py-3 w-10">
                   <button onClick={() => setSelectedInvoices(selectedInvoices.size === filteredInvoices.length ? new Set() : new Set(filteredInvoices.map(i => i.id)))} className="hover:text-indigo-600 transition-colors">
                      <CheckSquare className="w-5 h-5" />
                   </button>
                </th>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3 hidden sm:table-cell">Month</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-center hidden sm:table-cell">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={7} className="p-20 text-center"><div className="w-10 h-10 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin mx-auto"></div></td></tr>
              ) : displayList.length === 0 ? (
                <tr><td colSpan={7} className="p-20 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest italic opacity-50">No invoices found for the selected filters.</td></tr>
              ) : paginatedDisplayList.map((inv, i) => {
                const balance = groupByFamily ? inv.balance : ((inv.total_amount || 0) - (inv.paid_amount || 0));
                const isFamily = groupByFamily;
                
                return (
                  <motion.tr 
                    key={inv.id} 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="hover:bg-indigo-50/20 transition-all group"
                  >
                    <td className="px-4 py-2" onClick={(e) => { e.stopPropagation(); if(isFamily) return; const s = new Set(selectedInvoices); s.has(inv.id) ? s.delete(inv.id) : s.add(inv.id); setSelectedInvoices(s); }}>
                      <div className={cn("w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer", selectedInvoices.has(inv.id) ? "bg-indigo-600 border-indigo-600" : "border-slate-200 bg-white")}>
                        {selectedInvoices.has(inv.id) && <CheckSquare className="w-3 h-3 text-white" />}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <p className="text-[10px] font-mono font-black text-slate-500 tracking-tight uppercase">{isFamily ? `FAM-${inv.id.substring(0,6)}` : (inv.invoice_number || 'LEGACY')}</p>
                      {!isFamily && <p className="text-[9px] font-bold text-slate-400 mt-0.5 flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'No due date'}</p>}
                    </td>
                    <td className="px-4 py-2">
                      <p className="text-sm font-black text-slate-900 uppercase tracking-tight leading-tight">{isFamily ? inv.name : inv.students?.full_name}</p>
                      <p className="text-[10px] text-slate-400 font-bold">{isFamily ? `${inv.count} students` : (inv.students?.classes ? `${inv.students.classes.name}-${inv.students.classes.section}` : 'N/A')}</p>
                    </td>
                    <td className="px-4 py-2 hidden sm:table-cell">
                      <span className="bg-slate-100 text-slate-600 font-black px-2.5 py-1 rounded-lg text-[9px] uppercase tracking-widest">
                        {new Date(inv.month_year).toLocaleString('default', { month: 'short', year: 'numeric' })}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <p className="text-sm font-black text-slate-900">Rs. {Number(inv.total_amount).toLocaleString()}</p>
                      <p className={cn("text-[10px] font-black mt-0.5", balance > 0 ? 'text-rose-500' : 'text-emerald-500')}>
                        {balance > 0 ? `Unpaid: ${balance.toLocaleString()}` : '✓ Settled'}
                      </p>
                    </td>
                    <td className="px-4 py-2 text-center hidden sm:table-cell">
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest",
                        inv.status === 'paid' ? "bg-emerald-100 text-emerald-700" :
                        inv.status === 'overdue' ? "bg-rose-100 text-rose-700" :
                        inv.status === 'partial' ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                      )}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!isFamily ? (
                          <>
                            <button onClick={() => handlePrintChallan(inv)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Print Challan"><Printer className="w-4 h-4" /></button>
                            <button onClick={() => handleSendWhatsApp(inv)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" title="WhatsApp Reminder"><MessageCircle className="w-4 h-4" /></button>
                            <button onClick={() => setEditingInvoice(inv)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all" title="Edit Invoice"><Edit className="w-4 h-4" /></button>
                            <button onClick={() => handleDeleteInvoice(inv.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all" title="Delete Invoice"><Trash2 className="w-4 h-4" /></button>
                          </>
                        ) : (
                          <button onClick={() => handlePrintFamilyChallan(inv)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg font-bold text-[10px] uppercase tracking-widest hover:bg-indigo-100 transition-all"><Printer className="w-3.5 h-3.5" /> Family</button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && feeTotalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
            <p className="text-[11px] font-bold text-slate-500">
              Showing <span className="font-black text-slate-700">{(feeCurrentPage - 1) * FEE_ITEMS_PER_PAGE + 1}–{Math.min(feeCurrentPage * FEE_ITEMS_PER_PAGE, displayList.length)}</span> of <span className="font-black text-slate-700">{displayList.length}</span> invoices
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setFeeCurrentPage(p => Math.max(1, p - 1))} disabled={feeCurrentPage === 1}
                className="px-3 py-1 text-xs font-black text-slate-500 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-indigo-50 transition-all">Prev</button>
              {Array.from({ length: Math.min(5, feeTotalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(feeCurrentPage - 2, feeTotalPages - 4));
                const page = start + i;
                return (
                  <button key={page} onClick={() => setFeeCurrentPage(page)}
                    className={cn('w-8 h-7 text-xs font-black rounded-lg transition-all',
                      page === feeCurrentPage ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50'
                    )}>{page}</button>
                );
              })}
              <button onClick={() => setFeeCurrentPage(p => Math.min(feeTotalPages, p + 1))} disabled={feeCurrentPage === feeTotalPages}
                className="px-3 py-1 text-xs font-black text-slate-500 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-indigo-50 transition-all">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Modernized Modals... (Simplified for Brevity but Premium Styles) */}
      <AnimatePresence>
        {showGenerateModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-white/20">
                <div className="bg-slate-900 p-8 text-white relative">
                   <h3 className="text-2xl font-black italic uppercase tracking-tighter">Generate Class Invoices</h3>
                   <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-2">Financial Engine Sequence</p>
                    <button onClick={() => setShowGenerateModal(false)} className="absolute top-8 right-8 text-slate-500 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
                </div>
                <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                   {/* Mode Selection */}
                   <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1">
                      {[
                        { id: 'all', label: 'All Students', icon: Users },
                        { id: 'class', label: 'By Class', icon: Filter },
                        { id: 'student', label: 'Single Student', icon: Search }
                      ].map(m => (
                        <button 
                          key={m.id}
                          onClick={() => setGenMode(m.id as any)}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all",
                            genMode === m.id ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                          )}
                        >
                          <m.icon className="w-3.5 h-3.5" /> {m.label}
                        </button>
                      ))}
                   </div>

                   {genMode === 'class' && (
                     <div className="animate-in fade-in slide-in-from-top-2">
                        <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Select Target Class</label>
                        <select 
                          value={targetClass} 
                          onChange={e => setTargetClass(e.target.value)}
                          className="w-full bg-slate-50 border border-transparent p-4 rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-100"
                        >
                          <option value="">-- Choose Class --</option>
                          {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
                        </select>
                     </div>
                   )}

                   {genMode === 'student' && (
                     <div className="animate-in fade-in slide-in-from-top-2 space-y-3">
                        <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Search Student</label>

                        {/* Selected student chip */}
                        {targetStudent ? (
                          <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                              <span className="text-white text-xs font-black">{targetStudent.full_name[0]}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-black text-indigo-900 truncate">{targetStudent.full_name}</p>
                              <p className="text-[10px] font-bold text-indigo-500">Roll # {targetStudent.roll_number}{targetStudent.class_name ? ` · ${targetStudent.class_name}` : ''}</p>
                            </div>
                            <button
                              onClick={() => { setTargetStudent(null); setStuQuery(''); setStuResults([]); }}
                              className="p-1 rounded-full hover:bg-indigo-200 transition-colors text-indigo-400 hover:text-indigo-700"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="relative">
                              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <input
                                type="text"
                                placeholder="Type student name or roll #..."
                                value={stuQuery}
                                onChange={async (e) => {
                                  const q = e.target.value;
                                  setStuQuery(q);
                                  if (q.length > 1) {
                                    const { data } = await supabase
                                      .from('students')
                                      .select('id, full_name, roll_number, classes(name, section)')
                                      .eq('school_id', userRole?.school_id)
                                      .eq('status', 'active')
                                      .or(`full_name.ilike.%${q}%,roll_number.eq.${parseInt(q) || 0}`)
                                      .limit(8);
                                    setStuResults(data || []);
                                  } else {
                                    setStuResults([]);
                                  }
                                }}
                                className="w-full bg-slate-50 border border-transparent p-4 pl-12 rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-100"
                                autoFocus
                              />
                            </div>
                            {/* Dropdown results */}
                            {stuQuery.length > 1 && stuResults.length === 0 && (
                              <p className="text-center text-xs text-slate-400 py-2">No students found for "{stuQuery}"</p>
                            )}
                            {stuResults.length > 0 && (
                              <div className="bg-slate-50 rounded-2xl border border-slate-100 p-2 space-y-1 max-h-48 overflow-y-auto">
                                {stuResults.map(s => {
                                  const cls = s.classes ? `${s.classes.name}${s.classes.section ? ' ' + s.classes.section : ''}` : '';
                                  return (
                                    <button
                                      key={s.id}
                                      onClick={() => {
                                        setTargetStudent({ ...s, class_name: cls });
                                        setStuQuery(s.full_name);
                                        setStuResults([]);
                                      }}
                                      className="w-full text-left p-3 rounded-xl hover:bg-white transition-all text-slate-700 flex items-center gap-3"
                                    >
                                      <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                                        <span className="text-indigo-600 text-[10px] font-black">{s.full_name[0]}</span>
                                      </div>
                                      <div>
                                        <p className="text-xs font-black uppercase">{s.full_name}</p>
                                        <p className="text-[10px] font-bold opacity-60">Roll #{s.roll_number}{cls ? ` · ${cls}` : ''}</p>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        )}
                     </div>
                   )}
                   <div>
                     <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest text-center">Select Billing Cycle</label>
                     <input type="month" value={generateMonth} onChange={e => setGenerateMonth(e.target.value)} className="w-full bg-slate-50 border border-transparent focus:bg-white focus:border-slate-100 p-4 rounded-2xl text-center text-xl font-black text-slate-900 transition-all outline-none" />
                   </div>
                   <div>
                     <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest text-center">Due Date</label>
                     <input type="date" value={generateDueDate} onChange={e => setGenerateDueDate(e.target.value)} className="w-full bg-slate-50 border border-transparent focus:bg-white focus:border-slate-100 p-4 rounded-2xl text-center font-bold text-slate-700 transition-all outline-none" />
                   </div>
                   <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100/50 flex items-center gap-4">
                      <div className="flex-1">
                         <p className="text-xs font-black text-indigo-900 uppercase">Include Admission Fee</p>
                         <p className="text-[10px] text-indigo-600 font-bold opacity-70">Apply one-time matrix components</p>
                      </div>
                      <button onClick={() => setIncludeAdmissionFee(!includeAdmissionFee)} className={cn("w-14 h-8 rounded-full transition-all relative", includeAdmissionFee ? "bg-indigo-600" : "bg-slate-200")}>
                         <div className={cn("w-6 h-6 bg-white rounded-full absolute top-1 transition-all shadow-md", includeAdmissionFee ? "left-7" : "left-1")}></div>
                      </button>
                   </div>
                   <button onClick={handleMassGenerate} disabled={generating} className="w-full bg-indigo-600 text-white p-5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50">
                      {generating ? 'Processing Engine...' : 'Generate Invoices'}
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Invoice Editor Modal */}
      <AnimatePresence>
        {editingInvoice && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
              <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest">Edit Invoice</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{editingInvoice.invoice_number} · {editingInvoice.students?.full_name}</p>
                </div>
                <button onClick={() => setEditingInvoice(null)} className="p-2 hover:bg-white/10 rounded-xl"><X className="w-5 h-5 text-slate-400" /></button>
              </div>
              <div className="p-6 overflow-y-auto space-y-5 flex-1">
                {/* Due Date */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Due Date</label>
                  <input type="date" value={editingInvoice.due_date || ''} onChange={e => setEditingInvoice({ ...editingInvoice, due_date: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500" />
                </div>
                {/* Breakdown Editor */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-2">Fee Breakdown</label>
                  <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                    <FeeBreakdownEditor
                      breakdown={(editingInvoice.breakdown || []).map((b: any) => ({ item: b.item, amount: Number(b.amount) }))}
                      onChange={rows => setEditingInvoice({
                        ...editingInvoice,
                        breakdown: rows,
                        total_amount: rows.reduce((s, r) => s + (Number(r.amount) || 0), 0)
                      })}
                      schoolId={userRole?.school_id}
                    />
                  </div>
                </div>
              </div>
              <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
                <button
                  onClick={async () => {
                    if (!confirm('Soft-delete this invoice? It will be hidden but can be recovered.')) return;
                    await supabase.from('fee_records').update({ deleted_at: new Date().toISOString() }).eq('id', editingInvoice.id);
                    setEditingInvoice(null);
                    fetchInvoices();
                  }}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
                <button onClick={handleSaveInvoiceEdit}
                  className="flex-1 bg-slate-900 text-white py-2.5 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-black transition active:scale-95">
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
