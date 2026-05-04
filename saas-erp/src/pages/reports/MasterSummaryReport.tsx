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
  FileDown,
  BarChart3,
  PieChart,
  LayoutGrid,
  List,
  TrendingUp,
  Activity,
  CreditCard
} from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';
import { formatDate, formatDateTime, cn, getBase64Image } from '../../lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Card, Btn, Select, Input } from '../../components/ui';

interface ReportData {
  admissions: any[];
  income: any[];
  expenses: any[];
}

export default function MasterSummaryReport() {
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dateType, setDateType] = useState('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [data, setData] = useState<ReportData>({ admissions: [], income: [], expenses: [] });
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'admissions' | 'income' | 'expenses'>('admissions');
  const [viewType, setViewType] = useState<'table' | 'grid'>('table');

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
      startDate = endDate;
    }

    try {
      const [
        { data: admissions },
        { data: transactions },
        { data: school }
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
          .order('date', { ascending: false }),
        supabase.from('schools').select('*').eq('id', sid).single()
      ]);

      const income = (transactions || []).filter(t => t.type === 'income');
      const expenses = (transactions || []).filter(t => t.type === 'expense');

      setData({
        admissions: admissions || [],
        income: income || [],
        expenses: expenses || []
      });
      setSchoolInfo(school);
    } catch (err) {
      console.error('Error fetching report data:', err);
    } finally {
      setLoading(false);
    }
  }, [userRole?.school_id, dateType, customStart, customEnd]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalIncome = data.income.reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpenses = data.expenses.reduce((sum, t) => sum + Number(t.amount), 0);
  const netCashflow = totalIncome - totalExpenses;

  // Breakdown fee income by category/line-item
  const feeItemTotals = data.income
    .filter(t => t.category === 'Fee Collection' && t.remarks?.includes('—'))
    .reduce((acc: any[], t) => {
      const parts = t.remarks.split('—');
      const itemsPart = parts[parts.length - 1];
      const items = itemsPart.split(',').map((s: string) => s.trim());
      
      items.forEach((itemStr: string) => {
        const [name, amtStr] = itemStr.split(':').map(s => s.trim());
        if (!name || !amtStr) return;
        const amt = parseFloat(amtStr.replace(/[^\d.]/g, ''));
        if (isNaN(amt)) return;
        
        const existing = acc.find(x => x.item === name);
        if (existing) existing.amount += amt;
        else acc.push({ item: name, amount: amt });
      });
      return acc;
    }, [])
    .sort((a, b) => b.amount - a.amount);

  const handleExportPDF = async () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;

    if (schoolInfo?.logo_url) {
      try {
        const logoBase64 = await getBase64Image(schoolInfo.logo_url);
        doc.addImage(logoBase64, 'PNG', 14, 10, 25, 25);
      } catch (err) { console.warn(err); }
    }

    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(schoolInfo?.name || 'Executive Summary', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(schoolInfo?.address || '', pageWidth / 2, 28, { align: 'center' });
    
    doc.setFontSize(14);
    doc.text('Master Executive Summary Report', pageWidth / 2, 40, { align: 'center' });
    
    doc.setFontSize(9);
    doc.text(`Period: ${dateType === 'custom' ? `${customStart} to ${customEnd}` : dateType.toUpperCase()}`, 14, 48);
    doc.text(`Generated: ${formatDateTime(new Date())}`, pageWidth - 14, 48, { align: 'right' });

    // Summary Box
    doc.setFillColor(248, 250, 252);
    doc.rect(14, 52, pageWidth - 28, 20, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('KEY PERFORMANCE INDICATORS', 18, 58);
    doc.setFont('helvetica', 'normal');
    doc.text(`New Admissions: ${data.admissions.length}`, 18, 65);
    doc.text(`Total Income: Rs. ${totalIncome.toLocaleString()}`, 70, 65);
    doc.text(`Total Expenses: Rs. ${totalExpenses.toLocaleString()}`, 120, 65);
    doc.setFont('helvetica', 'bold');
    doc.text(`Net Cashflow: Rs. ${netCashflow.toLocaleString()}`, 170, 65, { align: 'right' });

    let currentY = 80;

    // Table
    const activeData = activeTab === 'admissions' ? data.admissions : activeTab === 'income' ? data.income : data.expenses;
    const headers = activeTab === 'admissions' 
      ? [['#', 'Student Name', 'Roll #', 'Class', 'Date']]
      : [['#', 'Date', 'Category', 'Description', 'Mode', 'Amount']];
    
    const tableBody = activeData.map((row, i) => {
      if (activeTab === 'admissions') return [i + 1, row.full_name, row.roll_number, row.classes?.name || '—', formatDate(row.admission_date)];
      return [i + 1, formatDate(row.date), row.category, row.remarks || '—', row.payment_mode, Number(row.amount).toLocaleString()];
    });

    autoTable(doc, {
      startY: currentY,
      head: headers,
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [13, 21, 38], textColor: 255 },
      styles: { fontSize: 8 },
      columnStyles: activeTab !== 'admissions' ? { 5: { halign: 'right' } } : {}
    });

    doc.save(`Executive_Summary_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleExportCSV = () => {
    const exportData = activeTab === 'admissions' ? data.admissions : activeTab === 'income' ? data.income : data.expenses;
    const title = `master-${activeTab}-report`;
    const headers = activeTab === 'admissions' 
      ? [ { header: 'Name', key: 'full_name' }, { header: 'Roll', key: 'roll_number' }, { header: 'Class', key: (row: any) => row.classes?.name || '—' }, { header: 'Date', key: 'admission_date' } ]
      : [ { header: 'Date', key: 'date' }, { header: 'Category', key: 'category' }, { header: 'Amount', key: (row: any) => row.amount }, { header: 'Mode', key: 'payment_mode' }, { header: 'Remarks', key: 'remarks' } ];
    exportToCSV(title, exportData, headers);
  };

  const kpis = [
    { label: 'New Admissions', value: data.admissions.length, icon: Users, color: 'indigo', sub: 'Total students enrolled' },
    { label: 'Total Income', value: `Rs. ${totalIncome.toLocaleString()}`, icon: ArrowDownCircle, color: 'emerald', sub: 'Revenue from all sources' },
    { label: 'Total Expenses', value: `Rs. ${totalExpenses.toLocaleString()}`, icon: ArrowUpCircle, color: 'rose', sub: 'Operational & fixed costs' },
    { label: 'Net Cashflow', value: `Rs. ${netCashflow.toLocaleString()}`, icon: Wallet, color: 'blue', sub: 'Available liquidity', highlight: true },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 space-y-3">
      {/* Control Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900 uppercase tracking-tight">Executive Summary</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-0.5">Cross-Domain Analytics</p>
          </div>
        </div>

        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
          <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            {[
              { id: 'today', label: 'Today' },
              { id: 'week', label: '7D' },
              { id: 'month', label: '1M' },
              { id: 'custom', label: 'Custom' }
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => setDateType(opt.id)}
                className={cn(
                  "px-3 py-1.5 text-[10px] font-black rounded-lg transition-all uppercase tracking-tighter",
                  dateType === opt.id ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          
          <div className="h-8 w-px bg-slate-200 mx-1 shrink-0" />
          
          <div className="flex items-center gap-2 shrink-0">
            <Btn variant="outline" size="sm" onClick={() => window.print()} className="text-[10px] h-9 px-3">
               <Printer className="w-3.5 h-3.5 mr-1" /> PRINT
            </Btn>
            <Btn variant="primary" size="sm" onClick={handleExportPDF} className="bg-indigo-600 hover:bg-indigo-700 text-[10px] h-9 px-3 font-black uppercase tracking-tighter">
               <FileDown className="w-3.5 h-3.5 mr-1" /> PDF SUMMARY
            </Btn>
          </div>
        </div>
      </div>

      {/* Custom Date Range (Conditional) */}
      {dateType === 'custom' && (
        <Card className="p-2 border-slate-100 animate-in fade-in slide-in-from-top-2">
           <div className="flex items-center gap-3 px-2">
              <Calendar className="w-4 h-4 text-indigo-500" />
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="text-xs font-bold border-none bg-slate-50 rounded-lg px-3 py-1.5 focus:ring-0" />
              <span className="text-[10px] font-black text-slate-300 uppercase">to</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="text-xs font-bold border-none bg-slate-50 rounded-lg px-3 py-1.5 focus:ring-0" />
              <Btn variant="ghost" size="xs" onClick={() => { setCustomStart(''); setCustomEnd(''); }} className="text-[9px] font-black text-slate-400">CLEAR</Btn>
           </div>
        </Card>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((kpi, i) => (
          <div 
            key={i} 
            className={cn(
              "bg-white rounded-2xl p-4 border transition-all relative overflow-hidden",
              kpi.highlight ? "border-indigo-600 shadow-md shadow-indigo-50" : "border-slate-100 shadow-sm"
            )}
          >
            <div className="flex justify-between items-start mb-2">
               <div className={cn("p-2 rounded-lg", 
                 kpi.color === 'indigo' ? "bg-indigo-50 text-indigo-600" :
                 kpi.color === 'emerald' ? "bg-emerald-50 text-emerald-600" :
                 kpi.color === 'rose' ? "bg-rose-50 text-rose-600" : "bg-blue-50 text-blue-600"
               )}>
                 <kpi.icon className="w-4 h-4" />
               </div>
               <Activity className="w-3 h-3 text-slate-200" />
            </div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{kpi.label}</p>
            <h3 className={cn("text-xl font-black tracking-tight", 
               kpi.color === 'emerald' ? "text-emerald-600" : 
               kpi.color === 'rose' ? "text-rose-600" : "text-slate-900"
            )}>{kpi.value}</h3>
            <p className="text-[9px] font-bold text-slate-400 mt-0.5 italic">{kpi.sub}</p>
            {kpi.highlight && <div className="absolute top-0 right-0 w-8 h-8 bg-indigo-600 transform rotate-45 translate-x-4 -translate-y-4 shadow-sm" />}
          </div>
        ))}
      </div>

      {/* Fee Income Breakdown */}
      {feeItemTotals.length > 0 && (
        <Card className="p-4 border-slate-100 shadow-sm">
           <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Revenue Breakdown</h3>
                <p className="text-[10px] text-slate-400 font-medium">Line-item analytics from collected fees</p>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full">
                 <TrendingUp className="w-3 h-3" />
                 <span className="text-[10px] font-black">{feeItemTotals.length} Categories</span>
              </div>
           </div>
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {feeItemTotals.slice(0, 8).map(({ item, amount }) => {
                const pct = totalIncome > 0 ? Math.round((amount / totalIncome) * 100) : 0;
                return (
                  <div key={item} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold text-slate-600 truncate mr-2">{item}</span>
                      <span className="text-[10px] font-black text-indigo-600 whitespace-nowrap">Rs. {amount.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1">
                      <div className="bg-indigo-500 h-1 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>
                );
              })}
           </div>
        </Card>
      )}

      {/* Main Content Area */}
      <Card className="overflow-hidden border-slate-100 shadow-sm">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
           <div className="flex bg-slate-200/50 p-0.5 rounded-xl">
             {[
               { id: 'admissions', label: 'Enrollments', count: data.admissions.length, icon: Users },
               { id: 'income', label: 'Income', count: data.income.length, icon: ArrowDownCircle },
               { id: 'expenses', label: 'Expenses', count: data.expenses.length, icon: ArrowUpCircle }
             ].map(tab => (
               <button
                 key={tab.id}
                 onClick={() => setActiveTab(tab.id as any)}
                 className={cn(
                   "px-4 py-1.5 text-[10px] font-black rounded-lg transition-all flex items-center gap-2 uppercase tracking-tighter",
                   activeTab === tab.id ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                 )}
               >
                 <tab.icon className="w-3 h-3" />
                 {tab.label}
                 <span className={cn(
                   "px-1.5 py-0.5 rounded-md text-[8px] font-black",
                   activeTab === tab.id ? "bg-indigo-100 text-indigo-600" : "bg-slate-300/50 text-slate-500"
                 )}>
                   {tab.count}
                 </span>
               </button>
             ))}
           </div>

           <div className="flex items-center gap-2">
             <div className="flex bg-slate-100 p-0.5 rounded-lg mr-2">
                <button onClick={() => setViewType('table')} className={cn("p-1.5 rounded-md", viewType === 'table' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400")}>
                  <List className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setViewType('grid')} className={cn("p-1.5 rounded-md", viewType === 'grid' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400")}>
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
             </div>
             <Btn variant="outline" size="xs" onClick={handleExportCSV} className="text-[9px] h-7 px-2 font-black uppercase">CSV</Btn>
             <Btn variant="outline" size="xs" onClick={handleExportPDF} className="text-[9px] h-7 px-2 font-black uppercase border-indigo-200 text-indigo-600">PDF</Btn>
           </div>
        </div>

        <div className="min-h-[400px]">
           {loading ? (
             <div className="py-20 text-center">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Compiling Analytics...</p>
             </div>
           ) : (
             <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                   <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                         {activeTab === 'admissions' ? (
                           <>
                             <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Student</th>
                             <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Roll #</th>
                             <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Class</th>
                             <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Admission Date</th>
                           </>
                         ) : (
                           <>
                             <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                             <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                             <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Remarks</th>
                             <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Mode</th>
                             <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                           </>
                         )}
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {(activeTab === 'admissions' ? data.admissions : activeTab === 'income' ? data.income : data.expenses).map((row: any) => (
                        <tr key={row.id} className="hover:bg-slate-50 transition-colors group">
                           {activeTab === 'admissions' ? (
                             <>
                               <td className="px-4 py-3 text-xs font-bold text-slate-900 uppercase">{row.full_name}</td>
                               <td className="px-4 py-3 text-xs font-bold text-slate-400">#{row.roll_number}</td>
                               <td className="px-4 py-3"><span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">{row.classes?.name || 'Unassigned'}</span></td>
                               <td className="px-4 py-3 text-xs text-slate-500 font-bold">{formatDate(row.admission_date)}</td>
                             </>
                           ) : (
                             <>
                               <td className="px-4 py-3 text-xs font-bold text-slate-500">{formatDate(row.date)}</td>
                               <td className="px-4 py-3">
                                 <span className={cn(
                                   "px-2 py-0.5 rounded text-[10px] font-black uppercase",
                                   activeTab === 'income' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                                 )}>
                                   {row.category}
                                 </span>
                               </td>
                               <td className="px-4 py-3 text-xs text-slate-400 italic max-w-xs truncate">{row.remarks || '—'}</td>
                               <td className="px-4 py-3 text-[10px] font-black text-slate-300 uppercase">{row.payment_mode}</td>
                               <td className={cn(
                                 "px-4 py-3 text-right text-xs font-black",
                                 activeTab === 'income' ? "text-emerald-600" : "text-rose-600"
                               )}>
                                 Rs. {Number(row.amount).toLocaleString()}
                               </td>
                             </>
                           )}
                        </tr>
                      ))}
                      {(activeTab === 'admissions' ? data.admissions : activeTab === 'income' ? data.income : data.expenses).length === 0 && (
                        <tr><td colSpan={10} className="px-4 py-20 text-center text-slate-300 font-bold text-sm uppercase">No records found for this period.</td></tr>
                      )}
                   </tbody>
                </table>
             </div>
           )}
        </div>
      </Card>
    </div>
  );
}
