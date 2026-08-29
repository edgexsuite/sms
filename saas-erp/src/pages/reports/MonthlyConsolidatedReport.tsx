import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Calendar, Download, Printer, Search, ChevronDown, ChevronUp,
  CreditCard, CheckCircle, AlertCircle, BarChart3, FileText, TrendingUp
} from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';
import { formatDate, formatDateTime, cn, getBase64Image } from '../../lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Card, Btn, Select } from '../../components/ui';

interface MonthSummary {
  month: string;        // YYYY-MM
  label: string;        // "Aug 2026"
  invoiceCount: number;
  totalAmount: number;
  collectedAmount: number;
  balance: number;
  paidCount: number;
  partialCount: number;
  pendingCount: number;
  collectionRate: number;
}

interface InvoiceRow {
  id: string;
  student_id: string;
  invoice_number: string;
  month_year: string;
  total_amount: number;
  paid_amount: number;
  status: string;
  students: {
    full_name: string;
    student_unique_id: string;
    roll_number: string;
    class_id: string;
    classes: { name: string; section: string } | null;
    parents: { father_name: string; whatsapp_number: string } | null;
  } | null;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function MonthlyConsolidatedReport() {
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [classFilter, setClassFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!userRole?.school_id) return;
    setLoading(true);
    const [{ data }, { data: cls }, { data: sch }] = await Promise.all([
      supabase.from('fee_records')
        .select(`*, students!inner(full_name, student_unique_id, roll_number, class_id, is_deleted, classes(name, section), parents(father_name, whatsapp_number))`)
        .eq('school_id', userRole.school_id)
        .eq('students.is_deleted', false)
        .is('deleted_at', null)
        .order('month_year', { ascending: false }),
      supabase.from('classes').select('id, name, section').eq('school_id', userRole.school_id).order('name'),
      supabase.from('schools').select('name, address, logo_url').eq('id', userRole.school_id).single(),
    ]);
    setInvoices((data || []) as InvoiceRow[]);
    if (cls) setClasses(cls);
    if (sch) setSchoolInfo(sch);
    setLoading(false);
  }, [userRole?.school_id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredInvoices = useMemo(() => {
    let list = invoices;
    if (classFilter) list = list.filter(r => r.students?.class_id === classFilter);
    if (yearFilter) list = list.filter(r => r.month_year?.startsWith(yearFilter));
    return list;
  }, [invoices, classFilter, yearFilter]);

  const monthSummaries = useMemo<MonthSummary[]>(() => {
    const map: Record<string, MonthSummary> = {};
    filteredInvoices.forEach(inv => {
      const m = inv.month_year?.slice(0, 7) || 'Unknown';
      if (!map[m]) {
        const [y, mo] = m.split('-');
        map[m] = {
          month: m,
          label: `${MONTH_NAMES[parseInt(mo) - 1] || mo} ${y}`,
          invoiceCount: 0, totalAmount: 0, collectedAmount: 0, balance: 0,
          paidCount: 0, partialCount: 0, pendingCount: 0, collectionRate: 0,
        };
      }
      const s = map[m];
      s.invoiceCount++;
      s.totalAmount += Number(inv.total_amount || 0);
      s.collectedAmount += Number(inv.paid_amount || 0);
      if (inv.status === 'paid') s.paidCount++;
      else if (inv.status === 'partial' || inv.status === 'partially paid') s.partialCount++;
      else s.pendingCount++;
    });
    Object.values(map).forEach(s => {
      s.balance = Math.max(0, s.totalAmount - s.collectedAmount);
      s.collectionRate = s.totalAmount > 0 ? Math.round((s.collectedAmount / s.totalAmount) * 100) : 0;
    });
    return Object.values(map).sort((a, b) => b.month.localeCompare(a.month));
  }, [filteredInvoices]);

  // Years for filter
  const years = useMemo(() => {
    const set = new Set<string>();
    invoices.forEach(r => { if (r.month_year) set.add(r.month_year.slice(0, 4)); });
    return Array.from(set).sort().reverse();
  }, [invoices]);

  // Grand totals
  const grandTotal = useMemo(() => monthSummaries.reduce((a, s) => ({
    invoices: a.invoices + s.invoiceCount,
    total: a.total + s.totalAmount,
    collected: a.collected + s.collectedAmount,
    balance: a.balance + s.balance,
  }), { invoices: 0, total: 0, collected: 0, balance: 0 }), [monthSummaries]);

  const detailRows = useMemo(() => {
    if (!expandedMonth) return [];
    return filteredInvoices.filter(r => r.month_year?.startsWith(expandedMonth));
  }, [expandedMonth, filteredInvoices]);

  // PDF
  const handlePDF = async () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pw = doc.internal.pageSize.width;

    if (schoolInfo?.logo_url) {
      try { doc.addImage(await getBase64Image(schoolInfo.logo_url), 'PNG', pw / 2 - 10, 8, 20, 20); } catch {}
    }
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text(schoolInfo?.name || '', pw / 2, 32, { align: 'center' });
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Monthly Consolidated Report | ${formatDateTime(new Date())}`, pw / 2, 39, { align: 'center' });
    doc.setDrawColor(200); doc.setLineWidth(0.3); doc.line(10, 42, pw - 10, 42);

    autoTable(doc, {
      startY: 47,
      head: [['Month', 'Invoices', 'Total Amount', 'Collected', 'Balance', 'Paid', 'Partial', 'Pending', 'Rate %']],
      body: monthSummaries.map(s => [
        s.label, s.invoiceCount,
        `Rs. ${s.totalAmount.toLocaleString()}`,
        `Rs. ${s.collectedAmount.toLocaleString()}`,
        `Rs. ${s.balance.toLocaleString()}`,
        s.paidCount, s.partialCount, s.pendingCount,
        `${s.collectionRate}%`,
      ]),
      foot: [['TOTAL', grandTotal.invoices, `Rs. ${grandTotal.total.toLocaleString()}`, `Rs. ${grandTotal.collected.toLocaleString()}`, `Rs. ${grandTotal.balance.toLocaleString()}`, '', '', '', '']],
      theme: 'grid',
      headStyles: { fillColor: [13, 21, 38], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      footStyles: { fillColor: [248, 250, 252], textColor: [13, 21, 38], fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i); doc.setFontSize(6); doc.setTextColor(160);
      doc.text(`${schoolInfo?.name || ''} — Confidential`, 10, 290);
      doc.text(`Page ${i} of ${pages}`, pw - 10, 290, { align: 'right' });
      doc.setTextColor(0);
    }
    doc.save(`Monthly_Consolidated_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleCSV = () => {
    exportToCSV('monthly-consolidated', monthSummaries, [
      { header: 'Month', key: 'label' },
      { header: 'Invoices', key: 'invoiceCount' },
      { header: 'Total Amount', key: 'totalAmount' },
      { header: 'Collected', key: 'collectedAmount' },
      { header: 'Balance', key: 'balance' },
      { header: 'Paid', key: 'paidCount' },
      { header: 'Partial', key: 'partialCount' },
      { header: 'Pending', key: 'pendingCount' },
      { header: 'Collection Rate %', key: 'collectionRate' },
    ]);
  };

  const rateColor = (rate: number) => {
    if (rate >= 90) return 'bg-emerald-500';
    if (rate >= 70) return 'bg-amber-500';
    if (rate >= 50) return 'bg-orange-500';
    return 'bg-rose-500';
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm no-print">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-violet-100">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900 uppercase tracking-tight">Monthly Consolidated</h1>
            <p className="text-[10px] text-slate-400 font-bold">Month-by-month invoice summary & collection rates</p>
          </div>
        </div>

        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
          {[
            { label: 'Total Invoiced', val: grandTotal.total, color: 'text-indigo-600', icon: CreditCard },
            { label: 'Collected', val: grandTotal.collected, color: 'text-emerald-600', icon: CheckCircle },
            { label: 'Outstanding', val: grandTotal.balance, color: 'text-rose-600', icon: AlertCircle },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 whitespace-nowrap">
              <div className={cn("p-1.5 rounded-lg bg-white shadow-sm", s.color)}><s.icon className="w-3.5 h-3.5" /></div>
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

      {/* Filters */}
      <Card className="p-2 shadow-sm border-slate-100 no-print">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <select value={classFilter} onChange={e => setClassFilter(e.target.value)}
            className="w-full px-3 py-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
          </select>
          <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
            className="w-full px-3 py-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">All Years</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </Card>

      {/* Month Cards */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-violet-100 border-t-violet-600 rounded-full animate-spin" />
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-4">Loading…</p>
        </div>
      ) : monthSummaries.length === 0 ? (
        <Card className="py-20 text-center shadow-sm">
          <Calendar className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-400">No fee records found.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {monthSummaries.map(s => (
            <div key={s.month}>
              <button
                onClick={() => setExpandedMonth(expandedMonth === s.month ? null : s.month)}
                className="w-full bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-all text-left"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-violet-50 rounded-xl flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-violet-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">{s.label}</h3>
                      <p className="text-[10px] text-slate-400 font-bold">{s.invoiceCount} invoices</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 flex-wrap">
                    <div className="text-center min-w-[80px]">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Invoiced</p>
                      <p className="text-xs font-black text-slate-900">Rs. {s.totalAmount.toLocaleString()}</p>
                    </div>
                    <div className="text-center min-w-[80px]">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Collected</p>
                      <p className="text-xs font-black text-emerald-600">Rs. {s.collectedAmount.toLocaleString()}</p>
                    </div>
                    <div className="text-center min-w-[80px]">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Balance</p>
                      <p className="text-xs font-black text-rose-600">Rs. {s.balance.toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-black">{s.paidCount} Paid</span>
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px] font-black">{s.partialCount} Partial</span>
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded text-[9px] font-black">{s.pendingCount} Pending</span>
                      </div>
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className={cn('h-full rounded-full transition-all', rateColor(s.collectionRate))}
                            style={{ width: `${s.collectionRate}%` }} />
                        </div>
                        <span className="text-[10px] font-black text-slate-600">{s.collectionRate}%</span>
                      </div>
                    </div>
                    {expandedMonth === s.month ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                  </div>
                </div>
              </button>

              {/* Expanded detail */}
              {expandedMonth === s.month && (
                <div className="mt-1 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          {['#', 'Adm No', 'Roll', 'Student', 'Class', 'Father', 'WhatsApp', 'Invoice', 'Total', 'Paid', 'Balance', 'Status'].map(h => (
                            <th key={h} className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest text-[10px]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detailRows.map((r, i) => {
                          const bal = Math.max(0, Number(r.total_amount) - Number(r.paid_amount));
                          const cls = r.students?.classes ? `${r.students.classes.name}${r.students.classes.section ? `-${r.students.classes.section}` : ''}` : '—';
                          return (
                            <tr key={r.id} className="hover:bg-slate-50/50">
                              <td className="px-4 py-2.5 text-slate-300 font-bold">{i + 1}</td>
                              <td className="px-4 py-2.5 font-mono text-[10px] text-slate-500">{r.students?.student_unique_id || '—'}</td>
                              <td className="px-4 py-2.5 font-bold text-slate-600">{r.students?.roll_number || '—'}</td>
                              <td className="px-4 py-2.5 font-bold text-slate-900 uppercase">{r.students?.full_name || '—'}</td>
                              <td className="px-4 py-2.5 font-bold text-slate-600">{cls}</td>
                              <td className="px-4 py-2.5 font-bold text-slate-600">{r.students?.parents?.father_name || '—'}</td>
                              <td className="px-4 py-2.5 font-mono text-[10px] text-slate-500">{r.students?.parents?.whatsapp_number || '—'}</td>
                              <td className="px-4 py-2.5 font-mono text-[10px] text-slate-400">{r.invoice_number || '—'}</td>
                              <td className="px-4 py-2.5 font-bold text-slate-700">{Number(r.total_amount).toLocaleString()}</td>
                              <td className="px-4 py-2.5 font-bold text-emerald-600">{Number(r.paid_amount).toLocaleString()}</td>
                              <td className="px-4 py-2.5 font-bold text-rose-600">{bal > 0 ? bal.toLocaleString() : '0'}</td>
                              <td className="px-4 py-2.5">
                                <span className={cn('px-2 py-0.5 rounded text-[9px] font-black uppercase',
                                  r.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                                  (r.status === 'partial' || r.status === 'partially paid') ? 'bg-amber-100 text-amber-700' :
                                  'bg-rose-100 text-rose-700'
                                )}>{r.status}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Grand total bar */}
          <div className="bg-[#0d1526] rounded-2xl p-4 flex flex-wrap justify-between items-center gap-4 text-white">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Grand Total ({monthSummaries.length} months)</span>
            <div className="flex gap-6">
              {[
                { label: 'Invoices', val: grandTotal.invoices },
                { label: 'Invoiced', val: `Rs. ${grandTotal.total.toLocaleString()}` },
                { label: 'Collected', val: `Rs. ${grandTotal.collected.toLocaleString()}` },
                { label: 'Balance', val: `Rs. ${grandTotal.balance.toLocaleString()}` },
              ].map(g => (
                <div key={g.label} className="text-right">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{g.label}</p>
                  <p className="text-sm font-black">{g.val}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
