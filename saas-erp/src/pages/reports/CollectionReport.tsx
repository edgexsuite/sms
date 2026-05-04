import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  FileText, 
  Users, 
  Search,
  Printer,
  FileDown,
  Filter,
  Calendar,
  CreditCard,
  CheckCircle,
  AlertCircle,
  Download,
  LayoutGrid,
  List
} from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';
import { formatDate, formatDateTime, cn, getBase64Image } from '../../lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PageHeader, Card, Btn, Badge, Select, Input, SmartDateInput } from '../../components/ui';

interface FeeRecord {
  id: string;
  invoice_number: string;
  month_year: string;
  total_amount: number;
  paid_amount: number;
  status: string;
  due_date: string;
  paid_at: string | null;
  payment_mode: string | null;
  students: {
    full_name: string;
    roll_number: number;
    classes: {
      name: string;
      section: string;
    };
  };
}

export default function CollectionReport() {
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<FeeRecord[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);

  // Filters
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewType, setViewType] = useState<'table' | 'grid'>('table');

  const fetchMetadata = useCallback(async () => {
    if (!userRole?.school_id) return;
    const [
      { data: cls },
      { data: sch }
    ] = await Promise.all([
      supabase.from('classes').select('id, name, section').eq('school_id', userRole.school_id).order('name'),
      supabase.from('schools').select('*').eq('id', userRole.school_id).single()
    ]);
    if (cls) setClasses(cls);
    if (sch) setSchoolInfo(sch);
  }, [userRole?.school_id]);

  const fetchRecords = useCallback(async () => {
    if (!userRole?.school_id) return;
    setLoading(true);

    try {
      let query = supabase
        .from('fee_records')
        .select(`
          *,
          students (
            full_name,
            roll_number,
            classes (name, section)
          )
        `)
        .eq('school_id', userRole.school_id)
        .is('deleted_at', null)
        .order('month_year', { ascending: false });

      if (selectedClass) {
        query = query.eq('students.class_id', selectedClass);
      }
      if (selectedStatus !== 'all') {
        query = query.eq('status', selectedStatus);
      }
      if (selectedMonth) {
        query = query.eq('month_year', `${selectedMonth}-01`);
      }
      if (startDate) {
        query = query.gte('paid_at', `${startDate}T00:00:00Z`);
      }
      if (endDate) {
        query = query.lte('paid_at', `${endDate}T23:59:59Z`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Local filtering for student name/roll number and class (since join filtering in Supabase can be tricky)
      let filtered = (data || []) as FeeRecord[];
      
      if (selectedClass) {
        filtered = filtered.filter(r => (r.students as any)?.classes?.id === selectedClass || (r as any).students?.class_id === selectedClass);
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(r => 
          r.students?.full_name?.toLowerCase().includes(q) || 
          String(r.students?.roll_number).includes(q) ||
          r.invoice_number?.toLowerCase().includes(q)
        );
      }

      setRecords(filtered);
    } catch (err) {
      console.error('Error fetching collection records:', err);
    } finally {
      setLoading(false);
    }
  }, [userRole?.school_id, selectedClass, selectedStatus, selectedMonth, startDate, endDate, searchQuery]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const totalInvoiced = records.reduce((sum, r) => sum + Number(r.total_amount), 0);
  const totalCollected = records.reduce((sum, r) => sum + Number(r.paid_amount), 0);
  const totalBalance = totalInvoiced - totalCollected;

  const handleExportPDF = async () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;

    // Add Logo if available
    if (schoolInfo?.logo_url) {
      try {
        const logoBase64 = await getBase64Image(schoolInfo.logo_url);
        doc.addImage(logoBase64, 'PNG', 14, 10, 25, 25);
      } catch (err) {
        console.warn('Could not load school logo for PDF:', err);
      }
    }

    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(schoolInfo?.name || 'Collection Report', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(schoolInfo?.address || '', pageWidth / 2, 28, { align: 'center' });
    
    doc.setFontSize(14);
    doc.text('Detailed Fee Collection & Outstanding Report', pageWidth / 2, 40, { align: 'center' });
    
    doc.setFontSize(9);
    doc.text(`Generated on: ${formatDateTime(new Date())}`, pageWidth - 14, 48, { align: 'right' });

    const tableData = records.map((r, i) => [
      i + 1,
      r.students?.full_name || 'N/A',
      r.students?.roll_number || 'N/A',
      r.students?.classes ? `${r.students.classes.name}-${r.students.classes.section}` : 'N/A',
      formatDate(r.month_year),
      r.status.toUpperCase(),
      Number(r.total_amount).toLocaleString(),
      Number(r.paid_amount).toLocaleString(),
      (Number(r.total_amount) - Number(r.paid_amount)).toLocaleString()
    ]);

    autoTable(doc, {
      startY: 55,
      head: [['#', 'Student Name', 'Roll #', 'Class', 'Month', 'Status', 'Invoiced', 'Collected', 'Balance']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [13, 21, 38], textColor: 255 },
      styles: { fontSize: 8 },
      columnStyles: {
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'right' }
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Invoiced: Rs. ${totalInvoiced.toLocaleString()}`, 14, finalY);
    doc.text(`Total Collected: Rs. ${totalCollected.toLocaleString()}`, 14, finalY + 6);
    doc.text(`Total Balance: Rs. ${totalBalance.toLocaleString()}`, 14, finalY + 12);

    doc.save(`Collection_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleExportCSV = () => {
    const headers = [
      { header: 'Student Name', key: (r: any) => r.students?.full_name },
      { header: 'Roll #', key: (r: any) => r.students?.roll_number },
      { header: 'Class', key: (r: any) => r.students?.classes ? `${r.students.classes.name}-${r.students.classes.section}` : 'N/A' },
      { header: 'Month', key: (r: any) => formatDate(r.month_year) },
      { header: 'Status', key: 'status' },
      { header: 'Total Amount', key: 'total_amount' },
      { header: 'Paid Amount', key: 'paid_amount' },
      { header: 'Balance', key: (r: any) => r.total_amount - r.paid_amount },
      { header: 'Paid Date', key: (r: any) => r.paid_at ? formatDate(r.paid_at) : '-' },
      { header: 'Payment Mode', key: 'payment_mode' }
    ];
    exportToCSV('collection-report', records, headers);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 space-y-3">
      {/* Improved Compact Control Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
            <FileText className="w-5 h-5" />
          </div>
          <h1 className="text-base font-black text-slate-900 uppercase tracking-tight">Analytics</h1>
        </div>

        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
          {[
            { label: 'Invoiced', val: totalInvoiced, color: 'text-indigo-600', icon: CreditCard },
            { label: 'Collected', val: totalCollected, color: 'text-emerald-600', icon: CheckCircle },
            { label: 'Balance', val: totalBalance, color: 'text-rose-600', icon: AlertCircle },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 whitespace-nowrap min-w-[120px]">
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
          <div className="flex items-center gap-2 shrink-0">
            <Btn variant="outline" size="sm" onClick={handleExportCSV} className="text-[10px] h-9 px-3">CSV</Btn>
            <Btn variant="primary" size="sm" onClick={handleExportPDF} className="text-[10px] h-9 px-3 font-black">PDF REPORT</Btn>
          </div>
        </div>
      </div>

      {/* Rebalanced Grid Filter Bar */}
      <Card className="p-2 shadow-sm border-slate-100">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2 items-center">
          <div className="lg:col-span-2">
            <Input
              placeholder="Search student..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              icon={Search}
              className="h-9 text-[11px] font-bold"
            />
          </div>
          <div className="lg:col-span-1">
            <Select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="h-9 text-[11px] px-1 font-bold">
              <option value="">Class</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div className="lg:col-span-1">
            <Select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)} className="h-9 text-[11px] px-1 font-bold">
              <option value="all">Status</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="pending">Pending</option>
              <option value="overdue">Overdue</option>
            </Select>
          </div>
          <div 
            className="lg:col-span-1 relative group cursor-pointer"
            onClick={(e) => {
              const input = e.currentTarget.querySelector('input');
              if (input) (input as any).showPicker();
            }}
          >
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-indigo-500 transition-colors pointer-events-none z-10">
              <Calendar className="w-3.5 h-3.5" />
            </div>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="h-9 w-full bg-white border border-slate-200 rounded-lg pl-9 pr-2 text-[11px] font-bold outline-none group-hover:border-indigo-500 group-hover:ring-2 group-hover:ring-indigo-50/50 cursor-pointer [color-scheme:light] [&::-webkit-calendar-picker-indicator]:hidden"
            />
          </div>
          <div className="lg:col-span-4 flex items-center gap-1">
             <SmartDateInput value={startDate} onChange={setStartDate} className="h-9 text-[11px] w-full" />
             <span className="text-slate-300 text-[10px] font-black px-0.5">to</span>
             <SmartDateInput value={endDate} onChange={setEndDate} className="h-9 text-[11px] w-full" />
          </div>
          <div className="lg:col-span-3 flex items-center justify-end gap-2">
            <div className="flex bg-slate-100 p-0.5 rounded-lg shrink-0">
              {['today', 'week', 'month'].map(type => (
                <button
                  key={type}
                  onClick={() => {
                    const end = new Date(); const start = new Date();
                    if (type === 'week') start.setDate(end.getDate() - 7);
                    else if (type === 'month') start.setDate(1);
                    setStartDate(start.toISOString().split('T')[0]);
                    setEndDate(end.toISOString().split('T')[0]);
                  }}
                  className={cn(
                    "px-2 py-1 text-[8px] font-black uppercase rounded-md transition-all",
                    startDate === (type === 'month' ? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0] : (type === 'week' ? new Date(Date.now() - 7*86400000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]))
                      ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
            <Btn 
              variant="ghost" 
              size="xs" 
              onClick={() => {
                setSelectedClass(''); setSelectedStatus('all'); setSelectedMonth('');
                setStartDate(''); setEndDate(''); setSearchQuery('');
              }} 
              className="text-rose-500 hover:bg-rose-50 font-black uppercase tracking-tighter text-[10px] px-2 h-7"
            >
              Reset
            </Btn>
            
            <div className="h-6 w-px bg-slate-100" />
            
            <div className="flex bg-slate-100 p-0.5 rounded-lg shrink-0">
              <button onClick={() => setViewType('table')} className={cn("p-1.5 rounded-md transition-all", viewType === 'table' ? "bg-white shadow-sm text-indigo-600" : "text-slate-400")}>
                <List className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setViewType('grid')} className={cn("p-1.5 rounded-md transition-all", viewType === 'grid' ? "bg-white shadow-sm text-indigo-600" : "text-slate-400")}>
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Main Content */}
      {viewType === 'table' ? (
        <Card className="overflow-hidden border-none shadow-xl shadow-slate-200/50">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800">Student & Class</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800">Invoice Info</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800 text-right">Invoiced</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800 text-right">Paid</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                        <p className="text-sm font-bold text-slate-500">Generating Analytics...</p>
                      </div>
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center text-slate-400 italic font-medium">
                      No records found matching the current filters.
                    </td>
                  </tr>
                ) : (
                  records.map(record => {
                    const balance = Number(record.total_amount) - Number(record.paid_amount);
                    return (
                      <tr key={record.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-sm border border-indigo-100">
                              {record.students?.full_name[0]}
                            </div>
                            <div>
                              <p className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{record.students?.full_name}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                {record.students?.classes?.name} {record.students?.classes?.section} · #{record.students?.roll_number}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs font-black text-slate-700">{formatDate(record.month_year)}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{record.invoice_number}</p>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={
                            record.status === 'paid' ? 'success' : 
                            record.status === 'partial' ? 'warning' : 
                            record.status === 'overdue' ? 'danger' : 'secondary'
                          } className="text-[9px] uppercase tracking-widest font-black">
                            {record.status}
                          </Badge>
                          {record.paid_at && (
                            <p className="text-[9px] text-slate-400 mt-1 font-medium italic">
                              Paid: {formatDate(record.paid_at)}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="text-sm font-bold text-slate-900">Rs. {Number(record.total_amount).toLocaleString()}</p>
                        </td>
                        <td className="px-6 py-4 text-right text-emerald-600">
                          <p className="text-sm font-black">Rs. {Number(record.paid_amount).toLocaleString()}</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className={cn("text-sm font-black", balance > 0 ? "text-rose-600" : "text-emerald-600")}>
                            Rs. {balance.toLocaleString()}
                          </p>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {!loading && records.length > 0 && (
                <tfoot className="bg-slate-50 font-black text-slate-900">
                  <tr>
                    <td colSpan={3} className="px-6 py-4 text-right uppercase tracking-widest text-[10px] text-slate-500">Subtotals</td>
                    <td className="px-6 py-4 text-right">Rs. {totalInvoiced.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-emerald-600">Rs. {totalCollected.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-rose-600">Rs. {totalBalance.toLocaleString()}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
             <div className="col-span-full py-20 text-center">
                <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-sm font-bold text-slate-500">Generating Analytics...</p>
             </div>
          ) : records.length === 0 ? (
             <div className="col-span-full py-20 text-center text-slate-400 italic font-medium">
                No records found.
             </div>
          ) : (
            records.map(record => {
              const balance = Number(record.total_amount) - Number(record.paid_amount);
              return (
                <Card key={record.id} className="p-5 hover:shadow-xl transition-all border-none bg-white group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-lg border border-indigo-100">
                        {record.students?.full_name[0]}
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors truncate max-w-[150px]">{record.students?.full_name}</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {record.students?.classes?.name} · Roll #{record.students?.roll_number}
                        </p>
                      </div>
                    </div>
                    <Badge variant={
                      record.status === 'paid' ? 'success' : 
                      record.status === 'partial' ? 'warning' : 'danger'
                    } className="text-[9px]">
                      {record.status.toUpperCase()}
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-slate-50">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Invoice</span>
                      <span className="text-xs font-bold text-slate-700">{record.invoice_number} ({formatDate(record.month_year)})</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total</p>
                        <p className="text-sm font-black text-slate-900">Rs {Number(record.total_amount).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Paid</p>
                        <p className="text-sm font-black text-emerald-600">Rs {Number(record.paid_amount).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="pt-2">
                       <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={cn("h-full transition-all duration-500", record.status === 'paid' ? 'bg-emerald-500' : 'bg-indigo-500')} 
                            style={{ width: `${(Number(record.paid_amount) / Number(record.total_amount)) * 100}%` }}
                          />
                       </div>
                       <div className="flex justify-between items-center mt-2">
                          <span className="text-[9px] font-black text-slate-400 uppercase">Balance</span>
                          <span className={cn("text-xs font-black", balance > 0 ? "text-rose-600" : "text-emerald-600")}>
                            Rs {balance.toLocaleString()}
                          </span>
                       </div>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
