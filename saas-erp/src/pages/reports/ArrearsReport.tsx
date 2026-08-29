import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  AlertTriangle, Download, Printer, Search, CreditCard,
  CheckCircle, AlertCircle, Clock, MessageCircle
} from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';
import { formatDate, formatDateTime, cn, getBase64Image } from '../../lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Card, Btn } from '../../components/ui';

interface ArrearStudent {
  student_id: string;
  studentName: string;
  admNo: string;
  rollNo: string;
  className: string;
  fatherName: string;
  whatsapp: string;
  overdueMonths: string[];
  totalArrears: number;
  ageBucket: '1 month' | '2-3 months' | '3-6 months' | '6+ months';
  oldestDue: string;
}

export default function ArrearsReport() {
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [arrears, setArrears] = useState<ArrearStudent[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);

  const [classFilter, setClassFilter] = useState('');
  const [minAmount, setMinAmount] = useState('1');
  const [bucketFilter, setBucketFilter] = useState('');
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    if (!userRole?.school_id) return;
    setLoading(true);

    const [{ data }, { data: cls }, { data: sch }] = await Promise.all([
      supabase.from('fee_records')
        .select(`*, students!inner(id, full_name, student_unique_id, roll_number, class_id, is_deleted, classes(name, section), parents(father_name, whatsapp_number))`)
        .eq('school_id', userRole.school_id)
        .eq('students.is_deleted', false)
        .is('deleted_at', null)
        .in('status', ['pending', 'partial', 'partially paid', 'unpaid'])
        .order('month_year', { ascending: true }),
      supabase.from('classes').select('id, name, section').eq('school_id', userRole.school_id).order('name'),
      supabase.from('schools').select('name, address, logo_url').eq('id', userRole.school_id).single(),
    ]);

    if (cls) setClasses(cls);
    if (sch) setSchoolInfo(sch);

    // Group by student
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const studentMap: Record<string, ArrearStudent> = {};

    (data || []).forEach((r: any) => {
      const monthKey = r.month_year?.slice(0, 7) || '';
      // Only count months older than current as arrears
      if (monthKey >= currentMonth) return;

      const sid = r.student_id;
      const bal = Math.max(0, Number(r.total_amount || 0) - Number(r.paid_amount || 0));
      if (bal <= 0) return;

      const s = r.students;
      const cls = s?.classes;
      if (!studentMap[sid]) {
        studentMap[sid] = {
          student_id: sid,
          studentName: s?.full_name || '—',
          admNo: s?.student_unique_id || '—',
          rollNo: s?.roll_number || '—',
          className: cls ? `${cls.name}${cls.section ? `-${cls.section}` : ''}` : '—',
          fatherName: s?.parents?.father_name || '—',
          whatsapp: s?.parents?.whatsapp_number || '—',
          overdueMonths: [],
          totalArrears: 0,
          ageBucket: '1 month',
          oldestDue: monthKey,
        };
      }
      studentMap[sid].overdueMonths.push(monthKey);
      studentMap[sid].totalArrears += bal;
      if (monthKey < studentMap[sid].oldestDue) studentMap[sid].oldestDue = monthKey;
    });

    // Calculate age bucket
    Object.values(studentMap).forEach(s => {
      const oldest = new Date(s.oldestDue + '-01');
      const diffMonths = (now.getFullYear() - oldest.getFullYear()) * 12 + (now.getMonth() - oldest.getMonth());
      if (diffMonths >= 6) s.ageBucket = '6+ months';
      else if (diffMonths >= 3) s.ageBucket = '3-6 months';
      else if (diffMonths >= 2) s.ageBucket = '2-3 months';
      else s.ageBucket = '1 month';
    });

    setArrears(Object.values(studentMap).sort((a, b) => b.totalArrears - a.totalArrears));
    setLoading(false);
  }, [userRole?.school_id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    let list = arrears;
    if (classFilter) {
      // Need to filter by class_id which isn't directly stored, so filter by className
      const cls = classes.find(c => c.id === classFilter);
      if (cls) {
        const label = `${cls.name}${cls.section ? `-${cls.section}` : ''}`;
        list = list.filter(r => r.className === label);
      }
    }
    if (minAmount) list = list.filter(r => r.totalArrears >= Number(minAmount));
    if (bucketFilter) list = list.filter(r => r.ageBucket === bucketFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.studentName.toLowerCase().includes(q) ||
        r.admNo.toLowerCase().includes(q) ||
        r.fatherName.toLowerCase().includes(q) ||
        r.rollNo.includes(q)
      );
    }
    return list;
  }, [arrears, classFilter, minAmount, bucketFilter, search, classes]);

  const totalArrears = filtered.reduce((s, r) => s + r.totalArrears, 0);

  const bucketCounts = useMemo(() => ({
    '1 month': filtered.filter(r => r.ageBucket === '1 month').length,
    '2-3 months': filtered.filter(r => r.ageBucket === '2-3 months').length,
    '3-6 months': filtered.filter(r => r.ageBucket === '3-6 months').length,
    '6+ months': filtered.filter(r => r.ageBucket === '6+ months').length,
  }), [filtered]);

  const bucketColor = (b: string) => {
    if (b === '1 month') return 'bg-amber-100 text-amber-700 border-amber-200';
    if (b === '2-3 months') return 'bg-orange-100 text-orange-700 border-orange-200';
    if (b === '3-6 months') return 'bg-rose-100 text-rose-700 border-rose-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  const rowBorder = (b: string) => {
    if (b === '1 month') return 'border-l-amber-400';
    if (b === '2-3 months') return 'border-l-orange-400';
    if (b === '3-6 months') return 'border-l-rose-400';
    return 'border-l-red-600';
  };

  // PDF
  const handlePDF = async () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const pw = doc.internal.pageSize.width;

    if (schoolInfo?.logo_url) {
      try { doc.addImage(await getBase64Image(schoolInfo.logo_url), 'PNG', pw / 2 - 10, 8, 20, 20); } catch {}
    }
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text(schoolInfo?.name || '', pw / 2, 32, { align: 'center' });
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Arrears / Carry-Forward Report | ${formatDateTime(new Date())}`, pw / 2, 39, { align: 'center' });
    doc.setDrawColor(200); doc.setLineWidth(0.3); doc.line(10, 42, pw - 10, 42);

    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text(`Students: ${filtered.length}  |  Total Arrears: Rs. ${totalArrears.toLocaleString()}`, pw / 2, 47, { align: 'center' });

    autoTable(doc, {
      startY: 52,
      head: [['#', 'Adm No', 'Roll', 'Student', 'Class', 'Father', 'WhatsApp', 'Overdue Months', 'Arrears (Rs.)', 'Severity']],
      body: filtered.map((r, i) => [
        i + 1, r.admNo, r.rollNo, r.studentName, r.className, r.fatherName, r.whatsapp,
        r.overdueMonths.join(', '),
        r.totalArrears.toLocaleString(),
        r.ageBucket.toUpperCase(),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [13, 21, 38], textColor: 255, fontStyle: 'bold', fontSize: 6.5 },
      styles: { fontSize: 6, cellPadding: 1.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i); doc.setFontSize(6); doc.setTextColor(160);
      doc.text(`${schoolInfo?.name || ''} — Confidential`, 10, 205);
      doc.text(`Page ${i} of ${pages}`, pw - 10, 205, { align: 'right' });
      doc.setTextColor(0);
    }
    doc.save(`Arrears_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleCSV = () => {
    exportToCSV('arrears-report', filtered, [
      { header: 'Adm No', key: 'admNo' },
      { header: 'Roll', key: 'rollNo' },
      { header: 'Student', key: 'studentName' },
      { header: 'Class', key: 'className' },
      { header: 'Father', key: 'fatherName' },
      { header: 'WhatsApp', key: 'whatsapp' },
      { header: 'Overdue Months', key: (r: any) => r.overdueMonths.join(', ') },
      { header: 'Total Arrears', key: 'totalArrears' },
      { header: 'Severity', key: 'ageBucket' },
    ]);
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm no-print">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-rose-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-rose-100">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900 uppercase tracking-tight">Arrears Report</h1>
            <p className="text-[10px] text-slate-400 font-bold">Overdue balances from previous months</p>
          </div>
        </div>

        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-3 px-4 py-2 bg-rose-50 rounded-xl border border-rose-100 whitespace-nowrap">
            <div className="p-1.5 rounded-lg bg-white shadow-sm text-rose-600"><AlertCircle className="w-3.5 h-3.5" /></div>
            <div className="leading-tight">
              <p className="text-[8px] font-black text-rose-400 uppercase tracking-widest">Total Arrears</p>
              <p className="text-xs font-black text-rose-600">Rs. {totalArrears.toLocaleString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 whitespace-nowrap">
            <div className="leading-tight">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Students</p>
              <p className="text-xs font-black text-slate-700">{filtered.length}</p>
            </div>
          </div>
          <div className="h-8 w-px bg-slate-200 mx-1 shrink-0" />
          <Btn variant="outline" size="sm" onClick={handleCSV} className="text-[10px] h-9 px-3">CSV</Btn>
          <Btn variant="outline" size="sm" onClick={() => window.print()} className="text-[10px] h-9 px-3"><Printer className="w-3 h-3" /></Btn>
          <Btn variant="primary" size="sm" onClick={handlePDF} className="text-[10px] h-9 px-3 font-black">PDF REPORT</Btn>
        </div>
      </div>

      {/* Age Buckets */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 no-print">
        {(['1 month', '2-3 months', '3-6 months', '6+ months'] as const).map(b => (
          <button key={b} onClick={() => setBucketFilter(bucketFilter === b ? '' : b)}
            className={cn(
              'p-4 rounded-2xl border-2 text-center transition-all',
              bucketFilter === b ? 'ring-2 ring-offset-2 ring-indigo-500' : '',
              bucketColor(b)
            )}>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{b} overdue</p>
            <p className="text-2xl font-black mt-1">{bucketCounts[b]}</p>
            <p className="text-[9px] font-bold opacity-60">students</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <Card className="p-2 shadow-sm border-slate-100 no-print">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, admission no..."
              className="w-full pl-9 pr-3 py-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <select value={classFilter} onChange={e => setClassFilter(e.target.value)}
            className="w-full px-3 py-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
          </select>
          <input value={minAmount} onChange={e => setMinAmount(e.target.value)} type="number" placeholder="Min arrears amount"
            className="w-full px-3 py-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </Card>

      {/* Table */}
      <Card className="shadow-sm border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-rose-100 border-t-rose-600 rounded-full animate-spin" />
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-4">Analyzing Arrears…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <CheckCircle className="w-10 h-10 text-emerald-300 mb-3" />
            <p className="text-sm font-bold text-slate-400">No overdue arrears found. All clear!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-[#0d1526] sticky top-0 z-10">
                <tr>
                  {['Sr', 'Adm No', 'Roll', 'Student', 'Class', 'Father', 'WhatsApp', 'Overdue Months', 'Arrears', 'Severity'].map(h => (
                    <th key={h} className="px-4 py-3.5 font-black text-slate-400 uppercase tracking-widest text-[10px] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r, i) => (
                  <tr key={r.student_id} className={cn('hover:bg-slate-50/50 transition-colors border-l-4', rowBorder(r.ageBucket))}>
                    <td className="px-4 py-3 font-bold text-slate-300">{i + 1}</td>
                    <td className="px-4 py-3 font-mono text-[10px] text-slate-500">{r.admNo}</td>
                    <td className="px-4 py-3 font-bold text-slate-600">{r.rollNo}</td>
                    <td className="px-4 py-3 font-bold text-slate-900 uppercase">{r.studentName}</td>
                    <td className="px-4 py-3 font-bold text-slate-600">{r.className}</td>
                    <td className="px-4 py-3 font-bold text-slate-600">{r.fatherName}</td>
                    <td className="px-4 py-3 font-mono text-[10px] text-slate-500">{r.whatsapp}</td>
                    <td className="px-4 py-3 font-bold text-slate-500 text-[10px] max-w-[200px] truncate" title={r.overdueMonths.join(', ')}>
                      {r.overdueMonths.length} month{r.overdueMonths.length > 1 ? 's' : ''}
                    </td>
                    <td className="px-4 py-3 font-black text-rose-600">Rs. {r.totalArrears.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={cn('px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border', bucketColor(r.ageBucket))}>
                        {r.ageBucket}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="bg-slate-50 px-6 py-4 flex justify-between items-center border-t border-slate-200">
            <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">
              Students: <span className="text-slate-900 ml-1">{filtered.length}</span>
            </span>
            <div className="text-right">
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Total Arrears</p>
              <p className="text-sm font-black text-rose-600">Rs. {totalArrears.toLocaleString()}</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
