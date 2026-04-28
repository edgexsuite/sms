import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Users, Search, Save, ArrowLeft, 
  ChevronDown, ChevronUp, Loader2, 
  AlertCircle, CheckCircle2, Filter,
  Tag, CreditCard
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';

interface StudentRow {
  id: string;
  full_name: string;
  roll_number: string;
  class_id: string;
  class_name: string;
  class_section: string;
  fee_waiver_percentage: number;
  tuition_fee: number;
  current_discount_amount: number;
  new_discount_amount: number;
  is_dirty: boolean;
}

export default function BulkDiscountEntry() {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [classes, setClasses] = useState<any[]>([]);

  useEffect(() => {
    if (userRole?.school_id) {
      fetchData();
    }
  }, [userRole?.school_id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Classes
      const { data: clsData } = await supabase
        .from('classes')
        .select('id, name, section')
        .eq('school_id', userRole?.school_id)
        .order('name');
      setClasses(clsData || []);

      // 2. Fetch Fee Structures (to get tuition fees)
      const { data: fsData } = await supabase
        .from('fee_structures')
        .select('class_id, amount, fee_matrix')
        .eq('school_id', userRole?.school_id);

      // 3. Fetch Students
      const { data: stuData } = await supabase
        .from('students')
        .select('id, full_name, roll_number, class_id, fee_waiver_percentage, classes(name, section)')
        .eq('school_id', userRole?.school_id)
        .eq('status', 'active')
        .order('class_id');

      if (stuData) {
        const rows: StudentRow[] = stuData.map(s => {
          const structure = fsData?.find(f => f.class_id === s.class_id);
          
          // Get Tuition Fee: either from fee_matrix.recurrent or the 'amount' field
          let tuition = 0;
          if (structure) {
            const matrix = structure.fee_matrix;
            if (matrix?.recurrent?.length) {
              // Try to find an item called 'Tuition' or just take the first recurring item if only one
              const tItem = matrix.recurrent.find((r: any) => r.item.toLowerCase().includes('tuition')) || matrix.recurrent[0];
              tuition = Number(tItem?.amount) || 0;
            } else {
              tuition = Number(structure.amount) || 0;
            }
          }

          const currentDiscount = Math.round(tuition * ((s.fee_waiver_percentage || 0) / 100));

          return {
            id: s.id,
            full_name: s.full_name,
            roll_number: s.roll_number,
            class_id: s.class_id,
            class_name: s.classes?.name || 'No Class',
            class_section: s.classes?.section || '',
            fee_waiver_percentage: s.fee_waiver_percentage || 0,
            tuition_fee: tuition,
            current_discount_amount: currentDiscount,
            new_discount_amount: currentDiscount,
            is_dirty: false
          };
        });
        
        // Sort by class name then roll number
        rows.sort((a, b) => {
          const clsCompare = a.class_name.localeCompare(b.class_name);
          if (clsCompare !== 0) return clsCompare;
          return (parseInt(a.roll_number) || 0) - (parseInt(b.roll_number) || 0);
        });

        setStudents(rows);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDiscountChange = (id: string, value: string) => {
    const amt = parseInt(value) || 0;
    setStudents(prev => prev.map(s => {
      if (s.id === id) {
        return { 
          ...s, 
          new_discount_amount: amt, 
          is_dirty: amt !== s.current_discount_amount 
        };
      }
      return s;
    }));
  };

  const handleSave = async () => {
    const dirtyRows = students.filter(s => s.is_dirty);
    if (dirtyRows.length === 0) return;

    setSaving(true);
    try {
      const updates = dirtyRows.map(s => {
        // Calculate percentage: (Discount / Tuition) * 100
        const pct = s.tuition_fee > 0 ? Math.min(100, Math.round((s.new_discount_amount / s.tuition_fee) * 100)) : 0;
        return supabase.from('students').update({
          fee_waiver_percentage: pct
        }).eq('id', s.id);
      });

      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);

      if (errors.length > 0) {
        alert(`Failed to save some records: ${errors[0].error?.message}`);
      } else {
        alert(`Successfully updated ${dirtyRows.length} student records.`);
        // Refresh local state to reset dirty flags
        setStudents(prev => prev.map(s => ({
          ...s,
          current_discount_amount: s.new_discount_amount,
          fee_waiver_percentage: s.tuition_fee > 0 ? Math.min(100, Math.round((s.new_discount_amount / s.tuition_fee) * 100)) : s.fee_waiver_percentage,
          is_dirty: false
        })));
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = (s.full_name || '').toLowerCase().includes(search.toLowerCase()) || 
                          (String(s.roll_number || '')).toLowerCase().includes(search.toLowerCase());
    const matchesClass = classFilter === 'all' || s.class_id === classFilter;
    return matchesSearch && matchesClass;
  });

  const dirtyCount = students.filter(s => s.is_dirty).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Syncing School Ledger...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
              <ArrowLeft className="w-5 h-5 text-slate-500" />
            </button>
            <div>
              <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">Bulk Discount Manager</h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Post-Migration Financial Hardening</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search students..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white focus:border-indigo-200 rounded-xl text-sm font-bold outline-none transition-all w-full md:w-64"
                />
             </div>
             <select 
               value={classFilter}
               onChange={e => setClassFilter(e.target.value)}
               className="bg-slate-100 border-transparent px-4 py-2 rounded-xl text-sm font-bold outline-none cursor-pointer"
             >
               <option value="all">All Classes</option>
               {classes.map(c => (
                 <option key={c.id} value={c.id}>{c.name} {c.section}</option>
               ))}
             </select>
             <button 
               onClick={handleSave}
               disabled={saving || dirtyCount === 0}
               className={cn(
                 "flex items-center gap-2 px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95",
                 dirtyCount > 0 
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700" 
                  : "bg-slate-200 text-slate-400 grayscale opacity-50"
               )}
             >
               {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
               Save {dirtyCount > 0 ? `(${dirtyCount})` : ''}
             </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/60 overflow-hidden border border-slate-100">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] w-24">Roll #</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em]">Student Name</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em]">Class</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-right">Tuition Fee</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-center w-48">Discount Amount (Rs.)</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-right">Net Fee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-slate-400">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p className="font-bold text-sm">No students found for this criteria</p>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s, idx) => {
                  const netFee = s.tuition_fee - s.new_discount_amount;
                  return (
                    <tr 
                      key={s.id} 
                      className={cn(
                        "group hover:bg-indigo-50/30 transition-colors",
                        s.is_dirty ? "bg-amber-50/50" : ""
                      )}
                    >
                      <td className="px-6 py-4 text-xs font-black text-slate-400">#{s.roll_number}</td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-black text-slate-800">{s.full_name}</p>
                        {s.is_dirty && (
                           <div className="flex items-center gap-1 mt-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Unsaved Changes</span>
                           </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-[10px] font-black text-slate-600 uppercase">
                          {s.class_name} {s.class_section}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="text-sm font-bold text-slate-500">Rs. {s.tuition_fee.toLocaleString()}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="relative max-w-[160px] mx-auto">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">Rs.</span>
                          <input 
                            type="number" 
                            value={s.new_discount_amount}
                            onChange={e => handleDiscountChange(s.id, e.target.value)}
                            className={cn(
                              "w-full pl-10 pr-4 py-2.5 rounded-xl text-center text-sm font-black outline-none transition-all",
                              s.is_dirty 
                                ? "bg-white border-2 border-amber-300 ring-4 ring-amber-100 shadow-sm" 
                                : "bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-200"
                            )}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-col items-end">
                           <p className={cn(
                             "text-lg font-black tracking-tighter",
                             netFee <= 0 ? "text-emerald-600" : "text-slate-900"
                           )}>
                             Rs. {netFee.toLocaleString()}
                           </p>
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                             {s.tuition_fee > 0 ? Math.min(100, Math.round((s.new_discount_amount / s.tuition_fee) * 100)) : 0}% WAIVER
                           </p>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Info Panel */}
      {dirtyCount > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
           <div className="bg-slate-900 text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-6 border border-white/10 backdrop-blur-xl">
              <div className="flex items-center gap-3 border-r border-white/10 pr-6">
                 <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
                    <Tag className="w-5 h-5" />
                 </div>
                 <div>
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest leading-none">Modified</p>
                    <p className="text-xl font-black mt-0.5">{dirtyCount} <span className="text-xs text-white/60">Students</span></p>
                 </div>
              </div>
              <button 
                onClick={handleSave}
                disabled={saving}
                className="bg-white text-slate-900 px-8 py-2.5 rounded-full font-black text-sm uppercase tracking-widest hover:bg-indigo-50 transition-all active:scale-95 flex items-center gap-2"
              >
                {saving ? 'Processing...' : 'Apply Changes'}
                <Save className="w-4 h-4" />
              </button>
           </div>
        </div>
      )}
    </div>
  );
}
