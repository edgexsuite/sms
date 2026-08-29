import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  FileText, Search, Download, Printer, Filter, CreditCard,
  CheckCircle, AlertCircle, Clock, Users, ChevronDown
} from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';
import { formatDate, formatDateTime, cn, getBase64Image } from '../../lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PageHeader, Card, Btn, Badge, Select, Input } from '../../components/ui';

type StatusFilter = 'all' | 'pending' | 'partial' | 'paid';

interface FeeRow {
  id: string;
  student_id: string;
  invoice_number: string;
  month_year: string;
  total_amount: number;
  paid_amount: number;
  status: string;
  due_date: string;
  students: {
    id: string;
    full_name: string;
    student_unique_id: string;
    roll_number: string;
    class_id: string;
    fee_waiver_percentage: number;
    is_deleted: boolean;
    classes: { name: string; section: string } | null;
    parents: { father_name: string; whatsapp_number: string } | null;
  } | null;
}

export default function FeeStatusReport() {
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<FeeRow[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [classFilter, setClassFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [search, setSearch] = useState('');

  const fetchMeta = useCallback(async () => {
    if (!userRole?.school_id) return;
    const [{ data: cls }, { data: sch }] = await Promise.all([
      supabase.from('classes').select('id, name, section').eq('school_id', userRole.school_id).order('name'),
      supabase.from('schools').select('name, address, logo_url').eq('id', userRole.school_id).single(),
    ]);
    if (cls) setClasses(cls);
    if (sch) setSchoolInfo(sch);
  }, [userRole?.school_id]);

  const fetchRecords = useCallback(async () => {
    if (!userRole?.school_id) return;
    setLoading(true);
    const { data } = await supabase
      .from('fee_records')
      .select(`*, students!inner(id, full_name, student_unique_id, roll_number, class_id, fee_waiver_percentage, is_deleted, classes(name, section), parents(father_name, whatsapp_number))`)
      .eq('school_id', userRole.school_id)
      .eq('students.is_deleted', false)
      .is('deleted_at', null)
      .order('month_year', { ascending: false });
    setRecords((data || []) as FeeRow[]);
    setLoading(false);
  }, [userRole?.school_id]);

  useEffect(() => { fetchMeta(); }, [fetchMeta]);
  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const filtered = useMemo(() => {
    let list = records;

    // Status
    if (statusFilter !== 'all') {
      list = list.filter(r => {
        if (statusFilter === 'pending') return r.status === 'pending' || r.status === 'unpaid';
        if (statusFilter === 'partial') return r.status === 'partial' || r.status === 'partially paid';
        if (statusFilter === 'paid') return r.status === 'paid';
        return true;
      });
    }

    // Class
    if (classFilter) list = list.filter(r => r.students?.class_id === classFilter);

    // Month
    if (monthFilter) {
      const m = `${monthFilter}-01`;
      list = list.filter(r => r.month_year === m);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.students?.full_name?.toLowerCase().includes(q) ||
        String(r.students?.roll_number).includes(q) ||
        r.students?.student_unique_id?.toLowerCase().includes(q) ||
        r.students?.parents?.father_name?.toLowerCase().includes(q) ||
        r.invoice_number?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [records, statusFilter, classFilter, monthFilter, search]);

  // Stats
  const stats = useMemo(() => {
    const total = filtered.reduce((s, r) => s + Number(r.total_amount || 0), 0);
    const collected = filtered.reduce((s, r) => s + Number(r.paid_amount || 0), 0);
    const balance = Math.max(0, total - collected);
    const pending = filtered.filter(r => r.status === 'pending' || r.status === 'unpaid').length;
    const partial = filtered.filter(r => r.status === 'partial' || r.status === 'partially paid').length;
    const paid = filtered.filter(r => r.status === 'paid').length;
    return { total, collected, balance, pending, partial, paid, count: filtered.length };
  }, [filtered]);

  // Unique months for filter
  const months = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => { if (r.month_year) set.add(r.month_year.slice(0, 7)); });
    return Array.from(set).sort().reverse();
  }, [records]);

  const clsLabel = (r: FeeRow) =>
    r.students?.classes ? `${r.students.classes.name}${r.students.classes.section ? `-${r.students.classes.section}` : ''}` : '—';

  const statusBadge = (s: string) => {
    if (s === 'paid') return 'bg-emerald-100 text-emerald-700';
    if (s === 'partial' || s === 'partially paid') return 'bg-amber-100 text-amber-700';
    return 'bg-rose-100 text-rose-700';
  };

  // PDF Export
  const handlePDF = async () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const pw = doc.internal.pageSize.width;

    if (schoolInfo?.logo_url) {
      try { doc.addImage(await getBase64Image(schoolInfo.logo_url), 'PNG', pw / 2 - 10, 8, 20, 20); } catch {}
    }

    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text(schoolInfo?.name || 'Fee Status Report', pw / 2, 32, { align: 'center' });
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(`Fee Status Report — ${statusFilter === 'all' ? 'All Statuses' : statusFilter.toUpperCase()} | Generated: ${formatDateTime(new Date())}`, pw / 2, 39, { align: 'center' });

    doc.setDrawColor(200); doc.setLineWidth(0.3); doc.line(10, 42, pw - 10, 42);

    // Stats row
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text(`Records: ${stats.count}  |  Invoiced: Rs. ${stats.total.toLocaleString()}  |  Collected: Rs. ${stats.collected.toLocaleString()}  |  Balance: Rs. ${stats.balance.toLocaleString()}`, pw / 2, 47, { align: 'center' });

    autoTable(doc, {
      startY: 52,
      head: [['#', 'Adm No', 'Roll', 'Student Name', 'Class', 'Father Name', 'WhatsApp', 'Month', 'Invoice', 'Total', 'Paid', 'Balance', 'Status']],
      body: filtered.map((r, i) => [
        i + 1,
        r.students?.student_unique_id || '—',
        r.students?.roll_number || '—',
        r.students?.full_name || '—',
        clsLabel(r),
        r.students?.parents?.father_name || '—',
        r.students?.parents?.whatsapp_number || '—',
        formatDate(r.month_year),
        r.invoice_number || '—',
        Number(r.total_amount).toLocaleString(),
        Number(r.paid_amount).toLocaleString(),
        Math.max(0, Number(r.total_amount) - Number(r.paid_amount)).toLocaleString(),
        r.status?.toUpperCase(),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [13, 21, 38], textColor: 255, fontStyle: 'bold', fontSize: 6.5 },
      styles: { fontSize: 6, cellPadding: 1.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    // Footer
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i); doc.setFontSize(6); doc.setTextColor(160);
      doc.text(`${schoolInfo?.name || ''} — Confidential`, 10, 205);
      doc.text(`Page ${i} of ${pages}`, pw - 10, 205, { align: 'right' });
      doc.setTextColor(0);
    }

    doc.save(`Fee_Status_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // CSV Export
  const handleCSV = () => {
    exportToCSV('fee-status-report', filtered, [
      { header: 'Adm No', key: (r: any) => r.students?.student_unique_id },
      { header: 'Roll No', key: (r: any) => r.students?.roll_number },
      { header: 'Student Name', key: (r: any) => r.students?.full_name },
      { header: 'Class', key: (r: any) => clsLabel(r) },
      { header: 'Father Name', key: (r: any) => r.students?.parents?.father_name },
      { header: 'WhatsApp', key: (r: any) => r.students?.parents?.whatsapp_number },
      { header: 'Month', key: (r: any) => formatDate(r.month_year) },
      { header: 'Invoice', key: 'invoice_number' },
      { header: 'Total', key: 'total_amount' },
      { header: 'Paid', key: 'paid_amount' },
      { header: 'Balance', key: (r: any) => Math.max(0, r.total_amount - r.paid_amount) },
      { header: 'Status', key: 'status' },
    ]);
  };

  const STATUS_TABS: { key: StatusFilter; label: string; icon: any; color: string }[] = [
    { key: 'all',     label: 'All',     icon: Users,       color: 'indigo' },
    { key: 'pending', label: 'Pending', icon: AlertCircle, color: 'rose'   },
    { key: 'partial', label: 'Partial', icon: Clock,       color: 'amber'  },
    { key: 'paid',    label: 'Paid',    icon: CheckCircle, color: 'emerald' },
  ];

  return (
    <div className="max-w-[1600px] mx-auto space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm no-print">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900 uppercase tracking-tight">Fee Status Report</h1>
            <p className="text-[10px] text-slate-400 font-bold">Filter by Pending, Partial, or Paid</p>
          </div>
        </div>

        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
          {[
            { label: 'Invoiced', val: stats.total, color: 'text-indigo-600', icon: CreditCard },
            { label: 'Collected', val: stats.collected, color: 'text-emerald-600', icon: CheckCircle },
            { label: 'Balance', val: stats.balance, color: 'text-rose-600', icon: AlertCircle },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 whitespace-nowrap">
              <div className={cn("p-1.5 rounded-lg bg-white shadow-sm", s.color)}>
                <s.icon className="w-3.5 h-3.5" />
              </div>
              <div className="leading-tight">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
                <p className={cn("text-xs font-black", s.color)}>Rs. {s.val.toLocaleString()}</p>
              </div>
            </div>
          ))}
          <div className="h-8 w-px bg-slate-200 mx-1 shrink-0" />
          <Btn variant="outline" size="sm" onClick={handleCSV} className="text-[10px] h-9 px-3">CSV</Btn>
          <Btn variant="outline" size="sm" onClick={() => window.print()} className="text-[10px] h-9 px-3"><Printer className="w-3 h-3" /></Btn>
          <Btn variant="primary" size="sm" onClick={handlePDF} className="text-[10px] h-9 px-3 font-black">PDF REPORT</Btn>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar no-print">
        {STATUS_TABS.map(t => {
          const count = t.key === 'all' ? stats.count : t.key === 'pending' ? stats.pending : t.key === 'partial' ? stats.partial : stats.paid;
          return (
            <button key={t.key} onClick={() => setStatusFilter(t.key)}
              className={cn(
                'flex items-center gap-2 px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all border whitespace-nowrap',
                statusFilter === t.key
                  ? `bg-${t.color}-600 text-white border-${t.color}-600 shadow-lg`
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
              )}
              style={statusFilter === t.key ? {
                backgroundColor: t.color === 'indigo' ? '#4f46e5' : t.color === 'rose' ? '#e11d48' : t.color === 'amber' ? '#d97706' : '#059669',
                color: 'white', borderColor: 'transparent',
              } : {}}>
              <t.icon className="w-4 h-4" />
              {t.label}
              <span className={cn('px-2 py-0.5 rounded-lg text-[10px]',
                statusFilter === t.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500')}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <Card className="p-2 shadow-sm border-slate-100 no-print">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, roll no, admission no..."
              className="w-full pl-9 pr-3 py-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <select value={classFilter} onChange={e => setClassFilter(e.target.value)}
            className="w-full px-3 py-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
          </select>
          <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
            className="w-full px-3 py-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">All Months</option>
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card className="shadow-sm border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-4">Loading Records…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search className="w-10 h-10 text-slate-200 mb-3" />
            <p className="text-sm font-bold text-slate-400">No records match your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-[#0d1526] sticky top-0 z-10">
                <tr>
                  {['Sr', 'Adm No', 'Roll', 'Student Name', 'Class', 'Father Name', 'WhatsApp', 'Month', 'Invoice', 'Total', 'Paid', 'Balance', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3.5 font-black text-slate-400 uppercase tracking-widest text-[10px] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r, i) => {
                  const bal = Math.max(0, Number(r.total_amount) - Number(r.paid_amount));
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-bold text-slate-300">{i + 1}</td>
                      <td className="px-4 py-3 font-bold text-slate-600 font-mono text-[10px]">{r.students?.student_unique_id || '—'}</td>
                      <td className="px-4 py-3 font-bold text-slate-600">{r.students?.roll_number || '—'}</td>
                      <td className="px-4 py-3 font-bold text-slate-900 uppercase">{r.students?.full_name || '—'}</td>
                      <td className="px-4 py-3 font-bold text-slate-600">{clsLabel(r)}</td>
                      <td className="px-4 py-3 font-bold text-slate-600">{r.students?.parents?.father_name || '—'}</td>
                      <td className="px-4 py-3 font-bold text-slate-500 font-mono text-[10px]">{r.students?.parents?.whatsapp_number || '—'}</td>
                      <td className="px-4 py-3 font-bold text-slate-500">{formatDate(r.month_year)}</td>
                      <td className="px-4 py-3 font-mono text-[10px] text-slate-400">{r.invoice_number || '—'}</td>
                      <td className="px-4 py-3 font-bold text-slate-700">{Number(r.total_amount).toLocaleString()}</td>
                      <td className="px-4 py-3 font-bold text-emerald-600">{Number(r.paid_amount).toLocaleString()}</td>
                      <td className="px-4 py-3 font-bold text-rose-600">{bal > 0 ? bal.toLocaleString() : '0'}</td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest', statusBadge(r.status))}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer totals */}
        {!loading && filtered.length > 0 && (
          <div className="bg-slate-50 px-6 py-4 flex flex-wrap justify-between items-center gap-4 border-t border-slate-200">
            <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">
              Total Records: <span className="text-slate-900 ml-1">{filtered.length}</span>
            </span>
            <div className="flex gap-6">
              <div className="text-right">
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Invoiced</p>
                <p className="text-sm font-black text-slate-900">Rs. {stats.total.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Collected</p>
                <p className="text-sm font-black text-emerald-600">Rs. {stats.collected.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Balance</p>
                <p className="text-sm font-black text-rose-600">Rs. {stats.balance.toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
