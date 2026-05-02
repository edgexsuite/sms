import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Receipt, Search, PlusCircle, MessageCircle, Edit,
  Calendar, CheckSquare, Square, Save, X, Printer, Users,
  Layout, TrendingUp, AlertCircle, FileText, CheckCircle2,
  Clock, Filter, Download, Trash2, Send, Bell, Tag, Loader2, ExternalLink,
  ChevronLeft, ChevronRight, MoreVertical, Trash, Settings
} from 'lucide-react';
import FeeBreakdownEditor, { type BreakdownRow } from '../../components/FeeBreakdownEditor';
import HelpBanner from '../../components/HelpBanner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { downloadChallanPDF, DEFAULT_CHALLAN_CONFIG, ChallanConfig, ChallanRecord, SchoolInfo } from '../../lib/challanUtils';
import * as templatesLib from '../../lib/whatsappTemplates';
import { formatDate } from '../../lib/utils';
import { PageHeader, Card, Btn, Badge, Select, Input, EmptyState, StatCard } from '../../components/ui';

export default function MonthlyFeeInvoices() {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classes, setClasses] = useState<any[]>([]);
  const [classFilter, setClassFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortField, setSortField] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const bulkDateRef = useRef<HTMLInputElement>(null);
  const genDateRef = useRef<HTMLInputElement>(null);
  const editDateRef = useRef<HTMLInputElement>(null);
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
  const [singleBreakdown, setSingleBreakdown] = useState<any[]>([]);
  const [singleDiscount, setSingleDiscount] = useState<number>(0);
  const [isAutoLoading, setIsAutoLoading] = useState(false);

  const [discountRules, setDiscountRules] = useState<any[]>([]);

  useEffect(() => {
    if (userRole?.school_id) {
      fetchInvoices();
      fetchClasses();
      fetchSchool();
      fetchChallanConfig();
      fetchFeeItems();
      supabase.from('form_settings').select('sections_config').eq('school_id', userRole.school_id).eq('form_name', 'discount_rules').maybeSingle()
        .then(({ data }) => setDiscountRules(data?.sections_config?.rules ?? []));
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

  useEffect(() => {
    if (genMode === 'student' && targetStudent && userRole?.school_id) {
      setIsAutoLoading(true);
      supabase.from('fee_structures')
        .select('*')
        .eq('school_id', userRole.school_id)
        .eq('class_id', targetStudent.class_id)
        .maybeSingle()
        .then(({ data: structure }) => {
          const matrix = structure?.fee_matrix;
          let breakdown: any[] = [];
          if (matrix?.recurrent?.length) {
            breakdown = matrix.recurrent.map((r: any) => ({ item: r.item, amount: Number(r.amount) }));
          } else if (structure?.amount) {
            breakdown = [{ item: 'Monthly Tuition Fee', amount: Number(structure.amount) }];
          }
          if (includeAdmissionFee && matrix?.first_time?.length) {
            matrix.first_time.forEach((f: any) => breakdown.push({ item: f.item, amount: f.amount }));
          }
          setSingleBreakdown(breakdown);
          const recurringTotal = matrix?.recurrent?.length
            ? matrix.recurrent.reduce((s: number, r: any) => s + Number(r.amount), 0)
            : (structure?.amount ? Number(structure.amount) : 0);
          setSingleDiscount(Math.round(recurringTotal * ((targetStudent.fee_waiver_percentage || 0) / 100)));
          setIsAutoLoading(false);
        });
    }
  }, [genMode, targetStudent, includeAdmissionFee, userRole?.school_id]);

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

      const monthYear = generateMonth + '-01';
      const { data: existing } = await supabase.from('fee_records').select('student_id').eq('school_id', userRole?.school_id).eq('month_year', monthYear).is('deleted_at', null);
      const existingIds = new Set(existing?.map(e => e.student_id) || []);

      const billableStudents = students.filter(s => !existingIds.has(s.id));

      if (billableStudents.length === 0) {
        throw new Error('All students in this selection already have invoices generated for this month.');
      }

      const allInserts = billableStudents.map(student => {
        if (genMode === 'student') {
          const grossTotal = singleBreakdown.reduce((s, r) => s + Number(r.amount), 0);
          return {
            school_id: userRole?.school_id,
            student_id: student.id,
            student_name: student.full_name,
            month_year: generateMonth + '-01',
            total_amount: grossTotal - singleDiscount,
            discount_amount: singleDiscount,
            paid_amount: 0,
            status: 'pending',
            due_date: generateDueDate,
            payment_mode: 'Pending',
            breakdown: singleBreakdown,
            invoice_number: `INV-${generateMonth.replace('-', '').slice(2)}-${student.id.slice(0, 6).toUpperCase()}`,
            no_structure: false,
          };
        }
        const structure = structures?.find(s => s.class_id === student.class_id);
        const matrix = structure?.fee_matrix;
        let breakdown: any[] = [];
        let grossTotal = 0;
        const waiverDec = (student.fee_waiver_percentage || 0) / 100;

        if (matrix?.recurrent?.length) {
          matrix.recurrent.forEach((r: any) => {
            breakdown.push({ item: r.item, amount: Number(r.amount) });
            grossTotal += Number(r.amount);
          });
        } else if (structure?.amount) {
          breakdown.push({ item: 'Monthly Tuition Fee', amount: Number(structure.amount) });
          grossTotal = Number(structure.amount);
        }

        if (includeAdmissionFee && matrix?.first_time?.length) {
          matrix.first_time.forEach((f: any) => {
            breakdown.push({ item: f.item, amount: f.amount });
            grossTotal += f.amount;
          });
        }

        const recurringGross = matrix?.recurrent?.length
          ? matrix.recurrent.reduce((s: number, r: any) => s + Number(r.amount), 0)
          : (structure?.amount ? Number(structure.amount) : 0);
        const discountAmount = Math.round(recurringGross * waiverDec);
        const netTotal = grossTotal - discountAmount;

        return {
          school_id: userRole?.school_id,
          student_id: student.id,
          student_name: student.full_name,
          month_year: generateMonth + '-01',
          total_amount: netTotal,
          discount_amount: discountAmount,
          paid_amount: 0,
          status: 'pending',
          due_date: generateDueDate,
          payment_mode: 'Pending',
          breakdown,
          invoice_number: `INV-${generateMonth.replace('-', '').slice(2)}-${student.id.slice(0, 6).toUpperCase()}`,
          no_structure: !structure,
        };
      });

      const inserts = allInserts.filter(i => i.total_amount > 0).map(({ no_structure, student_name, ...rest }) => rest);
      const skippedCount = allInserts.filter(i => i.total_amount === 0).length;

      if (inserts.length === 0) {
        throw new Error('No invoices could be generated — fee structures are missing for all selected students. Configure fee structures in Settings first.');
      }

      const { error } = await supabase.from('fee_records').insert(inserts);
      if (error) throw error;

      const dupSkipped = students.length - billableStudents.length;
      const skippedMsg = [
        skippedCount > 0 ? `⚠️ ${skippedCount} skipped — no fee structure for their class.` : '',
        dupSkipped > 0   ? `ℹ️ ${dupSkipped} already had an invoice for this month (skipped).` : '',
      ].filter(Boolean).join('\n');
      alert(`✅ Generated ${inserts.length} invoice(s)!${skippedMsg ? '\n\n' + skippedMsg : ''}`);
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

  const handleDeleteInvoice = async (inv: any) => {
    if (inv.status === 'paid') {
      alert(`Invoice ${inv.invoice_number || ''} is already paid and cannot be deleted. Use the Trash Bin in Settings to recover deleted records if needed.`);
      return;
    }
    const hasPayment = Number(inv.paid_amount) > 0;
    if (hasPayment) {
      if (!confirm(`Invoice ${inv.invoice_number || ''} has a partial payment of Rs. ${Number(inv.paid_amount).toLocaleString()}.\n\nThis will soft-delete the invoice (recoverable from Trash Bin). The payment records in the ledger will be preserved.\n\nProceed?`)) return;
    } else {
      if (!confirm(`Delete invoice ${inv.invoice_number || ''} for ${inv.students?.full_name || 'student'}?\n\nThis is a soft delete — recoverable from Settings → Trash Bin.`)) return;
    }
    try {
      const { error } = await supabase.from('fee_records')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', inv.id);
      if (error) throw error;
      fetchInvoices();
    } catch (err: any) { alert(err.message); }
  };

  const handleBulkDelete = async () => {
    if (selectedInvoices.size === 0) return;

    const selectedList = invoices.filter(i => selectedInvoices.has(i.id));
    const paidCount = selectedList.filter(i => i.status === 'paid').length;
    const unpaidCount = selectedList.length - paidCount;

    let msg = `Delete ${unpaidCount} pending/partial invoice(s) (soft delete — recoverable)?`;
    if (paidCount > 0) {
      msg += `\n\n⚠️ ${paidCount} PAID invoice(s) are selected and will be SKIPPED — paid invoices cannot be deleted to protect the payment ledger.`;
    }
    if (!confirm(msg)) return;

    const deletableIds = selectedList
      .filter(i => i.status !== 'paid')
      .map(i => i.id);

    if (deletableIds.length === 0) {
      alert('No deletable invoices in your selection. Paid invoices are protected.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('fee_records')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', deletableIds);
      if (error) throw error;

      alert(`Soft-deleted ${deletableIds.length} invoice(s).${paidCount > 0 ? ` ${paidCount} paid invoice(s) were skipped.` : ''}`);
      setSelectedInvoices(new Set());
      fetchInvoices();
    } catch (err: any) { alert(err.message); }
    finally { setLoading(false); }
  };

  const handleSendWhatsApp = async (invoice: any) => {
    const parentPhone = invoice.students?.parents?.whatsapp_number;
    if (!parentPhone) return alert('No WhatsApp number found for this student\'s parent.');
    const balance = (invoice.total_amount || 0) - (invoice.paid_amount || 0);
    const dueDate = formatDate(invoice.due_date);
    
    const isOverdue = invoice.due_date && new Date(invoice.due_date) < new Date();
    const templateFn = isOverdue ? templatesLib.overdueFeeTemplate : templatesLib.feeDueTemplate;
    
    const msg = templateFn({
      studentName: invoice.students?.full_name,
      className: invoice.students?.classes ? `${invoice.students.classes.name} ${invoice.students.classes.section}` : '',
      invoiceNumber: invoice.invoice_number || invoice.id.substring(0, 10),
      balance: balance,
      dueDate: dueDate,
      month: formatDate(invoice.month_year),
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
      await new Promise(r => setTimeout(r, 600));
    }
    setSelectedInvoices(new Set());
  };

  const buildRecord = async (inv: any): Promise<ChallanRecord> => {
    const { data: prevFees } = await supabase
      .from('fee_records')
      .select('total_amount, paid_amount')
      .eq('school_id', userRole?.school_id)
      .eq('student_id', inv.student_id)
      .in('status', ['pending', 'partial', 'overdue'])
      .is('deleted_at', null)
      .neq('id', inv.id)
      .lt('month_year', inv.month_year);
    const previousFee = (prevFees || []).reduce(
      (sum: number, r: any) => sum + Math.max(0, (r.total_amount || 0) - (r.paid_amount || 0)), 0
    );

    const classId = inv.students?.class_id;
    let discountAmount = inv.discount_amount ?? 0;
    let challanBreakdown: { item: string; amount: number }[] | null = null;

    if (classId) {
      const { data: structure } = await supabase
        .from('fee_structures')
        .select('fee_matrix')
        .eq('school_id', userRole?.school_id)
        .eq('class_id', classId)
        .maybeSingle();
      if (structure?.fee_matrix) {
        const feeMatrix = structure.fee_matrix;

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

    const effectiveBreakdown = challanBreakdown ?? (inv.breakdown || []);
    const grossTotal = effectiveBreakdown.reduce((s: number, b: any) => s + Number(b.amount || 0), 0)
      || inv.total_amount;

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

      const daysLate = today > dueDate
        ? Math.ceil((today.getTime() - dueDate.getTime()) / 86400000)
        : 1;

      fineRules.forEach((rule: any) => {
        const graceDays = rule.grace_days || 0;
        if (daysLate <= graceDays) return;
        const eff = daysLate - graceDays;
        if      (rule.type === 'flat')       fineAmount += rule.amount;
        else if (rule.type === 'per_day')    fineAmount += rule.amount * eff;
        else if (rule.type === 'percentage') fineAmount += (inv.total_amount * rule.amount) / 100;
      });
      fineAmount = Math.round(fineAmount);
    }

    return {
      ...inv,
      breakdown: effectiveBreakdown,
      total_amount: grossTotal,
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
    await downloadChallanPDF([record], school, challanConfig, { autoPrint: true, download: false });
  };

  const handleDownloadChallan = async (invoice: any) => {
    const record = await buildRecord(invoice);
    await downloadChallanPDF([record], school, challanConfig, { autoPrint: false, download: true });
  };

  const handlePrintFamilyChallan = async (famGroup: any) => {
    const records = await Promise.all(famGroup.invoices.map(buildRecord));
    await downloadChallanPDF(records, school, challanConfig, {
      filenameOverride: `family-challan-${famGroup.name.replace(/\s+/g, '-')}.pdf`,
      autoPrint: true,
      download: false
    });
  };

  const handleBatchClassPrint = async () => {
    if (!classFilter || !monthFilter) return alert('Please select both a Class and a Month to print class challans.');
    setBatchPrinting(true);
    try {
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
      const breakdown = editingInvoice.breakdown || [];
      const grossTotal = breakdown.length > 0
        ? breakdown.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0)
        : editingInvoice.total_amount;
      const discountAmt = Number(editingInvoice.discount_amount) || 0;
      const netTotal = Math.max(0, grossTotal - discountAmt);

      const alreadyPaid = Number(editingInvoice.paid_amount) || 0;
      if (netTotal < alreadyPaid) {
        alert(`Cannot set invoice total (Rs. ${netTotal.toLocaleString()}) below the amount already paid (Rs. ${alreadyPaid.toLocaleString()}).`);
        return;
      }

      const newStatus = alreadyPaid >= netTotal && netTotal > 0 ? 'paid'
        : alreadyPaid > 0 ? 'partial'
        : 'pending';

      const { error } = await supabase.from('fee_records').update({
        total_amount: netTotal,
        discount_amount: discountAmt,
        due_date: editingInvoice.due_date,
        breakdown,
        status: newStatus,
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
    const matchStatus = !statusFilter || inv.status === statusFilter;
    return matchSearch && matchClass && matchMonth && matchStatus;
  }).sort((a, b) => {
    let aVal: any = a[sortField];
    let bVal: any = b[sortField];
    if (sortField === 'student_name') {
      aVal = a.students?.full_name || '';
      bVal = b.students?.full_name || '';
    }
    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

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

  const totalRevenue = invoices.reduce((sum, i) => sum + (Number(i.paid_amount) || 0), 0);
  const totalPending = invoices.reduce((sum, i) => sum + Math.max(0, (Number(i.total_amount) || 0) - (Number(i.paid_amount) || 0)), 0);
  const collectionRate = (totalRevenue + totalPending) > 0 ? (totalRevenue / (totalRevenue + totalPending)) * 100 : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">
      {/* Compact Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none mb-1 uppercase">Fee Invoices</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none">Manage Billing & Collections</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Btn
            variant={groupByFamily ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setGroupByFamily(!groupByFamily)}
            icon={Users}
            className="text-[10px] font-black uppercase"
          >
            {groupByFamily ? 'Family View' : 'Group By Family'}
          </Btn>
          <Btn
            variant="outline"
            size="sm"
            onClick={() => navigate('/fees/challan-settings')}
            icon={Settings}
            className="text-[10px] font-black uppercase"
          >
            Config
          </Btn>
          <Btn
            variant="primary"
            size="sm"
            onClick={() => setShowGenerateModal(true)}
            icon={PlusCircle}
            className="text-[10px] font-black uppercase shadow-lg shadow-indigo-100"
          >
            Generate
          </Btn>
        </div>
      </div>

      {/* High-Density Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Collected', value: totalRevenue, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', accent: 'bg-emerald-600' },
          { label: 'Outstanding', value: totalPending, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100', accent: 'bg-rose-600' },
          { label: 'Rate', value: `${collectionRate.toFixed(1)}%`, icon: CheckCircle2, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100', accent: 'bg-indigo-600' },
          { label: 'Total', value: invoices.length, icon: FileText, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100', accent: 'bg-violet-600' }
        ].map((stat, i) => (
          <div key={i} className={cn(
            "group relative flex items-center gap-4 bg-white p-4 rounded-2xl border shadow-sm transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/5 hover:-translate-y-0.5 overflow-hidden",
            stat.border
          )}>
            <div className={cn("absolute left-0 top-0 bottom-0 w-1 transition-all group-hover:w-1.5", stat.accent)} />
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 group-hover:rotate-3", stat.bg)}>
              <stat.icon className={cn("w-5 h-5", stat.color)} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">{stat.label}</p>
              <p className={cn("text-lg font-black leading-none truncate tracking-tight", stat.color)}>
                {typeof stat.value === 'number' ? `Rs. ${stat.value.toLocaleString()}` : stat.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Unified Compact Filters Area */}
      <div className="bg-gradient-to-br from-slate-50 to-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row items-center gap-2">
          <div className="w-full lg:flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search student or invoice..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-medium focus:ring-1 focus:ring-indigo-500 focus:bg-white outline-none transition-all placeholder:text-slate-400"
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <select 
              value={classFilter}
              onChange={e => setClassFilter(e.target.value)}
              className="flex-1 lg:w-32 py-2 px-3 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold text-slate-600 outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
            >
              <option value="">All Classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
            </select>

            <input
              type="month"
              value={monthFilter}
              onChange={e => setMonthFilter(e.target.value)}
              className="flex-1 lg:w-32 py-2 px-3 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold text-slate-600 outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
            />

            <select 
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="flex-1 lg:w-32 py-2 px-3 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold text-slate-600 outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
            >
              <option value="">All Status</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
              <option value="overdue">Overdue</option>
            </select>

            <select 
              value={`${sortField}-${sortOrder}`}
              onChange={e => {
                const [field, order] = e.target.value.split('-');
                setSortField(field);
                setSortOrder(order as any);
              }}
              className="flex-1 lg:w-32 py-2 px-3 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold text-slate-600 outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
            >
              <option value="created_at-desc">Newest First</option>
              <option value="created_at-asc">Oldest First</option>
              <option value="student_name-asc">Name A-Z</option>
              <option value="total_amount-desc">Highest Amount</option>
              <option value="total_amount-asc">Lowest Amount</option>
            </select>

            <Btn
              variant="secondary"
              onClick={handleBatchClassPrint}
              disabled={batchPrinting || !classFilter || !monthFilter}
              loading={batchPrinting}
              icon={Printer}
              size="sm"
              className="text-[10px] font-black uppercase px-4 h-[38px]"
            >
              Print Batch
            </Btn>
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {selectedInvoices.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="bg-slate-900 border border-slate-800 rounded-[2rem] p-4 flex flex-col md:flex-row items-center justify-between shadow-2xl shadow-indigo-100 text-white"
          >
            <div className="flex items-center gap-4 px-4 py-2">
              <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-400/20">
                <CheckSquare className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <p className="font-black text-xs uppercase tracking-widest text-white">
                  {selectedInvoices.size} Selected
                </p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Bulk operation active</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 p-2">
              {!showBulkEdit ? (
                <>
                  <Btn variant="ghost" onClick={() => setShowBulkEdit(true)} icon={Calendar} size="sm" className="text-white hover:bg-white/10">
                    Reschedule
                  </Btn>
                  <Btn variant="ghost" onClick={handleBulkOverdueReminders} icon={Bell} size="sm" className="text-white hover:bg-white/10">
                    Reminders
                  </Btn>
                  <Btn variant="danger" onClick={handleBulkDelete} icon={Trash2} size="sm">
                    Delete
                  </Btn>
                  <Btn variant="ghost" onClick={() => setSelectedInvoices(new Set())} icon={X} size="sm" className="text-slate-400 hover:text-white">
                    Cancel
                  </Btn>
                </>
              ) : (
                <div className="flex items-center gap-3 bg-white/5 p-2 rounded-2xl border border-white/10">
                  <Input
                    type="date"
                    value={bulkDueDate}
                    onChange={e => setBulkDueDate(e.target.value)}
                    className="!bg-transparent !border-none !text-white !p-0 !w-32"
                    style={{ colorScheme: 'dark' }}
                  />
                  <Btn variant="primary" size="sm" onClick={executeBulkDateChange}>
                    Apply
                  </Btn>
                  <button onClick={() => setShowBulkEdit(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all text-slate-400">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Table */}
      <Card className="p-0 overflow-hidden border-none shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-3 w-12">
                  <button 
                    onClick={() => setSelectedInvoices(selectedInvoices.size === filteredInvoices.length ? new Set() : new Set(filteredInvoices.map(i => i.id)))}
                    className={cn(
                      "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                      selectedInvoices.size === filteredInvoices.length && filteredInvoices.length > 0
                        ? "bg-indigo-600 border-indigo-600 shadow-sm"
                        : "bg-white border-slate-200"
                    )}
                  >
                    {selectedInvoices.size === filteredInvoices.length && filteredInvoices.length > 0 && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                  </button>
                </th>
                <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Invoice Info</th>
                <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Student / Family</th>
                <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 hidden sm:table-cell">Period</th>
                <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Amount</th>
                <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Status</th>
                <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-20 text-center">
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="mt-4 text-slate-400 font-bold uppercase text-[10px] tracking-widest">Loading Records...</p>
                  </td>
                </tr>
              ) : displayList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-0">
                    <EmptyState
                      icon={Receipt}
                      title="No Invoices Found"
                      description="We couldn't find any invoices matching your search or filters."
                    />
                  </td>
                </tr>
              ) : (
                paginatedDisplayList.map((inv, i) => {
                  const balance = groupByFamily ? inv.balance : ((inv.total_amount || 0) - (inv.paid_amount || 0));
                  const isFamily = groupByFamily;
                  
                  return (
                    <motion.tr 
                      key={inv.id} 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.01 }}
                      className="hover:bg-indigo-50/30 hover:shadow-sm transition-all group relative border-b border-slate-50 last:border-0"
                    >
                      <td className="px-6 py-2.5">
                        <button 
                          onClick={() => {
                            if(isFamily) return;
                            const s = new Set(selectedInvoices);
                            s.has(inv.id) ? s.delete(inv.id) : s.add(inv.id);
                            setSelectedInvoices(s);
                          }}
                          className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                            selectedInvoices.has(inv.id) ? "bg-indigo-600 border-indigo-600 shadow-sm" : "bg-white border-slate-200"
                          )}
                        >
                          {selectedInvoices.has(inv.id) && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                        </button>
                      </td>
                      <td className="px-6 py-2.5">
                        <p className="text-[9px] font-mono font-black text-slate-400 uppercase tracking-tight">
                          {isFamily ? `FAM-${inv.id.substring(0,6)}` : (inv.invoice_number || 'LEGACY')}
                        </p>
                        {!isFamily && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Clock className="w-3 h-3 text-slate-300" />
                            <p className="text-[9px] font-bold text-slate-400 whitespace-nowrap">Due: {formatDate(inv.due_date)}</p>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-2.5">
                        <p className="text-[13px] font-black text-slate-900 uppercase tracking-tight leading-none">
                          {isFamily ? inv.name : inv.students?.full_name}
                        </p>
                        <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-wider">
                          {isFamily ? `${inv.count} Students` : (inv.students?.classes ? `${inv.students.classes.name} - ${inv.students.classes.section}` : 'Unassigned')}
                        </p>
                      </td>
                      <td className="px-6 py-2.5 hidden sm:table-cell">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-slate-300" />
                          <p className="text-[11px] font-bold text-slate-500">{formatDate(inv.month_year)}</p>
                        </div>
                      </td>
                      <td className="px-6 py-2.5 text-right">
                        <p className="text-sm font-black text-slate-900">Rs. {Number(inv.total_amount).toLocaleString()}</p>
                        <p className={cn(
                          "text-[9px] font-black mt-0.5 uppercase tracking-widest",
                          balance > 0 ? 'text-rose-500' : 'text-emerald-500'
                        )}>
                          {balance > 0 ? `Unpaid: ${balance.toLocaleString()}` : '✓ Paid'}
                        </p>
                      </td>
                      <td className="px-6 py-2.5 text-center">
                        <Badge 
                          variant={
                            inv.status === 'paid' ? 'success' :
                            inv.status === 'partial' ? 'warning' :
                            inv.status === 'overdue' ? 'danger' : 'neutral'
                          }
                          className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest"
                        >
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {!isFamily ? (
                            <>
                              <Btn variant="ghost" size="sm" onClick={() => handlePrintChallan(inv)} icon={Printer} className="!p-2" />
                              <Btn variant="ghost" size="sm" onClick={() => handleDownloadChallan(inv)} icon={Download} className="!p-2" />
                              <Btn variant="ghost" size="sm" onClick={() => handleSendWhatsApp(inv)} icon={MessageCircle} className="!p-2" />
                              <Btn variant="ghost" size="sm" onClick={() => setEditingInvoice(inv)} icon={Edit} className="!p-2" />
                              <Btn variant="ghost" size="sm" onClick={() => handleDeleteInvoice(inv)} icon={Trash2} className="!p-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50" />
                            </>
                          ) : (
                            <Btn variant="secondary" size="sm" onClick={() => handlePrintFamilyChallan(inv)} icon={Printer}>
                              Family
                            </Btn>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && feeTotalPages > 1 && (
          <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs font-bold text-slate-500">
              Showing <span className="text-slate-900">{(feeCurrentPage - 1) * FEE_ITEMS_PER_PAGE + 1} to {Math.min(feeCurrentPage * FEE_ITEMS_PER_PAGE, displayList.length)}</span> of <span className="text-slate-900">{displayList.length}</span> results
            </p>
            <div className="flex items-center gap-2">
              <Btn 
                variant="outline" 
                size="sm" 
                disabled={feeCurrentPage === 1} 
                onClick={() => setFeeCurrentPage(p => p - 1)}
                icon={ChevronLeft}
              >
                Prev
              </Btn>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, feeTotalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(feeCurrentPage - 2, feeTotalPages - 4));
                  const page = start + i;
                  return (
                    <button 
                      key={page} 
                      onClick={() => setFeeCurrentPage(page)}
                      className={cn(
                        "w-8 h-8 rounded-lg text-xs font-black transition-all",
                        page === feeCurrentPage 
                          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" 
                          : "text-slate-500 hover:bg-slate-100"
                      )}
                    >
                      {page}
                    </button>
                  );
                })}
              </div>
              <Btn 
                variant="outline" 
                size="sm" 
                disabled={feeCurrentPage === feeTotalPages} 
                onClick={() => setFeeCurrentPage(p => p + 1)}
                icon={ChevronRight}
                iconPlacement="right"
              >
                Next
              </Btn>
            </div>
          </div>
        )}
      </Card>

      {/* Generation Modal */}
      <AnimatePresence>
        {showGenerateModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden border border-white/20">
                <div className="bg-slate-900 p-8 text-white relative">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center border border-indigo-400/20">
                         <Receipt className="w-6 h-6 text-indigo-300" />
                      </div>
                      <div>
                         <h3 className="text-xl font-black uppercase tracking-tight">Generate Invoices</h3>
                         <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1 opacity-60">Financial Engine sequence</p>
                      </div>
                   </div>
                   <button onClick={() => setShowGenerateModal(false)} className="absolute top-8 right-8 p-2 text-slate-500 hover:text-white hover:bg-white/10 rounded-xl transition-all"><X className="w-6 h-6" /></button>
                </div>
                
                <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                   <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1">
                      {[
                        { id: 'all', label: 'All', icon: Users },
                        { id: 'class', label: 'Class', icon: Filter },
                        { id: 'student', label: 'Single', icon: Search }
                      ].map(m => (
                        <button 
                          key={m.id}
                          onClick={() => setGenMode(m.id as any)}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all",
                            genMode === m.id ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                          )}
                        >
                          <m.icon className="w-3.5 h-3.5" /> {m.label}
                        </button>
                      ))}
                   </div>

                   <div className="space-y-6">
                     {genMode === 'class' && (
                       <Select 
                         label="Target Class"
                         value={targetClass} 
                         onChange={e => setTargetClass(e.target.value)}
                         icon={Users}
                       >
                         <option value="">-- Choose Class --</option>
                         {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
                       </Select>
                     )}

                     {genMode === 'student' && (
                       <div className="space-y-4">
                          {targetStudent ? (
                            <div className="flex items-center gap-4 bg-indigo-50 border border-indigo-100 rounded-2xl p-4 shadow-sm">
                              <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-black">
                                {targetStudent.full_name[0]}
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-black text-indigo-900 uppercase">{targetStudent.full_name}</p>
                                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Roll #{targetStudent.roll_number}</p>
                              </div>
                              <button onClick={() => { setTargetStudent(null); setStuQuery(''); }} className="p-2 text-indigo-300 hover:text-indigo-600 hover:bg-indigo-100 rounded-xl transition-all">
                                <X className="w-5 h-5" />
                              </button>
                            </div>
                          ) : (
                            <div className="relative">
                              <Input
                                placeholder="Search student name or roll #..."
                                value={stuQuery}
                                onChange={async (e) => {
                                  const q = e.target.value;
                                  setStuQuery(q);
                                  if (q.length > 1) {
                                    const { data } = await supabase
                                      .from('students')
                                      .select('id, full_name, roll_number, class_id, fee_waiver_percentage, classes(name, section)')
                                      .eq('school_id', userRole?.school_id)
                                      .eq('status', 'active')
                                      .or(`full_name.ilike.%${q}%,roll_number.eq.${parseInt(q) || 0}`)
                                      .limit(5);
                                    setStuResults(data || []);
                                  } else setStuResults([]);
                                }}
                                icon={Search}
                              />
                              {stuResults.length > 0 && (
                                <div className="absolute z-10 w-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 space-y-1">
                                  {stuResults.map(s => (
                                    <button
                                      key={s.id}
                                      onClick={() => {
                                        setTargetStudent({ ...s, class_name: s.classes ? `${s.classes.name} ${s.classes.section}` : '' });
                                        setStuResults([]);
                                      }}
                                      className="w-full text-left p-3 rounded-xl hover:bg-slate-50 transition-all flex items-center gap-3"
                                    >
                                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-black">{s.full_name[0]}</div>
                                      <div>
                                        <p className="text-xs font-black uppercase text-slate-900">{s.full_name}</p>
                                        <p className="text-[10px] font-bold text-slate-400">Roll #{s.roll_number}</p>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                       </div>
                     )}

                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <Input 
                          label="Billing Month"
                          type="month" 
                          value={generateMonth} 
                          onChange={e => {
                            setGenerateMonth(e.target.value);
                            if (e.target.value) setGenerateDueDate(e.target.value + '-05');
                          }}
                          icon={Calendar}
                        />
                        <Input 
                          label="Due Date"
                          type="date"
                          value={generateDueDate} 
                          onChange={e => setGenerateDueDate(e.target.value)}
                          icon={Clock}
                        />
                     </div>

                     <div className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100 transition-all hover:bg-slate-100/50">
                        <div>
                           <p className="text-xs font-black text-slate-900 uppercase tracking-tight">Include Admission Fee</p>
                           <p className="text-[10px] text-slate-500 font-bold mt-0.5 uppercase tracking-widest opacity-60">Apply one-time matrix components</p>
                        </div>
                        <button 
                          onClick={() => setIncludeAdmissionFee(!includeAdmissionFee)} 
                          className={cn(
                            "w-12 h-6 rounded-full transition-all relative flex items-center px-1",
                            includeAdmissionFee ? "bg-indigo-600" : "bg-slate-300"
                          )}
                        >
                          <div className={cn(
                            "w-4 h-4 bg-white rounded-full transition-all shadow-lg",
                            includeAdmissionFee ? "translate-x-6" : "translate-x-0"
                          )} />
                        </button>
                     </div>

                     {genMode === 'student' && targetStudent && (
                        <div className="p-6 bg-indigo-50/50 rounded-[2rem] border border-indigo-100 space-y-4">
                           <div className="flex items-center justify-between">
                              <p className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">Matrix Preview</p>
                              {isAutoLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />}
                           </div>
                           <FeeBreakdownEditor 
                             breakdown={singleBreakdown} 
                             onChange={setSingleBreakdown} 
                             schoolId={userRole?.school_id}
                           />
                           <div className="pt-4 border-t border-indigo-100 flex items-center justify-between">
                              <p className="text-sm font-black text-indigo-900">Total Net</p>
                              <p className="text-lg font-black text-indigo-600">Rs. {(singleBreakdown.reduce((s, r) => s + (Number(r.amount) || 0), 0) - singleDiscount).toLocaleString()}</p>
                           </div>
                        </div>
                     )}
                   </div>

                   <Btn 
                     variant="primary" 
                     className="w-full py-5 text-base tracking-[0.2em] shadow-2xl shadow-indigo-200" 
                     onClick={handleMassGenerate} 
                     disabled={generating}
                     loading={generating}
                     icon={PlusCircle}
                   >
                      Initialize Generation
                   </Btn>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Editor Modal */}
      <AnimatePresence>
        {editingInvoice && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
              <div className="bg-slate-900 p-8 flex items-center justify-between text-white">
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">Edit Invoice</h3>
                  <p className="text-[10px] font-black text-slate-400 mt-1 uppercase opacity-60">
                    {editingInvoice.invoice_number} · {editingInvoice.students?.full_name}
                  </p>
                </div>
                <button onClick={() => setEditingInvoice(null)} className="p-3 hover:bg-white/10 rounded-2xl transition-all"><X className="w-6 h-6 text-slate-400" /></button>
              </div>
              
              <div className="p-8 overflow-y-auto space-y-8 flex-1 custom-scrollbar">
                <Input 
                  label="Due Date"
                  type="date"
                  value={editingInvoice.due_date || ''} 
                  onChange={e => setEditingInvoice({ ...editingInvoice, due_date: e.target.value })}
                  icon={Clock}
                />
                
                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Fee Breakdown</label>
                  <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-6 shadow-inner">
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

                <div className="flex items-center justify-between p-6 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                  <p className="text-sm font-black text-indigo-900">Revised Total</p>
                  <p className="text-xl font-black text-indigo-600">Rs. {Number(editingInvoice.total_amount).toLocaleString()}</p>
                </div>
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                <Btn 
                  variant="danger" 
                  onClick={async () => {
                    if (!confirm('Soft-delete this invoice?')) return;
                    await supabase.from('fee_records').update({ deleted_at: new Date().toISOString() }).eq('id', editingInvoice.id);
                    setEditingInvoice(null);
                    fetchInvoices();
                  }}
                  icon={Trash}
                  className="px-6"
                />
                <Btn variant="primary" className="flex-1 text-sm tracking-[0.2em]" onClick={handleSaveInvoiceEdit}>
                  Save Changes
                </Btn>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
