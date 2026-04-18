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
      .select('*, students(id, full_name, roll_number, class_id, family_group_id, classes(name, section), parents(whatsapp_number, father_name))')
      .eq('school_id', userRole?.school_id)
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
      const { data: existing } = await supabase.from('fee_records').select('student_id').eq('school_id', userRole?.school_id).eq('month_year', monthYear);
      const existingIds = new Set(existing?.map(e => e.student_id) || []);

      const billableStudents = students.filter(s => !existingIds.has(s.id));

      if (billableStudents.length === 0) {
        throw new Error('All students in this selection already have invoices generated for this month.');
      }

      const allInserts = billableStudents.map(student => {
        const structure = structures?.find(s => s.class_id === student.class_id);
        const matrix = structure?.fee_matrix;
        let breakdown: any[] = [];
        let total = 0;
        const waiverDec = (student.fee_waiver_percentage || 0) / 100;

        if (matrix?.recurrent?.length) {
          matrix.recurrent.forEach((r: any) => {
            const discountedAmount = +(r.amount * (1 - waiverDec)).toFixed(2);
            breakdown.push({ item: r.item, amount: discountedAmount });
            total += discountedAmount;
          });
        } else if (structure?.amount) {
          // fallback to legacy amount field
          const discountedAmount = +(structure.amount * (1 - waiverDec)).toFixed(2);
          breakdown.push({ item: 'Monthly Tuition Fee', amount: discountedAmount });
          total = discountedAmount;
        }

        if (includeAdmissionFee && matrix?.first_time?.length) {
          matrix.first_time.forEach((f: any) => {
            breakdown.push({ item: f.item, amount: f.amount });
            total += f.amount;
          });
        }

        return {
          school_id: userRole?.school_id,
          student_id: student.id,
          student_name: student.full_name,
          month_year: generateMonth + '-01',
          total_amount: total,
          paid_amount: 0,
          status: 'pending',
          due_date: generateDueDate,
          payment_mode: 'Pending',
          breakdown,
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
    window.open(`https://wa.me/${parentPhone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
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
    const { data: prevFees } = await supabase.from('fee_records').select('total_amount, paid_amount').eq('school_id', userRole?.school_id).eq('student_id', inv.student_id).in('status', ['pending', 'overdue']).neq('id', inv.id).lt('month_year', inv.month_year);
    const previousFee = (prevFees || []).reduce((sum: number, r: any) => sum + Math.max(0, (r.total_amount || 0) - (r.paid_amount || 0)), 0);
    return {
      ...inv,
      student_name: inv.students?.full_name,
      roll_number: inv.students?.roll_number,
      class_name: inv.students?.classes ? `${inv.students.classes.name || ''}${inv.students.classes.section ? ' - ' + inv.students.classes.section : ''}` : '',
      father_name: inv.students?.parents?.father_name || '',
      family_number: inv.students?.parents?.family_number || '',
      issue_date: inv.created_at,
      previous_fee: previousFee,
      fine_amount: 0,
      discount_amount: inv.discount_amount || 0,
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
      const { error } = await supabase.from('fee_records').update({ total_amount: editingInvoice.total_amount, due_date: editingInvoice.due_date, breakdown: editingInvoice.breakdown }).eq('id', editingInvoice.id);
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

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">Billing Terminal</h1>
          <p className="text-slate-500 text-xs font-medium mt-0.5">Invoicing & revenue control</p>
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
                        <div className="relative">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input 
                            type="text"
                            placeholder="Type student name or roll #..."
                            value={stuQuery}
                            onChange={async (e) => {
                              setStuQuery(e.target.value);
                              if (e.target.value.length > 1) {
                                const { data } = await supabase.from('students').select('id, full_name, roll_number').eq('school_id', userRole?.school_id).ilike('full_name', `%${e.target.value}%`).limit(5);
                                setStuResults(data || []);
                              } else {
                                setStuResults([]);
                              }
                            }}
                            className="w-full bg-slate-50 border border-transparent p-4 pl-12 rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-100"
                          />
                        </div>
                        {stuResults.length > 0 && (
                          <div className="bg-slate-50 rounded-2xl border border-slate-100 p-2 space-y-1">
                            {stuResults.map(s => (
                              <button 
                                key={s.id}
                                onClick={() => { setTargetStudent(s); setStuQuery(s.full_name); setStuResults([]); }}
                                className={cn(
                                  "w-full text-left p-3 rounded-xl transition-all",
                                  targetStudent?.id === s.id ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "hover:bg-white text-slate-700"
                                )}
                              >
                                <p className="text-xs font-black uppercase">{s.full_name}</p>
                                <p className="text-[10px] font-bold opacity-70">Roll #{s.roll_number}</p>
                              </button>
                            ))}
                          </div>
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
             <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="bg-slate-50 border-b border-slate-100 p-8 flex justify-between items-center">
                   <div>
                      <h3 className="text-xl font-black uppercase tracking-tight text-slate-900">Adjust Artifact</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Manual Ledger Override</p>
                   </div>
                   <button onClick={() => setEditingInvoice(null)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                <div className="p-8 overflow-y-auto custom-scrollbar space-y-8 flex-1">
                   <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Modified Due Date</label>
                        <input type="date" value={editingInvoice.due_date || ''} onChange={e => setEditingInvoice({ ...editingInvoice, due_date: e.target.value })} className="w-full bg-slate-50 border-none p-4 rounded-xl font-bold text-slate-700 focus:bg-slate-100 transition-all outline-none" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Total Valuation</label>
                        <input type="number" value={editingInvoice.total_amount} onChange={e => setEditingInvoice({ ...editingInvoice, total_amount: parseFloat(e.target.value) })} className="w-full bg-slate-50 border-none p-4 rounded-xl font-black text-indigo-600 text-lg focus:bg-slate-100 transition-all outline-none" />
                      </div>
                   </div>
                   <div className="space-y-4">
                      <div className="flex justify-between items-center">
                         <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Breakdown Analysis</h4>
                         <button onClick={() => setEditingInvoice({ ...editingInvoice, breakdown: [...(editingInvoice.breakdown || []), { item: 'New Correction', amount: 0 }] })} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline">+ Append Entry</button>
                      </div>
                      <div className="space-y-3">
                         {(editingInvoice.breakdown || []).map((b, idx) => (
                           <div key={idx} className="flex gap-3 items-center bg-slate-50 p-4 rounded-2xl border border-slate-100/50 group">
                              <input type="text" value={b.item} onChange={e => { const a = [...editingInvoice.breakdown]; a[idx].item = e.target.value; setEditingInvoice({...editingInvoice, breakdown: a}); }} className="flex-1 bg-transparent border-none font-bold text-sm text-slate-700 outline-none" />
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-slate-400">Rs.</span>
                                <input type="number" value={b.amount} onChange={e => { const a = [...editingInvoice.breakdown]; a[idx].amount = parseFloat(e.target.value); setEditingInvoice({...editingInvoice, breakdown: a}); }} className="w-24 bg-white border border-slate-200 px-3 py-1.5 rounded-lg font-black text-sm text-right outline-none focus:border-indigo-500 transition-all" />
                              </div>
                              <button onClick={() => setEditingInvoice({ ...editingInvoice, breakdown: editingInvoice.breakdown.filter((_:any, i:number) => i !== idx) })} className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                           </div>
                         ))}
                      </div>
                   </div>
                </div>
                <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                   <button onClick={handleSaveInvoiceEdit} className="w-full bg-slate-900 text-white p-5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl hover:bg-black transition-all active:scale-95">Commit Adjustments</button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
