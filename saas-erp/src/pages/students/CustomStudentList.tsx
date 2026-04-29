import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Search, Filter, Download, Printer,
  ChevronRight, ClipboardList, School, Layout
} from 'lucide-react';
import { cn, formatDate } from '../../lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Column {
  key: string;
  label: string;
  category: 'Identity' | 'Academic' | 'Family' | 'Finance';
  default?: boolean;
}

const ALL_COLUMNS: Column[] = [
  { key: 'student_unique_id', label: 'Admission No', category: 'Academic', default: true },
  { key: 'roll_number',       label: 'Roll No',      category: 'Academic', default: true },
  { key: 'full_name',         label: 'Student Name', category: 'Identity', default: true },
  { key: 'class_section',     label: 'Class',        category: 'Academic', default: true },
  { key: 'father_name',       label: 'Father Name',  category: 'Family',   default: true },
  { key: 'father_mobile',     label: 'WhatsApp',     category: 'Family',   default: true },
  { key: 'family_number',     label: 'Family ID',    category: 'Family'  },
  { key: 'gender',            label: 'Gender',       category: 'Identity' },
  { key: 'dob',               label: 'DOB',          category: 'Identity' },
  { key: 'admission_date',    label: 'Adm. Date',    category: 'Academic' },
  { key: 'status',            label: 'Status',       category: 'Academic' },
  { key: 'total_fee',         label: 'Total Fee',    category: 'Finance',  default: true },
  { key: 'received_fee',      label: 'Received',     category: 'Finance',  default: true },
  { key: 'balance_fee',       label: 'Balance',      category: 'Finance',  default: true },
  { key: 'blood_group',       label: 'Blood Group',  category: 'Identity' },
  { key: 'address',           label: 'Address',      category: 'Identity' },
  { key: 'fee_waiver_percentage', label: 'Waiver %', category: 'Finance'  },
];

/** Convert a remote image URL → base64 PNG for jsPDF embedding */
const toBase64 = (url: string): Promise<string> =>
  new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d')?.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve('');
    img.src = url;
  });

export default function CustomStudentList() {
  const { userRole } = useAuth();
  const [classes, setClasses]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(false);
  const [fetched, setFetched]   = useState(false);
  const [rows, setRows]         = useState<any[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    new Set(ALL_COLUMNS.filter(c => c.default).map(c => c.key))
  );

  const [classFilter,  setClassFilter]  = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [genderFilter, setGenderFilter] = useState('');
  const [familyFilter, setFamilyFilter] = useState('');
  const [sortBy,       setSortBy]       = useState('full_name');
  const [viewMode,     setViewMode]     = useState<'list' | 'summary'>('list');
  const [schoolBrand,  setSchoolBrand]  = useState<{ name: string; logo: string | null }>({ name: 'School Report', logo: null });

  useEffect(() => {
    if (userRole?.school_id) { fetchClasses(); fetchSchoolBrand(); }
  }, [userRole]);

  const fetchSchoolBrand = async () => {
    const { data } = await supabase.from('schools').select('name, logo_url').eq('id', userRole?.school_id).single();
    if (data) setSchoolBrand({ name: data.name || 'School Report', logo: data.logo_url });
  };

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('*').eq('school_id', userRole?.school_id).order('name');
    if (data) setClasses(data);
  };

  const fetchData = async () => {
    if (!userRole?.school_id) return;
    setLoading(true); setFetched(false);
    const needsFinance = ['total_fee', 'received_fee', 'balance_fee'].some(k => selectedColumns.has(k));

    let query = supabase.from('students')
      .select('*, classes(name, section), parents(full_name, father_name, whatsapp_number, family_number)')
      .eq('school_id', userRole.school_id);

    if (statusFilter) query = query.eq('status', statusFilter);
    if (classFilter)  query = query.eq('class_id', classFilter);
    if (genderFilter) query = query.eq('gender', genderFilter);

    const { data: students, error } = await query;
    if (error || !students) { setLoading(false); return; }

    let filtered = students;
    if (familyFilter.trim()) {
      filtered = students.filter(s => {
        const p = Array.isArray(s.parents) ? s.parents[0] : s.parents;
        return p?.father_name?.toLowerCase().includes(familyFilter.toLowerCase()) ||
               p?.family_number?.toString().includes(familyFilter);
      });
    }

    let feeMap = new Map<string, { total: number; paid: number }>();
    if (needsFinance && filtered.length > 0) {
      const { data: fees } = await supabase.from('fee_records')
        .select('student_id, total_amount, paid_amount')
        .in('student_id', filtered.map(s => s.id));
      fees?.forEach(f => {
        const cur = feeMap.get(f.student_id) || { total: 0, paid: 0 };
        cur.total += Number(f.total_amount || 0);
        cur.paid  += Number(f.paid_amount  || 0);
        feeMap.set(f.student_id, cur);
      });
    }

    const finalRows = filtered.map(s => {
      const p = Array.isArray(s.parents) ? s.parents[0] : s.parents;
      const f = feeMap.get(s.id) || { total: 0, paid: 0 };
      return {
        id: s.id,
        student_unique_id: s.student_unique_id,
        roll_number: s.roll_number,
        full_name: s.full_name,
        class_section: s.classes ? `${(s.classes as any).name} ${(s.classes as any).section || ''}`.trim() : 'N/A',
        father_name: p?.father_name || 'N/A',
        father_mobile: p?.whatsapp_number || 'N/A',
        family_number: p?.family_number || 'N/A',
        gender: s.gender, dob: s.dob, admission_date: s.admission_date,
        status: s.status, blood_group: s.blood_group, address: s.address,
        total_fee: f.total, received_fee: f.paid,
        balance_fee: Math.max(0, f.total - f.paid),
        fee_waiver_percentage: s.fee_waiver_percentage || 0,
      };
    });

    finalRows.sort((a, b) =>
      sortBy === 'roll_number'
        ? (Number(a.roll_number) || 0) - (Number(b.roll_number) || 0)
        : String(a[sortBy as keyof typeof a] || '').localeCompare(String(b[sortBy as keyof typeof b] || ''), undefined, { numeric: true })
    );

    setRows(finalRows); setFetched(true); setLoading(false);
  };

  const toggleColumn = (key: string) => {
    const s = new Set(selectedColumns);
    s.has(key) ? s.delete(key) : s.add(key);
    setSelectedColumns(s);
  };

  /* ─── PDF helpers ─── */
  const addPDFHeader = async (doc: jsPDF, landscape: boolean, title: string): Promise<number> => {
    const pageW = landscape ? 297 : 210;
    let y = 10;

    if (schoolBrand.logo) {
      const b64 = await toBase64(schoolBrand.logo);
      if (b64) {
        const logoSize = 16;
        doc.addImage(b64, 'PNG', pageW / 2 - logoSize / 2, y, logoSize, logoSize);
        y += logoSize + 3;
      }
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(13, 21, 38);
    doc.text(schoolBrand.name.toUpperCase(), pageW / 2, y, { align: 'center' });
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(title.toUpperCase(), pageW / 2, y, { align: 'center' });
    y += 5;

    doc.setFontSize(7);
    doc.text(`Generated: ${formatDate(new Date())}`, pageW / 2, y, { align: 'center' });
    y += 4;

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(10, y, pageW - 10, y);
    y += 5;

    return y;
  };

  const addPDFFooter = (doc: jsPDF, landscape: boolean) => {
    const pageW  = landscape ? 297 : 210;
    const pageH  = landscape ? 210 : 297;
    const pages  = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(6);
      doc.setTextColor(160, 160, 160);
      doc.text(`${schoolBrand.name} — Confidential Student Record`, 10, pageH - 5);
      doc.text(`Page ${i} of ${pages}`, pageW - 10, pageH - 5, { align: 'right' });
    }
  };

  const exportListPDF = async () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const className = classFilter ? (classes.find(c => c.id === classFilter)?.name || '') : 'All Classes';
    let y = await addPDFHeader(doc, true, `Student List — ${className}`);

    // Quick stats bar
    const boys    = rows.filter(r => r.gender?.toLowerCase() === 'male').length;
    const girls   = rows.filter(r => r.gender?.toLowerCase() === 'female').length;
    const totalFee = rows.reduce((a, r) => a + (r.total_fee || 0), 0);
    const balance  = rows.reduce((a, r) => a + (r.balance_fee || 0), 0);
    const needsFin = ['total_fee', 'received_fee', 'balance_fee'].some(k => selectedColumns.has(k));

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(13, 21, 38);
    const statsStr = [
      `Total: ${rows.length}`,
      `Boys: ${boys}`,
      `Girls: ${girls}`,
      ...(needsFin ? [`Total Fee: PKR ${totalFee.toLocaleString()}`, `Balance: PKR ${balance.toLocaleString()}`] : []),
    ].join('   |   ');
    doc.text(statsStr, 148.5, y, { align: 'center' });
    y += 7;

    // Table
    const activeCols = ALL_COLUMNS.filter(c => selectedColumns.has(c.key));
    autoTable(doc, {
      head: [['#', ...activeCols.map(c => c.label)]],
      body: rows.map((r, i) => [
        String(i + 1),
        ...activeCols.map(c =>
          c.category === 'Finance'
            ? `PKR ${Number(r[c.key] || 0).toLocaleString()}`
            : formatDate(r[c.key]) || '-'
        ),
      ]),
      startY: y,
      styles: { fontSize: 6.5, cellPadding: 1.8 },
      headStyles: { fillColor: [13, 21, 38], textColor: 255, fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      theme: 'grid',
      margin: { left: 10, right: 10 },
    });

    addPDFFooter(doc, true);
    doc.save(`student-list-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const exportSummaryPDF = async () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const className = classFilter ? (classes.find(c => c.id === classFilter)?.name || '') : 'All Classes';
    let y = await addPDFHeader(doc, false, classFilter ? `Class Summary — ${className}` : 'Whole School Summary Report');

    const boys    = rows.filter(r => r.gender?.toLowerCase() === 'male').length;
    const girls   = rows.filter(r => r.gender?.toLowerCase() === 'female').length;
    const totalFee = rows.reduce((a, r) => a + (r.total_fee || 0), 0);
    const received = rows.reduce((a, r) => a + (r.received_fee || 0), 0);
    const balance  = Math.max(0, totalFee - received);
    const needsFin = ['total_fee', 'received_fee', 'balance_fee'].some(k => selectedColumns.has(k));

    // Stats box
    const stats = [
      ['Total Enrolled', String(rows.length)],
      ['Boys', String(boys)],
      ['Girls', String(girls)],
      ...(needsFin ? [
        ['Expected Revenue', `PKR ${totalFee.toLocaleString()}`],
        ['Received',         `PKR ${received.toLocaleString()}`],
        ['Outstanding',      `PKR ${balance.toLocaleString()}`],
      ] : []),
    ];
    autoTable(doc, {
      body: stats,
      startY: y,
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: { 0: { fontStyle: 'bold', textColor: [100, 100, 100], cellWidth: 60 }, 1: { fontStyle: 'bold', textColor: [13, 21, 38], fontSize: 11 } },
      theme: 'plain',
      margin: { left: 30, right: 30 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // Class breakdown
    if (!classFilter) {
      const classGroups: Record<string, { total: number; boys: number; girls: number; balance: number }> = {};
      rows.forEach(r => {
        const c = r.class_section || 'Unassigned';
        if (!classGroups[c]) classGroups[c] = { total: 0, boys: 0, girls: 0, balance: 0 };
        classGroups[c].total++;
        if (r.gender?.toLowerCase() === 'male')   classGroups[c].boys++;
        if (r.gender?.toLowerCase() === 'female') classGroups[c].girls++;
        classGroups[c].balance += Math.max(0, (r.total_fee || 0) - (r.received_fee || 0));
      });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      doc.text('CLASS-WISE BREAKDOWN', 15, y);
      y += 4;

      const breakdownHead = [['Class', 'Total', 'Boys', 'Girls', ...(needsFin ? ['Balance (PKR)'] : [])]];
      const breakdownBody = Object.entries(classGroups)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([cls, s]) => [cls, String(s.total), String(s.boys), String(s.girls), ...(needsFin ? [s.balance.toLocaleString()] : [])]);

      autoTable(doc, {
        head: breakdownHead,
        body: breakdownBody,
        startY: y,
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [13, 21, 38], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        theme: 'grid',
        margin: { left: 15, right: 15 },
      });
    }

    addPDFFooter(doc, false);
    doc.save(`school-summary-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  /* ─── Derived stats for on-screen quick strip ─── */
  const quickStats = React.useMemo(() => {
    if (!rows.length) return null;
    const boys     = rows.filter(r => r.gender?.toLowerCase() === 'male').length;
    const girls    = rows.filter(r => r.gender?.toLowerCase() === 'female').length;
    const totalFee = rows.reduce((a, r) => a + (r.total_fee    || 0), 0);
    const received = rows.reduce((a, r) => a + (r.received_fee || 0), 0);
    const balance  = rows.reduce((a, r) => a + (r.balance_fee  || 0), 0);
    const needsFin = ['total_fee', 'received_fee', 'balance_fee'].some(k => selectedColumns.has(k));
    return { total: rows.length, boys, girls, totalFee, received, balance, needsFin };
  }, [rows, selectedColumns]);

  /* ─── Summary report view ─── */
  const renderSummary = () => {
    if (!quickStats) return null;
    const { total, boys, girls, totalFee, received, balance, needsFin } = quickStats;

    const classGroups: Record<string, { total: number; boys: number; girls: number; balance: number }> = {};
    rows.forEach(r => {
      const c = r.class_section || 'Unassigned';
      if (!classGroups[c]) classGroups[c] = { total: 0, boys: 0, girls: 0, balance: 0 };
      classGroups[c].total++;
      if (r.gender?.toLowerCase() === 'male')   classGroups[c].boys++;
      if (r.gender?.toLowerCase() === 'female') classGroups[c].girls++;
      classGroups[c].balance += Math.max(0, (r.total_fee || 0) - (r.received_fee || 0));
    });

    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xl print:shadow-none print:border-none">
        {/* Report header — visible on screen and in print */}
        <div className="flex flex-col items-center justify-center mb-8 pb-6 border-b-2 border-slate-100">
          {schoolBrand.logo
            ? <img src={schoolBrand.logo} className="w-16 h-16 object-contain rounded-xl shadow-sm mb-3" alt="Logo" />
            : <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center mb-3"><School className="w-6 h-6 text-white" /></div>
          }
          <h2 className="text-2xl font-black uppercase tracking-widest text-[#0d1526] text-center">{schoolBrand.name}</h2>
          <p className="text-slate-500 font-bold tracking-wider mt-1 uppercase text-xs">
            {classFilter ? 'Class Summary Report' : 'Whole School Summary Report'}
          </p>
          <p className="text-slate-400 text-[10px] mt-2 tracking-widest uppercase font-bold">
            Generated: {formatDate(new Date())}
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Enrolled', value: total, big: true, color: 'text-indigo-600' },
            { label: 'Gender Split',   value: `${boys} Boys / ${girls} Girls`, big: false, color: 'text-slate-700' },
            ...(needsFin ? [
              { label: 'Expected Revenue',    value: `PKR ${totalFee.toLocaleString()}`, big: false, color: 'text-emerald-600' },
              { label: 'Outstanding Balance', value: `PKR ${balance.toLocaleString()}`,  big: false, color: 'text-rose-600'    },
            ] : []),
          ].map(card => (
            <div key={card.label} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{card.label}</p>
              <p className={cn('font-black mt-1', card.big ? 'text-3xl' : 'text-sm mt-2', card.color)}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* Class breakdown table */}
        {!classFilter && (
          <div>
            <h3 className="text-sm font-black text-[#0d1526] uppercase tracking-widest mb-4">Class-wise Breakdown</h3>
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-black text-slate-500 uppercase">Class</th>
                    <th className="px-4 py-3 font-black text-slate-500 uppercase text-center">Total</th>
                    <th className="px-4 py-3 font-black text-slate-500 uppercase text-center">Boys</th>
                    <th className="px-4 py-3 font-black text-slate-500 uppercase text-center">Girls</th>
                    {needsFin && <th className="px-4 py-3 font-black text-slate-500 uppercase text-right">Balance</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Object.entries(classGroups).sort(([a], [b]) => a.localeCompare(b)).map(([cls, s]) => (
                    <tr key={cls} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-bold text-slate-700">{cls}</td>
                      <td className="px-4 py-3 font-bold text-slate-900 text-center">{s.total}</td>
                      <td className="px-4 py-3 font-bold text-blue-600  text-center">{s.boys}</td>
                      <td className="px-4 py-3 font-bold text-pink-500  text-center">{s.girls}</td>
                      {needsFin && <td className="px-4 py-3 font-bold text-rose-600 text-right">PKR {s.balance.toLocaleString()}</td>}
                    </tr>
                  ))}
                  {/* Totals row */}
                  <tr className="bg-slate-900 text-white">
                    <td className="px-4 py-3 font-black text-[10px] uppercase tracking-widest">Total</td>
                    <td className="px-4 py-3 font-black text-center">{total}</td>
                    <td className="px-4 py-3 font-black text-center">{boys}</td>
                    <td className="px-4 py-3 font-black text-center">{girls}</td>
                    {needsFin && <td className="px-4 py-3 font-black text-right">PKR {balance.toLocaleString()}</td>}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ─── Render ─── */
  return (
    <>
      {/* Print-scoped styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-full { grid-column: 1 / -1 !important; }
          body { background: white !important; }
        }
      `}</style>

      <div className="max-w-[1600px] mx-auto space-y-6">

        {/* ── Page Header — hidden in print ── */}
        <div className="no-print flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-[#0d1526] flex items-center gap-2 uppercase tracking-tight">
              <ClipboardList className="w-7 h-7 text-indigo-600" /> Custom List Generator
            </h1>
            <p className="text-slate-500 text-sm mt-1">Design your own student lists and reports with real-time preview.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {fetched && rows.length > 0 && (
              <div className="bg-slate-100 p-1 rounded-xl flex">
                <button onClick={() => setViewMode('list')}
                  className={cn('px-4 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-wider', viewMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700')}>
                  List
                </button>
                <button onClick={() => setViewMode('summary')}
                  className={cn('px-4 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-wider', viewMode === 'summary' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700')}>
                  Summary
                </button>
              </div>
            )}
            {fetched && rows.length > 0 && (
              <>
                <button onClick={() => window.print()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-slate-200 transition-all border border-slate-200">
                  <Printer className="w-4 h-4" /> Print
                </button>
                <button
                  onClick={viewMode === 'summary' ? exportSummaryPDF : exportListPDF}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#0d1526] text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-slate-800 transition-all shadow-lg">
                  <Download className="w-4 h-4" /> PDF
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* ── Sidebar (hidden in print) ── */}
          <div className="no-print lg:col-span-1 space-y-6">

            {/* Filters */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-3">
                <Filter className="w-4 h-4 text-indigo-600" /> List Filters
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'Select Class', el: (
                    <select value={classFilter} onChange={e => setClassFilter(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none">
                      <option value="">All Classes</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
                    </select>
                  )},
                  { label: 'Gender', el: (
                    <select value={genderFilter} onChange={e => setGenderFilter(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none">
                      <option value="">All Genders</option>
                      <option value="male">Boys</option>
                      <option value="female">Girls</option>
                    </select>
                  )},
                  { label: 'Sort By', el: (
                    <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none">
                      <option value="full_name">Student Name (A–Z)</option>
                      <option value="roll_number">Roll Number</option>
                      <option value="class_section">Class & Section</option>
                      <option value="student_unique_id">Admission No.</option>
                      <option value="admission_date">Admission Date</option>
                    </select>
                  )},
                  { label: 'Enrollment Status', el: (
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none">
                      <option value="active">Active</option>
                      <option value="left">Left / Withdrawn</option>
                      <option value="graduated">Graduated / Alumni</option>
                    </select>
                  )},
                  { label: 'Family / Parent Search', el: (
                    <input type="text" value={familyFilter} onChange={e => setFamilyFilter(e.target.value)} placeholder="Father Name or Family ID"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold outline-none" />
                  )},
                ].map(({ label, el }) => (
                  <div key={label}>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</label>
                    {el}
                  </div>
                ))}
              </div>
              <button onClick={fetchData} disabled={loading}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 disabled:opacity-60">
                {loading ? 'Processing…' : <><Search className="w-4 h-4" /> Generate List</>}
              </button>
            </div>

            {/* Column selector */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
                <Layout className="w-4 h-4 text-indigo-600" /> Select Columns
              </h3>
              <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {(['Identity', 'Academic', 'Family', 'Finance'] as const).map(cat => (
                  <div key={cat} className="mb-4">
                    <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2 px-1">{cat}</p>
                    {ALL_COLUMNS.filter(c => c.category === cat).map(col => (
                      <button key={col.key} onClick={() => toggleColumn(col.key)}
                        className={cn('w-full text-left px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-between',
                          selectedColumns.has(col.key) ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50')}>
                        {col.label}
                        {selectedColumns.has(col.key) && <ChevronRight className="w-3 h-3" />}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Main content ── */}
          <div className="lg:col-span-3 print-full">
            {!fetched && !loading ? (
              <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 h-[600px] flex flex-col items-center justify-center text-center p-8">
                <div className="bg-indigo-50 p-6 rounded-full mb-4">
                  <ClipboardList className="w-12 h-12 text-indigo-400" />
                </div>
                <h2 className="text-xl font-black text-[#0d1526] uppercase tracking-tight">Ready to Generate</h2>
                <p className="text-slate-400 max-w-sm mt-2">Adjust your filters and select columns, then click Generate to preview.</p>
              </div>
            ) : loading ? (
              <div className="bg-white rounded-3xl border border-slate-200 h-[600px] flex flex-col items-center justify-center space-y-4">
                <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                <p className="font-black text-slate-500 uppercase tracking-widest text-xs">Fetching Records…</p>
              </div>
            ) : rows.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200 h-[600px] flex flex-col items-center justify-center text-center p-8">
                <Search className="w-12 h-12 text-slate-200 mb-4" />
                <p className="text-slate-500 font-bold">No students found matching current filters.</p>
              </div>
            ) : viewMode === 'summary' ? renderSummary() : (
              /* ── LIST VIEW ── */
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden print:shadow-none print:border-none print:rounded-none">

                {/* Print-only branding header */}
                <div className="hidden print:flex flex-col items-center py-6 px-8 border-b-2 border-slate-200">
                  {schoolBrand.logo && <img src={schoolBrand.logo} className="w-16 h-16 object-contain mb-3" alt="" />}
                  <h2 className="text-2xl font-black uppercase tracking-widest text-[#0d1526]">{schoolBrand.name}</h2>
                  <p className="text-slate-500 font-bold tracking-wider mt-1 uppercase text-xs">
                    Student List{classFilter ? ` — ${classes.find(c => c.id === classFilter)?.name}` : ' — All Classes'}
                  </p>
                  <p className="text-slate-400 text-[10px] mt-2 tracking-widest uppercase">
                    Generated: {formatDate(new Date())}
                  </p>
                </div>

                {/* Quick summary strip — shown on screen AND in print */}
                {quickStats && (
                  <div className="flex flex-wrap gap-x-6 gap-y-2 px-6 py-4 bg-slate-50 border-b border-slate-100">
                    <Chip label="Total Students" value={String(quickStats.total)} color="indigo" />
                    <Chip label="Boys"  value={String(quickStats.boys)}  color="blue"    />
                    <Chip label="Girls" value={String(quickStats.girls)} color="pink"    />
                    {quickStats.needsFin && (
                      <>
                        <Chip label="Total Fee" value={`PKR ${quickStats.totalFee.toLocaleString()}`} color="slate"   />
                        <Chip label="Received"  value={`PKR ${quickStats.received.toLocaleString()}`} color="emerald" />
                        <Chip label="Balance"   value={`PKR ${quickStats.balance.toLocaleString()}`}  color="rose"    />
                      </>
                    )}
                  </div>
                )}

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-[#0d1526] sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-4 font-black text-slate-400 uppercase tracking-widest">Sr.</th>
                        {ALL_COLUMNS.filter(c => selectedColumns.has(c.key)).map(col => (
                          <th key={col.key} className="px-4 py-4 font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((row, idx) => (
                        <tr key={row.id} className={cn(
                          'group transition-all border-l-4',
                          row.fee_waiver_percentage >= 100
                            ? 'bg-emerald-50/30 border-emerald-500 hover:bg-emerald-50/50'
                            : 'hover:bg-slate-50/80 border-transparent'
                        )}>
                          <td className="px-4 py-3 font-bold text-slate-300">{idx + 1}</td>
                          {ALL_COLUMNS.filter(c => selectedColumns.has(c.key)).map(col => (
                            <td key={col.key} className={cn(
                              'px-4 py-3 font-bold',
                              col.category === 'Finance'  ? 'text-indigo-600' :
                              col.key === 'full_name'      ? 'text-slate-900 uppercase' : 'text-slate-700'
                            )}>
                              {col.key === 'fee_waiver_percentage' ? (
                                <span className={cn('px-2 py-0.5 rounded text-[10px] uppercase font-black',
                                  row[col.key] >= 100 ? 'bg-emerald-500 text-white' :
                                  row[col.key] > 0    ? 'bg-amber-100 text-amber-700' : 'text-slate-400')}>
                                  {row[col.key] >= 100 ? 'FREE' : row[col.key] > 0 ? `${row[col.key]}%` : '—'}
                                </span>
                              ) : col.category === 'Finance'
                                ? `PKR ${Number(row[col.key] || 0).toLocaleString()}`
                                : formatDate(row[col.key]) || '—'
                              }
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer totals */}
                <div className="bg-slate-50 px-6 py-4 flex flex-wrap justify-between items-center gap-4 border-t border-slate-200">
                  <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                    Total Records: <span className="text-slate-900 ml-1">{rows.length}</span>
                  </span>
                  {quickStats?.needsFin && (
                    <div className="flex gap-6">
                      <div className="text-right">
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Total Fee</p>
                        <p className="text-sm font-black text-slate-900">PKR {quickStats.totalFee.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Received</p>
                        <p className="text-sm font-black text-emerald-600">PKR {quickStats.received.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Balance</p>
                        <p className="text-sm font-black text-rose-600">PKR {quickStats.balance.toLocaleString()}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Helper chip component for the quick-summary strip ── */
const colorMap: Record<string, string> = {
  indigo:  'text-indigo-700  bg-indigo-50  border-indigo-100',
  blue:    'text-blue-700    bg-blue-50    border-blue-100',
  pink:    'text-pink-700    bg-pink-50    border-pink-100',
  emerald: 'text-emerald-700 bg-emerald-50 border-emerald-100',
  rose:    'text-rose-700    bg-rose-50    border-rose-100',
  slate:   'text-slate-700   bg-slate-100  border-slate-200',
};

function Chip({ label, value, color = 'slate' }: { label: string; value: string; color?: string }) {
  return (
    <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-black', colorMap[color] || colorMap.slate)}>
      <span className="text-opacity-60 font-bold">{label}:</span>
      <span>{value}</span>
    </div>
  );
}
