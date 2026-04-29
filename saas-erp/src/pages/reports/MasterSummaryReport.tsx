import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  FileText, 
  Users, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Wallet, 
  Calendar, 
  Download,
  Search,
  ChevronRight,
  Printer,
  FileDown
} from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';
import { formatDate } from '../../lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReportData {
  admissions: any[];
  income: any[];
  expenses: any[];
}

// Convert remote URL → base64 via canvas (CORS-safe for jsPDF)
const toBase64 = (url: string): Promise<string> =>
  new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      canvas.getContext('2d')?.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve('');
    img.src = url;
  });

export default function MasterSummaryReport() {
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dateType, setDateType] = useState('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [data, setData] = useState<ReportData>({ admissions: [], income: [], expenses: [] });
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'admissions' | 'income' | 'expenses'>('admissions');

  const fetchData = useCallback(async () => {
    if (!userRole?.school_id) return;
    setLoading(true);
    const sid = userRole.school_id;

    let startDate: string;
    let endDate: string = new Date().toISOString().split('T')[0];
    const today = new Date();

    if (dateType === 'today') {
      startDate = endDate;
    } else if (dateType === 'week') {
      const lastWeek = new Date();
      lastWeek.setDate(today.getDate() - 7);
      startDate = lastWeek.toISOString().split('T')[0];
    } else if (dateType === 'month') {
      startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    } else if (dateType === 'custom' && customStart && customEnd) {
      startDate = customStart;
      endDate = customEnd;
    } else {
      startDate = endDate; // Fallback to today
    }

    try {
      const [
        { data: admissions },
        { data: transactions }
      ] = await Promise.all([
        supabase.from('students')
          .select('*, classes(name)')
          .eq('school_id', sid)
          .gte('admission_date', startDate)
          .lte('admission_date', endDate)
          .order('admission_date', { ascending: false }),
        supabase.from('financial_transactions')
          .select('*')
          .eq('school_id', sid)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: false })
      ]);

      const income = (transactions || []).filter(t => t.type === 'income');
      const expenses = (transactions || []).filter(t => t.type === 'expense');

      setData({
        admissions: admissions || [],
        income: income,
        expenses: expenses
      });
    } catch (err: any) {
      console.error('Error fetching report data:', err);
    } finally {
      setLoading(false);
    }
  }, [userRole, dateType, customStart, customEnd]);

  const fetchSchoolInfo = async () => {
    if (!userRole?.school_id) return;
    const { data } = await supabase.from('schools').select('*').eq('id', userRole.school_id).single();
    if (data) setSchoolInfo(data);
  };

  useEffect(() => {
    fetchData();
    fetchSchoolInfo();
  }, [fetchData]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    const filename = `Executive-Master-Report-${new Date().toISOString().split('T')[0]}.pdf`;
    const doc = new jsPDF({ orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();

    // 1. Header / Letterhead — logo via canvas (CORS-safe)
    const logoBase64 = schoolInfo?.logo_url ? await toBase64(schoolInfo.logo_url) : '';
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'PNG', 20, 10, 20, 20);
      } catch (e) { console.warn('Logo embed failed'); }
    }

    doc.setFontSize(24);
    doc.setFont('Inter', 'bold');
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(schoolInfo?.name || 'School Executive Report', 45, 20);
    
    doc.setFontSize(10);
    doc.setFont('Inter', 'normal');
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(schoolInfo?.address || 'Official Institutional Analytics', 45, 26);

    doc.setDrawColor(79, 70, 229); // indigo-600
    doc.setLineWidth(1.5);
    doc.line(20, 36, pageWidth - 20, 36);

    // 2. Report metadata
    doc.setFontSize(14);
    doc.setFont('Inter', 'bold');
    doc.setTextColor(30, 41, 59);
    const periodStr = dateType === 'custom' ? `${customStart} to ${customEnd}` : dateType.toUpperCase();
    doc.text(`FINANCIAL SUMMARY - ${periodStr}`, 20, 48);
    
    doc.setFontSize(9);
    doc.setFont('Inter', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(`Generated: ${formatDate(new Date())}`, pageWidth - 20, 48, { align: 'right' });

    // 3. KPI Summary Table
    autoTable(doc, {
      startY: 55,
      head: [['KPI Metric', 'Value', 'Description']],
      body: [
        ['New Admissions', data.admissions.length, 'Total students enrolled in this period'],
        ['Total Income', `Rs. ${totalIncome.toLocaleString()}`, 'Cash inflows (Fees, Payments, etc)'],
        ['Total Expenses', `Rs. ${totalExpenses.toLocaleString()}`, 'Cash outflows (Utility, Salary, etc)'],
        ['NET CASH IN HAND', `Rs. ${cashInHand.toLocaleString()}`, '(Income - Expenses)']
      ],
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], textColor: 255 }, // indigo-600
      styles: { cellPadding: 4, fontSize: 10 }
    });

    let currentY = (doc as any).lastAutoTable.finalY + 15;

    // 4. Admissions Table
    if (data.admissions.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('I. NEW STUDENT ENROLLMENTS', 20, currentY);
      autoTable(doc, {
        startY: currentY + 5,
        head: [['Student Name', 'Roll No', 'Class', 'Date']],
        body: data.admissions.map(s => [s.full_name, `#${s.roll_number}`, s.classes?.name || '—', formatDate(s.admission_date)]),
        styles: { fontSize: 9 }
      });
      currentY = (doc as any).lastAutoTable.finalY + 15;
    }

    // Checking for page overflow manually if needed, or autotable handles it.
    if (currentY > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); currentY = 20; }

    // 5. Income Table
    if (data.income.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('II. INCOME & FEE COLLECTION LOGS', 20, currentY);
      autoTable(doc, {
        startY: currentY + 5,
        head: [['Date', 'Category', 'Description', 'Mode', 'Amount']],
        body: data.income.map(i => [formatDate(i.date), i.category, i.remarks || '—', i.payment_mode, `Rs. ${Number(i.amount).toLocaleString()}`]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [16, 185, 129] } // green-500
      });
      currentY = (doc as any).lastAutoTable.finalY + 15;
    }

    if (currentY > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); currentY = 20; }

    // 6. Expense Table
    if (data.expenses.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('III. EXPENSE LOGS', 20, currentY);
      autoTable(doc, {
        startY: currentY + 5,
        head: [['Date', 'Category', 'Description', 'Mode', 'Amount']],
        body: data.expenses.map(e => [formatDate(e.date), e.category, e.remarks || '—', e.payment_mode, `Rs. ${Number(e.amount).toLocaleString()}`]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [239, 68, 68] } // red-500
      });
      currentY = (doc as any).lastAutoTable.finalY + 20;
    }

    // 7. Signatures
    if (currentY > doc.internal.pageSize.getHeight() - 30) { doc.addPage(); currentY = 20; }
    doc.line(20, currentY + 10, 80, currentY + 10);
    doc.text('Prepared By', 20, currentY + 16);
    
    doc.line(pageWidth - 80, currentY + 10, pageWidth - 20, currentY + 10);
    doc.text('Administrator Signature', pageWidth - 20, currentY + 16, { align: 'right' });

    doc.save(filename);
  };

  const totalIncome = data.income.reduce((sum, item) => sum + Number(item.amount), 0);
  const totalExpenses = data.expenses.reduce((sum, item) => sum + Number(item.amount), 0);
  const cashInHand = totalIncome - totalExpenses;

  // ── Fee Income Breakdown by Item Type ─────────────────────────────────────
  // Sum amounts across fee_items JSONB arrays on income transactions that have fee_record_id
  const feeItemTotals = React.useMemo(() => {
    const totals: Record<string, number> = {};
    data.income.forEach(tx => {
      if (!tx.fee_items || !Array.isArray(tx.fee_items)) return;
      tx.fee_items.forEach((fi: { item: string; amount: number }) => {
        if (!fi.item) return;
        totals[fi.item] = (totals[fi.item] || 0) + (Number(fi.amount) || 0);
      });
    });
    return Object.entries(totals)
      .map(([item, amount]) => ({ item, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [data.income]);

  const kpis = [
    { 
      label: 'New Admissions', 
      value: data.admissions.length, 
      icon: Users, 
      color: 'blue', 
      sub: 'Total Enrolled',
      key: 'admissions'
    },
    { 
      label: 'Total Income', 
      value: `Rs. ${totalIncome.toLocaleString()}`, 
      icon: ArrowDownCircle, 
      color: 'green', 
      sub: 'Cash Inflow',
      key: 'income'
    },
    { 
      label: 'Total Expenses', 
      value: `Rs. ${totalExpenses.toLocaleString()}`, 
      icon: ArrowUpCircle, 
      color: 'red', 
      sub: 'Cash Outflow',
      key: 'expenses'
    },
    { 
      label: 'Cash in Hand', 
      value: `Rs. ${cashInHand.toLocaleString()}`, 
      icon: Wallet, 
      color: 'indigo', 
      sub: '(Income - Expense)',
      highlight: true
    }
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-600" /> Master Summary Report
          </h1>
          <p className="text-slate-500 text-sm mt-1">Cross-domain financial and enrollment analytics.</p>
        </div>

        <div className="flex items-center gap-3 no-print">
          <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
            {[
              { id: 'today', label: 'Today' },
              { id: 'week', label: 'Last 7 Days' },
              { id: 'month', label: 'This Month' },
              { id: 'custom', label: 'Custom' }
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => setDateType(opt.id)}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${dateType === opt.id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button 
            onClick={handlePrint}
            className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all shadow-sm group"
            title="Print Report"
          >
            <Printer className="w-5 h-5 group-hover:text-indigo-600 transition-colors" />
          </button>
        </div>
      </div>

      {dateType === 'custom' && (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-center animate-in fade-in slide-in-from-top-2 no-print">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-bold text-slate-600">Period:</span>
          </div>
          <input 
            type="date" 
            value={customStart} 
            onChange={e => setCustomStart(e.target.value)}
            className="border border-slate-300 px-3 py-2 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all outline-none" 
          />
          <span className="text-slate-400 font-bold">to</span>
          <input 
            type="date" 
            value={customEnd} 
            onChange={e => setCustomEnd(e.target.value)}
            className="border border-slate-300 px-3 py-2 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all outline-none" 
          />
        </div>
      )}

      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <div 
            key={i} 
            className={`bg-white rounded-2xl p-6 shadow-sm border-2 transition-all duration-300 ${kpi.highlight ? 'border-indigo-500 bg-indigo-50/30' : 'border-transparent hover:border-slate-200'}`}
          >
            <div className={`p-3 rounded-xl inline-flex mb-4 ${
              kpi.color === 'blue' ? 'bg-blue-100 text-blue-600' : 
              kpi.color === 'green' ? 'bg-green-100 text-green-600' : 
              kpi.color === 'red' ? 'bg-red-100 text-red-600' : 
              'bg-indigo-100 text-indigo-600'
            }`}>
              <kpi.icon className="w-6 h-6" />
            </div>
            <p className="text-xs font-black text-slate-500 uppercase tracking-widest">{kpi.label}</p>
            <h3 className={`text-2xl font-black mt-1 ${
              kpi.color === 'red' ? 'text-red-600' : 
              kpi.color === 'green' ? 'text-green-600' : 
              'text-slate-900'
            }`}>{kpi.value}</h3>
            <p className="text-xs font-bold text-slate-400 mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Fee Income Breakdown by Type */}
      {feeItemTotals.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Fee Income by Type</h2>
              <p className="text-xs text-slate-400 mt-0.5">Breakdown of collected fees by line-item category</p>
            </div>
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
              {feeItemTotals.length} categories
            </span>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {feeItemTotals.map(({ item, amount }) => {
                const pct = totalIncome > 0 ? Math.round((amount / totalIncome) * 100) : 0;
                return (
                  <div key={item} className="flex flex-col gap-1 p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-bold text-slate-700">{item}</span>
                      <span className="text-xs font-black text-indigo-600 ml-2">Rs. {amount.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1">
                      <div
                        className="bg-indigo-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">{pct}% of total income</span>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400 mt-4">
              * Only transactions linked to specific invoices (via EasyFee or Student Fee Detail) show item-level breakdown.
              Older transactions show under general Fee Collection totals.
            </p>
          </div>
        </div>
      )}

      {/* Tabs & Data Tables */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex bg-slate-200/50 p-1 rounded-xl">
            {[
              { id: 'admissions', label: 'Students Enrolled', count: data.admissions.length },
              { id: 'income', label: 'Income Logs', count: data.income.length },
              { id: 'expenses', label: 'Expense Logs', count: data.expenses.length }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 text-xs font-black rounded-lg transition-all flex items-center gap-2 ${activeTab === tab.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {tab.label}
                <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === tab.id ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-300/50 text-slate-600'}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button 
              onClick={() => {
                const exportData = activeTab === 'admissions' ? data.admissions : activeTab === 'income' ? data.income : data.expenses;
                const title = `master-${activeTab}-report`;
                const headers = activeTab === 'admissions' 
                  ? [ { header: 'Name', key: 'full_name' }, { header: 'Roll', key: 'roll_number' }, { header: 'Class', key: (row: any) => row.classes?.name || '—' }, { header: 'Date', key: 'admission_date' } ]
                  : [ { header: 'Date', key: 'date' }, { header: 'Category', key: 'category' }, { header: 'Amount', key: (row: any) => row.amount }, { header: 'Mode', key: 'payment_mode' }, { header: 'Remarks', key: 'remarks' } ];
                exportToCSV(title, exportData, headers);
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-[10px] font-black rounded-lg hover:bg-slate-50 transition-all shadow-sm"
              title="Download CSV"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button 
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 border border-indigo-700 text-white text-[10px] font-black rounded-lg hover:bg-indigo-700 transition-all shadow-md"
              title="Download PDF"
            >
              <FileDown className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
              <p className="text-slate-500 font-bold text-sm">Synthesizing Report...</p>
            </div>
          ) : (
            <table className="w-full">
              {activeTab === 'admissions' && (
                <>
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Student Name</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Roll Number</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Class</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Admission Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.admissions.length === 0 ? (
                      <tr><td colSpan={4} className="px-6 py-20 text-center text-slate-400 italic">No students enrolled during this period.</td></tr>
                    ) : (
                      data.admissions.map(stu => (
                           <td className="px-6 py-4 font-bold text-slate-900">{stu.full_name}</td>
                          <td className="px-6 py-4 font-mono text-sm text-slate-600">#{stu.roll_number}</td>
                          <td className="px-6 py-4"><span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg font-bold text-xs">{stu.classes?.name || 'Unassigned'}</span></td>
                          <td className="px-6 py-4 text-sm text-slate-500 font-medium">{formatDate(stu.admission_date)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </>
              )}

              {(activeTab === 'income' || activeTab === 'expenses') && (
                <>
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Date</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Category</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Description</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Mode</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(activeTab === 'income' ? data.income : data.expenses).length === 0 ? (
                      <tr><td colSpan={5} className="px-6 py-20 text-center text-slate-400 italic">No {activeTab} logs found for this period.</td></tr>
                    ) : (
                      (activeTab === 'income' ? data.income : data.expenses).map(trans => (
                        <tr key={trans.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 text-sm text-slate-500 font-medium">{formatDate(trans.date)}</td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-lg font-bold text-xs ${activeTab === 'income' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                              {trans.category}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600 italic truncate max-w-xs">{trans.remarks || '—'}</td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">{trans.payment_mode}</td>
                          <td className={`px-6 py-4 text-right font-black ${activeTab === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                            {activeTab === 'income' ? '+' : '-'} Rs. {Number(trans.amount).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </>
              )}
            </table>
          )}
        </div>
      </div>

      {/* 
          NEW: UNIFIED PRINT VIEW 
          This section is hidden during normal browsing (hidden) but 
          triggers exclusively during window.print() (block print:block)
      */}
      <div className="hidden print:block bg-white p-8">
        {/* Letterhead */}
        <div className="flex justify-between items-center border-b-4 border-slate-900 pb-8 mb-10">
          <div className="flex items-center gap-6">
            {schoolInfo?.logo_url && (
              <img src={schoolInfo.logo_url} alt="Logo" className="w-20 h-20 object-contain p-1 border border-slate-100 rounded-xl" />
            )}
            <div>
              <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">{schoolInfo?.name || 'School Executive Report'}</h1>
              <p className="text-slate-500 font-bold mt-1 uppercase tracking-[0.2em] text-xs">{schoolInfo?.address || 'Official Campus Record'}</p>
              <div className="flex gap-4 mt-2 text-[10px] font-black text-slate-400">
                <span>TEL: {schoolInfo?.contact_phone || '—'}</span>
                <span>WEB: {schoolInfo?.website || '—'}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
                 <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Report Type</p>
                <p className="font-bold text-sm tracking-tight">EXECUTIVE SUMMARY</p>
             </div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date: {formatDate(new Date())}</p>
          </div>
        </div>

        <div className="flex justify-between items-end mb-8">
           <div>
              <h2 className="text-xl font-black text-slate-800 uppercase">Unified Executive Summary</h2>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Period: {dateType === 'custom' ? `${customStart} to ${customEnd}` : dateType}</p>
           </div>
           <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase">Generated On</p>
              <p className="text-sm font-bold text-slate-800">{formatDate(new Date())}</p>
           </div>
        </div>

        {/* Global KPI Summary */}
        <div className="grid grid-cols-4 gap-2 mb-10">
           {kpis.map((k, i) => (
             <div key={i} className="border border-slate-200 p-4 rounded-lg text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{k.label}</p>
                <p className="text-lg font-black text-slate-900">{k.value}</p>
             </div>
           ))}
        </div>

        {/* Sequential Sections */}
        <div className="space-y-12">
            {/* 1. Admissions */}
            <section>
              <h3 className="text-sm font-black text-slate-800 uppercase mb-3 flex items-center gap-2">
                <div className="w-2 h-4 bg-indigo-600 rounded-sm"></div> I. Student Enrollments ({data.admissions.length})
              </h3>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="border border-slate-200 px-3 py-2 text-left">Student Name</th>
                    <th className="border border-slate-200 px-3 py-2 text-left">Roll No</th>
                    <th className="border border-slate-200 px-3 py-2 text-left">Class</th>
                    <th className="border border-slate-200 px-3 py-2 text-left">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.admissions.map(s => (
                       <td className="border border-slate-200 px-3 py-2 font-bold">{s.full_name}</td>
                      <td className="border border-slate-200 px-3 py-2 font-mono">#{s.roll_number}</td>
                      <td className="border border-slate-200 px-3 py-2">{s.classes?.name || '—'}</td>
                      <td className="border border-slate-200 px-3 py-2">{formatDate(s.admission_date)}</td>
                    </tr>
                  ))}
                  {data.admissions.length === 0 && <tr><td colSpan={4} className="border border-slate-200 px-3 py-4 text-center italic text-slate-400">No enrollment records found.</td></tr>}
                </tbody>
              </table>
            </section>

            {/* 2. Income */}
            <section>
              <h3 className="text-sm font-black text-slate-800 uppercase mb-3 flex items-center gap-2">
                <div className="w-2 h-4 bg-green-600 rounded-sm"></div> II. Income & Fee Collections ({data.income.length})
              </h3>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="border border-slate-200 px-3 py-2 text-left">Date</th>
                    <th className="border border-slate-200 px-3 py-2 text-left">Category</th>
                    <th className="border border-slate-200 px-3 py-2 text-left">Description</th>
                    <th className="border border-slate-200 px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.income.map(i => (
                    <tr key={i.id}>
                      <td className="border border-slate-200 px-3 py-2">{formatDate(i.date)}</td>
                      <td className="border border-slate-200 px-3 py-2 font-bold text-green-700">{i.category}</td>
                      <td className="border border-slate-200 px-3 py-2 italic truncate max-w-xs">{i.remarks || '—'}</td>
                      <td className="border border-slate-200 px-3 py-2 text-right font-black">Rs. {Number(i.amount).toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-black">
                     <td colSpan={3} className="border border-slate-200 px-3 py-2 text-right">GROSS INCOME:</td>
                     <td className="border border-slate-200 px-3 py-2 text-right">Rs. {totalIncome.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </section>

            {/* 3. Expenses */}
            <section>
              <h3 className="text-sm font-black text-slate-800 uppercase mb-3 flex items-center gap-2">
                <div className="w-2 h-4 bg-red-600 rounded-sm"></div> III. Expense Registry ({data.expenses.length})
              </h3>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="border border-slate-200 px-3 py-2 text-left">Date</th>
                    <th className="border border-slate-200 px-3 py-2 text-left">Category</th>
                    <th className="border border-slate-200 px-3 py-2 text-left">Description</th>
                    <th className="border border-slate-200 px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.expenses.map(e => (
                    <tr key={e.id}>
                      <td className="border border-slate-200 px-3 py-2">{formatDate(e.date)}</td>
                      <td className="border border-slate-200 px-3 py-2 font-bold text-red-700">{e.category}</td>
                      <td className="border border-slate-200 px-3 py-2 italic truncate max-w-xs">{e.remarks || '—'}</td>
                      <td className="border border-slate-200 px-3 py-2 text-right font-black">Rs. {Number(e.amount).toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-black">
                     <td colSpan={3} className="border border-slate-200 px-3 py-2 text-right text-red-700">GROSS EXPENSE:</td>
                     <td className="border border-slate-200 px-3 py-2 text-right text-red-700">Rs. {totalExpenses.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </section>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-10 border-t-2 border-slate-900 grid grid-cols-2 gap-20">
            <div className="text-center">
               <div className="border-b border-slate-400 h-10 mb-2"></div>
               <p className="text-[10px] font-black text-slate-500 uppercase">Prepared By</p>
            </div>
            <div className="text-center">
               <div className="border-b border-slate-400 h-10 mb-2"></div>
               <p className="text-[10px] font-black text-slate-500 uppercase">Principal / Admin Signature</p>
            </div>
        </div>
      </div>
    </div>
  );
}
