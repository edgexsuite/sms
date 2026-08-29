import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  BarChart3, Download, Printer, CreditCard, CheckCircle, AlertCircle, Users
} from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';
import { formatDate, formatDateTime, cn, getBase64Image } from '../../lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Card, Btn } from '../../components/ui';

interface ClassSummary {
  class_id: string;
  className: string;
  totalStudents: number;
  totalFee: number;
  collected: number;
  balance: number;
  collectionRate: number;
  paidCount: number;
  partialCount: number;
  pendingCount: number;
}

export default function ClassFeeSummary() {
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ClassSummary[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [monthFilter, setMonthFilter] = useState('');
  const [months, setMonths] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    if (!userRole?.school_id) return;
    setLoading(true);

    const [{ data }, { data: cls }, { data: sch }] = await Promise.all([
      supabase.from('fee_records')
        .select(`student_id, total_amount, paid_amount, status, month_year,
          students!inner(id, class_id, is_deleted, classes(name, section))`)
        .eq('school_id', userRole.school_id)
        .eq('students.is_deleted', false)
        .is('deleted_at', null),
      supabase.from('classes').select('id, name, section').eq('school_id', userRole.school_id).order('name'),
      supabase.from('schools').select('name, address, logo_url').eq('id', userRole.school_id).single(),
    ]);

    if (cls) setClasses(cls);
    if (sch) setSchoolInfo(sch);

    // Extract months
    const monthSet = new Set<string>();
    (data || []).forEach((r: any) => { if (r.month_year) monthSet.add(r.month_year.slice(0, 7)); });
    setMonths(Array.from(monthSet).sort().reverse());

    // Filter by month if set
    let filtered = data || [];
    if (monthFilter) {
      const m = `${monthFilter}-01`;
      filtered = filtered.filter((r: any) => r.month_year === m);
    }

    // Group by class
    const classMap: Record<string, ClassSummary> = {};
    // Seed from classes list
    (cls || []).forEach((c: any) => {
      classMap[c.id] = {
        class_id: c.id,
        className: `${c.name}${c.section ? `-${c.section}` : ''}`,
        totalStudents: 0, totalFee: 0, collected: 0, balance: 0,
        collectionRate: 0, paidCount: 0, partialCount: 0, pendingCount: 0,
      };
    });

    const studentsSeen: Record<string, Set<string>> = {};
    filtered.forEach((r: any) => {
      const cid = r.students?.class_id;
      if (!cid || !classMap[cid]) return;

      const s = classMap[cid];
      // Count unique students
      if (!studentsSeen[cid]) studentsSeen[cid] = new Set();
      studentsSeen[cid].add(r.student_id);

      s.totalFee += Number(r.total_amount || 0);
      s.collected += Number(r.paid_amount || 0);
      if (r.status === 'paid') s.paidCount++;
      else if (r.status === 'partial' || r.status === 'partially paid') s.partialCount++;
      else s.pendingCount++;
    });

    Object.values(classMap).forEach(s => {
      const cid = s.class_id;
      s.totalStudents = studentsSeen[cid]?.size || 0;
      s.balance = Math.max(0, s.totalFee - s.collected);
      s.collectionRate = s.totalFee > 0 ? Math.round((s.collected / s.totalFee) * 100) : 0;
    });

    // Only show classes that have data
    const result = Object.values(classMap).filter(s => s.totalStudents > 0 || s.totalFee > 0);
    result.sort((a, b) => a.className.localeCompare(b.className, undefined, { numeric: true }));
    setRows(result);
    setLoading(false);
  }, [userRole?.school_id, monthFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const grand = useMemo(() => rows.reduce((a, r) => ({
    students: a.students + r.totalStudents,
    total: a.total + r.totalFee,
    collected: a.collected + r.collected,
    balance: a.balance + r.balance,
  }), { students: 0, total: 0, collected: 0, balance: 0 }), [rows]);

  const grandRate = grand.total > 0 ? Math.round((grand.collected / grand.total) * 100) : 0;

  const rateColor = (rate: number) => {
    if (rate >= 90) return 'bg-emerald-500';
    if (rate >= 70) return 'bg-amber-500';
    if (rate >= 50) return 'bg-orange-500';
    return 'bg-rose-500';
  };

  const rateText = (rate: number) => {
    if (rate >= 90) return 'text-emerald-600';
    if (rate >= 70) return 'text-amber-600';
    if (rate >= 50) return 'text-orange-600';
    return 'text-rose-600';
  };

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
    doc.text(`Class-wise Fee Summary${monthFilter ? ` — ${monthFilter}` : ' — All Months'} | ${formatDateTime(new Date())}`, pw / 2, 39, { align: 'center' });
    doc.setDrawColor(200); doc.setLineWidth(0.3); doc.line(10, 42, pw - 10, 42);

    autoTable(doc, {
      startY: 47,
      head: [['Class', 'Students', 'Total Fee', 'Collected', 'Balance', 'Paid', 'Partial', 'Pending', 'Rate']],
      body: rows.map(r => [
        r.className, r.totalStudents,
        `Rs. ${r.totalFee.toLocaleString()}`,
        `Rs. ${r.collected.toLocaleString()}`,
        `Rs. ${r.balance.toLocaleString()}`,
        r.paidCount, r.partialCount, r.pendingCount,
        `${r.collectionRate}%`,
      ]),
      foot: [['TOTAL', grand.students, `Rs. ${grand.total.toLocaleString()}`, `Rs. ${grand.collected.toLocaleString()}`, `Rs. ${grand.balance.toLocaleString()}`, '', '', '', `${grandRate}%`]],
      theme: 'grid',
      headStyles: { fillColor: [13, 21, 38], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      footStyles: { fillColor: [248, 250, 252], textColor: [13, 21, 38], fontStyle: 'bold', fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 3 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i); doc.setFontSize(6); doc.setTextColor(160);
      doc.text(`${schoolInfo?.name || ''} — Confidential`, 10, 290);
      doc.text(`Page ${i} of ${pages}`, pw - 10, 290, { align: 'right' });
      doc.setTextColor(0);
    }
    doc.save(`Class_Fee_Summary_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleCSV = () => {
    exportToCSV('class-fee-summary', rows, [
      { header: 'Class', key: 'className' },
      { header: 'Students', key: 'totalStudents' },
      { header: 'Total Fee', key: 'totalFee' },
      { header: 'Collected', key: 'collected' },
      { header: 'Balance', key: 'balance' },
      { header: 'Paid', key: 'paidCount' },
      { header: 'Partial', key: 'partialCount' },
      { header: 'Pending', key: 'pendingCount' },
      { header: 'Collection %', key: 'collectionRate' },
    ]);
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm no-print">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-teal-100">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900 uppercase tracking-tight">Class Fee Summary</h1>
            <p className="text-[10px] text-slate-400 font-bold">One row per class — total fee, collection, balance</p>
          </div>
        </div>

        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
          {[
            { label: 'Total Fee', val: grand.total, color: 'text-indigo-600', icon: CreditCard },
            { label: 'Collected', val: grand.collected, color: 'text-emerald-600', icon: CheckCircle },
            { label: 'Balance', val: grand.balance, color: 'text-rose-600', icon: AlertCircle },
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

      {/* Month Filter */}
      <Card className="p-2 shadow-sm border-slate-100 no-print">
        <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
          className="w-full sm:w-64 px-3 py-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All Months (Cumulative)</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </Card>

      {/* Table */}
      <Card className="shadow-sm border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-teal-100 border-t-teal-600 rounded-full animate-spin" />
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-4">Loading…</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <BarChart3 className="w-10 h-10 text-slate-200 mb-3" />
            <p className="text-sm font-bold text-slate-400">No fee data found for the selected period.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-[#0d1526] sticky top-0 z-10">
                <tr>
                  {['Class', 'Students', 'Total Fee', 'Collected', 'Balance', 'Paid', 'Partial', 'Pending', 'Collection Rate'].map(h => (
                    <th key={h} className="px-5 py-4 font-black text-slate-400 uppercase tracking-widest text-[10px] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(r => (
                  <tr key={r.class_id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4 font-black text-slate-900 uppercase">{r.className}</td>
                    <td className="px-5 py-4 font-bold text-slate-600">{r.totalStudents}</td>
                    <td className="px-5 py-4 font-bold text-slate-700">Rs. {r.totalFee.toLocaleString()}</td>
                    <td className="px-5 py-4 font-bold text-emerald-600">Rs. {r.collected.toLocaleString()}</td>
                    <td className="px-5 py-4 font-bold text-rose-600">Rs. {r.balance.toLocaleString()}</td>
                    <td className="px-5 py-4"><span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-black">{r.paidCount}</span></td>
                    <td className="px-5 py-4"><span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px] font-black">{r.partialCount}</span></td>
                    <td className="px-5 py-4"><span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded text-[9px] font-black">{r.pendingCount}</span></td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden min-w-[80px]">
                          <div className={cn('h-full rounded-full transition-all', rateColor(r.collectionRate))}
                            style={{ width: `${r.collectionRate}%` }} />
                        </div>
                        <span className={cn('text-xs font-black w-10 text-right', rateText(r.collectionRate))}>{r.collectionRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Grand total row */}
        {!loading && rows.length > 0 && (
          <div className="bg-[#0d1526] text-white px-5 py-4 flex flex-wrap justify-between items-center gap-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Grand Total ({rows.length} classes)</span>
            <div className="flex gap-8">
              {[
                { label: 'Students', val: grand.students },
                { label: 'Total Fee', val: `Rs. ${grand.total.toLocaleString()}` },
                { label: 'Collected', val: `Rs. ${grand.collected.toLocaleString()}` },
                { label: 'Balance', val: `Rs. ${grand.balance.toLocaleString()}` },
                { label: 'Rate', val: `${grandRate}%` },
              ].map(g => (
                <div key={g.label} className="text-right">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{g.label}</p>
                  <p className="text-sm font-black">{g.val}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
