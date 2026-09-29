import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Receipt, Search, PlusCircle, MessageCircle, Edit,
  Calendar, CheckSquare, Square, Save, X, Printer, Users,
  Layout, TrendingUp, AlertCircle, FileText, CheckCircle2,
  Clock, Filter, Download, Trash2, Send, Bell, Tag, Loader2, ExternalLink,
  ChevronLeft, ChevronRight, MoreVertical, Trash, Settings,
  Sparkles, Check, ArrowRight, ArrowLeft, RefreshCw, Eye, ShieldCheck, Zap
} from 'lucide-react';
import FeeBreakdownEditor, { type BreakdownRow } from '../../components/FeeBreakdownEditor';
import HelpBanner from '../../components/HelpBanner';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { downloadChallanPDF, DEFAULT_CHALLAN_CONFIG, ChallanConfig, ChallanRecord, SchoolInfo } from '../../lib/challanUtils';
import * as templatesLib from '../../lib/whatsappTemplates';
import { formatDate } from '../../lib/utils';
import { PageHeader, Card, Btn, Badge, Select, Input, EmptyState, StatCard } from '../../components/ui';

// Type for class generation status
interface ClassBillingStatus {
  id: string;
  name: string;
  section: string;
  totalStudents: number;
  invoicesGenerated: number;
  status: 'generated' | 'partial' | 'not_created' | 'no_students';
  billedAmount: number;
  paidAmount: number;
  invoices: any[];
}

export default function MonthlyFeeInvoices() {
  const { userRole } = useAuth();
  const navigate = useNavigate();

  // Active view tab: 'status' (Class Matrix) or 'invoices' (All Invoices table)
  const [activeTab, setActiveTab] = useState<'status' | 'invoices'>('status');

  // Selected Billing Month (defaults to current YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Data states
  const [invoices, setInvoices] = useState<any[]>([]);
  const [activeStudents, setActiveStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [school, setSchool] = useState<SchoolInfo>({ name: '' });
  const [challanConfig, setChallanConfig] = useState<ChallanConfig>(DEFAULT_CHALLAN_CONFIG);
  const [discountRules, setDiscountRules] = useState<any[]>([]);

  // Class status filters & search
  const [classStatusFilter, setClassStatusFilter] = useState<'all' | 'pending' | 'generated' | 'partial'>('all');
  const [classSearch, setClassSearch] = useState('');

  // Detailed Invoices view states
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortField, setSortField] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [groupByFamily, setGroupByFamily] = useState(false);
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [bulkDueDate, setBulkDueDate] = useState('');
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [batchPrinting, setBatchPrinting] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);

  // 4-Step Guided Wizard States
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [wizardMonth, setWizardMonth] = useState('');
  const [wizardIssueDate, setWizardIssueDate] = useState('');
  const [wizardDueDate, setWizardDueDate] = useState('');
  const [wizardTargetMode, setWizardTargetMode] = useState<'all_pending' | 'classes' | 'student'>('all_pending');
  const [wizardSelectedClasses, setWizardSelectedClasses] = useState<Set<string>>(new Set());
  const [wizardTargetStudent, setWizardTargetStudent] = useState<any>(null);
  const [stuQuery, setStuQuery] = useState('');
  const [stuResults, setStuResults] = useState<any[]>([]);
  const [wizardIncludeAdmission, setWizardIncludeAdmission] = useState(false);
  const [wizardIncludeArrears, setWizardIncludeArrears] = useState(true);
  const [wizardSingleBreakdown, setWizardSingleBreakdown] = useState<any[]>([]);
  const [wizardSingleDiscount, setWizardSingleDiscount] = useState<number>(0);
  const [wizardGenerating, setWizardGenerating] = useState(false);
  const [wizardProgress, setWizardProgress] = useState(0);
  const [wizardResult, setWizardResult] = useState<{ generated: number; skipped: number; invoiceIds: string[] } | null>(null);

  // Initial load
  useEffect(() => {
    if (userRole?.school_id) {
      fetchAllData();
      fetchSchool();
      fetchChallanConfig();
      supabase.from('form_settings').select('sections_config').eq('school_id', userRole.school_id).eq('form_name', 'discount_rules').maybeSingle()
        .then(({ data }) => setDiscountRules(data?.sections_config?.rules ?? []));
    }
  }, [userRole]);

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

  const fetchChallanConfig = async () => {
    const { data } = await supabase.from('form_settings').select('sections_config').eq('school_id', userRole?.school_id).eq('form_name', 'challan_settings').maybeSingle();
    if (data?.sections_config) setChallanConfig({ ...DEFAULT_CHALLAN_CONFIG, ...data.sections_config });
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Classes
      const { data: classesData } = await supabase
        .from('classes')
        .select('id, name, section')
        .eq('school_id', userRole?.school_id)
        .order('name');
      if (classesData) setClasses(classesData);

      // 2. Fetch Active Students
      const { data: studentsData } = await supabase
        .from('students')
        .select('id, full_name, roll_number, class_id, fee_waiver_percentage, fee_override, family_group_id, status, is_deleted')
        .eq('school_id', userRole?.school_id)
        .eq('status', 'active')
        .eq('is_deleted', false)
        .lt('fee_waiver_percentage', 100);
      if (studentsData) setActiveStudents(studentsData);

      // 3. Fetch Invoices
      const { data: invoicesData } = await supabase
        .from('fee_records')
        .select('*, students!inner(id, full_name, roll_number, class_id, family_group_id, fee_waiver_percentage, fee_override, is_deleted, classes(name, section), parents(whatsapp_number, father_name, family_number))')
        .eq('school_id', userRole?.school_id)
        .eq('students.is_deleted', false)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (invoicesData) setInvoices(invoicesData);
    } catch (err: any) {
      console.error('Error fetching fee data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Month navigation helpers
  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    setSelectedMonth(`${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const nextDate = new Date(y, m, 1);
    setSelectedMonth(`${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleCurrentMonth = () => {
    const now = new Date();
    setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  };

  // Compute Class Billing Status for the selectedMonth
  const classStatuses: ClassBillingStatus[] = useMemo(() => {
    const monthPrefix = `${selectedMonth}-01`;
    const monthInvoices = invoices.filter(i => i.month_year === monthPrefix || i.month_year?.startsWith(selectedMonth));

    return classes.map(c => {
      const classStudents = activeStudents.filter(s => s.class_id === c.id);
      const totalStudents = classStudents.length;

      const matchingInvoices = monthInvoices.filter(i => {
        return i.students?.class_id === c.id || classStudents.some(s => s.id === i.student_id);
      });

      const invoicesGenerated = matchingInvoices.length;
      let status: 'generated' | 'partial' | 'not_created' | 'no_students' = 'not_created';

      if (totalStudents === 0) {
        status = 'no_students';
      } else if (invoicesGenerated === 0) {
        status = 'not_created';
      } else if (invoicesGenerated >= totalStudents) {
        status = 'generated';
      } else {
        status = 'partial';
      }

      const billedAmount = matchingInvoices.reduce((sum, i) => sum + (Number(i.total_amount) || 0), 0);
      const paidAmount = matchingInvoices.reduce((sum, i) => sum + (Number(i.paid_amount) || 0), 0);

      return {
        id: c.id,
        name: c.name,
        section: c.section || '',
        totalStudents,
        invoicesGenerated,
        status,
        billedAmount,
        paidAmount,
        invoices: matchingInvoices
      };
    });
  }, [classes, activeStudents, invoices, selectedMonth]);

  // Filtered classes for status view
  const filteredClassStatuses = useMemo(() => {
    return classStatuses.filter(cs => {
      const matchSearch = !classSearch || 
        cs.name.toLowerCase().includes(classSearch.toLowerCase()) || 
        cs.section.toLowerCase().includes(classSearch.toLowerCase());
      
      let matchStatus = true;
      if (classStatusFilter === 'pending') {
        matchStatus = cs.status === 'not_created';
      } else if (classStatusFilter === 'generated') {
        matchStatus = cs.status === 'generated';
      } else if (classStatusFilter === 'partial') {
        matchStatus = cs.status === 'partial';
      }

      return matchSearch && matchStatus;
    });
  }, [classStatuses, classSearch, classStatusFilter]);

  // Monthly high-level KPIs
  const monthlyMetrics = useMemo(() => {
    const totalActive = activeStudents.length;
    const monthPrefix = `${selectedMonth}-01`;
    const monthInvoices = invoices.filter(i => i.month_year === monthPrefix || i.month_year?.startsWith(selectedMonth));
    const generatedCount = monthInvoices.length;
    const pendingCount = Math.max(0, totalActive - generatedCount);
    const billedTotal = monthInvoices.reduce((sum, i) => sum + (Number(i.total_amount) || 0), 0);
    const paidTotal = monthInvoices.reduce((sum, i) => sum + (Number(i.paid_amount) || 0), 0);
    const completionPercent = totalActive > 0 ? Math.round((generatedCount / totalActive) * 100) : 0;

    return {
      totalActive,
      generatedCount,
      pendingCount,
      billedTotal,
      paidTotal,
      completionPercent
    };
  }, [activeStudents, invoices, selectedMonth]);

  // Open Wizard pre-targeted
  const openWizard = (mode: 'all_pending' | 'classes' | 'student', preselectedClassId?: string) => {
    setWizardMonth(selectedMonth);
    const today = new Date().toISOString().slice(0, 10);
    setWizardIssueDate(today);
    setWizardDueDate(`${selectedMonth}-10`);
    setWizardTargetMode(mode);
    if (preselectedClassId) {
      setWizardSelectedClasses(new Set([preselectedClassId]));
    } else if (mode === 'classes') {
      // Preselect pending classes
      const pendingIds = classStatuses.filter(c => c.status === 'not_created' || c.status === 'partial').map(c => c.id);
      setWizardSelectedClasses(new Set(pendingIds));
    }
    setWizardTargetStudent(null);
    setWizardProgress(0);
    setWizardResult(null);
    setWizardStep(1);
    setShowWizard(true);
  };

  // Helper for single student breakdown preview in wizard
  useEffect(() => {
    if (wizardTargetMode === 'student' && wizardTargetStudent && userRole?.school_id) {
      supabase.from('fee_structures')
        .select('*')
        .eq('school_id', userRole.school_id)
        .eq('class_id', wizardTargetStudent.class_id)
        .maybeSingle()
        .then(({ data: structure }) => {
          const matrix = (wizardTargetStudent.fee_override as any) || structure?.fee_matrix;
          let breakdown: any[] = [];
          if (matrix?.recurrent?.length) {
            breakdown = matrix.recurrent.map((r: any) => ({ item: r.item, amount: Number(r.amount) }));
          } else if (structure?.amount) {
            breakdown = [{ item: 'Monthly Tuition Fee', amount: Number(structure.amount) }];
          }
          if (wizardIncludeAdmission && matrix?.first_time?.length) {
            matrix.first_time.forEach((f: any) => breakdown.push({ item: f.item, amount: f.amount }));
          }
          setWizardSingleBreakdown(breakdown);
          const recurringTotal = matrix?.recurrent?.length
            ? matrix.recurrent.reduce((s: number, r: any) => s + Number(r.amount), 0)
            : (structure?.amount ? Number(structure.amount) : 0);
          setWizardSingleDiscount(Math.round(recurringTotal * ((wizardTargetStudent.fee_waiver_percentage || 0) / 100)));
        });
    }
  }, [wizardTargetMode, wizardTargetStudent, wizardIncludeAdmission, userRole?.school_id]);

  // Execute Batch Invoice Generation inside the Wizard
  const handleExecuteWizardGeneration = async () => {
    if (!wizardMonth || !wizardDueDate) {
      alert('Please select both Billing Month and Due Date.');
      return;
    }

    setWizardGenerating(true);
    setWizardProgress(15);

    try {
      // 1. Fetch fee structures
      const { data: structures } = await supabase
        .from('fee_structures')
        .select('*')
        .eq('school_id', userRole?.school_id);

      setWizardProgress(30);

      // 2. Identify candidate students
      let candidates: any[] = [];
      if (wizardTargetMode === 'student') {
        if (!wizardTargetStudent) throw new Error('Please select a student.');
        candidates = [wizardTargetStudent];
      } else if (wizardTargetMode === 'classes') {
        if (wizardSelectedClasses.size === 0) throw new Error('Please select at least one class.');
        candidates = activeStudents.filter(s => wizardSelectedClasses.has(s.class_id));
      } else {
        // all_pending
        const pendingClasses = classStatuses.filter(c => c.status === 'not_created' || c.status === 'partial');
        const pendingClassIds = new Set(pendingClasses.map(c => c.id));
        candidates = activeStudents.filter(s => pendingClassIds.has(s.class_id));
      }

      if (candidates.length === 0) {
        throw new Error('No billable active students found for current selection.');
      }

      setWizardProgress(45);

      // 3. Filter out students who ALREADY have an invoice for this month (zero duplication guarantee!)
      const monthYear = wizardMonth + '-01';
      const { data: existingRecords } = await supabase
        .from('fee_records')
        .select('student_id')
        .eq('school_id', userRole?.school_id)
        .eq('month_year', monthYear)
        .is('deleted_at', null);

      const existingIds = new Set(existingRecords?.map(e => e.student_id) || []);
      const billableStudents = candidates.filter(s => !existingIds.has(s.id));
      const skippedCount = candidates.length - billableStudents.length;

      if (billableStudents.length === 0) {
        throw new Error(`All ${candidates.length} student(s) in this selection already have invoices generated for ${wizardMonth}.`);
      }

      setWizardProgress(60);

      // 4. Build invoice inserts
      const allInserts = billableStudents.map(student => {
        if (wizardTargetMode === 'student') {
          const grossTotal = wizardSingleBreakdown.reduce((s, r) => s + Number(r.amount), 0);
          return {
            school_id: userRole?.school_id,
            student_id: student.id,
            student_name: student.full_name,
            month_year: monthYear,
            total_amount: Math.max(0, grossTotal - wizardSingleDiscount),
            discount_amount: wizardSingleDiscount,
            paid_amount: 0,
            status: 'pending',
            due_date: wizardDueDate,
            payment_mode: 'Pending',
            breakdown: wizardSingleBreakdown,
            invoice_number: `INV-${wizardMonth.replace('-', '').slice(2)}-${student.id.slice(0, 6).toUpperCase()}`,
          };
        }

        const structure = structures?.find(s => s.class_id === student.class_id);
        const studentOverride = (student.fee_override as any);
        const matrix = studentOverride || structure?.fee_matrix;
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

        if (wizardIncludeAdmission && matrix?.first_time?.length) {
          matrix.first_time.forEach((f: any) => {
            breakdown.push({ item: f.item, amount: f.amount });
            grossTotal += f.amount;
          });
        }

        const recurringGross = matrix?.recurrent?.length
          ? matrix.recurrent.reduce((s: number, r: any) => s + Number(r.amount), 0)
          : (structure?.amount ? Number(structure.amount) : 0);
        const discountAmount = Math.round(recurringGross * waiverDec);
        const netTotal = Math.max(0, grossTotal - discountAmount);

        return {
          school_id: userRole?.school_id,
          student_id: student.id,
          student_name: student.full_name,
          month_year: monthYear,
          total_amount: netTotal,
          discount_amount: discountAmount,
          paid_amount: 0,
          status: 'pending',
          due_date: wizardDueDate,
          payment_mode: 'Pending',
          breakdown,
          invoice_number: `INV-${wizardMonth.replace('-', '').slice(2)}-${student.id.slice(0, 6).toUpperCase()}`,
        };
      });

      const validInserts = allInserts.filter(i => i.total_amount > 0);

      if (validInserts.length === 0) {
        throw new Error('No invoices could be generated — fee structures are missing for the selected classes. Configure fee structures first.');
      }

      setWizardProgress(80);

      // 5. Insert in chunks
      const chunkSize = 50;
      const insertedIds: string[] = [];
      for (let i = 0; i < validInserts.length; i += chunkSize) {
        const chunk = validInserts.slice(i, i + chunkSize);
        const { data, error } = await supabase.from('fee_records').insert(chunk).select('id');
        if (error) throw error;
        if (data) insertedIds.push(...data.map(d => d.id));
        setWizardProgress(Math.min(95, 80 + Math.round(((i + chunkSize) / validInserts.length) * 15)));
      }

      setWizardProgress(100);
      setWizardResult({
        generated: validInserts.length,
        skipped: skippedCount,
        invoiceIds: insertedIds
      });

      // Refresh master data
      await fetchAllData();
    } catch (err: any) {
      alert(err.message || 'Error generating invoices');
    } finally {
      setWizardGenerating(false);
    }
  };

  // Build challan record for printing/downloading
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
      let feeMatrix = (inv.students?.fee_override as any);
      if (!feeMatrix) {
        const { data: structure } = await supabase
          .from('fee_structures')
          .select('fee_matrix')
          .eq('school_id', userRole?.school_id)
          .eq('class_id', classId)
          .maybeSingle();
        feeMatrix = structure?.fee_matrix;
      }
      if (feeMatrix && !inv.discount_amount) {
        const originalTotal = (feeMatrix!.recurrent || []).reduce((s: number, i: any) => s + Number(i.amount || 0), 0);
        const invoiceTotal = (inv.breakdown || []).reduce((s: number, b: any) => s + Number(b.amount || 0), 0);
        const computed = Math.round(originalTotal - invoiceTotal);
        if (computed > 0) {
          discountAmount = computed;
          challanBreakdown = (feeMatrix!.recurrent || []).map((r: any) => ({ item: r.item, amount: Number(r.amount) }));
        }
      }
    }

    const effectiveBreakdown = challanBreakdown ?? (inv.breakdown || []);
    const grossTotal = effectiveBreakdown.reduce((s: number, b: any) => s + Number(b.amount || 0), 0) || inv.total_amount;

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
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const daysLate = today > dueDate ? Math.ceil((today.getTime() - dueDate.getTime()) / 86400000) : 1;

      fineRules.forEach((rule: any) => {
        const graceDays = rule.grace_days || 0;
        if (daysLate <= graceDays) return;
        const eff = daysLate - graceDays;
        if (rule.type === 'flat') fineAmount += rule.amount;
        else if (rule.type === 'per_day') fineAmount += rule.amount * eff;
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

  // Instant Batch Print for a specific Class
  const handlePrintClassChallans = async (classStatus: ClassBillingStatus) => {
    if (classStatus.invoices.length === 0) {
      alert(`No invoices generated yet for ${classStatus.name} ${classStatus.section} in ${selectedMonth}.`);
      return;
    }

    setBatchPrinting(true);
    try {
      const records = await Promise.all(classStatus.invoices.map(buildRecord));
      const safeLabel = `${classStatus.name.replace(/\s+/g, '_')}_${classStatus.section || 'All'}_${selectedMonth}`;
      await downloadChallanPDF(records, school, challanConfig, {
        filenameOverride: `challans_${safeLabel}.pdf`,
        autoPrint: true,
        download: false,
      });
    } catch (err: any) {
      alert(err.message || 'Failed to print challans.');
    } finally {
      setBatchPrinting(false);
    }
  };

  // Download batch challans from Wizard completion screen
  const handleDownloadWizardBatchPDF = async () => {
    if (!wizardResult?.invoiceIds?.length) return;
    setBatchPrinting(true);
    try {
      const { data: newInvs } = await supabase
        .from('fee_records')
        .select('*, students!inner(id, full_name, roll_number, class_id, family_group_id, fee_waiver_percentage, fee_override, is_deleted, classes(name, section), parents(whatsapp_number, father_name, family_number))')
        .in('id', wizardResult.invoiceIds);

      if (newInvs?.length) {
        const records = await Promise.all(newInvs.map(buildRecord));
        await downloadChallanPDF(records, school, challanConfig, {
          filenameOverride: `generated_challans_${wizardMonth}.pdf`,
          autoPrint: true,
          download: true,
        });
      }
    } catch (err: any) {
      alert(err.message || 'Failed to download batch challans.');
    } finally {
      setBatchPrinting(false);
    }
  };

  // Single Invoice actions
  const handlePrintChallan = async (invoice: any) => {
    const record = await buildRecord(invoice);
    await downloadChallanPDF([record], school, challanConfig, { autoPrint: true, download: false });
  };

  const handleDownloadChallan = async (invoice: any) => {
    const record = await buildRecord(invoice);
    await downloadChallanPDF([record], school, challanConfig, { autoPrint: false, download: true });
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

  const handleDeleteInvoice = async (inv: any) => {
    if (inv.status === 'paid') {
      alert(`Invoice ${inv.invoice_number || ''} is already paid and cannot be deleted.`);
      return;
    }
    const hasPayment = Number(inv.paid_amount) > 0;
    if (hasPayment) {
      if (!confirm(`Invoice ${inv.invoice_number || ''} has a partial payment of Rs. ${Number(inv.paid_amount).toLocaleString()}.\n\nSoft-delete this invoice? Payment ledger remains intact.`)) return;
    } else {
      if (!confirm(`Delete invoice ${inv.invoice_number || ''} for ${inv.students?.full_name || 'student'}?`)) return;
    }
    try {
      const { error } = await supabase.from('fee_records')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', inv.id);
      if (error) throw error;
      fetchAllData();
    } catch (err: any) { alert(err.message); }
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
      fetchAllData();
    } catch (err: any) { alert(err.message); }
  };

  // Filtered invoices for detailed tab
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
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
  }, [invoices, search, classFilter, monthFilter, statusFilter, sortField, sortOrder]);

  // Family grouping for invoices view
  const familyGroupedInvoices = useMemo(() => {
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
  useEffect(() => { setFeeCurrentPage(1); }, [search, classFilter, monthFilter, groupByFamily]);

  const displayList = groupByFamily ? (familyGroupedInvoices || []) : filteredInvoices;
  const feeTotalPages = Math.ceil(displayList.length / FEE_ITEMS_PER_PAGE);
  const paginatedDisplayList = displayList.slice((feeCurrentPage - 1) * FEE_ITEMS_PER_PAGE, feeCurrentPage * FEE_ITEMS_PER_PAGE);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100 ring-4 ring-indigo-50">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none uppercase">Fee Invoices & Challans</h1>
              <Badge variant="neutral" className="bg-indigo-50 text-indigo-700 border-indigo-100 font-black">
                {selectedMonth}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Class-by-Class Generation Status, Batch Printing & Instant Billing Wizard
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Mode Toggle */}
          <div className="bg-slate-100 p-1 rounded-2xl flex items-center border border-slate-200">
            <button
              onClick={() => setActiveTab('status')}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all",
                activeTab === 'status' 
                  ? "bg-white text-indigo-700 shadow-sm" 
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              <Layout className="w-3.5 h-3.5" />
              Class Status
            </button>
            <button
              onClick={() => setActiveTab('invoices')}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all",
                activeTab === 'invoices' 
                  ? "bg-white text-indigo-700 shadow-sm" 
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              <FileText className="w-3.5 h-3.5" />
              All Invoices ({filteredInvoices.length})
            </button>
          </div>

          <Btn
            variant="outline"
            size="sm"
            onClick={() => navigate('/fees/challan-settings')}
            icon={Settings}
            className="text-xs font-bold"
          >
            Challan Config
          </Btn>

          <Btn
            variant="primary"
            size="sm"
            onClick={() => openWizard('all_pending')}
            icon={Sparkles}
            className="text-xs font-black uppercase tracking-wider bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-lg shadow-indigo-200"
          >
            Generate Invoices
          </Btn>
        </div>
      </div>

      {/* Month Navigator & High-Density Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Month Selector Box */}
        <div className="lg:col-span-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-3xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black tracking-widest uppercase text-slate-400">Billing Period</span>
            <button
              onClick={handleCurrentMonth}
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-indigo-300 transition-all"
            >
              This Month
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 my-3">
            <button
              onClick={handlePrevMonth}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all"
              title="Previous Month"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="text-center">
              <input
                type="month"
                value={selectedMonth}
                onChange={e => e.target.value && setSelectedMonth(e.target.value)}
                className="bg-transparent text-xl font-black text-white text-center focus:outline-none cursor-pointer"
              />
              <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                {new Date(selectedMonth + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </p>
            </div>

            <button
              onClick={handleNextMonth}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all"
              title="Next Month"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Mini completion bar */}
          <div>
            <div className="flex justify-between text-[11px] font-bold text-slate-300 mb-1.5">
              <span>Billing Progress</span>
              <span className="text-indigo-400 font-black">{monthlyMetrics.completionPercent}%</span>
            </div>
            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${monthlyMetrics.completionPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* 3 Metric Cards */}
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Invoices Generated</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-black text-slate-900 tracking-tight">
                {monthlyMetrics.generatedCount} <span className="text-xs font-bold text-slate-400">/ {monthlyMetrics.totalActive}</span>
              </p>
              <p className="text-[11px] font-bold text-emerald-600 mt-0.5">
                {monthlyMetrics.completionPercent}% students billed
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Pending / Unbilled</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-black text-slate-900 tracking-tight">
                {monthlyMetrics.pendingCount} <span className="text-xs font-bold text-slate-400">students</span>
              </p>
              <p className="text-[11px] font-bold text-amber-600 mt-0.5">
                {monthlyMetrics.pendingCount > 0 ? 'Needs invoice creation' : 'All classes generated'}
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Billed ({selectedMonth})</span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-black text-slate-900 tracking-tight">
                Rs. {monthlyMetrics.billedTotal.toLocaleString()}
              </p>
              <p className="text-[11px] font-bold text-indigo-600 mt-0.5">
                Rs. {monthlyMetrics.paidTotal.toLocaleString()} collected
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* VIEW MODE 1: CLASS-BY-CLASS GENERATION STATUS (DEFAULT / PRACTICAL DASHBOARD) */}
      {activeTab === 'status' && (
        <div className="space-y-4">
          {/* Controls & Quick Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter by class name or section..."
                  value={classSearch}
                  onChange={e => setClassSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Filter Pills */}
              <div className="flex bg-slate-100 p-1 rounded-xl gap-1 text-[11px] font-bold">
                {[
                  { id: 'all', label: 'All Classes' },
                  { id: 'pending', label: '⏳ Not Created' },
                  { id: 'partial', label: '⚠️ Partial' },
                  { id: 'generated', label: '✅ Generated' }
                ].map(filter => (
                  <button
                    key={filter.id}
                    onClick={() => setClassStatusFilter(filter.id as any)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg transition-all",
                      classStatusFilter === filter.id
                        ? "bg-white text-indigo-700 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              {monthlyMetrics.pendingCount > 0 && (
                <Btn
                  variant="primary"
                  size="sm"
                  onClick={() => openWizard('all_pending')}
                  icon={Zap}
                  className="text-xs font-black uppercase tracking-wider bg-amber-600 hover:bg-amber-700"
                >
                  Generate All Pending ({monthlyMetrics.pendingCount})
                </Btn>
              )}
            </div>
          </div>

          {/* Class Matrix Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase font-black tracking-wider text-[10px]">
                    <th className="py-4 px-6">Class & Section</th>
                    <th className="py-4 px-6 text-center">Active Students</th>
                    <th className="py-4 px-6 text-center">Invoices Status ({selectedMonth})</th>
                    <th className="py-4 px-6 text-right">Amount Billed</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                        Loading class billing status...
                      </td>
                    </tr>
                  ) : filteredClassStatuses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        No classes found matching the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredClassStatuses.map(cs => {
                      const isComplete = cs.status === 'generated';
                      const isPending = cs.status === 'not_created';
                      const isPartial = cs.status === 'partial';
                      const isEmpty = cs.status === 'no_students';

                      return (
                        <tr key={cs.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs",
                                isComplete ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                isPartial ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                isPending ? "bg-rose-50 text-rose-700 border border-rose-200" :
                                "bg-slate-100 text-slate-500 border border-slate-200"
                              )}>
                                {cs.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-black text-slate-900 text-sm">
                                  {cs.name} {cs.section && <span className="text-slate-400 font-bold">· Section {cs.section}</span>}
                                </p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                  {cs.totalStudents} enrolled student{cs.totalStudents !== 1 ? 's' : ''}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="py-4 px-6 text-center">
                            <span className="font-bold text-slate-700">
                              {cs.totalStudents}
                            </span>
                          </td>

                          <td className="py-4 px-6">
                            <div className="flex flex-col items-center justify-center gap-1.5">
                              {isComplete && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Generated ({cs.invoicesGenerated}/{cs.totalStudents})
                                </span>
                              )}
                              {isPartial && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black bg-amber-50 text-amber-700 border border-amber-200">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  Partial ({cs.invoicesGenerated}/{cs.totalStudents}) · {cs.totalStudents - cs.invoicesGenerated} Missing
                                </span>
                              )}
                              {isPending && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                                  <Clock className="w-3.5 h-3.5" />
                                  Not Created (0/{cs.totalStudents})
                                </span>
                              )}
                              {isEmpty && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                  No Active Students
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-4 px-6 text-right">
                            {cs.billedAmount > 0 ? (
                              <div>
                                <p className="font-black text-slate-900 text-sm">Rs. {cs.billedAmount.toLocaleString()}</p>
                                <p className="text-[10px] text-slate-400 font-bold">
                                  Paid: Rs. {cs.paidAmount.toLocaleString()}
                                </p>
                              </div>
                            ) : (
                              <span className="text-slate-300 font-bold">—</span>
                            )}
                          </td>

                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {(isPending || isPartial) && cs.totalStudents > 0 && (
                                <Btn
                                  variant="primary"
                                  size="sm"
                                  onClick={() => openWizard('classes', cs.id)}
                                  icon={Zap}
                                  className="text-xs font-black uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 shadow-sm"
                                >
                                  Generate Now
                                </Btn>
                              )}

                              {cs.invoicesGenerated > 0 && (
                                <>
                                  <Btn
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handlePrintClassChallans(cs)}
                                    icon={Printer}
                                    disabled={batchPrinting}
                                    className="text-xs font-bold text-slate-700 hover:text-indigo-600 hover:border-indigo-300"
                                  >
                                    Print Challans
                                  </Btn>

                                  <Btn
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                      setClassFilter(cs.id);
                                      setMonthFilter(selectedMonth);
                                      setActiveTab('invoices');
                                    }}
                                    icon={Eye}
                                    className="text-xs font-bold"
                                    title="View Invoices List"
                                  >
                                    View
                                  </Btn>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE 2: DETAILED ALL INVOICES TABLE */}
      {activeTab === 'invoices' && (
        <div className="space-y-4">
          {/* Detailed Filters Area */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex flex-col lg:flex-row items-center gap-2">
              <div className="w-full lg:flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search student name, roll number, or invoice #..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                <select 
                  value={classFilter}
                  onChange={e => setClassFilter(e.target.value)}
                  className="flex-1 lg:w-36 py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="">All Classes</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
                </select>

                <input
                  type="month"
                  value={monthFilter}
                  onChange={e => setMonthFilter(e.target.value)}
                  className="flex-1 lg:w-36 py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/20"
                />

                <select 
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="flex-1 lg:w-32 py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="">All Status</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="partial">Partial</option>
                  <option value="overdue">Overdue</option>
                </select>

                <Btn
                  variant={groupByFamily ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setGroupByFamily(!groupByFamily)}
                  icon={Users}
                  className="text-xs font-bold"
                >
                  {groupByFamily ? 'Family Grouped' : 'Group by Family'}
                </Btn>
              </div>
            </div>

            {/* Bulk Selection Actions Bar */}
            {selectedInvoices.size > 0 && (
              <div className="flex items-center justify-between p-3 bg-indigo-50/80 rounded-xl border border-indigo-200/80 animate-in fade-in">
                <span className="text-xs font-bold text-indigo-900">
                  {selectedInvoices.size} invoice(s) selected
                </span>
                <div className="flex items-center gap-2">
                  <Btn
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!bulkDueDate) {
                        const d = prompt('Enter new due date (YYYY-MM-DD):');
                        if (!d) return;
                        setBulkDueDate(d);
                      }
                      setShowBulkEdit(true);
                    }}
                    icon={Calendar}
                    className="text-xs font-bold bg-white"
                  >
                    Change Due Date
                  </Btn>
                  <Btn
                    variant="danger"
                    size="sm"
                    onClick={async () => {
                      if (!confirm(`Soft-delete ${selectedInvoices.size} selected invoices?`)) return;
                      const { error } = await supabase.from('fee_records').update({ deleted_at: new Date().toISOString() }).in('id', Array.from(selectedInvoices));
                      if (error) alert(error.message);
                      else {
                        setSelectedInvoices(new Set());
                        fetchAllData();
                      }
                    }}
                    icon={Trash2}
                    className="text-xs font-bold"
                  >
                    Delete Selected
                  </Btn>
                </div>
              </div>
            )}
          </div>

          {/* Invoices List Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase font-black tracking-wider text-[10px]">
                    <th className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={selectedInvoices.size === paginatedDisplayList.length && paginatedDisplayList.length > 0}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedInvoices(new Set(paginatedDisplayList.map(i => i.id)));
                          } else {
                            setSelectedInvoices(new Set());
                          }
                        }}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                    </th>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Invoice # & Month</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                        Loading invoices...
                      </td>
                    </tr>
                  ) : paginatedDisplayList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No invoices found. Generate invoices using the wizard above.
                      </td>
                    </tr>
                  ) : (
                    paginatedDisplayList.map((inv: any) => {
                      const isSelected = selectedInvoices.has(inv.id);
                      const isPaid = inv.status === 'paid';
                      const isOverdue = inv.status === 'overdue' || (inv.due_date && new Date(inv.due_date) < new Date() && !isPaid);

                      return (
                        <tr key={inv.id} className={cn("hover:bg-slate-50/80 transition-colors", isSelected && "bg-indigo-50/40")}>
                          <td className="py-3 px-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                const next = new Set(selectedInvoices);
                                if (isSelected) next.delete(inv.id);
                                else next.add(inv.id);
                                setSelectedInvoices(next);
                              }}
                              className="rounded text-indigo-600 focus:ring-indigo-500"
                            />
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs">
                                {inv.students?.full_name ? inv.students.full_name[0] : 'S'}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900">{inv.students?.full_name}</p>
                                <p className="text-[10px] text-slate-400 font-bold">
                                  Roll #{inv.students?.roll_number} · {inv.students?.classes?.name} {inv.students?.classes?.section}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <p className="font-mono text-[11px] font-bold text-slate-700">{inv.invoice_number}</p>
                            <p className="text-[10px] text-slate-400">{formatDate(inv.month_year)}</p>
                          </td>

                          <td className="py-3 px-4">
                            <p className="font-black text-slate-900">Rs. {Number(inv.total_amount).toLocaleString()}</p>
                            {inv.paid_amount > 0 && (
                              <p className="text-[10px] text-emerald-600 font-bold">Paid: Rs. {Number(inv.paid_amount).toLocaleString()}</p>
                            )}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <span className={cn(
                              "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider",
                              isPaid ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                              isOverdue ? "bg-rose-50 text-rose-700 border border-rose-200" :
                              inv.status === 'partial' ? "bg-amber-50 text-amber-700 border border-amber-200" :
                              "bg-slate-100 text-slate-700 border border-slate-200"
                            )}>
                              {isPaid ? 'Paid' : isOverdue ? 'Overdue' : inv.status}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-slate-600 font-bold text-[11px]">
                            {inv.due_date ? formatDate(inv.due_date) : '—'}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handlePrintChallan(inv)}
                                title="Print Challan"
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-all"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDownloadChallan(inv)}
                                title="Download PDF"
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-all"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleSendWhatsApp(inv)}
                                title="Send WhatsApp Reminder"
                                className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                              >
                                <MessageCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingInvoice(inv)}
                                title="Edit Fee Items"
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-all"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteInvoice(inv)}
                                title="Delete Invoice"
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {feeTotalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-slate-100">
                <span className="text-xs text-slate-500 font-medium">
                  Page {feeCurrentPage} of {feeTotalPages} ({displayList.length} records)
                </span>
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
          </div>
        </div>
      )}

      {/* 4-STEP GUIDED INVOICE & CHALLAN GENERATION WIZARD */}
      <AnimatePresence>
        {showWizard && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-white/20 flex flex-col max-h-[90vh]"
            >
              {/* Wizard Header with Stepper */}
              <div className="bg-slate-900 p-6 text-white relative">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 flex items-center justify-center border border-indigo-400/20 text-indigo-300">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black uppercase tracking-tight">Invoice Generation Wizard</h3>
                      <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-0.5">
                        {wizardResult ? 'Step 4 of 4: Completed' : `Step ${wizardStep} of 4: ${
                          wizardStep === 1 ? 'Period & Due Date' :
                          wizardStep === 2 ? 'Select Target Classes' :
                          wizardStep === 3 ? 'Billing Components' :
                          'Review & Execute'
                        }`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowWizard(false)}
                    className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Visual Step Progress Bar */}
                <div className="grid grid-cols-4 gap-2 mt-5">
                  {[
                    { step: 1, label: 'Period' },
                    { step: 2, label: 'Target' },
                    { step: 3, label: 'Options' },
                    { step: 4, label: 'Generate' },
                  ].map(s => {
                    const isDone = wizardResult ? true : wizardStep > s.step;
                    const isCurrent = !wizardResult && wizardStep === s.step;
                    return (
                      <div key={s.step} className="flex flex-col gap-1">
                        <div className={cn(
                          "h-1.5 rounded-full transition-all duration-300",
                          isDone ? "bg-emerald-400" :
                          isCurrent ? "bg-indigo-500" :
                          "bg-white/10"
                        )} />
                        <span className={cn(
                          "text-[9px] font-black uppercase tracking-widest text-center",
                          isCurrent ? "text-indigo-300" : "text-slate-500"
                        )}>
                          {s.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Wizard Content Body */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
                {/* Result Screen (After successful generation) */}
                {wizardResult ? (
                  <div className="py-6 text-center space-y-5">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner ring-8 ring-emerald-50">
                      <Check className="w-8 h-8 stroke-[3]" />
                    </div>

                    <div>
                      <h4 className="text-xl font-black text-slate-900 uppercase">Invoices Created Successfully!</h4>
                      <p className="text-xs text-slate-500 font-medium mt-1">
                        Financial engine has generated invoices for billing period <span className="font-black text-slate-800">{wizardMonth}</span>.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
                      <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
                        <p className="text-2xl font-black text-emerald-700">{wizardResult.generated}</p>
                        <p className="text-[10px] font-black uppercase text-emerald-600 tracking-wider mt-0.5">Invoices Created</p>
                      </div>
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                        <p className="text-2xl font-black text-slate-600">{wizardResult.skipped}</p>
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mt-0.5">Already Existed</p>
                      </div>
                    </div>

                    <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                      <Btn
                        variant="primary"
                        onClick={handleDownloadWizardBatchPDF}
                        disabled={batchPrinting}
                        loading={batchPrinting}
                        icon={Printer}
                        className="w-full sm:w-auto px-6 py-3 text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100"
                      >
                        Print Batch Challans Now
                      </Btn>

                      <Btn
                        variant="outline"
                        onClick={() => {
                          setShowWizard(false);
                          setActiveTab('status');
                        }}
                        className="w-full sm:w-auto px-6 py-3 text-xs font-black uppercase tracking-wider"
                      >
                        Back to Class Status
                      </Btn>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* STEP 1: PERIOD & DUE DATE */}
                    {wizardStep === 1 && (
                      <div className="space-y-5 animate-in fade-in duration-200">
                        <div className="bg-indigo-50/60 p-4 rounded-2xl border border-indigo-100 text-xs text-indigo-900 flex items-start gap-3">
                          <Clock className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold">Select Billing Month & Challan Deadlines</p>
                            <p className="text-indigo-600 text-[11px] mt-0.5">
                              Invoices generated will be tagged to this billing cycle. Late fee policy will calculate fines past the due date automatically.
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Input
                            label="Billing Month"
                            type="month"
                            value={wizardMonth}
                            onChange={e => {
                              setWizardMonth(e.target.value);
                              if (e.target.value) setWizardDueDate(e.target.value + '-10');
                            }}
                            icon={Calendar}
                          />

                          <Input
                            label="Issue Date"
                            type="date"
                            value={wizardIssueDate}
                            onChange={e => setWizardIssueDate(e.target.value)}
                            icon={Clock}
                          />
                        </div>

                        <Input
                          label="Payment Due Date (Challan Deadline)"
                          type="date"
                          value={wizardDueDate}
                          onChange={e => setWizardDueDate(e.target.value)}
                          icon={Clock}
                        />
                      </div>
                    )}

                    {/* STEP 2: TARGET SELECTION */}
                    {wizardStep === 2 && (
                      <div className="space-y-5 animate-in fade-in duration-200">
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'all_pending', label: 'All Pending', desc: 'Auto-detect missing classes', icon: Zap },
                            { id: 'classes', label: 'Specific Classes', desc: 'Choose target grades', icon: Users },
                            { id: 'student', label: 'Single Student', desc: 'Individual slip', icon: Search },
                          ].map(mode => (
                            <button
                              key={mode.id}
                              onClick={() => setWizardTargetMode(mode.id as any)}
                              className={cn(
                                "p-3 rounded-2xl border text-left transition-all flex flex-col justify-between",
                                wizardTargetMode === mode.id
                                  ? "bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/20 text-indigo-900"
                                  : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-white"
                              )}
                            >
                              <mode.icon className={cn("w-4 h-4 mb-2", wizardTargetMode === mode.id ? "text-indigo-600" : "text-slate-400")} />
                              <div>
                                <p className="text-xs font-black uppercase tracking-tight">{mode.label}</p>
                                <p className="text-[10px] text-slate-400 font-medium mt-0.5">{mode.desc}</p>
                              </div>
                            </button>
                          ))}
                        </div>

                        {wizardTargetMode === 'all_pending' && (
                          <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl text-amber-900 text-xs space-y-1">
                            <p className="font-black flex items-center gap-1.5">
                              <Zap className="w-4 h-4 text-amber-600" />
                              Auto-Generate for Unbilled Classes
                            </p>
                            <p className="text-amber-700 text-[11px]">
                              System will detect all students who have not yet received an invoice for <b>{wizardMonth}</b> and generate their challans in a single automated batch.
                            </p>
                          </div>
                        )}

                        {wizardTargetMode === 'classes' && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                                Select Classes ({wizardSelectedClasses.size} selected)
                              </span>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setWizardSelectedClasses(new Set(classes.map(c => c.id)))}
                                  className="text-[11px] font-bold text-indigo-600 hover:underline"
                                >
                                  Select All
                                </button>
                                <span className="text-slate-300">·</span>
                                <button
                                  onClick={() => setWizardSelectedClasses(new Set())}
                                  className="text-[11px] font-bold text-slate-400 hover:underline"
                                >
                                  Clear
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1">
                              {classStatuses.map(cs => {
                                const isChecked = wizardSelectedClasses.has(cs.id);
                                return (
                                  <label
                                    key={cs.id}
                                    className={cn(
                                      "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                                      isChecked
                                        ? "bg-indigo-50/60 border-indigo-300 ring-1 ring-indigo-500/20"
                                        : "bg-white border-slate-200 hover:bg-slate-50"
                                    )}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        const next = new Set(wizardSelectedClasses);
                                        if (isChecked) next.delete(cs.id);
                                        else next.add(cs.id);
                                        setWizardSelectedClasses(next);
                                      }}
                                      className="rounded text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-bold text-slate-800 truncate">
                                        {cs.name} {cs.section && `(${cs.section})`}
                                      </p>
                                      <p className="text-[10px] text-slate-400">
                                        {cs.totalStudents} student{cs.totalStudents !== 1 ? 's' : ''} · {cs.status}
                                      </p>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {wizardTargetMode === 'student' && (
                          <div className="space-y-3">
                            {wizardTargetStudent ? (
                              <div className="flex items-center justify-between p-4 bg-indigo-50 border border-indigo-200 rounded-2xl">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-black flex items-center justify-center text-sm">
                                    {wizardTargetStudent.full_name[0]}
                                  </div>
                                  <div>
                                    <p className="text-xs font-black uppercase text-indigo-950">{wizardTargetStudent.full_name}</p>
                                    <p className="text-[10px] text-indigo-600 font-bold">
                                      Roll #{wizardTargetStudent.roll_number} · {wizardTargetStudent.classes?.name} {wizardTargetStudent.classes?.section}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => setWizardTargetStudent(null)}
                                  className="p-1.5 text-indigo-400 hover:text-indigo-800 hover:bg-indigo-100 rounded-lg transition-all"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="relative">
                                <Input
                                  label="Search Student"
                                  placeholder="Type name or roll number..."
                                  value={stuQuery}
                                  onChange={async e => {
                                    const q = e.target.value;
                                    setStuQuery(q);
                                    if (q.length > 1) {
                                      const { data } = await supabase
                                        .from('students')
                                        .select('id, full_name, roll_number, class_id, fee_waiver_percentage, fee_override, classes(name, section)')
                                        .eq('school_id', userRole?.school_id)
                                        .eq('status', 'active')
                                        .or(`full_name.ilike.%${q}%,roll_number.eq.${parseInt(q) || 0}`)
                                        .limit(6);
                                      setStuResults(data || []);
                                    } else {
                                      setStuResults([]);
                                    }
                                  }}
                                  icon={Search}
                                />
                                {stuResults.length > 0 && (
                                  <div className="absolute z-10 w-full mt-1 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 space-y-1">
                                    {stuResults.map(s => (
                                      <button
                                        key={s.id}
                                        onClick={() => {
                                          setWizardTargetStudent(s);
                                          setStuResults([]);
                                        }}
                                        className="w-full text-left p-2.5 rounded-xl hover:bg-indigo-50 transition-all flex items-center justify-between text-xs"
                                      >
                                        <div>
                                          <p className="font-bold text-slate-900">{s.full_name}</p>
                                          <p className="text-[10px] text-slate-400">Roll #{s.roll_number} · {s.classes?.name} {s.classes?.section}</p>
                                        </div>
                                        <Badge variant="neutral">Select</Badge>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* STEP 3: COMPONENTS & OPTIONS */}
                    {wizardStep === 3 && (
                      <div className="space-y-4 animate-in fade-in duration-200">
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                          <label className="flex items-center justify-between cursor-pointer">
                            <div>
                              <p className="text-xs font-black text-slate-900 uppercase">Include Previous Unpaid Arrears</p>
                              <p className="text-[10px] text-slate-500 font-medium">
                                Displays outstanding balances from previous months on the printed challan slip.
                              </p>
                            </div>
                            <input
                              type="checkbox"
                              checked={wizardIncludeArrears}
                              onChange={e => setWizardIncludeArrears(e.target.checked)}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                            />
                          </label>

                          <div className="border-t border-slate-200 pt-3">
                            <label className="flex items-center justify-between cursor-pointer">
                              <div>
                                <p className="text-xs font-black text-slate-900 uppercase">Include One-Time Admission Fee</p>
                                <p className="text-[10px] text-slate-500 font-medium">
                                  Applies one-time admission/registration charges configured in class fee matrix.
                                </p>
                              </div>
                              <input
                                type="checkbox"
                                checked={wizardIncludeAdmission}
                                onChange={e => setWizardIncludeAdmission(e.target.checked)}
                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                              />
                            </label>
                          </div>
                        </div>

                        <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl flex items-start gap-3">
                          <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                          <div className="text-xs text-indigo-950">
                            <p className="font-bold">Zero Duplication Protection Active</p>
                            <p className="text-indigo-600 text-[11px] mt-0.5">
                              Students who already have an invoice for {wizardMonth} will be safely skipped. Fee waivers and student fee overrides will be calculated automatically.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* STEP 4: REVIEW & EXECUTE */}
                    {wizardStep === 4 && (
                      <div className="space-y-4 animate-in fade-in duration-200">
                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
                          <p className="text-xs font-black uppercase tracking-wider text-slate-400">Generation Summary</p>

                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <p className="text-[10px] text-slate-400 font-bold uppercase">Billing Period</p>
                              <p className="font-black text-slate-900">{wizardMonth}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 font-bold uppercase">Challan Due Date</p>
                              <p className="font-black text-slate-900">{wizardDueDate}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 font-bold uppercase">Target Mode</p>
                              <p className="font-black text-slate-900 uppercase">
                                {wizardTargetMode === 'all_pending' ? 'All Pending Classes' :
                                 wizardTargetMode === 'classes' ? `${wizardSelectedClasses.size} Selected Classes` :
                                 'Single Student'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 font-bold uppercase">Admission Fee</p>
                              <p className="font-black text-slate-900">{wizardIncludeAdmission ? 'Included' : 'Excluded'}</p>
                            </div>
                          </div>
                        </div>

                        {wizardGenerating && (
                          <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl space-y-2">
                            <div className="flex justify-between text-xs font-black text-indigo-900">
                              <span>Generating Invoices...</span>
                              <span>{wizardProgress}%</span>
                            </div>
                            <div className="w-full bg-indigo-200 h-2 rounded-full overflow-hidden">
                              <div
                                className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                                style={{ width: `${wizardProgress}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Wizard Footer Navigation Controls */}
              {!wizardResult && (
                <div className="p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                  {wizardStep > 1 ? (
                    <Btn
                      variant="outline"
                      size="sm"
                      onClick={() => setWizardStep((s: any) => s - 1)}
                      disabled={wizardGenerating}
                      icon={ArrowLeft}
                      className="text-xs font-bold"
                    >
                      Back
                    </Btn>
                  ) : (
                    <div />
                  )}

                  {wizardStep < 4 ? (
                    <Btn
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        if (wizardStep === 1 && (!wizardMonth || !wizardDueDate)) {
                          alert('Please choose month and due date.');
                          return;
                        }
                        if (wizardStep === 2 && wizardTargetMode === 'classes' && wizardSelectedClasses.size === 0) {
                          alert('Please select at least one class.');
                          return;
                        }
                        if (wizardStep === 2 && wizardTargetMode === 'student' && !wizardTargetStudent) {
                          alert('Please search and select a student.');
                          return;
                        }
                        setWizardStep((s: any) => s + 1);
                      }}
                      icon={ArrowRight}
                      iconPlacement="right"
                      className="text-xs font-black uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700"
                    >
                      Continue
                    </Btn>
                  ) : (
                    <Btn
                      variant="primary"
                      size="sm"
                      onClick={handleExecuteWizardGeneration}
                      disabled={wizardGenerating}
                      loading={wizardGenerating}
                      icon={Zap}
                      className="text-xs font-black uppercase tracking-wider bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-lg shadow-indigo-200 px-6 py-2.5"
                    >
                      Generate Invoices Now
                    </Btn>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* INVOICE EDITOR MODAL */}
      <AnimatePresence>
        {editingInvoice && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
              <div className="bg-slate-900 p-6 flex items-center justify-between text-white">
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight">Edit Fee Invoice</h3>
                  <p className="text-[10px] font-black text-slate-400 mt-0.5 uppercase opacity-70">
                    {editingInvoice.invoice_number} · {editingInvoice.students?.full_name}
                  </p>
                </div>
                <button onClick={() => setEditingInvoice(null)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
                <Input 
                  label="Due Date"
                  type="date"
                  value={editingInvoice.due_date || ''} 
                  onChange={e => setEditingInvoice({ ...editingInvoice, due_date: e.target.value })}
                  icon={Clock}
                />
                
                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Fee Breakdown</label>
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
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

                <div className="flex items-center justify-between p-4 bg-indigo-50/60 rounded-2xl border border-indigo-100">
                  <p className="text-xs font-black text-indigo-900 uppercase">Revised Total</p>
                  <p className="text-lg font-black text-indigo-600">Rs. {Number(editingInvoice.total_amount).toLocaleString()}</p>
                </div>
              </div>

              <div className="p-5 bg-slate-50 border-t border-slate-200 flex gap-3">
                <Btn 
                  variant="danger" 
                  onClick={async () => {
                    if (!confirm('Soft-delete this invoice?')) return;
                    await supabase.from('fee_records').update({ deleted_at: new Date().toISOString() }).eq('id', editingInvoice.id);
                    setEditingInvoice(null);
                    fetchAllData();
                  }}
                  icon={Trash}
                  className="px-4"
                />
                <Btn variant="primary" className="flex-1 text-xs font-black uppercase tracking-wider" onClick={handleSaveInvoiceEdit}>
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
