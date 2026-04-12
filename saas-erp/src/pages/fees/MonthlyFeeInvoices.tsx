import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Receipt, Search, PlusCircle, MessageCircle, Edit, Calendar, CheckSquare, Square, Save, X, Printer, Users, Layout } from 'lucide-react';
import { downloadChallanPDF, DEFAULT_CHALLAN_CONFIG, ChallanConfig, ChallanRecord, SchoolInfo } from '../../lib/challanUtils';

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

  // Mass Generate Modal State
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateMonth, setGenerateMonth] = useState('');
  const [generateDueDate, setGenerateDueDate] = useState('');
  const [includeAdmissionFee, setIncludeAdmissionFee] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Bulk Edit State
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [bulkDueDate, setBulkDueDate] = useState('');
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [batchPrinting, setBatchPrinting] = useState(false);

  // Edit Invoice State
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
      // If logo_url is just a filename/path, resolve it to a public Supabase URL
      if (data.logo_url && !data.logo_url.startsWith('http')) {
        const { data: publicURL } = supabase.storage
          .from('logos')
          .getPublicUrl(data.logo_url);
        data.logo_url = publicURL.publicUrl;
      }
      setSchool(data);
    }
  };

  const fetchClasses = async () => {
    const { data } = await supabase
      .from('classes')
      .select('id, name, section')
      .eq('school_id', userRole?.school_id)
      .order('name');
    if (data) setClasses(data);
  };

  const fetchChallanConfig = async () => {
    const { data } = await supabase
      .from('form_settings')
      .select('sections_config')
      .eq('school_id', userRole?.school_id)
      .eq('form_name', 'challan_settings')
      .maybeSingle();
    if (data?.sections_config) setChallanConfig({ ...DEFAULT_CHALLAN_CONFIG, ...data.sections_config });
  };

  const fetchInvoices = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('fee_records')
      .select('*, students(id, full_name, roll_number, class_id, classes(name, section), parents(whatsapp_number, father_name))')
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
      const { data: students } = await supabase.from('students')
        .select('*')
        .eq('school_id', userRole?.school_id)
        .eq('status', 'active')
        .lt('fee_waiver_percentage', 100);

      if (!students || students.length === 0) throw new Error('No billable students found.');

      const inserts = students.map(student => {
        const structure = structures?.find(s => s.class_id === student.class_id);
        const matrix = structure?.fee_matrix || { recurrent: [{ item: 'Default Tuition', amount: 0 }], first_time: [] };
        let breakdown: any[] = [];
        let total = 0;
        const waiverDec = (student.fee_waiver_percentage || 0) / 100;

        if (matrix.recurrent) {
          matrix.recurrent.forEach((r: any) => {
            const discountedAmount = r.amount * (1 - waiverDec);
            breakdown.push({ item: r.item, amount: discountedAmount });
            total += discountedAmount;
          });
        }

        if (includeAdmissionFee && matrix.first_time) {
          matrix.first_time.forEach((f: any) => {
            breakdown.push({ item: f.item, amount: f.amount });
            total += f.amount;
          });
        }

        return {
          school_id: userRole?.school_id,
          student_id: student.id,
          month_year: generateMonth + '-01',
          total_amount: total,
          paid_amount: 0,
          status: 'pending',
          due_date: generateDueDate,
          payment_mode: 'Pending',
          breakdown,
          invoice_number: `INV-${Math.floor(Date.now() / 1000)}-${student.roll_number}`,
        };
      });

      const { error } = await supabase.from('fee_records').insert(inserts);
      if (error) throw error;

      alert(`Successfully generated ${inserts.length} invoices!`);
      setShowGenerateModal(false);
      fetchInvoices();
    } catch (err: any) {
      alert(err.message || 'Error generating invoices');
    } finally {
      setGenerating(false);
    }
  };

  const executeBulkDateChange = async () => {
    if (!bulkDueDate || selectedInvoices.size === 0) return;
    try {
      const { error } = await supabase.from('fee_records')
        .update({ due_date: bulkDueDate })
        .in('id', Array.from(selectedInvoices));
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
    const msg = `Dear Parent,\n\nFee invoice *${invoice.invoice_number || invoice.id.substring(0, 10)}* of *Rs. ${balance.toLocaleString()}* for *${invoice.students?.full_name}* is due on *${dueDate}*.\n\nPlease pay promptly to avoid late fines.\n\n— ${school.name || 'School Management'}`;

    // Log to communication_logs
    await supabase.from('communication_logs').insert([{
      school_id: userRole?.school_id,
      recipient_number: parentPhone,
      message_content: msg,
      channel: 'whatsapp',
      status: 'sent',
    }]);

    window.open(`https://wa.me/${parentPhone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const buildRecord = async (inv: any): Promise<ChallanRecord> => {
    // Fetch previous unpaid balances for this student (older months)
    const { data: prevFees } = await supabase
      .from('fee_records')
      .select('total_amount, paid_amount')
      .eq('school_id', userRole?.school_id)
      .eq('student_id', inv.student_id)
      .in('status', ['pending', 'overdue'])
      .neq('id', inv.id)
      .lt('month_year', inv.month_year);

    const previousFee = (prevFees || []).reduce(
      (sum: number, r: any) => sum + Math.max(0, (r.total_amount || 0) - (r.paid_amount || 0)), 0
    );

    // Fine amount from config (stored in fine_note as number, or default 0)
    const fineAmt = 0; // override from FinePolicy settings if available

    return {
      ...inv,
      student_name: inv.students?.full_name,
      roll_number: inv.students?.roll_number,
      class_name: inv.students?.classes
        ? `${inv.students.classes.name || ''}${inv.students.classes.section ? ' - ' + inv.students.classes.section : ''}`
        : '',
      father_name: inv.students?.parents?.father_name || '',
      family_number: inv.students?.parents?.family_number || '',
      issue_date: inv.created_at,
      previous_fee: previousFee,
      fine_amount: fineAmt,
      discount_amount: inv.discount_amount || 0,
    };
  };

  const handlePrintChallan = async (invoice: any) => {
    const record = await buildRecord(invoice);
    await downloadChallanPDF([record], school, challanConfig, { autoPrint: true, download: true });
  };

  const handleBatchClassPrint = async () => {
    if (!classFilter || !monthFilter) return alert('Please select both Class and Month to batch print.');
    setBatchPrinting(true);
    try {
      const { data } = await supabase
        .from('fee_records')
        .select('*, students(id, full_name, roll_number, class_id, classes(name, section), parents(whatsapp_number, father_name, family_number))')
        .eq('school_id', userRole?.school_id)
        .eq('month_year', monthFilter + '-01');

      const filtered = (data || []).filter((inv: any) => inv.students?.class_id === classFilter);
      if (!filtered.length) { alert('No invoices found for the selected class and month.'); return; }

      // Build all records (with previous fee per student) in parallel
      const records: ChallanRecord[] = await Promise.all(filtered.map(buildRecord));

      const selectedClass = classes.find(c => c.id === classFilter);
      const label = `class-${selectedClass?.name || 'all'}-${monthFilter}`;
      await downloadChallanPDF(records, school, challanConfig, `challans-${label}.pdf`);
    } catch (err: any) {
      alert(err.message || 'Failed to generate batch challans.');
    } finally {
      setBatchPrinting(false);
    }
  };

  const handleSaveInvoiceEdit = async () => {
    try {
      const { error } = await supabase.from('fee_records').update({
        total_amount: editingInvoice.total_amount,
        due_date: editingInvoice.due_date,
        breakdown: editingInvoice.breakdown,
      }).eq('id', editingInvoice.id);
      if (error) throw error;
      setEditingInvoice(null);
      fetchInvoices();
    } catch (err: any) { alert(err.message); }
  };

  const toggleInvoice = (id: string) => {
    const s = new Set(selectedInvoices);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedInvoices(s);
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchSearch = !search ||
      inv.students?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      inv.invoice_number?.toLowerCase().includes(search.toLowerCase());
    const matchClass = !classFilter || inv.students?.class_id === classFilter;
    const matchMonth = !monthFilter || inv.month_year?.startsWith(monthFilter);
    return matchSearch && matchClass && matchMonth;
  });

  const statusColor: Record<string, string> = {
    paid: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    overdue: 'bg-red-100 text-red-800',
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Receipt className="w-6 h-6 text-blue-600" /> Invoice Management
          </h1>
          <p className="text-gray-500 text-sm mt-1">Mass generate, print challans, and dispatch WhatsApp reminders.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search invoices..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 text-sm w-44" />
          </div>
          <select value={classFilter} onChange={e => setClassFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500">
            <option value="">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.section ? ` ${c.section}` : ''}</option>)}
          </select>
          <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500" />
          {classFilter && monthFilter && (
            <button onClick={handleBatchClassPrint} disabled={batchPrinting}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md font-medium text-sm hover:bg-indigo-700 transition disabled:opacity-50">
              <Users className="w-4 h-4" />
              {batchPrinting ? 'Generating...' : 'Print Class Challans'}
            </button>
          )}
          <button onClick={() => navigate('/fees/challan-settings')}
            className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-md font-medium text-sm hover:bg-gray-200 transition">
            <Layout className="w-4 h-4" /> Config
          </button>
          <button onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md font-medium text-sm hover:bg-blue-700 transition">
            <PlusCircle className="w-4 h-4" /> Mass Generate
          </button>
        </div>
      </div>

      {/* BULK ACTION BAR */}
      {selectedInvoices.size > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3 text-indigo-800 font-medium text-sm">
            <CheckSquare className="w-5 h-5 text-indigo-600" /> {selectedInvoices.size} Invoices Selected
          </div>
          {!showBulkEdit ? (
            <button onClick={() => setShowBulkEdit(true)}
              className="text-sm bg-white border border-indigo-300 text-indigo-700 px-4 py-2 rounded hover:bg-indigo-100 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Change Due Date
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input type="date" value={bulkDueDate} onChange={e => setBulkDueDate(e.target.value)}
                className="border border-indigo-300 px-3 py-1.5 rounded text-sm" />
              <button onClick={executeBulkDateChange}
                className="bg-indigo-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-indigo-700">Apply</button>
              <button onClick={() => setShowBulkEdit(false)} className="text-indigo-600 hover:text-indigo-800 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* TABLE */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="p-4 w-10">
                <button onClick={() => setSelectedInvoices(selectedInvoices.size === filteredInvoices.length ? new Set() : new Set(filteredInvoices.map(i => i.id)))}
                  className="text-gray-400 hover:text-blue-600">
                  <CheckSquare className="w-4 h-4" />
                </button>
              </th>
              <th className="p-4 font-medium text-gray-700">Invoice #</th>
              <th className="p-4 font-medium text-gray-700">Student</th>
              <th className="p-4 font-medium text-gray-700">Class</th>
              <th className="p-4 font-medium text-gray-700">Month</th>
              <th className="p-4 font-medium text-gray-700">Due Date</th>
              <th className="p-4 font-medium text-gray-700">Amount</th>
              <th className="p-4 font-medium text-gray-700">Balance</th>
              <th className="p-4 font-medium text-gray-700">Status</th>
              <th className="p-4 font-medium text-gray-700 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={10} className="p-8 text-center text-gray-500">Loading Invoices...</td></tr>
            ) : filteredInvoices.length === 0 ? (
              <tr><td colSpan={10} className="p-12 text-center text-gray-400">No invoices found.</td></tr>
            ) : filteredInvoices.map(inv => {
              const balance = (inv.total_amount || 0) - (inv.paid_amount || 0);
              const classInfo = inv.students?.classes;
              const classLabel = classInfo ? `${classInfo.name || ''}${classInfo.section ? ' ' + classInfo.section : ''}` : '-';
              return (
                <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4" onClick={() => toggleInvoice(inv.id)}>
                    {selectedInvoices.has(inv.id)
                      ? <CheckSquare className="w-4 h-4 text-blue-600 cursor-pointer" />
                      : <Square className="w-4 h-4 text-gray-400 cursor-pointer" />}
                  </td>
                  <td className="p-4 font-mono text-xs text-gray-600">{inv.invoice_number || 'INV-LEGACY'}</td>
                  <td className="p-4 font-medium text-gray-900">{inv.students?.full_name}</td>
                  <td className="p-4 text-gray-600">{classLabel}</td>
                  <td className="p-4 text-gray-600">
                    {new Date(inv.month_year).toLocaleString('default', { month: 'short', year: 'numeric' })}
                  </td>
                  <td className="p-4 text-gray-600">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '-'}</td>
                  <td className="p-4 font-bold text-gray-900">Rs. {Number(inv.total_amount).toLocaleString()}</td>
                  <td className={`p-4 font-bold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    Rs. {balance.toLocaleString()}
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${statusColor[inv.status] || 'bg-gray-100 text-gray-700'}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => handlePrintChallan(inv)} title="Print Challan"
                        className="p-1.5 text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded">
                        <Printer className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleSendWhatsApp(inv)} title="Send WhatsApp Reminder"
                        className="p-1.5 text-green-600 hover:text-green-800 bg-green-50 hover:bg-green-100 rounded">
                        <MessageCircle className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingInvoice(inv)} title="Edit Invoice"
                        className="p-1.5 text-gray-400 hover:text-blue-600 bg-gray-100 hover:bg-blue-50 rounded">
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MASS GENERATE MODAL */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="bg-blue-600 px-6 py-4 flex justify-between items-center text-white">
              <h3 className="font-bold text-lg">Mass Generate Invoices</h3>
              <button onClick={() => setShowGenerateModal(false)}><X className="w-5 h-5 opacity-80 hover:opacity-100" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
                Automatically generates invoices for all active students based on their class fee structure.
                Students with a 100% waiver are skipped.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Billing Month</label>
                <input type="month" value={generateMonth} onChange={e => setGenerateMonth(e.target.value)}
                  className="w-full border border-gray-300 px-3 py-2 rounded focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                <input type="date" value={generateDueDate} onChange={e => setGenerateDueDate(e.target.value)}
                  className="w-full border border-gray-300 px-3 py-2 rounded focus:ring-blue-500" />
              </div>
              <div className="flex items-start gap-2 pt-2">
                <input type="checkbox" id="admF" checked={includeAdmissionFee} onChange={e => setIncludeAdmissionFee(e.target.checked)}
                  className="mt-1 w-4 h-4 text-blue-600" />
                <label htmlFor="admF" className="text-sm font-medium text-gray-700">
                  Include Admission Fee
                  <br /><span className="font-normal text-gray-500 text-xs">Adds one-time admission cost from the fee matrix.</span>
                </label>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
              <button onClick={() => setShowGenerateModal(false)} className="px-4 py-2 font-medium text-gray-700 hover:bg-gray-200 rounded">Cancel</button>
              <button onClick={handleMassGenerate} disabled={generating}
                className="px-5 py-2 font-medium text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50">
                {generating ? 'Processing...' : 'Generate Invoices'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INVOICE EDITOR MODAL */}
      {editingInvoice && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 flex justify-between items-center border-b border-gray-200">
              <h3 className="font-bold text-lg text-gray-900">Edit Invoice</h3>
              <button onClick={() => setEditingInvoice(null)}><X className="w-5 h-5 text-gray-400 hover:text-gray-900" /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Due Date</label>
                  <input type="date" value={editingInvoice.due_date || ''}
                    onChange={e => setEditingInvoice({ ...editingInvoice, due_date: e.target.value })}
                    className="w-full border border-gray-300 px-3 py-2 rounded focus:ring-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Total Amount</label>
                  <input type="number" value={editingInvoice.total_amount}
                    onChange={e => setEditingInvoice({ ...editingInvoice, total_amount: parseFloat(e.target.value) })}
                    className="w-full border border-gray-300 px-3 py-2 rounded focus:ring-blue-500 text-sm font-bold" />
                </div>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-4 py-2 text-xs font-bold text-gray-600 uppercase border-b border-gray-200 flex justify-between items-center">
                  Line Items
                  <button onClick={() => setEditingInvoice({ ...editingInvoice, breakdown: [...(editingInvoice.breakdown || []), { item: 'New Item', amount: 0 }] })}
                    className="text-blue-600 hover:text-blue-800 flex items-center gap-1">
                    <PlusCircle className="w-3 h-3" /> Add
                  </button>
                </div>
                <div className="p-2 space-y-2">
                  {(editingInvoice.breakdown || []).map((bItem: any, idx: number) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input type="text" value={bItem.item}
                        onChange={e => {
                          const arr = [...editingInvoice.breakdown];
                          arr[idx] = { ...arr[idx], item: e.target.value };
                          setEditingInvoice({ ...editingInvoice, breakdown: arr });
                        }}
                        className="flex-1 text-sm px-2 py-1 border border-gray-200 rounded" />
                      <input type="number" value={bItem.amount}
                        onChange={e => {
                          const arr = [...editingInvoice.breakdown];
                          arr[idx] = { ...arr[idx], amount: parseFloat(e.target.value) };
                          setEditingInvoice({ ...editingInvoice, breakdown: arr });
                        }}
                        className="w-24 text-sm px-2 py-1 border border-gray-200 rounded text-right" />
                      <button onClick={() => {
                        const arr = editingInvoice.breakdown.filter((_: any, i: number) => i !== idx);
                        setEditingInvoice({ ...editingInvoice, breakdown: arr });
                      }} className="text-red-500 p-1"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                  {(!editingInvoice.breakdown || editingInvoice.breakdown.length === 0) && (
                    <p className="text-xs text-gray-400 text-center py-2">No line items. Standard invoice.</p>
                  )}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
              <button onClick={handleSaveInvoiceEdit}
                className="px-6 py-2 bg-blue-600 text-white rounded font-medium shadow flex items-center gap-2 hover:bg-blue-700">
                <Save className="w-4 h-4" /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
