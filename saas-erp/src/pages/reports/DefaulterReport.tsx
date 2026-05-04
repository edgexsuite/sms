import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  FileText, 
  Search,
  Printer,
  FileDown,
  Calendar,
  AlertCircle,
  MessageSquare,
  Users,
  LayoutGrid,
  List,
  CreditCard
} from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';
import { formatDate, formatDateTime, cn, getBase64Image } from '../../lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Card, Btn, Select, Input } from '../../components/ui';

interface DefaulterRecord {
  student_id: string;
  student_name: string;
  roll_number: string;
  class_name: string;
  section: string;
  father_name: string;
  father_contact: string;
  total_pending: number;
  unpaid_months: string[];
}

export default function DefaulterReport() {
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [defaulters, setDefaulters] = useState<DefaulterRecord[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);

  // Filters
  const [selectedClass, setSelectedClass] = useState('');
  const [minBalance, setMinBalance] = useState('1');
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

  const fetchDefaulters = useCallback(async () => {
    if (!userRole?.school_id) return;
    setLoading(true);

    try {
      // 1. Fetch all unpaid fee records
      let query = supabase
        .from('fee_records')
        .select(`
          student_id,
          total_amount,
          paid_amount,
          month_year,
          students (
            id,
            full_name,
            roll_number,
            father_name,
            father_contact,
            class_id,
            classes (name, section)
          )
        `)
        .eq('school_id', userRole.school_id)
        .is('deleted_at', null)
        .neq('status', 'paid');

      const { data, error } = await query;
      if (error) throw error;

      // 2. Group by student
      const studentMap = new Map<string, DefaulterRecord>();

      (data || []).forEach((r: any) => {
        const student = r.students;
        if (!student) return;

        // Apply class filter if selected
        if (selectedClass && student.class_id !== selectedClass) return;

        const balance = Number(r.total_amount) - Number(r.paid_amount);
        if (balance <= 0) return;

        if (studentMap.has(student.id)) {
          const existing = studentMap.get(student.id)!;
          existing.total_pending += balance;
          existing.unpaid_months.push(formatDate(r.month_year));
        } else {
          studentMap.set(student.id, {
            student_id: student.id,
            student_name: student.full_name,
            roll_number: student.roll_number,
            class_name: student.classes?.name || 'N/A',
            section: student.classes?.section || '',
            father_name: student.father_name || 'N/A',
            father_contact: student.father_contact || '',
            total_pending: balance,
            unpaid_months: [formatDate(r.month_year)]
          });
        }
      });

      // 3. Convert to array and apply Min Balance + Search
      let result = Array.from(studentMap.values())
        .filter(d => d.total_pending >= Number(minBalance));

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        result = result.filter(d => 
          d.student_name.toLowerCase().includes(q) || 
          d.roll_number.toString().includes(q) ||
          d.father_name.toLowerCase().includes(q)
        );
      }

      setDefaulters(result.sort((a, b) => b.total_pending - a.total_pending));
    } catch (err) {
      console.error('Error fetching defaulters:', err);
    } finally {
      setLoading(false);
    }
  }, [userRole?.school_id, selectedClass, minBalance, searchQuery]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  useEffect(() => {
    fetchDefaulters();
  }, [fetchDefaulters]);

  const totalOutstanding = defaulters.reduce((sum, d) => sum + d.total_pending, 0);

  const handleExportPDF = async () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;

    if (schoolInfo?.logo_url) {
      try {
        const logoBase64 = await getBase64Image(schoolInfo.logo_url);
        doc.addImage(logoBase64, 'PNG', 14, 10, 25, 25);
      } catch (err) { console.warn(err); }
    }

    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(schoolInfo?.name || 'Defaulter Report', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(schoolInfo?.address || '', pageWidth / 2, 28, { align: 'center' });
    
    doc.setFontSize(14);
    doc.text('Defaulters & Outstanding Fees List', pageWidth / 2, 40, { align: 'center' });
    
    doc.setFontSize(9);
    doc.text(`Generated on: ${formatDateTime(new Date())}`, pageWidth - 14, 48, { align: 'right' });

    const tableData = defaulters.map((d, i) => [
      i + 1,
      d.student_name,
      d.roll_number,
      `${d.class_name}-${d.section}`,
      d.father_name,
      d.father_contact,
      d.unpaid_months.join(', '),
      d.total_pending.toLocaleString()
    ]);

    autoTable(doc, {
      startY: 55,
      head: [['#', 'Student Name', 'Roll #', 'Class', 'Father Name', 'Contact', 'Months', 'Balance']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [13, 21, 38], textColor: 255 },
      styles: { fontSize: 8 },
      columnStyles: { 7: { halign: 'right' } }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Outstanding: Rs. ${totalOutstanding.toLocaleString()}`, 14, finalY);

    doc.save(`Defaulters_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleExportCSV = () => {
    const headers = [
      { header: 'Student Name', key: 'student_name' },
      { header: 'Roll #', key: 'roll_number' },
      { header: 'Class', key: (d: any) => `${d.class_name}-${d.section}` },
      { header: 'Father Name', key: 'father_name' },
      { header: 'Contact', key: 'father_contact' },
      { header: 'Months', key: (d: any) => d.unpaid_months.join('|') },
      { header: 'Total Pending', key: 'total_pending' }
    ];
    exportToCSV('defaulters-report', defaulters, headers);
  };

  const sendWhatsApp = (d: DefaulterRecord) => {
    const contact = d.father_contact.replace(/\D/g, '');
    if (!contact) {
      alert('Father contact number not available.');
      return;
    }
    const message = encodeURIComponent(`Dear Parent,\n\nThis is a reminder from ${schoolInfo?.name || 'the school'} regarding outstanding fees for ${d.student_name} (${d.class_name}-${d.section}).\n\nTotal Pending: Rs. ${d.total_pending.toLocaleString()}\nMonths: ${d.unpaid_months.join(', ')}\n\nPlease clear the dues as soon as possible. Thank you.`);
    window.open(`https://wa.me/${contact.startsWith('0') ? '92' + contact.slice(1) : contact}?text=${message}`, '_blank');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 space-y-3">
      {/* Improved Compact Control Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 bg-rose-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-rose-100">
            <AlertCircle className="w-5 h-5" />
          </div>
          <h1 className="text-base font-black text-slate-900 uppercase tracking-tight">Defaulters</h1>
        </div>

        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
          <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 whitespace-nowrap min-w-[140px]">
             <div className="p-1.5 rounded-lg bg-white shadow-sm text-rose-600">
               <Users className="w-3.5 h-3.5" />
             </div>
             <div className="leading-tight">
               <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Defaulters</p>
               <p className="text-xs font-black text-rose-600">{defaulters.length} Students</p>
             </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 whitespace-nowrap min-w-[160px]">
             <div className="p-1.5 rounded-lg bg-white shadow-sm text-rose-600">
               <CreditCard className="w-3.5 h-3.5" />
             </div>
             <div className="leading-tight">
               <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Pending</p>
               <p className="text-xs font-black text-rose-600">Rs. {totalOutstanding.toLocaleString()}</p>
             </div>
          </div>
          <div className="h-8 w-px bg-slate-200 mx-1 shrink-0" />
          <div className="flex items-center gap-2 shrink-0">
            <Btn variant="outline" size="sm" onClick={handleExportCSV} className="text-[10px] h-9 px-3">CSV</Btn>
            <Btn variant="primary" size="sm" onClick={handleExportPDF} className="bg-rose-600 hover:bg-rose-700 text-[10px] h-9 px-3 font-black">PDF REPORT</Btn>
          </div>
        </div>
      </div>

      {/* Grid-Based Filter Bar */}
      <Card className="p-2 shadow-sm border-slate-100">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2 items-center">
          <div className="lg:col-span-3">
            <Input
              placeholder="Search student or father..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              icon={Search}
              className="h-9 text-[11px] font-bold"
            />
          </div>
          <div className="lg:col-span-2">
            <Select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="h-9 text-[11px] px-2 font-bold">
              <option value="">All Classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}-{c.section}</option>)}
            </Select>
          </div>
          <div className="lg:col-span-2">
            <Select value={minBalance} onChange={e => setMinBalance(e.target.value)} className="h-9 text-[11px] px-2 font-bold">
              <option value="1">Min. Balance: Any</option>
              <option value="1000">Min. Balance: 1,000</option>
              <option value="5000">Min. Balance: 5,000</option>
              <option value="10000">Min. Balance: 10,000</option>
            </Select>
          </div>
          
          <div className="lg:col-span-5 flex items-center justify-end gap-2">
            <Btn 
              variant="ghost" 
              size="xs" 
              onClick={() => {
                setSelectedClass(''); setMinBalance('1'); setSearchQuery('');
              }} 
              className="text-rose-500 hover:bg-rose-50 font-black uppercase tracking-tighter text-[10px] px-2 h-7"
            >
              Reset
            </Btn>
            <div className="h-6 w-px bg-slate-100" />
            <div className="flex bg-slate-100 p-0.5 rounded-lg shrink-0">
              <button onClick={() => setViewType('table')} className={cn("p-1.5 rounded-md transition-all", viewType === 'table' ? "bg-white shadow-sm text-rose-600" : "text-slate-400")}>
                <List className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setViewType('grid')} className={cn("p-1.5 rounded-md transition-all", viewType === 'grid' ? "bg-white shadow-sm text-rose-600" : "text-slate-400")}>
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Main Content */}
      <Card className="overflow-hidden border-slate-100 shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-bold text-sm">
             <div className="w-8 h-8 border-4 border-rose-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
             Analyzing fee records...
          </div>
        ) : defaulters.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-bold text-sm">
             No defaulters found based on current filters.
          </div>
        ) : viewType === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Student</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Roll #</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Class</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Father Details</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pending Months</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Outstanding</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {defaulters.map((d) => (
                  <tr key={d.student_id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-4 py-3">
                      <p className="text-xs font-bold text-slate-900 uppercase">{d.student_name}</p>
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-slate-500">{d.roll_number}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">{d.class_name}-{d.section}</span>
                    </td>
                    <td className="px-4 py-3 leading-tight">
                      <p className="text-xs font-bold text-slate-700">{d.father_name}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{d.father_contact}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {d.unpaid_months.slice(0, 3).map(m => (
                          <span key={m} className="px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded text-[9px] font-black">{m}</span>
                        ))}
                        {d.unpaid_months.length > 3 && <span className="text-[9px] text-slate-400 font-bold">+{d.unpaid_months.length - 3} more</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-black text-rose-600">
                      Rs. {d.total_pending.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                       <button 
                         onClick={() => sendWhatsApp(d)}
                         className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all shadow-sm active:scale-95"
                         title="Send WhatsApp Reminder"
                       >
                         <MessageSquare className="w-3.5 h-3.5" />
                       </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-3">
            {defaulters.map(d => (
              <div key={d.student_id} className="bg-slate-50 border border-slate-100 rounded-xl p-3 hover:shadow-md transition-all group">
                <div className="flex justify-between items-start mb-2">
                  <div className="leading-tight">
                    <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{d.student_name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{d.class_name}-{d.section}</p>
                  </div>
                  <button 
                    onClick={() => sendWhatsApp(d)}
                    className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-all"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>
                </div>
                
                <div className="space-y-2 mt-3">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-400 font-bold uppercase">Outstanding</span>
                    <span className="text-rose-600 font-black">Rs. {d.total_pending.toLocaleString()}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {d.unpaid_months.map(m => (
                      <span key={m} className="px-1.5 py-0.5 bg-white text-rose-500 border border-rose-100 rounded text-[8px] font-black uppercase tracking-tighter">{m}</span>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-slate-200">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Parent Info</p>
                    <p className="text-[11px] font-bold text-slate-700">{d.father_name}</p>
                    <p className="text-[10px] text-slate-500 font-medium">{d.father_contact}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
