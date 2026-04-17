import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Users, Search, Filter, Download, Printer, 
  ChevronRight, ClipboardList, School, GraduationCap, 
  MapPin, Phone, User, Calendar, CreditCard, Layout
} from 'lucide-react';
import { cn } from '../../lib/utils';
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
  { key: 'roll_number', label: 'Roll No', category: 'Academic', default: true },
  { key: 'full_name', label: 'Student Name', category: 'Identity', default: true },
  { key: 'class_section', label: 'Class/Section', category: 'Academic', default: true },
  { key: 'father_name', label: 'Father Name', category: 'Family', default: true },
  { key: 'father_mobile', label: 'WhatsApp', category: 'Family', default: true },
  { key: 'family_number', label: 'Family ID', category: 'Family' },
  { key: 'gender', label: 'Gender', category: 'Identity' },
  { key: 'dob', label: 'DOB', category: 'Identity' },
  { key: 'admission_date', label: 'Adm. Date', category: 'Academic' },
  { key: 'status', label: 'Status', category: 'Academic' },
  { key: 'total_fee', label: 'Total Fee', category: 'Finance', default: true },
  { key: 'received_fee', label: 'Received', category: 'Finance', default: true },
  { key: 'balance_fee', label: 'Balance', category: 'Finance', default: true },
  { key: 'blood_group', label: 'Blood Group', category: 'Identity' },
  { key: 'address', label: 'Address', category: 'Identity' },
  { key: 'fee_waiver_percentage', label: 'Waiver %', category: 'Finance' },
];

export default function CustomStudentList() {
  const { userRole } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set(ALL_COLUMNS.filter(c => c.default).map(c => c.key)));
  
  // Filters
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [genderFilter, setGenderFilter] = useState('');
  const [familyFilter, setFamilyFilter] = useState('');

  useEffect(() => {
    if (userRole?.school_id) fetchClasses();
  }, [userRole]);

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('*').eq('school_id', userRole?.school_id).order('name');
    if (data) setClasses(data);
  };

  const fetchData = async () => {
    if (!userRole?.school_id) return;
    setLoading(true);
    setFetched(false);

    const needsFinance = ['total_fee', 'received_fee', 'balance_fee'].some(k => selectedColumns.has(k));

    let query = supabase
      .from('students')
      .select(`
        *,
        classes (name, section),
        parents (full_name, father_name, whatsapp_number, family_number)
      `)
      .eq('school_id', userRole.school_id);

    if (statusFilter) query = query.eq('status', statusFilter);
    if (classFilter) query = query.eq('class_id', classFilter);
    if (genderFilter) query = query.eq('gender', genderFilter);

    const { data: students, error } = await query.order('full_name');
    
    if (error) {
      console.error('Fetch Error:', error);
      setLoading(false);
      return;
    }

    if (!students) {
      setRows([]);
      setFetched(true);
      setLoading(false);
      return;
    }

    let filtered = students;
    if (familyFilter.trim()) {
      filtered = students.filter(s => {
        const parent = Array.isArray(s.parents) ? s.parents[0] : s.parents;
        return (
          parent?.father_name?.toLowerCase().includes(familyFilter.toLowerCase()) ||
          parent?.family_number?.toString().includes(familyFilter)
        );
      });
    }

    // Finance logic
    let feeMap = new Map();
    if (needsFinance && filtered.length > 0) {
      const { data: fees } = await supabase
        .from('fee_records')
        .select('student_id, total_amount, paid_amount')
        .in('student_id', filtered.map(s => s.id));
      
      fees?.forEach(f => {
        const cur = feeMap.get(f.student_id) || { total: 0, paid: 0 };
        cur.total += Number(f.total_amount || 0);
        cur.paid += Number(f.paid_amount || 0);
        feeMap.set(f.student_id, cur);
      });
    }

    const finalRows = filtered.map(s => {
      const parent = Array.isArray(s.parents) ? s.parents[0] : s.parents;
      const f = feeMap.get(s.id) || { total: 0, paid: 0 };
      return {
        id: s.id,
        student_unique_id: s.student_unique_id,
        roll_number: s.roll_number,
        full_name: s.full_name,
        class_section: s.classes ? `${(s.classes as any).name} ${(s.classes as any).section || ''}` : 'N/A',
        father_name: parent?.father_name || 'N/A',
        father_mobile: parent?.whatsapp_number || 'N/A',
        family_number: parent?.family_number || 'N/A',
        gender: s.gender,
        dob: s.dob,
        admission_date: s.admission_date,
        status: s.status,
        blood_group: s.blood_group,
        address: s.address,
        total_fee: f.total,
        received_fee: f.paid,
        balance_fee: Math.max(0, f.total - f.paid),
        fee_waiver_percentage: s.fee_waiver_percentage || 0,
      };
    });

    setRows(finalRows);
    setFetched(true);
    setLoading(false);
  };

  const toggleColumn = (key: string) => {
    const newSet = new Set(selectedColumns);
    if (newSet.has(key)) newSet.delete(key);
    else newSet.add(key);
    setSelectedColumns(newSet);
  };

  const exportPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFontSize(16);
    doc.text('Custom Student List', 148, 15, { align: 'center' });
    doc.setFontSize(8);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 148, 20, { align: 'center' });

    const activeCols = ALL_COLUMNS.filter(c => selectedColumns.has(c.key));
    const head = [activeCols.map(c => c.label)];
    const body = rows.map(r => activeCols.map(c => r[c.key]));

    autoTable(doc, {
      head,
      body,
      startY: 25,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [13, 21, 38] },
      theme: 'grid'
    });

    doc.save('student-list.pdf');
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      
      {/* ── Page Header ── */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-[#0d1526] flex items-center gap-2 uppercase tracking-tight">
            <ClipboardList className="w-7 h-7 text-indigo-600" /> Custom List Generator
          </h1>
          <p className="text-slate-500 text-sm mt-1">Design your own student lists and reports with real-time preview.</p>
        </div>
        <div className="flex gap-2">
          {fetched && rows.length > 0 && (
            <>
              <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-slate-200 transition-all border border-slate-200">
                <Printer className="w-4 h-4" /> Print View
              </button>
              <button onClick={exportPDF} className="flex items-center gap-2 px-5 py-2.5 bg-[#0d1526] text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-slate-800 transition-all shadow-lg shadow-indigo-100">
                <Download className="w-4 h-4" /> Download PDF
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* ── Left Sidebar: Configuration ── */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Filters Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-3 mb-2">
              <Filter className="w-4 h-4 text-indigo-600" /> List Filters
            </h3>
            
            <div className="space-y-3">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Class</label>
              <select value={classFilter} onChange={e => setClassFilter(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none">
                <option value="">All Classes</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
              </select>

              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Enrollment Status</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none">
                <option value="active">Active Students</option>
                <option value="left">Left / Withdrawn</option>
                <option value="graduated">Graduated/Alumni</option>
              </select>

              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Family / Parent Search</label>
              <input type="text" value={familyFilter} onChange={e => setFamilyFilter(e.target.value)} placeholder="Father Name or Family ID" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold outline-none" />
            </div>

            <button 
              onClick={fetchData} 
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
            >
              {loading ? 'Processing...' : <><Search className="w-4 h-4" /> Generate List</>}
            </button>
          </div>

          {/* Column Selector Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Layout className="w-4 h-4 text-indigo-600" /> Select Columns
            </h3>
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {['Identity', 'Academic', 'Family', 'Finance'].map(cat => (
                <div key={cat} className="mb-4">
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2 px-1">{cat}</p>
                  <div className="space-y-1">
                    {ALL_COLUMNS.filter(c => c.category === cat).map(col => (
                      <button
                        key={col.key}
                        onClick={() => toggleColumn(col.key)}
                        className={cn(
                          "w-full text-left px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-between",
                          selectedColumns.has(col.key) ? "bg-indigo-50 text-indigo-700 font-extrabold" : "text-slate-500 hover:bg-slate-50"
                        )}
                      >
                        {col.label}
                        {selectedColumns.has(col.key) && <ChevronRight className="w-3 h-3" />}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Main Content: Table Preview ── */}
        <div className="lg:col-span-3">
          {!fetched && !loading ? (
            <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 h-[600px] flex flex-col items-center justify-center text-center p-8">
              <div className="bg-indigo-50 p-6 rounded-full mb-4">
                <ClipboardList className="w-12 h-12 text-indigo-400" />
              </div>
              <h2 className="text-xl font-black text-[#0d1526] uppercase tracking-tight">Ready to Generate</h2>
              <p className="text-slate-400 max-w-sm mt-2">Adjust your filters and select columns from the sidebar, then click Generate to preview your custom student list.</p>
            </div>
          ) : loading ? (
            <div className="bg-white rounded-3xl border border-slate-200 h-[600px] flex flex-col items-center justify-center space-y-4">
               <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
               <p className="font-black text-slate-500 uppercase tracking-widest text-xs">Fetching Records...</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 h-[600px] flex flex-col items-center justify-center text-center p-8">
              <Search className="w-12 h-12 text-slate-200 mb-4" />
              <p className="text-slate-500 font-bold">No students found matching current filters.</p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden overflow-x-auto min-h-[600px]">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-[#0d1526] sticky top-0 z-10 transition-colors">
                  <tr>
                    <th className="px-4 py-4 font-black text-slate-400 uppercase tracking-widest border-b border-slate-800">Sr.</th>
                    {ALL_COLUMNS.filter(c => selectedColumns.has(c.key)).map(col => (
                      <th key={col.key} className="px-4 py-4 font-black text-slate-400 uppercase tracking-widest border-b border-slate-800 whitespace-nowrap">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row, idx) => (
                    <tr key={row.id} className={cn(
                      "group transition-all border-l-4",
                      row.fee_waiver_percentage >= 100 ? "bg-emerald-50/30 border-emerald-500 hover:bg-emerald-50/50" : "hover:bg-slate-50 border-transparent"
                    )}>
                      <td className="px-4 py-3.5 font-bold text-slate-300">{idx + 1}</td>
                      {ALL_COLUMNS.filter(c => selectedColumns.has(c.key)).map(col => (
                        <td key={col.key} className={cn(
                          "px-4 py-3.5 font-bold",
                          col.category === 'Finance' ? 'text-indigo-600' : 
                          col.key === 'full_name' ? 'text-slate-900 group-hover:text-indigo-600 transition-colors uppercase' : 'text-slate-700'
                        )}>
                          {col.key === 'fee_waiver_percentage' ? (
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[10px] uppercase font-black",
                              row[col.key] >= 100 ? "bg-emerald-500 text-white" : 
                              row[col.key] > 0 ? "bg-amber-100 text-amber-700" : "text-slate-400"
                            )}>
                              {row[col.key] >= 100 ? 'FREE' : row[col.key] > 0 ? `${row[col.key]}%` : '-'}
                            </span>
                          ) : col.category === 'Finance' ? `PKR ${Number(row[col.key]).toLocaleString()}` : row[col.key] || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {/* Table Footer Stats */}
              <div className="bg-slate-50 px-6 py-4 flex justify-between items-center border-t border-slate-200">
                <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Total Records: <span className="text-slate-900 ml-1">{rows.length}</span></span>
                {['total_fee', 'received_fee', 'balance_fee'].some(k => selectedColumns.has(k)) && (
                   <div className="flex gap-6">
                      <div className="text-right">
                         <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Total Fee</span>
                         <p className="text-sm font-black text-slate-900">PKR {rows.reduce((a, b) => a + (b.total_fee || 0), 0).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                         <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Balance</span>
                         <p className="text-sm font-black text-rose-600">PKR {rows.reduce((a, b) => a + (b.balance_fee || 0), 0).toLocaleString()}</p>
                      </div>
                   </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
